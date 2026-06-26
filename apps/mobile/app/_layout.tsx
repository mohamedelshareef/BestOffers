import React, { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { Rubik_400Regular, Rubik_700Bold, Rubik_800ExtraBold } from '@expo-google-fonts/rubik';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { accounts } from '../src/api/config';
import { restore } from '../src/auth/session';

/**
 * Stack navigation (flows-and-ia §1.2 — single linear funnel, not tabs). RTL-first: force RTL for
 * the Arabic-primary experience (takes effect after a reload; the locale toggle flips copy+alignment
 * live — a true layout flip needs a controlled restart, deferred to a later slice).
 * On boot we restore the session from the persisted refresh token (SecureStore native / localStorage
 * web) so a returning user lands authed (metered + quota pill) without re-entering an OTP.
 *
 * v2 re-skin: load the brand pairing — Rubik (display) + IBM Plex Sans Arabic (body) — via expo-font.
 * Rendering proceeds even if fonts are still loading (system fallback) so we never block the splash.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Rubik_400Regular,
    Rubik_700Bold,
    Rubik_800ExtraBold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
  });

  useEffect(() => {
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
    restore((refresh) => accounts.refresh(refresh)).catch(() => {});
  }, []);

  // fontsLoaded intentionally NOT gated — we render with the system fallback if the font is still
  // loading (or failed offline) so the app never hangs on a blank screen.
  void fontsLoaded;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="categories" />
      <Stack.Screen name="search" />
      <Stack.Screen name="login" />
      <Stack.Screen name="login/otp" />
      <Stack.Screen name="profile/index" />
      <Stack.Screen name="profile/edit" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
