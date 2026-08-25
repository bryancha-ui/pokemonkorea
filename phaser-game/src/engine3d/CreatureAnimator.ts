import * as THREE from 'three';

// ── Creature battle animator ─────────────────────────────────────────────────
// Gives every 3D battler real motion, whether or not its model ships with
// animation clips:
//
//   • Rigged GLBs — any clips inside the model are played through an
//     AnimationMixer, matched by name (idle / attack / hit / faint).
//   • Static GLBs (image-to-3D output) and extruded art — a procedural rig
//     animates the whole model: idle breathing and sway, a crouch-and-lunge
//     for physical moves, a rear-back-and-cast for special moves, a status
//     shimmy, recoil on being hit, and a topple on fainting.
//
// The motion is chosen from the move data the battle already fetches from
// PokeAPI (category + type), so attacks read differently without any change
// to battle logic.

export type AnimState = 'idle' | 'attack' | 'hit' | 'faint';
export type MoveCategory = 'physical' | 'special' | 'status';

interface Clips {
  mixer: THREE.AnimationMixer;
  byState: Partial<Record<AnimState, THREE.AnimationAction>>;
  current?: THREE.AnimationAction;
}

const NAME_HINTS: Record<AnimState, RegExp> = {
  idle:  /idle|breath|stand|rest|loop/i,
  attack:/attack|punch|kick|hit_?a|strike|cast|shoot|jump/i,
  hit:   /hit|damage|hurt|impact|flinch/i,
  faint: /death|die|faint|down|defeat/i,
};

export class CreatureAnimator {
  /** The node this animator moves (position/rotation/scale are its own). */
  private root: THREE.Object3D;
  private clips: Clips | null = null;
  private state: AnimState = 'idle';
  private t = 0;
  private phase = Math.random() * Math.PI * 2;

  // procedural action state
  private action: { kind: MoveCategory | 'combo' | 'flight' | 'hit' | 'faint'; t: number; dur: number; dir: THREE.Vector3; power: number } | null = null;
  private baseY = 0;
  private facing = 0;
  private onImpact: (() => void) | null = null;
  private impactAt = 0;
  private impactFired = false;

  constructor(root: THREE.Object3D, animations?: THREE.AnimationClip[]) {
    this.root = root;
    this.facing = root.rotation.y;
    if (animations && animations.length) {
      const mixer = new THREE.AnimationMixer(root);
      const byState: Clips['byState'] = {};
      for (const st of ['idle', 'attack', 'hit', 'faint'] as AnimState[]) {
        const clip = animations.find(c => NAME_HINTS[st].test(c.name));
        if (clip) byState[st] = mixer.clipAction(clip);
      }
      // A model shipping exactly one non-idle clip is showing its signature move,
      // not a damage reaction. Pikachu's only clip is "Impactrueno", which the hit
      // pattern claimed because the word contains "impact" — so its thunder
      // animation fired when it got hurt and never when it attacked, and its
      // resting pose stayed the mid-leap bind pose.
      if (!byState.idle && !byState.attack && byState.hit && animations.length === 1) {
        byState.attack = byState.hit;
        delete byState.hit;
      }
      // Do not guess that an unknown first clip is idle. Many sourced GLBs name
      // a single attack/effect clip in another language; looping it made the
      // follower convulse and could reintroduce the old accordion distortion.
      // Procedural motion remains available when no semantic clip is found.
      if (Object.keys(byState).length) {
        this.clips = { mixer, byState };
        this.play('idle');
      }
    }
  }

  get hasClips(): boolean { return !!this.clips; }

  private play(state: AnimState, once = false): void {
    const c = this.clips;
    if (!c) return;
    const next = c.byState[state] ?? c.byState.idle;
    if (!next) {
      // Nothing to play for this state, and no idle to fall back on. Returning
      // here used to leave the PREVIOUS action running — and one-shot actions are
      // clamped on their final frame, so the creature froze in the end pose of
      // its last move. Pikachu ships a single clip (its thunder attack) and no
      // idle, so after every move it stayed at the top of that leap and read as
      // hovering above the ground. Release the held pose instead.
      if (c.current) {
        c.current.fadeOut(0.18);
        c.current = undefined;
      }
      return;
    }
    if (c.current && c.current !== next) c.current.fadeOut(0.15);
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.fadeIn(0.12).play();
    c.current = next;
  }

  /**
   * Perform an attack. `dir` points from this creature toward its target
   * (world space, y ignored). `onImpact` fires at the contact moment.
   */
  attack(category: MoveCategory, dir: THREE.Vector3, power = 1, onImpact?: () => void): void {
    const d = dir.clone().setY(0);
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    d.normalize();
    const dur = category === 'physical' ? 0.62 : category === 'special' ? 0.75 : 0.55;
    this.action = { kind: category, t: 0, dur, dir: d, power: Math.max(0.5, Math.min(1.6, power)) };
    this.onImpact = onImpact ?? null;
    this.impactFired = false;
    // Contact lands mid-lunge for physical moves, at the cast release otherwise.
    this.impactAt = category === 'physical' ? 0.45 : 0.4;
    this.state = 'attack';
    this.play('attack', true);
  }

  /** Close Combat-style rapid rush. The model stays forward for four visible
   *  strike beats, weaving around the attack line before snapping home. */
  comboAttack(dir: THREE.Vector3, power = 1): void {
    const d = dir.clone().setY(0);
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    d.normalize();
    this.action = { kind: 'combo', t: 0, dur: 0.92, dir: d, power: Math.max(0.5, Math.min(1.6, power)) };
    this.onImpact = null;
    this.impactFired = false;
    this.state = 'attack';
    this.play('attack', true);
  }

  /** Fly-style aerial strike. BattleMirror moves the arena holder through the
   *  ascent/dive/return path; this animator supplies the matching body pose for
   *  both rigged and static GLBs so the model does not remain upright in midair. */
  flightAttack(dir: THREE.Vector3, power = 1): void {
    const d = dir.clone().setY(0);
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    d.normalize();
    this.action = { kind: 'flight', t: 0, dur: 1.1, dir: d, power: Math.max(0.5, Math.min(1.6, power)) };
    this.onImpact = null;
    this.impactFired = false;
    this.state = 'attack';
    this.play('attack', true);
  }

  /** React to taking a hit. */
  hit(power = 1): void {
    this.action = { kind: 'hit', t: 0, dur: 0.42, dir: new THREE.Vector3(0, 0, 1), power };
    this.state = 'hit';
    this.play('hit', true);
  }

  faint(): void {
    this.action = { kind: 'faint', t: 0, dur: 1.0, dir: new THREE.Vector3(0, 0, 1), power: 1 };
    this.state = 'faint';
    this.play('faint', true);
  }

  /** Cancel a held faint/recoil pose when the battle slot is reused. */
  standUp(): void {
    this.action = null;
    this.state = 'idle';
    this.onImpact = null;
    this.impactFired = false;
    this.root.position.set(0, this.baseY, 0);
    this.root.rotation.set(0, this.facing, 0);
    this.play('idle');
  }

  /** Base position the creature returns to (its arena anchor). */
  setBase(y: number): void { this.baseY = y; }

  update(dt: number, scale: number): void {
    // A malformed model bound must never propagate NaN/Infinity into the scene
    // graph: Three.js then culls the Pokémon even though the battle is healthy.
    scale = Number.isFinite(scale) ? Math.max(0.001, Math.min(100, scale)) : 1;
    this.t += dt;
    this.clips?.mixer.update(dt);

    // Rigged models animate themselves; still add a gentle idle sway so they
    // never look frozen between clips.
    const idleBob = Math.sin(this.t * 2.2 + this.phase) * 0.02;
    const idleSway = Math.sin(this.t * 1.1 + this.phase) * 0.03;

    let offX = 0, offZ = 0, offY = 0;
    let pitch = 0, roll = 0, yaw = 0;
    let sx = 1, sy = 1, sz = 1;

    const a = this.action;
    if (a) {
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);

      if (a.kind === 'physical') {
        // crouch (0–0.25) → burst forward (0.25–0.55) → settle back
        const wind = k < 0.25 ? k / 0.25 : 0;
        const surge = k >= 0.25 && k < 0.62 ? (k - 0.25) / 0.37 : k >= 0.62 ? 1 - (k - 0.62) / 0.38 : 0;
        const lunge = Math.sin(Math.min(1, surge) * Math.PI) * 1.25 * a.power;
        offX = a.dir.x * lunge;
        offZ = a.dir.z * lunge;
        offY = Math.sin(Math.min(1, surge) * Math.PI) * 0.35 * a.power;
        sy = 1 - wind * 0.16 + surge * 0.1;
        sx = sz = 1 + wind * 0.12 - surge * 0.05;
        pitch = -surge * 0.35;
      } else if (a.kind === 'combo') {
        // Fast entry → four alternating body blows → fast retreat. Root motion
        // works for both rigged and static GLBs, so every species can sell the
        // same Close Combat rhythm even without a bespoke attack clip.
        const enter = k < 0.16 ? Math.sin((k / 0.16) * Math.PI * 0.5) : 1;
        const retreat = k > 0.82 ? Math.cos(((k - 0.82) / 0.18) * Math.PI * 0.5) : 1;
        const forward = Math.max(0, enter * retreat);
        const sideX = -a.dir.z, sideZ = a.dir.x;
        const weave = Math.sin(k * Math.PI * 8) * 0.24 * forward * a.power;
        const strike = Math.abs(Math.sin(k * Math.PI * 4));
        const lunge = (1.18 + strike * 0.24) * forward * a.power;
        offX = a.dir.x * lunge + sideX * weave;
        offZ = a.dir.z * lunge + sideZ * weave;
        offY = strike * 0.2 * forward * a.power;
        pitch = -0.22 * forward - strike * 0.12;
        yaw = Math.sin(k * Math.PI * 8) * 0.24 * forward;
        roll = -Math.sin(k * Math.PI * 8) * 0.11 * forward;
        sx = sz = 1 + strike * 0.06;
        sy = 1 - strike * 0.05;
      } else if (a.kind === 'flight') {
        // Hovering wind-up → nose-down dive → recoil → level landing. World
        // translation is applied by BattleMirror so this pose also lines up
        // with screen-space fallback sprites and the wind trail.
        const gather = Math.min(1, k / 0.16);
        const dive = Math.max(0, Math.min(1, (k - 0.16) / 0.42));
        const recoil = Math.max(0, Math.min(1, (k - 0.58) / 0.14));
        const recover = Math.max(0, Math.min(1, (k - 0.72) / 0.28));
        const divePose = Math.sin(dive * Math.PI * 0.5) * (1 - recoil);
        pitch = gather * 0.12 - divePose * 0.76 + recover * 0.64;
        roll = Math.sin(k * Math.PI * 5) * (0.1 + divePose * 0.13) * (1 - recover);
        yaw = Math.sin(k * Math.PI * 3) * 0.09 * (1 - recover);
        offY = Math.sin(gather * Math.PI) * 0.12 + Math.sin(recoil * Math.PI) * 0.16;
        sx = sz = 1 + divePose * 0.08 - Math.sin(recoil * Math.PI) * 0.05;
        sy = 1 - divePose * 0.08 + Math.sin(recoil * Math.PI) * 0.1;
      } else if (a.kind === 'special') {
        // rear back, charge (glow handled by MoveFX3D), release forward
        const charge = k < 0.42 ? k / 0.42 : 1;
        const release = k >= 0.42 ? (k - 0.42) / 0.58 : 0;
        const back = Math.sin(charge * Math.PI * 0.5) * 0.42 * a.power;
        const push = Math.sin(Math.min(1, release) * Math.PI) * 0.55 * a.power;
        offX = a.dir.x * (push - back);
        offZ = a.dir.z * (push - back);
        offY = Math.sin(charge * Math.PI) * 0.18;
        sy = 1 + charge * 0.12 - release * 0.08;
        sx = sz = 1 - charge * 0.06 + release * 0.05;
        pitch = charge * 0.18 - release * 0.3;
        yaw = Math.sin(k * Math.PI * 2) * 0.12;
      } else if (a.kind === 'status') {
        // a quick shimmy + hop: buffs/debuffs read as a flourish, not a strike
        offY = Math.abs(Math.sin(k * Math.PI * 2)) * 0.3;
        yaw = Math.sin(k * Math.PI * 4) * 0.35;
        sy = 1 + Math.sin(k * Math.PI * 2) * 0.1;
      } else if (a.kind === 'hit') {
        const shake = Math.sin(k * Math.PI * 6) * (1 - k);
        offX = -a.dir.x * 0.35 * (1 - k) + shake * 0.12;
        offZ = -a.dir.z * 0.35 * (1 - k);
        sy = 1 - (1 - k) * 0.14;
        sx = sz = 1 + (1 - k) * 0.1;
        roll = shake * 0.18;
      } else if (a.kind === 'faint') {
        const fall = k;
        roll = fall * Math.PI * 0.45;
        // Topple in place — never translate downward, or the creature sinks
        // through the arena floor instead of keeling over on top of it.
        offY = 0;
        sy = 1 - fall * 0.25;
      }

      if (!this.impactFired && this.onImpact && k >= this.impactAt) {
        this.impactFired = true;
        this.onImpact();
        this.onImpact = null;
      }
      if (k >= 1) {
        if (a.kind !== 'faint') { this.action = null; this.state = 'idle'; this.play('idle'); }
        else { a.t = a.dur; }        // hold the fainted pose
      }
    }

    // Clamp to the ground plane: idle bob, lunges, recoil and topples may push
    // the body around, but a 3D creature must never drop below its feet anchor
    // (baseY) and sink under the field.
    const groundedY = Math.max(this.baseY, this.baseY + offY + (this.action ? 0 : idleBob));
    this.root.position.set(offX, groundedY, offZ);
    this.root.rotation.set(pitch, this.facing + yaw + (this.action ? 0 : idleSway), roll);
    const breathe = this.action ? 1 : 1 + Math.sin(this.t * 2.4 + this.phase) * 0.015;
    this.root.scale.set(scale * sx, scale * sy * breathe, scale * sz);
  }

  /** Face a direction (world space, y ignored). */
  setFacing(yaw: number): void { this.facing = yaw; }
  get busy(): boolean { return !!this.action; }
  get isFainted(): boolean { return this.state === 'faint'; }
}
