export const STANDALONE_TEST_MODES = ['ryeo-battle', 'nabi-entrance', 'true-ending'] as const;
export type StandaloneTestMode = typeof STANDALONE_TEST_MODES[number];

/** Dedicated, non-saving scene-flow checks opened through the `?test=` URL. */
export function standaloneTestMode(): StandaloneTestMode | undefined {
  const value = new URLSearchParams(location.search).get('test');
  return STANDALONE_TEST_MODES.find(mode => mode === value);
}
