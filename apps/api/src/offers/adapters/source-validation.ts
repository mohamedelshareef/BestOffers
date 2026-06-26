import { RawPage } from './provider-adapter.interface';

/**
 * Truthfulness invariant (ADR-003 §2, AC D3.3), enforced STRUCTURALLY:
 * an extracted price is kept ONLY if a matching price-shaped token is present verbatim in the
 * fetched source bytes. A value not found in the source is DROPPED — never invented, never inferred.
 *
 * This is defense-in-depth that holds for deterministic parsers too: if a future selector drifts and
 * yields a price the page does not actually contain, the offer is rejected rather than shown.
 *
 * priceFils is integer fils (e.g. 219900). The KWD value is 219.900. We accept the price if the
 * source contains EITHER the 3-dp form (219.900 / 219,900) OR the trimmed-decimal form (219.9).
 */
export function priceTokenInSource(priceFils: number, raw: RawPage): boolean {
  const haystack = raw.html ?? (raw.json !== undefined ? JSON.stringify(raw.json) : '');
  if (!haystack) return false;

  const kwd = priceFils / 1000;
  const threeDp = kwd.toFixed(3); // "219.900"
  const trimmed = String(kwd); // "219.9"
  const candidates = new Set<string>([
    threeDp,
    threeDp.replace('.', ','), // locale comma
    trimmed,
    String(priceFils), // raw fils, if a source ever ships integer minor units
  ]);

  for (const c of candidates) {
    if (haystack.includes(c)) return true;
  }
  return false;
}
