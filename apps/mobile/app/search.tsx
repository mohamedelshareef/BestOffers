import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import type { Locale, QuotaStatus, ResultCard, SearchResponse, Sector } from '@bestoffers/shared';
import { PaywallRequired } from '../src/api/searchClient';
import { BlockedSearch, type SearchCall } from '../src/search/resume';
import { accounts, search } from '../src/api/config';
import { ResultCardView } from '../src/components/ResultCard';
import { VerdictRibbon } from '../src/components/VerdictRibbon';
import { ClarifierQuestionView } from '../src/components/ClarifierQuestion';
import { Avatar } from '../src/components/Avatar';
import { QuotaPill } from '../src/components/QuotaPill';
import { NumText } from '../src/components/NumText';
import { useSession } from '../src/auth/session';
import { useLocale } from '../src/locale';
import { t } from '../src/i18n';
import { color, font, gradient, radius, space } from '../src/theme';

/**
 * Intent (W6) → bounded clarifier chips (W7) → ranked cards (W9), wired to the Phase-2a auth +
 * freemium backend, now CATEGORY-SCOPED (flows §1.3): always reached from `/categories` with a `cat`
 * param (electronics | food) which maps 1:1 to the Sector contract. Header carries a back chevron →
 * `/categories` (preserves session) and echoes the category as the eyebrow.
 *
 * PO decision: switching category mid-search RESETS the funnel (a new `cat` is a brand-new search).
 *
 * v2 re-skin: sand canvas, Rubik headings, brand-gradient hero CTA, the best-price VERDICT ribbon on
 * rank #1 only, Western numerals via NumText. Anonymous use stays clickable (unmetered).
 */
const PSEUDO = 'mobile-demo';
type Phase = 'intent' | 'searching' | 'clarifying' | 'results';

const CAT_EYEBROW: Record<Sector, { ar: string; en: string }> = {
  electronics: { ar: 'الإلكترونيات', en: 'ELECTRONICS' },
  food: { ar: 'الطعام', en: 'FOOD' },
  realestate: { ar: 'عقارات', en: 'REAL ESTATE' },
};
const CAT_PLACEHOLDER: Record<Sector, { ar: string; en: string }> = {
  electronics: { ar: 'مثال: آيفون 17 برو ماكس', en: 'e.g. iPhone 17 Pro Max' },
  food: { ar: 'مثال: برجر، دجاج، بيتزا', en: 'e.g. burger, chicken, pizza' },
  realestate: { ar: 'مثال: شقة للإيجار بالسالوة، غرفتين', en: 'e.g. flat for rent in Salwa, 2BR' },
};

export default function SearchScreen() {
  const session = useSession();
  const { locale, toggle } = useLocale();
  const params = useLocalSearchParams<{ cat?: string; resume?: string; q?: string; skipclar?: string }>();
  // DEV/DEMO ONLY (non-default): `?q=...&cat=...&skipclar=1` auto-answers every clarifier with
  // __skip__ and runs straight through to the terminal results/empty screen (final product cards) —
  // mirrors the API harness's /search/intent → /search/answer(__skip__) path, but in the UI. The
  // normal flow (no skipclar) still asks the full ≥5 clarifier set.
  const skipClarifiers = params.skipclar === '1';
  // `cat` is required; default to electronics if a stray deep-link lacks it.
  const cat: Sector =
    params.cat === 'food' ? 'food' : params.cat === 'realestate' ? 'realestate' : 'electronics';

  const [intent, setIntent] = useState(params.q ?? '');
  const [phase, setPhase] = useState<Phase>('intent');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const blocked = useRef(new BlockedSearch());

  const lc = locale as Locale;
  const isRTL = lc === 'ar';
  const align = isRTL ? ('right' as const) : ('left' as const);
  const pseudo = session?.pseudoId ?? PSEUDO;

  function refreshQuota() {
    if (session) accounts.getQuota().then(setQuota).catch(() => setQuota(null));
    else setQuota(null);
  }

  useEffect(refreshQuota, [session]);

  // Switching category mid-search RESETS the funnel (PO decision): clear intent + results when `cat`
  // changes so the new category starts a clean search.
  useEffect(() => {
    setPhase('intent');
    setResponse(null);
    setIntent(params.q ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  useEffect(() => {
    if (params.resume === '1' && blocked.current.pending) {
      resumeBlocked();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.resume]);

  useEffect(() => {
    if (params.q && phase === 'intent') run(params.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

  function applyResponse(res: SearchResponse) {
    setResponse(res);
    setPhase(res.state === 'clarifying' ? 'clarifying' : 'results');
    refreshQuota();
  }

  /**
   * DEV/DEMO skip-loop: given a clarifying response, keep POSTing /search/answer with __skip__ for the
   * first presented question until the server reaches a terminal state (results | empty). Bounded by a
   * hard cap so a misbehaving server can never spin forever. Drives the SAME path the API harness uses.
   */
  async function autoSkipToTerminal(res: SearchResponse): Promise<SearchResponse> {
    let cur = res;
    for (let i = 0; cur.state === 'clarifying' && i < 12; i++) {
      const dim = cur.questions?.[0]?.dimension;
      if (!dim) break;
      cur = await search.submitAnswer(
        { searchSessionId: cur.searchSessionId, dimension: dim, answer: '__skip__' },
        pseudo,
      );
    }
    return cur;
  }

  async function execute(call: SearchCall, onBlockedPhase: Phase): Promise<void> {
    setPhase('searching');
    try {
      let res = await blocked.current.run(call);
      if (skipClarifiers && res.state === 'clarifying') {
        res = await autoSkipToTerminal(res);
      }
      applyResponse(res);
    } catch (e) {
      if (e instanceof PaywallRequired) {
        setPhase(onBlockedPhase);
        router.push(`/paywall?cat=${cat}`);
        return;
      }
      setPhase(onBlockedPhase);
    }
  }

  async function resumeBlocked() {
    setResponse(null);
    setPhase('searching');
    const res = await blocked.current.resume();
    if (res) applyResponse(res);
    else setPhase('intent');
  }

  async function run(intentRaw: string) {
    setResponse(null);
    await execute(
      () => search.startIntent({ sector: cat, locale: lc, intentRaw }, pseudo),
      'intent',
    );
  }

  async function start() {
    if (!intent.trim()) return;
    run(intent);
  }

  async function answer(dimension: string, value: string | null) {
    if (!response) return;
    const sessionId = response.searchSessionId;
    await execute(
      () => search.submitAnswer({ searchSessionId: sessionId, dimension, answer: value ?? '__skip__' }, pseudo),
      'clarifying',
    );
  }

  function reset() {
    setPhase('intent');
    setResponse(null);
  }

  const cards = response?.cards ?? [];
  // Verdict savings = (average − cheapest) of the REAL result set (cards are ranked cheapest-first).
  const savingsFils =
    cards.length > 1
      ? Math.max(0, Math.round(cards.reduce((s, c) => s + c.priceFils, 0) / cards.length) - cards[0].priceFils)
      : 0;

  const renderCard = ({ item, index }: { item: ResultCard; index: number }) =>
    index === 0 ? (
      <VerdictRibbon savingsFils={savingsFils} locale={lc}>
        <ResultCardView card={item} locale={lc} />
      </VerdictRibbon>
    ) : (
      <ResultCardView card={item} locale={lc} />
    );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {/* Back chevron → /categories (preserves session). Points the RTL-correct way. */}
        <Pressable
          style={styles.iconBtn}
          onPress={() => router.replace('/categories')}
          accessibilityRole="button"
          accessibilityLabel={t('back', lc)}
        >
          <Text style={styles.chevron}>{isRTL ? '›' : '‹'}</Text>
        </Pressable>
        <View style={styles.headEyebrowWrap}>
          <Text style={[styles.eyebrow, { textAlign: align }]} numberOfLines={1}>
            {isRTL ? CAT_EYEBROW[cat].ar : CAT_EYEBROW[cat].en}
          </Text>
        </View>
        <QuotaPill quota={quota} locale={lc} onSubscribe={() => router.push(`/paywall?cat=${cat}`)} />
        <Pressable style={styles.langBtn} onPress={toggle} accessibilityRole="button" accessibilityLabel="toggle language">
          <Text style={styles.langLabel}>{t('langToggle', lc)}</Text>
        </Pressable>
        {session ? (
          <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="profile">
            <Avatar name={pseudo} size="sm" />
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.title, { textAlign: align }]}>{t('intentTitle', lc)}</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, { textAlign: align }]}
          value={intent}
          onChangeText={setIntent}
          onSubmitEditing={start}
          editable={phase === 'intent'}
          placeholder={isRTL ? CAT_PLACEHOLDER[cat].ar : CAT_PLACEHOLDER[cat].en}
          placeholderTextColor="#9AA39F"
        />
        <Pressable
          onPress={start}
          disabled={!intent.trim() || phase === 'searching'}
          accessibilityRole="button"
          style={!intent.trim() ? styles.ctaDisabled : undefined}
        >
          <LinearGradient
            colors={gradient.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.searchBtn}
          >
            <Text style={styles.searchBtnLabel}>{t('searchCta', lc)}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {(phase === 'clarifying' || phase === 'results') && (
        <Pressable style={styles.newSearch} onPress={reset} accessibilityRole="button">
          <Text style={styles.newSearchLabel}>{t('newSearch', lc)}</Text>
        </Pressable>
      )}

      {phase === 'searching' && (
        <View style={styles.searching}>
          <ActivityIndicator color={color.brand.primary} />
          <Text style={[styles.searchingLabel, { textAlign: align }]}>{t('searching', lc)}</Text>
        </View>
      )}

      {phase === 'clarifying' && response?.questions?.[0] && (
        <ClarifierQuestionView
          question={response.questions[0]}
          locale={lc}
          index={response.clarifierCount}
          total={response.totalQuestions ?? 5}
          onAnswer={answer}
        />
      )}

      {phase === 'results' && response?.state === 'empty' && (
        <Text style={styles.empty}>{t('emptyTitle', lc)}</Text>
      )}

      {phase === 'results' && cards.length > 0 && (
        <FlatList
          data={cards}
          keyExtractor={(c) => c.offerId}
          renderItem={renderCard}
          ListHeaderComponent={
            <Text style={[styles.resultsMeta, { textAlign: align }]}>
              {isRTL ? 'رتّبنا ' : 'Ranked '}
              <NumText style={styles.resultsMetaNum}>{String(cards.length)}</NumText>
              {isRTL ? ' عروض حسب أفضل قيمة لك' : ' offers by best value'}
            </Text>
          }
          style={{ marginTop: 12 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space.lg, paddingTop: 56, backgroundColor: color.bg.canvas },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.lg, gap: space.sm },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: color.bg.surface,
    borderWidth: 1,
    borderColor: color.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: { fontSize: 24, color: color.text.primary, fontFamily: font.displayBold, lineHeight: 26 },
  headEyebrowWrap: { flex: 1 },
  eyebrow: { fontSize: 12, letterSpacing: 1, fontFamily: font.displayBold, color: color.brand.primary },
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
  title: { fontSize: 22, fontFamily: font.displayBold, color: color.text.primary, marginBottom: space.md },
  searchRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 56,
    borderColor: color.border.default,
    borderWidth: 1,
    borderRadius: radius.input,
    backgroundColor: color.bg.surface,
    paddingHorizontal: space.lg,
    fontSize: 16,
    fontFamily: font.body,
    color: color.text.primary,
  },
  searchBtn: {
    minHeight: 52,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
  },
  ctaDisabled: { opacity: 0.4 },
  searchBtnLabel: { color: color.text.onBrand, fontSize: 16, fontFamily: font.displayBold },
  newSearch: { marginTop: space.md, alignSelf: 'flex-start' },
  newSearchLabel: { color: color.brand.primary, fontSize: 14, fontFamily: font.bodySemiBold },
  searching: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: space.xl },
  searchingLabel: { flex: 1, color: color.text.secondary, fontSize: 14, fontFamily: font.body },
  resultsMeta: { fontSize: 13, color: color.text.secondary, fontFamily: font.body, marginBottom: 4 },
  resultsMetaNum: { fontSize: 13, color: color.text.secondary, fontFamily: font.bodySemiBold },
  empty: { marginTop: space.xl, color: color.text.secondary, textAlign: 'center', fontSize: 15, fontFamily: font.body },
});
