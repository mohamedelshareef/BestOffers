import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Body, Controller, Get, Post, Module, BadRequestException } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SqliteDb } from '../db/sqlite-db';
import { DbService } from '../db/db.service';
import { AuditRecorderService } from './audit-recorder.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditExceptionFilter } from './audit.exception-filter';

/**
 * ADR-009 Slice C — global interceptor + exception filter, end-to-end against a real Nest app.
 * One row per request (success + error), correct route/status/duration/actor, x-request-id header,
 * and a hostile body/header (otp/phone/Authorization) NEVER lands in the row.
 */

@Controller('search')
class FakeSearchController {
  @Post('intent')
  intent(@Body() _b: unknown) {
    return { state: 'clarifying', questions: [1, 2, 3, 4, 5] };
  }
}

@Controller('auth/otp')
class FakeAuthController {
  @Post('verify')
  verify(@Body() _b: unknown) {
    // a fake verify that rejects a bad code (the error path)
    throw new BadRequestException('invalid code');
  }
}

@Controller('health')
class FakeHealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}

function freshSqlite(): Database.Database {
  const handle = new Database(':memory:');
  handle.pragma('foreign_keys = ON');
  const dir = join(__dirname, '..', 'db', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    handle.exec(readFileSync(join(dir, f), 'utf8'));
  }
  return handle;
}

describe('Audit interceptor + filter (e2e) — one row per request, redacted', () => {
  let app: INestApplication;
  let db: SqliteDb;
  let recorder: AuditRecorderService;

  beforeAll(async () => {
    const handle = freshSqlite();
    db = new SqliteDb(handle);
    // DbService stub backed by the in-memory sqlite (DI for the recorder)
    const dbStub = { run: db.run.bind(db), all: db.all.bind(db), get: db.get.bind(db) } as unknown as DbService;

    const moduleRef = await Test.createTestingModule({
      controllers: [FakeSearchController, FakeAuthController, FakeHealthController],
      providers: [
        { provide: DbService, useValue: dbStub },
        AuditRecorderService,
        { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
        { provide: APP_FILTER, useClass: AuditExceptionFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    recorder = moduleRef.get(AuditRecorderService);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  async function rows() {
    await recorder.flush();
    return db.all<Record<string, any>>('SELECT * FROM audit_trail ORDER BY ts');
  }

  it('records ONE row per request with route/status/duration + x-request-id header', async () => {
    const res = await request(app.getHttpServer())
      .post('/search/intent')
      .send({ sector: 'food', locale: 'ar', intentRaw: 'kfc' });
    expect(res.status).toBe(201);
    expect(res.headers['x-request-id']).toBeTruthy();

    const all = await rows();
    const r = all.filter((x) => x.route === '/search/intent');
    expect(r).toHaveLength(1); // de-dup: exactly one
    expect(r[0].method).toBe('POST');
    expect(r[0].status_code).toBe(201);
    expect(typeof r[0].duration_ms).toBe('number');
    expect(r[0].sector).toBe('food');
    expect(r[0].query).toBe('kfc');
    expect(r[0].path).toBe('/search/intent');
    expect(r[0].id).toBe(res.headers['x-request-id']);
  });

  it('records the ERROR path with error_code, status from the exception (filter)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phoneE164: '+96599887766', code: '654321' });
    expect(res.status).toBe(400); // client still gets the normal error response

    const all = await rows();
    const r = all.filter((x) => x.route === '/auth/otp/verify');
    expect(r).toHaveLength(1);
    expect(r[0].status_code).toBe(400);
    expect(r[0].error_code).toBe('BadRequestException');
    expect(r[0].error_message).toContain('invalid code');
    // auth route stores NO body summary
    expect(r[0].request_summary).toBeNull();
  });

  it('NEVER persists a secret/OTP/phone/token from headers or body in any row', async () => {
    await request(app.getHttpServer())
      .post('/search/intent')
      .set('Authorization', 'Bearer sk_live_TOPSECRET_should_not_log')
      .set('Cookie', 'session=abc; refresh_token=zzz')
      .send({ sector: 'food', locale: 'ar', intentRaw: 'my otp is 654321 call +96599887766', password: 'hunter2' });

    const all = await rows();
    const blob = JSON.stringify(all).toLowerCase();
    for (const forbidden of [
      'sk_live_topsecret', 'refresh_token=zzz', 'authorization', 'hunter2', '654321', '96599887766',
    ]) {
      expect(blob).not.toContain(forbidden.toLowerCase());
    }
  });

  it('health request records actor=anon, no sector/query', async () => {
    await request(app.getHttpServer()).get('/health');
    const all = await rows();
    const r = all.filter((x) => x.route === '/health');
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].actor).toBe('anon');
    expect(r[0].sector).toBeNull();
    expect(r[0].query).toBeNull();
    expect(r[0].status_code).toBe(200);
  });
});
