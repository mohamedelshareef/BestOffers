import { FetchCtx } from './provider-adapter.interface';

/**
 * Tier-1 HTTP retrieval (ADR-003 §1/§5): global fetch (undici on Node 18+), realistic UA +
 * Accept-Language, hard per-site timeout via AbortController, 1 jittered retry on 5xx/timeout.
 * No browser. Used by the X-cite and Blink adapters.
 */
export async function httpGet(
  url: string,
  ctx: FetchCtx,
  accept = 'text/html,application/json',
): Promise<{ status: number; body: string; url: string }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= 1; attempt++) {
    if (attempt > 0) await sleep(120 + Math.floor(Math.random() * 180)); // jittered backoff
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ctx.timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': ctx.userAgent,
          'Accept-Language': ctx.acceptLanguage,
          Accept: accept,
        },
      });
      const body = await res.text();
      if (res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
        continue; // retry 5xx
      }
      return { status: res.status, body, url: res.url || url };
    } catch (err) {
      lastErr = err; // timeout/network → retry once
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`fetch failed for ${url}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
