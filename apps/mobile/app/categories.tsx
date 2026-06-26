import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Locale } from '@bestoffers/shared';
import { Avatar } from '../src/components/Avatar';
import { useSession } from '../src/auth/session';
import { useLocale } from '../src/locale';
import { t } from '../src/i18n';
import { color, font, radius, space } from '../src/theme';

/**
 * Category select — screen 0 / the FIRST authed screen (flows §1.1, B1). Post-login landing.
 * 2×2 grid: Electronics + Food = ACTIVE (tap → `/search?cat=<id>`); Furniture + Cars = disabled
 * "قريباً / Soon" tiles (non-interactive) to signal the multi-category vision. `cat` id maps 1:1 to
 * the Sector contract ('electronics' | 'food'), so the search screen forwards it straight to the API.
 *
 * v2 re-skin: sand canvas, Rubik display headings, brand-soft active-tile icon well, dashed recessed
 * "soon" tiles, full-pill Soon tag.
 */
type Cat = {
  id: 'electronics' | 'food' | 'realestate';
  labelKey: 'catElectronics' | 'catFood' | 'catRealEstate';
  en: string;
  icon: string;
};
const ACTIVE: Cat[] = [
  { id: 'electronics', labelKey: 'catElectronics', en: 'Electronics', icon: '🖥️' },
  { id: 'food', labelKey: 'catFood', en: 'Food', icon: '🍽️' },
  // Real Estate (Flats) — powered by the social IG mock lane (ADR-006).
  { id: 'realestate', labelKey: 'catRealEstate', en: 'Real Estate', icon: '🏢' },
];
const SOON: { labelKey: 'catFurniture' | 'catCars'; en: string; icon: string }[] = [
  { labelKey: 'catCars', en: 'Cars', icon: '🚗' },
];

export default function CategoriesScreen() {
  const session = useSession();
  const { locale, toggle } = useLocale();
  const lc = locale as Locale;
  const isRTL = lc === 'ar';
  const align = isRTL ? ('right' as const) : ('left' as const);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {session ? (
          <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="profile">
            <Avatar name={session.pseudoId} size="sm" />
          </Pressable>
        ) : (
          <Pressable style={styles.signIn} onPress={() => router.push('/login')} accessibilityRole="button">
            <Text style={styles.signInLabel}>{t('signIn', lc)}</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        <Pressable style={styles.langBtn} onPress={toggle} accessibilityRole="button" accessibilityLabel="toggle language">
          <Text style={styles.langLabel}>{t('langToggle', lc)}</Text>
        </Pressable>
        <Pressable style={styles.langBtn} onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="settings">
          <Text style={styles.overflow}>⋮</Text>
        </Pressable>
      </View>

      <Text style={[styles.eyebrow, { textAlign: align }]}>{t('catEyebrow', lc)}</Text>
      <Text style={[styles.title, { textAlign: align }]}>{t('catTitle', lc)}</Text>
      <Text style={[styles.sub, { textAlign: align }]}>{t('catSub', lc)}</Text>

      <View style={styles.grid}>
        {ACTIVE.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.tile, styles.tileActive]}
            onPress={() => router.push(`/search?cat=${c.id}`)}
            accessibilityRole="button"
            accessibilityLabel={t(c.labelKey, lc)}
          >
            <View style={[styles.icWell, styles.icWellActive]}>
              <Text style={styles.ic}>{c.icon}</Text>
            </View>
            <Text style={[styles.tileTitle, { textAlign: align }]}>{t(c.labelKey, lc)}</Text>
            <Text style={[styles.tileEn, { textAlign: align }]}>{c.en}</Text>
          </Pressable>
        ))}
        {SOON.map((c) => (
          <View key={c.en} style={[styles.tile, styles.tileSoon]} accessibilityState={{ disabled: true }}>
            <View style={styles.soonTag}>
              <Text style={styles.soonTagText}>
                {t('catSoon', lc)}
                {isRTL ? ' · Soon' : ''}
              </Text>
            </View>
            <View style={[styles.icWell, styles.icWellSoon]}>
              <Text style={[styles.ic, styles.icSoon]}>{c.icon}</Text>
            </View>
            <Text style={[styles.tileTitle, styles.tileTitleSoon, { textAlign: align }]}>{t(c.labelKey, lc)}</Text>
            <Text style={[styles.tileEn, styles.tileEnSoon, { textAlign: align }]}>{c.en}</Text>
          </View>
        ))}
      </View>

      <View style={styles.note}>
        <Text style={styles.noteIcon}>ⓘ</Text>
        <Text style={[styles.noteText, { textAlign: align }]}>{t('catNote', lc)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas },
  content: { padding: space.lg, paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  signIn: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: color.brand.primary,
    paddingHorizontal: space.md,
  },
  signInLabel: { fontSize: 15, fontFamily: font.bodySemiBold, color: color.brand.primary },
  langBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.border.default,
    paddingHorizontal: space.md,
  },
  langLabel: { fontSize: 15, fontFamily: font.displayBold, color: color.brand.primary },
  overflow: { fontSize: 20, color: color.text.primary, fontFamily: font.displayBold },
  eyebrow: { fontSize: 12, fontFamily: font.displayBold, letterSpacing: 1, color: color.brand.primary, marginBottom: 8 },
  title: { fontSize: 26, lineHeight: 36, fontFamily: font.displayExtraBold, color: color.text.primary },
  sub: { fontSize: 14.5, lineHeight: 22, fontFamily: font.body, color: color.text.secondary, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: space.xl },
  tile: {
    width: '47%',
    flexGrow: 1,
    minHeight: 150,
    borderRadius: radius.card,
    padding: space.lg,
    justifyContent: 'flex-end',
  },
  tileActive: { backgroundColor: color.bg.surface, borderWidth: 1, borderColor: color.border.default },
  tileSoon: { backgroundColor: color.bg.surfaceAlt, borderWidth: 1, borderStyle: 'dashed', borderColor: color.border.strong },
  icWell: { width: 52, height: 52, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  icWellActive: { backgroundColor: color.brand.primarySoft },
  icWellSoon: { backgroundColor: '#E7E1D6' },
  ic: { fontSize: 26 },
  icSoon: { opacity: 0.5 },
  tileTitle: { fontSize: 18, fontFamily: font.displayBold, color: color.text.primary },
  tileTitleSoon: { color: color.text.secondary },
  tileEn: { fontSize: 11.5, letterSpacing: 0.5, fontFamily: font.displayBold, color: color.brand.primary, marginTop: 2 },
  tileEnSoon: { color: color.text.secondary },
  soonTag: {
    position: 'absolute',
    top: space.md,
    left: space.md, // top-corner per mockup (RTL container places this at the visual start corner)
    backgroundColor: color.bg.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  soonTagText: { fontSize: 11.5, fontFamily: font.bodySemiBold, color: color.text.secondary },
  note: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: space.xl },
  noteIcon: { fontSize: 16, color: color.brand.primary },
  noteText: { flex: 1, fontSize: 13, fontFamily: font.body, color: color.text.secondary },
});
