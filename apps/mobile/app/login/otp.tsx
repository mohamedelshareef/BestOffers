import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { Locale, OtpChannel } from '@bestoffers/shared';
import { OtpInput } from '../../src/components/OtpInput';
import { Button } from '../../src/components/Button';
import { Banner } from '../../src/components/Banner';
import { accounts } from '../../src/api/config';
import { signIn } from '../../src/auth/session';
import { setLocale } from '../../src/locale';
import { useLocale } from '../../src/locale';
import { t, tn } from '../../src/i18n';
import { color, space } from '../../src/theme';

/** C2 — WhatsApp OTP verify. N5 6-box input, resend countdown, expiry/error states, SMS retry. */
export default function OtpScreen() {
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ phone: string; channel: string; cooldown: string }>();
  const phone = (params.phone as string) ?? '';
  const [channel, setChannel] = useState<OtpChannel>((params.channel as OtpChannel) ?? 'whatsapp');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(Number(params.cooldown ?? 30));

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const masked = phone ? `…${phone.slice(-2)}` : '';
  const channelLabel = channel === 'sms' ? t('channelSms', locale as Locale) : t('channelWhatsapp', locale as Locale);

  async function verify(full: string) {
    setVerifying(true);
    setError(null);
    try {
      const res = await accounts.verifyOtp(phone, full);
      await signIn(res);
      setLocale(res.localePref);
      router.replace('/categories'); // post-login landing = category select (authed root)
    } catch (e: any) {
      setError(t('otpWrong', locale as Locale));
      setCode('');
    } finally {
      setVerifying(false);
    }
  }

  async function resend(ch: OtpChannel) {
    setError(null);
    try {
      const res = await accounts.requestOtp(phone, locale as Locale, ch);
      setChannel(res.channel);
      setSeconds(res.cooldownSeconds);
    } catch {
      setError(t('waUndeliverable', locale as Locale));
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t('otpTitle', locale as Locale)}</Text>
      <Text style={styles.sent}>
        {tn('otpSentVia', locale as Locale, { ch: channelLabel, dest: masked })}
      </Text>

      <View style={styles.otpWrap}>
        <OtpInput value={code} onChange={setCode} onComplete={verify} error={!!error} disabled={verifying} />
      </View>

      {error ? <Banner variant="error" text={error} /> : null}

      <Button
        label={t('done', locale as Locale)}
        onPress={() => verify(code)}
        disabled={code.length !== 6}
        loading={verifying}
      />

      <View style={styles.resendRow}>
        {seconds > 0 ? (
          <Text style={styles.resendDisabled}>
            {tn('resendIn', locale as Locale, { s: `0:${String(seconds).padStart(2, '0')}` })}
          </Text>
        ) : (
          <Button label={t('resend', locale as Locale)} variant="text" onPress={() => resend(channel)} />
        )}
        <Button label={t('tryViaSms', locale as Locale)} variant="text" onPress={() => resend('sms')} />
      </View>

      <Button label={t('changeNumber', locale as Locale)} variant="text" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space.lg, paddingTop: 72, backgroundColor: color.bg.canvas, gap: space.md },
  title: { fontSize: 22, fontWeight: '700', color: color.text.primary, textAlign: 'left' },
  sent: { fontSize: 14, color: color.text.secondary, textAlign: 'left' },
  otpWrap: { marginVertical: space.lg },
  resendRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  resendDisabled: { fontSize: 14, color: color.text.secondary },
});
