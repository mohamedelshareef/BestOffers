import { ExecutionContext } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { normalizeProviderQuery } from '../offers/adapters/query-normalize';
import { ipHash, redactString, sanitizeObject } from './audit.redact';

/**
 * ADR-009 Slice C — route extraction + per-request field capture (the one spike).
 * VERIFIED (Nest 10): the matched route TEMPLATE is the controller's PATH_METADATA + the handler's
 * PATH_METADATA, joined — e.g. controller '@Controller("search")' + '@Post("intent")' → '/search/intent',
 * keeping the low-cardinality `:id` form (NOT the concrete value). This is the analytics key.
 */
export function extractRoute(ctx: ExecutionContext): string {
  try {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, ctx.getClass()) ?? '';
    const handlerPath = Reflect.getMetadata(PATH_METADATA, ctx.getHandler()) ?? '';
    const join = [controllerPath, handlerPath]
      .map((p: string) => String(p).replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .join('/');
    return '/' + join;
  } catch {
    return '';
  }
}

/** pseudoId from a guard-attached auth ctx, else 'anon'. NEVER phone/email/userId. */
export function extractActor(req: any): string {
  const pseudo = req?.auth?.pseudoId ?? req?.user?.pseudoId;
  if (typeof pseudo === 'string' && pseudo.length) return redactString(pseudo, 128) ?? 'anon';
  return 'anon';
}

/** First client IP (x-forwarded-for first hop, else socket), salted-hashed. Never the raw IP. */
export function extractIpHash(req: any): string | null {
  if (process.env.AUDIT_IP === 'off') return null;
  const salt = process.env.AUDIT_IP_SALT ?? 'dev-audit-salt';
  const xff = req?.headers?.['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : typeof xff === 'string' ? xff.split(',')[0] : undefined;
  const ip = (raw ?? req?.ip ?? req?.socket?.remoteAddress ?? '').toString().trim();
  return ipHash(ip || null, salt);
}

const SEARCH_SECTORS = new Set(['electronics', 'food', 'realestate']);

/**
 * Body summary + sector/query for the row — ALLOW-LIST per route family (deny-by-default).
 *   /search/*  → sector + {hasQuery:true}; the free-text intent goes through query-normalize + scrub
 *                into the dedicated `query` column (never the raw intentRaw — that's a forbidden key).
 *   auth/billing → NO body (only bytes). default unknown route → NO body.
 */
export function buildBodySummary(
  route: string,
  body: Record<string, unknown> | undefined,
): { sector: string | null; query: string | null; requestSummary: Record<string, unknown> | null } {
  const b = body ?? {};
  if (route.startsWith('/search')) {
    const sectorRaw = typeof b.sector === 'string' ? b.sector.toLowerCase() : null;
    const sector = sectorRaw && SEARCH_SECTORS.has(sectorRaw) ? sectorRaw : null;
    // intentRaw is on the never-log list as RAW free text; we store ONLY the normalized + scrubbed form.
    const raw = typeof b.intentRaw === 'string' ? b.intentRaw : '';
    let query: string | null = null;
    if (raw) {
      const sectorForNorm = sector === 'food' ? 'food' : 'electronics';
      let norm = raw;
      try {
        norm = normalizeProviderQuery(raw, sectorForNorm as 'food' | 'electronics');
      } catch {
        norm = raw;
      }
      query = redactString(norm, 200);
    }
    return {
      sector,
      query,
      requestSummary: sanitizeObject({ hasQuery: !!raw }, ['hasQuery']),
    };
  }
  // auth / billing / everything else → no body summary (deny-by-default), bytes only.
  return { sector: null, query: null, requestSummary: null };
}

/** Response shape only — counts/state enum, never the offers payload or any echoed input. */
export function buildResponseSummary(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const r = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof r.state === 'string') out.state = r.state;
  if (typeof r.status === 'string') out.status = r.status;
  if (Array.isArray(r.cards)) out.cards = r.cards.length;
  if (Array.isArray(r.questions)) out.questions = r.questions.length;
  if (Array.isArray(r.offers)) out.offers = r.offers.length;
  if (typeof r.coverageReason === 'string') out.coverageReason = r.coverageReason;
  return Object.keys(out).length ? out : null;
}

export function byteLen(v: unknown): number | null {
  if (v == null) return null;
  try {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return Buffer.byteLength(s, 'utf8');
  } catch {
    return null;
  }
}
