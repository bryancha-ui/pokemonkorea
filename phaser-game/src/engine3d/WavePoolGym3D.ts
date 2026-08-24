import * as THREE from 'three';
import { makeBlobShadow, toonMat } from './Props';

export type WaveGymPropKind = 'pool' | 'surfboard';

export interface WaveGymPropModel3D {
  group: THREE.Group;
  setState(active: number, cleared: number, intensity: number, lean: number, cue: number): void;
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

function buildWavePool(width: number, depth: number, accent: number): WaveGymPropModel3D {
  const group = new THREE.Group();
  group.name = 'harang-gym-wave-pool';
  const waterMaterial = new THREE.MeshBasicMaterial({
    color: 0x1676a8,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const water = mesh(group, new THREE.PlaneGeometry(width, depth), waterMaterial, [0, 0.035, 0], 'wave-pool-water');
  water.rotation.x = -Math.PI / 2;

  const rim = toonMat(0x244b60);
  mesh(group, new THREE.BoxGeometry(width + 0.28, 0.13, 0.22), rim, [0, 0.07, -depth / 2], 'wave-pool-north-rim');
  mesh(group, new THREE.BoxGeometry(width + 0.28, 0.13, 0.22), rim, [0, 0.07, depth / 2], 'wave-pool-south-rim');

  const foamMaterial = new THREE.MeshBasicMaterial({
    color: 0xd7f7ff,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const crests: THREE.Mesh[] = [];
  for (let index = 0; index < 7; index++) {
    const crest = mesh(
      group,
      new THREE.BoxGeometry(width * (0.72 + (index % 2) * 0.14), 0.035, 0.075),
      foamMaterial,
      [index % 2 ? width * 0.05 : -width * 0.05, 0.09, -depth / 2 + index / 6 * depth],
      'wave-pool-foam-crest',
    );
    crests.push(crest);
  }

  const bridge = new THREE.Group();
  bridge.name = 'wave-pool-cleared-checkpoint-bridge';
  group.add(bridge);
  const plank = toonMat(0xd59a48);
  const rail = toonMat(0x31566a);
  const plankCount = Math.max(6, Math.ceil(depth / 0.42));
  for (let index = 0; index < plankCount; index++) {
    const z = -depth / 2 + (index + 0.5) * depth / plankCount;
    mesh(bridge, new THREE.BoxGeometry(1.28, 0.09, depth / plankCount * 0.78), plank, [0, 0.14, z], 'checkpoint-floating-plank');
  }
  for (const x of [-0.74, 0.74]) {
    mesh(bridge, new THREE.BoxGeometry(0.055, 0.34, depth), rail, [x, 0.3, 0], 'checkpoint-bridge-rail');
  }

  const beaconMaterial = new THREE.MeshBasicMaterial({ color: accent });
  for (const x of [-0.86, 0.86]) {
    mesh(group, new THREE.CylinderGeometry(0.07, 0.09, 0.72, 10), rim, [x, 0.36, -depth / 2 - 0.08], 'wave-checkpoint-post');
    mesh(group, new THREE.SphereGeometry(0.1, 12, 8), beaconMaterial, [x, 0.78, -depth / 2 - 0.08], 'wave-checkpoint-beacon');
  }

  let active = 1;
  let cleared = 0;
  let intensity = 1;
  let cue = 0;
  return {
    group,
    setState(nextActive, nextCleared, nextIntensity, _lean, nextCue) {
      active = THREE.MathUtils.clamp(nextActive, 0, 1);
      cleared = THREE.MathUtils.clamp(nextCleared, 0, 1);
      intensity = Math.max(0.2, nextIntensity);
      cue = THREE.MathUtils.clamp(nextCue, 0, 1);
      waterMaterial.opacity = 0.42 + active * 0.25;
      bridge.visible = cleared > 0.02;
      beaconMaterial.color.set(cleared > 0.5 ? 0x76ffb1 : accent);
      for (const crest of crests) crest.visible = cleared < 0.98;
    },
    update(time) {
      if (cleared > 0.98) {
        bridge.position.y = Math.sin(time * 2.2) * 0.018;
        return;
      }
      const speed = 0.42 + intensity * 0.32;
      crests.forEach((crest, index) => {
        const cycle = ((time * speed + index * depth / crests.length) % depth + depth) % depth;
        crest.position.z = -depth / 2 + cycle;
        crest.position.y = 0.09 + Math.sin(time * (2.6 + intensity) + index * 0.8) * (0.035 + intensity * 0.028);
        crest.scale.y = 1 + Math.sin(time * 4.1 + index) * 0.25 + cue * 0.35;
      });
      waterMaterial.opacity = (0.4 + active * 0.24) * (0.96 + Math.sin(time * 2.4) * 0.04);
    },
  };
}

function buildSurfboard(accent: number): WaveGymPropModel3D {
  const group = new THREE.Group();
  group.name = 'harang-gym-surfboard';
  const boardMaterial = toonMat(accent);
  const edgeMaterial = toonMat(0xf2ead5);
  const gripMaterial = toonMat(0x173347);
  const board = mesh(group, new THREE.SphereGeometry(0.5, 18, 10), boardMaterial, [0, 0.12, 0], 'gym-surfboard-deck');
  board.scale.set(0.54, 0.11, 1.5);
  const edge = mesh(group, new THREE.TorusGeometry(0.47, 0.035, 7, 22), edgeMaterial, [0, 0.16, 0], 'gym-surfboard-edge');
  edge.rotation.x = Math.PI / 2;
  edge.scale.set(0.54, 1.5, 1);
  mesh(group, new THREE.BoxGeometry(0.16, 0.025, 1.18), gripMaterial, [0, 0.185, -0.02], 'gym-surfboard-grip');
  const fin = mesh(group, new THREE.ConeGeometry(0.11, 0.3, 8), gripMaterial, [0, 0.01, 0.52], 'gym-surfboard-fin');
  fin.rotation.x = Math.PI;
  const foamMaterial = new THREE.MeshBasicMaterial({
    color: 0xdffaff,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const foam = mesh(group, new THREE.TorusGeometry(0.48, 0.035, 6, 22), foamMaterial, [0, 0.04, 0.42], 'gym-surfboard-foam');
  foam.rotation.x = Math.PI / 2;
  foam.scale.set(0.78, 1.05, 1);
  const shadow = makeBlobShadow(0.58);
  group.add(shadow);

  let active = 0;
  let intensity = 1;
  let lean = 0;
  let cue = 0;
  return {
    group,
    setState(nextActive, _cleared, nextIntensity, nextLean, nextCue) {
      active = THREE.MathUtils.clamp(nextActive, 0, 1);
      intensity = Math.max(0.2, nextIntensity);
      lean = THREE.MathUtils.clamp(nextLean, -1.25, 1.25);
      cue = THREE.MathUtils.clamp(nextCue, 0, 1);
      group.visible = active > 0.01;
      group.rotation.z = -lean * 0.3;
    },
    update(time) {
      if (active <= 0.01) return;
      group.position.y = Math.sin(time * (4.2 + intensity)) * (0.025 + intensity * 0.012);
      group.rotation.x = Math.sin(time * (3.5 + intensity)) * 0.035 * intensity;
      foamMaterial.opacity = 0.56 + Math.sin(time * 7.2) * 0.12 + cue * 0.16;
      foam.scale.x = 0.76 + Math.sin(time * 5.4) * 0.04;
    },
  };
}

export function buildWaveGymProp3D(
  kind: WaveGymPropKind,
  width: number,
  depth: number,
  accent: number,
): WaveGymPropModel3D {
  return kind === 'pool' ? buildWavePool(width, depth, accent) : buildSurfboard(accent);
}
