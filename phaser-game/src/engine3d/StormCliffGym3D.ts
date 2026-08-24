import * as THREE from 'three';
import { makeBlobShadow, toonMat } from './Props';

export type StormCliffPropKind = 'platform' | 'rod' | 'receiver' | 'insulated-pad' | 'gate' | 'elevator' | 'lightning';

export interface StormCliffModel3D {
  group: THREE.Group;
  setState(direction: number, height: number, charged: number, active: number, cue: number): void;
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

function cylinderBetween(
  parent: THREE.Object3D,
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  const midpoint = from.clone().add(to).multiplyScalar(0.5);
  const direction = to.clone().sub(from);
  const result = mesh(parent, new THREE.CylinderGeometry(radius, radius, direction.length(), 7), material,
    [midpoint.x, midpoint.y, midpoint.z], name);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  return result;
}

function buildPlatform(width: number, depth: number, accent: number): StormCliffModel3D {
  const group = new THREE.Group();
  group.name = 'sunrise-storm-cliff-platform';
  const rock = toonMat(0x263044);
  const steel = toonMat(0x496780);
  const glow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.55 });
  mesh(group, new THREE.BoxGeometry(width, 0.62, depth), rock, [0, -0.26, 0], 'storm-cliff-volumetric-rock-deck');
  mesh(group, new THREE.BoxGeometry(width * 0.94, 0.08, depth * 0.92), steel, [0, 0.08, 0], 'storm-cliff-steel-walkway');
  for (const x of [-width / 2 + 0.16, width / 2 - 0.16]) {
    mesh(group, new THREE.BoxGeometry(0.08, 0.62, depth), steel, [x, 0.38, 0], 'storm-cliff-safety-rail');
  }
  const edge = mesh(group, new THREE.BoxGeometry(width * 0.86, 0.035, 0.07), glow, [0, 0.15, -depth * 0.42], 'storm-cliff-live-edge-light');
  let cue = 0;
  return {
    group,
    setState(_direction, _height, _charged, _active, nextCue) {
      cue = THREE.MathUtils.clamp(nextCue, 0, 1);
    },
    update(time) { (edge.material as THREE.MeshBasicMaterial).opacity = 0.38 + cue * 0.34 + Math.sin(time * 2.2) * 0.08; },
  };
}

function buildRod(accent: number): StormCliffModel3D {
  const group = new THREE.Group();
  group.name = 'sunrise-adjustable-lightning-rod';
  const baseMaterial = toonMat(0x374151);
  const metal = toonMat(0xa9c3d4);
  const darkMetal = toonMat(0x50677a);
  const glow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.76 });
  mesh(group, new THREE.CylinderGeometry(0.55, 0.7, 0.35, 12), baseMaterial, [0, 0.18, 0], 'lightning-rod-ground-base');
  mesh(group, new THREE.TorusGeometry(0.58, 0.07, 8, 24), glow, [0, 0.36, 0], 'lightning-rod-charge-ring').rotation.x = Math.PI / 2;
  const lowerMast = mesh(group, new THREE.CylinderGeometry(0.09, 0.12, 1.65, 10), darkMetal, [0, 1.12, 0], 'lightning-rod-lower-mast');
  const upper = new THREE.Group();
  upper.name = 'lightning-rod-telescoping-head';
  group.add(upper);
  mesh(upper, new THREE.CylinderGeometry(0.055, 0.08, 1.4, 9), metal, [0, 1.95, 0], 'lightning-rod-upper-mast');
  mesh(upper, new THREE.ConeGeometry(0.13, 0.48, 9), metal, [0, 2.87, 0], 'lightning-rod-spike');
  const arrow = new THREE.Group();
  arrow.name = 'lightning-rod-directional-arm';
  upper.add(arrow);
  mesh(arrow, new THREE.BoxGeometry(1.15, 0.09, 0.09), metal, [0.45, 2.35, 0], 'lightning-rod-aim-arm');
  mesh(arrow, new THREE.ConeGeometry(0.16, 0.35, 8), metal, [1.05, 2.35, 0], 'lightning-rod-aim-tip').rotation.z = -Math.PI / 2;
  const chargeOrb = mesh(upper, new THREE.SphereGeometry(0.16, 12, 8), glow, [0, 2.62, 0], 'lightning-rod-charge-orb');
  group.add(makeBlobShadow(0.72));
  let active = 0;
  let charged = 0;
  let cue = 0;
  return {
    group,
    setState(direction, height, nextCharged, nextActive, nextCue) {
      arrow.rotation.y = -Math.round(direction) * Math.PI / 2;
      upper.position.y = THREE.MathUtils.clamp(height, 0, 1) * 0.78;
      charged = THREE.MathUtils.clamp(nextCharged, 0, 1);
      active = THREE.MathUtils.clamp(nextActive, 0, 1);
      cue = THREE.MathUtils.clamp(nextCue, 0, 1);
      glow.color.setHex(charged > 0.98 ? 0x74ffbd : accent);
      lowerMast.scale.y = 1 + active * 0.035;
    },
    update(time) {
      chargeOrb.scale.setScalar(0.86 + charged * 0.28 + cue * 0.3 + Math.sin(time * 5.4) * 0.08);
      (glow as THREE.MeshBasicMaterial).opacity = 0.48 + active * 0.14 + cue * 0.28;
    },
  };
}

function buildInsulatedPad(accent: number): StormCliffModel3D {
  const group = new THREE.Group();
  group.name = 'sunrise-insulated-safety-pad';
  const rubber = toonMat(0x20242a);
  const warning = toonMat(0xf2c94c);
  const glow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.52 });
  mesh(group, new THREE.CylinderGeometry(0.78, 0.84, 0.12, 24), rubber, [0, 0.06, 0], 'insulated-pad-rubber-base');
  const ring = mesh(group, new THREE.TorusGeometry(0.61, 0.1, 8, 28), warning, [0, 0.14, 0], 'insulated-pad-warning-ring');
  ring.rotation.x = Math.PI / 2;
  const shield = mesh(group, new THREE.CylinderGeometry(0.4, 0.4, 0.035, 20), glow, [0, 0.15, 0], 'insulated-pad-live-shield');
  let cue = 0;
  return {
    group,
    setState(_direction, _height, _charged, _active, nextCue) { cue = THREE.MathUtils.clamp(nextCue, 0, 1); },
    update(time) {
      shield.scale.setScalar(0.9 + cue * 0.22 + Math.sin(time * 4.5) * 0.06);
      (glow as THREE.MeshBasicMaterial).opacity = 0.34 + cue * 0.5;
    },
  };
}

function buildReceiver(accent: number): StormCliffModel3D {
  const group = new THREE.Group();
  group.name = 'sunrise-lightning-receiver-beacon';
  const base = toonMat(0x35485d);
  const metal = toonMat(0xa8bfce);
  const glow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.76 });
  mesh(group, new THREE.CylinderGeometry(0.42, 0.5, 0.42, 12), base, [0, 0.21, 0], 'storm-receiver-base');
  const mast = mesh(group, new THREE.CylinderGeometry(0.06, 0.08, 1.1, 9), metal, [0, 0.92, 0], 'storm-receiver-height-mast');
  const dish = mesh(group, new THREE.ConeGeometry(0.38, 0.18, 16, 1, true), metal, [0, 1.47, 0], 'storm-receiver-dish');
  dish.rotation.x = Math.PI;
  const orb = mesh(group, new THREE.SphereGeometry(0.12, 10, 7), glow, [0, 1.65, 0], 'storm-receiver-lock-light');
  group.add(makeBlobShadow(0.48));
  let charged = 0;
  let active = 0;
  return {
    group,
    setState(direction, height, nextCharged, nextActive) {
      group.rotation.y = -Math.round(direction) * Math.PI / 2;
      mast.scale.y = height > 0.5 ? 1.55 : 0.82;
      mast.position.y = height > 0.5 ? 1.2 : 0.74;
      dish.position.y = height > 0.5 ? 1.98 : 1.19;
      orb.position.y = height > 0.5 ? 2.17 : 1.38;
      charged = THREE.MathUtils.clamp(nextCharged, 0, 1);
      active = THREE.MathUtils.clamp(nextActive, 0, 1);
      glow.color.setHex(charged > 0.98 ? 0x72ffb6 : accent);
    },
    update(time) {
      orb.scale.setScalar(0.86 + charged * 0.3 + active * 0.18 + Math.sin(time * 4.8) * 0.08);
      (glow as THREE.MeshBasicMaterial).opacity = 0.48 + active * 0.28 + charged * 0.18;
    },
  };
}

function buildGate(width: number, accent: number): StormCliffModel3D {
  const group = new THREE.Group();
  group.name = 'sunrise-storm-bridge-gate';
  const steel = toonMat(0x405a71);
  const glow = toonMat(accent);
  for (const x of [-width / 2, width / 2]) {
    mesh(group, new THREE.CylinderGeometry(0.12, 0.15, 1.4, 10), steel, [x, 0.7, 0], 'storm-gate-post');
  }
  const bridge = new THREE.Group();
  bridge.name = 'storm-gate-extending-bridge';
  group.add(bridge);
  mesh(bridge, new THREE.BoxGeometry(width, 0.14, 1.75), steel, [0, 0.05, 0], 'storm-gate-bridge-deck');
  const barrier = mesh(group, new THREE.BoxGeometry(width, 0.16, 0.15), glow, [0, 0.92, 0], 'storm-gate-energy-barrier');
  let open = 0;
  return {
    group,
    setState(_direction, _height, charged) {
      open = THREE.MathUtils.clamp(charged, 0, 1);
      bridge.visible = open > 0.98;
      barrier.visible = open < 0.98;
    },
    update(time) { if (open < 0.98) barrier.scale.y = 0.82 + Math.sin(time * 6) * 0.18; },
  };
}

function buildElevator(accent: number): StormCliffModel3D {
  const group = new THREE.Group();
  group.name = 'sunrise-lightning-powered-elevator';
  const steel = toonMat(0x516b82);
  const dark = toonMat(0x27384b);
  const glow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.72 });
  mesh(group, new THREE.CylinderGeometry(1.25, 1.35, 0.24, 20), steel, [0, 0.12, 0], 'storm-elevator-platform');
  for (const x of [-1.12, 1.12]) {
    mesh(group, new THREE.CylinderGeometry(0.07, 0.08, 2.2, 9), dark, [x, 1.1, 0], 'storm-elevator-guide-rail');
  }
  const coil = mesh(group, new THREE.TorusGeometry(0.78, 0.09, 8, 30), glow, [0, 0.28, 0], 'storm-elevator-tesla-coil');
  coil.rotation.x = Math.PI / 2;
  let raised = 0;
  let active = 0;
  return {
    group,
    setState(_direction, height, charged, nextActive) {
      raised = THREE.MathUtils.clamp(height, 0, 1);
      active = THREE.MathUtils.clamp(nextActive, 0, 1);
      glow.color.setHex(charged > 0.98 ? 0x78ffbc : accent);
      group.position.y = raised * 0.6;
    },
    update(time) {
      coil.rotation.z = time * (0.4 + active * 1.6);
      (glow as THREE.MeshBasicMaterial).opacity = 0.48 + active * 0.35 + Math.sin(time * 4.8) * 0.08;
    },
  };
}

function buildLightning(accent: number): StormCliffModel3D {
  const group = new THREE.Group();
  group.name = 'sunrise-volumetric-lightning-strike';
  const core = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending });
  const glow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false });
  const segments: THREE.Mesh[] = [];
  const points = [
    new THREE.Vector3(0.2, 8.8, -0.15), new THREE.Vector3(-0.22, 7.2, 0.1),
    new THREE.Vector3(0.18, 5.7, -0.08), new THREE.Vector3(-0.14, 4.1, 0.12),
    new THREE.Vector3(0.08, 2.7, 0), new THREE.Vector3(0, 0.3, 0),
  ];
  for (let index = 0; index < points.length - 1; index++) {
    segments.push(cylinderBetween(group, points[index], points[index + 1], index % 2 ? 0.055 : 0.075, core, 'storm-main-lightning-bolt'));
  }
  for (let index = 1; index < 4; index++) {
    const origin = points[index];
    const end = origin.clone().add(new THREE.Vector3(index % 2 ? 0.9 : -0.85, -0.8, 0.35));
    segments.push(cylinderBetween(group, origin, end, 0.025, glow, 'storm-branch-lightning-bolt'));
  }
  const arc = cylinderBetween(group, new THREE.Vector3(0, 2.4, 0), new THREE.Vector3(2.4, 1.1, 0), 0.035, glow, 'storm-directed-chain-arc');
  let active = 0;
  let charged = 0;
  return {
    group,
    setState(direction, _height, nextCharged, nextActive) {
      active = THREE.MathUtils.clamp(nextActive, 0, 1);
      charged = THREE.MathUtils.clamp(nextCharged, 0, 1);
      group.visible = active > 0.02 || charged > 0.98;
      group.rotation.y = -Math.round(direction) * Math.PI / 2;
      segments.forEach(segment => { segment.visible = active > 0.02; });
      arc.visible = active > 0.02 || charged > 0.98;
    },
    update(time) {
      group.scale.x = 0.92 + Math.sin(time * 31) * 0.08;
      arc.scale.y = charged > 0.98 ? 0.72 + Math.sin(time * 8) * 0.16 : 1;
      (glow as THREE.MeshBasicMaterial).opacity = 0.52 + Math.sin(time * 18) * 0.22;
    },
  };
}

export function buildStormCliffProp3D(
  kind: StormCliffPropKind,
  width: number,
  depth: number,
  accent: number,
): StormCliffModel3D {
  if (kind === 'platform') return buildPlatform(width, depth, accent);
  if (kind === 'rod') return buildRod(accent);
  if (kind === 'receiver') return buildReceiver(accent);
  if (kind === 'insulated-pad') return buildInsulatedPad(accent);
  if (kind === 'gate') return buildGate(width, accent);
  if (kind === 'elevator') return buildElevator(accent);
  return buildLightning(accent);
}
