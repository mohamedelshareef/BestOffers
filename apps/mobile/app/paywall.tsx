import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { Locale, Sector } from '@bestoffers/shared';
import { PlanBlock } from '../src/components/PlanBlock';
import { Button } from '../src/components/Button';
import { GradientButton } from '../src/components/GradientButton';
import { Banner } from '../src/components/Banner';
import { accounts } from '../src/api/config';
import { userIdFromMockCheckoutUrl } from '../src/api/accountsClient';
import { useLocale } from '../src/locale';
import { t } from '../src/i18n';
import { color, font, radius, space } from '../src/theme';

/**
 * D2 — Paywall (modal-route). Shown on a 402 PAYWALL. $1/mo plan, Subscribe CTA → /billing/checkout.
 * In mock mode the hosted Stripe sheet doesn't exist, so a dev "confirm subscription" affordance
 * drives /billing/webhook to flip the account to active. On success we resume back to the
 * category-scoped search screen which auto-re-runs the blocked intent → now unlimited.
 *
 * v2 re-skin (README item 6): sand canvas, bottom sheet with a gold crown, brand-gradient CTA,
 * neutral price block (no fake scarcity), USD fine-print retained.
 */
export default function PaywallScreen() {
  const { locale } = useLocale();
  const params = useLocalSearchParams<{ cat?: string }>();
  const cat: Sector =
    params.cat === 'food' ? 'food' : params.cat === 'realestate' ? 'realestate' : 'electronics';
  const lc = locale as Locale;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  async function subscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await accounts.checkout();
      setCheckoutUrl(res.url);
    } catch {
      setError(t('genericError', lc));
    } finally {
      setLoading(false);
    }
  }

  async function devConfirm() {
    if (!checkoutUrl) return;
    setLoading(true);
    setError(null);
    try {
      const userId = userIdFromMockCheckoutUrl(checkoutUrl);
      if (!userId) throw new Error('no userId');
      await accounts.webhook('mock.confirm', userId);
      // Resume the blocked intent on the same category-scoped search screen (now premium → unlimited).
      router.replace({ pathname: '/search', params: { cat, resume: '1' } });
    } catch {
      setError(t('genericError', lc));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.scrim} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.crown}>
          <Text style={styles.crownGlyph}>★</Text>
        </View>

        <View style={styles.header}>
          <Button label={t('later', lc)} variant="text" onPress={() => router.back()} />
        </View>

        <Text style={styles.headline}>{t('paywallHeadline', lc)}</Text>
        <Text style={styles.sub}>{t('paywallSub', lc)}</Text>

        <View style={styles.plan}>
          <PlanBlock
            planName={t('planName', lc)}
            price={t('priceMonthly', lc)}
            caption={t('priceCaption', lc)}
            bullets={[t('bulletUnlimited', lc), t('bulletAlerts', lc)]}
          />
        </View>

        {error ? <Banner variant="error" text={error} /> : null}

        <View style={styles.cta}>
          {!checkoutUrl ? (
            <GradientButton label={t('subscribeCta', lc)} onPress={subscribe} loading={loading} />
          ) : (
            <GradientButton label={t('devConfirmSub', lc)} onPress={devConfirm} loading={loading} />
          )}
        </View>

        <Text style={styles.fine}>{t('billedUsd', lc)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: color.overlay.scrim },
  sheet: {
    backgroundColor: color.bg.canvas,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xxl,
  },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: color.border.strong, marginBottom: space.md },
  crown: { alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: color.accent.goldSoft, alignItems: 'center', justifyContent: 'center' },
  crownGlyph: { fontSize: 26, color: color.accent.gold },
  header: { flexDirection: 'row', justifyContent: 'flex-start' },
  headline: { fontSize: 22, fontFamily: font.displayBold, color: color.text.primary, textAlign: 'center', marginTop: space.sm },
  sub: { fontSize: 15, fontFamily: font.body, color: color.text.secondary, textAlign: 'center', marginTop: space.sm, marginBottom: space.lg },
  plan: { marginVertical: space.md },
  cta: { marginTop: space.lg },
  fine: { fontSize: 12, fontFamily: font.body, color: color.text.secondary, textAlign: 'center', marginTop: space.md },
});
