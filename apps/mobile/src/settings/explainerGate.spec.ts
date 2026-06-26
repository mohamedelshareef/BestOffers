import { toggleDecision } from './explainerGate';

/**
 * D2 (HIGH) smoke: the first-time enable must route through the EXPLAINER sheet (no direct flip);
 * disabling or re-confirming an already-enabled feature persists directly (F-A2 / F-A3).
 */
describe('settings explainer gate', () => {
  it('enabling from OFF shows the explainer first (does NOT flip directly)', () => {
    expect(toggleDecision(true, false)).toBe('explain');
  });

  it('disabling persists immediately (no explainer)', () => {
    expect(toggleDecision(false, true)).toBe('persist');
  });

  it('confirming an already-enabled feature persists (idempotent, no explainer)', () => {
    expect(toggleDecision(true, true)).toBe('persist');
  });
});
