/**
 * Idempotent Supabase provisioner — applies the Postgres-ported schema + RLS into the Supabase
 * managed Postgres, creates the `avatars` Storage bucket, and verifies the result.
 *
 *   npm run db:supabase:push --workspace @bestoffers/api
 *
 * Safe to re-run (every DDL object is IF NOT EXISTS / DROP-then-CREATE). Reads the workspace-root
 * .env. NEVER prints secrets. Does NOT touch the local SQLite dev path or the test suite.
 *
 * NOTE: this provisions the production identity/user-data plane (ADR-004). It does NOT migrate the
 * NestJS runtime off better-sqlite3 — that cutover is scoped in supabase-runtime-cutover-plan.md.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const PG_DIR = join(__dirname, '..', 'src', 'db', 'postgres');

function loadEnv() {
  const txt = readFileSync(join(REPO_ROOT, '.env'), 'utf8');
  const env = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const DATABASE_URL = env.DATABASE_URL;
const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing DATABASE_URL / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

async function applyMigrations(client) {
  const files = readdirSync(PG_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = readFileSync(join(PG_DIR, f), 'utf8');
    await client.query(sql);
    console.log(`  applied ${f}`);
  }
}

async function ensureAvatarsBucket() {
  // Create the private `avatars` bucket via the Storage API (service role). Idempotent: a 409/
  // "already exists" is treated as success.
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: 'avatars',
      name: 'avatars',
      public: false,
      file_size_limit: 2 * 1024 * 1024, // ~2MB (ADR-004 Decision 2)
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
    }),
  });
  if (res.ok) {
    console.log('  avatars bucket: created');
    return;
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 409 || /exist/i.test(body?.message || '') || body?.error === 'Duplicate') {
    console.log('  avatars bucket: already exists (ok)');
    return;
  }
  throw new Error(`bucket create failed: ${res.status} ${JSON.stringify(body)}`);
}

async function verify(client) {
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
  );
  const rls = await client.query(
    `SELECT relname, relrowsecurity FROM pg_class
     WHERE relnamespace = 'public'::regnamespace AND relkind='r' AND relrowsecurity = true
     ORDER BY relname`,
  );
  const policies = await client.query(
    `SELECT schemaname, tablename, policyname, cmd FROM pg_policies
     WHERE schemaname IN ('public','storage')
       AND (tablename IN ('profiles','notification_tokens','subscriptions','search_quota')
            OR policyname LIKE 'avatars_%')
     ORDER BY schemaname, tablename, policyname`,
  );
  return { tables, rls, policies };
}

async function listBuckets() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) return [];
  return res.json();
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('connected to Supabase Postgres');
  try {
    console.log('applying migrations:');
    await applyMigrations(client);
    console.log('ensuring storage bucket:');
    await ensureAvatarsBucket();

    const { tables, rls, policies } = await verify(client);
    console.log('\n=== VERIFY ===');
    console.log(`public BASE tables (${tables.rowCount}):`);
    for (const r of tables.rows) console.log(`  - ${r.table_name}`);
    console.log(`\nRLS-enabled public tables (${rls.rowCount}):`);
    for (const r of rls.rows) console.log(`  - ${r.relname}`);
    console.log(`\npolicies (${policies.rowCount}):`);
    for (const r of policies.rows) console.log(`  - ${r.schemaname}.${r.tablename}: ${r.policyname} [${r.cmd}]`);
    const buckets = await listBuckets();
    console.log(`\nstorage buckets (${buckets.length}):`);
    for (const b of buckets) console.log(`  - ${b.id} (public=${b.public})`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('PUSH FAILED:', e.message);
  process.exit(1);
});
