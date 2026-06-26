import { useEffect, useState } from 'react';
import type { Locale } from '@bestoffers/shared';

/**
 * App-wide locale (AR-first). A module singleton + subscribers so the header toggle on any screen
 * flips copy app-wide. NOTE: this switches copy + text alignment only. A true RTL/LTR *layout* flip
 * needs I18nManager.forceRTL + an app reload (deferred — see _layout.tsx + Handoff). The app boots
 * forced-RTL, which is correct for the Arabic-primary default.
 */
let current: Locale = 'ar';
const subscribers = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function setLocale(next: Locale): void {
  current = next;
  for (const fn of subscribers) fn();
}

export function toggleLocale(): void {
  setLocale(current === 'ar' ? 'en' : 'ar');
}

export function useLocale(): { locale: Locale; toggle: () => void } {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);
  return { locale: current, toggle: toggleLocale };
}
