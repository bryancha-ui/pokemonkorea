export const STANDALONE_TEST_MODES = [
  'ryeo-battle', 'nabi-entrance', 'hwanung-entrance', 'hwanung-battle', 'true-ending',
  'battle-regressions', 'ui-localization', 'close-combat', 'fly-move', 'special-move-fx', 'move-fx-families', 'status-effects',
  'starter-select', 'starter-rival-vipour',
  'reward-ceremony',
  'leaderboard', 'leaderboard-live',
  'finale-party', 'finale-night-boy', 'finale-night-girl', 'finale-logo',
] as const;
export type StandaloneTestMode = typeof STANDALONE_TEST_MODES[number];

/** Dedicated, non-saving scene-flow checks opened through the `?test=` URL. */
export function standaloneTestMode(): StandaloneTestMode | undefined {
  const value = new URLSearchParams(location.search).get('test');
  return STANDALONE_TEST_MODES.find(mode => mode === value);
}
