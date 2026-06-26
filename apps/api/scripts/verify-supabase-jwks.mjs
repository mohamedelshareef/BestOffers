/**
 * REAL JWKS auth proof (AUTH_MODE=supabase). Mints a GENUINE Supabase access token (create a user +
 * password sign-in via the live Auth API), then runs it through the COMPILED JwtService.verifyAccessAsync
 * to show it is ACCEPTED, and shows a forged/HS256-signed token is REJECTED. Self-cleaning.
 *
 *   node apps/api/scripts/verify-supabase-jwks.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const DIST = join(__dirname, '..', 'dist');

(function loadEnv() {
  const txt = readFileSync(join(REPO_ROOT, '.env'), 'utf8');
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
})();
process.env.AUTH_MODE = 'supabase';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = process.env;
const email = `cutover_${Date.now()}@bestoffers.test`;
const password = `Pw!${Math.random().toString(36).slice(2)}A9`;
let userId;

async function createUser() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const b = await res.json();
  if (!res.ok) throw new Error(`create user: ${res.status} ${JSON.stringify(b)}`);
  userId = b.id;
}

async function signIn() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const b = await res.json();
  if (!res.ok) throw new Error(`sign-in: ${res.status} ${JSON.stringify(b)}`);
  return b.access_token;
}

async function cleanup() {
  if (!userId) return;
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  }).catch(() => {});
}

async function main() {
  const { JwtService } = await import(join(DIST, 'auth', 'jwt.service.js'));
  const jwt = new JwtService();

  await createUser();
  const realToken = await signIn();
  const alg = JSON.parse(Buffer.from(realToken.split('.')[0], 'base64url').toString()).alg;
  console.log(`Minted REAL Supabase access token (alg=${alg}, len=${realToken.length}) for ${email}`);

  // 1) Real Supabase token → ACCEPTED by the JWKS path.
  const claims = await jwt.verifyAccessAsync(realToken);
  console.log(`[ACCEPT] real Supabase token verified via JWKS → sub=${claims.sub} (matches user id: ${claims.sub === userId})`);

  // 2) Forged HS256 token (locally minted) → REJECTED in supabase mode.
  const forged = jwt.signAccess(userId, 'forged-pseudo');
  try {
    await jwt.verifyAccessAsync(forged);
    console.log('[FAIL] forged HS256 token was ACCEPTED — security hole!');
    process.exitCode = 1;
  } catch (e) {
    console.log(`[REJECT] forged HS256 token rejected: "${e.message}"`);
  }

  // 3) Tampered real token (corrupt the SIGNATURE) → REJECTED at the crypto verify (header/payload
  //    stay valid so it reaches verifySignature → proves the cryptographic check, not just parsing).
  const parts = realToken.split('.');
  const sig = parts[2];
  const flipped = sig.slice(0, -4) + (sig.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
  const tampered = `${parts[0]}.${parts[1]}.${flipped}`;
  try {
    await jwt.verifyAccessAsync(tampered);
    console.log('[FAIL] tampered token was ACCEPTED — security hole!');
    process.exitCode = 1;
  } catch (e) {
    console.log(`[REJECT] tampered token rejected: "${e.message}"`);
  }

  console.log('\n=== JWKS AUTH PATH VERIFIED AGAINST REAL SUPABASE TOKENS ===');
}

main()
  .catch((e) => {
    console.error('JWKS VERIFY FAILED:', e.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
