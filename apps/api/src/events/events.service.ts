import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsEvent, EventType, PII_FORBIDDEN_KEYS } from '@bestoffers/shared';

/**
 * Anonymized event sink (S1-4 pipeline). FIRE-AND-FORGET: log() returns immediately and
 * NEVER blocks the request path (cross-cutting AC #3). The no-PII assertion is the validation
 * gate (defense-in-depth) — any payload carrying a forbidden key is dropped, not stored.
 *
 * For the slice this buffers in memory (so tests can assert what was emitted). Prod swaps the
 * enqueue for BullMQ → Postgres `events`; the log()/no-PII contract is unchanged.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly sink: AnalyticsEvent[] = [];

  log(e: { type: EventType; pseudoId: string; searchSessionId?: string; payload: Record<string, unknown> }): void {
    // fire-and-forget: do not await, do not throw into the caller.
    queueMicrotask(() => {
      try {
        const violating = this.findPii(e.payload);
        if (violating) {
          this.logger.warn(`dropped ${e.type} event — forbidden PII key "${violating}"`);
          return;
        }
        this.sink.push({ ...e, ts: new Date().toISOString() });
      } catch (err) {
        this.logger.error(`event log failed (non-blocking): ${(err as Error).message}`);
      }
    });
  }

  /** Returns the first forbidden key found (top-level + one level of nesting), or null. */
  private findPii(payload: Record<string, unknown>): string | null {
    const forbidden = new Set<string>(PII_FORBIDDEN_KEYS as readonly string[]);
    const scan = (obj: Record<string, unknown>): string | null => {
      for (const k of Object.keys(obj)) {
        if (forbidden.has(k)) return k;
        const v = obj[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const nested = scan(v as Record<string, unknown>);
          if (nested) return nested;
        }
      }
      return null;
    };
    return scan(payload);
  }

  /** Test/inspection helper — drains pending microtasks first via flush(). */
  drain(): AnalyticsEvent[] {
    return [...this.sink];
  }

  /** Await pending fire-and-forget writes (tests only). */
  async flush(): Promise<void> {
    await new Promise((r) => setTimeout(r, 0));
  }
}
