import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, space } from '../theme';

/**
 * N7 — Plan / price block (paywall + manage). Centered plan name + display-weight price on
 * brand.primary, period caption, value bullets (check glyph + body). Neutral — no fake scarcity.
 */
export function PlanBlock({
  planName,
  price,
  caption,
  bullets,
}: {
  planName: string;
  price: string;
  caption: string;
  bullets: string[];
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.plan}>{planName}</Text>
      <Text style={styles.price}>{price}</Text>
      <Text style={styles.caption}>{caption}</Text>
      <View style={styles.bullets}>
        {bullets.map((b) => (
          <View key={b} style={styles.bulletRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.bulletText}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs },
  plan: { fontSize: 18, fontWeight: '600', color: color.text.primary },
  price: { fontSize: 28, fontWeight: '700', color: color.brand.primary, marginTop: space.xs },
  caption: { fontSize: 13, color: color.text.secondary, marginBottom: space.md },
  bullets: { alignSelf: 'stretch', gap: space.sm },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  check: { color: color.state.success, fontSize: 16, fontWeight: '800' },
  bulletText: { fontSize: 16, color: color.text.primary, textAlign: 'left' },
});
