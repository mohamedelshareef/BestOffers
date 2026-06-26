import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { makeTestDb } from '../db/test-db';
import { AppModule } from '../app.module';

/**
 * Phase-2a end-to-end (mock mode, ZERO real keys): the headline flow —
 *   sign-in via mock OTP → search ×5 → hit the gate at #6 (402 PAYWALL) → mock-subscribe → unlimited.
 * Drives the real HTTP surface with MockOtpSender + MockBillingProvider + MockClaude. Offline.
 */
describe('Phase-2a E2E (mock OTP → search → paywall → subscribe → unlimited)', () => {
  let app: INestApplication;
  let access: string;
  let userId: string;
  const PHONE = '+96555512345';

  beforeAll(async () => {
    makeTestDb();
    process.env.OTP_PROVIDER = 'mock';
    process.env.OTP_DEV_CODE = '000000';
    process.env.BILLING_PROVIDER = 'mock';
    process.env.BILLING_DEV_GRANT = 'false';
    process.env.CLAUDE_PROVIDER = 'mock';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  const srv = () => app.getHttpServer();
  const bearer = () => ({ Authorization: `Bearer ${access}` });

  // Runs one full search to results (intent → skip clarifiers → cards/empty/402). Returns the HTTP res.
  async function runSearch(): Promise<request.Response> {
    const intent = await request(srv())
      .post('/search/intent')
      .set(bearer())
      .send({ sector: 'electronics', locale: 'en', intentRaw: 'iPhone 16 Pro 256GB' });
    if (intent.status === 402) return intent;
    let res = intent;
    let sid = intent.body.searchSessionId;
    let guard = 0;
    while (res.body.state === 'clarifying') {
      res = await request(srv())
        .post('/search/answer')
        .set(bearer())
        .send({ searchSessionId: sid, dimension: res.body.questions[0].dimension, answer: '__skip__' });
      if (res.status === 402) return res;
      if (guard++ > 5) throw new Error('clarifier did not terminate');
    }
    return res;
  }

  it('mock OTP sign-in issues a session + creates the profile', async () => {
    await request(srv())
      .post('/auth/otp/request')
      .send({ phoneE164: PHONE, locale: 'en' })
      .expect(201)
      .expect((r) => expect(r.body.sent).toBe(true));

    const verify = await request(srv())
      .post('/auth/otp/verify')
      .send({ phoneE164: PHONE, code: '000000' })
      .expect(201);
    expect(verify.body.isNewUser).toBe(true);
    access = verify.body.access;
    expect(access).toBeTruthy();

    const me = await request(srv()).get('/me').set(bearer()).expect(200);
    expect(me.body.pseudoId).toBe(verify.body.pseudoId);
    userId = me.body.id;
  });

  it('rejects /me without a token (auth guard)', async () => {
    await request(srv()).get('/me').expect(401);
  });

  it('allows 5 free searches, then 402 PAYWALL on #6', async () => {
    for (let i = 1; i <= 5; i++) {
      const res = await runSearch();
      expect(res.status).toBe(201);
      expect(['results', 'empty']).toContain(res.body.state);
      const q = await request(srv()).get('/me/quota').set(bearer()).expect(200);
      expect(q.body.used).toBe(i);
    }
    const sixth = await runSearch();
    expect(sixth.status).toBe(402);
    expect(sixth.body.error).toBe('PAYWALL');
    expect(sixth.body.limit).toBe(5);
  });

  it('mock-subscribe (checkout + webhook) flips to premium → unlimited searches', async () => {
    const checkout = await request(srv()).post('/billing/checkout').set(bearer()).expect(201);
    expect(checkout.body.url).toMatch(/^mock-checkout:/);

    // Simulate Stripe confirming the subscription (mock webhook = source of truth).
    await request(srv())
      .post('/billing/webhook')
      .send({ type: 'checkout.session.completed', userId })
      .expect(201)
      .expect((r) => expect(r.body.applied).toBe(true));

    const status = await request(srv()).get('/billing/status').set(bearer()).expect(200);
    expect(status.body.premium).toBe(true);

    // Now searches are unlimited and the counter is never touched (stays at 5).
    for (let i = 0; i < 3; i++) {
      const res = await runSearch();
      expect(res.status).toBe(201);
    }
    const q = await request(srv()).get('/me/quota').set(bearer()).expect(200);
    expect(q.body.premium).toBe(true);
    expect(q.body.used).toBe(5); // unchanged — premium bypass
  });
});
