import { FetchCtx } from './provider-adapter.interface';

/**
 * Tier-2 headless-render capability (ADR-003 §1 Tier 2, Slice B). Renders a JS/SPA page in a
 * headless Chromium so the post-JS DOM (with prices the plain fetcher never sees) becomes available
 * to extract().
 *
 * DESIGN NOTE (ADR-003 §2/§3 — prefer the XHR/JSON sniff over a full render): for sites whose SPA is
 * driven by a clean structured endpoint (Eureka = AngularJS shell driven by an Algolia search API),
 * the adapter should hit that JSON endpoint directly (via the Tier-1 httpGet) — it is an order of
 * magnitude faster than booting Chromium and is just as truthful (the JSON IS the fetched source).
 * `renderHtml` is the fallback for AMBER sites that have NO such endpoint.
 *
 * Playwright is loaded LAZILY (dynamic import) and is OPTIONAL: if it is not installed, renderHtml
 * throws a clear, catchable error so the live resolver degrades gracefully (partial results) instead
 * of crashing the query. Keeping it dynamic also keeps the offline unit suite free of the dep.
 */

let browserPromise: Promise<any> | null = null;

/** Lazily import Playwright and launch ONE shared headless Chromium (pooled across calls). */
async function getBrowser(): Promise<any> {
  if (!browserPromise) {
    browserPromise = (async () => {
      let chromium: any;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        ({ chromium } = await import('playwright'));
      } catch {
        throw new Error(
          'RENDER_UNAVAILABLE: playwright is not installed (run `npm i -D playwright && npx playwright install chromium` in apps/api)',
        );
      }
      return chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    })();
  }
  return browserPromise;
}

/**
 * Render a URL in headless Chromium and return the post-JS HTML. Hard-bounded by ctx.timeoutMs
 * (Tier-2 budget ≈ 5s per ADR-003 §4). Each call uses a fresh isolated context, closed in finally.
 *
 * @param waitForSelector optional CSS selector to await before snapshotting (price container).
 */
export async function renderHtml(
  url: string,
  ctx: FetchCtx,
  waitForSelector?: string,
): Promise<string> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: ctx.userAgent,
    locale: 'en-US',
    extraHTTPHeaders: { 'Accept-Language': ctx.acceptLanguage },
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: ctx.timeoutMs });
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: ctx.timeoutMs }).catch(() => undefined);
    }
    return await page.content();
  } finally {
    await context.close().catch(() => undefined);
  }
}

/** Close the shared browser (call on shutdown / after a batch). Safe if never launched. */
export async function closeRenderBrowser(): Promise<void> {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch {
    /* ignore */
  } finally {
    browserPromise = null;
  }
}
