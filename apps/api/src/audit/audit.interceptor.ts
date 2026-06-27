import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditRecorderService } from './audit-recorder.service';
import { AuditRow } from './audit.types';
import {
  buildBodySummary,
  buildResponseSummary,
  byteLen,
  extractActor,
  extractIpHash,
  extractRoute,
} from './audit.context';

/**
 * ADR-009 Slice C — global APP_INTERCEPTOR. Captures one audit row per request, ON BOTH success and
 * error, OFF the request path (enqueue is fire-and-forget). Mints request_id (uuid) → x-request-id
 * header. De-dups with the exception filter via `req.__auditRecorded` so a request is recorded ONCE.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly recorder: AuditRecorderService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req: any = http.getRequest();
    const res: any = http.getResponse();

    const requestId = randomUUID();
    const start = Date.now();
    const ts = new Date().toISOString();

    // correlation id + start time on the request (filter reads both) + response header.
    req.__auditRequestId = requestId;
    req.__auditStart = start;
    try {
      res?.setHeader?.('x-request-id', requestId);
    } catch {
      /* header set must never break a request */
    }

    const route = extractRoute(context);
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    const { sector, query, requestSummary } = buildBodySummary(route, req.body);

    const base: Omit<AuditRow, 'statusCode' | 'durationMs' | 'responseSummary' | 'responseBytes' | 'errorCode' | 'errorMessage'> = {
      id: requestId,
      ts,
      method: req.method,
      path,
      route,
      actor: extractActor(req),
      ipHash: extractIpHash(req),
      userAgent: ((req.headers?.['user-agent'] as string) ?? null),
      sector,
      query,
      requestSummary,
      requestBytes: byteLen(req.body),
      requestId,
    };

    const record = (statusCode: number, responseBody: unknown, errorCode: string | null, errorMessage: string | null) => {
      if (req.__auditRecorded) return; // filter already recorded this request
      req.__auditRecorded = true;
      this.recorder.enqueue({
        ...base,
        statusCode,
        durationMs: Date.now() - start,
        responseSummary: errorCode ? null : buildResponseSummary(responseBody),
        responseBytes: errorCode ? null : byteLen(responseBody),
        errorCode,
        errorMessage,
      });
    };

    return next.handle().pipe(
      tap({
        next: (body) => record(res?.statusCode ?? 200, body, null, null),
        // the exception filter records the error row (it has the mapped status_code); skip here to
        // avoid a double-record. If for some reason no filter runs, finalize below covers it.
        error: () => undefined,
      }),
    );
  }
}
