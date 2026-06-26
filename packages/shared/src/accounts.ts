/**
 * Accounts / Auth / Billing / Freemium contract types (ADR-004).
 * Frozen request/response shapes shared by API + mobile. Phone PII NEVER appears in events;
 * the only identity that crosses into analytics is `pseudoId` (privacy wall, system-design).
 */
import { Locale } from './domain';

// ── Profile (Slice A — F-A1/A2/A3) ──
export interface Profile {
  id: string; // auth user id (maps to auth.users in Supabase prod)
  pseudoId: string; // ONLY id that enters events
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  emailPending: string | null; // new email awaiting verification (F-A1 AC-4)
  avatarUrl: string | null;
  localePref: Locale;
  notifEnabled: boolean; // F-A3 master toggle
  notifPrefs: Record<string, boolean>; // per-type {price_drop, account_security, ...}
  biometricEnabled: boolean; // F-A2 (informational; secret is device-side)
}

/** PATCH /me body — all fields optional; partial update. Email change triggers re-verification. */
export interface ProfileUpdate {
  displayName?: string;
  email?: string | null;
  avatarUrl?: string | null;
  localePref?: Locale;
  notifEnabled?: boolean;
  notifPrefs?: Record<string, boolean>;
  biometricEnabled?: boolean;
}

// ── Auth / OTP (Slice B — F-C1) ──
export type OtpChannel = 'whatsapp' | 'sms';

export interface OtpRequestBody {
  phoneE164: string; // +965…
  locale: Locale;
  channel?: OtpChannel; // default whatsapp; 'sms' = fallback
}
export interface OtpRequestResponse {
  sent: true;
  channel: OtpChannel;
  cooldownSeconds: number; // resend cooldown (F-C1 AC-5)
}
export interface OtpVerifyBody {
  phoneE164: string;
  code: string;
}
export interface OtpVerifyResponse {
  access: string; // short-lived access JWT
  refresh: string; // rotating refresh token (device SecureStore under biometric)
  pseudoId: string;
  localePref: Locale;
  isNewUser: boolean; // first sign-in → unlock biometric opt-in (F-A2 AC-1)
}
export interface OtpRefreshBody {
  refresh: string;
}

// ── Billing (Slice C — F-D1) ──
export type SubStatus = 'none' | 'active' | 'trialing' | 'past_due' | 'canceled';
export interface BillingStatus {
  status: SubStatus;
  premium: boolean; // active | trialing
  currentPeriodEnd: string | null; // ISO-8601
}
export interface CheckoutResponse {
  url: string;
}

// ── Freemium gate (Slice D — F-D2) ──
export interface QuotaStatus {
  used: number;
  limit: number; // 5 free (lifetime, never-reset per BA AC-6)
  premium: boolean;
}
/** 402 body when the gate blocks search #6 (F-D2 AC-5). App routes to checkout. */
export interface PaywallError {
  error: 'PAYWALL';
  used: number;
  limit: number;
}

export const FREE_SEARCH_LIMIT = 5;
