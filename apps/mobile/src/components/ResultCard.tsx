import React from 'react';
import { I18nManager, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale, ResultCard as ResultCardData } from '@bestoffers/shared';
import { NumText } from './NumText';
import { color, font, radius, space } from '../theme';
import { toLatinDigits } from '../format';
import { t } from '../i18n';

/**
 * Result card (wireframe §1.4 / W9, v2 re-skin). RTL-native via LOGICAL props (start/end), so it
 * mirrors cleanly when I18nManager.isRTL. Whole card is tappable → deep-link hand-off (E1).
 * Degrades gracefully on missing image (placeholder, never a broken card — AC D2.4).
 *
 * v2: sand-harmonized surface, card radius 16, Rubik display name, price in deal-gold (the ONLY
 * gold in the card) wrapped in NumText so the digits stay Western + LTR-isolated inside RTL copy.
 */
export function ResultCardView({
  card,
  locale,
  onHandoff,
}: {
  card: ResultCardData;
  locale: Locale;
  onHandoff?: (url: string) => void;
}) {
  const why = locale === 'ar' ? card.whyAr : card.whyEn;
  const open = () => (onHandoff ? onHandoff(card.deeplinkUrl) : Linking.openURL(card.deeplinkUrl));
  // Social (Instagram) offers (ADR-006): the CTA opens the exact IG post. We surface an explicit
  // "View on Instagram / شوف على إنستقرام" pill so the deep-link affordance is obvious on the card.
  const isInstagram = /instagram\.com\//.test(card.deeplinkUrl);

  return (
    <Pressable
      style={styles.card}
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${card.productName}, ${card.priceLabel}, ${card.providerName}`}
    >
      {card.imageUrl ? (
        <Image source={{ uri: card.imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {card.productName}
        </Text>
        <Text style={styles.why} numberOfLines={1}>
          {why}
        </Text>
        <Text style={styles.provider}>{card.providerName}</Text>
        {/* Price = the one gold element; digits Western + LTR-isolated. */}
        <NumText style={styles.price}>{toLatinDigits(card.priceLabel)}</NumText>
        {isInstagram ? (
          <View style={styles.igCta}>
            <Text style={styles.igIcon}>📷</Text>
            <Text style={styles.igLabel}>{t('viewOnInstagram', locale)}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    backgroundColor: color.bg.surface,
    borderColor: color.border.default,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.md,
    marginVertical: 6,
    gap: space.md,
  },
  image: { width: 88, height: 88, borderRadius: radius.input },
  imagePlaceholder: { backgroundColor: color.bg.surfaceAlt },
  body: { flex: 1 },
  name: {
    fontSize: 18,
    fontFamily: font.displayBold,
    color: color.text.primary,
    textAlign: 'left',
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  why: { fontSize: 13, fontFamily: font.body, color: color.text.secondary, marginTop: 2, textAlign: 'left' },
  provider: { fontSize: 13, fontFamily: font.bodySemiBold, color: color.text.secondary, marginTop: 4, textAlign: 'left' },
  price: { fontSize: 22, fontFamily: font.displayExtraBold, color: color.accent.gold, marginTop: 6, textAlign: 'left' },
  igCta: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    borderRadius: radius.pill,
    backgroundColor: color.brand.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  igIcon: { fontSize: 13 },
  igLabel: { fontSize: 13, fontFamily: font.bodySemiBold, color: color.text.onBrand },
});
