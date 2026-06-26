import { toLatinDigits, formatCount } from './format';

/**
 * NUMERAL RULE (LOCKED — tokens.css / flows §4): every number renders with Western (Latin) digits
 * regardless of locale. These tests lock that the helpers NEVER emit Arabic-Indic digits.
 */
describe('Western-numeral formatting', () => {
  it('normalizes Arabic-Indic (٠-٩) digits to Latin', () => {
    expect(toLatinDigits('٤١٢٫٠٠٠')).toBe('412٫٠٠٠'.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)));
    expect(toLatinDigits('٤١٢')).toBe('412');
    expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('normalizes Extended-Arabic-Indic (۰-۹) digits to Latin', () => {
    expect(toLatinDigits('۴۱۲')).toBe('412');
  });

  it('leaves Latin digits and non-digits untouched', () => {
    expect(toLatinDigits('412.000 KWD')).toBe('412.000 KWD');
    expect(toLatinDigits('5 free searches left')).toBe('5 free searches left');
  });

  it('formatCount yields Latin digits even for an Arabic locale', () => {
    expect(formatCount(412, 'ar-KW')).toMatch(/^[0-9,]+$/);
    expect(formatCount(8, 'ar')).toBe('8');
    expect(/[٠-٩۰-۹]/.test(formatCount(1234567, 'ar-KW'))).toBe(false);
  });
});
