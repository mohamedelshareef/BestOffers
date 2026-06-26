/**
 * provider_url_cache (ADR-005 Slice F-1): a short-lived map from a provider's discovery key
 * (e.g. a Talabat restaurant slug) to a stable id (the vendorId) so repeat queries skip the page
 * round-trip. Interface is Redis/Postgres-table-ready; the default impl is in-memory so the slice
 * runs with no external store locally (same pattern as `OfferCache`).
 *
 * TTL ≈ 24h (discovery ids are stable far longer than prices — only the price menu is short-TTL).
 */
export interface ProviderUrlCache {
  get(providerId: string, key: string): Promise<string | null>;
  set(providerId: string, key: string, value: string, ttlMs?: number): Promise<void>;
}

/** Discovery-id TTL — 24h (ADR-005 §Lane-1). */
export const DISCOVERY_TTL_MS = 24 * 60 * 60 * 1000;

interface Entry {
  value: string;
  expiresAt: number;
}

export class InMemoryProviderUrlCache implements ProviderUrlCache {
  private readonly store = new Map<string, Entry>();

  async get(providerId: string, key: string): Promise<string | null> {
    const e = this.store.get(`${providerId}:${key}`);
    if (!e) return null;
    if (Date.now() >= e.expiresAt) {
      this.store.delete(`${providerId}:${key}`);
      return null;
    }
    return e.value;
  }

  async set(providerId: string, key: string, value: string, ttlMs = DISCOVERY_TTL_MS): Promise<void> {
    this.store.set(`${providerId}:${key}`, { value, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.store.clear();
  }
}
