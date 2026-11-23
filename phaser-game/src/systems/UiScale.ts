import Phaser from 'phaser';
import { autoTranslateDisplay, isSpeakerLabelText } from './i18n';

// ── Screen-ratio-aware on-canvas font scaling ────────────────────────────────
// The game renders at a fixed 1280×720 with Scale.FIT, so the canvas is shrunk to
// fit the display. On a SMALL phone that shrink is severe (px fonts become a few
// screen-pixels tall → unreadable), so we enlarge fonts. But a flat multiplier
// hurts LARGE screens (incl. big touchscreens, which also count as "mobile"): the
// canvas is barely shrunk there, so scaled-up text overflows and neighbouring
// labels overlap.
//
// So the multiplier is derived from the ACTUAL display ratio (gameWidth /
// on-screen canvas width): ~1× when the canvas is shown near/above its native
// size (no overlap), rising toward MAX only as the canvas is squeezed onto a
// small screen. Hooked once at Phaser's text factory so no scene changes.

let ENABLED = false;
const MAX_SCALE = 2;      // never enlarge fonts beyond 2× (matches the small-phone target)

/** The font multiplier for a scene, from how far its canvas is scaled down to fit
 *  the display. 1 on large screens (canvas ≥ native width), up to MAX on small
 *  ones. UI that owns a fixed-size container (the dialog box) reads this so the
 *  box, spacing and layout grow together with the text — never overlapping. */
export function fontScaleForScene(scene: Phaser.Scene | undefined): number {
  if (!ENABLED || !scene) return 1;
  const sm = scene.scale as unknown as {
    gameSize?: { width?: number };
    displaySize?: { width?: number };
    canvas?: { getBoundingClientRect?: () => { width: number } };
  } | undefined;
  const gameW = sm?.gameSize?.width || 1280;
  const displayW = sm?.displaySize?.width
    || sm?.canvas?.getBoundingClientRect?.().width
    || gameW;
  if (!displayW) return 1;
  const ratio = gameW / displayW;                 // >1 when the canvas is shrunk
  return Math.min(MAX_SCALE, Math.max(1, ratio));
}

type PaddingObj = { x?: number; y?: number; left?: number; right?: number; top?: number; bottom?: number };
function scalePadding(p: number | PaddingObj, factor: number): number | PaddingObj {
  if (typeof p === 'number') return Math.round(p * factor);
  const out: PaddingObj = {};
  for (const k of ['x', 'y', 'left', 'right', 'top', 'bottom'] as const) {
    if (typeof p[k] === 'number') out[k] = Math.round((p[k] as number) * factor);
  }
  return out;
}

function scaleStyle(style: unknown, factor: number): unknown {
  const s = style as {
    fontSize?: unknown; padding?: number | PaddingObj; fixedWidth?: number; fixedHeight?: number; lineSpacing?: number;
  } | undefined;
  if (factor === 1 || !s || s.fontSize == null) return style;
  const fs = s.fontSize;
  let px: number | null = null;
  if (typeof fs === 'number') px = fs;
  else if (typeof fs === 'string') { const m = /^(\d+(?:\.\d+)?)\s*px$/.exec(fs.trim()); if (m) px = parseFloat(m[1]); }
  if (px == null) return style;
  const out: typeof s = { ...s, fontSize: `${Math.round(px * factor)}px` };
  // Grow the text's own background box (padding), any fixed box, and line gaps so
  // the enlarged glyphs sit in a proportionally enlarged rectangle — not clipped.
  if (s.padding != null) out.padding = scalePadding(s.padding, factor);
  if (typeof s.fixedWidth === 'number' && s.fixedWidth > 0) out.fixedWidth = Math.round(s.fixedWidth * factor);
  if (typeof s.fixedHeight === 'number' && s.fixedHeight > 0) out.fixedHeight = Math.round(s.fixedHeight * factor);
  if (typeof s.lineSpacing === 'number') out.lineSpacing = Math.round(s.lineSpacing * factor);
  return out;
}

function compactSpeakerStyle(style: unknown): unknown {
  const s = style as { fontSize?: unknown; padding?: number | PaddingObj } | undefined;
  if (!s) return style;
  return { ...s, fontSize: '7px', padding: { x: 2, y: 1 } };
}

/** Attach an exact speaker-name Text to the closest generated character. */
function attachSpeakerLabel(scene: Phaser.Scene | undefined, value: unknown): void {
  if (!scene || !(value instanceof Phaser.GameObjects.Text)) return;
  const label = value;
  label.setData('characterLabel3D', true);
  const children = scene.children?.list ?? [];
  let target: Phaser.GameObjects.GameObject | undefined;
  let best = Infinity;
  for (const child of children) {
    if (child === label || !('x' in child) || !('y' in child)) continue;
    const candidate = child as Phaser.GameObjects.GameObject & {
      x: number; y: number; getData?: (key: string) => unknown;
    };
    if (!candidate.getData?.('characterModel3DKey') && !candidate.getData?.('battleTrainer2DAnchor')) continue;
    const dx = Math.abs(candidate.x - label.x);
    const dy = candidate.y - label.y;
    if (dx > 40 || dy < -4 || dy > 72) continue;
    const score = dx * 2 + Math.abs(dy - 28);
    if (score < best) { best = score; target = candidate; }
  }
  if (!target || !('x' in target) || !('y' in target)) return;
  const actor = target as Phaser.GameObjects.GameObject & { x: number; y: number };
  label.setData('characterLabelTarget3D', actor);
  // Character drawings have their head top at about footY - 23. Use the actual
  // rendered label height so enlarged mobile fonts still leave a small gap.
  label.setOrigin(0.5).setPosition(actor.x, actor.y - 25 - label.displayHeight / 2);
}

/** Install the screen-ratio font multiplier. MUST run before any scene creates
 *  text. `enabled` is normally true only on touch devices; the per-scene ratio
 *  keeps it a no-op on large displays even when enabled. */
export function installFontScaling(enabled: boolean): void {
  ENABLED = enabled;
  // Install the factory hook on every device: font multiplication remains a
  // mobile-only concern, while compact character-name labels apply everywhere.

  const facProto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (x: number, y: number, text: unknown, style: unknown) => unknown;
    scene?: Phaser.Scene;
  };
  const origText = facProto.text;
  facProto.text = function (x: number, y: number, text: unknown, style: unknown) {
    if (typeof text === 'string') text = autoTranslateDisplay(text);
    const speakerLabel = isSpeakerLabelText(text);
    const prepared = speakerLabel ? compactSpeakerStyle(style) : style;
    const result = origText.call(this, x, y, text, scaleStyle(prepared, fontScaleForScene(this.scene)));
    if (speakerLabel) attachSpeakerLabel(this.scene, result);
    return result;
  };

  // Later updates (toasts, HUD rows, dialogue pages) arrive through setText.
  // Route them through the same localization safety net.
  const textProto = Phaser.GameObjects.Text.prototype as unknown as {
    setText: (value: unknown) => unknown;
    __pkAutoTranslate?: boolean;
  };
  if (!textProto.__pkAutoTranslate) {
    const origSetText = textProto.setText;
    textProto.setText = function (value: unknown) {
      return origSetText.call(this, typeof value === 'string' ? autoTranslateDisplay(value) : value);
    };
    textProto.__pkAutoTranslate = true;
  }

  // this.make.text({ ... }) bypasses the factory — patch the creator too.
  const crProto = Phaser.GameObjects.GameObjectCreator.prototype as unknown as {
    text?: (config: { style?: unknown }, addToScene?: boolean) => unknown;
    scene?: Phaser.Scene;
  };
  const origCreate = crProto.text;
  if (origCreate) {
    crProto.text = function (config: { style?: unknown }, addToScene?: boolean) {
      if (config && config.style) config = { ...config, style: scaleStyle(config.style, fontScaleForScene(this.scene)) };
      return origCreate.call(this, config, addToScene);
    };
  }
}
