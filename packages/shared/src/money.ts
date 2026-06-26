/**
 * Money is stored and transported as integer **fils** to avoid float drift.
 * 1 KWD = 1000 fils (system-design.md → Data model).
 * Never use floats for money in business logic; format only at the display edge.
 */

export const FILS_PER_KWD = 1000;

/** A price in integer fils. Branded for clarity at call sites. */
export type Fils = number;

/** Format integer fils as a KWD string, e.g. 152500 → "152.500 KWD" (3 dp, Western digits per S1-1 §4). */
export function formatFils(fils: Fils, opts: { suffix?: string } = {}): string {
  const suffix = opts.suffix ?? ' KWD';
  const sign = fils < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(fils));
  const kwd = Math.trunc(abs / FILS_PER_KWD);
  const rem = abs % FILS_PER_KWD;
  return `${sign}${kwd}.${rem.toString().padStart(3, '0')}${suffix}`;
}

/** Parse a KWD decimal string/number into integer fils. "152.5" → 152500. */
export function kwdToFils(kwd: number): Fils {
  return Math.round(kwd * FILS_PER_KWD);
}
