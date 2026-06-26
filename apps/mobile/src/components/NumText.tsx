import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { toLatinDigits } from '../format';

/**
 * The RN equivalent of the mockup `.num` span (tokens.css NUMERAL RULE): a numeric run that stays
 * Western (Latin digits) and LTR-isolated so it does NOT flip inside RTL Arabic copy.
 *
 * - `writingDirection: 'ltr'` keeps "412.000" left-to-right even when the surrounding paragraph is RTL.
 * - children are hard-normalized to Latin digits (`toLatinDigits`) as a final guard against any
 *   Arabic-Indic shaping that slipped through a formatter.
 *
 * Use for every numeric value: prices, quota counts, OTP, ranks, counts, timers.
 */
const ltr: TextStyle = { writingDirection: 'ltr' };

export function NumText({ children, style, ...rest }: TextProps) {
  const text = React.Children.toArray(children)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? toLatinDigits(String(c)) : ''))
    .join('');
  return (
    <Text {...rest} style={[ltr, style]}>
      {text}
    </Text>
  );
}
