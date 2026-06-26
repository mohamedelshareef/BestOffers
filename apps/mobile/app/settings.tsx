import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Locale, Profile } from '@bestoffers/shared';
import { ListRow } from '../src/components/ListRow';
import { Banner } from '../src/components/Banner';
import { Button } from '../src/components/Button';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { accounts } from '../src/api/config';
import { toggleDecision } from '../src/settings/explainerGate';
import { signOut } from '../src/auth/session';
import { useLocale } from '../src/locale';
import { t } from '../src/i18n';
import { color, radius, space } from '../src/theme';

/**
 * S1 — Settings (extended). Account rows + biometric toggle (F-A2) + notifications toggle with
 * permission-state UI (F-A3) + general. The biometric SECRET + real OS permission prompts need a
 * device; on web we persist the app-level preference to the profile and show the permission UI
 * honestly (web has no biometric / push, so those show the "unavailable / denied" affordances).
 */
type NotifPerm = 'undetermined' | 'granted' | 'denied';
/** Which first-time explainer sheet is open (F-A2 / F-A3 pre-enable soft-ask). */
type Explainer = null | 'biometric' | 'notifications';

export default function SettingsScreen() {
  const { locale, toggle } = useLocale();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bioPending, setBioPending] = useState(false);
  const [notifPending, setNotifPending] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotifPerm>('undetermined');
  const [explainer, setExplainer] = useState<Explainer>(null);
  const biometricCapable = Platform.OS !== 'web'; // web has no biometric hardware

  useEffect(() => {
    accounts.getProfile().then(setProfile).catch(() => {});
  }, []);

  // Toggling ON the FIRST time opens the explainer sheet BEFORE the switch flips (F-A2/F-A3). The
  // toggle does NOT persist until the user confirms in the sheet (and, for notifications, the OS
  // permission is granted). Toggling OFF is immediate (no explainer needed).
  function toggleBiometric(next: boolean) {
    if (!biometricCapable) return;
    if (toggleDecision(next, !!profile?.biometricEnabled) === 'explain') {
      setExplainer('biometric');
      return;
    }
    persistBiometric(next);
  }

  function toggleNotifications(next: boolean) {
    if (toggleDecision(next, !!profile?.notifEnabled) === 'explain') {
      setExplainer('notifications');
      return;
    }
    persistNotifications(next);
  }

  async function persistBiometric(next: boolean) {
    setBioPending(true);
    try {
      // Real device: prompt OS biometric here (expo-local-authentication) before persisting.
      const p = await accounts.updateProfile({ biometricEnabled: next });
      setProfile(p);
    } finally {
      setBioPending(false);
    }
  }

  async function persistNotifications(next: boolean) {
    setNotifPending(true);
    try {
      if (next) {
        // Real device: request OS push permission (expo-notifications). Web has no push → denied.
        const perm: NotifPerm = Platform.OS === 'web' ? 'denied' : 'granted';
        setNotifPerm(perm);
        if (perm !== 'granted') return; // can't enable without permission
      }
      const p = await accounts.updateProfile({ notifEnabled: next });
      setProfile(p);
    } finally {
      setNotifPending(false);
    }
  }

  // "Enable" in the explainer → gate the real enable behind it (and the OS-permission request).
  function confirmExplainer() {
    const which = explainer;
    setExplainer(null);
    if (which === 'biometric') persistBiometric(true);
    else if (which === 'notifications') persistNotifications(true);
  }

  async function doSignOut() {
    await signOut();
    router.replace('/');
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t('settingsTitle', locale as Locale)} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.section}>{t('sectionAccount', locale as Locale)}</Text>
        <ListRow
          variant="navigation"
          label={t('rowProfile', locale as Locale)}
          value={profile?.displayName ?? undefined}
          onPress={() => router.push('/profile')}
        />
        <ListRow
          variant="navigation"
          label={t('rowSubscription', locale as Locale)}
          value={t('planFree', locale as Locale)}
          onPress={() => router.push('/subscription')}
        />

        <Text style={styles.section}>{t('sectionSecurity', locale as Locale)}</Text>
        <ListRow
          variant="toggle"
          label={t('biometricLogin', locale as Locale)}
          caption={biometricCapable ? undefined : t('biometricUnavailable', locale as Locale)}
          switchValue={!!profile?.biometricEnabled}
          onToggle={toggleBiometric}
          switchDisabled={!biometricCapable}
          switchPending={bioPending}
        />

        <Text style={styles.section}>{t('sectionNotifications', locale as Locale)}</Text>
        <ListRow
          variant="toggle"
          label={t('notifications', locale as Locale)}
          switchValue={!!profile?.notifEnabled}
          onToggle={toggleNotifications}
          switchPending={notifPending}
        />
        {notifPerm === 'denied' ? (
          <Banner
            variant="warning"
            text={t('notifDenied', locale as Locale)}
            actionLabel={t('openSettings', locale as Locale)}
            onAction={() => {
              /* device: Linking.openSettings(); web: no-op */
            }}
          />
        ) : null}

        <Text style={styles.section}>{t('sectionGeneral', locale as Locale)}</Text>
        <ListRow
          variant="navigation"
          label={t('language', locale as Locale)}
          value={locale === 'ar' ? 'العربية' : 'English'}
          onPress={toggle}
        />
        <ListRow variant="plain" label={t('signOut', locale as Locale)} destructive onPress={doSignOut} />
        <ListRow variant="value" label={t('version', locale as Locale)} value="0.1.0" />
      </ScrollView>

      <Modal
        visible={explainer !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setExplainer(null)}
      >
        <Pressable style={styles.scrim} onPress={() => setExplainer(null)}>
          <Pressable style={styles.sheet} onPress={() => {}} accessibilityViewIsModal>
            <Text style={styles.sheetTitle}>
              {t(explainer === 'biometric' ? 'biometricExplainTitle' : 'notifExplainTitle', locale as Locale)}
            </Text>
            <Text style={styles.sheetBody}>
              {t(explainer === 'biometric' ? 'biometricExplainBody' : 'notifExplainBody', locale as Locale)}
            </Text>
            <View style={styles.sheetActions}>
              <Button label={t('enable', locale as Locale)} onPress={confirmExplainer} />
              <Button label={t('notNow', locale as Locale)} variant="text" onPress={() => setExplainer(null)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas, paddingTop: 56 },
  body: { paddingBottom: space.xl },
  section: {
    fontSize: 13,
    fontWeight: '600',
    color: color.text.secondary,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xs,
    textAlign: 'left',
  },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: color.bg.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: color.text.primary, textAlign: 'left' },
  sheetBody: { fontSize: 15, color: color.text.secondary, textAlign: 'left', lineHeight: 22 },
  sheetActions: { gap: space.xs, marginTop: space.xs },
});
