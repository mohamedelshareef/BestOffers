/**
 * Full HTTP authed round-trip against a RUNNING pg/supabase-mode API (on :3201). Mints a real Supabase
 * access token, then calls GET /me and GET /me/quota with it — proving the AuthGuard JWKS verify +
 * sub→pseudo_id resolution + pg reads all work end-to-end over the wire. Self-cleaning.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
(function loadEnv() {
  const txt = readFileSync(join(REPO_ROOT, '.env'), 'utf8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
})();
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = process.env;
const API = 'http://localhost:3201';
const email = `httpcheck_${Date.now()}@bestoffers.test`;
const password = `Pw!${Math.random().toString(36).slice(2)}A9`;
let userId;

async function createUser() {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const b = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(b));
  userId = b.id;
}
async function token() {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return (await r.json()).access_token;
}
async function cleanup() {
  if (userId) await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }).catch(() => {});
}

async function main() {
  await createUser();
  const t = await token();
  const auth = { Authorization: `Bearer ${t}` };

  const me = await fetch(`${API}/me`, { headers: auth });
  console.log(`GET /me  → ${me.status}  body=${(await me.text()).slice(0, 200)}`);

  const quota = await fetch(`${API}/me/quota`, { headers: auth });
  console.log(`GET /me/quota → ${quota.status}  body=${await quota.text()}`);

  const noAuth = await fetch(`${API}/me`);
  console.log(`GET /me (no token) → ${noAuth.status} (expect 401)`);

  const badToken = await fetch(`${API}/me`, { headers: { Authorization: 'Bearer not.a.token' } });
  console.log(`GET /me (garbage token) → ${badToken.status} (expect 401)`);
}
main().catch((e) => { console.error('HTTP CHECK FAILED:', e.message); process.exitCode = 1; }).finally(cleanup);
