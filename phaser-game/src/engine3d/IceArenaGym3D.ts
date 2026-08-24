import * as THREE from 'three';
import { makeBlobShadow, toonMat } from './Props';

export type IceArenaPropKind = 'short-track' | 'speed-lane' | 'figure-rink' | 'gate' | 'start-beacon' | 'skate-trail';

export interface IceArenaModel3D {
  group: THREE.Group;
  setState(active: number, cleared: number, cue: number): void;
  update(time: number): void;
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  name: string,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.position.set(...position);
  result.castShadow = !material.transparent;
  result.receiveShadow = !material.transparent;
  parent.add(result);
  return result;
}

function sparkleRing(parent: THREE.Object3D, radiusX: number, radiusZ: number, color: number): THREE.Mesh[] {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false });
  const result: THREE.Mesh[] = [];
  for (let index = 0; index < 16; index++) {
    const angle = index / 16 * Math.PI * 2;
    result.push(mesh(parent, new THREE.OctahedronGeometry(0.045, 0), material,
      [Math.cos(angle) * radiusX, 0.12, Math.sin(angle) * radiusZ], 'ice-arena-sparkle'));
  }
  return result;
}

function rinkBase(width: number, depth: number): { group: THREE.Group; ice: THREE.Mesh; sparkles: THREE.Mesh[] } {
  const group = new THREE.Group();
  const iceMaterial = toonMat(0xa9e8f5);
  iceMaterial.transparent = true;
  iceMaterial.opacity = 0.88;
  const ice = mesh(group, new THREE.BoxGeometry(width, 0.08, depth), iceMaterial, [0, 0.02, 0], 'ice-arena-frozen-surface');
  const sparkles = sparkleRing(group, width * 0.43, depth * 0.39, 0xe9fdff);
  return { group, ice, sparkles };
}

function buildShortTrack(width: number, depth: number, accent: number): IceArenaModel3D {
  const { group, ice, sparkles } = rinkBase(width, depth);
  group.name = 'seorae-short-track-rink';
  const lane = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
  for (const scale of [0.94, 0.76]) {
    const ring = mesh(group, new THREE.RingGeometry(0.82, 0.86, 64), lane, [0, 0.075, 0], 'short-track-oval-lane');
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(width * 0.5 * scale, depth * 0.5 * scale, 1);
  }
  const island = mesh(group, new THREE.CylinderGeometry(0.5, 0.5, 0.1, 48), toonMat(0xeaf8fa), [0, 0.09, 0], 'short-track-snow-infield');
  island.scale.set(width * 0.55, 1, depth * 0.48);
  for (const side of [-1, 1]) {
    for (let index = -2; index <= 2; index++) {
      mesh(group, new THREE.ConeGeometry(0.08, 0.28, 10), toonMat(0xf67b35),
        [side * width * 0.3, 0.17, index * depth * 0.095], 'short-track-corner-cone');
    }
  }
  let active = 0;
  let cleared = 0;
  return {
    group,
    setState(nextActive, nextCleared) {
      active = THREE.MathUtils.clamp(nextActive, 0, 1);
      cleared = THREE.MathUtils.clamp(nextCleared, 0, 1);
      (lane as THREE.MeshBasicMaterial).color.setHex(cleared > 0.98 ? 0x63e2a8 : accent);
      ice.position.y = 0.02 + active * 0.025;
    },
    update(time) {
      sparkles.forEach((item, index) => item.scale.setScalar(0.65 + Math.sin(time * 3.8 + index) * 0.22 + active * 0.25));
    },
  };
}

function buildSpeedLane(width: number, depth: number, accent: number): IceArenaModel3D {
  const { group, ice, sparkles } = rinkBase(width, depth);
  group.name = 'seorae-speed-skating-straight';
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.78 });
  for (const x of [-0.34, 0, 0.34]) {
    mesh(group, new THREE.BoxGeometry(0.035, 0.018, depth * 0.92), stripeMaterial, [x * width, 0.075, 0], 'speed-skating-lane-line');
  }
  for (const z of [-0.44, 0.44]) {
    mesh(group, new THREE.BoxGeometry(width * 0.9, 0.022, 0.055), toonMat(0xffffff), [0, 0.085, z * depth], 'speed-skating-start-finish-line');
  }
  const arch = new THREE.Group();
  group.add(arch);
  for (const x of [-width * 0.42, width * 0.42]) {
    mesh(arch, new THREE.CylinderGeometry(0.07, 0.08, 1.5, 10), toonMat(0x315c88), [x, 0.75, -depth * 0.43], 'speed-finish-post');
  }
  mesh(arch, new THREE.BoxGeometry(width * 0.9, 0.14, 0.14), toonMat(accent), [0, 1.47, -depth * 0.43], 'speed-finish-banner');
  let active = 0;
  let cleared = 0;
  return {
    group,
    setState(nextActive, nextCleared) {
      active = THREE.MathUtils.clamp(nextActive, 0, 1);
      cleared = THREE.MathUtils.clamp(nextCleared, 0, 1);
      arch.position.y = cleared * 0.12;
      ice.position.y = 0.02 + active * 0.025;
    },
    update(time) {
      sparkles.forEach((item, index) => item.scale.setScalar(0.68 + Math.sin(time * 4.4 + index * 0.7) * 0.2 + cleared * 0.2));
    },
  };
}

function buildFigureRink(width: number, depth: number, accent: number): IceArenaModel3D {
  const { group, ice, sparkles } = rinkBase(width, depth);
  group.name = 'seorae-figure-skating-rink';
  const lineMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.68, side: THREE.DoubleSide });
  for (const radius of [0.2, 0.38, 0.57]) {
    const ring = mesh(group, new THREE.RingGeometry(radius, radius + 0.018, 48), lineMaterial, [0, 0.08, 0], 'figure-skating-choreography-ring');
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(width * 0.72, depth * 0.72, 1);
  }
  for (let arm = 0; arm < 6; arm++) {
    const spoke = mesh(group, new THREE.BoxGeometry(width * 0.56, 0.02, 0.035), lineMaterial, [0, 0.085, 0], 'figure-skating-snowflake-mark');
    spoke.rotation.y = arm * Math.PI / 3;
  }
  let active = 0;
  let cleared = 0;
  return {
    group,
    setState(nextActive, nextCleared) {
      active = THREE.MathUtils.clamp(nextActive, 0, 1);
      cleared = THREE.MathUtils.clamp(nextCleared, 0, 1);
      lineMaterial.opacity = 0.5 + active * 0.35 + cleared * 0.1;
      ice.position.y = 0.02 + active * 0.025;
    },
    update(time) {
      sparkles.forEach((item, index) => {
        item.position.y = 0.12 + Math.sin(time * 2.8 + index) * 0.04;
        item.scale.setScalar(0.7 + Math.sin(time * 4 + index) * 0.2 + active * 0.24);
      });
    },
  };
}

function buildGate(width: number, accent: number): IceArenaModel3D {
  const group = new THREE.Group();
  group.name = 'seorae-ice-arena-event-gate';
  const post = toonMat(0x36546d);
  const armMaterial = toonMat(accent);
  for (const x of [-width / 2, width / 2]) {
    mesh(group, new THREE.CylinderGeometry(0.12, 0.15, 1.75, 12), post, [x, 0.88, 0], 'ice-event-gate-post');
  }
  const leftArm = mesh(group, new THREE.BoxGeometry(width / 2, 0.16, 0.16), armMaterial, [-width / 2, 1.35, 0], 'ice-event-gate-left-arm');
  const rightArm = mesh(group, new THREE.BoxGeometry(width / 2, 0.16, 0.16), armMaterial, [width / 2, 1.35, 0], 'ice-event-gate-right-arm');
  leftArm.geometry.translate(width / 4, 0, 0);
  rightArm.geometry.translate(-width / 4, 0, 0);
  let cleared = 0;
  return {
    group,
    setState(_active, nextCleared) {
      cleared = THREE.MathUtils.clamp(nextCleared, 0, 1);
      leftArm.rotation.z = cleared * Math.PI * 0.48;
      rightArm.rotation.z = -cleared * Math.PI * 0.48;
    },
    update(time) { group.position.y = Math.sin(time * 1.8) * 0.008 * (1 - cleared); },
  };
}

function buildStartBeacon(accent: number): IceArenaModel3D {
  const group = new THREE.Group();
  group.name = 'seorae-ice-sport-start-beacon';
  const glow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.72 });
  const ring = mesh(group, new THREE.TorusGeometry(0.48, 0.07, 9, 28), glow, [0, 0.07, 0], 'ice-sport-start-ring');
  ring.rotation.x = Math.PI / 2;
  const crystal = mesh(group, new THREE.OctahedronGeometry(0.18, 0), glow, [0, 0.5, 0], 'ice-sport-start-crystal');
  group.add(makeBlobShadow(0.42));
  let active = 0;
  let cleared = 0;
  let cue = 0;
  return {
    group,
    setState(nextActive, nextCleared, nextCue) {
      active = THREE.MathUtils.clamp(nextActive, 0, 1);
      cleared = THREE.MathUtils.clamp(nextCleared, 0, 1);
      cue = THREE.MathUtils.clamp(nextCue, 0, 1);
      group.visible = cleared < 0.98;
    },
    update(time) {
      ring.rotation.z = time * 0.55;
      crystal.position.y = 0.5 + Math.sin(time * 3.4) * 0.08;
      crystal.scale.setScalar(0.9 + active * 0.18 + cue * 0.22);
    },
  };
}

function buildSkateTrail(accent: number): IceArenaModel3D {
  const group = new THREE.Group();
  group.name = 'seorae-live-skate-trails';
  const glow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.62, depthWrite: false });
  const trails = [-0.13, 0.13].map(x => mesh(group, new THREE.BoxGeometry(0.045, 0.025, 1.15), glow, [x, 0.035, 0.48], 'ice-skate-cut-trail'));
  const spray = sparkleRing(group, 0.34, 0.38, 0xeaffff);
  let active = 0;
  return {
    group,
    setState(nextActive) { active = THREE.MathUtils.clamp(nextActive, 0, 1); group.visible = active > 0.02; },
    update(time) {
      trails.forEach((trail, index) => { trail.scale.z = 0.75 + Math.sin(time * 5 + index) * 0.16; });
      spray.forEach((item, index) => item.scale.setScalar(active * (0.45 + Math.sin(time * 7 + index) * 0.2)));
    },
  };
}

export function buildIceArenaProp3D(
  kind: IceArenaPropKind,
  width: number,
  depth: number,
  accent: number,
): IceArenaModel3D {
  if (kind === 'short-track') return buildShortTrack(width, depth, accent);
  if (kind === 'speed-lane') return buildSpeedLane(width, depth, accent);
  if (kind === 'figure-rink') return buildFigureRink(width, depth, accent);
  if (kind === 'gate') return buildGate(width, accent);
  if (kind === 'start-beacon') return buildStartBeacon(accent);
  return buildSkateTrail(accent);
}
