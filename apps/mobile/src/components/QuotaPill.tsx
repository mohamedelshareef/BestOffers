import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { Locale, QuotaStatus } from '@bestoffers/shared';
import { color, font, radius } from '../theme';
import { t, tn } from '../i18n';
import { toLatinDigits } from '../format';

/**
 * N8 — Searches-remaining indicator (counter pill / F-D2 D1). Pure function of QuotaStatus:
 *  - premium → hidden (returns null; optional Pro badge handled by caller)
 *  - 5..2 left → secondary "{n} free searches left"
 *  - 1 left   → warning "1 free search left"
 *  - 0 left   → brand "Subscribe to continue" → opens paywall
 * Fail-open: when `quota` is null (fetch failed / unauthed) the pill is hidden — never blocks UX.
 */
export function QuotaPill({
  quota,
  locale,
  onSubscribe,
}: {
  quota: QuotaStatus | null;
  locale: Locale;
  onSubscribe: () => void;
}) {
  if (!quota || quota.premium) return null;
  const left = Math.max(0, quota.limit - quota.used);

  if (left === 0) {
    return (
      <Pressable
        style={[styles.pill, styles.subscribe]}
        onPress={onSubscribe}
        accessibilityRole="button"
        accessibilityLabel={t('quotaSubscribe', locale)}
      >
        <Text style={[styles.text, styles.subscribeText]}>{t('quotaSubscribe', locale)}</Text>
      </Pressable>
    );
  }

  const warning = left === 1;
  // Quota count uses Western digits (NUMERAL RULE); normalize the interpolated string as a guard.
  const label = warning ? t('quotaLastFree', locale) : toLatinDigits(tn('quotaFreeLeft', locale, { n: left }));
  return (
    <Text
      style={[styles.pill, styles.text, warning ? styles.warning : styles.secondary]}
      accessibilityLabel={label}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 30,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border.default,
    backgroundColor: color.bg.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  text: { fontSize: 12.5, lineHeight: 20, fontFamily: font.bodySemiBold },
  secondary: { color: color.text.secondary },
  // 1-left warning = gold-soft fill (matches mockup .quota--warn), not a red alert.
  warning: { color: color.state.warning, borderColor: '#EBD7AE', backgroundColor: color.accent.goldSoft },
  // 0-left gate = solid brand "Subscribe" pill.
  subscribe: { borderColor: color.brand.primary, backgroundColor: color.brand.primary },
  subscribeText: { color: color.text.onBrand, fontFamily: font.displayBold },
});
