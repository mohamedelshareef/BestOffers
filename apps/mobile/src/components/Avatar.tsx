import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { color } from '../theme';
import { initials } from './initials';

const SIZES = { sm: 40, md: 64, lg: 96 } as const;

export { initials };

/**
 * N3 — Avatar. Circle; image cover-fit; initials fallback in a brand-tinted circle when no photo
 * (never a broken image). Editable variant adds a camera badge (leading-bottom under forced RTL).
 */
export function Avatar({
  uri,
  name,
  size = 'md',
  editable,
  onEdit,
}: {
  uri?: string | null;
  name?: string | null;
  size?: keyof typeof SIZES;
  editable?: boolean;
  onEdit?: () => void;
}) {
  const dim = SIZES[size];
  const circle = { width: dim, height: dim, borderRadius: dim / 2 };
  const inner = uri ? (
    <Image source={{ uri }} style={[circle, styles.image]} accessibilityIgnoresInvertColors />
  ) : (
    <View style={[circle, styles.fallback]}>
      <Text style={[styles.initials, { fontSize: dim * 0.38 }]}>{initials(name)}</Text>
    </View>
  );

  if (!editable) return inner;

  return (
    <View style={[circle, styles.editableWrap]}>
      {inner}
      <Pressable
        style={styles.badge}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel="change photo"
      >
        <Text style={styles.badgeIcon}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: color.bg.surfaceAlt },
  fallback: { backgroundColor: color.brand.primary, alignItems: 'center', justifyContent: 'center' },
  initials: { color: color.text.onBrand, fontWeight: '700' },
  editableWrap: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: color.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: color.bg.canvas,
  },
  badgeIcon: { color: color.text.onBrand, fontSize: 16, lineHeight: 18, fontWeight: '700' },
});
