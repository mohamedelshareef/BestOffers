import { NormalizedOffer } from './provider-adapter.interface';

/**
 * Short-TTL offer cache (ADR-003 §4). Interface is Redis-ready; the default impl is in-memory so
 * the slice runs with no Redis locally. Swap `InMemoryOfferCache` for a Redis-backed impl (same
 * interface) for prod — `OffersService` depends only on `OfferCache`.
 *
 * Electronics price TTL ≈ 15 min (ADR-003 §4). A hit returns offers labeled source:"cache" upstream.
 */
export interface OfferCache {
  get(key: string): Promise<NormalizedOffer[] | null>;
  set(key: string, offers: NormalizedOffer[], ttlMs: number): Promise<void>;
}

/** Electronics price TTL — ADR-003 §4. */
export const ELECTRONICS_TTL_MS = 15 * 60 * 1000;

/** Food price TTL — ADR-005 §Lane-1 (promos are volatile → short ~5 min). */
export const FOOD_TTL_MS = 5 * 60 * 1000;

/** Social (Instagram) offer TTL — ADR-006 §2b. IG posts are static once posted → 6h (caps spend). */
export const SOCIAL_TTL_MS = 6 * 60 * 60 * 1000;

interface Entry {
  offers: NormalizedOffer[];
  expiresAt: number;
}

export class InMemoryOfferCache implements OfferCache {
  private readonly store = new Map<string, Entry>();

  async get(key: string): Promise<NormalizedOffer[] | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() >= e.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return e.offers;
  }

  async set(key: string, offers: NormalizedOffer[], ttlMs: number): Promise<void> {
    this.store.set(key, { offers, expiresAt: Date.now() + ttlMs });
  }

  /** test/util: clear all entries. */
  clear(): void {
    this.store.clear();
  }
}
