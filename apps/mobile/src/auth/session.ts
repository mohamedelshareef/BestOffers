/**
 * In-memory auth session (F-C1). The ACCESS token is short-lived and kept in memory only; the
 * REFRESH token is persisted (SecureStore native / localStorage web — see secureStorage.ts) and
 * exchanged for a fresh access token on boot. The access token is attached as
 * `Authorization: Bearer <access>` to every /search, /me, /billing call (AccountsClient + SearchClient).
 *
 * Deliberately framework-light: a module singleton + subscriber list so any screen can read/update
 * the session without prop-drilling, and `useSession()` re-renders subscribers on change.
 */
import { useEffect, useState } from 'react';
import type { OtpVerifyResponse } from '@bestoffers/shared';
import { clearRefreshToken, getRefreshToken, setRefreshToken } from './secureStorage';

export interface Session {
  access: string;
  pseudoId: string;
}

let current: Session | null = null;
const subscribers = new Set<() => void>();

function notify() {
  for (const fn of subscribers) fn();
}

export function getSession(): Session | null {
  return current;
}

/** Access token getter passed to the API clients so they always read the latest token. */
export function accessTokenProvider(): string | null {
  return current?.access ?? null;
}

export async function signIn(res: OtpVerifyResponse): Promise<void> {
  current = { access: res.access, pseudoId: res.pseudoId };
  await setRefreshToken(res.refresh);
  notify();
}

/** Update only the access token after a refresh (refresh token rotates separately). */
export async function setTokens(access: string, refresh: string): Promise<void> {
  if (current) current = { ...current, access };
  await setRefreshToken(refresh);
  notify();
}

export async function signOut(): Promise<void> {
  current = null;
  await clearRefreshToken();
  notify();
}

/**
 * Boot restore: if a refresh token is persisted, exchange it for a fresh access token. Returns the
 * restored pseudoId or null. `refreshFn` is injected (the AccountsClient) to keep this UI-agnostic.
 */
export async function restore(
  refreshFn: (refresh: string) => Promise<{ access: string; refresh: string; pseudoId?: string }>,
): Promise<Session | null> {
  const refresh = await getRefreshToken();
  if (!refresh) return null;
  try {
    const r = await refreshFn(refresh);
    current = { access: r.access, pseudoId: r.pseudoId ?? current?.pseudoId ?? 'me' };
    if (r.refresh) await setRefreshToken(r.refresh);
    notify();
    return current;
  } catch {
    await clearRefreshToken();
    return null;
  }
}

/** React hook: re-renders the caller whenever the session changes. */
export function useSession(): Session | null {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);
  return current;
}
