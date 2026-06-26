import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { BillingStatus, Locale } from '@bestoffers/shared';
import { Button } from '../src/components/Button';
import { Banner } from '../src/components/Banner';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { accounts } from '../src/api/config';
import { getSession } from '../src/auth/session';
import { useLocale } from '../src/locale';
import { t, tn } from '../src/i18n';
import { color, radius, space } from '../src/theme';

/** M1 — Subscription / Manage. active / canceled / past_due / free; cancel + renew via webhook (mock). */
export default function SubscriptionScreen() {
  const { locale } = useLocale();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    accounts
      .billingStatus()
      .then(setStatus)
      .catch(() => setError(t('genericError', locale as Locale)));
  }, [locale]);

  useFocusEffect(useCallback(() => load(), [load]));

  // Mock: drive the same webhook the real Stripe events would, scoped to this user.
  async function drive(type: string, sub?: 'active' | 'canceled' | 'past_due') {
    const userId = getSession()?.pseudoId;
    // The webhook keys on the auth userId; in mock the checkout URL carries it. For manage actions
    // we re-derive it from a fresh checkout (cheap, mock-only) so cancel/resume target the account.
    setBusy(true);
    setError(null);
    try {
      const co = await accounts.checkout();
      const m = /[?&]user=([^&]+)/.exec(co.url);
      const id = m ? decodeURIComponent(m[1]) : userId;
      if (!id) throw new Error('no user');
      await accounts.webhook(type, id, sub);
      load();
    } catch {
      setError(t('genericError', locale as Locale));
    } finally {
      setBusy(false);
    }
  }

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB') : '—');

  function statusBlock() {
    if (!status) return <Text style={styles.muted}>…</Text>;
    switch (status.status) {
      case 'active':
      case 'trialing':
        return (
          <View style={styles.block}>
            <Text style={[styles.pill, styles.pillSuccess]}>{t('statusActive', locale as Locale)}</Text>
            <Text style={styles.plan}>{t('planName', locale as Locale)} · {t('priceMonthly', locale as Locale)}</Text>
            <Text style={styles.muted}>{tn('renewsOn', locale as Locale, { date: fmt(status.currentPeriodEnd) })}</Text>
            <Button
              label={t('cancelSub', locale as Locale)}
              variant="secondary"
              loading={busy}
              onPress={() => drive('customer.subscription.deleted')}
            />
          </View>
        );
      case 'canceled':
        return (
          <View style={styles.block}>
            <Text style={[styles.pill, styles.pillWarning]}>{t('statusCanceled', locale as Locale)}</Text>
            <Text style={styles.muted}>{tn('endsOn', locale as Locale, { date: fmt(status.currentPeriodEnd) })}</Text>
            <Button
              label={t('resumeSub', locale as Locale)}
              loading={busy}
              onPress={() => drive('customer.subscription.updated', 'active')}
            />
          </View>
        );
      case 'past_due':
        return (
          <View style={styles.block}>
            <Banner variant="error" text={t('paymentIssue', locale as Locale)} />
            <Text style={[styles.pill, styles.pillError]}>{t('statusPastDue', locale as Locale)}</Text>
            <Button
              label={t('updatePayment', locale as Locale)}
              loading={busy}
              onPress={() => drive('mock.confirm')}
            />
          </View>
        );
      default: // 'none'
        return (
          <View style={styles.block}>
            <Text style={[styles.pill, styles.pillNeutral]}>{t('statusFree', locale as Locale)}</Text>
            <Button label={t('subscribeNow', locale as Locale)} loading={busy} onPress={() => router.push('/paywall')} />
          </View>
        );
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t('subscriptionTitle', locale as Locale)} />
      <ScrollView contentContainerStyle={styles.body}>
        {error ? <Banner variant="error" text={error} /> : null}
        {statusBlock()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg.canvas, paddingTop: 56 },
  body: { padding: space.lg, gap: space.lg },
  block: { gap: space.md, alignItems: 'flex-start' },
  plan: { fontSize: 16, fontWeight: '600', color: color.text.primary },
  muted: { fontSize: 14, color: color.text.secondary },
  pill: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.input,
    overflow: 'hidden',
  },
  pillSuccess: { color: color.state.success, backgroundColor: '#E8F6EF' },
  pillWarning: { color: color.state.warning, backgroundColor: '#FFF4E5' },
  pillError: { color: color.state.error, backgroundColor: '#FCEBEB' },
  pillNeutral: { color: color.text.secondary, backgroundColor: color.bg.surface },
});
