import Phaser from 'phaser';
import { TYPE_COLORS } from '../data/StarterData';
import { tr, typeName } from './i18n';
import { fontScaleForScene } from './UiScale';
import { sfxConfirm, sfxMove } from './UiSfx';

/** Shared visual language for the high-density menu, storage and battle UI. */
export const PROD_UI = {
  ink: 0x07111f,
  panel: 0x10213a,
  panelRaised: 0x172d4b,
  line: 0x54779f,
  text: '#f6fbff',
  muted: '#a9bfd5',
  cyan: 0x59d8ff,
  yellow: 0xffdc5e,
  green: 0x35d06f,
  amber: 0xf4c542,
  red: 0xef5261,
} as const;

export function hpColor(ratio: number): number {
  if (ratio > 0.5) return PROD_UI.green;
  if (ratio > 0.25) return PROD_UI.amber;
  return PROD_UI.red;
}

export function roundedPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fill?: number; alpha?: number; stroke?: number; radius?: number; shadow?: boolean } = {},
): Phaser.GameObjects.Graphics {
  const fill = options.fill ?? PROD_UI.panel;
  const alpha = options.alpha ?? 0.96;
  const stroke = options.stroke ?? PROD_UI.line;
  const radius = options.radius ?? 16;
  const g = scene.add.graphics();
  if (options.shadow !== false) {
    g.fillStyle(0x000000, 0.32);
    g.fillRoundedRect(x + 5, y + 7, width, height, radius);
  }
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, width, height, radius);
  g.lineStyle(1.5, stroke, 0.72);
  g.strokeRoundedRect(x, y, width, height, radius);
  // A restrained top highlight gives the panel depth without obscuring the field.
  g.lineStyle(1, 0xffffff, 0.10);
  g.beginPath();
  g.moveTo(x + radius, y + 1);
  g.lineTo(x + width - radius, y + 1);
  g.strokePath();
  return g;
}

export interface BattleHud {
  objects: Phaser.GameObjects.GameObject[];
  nameText: Phaser.GameObjects.Text;
  levelText: Phaser.GameObjects.Text;
  hpBar: Phaser.GameObjects.Rectangle;
  hpText: Phaser.GameObjects.Text;
  hpWidth: number;
  typeChips: Array<{ background: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }>;
}

export interface BattleHudConfig {
  side: 'enemy' | 'player';
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  types: Array<string | undefined>;
  accent?: number;
  hidden?: boolean;
}

/**
 * Builds a safe-area aware battle card. Every label, including type chips, is
 * contained inside the card; this is what prevents enlarged mobile text from
 * escaping through the left edge of the canvas.
 */
export function createBattleHud(scene: Phaser.Scene, config: BattleHudConfig): BattleHud {
  const scale = Math.max(1, fontScaleForScene(scene));
  const desiredWidth = 304 + Math.round((scale - 1) * 116);
  const width = Math.min(scene.scale.width - 28, Math.max(292, desiredWidth));
  const height = 96;
  const margin = 14;
  const x = config.side === 'enemy' ? margin : scene.scale.width - margin - width;
  const y = config.side === 'enemy' ? 16 : scene.scale.height - 120 - height - 14;
  const accent = config.accent ?? (config.side === 'player' ? PROD_UI.cyan : 0xff7f76);
  const panel = roundedPanel(scene, x, y, width, height, {
    fill: PROD_UI.ink, alpha: 0.9, stroke: accent, radius: 14,
  });
  panel.setDepth(9);

  const nameText = scene.add.text(x + 14, y + 11, config.name, {
    fontSize: '15px', color: PROD_UI.text, fontStyle: 'bold',
    fixedWidth: width - 90,
  }).setDepth(10);
  const levelText = scene.add.text(x + width - 13, y + 12, `Lv.${config.level}`, {
    fontSize: '13px', color: '#ffe788', fontStyle: 'bold',
  }).setOrigin(1, 0).setDepth(10);

  const hpX = x + 15;
  const hpWidth = width - 30;
  const hpY = y + 43;
  const track = scene.add.rectangle(hpX + hpWidth / 2, hpY, hpWidth + 6, 13, 0x07101c, 0.94)
    .setStrokeStyle(1, 0xffffff, 0.16).setDepth(10);
  const ratio = Phaser.Math.Clamp(config.maxHp > 0 ? config.hp / config.maxHp : 0, 0, 1);
  const hpBar = scene.add.rectangle(hpX, hpY, hpWidth * ratio, 9, hpColor(ratio))
    .setOrigin(0, 0.5).setDepth(11);
  const hpText = scene.add.text(x + width - 14, y + 53, `${config.hp}/${config.maxHp}`, {
    fontSize: '10px', color: '#d9e7f4', fontStyle: 'bold',
  }).setOrigin(1, 0).setDepth(10);

  const objects: Phaser.GameObjects.GameObject[] = [panel, nameText, levelText, track, hpBar, hpText];
  const types = config.types.filter(Boolean) as string[];
  const typeChips: BattleHud['typeChips'] = [];
  for (let index = 0; index < 2; index++) {
    const type = types[index];
    const chipW = 86;
    const chipX = x + 14 + chipW / 2 + index * (chipW + 7);
    const col = type ? (TYPE_COLORS as Record<string, number>)[type] ?? PROD_UI.line : PROD_UI.line;
    const chip = scene.add.rectangle(chipX, y + 75, chipW, 20, col, 0.92)
      .setStrokeStyle(1, 0xffffff, 0.22).setDepth(10).setVisible(!!type);
    const label = scene.add.text(chipX, y + 75, type ? typeName(type) : '', {
      fontSize: '9px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11).setVisible(!!type);
    objects.push(chip, label);
    typeChips.push({ background: chip, label });
  }

  if (config.hidden) {
    for (const object of objects) (object as unknown as { setAlpha(value: number): void }).setAlpha(0);
  }
  return { objects, nameText, levelText, hpBar, hpText, hpWidth, typeChips };
}

/** Keep the player card's type chips accurate after an in-battle switch. */
export function syncBattleHudTypes(hud: BattleHud | undefined, types: Array<string | undefined>): void {
  if (!hud) return;
  const visible = types.filter(Boolean) as string[];
  hud.typeChips.forEach((chip, index) => {
    const type = visible[index];
    chip.background.setVisible(!!type);
    chip.label.setVisible(!!type);
    if (!type) return;
    chip.background.setFillStyle((TYPE_COLORS as Record<string, number>)[type] ?? PROD_UI.line, 0.92);
    chip.label.setText(typeName(type));
  });
}

export interface ModernButtonConfig {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent?: number;
  disabled?: boolean;
  onPick: () => void;
}

/** A complete hit target (not text-only), suitable for mouse, touch and keyboard focus. */
export function modernButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  config: ModernButtonConfig,
): Phaser.GameObjects.Rectangle {
  const accent = config.accent ?? PROD_UI.cyan;
  const bg = scene.add.rectangle(config.x, config.y, config.width, config.height,
    config.disabled ? 0x26303d : PROD_UI.panelRaised, config.disabled ? 0.62 : 0.96)
    .setStrokeStyle(1.5, config.disabled ? 0x4a5664 : accent, config.disabled ? 0.45 : 0.9);
  const stripe = scene.add.rectangle(config.x - config.width / 2 + 4, config.y, 6, config.height - 8,
    config.disabled ? 0x59616b : accent, 0.95);
  const label = scene.add.text(config.x, config.y, config.label, {
    fontSize: '15px', color: config.disabled ? '#74808f' : '#ffffff', fontStyle: 'bold', align: 'center',
    fixedWidth: config.width - 18,
  }).setOrigin(0.5);
  container.add([bg, stripe, label]);
  if (!config.disabled) {
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { bg.setFillStyle(accent, 0.28); label.setColor('#ffffff'); sfxMove(scene); })
      .on('pointerout', () => bg.setFillStyle(PROD_UI.panelRaised, 0.96))
      .on('pointerdown', () => { sfxConfirm(scene); config.onPick(); });
  }
  return bg;
}

export interface ModernMoveConfig {
  move: { data: { name: string; type: string; pp: number }; pp: number };
  x: number;
  y: number;
  width: number;
  height: number;
  onPick: () => void;
}

/** Compact Sword/Shield-inspired move card with name, localized type and PP. */
export function modernMoveButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  config: ModernMoveConfig,
): Phaser.GameObjects.Rectangle {
  const move = config.move;
  const disabled = move.pp <= 0;
  const accent = (TYPE_COLORS as Record<string, number>)[move.data.type] ?? PROD_UI.line;
  const bg = scene.add.rectangle(config.x, config.y, config.width, config.height,
    disabled ? 0x232a33 : 0x14263a, disabled ? 0.72 : 0.98)
    .setStrokeStyle(1.5, disabled ? 0x4d5965 : accent, disabled ? 0.5 : 0.9);
  const stripe = scene.add.rectangle(config.x - config.width / 2 + 5, config.y, 8, config.height - 10,
    disabled ? 0x5f6871 : accent, 0.96);
  const typeDot = scene.add.circle(config.x + config.width / 2 - 23, config.y - 12, 11,
    disabled ? 0x5f6871 : accent, 0.98).setStrokeStyle(1, 0xffffff, 0.26);
  const name = scene.add.text(config.x - config.width / 2 + 18, config.y - 19, tr(move.data.name), {
    fontSize: '13px', color: disabled ? '#737d87' : '#ffffff', fontStyle: 'bold',
    fixedWidth: config.width - 58,
  });
  const meta = scene.add.text(config.x - config.width / 2 + 18, config.y + 8,
    `${typeName(move.data.type)}  ·  PP ${move.pp}/${move.data.pp}`, {
      fontSize: '9px', color: disabled ? '#68717a' : '#b9cad9', fontStyle: 'bold',
      fixedWidth: config.width - 36,
    });
  container.add([bg, stripe, typeDot, name, meta]);
  if (!disabled) {
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { bg.setFillStyle(accent, 0.30); sfxMove(scene); })
      .on('pointerout', () => bg.setFillStyle(0x14263a, 0.98))
      .on('pointerdown', () => { sfxConfirm(scene); config.onPick(); });
  }
  return bg;
}
