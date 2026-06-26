import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import type { Locale, Profile } from '@bestoffers/shared';
import { Avatar } from '../../src/components/Avatar';
import { Banner } from '../../src/components/Banner';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { accounts, apiBaseUrl } from '../../src/api/config';
import { useLocale } from '../../src/locale';
import { t } from '../../src/i18n';
import { color, radius, space } from '../../src/theme';

// 1×1 PNG (base64) — stands in for a cropped photo so the upload→/me/avatar flow is clickable on
// web where there is no native image picker/cropper (those need a device — see Handoff).
const SAMPLE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** P2 — Profile edit. Name + email (LTR) + avatar upload. Save disabled until a field changes. */
export default function ProfileEditScreen() {
  const { locale } = useLocale();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailChanged, setEmailChanged] = useState(false);

  useEffect(() => {
    accounts.getProfile().then((p) => {
      setProfile(p);
      setName(p.displayName ?? '');
      setEmail(p.email ?? '');
      setAvatarUrl(p.avatarUrl);
    });
  }, []);

  const emailValid = email === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const dirty =
    !!profile &&
    (name !== (profile.displayName ?? '') || email !== (profile.email ?? '') || avatarUrl !== profile.avatarUrl);
  const canSave = dirty && emailValid && !saving;

  async function pickAvatar() {
    // Web demo: no native picker → upload a sample image so the round-trip is real.
    setUploading(true);
    setError(null);
    try {
      const res = await accounts.uploadAvatar(SAMPLE_PNG, 'image/png');
      setAvatarUrl(res.avatarUrl);
    } catch {
      setError(t('genericError', locale as Locale));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const body: any = {};
      if (name !== (profile.displayName ?? '')) body.displayName = name;
      if (email !== (profile.email ?? '')) body.email = email;
      const res = await accounts.updateProfile(body);
      if (body.email && res.emailVerifyToken) {
        // Mock: surface + auto-complete verification so the demo isn't stuck on a missing mailer.
        await accounts.verifyEmail(res.emailVerifyToken);
        setEmailChanged(true);
      }
      router.back();
    } catch {
      setError(t('genericError', locale as Locale));
    } finally {
      setSaving(false);
    }
  }

  const previewUri = avatarUrl ? `${apiBaseUrl}${avatarUrl}` : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t('editProfile', locale as Locale)}
        leadingLabel={t('cancel', locale as Locale)}
        onLeading={() => router.back()}
        trailingLabel={t('save', locale as Locale)}
        onTrailing={save}
        trailingDisabled={!canSave}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.heroAvatar}>
          <Avatar uri={previewUri} name={name} size="lg" editable onEdit={pickAvatar} />
          {uploading ? <Text style={styles.uploadingText}>…</Text> : null}
        </View>

        {error ? <Banner variant="error" text={error} /> : null}
        {emailChanged ? <Banner variant="success" text={t('emailVerified', locale as Locale)} /> : null}

        <Text style={styles.label}>{t('nameLabel', locale as Locale)}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="—" />

        <Text style={styles.label}>{t('emailLabel', locale as Locale)}</Text>
        <TextInput
          style={[styles.input, styles.ltr]}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="name@example.com"
          placeholderTextColor="#9AA3AB"
        />
        {!emailValid ? <Text style={styles.fieldError}>{t('emailLabel', locale as Locale)} ✗</Text> : null}
        <Text style={styles.helper}>{t('emailReverifyHelper', locale as Locale)}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas, paddingTop: 56 },
  body: { padding: space.lg, gap: space.sm },
  heroAvatar: { alignItems: 'center', marginVertical: space.lg },
  uploadingText: { color: color.text.secondary, marginTop: space.sm },
  label: { fontSize: 13, color: color.text.secondary, marginTop: space.md, textAlign: 'left' },
  input: {
    minHeight: 52,
    borderColor: color.border.default,
    borderWidth: 1,
    borderRadius: radius.input,
    backgroundColor: color.bg.surface,
    paddingHorizontal: space.lg,
    fontSize: 16,
    color: color.text.primary,
    textAlign: 'left',
  },
  ltr: { writingDirection: 'ltr' },
  fieldError: { color: color.state.error, fontSize: 13, textAlign: 'left' },
  helper: { color: color.text.secondary, fontSize: 13, textAlign: 'left' },
});
