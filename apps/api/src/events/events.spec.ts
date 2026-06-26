import { EventsService } from './events.service';
import { formatFils, kwdToFils } from '@bestoffers/shared';

/**
 * Privacy wall (S1-4 / cross-cutting AC #3): only pseudo_id + bucketed values enter events;
 * any forbidden PII key is DROPPED at the sink. Logging is fire-and-forget (non-blocking).
 */
describe('EventsService — no-PII gate (AC cross-cutting #3)', () => {
  it('stores a clean, bucketed event', async () => {
    const svc = new EventsService();
    svc.log({ type: 'search_executed', pseudoId: 'p', payload: { source: 'cache', latency_ms: 12 } });
    await svc.flush();
    expect(svc.drain()).toHaveLength(1);
    expect(svc.drain()[0].pseudoId).toBe('p');
  });

  it('drops an event carrying a forbidden PII key (top-level)', async () => {
    const svc = new EventsService();
    svc.log({ type: 'intent_submitted', pseudoId: 'p', payload: { phone_e164: '+96550000000' } });
    await svc.flush();
    expect(svc.drain()).toHaveLength(0);
  });

  it('drops an event carrying a forbidden key nested one level deep', async () => {
    const svc = new EventsService();
    svc.log({ type: 'intent_submitted', pseudoId: 'p', payload: { meta: { intentRaw: 'my number is 12345' } } });
    await svc.flush();
    expect(svc.drain()).toHaveLength(0);
  });

  it('log() never throws into the caller (fire-and-forget)', () => {
    const svc = new EventsService();
    expect(() => svc.log({ type: 'card_tapped', pseudoId: 'p', payload: { provider: 'x' } })).not.toThrow();
  });
});

describe('money: fils integer arithmetic', () => {
  it('formats fils as KWD with 3 decimals', () => {
    expect(formatFils(419500)).toBe('419.500 KWD');
    expect(formatFils(5)).toBe('0.005 KWD');
    expect(formatFils(1000)).toBe('1.000 KWD');
  });
  it('round-trips KWD → fils', () => {
    expect(kwdToFils(152.5)).toBe(152500);
  });
});
