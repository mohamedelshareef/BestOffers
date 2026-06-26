import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ClarifierQuestion as ClarifierQuestionData, Locale } from '@bestoffers/shared';
import { t } from '../i18n';
import { NumText } from './NumText';
import { color, font, radius, space } from '../theme';

/**
 * Clarifier question (wireframe W7 / §1.4 "Clarifier chat bubble" + "Answer chips").
 * AI bubble (the question) + a row of tappable FULL-PILL chips (v2), plus a dashed Skip chip (AC C2.3).
 * Pure presentational: the screen owns the bound (≤3) and the answer→advance loop.
 */
export function ClarifierQuestionView({
  question,
  locale,
  index,
  onAnswer,
}: {
  question: ClarifierQuestionData;
  locale: Locale;
  index: number;
  onAnswer: (dimension: string, value: string | null) => void;
}) {
  const text = locale === 'ar' ? question.textAr : question.textEn;
  return (
    <View style={styles.wrap}>
      <View style={styles.bubble}>
        <Text style={styles.counter}>
          {t('questionOf', locale)} <NumText style={styles.counter}>{String(index)}</NumText>
        </Text>
        <Text style={styles.question}>{text}</Text>
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
