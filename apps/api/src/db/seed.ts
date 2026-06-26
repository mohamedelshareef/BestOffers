/**
 * Seed runner (S2.5-1). Loads the MOCK Kuwait-Electronics catalog into the local dev DB
 * (providers / skus / offers + an initial offer_history snapshot). Idempotent: re-running
 * upserts the same rows. NO scraping — reads only the in-repo fixture.
 *
 *   npm run seed --workspace @bestoffers/api     # → apps/api/dev.sqlite (run after migrate)
 *
 * The running API still resolves offers from the in-memory fixture (Slice-2 stub); this seed makes
 * the data inspectable in SQL and is the drop-in point for the real provider-data layer (bo-dev-3).
 */
import Database from 'better-sqlite3';
import { join } from 'path';
import { MOCK_OFFERS, MOCK_PROVIDERS, MOCK_SKUS } from '../offers/mock-offers.dataset';

const DB_PATH = process.env.SQLITE_PATH ?? join(__dirname, '..', '..', 'dev.sqlite');

function run() {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  const now = new Date().toISOString();

  const upsertProvider = db.prepare(
    `INSERT INTO providers (id, name, slug, sector, access_channel, base_url, enabled, robots_ok, tos_reviewed)
     VALUES (@id, @name, @slug, 'electronics', 'affiliate', @baseUrl, 1, 0, 0)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, base_url=excluded.base_url`,
  );
  const upsertSku = db.prepare(
    `INSERT INTO skus (id, category, canonical_name, brand, model, attributes)
     VALUES (@id, @category, @canonicalName, @brand, @model, @attributes)
     ON CONFLICT(id) DO UPDATE SET canonical_name=excluded.canonical_name, attributes=excluded.attributes`,
  );
  const upsertOffer = db.prepare(
    `INSERT INTO offers (id, sku_id, provider_id, price_fils, currency, in_stock, deeplink_url, fetched_at, source)
     VALUES (@id, @skuId, @providerId, @priceFils, 'KWD', @inStock, @deeplinkUrl, @fetchedAt, @source)
     ON CONFLICT(id) DO UPDATE SET price_fils=excluded.price_fils, in_stock=excluded.in_stock, fetched_at=excluded.fetched_at, source=excluded.source`,
  );
  const insertHistory = db.prepare(
    `INSERT INTO offer_history (id, sku_id, provider_id, price_fils, in_stock, observed_at)
     VALUES (@id, @skuId, @providerId, @priceFils, @inStock, @observedAt)`,
  );

  const tx = db.transaction(() => {
    for (const p of MOCK_PROVIDERS) upsertProvider.run(p);
    for (const s of MOCK_SKUS) upsertSku.run({ ...s, attributes: JSON.stringify(s.attributes) });
    for (const o of MOCK_OFFERS) {
      upsertOffer.run({ ...o, inStock: o.inStock == null ? null : o.inStock ? 1 : 0 });
      insertHistory.run({
        id: `oh_${o.id}_${now}`,
        skuId: o.skuId,
        providerId: o.providerId,
        priceFils: o.priceFils,
        inStock: o.inStock == null ? null : o.inStock ? 1 : 0,
        observedAt: now,
      });
    }
  });
  tx();

  const counts = {
    providers: (db.prepare('SELECT COUNT(*) c FROM providers').get() as any).c,
    skus: (db.prepare('SELECT COUNT(*) c FROM skus').get() as any).c,
    offers: (db.prepare('SELECT COUNT(*) c FROM offers').get() as any).c,
    offer_history: (db.prepare('SELECT COUNT(*) c FROM offer_history').get() as any).c,
  };
  console.log(`seeded → ${DB_PATH}`);
  console.log(
    `providers=${counts.providers} skus=${counts.skus} offers=${counts.offers} offer_history=${counts.offer_history}`,
  );
  db.close();
}

run();
