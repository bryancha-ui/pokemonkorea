import * as THREE from 'three';
import { makeBlobShadow, toonMat } from './Props';

export type LanternStagePropKind = 'lantern' | 'dance-pad' | 'lotus' | 'gate';

export interface LanternStagePropModel3D {
  group: THREE.Group;
  setState(active: number, rotation: number, aligned: number, cue: number): void;
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

function cardinalYaw(rotation: number): number {
  return [Math.PI, Math.PI / 2, 0, -Math.PI / 2][((Math.round(rotation) % 4) + 4) % 4];
}

function buildLantern(color: number, beamLength: number): LanternStagePropModel3D {
  const group = new THREE.Group();
  group.name = 'lantern-stage-rotating-lantern';
  const wood = toonMat(0x402038);
  const gold = toonMat(0xd7a64b);
  const darkGold = toonMat(0x8c602b);
  const paper = new THREE.MeshBasicMaterial({ color: 0x3b293a, transparent: true, opacity: 0.72 });
  const glow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08 });
  const beamMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  mesh(group, new THREE.CylinderGeometry(0.38, 0.47, 0.18, 12), wood, [0, 0.09, 0], 'lantern-stage-plinth');
  mesh(group, new THREE.CylinderGeometry(0.1, 0.13, 1.28, 10), darkGold, [0, 0.72, 0], 'lantern-stage-post');
  mesh(group, new THREE.BoxGeometry(0.82, 0.09, 0.12), gold, [0, 1.36, 0], 'lantern-stage-yoke');

  const head = new THREE.Group();
  head.name = 'lantern-stage-turning-head';
  head.position.y = 1.05;
  group.add(head);
  mesh(head, new THREE.CylinderGeometry(0.29, 0.34, 0.58, 12), paper, [0, 0, 0], 'lantern-paper-body');
  mesh(head, new THREE.CylinderGeometry(0.36, 0.24, 0.12, 12), gold, [0, 0.35, 0], 'lantern-roof');
  mesh(head, new THREE.CylinderGeometry(0.29, 0.33, 0.08, 12), gold, [0, -0.33, 0], 'lantern-base');
  mesh(head, new THREE.SphereGeometry(0.18, 14, 10), glow, [0, 0, 0], 'lantern-light-core');
  for (const x of [-0.31, 0.31]) mesh(head, new THREE.BoxGeometry(0.035, 0.58, 0.035), darkGold, [x, 0, 0], 'lantern-rib');

  const beam = mesh(
    head,
    new THREE.CylinderGeometry(0.045, 0.46, beamLength, 14, 1, true),
    beamMaterial,
    [0, 0, beamLength / 2],
    'lantern-stage-light-beam',
  );
  beam.rotation.x = Math.PI / 2;
  const shadow = makeBlobShadow(0.5);
  group.add(shadow);

  let active = 0;
  let aligned = 0;
  let cue = 0;
  let rotation = 0;

  return {
    group,
    setState(nextActive, nextRotation, nextAligned, nextCue) {
      active = THREE.MathUtils.clamp(nextActive, 0, 1);
      aligned = THREE.MathUtils.clamp(nextAligned, 0, 1);
      cue = THREE.MathUtils.clamp(nextCue, 0, 1);
      rotation = nextRotation;
      head.rotation.y = cardinalYaw(rotation);
      paper.color.set(0x3b293a).lerp(new THREE.Color(color), active * 0.72);
      paper.opacity = 0.58 + active * 0.34;
      glow.opacity = 0.06 + active * (aligned > 0.5 ? 0.92 : 0.62);
      beam.visible = active > 0.02;
      beamMaterial.opacity = active * (0.14 + aligned * 0.2);
    },
    update(time) {
      const pulse = 1 + Math.sin(time * (aligned > 0.5 ? 3.1 : 4.7)) * (0.025 + cue * 0.08);
      head.scale.setScalar(pulse);
      glow.opacity = (0.06 + active * (aligned > 0.5 ? 0.82 : 0.52)) * (0.88 + Math.sin(time * 4.2) * 0.12);
      beamMaterial.opacity = active * (0.13 + aligned * 0.18 + cue * 0.13) * (0.9 + Math.sin(time * 2.7) * 0.1);
    },
  };
}

function buildFloorEmblem(kind: 'dance-pad' | 'lotus', color: number): LanternStagePropModel3D {
  const group = new THREE.Group();
  group.name = kind === 'lotus' ? 'lantern-stage-lotus-focus' : 'lantern-stage-dance-pad';
  const base = toonMat(kind === 'lotus' ? 0x493354 : 0x302642);
  const edge = toonMat(0xc69c55);
  const glow = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const radius = kind === 'lotus' ? 0.78 : 0.58;
  mesh(group, new THREE.CylinderGeometry(radius, radius * 1.04, 0.08, 24), base, [0, 0.04, 0], `${kind}-base`);
  const ring = mesh(group, new THREE.TorusGeometry(radius * 0.78, 0.045, 8, 24), edge, [0, 0.095, 0], `${kind}-gold-ring`);
  ring.rotation.x = Math.PI / 2;
  const petals: THREE.Mesh[] = [];
  const count = kind === 'lotus' ? 8 : 5;
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2;
    const petal = mesh(
      group,
      new THREE.SphereGeometry(kind === 'lotus' ? 0.21 : 0.16, 12, 8),
      glow,
      [Math.sin(angle) * radius * 0.43, 0.105, Math.cos(angle) * radius * 0.43],
      `${kind}-light-petal`,
    );
    petal.scale.set(0.72, 0.12, 1.3);
    petal.rotation.y = angle;
    petals.push(petal);
  }
  mesh(group, new THREE.SphereGeometry(0.14, 14, 10), glow, [0, 0.12, 0], `${kind}-light-core`);

  let active = 0;
  let cue = 0;
  let aligned = 0;
  return {
    group,
    setState(nextActive, _rotation, nextAligned, nextCue) {
      active = THREE.MathUtils.clamp(nextActive, 0, 1);
      aligned = THREE.MathUtils.clamp(nextAligned, 0, 1);
      cue = THREE.MathUtils.clamp(nextCue, 0, 1);
      glow.opacity = 0.08 + active * 0.62 + aligned * 0.18;
    },
    update(time) {
      const pulse = 1 + Math.sin(time * 5.4) * (0.018 + cue * 0.1);
      for (const petal of petals) petal.scale.y = (0.12 + cue * 0.04) * pulse;
      group.scale.setScalar(1 + cue * 0.08 + Math.sin(time * 4.2) * 0.012 * active);
      glow.opacity = (0.08 + active * 0.56 + aligned * 0.15 + cue * 0.14) * (0.9 + Math.sin(time * 3.8) * 0.1);
    },
  };
}

function buildGate(color: number): LanternStagePropModel3D {
  const group = new THREE.Group();
  group.name = 'lantern-stage-light-curtain';
  const wood = toonMat(0x3d1f43);
  const gold = toonMat(0xd1a654);
  for (const side of [-1, 1]) {
    mesh(group, new THREE.BoxGeometry(0.22, 2.1, 0.3), wood, [side * 1.75, 1.05, 0], 'stage-gate-post');
    mesh(group, new THREE.SphereGeometry(0.16, 12, 8), gold, [side * 1.75, 2.2, 0], 'stage-gate-finial');
  }
  mesh(group, new THREE.BoxGeometry(3.75, 0.22, 0.34), wood, [0, 2.13, 0], 'stage-gate-lintel');
  const curtainMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const curtain = mesh(group, new THREE.PlaneGeometry(3.25, 1.85), curtainMaterial, [0, 1.02, 0.02], 'stage-light-curtain');
  const rays: THREE.Mesh[] = [];
  for (let index = 0; index < 7; index++) {
    rays.push(mesh(group, new THREE.BoxGeometry(0.035, 1.8, 0.04), gold, [-1.38 + index * 0.46, 1.02, 0.07], 'stage-curtain-ray'));
  }
  let closed = 1;
  return {
    group,
    setState(active) {
      closed = THREE.MathUtils.clamp(active, 0, 1);
      curtain.visible = closed > 0.02;
      curtainMaterial.opacity = 0.3 * closed;
      for (const ray of rays) ray.visible = curtain.visible;
    },
    update(time) {
      if (!curtain.visible) return;
      curtainMaterial.opacity = closed * (0.27 + Math.sin(time * 3.5) * 0.06);
      rays.forEach((ray, index) => { ray.scale.y = 0.92 + Math.sin(time * 4.1 + index) * 0.08; });
    },
  };
}

export function buildLanternStageProp3D(
  kind: LanternStagePropKind,
  color: number,
  beamLength = 5.4,
): LanternStagePropModel3D {
  if (kind === 'lantern') return buildLantern(color, Math.max(1, beamLength));
  if (kind === 'gate') return buildGate(color);
  return buildFloorEmblem(kind, color);
}
