import { UnauthorizedException } from '@nestjs/common';
import { createPublicKey, createVerify, verify as edVerify, KeyObject } from 'crypto';
import { AccessClaims } from './jwt.service';

/**
 * Supabase access-token verification via JWKS (AUTH_MODE=supabase). NestJS verifies a token ISSUED BY
 * Supabase Auth (the identity plane, ADR-004 Decision 1) instead of minting its own HS256.
 *
 * Zero deps (Node `crypto`): fetches `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`, caches the keys by
 * `kid`, and verifies RS256 (RSA) / ES256 (P-256) / EdDSA (Ed25519) — the algs Supabase uses for its
 * asymmetric signing keys. HS256 (legacy shared-secret) is intentionally NOT accepted here: a forged
 * token must be rejected. Checks `iss`, `exp`, and (if SUPABASE_JWT_AUD set) `aud`. Returns the same
 * `{ sub, pseudo_id }`-shaped claims the AuthGuard already consumes — downstream is unchanged.
 *
 * NOTE: Supabase puts the auth user id in `sub`. There is NO `pseudo_id` claim in a Supabase token; the
 * AuthGuard resolves sub → profiles.pseudo_id (a DB lookup) in supabase mode. So verify() returns
 * pseudo_id = '' and the guard fills it. This file ONLY does cryptographic token verification.
 */

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
}

let cache: { url: string; keys: Map<string, KeyObject>; fetchedAt: number } | undefined;
const JWKS_TTL_MS = 10 * 60 * 1000; // re-fetch keys at most every 10 min (rotation-tolerant)

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function jwkToKey(jwk: Jwk): KeyObject {
  // Node's createPublicKey accepts JWK directly (RSA / EC / OKP).
  return createPublicKey({ key: jwk as any, format: 'jwk' });
}

async function getKeys(supabaseUrl: string): Promise<Map<string, KeyObject>> {
  const url = process.env.SUPABASE_JWKS_URL ?? `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  if (cache && cache.url === url && Date.now() - cache.fetchedAt < JWKS_TTL_MS && cache.keys.size > 0) {
    return cache.keys;
  }
  const res = await fetch(url);
  if (!res.ok) throw new UnauthorizedException(`JWKS fetch failed (${res.status})`);
  const body = (await res.json()) as { keys: Jwk[] };
  const keys = new Map<string, KeyObject>();
  for (const jwk of body.keys ?? []) {
    try {
      keys.set(jwk.kid, jwkToKey(jwk));
    } catch {
      /* skip an unparseable key */
    }
  }
  cache = { url, keys, fetchedAt: Date.now() };
  return keys;
}

function verifySignature(alg: string, signingInput: string, sig: Buffer, key: KeyObject): boolean {
  if (alg === 'RS256') {
    return createVerify('RSA-SHA256').update(signingInput).verify(key, sig);
  }
  if (alg === 'ES256') {
    // JWS ES256 signature is raw r||s (64 bytes); Node verify wants DER. Convert.
    return createVerify('SHA256').update(signingInput).verify({ key, dsaEncoding: 'ieee-p1363' } as any, sig);
  }
  if (alg === 'EdDSA') {
    return edVerify(null, Buffer.from(signingInput), key, sig);
  }
  throw new UnauthorizedException(`unsupported JWT alg "${alg}"`);
}

export async function verifySupabaseToken(token: string): Promise<AccessClaims> {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) throw new UnauthorizedException('SUPABASE_URL not set (AUTH_MODE=supabase)');

  const parts = token.split('.');
  if (parts.length !== 3) throw new UnauthorizedException('malformed token');
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg: string; kid?: string };
  let payload: any;
  try {
    header = JSON.parse(b64urlToBuf(headerB64).toString('utf8'));
    payload = JSON.parse(b64urlToBuf(payloadB64).toString('utf8'));
  } catch {
    throw new UnauthorizedException('bad token encoding');
  }
  if (header.alg === 'HS256' || !header.kid) {
    // Reject symmetric / keyless tokens in supabase mode — only asymmetric JWKS keys are trusted.
    throw new UnauthorizedException('token not signed by a trusted Supabase key');
  }

  const keys = await getKeys(supabaseUrl);
  const key = keys.get(header.kid);
  if (!key) throw new UnauthorizedException('unknown signing key (kid)');

  const ok = verifySignature(header.alg, `${headerB64}.${payloadB64}`, b64urlToBuf(sigB64), key);
  if (!ok) throw new UnauthorizedException('bad signature');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new UnauthorizedException('token expired');
  const expectedIss = process.env.SUPABASE_JWT_ISSUER ?? `${supabaseUrl}/auth/v1`;
  if (payload.iss && payload.iss !== expectedIss) throw new UnauthorizedException('bad issuer');
  const expectedAud = process.env.SUPABASE_JWT_AUD;
  if (expectedAud && payload.aud && payload.aud !== expectedAud) throw new UnauthorizedException('bad audience');
  if (!payload.sub) throw new UnauthorizedException('missing sub');

  // pseudo_id is resolved from profiles by the guard (no such claim in a Supabase token).
  return { sub: payload.sub, pseudo_id: '', iat: payload.iat ?? now, exp: payload.exp ?? now };
}
