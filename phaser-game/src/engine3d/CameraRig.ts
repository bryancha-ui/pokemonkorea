import * as THREE from 'three';

// ── Camera rigs ──────────────────────────────────────────────────────────────
// Third-person follow camera for the overworld (behind/above the player,
// smooth-damped, modern-3D-RPG style), a tighter preset for interiors, and a
// cinematic battle rig with idle drift + punch-in focus on whichever creature
// is attacking.

export type RigMode = 'overworld' | 'interior' | 'battle';

const PRESET = {
  // Elevated, lightly telephoto framing matches the miniature-diorama camera
  // language of Omega Ruby: readable routes and roofs, little perspective
  // distortion, and no first/third-person voxel-world feeling.
  overworld: { back: 5.8, up: 8.25, lookAhead: 1.15, lookUp: 0.45, fov: 43, damp: 4.8 },
  interior:  { back: 5.15, up: 6.25, lookAhead: 0.7, lookUp: 0.45, fov: 42, damp: 5.5 },
} as const;

export class CameraRig {
  private cam: THREE.PerspectiveCamera;
  private mode: RigMode = 'overworld';
  private pos = new THREE.Vector3(0, 8, 8);
  private look = new THREE.Vector3(0, 0, 0);
  private hasSnapped = false;

  // Battle rig state
  // Slightly telephoto and closer than the exploration camera: more of the
  // model's surface detail survives while both combatants stay in frame.
  private battleBase = new THREE.Vector3(-2.35, 2.5, 5.65);
  private battleLook = new THREE.Vector3(0.28, 1.08, -0.58);
  private focus = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private desiredLook = new THREE.Vector3();
  private battleFrame = new THREE.Vector3();
  private battleLookFrame = new THREE.Vector3();
  private toward = new THREE.Vector3();
  private focusAmt = 0;                // 0..1 punch-in toward focus point
  private shake = 0;
  private t = 0;

  // World clamping (keeps the camera from staring into the void at map edges).
  private boundsMin = new THREE.Vector3(-Infinity, 0, -Infinity);
  private boundsMax = new THREE.Vector3(Infinity, 0, Infinity);

  constructor(cam: THREE.PerspectiveCamera) {
    this.cam = cam;
  }

  setMode(mode: RigMode): void {
    if (this.mode !== mode) { this.mode = mode; this.hasSnapped = false; }
  }

  setWorldBounds(minX: number, minZ: number, maxX: number, maxZ: number): void {
    this.boundsMin.set(minX, 0, minZ);
    this.boundsMax.set(maxX, 0, maxZ);
  }

  /** Punch the battle camera toward a world point (attack moments). */
  focusOn(p: THREE.Vector3, strength = 1): void {
    this.focus.copy(p);
    this.focusAmt = Math.min(1, Math.max(this.focusAmt, strength));
  }

  addShake(amount: number): void {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  /** Follow a target (player) in overworld/interior modes. */
  update(dt: number, target: THREE.Vector3 | null): void {
    this.t += dt;
    if (this.mode === 'battle') { this.updateBattle(dt); return; }
    if (!target) return;
    const p = PRESET[this.mode];

    const desired = this.desired.set(target.x, target.y + p.up, target.z + p.back);
    // Gentle horizontal clamp so edges of small maps still frame nicely.
    const cx = Math.min(Math.max(desired.x, this.boundsMin.x + 4), Math.max(this.boundsMin.x + 4, this.boundsMax.x - 4));
    desired.x = isFinite(cx) ? cx : desired.x;

    const desiredLook = this.desiredLook.set(target.x, target.y + p.lookUp, target.z - p.lookAhead);

    if (!this.hasSnapped) {
      this.pos.copy(desired);
      this.look.copy(desiredLook);
      this.hasSnapped = true;
    } else {
      const k = 1 - Math.exp(-p.damp * dt);
      this.pos.lerp(desired, k);
      this.look.lerp(desiredLook, k);
    }

    this.applyShake(dt);
    this.cam.fov += ((p.fov - this.cam.fov) * Math.min(1, dt * 3));
    this.cam.updateProjectionMatrix();
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.look);
  }

  private updateBattle(dt: number): void {
    // Idle drift: slow orbital sway like modern battle cameras.
    const sway = Math.sin(this.t * 0.35) * 0.55;
    const bob = Math.sin(this.t * 0.22) * 0.18;
    const base = this.battleFrame.set(
      this.battleBase.x + sway,
      this.battleBase.y + bob,
      this.battleBase.z - Math.abs(sway) * 0.3,
    );
    const look = this.battleLookFrame.copy(this.battleLook);

    // Punch-in toward the focused creature during attacks, then relax.
    if (this.focusAmt > 0.01) {
      const toward = this.toward.copy(this.focus).sub(base).multiplyScalar(0.22 * this.focusAmt);
      base.add(toward);
      this.desiredLook.set(this.focus.x, this.focus.y + 0.7, this.focus.z);
      look.lerp(this.desiredLook, 0.45 * this.focusAmt);
      this.focusAmt = Math.max(0, this.focusAmt - dt * 1.1);
    }

    if (!this.hasSnapped) { this.pos.copy(base); this.look.copy(look); this.hasSnapped = true; }
    const k = 1 - Math.exp(-3.2 * dt);
    this.pos.lerp(base, k);
    this.look.lerp(look, k);

    this.applyShake(dt);
    const fovTarget = 40 - this.focusAmt * 4.5;
    this.cam.fov += (fovTarget - this.cam.fov) * Math.min(1, dt * 4);
    this.cam.updateProjectionMatrix();
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.look);
  }

  private applyShake(dt: number): void {
    if (this.shake > 0.001) {
      this.pos.x += (Math.random() - 0.5) * 0.12 * this.shake;
      this.pos.y += (Math.random() - 0.5) * 0.09 * this.shake;
      this.shake = Math.max(0, this.shake - dt * 3.2);
    }
  }
}
