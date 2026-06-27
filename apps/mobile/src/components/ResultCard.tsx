import React from 'react';
import { I18nManager, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Locale, ResultCard as ResultCardData } from '@bestoffers/shared';
import { NumText } from './NumText';
import { color, font, radius, space } from '../theme';
import { toLatinDigits } from '../format';
import { t } from '../i18n';

/**
 * Result card (wireframe §1.4 / W9, v2 re-skin + Claude-revamp refinements). RTL-native via LOGICAL
 * props (start/end), so it mirrors cleanly when I18nManager.isRTL. Whole card is tappable → deep-link
 * hand-off (E1). Degrades gracefully on missing image (greyscale silhouette, never a broken card).
 *
 * v2 + revamp adopt-list (team/design/claude-design-review.md):
 *  - media well 88×88 (--media-well); price 22/800 deal-gold (the ONLY gold in the card).
 *  - rank badge (ink, top-start) on cards #2..N (the #1 wears the verdict ribbon instead).
 *  - missing-image → greyscale silhouette on --bg-surfaceAlt (truthfulness: never a fabricated photo).
 *  - IG offer: outlined Instagram glyph (dependency-free, View-built — replaces the 📷 emoji; neutral,
 *    does NOT flip in RTL), recency chip, "View on Instagram" pill, and the price-on-request branch
 *    (priceFils===0 → non-gold label, no number — we NEVER invent a price).
 */
export function ResultCardView({
  card,
  locale,
  rank,
  recency,
  onHandoff,
}: {
  card: ResultCardData;
  locale: Locale;
  /** 1-based rank; the #1 card wears the verdict ribbon so its badge is suppressed (rank<=1 → none). */
  rank?: number;
  /** Optional "Instagram · 2 days ago" recency string (server-derived); gated — never fabricated here. */
  recency?: string;
  onHandoff?: (url: string) => void;
}) {
  const why = locale === 'ar' ? card.whyAr : card.whyEn;
  const open = () => (onHandoff ? onHandoff(card.deeplinkUrl) : Linking.openURL(card.deeplinkUrl));
  // Social (Instagram) offers (ADR-006): the CTA opens the exact IG post. We surface an explicit
  // "View on Instagram / شوف على إنستقرام" pill so the deep-link affordance is obvious on the card.
  const isInstagram = /instagram\.com\//.test(card.deeplinkUrl);
  // Price-on-request (priceFils===0): the server already localized priceLabel to "السعر بالخاص …"/
  // "Price on request …". Render it non-gold, no number — a price-on-request card never wins gold.
  const priceOnRequest = card.priceFils === 0;
  const showRankBadge = typeof rank === 'number' && rank > 1;

  return (
    <Pressable
      style={styles.card}
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${card.productName}, ${card.priceLabel}, ${card.providerName}`}
    >
      <View style={styles.well}>
        {card.imageUrl ? (
          <Image source={{ uri: card.imageUrl }} style={styles.image} />
        ) : (
          /* Missing image → greyscale silhouette (box-frame) on the recessed well, never a broken image. */
          <View style={styles.silhouette}>
            <View style={styles.silhouetteFrame} />
            <View style={styles.silhouetteDot} />
          </View>
        )}
        {showRankBadge ? (
          <View style={styles.rankBadge}>
            <NumText style={styles.rankBadgeText}>{String(rank)}</NumText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {card.productName}
        </Text>
        <Text style={styles.why} numberOfLines={1}>
          {why}
        </Text>
        <View style={styles.providerRow}>
          {isInstagram ? <InstagramGlyph size={14} color={color.text.secondary} /> : null}
          <Text style={styles.provider}>{card.providerName}</Text>
        </View>
        {isInstagram && recency ? (
          <View style={styles.recencyChip}>
            <Text style={styles.recencyText}>{recency}</Text>
          </View>
        ) : null}
        {/* Price = the one gold element; digits Western + LTR-isolated. Price-on-request = non-gold, no number. */}
        {priceOnRequest ? (
          <Text style={styles.priceOnRequest} numberOfLines={2}>
            {card.priceLabel}
          </Text>
        ) : (
          <NumText style={styles.price}>{toLatinDigits(card.priceLabel)}</NumText>
        )}
        {isInstagram ? (
          <View style={styles.igCta}>
            <InstagramGlyph size={14} color={color.text.onBrand} />
            <Text style={styles.igLabel}>{t('viewOnInstagram', locale)}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Outlined Instagram glyph (dependency-free — no react-native-svg). Rounded square + center ring +
 * top-end corner dot, matching the revamp's Lucide-style outline. NEUTRAL icon: does NOT flip in RTL.
 */
function InstagramGlyph({ size = 14, color: c }: { size?: number; color: string }) {
  const ring = Math.round(size * 0.5);
  const dot = Math.max(2, Math.round(size * 0.14));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        borderWidth: 1.4,
        borderColor: c,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{ width: ring, height: ring, borderRadius: ring / 2, borderWidth: 1.4, borderColor: c }}
      />
      <View
        style={{
          position: 'absolute',
          top: 1.6,
          right: 1.6,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: c,
        }}
      />
    </View>
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
  // Media well (--media-well 88) — the container for the provider/post image or its silhouette fallback.
  well: { width: 88, height: 88, borderRadius: radius.input, overflow: 'hidden', position: 'relative' },
  image: { width: 88, height: 88, borderRadius: radius.input },
  // Greyscale silhouette on the recessed well (--bg-surfaceAlt), drawn in --border-strong (muted grey).
  silhouette: {
    width: 88,
    height: 88,
    borderRadius: radius.input,
    backgroundColor: color.bg.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  silhouetteFrame: {
    width: 38,
    height: 30,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: color.border.strong,
  },
  silhouetteDot: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: color.border.strong,
    transform: [{ translateX: 6 }, { translateY: -4 }],
  },
  // Rank badge — ink circle, top-start (logical) over the media well, Western digits, LTR-isolated.
  rankBadge: {
    position: 'absolute',
    top: 6,
    // logical start: in RTL the badge sits at the right edge of the well, otherwise the left.
    ...(I18nManager.isRTL ? { right: 6 } : { left: 6 }),
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: { color: color.text.onBrand, fontSize: 11, fontFamily: font.displayBold },
  body: { flex: 1 },
  name: {
    fontSize: 18,
    fontFamily: font.displayBold,
    color: color.text.primary,
    textAlign: 'left',
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  why: { fontSize: 13, fontFamily: font.body, color: color.text.secondary, marginTop: 2, textAlign: 'left' },
  providerRow: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  provider: { fontSize: 13, fontFamily: font.bodySemiBold, color: color.text.secondary, textAlign: 'left' },
  // Recency chip (--bg-surfaceAlt) — "إنستقرام · قبل يومين" / "Instagram · 2 days ago".
  recencyChip: {
    alignSelf: 'flex-start',
    marginTop: 7,
    backgroundColor: color.bg.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  recencyText: { fontSize: 11, fontFamily: font.bodySemiBold, color: color.text.secondary },
  price: { fontSize: 22, fontFamily: font.displayExtraBold, color: color.accent.gold, marginTop: 6, textAlign: 'left' },
  // Price-on-request — secondary, NON-gold, no number (truthfulness: we never invent a price).
  priceOnRequest: { fontSize: 13, fontFamily: font.bodySemiBold, color: color.text.secondary, marginTop: 6, textAlign: 'left' },
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
  igLabel: { fontSize: 13, fontFamily: font.bodySemiBold, color: color.text.onBrand },
});
