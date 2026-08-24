export interface MobileShellLayout {
  viewportWidth: number;
  viewportHeight: number;
  portrait: boolean;
  /** A narrow portrait phone cannot display a useful 16:9 play surface. */
  rotationRequired: boolean;
  /** Controls float over the game instead of consuming a second screen. */
  stacked: false;
  direction: 'overlay';
  gameWidth: number;
  gameHeight: number;
  deckWidth: number;
  deckHeight: number;
}

export const GAME_ASPECT = 16 / 9;
/** Tablets and unfolded foldables remain playable in portrait. */
export const PHONE_PORTRAIT_MAX_WIDTH = 560;

/**
 * Pure viewport-to-shell geometry shared by the live controls and audits.
 *
 * The game always receives the largest uncropped 16:9 rectangle that fits the
 * visible browser viewport. Controls use a full-viewport transparent overlay,
 * so they cannot push the game off-screen on a foldable or consume half of a
 * tall phone. `immersive` only hides controls; it never changes game scale.
 */
export function calculateMobileShellLayout(
  visibleWidth: number,
  visibleHeight: number,
  immersive = false,
): MobileShellLayout {
  const viewportWidth = Math.max(240, Math.round(visibleWidth));
  const viewportHeight = Math.max(180, Math.round(visibleHeight));
  const portrait = viewportHeight > viewportWidth;
  const gameWidth = Math.min(viewportWidth, viewportHeight * GAME_ASPECT);
  const gameHeight = gameWidth / GAME_ASPECT;

  return {
    viewportWidth,
    viewportHeight,
    portrait,
    rotationRequired: !immersive && portrait && viewportWidth <= PHONE_PORTRAIT_MAX_WIDTH,
    stacked: false,
    direction: 'overlay',
    gameWidth,
    gameHeight,
    deckWidth: viewportWidth,
    deckHeight: viewportHeight,
  };
}
