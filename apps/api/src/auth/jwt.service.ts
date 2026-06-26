import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

export interface AccessClaims {
  sub: string; // auth user id
  pseudo_id: string;
  iat: number;
  exp: number;
}

/**
 * Minimal HS256 JWT mint/verify for the LOCAL identity plane (mock mode). Zero deps (Node crypto).
 *
 * In Supabase prod (ADR-004 Decision 1) the access token is issued by Supabase Auth and NestJS
 * verifies it via JWKS (`SUPABASE_JWKS_URL`). This service is the swappable local issuer/verifier:
 * the AuthGuard depends only on `verifyAccess()` returning `{ sub, pseudo_id }`, so swapping in a
 * JWKS verifier later changes nothing downstream.
 */
@Injectable()
export class JwtService {
  private readonly secret = process.env.JWT_SECRET ?? 'dev-mock-jwt-secret-not-for-prod';
  private readonly accessTtlSec = 60 * 60; // ~1h (ADR-004 §Security)

  /** AUTH_MODE: 'local' (HS256 mock, DEFAULT) | 'supabase' (verify Supabase access tokens via JWKS). */
  private get mode(): 'local' | 'supabase' {
    return process.env.AUTH_MODE === 'supabase' ? 'supabase' : 'local';
  }

  /**
   * Async verification used by the AuthGuard. In 'local' mode this is the HS256 path below; in
   * 'supabase' mode it verifies a real Supabase access token via JWKS (dynamic import keeps the
   * crypto/fetch path out of the local hot path). Returns the same claims shape either way.
   */
  async verifyAccessAsync(token: string): Promise<AccessClaims> {
    if (this.mode === 'supabase') {
      const { verifySupabaseToken } = await import('./supabase-jwks');
      return verifySupabaseToken(token);
    }
    return this.verifyAccess(token);
  }

  private b64url(input: Buffer | string): string {
    return Buffer.from(input)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private sign(data: string): string {
    return this.b64url(createHmac('sha256', this.secret).update(data).digest());
  }

  signAccess(sub: string, pseudoId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const header = this.b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = this.b64url(
      JSON.stringify({ sub, pseudo_id: pseudoId, iat: now, exp: now + this.accessTtlSec }),
    );
    const body = `${header}.${payload}`;
    return `${body}.${this.sign(body)}`;
  }

  verifyAccess(token: string): AccessClaims {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('malformed token');
    const [header, payload, sig] = parts;
    const expected = this.sign(`${header}.${payload}`);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('bad signature');
    }
    let claims: AccessClaims;
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    } catch {
      throw new UnauthorizedException('bad payload');
    }
    if (!claims.sub || !claims.pseudo_id) throw new UnauthorizedException('missing claims');
    if (claims.exp && Math.floor(Date.now() / 1000) > claims.exp) {
      throw new UnauthorizedException('token expired');
    }
    return claims;
  }
}
