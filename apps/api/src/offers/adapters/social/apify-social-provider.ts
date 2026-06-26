import { RawPost, SocialProvider, SocialQuery } from './social-provider';

/**
 * ApifySocialProvider (ADR-006 §Decision-1, CONFIG-READY STUB — not the demo path).
 *
 * Bound when SOCIAL_PROVIDER=apify. Calls the Apify `instagram-scraper` actor over the curated
 * tracked-accounts allow-list with `onlyPostsNewerThan=30d` + `resultsLimit=30`, polls the run, and
 * maps dataset rows (caption, timestamp, post `url`, displayUrl, ownerUsername) → RawPost.
 *
 * Intentionally NOT implemented end-to-end here: the demo runs on MockSocialProvider with NO key/spend.
 * Going live needs (a) APIFY_TOKEN, (b) a curated `tracked_accounts` allow-list, (c) legal sign-off on
 * Meta ToS/IP (ADR-006 §4 — the biggest legal flag in the project). This class throws until configured
 * so a misconfigured prod fails loudly instead of silently returning nothing.
 */
export class ApifySocialProvider implements SocialProvider {
  readonly name = 'apify';

  private get token(): string | undefined {
    return process.env.APIFY_TOKEN;
  }
  private get actor(): string {
    return process.env.APIFY_IG_ACTOR ?? 'apify/instagram-scraper';
  }

  async fetchPosts(_query: SocialQuery): Promise<RawPost[]> {
    if (!this.token) {
      throw new Error(
        'ApifySocialProvider: APIFY_TOKEN missing. Set SOCIAL_PROVIDER=mock for dev/demo, or provide ' +
          'APIFY_TOKEN + a curated tracked_accounts allow-list to go live (ADR-006 §3, legal sign-off pending).',
      );
    }
    // Live wiring (deferred — ADR-006 Phase 1 go-live):
    //   POST https://api.apify.com/v2/acts/{actor}/runs?token=… with input:
    //     { directUrls: trackedAccounts, resultsType: 'posts', onlyPostsNewerThan: '30 days',
    //       resultsLimit: 30 }
    //   poll GET …/runs/{id}; then GET …/datasets/{defaultDatasetId}/items → map rows to RawPost.
    throw new Error('ApifySocialProvider live path not enabled — use SOCIAL_PROVIDER=mock for the demo.');
  }
}
