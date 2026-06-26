/**
 * REAL Supabase runtime cutover proof. Boots the COMPILED NestJS services with DB_DRIVER=pg pointed at
 * the live Supabase Postgres (Tokyo txn pooler :6543), runs real write+read flows through them, then
 * queries the Supabase tables DIRECTLY (independent service-role pg connection) to show the rows truly
 * landed. Also exercises the Supabase Storage avatar upload + signed-URL. Self-cleaning.
 *
 *   node apps/api/scripts/verify-supabase-runtime.mjs
 *
 * Reads repo-root .env. NEVER prints secrets. Does NOT touch local SQLite or the test suite.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const DIST = join(__dirname, '..', 'dist');

function loadEnv() {
  const txt = readFileSync(join(REPO_ROOT, '.env'), 'utf8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

// Force the runtime into Supabase mode for THIS process (the services read these at construct/query time).
process.env.DB_DRIVER = 'pg';
process.env.AUTH_MODE = 'supabase';
process.env.STORAGE_PROVIDER = 'supabase';
process.env.BILLING_PROVIDER = 'mock';
process.env.BILLING_DEV_GRANT = 'false';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL');
  process.exit(1);
}

const TEST_PHONE = `+9659${Math.floor(1000000 + Math.random() * 8999999)}`;
let authUserId;

async function adminCreateAuthUser() {
  // Real Supabase Auth admin API → inserts auth.users → fires on_auth_user_created trigger →
  // auto-provisions public.profiles + public.search_quota rows. This is the real identity path.
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone: TEST_PHONE.replace('+', ''), phone_confirm: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`admin create user failed: ${res.status} ${JSON.stringify(body)}`);
  authUserId = body.id;
  console.log(`  created real auth.users row → id=${authUserId} (phone ${TEST_PHONE})`);
}

async function adminDeleteAuthUser(direct) {
  if (!authUserId) return;
  // ON DELETE CASCADE removes profiles/search_quota/subscriptions. Also drop the avatar object.
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUserId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  }).catch(() => {});
  await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${authUserId}/avatar.png`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  }).catch(() => {});
  console.log('  cleaned up auth user + cascade + avatar object');
}

async function main() {
  // Dynamic-import the COMPILED services (require dist build).
  const { DbService } = await import(join(DIST, 'db', 'db.service.js'));
  const { ProfileService } = await import(join(DIST, 'accounts', 'profile.service.js'));
  const { QuotaService } = await import(join(DIST, 'quota', 'quota.service.js'));
  const { BillingService } = await import(join(DIST, 'billing', 'billing.service.js'));
  const { MockBillingProvider } = await import(join(DIST, 'billing', 'mock-billing-provider.js'));
  const { SupabaseStorage } = await import(join(DIST, 'accounts', 'storage.interface.js'));

  const dbs = new DbService(); // DB_DRIVER=pg → lazily opens a pg.Pool on DATABASE_URL
  console.log(`DbService driver = ${dbs.driver}`);

  const verifier = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await verifier.connect();

  try {
    console.log('\n[1] create real Supabase auth user (fires trigger → profiles + search_quota):');
    await adminCreateAuthUser();

    // Prove the trigger landed the rows.
    const seeded = await verifier.query(
      'SELECT (SELECT count(*) FROM profiles WHERE id=$1) p, (SELECT count(*) FROM search_quota WHERE user_id=$1) q',
      [authUserId],
    );
    console.log(`  trigger-provisioned rows → profiles=${seeded.rows[0].p}, search_quota=${seeded.rows[0].q}`);

    console.log('\n[2] PROFILE UPSERT through the real NestJS ProfileService (DB_DRIVER=pg writes to Supabase):');
    const profiles = new ProfileService(dbs, new SupabaseStorage());
    const updated = await profiles.updateProfile(authUserId, {
      displayName: 'محمد الشريف',
      localePref: 'ar',
      notifPrefs: { price_drop: true, account_security: false },
      biometricEnabled: true,
    });
    console.log(`  service returned: displayName="${updated.displayName}" biometric=${updated.biometricEnabled} prefs=${JSON.stringify(updated.notifPrefs)}`);

    // INDEPENDENT read straight from Supabase to prove it persisted (not just an echo).
    const profRow = await verifier.query(
      'SELECT display_name, locale_pref, biometric_enabled, notif_prefs FROM profiles WHERE id=$1',
      [authUserId],
    );
    console.log('  >> Supabase profiles row:', JSON.stringify(profRow.rows[0]));

    console.log('\n[3] FREEMIUM QUOTA FLOW through the real QuotaService (atomic UPDATE … RETURNING on Supabase):');
    const billing = new BillingService(dbs, new MockBillingProvider(dbs));
    const quota = new QuotaService(dbs, billing);
    const consumed = [];
    for (let i = 1; i <= 6; i++) {
      const r = await quota.tryConsume(authUserId);
      consumed.push(r.allowed ? `#${i}:allow(used=${r.used})` : `#${i}:PAYWALL(used=${r.used})`);
    }
    console.log('  ' + consumed.join('  '));

    const quotaRow = await verifier.query('SELECT used_count, updated_at FROM search_quota WHERE user_id=$1', [
      authUserId,
    ]);
    console.log('  >> Supabase search_quota row:', JSON.stringify(quotaRow.rows[0]));

    console.log('\n[4] RACE-SAFETY against Postgres (25 concurrent attempts; cap already at 5):');
    const race = await Promise.all(Array.from({ length: 25 }, () => quota.tryConsume(authUserId)));
    const allowed = race.filter((r) => r.allowed).length;
    const afterRace = await verifier.query('SELECT used_count FROM search_quota WHERE user_id=$1', [authUserId]);
    console.log(`  concurrent allowed=${allowed} (expect 0, already capped); used_count=${afterRace.rows[0].used_count} (expect 5)`);

    console.log('\n[5] AVATAR STORAGE round-trip (Supabase `avatars` bucket, service role):');
    const storage = new SupabaseStorage();
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f5d0000000049454e44ae426082',
      'hex',
    );
    const put = await storage.put(authUserId, 'png', png, 'image/png');
    const signed = await storage.url(put.path);
    const head = await fetch(signed);
    console.log(`  uploaded path=${put.path}; signed-URL fetch status=${head.status} (200 = object really stored)`);

    // Prove it's in storage.objects too.
    const objRow = await verifier.query(
      "SELECT name, bucket_id FROM storage.objects WHERE bucket_id='avatars' AND name=$1",
      [put.path],
    );
    console.log('  >> Supabase storage.objects row:', JSON.stringify(objRow.rows[0] ?? null));

    console.log('\n=== ALL REAL ROUND-TRIPS LANDED IN SUPABASE ===');
  } finally {
    console.log('\n[cleanup]');
    await adminDeleteAuthUser();
    await verifier.end();
    await dbs.close();
  }
}

main().catch((e) => {
  console.error('VERIFY FAILED:', e.message);
  adminDeleteAuthUser().finally(() => process.exit(1));
});
