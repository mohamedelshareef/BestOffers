import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams, useRootNavigationState } from 'expo-router';
import { color } from '../src/theme';

/**
 * Splash / launch → redirect (flows §1.3). The post-login landing is now `/categories` (the authed
 * root), NOT `/search`. We redirect on mount:
 *   - `?q=<intent>` (QA / demo deep-link affordance) → `/search?cat=electronics&q=<intent>` so the
 *     auto-run search flow is preserved by URL on web/sim.
 *   - otherwise → `/categories`.
 * Session restore runs in the root layout; protected screens render the sign-in affordance when there
 * is no session (anonymous use stays clickable for the demo), so this redirect is unconditional.
 *
 * RENDER-FIX: on the web/static export this component's effect can fire BEFORE the root <Stack>
 * navigator has committed — calling router.replace then throws "Attempted to navigate before mounting
 * the Root Layout component", which unwinds React and leaves a BLANK page. Gate the redirect on
 * useRootNavigationState().key being defined (the navigator is mounted only once that key exists).
 */
export default function IndexRedirect() {
  const params = useLocalSearchParams<{ q?: string }>();
  const rootNavState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavState?.key) return; // wait until the root navigator is mounted (web export race)
    if (params.q) {
      router.replace(`/search?cat=electronics&q=${encodeURIComponent(params.q)}`);
    } else {
      router.replace('/categories');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootNavState?.key]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator color={color.brand.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.bg.canvas },
});
