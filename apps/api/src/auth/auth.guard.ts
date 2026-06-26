import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { DbService } from '../db/db.service';

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
  constructor(
    private readonly jwt: JwtService,
    private readonly dbs: DbService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['authorization'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw || !raw.startsWith('Bearer ')) throw new UnauthorizedException('missing bearer token');
    const claims = await this.jwt.verifyAccessAsync(raw.slice('Bearer '.length).trim());

    let pseudoId = claims.pseudo_id;
    // Supabase tokens carry no pseudo_id claim → resolve sub → profiles.pseudo_id (one query).
    if (!pseudoId) {
      const row = await this.dbs.get<{ pseudo_id: string }>('SELECT pseudo_id FROM profiles WHERE id=?', [
        claims.sub,
      ]);
      if (!row) throw new UnauthorizedException('no profile for this identity');
      pseudoId = row.pseudo_id;
    }
    req.auth = { userId: claims.sub, pseudoId };
    return true;
  }
}
