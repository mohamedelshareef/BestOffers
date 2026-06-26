import { Platform } from 'react-native';

/**
 * Platform-appropriate secret storage for the refresh token (F-C1).
 *  - Native (iOS/Android): expo-secure-store (Keychain / Keystore), dynamically required so the web
 *    bundle never pulls a native-only module. REAL secure storage needs a device — see Handoff.
 *  - Web (npm run demo / Expo Web): there is no Keychain; fall back to localStorage. This is the
 *    demo target and is honestly NOT secure — fine for a keyless mock walkthrough, not for prod.
 */
const KEY = 'bo.refresh';

let secureStore: any | null = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    secureStore = require('expo-secure-store');
  } catch {
    secureStore = null; // not installed → memory fallback below
  }
}

const memory = new Map<string, string>();

export async function setRefreshToken(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(KEY, value);
      return;
    } catch {
      memory.set(KEY, value);
      return;
    }
  }
  if (secureStore) return secureStore.setItemAsync(KEY, value);
  memory.set(KEY, value);
}

export async function getRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(KEY);
    } catch {
      return memory.get(KEY) ?? null;
    }
  }
  if (secureStore) return secureStore.getItemAsync(KEY);
  return memory.get(KEY) ?? null;
}

export async function clearRefreshToken(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem(KEY);
      return;
    } catch {
      memory.delete(KEY);
      return;
    }
  }
  if (secureStore) {
    await secureStore.deleteItemAsync(KEY);
    return;
  }
  memory.delete(KEY);
}
