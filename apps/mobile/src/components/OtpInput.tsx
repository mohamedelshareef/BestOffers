import React, { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { color, radius } from '../theme';

const LENGTH = 6;

/**
 * N5 — OTP code input. 6 boxes, auto-advance, paste-aware (a 6-digit paste fills all), auto-submit
 * on full. Digits render LTR even under RTL; error state borders every box. Boxes fill in reading
 * order which the forced-RTL layout mirrors automatically (right→left).
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  error,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete: (code: string) => void;
  error?: boolean;
  disabled?: boolean;
}) {
  const refs = useRef<(TextInput | null)[]>([]);
  const [focused, setFocused] = useState(-1);
  const digits = value.split('').concat(Array(LENGTH).fill('')).slice(0, LENGTH);

  function setAt(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, '');
    if (cleaned.length > 1) {
      // paste: fill from this box forward
      const next = (value.slice(0, index) + cleaned).slice(0, LENGTH);
      onChange(next);
      if (next.length === LENGTH) {
        refs.current[LENGTH - 1]?.blur();
        onComplete(next);
      } else {
        refs.current[next.length]?.focus();
      }
      return;
    }
    const arr = digits.slice();
    arr[index] = cleaned;
    const joined = arr.join('').slice(0, LENGTH);
    onChange(joined);
    if (cleaned && index < LENGTH - 1) refs.current[index + 1]?.focus();
    if (joined.replace(/\s/g, '').length === LENGTH && !joined.includes('')) onComplete(joined);
  }

  function onKeyPress(index: number, key: string) {
    if (key === 'Backspace' && !digits[index] && index > 0) refs.current[index - 1]?.focus();
  }

  return (
    <View style={styles.row} accessibilityLabel="6-digit code">
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={(r) => (refs.current[i] = r)}
          style={[
            styles.box,
            focused === i && styles.boxFocused,
            error && styles.boxError,
          ]}
          value={d}
          onChangeText={(text) => setAt(i, text)}
          onKeyPress={(e) => onKeyPress(i, e.nativeEvent.key)}
          onFocus={() => setFocused(i)}
          onBlur={() => setFocused(-1)}
          keyboardType="number-pad"
          maxLength={i === 0 ? LENGTH : 1}
          editable={!disabled}
          textAlign="center"
          accessibilityLabel={`digit ${i + 1}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  box: {
    width: 48,
    height: 56,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.border.default,
    backgroundColor: color.bg.surface,
    fontSize: 22,
    fontWeight: '600',
    color: color.text.primary,
    writingDirection: 'ltr',
  },
  boxFocused: { borderColor: color.brand.primary, borderWidth: 2 },
  boxError: { borderColor: color.state.error },
});
