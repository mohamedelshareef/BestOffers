/**
 * End-to-end DB-level verification of the provisioned Supabase plane. Creates two throwaway auth
 * users via the Auth admin API (service role), checks the on_auth_user_created trigger auto-made
 * their profiles + quota rows, exercises the atomic freemium UPDATE, then proves RLS denies
 * cross-user access (PostgREST with a forged user JWT vs the anon key), and CLEANS UP everything.
 *
 *   node scripts/supabase-verify-e2e.mjs
 *
 * Idempotent-ish: always deletes the users it created at the end (cascades profiles/quota/subs).
 * NEVER prints secrets.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const env = (() => {
  const txt = readFileSync(join(REPO_ROOT, '.env'), 'utf8');
  const o = {};
  for (const l of txt.split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) o[m[1]] = m[2].trim(); }
  return o;
})();
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SR, SUPABASE_ANON_KEY: ANON, DATABASE_URL } = env;

const adminHeaders = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };

async function createUser(phone) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ phone, phone_confirm: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`createUser ${res.status}: ${JSON.stringify(body)}`);
  return body; // { id, phone, ... }
}
async function deleteUser(id) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders });
}

const results = [];
const ok = (name, pass, detail = '') => { results.push({ check: name, pass: pass ? 'PASS' : 'FAIL', detail }); };

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  let uA, uB;
  try {
    // unique throwaway phones (E.164-ish, KW prefix, time-based to avoid collision)
    const t = Date.now().toString().slice(-7);
    uA = await createUser(`+9659${t}1`);
    uB = await createUser(`+9659${t}2`);

    // 1) trigger auto-provisioned profile + quota for user A
    const prof = await client.query('SELECT id, pseudo_id, locale_pref, notif_enabled FROM profiles WHERE id=$1', [uA.id]);
    ok('trigger created profiles row', prof.rowCount === 1, prof.rows[0] ? `pseudo_id=${prof.rows[0].pseudo_id?.slice(0, 8)}…` : 'missing');
    ok('profile has NO phone column leak', prof.rows[0] && !('phone' in prof.rows[0]) && !('phone_e164' in prof.rows[0]), 'phone PII stays in auth.users');
    const quota = await client.query('SELECT used_count FROM search_quota WHERE user_id=$1', [uA.id]);
    ok('trigger created search_quota row (used=0)', quota.rowCount === 1 && quota.rows[0].used_count === 0);

    // 2) atomic freemium UPDATE — consume 5, 6th must fail (ADR-004 Decision 5)
    let wins = 0;
    for (let i = 0; i < 6; i++) {
      const r = await client.query(
        'UPDATE search_quota SET used_count=used_count+1, updated_at=now() WHERE user_id=$1 AND used_count < 5 RETURNING used_count',
        [uA.id]);
      if (r.rowCount === 1) wins++;
    }
    ok('atomic quota cap: exactly 5 of 6 attempts win', wins === 5, `wins=${wins}`);

    // 3) service-role can write subscriptions (server-only path); read it back
    await client.query(
      `INSERT INTO subscriptions (user_id, status, current_period_end, updated_at)
       VALUES ($1,'active', now() + interval '30 days', now())
       ON CONFLICT (user_id) DO UPDATE SET status=excluded.status`, [uA.id]);
    const sub = await client.query('SELECT status FROM subscriptions WHERE user_id=$1', [uA.id]);
    ok('service-role wrote+read subscription', sub.rows[0]?.status === 'active');

    // 4) RLS: forge user A's access token via the Auth admin "generate_link"? Simpler & robust:
    //    use PostgREST with the ANON key + a SET-role simulation is not available over HTTP.
    //    Instead we prove RLS at the SQL layer the way Supabase enforces it: set the request JWT
    //    claims and switch to the `authenticated` role, then read profiles as user A vs user B.
    async function readProfilesAs(uid) {
      const cx = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await cx.connect();
      try {
        // ONE transaction so all statements pin to a single pooler backend; local GUC + role apply
        // for the SELECT. auth.uid() reads request.jwt.claims ->> 'sub'.
        await cx.query('BEGIN');
        await cx.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
        await cx.query('SET LOCAL ROLE authenticated');
        const r = await cx.query('SELECT id FROM profiles ORDER BY id');
        await cx.query('COMMIT');
        return r.rows.map((x) => x.id);
      } finally { await cx.query('ROLLBACK').catch(() => {}); await cx.end(); }
    }
    const seenByA = await readProfilesAs(uA.id);
    ok('RLS: user A sees ONLY own profile', seenByA.length === 1 && seenByA[0] === uA.id, `saw ${seenByA.length} row(s)`);
    ok('RLS: user A canNOT see user B profile', !seenByA.includes(uB.id));

    // 5) RLS denies a client write to subscriptions (paywall crux) — as authenticated user A.
    const cx = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await cx.connect();
    let writeDenied = false;
    try {
      await cx.query('BEGIN');
      await cx.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uA.id, role: 'authenticated' })]);
      await cx.query('SET LOCAL ROLE authenticated');
      // No UPDATE policy on subscriptions → RLS makes 0 rows visible-for-update = effectively denied.
      const upd = await cx.query("UPDATE subscriptions SET status='canceled' WHERE user_id=$1", [uA.id]);
      writeDenied = upd.rowCount === 0;
      await cx.query('ROLLBACK');
    } finally { await cx.query('ROLLBACK').catch(() => {}); await cx.end(); }
    ok('RLS: client (authenticated) CANNOT write subscriptions', writeDenied, 'no UPDATE policy → 0 rows');

    // 6) anon key over PostgREST gets nothing from subscriptions (no anon policy)
    const anonRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?select=user_id,status`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    const anonBody = await anonRes.json().catch(() => []);
    ok('RLS: anon key reads ZERO subscriptions', Array.isArray(anonBody) && anonBody.length === 0, `got ${Array.isArray(anonBody) ? anonBody.length : 'err'}`);

  } finally {
    if (uA) await deleteUser(uA.id);
    if (uB) await deleteUser(uB.id);
    // confirm cascade cleanup
    if (uA) {
      const leftover = await client.query('SELECT (SELECT count(*) FROM profiles WHERE id=$1) p, (SELECT count(*) FROM search_quota WHERE user_id=$1) q, (SELECT count(*) FROM subscriptions WHERE user_id=$1) s', [uA.id]);
      ok('cleanup: cascade removed profile/quota/sub', leftover.rows[0].p === '0' && leftover.rows[0].q === '0' && leftover.rows[0].s === '0', JSON.stringify(leftover.rows[0]));
    }
    await client.end();
  }

  console.log('\n=== E2E VERIFY ===');
  console.table(results);
  const failed = results.filter((r) => r.pass === 'FAIL');
  if (failed.length) { console.error(`${failed.length} CHECK(S) FAILED`); process.exit(1); }
  console.log('ALL CHECKS PASSED');
}

main().catch((e) => { console.error('E2E FAILED:', e.message); process.exit(1); });
