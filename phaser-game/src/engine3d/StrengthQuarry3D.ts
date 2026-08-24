import * as THREE from 'three';
import { makeBlobShadow, toonMat } from './Props';
import type { StrengthRune } from '../systems/StrengthQuarryPuzzle';

export type StrengthQuarryPropKind = 'boulder' | 'hole' | 'chasm' | 'reset';

export interface StrengthQuarryModel3D {
  group: THREE.Group;
  setState(moving: number, filled: number, solved: number, cue: number): void;
  update(time: number): void;
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  name: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = !material.transparent;
  mesh.receiveShadow = !material.transparent;
  parent.add(mesh);
  return mesh;
}

function runeGeometry(rune: StrengthRune): THREE.BufferGeometry {
  if (rune === 'circle') return new THREE.TorusGeometry(0.24, 0.05, 7, 18);
  if (rune === 'triangle') return new THREE.CylinderGeometry(0.28, 0.28, 0.07, 3);
  return new THREE.BoxGeometry(0.4, 0.07, 0.4);
}

function buildBoulder(rune: StrengthRune, accent: number): StrengthQuarryModel3D {
  const group = new THREE.Group();
  group.name = 'dolmoe-strength-boulder';
  const stone = toonMat(rune === 'triangle' ? 0x414047 : rune === 'square' ? 0x817b6c : 0x625f5b);
  const stoneLight = toonMat(rune === 'triangle' ? 0x65636b : rune === 'square' ? 0xa39b88 : 0x85817b);
  const glow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.9 });
  const rock = addMesh(group, new THREE.DodecahedronGeometry(0.56, 1), stone, [0, 0.52, 0], 'strength-irregular-boulder');
  rock.scale.set(1.02, 0.94, 0.98);
  const cap = addMesh(group, new THREE.DodecahedronGeometry(0.36, 0), stoneLight, [-0.11, 0.79, -0.06], 'strength-boulder-highlight');
  cap.scale.set(1.05, 0.32, 0.92);
  const runeMesh = addMesh(group, runeGeometry(rune), glow, [0, 1.01, 0], `strength-rune-${rune}`);
  if (rune === 'circle') runeMesh.rotation.x = Math.PI / 2;
  const dustMaterial = new THREE.MeshBasicMaterial({ color: 0xc9b48d, transparent: true, opacity: 0.5, depthWrite: false });
  const dust: THREE.Mesh[] = [];
  for (let index = 0; index < 8; index++) {
    const angle = index / 8 * Math.PI * 2;
    dust.push(addMesh(group, new THREE.SphereGeometry(0.045, 6, 4), dustMaterial, [Math.cos(angle) * 0.64, 0.08, Math.sin(angle) * 0.64], 'strength-push-dust'));
  }
  group.add(makeBlobShadow(0.62));
  let moving = 0;
  let filled = 0;
  let cue = 0;
  return {
    group,
    setState(nextMoving, nextFilled, _solved, nextCue) {
      moving = THREE.MathUtils.clamp(nextMoving, 0, 1);
      filled = THREE.MathUtils.clamp(nextFilled, 0, 1);
      cue = THREE.MathUtils.clamp(nextCue, 0, 1);
      group.position.y = -filled * 0.22;
      glow.opacity = 0.68 + cue * 0.28;
      dust.forEach(particle => { particle.visible = moving > 0.02 && filled < 0.98; });
    },
    update(time) {
      if (moving > 0.02) rock.rotation.z += 0.035 * moving;
      runeMesh.position.y = 1.01 + Math.sin(time * 3.2) * 0.018;
      dust.forEach((particle, index) => {
        const pulse = 0.78 + Math.sin(time * 8 + index) * 0.22;
        particle.scale.setScalar(pulse);
      });
    },
  };
}

function buildHole(rune: StrengthRune, accent: number): StrengthQuarryModel3D {
  const group = new THREE.Group();
  group.name = 'dolmoe-strength-rune-hole';
  const rim = toonMat(0x8a8174);
  const darkness = new THREE.MeshBasicMaterial({ color: 0x050506 });
  const glow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.72 });
  const ring = addMesh(group, new THREE.TorusGeometry(0.57, 0.1, 9, 24), rim, [0, 0.04, 0], 'strength-hole-stone-rim');
  ring.rotation.x = Math.PI / 2;
  const voidMesh = addMesh(group, new THREE.CylinderGeometry(0.48, 0.38, 0.18, 20), darkness, [0, -0.06, 0], 'strength-hole-dark-void');
  const runeMesh = addMesh(group, runeGeometry(rune), glow, [0, 0.045, 0], `strength-hole-rune-${rune}`);
  if (rune === 'circle') runeMesh.rotation.x = Math.PI / 2;
  let filled = 0;
  return {
    group,
    setState(_moving, nextFilled) {
      filled = THREE.MathUtils.clamp(nextFilled, 0, 1);
      voidMesh.visible = filled < 0.98;
      runeMesh.visible = filled < 0.98;
      ring.scale.setScalar(1 + filled * 0.04);
    },
    update(time) {
      if (filled > 0.98) return;
      glow.opacity = 0.55 + Math.sin(time * 3.8) * 0.16;
      runeMesh.rotation.y = time * 0.35;
    },
  };
}

function buildChasm(width: number, depth: number): StrengthQuarryModel3D {
  const group = new THREE.Group();
  group.name = 'dolmoe-strength-quarry-chasm';
  const voidMaterial = new THREE.MeshBasicMaterial({ color: 0x050407, side: THREE.DoubleSide });
  const wall = toonMat(0x302b27);
  const stone = toonMat(0x716b62);
  const moss = toonMat(0x766b43);
  const pit = addMesh(group, new THREE.PlaneGeometry(width, depth), voidMaterial, [0, -0.08, 0], 'strength-bottomless-fissure');
  pit.rotation.x = -Math.PI / 2;
  addMesh(group, new THREE.BoxGeometry(width + 0.2, 0.28, 0.18), wall, [0, 0.02, -depth / 2], 'strength-chasm-north-rim');
  addMesh(group, new THREE.BoxGeometry(width + 0.2, 0.28, 0.18), wall, [0, 0.02, depth / 2], 'strength-chasm-south-rim');
  const bridge = new THREE.Group();
  bridge.name = 'strength-completed-boulder-bridge';
  group.add(bridge);
  // The chasm mesh is centered on the full room while the authored holes sit at
  // columns 6, 8 and 10. Their exact local offsets keep the raised 3D stones
  // aligned with the Phaser collision cells (36 px tiles at 32 px/world unit).
  for (const x of [-2.8125, -0.5625, 1.6875]) {
    const slab = addMesh(bridge, new THREE.DodecahedronGeometry(0.82, 1), stone, [x, 0.15, 0], 'strength-filled-hole-crossing-stone');
    slab.scale.set(1.42, 0.24, Math.max(1.1, depth * 0.72));
    const patch = addMesh(bridge, new THREE.BoxGeometry(1.82, 0.035, depth * 0.72), moss, [x, 0.38, 0], 'strength-bridge-worn-top');
    patch.rotation.y = x * 0.08;
  }
  let solved = 0;
  return {
    group,
    setState(_moving, _filled, nextSolved) {
      solved = THREE.MathUtils.clamp(nextSolved, 0, 1);
      bridge.visible = solved > 0.98;
    },
    update(time) {
      if (solved > 0.98) bridge.position.y = Math.sin(time * 1.7) * 0.008;
    },
  };
}

function buildResetPedestal(accent: number): StrengthQuarryModel3D {
  const group = new THREE.Group();
  group.name = 'dolmoe-strength-reset-pedestal';
  const stone = toonMat(0x514943);
  const metal = toonMat(0xb38943);
  const glow = new THREE.MeshBasicMaterial({ color: accent });
  addMesh(group, new THREE.CylinderGeometry(0.42, 0.52, 0.72, 12), stone, [0, 0.36, 0], 'strength-reset-base');
  const lever = addMesh(group, new THREE.CylinderGeometry(0.055, 0.055, 0.68, 8), metal, [0, 0.9, 0], 'strength-reset-lever');
  lever.rotation.z = -0.55;
  const lamp = addMesh(group, new THREE.SphereGeometry(0.1, 10, 7), glow, [0.2, 1.17, 0], 'strength-reset-lamp');
  let cue = 0;
  return {
    group,
    setState(_moving, _filled, _solved, nextCue) { cue = THREE.MathUtils.clamp(nextCue, 0, 1); },
    update(time) { lamp.scale.setScalar(0.9 + Math.sin(time * 3.3) * 0.08 + cue * 0.18); },
  };
}

export function buildStrengthQuarryProp3D(
  kind: StrengthQuarryPropKind,
  width: number,
  depth: number,
  rune: StrengthRune,
  accent: number,
): StrengthQuarryModel3D {
  if (kind === 'boulder') return buildBoulder(rune, accent);
  if (kind === 'hole') return buildHole(rune, accent);
  if (kind === 'chasm') return buildChasm(width, depth);
  return buildResetPedestal(accent);
}
