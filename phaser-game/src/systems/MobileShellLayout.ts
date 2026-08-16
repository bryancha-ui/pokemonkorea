export interface MobileShellLayout {
  viewportWidth: number;
  viewportHeight: number;
  portrait: boolean;
  /** True when the play screen and controls should be arranged vertically.
   *  Foldables can be physically landscape while their visible browser area is
   *  almost square, so this is intentionally not the same as `portrait`. */
  stacked: boolean;
  direction: 'row' | 'column';
  gameWidth: number;
  gameHeight: number;
  deckWidth: number;
  deckHeight: number;
}

const GAME_ASPECT = 16 / 9;
const DECK_ASPECT = 17.5 / 9.4;
// A barely-wide / near-square foldable is much better served by a full-width
// play screen with the compact deck underneath. Side-by-side is reserved for a
// genuinely wide landscape viewport; otherwise the game can remain stuck at
// roughly the folded phone width after the device is opened.
const SIDE_BY_SIDE_MIN_ASPECT = 1.48;

/** Pure viewport-to-shell geometry. No crop or stretch is ever applied. */
export function calculateMobileShellLayout(
  visibleWidth: number,
  visibleHeight: number,
  immersive = false,
): MobileShellLayout {
  const vw = Math.max(240, Math.round(visibleWidth));
  // Landscape browser chrome can leave less than 320 CSS px. Clamping to the
  // old 320px floor made the document taller than the actual screen and clipped
  // the controls, so retain only a small malformed-viewport safety floor.
  const vh = Math.max(180, Math.round(visibleHeight));
  const portrait = vh >= vw;
  const stacked = vw / vh < SIDE_BY_SIDE_MIN_ASPECT;
  let gameWidth: number;
  let gameHeight: number;
  let deckWidth: number;
  let deckHeight: number;

  if (immersive) {
    gameWidth = Math.min(vw, vh * GAME_ASPECT);
    gameHeight = gameWidth / GAME_ASPECT;
    deckWidth = 0;
    deckHeight = 0;
  } else if (stacked) {
    // Width limits a 16:9 game on portrait and near-square foldable screens.
    // Use all of it, then size the controls from their authored footprint. On
    // an unfolded Fold this nearly doubles the play-screen width compared with
    // treating a 1.01:1 browser area as an ordinary landscape phone.
    gameWidth = vw;
    gameHeight = gameWidth / GAME_ASPECT;
    const deckHeightCap = Math.min(260, vh * 0.30);
    deckHeight = Math.min(vw / DECK_ASPECT, deckHeightCap);
    deckWidth = Math.min(vw, deckHeight * DECK_ASPECT);

    const total = gameHeight + deckHeight;
    if (total > vh) {
      const scale = vh / total;
      gameWidth *= scale;
      gameHeight *= scale;
      deckWidth *= scale;
      deckHeight *= scale;
    }
  } else {
    // A wide phone has enough horizontal room to emulate the two surfaces side
    // by side. This keeps the 16:9 play screen close to full viewport height;
    // stacking the deck below it wasted roughly half of an ultrawide display.
    const minimumDeckWidth = Math.min(180, vw * 0.32);
    const preferredDeckWidth = Math.max(minimumDeckWidth, Math.min(240, vw * 0.22));
    deckWidth = Math.min(preferredDeckWidth, vh * DECK_ASPECT);
    deckHeight = deckWidth / DECK_ASPECT;
    const availableGameWidth = Math.max(120, vw - deckWidth);
    gameWidth = Math.min(availableGameWidth, vh * GAME_ASPECT);
    gameHeight = gameWidth / GAME_ASPECT;
  }

  return {
    viewportWidth: vw,
    viewportHeight: vh,
    portrait,
    stacked: immersive || stacked,
    direction: !immersive && !stacked ? 'row' : 'column',
    gameWidth,
    gameHeight,
    deckWidth,
    deckHeight,
  };
}
