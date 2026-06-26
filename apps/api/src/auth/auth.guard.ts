import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from './jwt.service';

export interface AuthedUser {
  userId: string; // auth user id — the enforcement key for ownership + quota
  pseudoId: string; // the ONLY id that crosses into events
}

/** Express request augmented with the resolved auth context. */
export interface AuthedRequest {
  auth?: AuthedUser;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Verifies the Supabase-style access JWT (locally minted in mock mode; JWKS-verified in prod) and
 * attaches `{ userId, pseudoId }`. This is the RLS-equivalent boundary: every user-scoped handler
 * authorizes by `req.auth.userId`, so a caller can only ever touch its own rows (ADR-004 Decision 2).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['authorization'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw || !raw.startsWith('Bearer ')) throw new UnauthorizedException('missing bearer token');
    const claims = this.jwt.verifyAccess(raw.slice('Bearer '.length).trim());
    req.auth = { userId: claims.sub, pseudoId: claims.pseudo_id };
    return true;
  }
}
