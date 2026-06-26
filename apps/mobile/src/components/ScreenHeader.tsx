import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { color, space } from '../theme';

/**
 * Shared screen header: a leading back chevron (directional → mirrors under RTL), centered title,
 * optional trailing text action (Edit / Save / Cancel). Keeps the Phase-2b screens consistent.
 */
export function ScreenHeader({
  title,
  trailingLabel,
  onTrailing,
  trailingDisabled,
  leadingLabel,
  onLeading,
}: {
  title: string;
  trailingLabel?: string;
  onTrailing?: () => void;
  trailingDisabled?: boolean;
  leadingLabel?: string;
  onLeading?: () => void;
}) {
  return (
    <View style={styles.header}>
      {leadingLabel ? (
        <Pressable onPress={onLeading} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.action}>{leadingLabel}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="back"
          hitSlop={8}
        >
          <Text style={styles.chevron}>‹</Text>
        </Pressable>
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {trailingLabel ? (
        <Pressable onPress={onTrailing} disabled={trailingDisabled} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.action, trailingDisabled && styles.disabled]}>{trailingLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
  },
  chevron: { fontSize: 30, color: color.brand.primary, fontWeight: '300', minWidth: 44 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: color.text.primary, textAlign: 'center' },
  action: { fontSize: 16, fontWeight: '600', color: color.brand.primary, minWidth: 44, textAlign: 'right' },
  disabled: { opacity: 0.4 },
  spacer: { minWidth: 44 },
});
