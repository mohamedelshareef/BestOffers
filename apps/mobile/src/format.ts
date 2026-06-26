/**
 * Western (Latin) numeral formatting — LOCKED rule (tokens.css NUMERAL RULE, flows §4).
 *
 * ALL numbers in the app render with Latin digits 0-9, regardless of UI locale. We NEVER enable
 * Arabic-Indic digit shaping. Rationale: matches Kuwaiti provider feeds, avoids bidi/digit-shaping
 * bugs, one rule for devs. The currency LABEL stays bilingual ("KWD" / "د.ك"); only the DIGITS are
 * Western.
 *
 * Implementation:
 *  - `formatCount` uses Intl.NumberFormat with the `-nu-latn` numbering-system extension (and falls
 *    back to a manual digit-normalize if the runtime/Hermes lacks full Intl), so a locale of 'ar' or
 *    'ar-KW' still yields 0-9, never ٠-٩.
 *  - `toLatinDigits` hard-normalizes any Arabic-Indic / Eastern-Arabic digits in a string to Latin —
 *    a belt-and-suspenders pass for any server- or library-shaped numerals reaching the UI.
 *  - `RLM`/`LRM`-free: callers wrap numeric runs in the `NumText` component (direction:ltr) so digits
 *    stay LTR-isolated inside RTL copy.
 */

/** Arabic-Indic (٠-٩, U+0660–0669) + Extended-Arabic-Indic (۰-۹, U+06F0–06F9) → Latin 0-9. */
export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/**
 * Format an integer/number with Western digits, regardless of locale. Always forces the latn
 * numbering system; normalizes the output as a final guard. Safe when Intl is partial.
 */
export function formatCount(n: number, locale: string = 'en'): string {
  try {
    // -nu-latn forces Latin digits even for an 'ar' / 'ar-KW' locale.
    const tag = locale.includes('-u-') ? locale : `${locale}-u-nu-latn`;
    return toLatinDigits(new Intl.NumberFormat(tag).format(n));
  } catch {
    return toLatinDigits(String(n));
  }
}
