import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { makeTestDb } from '../db/test-db';
import { AppModule } from '../app.module';

/**
 * Walking-skeleton smoke test (S2-3) over the real HTTP surface with the MOCK Claude client
 * (offline, no API key). Drives the demoable spine: intent → clarifier → answer → ranked cards.
 */
describe('POST /search (walking skeleton, mock Claude)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Isolated, per-suite migrated DB (SQLITE_PATH set BEFORE module compile) so this smoke test
    // never shares dev.sqlite with a live dev server / other suites. Offers resolve from the
    // in-memory fixture (Slice-2 stub), so a migrated-but-unseeded DB is sufficient for ranked cards.
    makeTestDb();
    process.env.CLAUDE_PROVIDER = 'mock';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('health endpoint is up', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('vague intent → clarifier question, then answers → ranked cards', async () => {
    const intent = await request(app.getHttpServer())
      .post('/search/intent')
      .send({ sector: 'electronics', locale: 'en', intentRaw: 'iPhone 17 Pro Max', pseudoId: 'e2e1' })
      .expect(201);

    expect(intent.body.state).toBe('clarifying');
    expect(intent.body.questions).toHaveLength(1);
    const sid = intent.body.searchSessionId;

    // answer storage = 256GB
    let res = await request(app.getHttpServer())
      .post('/search/answer')
      .send({ searchSessionId: sid, dimension: intent.body.questions[0].dimension, answer: '256GB', pseudoId: 'e2e1' })
      .expect(201);

    // keep answering/skip until results
    let guard = 0;
    while (res.body.state === 'clarifying') {
      res = await request(app.getHttpServer())
        .post('/search/answer')
        .send({ searchSessionId: sid, dimension: res.body.questions[0].dimension, answer: '__skip__', pseudoId: 'e2e1' })
        .expect(201);
      if (guard++ > 5) throw new Error('clarifier did not terminate');
    }

    expect(res.body.state).toBe('results');
    const cards = res.body.cards;
    expect(cards.length).toBeGreaterThanOrEqual(2);

    // each card carries the contract fields (image, why, price KWD, provider, deeplink)
    for (const c of cards) {
      expect(c.productName).toBeTruthy();
      expect(typeof c.priceFils).toBe('number');
      expect(c.priceLabel).toMatch(/KWD$/);
      expect(c.providerName).toBeTruthy();
      expect(c.deeplinkUrl).toMatch(/^https:\/\//);
      expect(c.whyEn).toBeTruthy();
      expect(c.whyAr).toBeTruthy();
      expect(c.whyCitedAttribute.value).not.toBe('');
    }
    // ranked: cheapest in-stock first
    expect(cards[0].providerName).toBe('Eureka');
  });
});
