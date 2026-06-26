import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { color, radius } from '../theme';

/** Button (design system §1.4): primary / secondary / text, with loading + disabled states. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'text' && styles.textBtn,
        pressed && variant === 'primary' && styles.primaryPressed,
        isDisabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? color.text.onBrand : color.brand.primary} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' ? styles.labelOnBrand : styles.labelBrand,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primary: { backgroundColor: color.brand.primary },
  primaryPressed: { backgroundColor: color.brand.primaryPressed },
  secondary: { backgroundColor: color.bg.surface, borderWidth: 1, borderColor: color.brand.primary },
  textBtn: { minHeight: 44, paddingHorizontal: 8 },
  disabled: { opacity: 0.4 },
  label: { fontSize: 16, fontWeight: '600' },
  labelOnBrand: { color: color.text.onBrand },
  labelBrand: { color: color.brand.primary },
});
