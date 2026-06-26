import { Injectable } from '@nestjs/common';
import { IntentNormalized, Locale, Sector } from '@bestoffers/shared';
import { randomUUID } from 'crypto';

/**
 * Ephemeral per-search session (system-design `search_sessions`).
 * In prod this lives in Redis (TTL'd). For the slice it's in-memory — same shape, swappable.
 * Holds the clarifier_state used to ENFORCE the ≤3 bound + never-re-ask in CODE.
 */
export interface SearchSession {
  id: string;
  pseudoId: string;
  /** Auth user id (ADR-004) — present when the request is authed; drives the freemium gate. */
  userId?: string;
  /** Set once a free search has been counted for this session (idempotent — refinements don't recount). */
  quotaConsumed?: boolean;
  sector: Sector;
  locale: Locale;
  intentRaw: string;
  intentNormalized: IntentNormalized;
  /** dimensions already asked — the never-re-ask guard set (AC C2.6). */
  askedDimensions: string[];
  /** answers recorded by dimension (chip value / free text / null = skipped). */
  answers: Record<string, string | null>;
  clarifierCount: number;
  status: 'clarifying' | 'results' | 'empty';
}

@Injectable()
export class SessionStore {
  private readonly sessions = new Map<string, SearchSession>();

  create(input: {
    pseudoId: string;
    userId?: string;
    sector: Sector;
    locale: Locale;
    intentRaw: string;
    intentNormalized: IntentNormalized;
  }): SearchSession {
    const session: SearchSession = {
      id: randomUUID(),
      pseudoId: input.pseudoId,
      userId: input.userId,
      sector: input.sector,
      locale: input.locale,
      intentRaw: input.intentRaw,
      intentNormalized: input.intentNormalized,
      askedDimensions: [],
      answers: {},
      clarifierCount: 0,
      status: 'clarifying',
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): SearchSession | undefined {
    return this.sessions.get(id);
  }

  save(session: SearchSession): void {
    this.sessions.set(session.id, session);
  }
}
