import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { AuditRecorder, AuditRow } from './audit.types';
import { dropForbiddenKeys, redactString } from './audit.redact';

/**
 * ADR-009 Decision 2 — AuditRecorderService. Bounded async FIRE-AND-FORGET queue, batched insert
 * via the `Db` port (works in sqlite AND pg — `?` placeholders, rewritten for pg). Mirrors the
 * EventsService contract EXACTLY: enqueue() returns immediately and NEVER throws into the request;
 * a failed insert is logged, not propagated; backpressure DROPS the oldest row (never blocks).
 *
 * Self-protecting: its own failure can NEVER affect a request. Kill-switch AUDIT_ENABLED (default on).
 */
@Injectable()
export class AuditRecorderService implements AuditRecorder {
  private readonly logger = new Logger(AuditRecorderService.name);
  private readonly queue: AuditRow[] = [];
  private readonly enabled = process.env.AUDIT_ENABLED !== 'false';
  private readonly queueMax = Number(process.env.AUDIT_QUEUE_MAX ?? 5000);
  private readonly batchSize = 200;
  private dropped = 0;
  private draining = false;
  private pending: Promise<void> = Promise.resolve();

  constructor(private readonly db: DbService) {}

  /** Fire-and-forget. Returns immediately. NEVER throws into the caller. */
  enqueue(row: AuditRow): void {
    if (!this.enabled) return;
    try {
      // backpressure: protect memory, never block the request path.
      if (this.queue.length >= this.queueMax) {
        this.queue.shift(); // drop OLDEST
        this.dropped++;
        if (this.dropped % 500 === 1) {
          this.logger.warn(`audit queue full (>${this.queueMax}) — dropped ${this.dropped} rows`);
        }
      }
      this.queue.push(this.scrub(row));
      this.scheduleDrain();
    } catch (err) {
      // enqueue itself must never throw into the request.
      this.logger.error(`audit enqueue failed (non-blocking): ${(err as Error).message}`);
    }
  }

  /** Defense-in-depth final scrub: drop forbidden keys + scrub free-text values right before store. */
  private scrub(row: AuditRow): AuditRow {
    return {
      ...row,
      actor: redactString(row.actor, 128) ?? 'anon',
      userAgent: redactString(row.userAgent, 256),
      query: redactString(row.query, 200),
      errorMessage: redactString(row.errorMessage, 500),
      requestSummary: dropForbiddenKeys(row.requestSummary),
      responseSummary: dropForbiddenKeys(row.responseSummary),
    };
  }

  private scheduleDrain(): void {
    if (this.draining) return;
    this.draining = true;
    this.pending = (async () => {
      await Promise.resolve(); // yield: batch what arrives this tick
      try {
        while (this.queue.length) {
          const batch = this.queue.splice(0, this.batchSize);
          await this.insertBatch(batch);
        }
      } finally {
        this.draining = false;
      }
    })();
  }

  /** Single batched INSERT through the Db port. Self-protecting — a DB failure is logged, not thrown. */
  private async insertBatch(batch: AuditRow[]): Promise<void> {
    if (!batch.length) return;
    const cols = [
      'id', 'ts', 'method', 'path', 'route', 'status_code', 'duration_ms', 'actor', 'ip_hash',
      'user_agent', 'sector', 'query', 'request_summary', 'request_bytes', 'response_summary',
      'response_bytes', 'error_code', 'error_message', 'request_id',
    ];
    const rowPlaceholder = `(${cols.map(() => '?').join(',')})`;
    const sql = `INSERT INTO audit_trail (${cols.join(',')}) VALUES ${batch.map(() => rowPlaceholder).join(',')}`;
    const params: unknown[] = [];
    for (const r of batch) {
      params.push(
        r.id, r.ts, r.method, r.path, r.route, r.statusCode, r.durationMs, r.actor, r.ipHash,
        r.userAgent, r.sector, r.query,
        r.requestSummary ? JSON.stringify(r.requestSummary) : null, r.requestBytes,
        r.responseSummary ? JSON.stringify(r.responseSummary) : null, r.responseBytes,
        r.errorCode, r.errorMessage, r.requestId,
      );
    }
    try {
      await this.db.run(sql, params);
    } catch (err) {
      // NEVER propagate — the audit write failing must not affect any request.
      this.logger.error(`audit insert failed (non-blocking): ${(err as Error).message}`);
    }
  }

  /** tests only — await pending writes. */
  async flush(): Promise<void> {
    // run until the queue is fully drained (drain may re-schedule across ticks)
    for (let i = 0; i < 50; i++) {
      await this.pending;
      if (!this.queue.length && !this.draining) break;
      this.scheduleDrain();
    }
  }

  /** tests/health — count of dropped rows. */
  droppedCount(): number {
    return this.dropped;
  }
}
