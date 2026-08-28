import Phaser from 'phaser';
import { MoveData } from '../battle/Pokemon';
import { TYPE_COLORS } from '../data/StarterData';
import { BATTLE_PACING, cinematic3DImpactDelay } from './BattlePacing';
import { playMoveSfx } from './MoveSfx';

const CINEMATIC_3D_IMPACT_DELAY: Readonly<Record<string, number>> = {
  'soul ferry deluge': 515, 'royal kiln roar': 450,
  'ice beam': 365, 'hydro pump': 525, 'shadow ball': 640, 'air slash': 455,
  flamethrower: 290, ember: 290, 'flame burst': 290, 'fire blast': 290,
  thunderbolt: 410,
  psychic: 290, psybeam: 290, psyshock: 290, confusion: 290,
  'dark pulse': 290, hex: 290, 'ominous wind': 290,
  'bug buzz': 290, 'hyper voice': 290, supersonic: 290,
  'energy ball': 310, 'mega drain': 310, 'giga drain': 310, absorb: 310, 'grave bloom': 310,
  'sludge bomb': 320, venoshock: 320,
  moonblast: 330, 'dazzling gleam': 330, 'fairy wind': 330, 'draining kiss': 330,
  'draco meteor': 545, 'dragon pulse': 290, 'dragon breath': 290,
  blizzard: 335, 'powder snow': 335, 'aurora beam': 335,
};

/**
 * Play a quick attack animation for `move`, from the attacker sprite toward the
 * target sprite, then call `onImpact` at the moment of contact. Type-coloured:
 *   • physical → the attacker lunges into the target
 *   • special  → a coloured projectile flies to the target
 * On impact the target flashes its type colour, jitters, sprays coloured shards,
 * the camera gives a small shake, and a hit sound plays (a brighter "sting" when
 * the move is super-effective). `effectiveness` is the type multiplier from
 * takeDamage (0 = no effect, >1 = super effective).
 */
export function playMoveFX(
  scene: Phaser.Scene,
  attacker: Phaser.GameObjects.Image,
  target: Phaser.GameObjects.Image,
  move: MoveData,
  effectiveness: number,
  onImpact: () => void,
): void {
  const color = (TYPE_COLORS as Record<string, number>)[move.type] ?? 0xffffff;
  const engine3D = (window as unknown as { __pk3d?: { isRendering(scene: Phaser.Scene): boolean } }).__pk3d;
  const using3D = !!engine3D?.isRendering(scene);
  // Visual-layer hook only: lets the 3D renderer mirror this move as a 3D
  // effect (projectile / impact burst). No game behavior depends on it.
  scene.events.emit('pk3d-movefx', {
    attacker, target, color,
    category: move.category, moveType: move.type, moveName: move.name,
    power: move.power ?? 0, effectiveness,
  });
  const ax = attacker.x, ay = attacker.y;
  const tx = target.x, ty = target.y;
  const moveKey = move.name.toLowerCase().replace(/-/g, ' ').trim();

  // Each element gets its own voice — fire crackles as it launches, fighting
  // cracks like a snapped board when it lands. The cast layer plays quieter so
  // it sits under the impact rather than competing with it.
  playMoveSfx(scene, move.type, 'cast');

  const impact = () => {
    flashTarget(scene, target, color, !using3D);
    scene.cameras.main.shake(180, 0.0065);
    playHitSfx(scene, effectiveness);
    if (effectiveness !== 0) playMoveSfx(scene, move.type, 'impact');
    onImpact();
  };

  if (move.category === 'physical') {
    if (using3D && moveKey === 'fly') {
      // BattleMirror's airborne dive reaches the target at 0.58 of its 1.1 s
      // timeline. Keep damage/HP feedback on that contact instead of the old
      // 120 ms ground-lunge beat.
      scene.time.delayedCall(cinematic3DImpactDelay(640), impact);
      return;
    }
    if (using3D && moveKey === 'close combat') {
      // The 3D mirror stages four visible contacts over 0.92 s. Resolve battle
      // damage on the finisher instead of during the old single-lunge beat.
      scene.time.delayedCall(cinematic3DImpactDelay(850), impact);
      return;
    }
    if (using3D && (moveKey === 'rock slide' || moveKey === 'stone shower' || moveKey === 'stone edge')) {
      scene.time.delayedCall(cinematic3DImpactDelay(moveKey === 'stone edge' ? 500 : 620), impact);
      return;
    }
    if (using3D && (moveKey === 'rock throw' || moveKey === 'rock tomb')) {
      scene.time.delayedCall(cinematic3DImpactDelay(moveKey === 'rock tomb' ? 675 : 505), impact);
      return;
    }
    if (using3D) {
      scene.time.delayedCall(cinematic3DImpactDelay(300), impact);
      return;
    }
    if (moveKey === 'rock throw') {
      playRockThrow2D(scene, attacker, target, impact);
      return;
    }
    if (moveKey === 'rock tomb') {
      playRockTomb2D(scene, target, impact);
      return;
    }
    scene.tweens.add({
      targets: attacker,
      x: ax + (tx - ax) * 0.3,
      y: ay + (ty - ay) * 0.3,
      duration: BATTLE_PACING.physicalLungeMs, yoyo: true, ease: 'Quad.easeInOut',
      onYoyo: impact,
      onComplete: () => attacker.setPosition(ax, ay),
    });
  } else {
    if (using3D) {
      // Keep damage timing identical while the richer effect is drawn by the
      // 3D mirror. Drawing the generic 2D orb here would cover that effect.
      const delay = CINEMATIC_3D_IMPACT_DELAY[moveKey] ?? 340;
      scene.time.delayedCall(cinematic3DImpactDelay(delay), impact);
      return;
    }
    if (moveKey === 'thunderbolt') {
      playThunderbolt2D(scene, attacker, target, impact);
      return;
    }
    const orb  = scene.add.circle(ax, ay, 11, color, 0.95).setDepth(9);
    const glow = scene.add.circle(ax, ay, 20, color, 0.30).setDepth(9);
    scene.tweens.add({
      targets: [orb, glow], x: tx, y: ty,
      duration: BATTLE_PACING.specialProjectileMs, ease: 'Sine.easeInOut',
      onComplete: () => { orb.destroy(); glow.destroy(); impact(); },
    });
  }
}

/** Large, readable 2D fallback for Rock Throw. The 3D renderer owns the normal
 * production path, but F3/debug mode and GLB-less devices must retain the same
 * move identity instead of falling back to a generic body lunge. */
function playRockThrow2D(
  scene: Phaser.Scene,
  attacker: Phaser.GameObjects.Image,
  target: Phaser.GameObjects.Image,
  impact: () => void,
): void {
  const dir = attacker.x < target.x ? -1 : 1;
  const points = [-42,-12, -23,-38, 12,-46, 39,-21, 46,13, 20,41, -17,45, -45,19];
  const shadow = scene.add.ellipse(target.x, target.y + 24, 104, 28, 0x17120d, 0.38)
    .setDepth(8).setScale(0.35);
  const rock = scene.add.polygon(target.x + dir * 105, target.y - 230, points, 0x6f5943, 1)
    .setStrokeStyle(5, 0xb99a70, 0.9).setDepth(13).setScale(0.45).setAngle(-25 * dir);
  scene.tweens.add({ targets: shadow, scaleX: 1, scaleY: 1, alpha: 0.62, duration: 500, ease: 'Quad.easeIn' });
  scene.tweens.add({
    targets: rock,
    x: target.x, y: target.y - 8, scaleX: 1.18, scaleY: 1.18,
    angle: 145 * dir, duration: 530, ease: 'Quad.easeIn',
    onComplete: () => {
      impact();
      for (let i = 0; i < 9; i++) {
        const chip = scene.add.polygon(target.x, target.y - 4,
          [-7,-3, 0,-8, 8,-2, 4,7, -5,6], i % 2 ? 0x8a6d4d : 0xc09a68, 0.95)
          .setDepth(14).setAngle(i * 39);
        const a = i / 9 * Math.PI * 2;
        scene.tweens.add({
          targets: chip,
          x: target.x + Math.cos(a) * (48 + (i % 3) * 17),
          y: target.y + Math.sin(a) * (30 + (i % 2) * 18),
          angle: chip.angle + 140, alpha: 0, duration: 360,
          onComplete: () => chip.destroy(),
        });
      }
      scene.tweens.add({
        targets: [rock, shadow], alpha: 0, duration: 260, delay: 80,
        onComplete: () => { rock.destroy(); shadow.destroy(); },
      });
    },
  });
}

/** Rock Tomb surrounds and partially buries the target, then stamps the red X
 * seal requested by the move's visual language. */
function playRockTomb2D(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Image,
  impact: () => void,
): void {
  const rocks: Phaser.GameObjects.Polygon[] = [];
  const basePoints = [-25,-8, -13,-27, 12,-30, 29,-12, 24,17, 4,28, -22,20];
  for (let i = 0; i < 11; i++) {
    const front = i >= 6;
    const angle = i / 11 * Math.PI * 2;
    const radius = 26 + (i % 4) * 13;
    const scale = front ? 1.05 + (i % 3) * 0.14 : 0.78 + (i % 3) * 0.12;
    const landX = target.x + Math.cos(angle) * radius;
    const landY = target.y + (front ? 24 : -2) + Math.sin(angle) * 18;
    const rock = scene.add.polygon(landX + (i % 2 ? -35 : 35), landY - 210 - (i % 3) * 34,
      basePoints, i % 3 ? 0x68513d : 0x8a6747, 1)
      .setStrokeStyle(3, 0xb39468, 0.82).setDepth(front ? 14 : 9)
      .setScale(scale * 0.52).setAngle(i * 47);
    rocks.push(rock);
    scene.tweens.add({
      targets: rock, x: landX, y: landY, scaleX: scale, scaleY: scale,
      angle: rock.angle + (i % 2 ? 130 : -145), delay: i * 32,
      duration: 380 + (i % 3) * 35, ease: 'Quad.easeIn',
    });
  }

  const seal = scene.add.text(target.x, target.y - 34, '✕', {
    fontFamily: 'Arial Black, sans-serif', fontSize: '96px', color: '#ff3b2f',
    stroke: '#fff1bb', strokeThickness: 8,
  }).setOrigin(0.5).setDepth(18).setAlpha(0).setScale(0.25);
  scene.time.delayedCall(565, () => {
    impact();
    scene.tweens.add({
      targets: seal, alpha: 1, scaleX: 1, scaleY: 1, duration: 170, ease: 'Back.easeOut',
      onComplete: () => scene.tweens.add({
        targets: seal, alpha: 0, scaleX: 1.2, scaleY: 1.2, delay: 210, duration: 190,
        onComplete: () => seal.destroy(),
      }),
    });
    scene.tweens.add({
      targets: rocks, alpha: 0, y: '+=18', delay: 360, duration: 300,
      onComplete: () => rocks.forEach(rock => rock.destroy()),
    });
  });
}

/** Oversized Thunderbolt fallback: three jagged high-voltage channels bridge
 * attacker and target while a wide electric cage wraps the target. */
function playThunderbolt2D(
  scene: Phaser.Scene,
  attacker: Phaser.GameObjects.Image,
  target: Phaser.GameObjects.Image,
  impact: () => void,
): void {
  const graphics = scene.add.graphics().setDepth(17).setBlendMode(Phaser.BlendModes.ADD);
  const glow = scene.add.circle(target.x, target.y, 54, 0xffe52e, 0.2)
    .setDepth(16).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3);
  const draw = () => {
    graphics.clear();
    for (let lane = -1; lane <= 1; lane++) {
      graphics.lineStyle(lane === 0 ? 10 : 5, lane === 0 ? 0xffffd0 : 0xffd400, lane === 0 ? 0.96 : 0.72);
      graphics.beginPath();
      graphics.moveTo(attacker.x, attacker.y - 18 + lane * 8);
      for (let i = 1; i < 9; i++) {
        const k = i / 9;
        const x = Phaser.Math.Linear(attacker.x, target.x, k) + (Math.random() - 0.5) * (42 + Math.abs(lane) * 18);
        const y = Phaser.Math.Linear(attacker.y - 18, target.y, k) + (Math.random() - 0.5) * 34 + lane * 12;
        graphics.lineTo(x, y);
      }
      graphics.lineTo(target.x, target.y);
      graphics.strokePath();
    }
    graphics.lineStyle(5, 0xffff7a, 0.82);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      graphics.beginPath();
      graphics.moveTo(target.x + Math.cos(a) * 18, target.y + Math.sin(a) * 16);
      graphics.lineTo(target.x + Math.cos(a + 0.18) * 58, target.y + Math.sin(a + 0.18) * 72);
      graphics.lineTo(target.x + Math.cos(a) * 84, target.y + Math.sin(a) * 96);
      graphics.strokePath();
    }
  };
  draw();
  scene.tweens.add({ targets: glow, scaleX: 1.55, scaleY: 1.55, alpha: 0.55, duration: 360, ease: 'Sine.easeOut' });
  let flashes = 0;
  const flicker = scene.time.addEvent({
    delay: 52, repeat: 7,
    callback: () => {
      flashes++;
      if (flashes % 2) draw();
      graphics.setAlpha(flashes % 2 ? 1 : 0.42);
    },
  });
  scene.time.delayedCall(410, impact);
  scene.time.delayedCall(610, () => {
    flicker.destroy();
    scene.tweens.add({
      targets: [graphics, glow], alpha: 0, duration: 160,
      onComplete: () => { graphics.destroy(); glow.destroy(); },
    });
  });
}

function projectedPoint(scene: Phaser.Scene, target: Phaser.GameObjects.Image, heightRatio = 0.55) {
  const p = { target, x: target.x, y: target.y, heightRatio };
  scene.events.emit('pk3d-screen-target', p);
  return p;
}

/** Healing and rank-change animation shared by every battle scene. */
export function playStatusFX(
  scene: Phaser.Scene,
  affected: Phaser.GameObjects.Image,
  move: MoveData,
  kind: 'heal' | 'stat-up' | 'stat-down' | 'guard',
  onComplete: () => void,
): void {
  const color = kind === 'heal' ? 0x61e883
    : kind === 'stat-up' ? 0xffd95a
      : kind === 'stat-down' ? 0x9b75d6 : 0x86d9ff;
  const p = projectedPoint(scene, affected);
  // Reuse the 3D status aura around the affected combatant.
  scene.events.emit('pk3d-movefx', {
    attacker: affected, target: affected, color, category: 'status',
    moveType: move.type, moveName: move.name, power: 0, effectiveness: 1,
  });
  // Status moves never pass through playMoveFX, so without this hook moves such
  // as Sunny Day, Swords Dance and Thunder Wave were the last silent part of the
  // battle move set. Damaging moves with a secondary status have already played
  // their cast/impact voice and must not add a third copy here.
  if (move.category === 'status') playMoveSfx(scene, move.type, 'cast');
  const symbol = kind === 'heal' ? '+' : kind === 'stat-down' ? '▼' : kind === 'guard' ? '◆' : '▲';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const glyph = scene.add.text(p.x + Math.cos(a) * 24, p.y + 18, symbol, {
      fontSize: kind === 'heal' ? '20px' : '16px', color: `#${color.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold', stroke: '#102018', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(30).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: glyph,
      x: p.x + Math.cos(a) * (36 + (i % 3) * 8),
      y: p.y - 55 - (i % 3) * 14,
      alpha: 0,
      duration: 515 + (i % 3) * 80,
      onComplete: () => glyph.destroy(),
    });
  }
  affected.setTint(color);
  scene.time.delayedCall(180, () => affected.clearTint());
  scene.time.delayedCall(670, onComplete);
}

/** Energy travelling back from the damaged target to the draining user. */
export function playDrainFX(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Image,
  user: Phaser.GameObjects.Image,
  move: MoveData,
  onComplete: () => void,
): void {
  const from = projectedPoint(scene, target);
  const to = projectedPoint(scene, user);
  const color = move.type === 'fairy' ? 0xff9edb : 0x72e879;
  for (let i = 0; i < 8; i++) {
    const mote = scene.add.circle(from.x, from.y, 4 + (i % 2), color, 0.9)
      .setDepth(30).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4);
    scene.tweens.add({
      targets: mote,
      x: to.x, y: to.y,
      scale: 1.15,
      alpha: 0.15,
      delay: i * 43,
      duration: 370,
      ease: 'Sine.easeInOut',
      onComplete: () => mote.destroy(),
    });
  }
  scene.time.delayedCall(770, onComplete);
}

/** First/second phase of Fly, Dig and other charge moves. */
export function playChargeFX(
  scene: Phaser.Scene,
  user: Phaser.GameObjects.Image,
  move: MoveData,
  phase: 'charge' | 'release',
  mode: 'air' | 'underground' | 'charge',
  onComplete: () => void,
): void {
  const engine3D = (window as unknown as { __pk3d?: { isRendering(scene: Phaser.Scene): boolean } }).__pk3d;
  const using3D = !!engine3D?.isRendering(scene);
  // Give the first turn of Fly, Dig, Solar Beam, etc. an audible wind-up. The
  // release turn subsequently enters playMoveFX and supplies its own impact.
  if (phase === 'charge') playMoveSfx(scene, move.type, 'cast');
  scene.events.emit('pk3d-chargefx', { target: user, phase, mode, moveName: move.name });
  if (using3D) {
    scene.time.delayedCall(phase === 'charge' ? 540 : 370, onComplete);
    return;
  }
  const stored = Number(user.getData('battleChargeOriginY'));
  const originY = Number.isFinite(stored) ? stored : user.y;
  if (!Number.isFinite(stored)) user.setData('battleChargeOriginY', originY);
  const targetY = mode === 'air' ? originY - 150 : mode === 'underground' ? originY + 75 : originY - 45;
  scene.tweens.add({
    targets: user,
    y: phase === 'charge' ? targetY : originY,
    alpha: phase === 'charge' ? 0.18 : 1,
    duration: phase === 'charge' ? 485 : 315,
    ease: phase === 'charge' ? 'Sine.easeOut' : 'Sine.easeIn',
    onComplete,
  });
}

function flashTarget(scene: Phaser.Scene, target: Phaser.GameObjects.Image, color: number, particles = true): void {
  target.setTint(color);
  scene.time.delayedCall(120, () => target.clearTint());
  const ox = target.x;
  scene.tweens.add({
    targets: target, x: ox - 8, duration: 46, yoyo: true, repeat: 3,
    onComplete: () => target.setX(ox),
  });
  if (!particles) return;
  for (let i = 0; i < 12; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 34;
    const p = scene.add.circle(ox, target.y, Math.random() < 0.35 ? 4 : 2, color, 0.9).setDepth(11);
    scene.tweens.add({
      targets: p,
      x: ox + Math.cos(ang) * dist,
      y: target.y + Math.sin(ang) * dist,
      alpha: 0, duration: 330 + Math.random() * 185,
      onComplete: () => p.destroy(),
    });
  }
}

/**
 * Synthesised hit sound (no audio asset needed). A filtered noise "thud" when a
 * damaging move lands, plus a bright rising two-tone "sting" when it's super
 * effective. Uses Phaser's already-unlocked WebAudio context.
 */
export function playHitSfx(scene: Phaser.Scene, effectiveness: number): void {
  if (effectiveness === 0) return;                       // "no effect" → no hit sound
  if (scene.game.registry.get('bgmMuted')) return;
  const mgr = scene.sound as Phaser.Sound.WebAudioSoundManager;
  const ac = mgr && mgr.context;
  if (!ac) return;                                       // non-WebAudio (e.g. HTML5) — skip
  const superEff = effectiveness > 1;

  // The WebAudio context auto-suspends after silent gaps (mobile power-saving,
  // long battles). resume() is async, so scheduling on a still-suspended context
  // silently drops that hit — the classic "some hits have no sound" symptom.
  // Wait for the resume to land, THEN synthesise, so no impact is ever lost.
  if (ac.state === 'suspended') {
    ac.resume().then(() => synthHit(ac, superEff)).catch(() => { /* gesture-locked */ });
  } else {
    synthHit(ac, superEff);
  }
}

function synthHit(ac: AudioContext, superEff: boolean): void {
  // Small lookahead so nodes never start "in the past": under the heavy 3D
  // battle scenes a frame hitch can leave ac.currentTime behind the audio clock,
  // and a past start time glitches to silence on some browsers.
  const now = ac.currentTime + 0.02;

  // Impact "thud" — a short decaying noise burst through a low-pass filter.
  const dur = superEff ? 0.16 : 0.11;
  const buf = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * (1 - t) * (1 - t);
  }
  const noise = ac.createBufferSource(); noise.buffer = buf;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.value = superEff ? 3600 : 1400;
  const g = ac.createGain(); g.gain.value = superEff ? 0.32 : 0.26;
  noise.connect(lp); lp.connect(g); g.connect(ac.destination);
  noise.start(now); noise.stop(now + dur);

  // Super effective → a bright rising two-note sting on top.
  if (superEff) {
    [880, 1320].forEach((freq, k) => {
      const t0 = now + k * 0.05;
      const osc = ac.createOscillator(); osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t0);
      const og = ac.createGain();
      og.gain.setValueAtTime(0.0001, t0);
      og.gain.exponentialRampToValueAtTime(0.16, t0 + 0.012);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      osc.connect(og); og.connect(ac.destination);
      osc.start(t0); osc.stop(t0 + 0.16);
    });
  }
}
