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

  constructor(private root: THREE.Group) {}

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

  /** Physical moves use the model's lunge, then get an attack-specific contact. */
  physicalImpact(at: THREE.Vector3, moveType: string, moveName: string, color: number, power: number, eff: number): void {
    const type = moveType.toLowerCase(), name = moveName.toLowerCase();
    const scale = Math.max(0.75, Math.min(1.55, 0.75 + power / 130));
    if (name === 'outlaw leafstorm') {
      this.outlawLeafstorm(at, color, scale);
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
    for (let i = this.active.length - 1; i >= 0; i--) {
      const fx = this.active[i];
      fx.t += Math.min(0.05, Math.max(0, dt));
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
