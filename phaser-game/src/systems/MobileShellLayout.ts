export interface MobileShellLayout {
  viewportWidth: number;
  viewportHeight: number;
  portrait: boolean;
  direction: 'row' | 'column';
  gameWidth: number;
  gameHeight: number;
  deckWidth: number;
  deckHeight: number;
}

const GAME_ASPECT = 16 / 9;
const DECK_ASPECT = 17.5 / 9.4;

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
  let gameWidth: number;
  let gameHeight: number;
  let deckWidth: number;
  let deckHeight: number;

  if (immersive) {
    gameWidth = Math.min(vw, vh * GAME_ASPECT);
    gameHeight = gameWidth / GAME_ASPECT;
    deckWidth = 0;
    deckHeight = 0;
  } else if (portrait) {
    // Width limits a 16:9 game on portrait phones. Use all of it, then size the
    // controls from their authored 17.5u × 9.4u footprint. The remaining tall-
    // phone space stays neutral instead of inflating and separating the keys.
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
    direction: !immersive && !portrait ? 'row' : 'column',
    gameWidth,
    gameHeight,
    deckWidth,
    deckHeight,
  };
}
