import Phaser from 'phaser';
import { MoveData } from '../battle/Pokemon';
import { TYPE_COLORS } from '../data/StarterData';
import { BATTLE_PACING, cinematic3DImpactDelay } from './BattlePacing';
import { playMoveSfx } from './MoveSfx';

const CINEMATIC_3D_IMPACT_DELAY: Readonly<Record<string, number>> = {
  'soul ferry deluge': 515, 'royal kiln roar': 450,
  'ice beam': 365, 'hydro pump': 525, 'shadow ball': 640, 'air slash': 455,
  flamethrower: 290, ember: 290, 'flame burst': 290, 'fire blast': 290,
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
    const moveKey = move.name.toLowerCase().replace(/-/g, ' ').trim();
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
    if (using3D) {
      scene.time.delayedCall(cinematic3DImpactDelay(300), impact);
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
      const moveKey = move.name.toLowerCase().replace(/-/g, ' ').trim();
      const delay = CINEMATIC_3D_IMPACT_DELAY[moveKey] ?? 340;
      scene.time.delayedCall(cinematic3DImpactDelay(delay), impact);
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
