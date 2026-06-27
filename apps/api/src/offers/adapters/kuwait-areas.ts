/**
 * Kuwait area gazetteer → AREA_GROUPS (ADR-007 Q3).
 *
 * GOAL: every Kuwait area a user can name must resolve, so an RE area query is constrained to the RIGHT
 * area (no Jabriya→wrong-area leaks, no unlisted-area pass-through). This replaces the hand-maintained
 * ~12-area map with the full researcher gazetteer (`team/research/kuwait-area-gazetteer.json`).
 *
 * It generates `AREA_GROUPS` = canonicalSlug(en) → de-duped list of alias forms:
 *   - every alias from the gazetteer (EN transliterations + AR with/without "ال", ة/ه + ى/ي variants),
 *   - PLUS auto-generated AR ة/ه and ى/ي spelling variants for each AR alias (so a caption that writes
 *     "سالميه" instead of "سالمية" still matches even if the seed listed only one spelling).
 *
 * CAVEATS handled (flagged in the gazetteer):
 *   - Two areas romanize to "Qairawan" (Capital القيروان vs Jahra القيصرية). They MUST stay separate keys
 *     so their aliases never merge — on a slug collision we disambiguate by governorate suffix.
 *   - Salwa carries both سلوى and السالوة spellings — both are kept (they're listed in its aliases).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface GazetteerArea {
  en: string;
  ar: string;
  aliases: string[];
  governorate: string;
}

/**
 * Load the researcher gazetteer at module init. Read from the repo file (kept OUTSIDE `src` so it stays a
 * shared research artifact) so we don't trip the tsc rootDir constraint a JSON `import` would. Path is
 * resolved from this compiled file up to the repo root, with an env override for tests/isolation.
 */
function loadGazetteer(): GazetteerArea[] {
  const override = process.env.KUWAIT_AREA_GAZETTEER_PATH;
  const candidates = override
    ? [override]
    : [
        // dist build: apps/api/dist/offers/adapters → repo root is 5 up
        resolve(__dirname, '../../../../../team/research/kuwait-area-gazetteer.json'),
        // ts-node/jest from src: apps/api/src/offers/adapters → repo root is 5 up
        resolve(__dirname, '../../../../../team/research/kuwait-area-gazetteer.json'),
        // fallback from cwd (apps/api)
        resolve(process.cwd(), '../../team/research/kuwait-area-gazetteer.json'),
      ];
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, 'utf8')) as GazetteerArea[];
    } catch {
      /* try next candidate */
    }
  }
  throw new Error('kuwait-area-gazetteer.json not found (set KUWAIT_AREA_GAZETTEER_PATH)');
}

const RAW_AREAS = loadGazetteer();

/** canonical slug from an English name: lowercased, non-alnum → underscore. */
export function slugifyArea(en: string): string {
  return en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** AR-only: produce ة↔ه and ى↔ي spelling variants of a token so seed spelling gaps still match. */
function arabicSpellingVariants(alias: string): string[] {
  if (!/[؀-ۿ]/.test(alias)) return [alias];
  const out = new Set<string>([alias]);
  const swap = (s: string, from: RegExp, to: string) => s.replace(from, to);
  // ة → ه and ه → ة
  out.add(swap(alias, /ة/g, 'ه'));
  out.add(swap(alias, /ه(?=\s|$)/g, 'ة'));
  // ى → ي and ي → ى (only at word end where the two genuinely interchange)
  out.add(swap(alias, /ى/g, 'ي'));
  out.add(swap(alias, /ي(?=\s|$)/g, 'ى'));
  return [...out];
}

/**
 * Build AREA_GROUPS from the gazetteer. Slugs collide only for same-romanization areas; on collision we
 * append the governorate slug so each area keeps a UNIQUE key and its aliases never bleed into the other.
 */
function buildAreaGroups(): { groups: Record<string, string[]>; govByArea: Record<string, string> } {
  // 1st pass: count slug occurrences so we know which need governorate disambiguation.
  const slugCount: Record<string, number> = {};
  for (const a of RAW_AREAS) slugCount[slugifyArea(a.en)] = (slugCount[slugifyArea(a.en)] || 0) + 1;

  const groups: Record<string, string[]> = {};
  const govByArea: Record<string, string> = {};

  for (const area of RAW_AREAS) {
    let key = slugifyArea(area.en);
    if (slugCount[key] > 1) key = `${key}_${slugifyArea(area.governorate)}`; // collision → keep separate

    const aliasSet = new Set<string>();
    const add = (s?: string) => {
      if (!s) return;
      for (const v of arabicSpellingVariants(s.trim())) if (v) aliasSet.add(v);
    };
    add(area.en);
    add(area.ar);
    for (const al of area.aliases) add(al);

    groups[key] = [...aliasSet];
    govByArea[key] = slugifyArea(area.governorate);
  }
  return { groups, govByArea };
}

const built = buildAreaGroups();

/** Canonical Kuwait area key → all AR + EN spellings/aliases that denote that area (84+ areas). */
export const AREA_GROUPS: Record<string, string[]> = built.groups;

/** Canonical area key → governorate slug (for a governorate-level fallback). */
export const AREA_GOVERNORATE: Record<string, string> = built.govByArea;

/**
 * governorate slug → spoken forms of that GOVERNORATE name (EN + AR, with ال variants).
 * Used only for an explicit governorate-level query ("شقق في محافظة الأحمدي" / "Capital governorate").
 */
const GOV_NAME_AR: Record<string, string[]> = {
  capital: ['العاصمة', 'العاصمه', 'محافظة العاصمة'],
  hawalli: ['حولي', 'محافظة حولي'],
  farwaniya: ['الفروانية', 'الفروانيه', 'محافظة الفروانية'],
  ahmadi: ['الأحمدي', 'الاحمدي', 'محافظة الأحمدي', 'محافظة الاحمدي'],
  jahra: ['الجهراء', 'الجهرا', 'محافظة الجهراء'],
  mubarak_al_kabeer: ['مبارك الكبير', 'محافظة مبارك الكبير'],
};
const GOV_NAME_EN: Record<string, string[]> = {
  capital: ['capital', 'asima'],
  hawalli: ['hawalli', 'hawally'],
  farwaniya: ['farwaniya'],
  ahmadi: ['ahmadi'],
  jahra: ['jahra'],
  mubarak_al_kabeer: ['mubarak al kabeer', 'mubarak alkabeer'],
};
export const GOVERNORATE_ALIASES: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const area of RAW_AREAS) out[slugifyArea(area.governorate)] = [];
  for (const gov of Object.keys(out)) {
    out[gov] = [...new Set([...(GOV_NAME_AR[gov] || []), ...(GOV_NAME_EN[gov] || [])])];
  }
  return out;
})();

/** Markers that force a GOVERNORATE-level (not specific-area) reading of a query. */
export const GOVERNORATE_MARKERS = ['محافظة', 'محافظه', 'governorate', 'governate'];
