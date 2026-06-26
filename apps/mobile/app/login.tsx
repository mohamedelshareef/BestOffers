import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import type { Locale, OtpChannel } from '@bestoffers/shared';
import { Button } from '../src/components/Button';
import { Banner } from '../src/components/Banner';
import { accounts } from '../src/api/config';
import { t } from '../src/i18n';
import { color, radius, space } from '../src/theme';
import { useLocale } from '../src/locale';

/** C1 — WhatsApp OTP request (phone entry). WhatsApp-first with an SMS-fallback affordance. */
export default function LoginScreen() {
  const { locale } = useLocale();
  const [phone, setPhone] = useState('5');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSmsFallback, setShowSmsFallback] = useState(false);

  const e164 = `+965${phone.replace(/\D/g, '')}`;
  const valid = /^\+965\d{7,8}$/.test(e164);

  async function send(channel: OtpChannel) {
    if (!valid) return;
    setSending(true);
    setError(null);
    try {
      const res = await accounts.requestOtp(e164, locale as Locale, channel);
      router.push({
        pathname: '/login/otp',
        params: { phone: e164, channel: res.channel, cooldown: String(res.cooldownSeconds) },
      });
    } catch (e: any) {
      setError(t('waUndeliverable', locale as Locale));
      setShowSmsFallback(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t('signIn', locale as Locale)}</Text>
      <Text style={styles.hint}>{t('signInHint', locale as Locale)}</Text>

      <Text style={styles.label}>{t('phoneLabel', locale as Locale)}</Text>
      <View style={styles.phoneRow}>
        <Text style={styles.prefix}>+965</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="5XXXXXXX"
          placeholderTextColor="#9AA3AB"
          maxLength={8}
        />
      </View>

      <Text style={styles.devHint}>{t('devCodeHint', locale as Locale)}</Text>

      {error ? <Banner variant="error" text={error} /> : null}

      <View style={styles.cta}>
        <Button
          label={t('sendViaWhatsapp', locale as Locale)}
          onPress={() => send('whatsapp')}
          disabled={!valid}
          loading={sending}
        />
        {showSmsFallback ? (
          <Button
            label={t('sendViaSms', locale as Locale)}
            variant="text"
            onPress={() => send('sms')}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space.lg, paddingTop: 72, backgroundColor: color.bg.canvas, gap: space.md },
  title: { fontSize: 22, fontWeight: '700', color: color.text.primary, textAlign: 'left' },
  hint: { fontSize: 14, color: color.text.secondary, textAlign: 'left' },
  label: { fontSize: 13, color: color.text.secondary, marginTop: space.md, textAlign: 'left' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  prefix: { fontSize: 16, fontWeight: '600', color: color.text.primary },
  input: {
    flex: 1,
    minHeight: 56,
    borderColor: color.border.default,
    borderWidth: 1,
    borderRadius: radius.button,
    backgroundColor: color.bg.surface,
    paddingHorizontal: space.lg,
    fontSize: 16,
    color: color.text.primary,
    writingDirection: 'ltr',
    textAlign: 'left',
  },
  devHint: { fontSize: 12, color: color.text.secondary, fontStyle: 'italic', textAlign: 'left' },
  cta: { marginTop: space.lg, gap: space.sm },
});
