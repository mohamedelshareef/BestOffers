import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Locale, Profile } from '@bestoffers/shared';
import { Avatar } from '../../src/components/Avatar';
import { Banner } from '../../src/components/Banner';
import { ListRow } from '../../src/components/ListRow';
import { Button } from '../../src/components/Button';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { accounts, apiBaseUrl } from '../../src/api/config';
import { useLocale } from '../../src/locale';
import { t } from '../../src/i18n';
import { color, space } from '../../src/theme';

/** P1 — Profile (view). Hero avatar+name+email, email re-verify banner, info rows, settings link. */
export default function ProfileScreen() {
  const { locale } = useLocale();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    accounts
      .getProfile()
      .then(setProfile)
      .catch(() => setError(true));
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  const avatarUri = profile?.avatarUrl ? `${apiBaseUrl}${profile.avatarUrl}` : null;
  const showReverify = !!profile && (!profile.emailVerified && (!!profile.email || !!profile.emailPending));

  async function resendVerify() {
    if (!profile?.emailPending && !profile?.email) return;
    // Re-PATCH the same email to mint a fresh token, then surface it (mock has no mailer).
    const email = profile.emailPending ?? profile.email!;
    const res = await accounts.updateProfile({ email });
    if (res.emailVerifyToken) {
      await accounts.verifyEmail(res.emailVerifyToken);
      load();
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t('profileTitle', locale as Locale)}
        trailingLabel={t('edit', locale as Locale)}
        onTrailing={() => router.push('/profile/edit')}
      />
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('genericError', locale as Locale)}</Text>
          <Button label={t('retry', locale as Locale)} variant="secondary" onPress={load} />
        </View>
      ) : !profile ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.hero}>
            <Avatar uri={avatarUri} name={profile.displayName} size="lg" />
            <Text style={styles.name}>{profile.displayName ?? '—'}</Text>
            <Text style={styles.email}>{profile.emailPending ?? profile.email ?? ''}</Text>
          </View>

          {showReverify ? (
            <Banner
              variant="warning"
              text={t('verifyEmailBanner', locale as Locale)}
              actionLabel={t('verifyNow', locale as Locale)}
              onAction={resendVerify}
            />
          ) : null}

          <View style={styles.rows}>
            {/* Phone is PII — not exposed via /me; masked placeholder with WESTERN digits (numeral rule). */}
            <ListRow variant="value" label={t('phoneLabelRow', locale as Locale)} value="…67" />
            <ListRow
              variant="navigation"
              label={t('planLabel', locale as Locale)}
              value={t('planFree', locale as Locale)}
              onPress={() => router.push('/subscription')}
            />
            <ListRow
              variant="navigation"
              label={t('settingsTitle', locale as Locale)}
              onPress={() => router.push('/settings')}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas, paddingTop: 56 },
  body: { padding: space.lg, gap: space.lg },
  hero: { alignItems: 'center', gap: space.sm, marginVertical: space.lg },
  name: { fontSize: 22, fontWeight: '700', color: color.text.primary },
  email: { fontSize: 16, color: color.text.secondary, writingDirection: 'ltr' },
  rows: { borderTopWidth: 1, borderTopColor: color.border.default },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
  errorText: { fontSize: 15, color: color.text.secondary },
});
