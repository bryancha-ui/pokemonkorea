import { LANG_EVENT, t, tr, typeName } from './i18n';
import { calculateMobileShellLayout } from './MobileShellLayout';
// ── Mobile "dual-screen" shell + on-screen controls ──────────────────────────
// On touch devices the page is split like a Nintendo DS: the Phaser game canvas
// lives on the TOP screen, and a solid control DECK fills the BOTTOM screen so the
// buttons never sit on top of the game. The deck holds an analog drag stick,
// A/B buttons and utility
// pills, and — during battle — a move-select bar (see deckShowMoves/deckHideMoves).
//
// Everything on the deck is sized in a single unit `--u` derived from the deck's
// ACTUAL box (a ResizeObserver recomputes it on rotate / fold / resize), so the
// controls always scale to fit and never overflow when the screen changes shape.
//
// The game reads the keyboard (arrows/SPACE/SHIFT/M/C/ESC); the stick/buttons
// synthesise those key events on `window` (the target Phaser listens on), so no
// per-scene wiring is needed. Battle move buttons instead call a JS callback the
// battle scene supplies, since the on-canvas move buttons are already tap-driven.

const KEY = {
  left: 37, up: 38, right: 39, down: 40,
  space: 32, shift: 16, m: 77, c: 67, esc: 27,
} as const;

/** Direct action bridge for scenes where an iOS synthetic key tap can fall
 * entirely between two Phaser frames. Keyboard Space remains the main path. */
export const MOBILE_ACTION_EVENT = 'pokemonkorea:mobile-action';
/** Direct menu bridge. Some standalone interiors do not register an M-key
 * listener, and synthetic key taps can be lost while a lazy scene is swapping. */
export const MOBILE_MENU_EVENT = 'pokemonkorea:mobile-menu';

export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/** Fire a synthetic keyboard event that Phaser will read (keyCode-indexed). */
function dispatchKey(type: 'keydown' | 'keyup', code: number): void {
  const ev = new KeyboardEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'keyCode', { get: () => code });
  Object.defineProperty(ev, 'which', { get: () => code });
  window.dispatchEvent(ev);
}

const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', electric: '#f8d030',
  grass: '#78c850', ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0',
  ground: '#e0c068', flying: '#a890f0', psychic: '#f85888', bug: '#a8b820',
  rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848',
  steel: '#b8b8d0', fairy: '#ee99ac',
};

interface DeckMove { data: { name: string; type: string; pp: number }; pp: number }

export interface DeckBattleAction {
  label: string;
  onPick: () => void;
  disabled?: boolean;
  accent?: string;
}

// ── Glass control palette ────────────────────────────────────────────────────
// The deck floats directly ON TOP of the play screen, so a control painted with
// a solid fill hides whatever it covers — in practice the dialogue box, which
// lives in exactly the bottom band the stick and A/B buttons occupy. Every deck
// surface is therefore see-through: the shape is carried by a bright rim and a
// hard text shadow instead of by an opaque panel, which stays readable over both
// a sunlit route and a dark interior while the text underneath still reads
// through. Only the pressed state briefly brightens, as touch feedback.
const GLASS_BG = 'rgba(24,32,58,0.20)';
const GLASS_BG_ACTIVE = 'rgba(126,162,240,0.42)';
const GLASS_BORDER = 'rgba(214,230,255,0.34)';
const GLASS_TEXT_SHADOW = '0 1px 3px rgba(0,0,0,0.95),0 0 10px rgba(0,0,0,0.6)';

const btnBase =
  'display:flex;align-items:center;justify-content:center;pointer-events:auto;' +
  'touch-action:none;user-select:none;-webkit-user-select:none;color:#fff;font-weight:700;' +
  '-webkit-touch-callout:none;' +
  `border:2px solid ${GLASS_BORDER};background:${GLASS_BG};` +
  `text-shadow:${GLASS_TEXT_SHADOW};` +
  'box-shadow:0 1px 5px rgba(0,0,0,0.22);-webkit-tap-highlight-color:transparent;box-sizing:border-box;';

/** One activation path shared by iOS Safari and Android browsers. Pointer
 * events are primary; click/touch are guarded fallbacks and never double-fire. */
// A tap acts on `pointerdown` for snappiness, but a deck button may swap in a NEW
// layer (FIGHT → the move buttons). The SAME finger's release then emits a `click`
// that lands on whatever button is now under it and fires it too — "FIGHT instantly
// picks a move" / "wrong Pokémon swapped". (That's why holding the finger down —
// which never releases, so never clicks — worked, while a quick tap double-fired.)
//
// So: after a real pointer/touch activation, eat the ONE trailing ghost click at the
// document CAPTURE phase, before it can reach any button. This is bulletproof (not a
// timing window) and leaves pointerdown instant. Deck buttons stay armed only for
// that single click; a genuine second tap is a fresh pointerdown.
let swallowClickUntil = 0;
let swallowArmed = false;
let deckGestureDown = false;
let moveInputReady = true;
let moveInputToken = 0;
function armGhostClickSwallow(): void {
  swallowArmed = true;
  swallowClickUntil = performance.now() + 900;   // safety expiry if no click ever comes
}
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (!swallowArmed) return;
    swallowArmed = false;
    if (performance.now() > swallowClickUntil) return;   // stale — let it through
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);   // capture: runs before any target's own click handler

  // Track the physical contact separately from its command. FIGHT replaces its
  // own layer on pointerdown, so the new move layer must wait for this release.
  document.addEventListener('pointerup', () => { deckGestureDown = false; }, true);
  document.addEventListener('pointercancel', () => { deckGestureDown = false; }, true);
  if (typeof window !== 'undefined' && !('PointerEvent' in window)) {
    document.addEventListener('touchend', () => { deckGestureDown = false; }, true);
    document.addEventListener('touchcancel', () => { deckGestureDown = false; }, true);
  }
}

function bindTap(el: HTMLElement, callback: () => void): void {
  let lastActivation = -Infinity;
  const activate = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const now = performance.now();
    // Per-button debounce: one finger contact can't become two of the SAME command.
    if (now - lastActivation < 400) return;
    lastActivation = now;
    // Real (pointer/touch) tap → swallow its trailing ghost click. A bare `click`
    // (no-pointer fallback devices) IS the activation, so don't self-swallow.
    if (e.type !== 'click') {
      deckGestureDown = true;
      armGhostClickSwallow();
    }
    callback();
  };
  el.addEventListener('pointerdown', activate);
  el.addEventListener('click', activate);
  if (!('PointerEvent' in window)) {
    el.addEventListener('touchstart', activate, { passive: false });
  }
}

/** Require a fresh tap after FIGHT opens the move layer. The original release
 * and its synthesized click finish before this layer is armed. */
function armMoveInputAfterCurrentGesture(): void {
  if (!moveLayer) return;
  const token = ++moveInputToken;
  moveInputReady = !deckGestureDown;
  moveLayer.style.pointerEvents = moveInputReady ? 'auto' : 'none';
  if (moveInputReady || typeof document === 'undefined') return;

  let finished = false;
  let fallbackTimer = 0;
  const cleanup = () => {
    document.removeEventListener('pointerup', release, true);
    document.removeEventListener('pointercancel', release, true);
    document.removeEventListener('touchend', release, true);
    document.removeEventListener('touchcancel', release, true);
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
  };
  const release = () => {
    if (finished) return;
    finished = true;
    cleanup();
    window.setTimeout(() => {
      if (token !== moveInputToken || !moveLayer) return;
      moveInputReady = true;
      moveLayer.style.pointerEvents = 'auto';
    }, 0);
  };
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
  if (!('PointerEvent' in window)) {
    document.addEventListener('touchend', release, true);
    document.addEventListener('touchcancel', release, true);
  }
  // Click-only accessibility activation has no matching pointer release.
  fallbackTimer = window.setTimeout(release, 350);
}

/** Button that holds a key down while pressed (run). */
function holdButton(label: string, css: string, code: number): HTMLElement {
  const b = document.createElement('div');
  b.style.cssText = btnBase + css;
  b.textContent = label;
  let held = false;
  // Buttons declare their own resting tint after btnBase, so restore whatever the
  // element was actually built with instead of assuming the shared default.
  const idle = b.style.background || GLASS_BG;
  const press = (e: Event) => { e.preventDefault(); if (held) return; held = true; b.style.background = GLASS_BG_ACTIVE; dispatchKey('keydown', code); };
  const release = (e: Event) => { e.preventDefault(); if (!held) return; held = false; b.style.background = idle; dispatchKey('keyup', code); };
  b.addEventListener('pointerdown', press);
  b.addEventListener('pointerup', release);
  b.addEventListener('pointerleave', release);
  b.addEventListener('pointercancel', release);
  return b;
}

/** Button that taps a key (keydown then keyup shortly after). */
function tapButton(label: string, css: string, code: number): HTMLElement {
  const b = document.createElement('div');
  b.style.cssText = btnBase + css;
  b.textContent = label;
  const idle = b.style.background || GLASS_BG;
  bindTap(b, () => {
    b.style.background = GLASS_BG_ACTIVE;
    if (code === KEY.space) window.dispatchEvent(new Event(MOBILE_ACTION_EVENT));
    if (code === KEY.m) {
      // A cancelable request lets the central bridge claim gameplay taps. If no
      // eligible map is active, retain the old M-key fallback (including using
      // the same button to close an already-open menu).
      const request = new Event(MOBILE_MENU_EVENT, { cancelable: true });
      if (!window.dispatchEvent(request)) {
        setTimeout(() => { b.style.background = idle; }, 140);
        return;
      }
    }
    dispatchKey('keydown', code);
    setTimeout(() => { dispatchKey('keyup', code); b.style.background = idle; }, 140);
  });
  // iOS Safari may still interpret two rapid taps as page zoom even when the
  // pointerdown was consumed. The game already acts on pointerdown, so suppress
  // the follow-up touch/click gestures explicitly.
  b.addEventListener('touchend', e => e.preventDefault(), { passive: false });
  b.addEventListener('dblclick', e => e.preventDefault());
  return b;
}

let deckEl: HTMLElement | null = null;
let gamePaneEl: HTMLElement | null = null;
let rotateHintEl: HTMLElement | null = null;
let immersiveView = false;
// In battle the overworld movement stick + A/B buttons are irrelevant (there is no
// walking), so they stay hidden and the fight is driven entirely by touch on the
// battle command / move deck. Battle scenes toggle this on create/shutdown.
let battleMode = false;
let controlLayer: HTMLElement | null = null;
let controlPad: HTMLElement | null = null;          // the movement drag stick
let controlActionBtns: HTMLElement[] = [];          // the A / B buttons
let battleActionLayer: HTMLElement | null = null;
let moveLayer: HTMLElement | null = null;
let partyLeadLayer: HTMLElement | null = null;
let layerBeforeLeadPicker: 'control' | 'actions' | 'move' = 'control';
let mobile = false;
/** True while a portrait phone is being asked to turn sideways. */
let rotationGateOpen = false;
let releaseMovement: (() => void) | null = null;

/** The deck hides for a full-screen takeover — the leaderboard, or the rotate gate. */
function applyDeckVisibility(): void {
  if (deckEl) deckEl.style.display = (immersiveView || rotationGateOpen) ? 'none' : 'block';
}

// Deck labels are DOM, built before initI18n has read the saved KO/EN preference,
// so each one registers how to re-render itself and they all refresh on LANG_EVENT.
const localizedLabels: (() => void)[] = [];
function localize(apply: () => void): void {
  apply();
  localizedLabels.push(apply);
}
if (typeof window !== 'undefined') {
  window.addEventListener(LANG_EVENT, () => { for (const apply of localizedLabels) apply(); });
}
let mobileLayoutFrame = 0;
let mobileLayoutSettleTimers: number[] = [];
// Latest viewport + covered play-screen size, used to derive the visible safe area.
let lastLayout = { vw: 0, vh: 0, gameWidth: 0, gameHeight: 0 };

/**
 * The rectangle of the game's DESIGN space (default 1280×720) that is actually
 * on-screen. The mobile shell now letterboxes rather than crops, so this reports
 * the full design rect on every layout; it is kept as the single place that would
 * describe a cropped play screen if one is ever reintroduced. Call on create and
 * on every `resize` / `pokemonkorea:mobile-layout` event.
 */
export function mobileSafeInsets(designW = 1280, designH = 720): {
  left: number; top: number; right: number; bottom: number;
} {
  const full = { left: 0, top: 0, right: designW, bottom: designH };
  if (!mobile || !lastLayout.gameWidth) return full;
  const s = lastLayout.gameWidth / designW;                 // screen px per design px
  const insetX = Math.max(0, Math.round((designW - lastLayout.vw / s) / 2));
  const insetY = Math.max(0, Math.round((designH - lastLayout.vh / s) / 2));
  return { left: insetX, top: insetY, right: designW - insetX, bottom: designH - insetY };
}

/**
 * Size the two-screen shell from the browser's *visible* viewport, like a
 * handheld emulator. In particular, a tall phone no longer gives the deck a
 * fixed 47% of its height: the deck follows the controls' own aspect ratio,
 * while the 16:9 game screen receives the largest uncropped rectangle it can.
 */
function syncMobileLayout(): void {
  if (!mobile || !deckEl || !gamePaneEl) return;
  const deck = deckEl;
  const gamePane = gamePaneEl;
  if (mobileLayoutFrame) cancelAnimationFrame(mobileLayoutFrame);
  mobileLayoutFrame = requestAnimationFrame(() => {
    mobileLayoutFrame = 0;
    const viewport = window.visualViewport;
    const layout = calculateMobileShellLayout(
      viewport?.width ?? window.innerWidth,
      viewport?.height ?? window.innerHeight,
      immersiveView,
    );
    const vw = layout.viewportWidth;
    const vh = layout.viewportHeight;
    // The play screen is the largest 16:9 rectangle that FITS INSIDE the viewport,
    // centred with letterbox margins. It used to COVER the viewport instead, which
    // scaled the canvas up until the overflowing edges were clipped away — on a
    // portrait phone that threw away roughly 470 design px off each side, and even
    // in landscape it shaved the top and bottom off the dialogue box and HUD.
    // Containing costs some margin but guarantees that every pixel the game draws
    // is actually on screen, which is what a fixed-resolution 2D game needs.
    // mobileSafeInsets() consequently reports no inset here; edge-anchored UI stays
    // where the scenes author it, and the calculation still protects anything that
    // asks about a genuinely cropped layout.
    const { gameWidth, gameHeight } = layout;
    lastLayout = { vw, vh, gameWidth, gameHeight };

    document.body.style.minHeight = '0px';
    document.body.style.maxHeight = `${vh}px`;
    document.body.style.width = `${vw}px`;
    document.body.style.height = `${vh}px`;

    gamePane.style.width = `${Math.round(gameWidth)}px`;
    gamePane.style.height = `${Math.round(gameHeight)}px`;
    // The deck is a fixed full-viewport overlay; it does not size a pane.
    applyDeckVisibility();
    deck.dataset.layout = layout.portrait ? 'portrait' : 'landscape';
    deck.dataset.viewport = `${vw}x${vh}`;
    gamePane.dataset.layout = deck.dataset.layout;
    gamePane.dataset.viewport = deck.dataset.viewport;
    updateUnit();

    // Phaser watches resize, but visualViewport can change without a window
    // resize when mobile browser chrome expands/collapses.
    window.dispatchEvent(new CustomEvent('pokemonkorea:mobile-layout', {
      detail: { ...layout, width: vw, height: vh },
    }));
  });
}

/** Fold posture changes arrive as a short burst of resize events. Samsung
 * Internet can expose the cover-screen visualViewport for one or two frames
 * after the inner display has opened, so repeat the pure layout pass while the
 * viewport settles instead of trusting the first measurement. */
function syncMobileLayoutSettled(): void {
  for (const timer of mobileLayoutSettleTimers) window.clearTimeout(timer);
  mobileLayoutSettleTimers = [];
  syncMobileLayout();
  for (const delay of [80, 220, 520]) {
    mobileLayoutSettleTimers.push(window.setTimeout(syncMobileLayout, delay));
  }
}

/**
 * PES-style drag joystick. Sliding around the disc continuously changes the
 * held arrow-key combination, including diagonals; releasing recentres the
 * thumb and clears every movement key.
 */
function analogStick(): HTMLElement {
  const base = document.createElement('div');
  base.dataset.role = 'movement-pad';
  base.setAttribute('role', 'application');
  localize(() => base.setAttribute('aria-label', t('Movement joystick', '이동 조이스틱')));
  base.style.cssText =
    'position:absolute;left:max(env(safe-area-inset-left),calc(var(--u)*0.5));' +
    'bottom:max(env(safe-area-inset-bottom),calc(var(--u)*0.5));' +
    'width:min(calc(var(--u)*8.4),38vw,46vh);height:min(calc(var(--u)*8.4),38vw,46vh);border-radius:50%;' +
    'pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;' +
    'box-sizing:border-box;border:2px solid rgba(180,208,255,0.30);' +
    // The disc is the single largest thing on the deck, so it is the most
    // transparent: a faint tint that reads as glass rather than a painted pad.
    'background:radial-gradient(circle at 50% 50%,rgba(90,116,175,0.16) 0 20%,' +
    'rgba(28,38,68,0.20) 21% 64%,rgba(12,18,36,0.24) 65% 100%);' +
    'box-shadow:inset 0 0 0 calc(var(--u)*0.16) rgba(255,255,255,0.04),' +
    'inset 0 calc(var(--u)*0.22) calc(var(--u)*0.6) rgba(160,190,255,0.07),' +
    '0 calc(var(--u)*0.12) calc(var(--u)*0.4) rgba(0,0,0,0.2);' +
    '-webkit-tap-highlight-color:transparent;overflow:hidden;';

  // Subtle direction guides make the control readable without turning it back
  // into four separate buttons.
  const guides = document.createElement('div');
  guides.style.cssText =
    'position:absolute;inset:10%;border-radius:50%;pointer-events:none;opacity:0.4;' +
    'background:linear-gradient(90deg,transparent 49.4%,rgba(180,205,255,0.22) 49.5% 50.5%,transparent 50.6%),' +
    'linear-gradient(0deg,transparent 49.4%,rgba(180,205,255,0.22) 49.5% 50.5%,transparent 50.6%);';

  const label = document.createElement('div');
  localize(() => { label.textContent = t('DRAG TO MOVE', '밀어서 이동'); });
  // Kept well inside the disc. At bottom:7% it sat on the very bottom edge of the
  // screen, where scenes put their caption text, and the two read as one jumble.
  label.style.cssText =
    'position:absolute;left:50%;bottom:19%;transform:translateX(-50%);white-space:nowrap;' +
    'pointer-events:none;color:rgba(212,226,255,0.5);font-size:calc(var(--u)*0.58);' +
    `font-weight:800;letter-spacing:0.08em;text-shadow:${GLASS_TEXT_SHADOW};`;

  const thumb = document.createElement('div');
  thumb.style.cssText =
    'position:absolute;left:50%;top:50%;width:calc(var(--u)*3.35);height:calc(var(--u)*3.35);' +
    'transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;box-sizing:border-box;' +
    'border:2px solid rgba(228,240,255,0.55);' +
    // The thumb keeps the most tint of anything on the deck — it is the part the
    // player tracks while dragging — but is still see-through.
    'background:radial-gradient(circle at 36% 30%,rgba(130,157,221,0.40),' +
    'rgba(69,98,162,0.34) 46%,rgba(38,57,103,0.32) 100%);' +
    'box-shadow:inset 0 calc(var(--u)*0.14) calc(var(--u)*0.34) rgba(255,255,255,0.18),' +
    '0 calc(var(--u)*0.18) calc(var(--u)*0.4) rgba(0,0,0,0.28);' +
    'will-change:transform;';
  base.append(guides, label, thumb);

  let pointerId: number | null = null;
  const held = new Set<number>();
  const movementCodes = [KEY.left, KEY.right, KEY.up, KEY.down];

  const setHeld = (wanted: Set<number>) => {
    for (const code of movementCodes) {
      if (wanted.has(code) && !held.has(code)) {
        held.add(code);
        dispatchKey('keydown', code);
      } else if (!wanted.has(code) && held.has(code)) {
        held.delete(code);
        dispatchKey('keyup', code);
      }
    }
  };

  const release = () => {
    pointerId = null;
    setHeld(new Set());
    thumb.style.transition = 'transform 100ms ease-out';
    thumb.style.transform = 'translate(-50%,-50%)';
    base.style.borderColor = 'rgba(180,208,255,0.30)';
  };
  releaseMovement = release;

  const update = (e: PointerEvent) => {
    const r = base.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const travel = Math.max(1, Math.min(r.width, r.height) * 0.31);
    const distance = Math.hypot(dx, dy);
    const scale = distance > travel ? travel / distance : 1;
    const tx = dx * scale, ty = dy * scale;
    thumb.style.transition = 'none';
    thumb.style.transform = `translate(calc(-50% + ${tx.toFixed(1)}px),calc(-50% + ${ty.toFixed(1)}px))`;

    const strength = Math.min(1, distance / travel);
    const wanted = new Set<number>();
    if (strength >= 0.18) {
      const nx = dx / Math.max(1, distance);
      const ny = dy / Math.max(1, distance);
      // A 0.38 component threshold creates broad diagonal sectors while still
      // allowing a player to hold a clean cardinal direction.
      if (nx <= -0.38) wanted.add(KEY.left);
      if (nx >=  0.38) wanted.add(KEY.right);
      if (ny <= -0.38) wanted.add(KEY.up);
      if (ny >=  0.38) wanted.add(KEY.down);
    }
    setHeld(wanted);
  };

  base.addEventListener('pointerdown', (event) => {
    const e = event as PointerEvent;
    e.preventDefault();
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    base.setPointerCapture?.(e.pointerId);
    base.style.borderColor = 'rgba(205,225,255,0.62)';
    update(e);
  });
  base.addEventListener('pointermove', (event) => {
    const e = event as PointerEvent;
    if (e.pointerId !== pointerId) return;
    e.preventDefault();
    update(e);
  });
  const finish = (event: Event) => {
    const e = event as PointerEvent;
    if (pointerId !== null && e.pointerId !== pointerId) return;
    e.preventDefault();
    release();
  };
  base.addEventListener('pointerup', finish);
  base.addEventListener('pointercancel', finish);
  base.addEventListener('lostpointercapture', finish);
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  return base;
}

/** Recompute the `--u` sizing unit from the deck's real box so nothing overflows. */
function updateUnit(): void {
  if (!deckEl) return;
  const r = deckEl.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  // Keep the smallest landscape-phone controls at a comfortable thumb size.
  // The old height / 12 calculation reduced D-pad cells to about 30px on a
  // short 16:9 phone; the analog disc now keeps the whole drag range usable.
  // The complete layout is 17.5u wide and 9.4u tall, so it still cannot overflow.
  // Larger thumb/button targets for small phones: a higher floor (so tiny screens
  // still get chunky buttons) and a higher cap, keeping the 17.5u×9.4u layout.
  // The deck now spans the whole viewport, so size the control unit from it
  // directly and cap it so buttons stay thumb-sized (not screen-huge) on tablets.
  // The 17.5u×9.4u control cluster then anchors bottom-left (pad) / right (buttons).
  const u = Math.max(9, Math.min(30, Math.min(r.width / 17.5, r.height / 9.4)));
  deckEl.style.setProperty('--u', u.toFixed(2) + 'px');
}

/**
 * Build the DS-style split shell. Must run BEFORE the Phaser game is created so the
 * game can mount into the top `#game` pane. Returns the parent the game should use.
 * On non-touch (desktop) it does nothing and the game fills the window as before.
 */
export function setupMobileShell(force = false): { parent: HTMLElement | undefined; mobile: boolean } {
  mobile = force || isTouchDevice();
  if (!mobile) return { parent: undefined, mobile: false };

  // Emulator layout: the game fills the whole screen and the controls float on
  // top of it as a transparent overlay (drag pad on the left, buttons on the
  // right), instead of taking their own pane beside/below the play screen.
  document.body.style.cssText =
    'margin:0;padding:0;background:#000;position:relative;' +
    'height:100vh;height:100dvh;min-height:0;width:100vw;overflow:hidden;' +
    'font-family:system-ui,-apple-system,sans-serif;touch-action:none;overscroll-behavior:none;';

  // Safari-specific safety net: prevent double-tap and pinch gestures from
  // changing the visual viewport while the player rapidly presses A/B.
  const stopGesture = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', stopGesture, { passive: false });
  document.addEventListener('gesturechange', stopGesture, { passive: false });
  document.addEventListener('gestureend', stopGesture, { passive: false });
  document.addEventListener('dblclick', stopGesture, { passive: false });

  const gamePane = document.createElement('div');
  gamePane.id = 'game';
  // The play screen fills the whole viewport (largest uncropped 16:9 rectangle,
  // centred with letterboxing). syncMobileLayout() sets its exact size.
  gamePane.style.cssText =
    'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);' +
    'min-width:0;min-height:0;background:#000;overflow:hidden;';
  gamePaneEl = gamePane;

  deckEl = document.createElement('div');
  deckEl.id = 'deck';
  // The control deck is now a transparent full-viewport overlay ABOVE the game.
  // It never eats pointer events itself — only its buttons/stick do — so taps on
  // empty areas fall through to the game. --u (control size) is set from the
  // viewport by updateUnit().
  deckEl.style.cssText =
    'position:fixed;inset:0;z-index:50;pointer-events:none;background:transparent;' +
    '--u:20px;touch-action:none;box-sizing:border-box;overflow:hidden;';

  buildControlLayer();
  buildBattleActionLayer();
  buildMoveLayer();
  buildPartyLeadLayer();
  deckEl.append(controlLayer!, battleActionLayer!, moveLayer!, partyLeadLayer!);
  document.body.append(gamePane, deckEl);

  // ── Rotate-to-landscape gate ──────────────────────────────────────────────
  // The game renders a fixed 16:9 frame. On a portrait PHONE the only way to fit
  // that frame without cropping it is a band about a quarter of the screen tall —
  // technically visible, practically unreadable. So a portrait phone is asked to
  // turn sideways and the gate clears itself the moment it does; there is no
  // "play in portrait anyway", because that layout is not worth shipping.
  //
  // The cutoff is deliberately a phone-width test, not merely `portrait`: a tablet
  // or an unfolded foldable held upright still has enough width for a comfortable
  // play screen, and must not be nagged.
  const rotateGate = document.createElement('div');
  rotateHintEl = rotateGate;
  rotateGate.id = 'rotate-hint';
  rotateGate.style.cssText =
    'position:fixed;inset:0;z-index:100000;display:none;flex-direction:column;' +
    'align-items:center;justify-content:center;gap:20px;background:#060914;' +
    'color:#ffe88a;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:28px;' +
    'touch-action:none;';
  rotateGate.innerHTML =
    '<style>@keyframes rotGate{0%,12%{transform:rotate(0deg)}55%,100%{transform:rotate(90deg)}}</style>' +
    '<div style="width:74px;height:118px;border:4px solid #ffe88a;border-radius:12px;' +
    'animation:rotGate 2.4s ease-in-out infinite;display:flex;align-items:center;justify-content:center">' +
    '<div style="width:46px;height:88px;background:rgba(255,232,138,0.18);border-radius:4px"></div></div>' +
    '<div data-role="gate-title" style="font-size:23px;font-weight:800;line-height:1.35"></div>' +
    '<div data-role="gate-body" style="font-size:15px;color:#bcd4ff;max-width:300px;line-height:1.55"></div>';
  document.body.append(rotateGate);

  /** True when the viewport is an upright phone — the one case worth gating. */
  const needsRotation = (): boolean => {
    const viewport = window.visualViewport;
    return calculateMobileShellLayout(
      viewport?.width ?? window.innerWidth,
      viewport?.height ?? window.innerHeight,
      immersiveView,
    ).rotationRequired;
  };
  const syncGate = () => {
    const show = needsRotation() && !immersiveView;
    rotateGate.style.display = show ? 'flex' : 'none';
    rotationGateOpen = show;
    // Put the controls away rather than leaving them faintly visible under the
    // gate, where they would also still be catching taps.
    applyDeckVisibility();
    if (!show) return;
    // Written on every show, not once at construction: the shell is built before
    // the saved KO/EN preference is loaded, so text set here would be stuck in
    // whatever language happened to be active at boot.
    (rotateGate.querySelector('[data-role="gate-title"]') as HTMLElement).textContent =
      t('Turn your phone sideways', '휴대폰을 가로로 돌려주세요');
    (rotateGate.querySelector('[data-role="gate-body"]') as HTMLElement).textContent =
      t('This adventure is played in landscape. It starts as soon as you rotate.',
        '이 게임은 가로 화면으로 플레이합니다. 가로로 돌리면 바로 이어집니다.');
  };
  syncGate();
  // The shell is built before the saved language is read, so re-render once that
  // lands — otherwise a Korean save shows an English gate until the next resize.
  window.addEventListener(LANG_EVENT, syncGate);
  window.addEventListener('resize', syncGate);
  window.visualViewport?.addEventListener('resize', syncGate);
  window.addEventListener('orientationchange', () => setTimeout(syncGate, 150));
  window.screen.orientation?.addEventListener?.('change', () => setTimeout(syncGate, 150));

  // Keep the emulator shell and its sizing unit in step with rotate, folds,
  // split-screen, and Safari's expanding/collapsing browser chrome.
  syncMobileLayoutSettled();
  if ('ResizeObserver' in window) new ResizeObserver(updateUnit).observe(deckEl);
  window.addEventListener('resize', syncMobileLayoutSettled);
  window.visualViewport?.addEventListener('resize', syncMobileLayoutSettled);
  window.visualViewport?.addEventListener('scroll', syncMobileLayout);
  window.addEventListener('orientationchange', () => setTimeout(syncMobileLayoutSettled, 150));
  window.screen.orientation?.addEventListener?.('change', syncMobileLayoutSettled);
  window.addEventListener('pageshow', syncMobileLayoutSettled);
  return { parent: gamePane, mobile: true };
}

/** Temporarily give an information-heavy overlay the whole phone display.
 *  Leaderboards do not use movement or battle buttons, and squeezing them into
 *  the DS top pane would make trainer records unreadably small. */
export function deckSetImmersiveView(enabled: boolean): void {
  if (!mobile || !deckEl || !gamePaneEl) return;
  immersiveView = enabled;
  applyDeckVisibility();
  if (rotateHintEl && enabled) {
    rotateHintEl.style.display = 'none';
    rotationGateOpen = false;
    applyDeckVisibility();
  }
  syncMobileLayout();
  // Phaser's Scale Manager listens for viewport changes, not sibling display
  // changes. Refit after the calculated pane dimensions have landed.
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

/** Enter/leave battle: hide the walking stick + A/B so the battle is touch-only
 *  (command/move deck only). Call true in a battle scene's create(), false on
 *  shutdown so the overworld controls return. */
export function deckSetBattleMode(enabled: boolean): void {
  battleMode = enabled;
  if (controlLayer) controlLayer.style.display = enabled ? 'none' : 'block';
}

/** The persistent movement/action controls, shown whenever the move bar is hidden. */
function buildControlLayer(): void {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';

  // One continuous drag stick replaces the four independent D-pad buttons.
  const pad = analogStick();

  // A / B — bottom-right cluster.
  // A/B keep their green/red identity, but only as a wash — they sit on the same
  // bottom band as the dialogue box, so a filled disc would cover the text.
  const safeRight = 'max(env(safe-area-inset-right),calc(var(--u)*0.5))';
  const safeBottom = 'max(env(safe-area-inset-bottom),calc(var(--u)*1.1))';
  const a = tapButton('A',  `position:absolute;right:${safeRight};bottom:${safeBottom};width:calc(var(--u)*4.2);height:calc(var(--u)*4.2);border-radius:50%;font-size:calc(var(--u)*1.85);background:rgba(52,148,92,0.26);border-color:rgba(150,240,190,0.42);`, KEY.space);
  const b = holdButton('B', 'position:absolute;right:max(env(safe-area-inset-right),calc(var(--u)*4.9));bottom:max(env(safe-area-inset-bottom),calc(var(--u)*1.2));width:calc(var(--u)*3.4);height:calc(var(--u)*3.4);border-radius:50%;font-size:calc(var(--u)*1.5);background:rgba(172,74,74,0.26);border-color:rgba(255,178,178,0.42);', KEY.shift);

  // Utility pills — top-right of the deck.
  const pill = 'top:calc(var(--u)*0.35);width:calc(var(--u)*2.7);height:calc(var(--u)*2.7);border-radius:calc(var(--u)*0.55);font-size:calc(var(--u)*1.25);';
  const menu = tapButton('☰',  `position:absolute;right:max(env(safe-area-inset-right),calc(var(--u)*0.5));${pill}`, KEY.m);
  const back = tapButton('✕',  `position:absolute;right:max(env(safe-area-inset-right),calc(var(--u)*3.5));${pill}`, KEY.esc);
  const bike = tapButton('🚲', `position:absolute;right:max(env(safe-area-inset-right),calc(var(--u)*6.5));${pill}`, KEY.c);
  menu.dataset.role = 'menu-button';
  back.dataset.role = 'back-button';
  bike.dataset.role = 'bike-button';
  a.dataset.role = 'action-a';
  b.dataset.role = 'action-b';

  // A/B fade smoothly when dialogue makes them translucent.
  a.style.transition = (a.style.transition ? a.style.transition + ',' : '') + 'opacity 140ms ease';
  b.style.transition = (b.style.transition ? b.style.transition + ',' : '') + 'opacity 140ms ease';

  layer.append(pad, a, b, menu, back, bike);
  controlLayer = layer;
  controlPad = pad;
  controlActionBtns = [a, b];
}

/** While an overworld dialogue is open, hide the movement stick (it sits over the
 *  dialogue box) and make the A/B buttons translucent so the text reads through.
 *  Restores them when the dialogue closes. No-op off mobile. */
export function deckSetDialogueMode(active: boolean): void {
  if (!mobile) return;
  if (controlPad) controlPad.style.display = active ? 'none' : 'block';
  // The buttons are already translucent, so the old 0.32 dialogue fade left them
  // almost invisible — and A is how the player advances the very dialogue that
  // triggered the fade. Fade to a lighter but still findable 0.6.
  for (const btn of controlActionBtns) btn.style.opacity = active ? '0.6' : '1';
}

/** Large direct battle commands. These call scene callbacks instead of
 * synthesising keyboard events, which iOS can drop between Phaser frames. */
function buildBattleActionLayer(): void {
  const layer = document.createElement('div');
  layer.style.cssText =
    'position:absolute;left:0;right:0;top:50%;bottom:0;height:auto;' +
    'display:none;flex-direction:column;padding:calc(var(--u)*0.5);box-sizing:border-box;pointer-events:none;' +
    // A light scrim only, so the battle dialogue line behind the commands stays
    // readable instead of disappearing under a near-solid panel.
    'background:linear-gradient(180deg,rgba(11,15,30,0) 0%,rgba(11,15,30,0.14) 14%,rgba(11,15,30,0.3) 36%);';
  const title = document.createElement('div');
  title.dataset.role = 'action-title';
  // deckShowBattleActions overwrites this with the scene's own prompt; the
  // registered version only matters until the first battle opens.
  localize(() => { title.textContent = t('BATTLE COMMAND', '배틀 명령'); });
  title.style.cssText =
    'color:#ffe44e;font-weight:900;font-size:clamp(12px,calc(var(--u)*0.8),20px);' +
    `text-shadow:${GLASS_TEXT_SHADOW};` +
    'text-align:center;letter-spacing:1px;margin:clamp(1px,calc(var(--u)*0.12),4px) 0 ' +
    'clamp(3px,calc(var(--u)*0.3),9px);flex:0 0 auto;';
  const grid = document.createElement('div');
  grid.className = '__actiongrid';
  grid.style.cssText =
    'flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;' +
    'grid-template-rows:1fr 1fr;gap:calc(var(--u)*0.5);pointer-events:auto;';
  layer.append(title, grid);
  battleActionLayer = layer;
}

/** The battle move-select bar (2×2), shown only while a move choice is offered. */
function buildMoveLayer(): void {
  const layer = document.createElement('div');
  // 66vh rather than 60vh: a move cell has to fit a name AND a type/PP line, and
  // the tighter cap left it 41px on a short landscape phone — enough for the name
  // only, so the type badge and remaining PP were silently clipped off. The layer
  // is translucent now, so claiming the extra band costs nothing visually.
  layer.style.cssText = 'position:absolute;left:0;right:0;top:50%;bottom:0;height:auto;display:none;flex-direction:column;padding:calc(var(--u)*0.5) max(env(safe-area-inset-right),calc(var(--u)*0.5)) max(env(safe-area-inset-bottom),calc(var(--u)*0.5)) max(env(safe-area-inset-left),calc(var(--u)*0.5));box-sizing:border-box;pointer-events:none;background:linear-gradient(180deg,rgba(11,15,30,0.08) 0%,rgba(11,15,30,0.32) 24%,rgba(11,15,30,0.5) 100%);';
  const title = document.createElement('div');
  localize(() => { title.textContent = t('CHOOSE A MOVE', '기술을 선택하세요'); });
  // Title + BACK are deliberately compact: on a 390px-tall landscape phone the
  // layer is capped by 60vh, and the old sizes ate so much of it that each move
  // cell collapsed to ~41px and clipped its own type/PP line away entirely.
  title.style.cssText = `color:#ffe44e;font-weight:800;font-size:clamp(11px,calc(var(--u)*0.7),18px);text-shadow:${GLASS_TEXT_SHADOW};text-align:center;letter-spacing:2px;margin:0 0 clamp(2px,calc(var(--u)*0.16),6px);flex:0 0 auto;`;
  const grid = document.createElement('div');
  grid.className = '__movegrid';
  grid.style.cssText = 'flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:calc(var(--u)*0.5);pointer-events:auto;';
  const back = document.createElement('div');
  back.style.cssText = btnBase + 'flex:0 0 auto;margin-top:clamp(2px,calc(var(--u)*0.3),9px);height:clamp(26px,calc(var(--u)*1.5),44px);border-radius:calc(var(--u)*0.4);font-size:clamp(12px,calc(var(--u)*0.8),20px);pointer-events:auto;background:rgba(60,70,100,0.24);';
  back.dataset.role = 'back';
  layer.append(title, grid, back);
  moveLayer = layer;
  // deckShowMoves swaps BACK for a fresh clone each time (to shed stale tap
  // handlers), so resolve the LIVE node by role rather than capturing this one.
  localize(() => {
    const live = layer.querySelector('[data-role="back"]');
    if (live) live.textContent = t('← BACK', '← 뒤로');
  });
}

/** Large, canvas-independent party picker used by the mobile Pokémon menu. */
function buildPartyLeadLayer(): void {
  const layer = document.createElement('div');
  layer.style.cssText =
    'position:absolute;left:0;right:0;top:50%;bottom:0;height:auto;' +
    'display:none;flex-direction:column;padding:calc(var(--u)*0.45);box-sizing:border-box;pointer-events:none;' +
    'background:linear-gradient(180deg,rgba(11,15,30,0) 0%,rgba(11,15,30,0.16) 12%,rgba(11,15,30,0.32) 30%);';

  const title = document.createElement('div');
  title.dataset.role = 'lead-title';
  title.textContent = t('CHANGE LEAD POKÉMON', '선두 포켓몬 변경');
  title.style.cssText =
    'height:clamp(30px,calc(var(--u)*1.65),52px);display:flex;align-items:center;justify-content:center;' +
    'color:#ffe44e;font-weight:900;font-size:clamp(13px,calc(var(--u)*0.82),21px);' +
    `text-shadow:${GLASS_TEXT_SHADOW};letter-spacing:1px;flex:0 0 auto;`;

  const close = tapButton('',
    'position:absolute;right:calc(var(--u)*0.5);top:calc(var(--u)*0.48);' +
    'width:clamp(64px,calc(var(--u)*3.2),112px);height:clamp(30px,calc(var(--u)*1.65),52px);' +
    'border-radius:calc(var(--u)*0.38);font-size:clamp(11px,calc(var(--u)*0.65),17px);', KEY.esc);
  close.dataset.role = 'lead-close';
  // Unlike the title, this label is never rewritten when the picker opens.
  localize(() => { close.textContent = t('✕ CLOSE', '✕ 닫기'); });

  const grid = document.createElement('div');
  grid.className = '__leadgrid';
  grid.style.cssText =
    'flex:1;min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));' +
    'grid-template-rows:repeat(2,minmax(0,1fr));gap:calc(var(--u)*0.38);pointer-events:auto;';
  layer.append(title, close, grid);
  partyLeadLayer = layer;
}

export interface DeckLeadChoice {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  isLead: boolean;
  /** Disabled choices remain visible but cannot be tapped (active/fainted targets). */
  disabled?: boolean;
  /** Optional battle-specific status such as ACTIVE or FAINTED. */
  status?: string;
}

export interface DeckLeadPickerOptions {
  title?: string;
  allowClose?: boolean;
}

/** Show large physical-size party buttons on the mobile lower screen. */
export function deckShowLeadPicker(
  choices: DeckLeadChoice[],
  onPick: (index: number) => void,
  options: DeckLeadPickerOptions = {},
): boolean {
  if (!mobile || !partyLeadLayer || !controlLayer || !battleActionLayer || !moveLayer) return false;
  releaseMovement?.();
  const alreadyOpen = partyLeadLayer.style.display === 'flex';
  if (!alreadyOpen) {
    layerBeforeLeadPicker = moveLayer.style.display === 'flex'
      ? 'move'
      : battleActionLayer.style.display === 'flex' ? 'actions' : 'control';
  }

  const title = partyLeadLayer.querySelector('[data-role="lead-title"]') as HTMLElement;
  const close = partyLeadLayer.querySelector('[data-role="lead-close"]') as HTMLElement;
  title.textContent = options.title ?? t('CHANGE LEAD POKÉMON', '선두 포켓몬 변경');
  close.style.display = options.allowClose === false ? 'none' : 'flex';

  const grid = partyLeadLayer.querySelector('.__leadgrid') as HTMLElement;
  grid.textContent = '';
  choices.slice(0, 6).forEach((choice, index) => {
    const disabled = choice.disabled ?? choice.isLead;
    const cell = document.createElement('div');
    cell.style.cssText = btnBase +
      'min-width:0;min-height:0;flex-direction:column;border-radius:calc(var(--u)*0.45);' +
      `padding:calc(var(--u)*0.24);background:${choice.isLead ? 'rgba(140,113,32,0.30)' : disabled ? 'rgba(45,45,58,0.26)' : 'rgba(25,43,78,0.28)'};` +
      `border-color:${choice.isLead ? 'rgba(255,228,78,0.85)' : disabled ? 'rgba(150,152,175,0.5)' : 'rgba(140,175,235,0.62)'};` +
      `opacity:${disabled && !choice.isLead ? 0.58 : 1};line-height:1.08;text-align:center;`;
    const name = document.createElement('div');
    name.textContent = `${choice.isLead ? '★ ' : ''}${choice.name}`;
    name.style.cssText =
      'max-width:100%;font-size:clamp(12px,calc(var(--u)*0.78),21px);font-weight:900;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    const sub = document.createElement('div');
    sub.textContent = choice.status ?? (choice.isLead
      ? t(`LEAD · Lv.${choice.level}`, `현재 선두 · Lv.${choice.level}`)
      : `Lv.${choice.level} · HP ${choice.hp}/${choice.maxHp}`);
    sub.style.cssText =
      `margin-top:calc(var(--u)*0.18);font-size:clamp(9px,calc(var(--u)*0.52),15px);` +
      `text-shadow:${GLASS_TEXT_SHADOW};` +
      `color:${choice.isLead ? '#fff0a8' : disabled ? '#c4c4cf' : '#dbe7ff'};`;
    cell.append(name, sub);
    if (!disabled) bindTap(cell, () => {
      if (cell.dataset.picked === 'true') return;
      cell.dataset.picked = 'true';
      cell.style.pointerEvents = 'none';
      cell.style.background = GLASS_BG_ACTIVE;
      onPick(index);
    });
    grid.append(cell);
  });

  controlLayer.style.display = 'none';
  battleActionLayer.style.display = 'none';
  moveLayer.style.display = 'none';
  partyLeadLayer.style.display = 'flex';
  return true;
}

/** Restore the lower screen that was visible before the menu lead picker. */
export function deckHideLeadPicker(): void {
  if (!mobile || !partyLeadLayer || !controlLayer || !battleActionLayer || !moveLayer) return;
  partyLeadLayer.style.display = 'none';
  if (layerBeforeLeadPicker === 'move') {
    moveLayer.style.display = 'flex';
    battleActionLayer.style.display = 'none';
    controlLayer.style.display = 'none';
  } else if (layerBeforeLeadPicker === 'actions') {
    moveLayer.style.display = 'none';
    battleActionLayer.style.display = 'flex';
    controlLayer.style.display = 'none';
  } else {
    moveLayer.style.display = 'none';
    battleActionLayer.style.display = 'none';
    controlLayer.style.display = battleMode ? 'none' : 'block';
  }
}

/** Show direct battle commands on the lower screen. This is the reliable
 * mobile entry point for Fight/Bag/Party/Run on both iOS and Android. */
export function deckShowBattleActions(
  actions: DeckBattleAction[],
  title = t('WHAT WILL YOU DO?', '무엇을 할까?'),
): boolean {
  if (!mobile || !battleActionLayer || !controlLayer || !moveLayer || !partyLeadLayer) return false;
  releaseMovement?.();
  const titleEl = battleActionLayer.querySelector('[data-role="action-title"]') as HTMLElement;
  titleEl.textContent = title;
  const grid = battleActionLayer.querySelector('.__actiongrid') as HTMLElement;
  grid.textContent = '';
  actions.slice(0, 4).forEach((action) => {
    const cell = document.createElement('div');
    const disabled = !!action.disabled;
    const accent = action.accent ?? '#668bc7';
    cell.style.cssText = btnBase +
      `min-width:0;min-height:0;border-radius:calc(var(--u)*0.5);border-color:${accent};` +
      `background:${disabled ? 'rgba(42,44,55,0.24)' : 'rgba(25,43,78,0.28)'};` +
      `opacity:${disabled ? 0.5 : 1};font-size:clamp(14px,calc(var(--u)*1.05),26px);` +
      'line-height:1.05;text-align:center;padding:calc(var(--u)*0.3);overflow-wrap:anywhere;';
    cell.textContent = tr(action.label);
    if (!disabled) bindTap(cell, () => {
      if (cell.dataset.picked === 'true') return;
      cell.dataset.picked = 'true';
      cell.style.pointerEvents = 'none';
      cell.style.background = GLASS_BG_ACTIVE;
      deckHideBattleActions();
      action.onPick();
    });
    grid.append(cell);
  });
  controlLayer.style.display = 'none';
  moveLayer.style.display = 'none';
  partyLeadLayer.style.display = 'none';
  battleActionLayer.style.display = 'flex';
  return true;
}

/** Hide direct commands without disturbing an open move/party layer. */
export function deckHideBattleActions(): void {
  if (!mobile || !battleActionLayer || !controlLayer || !moveLayer || !partyLeadLayer) return;
  battleActionLayer.style.display = 'none';
  if (moveLayer.style.display !== 'flex' && partyLeadLayer.style.display !== 'flex') {
    controlLayer.style.display = battleMode ? 'none' : 'block';
  }
}

/**
 * Show the move-select bar on the bottom deck. Battle scenes call this from
 * showMovePanel; it returns true when the deck handled it (touch/mobile), so the
 * scene can hide its on-canvas move panel and keep the top screen clean.
 */
export function deckShowMoves(moves: DeckMove[], onPick: (i: number) => void, onBack: () => void): boolean {
  if (!mobile || !moveLayer || !controlLayer || !battleActionLayer || !partyLeadLayer) return false;
  releaseMovement?.();
  const grid = moveLayer.querySelector('.__movegrid') as HTMLElement;
  grid.textContent = '';
  moves.slice(0, 4).forEach((m, i) => {
    const col = TYPE_COLORS[m.data.type] ?? '#556';
    const cell = document.createElement('div');
    const dim = m.pp <= 0;
    cell.style.cssText = btnBase +
      `flex-direction:column;border-radius:calc(var(--u)*0.5);border-color:${col};min-width:0;` +
      `background:${dim ? 'rgba(40,40,50,0.24)' : 'rgba(24,30,54,0.28)'};opacity:${dim ? 0.5 : 1};` +
      // Fonts are clamped so they never blow up on big/unfolded screens; the name wraps
      // instead of overflowing, and nothing gets clipped.
      'line-height:1.1;padding:clamp(3px,calc(var(--u)*0.3),12px);text-align:center;overflow:hidden;box-sizing:border-box;';
    // Type + PP share one line so a cell needs only two rows of text — on short
    // landscape decks three rows overflowed the cell box, clipping the last line.
    cell.innerHTML =
      `<div style="font-weight:800;font-size:clamp(13px,calc(var(--u)*0.85),22px);line-height:1.05;word-break:break-word;overflow-wrap:anywhere">${tr(m.data.name).toUpperCase()}</div>` +
      `<div style="max-width:100%;display:flex;align-items:center;justify-content:center;gap:clamp(3px,calc(var(--u)*0.2),8px);font-size:clamp(9px,calc(var(--u)*0.55),14px);margin-top:clamp(2px,calc(var(--u)*0.2),8px);white-space:nowrap;overflow:hidden">` +
      `<span style="display:block;min-width:0;max-width:58%;overflow:hidden;text-overflow:ellipsis;color:#fff;background:${col};opacity:0.82;border-radius:999px;padding:1px 6px">${typeName(m.data.type)}</span>` +
      `<span style="display:block;min-width:0;color:#cbd3e6;overflow:hidden;text-overflow:ellipsis">PP ${m.pp}/${m.data.pp}</span></div>`;
    if (!dim) bindTap(cell, () => {
      if (!moveInputReady) return;
      onPick(i);
    });
    grid.append(cell);
  });
  const back = moveLayer.querySelector('[data-role="back"]') as HTMLElement;
  back.onpointerdown = null;
  back.onclick = null;
  const replacement = back.cloneNode(true) as HTMLElement;
  back.replaceWith(replacement);
  bindTap(replacement, () => {
    if (!moveInputReady) return;
    onBack();
  });

  controlLayer.style.display = 'none';
  battleActionLayer.style.display = 'none';
  partyLeadLayer.style.display = 'none';
  moveLayer.style.display = 'flex';
  armMoveInputAfterCurrentGesture();
  return true;
}

/** Hide the move bar and restore the movement/action controls. */
export function deckHideMoves(): void {
  if (!mobile || !moveLayer || !controlLayer || !battleActionLayer || !partyLeadLayer) return;
  moveInputToken++;
  moveInputReady = false;
  moveLayer.style.pointerEvents = 'none';
  moveLayer.style.display = 'none';
  if (battleActionLayer.style.display !== 'flex' && partyLeadLayer.style.display !== 'flex') {
    controlLayer.style.display = battleMode ? 'none' : 'block';
  }
}

/** Back-compat shim: the old entry point. The shell is now built in setupMobileShell. */
export function initTouchControls(_force = false): void { /* handled by setupMobileShell */ }
