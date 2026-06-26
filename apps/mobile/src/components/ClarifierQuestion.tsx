import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ClarifierQuestion as ClarifierQuestionData, Locale } from '@bestoffers/shared';
import { t } from '../i18n';
import { NumText } from './NumText';
import { color, font, radius, space } from '../theme';

/**
 * Clarifier question (wireframe W7 / §1.4 "Clarifier chat bubble" + "Answer chips").
 * AI bubble (the question) + a row of tappable FULL-PILL chips (v2), plus a dashed Skip chip (AC C2.3).
 * Pure presentational: the screen owns the ≥5 gate and the answer→advance loop.
 *
 * OWNER DIRECTIVE 2026-06-26: a prominent "N of 5 / ٣ من ٥" progress indicator (Western numerals) +
 * a segmented dot bar so the user sees a short, bounded end (mitigates ≥5-flow abandonment). RTL/AR-first.
 */
export function ClarifierQuestionView({
  question,
  locale,
  index,
  total = 5,
  onAnswer,
}: {
  question: ClarifierQuestionData;
  locale: Locale;
  index: number;
  total?: number;
  onAnswer: (dimension: string, value: string | null) => void;
}) {
  const text = locale === 'ar' ? question.textAr : question.textEn;
  const isRTL = locale === 'ar';
  const segCount = Math.max(total, index);
  // segments fill from the leading edge: in RTL the bar is row-reverse so filled dots start at the
  // right; the boolean is the same (the first `index` are filled).
  const segments = Array.from({ length: segCount }, (_, i) => i < index);
  // "N of total / ٣ من ٥" — Western digits, the AR connector "من". In RTL the run "٢ من ٥" lays out
  // with 2 on the trailing (right) edge → reads correctly right-to-left as "2 من 5"; in EN it reads
  // "2 of 5". A single Text run keeps the bidi reorder consistent with the locale's reading direction.
  const progressText = `${String(index)} ${t('progressOf', locale)} ${String(total)}`;
  return (
    <View style={styles.wrap}>
      {/* Progress: "N of total / ٣ من ٥" (Western digits) + a segmented dot bar. */}
      <View style={[styles.progressRow, isRTL && styles.progressRowRtl]}>
        <View style={styles.progressPill}>
          <Text style={styles.progressPillText}>{progressText}</Text>
        </View>
        <View style={[styles.segments, isRTL && styles.segmentsRtl]}>
          {segments.map((filled, i) => (
            <View key={i} style={[styles.segment, filled ? styles.segmentFilled : styles.segmentEmpty]} />
          ))}
        </View>
      </View>
      <View style={styles.bubble}>
        <Text style={[styles.counter, { textAlign: isRTL ? 'right' : 'left' }]}>{t('narrowingTitle', locale)}</Text>
        <Text style={[styles.question, { textAlign: isRTL ? 'right' : 'left' }]}>{text}</Text>
      </View>
      <View style={styles.chips}>
        {question.chips.map((c) => (
          <Pressable
            key={c.value}
            style={styles.chip}
            onPress={() => onAnswer(question.dimension, c.value)}
            accessibilityRole="button"
            accessibilityLabel={locale === 'ar' ? c.labelAr : c.labelEn}
          >
            <Text style={styles.chipLabel}>{locale === 'ar' ? c.labelAr : c.labelEn}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.chip, styles.skipChip]}
          onPress={() => onAnswer(question.dimension, null)}
          accessibilityRole="button"
          accessibilityLabel={t('skip', locale)}
        >
          <Text style={styles.skipLabel}>{t('skip', locale)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  progressRowRtl: { flexDirection: 'row-reverse' },
  progressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.brand.primary,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  progressPillText: { color: color.text.onBrand, fontSize: 13, fontFamily: font.bodySemiBold },
  progressPillSep: { color: color.text.onBrand, fontSize: 13, fontFamily: font.bodySemiBold, marginHorizontal: 4 },
  segments: { flex: 1, flexDirection: 'row', gap: 6 },
  segmentsRtl: { flexDirection: 'row-reverse' },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  segmentFilled: { backgroundColor: color.brand.primary },
  segmentEmpty: { backgroundColor: color.border.default },
  bubble: {
    backgroundColor: color.bg.surface,
    borderColor: color.border.default,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 14,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  counter: { fontSize: 12, color: color.brand.primary, fontFamily: font.bodySemiBold, marginBottom: 4, textAlign: 'left' },
  question: { fontSize: 16, lineHeight: 26, fontFamily: font.body, color: color.text.primary, textAlign: 'left' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    backgroundColor: color.bg.surface,
    borderColor: color.border.default,
    borderWidth: 1.5,
    borderRadius: radius.chip, // full pill (v2)
  },
  chipLabel: { fontSize: 15, fontFamily: font.bodyMedium, color: color.text.primary },
  skipChip: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  skipLabel: { fontSize: 15, fontFamily: font.bodyMedium, color: color.text.secondary },
});
