/**
 * LIVE proof script (S2.6-4): really fetches X-cite + Blink and prints the REAL offers returned —
 * live KWD prices + source URLs. NOT a unit test (unit tests run offline). Run with:
 *
 *   npx ts-node apps/api/scripts/live-offers-spike.ts "iphone 16"
 *
 * Requires network access to www.xcite.com and www.blink.com.kw. Exits non-zero on total failure.
 */
import { formatFils } from '@bestoffers/shared';
import { XciteAdapter } from '../src/offers/adapters/xcite.adapter';
import { BlinkAdapter } from '../src/offers/adapters/blink.adapter';
import { EurekaAdapter } from '../src/offers/adapters/eureka.adapter';
import { TalabatAdapter } from '../src/offers/adapters/talabat.adapter';
import { DEFAULT_HTTP_CTX, ProviderAdapter } from '../src/offers/adapters/provider-adapter.interface';

async function runAdapter(adapter: ProviderAdapter, query: string) {
  const ctx = { ...DEFAULT_HTTP_CTX, timeoutMs: 6000 }; // generous for a cold one-shot script
  const refs = await adapter.discover({ text: query, limit: 5 }, ctx);
  console.log(`\n=== ${adapter.providerName} ===`);
  console.log(`discovered ${refs.length} product ref(s)`);
  let count = 0;
  for (const ref of refs) {
    try {
      const raw = await adapter.fetch(ref, ctx);
      const offers = await adapter.extract(raw);
      for (const o of offers) {
        count++;
        console.log(
          `  • ${formatFils(o.priceFils)}  | ${o.inStock ? 'in stock' : 'out'} | sku ${o.providerSkuRef}` +
            `\n      ${o.title}` +
            `\n      ${o.deeplink}`,
        );
      }
      if (offers.length === 0) console.log(`  (no offer extracted from ${ref.url})`);
    } catch (err) {
      console.log(`  ! fetch/extract failed for ${ref.url}: ${(err as Error).message}`);
    }
  }
  return count;
}

/** Food (Talabat) prints a capped sample of real dishes + promo flags from each restaurant. */
async function runTalabat(query: string) {
  const adapter = new TalabatAdapter();
  const ctx = { ...DEFAULT_HTTP_CTX, timeoutMs: 8000 };
  const refs = await adapter.discover({ text: query, limit: 3 }, ctx);
  console.log(`\n=== ${adapter.providerName} (food) ===`);
  console.log(`discovered ${refs.length} restaurant(s): ${refs.map((r) => `${r.handle}#${r.providerSkuRef}`).join(', ')}`);
  let count = 0;
  for (const ref of refs) {
    try {
      const raw = await adapter.fetch(ref, ctx);
      const offers = await adapter.extract(raw);
      console.log(`  ${ref.handle}: ${offers.length} priced dishes`);
      for (const o of offers.slice(0, 5)) {
        count++;
        const promo = o.attrs.isPromo
          ? `  (was ${formatFils(Number(o.attrs.oldPriceFils))}, -${o.attrs.discountPct}%)`
          : '';
        console.log(`    • ${formatFils(o.priceFils)}${promo}  | ${o.title}\n        ${o.deeplink}`);
      }
    } catch (err) {
      console.log(`  ! failed for ${ref.url}: ${(err as Error).message}`);
    }
  }
  return count;
}

async function main() {
  const query = process.argv[2] ?? 'iphone 16';
  const food = process.argv.includes('--food');
  console.log(`LIVE offer fetch — query: "${query}"${food ? ' [food/Talabat]' : ''}`);
  if (food) {
    const total = await runTalabat(query);
    console.log(`\nTOTAL live Talabat dishes (sampled): ${total}`);
    if (total === 0) {
      console.error('NO live Talabat dishes — check network access to talabat.com.');
      process.exit(1);
    }
    return;
  }
  const results = await Promise.allSettled([
    runAdapter(new XciteAdapter(), query),
    runAdapter(new BlinkAdapter(), query),
    runAdapter(new EurekaAdapter(), query),
  ]);
  const total = results.reduce((n, r) => n + (r.status === 'fulfilled' ? r.value : 0), 0);
  for (const r of results) {
    if (r.status === 'rejected') console.log(`\nadapter failed: ${(r.reason as Error)?.message}`);
  }
  console.log(`\nTOTAL live offers: ${total}`);
  if (total === 0) {
    console.error('NO live offers returned — check network access to xcite.com / blink.com.kw.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('live spike crashed:', e);
  process.exit(1);
});
