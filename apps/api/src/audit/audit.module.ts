import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditRecorderService } from './audit-recorder.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditExceptionFilter } from './audit.exception-filter';

/**
 * ADR-009 — @Global audit module. Registers the recorder (injectable everywhere), the global
 * APP_INTERCEPTOR (one row per request on success/error, mints x-request-id) and the global APP_FILTER
 * (records the error path + delegates to default Nest error handling). DbService comes from the @Global
 * AuthModule. No change to any existing controller — capture is automatic + total.
 */
@Global()
@Module({
  providers: [
    AuditRecorderService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: AuditExceptionFilter },
  ],
  exports: [AuditRecorderService],
})
export class AuditModule {}
