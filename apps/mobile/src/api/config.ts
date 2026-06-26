import Constants from 'expo-constants';
import { AccountsClient } from './accountsClient';
import { SearchClient } from './searchClient';
import { accessTokenProvider } from '../auth/session';

/** Resolved API base URL (app.json extra.apiBaseUrl; defaults to local demo API). */
export const apiBaseUrl =
  ((Constants.expoConfig?.extra as any)?.apiBaseUrl as string) ?? 'http://localhost:3000';

/**
 * Shared client singletons — both read the live access token via accessTokenProvider().
 * `fetch` MUST be bound to its realm (window/global): calling a bare `fetch` reference as a method
 * (`this.fetchImpl(...)`) makes the browser throw `TypeError: Illegal invocation`, which silently
 * failed every web search (the button appeared to do nothing). Bind once here.
 */
const boundFetch: typeof fetch = (...args) => fetch(...args);
export const accounts = new AccountsClient(apiBaseUrl, accessTokenProvider, boundFetch);
export const search = new SearchClient(apiBaseUrl, boundFetch, accessTokenProvider);
