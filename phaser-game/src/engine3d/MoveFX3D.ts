import * as THREE from 'three';

// ── 3D battle move effects ───────────────────────────────────────────────────
// The battle rules still live in Phaser. This module is a purely visual layer
// that turns the emitted move name/type/category into readable, staged 3D
// attacks: beams, lightning, waves, ground eruptions, auras and physical hits.

interface Task {
  group: THREE.Group;
  t: number;
  dur: number;
  update(k: number, dt: number, t: number): void;
  impactAt?: number;
  impact?: () => void;
  impacted?: boolean;
  done?: () => void;
}

interface PersistentStatusFX {
  group: THREE.Group;
  anchor: THREE.Object3D;
  status: string;
  t: number;
  animate(t: number, dt: number): void;
}

let glowTex: THREE.Texture | null = null;
function getGlowTex(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.62)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

const TYPE_ACCENTS: Record<string, number> = {
  fire: 0xffd05a, water: 0xbfefff, grass: 0xb8f06a, electric: 0xffffa8,
  ice: 0xffffff, fighting: 0xffc18a, poison: 0xe7a6ff, ground: 0xe4bd77,
  flying: 0xe8f7ff, psychic: 0xffb4f2, bug: 0xd9ef72, rock: 0xe0c18f,
  ghost: 0xc5a5ff, dragon: 0x9ce8ff, dark: 0x9a7cc7, steel: 0xf2f5f8,
  fairy: 0xffe1f2, normal: 0xffffff,
};

export class MoveFX3D {
  private active: Task[] = [];
  private persistentStatuses = new Map<THREE.Object3D, PersistentStatusFX>();

  constructor(private root: THREE.Group) {}

  /** Keep a major-status effect attached to a live battler until it is cured,
   *  switched out or fainted. The geometry is normalised to a 1.6 m creature. */
  syncPersistentStatus(anchor: THREE.Object3D, status: string | undefined, height: number, visible: boolean): void {
    const normalized = (status ?? 'none').toLowerCase() === 'tox' ? 'psn' : (status ?? 'none').toLowerCase();
    if (!['frz', 'par', 'brn', 'psn', 'slp'].includes(normalized)) {
      this.removePersistentStatus(anchor);
      return;
    }
    let fx = this.persistentStatuses.get(anchor);
    if (!fx || fx.status !== normalized) {
      this.removePersistentStatus(anchor);
      fx = this.buildPersistentStatus(anchor, normalized);
      this.persistentStatuses.set(anchor, fx);
      this.root.add(fx.group);
    }
    fx.group.position.copy(anchor.position);
    fx.group.scale.setScalar(Math.max(0.72, Math.min(1.45, height / 1.6)));
    fx.group.visible = visible;
  }

  removePersistentStatus(anchor: THREE.Object3D): void {
    const fx = this.persistentStatuses.get(anchor);
    if (!fx) return;
    this.root.remove(fx.group);
    disposeGroup(fx.group);
    this.persistentStatuses.delete(anchor);
  }

  clearPersistentStatuses(): void {
    for (const anchor of [...this.persistentStatuses.keys()]) this.removePersistentStatus(anchor);
  }

  private buildPersistentStatus(anchor: THREE.Object3D, status: string): PersistentStatusFX {
    const group = new THREE.Group();
    let animate: (t: number, dt: number) => void;

    if (status === 'frz') {
      // A translucent faceted ice prison encloses the whole silhouette while
      // uneven crystals lock the feet and torso in place.
      const ice = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.72, 1.42, 7, 2, false),
        new THREE.MeshPhysicalMaterial({
          color: 0xa8edff, emissive: 0x184d68, emissiveIntensity: 0.65,
          transparent: true, opacity: 0.2, roughness: 0.08, metalness: 0.05,
          transmission: 0.28, thickness: 0.16, depthWrite: false, side: THREE.DoubleSide,
        }),
      );
      ice.position.y = 0.72;
      group.add(ice);
      const cage: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.58 - i * 0.045, 0.025, 6, 28),
          statusMaterial(i === 1 ? 0xdffaff : 0x52caec, 0.72),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.36 + i * 0.43;
        group.add(ring); cage.push(ring);
      }
      const crystals: THREE.Mesh[] = [];
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        const crystal = new THREE.Mesh(
          new THREE.ConeGeometry(0.11 + (i % 3) * 0.025, 0.5 + (i % 4) * 0.13, 5),
          new THREE.MeshPhysicalMaterial({
            color: i % 3 ? 0x8ee8ff : 0xe8fbff, emissive: 0x164e6b,
            transparent: true, opacity: 0.72, roughness: 0.12, metalness: 0.06,
            transmission: 0.12, depthWrite: false,
          }),
        );
        crystal.position.set(Math.cos(a) * (0.48 + (i % 2) * 0.12), 0.18 + (i % 3) * 0.19, Math.sin(a) * (0.48 + (i % 2) * 0.12));
        crystal.rotation.z = Math.cos(a) * 0.22;
        crystal.rotation.x = Math.sin(a) * 0.22;
        group.add(crystal); crystals.push(crystal);
      }
      animate = (t) => {
        const pulse = 0.92 + Math.sin(t * 4.2) * 0.055;
        ice.scale.set(pulse, 1, pulse);
        cage.forEach((ring, i) => { ring.rotation.z += 0.003 + i * 0.001; opacity(ring, 0.48 + Math.sin(t * 5 + i) * 0.16); });
        crystals.forEach((crystal, i) => opacity(crystal, 0.62 + Math.sin(t * 4.5 + i) * 0.16));
      };
    } else if (status === 'par') {
      // Jagged electric arcs crawl upward across both sides of the body, with
      // smaller sparks popping loose like static discharge.
      const bolts: THREE.Mesh[] = [];
      for (let chain = 0; chain < 5; chain++) {
        const a = chain / 5 * Math.PI * 2;
        for (let part = 0; part < 4; part++) {
          const y0 = 0.14 + part * 0.34;
          const y1 = y0 + 0.29;
          const r0 = 0.5 + ((part + chain) % 2) * 0.13;
          const r1 = 0.5 + ((part + chain + 1) % 2) * 0.13;
          const p0 = new THREE.Vector3(Math.cos(a + part * 0.16) * r0, y0, Math.sin(a + part * 0.16) * r0);
          const p1 = new THREE.Vector3(Math.cos(a - part * 0.13) * r1, y1, Math.sin(a - part * 0.13) * r1);
          const bolt = statusSegmentMesh(p0, p1, part % 2 ? 0.018 : 0.026, part % 2 ? 0xfff5aa : 0xffcf20, 0.92);
          group.add(bolt); bolts.push(bolt);
        }
      }
      const sparks: THREE.Mesh[] = [];
      for (let i = 0; i < 18; i++) {
        const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.035 + (i % 3) * 0.012), statusMaterial(i % 2 ? 0xfff4a3 : 0xffc400, 0.94));
        group.add(spark); sparks.push(spark);
      }
      animate = (t) => {
        bolts.forEach((bolt, i) => opacity(bolt, ((Math.floor(t * 15 + i * 1.7) % 5) < 2 ? 0.92 : 0.16)));
        sparks.forEach((spark, i) => {
          const age = (t * (0.72 + (i % 4) * 0.1) + i / sparks.length) % 1;
          const a = i / sparks.length * Math.PI * 2 + t * 0.8;
          spark.position.set(Math.cos(a) * (0.45 + (i % 3) * 0.09), 0.12 + age * 1.48, Math.sin(a) * (0.45 + (i % 3) * 0.09));
          spark.rotation.set(t * 8 + i, t * 11, i);
          opacity(spark, Math.sin(age * Math.PI) * 0.92);
        });
      };
    } else if (status === 'brn') {
      // Fire continuously licks upward from several points around the body.
      const flames: THREE.Mesh[] = [];
      for (let i = 0; i < 16; i++) {
        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.08 + (i % 4) * 0.025, 0.3 + (i % 5) * 0.07, 6),
          statusMaterial(i % 3 === 0 ? 0xffdc62 : i % 2 ? 0xff7a18 : 0xd92d18, 0.9),
        );
        group.add(flame); flames.push(flame);
      }
      animate = (t) => {
        flames.forEach((flame, i) => {
          const age = (t * (0.62 + (i % 4) * 0.08) + i / flames.length) % 1;
          const a = i / flames.length * Math.PI * 2 + Math.sin(t * 1.7 + i) * 0.15;
          const radius = 0.34 + (i % 4) * 0.085;
          flame.position.set(Math.cos(a) * radius, 0.06 + age * 1.32, Math.sin(a) * radius);
          flame.rotation.z = Math.sin(t * 7 + i) * 0.22;
          flame.scale.set(0.72 + Math.sin(t * 9 + i) * 0.18, 0.72 + age * 0.7, 0.72 + Math.cos(t * 8 + i) * 0.16);
          opacity(flame, Math.sin(age * Math.PI) * 0.92);
        });
      };
    } else if (status === 'psn') {
      // Viscous purple bubbles rise, swell and pop around the poisoned body.
      const bubbles: { mesh: THREE.Mesh; ring: THREE.Mesh }[] = [];
      for (let i = 0; i < 18; i++) {
        const radius = 0.045 + (i % 5) * 0.018;
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), statusMaterial(i % 3 ? 0x7c27b5 : 0xd45bf0, 0.8));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.25, 0.009, 5, 14), statusMaterial(0xb950dd, 0.72));
        group.add(bubble, ring); bubbles.push({ mesh: bubble, ring });
      }
      animate = (t) => {
        bubbles.forEach((bubble, i) => {
          const age = (t * (0.42 + (i % 5) * 0.055) + i / bubbles.length) % 1;
          const a = i / bubbles.length * Math.PI * 2 + t * 0.42;
          const radius = 0.35 + (i % 4) * 0.085;
          const p = new THREE.Vector3(Math.cos(a) * radius, 0.05 + age * 1.52, Math.sin(a) * radius);
          p.x += Math.sin(t * 4 + i) * 0.055;
          bubble.mesh.position.copy(p); bubble.ring.position.copy(p);
          bubble.ring.quaternion.copy(group.quaternion).invert();
          const swell = 0.72 + age * 0.78;
          bubble.mesh.scale.setScalar(swell); bubble.ring.scale.setScalar(swell);
          opacity(bubble.mesh, Math.sin(age * Math.PI) * 0.76);
          opacity(bubble.ring, Math.sin(age * Math.PI) * 0.62);
        });
      };
    } else {
      // Sleep is represented more softly: slow indigo rings and drifting motes.
      const motes: THREE.Mesh[] = [];
      for (let i = 0; i < 10; i++) {
        const mote = new THREE.Mesh(new THREE.SphereGeometry(0.045 + (i % 3) * 0.015, 7, 5), statusMaterial(i % 2 ? 0xa9b7ff : 0x7382d7, 0.72));
        group.add(mote); motes.push(mote);
      }
      animate = (t) => {
        motes.forEach((mote, i) => {
          const age = (t * 0.24 + i / motes.length) % 1;
          const a = i / motes.length * Math.PI * 2 + t * 0.35;
          mote.position.set(Math.cos(a) * 0.48, 0.72 + age * 0.78, Math.sin(a) * 0.48);
          opacity(mote, Math.sin(age * Math.PI) * 0.58);
        });
      };
    }

    return { group, anchor, status, t: 0, animate };
  }

  /** Choose a cinematic special-move family from its type and actual name. */
  playSpecial(
    from: THREE.Vector3,
    to: THREE.Vector3,
    moveType: string,
    moveName: string,
    color: number,
    power: number,
    eff: number,
    onImpact?: () => void,
  ): void {
    const type = moveType.toLowerCase();
    const name = moveName.toLowerCase();
    const strong = Math.max(0.75, Math.min(1.45, 0.72 + power / 145));

    if (name === 'soul-ferry deluge') {
      this.soulFerryDeluge(from, to, color, strong, eff, onImpact);
    } else if (name === 'royal kiln roar') {
      this.royalKilnRoar(from, to, color, strong, eff, onImpact);
    } else if (name === 'ice beam') {
      this.iceBeam(from, to, color, strong, eff, onImpact);
    } else if (name === 'hydro pump') {
      this.hydroPump(from, to, color, strong, eff, onImpact);
    } else if (name === 'shadow ball') {
      this.shadowBall(from, to, color, strong, eff, onImpact);
    } else if (name === 'air slash') {
      this.airSlash(from, to, color, strong, eff, onImpact);
    } else if (/^(flamethrower|ember|flame burst|fire blast)$/.test(name)) {
      this.fireTorrent(from, to, color, strong, eff, onImpact);
    } else if (/^(psychic|psybeam|psyshock|confusion)$/.test(name)) {
      this.ringPulse(from, to, 0xf05cff, 0xffc7ff, strong, eff, onImpact, 0.42);
    } else if (/^(dark pulse|hex|ominous wind)$/.test(name)) {
      this.ringPulse(from, to, 0x522080, 0xc45cff, strong, eff, onImpact, 0.78);
    } else if (/^(bug buzz|hyper voice|supersonic)$/.test(name)) {
      this.ringPulse(from, to, type === 'bug' ? 0x9edb4f : 0xbfeeff, 0xffffff, strong, eff, onImpact, 0.18);
    } else if (/^(energy ball|mega drain|giga drain|absorb|grave bloom)$/.test(name)) {
      this.natureOrb(from, to, color, strong, eff, onImpact);
    } else if (/^(sludge bomb|venoshock)$/.test(name)) {
      this.toxicBomb(from, to, color, strong, eff, onImpact);
    } else if (/^(moonblast|dazzling gleam|fairy wind|draining kiss)$/.test(name)) {
      this.fairyLight(from, to, color, strong, eff, onImpact);
    } else if (name === 'draco meteor') {
      this.dracoMeteor(to, color, strong, eff, onImpact);
    } else if (/^(dragon pulse|dragon breath)$/.test(name)) {
      this.dragonBeam(from, to, color, strong, eff, onImpact);
    } else if (/^(blizzard|powder snow|aurora beam)$/.test(name)) {
      this.iceStorm(from, to, color, strong, eff, onImpact);
    } else if (name === 'thunder') {
      this.thunderStorm(to, color, strong, eff, onImpact);
    } else if (type === 'electric' || /thunder|shock|volt/.test(name)) {
      this.electricArc(from, to, color, strong, eff, onImpact);
    } else if (name === 'surf' || /deluge|tidal|wave/.test(name)) {
      this.waterWave(from, to, color, strong, eff, onImpact);
    } else if (type === 'ground' || (type === 'rock' && /power|slide|tomb|throw/.test(name))) {
      this.groundSurge(from, to, color, strong, eff, onImpact);
    } else if (/beam|flamethrower|hydro pump|pulse|breath|blast|buzz|psychic|gleam|moonblast/.test(name)) {
      this.beam(from, to, type, color, strong, eff, onImpact);
    } else {
      this.typedProjectile(from, to, type, color, strong, eff, onImpact);
    }
  }

  /** Compatibility hook for any older caller; now uses the richer orb family. */
  fireProjectile(from: THREE.Vector3, to: THREE.Vector3, color: number, eff: number, onImpact?: () => void): void {
    this.typedProjectile(from, to, 'normal', color, 1, eff, onImpact);
  }

  /** Non-damaging move: layered rings and motes rise around the user. */
  statusAura(at: THREE.Vector3, moveType: string, moveName: string, color: number): void {
    const group = new THREE.Group();
    group.position.copy(at);
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.38 + i * 0.1, 0.035, 6, 28),
        glowMaterial(i % 2 ? color : (TYPE_ACCENTS[moveType] ?? 0xffffff), 0.82),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.12 + i * 0.22;
      group.add(ring); rings.push(ring);
    }
    const motes: THREE.Mesh[] = [];
    for (let i = 0; i < 12; i++) {
      const mote = new THREE.Mesh(
        /swords dance/i.test(moveName) ? new THREE.OctahedronGeometry(0.07) : new THREE.SphereGeometry(0.055, 7, 5),
        glowMaterial(i % 2 ? color : 0xffffff, 0.9),
      );
      const a = i / 12 * Math.PI * 2;
      mote.position.set(Math.cos(a) * 0.65, 0.25 + (i % 4) * 0.2, Math.sin(a) * 0.65);
      group.add(mote); motes.push(mote);
    }
    this.addTask(group, 0.9, (k) => {
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        ring.position.y = 0.12 + ((k + i * 0.17) % 1) * 1.35;
        ring.scale.setScalar(0.65 + k * 0.65);
        opacity(ring, Math.sin(k * Math.PI) * 0.86);
      }
      for (let i = 0; i < motes.length; i++) {
        const a = i / motes.length * Math.PI * 2 + k * Math.PI * 2.4;
        motes[i].position.x = Math.cos(a) * (0.62 + Math.sin(k * Math.PI) * 0.16);
        motes[i].position.z = Math.sin(a) * (0.62 + Math.sin(k * Math.PI) * 0.16);
        motes[i].position.y += 0.012;
        opacity(motes[i], Math.sin(k * Math.PI));
      }
      group.rotation.y = k * Math.PI * 0.7;
    });
  }

  /** First-turn Fly takeoff: a pressure ring and rising air columns make the
   *  battler's actual ascent readable instead of looking like a teleport. */
  flyTakeoff(at: THREE.Vector3, height: number): void {
    const group = new THREE.Group();
    group.position.copy(at);
    const scale = Math.max(0.78, Math.min(1.45, height / 1.6));
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry((0.34 + i * 0.1) * scale, (0.022 + i * 0.004) * scale, 6, 34),
        glowMaterial(i % 2 ? 0xffffff : 0xbdeeff, 0),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.035 + i * 0.035;
      group.add(ring); rings.push(ring);
    }
    const gusts: THREE.Mesh[] = [];
    for (let i = 0; i < 16; i++) {
      const angle = i / 16 * Math.PI * 2;
      const radius = (0.3 + (i % 4) * 0.11) * scale;
      const start = new THREE.Vector3(Math.cos(angle) * radius, 0.04, Math.sin(angle) * radius);
      const end = new THREE.Vector3(
        Math.cos(angle + 0.34) * radius * 0.72,
        (0.72 + (i % 5) * 0.16) * scale,
        Math.sin(angle + 0.34) * radius * 0.72,
      );
      const gust = segmentMesh(start, end, (0.009 + (i % 3) * 0.005) * scale,
        i % 3 ? 0xdff8ff : 0xffffff, 0);
      group.add(gust); gusts.push(gust);
    }
    this.addTask(group, 0.56, (k) => {
      const rise = Math.sin(Math.min(1, k * 1.25) * Math.PI * 0.5);
      rings.forEach((ring, i) => {
        ring.scale.setScalar(0.45 + k * (1.85 + i * 0.17));
        ring.rotation.z += 0.08 + i * 0.012;
        opacity(ring, (1 - k) * (0.82 - i * 0.1));
      });
      gusts.forEach((gust, i) => {
        gust.position.y = rise * (0.38 + (i % 4) * 0.1) * scale;
        gust.rotation.y += (i % 2 ? 1 : -1) * 0.045;
        opacity(gust, Math.sin(k * Math.PI) * (0.48 + (i % 3) * 0.16));
      });
    });
  }

  /** Brief second-turn hover before the dive. The rotating wind cage mirrors
   *  the reference video's pause and makes the following acceleration legible. */
  flyWindup(at: THREE.Vector3, height: number): void {
    const group = new THREE.Group();
    group.position.copy(at).add(new THREE.Vector3(0, Math.max(0.45, height * 0.42), 0));
    const scale = Math.max(0.8, Math.min(1.45, height / 1.6));
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry((0.38 + i * 0.075) * scale, 0.026 * scale, 6, 36, Math.PI * 1.62),
        glowMaterial(i % 2 ? 0xffffff : 0xb9ecff, 0),
      );
      ring.rotation.x = Math.PI / 2 + (i - 2) * 0.08;
      ring.rotation.z = i * 1.17;
      ring.position.y = (i - 2) * 0.16 * scale;
      group.add(ring); rings.push(ring);
    }
    const motes: THREE.Mesh[] = [];
    for (let i = 0; i < 14; i++) {
      const mote = new THREE.Mesh(
        new THREE.ConeGeometry(0.025 * scale, (0.16 + (i % 4) * 0.05) * scale, 5),
        glowMaterial(i % 3 ? 0xd9f7ff : 0xffffff, 0),
      );
      group.add(mote); motes.push(mote);
    }
    this.addTask(group, 0.42, (k) => {
      const pulse = Math.sin(k * Math.PI);
      rings.forEach((ring, i) => {
        ring.rotation.z += (i % 2 ? -1 : 1) * (0.09 + i * 0.008);
        ring.scale.setScalar(0.76 + pulse * 0.34);
        opacity(ring, pulse * (0.56 + (i % 2) * 0.24));
      });
      motes.forEach((mote, i) => {
        const angle = i / motes.length * Math.PI * 2 + k * Math.PI * 4;
        const radius = (0.48 + (i % 3) * 0.11) * scale * (1 - k * 0.22);
        mote.position.set(Math.cos(angle) * radius, ((i % 5) - 2) * 0.15 * scale,
          Math.sin(angle) * radius);
        mote.rotation.z = angle;
        opacity(mote, pulse * (0.55 + (i % 3) * 0.14));
      });
    });
  }

  /** Fly's release: accelerating speed lines and a helical wind wake converge
   *  on the target, followed by a white aerial slash and ground-level dust. */
  flyDive(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color: number,
    power: number,
    eff: number,
    onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const scale = Math.max(0.86, Math.min(1.5, 0.76 + power / 145));
    const tangent = to.clone().sub(from);
    if (tangent.lengthSq() < 1e-6) tangent.set(1, -0.3, 0);
    tangent.normalize();
    const side = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0));
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const normal = new THREE.Vector3().crossVectors(side, tangent).normalize();

    const spiralPoint = (u: number): THREE.Vector3 => {
      const center = from.clone().lerp(to, u);
      const radius = (0.42 - u * 0.19) * scale;
      const phase = u * Math.PI * 7.2;
      return center
        .addScaledVector(side, Math.cos(phase) * radius)
        .addScaledVector(normal, Math.sin(phase) * radius);
    };

    const spiral: { mesh: THREE.Mesh; u: number }[] = [];
    for (let i = 0; i < 34; i++) {
      const u0 = i / 35, u1 = (i + 1) / 35;
      const mesh = segmentMesh(spiralPoint(u0), spiralPoint(u1),
        (0.012 + (i % 4) * 0.0035) * scale, i % 3 ? 0xd9f7ff : 0xffffff, 0);
      group.add(mesh); spiral.push({ mesh, u: u1 });
    }

    const streaks: { mesh: THREE.Mesh; u: number }[] = [];
    const distance = from.distanceTo(to);
    for (let i = 0; i < 18; i++) {
      const u = 0.08 + (i % 9) * 0.095;
      const center = from.clone().lerp(to, u)
        .addScaledVector(side, ((i % 6) - 2.5) * 0.14 * scale)
        .addScaledVector(normal, ((i * 3) % 7 - 3) * 0.09 * scale);
      const half = (0.16 + (i % 4) * 0.045) * Math.min(1.4, distance / 3.5);
      const mesh = segmentMesh(
        center.clone().addScaledVector(tangent, -half),
        center.clone().addScaledVector(tangent, half * 0.65),
        (0.008 + (i % 3) * 0.004) * scale,
        i % 4 ? 0xeafaff : color,
        0,
      );
      group.add(mesh); streaks.push({ mesh, u });
    }

    const pressureRings: { mesh: THREE.Mesh; delay: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry((0.3 + i * 0.035) * scale, (0.018 + (i % 2) * 0.008) * scale, 6, 34),
        glowMaterial(i % 2 ? 0xffffff : 0xbceeff, 0),
      );
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      group.add(ring); pressureRings.push({ mesh: ring, delay: i * 0.075 });
    }

    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.42 * scale, 1.35 * scale, 18, 1, true),
      glowMaterial(mixWhite(color, 0.72), 0),
    );
    nose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    group.add(nose);

    this.addTask(group, 1.1, (k) => {
      const dive = Math.max(0, Math.min(1, (k - 0.12) / 0.46));
      const travel = dive * dive * (3 - 2 * dive);
      const beforeImpact = Math.max(0, 1 - Math.max(0, k - 0.58) / 0.16);
      const rush = Math.sin(Math.min(1, dive) * Math.PI * 0.5) * beforeImpact;

      nose.position.copy(from).lerp(to, travel).addScaledVector(tangent, -0.34 * scale);
      nose.rotation.y += 0.18;
      nose.scale.set(0.76 + rush * 0.34, 0.72 + rush * 0.45, 0.76 + rush * 0.34);
      opacity(nose, rush * 0.26);

      spiral.forEach(({ mesh, u }, i) => {
        const wake = Math.max(0, 1 - Math.abs(u - travel) / 0.34);
        const revealed = u <= travel + 0.07 ? 1 : 0;
        opacity(mesh, wake * revealed * beforeImpact * (0.52 + (i % 3) * 0.17));
      });
      streaks.forEach(({ mesh, u }, i) => {
        const wave = Math.max(0, 1 - Math.abs(u - travel) / 0.46);
        mesh.scale.y = 0.55 + rush * 1.65;
        opacity(mesh, wave * rush * (0.4 + (i % 4) * 0.13));
      });
      pressureRings.forEach(({ mesh, delay }, i) => {
        const local = Math.max(0, Math.min(1, (travel - delay) / 0.36));
        mesh.position.copy(from).lerp(to, local);
        mesh.scale.setScalar(0.52 + local * (1.1 + i * 0.05));
        mesh.rotation.z += (i % 2 ? -1 : 1) * 0.11;
        opacity(mesh, Math.sin(local * Math.PI) * beforeImpact * (0.5 + (i % 2) * 0.25));
      });
    }, 0.58, () => {
      this.aerialImpact(to, color, scale * 1.12);
      this.flyLandingImpact(to, color, scale);
      this.burst(to, mixWhite(color, 0.35), eff, scale * 1.25);
      onImpact?.();
    });
  }

  /** Physical moves use the model's lunge, then get an attack-specific contact. */
  physicalImpact(at: THREE.Vector3, moveType: string, moveName: string, color: number, power: number, eff: number): void {
    const type = moveType.toLowerCase(), name = moveName.toLowerCase();
    const scale = Math.max(0.75, Math.min(1.55, 0.75 + power / 130));
    if (name === 'outlaw leafstorm') {
      this.outlawLeafstorm(at, color, scale);
    } else if (/^(earthquake|bulldoze)$/.test(name)) {
      this.groundQuake(at, color, scale);
    } else if (/^(brave bird|wing attack|peck|fly)$/.test(name)) {
      this.aerialImpact(at, color, scale);
    } else if (/^(poison jab|poison sting)$/.test(name)) {
      this.toxicJab(at, color, scale);
    } else if (/^(quick attack|tackle|body slam|headbutt|sucker punch|pursuit)$/.test(name)) {
      this.speedImpact(at, color, scale);
    } else if (/slash|claw|blade|wing|cut|edge/.test(name) || type === 'flying') {
      this.slashImpact(at, color, scale);
    } else if (/bite|fang|crunch/.test(name)) {
      this.biteImpact(at, color, scale);
    } else if (type === 'fighting' || /break|combat|punch|slam|headbutt|hammer/.test(name)) {
      this.punchImpact(at, color, scale);
    } else if (type === 'ground' || type === 'rock' || /earthquake|bulldoze|rock/.test(name)) {
      this.rockImpact(at, color, scale);
    } else if (type === 'steel') {
      this.slashImpact(at, 0xe7f1f7, scale * 1.05);
    }
    this.burst(at, color, eff, scale);
  }

  /** Close Combat: four rapid, alternating 3D strikes capped by a heavy finisher.
   *  Each beat owns its own directional trail and pressure ring so the move
   *  reads as a combo instead of one oversized generic impact. */
  closeCombatCombo(
    from: THREE.Vector3,
    to: THREE.Vector3,
    color: number,
    power: number,
    eff: number,
    onStrike?: (index: number) => void,
  ): void {
    const group = new THREE.Group();
    const unit = to.clone().sub(from).setY(0);
    if (unit.lengthSq() < 1e-6) unit.set(1, 0, 0);
    unit.normalize();
    const side = new THREE.Vector3(-unit.z, 0, unit.x);
    const scale = Math.max(0.9, Math.min(1.55, 0.78 + power / 150));
    const beats = [0.2, 0.38, 0.57, 0.78];
    const fired = beats.map(() => false);
    const strikes: {
      center: THREE.Vector3;
      ring: THREE.Mesh;
      halo: THREE.Mesh;
      trails: THREE.Mesh[];
      slashes: THREE.Mesh[];
    }[] = [];

    for (let i = 0; i < beats.length; i++) {
      const center = to.clone()
        .addScaledVector(side, (i % 2 === 0 ? -1 : 1) * (0.18 + (i % 3) * 0.04) * scale)
        .add(new THREE.Vector3(0, (i === 3 ? 0.12 : (i % 2) * 0.16 - 0.06) * scale, 0));
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.17 * scale, 0.31 * scale, 30),
        glowMaterial(i === 3 ? 0xffffff : mixWhite(color, 0.22), 0),
      );
      ring.position.copy(center);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), unit);
      group.add(ring);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry((0.35 + i * 0.025) * scale, 0.04 * scale, 7, 34),
        glowMaterial(i === 3 ? 0xff263f : color, 0),
      );
      halo.position.copy(center);
      halo.quaternion.copy(ring.quaternion);
      group.add(halo);

      const trails: THREE.Mesh[] = [];
      for (let lane = -1; lane <= 1; lane++) {
        const start = center.clone().addScaledVector(unit, -1.15 * scale)
          .addScaledVector(side, lane * 0.11 * scale)
          .add(new THREE.Vector3(0, lane * 0.08, 0));
        const end = center.clone().addScaledVector(unit, 0.18 * scale)
          .addScaledVector(side, lane * 0.035 * scale);
        const trail = segmentMesh(start, end, (lane === 0 ? 0.045 : 0.025) * scale,
          lane === 0 ? 0xffffff : (i % 2 ? 0xff1738 : color), 0);
        group.add(trail); trails.push(trail);
      }

      const slashes: THREE.Mesh[] = [];
      for (let slashIndex = 0; slashIndex < 2; slashIndex++) {
        const slash = new THREE.Mesh(
          new THREE.TorusGeometry((0.42 + slashIndex * 0.11) * scale, 0.035 * scale, 6, 28, Math.PI * 0.92),
          glowMaterial(slashIndex ? 0xff3350 : 0xffe4e8, 0),
        );
        slash.position.copy(center);
        slash.rotation.set(0.3 + i * 0.13, Math.atan2(unit.x, unit.z),
          (i % 2 ? 0.8 : -0.8) + slashIndex * 0.36);
        group.add(slash); slashes.push(slash);
      }
      strikes.push({ center, ring, halo, trails, slashes });
    }

    const speedLines: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const lane = ((i % 5) - 2) * 0.16 * scale;
      const rise = ((i % 3) - 1) * 0.15 * scale;
      const a = from.clone().lerp(to, 0.35).addScaledVector(side, lane).add(new THREE.Vector3(0, rise, 0));
      const b = to.clone().addScaledVector(side, lane * 0.4).add(new THREE.Vector3(0, rise * 0.35, 0));
      const line = segmentMesh(a, b, (0.012 + (i % 3) * 0.006) * scale,
        i % 3 === 0 ? 0xffffff : 0xff1738, 0);
      group.add(line); speedLines.push(line);
    }

    this.addTask(group, 0.92, (k) => {
      const comboEnvelope = Math.sin(Math.min(1, k / 0.9) * Math.PI);
      speedLines.forEach((line, i) => {
        const flicker = 0.45 + Math.sin(k * Math.PI * 18 + i * 1.7) * 0.35;
        opacity(line, Math.max(0, comboEnvelope * flicker * 0.58));
      });
      strikes.forEach((strike, i) => {
        const width = i === beats.length - 1 ? 0.13 : 0.105;
        const pulse = Math.max(0, 1 - Math.abs(k - beats[i]) / width);
        const snap = Math.pow(pulse, 0.6);
        strike.ring.scale.setScalar(0.35 + snap * (i === 3 ? 2.35 : 1.55));
        strike.halo.scale.setScalar(0.5 + snap * (i === 3 ? 2.05 : 1.3));
        strike.halo.rotation.z += 0.12 + i * 0.025;
        opacity(strike.ring, snap * (i === 3 ? 1 : 0.86));
        opacity(strike.halo, snap * 0.82);
        strike.trails.forEach((trail, lane) => opacity(trail, snap * (lane === 1 ? 1 : 0.72)));
        strike.slashes.forEach((slash, slashIndex) => {
          slash.scale.setScalar(0.45 + snap * (1.25 + slashIndex * 0.2));
          opacity(slash, snap * (slashIndex ? 0.72 : 0.95));
        });
        if (!fired[i] && k >= beats[i]) {
          fired[i] = true;
          this.burst(strike.center, i === 3 ? 0xff1738 : color, eff,
            scale * (i === 3 ? 1.35 : 0.72));
          onStrike?.(i);
        }
      });
    });
  }

  /** Rock Slide / 스톤샤워: a staggered field of heavy rocks falls through the
   *  target's space from overhead, with the largest stones landing last. */
  rockSlide(
    at: THREE.Vector3,
    color: number,
    power: number,
    eff: number,
    onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const scale = Math.max(0.85, Math.min(1.5, 0.78 + power / 145));
    const ground = new THREE.Vector3(at.x, 0.12, at.z);
    const rocks: { mesh: THREE.Mesh; top: THREE.Vector3; land: THREE.Vector3; delay: number; spin: THREE.Vector3 }[] = [];
    const shafts: THREE.Mesh[] = [];
    for (let i = 0; i < 13; i++) {
      const angle = i / 13 * Math.PI * 2 + (i % 3) * 0.35;
      const radius = (0.18 + (i % 5) * 0.18) * scale;
      const size = (i === 10 || i === 12 ? 0.32 : 0.14 + (i % 4) * 0.055) * scale;
      const land = ground.clone().add(new THREE.Vector3(Math.cos(angle) * radius, size * 0.65, Math.sin(angle) * radius));
      const top = land.clone().add(new THREE.Vector3((i % 2 ? -0.28 : 0.22) * scale, 3.3 + (i % 4) * 0.48, (i % 3 - 1) * 0.12));
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rockMaterial(i % 3 ? 0x68513d : 0x8a6747));
      rock.position.copy(top);
      rock.rotation.set(i * 0.73, i * 1.11, i * 0.49);
      group.add(rock);
      rocks.push({
        mesh: rock, top, land,
        delay: (i % 5) * 0.035 + (i > 8 ? 0.08 : 0),
        spin: new THREE.Vector3(2.6 + (i % 3), 3.2 + (i % 4) * 0.7, 2.1 + (i % 2)),
      });
      const shaft = segmentMesh(top.clone().add(new THREE.Vector3(0, 0.9, 0)), top.clone().add(new THREE.Vector3(0, -1.2, 0)),
        Math.max(0.012, size * 0.08), i % 2 ? 0xffe0a6 : mixWhite(color, 0.2), 0);
      group.add(shaft); shafts.push(shaft);
    }
    this.addTask(group, 0.84, (k, _dt, t) => {
      rocks.forEach((rock, i) => {
        const local = Math.max(0, Math.min(1, (k - rock.delay) / 0.62));
        const fall = local * local;
        rock.mesh.position.copy(rock.top).lerp(rock.land, fall);
        rock.mesh.rotation.x += rock.spin.x * 0.016;
        rock.mesh.rotation.y += rock.spin.y * 0.016;
        rock.mesh.rotation.z += rock.spin.z * 0.016;
        const fade = local < 0.9 ? 1 : (1 - local) / 0.1;
        opacity(rock.mesh, Math.max(0, fade));
        shafts[i].position.y = -(rock.top.y - rock.mesh.position.y);
        opacity(shafts[i], local > 0 && local < 0.82 ? Math.sin(local * Math.PI) * 0.52 : 0);
      });
      group.rotation.y = Math.sin(t * 1.8) * 0.025;
    }, 0.64, () => {
      this.burst(ground.clone().add(new THREE.Vector3(0, 0.12, 0)), color, eff, scale * 1.28);
      onImpact?.();
    });
  }

  /** Stone Edge / 스톤에지: jagged stone lances erupt from below and converge
   *  upward through the target instead of reusing the generic rock burst. */
  stoneEdge(
    at: THREE.Vector3,
    color: number,
    power: number,
    eff: number,
    onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const scale = Math.max(0.9, Math.min(1.55, 0.8 + power / 150));
    const ground = new THREE.Vector3(at.x, 0, at.z);
    const spikes: { mesh: THREE.Mesh; height: number; delay: number; x: number; z: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const center = i === 8;
      const angle = i / 8 * Math.PI * 2 + 0.22;
      const radius = center ? 0 : (0.3 + (i % 3) * 0.2) * scale;
      const height = (center ? 2.45 : 1.2 + (i % 4) * 0.28) * scale;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry((center ? 0.34 : 0.2 + (i % 3) * 0.035) * scale, height, 5),
        rockMaterial(center ? 0x4f4643 : (i % 2 ? 0x6d5947 : 0x80664d)),
      );
      const x = ground.x + Math.cos(angle) * radius;
      const z = ground.z + Math.sin(angle) * radius;
      spike.position.set(x, -height * 0.58, z);
      spike.rotation.y = angle + (i % 2 ? 0.2 : -0.18);
      spike.rotation.z = center ? 0 : Math.cos(angle) * 0.13;
      group.add(spike);
      spikes.push({ mesh: spike, height, delay: center ? 0.12 : (i % 4) * 0.035, x, z });
    }
    const fractureRings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry((0.18 + i * 0.2) * scale, (0.24 + i * 0.22) * scale, 7),
        glowMaterial(i === 2 ? mixWhite(color, 0.15) : 0xd7b67b, 0),
      );
      ring.position.set(ground.x, 0.025 + i * 0.005, ground.z);
      ring.rotation.x = -Math.PI / 2;
      ring.rotation.z = i * 0.55;
      group.add(ring); fractureRings.push(ring);
    }
    this.addTask(group, 0.74, (k) => {
      spikes.forEach((spike, i) => {
        const local = Math.max(0, Math.min(1, (k - spike.delay) / 0.42));
        const rise = 1 - Math.pow(1 - local, 3);
        spike.mesh.position.set(spike.x, -spike.height * 0.58 + rise * spike.height * 1.08, spike.z);
        const settle = k > 0.76 ? Math.max(0, (1 - k) / 0.24) : 1;
        opacity(spike.mesh, settle);
        spike.mesh.scale.x = spike.mesh.scale.z = 0.72 + rise * 0.28;
      });
      fractureRings.forEach((ring, i) => {
        const local = Math.max(0, Math.min(1, (k - i * 0.04) / 0.42));
        ring.scale.setScalar(0.5 + local * (1.6 + i * 0.25));
        opacity(ring, Math.sin(local * Math.PI) * 0.72);
      });
    }, 0.5, () => {
      this.burst(ground.clone().add(new THREE.Vector3(0, 0.35, 0)), color, eff, scale * 1.42);
      onImpact?.();
    });
  }

  /** 두루광 전용기: a spectral river, ferry rings and soul flames converge. */
  private soulFerryDeluge(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const dir = to.clone().sub(from);
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const ribbons: THREE.Mesh[] = [];
    for (let lane = -2; lane <= 2; lane++) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 12; i++) {
        const k = i / 12;
        const p = from.clone().lerp(to, k);
        p.addScaledVector(side, lane * 0.17 * scale + Math.sin(k * Math.PI * 3 + lane) * 0.12 * scale);
        p.y = Math.max(0.07, p.y * (1 - k) + 0.08 + Math.sin(k * Math.PI) * 0.42 * scale);
        points.push(p);
      }
      const ribbon = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, (0.07 + Math.abs(lane) * 0.012) * scale, 10, false),
        glowMaterial(lane % 2 ? 0x82e8ff : mixWhite(color, 0.25), 0),
      );
      group.add(ribbon); ribbons.push(ribbon);
    }
    const ferryRings: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry((0.36 + i * 0.14) * scale, 0.035 * scale, 8, 42),
        glowMaterial(i % 2 ? 0xc9f7ff : 0x9f83ff, 0),
      );
      ring.position.copy(to).add(new THREE.Vector3(0, 0.24 + i * 0.18, 0));
      ring.rotation.x = Math.PI / 2;
      group.add(ring); ferryRings.push(ring);
    }
    const souls: { mesh: THREE.Mesh; phase: number; lane: number }[] = [];
    for (let i = 0; i < 18; i++) {
      const soul = new THREE.Mesh(
        i % 3 === 0 ? new THREE.OctahedronGeometry(0.09 * scale, 1) : new THREE.SphereGeometry(0.065 * scale, 10, 7),
        glowMaterial(i % 2 ? 0xbef7ff : 0xc1a3ff, 0),
      );
      group.add(soul);
      souls.push({ mesh: soul, phase: i / 18, lane: (i % 5) - 2 });
    }
    this.addTask(group, 0.78, (k) => {
      const rise = Math.min(1, k / 0.22);
      const fade = k < 0.76 ? 1 : (1 - k) / 0.24;
      ribbons.forEach((r, i) => {
        opacity(r, rise * fade * (0.38 + i * 0.085));
        r.scale.y = 0.82 + Math.sin(k * Math.PI * 5 + i) * 0.08;
      });
      ferryRings.forEach((ring, i) => {
        ring.rotation.z += 0.06 + i * 0.018;
        ring.scale.setScalar(0.65 + rise * 0.6 + Math.sin(k * Math.PI * 6 + i) * 0.08);
        opacity(ring, rise * fade * 0.82);
      });
      souls.forEach((s, i) => {
        const travel = (k * 1.25 + s.phase) % 1;
        s.mesh.position.copy(from).lerp(to, travel);
        s.mesh.position.addScaledVector(side, s.lane * 0.17 * scale + Math.sin(travel * Math.PI * 4 + i) * 0.09);
        s.mesh.position.y += Math.sin(travel * Math.PI) * 0.72 + 0.18;
        s.mesh.rotation.y += 0.12; s.mesh.rotation.z += 0.08;
        opacity(s.mesh, Math.sin(travel * Math.PI) * fade * 0.92);
      });
    }, 0.66, () => { this.burst(to, 0xa9eaff, eff, scale * 1.35); onImpact?.(); });
  }

  /** 염흥왕 전용기: pipe-fire beam, steel pressure rings and a flame maw. */
  private royalKilnRoar(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const unit = to.clone().sub(from).normalize();
    const core = beamMesh(from, to, 0.11 * scale, 0xfff2b0, 0);
    const flame = beamMesh(from, to, 0.28 * scale, 0xff6a21, 0);
    const smokeHalo = beamMesh(from, to, 0.42 * scale, 0xb7c1c8, 0);
    group.add(smokeHalo, flame, core);
    const pressure: THREE.Mesh[] = [];
    for (let i = 1; i <= 7; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry((0.2 + i * 0.022) * scale, 0.027 * scale, 7, 30),
        glowMaterial(i % 2 ? 0xffd36a : 0xdde8ed, 0),
      );
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), unit);
      ring.position.copy(from).lerp(to, i / 8);
      group.add(ring); pressure.push(ring);
    }
    const embers: { mesh: THREE.Mesh; offset: THREE.Vector3; speed: number }[] = [];
    const side = new THREE.Vector3(-unit.z, 0, unit.x);
    for (let i = 0; i < 26; i++) {
      const ember = new THREE.Mesh(
        new THREE.TetrahedronGeometry((0.035 + (i % 4) * 0.012) * scale),
        glowMaterial(i % 3 ? 0xff8b28 : 0xfff0a0, 0),
      );
      group.add(ember);
      embers.push({ mesh: ember, offset: side.clone().multiplyScalar(((i % 7) - 3) * 0.09), speed: 0.74 + (i % 5) * 0.055 });
    }
    const jaws: THREE.Mesh[] = [];
    for (const sideY of [-1, 1]) for (let i = -2; i <= 2; i++) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.07 * scale, 0.34 * scale, 7), glowMaterial(0xffefbd, 0));
      fang.position.copy(to).add(new THREE.Vector3(i * 0.14 * scale, 0.85 + sideY * 0.34 * scale, 0));
      fang.rotation.z = sideY < 0 ? 0 : Math.PI;
      group.add(fang); jaws.push(fang);
    }
    this.addTask(group, 0.7, (k) => {
      const charge = Math.min(1, k / 0.2);
      const fade = k < 0.74 ? 1 : (1 - k) / 0.26;
      const growth = Math.min(1, k / 0.3);
      for (const beam of [smokeHalo, flame, core]) setBeamGrowth(beam, from, to, growth);
      opacity(smokeHalo, charge * fade * 0.2);
      opacity(flame, charge * fade * 0.58);
      opacity(core, charge * fade * 0.97);
      pressure.forEach((ring, i) => {
        ring.rotation.z += 0.1 + i * 0.012;
        ring.scale.setScalar(0.65 + charge * 0.65 + Math.sin(k * 16 + i) * 0.12);
        opacity(ring, charge * fade * 0.86);
      });
      embers.forEach((e, i) => {
        const t = (k * e.speed + i / embers.length) % 1;
        e.mesh.position.copy(from).lerp(to, t).add(e.offset);
        e.mesh.position.y += Math.sin(t * Math.PI) * 0.32 + Math.sin(k * 18 + i) * 0.06;
        e.mesh.rotation.set(k * 9 + i, k * 13, 0);
        opacity(e.mesh, Math.sin(t * Math.PI) * fade);
      });
      const bite = Math.sin(Math.min(1, k / 0.62) * Math.PI);
      jaws.forEach((fang, i) => {
        const top = i >= 5 ? 1 : -1;
        fang.position.y = to.y + 0.85 + top * (0.38 - bite * 0.22) * scale;
        opacity(fang, charge * fade * bite);
      });
    }, 0.64, () => { this.burst(to, color, eff, scale * 1.55); onImpact?.(); });
  }

  /** Ice Beam: a layered cryogenic beam that visibly crystallises around the
   *  target on contact, then fractures and fades without altering battle rules. */
  private iceBeam(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const core = beamMesh(from, to, 0.065 * scale, 0xf4ffff, 0);
    const cold = beamMesh(from, to, 0.15 * scale, 0x67d9ff, 0);
    const mist = beamMesh(from, to, 0.28 * scale, 0xbcefff, 0);
    group.add(mist, cold, core);
    const unit = to.clone().sub(from).normalize();
    const rings: THREE.Mesh[] = [];
    for (let i = 1; i <= 8; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry((0.13 + (i % 3) * 0.025) * scale, 0.018 * scale, 6, 22),
        glowMaterial(i % 2 ? 0xffffff : 0x64d7ff, 0),
      );
      ring.position.copy(from).lerp(to, i / 9);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), unit);
      group.add(ring); rings.push(ring);
    }
    const snow: { mesh: THREE.Mesh; phase: number; spin: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const flake = new THREE.Mesh(
        i % 3 === 0 ? new THREE.OctahedronGeometry(0.045 * scale, 0) : new THREE.TetrahedronGeometry(0.035 * scale),
        glowMaterial(i % 2 ? 0xeaffff : 0x79dcff, 0),
      );
      group.add(flake); snow.push({ mesh: flake, phase: i / 24, spin: 5 + (i % 5) });
    }
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.78 * scale, 1),
      new THREE.MeshBasicMaterial({
        color: 0xb9f1ff, transparent: true, opacity: 0, wireframe: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    shell.position.copy(to);
    shell.scale.set(0.82, 1.25, 0.82);
    group.add(shell);
    const crystals: { mesh: THREE.Mesh; base: THREE.Vector3 }[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2;
      const crystal = new THREE.Mesh(
        new THREE.ConeGeometry((0.055 + (i % 3) * 0.018) * scale, (0.28 + (i % 4) * 0.09) * scale, 5),
        glowMaterial(i % 3 ? 0xa9efff : 0xffffff, 0),
      );
      const base = to.clone().add(new THREE.Vector3(Math.cos(angle) * 0.65 * scale, ((i % 4) - 1.5) * 0.22 * scale, Math.sin(angle) * 0.65 * scale));
      crystal.position.copy(base);
      crystal.rotation.z = -Math.cos(angle) * 0.85;
      crystal.rotation.x = Math.sin(angle) * 0.7;
      group.add(crystal); crystals.push({ mesh: crystal, base });
    }
    this.addTask(group, 0.76, (k) => {
      const growth = Math.min(1, k / 0.28);
      const beamFade = k < 0.6 ? 1 : Math.max(0, (0.82 - k) / 0.22);
      [mist, cold, core].forEach(beam => setBeamGrowth(beam, from, to, growth));
      opacity(mist, growth * beamFade * 0.22);
      opacity(cold, growth * beamFade * 0.72);
      opacity(core, growth * beamFade);
      rings.forEach((ring, i) => {
        ring.rotation.z += 0.14 + i * 0.013;
        ring.scale.setScalar(0.75 + Math.sin(k * Math.PI * 12 + i) * 0.18);
        opacity(ring, growth * beamFade * 0.84);
      });
      snow.forEach((flake, i) => {
        const travel = Math.min(1, Math.max(0, k * 1.45 - flake.phase * 0.42));
        flake.mesh.position.copy(from).lerp(to, travel);
        flake.mesh.position.x += Math.sin(travel * Math.PI * 5 + i) * 0.15 * scale;
        flake.mesh.position.y += Math.cos(travel * Math.PI * 4 + i) * 0.12 * scale;
        flake.mesh.rotation.set(k * flake.spin, k * flake.spin * 1.3, i);
        opacity(flake.mesh, Math.sin(travel * Math.PI) * beamFade);
      });
      const freeze = Math.max(0, Math.min(1, (k - 0.4) / 0.16));
      const thaw = k < 0.82 ? 1 : Math.max(0, (1 - k) / 0.18);
      shell.rotation.y += 0.035;
      opacity(shell, freeze * thaw * 0.76);
      crystals.forEach((crystal, i) => {
        const local = Math.max(0, Math.min(1, freeze * 1.3 - (i % 4) * 0.08));
        crystal.mesh.position.copy(crystal.base).multiplyScalar(1);
        crystal.mesh.scale.setScalar(local * thaw);
        opacity(crystal.mesh, local * thaw * 0.9);
      });
    }, 0.48, () => {
      this.burst(to, 0x8ee8ff, eff, scale * 1.15);
      onImpact?.();
    });
  }

  /** Hydro Pump: a sustained high-pressure water column. The central jet stays
   *  connected while spiral streams, pressure rings and droplets continuously
   *  race toward a large impact splash at the target. */
  private hydroPump(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const dir = to.clone().sub(from);
    const unit = dir.clone().normalize();
    const side = new THREE.Vector3(-unit.z, 0, unit.x).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const outer = beamMesh(from, to, 0.42 * scale, 0x168cff, 0);
    const flow = beamMesh(from, to, 0.26 * scale, 0x43c9ff, 0);
    const core = beamMesh(from, to, 0.11 * scale, 0xf0ffff, 0);
    group.add(outer, flow, core);

    const ribbons: THREE.Mesh[] = [];
    for (let lane = 0; lane < 4; lane++) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 14; i++) {
        const travel = i / 14;
        const angle = travel * Math.PI * 5 + lane * Math.PI * 0.5;
        const radius = (0.24 + Math.sin(travel * Math.PI) * 0.12) * scale;
        const p = from.clone().lerp(to, travel)
          .addScaledVector(side, Math.cos(angle) * radius)
          .addScaledVector(up, Math.sin(angle) * radius);
        points.push(p);
      }
      const ribbon = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 72, 0.035 * scale, 7, false),
        glowMaterial(lane % 2 ? 0x9beaff : 0xffffff, 0),
      );
      group.add(ribbon); ribbons.push(ribbon);
    }

    const pressure: { mesh: THREE.Mesh; phase: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry((0.31 + (i % 3) * 0.035) * scale, 0.026 * scale, 7, 28),
        glowMaterial(i % 2 ? 0xd8f8ff : 0x55cfff, 0),
      );
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), unit);
      group.add(ring); pressure.push({ mesh: ring, phase: i / 9 });
    }

    const droplets: { mesh: THREE.Mesh; phase: number; lane: number; lift: number }[] = [];
    for (let i = 0; i < 34; i++) {
      const drop = new THREE.Mesh(
        i % 4 === 0 ? new THREE.OctahedronGeometry((0.045 + (i % 3) * 0.015) * scale, 0)
          : new THREE.SphereGeometry((0.035 + (i % 4) * 0.009) * scale, 7, 5),
        glowMaterial(i % 3 ? 0x7bdcff : 0xf4ffff, 0),
      );
      group.add(drop);
      droplets.push({ mesh: drop, phase: i / 34, lane: (i % 7) - 3, lift: ((i % 5) - 2) * 0.055 });
    }

    const splashArcs: THREE.Mesh[] = [];
    for (let i = 0; i < 7; i++) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry((0.36 + i * 0.07) * scale, (0.035 + (i % 2) * 0.012) * scale, 7, 30, Math.PI * 1.15),
        glowMaterial(i % 2 ? 0xffffff : 0x4ecaff, 0),
      );
      arc.position.copy(to);
      arc.rotation.set(-0.35 + (i % 3) * 0.35, Math.atan2(unit.x, unit.z), -1.25 + i * 0.38);
      group.add(arc); splashArcs.push(arc);
    }
    const foam: { mesh: THREE.Mesh; vel: THREE.Vector3 }[] = [];
    for (let i = 0; i < 24; i++) {
      const angle = i / 24 * Math.PI * 2;
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry((0.045 + (i % 4) * 0.014) * scale, 7, 5),
        glowMaterial(i % 3 ? 0xc8f7ff : 0xffffff, 0),
      );
      bubble.position.copy(to);
      group.add(bubble);
      foam.push({
        mesh: bubble,
        vel: new THREE.Vector3(Math.cos(angle) * (0.55 + (i % 5) * 0.12), 0.45 + (i % 4) * 0.17, Math.sin(angle) * (0.55 + (i % 3) * 0.14)).multiplyScalar(scale),
      });
    }

    this.addTask(group, 0.94, (k, _dt, t) => {
      const growth = Math.min(1, k / 0.2);
      const fade = k < 0.8 ? 1 : Math.max(0, (1 - k) / 0.2);
      [outer, flow, core].forEach(beam => setBeamGrowth(beam, from, to, growth));
      opacity(outer, growth * fade * (0.27 + Math.sin(k * Math.PI * 14) * 0.045));
      opacity(flow, growth * fade * 0.7);
      opacity(core, growth * fade);
      ribbons.forEach((ribbon, i) => {
        ribbon.rotation.y = Math.sin(k * Math.PI * 7 + i) * 0.025;
        opacity(ribbon, growth * fade * (0.56 + Math.sin(k * Math.PI * 12 + i) * 0.16));
      });
      pressure.forEach((ring, i) => {
        const travel = (k * 2.25 + ring.phase) % 1;
        ring.mesh.position.copy(from).lerp(to, travel);
        ring.mesh.rotation.z += 0.16 + i * 0.009;
        ring.mesh.scale.setScalar(0.7 + travel * 0.55);
        opacity(ring.mesh, growth * fade * Math.sin(travel * Math.PI) * 0.88);
      });
      droplets.forEach((drop, i) => {
        const travel = (k * (2.1 + (i % 4) * 0.12) + drop.phase) % 1;
        drop.mesh.position.copy(from).lerp(to, travel)
          .addScaledVector(side, drop.lane * 0.065 * scale + Math.sin(travel * Math.PI * 5 + i) * 0.08)
          .addScaledVector(up, drop.lift + Math.cos(travel * Math.PI * 6 + i) * 0.07);
        drop.mesh.rotation.set(t * (5 + i % 3), t * 8, i);
        opacity(drop.mesh, growth * fade * Math.sin(travel * Math.PI) * 0.9);
      });
      const impact = Math.max(0, Math.min(1, (k - 0.46) / 0.16));
      const splashFade = k < 0.86 ? 1 : Math.max(0, (1 - k) / 0.14);
      splashArcs.forEach((arc, i) => {
        arc.scale.setScalar(0.35 + impact * (1.25 + i * 0.08));
        opacity(arc, impact * splashFade * (i % 2 ? 0.72 : 0.9));
      });
      foam.forEach((bubble, i) => {
        const age = Math.max(0, (k - 0.48 - (i % 4) * 0.012) / 0.42);
        bubble.mesh.position.copy(to).addScaledVector(foam[i].vel, age);
        bubble.mesh.position.y += foam[i].vel.y * age - age * age * 0.72;
        bubble.mesh.scale.setScalar(0.5 + age * 0.8);
        opacity(bubble.mesh, Math.max(0, impact * (1 - age) * splashFade));
      });
    }, 0.56, () => {
      this.burst(to, color, eff, scale * 1.48);
      onImpact?.();
    });
  }

  /** Shadow Ball: darkness gathers visibly beside the attacker, condenses into
   *  a dense purple sphere, then launches with a twisting spectral tail. */
  private shadowBall(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const dir = to.clone().sub(from).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const chargeAt = from.clone().addScaledVector(dir, 0.38 * scale).add(new THREE.Vector3(0, 0.12 * scale, 0));
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19 * scale, 2), glowMaterial(0xf1c8ff, 0));
    const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34 * scale, 1), glowMaterial(color || 0x7b24d6, 0));
    core.position.copy(chargeAt); shell.position.copy(chargeAt);
    group.add(shell, core);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTex(), color: 0x8f2fff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.copy(chargeAt); glow.scale.setScalar(0.01);
    group.add(glow);

    const chargeRings: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry((0.38 + i * 0.1) * scale, 0.025 * scale, 6, 30),
        glowMaterial(i % 2 ? 0xd284ff : 0x6120a8, 0),
      );
      ring.position.copy(chargeAt);
      ring.rotation.set(0.35 + i * 0.26, i * 0.6, i * 0.42);
      group.add(ring); chargeRings.push(ring);
    }
    const motes: { mesh: THREE.Mesh; phase: number; radius: number; height: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const mote = new THREE.Mesh(
        i % 4 === 0 ? new THREE.TetrahedronGeometry((0.035 + (i % 3) * 0.012) * scale)
          : new THREE.SphereGeometry((0.025 + (i % 4) * 0.008) * scale, 6, 4),
        glowMaterial(i % 3 ? 0x9a42ef : 0xf0b9ff, 0),
      );
      group.add(mote);
      motes.push({ mesh: mote, phase: i / 28 * Math.PI * 2, radius: (0.65 + (i % 5) * 0.13) * scale, height: ((i % 7) - 3) * 0.1 * scale });
    }
    const tail: THREE.Mesh[] = [];
    for (let i = 0; i < 9; i++) {
      const echo = new THREE.Mesh(
        new THREE.SphereGeometry((0.16 - i * 0.011) * scale, 9, 6),
        glowMaterial(i % 2 ? 0x7d2bd1 : 0xc65cff, 0),
      );
      echo.position.copy(chargeAt);
      group.add(echo); tail.push(echo);
    }

    this.addTask(group, 0.84, (k) => {
      const charge = Math.max(0, Math.min(1, k / 0.36));
      const travel = Math.max(0, Math.min(1, (k - 0.36) / 0.42));
      const launch = easeInOut(travel);
      const orbAt = chargeAt.clone().lerp(to, launch);
      orbAt.y += Math.sin(travel * Math.PI) * 0.34 * scale;
      const impactFade = k < 0.78 ? 1 : Math.max(0, (1 - k) / 0.22);
      core.position.copy(orbAt); shell.position.copy(orbAt); glow.position.copy(orbAt);
      const pulse = 0.84 + Math.sin(k * Math.PI * 16) * 0.12;
      core.scale.setScalar(Math.max(0.05, charge * pulse));
      shell.scale.setScalar(Math.max(0.05, charge * (0.72 + Math.sin(k * Math.PI * 10) * 0.1)));
      glow.scale.setScalar(charge * (0.95 + Math.sin(k * Math.PI * 12) * 0.12) * scale);
      opacity(core, charge * impactFade);
      opacity(shell, charge * impactFade * 0.78);
      (glow.material as THREE.SpriteMaterial).opacity = charge * impactFade * 0.72;
      core.rotation.x += 0.16; core.rotation.y += 0.24;
      shell.rotation.x -= 0.08; shell.rotation.z += 0.13;
      chargeRings.forEach((ring, i) => {
        ring.position.copy(chargeAt);
        ring.rotation.z += 0.1 + i * 0.025;
        ring.scale.setScalar(Math.max(0.05, (1 - charge * 0.55) * (1 + i * 0.08)));
        opacity(ring, travel > 0 ? Math.max(0, 1 - travel * 3) : charge * 0.72);
      });
      motes.forEach((mote, i) => {
        if (travel <= 0) {
          const inward = 1 - charge * 0.78;
          const angle = mote.phase + k * Math.PI * (5 + (i % 3));
          mote.mesh.position.copy(chargeAt)
            .addScaledVector(side, Math.cos(angle) * mote.radius * inward)
            .add(new THREE.Vector3(0, mote.height * inward + Math.sin(angle) * 0.32 * inward, 0))
            .addScaledVector(dir, Math.sin(angle) * mote.radius * 0.5 * inward);
          opacity(mote.mesh, Math.sin(charge * Math.PI) * 0.9);
        } else {
          const lag = Math.max(0, launch - (i % 7) * 0.018);
          mote.mesh.position.copy(chargeAt).lerp(to, lag)
            .addScaledVector(side, Math.sin(k * Math.PI * 10 + i) * 0.16 * scale * (1 - travel))
            .add(new THREE.Vector3(0, Math.cos(k * Math.PI * 9 + i) * 0.12 * scale, 0));
          opacity(mote.mesh, impactFade * (1 - travel * 0.45));
        }
        mote.mesh.rotation.set(k * 7 + i, k * 11, i);
      });
      tail.forEach((echo, i) => {
        const lag = Math.max(0, launch - (i + 1) * 0.045);
        echo.position.copy(chargeAt).lerp(to, lag);
        echo.position.y += Math.sin(Math.max(0, travel - i * 0.02) * Math.PI) * 0.3;
        echo.scale.setScalar((1 - i / tail.length * 0.55) * scale);
        opacity(echo, travel > 0 ? impactFade * (0.46 - i * 0.035) : 0);
      });
    }, 0.76, () => {
      this.burst(to, 0x8b2bd6, eff, scale * 1.38);
      onImpact?.();
    });
  }

  /** Air Slash: several crescent wind blades leave the attacker in a staggered
   *  volley, cross through the target and resolve into a brief cutting vortex. */
  private airSlash(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const dir = to.clone().sub(from);
    const unit = dir.clone().normalize();
    const side = new THREE.Vector3(-unit.z, 0, unit.x).normalize();
    const blades: { mesh: THREE.Mesh; echo: THREE.Mesh; delay: number; side: number; lift: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const blade = new THREE.Mesh(
        new THREE.TorusGeometry((0.3 + (i % 3) * 0.055) * scale, (0.035 + (i % 2) * 0.009) * scale, 6, 30, Math.PI * 1.05),
        glowMaterial(i % 2 ? 0xf3fbff : (color || 0xa9e7ff), 0),
      );
      const echo = new THREE.Mesh(
        new THREE.TorusGeometry((0.34 + (i % 3) * 0.055) * scale, 0.018 * scale, 5, 26, Math.PI * 1.05),
        glowMaterial(0x74cfff, 0),
      );
      blade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), unit);
      echo.quaternion.copy(blade.quaternion);
      blade.rotateZ((i % 2 ? 0.7 : -0.7) + i * 0.11);
      echo.rotateZ((i % 2 ? 0.7 : -0.7) + i * 0.11);
      blade.position.copy(from); echo.position.copy(from);
      group.add(echo, blade);
      blades.push({ mesh: blade, echo, delay: i * 0.055, side: ((i % 3) - 1) * 0.28, lift: ((i % 4) - 1.5) * 0.12 });
    }
    const windLines: THREE.Mesh[] = [];
    for (let i = 0; i < 9; i++) {
      const start = from.clone().addScaledVector(side, ((i % 5) - 2) * 0.12 * scale).add(new THREE.Vector3(0, ((i % 3) - 1) * 0.12, 0));
      const end = to.clone().addScaledVector(side, ((i % 5) - 2) * 0.05 * scale).add(new THREE.Vector3(0, ((i % 3) - 1) * 0.05, 0));
      const line = segmentMesh(start, end, (0.01 + (i % 3) * 0.006) * scale, i % 2 ? 0xdff8ff : 0x73cfff, 0);
      group.add(line); windLines.push(line);
    }
    const vortex: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry((0.36 + i * 0.13) * scale, 0.03 * scale, 6, 34),
        glowMaterial(i % 2 ? 0xffffff : 0x7fd8ff, 0),
      );
      ring.position.copy(to);
      ring.rotation.set(Math.PI / 2 - i * 0.18, Math.atan2(unit.x, unit.z), i * 0.55);
      group.add(ring); vortex.push(ring);
    }
    this.addTask(group, 0.68, (k) => {
      blades.forEach((blade, i) => {
        const local = Math.max(0, Math.min(1, (k - blade.delay) / 0.58));
        const travel = easeInOut(local);
        const p = from.clone().lerp(to, travel)
          .addScaledVector(side, Math.sin(local * Math.PI) * blade.side * scale)
          .add(new THREE.Vector3(0, Math.sin(local * Math.PI) * (0.35 + blade.lift) * scale, 0));
        blade.mesh.position.copy(p);
        const lag = Math.max(0, travel - 0.075);
        blade.echo.position.copy(from).lerp(to, lag)
          .addScaledVector(side, Math.sin(Math.max(0, local - 0.08) * Math.PI) * blade.side * scale)
          .add(new THREE.Vector3(0, Math.sin(Math.max(0, local - 0.08) * Math.PI) * (0.32 + blade.lift), 0));
        blade.mesh.rotateZ(0.12 + i * 0.008);
        blade.echo.rotateZ(0.09);
        const fade = local < 0.82 ? Math.sin(Math.min(1, local * 1.8) * Math.PI * 0.5) : Math.max(0, (1 - local) / 0.18);
        opacity(blade.mesh, fade * 0.96);
        opacity(blade.echo, fade * 0.42);
      });
      windLines.forEach((line, i) => {
        opacity(line, Math.sin(Math.min(1, k * 1.5) * Math.PI) * (0.28 + (i % 3) * 0.1));
      });
      const impact = Math.max(0, Math.min(1, (k - 0.58) / 0.18));
      vortex.forEach((ring, i) => {
        ring.rotation.z += 0.16 + i * 0.025;
        ring.scale.setScalar(0.35 + impact * (1.5 + i * 0.12));
        opacity(ring, Math.sin(impact * Math.PI) * 0.8);
      });
    }, 0.67, () => {
      this.burst(to, 0x9de7ff, eff, scale * 1.22);
      onImpact?.();
    });
  }

  /** Fire-family stream: layered flame pressure with embers that keep flowing
   *  for the full attack instead of one orange projectile. */
  private fireTorrent(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const unit = to.clone().sub(from).normalize();
    const side = new THREE.Vector3(-unit.z, 0, unit.x);
    const heat = beamMesh(from, to, 0.3 * scale, 0xe82d16, 0);
    const flame = beamMesh(from, to, 0.18 * scale, color || 0xff6825, 0);
    const core = beamMesh(from, to, 0.065 * scale, 0xfff1a6, 0);
    group.add(heat, flame, core);
    const tongues: { mesh: THREE.Mesh; phase: number; lane: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const tongue = new THREE.Mesh(
        new THREE.ConeGeometry((0.035 + (i % 4) * 0.012) * scale, (0.15 + (i % 5) * 0.035) * scale, 5),
        glowMaterial(i % 3 ? 0xff6b1f : 0xffe36e, 0),
      );
      group.add(tongue); tongues.push({ mesh: tongue, phase: i / 30, lane: (i % 7) - 3 });
    }
    const flare: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(
        new THREE.TorusGeometry((0.28 + i * 0.08) * scale, 0.035 * scale, 6, 26, Math.PI * 1.25),
        glowMaterial(i % 2 ? 0xfff1a3 : 0xff4b20, 0),
      );
      f.position.copy(to); f.rotation.set(0.2 + i * 0.22, Math.atan2(unit.x, unit.z), -1 + i * 0.45);
      group.add(f); flare.push(f);
    }
    this.addTask(group, 0.58, (k) => {
      const growth = Math.min(1, k / 0.22);
      const fade = k < 0.72 ? 1 : Math.max(0, (1 - k) / 0.28);
      [heat, flame, core].forEach(beam => setBeamGrowth(beam, from, to, growth));
      opacity(heat, growth * fade * 0.28);
      opacity(flame, growth * fade * (0.68 + Math.sin(k * Math.PI * 13) * 0.1));
      opacity(core, growth * fade * 0.95);
      tongues.forEach((tongue, i) => {
        const travel = (k * 2.15 + tongue.phase) % 1;
        tongue.mesh.position.copy(from).lerp(to, travel)
          .addScaledVector(side, tongue.lane * 0.055 * scale + Math.sin(travel * Math.PI * 5 + i) * 0.08)
          .add(new THREE.Vector3(0, Math.sin(travel * Math.PI) * 0.22 + Math.cos(k * 15 + i) * 0.06, 0));
        tongue.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), unit);
        tongue.mesh.rotateY(k * 6 + i);
        opacity(tongue.mesh, growth * fade * Math.sin(travel * Math.PI));
      });
      const impact = Math.max(0, Math.min(1, (k - 0.42) / 0.18));
      flare.forEach((f, i) => {
        f.scale.setScalar(0.45 + impact * (1.3 + i * 0.12));
        opacity(f, Math.sin(impact * Math.PI) * 0.88);
      });
    }, 0.5, () => { this.burst(to, color || 0xff6328, eff, scale * 1.2); onImpact?.(); });
  }

  /** Concentric pulse family used by Psychic, Dark Pulse and sound attacks.
   *  Colour and twist distinguish the move while preserving its recognisable
   *  ring-wave silhouette from the modern games. */
  private ringPulse(
    from: THREE.Vector3, to: THREE.Vector3, primary: number, accent: number,
    scale: number, eff: number, onImpact: (() => void) | undefined, twist: number,
  ): void {
    const group = new THREE.Group();
    const unit = to.clone().sub(from).normalize();
    const rings: { mesh: THREE.Mesh; phase: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry((0.22 + (i % 3) * 0.05) * scale, 0.03 * scale, 6, 28),
        glowMaterial(i % 2 ? primary : accent, 0),
      );
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), unit);
      group.add(ring); rings.push({ mesh: ring, phase: i / 10 });
    }
    const nodes: { mesh: THREE.Mesh; phase: number; lane: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const node = new THREE.Mesh(
        new THREE.OctahedronGeometry((0.035 + (i % 3) * 0.012) * scale, 0),
        glowMaterial(i % 2 ? accent : primary, 0),
      );
      group.add(node); nodes.push({ mesh: node, phase: i / 16, lane: (i % 5) - 2 });
    }
    this.addTask(group, 0.52, (k) => {
      rings.forEach((ring, i) => {
        const travel = Math.min(1, Math.max(0, k * 1.65 - ring.phase * 0.5));
        ring.mesh.position.copy(from).lerp(to, travel);
        ring.mesh.rotateZ(0.12 + twist * 0.08 + i * 0.005);
        ring.mesh.scale.setScalar(0.65 + travel * (0.65 + twist * 0.2));
        opacity(ring.mesh, Math.sin(travel * Math.PI) * 0.88);
      });
      nodes.forEach((node, i) => {
        const travel = (k * 1.8 + node.phase) % 1;
        const a = travel * Math.PI * (4 + twist) + i;
        node.mesh.position.copy(from).lerp(to, travel)
          .add(new THREE.Vector3(Math.cos(a) * node.lane * 0.035, Math.sin(a) * 0.18 * scale, Math.sin(a) * node.lane * 0.035));
        node.mesh.rotation.set(k * 8 + i, k * 11, 0);
        opacity(node.mesh, Math.sin(travel * Math.PI) * 0.76);
      });
    }, 0.56, () => { this.burst(to, primary, eff, scale * 1.16); onImpact?.(); });
  }

  /** Grass energy attacks gather a bright seed-like sphere wrapped in leaves. */
  private natureOrb(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 * scale, 2), glowMaterial(0xdfff9a, 0.96));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.36 * scale, 14, 10), glowMaterial(color || 0x65c948, 0.34));
    group.add(halo, orb);
    const leaves: THREE.Mesh[] = [];
    for (let i = 0; i < 18; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.045 * scale, 0.19 * scale, 5), glowMaterial(i % 3 ? 0x79d84d : 0xe3f76e, 0.9));
      group.add(leaf); leaves.push(leaf);
    }
    this.addTask(group, 0.5, (k) => {
      const p = from.clone().lerp(to, easeInOut(k)); p.y += Math.sin(k * Math.PI) * 0.48;
      orb.position.copy(p); halo.position.copy(p);
      orb.rotation.x += 0.18; orb.rotation.y += 0.24;
      halo.scale.setScalar(0.85 + Math.sin(k * Math.PI * 8) * 0.12);
      leaves.forEach((leaf, i) => {
        const a = i / leaves.length * Math.PI * 2 + k * Math.PI * 7;
        const r = (0.3 + (i % 4) * 0.045) * scale;
        leaf.position.copy(p).add(new THREE.Vector3(Math.cos(a) * r, Math.sin(a * 1.7) * 0.18, Math.sin(a) * r));
        leaf.rotation.set(k * 8 + i, k * 10, a);
        opacity(leaf, Math.sin(k * Math.PI));
      });
      opacity(orb, 1 - Math.max(0, k - 0.84) * 6.2);
      opacity(halo, 0.34 * (1 - Math.max(0, k - 0.8) * 5));
    }, 0.62, () => { this.burst(to, color || 0x62c94e, eff, scale * 1.15); onImpact?.(); });
  }

  /** Poison projectile with viscous droplets and a splattering impact. */
  private toxicBomb(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const bomb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 * scale, 1), glowMaterial(0x74208f, 0.94));
    const skin = new THREE.Mesh(new THREE.SphereGeometry(0.34 * scale, 12, 9), glowMaterial(color || 0xb34dcc, 0.3));
    group.add(skin, bomb);
    const drops: { mesh: THREE.Mesh; phase: number; offset: THREE.Vector3 }[] = [];
    for (let i = 0; i < 20; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry((0.035 + (i % 4) * 0.012) * scale, 6, 4), glowMaterial(i % 2 ? 0xd56af1 : 0x6d1c80, 0.86));
      group.add(drop); drops.push({ mesh: drop, phase: i / 20, offset: new THREE.Vector3(((i % 5) - 2) * 0.08, ((i % 3) - 1) * 0.07, 0) });
    }
    this.addTask(group, 0.52, (k) => {
      const p = from.clone().lerp(to, easeInOut(k)); p.y += Math.sin(k * Math.PI) * 0.72;
      bomb.position.copy(p); skin.position.copy(p);
      bomb.rotation.set(k * 9, k * 13, k * 5);
      skin.scale.setScalar(0.82 + Math.sin(k * Math.PI * 10) * 0.14);
      drops.forEach((drop, i) => {
        const lag = Math.max(0, k - drop.phase * 0.14);
        drop.mesh.position.copy(from).lerp(to, lag).add(drop.offset);
        drop.mesh.position.y += Math.sin(lag * Math.PI) * 0.62 - (i % 3) * 0.035;
        opacity(drop.mesh, Math.sin(lag * Math.PI) * 0.84);
      });
      opacity(bomb, 1 - Math.max(0, k - 0.86) * 7);
      opacity(skin, 0.32 * (1 - Math.max(0, k - 0.82) * 5.5));
    }, 0.62, () => { this.burst(to, color || 0xaf43c5, eff, scale * 1.28); onImpact?.(); });
  }

  /** Fairy attacks form a moonlit source and send starry ribbons forward. */
  private fairyLight(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const moonAt = from.clone().add(new THREE.Vector3(0, 0.9 * scale, 0));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.38 * scale, 18, 12), glowMaterial(0xfff4cf, 0));
    moon.position.copy(moonAt); group.add(moon);
    const beamCore = beamMesh(moonAt, to, 0.07 * scale, 0xffffff, 0);
    const beamHalo = beamMesh(moonAt, to, 0.2 * scale, color || 0xff9edc, 0);
    group.add(beamHalo, beamCore);
    const stars: { mesh: THREE.Mesh; phase: number; lane: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry((0.035 + (i % 3) * 0.012) * scale, 0), glowMaterial(i % 2 ? 0xffffff : 0xffb5e8, 0));
      group.add(star); stars.push({ mesh: star, phase: i / 24, lane: (i % 7) - 3 });
    }
    this.addTask(group, 0.58, (k) => {
      const charge = Math.min(1, k / 0.3);
      const release = Math.max(0, Math.min(1, (k - 0.24) / 0.25));
      const fade = k < 0.78 ? 1 : Math.max(0, (1 - k) / 0.22);
      moon.scale.setScalar(0.45 + charge * 0.75 + Math.sin(k * Math.PI * 8) * 0.06);
      opacity(moon, charge * fade * 0.78);
      [beamHalo, beamCore].forEach(beam => setBeamGrowth(beam, moonAt, to, release));
      opacity(beamHalo, release * fade * 0.38); opacity(beamCore, release * fade * 0.96);
      stars.forEach((star, i) => {
        const travel = Math.max(0, Math.min(1, release * 1.35 - star.phase * 0.38));
        const a = travel * Math.PI * 5 + i;
        star.mesh.position.copy(moonAt).lerp(to, travel)
          .add(new THREE.Vector3(Math.cos(a) * star.lane * 0.035, Math.sin(a) * 0.16, Math.sin(a) * star.lane * 0.035));
        star.mesh.rotation.set(k * 9 + i, k * 12, 0);
        opacity(star.mesh, Math.sin(travel * Math.PI) * fade);
      });
    }, 0.57, () => { this.burst(to, color || 0xff9edc, eff, scale * 1.22); onImpact?.(); });
  }

  /** Draco Meteor: several draconic meteors descend around the target and the
   *  final central meteor provides the damage beat. */
  private dracoMeteor(
    at: THREE.Vector3, color: number, scale: number,
    eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const meteors: { rock: THREE.Mesh; trail: THREE.Mesh; start: THREE.Vector3; end: THREE.Vector3; delay: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      const radius = (i === 7 ? 0.08 : 0.28 + (i % 4) * 0.16) * scale;
      const end = new THREE.Vector3(at.x + Math.cos(angle) * radius, 0.18, at.z + Math.sin(angle) * radius);
      const start = end.clone().add(new THREE.Vector3(i % 2 ? -1.2 : 1.1, 3.8 + (i % 3) * 0.55, i % 3 - 1));
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry((i === 7 ? 0.31 : 0.16 + (i % 3) * 0.04) * scale, 0), glowMaterial(i % 2 ? 0x742bd1 : 0xb85cff, 0));
      rock.position.copy(start);
      const trail = beamMesh(start, start.clone().lerp(end, 0.42), (i === 7 ? 0.11 : 0.055) * scale, i % 2 ? 0xe4b4ff : color, 0);
      group.add(trail, rock); meteors.push({ rock, trail, start, end, delay: i === 7 ? 0.18 : (i % 4) * 0.045 });
    }
    this.addTask(group, 0.78, (k) => {
      meteors.forEach((meteor, i) => {
        const local = Math.max(0, Math.min(1, (k - meteor.delay) / 0.58));
        meteor.rock.position.copy(meteor.start).lerp(meteor.end, local * local);
        meteor.rock.rotation.set(k * 8 + i, k * 11, i);
        meteor.trail.position.copy(meteor.rock.position).lerp(meteor.start, 0.2);
        const fade = local < 0.9 ? 1 : Math.max(0, (1 - local) / 0.1);
        opacity(meteor.rock, fade); opacity(meteor.trail, Math.sin(local * Math.PI) * 0.7);
      });
    }, 0.7, () => { this.burst(new THREE.Vector3(at.x, 0.2, at.z), color, eff, scale * 1.55); onImpact?.(); });
  }

  /** Dragon Pulse / Breath: a bright core wrapped by two counter-rotating
   *  draconic energy streams. */
  private dragonBeam(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const core = beamMesh(from, to, 0.09 * scale, 0xe6efff, 0);
    const halo = beamMesh(from, to, 0.2 * scale, color || 0x7a56e8, 0);
    group.add(halo, core);
    const dir = to.clone().sub(from), side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const coils: THREE.Mesh[] = [];
    for (const sign of [-1, 1]) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 18; i++) {
        const travel = i / 18, a = travel * Math.PI * 6 * sign;
        points.push(from.clone().lerp(to, travel).addScaledVector(side, Math.cos(a) * 0.18 * scale).add(new THREE.Vector3(0, Math.sin(a) * 0.18 * scale, 0)));
      }
      const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 72, 0.035 * scale, 7, false), glowMaterial(sign > 0 ? 0x65d7ff : 0xc36cff, 0));
      group.add(coil); coils.push(coil);
    }
    this.addTask(group, 0.52, (k) => {
      const growth = Math.min(1, k / 0.25), fade = k < 0.72 ? 1 : Math.max(0, (1 - k) / 0.28);
      [halo, core].forEach(beam => setBeamGrowth(beam, from, to, growth));
      opacity(halo, growth * fade * 0.42); opacity(core, growth * fade);
      coils.forEach((coil, i) => { coil.rotation.y = Math.sin(k * Math.PI * 8 + i) * 0.03; opacity(coil, growth * fade * 0.82); });
    }, 0.56, () => { this.burst(to, color || 0x805ce0, eff, scale * 1.24); onImpact?.(); });
  }

  /** Blizzard / Powder Snow / Aurora Beam family: a forward cold gust blooms
   *  into a rotating field of ice shards around the target. */
  private iceStorm(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const wind = beamMesh(from, to, 0.24 * scale, 0xa7eaff, 0);
    group.add(wind);
    const shards: { mesh: THREE.Mesh; phase: number; angle: number; radius: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry((0.04 + (i % 4) * 0.015) * scale, 0), glowMaterial(i % 2 ? 0xffffff : 0x84ddff, 0));
      group.add(shard); shards.push({ mesh: shard, phase: i / 28, angle: i / 28 * Math.PI * 2, radius: (0.35 + (i % 6) * 0.09) * scale });
    }
    this.addTask(group, 0.6, (k) => {
      const growth = Math.min(1, k / 0.25), fade = k < 0.78 ? 1 : Math.max(0, (1 - k) / 0.22);
      setBeamGrowth(wind, from, to, growth); opacity(wind, growth * fade * 0.28);
      shards.forEach((shard, i) => {
        const travel = Math.max(0, Math.min(1, k * 1.45 - shard.phase * 0.32));
        const center = from.clone().lerp(to, travel);
        const a = shard.angle + k * Math.PI * (5 + (i % 3));
        shard.mesh.position.copy(center).add(new THREE.Vector3(Math.cos(a) * shard.radius, Math.sin(a * 1.4) * shard.radius * 0.7, Math.sin(a) * shard.radius));
        shard.mesh.rotation.set(k * 10 + i, k * 13, a);
        opacity(shard.mesh, Math.sin(travel * Math.PI) * fade);
      });
    }, 0.56, () => { this.burst(to, color || 0x8bdfff, eff, scale * 1.3); onImpact?.(); });
  }

  /** 활빈다람 전용기: acorn seal, three hero slashes and leaf shrapnel. */
  private outlawLeafstorm(at: THREE.Vector3, color: number, scale: number): void {
    const group = new THREE.Group();
    group.position.copy(at).add(new THREE.Vector3(0, 0.95, 0));
    const seal = new THREE.Mesh(
      new THREE.TorusGeometry(0.52 * scale, 0.055 * scale, 9, 44),
      glowMaterial(0xd6f07a, 0),
    );
    seal.rotation.x = Math.PI / 2;
    group.add(seal);
    const slashes: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const slash = new THREE.Mesh(
        new THREE.TorusGeometry((0.48 + i * 0.11) * scale, (0.045 + i * 0.006) * scale, 6, 30, Math.PI * 0.92),
        glowMaterial(i === 1 ? 0xffef88 : mixWhite(color, 0.18), 0),
      );
      slash.rotation.set(0.28 + i * 0.18, 0.5, -1.0 + i * 0.7);
      group.add(slash); slashes.push(slash);
    }
    const leaves: { mesh: THREE.Mesh; angle: number; speed: number }[] = [];
    for (let i = 0; i < 22; i++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.065 * scale, 0.3 * scale, 5),
        glowMaterial(i % 3 ? 0x8fdd52 : 0xe9ec77, 0),
      );
      group.add(leaf);
      leaves.push({ mesh: leaf, angle: i / 22 * Math.PI * 2, speed: 0.8 + (i % 5) * 0.1 });
    }
    this.addTask(group, 0.58, (k) => {
      const pulse = Math.sin(k * Math.PI);
      seal.rotation.z += 0.16;
      seal.scale.setScalar(0.45 + k * 1.25);
      opacity(seal, pulse * 0.85);
      slashes.forEach((slash, i) => {
        slash.scale.setScalar(0.25 + Math.min(1, k * 2.8 - i * 0.17) * 1.35);
        opacity(slash, Math.max(0, Math.sin(Math.max(0, k - i * 0.09) * Math.PI)));
      });
      leaves.forEach((l, i) => {
        const radius = k * (0.8 + (i % 4) * 0.16) * scale;
        l.mesh.position.set(Math.cos(l.angle + k * 5 * l.speed) * radius, Math.sin(k * Math.PI) * (0.4 + (i % 3) * 0.12), Math.sin(l.angle + k * 5 * l.speed) * radius);
        l.mesh.rotation.set(k * 8 + i, k * 11, l.angle);
        opacity(l.mesh, pulse);
      });
    });
  }

  /** Expanding shockwave and directional shard spray used by every solid hit. */
  burst(at: THREE.Vector3, color: number, eff = 1, strength = 1): void {
    const big = (eff > 1 ? 1.35 : eff === 0 ? 0.58 : 1) * strength;
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.3, 28),
      glowMaterial(mixWhite(color, 0.3), 0.95),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(at.x, 0.06, at.z);
    group.add(ring);
    const shards: { mesh: THREE.Mesh; vel: THREE.Vector3 }[] = [];
    const n = Math.round(12 * big);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + Math.random() * 0.35;
      const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.065 * big), glowMaterial(mixWhite(color, 0.12), 1));
      mesh.position.copy(at).add(new THREE.Vector3(0, 0.48, 0));
      group.add(mesh);
      shards.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(a) * (1.2 + Math.random()), 1.5 + Math.random() * 1.7, Math.sin(a) * (1.2 + Math.random())).multiplyScalar(big),
      });
    }
    this.addTask(group, 0.56 * Math.max(1, big * 0.72), (k, _dt, t) => {
      ring.scale.setScalar(1 + k * 6 * big);
      opacity(ring, 0.95 * (1 - k));
      for (let i = 0; i < shards.length; i++) {
        const s = shards[i];
        s.mesh.position.set(
          at.x + s.vel.x * t,
          Math.max(0.04, at.y + 0.48 + s.vel.y * t - 4.5 * t * t),
          at.z + s.vel.z * t,
        );
        s.mesh.rotation.set(t * 7 + i, t * 9, 0);
        s.mesh.scale.setScalar(Math.max(0.001, 1 - k));
        opacity(s.mesh, 1 - k * 0.75);
      }
    });
  }

  private typedProjectile(
    from: THREE.Vector3, to: THREE.Vector3, type: string, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const accent = TYPE_ACCENTS[type] ?? 0xffffff;
    const headGeo: THREE.BufferGeometry =
      type === 'ice' ? new THREE.OctahedronGeometry(0.19 * scale) :
      type === 'grass' ? new THREE.ConeGeometry(0.15 * scale, 0.48 * scale, 5) :
      type === 'fairy' ? new THREE.OctahedronGeometry(0.2 * scale) :
      type === 'bug' ? new THREE.TorusGeometry(0.16 * scale, 0.055 * scale, 6, 14) :
      /ghost|dark|poison|psychic|dragon/.test(type) ? new THREE.DodecahedronGeometry(0.2 * scale, 0) :
      new THREE.IcosahedronGeometry(0.18 * scale, 1);
    const head = new THREE.Mesh(headGeo, glowMaterial(mixWhite(color, 0.25), 1));
    if (type === 'grass') head.rotation.z = Math.PI / 2;
    group.add(head);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTex(), color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(1.0 * scale); group.add(glow);

    const dir = to.clone().sub(from).normalize();
    const trail: THREE.Mesh[] = [];
    for (let i = 1; i <= 7; i++) {
      const mote = new THREE.Mesh(
        type === 'grass' ? new THREE.ConeGeometry(0.045, 0.16, 4) : new THREE.SphereGeometry(0.05 + i * 0.004, 6, 4),
        glowMaterial(i % 2 ? color : accent, 0.7 - i * 0.07),
      );
      mote.position.copy(dir).multiplyScalar(-i * 0.12);
      mote.position.y += Math.sin(i * 2.1) * 0.05;
      group.add(mote); trail.push(mote);
    }
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.28 * scale, 0.025, 5, 22), glowMaterial(accent, 0.85));
    orbit.rotation.x = Math.PI / 2; group.add(orbit);
    group.position.copy(from);
    this.addTask(group, 0.4, (k) => {
      const p = from.clone().lerp(to, easeInOut(k));
      p.y += Math.sin(k * Math.PI) * (type === 'ground' ? 0.25 : 0.62);
      group.position.copy(p);
      head.rotation.x += 0.24; head.rotation.y += 0.32;
      orbit.rotation.z += 0.32;
      orbit.scale.setScalar(0.85 + Math.sin(k * Math.PI * 6) * 0.18);
      for (let i = 0; i < trail.length; i++) {
        trail[i].position.y += Math.sin(k * Math.PI * 8 + i) * 0.006;
        opacity(trail[i], (1 - k * 0.35) * (0.68 - i * 0.06));
      }
      opacity(head, 1 - Math.max(0, k - 0.82) * 4.8);
    }, 0.6, () => { this.burst(to, color, eff, scale); onImpact?.(); });
  }

  private beam(
    from: THREE.Vector3, to: THREE.Vector3, type: string, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const accent = TYPE_ACCENTS[type] ?? 0xffffff;
    const core = beamMesh(from, to, 0.08 * scale, mixWhite(color, 0.62), 0.98);
    const halo = beamMesh(from, to, 0.19 * scale, color, 0.3);
    group.add(halo, core);
    const dir = to.clone().sub(from), len = dir.length(), unit = dir.clone().normalize();
    const rings: THREE.Mesh[] = [];
    for (let i = 1; i <= 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22 * scale, 0.025, 5, 18), glowMaterial(i % 2 ? accent : color, 0.78));
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), unit);
      ring.position.copy(from).addScaledVector(unit, len * i / 7);
      group.add(ring); rings.push(ring);
    }
    this.addTask(group, 0.5, (k) => {
      const grow = Math.min(1, k / 0.24);
      setBeamGrowth(core, from, to, grow);
      setBeamGrowth(halo, from, to, grow);
      const fade = k < 0.68 ? 1 : 1 - (k - 0.68) / 0.32;
      opacity(core, fade); opacity(halo, fade * 0.38);
      for (let i = 0; i < rings.length; i++) {
        rings[i].rotation.z += 0.22 + i * 0.018;
        rings[i].scale.setScalar(0.72 + Math.sin(k * Math.PI * 9 - i) * 0.22);
        opacity(rings[i], Math.max(0, fade * 0.82));
      }
    }, 0.48, () => { this.burst(to, color, eff, scale * 1.08); onImpact?.(); });
  }

  private electricArc(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const dir = to.clone().sub(from), len = dir.length();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const pts: THREE.Vector3[] = [from.clone()];
    for (let i = 1; i < 10; i++) {
      const p = from.clone().lerp(to, i / 10);
      p.addScaledVector(side, (Math.random() - 0.5) * 0.5 * scale);
      p.y += (Math.random() - 0.35) * 0.35 * scale + Math.sin(i / 10 * Math.PI) * 0.35;
      pts.push(p);
    }
    pts.push(to.clone());
    const bolts: THREE.Mesh[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const b = segmentMesh(pts[i], pts[i + 1], 0.035 * scale, i % 2 ? color : 0xffffff, 1);
      group.add(b); bolts.push(b);
    }
    const branches: THREE.Mesh[] = [];
    for (let i = 2; i < pts.length - 1; i += 2) {
      const end = pts[i].clone().addScaledVector(side, (i % 4 ? 0.35 : -0.35) * scale).add(new THREE.Vector3(0, 0.18, 0));
      const b = segmentMesh(pts[i], end, 0.018 * scale, 0xffffd8, 0.8);
      group.add(b); branches.push(b);
    }
    this.addTask(group, 0.34, (k) => {
      const pulse = k < 0.72 ? (0.65 + Math.sin(k * Math.PI * 18) * 0.35) : (1 - k) / 0.28;
      for (const b of [...bolts, ...branches]) opacity(b, Math.max(0, pulse));
      group.scale.setScalar(0.9 + Math.sin(k * Math.PI * 14) * 0.08);
      group.position.y = Math.sin(k * Math.PI * 12) * 0.025;
    }, 0.68, () => { this.burst(to, color, eff, scale * 1.15); onImpact?.(); });
    void len;
  }

  /** Thunderstorm strike: dark storm clouds gather in the sky above the target,
   *  flicker with inner light, then a jagged bolt cracks straight down onto it.
   *  Drives every Electric attack. */
  private thunderStorm(
    to: THREE.Vector3, color: number, scale: number, eff: number, onImpact?: () => void,
  ): void {
    const boltColor = color || 0xfff2a0;
    // High enough to read as "the sky" but within the battle camera frame (matches
    // the sky-spawn height that dracoMeteor's meteors use).
    const cloudY = to.y + 3.2 * scale;
    const group = new THREE.Group();

    // Dark storm clouds — a clustered ring of dim puffs high above the target.
    const cloudGeo = new THREE.SphereGeometry(1, 12, 8);
    const puffs: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const puff = new THREE.Mesh(cloudGeo, new THREE.MeshBasicMaterial({
        color: 0x272c37, transparent: true, opacity: 0, depthWrite: false,
      }));
      const a = (i / 10) * Math.PI * 2;
      const r = (0.4 + (i % 3) * 0.5) * scale;
      puff.position.set(to.x + Math.cos(a) * r, cloudY + ((i % 2) - 0.5) * 0.3 * scale, to.z + Math.sin(a) * r);
      puff.scale.set((0.9 + Math.random() * 0.7) * scale, (0.55 + Math.random() * 0.3) * scale, (0.9 + Math.random() * 0.7) * scale);
      group.add(puff); puffs.push(puff);
    }

    // Inner flash that flickers within the clouds before and during the strike.
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(1.5 * scale, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xcdd6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    flash.position.set(to.x, cloudY, to.z);
    group.add(flash);

    // The jagged bolt from the cloud base straight down onto the target.
    const boltTop = new THREE.Vector3(to.x, cloudY - 0.6 * scale, to.z);
    const segs = 9;
    const pts: THREE.Vector3[] = [boltTop.clone()];
    for (let i = 1; i < segs; i++) {
      const p = boltTop.clone().lerp(to, i / segs);
      p.x += (Math.random() - 0.5) * 0.55 * scale;
      p.z += (Math.random() - 0.5) * 0.55 * scale;
      pts.push(p);
    }
    pts.push(to.clone());
    const bolts: THREE.Mesh[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      bolts.push(segmentMesh(pts[i], pts[i + 1], 0.055 * scale, i % 2 ? 0xffffff : boltColor, 0));
    }
    const branches: THREE.Mesh[] = [];
    for (let i = 2; i < pts.length - 1; i += 2) {
      const end = pts[i].clone().add(new THREE.Vector3((i % 4 ? 0.42 : -0.42) * scale, -0.12 * scale, (i % 3 ? 0.24 : -0.3) * scale));
      branches.push(segmentMesh(pts[i], end, 0.026 * scale, 0xffffd8, 0));
    }
    for (const b of [...bolts, ...branches]) group.add(b);

    const dur = 0.95, strikeAt = 0.58;
    this.addTask(group, dur, (k) => {
      if (k < strikeAt) {
        // Clouds roll in, darken and swirl; inner light flickers.
        const g = k / strikeAt;
        group.rotation.y = g * 0.6;
        for (const p of puffs) opacity(p, Math.min(0.94, g * 1.15));
        opacity(flash, (Math.sin(k * Math.PI * 22) > 0.6 ? 0.32 : 0.03) * g);
        for (const b of [...bolts, ...branches]) opacity(b, 0);
      } else {
        // The bolt cracks down, flickers bright, then everything dissipates.
        const s = (k - strikeAt) / (1 - strikeAt);
        const flick = s < 0.5 ? (0.7 + Math.sin(s * Math.PI * 26) * 0.3) : Math.max(0, 1 - (s - 0.5) / 0.5);
        for (const b of bolts) opacity(b, flick);
        for (const b of branches) opacity(b, flick * 0.8);
        opacity(flash, s < 0.35 ? 0.9 * (1 - s / 0.35) : 0);
        flash.scale.setScalar((1 + s * 1.4) * scale);
        for (const p of puffs) opacity(p, 0.9 * Math.max(0, 1 - s * 1.1));
      }
    }, strikeAt, () => { this.burst(to, boltColor, eff, scale * 1.35); onImpact?.(); });
  }

  private waterWave(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const dir = to.clone().sub(from).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const crests: THREE.Mesh[] = [];
    for (let i = -3; i <= 3; i++) {
      const crest = new THREE.Mesh(
        new THREE.TorusGeometry((0.34 + Math.abs(i) * 0.025) * scale, 0.09 * scale, 7, 20, Math.PI),
        glowMaterial(i % 2 ? color : 0xd8f7ff, 0.64),
      );
      crest.position.copy(side).multiplyScalar(i * 0.27 * scale);
      crest.rotation.x = Math.PI / 2;
      crest.rotation.z = Math.atan2(dir.z, dir.x) - Math.PI / 2;
      group.add(crest); crests.push(crest);
    }
    const foam: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.07 + (i % 3) * 0.02, 7, 5), glowMaterial(0xffffff, 0.72));
      b.position.copy(side).multiplyScalar((i - 4.5) * 0.18).add(new THREE.Vector3(0, 0.18 + (i % 2) * 0.12, 0));
      group.add(b); foam.push(b);
    }
    group.position.copy(from);
    this.addTask(group, 0.56, (k) => {
      group.position.copy(from).lerp(to, easeInOut(k));
      group.position.y = 0.05 + Math.sin(k * Math.PI) * 0.38;
      group.scale.setScalar(0.72 + k * 0.62);
      for (let i = 0; i < crests.length; i++) {
        crests[i].rotation.y = Math.sin(k * Math.PI * 4 + i) * 0.16;
        opacity(crests[i], Math.min(1, (1 - k) * 1.7) * 0.68);
      }
      for (let i = 0; i < foam.length; i++) foam[i].position.y += Math.sin(k * 12 + i) * 0.006;
    }, 0.43, () => { this.burst(to, color, eff, scale * 1.18); onImpact?.(); });
  }

  private groundSurge(
    from: THREE.Vector3, to: THREE.Vector3, color: number,
    scale: number, eff: number, onImpact?: () => void,
  ): void {
    const group = new THREE.Group();
    const rocks: THREE.Mesh[] = [];
    for (let i = 0; i < 9; i++) {
      const p = from.clone().lerp(to, (i + 1) / 9);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry((0.12 + i * 0.012) * scale, 0), glowMaterial(i % 2 ? color : 0xd9bd83, 0.95));
      rock.position.set(p.x + (Math.random() - 0.5) * 0.28, -0.2, p.z + (Math.random() - 0.5) * 0.28);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      group.add(rock); rocks.push(rock);
    }
    this.addTask(group, 0.66, (k) => {
      for (let i = 0; i < rocks.length; i++) {
        const local = Math.max(0, Math.min(1, (k - i * 0.055) / 0.3));
        rocks[i].position.y = -0.18 + Math.sin(local * Math.PI) * (0.55 + i * 0.035) * scale;
        rocks[i].scale.setScalar(Math.max(0.01, Math.sin(local * Math.PI)));
        rocks[i].rotation.y += 0.08;
        opacity(rocks[i], local < 0.85 ? 1 : (1 - local) / 0.15);
      }
    }, 0.36, () => { this.burst(to, color, eff, scale * 1.2); onImpact?.(); });
  }

  private groundQuake(at: THREE.Vector3, color: number, scale: number): void {
    const group = new THREE.Group();
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry((0.16 + i * 0.14) * scale, (0.22 + i * 0.16) * scale, 9), glowMaterial(i % 2 ? 0xc89a5c : color, 0));
      ring.position.set(at.x, 0.025 + i * 0.004, at.z); ring.rotation.x = -Math.PI / 2; ring.rotation.z = i * 0.48;
      group.add(ring); rings.push(ring);
    }
    const rocks: THREE.Mesh[] = [];
    for (let i = 0; i < 14; i++) {
      const angle = i / 14 * Math.PI * 2, radius = (0.35 + (i % 5) * 0.18) * scale;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry((0.07 + (i % 4) * 0.025) * scale, 0), rockMaterial(i % 2 ? 0x755d46 : 0x987450));
      rock.position.set(at.x + Math.cos(angle) * radius, -0.12, at.z + Math.sin(angle) * radius);
      group.add(rock); rocks.push(rock);
    }
    this.addTask(group, 0.46, (k) => {
      rings.forEach((ring, i) => { ring.scale.setScalar(0.45 + k * (2.2 + i * 0.3)); opacity(ring, (1 - k) * 0.76); });
      rocks.forEach((rock, i) => {
        const local = Math.max(0, Math.min(1, (k - (i % 4) * 0.035) / 0.72));
        rock.position.y = -0.12 + Math.sin(local * Math.PI) * (0.45 + (i % 3) * 0.12) * scale;
        rock.rotation.set(k * 6 + i, k * 9, i);
        opacity(rock, Math.sin(local * Math.PI));
      });
    });
  }

  private flyLandingImpact(at: THREE.Vector3, color: number, scale: number): void {
    const group = new THREE.Group();
    group.position.set(at.x, 0.025, at.z);
    const shock = new THREE.Mesh(
      new THREE.RingGeometry(0.22 * scale, 0.34 * scale, 40),
      glowMaterial(mixWhite(color, 0.62), 0),
    );
    shock.rotation.x = -Math.PI / 2;
    group.add(shock);

    const puffs: THREE.Mesh[] = [];
    for (let i = 0; i < 18; i++) {
      const angle = i / 18 * Math.PI * 2;
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry((0.1 + (i % 4) * 0.025) * scale, 8, 6),
        statusMaterial(i % 3 ? 0xd9d4ca : 0xf4f1e9, 0),
      );
      puff.userData.angle = angle;
      puff.userData.lane = 0.34 + (i % 5) * 0.09;
      group.add(puff); puffs.push(puff);
    }
    const debris: THREE.Mesh[] = [];
    for (let i = 0; i < 12; i++) {
      const chip = new THREE.Mesh(
        new THREE.DodecahedronGeometry((0.035 + (i % 3) * 0.014) * scale, 0),
        statusMaterial(i % 2 ? 0x7b715f : 0xa39884, 0),
      );
      chip.userData.angle = i / 12 * Math.PI * 2 + 0.2;
      group.add(chip); debris.push(chip);
    }

    this.addTask(group, 0.62, (k) => {
      const burst = Math.sin(Math.min(1, k * 1.35) * Math.PI * 0.5);
      shock.scale.setScalar(0.5 + k * 3.6);
      opacity(shock, (1 - k) * 0.9);
      puffs.forEach((puff, i) => {
        const angle = Number(puff.userData.angle);
        const lane = Number(puff.userData.lane) * scale;
        const radius = burst * lane * (1.2 + k * 1.7);
        puff.position.set(Math.cos(angle) * radius, 0.08 + Math.sin(k * Math.PI) * (0.2 + (i % 3) * 0.08) * scale,
          Math.sin(angle) * radius);
        puff.scale.setScalar(0.25 + burst * (0.9 + (i % 3) * 0.13));
        opacity(puff, Math.sin(k * Math.PI) * (0.54 + (i % 3) * 0.12));
      });
      debris.forEach((chip, i) => {
        const angle = Number(chip.userData.angle);
        const radius = k * (0.65 + (i % 4) * 0.16) * scale;
        chip.position.set(Math.cos(angle) * radius,
          Math.sin(k * Math.PI) * (0.48 + (i % 3) * 0.16) * scale,
          Math.sin(angle) * radius);
        chip.rotation.set(k * 9 + i, k * 13, k * 7 + i * 0.2);
        opacity(chip, Math.sin(k * Math.PI));
      });
    });
  }

  private aerialImpact(at: THREE.Vector3, color: number, scale: number): void {
    const group = new THREE.Group(); group.position.copy(at).add(new THREE.Vector3(0, 0.85, 0));
    const arcs: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry((0.34 + i * 0.06) * scale, 0.03 * scale, 6, 28, Math.PI * 1.12), glowMaterial(i % 2 ? 0xffffff : color, 0));
      arc.rotation.set(0.2 + i * 0.14, 0.45 + i * 0.16, -1.1 + i * 0.38);
      group.add(arc); arcs.push(arc);
    }
    const feathers: THREE.Mesh[] = [];
    for (let i = 0; i < 12; i++) {
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.04 * scale, 0.2 * scale, 5), glowMaterial(i % 3 ? 0xdff7ff : color, 0));
      group.add(feather); feathers.push(feather);
    }
    this.addTask(group, 0.38, (k) => {
      const pulse = Math.sin(k * Math.PI);
      arcs.forEach((arc, i) => { arc.scale.setScalar(0.4 + k * (1.45 + i * 0.05)); arc.rotation.z += 0.11; opacity(arc, pulse * 0.9); });
      feathers.forEach((feather, i) => {
        const angle = i / 12 * Math.PI * 2 + k * 4;
        feather.position.set(Math.cos(angle) * k * 0.9 * scale, Math.sin(k * Math.PI) * 0.45 + (i % 3) * 0.08, Math.sin(angle) * k * 0.9 * scale);
        feather.rotation.set(k * 8 + i, k * 10, angle); opacity(feather, pulse);
      });
    });
  }

  private toxicJab(at: THREE.Vector3, color: number, scale: number): void {
    const group = new THREE.Group(); group.position.copy(at).add(new THREE.Vector3(0, 0.82, 0));
    const spear = new THREE.Mesh(new THREE.ConeGeometry(0.12 * scale, 1.25 * scale, 6), glowMaterial(0xd66bed, 0));
    spear.rotation.z = -Math.PI / 2; group.add(spear);
    const drops: THREE.Mesh[] = [];
    for (let i = 0; i < 14; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry((0.035 + (i % 3) * 0.012) * scale, 6, 4), glowMaterial(i % 2 ? color : 0x79228e, 0));
      group.add(drop); drops.push(drop);
    }
    this.addTask(group, 0.34, (k) => {
      const hit = Math.sin(k * Math.PI);
      spear.position.x = -0.7 + hit * 0.78; spear.scale.y = 0.4 + hit * 0.9; opacity(spear, hit);
      drops.forEach((drop, i) => {
        const a = i / 14 * Math.PI * 2;
        drop.position.set(Math.cos(a) * k * 0.7, Math.sin(k * Math.PI) * (0.25 + (i % 3) * 0.1), Math.sin(a) * k * 0.7);
        opacity(drop, hit);
      });
    });
  }

  private speedImpact(at: THREE.Vector3, color: number, scale: number): void {
    const group = new THREE.Group();
    const streaks: THREE.Mesh[] = [];
    for (let i = 0; i < 12; i++) {
      const y = at.y + 0.25 + (i % 5) * 0.18;
      const a = new THREE.Vector3(at.x - (1.1 + (i % 3) * 0.25) * scale, y, at.z + ((i % 4) - 1.5) * 0.1);
      const b = new THREE.Vector3(at.x + 0.18, y + ((i % 3) - 1) * 0.06, at.z);
      const streak = segmentMesh(a, b, (0.012 + (i % 3) * 0.006) * scale, i % 2 ? 0xffffff : color, 0);
      group.add(streak); streaks.push(streak);
    }
    this.addTask(group, 0.28, (k) => {
      const pulse = Math.sin(k * Math.PI);
      streaks.forEach((streak, i) => { streak.scale.x = 0.4 + k * 1.4; opacity(streak, pulse * (0.55 + (i % 3) * 0.15)); });
    });
  }

  private slashImpact(at: THREE.Vector3, color: number, scale: number): void {
    const group = new THREE.Group(); group.position.copy(at).add(new THREE.Vector3(0, 0.9, 0));
    const slashes: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const slash = new THREE.Mesh(new THREE.TorusGeometry(0.42 * scale, 0.045 * scale, 5, 20, Math.PI * 0.82), glowMaterial(i === 1 ? 0xffffff : color, 0.95));
      slash.rotation.set(0.35 + i * 0.22, 0.55, -0.85 + i * 0.52);
      slash.position.x = (i - 1) * 0.12;
      group.add(slash); slashes.push(slash);
    }
    this.addTask(group, 0.34, (k) => {
      group.scale.setScalar(0.5 + k * 1.35);
      for (const s of slashes) opacity(s, Math.sin(k * Math.PI));
      group.rotation.y = -0.25 + k * 0.5;
    });
  }

  private biteImpact(at: THREE.Vector3, color: number, scale: number): void {
    const group = new THREE.Group(); group.position.copy(at).add(new THREE.Vector3(0, 0.9, 0));
    const teeth: THREE.Mesh[] = [];
    for (const side of [-1, 1]) for (let i = -2; i <= 2; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.075 * scale, 0.28 * scale, 5), glowMaterial(i % 2 ? color : 0xffffff, 0.96));
      tooth.position.set(i * 0.13 * scale, side * 0.45 * scale, 0);
      tooth.rotation.z = side < 0 ? 0 : Math.PI;
      group.add(tooth); teeth.push(tooth);
    }
    this.addTask(group, 0.32, (k) => {
      const close = Math.sin(k * Math.PI);
      for (let i = 0; i < teeth.length; i++) {
        const side = i < 5 ? -1 : 1;
        teeth[i].position.y = side * (0.46 - close * 0.28) * scale;
        opacity(teeth[i], Math.sin(k * Math.PI));
      }
      group.scale.setScalar(0.8 + close * 0.35);
    });
  }

  private punchImpact(at: THREE.Vector3, color: number, scale: number): void {
    const group = new THREE.Group(); group.position.copy(at).add(new THREE.Vector3(0, 0.82, 0));
    const knuckles: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.13 * scale, 8, 6), glowMaterial(i % 2 ? color : 0xffffff, 0.94));
      k.position.set((i - 1.5) * 0.16 * scale, 0.12 * Math.sin(i), 0);
      group.add(k); knuckles.push(k);
    }
    this.addTask(group, 0.3, (k) => {
      const hit = Math.sin(k * Math.PI);
      group.position.z = at.z + (1 - hit) * 0.55;
      group.scale.setScalar(0.6 + hit * 0.75);
      for (const m of knuckles) opacity(m, hit);
    });
  }

  private rockImpact(at: THREE.Vector3, color: number, scale: number): void {
    const group = new THREE.Group();
    const rocks: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13 * scale, 0), glowMaterial(i % 2 ? color : 0xd7bd8c, 0.95));
      r.position.set(at.x + Math.cos(a) * 0.45, 0, at.z + Math.sin(a) * 0.45);
      group.add(r); rocks.push(r);
    }
    this.addTask(group, 0.42, (k) => {
      for (let i = 0; i < rocks.length; i++) {
        rocks[i].position.y = Math.sin(k * Math.PI) * (0.7 + (i % 3) * 0.18) * scale;
        rocks[i].rotation.y += 0.12;
        rocks[i].scale.setScalar(Math.sin(k * Math.PI));
        opacity(rocks[i], Math.sin(k * Math.PI));
      }
    });
  }

  private addTask(
    group: THREE.Group,
    dur: number,
    update: (k: number, dt: number, t: number) => void,
    impactAt?: number,
    impact?: () => void,
    done?: () => void,
  ): void {
    this.root.add(group);
    this.active.push({ group, t: 0, dur, update, impactAt, impact, done });
  }

  update(dt: number): void {
    const step = Math.min(0.05, Math.max(0, dt));
    for (const fx of this.persistentStatuses.values()) {
      fx.t += step;
      fx.group.position.copy(fx.anchor.position);
      if (fx.group.visible) fx.animate(fx.t, step);
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const fx = this.active[i];
      fx.t += step;
      const k = Math.min(1, fx.t / fx.dur);
      fx.update(k, dt, fx.t);
      if (!fx.impacted && fx.impactAt !== undefined && k >= fx.impactAt) {
        fx.impacted = true;
        fx.impact?.();
      }
      if (k >= 1) {
        this.root.remove(fx.group);
        disposeGroup(fx.group);
        this.active.splice(i, 1);
        fx.done?.();
      }
    }
  }
}

function glowMaterial(color: number, opacityValue: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: opacityValue,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

/** Persistent statuses use normal alpha blending so their identity colour is
 *  not blown out to white by bright snow, sky or arena lighting. */
function statusMaterial(color: number, opacityValue: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: opacityValue,
    blending: THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

function statusSegmentMesh(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: number, alpha: number): THREE.Mesh {
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 7, 1, false), statusMaterial(color, alpha));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  mesh.position.copy(a).lerp(b, 0.5);
  return mesh;
}

function rockMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.04,
    flatShading: true,
    emissive: new THREE.Color(color).multiplyScalar(0.12),
    transparent: true,
  });
}

function opacity(mesh: THREE.Object3D, value: number): void {
  const material = (mesh as THREE.Mesh).material;
  const mats = Array.isArray(material) ? material : material ? [material] : [];
  for (const m of mats) {
    const mm = m as THREE.Material & { opacity: number; transparent: boolean };
    mm.transparent = true; mm.opacity = Math.max(0, Math.min(1, value));
  }
}

function beamMesh(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: number, alpha: number): THREE.Mesh {
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10, 1, true), glowMaterial(color, alpha));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  mesh.position.copy(a).lerp(b, 0.5);
  return mesh;
}

function segmentMesh(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: number, alpha: number): THREE.Mesh {
  const mesh = beamMesh(a, b, radius, color, alpha);
  mesh.userData.a = a.clone(); mesh.userData.b = b.clone();
  return mesh;
}

function setBeamGrowth(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, k: number): void {
  mesh.scale.y = Math.max(0.001, k);
  mesh.position.copy(a).lerp(b, k * 0.5);
}

function easeInOut(k: number): number {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}

function disposeGroup(group: THREE.Group): void {
  group.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach(m => m.dispose());
    else material?.dispose?.();
  });
}

function mixWhite(color: number, t: number): number {
  return new THREE.Color(color).lerp(new THREE.Color(0xffffff), t).getHex();
}
