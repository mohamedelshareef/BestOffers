/**
 * D2 (HIGH) gating logic for the first-time enable EXPLAINER sheets (F-A2 biometric / F-A3 notifs).
 * Pure + testable (no RN render). The rule: toggling a feature ON for the FIRST time must SHOW the
 * explainer sheet BEFORE the switch flips — the toggle only persists after the user taps "Enable"
 * (and, for notifications, the OS permission is granted). Toggling OFF is immediate.
 */
export type ExplainerKind = 'biometric' | 'notifications';

/** What the toggle handler should do. 'explain' opens the sheet (no persist yet); 'persist' writes. */
export function toggleDecision(next: boolean, currentlyEnabled: boolean): 'explain' | 'persist' {
  // Enabling from OFF → show the explainer first. Disabling (or re-confirming an enabled state) persists.
  if (next && !currentlyEnabled) return 'explain';
  return 'persist';
}
