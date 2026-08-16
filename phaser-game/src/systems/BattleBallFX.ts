import Phaser from 'phaser';

export type BattleBallKey = 'pokeball' | 'greatball' | 'ultraball' | 'masterball' | string;

interface BallStyle {
  top: number;
  accent: number;
  button: number;
}

const BALL_STYLES: Record<string, BallStyle> = {
  pokeball:   { top: 0xdd2b32, accent: 0xdd2b32, button: 0xffffff },
  greatball:  { top: 0x2873cf, accent: 0xe53b45, button: 0xffffff },
  ultraball:  { top: 0x20242d, accent: 0xf3c928, button: 0xf3c928 },
  masterball: { top: 0x8650bd, accent: 0xef70ad, button: 0xffffff },
};

function styleFor(key: BattleBallKey): BallStyle {
  return BALL_STYLES[String(key).toLowerCase()] ?? BALL_STYLES.pokeball;
}

/** Draw one of the four usable ball types without relying on an external sprite. */
export function drawBattleBall(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  key: BattleBallKey,
  radius = 11,
  opening = 0,
  tilt = 0,
): void {
  const style = styleFor(key);
  const ballKey = String(key).toLowerCase();
  const r = radius;

  g.clear();
  g.fillStyle(0x07101b, 0.28);
  g.fillEllipse(x + 2, y + r + 3, r * 1.8, r * 0.45);

  if (opening > 0) {
    const split = Math.min(r * 0.9, opening);
    g.fillStyle(style.top, 1);
    g.fillEllipse(x, y - split - r * 0.2, r * 2, r * 0.95);
    g.lineStyle(2, 0x171a20, 1);
    g.strokeEllipse(x, y - split - r * 0.2, r * 2, r * 0.95);
    g.fillStyle(0xf7f7f2, 1);
    g.fillEllipse(x, y + split + r * 0.2, r * 2, r * 0.95);
    g.lineStyle(2, 0x171a20, 1);
    g.strokeEllipse(x, y + split + r * 0.2, r * 2, r * 0.95);
    g.fillStyle(style.button, 1);
    g.fillCircle(x, y, r * 0.24);
    g.lineStyle(1.5, 0x171a20, 1);
    g.strokeCircle(x, y, r * 0.24);
    return;
  }

  // Coloured shell with a curved white lower half.
  g.fillStyle(style.top, 1);
  g.fillCircle(x, y, r);
  g.fillStyle(0xf7f7f2, 1);
  g.fillEllipse(x, y + r * 0.43, r * 1.72, r * 0.92);

  // Type-specific markings remain recognisable while the ball spins in flight.
  const lean = Math.sin(tilt) * r * 0.08;
  if (ballKey === 'greatball') {
    g.fillStyle(style.accent, 1);
    g.fillTriangle(x - r * 0.82 + lean, y - r * 0.62, x - r * 0.2 + lean, y - r * 0.48, x - r * 0.55 + lean, y - r * 0.05);
    g.fillTriangle(x + r * 0.82 + lean, y - r * 0.62, x + r * 0.2 + lean, y - r * 0.48, x + r * 0.55 + lean, y - r * 0.05);
  } else if (ballKey === 'ultraball') {
    g.fillStyle(style.accent, 1);
    g.fillRect(x - r * 0.18 + lean, y - r * 0.94, r * 0.36, r * 0.82);
    g.fillRect(x - r * 0.76 + lean, y - r * 0.64, r * 0.48, r * 0.24);
    g.fillRect(x + r * 0.28 + lean, y - r * 0.64, r * 0.48, r * 0.24);
  } else if (ballKey === 'masterball') {
    g.fillStyle(style.accent, 1);
    g.fillCircle(x - r * 0.56 + lean, y - r * 0.36, r * 0.25);
    g.fillCircle(x + r * 0.56 + lean, y - r * 0.36, r * 0.25);
    g.lineStyle(Math.max(1.5, r * 0.14), 0xffffff, 1);
    g.lineBetween(x - r * 0.38 + lean, y - r * 0.66, x - r * 0.16 + lean, y - r * 0.3);
    g.lineBetween(x - r * 0.16 + lean, y - r * 0.3, x + lean, y - r * 0.55);
    g.lineBetween(x + lean, y - r * 0.55, x + r * 0.16 + lean, y - r * 0.3);
    g.lineBetween(x + r * 0.16 + lean, y - r * 0.3, x + r * 0.38 + lean, y - r * 0.66);
  }

  // Black hinge band and central release button.
  g.fillStyle(0x171a20, 1);
  g.fillRect(x - r * 0.9, y - r * 0.1, r * 1.8, r * 0.2);
  g.fillCircle(x, y, r * 0.35);
  g.fillStyle(style.button, 1);
  g.fillCircle(x, y, r * 0.21);
  g.lineStyle(2, 0x171a20, 1);
  g.strokeCircle(x, y, r);
}

interface SendOutOptions {
  side: 'player' | 'enemy';
  targetX: number;
  targetY: number;
  ballKey?: BattleBallKey;
  duration?: number;
  onComplete?: () => void;
  /** Skip the flat 2D ball graphic — used when the 3D layer has already thrown a
   *  real ball (the Champion's stage routine). The landing burst and the
   *  Pokémon's materialisation still play. */
  skipBall?: boolean;
}

/**
 * Throw a ball from the trainer side, open it at the live 3D Pokémon anchor,
 * then materialise the existing Phaser/3D combatant out of its light burst.
 */
export function playBallSendOut(
  scene: Phaser.Scene,
  pokemon: Phaser.GameObjects.Image,
  options: SendOutOptions,
): void {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const ballKey = options.ballKey ?? 'pokeball';
  const startX = options.side === 'player' ? W * 0.1 : W * 0.9;
  const startY = options.side === 'player' ? H * 0.66 : H * 0.2;
  const baseSX = Math.abs(pokemon.scaleX) || 1;
  const baseSY = Math.abs(pokemon.scaleY) || baseSX;

  pokemon.setPosition(options.targetX, options.targetY).setVisible(true).setAlpha(0);
  pokemon.setScale(baseSX * 0.16, baseSY * 0.16);

  const target = { target: pokemon, x: options.targetX, y: options.targetY, heightRatio: 0.48 };
  scene.events.emit('pk3d-screen-target', target);
  const endX = target.x;
  const endY = target.y;

  const ball = scene.add.graphics().setDepth(28).setData('no3d', true);
  ball.setVisible(!options.skipBall);
  const flight = { t: 0 };
  if (!options.skipBall) drawBattleBall(ball, startX, startY, ballKey, 12);

  scene.tweens.add({
    targets: flight,
    t: 1,
    // With the 3D layer throwing the real ball, this tween is only a timer in
    // front of the reveal — running its full 520ms would land the Pokémon a
    // second after the ball it came from. Collapse it and open immediately.
    duration: options.skipBall ? 1 : (options.duration ?? 520),
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      const t = flight.t;
      const x = Phaser.Math.Linear(startX, endX, t);
      const y = Phaser.Math.Linear(startY, endY, t) - Math.sin(t * Math.PI) * 105;
      if (!options.skipBall) drawBattleBall(ball, x, y, ballKey, 12, 0, t * Math.PI * 6);
    },
    onComplete: () => {
      if (!options.skipBall) drawBattleBall(ball, endX, endY, ballKey, 12, 7);
      const flash = scene.add.circle(endX, endY, 9, 0xdffcff, 0.95)
        .setDepth(27).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: flash, scale: 6, alpha: 0, duration: 360, onComplete: () => flash.destroy() });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const spark = scene.add.circle(endX, endY, i % 2 ? 3 : 2, i % 2 ? 0xffffff : 0x75d9ff, 0.9)
          .setDepth(29).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({
          targets: spark,
          x: endX + Math.cos(a) * (34 + (i % 3) * 9),
          y: endY + Math.sin(a) * (27 + (i % 3) * 7),
          alpha: 0,
          duration: 420,
          onComplete: () => spark.destroy(),
        });
      }
      scene.time.delayedCall(90, () => {
        scene.tweens.add({
          targets: pokemon,
          alpha: 1,
          scaleX: baseSX,
          scaleY: baseSY,
          duration: 340,
          ease: 'Back.easeOut',
          onComplete: () => {
            pokemon.setScale(baseSX, baseSY).setAlpha(1);
            options.onComplete?.();
          },
        });
        scene.tweens.add({ targets: ball, alpha: 0, duration: 180, onComplete: () => ball.destroy() });
      });
    },
  });
}
