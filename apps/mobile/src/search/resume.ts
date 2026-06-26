import type { SearchResponse } from '@bestoffers/shared';
import { PaywallRequired } from '../api/searchClient';

/** A replayable search call — the exact request that produced (or will produce) a SearchResponse. */
export type SearchCall = () => Promise<SearchResponse>;

/**
 * Holds the EXACT search request blocked by the 402 paywall so it can be replayed verbatim after the
 * user subscribes (F-D2 AC-5: "runs as the first unlimited search, no re-typing"). The freemium gate
 * fires at the value-delivery moment — AFTER clarifiers resolve — so the blocked call is typically the
 * FINAL clarifier answer, not the raw intent. Replaying the same call lands directly on the resolved
 * result set instead of restarting the clarifier flow. Single-shot: consumed on the first resume.
 */
export class BlockedSearch {
  private call: SearchCall | null = null;

  /** True once a 402-blocked call has been captured and not yet resumed. */
  get pending(): boolean {
    return this.call !== null;
  }

  /**
   * Runs a search call. If it succeeds, returns the response and clears any prior block. If it throws
   * PaywallRequired, captures the SAME call (so resume() can replay it) and re-throws so the caller can
   * route to the paywall. Any other error propagates without capturing.
   */
  async run(call: SearchCall): Promise<SearchResponse> {
    try {
      const res = await call();
      this.call = null;
      return res;
    } catch (e) {
      if (e instanceof PaywallRequired) {
        this.call = call;
      }
      throw e;
    }
  }

  /**
   * Replays the captured blocked call to completion (now unlimited → results). Returns null if nothing
   * was blocked. Clears the block first so a resume is single-shot even if the replay itself throws.
   */
  async resume(): Promise<SearchResponse | null> {
    const call = this.call;
    if (!call) return null;
    this.call = null;
    return call();
  }
}
