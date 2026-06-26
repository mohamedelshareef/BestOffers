import React from 'react';
import { I18nManager, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatFils } from '@bestoffers/shared';
import type { Fils } from '@bestoffers/shared';
import { color, font, gradient, radius, space } from '../theme';
import { NumText } from './NumText';
import { toLatinDigits } from '../format';

/**
 * Best-price VERDICT ribbon (the v2 SIGNATURE element — README item 4). Crowns the #1 ranked result
 * ONLY. Gold accent gradient + check + "أوفر بـ X د.ك من المتوسط" savings line. This is the one place
 * we spend boldness; gold appears ONLY here and on the price (never a paid/sponsored marker).
 *
 * `savingsFils` is the (average − cheapest) delta computed from the REAL card set; when ≤0 (only one
 * card, or #1 is not below the average) we still crown the best offer but drop the savings clause —
 * we never invent a saving.
 */
export function VerdictRibbon({
  savingsFils,
  locale,
  children,
}: {
  savingsFils: Fils;
  locale: 'ar' | 'en';
  children: React.ReactNode;
}) {
  const hasSaving = savingsFils > 0;
  const amount = toLatinDigits(formatFils(savingsFils, { suffix: locale === 'ar' ? ' د.ك' : ' KWD' }));

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <LinearGradient
        colors={gradient.accent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ribbon}
      >
        <Text style={styles.check}>✓</Text>
        <Text style={styles.ribbonText} numberOfLines={1}>
          {locale === 'ar' ? 'أفضل عرض' : 'Best offer'}
          {hasSaving ? (locale === 'ar' ? ' — أوفر بـ ' : ' — saves ') : ''}
        </Text>
        {hasSaving ? <NumText style={styles.ribbonText}>{amount}</NumText> : null}
        {hasSaving ? (
          <Text style={styles.ribbonText}>{locale === 'ar' ? ' من المتوسط' : ' vs average'}</Text>
        ) : null}
      </LinearGradient>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.card,
    backgroundColor: color.accent.goldSoft,
    borderWidth: 1,
    borderColor: '#EBD7AE',
    overflow: 'hidden',
    marginVertical: 6,
  },
  ribbon: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: 4,
  },
  check: { color: color.text.onGold, fontSize: 13, fontFamily: font.displayExtraBold },
  ribbonText: { color: color.text.onGold, fontSize: 13, fontFamily: font.bodySemiBold },
});
