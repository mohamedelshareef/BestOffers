// Tests run OFFLINE: never hit the live provider sites (S2.6). Live fetch is exercised by the
// dedicated live script (scripts/live-offers-spike.ts), not by the unit suite.
process.env.LIVE_FETCH = 'off';
