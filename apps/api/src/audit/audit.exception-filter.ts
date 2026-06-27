import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AuditRecorderService } from './audit-recorder.service';
import { redactString } from './audit.redact';
import { buildBodySummary, byteLen, extractActor, extractIpHash, extractRoute } from './audit.context';
import { randomUUID } from 'crypto';
import { AuditRow } from './audit.types';

/**
 * ADR-009 Slice C — global APP_FILTER. Catches ANY thrown exception, records the audit row for the
 * failure path (status_code + error_code + sanitized error_message), then DELEGATES to the default Nest
 * exception response so the client still gets the normal error body. De-dups with the interceptor via
 * `req.__auditRecorded` (filter records first → interceptor's tap skips). One row per request.
 *
 * The filter cannot use ExecutionContext (no getClass/getHandler on ArgumentsHost for route metadata in
 * the same way), so route is best-effort from the request; status/error_code come from the exception.
 */
@Catch()
export class AuditExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AuditExceptionFilter.name);

  constructor(
    private readonly recorder: AuditRecorderService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req: any = ctx.getRequest();
    const res: any = ctx.getResponse();

    // record the audit row (self-protecting — never let auditing change the error response).
    try {
      this.recordFailure(host, req, exception);
    } catch (err) {
      this.logger.error(`audit exception-filter record failed (non-blocking): ${(err as Error).message}`);
    }

    // delegate to default Nest error handling so the client gets the normal error response.
    const { httpAdapter } = this.httpAdapterHost;
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };
    try {
      res?.setHeader?.('x-request-id', req?.__auditRequestId ?? '');
    } catch {
      /* noop */
    }
    httpAdapter.reply(res, payload, status);
  }

  private recordFailure(host: ArgumentsHost, req: any, exception: unknown): void {
    if (req?.__auditRecorded) return;
    if (req) req.__auditRecorded = true;

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorCode =
      exception instanceof HttpException
        ? exception.constructor.name
        : (exception as Error)?.name ?? 'Error';
    const errorMessage = redactString((exception as Error)?.message ?? String(exception), 500);

    // route: try the Nest execution-context shape if present, else best-effort from request.
    let route = '';
    try {
      route = extractRoute(host as any);
    } catch {
      route = '';
    }
    const path = (req?.originalUrl ?? req?.url ?? '').split('?')[0];
    const requestId = req?.__auditRequestId ?? randomUUID();
    const start = req?.__auditStart;
    const { sector, query, requestSummary } = buildBodySummary(route || path, req?.body);

    const row: AuditRow = {
      id: requestId,
      ts: new Date().toISOString(),
      method: req?.method ?? 'UNKNOWN',
      path,
      route: route || path,
      statusCode: status,
      durationMs: typeof start === 'number' ? Date.now() - start : 0,
      actor: extractActor(req),
      ipHash: extractIpHash(req),
      userAgent: (req?.headers?.['user-agent'] as string) ?? null,
      sector,
      query,
      requestSummary,
      requestBytes: byteLen(req?.body),
      responseSummary: null,
      responseBytes: null,
      errorCode,
      errorMessage,
      requestId,
    };
    this.recorder.enqueue(row);
  }
}
