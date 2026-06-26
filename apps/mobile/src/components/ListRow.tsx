import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { color, space } from '../theme';

/**
 * N1 — List row (settings/menu row). RTL-native via `flexDirection: row` under a forced-RTL tree
 * (I18nManager mirrors automatically). Variants: navigation (chevron), toggle (N2 Switch),
 * value (trailing secondary text), destructive (error label).
 * Switch states: off · on · disabled · pending (spinner, control locked) per N2.
 */
export function ListRow({
  label,
  value,
  caption,
  onPress,
  variant = 'navigation',
  destructive,
  // toggle props
  switchValue,
  onToggle,
  switchDisabled,
  switchPending,
}: {
  label: string;
  value?: string;
  caption?: string;
  onPress?: () => void;
  variant?: 'navigation' | 'toggle' | 'value' | 'plain';
  destructive?: boolean;
  switchValue?: boolean;
  onToggle?: (next: boolean) => void;
  switchDisabled?: boolean;
  switchPending?: boolean;
}) {
  const interactive = variant === 'navigation' || (variant === 'value' && !!onPress) || (variant === 'plain' && !!onPress);
  const content = (
    <View style={styles.row}>
      <View style={styles.main}>
        <Text style={[styles.label, destructive && styles.destructive]} numberOfLines={1}>
          {label}
        </Text>
        {caption ? (
          <Text style={styles.caption} numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
      </View>
      {variant === 'value' && value ? <Text style={styles.value}>{value}</Text> : null}
      {variant === 'navigation' && value ? <Text style={styles.value}>{value}</Text> : null}
      {variant === 'navigation' ? <Text style={styles.chevron}>›</Text> : null}
      {variant === 'toggle' ? (
        switchPending ? (
          <ActivityIndicator />
        ) : (
          <Switch
            value={!!switchValue}
            onValueChange={onToggle}
            disabled={switchDisabled}
            trackColor={{ true: color.brand.primary, false: color.bg.surfaceAlt }}
            accessibilityLabel={label}
            accessibilityState={{ checked: !!switchValue, disabled: !!switchDisabled }}
          />
        )
      ) : null}
    </View>
  );

  if (interactive) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}, ${value}` : label}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={styles.pressable}>{content}</View>;
}

const styles = StyleSheet.create({
  pressable: {
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: color.border.default,
    backgroundColor: color.bg.canvas,
    justifyContent: 'center',
  },
  pressed: { backgroundColor: color.bg.surface },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.md },
  main: { flex: 1 },
  label: { fontSize: 16, color: color.text.primary, textAlign: 'left' },
  destructive: { color: color.state.error },
  caption: { fontSize: 13, color: color.text.secondary, marginTop: 2, textAlign: 'left' },
  value: { fontSize: 15, color: color.text.secondary, textAlign: 'left' },
  chevron: { fontSize: 22, color: color.text.secondary, fontWeight: '300' },
});
