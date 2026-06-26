import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space } from '../theme';

type Variant = 'info' | 'warning' | 'error' | 'success';

const TINT: Record<Variant, { bg: string; fg: string }> = {
  info: { bg: color.bg.surface, fg: color.brand.primary },
  warning: { bg: '#FFF4E5', fg: color.state.warning },
  error: { bg: '#FCEBEB', fg: color.state.error },
  success: { bg: '#E8F6EF', fg: color.state.success },
};

/**
 * N6 — Banner (inline, persistent). Full-width strip; icon glyph + text + optional inline action.
 * Color is never the sole signal — a leading glyph + the text carry the meaning (a11y §1.5).
 */
export function Banner({
  variant = 'info',
  text,
  actionLabel,
  onAction,
}: {
  variant?: Variant;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const tint = TINT[variant];
  const glyph = variant === 'success' ? '✓' : variant === 'error' ? '!' : variant === 'warning' ? '!' : 'i';
  return (
    <View style={[styles.wrap, { backgroundColor: tint.bg }]} accessibilityRole="alert">
      <View style={[styles.glyph, { borderColor: tint.fg }]}>
        <Text style={[styles.glyphText, { color: tint.fg }]}>{glyph}</Text>
      </View>
      <Text style={[styles.text, { color: color.text.primary }]}>{text}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={[styles.action, { color: tint.fg }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.input,
  },
  glyph: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  glyphText: { fontSize: 12, fontWeight: '800' },
  text: { flex: 1, fontSize: 14, textAlign: 'left' },
  action: { fontSize: 14, fontWeight: '700' },
});
