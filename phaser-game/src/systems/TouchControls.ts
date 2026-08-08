import { t, tr } from './i18n';
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

const btnBase =
  'display:flex;align-items:center;justify-content:center;pointer-events:auto;' +
  'touch-action:none;user-select:none;-webkit-user-select:none;color:#fff;font-weight:700;' +
  '-webkit-touch-callout:none;' +
  'border:2px solid rgba(255,255,255,0.5);background:rgba(30,38,66,0.9);' +
  'box-shadow:0 2px 6px rgba(0,0,0,0.45);-webkit-tap-highlight-color:transparent;box-sizing:border-box;';

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
  const press = (e: Event) => { e.preventDefault(); if (held) return; held = true; b.style.background = 'rgba(90,120,200,0.95)'; dispatchKey('keydown', code); };
  const release = (e: Event) => { e.preventDefault(); if (!held) return; held = false; b.style.background = 'rgba(30,38,66,0.9)'; dispatchKey('keyup', code); };
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
  bindTap(b, () => {
    b.style.background = 'rgba(90,120,200,0.95)';
    if (code === KEY.space) window.dispatchEvent(new Event(MOBILE_ACTION_EVENT));
    dispatchKey('keydown', code);
    setTimeout(() => { dispatchKey('keyup', code); b.style.background = 'rgba(30,38,66,0.9)'; }, 140);
  });
  // iOS Safari may still interpret two rapid taps as page zoom even when the
  // pointerdown was consumed. The game already acts on pointerdown, so suppress
  // the follow-up touch/click gestures explicitly.
  b.addEventListener('touchend', e => e.preventDefault(), { passive: false });
  b.addEventListener('dblclick', e => e.preventDefault());
  return b;
}

let deckEl: HTMLElement | null = null;
let controlLayer: HTMLElement | null = null;
let battleActionLayer: HTMLElement | null = null;
let moveLayer: HTMLElement | null = null;
let partyLeadLayer: HTMLElement | null = null;
let layerBeforeLeadPicker: 'control' | 'actions' | 'move' = 'control';
let mobile = false;
let releaseMovement: (() => void) | null = null;

/**
 * PES-style drag joystick. Sliding around the disc continuously changes the
 * held arrow-key combination, including diagonals; releasing recentres the
 * thumb and clears every movement key.
 */
function analogStick(): HTMLElement {
  const base = document.createElement('div');
  base.setAttribute('role', 'application');
  base.setAttribute('aria-label', t('Movement joystick', '이동 조이스틱'));
  base.style.cssText =
    'position:absolute;left:calc(var(--u)*0.5);bottom:calc(var(--u)*0.5);' +
    'width:calc(var(--u)*8.4);height:calc(var(--u)*8.4);border-radius:50%;' +
    'pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;' +
    'box-sizing:border-box;border:2px solid rgba(170,200,255,0.42);' +
    'background:radial-gradient(circle at 50% 50%,rgba(55,72,116,0.62) 0 20%,' +
    'rgba(28,38,68,0.92) 21% 64%,rgba(12,18,36,0.96) 65% 100%);' +
    'box-shadow:inset 0 0 0 calc(var(--u)*0.16) rgba(255,255,255,0.05),' +
    'inset 0 calc(var(--u)*0.22) calc(var(--u)*0.6) rgba(160,190,255,0.12),' +
    '0 calc(var(--u)*0.18) calc(var(--u)*0.55) rgba(0,0,0,0.5);' +
    '-webkit-tap-highlight-color:transparent;overflow:hidden;';

  // Subtle direction guides make the control readable without turning it back
  // into four separate buttons.
  const guides = document.createElement('div');
  guides.style.cssText =
    'position:absolute;inset:10%;border-radius:50%;pointer-events:none;opacity:0.55;' +
    'background:linear-gradient(90deg,transparent 49.4%,rgba(180,205,255,0.22) 49.5% 50.5%,transparent 50.6%),' +
    'linear-gradient(0deg,transparent 49.4%,rgba(180,205,255,0.22) 49.5% 50.5%,transparent 50.6%);';

  const label = document.createElement('div');
  label.textContent = t('DRAG TO MOVE', '밀어서 이동');
  label.style.cssText =
    'position:absolute;left:50%;bottom:7%;transform:translateX(-50%);white-space:nowrap;' +
    'pointer-events:none;color:rgba(202,218,255,0.62);font-size:calc(var(--u)*0.58);' +
    'font-weight:800;letter-spacing:0.08em;';

  const thumb = document.createElement('div');
  thumb.style.cssText =
    'position:absolute;left:50%;top:50%;width:calc(var(--u)*3.35);height:calc(var(--u)*3.35);' +
    'transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;box-sizing:border-box;' +
    'border:2px solid rgba(225,237,255,0.72);' +
    'background:radial-gradient(circle at 36% 30%,#829ddd,#4562a2 46%,#263967 100%);' +
    'box-shadow:inset 0 calc(var(--u)*0.14) calc(var(--u)*0.34) rgba(255,255,255,0.28),' +
    '0 calc(var(--u)*0.28) calc(var(--u)*0.58) rgba(0,0,0,0.55);' +
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
    base.style.borderColor = 'rgba(170,200,255,0.42)';
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
    base.style.borderColor = 'rgba(205,225,255,0.9)';
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
  const u = Math.max(9, Math.min(96, Math.min(r.width / 17.5, r.height / 9.4)));
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

  // Body becomes a vertical split: game pane on top, control deck below.
  document.body.style.cssText =
    'margin:0;padding:0;background:#000;display:flex;flex-direction:column;' +
    'height:100vh;height:100dvh;width:100vw;overflow:hidden;' +
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
  // The game (play screen) takes the MAJORITY of the height so it always reads
  // larger than the control deck below it; the 16:9 canvas fits to width within it.
  gamePane.style.cssText =
    'position:relative;width:100vw;flex:1 1 auto;min-height:0;' +
    'background:#000;overflow:hidden;';

  deckEl = document.createElement('div');
  deckEl.id = 'deck';
  // The control deck is a capped minority of the screen (always shorter than the
  // game pane), so the playfield stays dominant.
  deckEl.style.cssText =
    'position:relative;flex:0 0 47vh;height:47vh;max-height:47vh;width:100vw;min-height:0;--u:24px;' +
    'background:linear-gradient(#141a2e,#0b0f1e);border-top:3px solid #33406a;' +
    'box-shadow:inset 0 3px 8px rgba(0,0,0,0.5);touch-action:none;';

  buildControlLayer();
  buildBattleActionLayer();
  buildMoveLayer();
  buildPartyLeadLayer();
  deckEl.append(controlLayer!, battleActionLayer!, moveLayer!, partyLeadLayer!);
  document.body.append(gamePane, deckEl);

  // ── Rotate-to-landscape hint ──────────────────────────────────────────────
  // A 16:9 game is far bigger in landscape on a phone. Show a dismissible overlay
  // while the device is held in portrait; once dismissed it stays out of the way.
  let hintDismissed = false;
  const rotateHint = document.createElement('div');
  rotateHint.id = 'rotate-hint';
  rotateHint.style.cssText =
    'position:fixed;inset:0;z-index:100000;display:none;flex-direction:column;' +
    'align-items:center;justify-content:center;gap:18px;background:rgba(6,9,20,0.97);' +
    'color:#ffe88a;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:28px;';
  rotateHint.innerHTML =
    '<style>@keyframes rotHint{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(82deg)}}</style>' +
    '<div style="font-size:52px;animation:rotHint 1.8s ease-in-out infinite">📱</div>' +
    '<div style="font-size:22px;font-weight:800">Rotate to landscape</div>' +
    '<div style="font-size:15px;color:#bcd4ff;max-width:320px">The game is much bigger and easier to read sideways.</div>' +
    '<button id="rotate-hint-dismiss" style="margin-top:8px;padding:10px 20px;font-size:15px;font-weight:700;' +
    'color:#0b0f1e;background:#ffe88a;border:none;border-radius:10px;">Play in portrait anyway</button>';
  document.body.append(rotateHint);
  const syncHint = () => {
    const portrait = window.innerHeight > window.innerWidth;
    rotateHint.style.display = (portrait && !hintDismissed) ? 'flex' : 'none';
  };
  rotateHint.querySelector('#rotate-hint-dismiss')!.addEventListener('click', (e) => {
    e.stopPropagation(); hintDismissed = true; syncHint();
  });
  syncHint();
  window.addEventListener('resize', syncHint);
  window.addEventListener('orientationchange', () => setTimeout(syncHint, 150));

  // Keep the sizing unit in step with the deck's real size across rotate / fold / resize.
  updateUnit();
  if ('ResizeObserver' in window) new ResizeObserver(updateUnit).observe(deckEl);
  window.addEventListener('resize', updateUnit);
  window.addEventListener('orientationchange', () => setTimeout(updateUnit, 150));
  return { parent: gamePane, mobile: true };
}

/** The persistent movement/action controls, shown whenever the move bar is hidden. */
function buildControlLayer(): void {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';

  // One continuous drag stick replaces the four independent D-pad buttons.
  const pad = analogStick();

  // A / B — bottom-right cluster.
  const a = tapButton('A',  'position:absolute;right:calc(var(--u)*0.5);bottom:calc(var(--u)*1.1);width:calc(var(--u)*4.2);height:calc(var(--u)*4.2);border-radius:50%;font-size:calc(var(--u)*1.85);background:rgba(46,120,74,0.92);', KEY.space);
  const b = holdButton('B', 'position:absolute;right:calc(var(--u)*4.9);bottom:calc(var(--u)*1.2);width:calc(var(--u)*3.4);height:calc(var(--u)*3.4);border-radius:50%;font-size:calc(var(--u)*1.5);background:rgba(150,64,64,0.92);', KEY.shift);

  // Utility pills — top-right of the deck.
  const pill = 'top:calc(var(--u)*0.35);width:calc(var(--u)*2.7);height:calc(var(--u)*2.7);border-radius:calc(var(--u)*0.55);font-size:calc(var(--u)*1.25);';
  const menu = tapButton('☰',  `position:absolute;right:calc(var(--u)*0.5);${pill}`, KEY.m);
  const back = tapButton('✕',  `position:absolute;right:calc(var(--u)*3.5);${pill}`, KEY.esc);
  const bike = tapButton('🚲', `position:absolute;right:calc(var(--u)*6.5);${pill}`, KEY.c);

  layer.append(pad, a, b, menu, back, bike);
  controlLayer = layer;
}

/** Large direct battle commands. These call scene callbacks instead of
 * synthesising keyboard events, which iOS can drop between Phaser frames. */
function buildBattleActionLayer(): void {
  const layer = document.createElement('div');
  layer.style.cssText =
    'position:absolute;inset:0;display:none;flex-direction:column;' +
    'padding:calc(var(--u)*0.5);box-sizing:border-box;pointer-events:none;';
  const title = document.createElement('div');
  title.dataset.role = 'action-title';
  title.textContent = t('BATTLE COMMAND', '배틀 명령');
  title.style.cssText =
    'color:#ffe44e;font-weight:900;font-size:clamp(12px,calc(var(--u)*0.8),20px);' +
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
  layer.style.cssText = 'position:absolute;inset:0;display:none;flex-direction:column;padding:calc(var(--u)*0.5);box-sizing:border-box;pointer-events:none;';
  const title = document.createElement('div');
  title.textContent = 'CHOOSE A MOVE';
  title.style.cssText = 'color:#ffe44e;font-weight:800;font-size:clamp(12px,calc(var(--u)*0.8),20px);text-align:center;letter-spacing:2px;margin:clamp(1px,calc(var(--u)*0.15),5px) 0 clamp(2px,calc(var(--u)*0.25),8px);flex:0 0 auto;';
  const grid = document.createElement('div');
  grid.className = '__movegrid';
  grid.style.cssText = 'flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:calc(var(--u)*0.5);pointer-events:auto;';
  const back = document.createElement('div');
  back.textContent = '← BACK';
  back.style.cssText = btnBase + 'flex:0 0 auto;margin-top:clamp(3px,calc(var(--u)*0.5),12px);height:clamp(30px,calc(var(--u)*2.2),60px);border-radius:calc(var(--u)*0.4);font-size:clamp(13px,calc(var(--u)*0.9),22px);pointer-events:auto;background:rgba(60,70,100,0.9);';
  back.dataset.role = 'back';
  layer.append(title, grid, back);
  moveLayer = layer;
}

/** Large, canvas-independent party picker used by the mobile Pokémon menu. */
function buildPartyLeadLayer(): void {
  const layer = document.createElement('div');
  layer.style.cssText =
    'position:absolute;inset:0;display:none;flex-direction:column;' +
    'padding:calc(var(--u)*0.45);box-sizing:border-box;pointer-events:none;';

  const title = document.createElement('div');
  title.dataset.role = 'lead-title';
  title.textContent = t('CHANGE LEAD POKÉMON', '선두 포켓몬 변경');
  title.style.cssText =
    'height:clamp(30px,calc(var(--u)*1.65),52px);display:flex;align-items:center;justify-content:center;' +
    'color:#ffe44e;font-weight:900;font-size:clamp(13px,calc(var(--u)*0.82),21px);' +
    'letter-spacing:1px;flex:0 0 auto;';

  const close = tapButton(t('✕ CLOSE', '✕ 닫기'),
    'position:absolute;right:calc(var(--u)*0.5);top:calc(var(--u)*0.48);' +
    'width:clamp(64px,calc(var(--u)*3.2),112px);height:clamp(30px,calc(var(--u)*1.65),52px);' +
    'border-radius:calc(var(--u)*0.38);font-size:clamp(11px,calc(var(--u)*0.65),17px);', KEY.esc);
  close.dataset.role = 'lead-close';

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
      `padding:calc(var(--u)*0.24);background:${choice.isLead ? 'rgba(112,91,25,0.96)' : disabled ? 'rgba(45,45,58,0.94)' : 'rgba(25,43,78,0.96)'};` +
      `border-color:${choice.isLead ? '#ffe44e' : disabled ? '#55576b' : '#668bc7'};` +
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
      `color:${choice.isLead ? '#fff0a8' : disabled ? '#a9a9b5' : '#cbdcff'};`;
    cell.append(name, sub);
    if (!disabled) bindTap(cell, () => {
      if (cell.dataset.picked === 'true') return;
      cell.dataset.picked = 'true';
      cell.style.pointerEvents = 'none';
      cell.style.background = 'rgba(70,112,180,0.98)';
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
    controlLayer.style.display = 'block';
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
      `background:${disabled ? 'rgba(42,44,55,0.9)' : 'rgba(25,43,78,0.96)'};` +
      `opacity:${disabled ? 0.5 : 1};font-size:clamp(14px,calc(var(--u)*1.05),26px);` +
      'line-height:1.05;text-align:center;padding:calc(var(--u)*0.3);overflow-wrap:anywhere;';
    cell.textContent = tr(action.label);
    if (!disabled) bindTap(cell, () => {
      if (cell.dataset.picked === 'true') return;
      cell.dataset.picked = 'true';
      cell.style.pointerEvents = 'none';
      cell.style.background = 'rgba(70,112,180,0.98)';
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
    controlLayer.style.display = 'block';
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
      `background:${dim ? 'rgba(40,40,50,0.85)' : 'rgba(24,30,54,0.95)'};opacity:${dim ? 0.5 : 1};` +
      // Fonts are clamped so they never blow up on big/unfolded screens; the name wraps
      // instead of overflowing, and nothing gets clipped.
      'line-height:1.1;padding:clamp(3px,calc(var(--u)*0.3),12px);text-align:center;overflow:visible;';
    // Type + PP share one line so a cell needs only two rows of text — on short
    // landscape decks three rows overflowed the cell box, clipping the last line.
    cell.innerHTML =
      `<div style="font-weight:800;font-size:clamp(13px,calc(var(--u)*0.85),22px);line-height:1.05;word-break:break-word;overflow-wrap:anywhere">${tr(m.data.name).toUpperCase()}</div>` +
      `<div style="font-size:clamp(9px,calc(var(--u)*0.55),14px);margin-top:clamp(2px,calc(var(--u)*0.2),8px)"><span style="color:${col}">${m.data.type.toUpperCase()}</span><span style="color:#cbd3e6"> · PP ${m.pp}/${m.data.pp}</span></div>`;
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
    controlLayer.style.display = 'block';
  }
}

/** Back-compat shim: the old entry point. The shell is now built in setupMobileShell. */
export function initTouchControls(_force = false): void { /* handled by setupMobileShell */ }
