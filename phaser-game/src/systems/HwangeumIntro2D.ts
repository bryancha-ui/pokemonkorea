import Phaser from 'phaser';

// ── Champion Hwangeum's 2D intro ─────────────────────────────────────────────
// His entrance used to be a rigged GLB playing a baked "Gangnam Groove" clip and
// a procedurally posed throw. It moved, but it was never HIM: the 3D figure is a
// different drawing from the champion the rest of the game shows you.
//
// So the entrance is now hand-posed 2D artwork of the same character — a standing
// pose, four idol-dance beats, and five throwing frames — swapped through on the
// battle portrait itself, the way a sprite-sheet character has always worked.
//
// Every frame is generated from the same reference portrait, so the face, the
// stage jacket and the line weight match the art used in dialogue and the Hall of
// Fame. Purely presentational: this drives a texture swap and one callback, and
// reads no battle state.

const DIR = 'assets/npc/hwangeum/';

/** Texture keys, in the order the routine plays them. */
export const HWANGEUM_FRAMES = {
  stand:  'hw2d_stand',
  dance1: 'hw2d_dance1',
  dance2: 'hw2d_dance2',
  dance3: 'hw2d_dance3',
  dance4: 'hw2d_dance4',
  throw1: 'hw2d_throw1',
  throw2: 'hw2d_throw2',
  throw3: 'hw2d_throw3',
  throw4: 'hw2d_throw4',
  throw5: 'hw2d_throw5',
} as const;

const FILES: Record<string, string> = {
  [HWANGEUM_FRAMES.stand]:  DIR + 'hw_stand.png',
  [HWANGEUM_FRAMES.dance1]: DIR + 'hw_dance1.png',
  [HWANGEUM_FRAMES.dance2]: DIR + 'hw_dance2.png',
  [HWANGEUM_FRAMES.dance3]: DIR + 'hw_dance3.png',
  [HWANGEUM_FRAMES.dance4]: DIR + 'hw_dance4.png',
  [HWANGEUM_FRAMES.throw1]: DIR + 'hw_throw1.png',
  [HWANGEUM_FRAMES.throw2]: DIR + 'hw_throw2.png',
  [HWANGEUM_FRAMES.throw3]: DIR + 'hw_throw3.png',
  [HWANGEUM_FRAMES.throw4]: DIR + 'hw_throw4.png',
  [HWANGEUM_FRAMES.throw5]: DIR + 'hw_throw5.png',
};

/** Queue every frame. Safe to call in any scene's preload; already-present
 *  textures are skipped, and a missing file simply leaves that key absent. */
export function preloadHwangeumFrames(scene: Phaser.Scene): void {
  for (const [key, url] of Object.entries(FILES)) {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  }
}

/** True once every frame is resident, i.e. the 2D routine can actually play. */
export function hwangeumFramesReady(scene: Phaser.Scene): boolean {
  return Object.keys(FILES).every(key => scene.textures.exists(key));
}

interface Beat { key: string; hold: number; dx?: number; dy?: number; tilt?: number }

/**
 * The routine, as (frame, hold-in-ms) pairs.
 *
 * The dance is deliberately built out of HOLDS rather than an even frame rate:
 * idol choreography hits a shape and stops on it, and reading a pose is what
 * makes four drawings look like dancing. `dx/dy/tilt` add the weight shift the
 * still frames cannot show — a few pixels of travel per beat, no more.
 */
const DANCE: Beat[] = [
  { key: HWANGEUM_FRAMES.stand,  hold: 260 },
  { key: HWANGEUM_FRAMES.dance1, hold: 240, dy: -6, tilt: -0.03 },
  { key: HWANGEUM_FRAMES.dance2, hold: 200, dy: 4, tilt: 0.02 },
  { key: HWANGEUM_FRAMES.dance3, hold: 240, dx: 7, tilt: 0.04 },
  { key: HWANGEUM_FRAMES.dance1, hold: 190, dy: -5, tilt: -0.03 },
  { key: HWANGEUM_FRAMES.dance4, hold: 280, dx: -6, tilt: -0.02 },
  { key: HWANGEUM_FRAMES.dance2, hold: 200, dy: 4, tilt: 0.02 },
  { key: HWANGEUM_FRAMES.dance3, hold: 220, dx: 7, tilt: 0.04 },
  { key: HWANGEUM_FRAMES.stand,  hold: 220 },
];

/**
 * The throw, timed the way an arm actually moves: a long gather, then a burst.
 * The wind-up holds; the elbow-lead and release frames are nearly flashes; the
 * follow-through decelerates. `release` marks the frame the ball leaves his hand,
 * so the caller can fire its own ball FX on the exact beat.
 */
const THROW: (Beat & { release?: boolean })[] = [
  { key: HWANGEUM_FRAMES.throw1, hold: 420, tilt: 0.02 },
  { key: HWANGEUM_FRAMES.throw2, hold: 380, dx: -10, dy: -4, tilt: 0.06 },
  { key: HWANGEUM_FRAMES.throw3, hold: 90,  dx: 6, tilt: -0.04 },
  { key: HWANGEUM_FRAMES.throw4, hold: 110, dx: 16, dy: 2, tilt: -0.08, release: true },
  { key: HWANGEUM_FRAMES.throw5, hold: 420, dx: 10, dy: 4, tilt: -0.05 },
  { key: HWANGEUM_FRAMES.stand,  hold: 200 },
];

export interface HwangeumIntroOptions {
  /** Fired on the frame the ball leaves his hand. */
  onRelease?: () => void;
  /** Fired once the whole routine has settled back to standing. */
  onDone?: () => void;
  /** Called for every frame swap so the caller can re-fit its portrait box. */
  onFrame?: (key: string) => void;
}

/** Total wall-clock length of the routine, for callers that need to time around it. */
export const HWANGEUM_INTRO_MS =
  DANCE.reduce((n, b) => n + b.hold, 0) + THROW.reduce((n, b) => n + b.hold, 0);
/** When the ball leaves his hand, measured from the start of the routine. */
export const HWANGEUM_RELEASE_MS = (() => {
  let t = DANCE.reduce((n, b) => n + b.hold, 0);
  for (const beat of THROW) {
    if (beat.release) return t;
    t += beat.hold;
  }
  return t;
})();

/**
 * Play the full dance-then-throw routine on `portrait`.
 * Returns a stop() that cancels cleanly if the scene shuts down mid-routine.
 */
export function playHwangeumIntro(
  scene: Phaser.Scene,
  portrait: Phaser.GameObjects.Image,
  options: HwangeumIntroOptions = {},
): () => void {
  const beats = [...DANCE, ...THROW];
  const homeX = portrait.x, homeY = portrait.y, homeAngle = portrait.angle;
  // The weight shift is published as an OFFSET, not as an absolute position. In
  // 3D the battle mirror pins this portrait to the arena anchor every frame, so
  // anything written straight to x/y is overwritten before it is drawn; the pin
  // reads these two data keys and adds them. With 3D off nothing is pinned, so
  // the same numbers are applied here directly.
  const off = { dx: 0, dy: 0 };
  const publish = () => {
    portrait.setData('pin2DOffsetX', off.dx);
    portrait.setData('pin2DOffsetY', off.dy);
    portrait.setPosition(homeX + off.dx, homeY + off.dy);
  };
  let cancelled = false;
  let timer: Phaser.Time.TimerEvent | undefined;
  let index = 0;

  const step = () => {
    if (cancelled || !portrait.scene) return;
    const beat = beats[index] as Beat & { release?: boolean };
    portrait.setTexture(beat.key);
    options.onFrame?.(beat.key);
    // Snap most of the way to the pose, then ease the rest across the hold.
    // Snapping is what gives the dance its attack; easing is what stops four
    // drawings from reading as a slideshow.
    off.dx = (beat.dx ?? 0) * 0.4;
    off.dy = (beat.dy ?? 0) * 0.4;
    publish();
    portrait.setAngle(homeAngle + Phaser.Math.RadToDeg(beat.tilt ?? 0) * 0.4);
    scene.tweens.add({
      targets: off, dx: beat.dx ?? 0, dy: beat.dy ?? 0,
      duration: Math.max(60, beat.hold * 0.8), ease: 'Sine.Out', onUpdate: publish,
    });
    scene.tweens.add({
      targets: portrait, angle: homeAngle + Phaser.Math.RadToDeg(beat.tilt ?? 0),
      duration: Math.max(60, beat.hold * 0.8), ease: 'Sine.Out',
    });
    if (beat.release) options.onRelease?.();

    index++;
    if (index >= beats.length) {
      timer = scene.time.delayedCall(beat.hold, () => {
        if (cancelled || !portrait.scene) return;
        off.dx = 0; off.dy = 0; publish();
        portrait.setAngle(homeAngle);
        options.onDone?.();
      });
      return;
    }
    timer = scene.time.delayedCall(beat.hold, step);
  };

  step();
  return () => {
    cancelled = true;
    timer?.remove();
    if (portrait.scene) {
      portrait.setData('pin2DOffsetX', 0).setData('pin2DOffsetY', 0);
      portrait.setPosition(homeX, homeY).setAngle(homeAngle);
    }
  };
}

/**
 * The ball he just released, drawn in 2D and flown to the send-out mark.
 *
 * Real projectile motion rather than a sine arc: the ball leaves his hand with a
 * velocity and falls under gravity, which is what makes it read as thrown rather
 * than slid across the screen. `onLand` is the cue for the send-out.
 */
export function throwChampionBall(
  scene: Phaser.Scene,
  fromX: number, fromY: number,
  toX: number, toY: number,
  onLand: () => void,
): void {
  const ball = scene.add.container(fromX, fromY).setDepth(9);
  const g = scene.add.graphics();
  const R = 11;
  g.fillStyle(0xd8342c, 1);
  g.slice(0, 0, R, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false); g.fillPath();
  g.fillStyle(0xf2f2f0, 1);
  g.slice(0, 0, R, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(180), false); g.fillPath();
  g.fillStyle(0x24262b, 1); g.fillRect(-R, -1.8, R * 2, 3.6);
  g.lineStyle(1.6, 0x24262b, 1); g.strokeCircle(0, 0, R);
  g.fillStyle(0x24262b, 1); g.fillCircle(0, 0, 3.8);
  g.fillStyle(0xf2f2f0, 1); g.fillCircle(0, 0, 2.2);
  ball.add(g);

  const DUR = 460, GRAV = 2600;              // px/s²
  const dur = DUR / 1000;
  const vx = (toX - fromX) / dur;
  // Solve for the launch speed that lands on the mark at exactly `dur`.
  const vy = (toY - fromY) / dur - 0.5 * GRAV * dur;

  let t = 0;
  const spin = scene.tweens.add({ targets: ball, angle: 540, duration: DUR, ease: 'Linear' });
  const flight = scene.time.addEvent({
    delay: 16, loop: true, callback: () => {
      if (!ball.scene) { flight.remove(); return; }
      t += 0.016;
      const k = Math.min(1, t / dur);
      ball.setPosition(fromX + vx * t, fromY + vy * t + 0.5 * GRAV * t * t);
      // A short motion trail, fading behind the ball.
      if (k < 1 && Math.random() < 0.7) {
        const ghost = scene.add.circle(ball.x, ball.y, 5, 0xffffff, 0.4).setDepth(8);
        scene.tweens.add({ targets: ghost, alpha: 0, scale: 0.4, duration: 180, onComplete: () => ghost.destroy() });
      }
      if (k >= 1) {
        flight.remove();
        spin.stop();
        const flash = scene.add.circle(toX, toY, 10, 0xffffff, 0.9).setDepth(10);
        scene.tweens.add({
          targets: flash, radius: 56, alpha: 0, duration: 260, ease: 'Cubic.Out',
          onComplete: () => flash.destroy(),
        });
        ball.destroy();
        onLand();
      }
    },
  });
}
