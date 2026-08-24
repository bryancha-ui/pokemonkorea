import * as THREE from 'three';
import { makeBlobShadow, toonMat } from './Props';

export type WorldTreePropKind = 'trunk' | 'branch' | 'summit';

export interface WorldTreeGymModel3D {
  group: THREE.Group;
  setState(visited: number, selected: number, elevation: number, trainerActive: number, cue: number): void;
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

function leafCluster(parent: THREE.Object3D, x: number, y: number, z: number, scale: number): THREE.Group {
  const cluster = new THREE.Group();
  cluster.position.set(x, y, z);
  cluster.userData.baseY = y;
  parent.add(cluster);
  const dark = toonMat(0x245d2c);
  const light = toonMat(0x4f9b45);
  for (let index = 0; index < 4; index++) {
    const angle = index / 4 * Math.PI * 2;
    const leaf = addMesh(
      cluster,
      new THREE.IcosahedronGeometry(scale * (0.62 + (index % 2) * 0.1), 1),
      index % 2 ? light : dark,
      [Math.cos(angle) * scale * 0.45, Math.sin(index * 1.7) * scale * 0.16, Math.sin(angle) * scale * 0.45],
      'world-tree-leaf-cluster',
    );
    leaf.scale.y = 0.72;
  }
  return cluster;
}

function buildTrunk(): WorldTreeGymModel3D {
  const group = new THREE.Group();
  group.name = 'forest-gym-world-tree';
  const bark = toonMat(0x5a351d);
  const barkLight = toonMat(0x80512c);
  const vine = toonMat(0x39753a);
  const glow = new THREE.MeshBasicMaterial({ color: 0xa8ffc1, transparent: true, opacity: 0.62 });

  addMesh(group, new THREE.CylinderGeometry(0.72, 1.18, 7.7, 14), bark, [0, 3.85, 0], 'world-tree-massive-trunk');
  for (let ring = 0; ring < 7; ring++) {
    const y = 0.75 + ring * 1.03;
    const radius = 1.04 - ring * 0.055;
    const knot = addMesh(group, new THREE.TorusGeometry(radius, 0.055, 7, 20), barkLight, [0, y, 0], 'world-tree-growth-ring');
    knot.rotation.x = Math.PI / 2;
    knot.rotation.z = ring * 0.43;
  }
  const spiral = new THREE.Group();
  spiral.name = 'world-tree-climbing-vine';
  group.add(spiral);
  for (let step = 0; step < 20; step++) {
    const angle = step * 0.88;
    addMesh(
      spiral,
      new THREE.SphereGeometry(0.075, 8, 6),
      step % 4 === 0 ? glow : vine,
      [Math.cos(angle) * (1.02 - step * 0.012), 0.45 + step * 0.36, Math.sin(angle) * (1.02 - step * 0.012)],
      'world-tree-vine-node',
    );
  }
  const clusters = [
    leafCluster(group, -1.8, 5.9, 0.2, 1.25),
    leafCluster(group, 1.8, 6.25, -0.35, 1.35),
    leafCluster(group, 0.1, 7.5, 0.15, 1.7),
    leafCluster(group, -0.6, 4.75, -1.2, 1.05),
    leafCluster(group, 0.7, 4.4, 1.25, 1.0),
  ];
  let selected = 0;
  return {
    group,
    setState(_visited, nextSelected) { selected = THREE.MathUtils.clamp(nextSelected, 0, 1); },
    update(time) {
      clusters.forEach((cluster, index) => {
        cluster.rotation.y = Math.sin(time * 0.35 + index) * 0.055;
        cluster.position.y = Number(cluster.userData.baseY) + Math.sin(time * 1.1 + index) * 0.035;
      });
      glow.opacity = 0.52 + Math.sin(time * 2.2) * 0.12 + selected * 0.18;
    },
  };
}

function buildBranch(length: number, width: number, yaw: number, accent: number): WorldTreeGymModel3D {
  const group = new THREE.Group();
  group.name = 'forest-gym-jump-branch';
  group.rotation.y = yaw;
  const bark = toonMat(0x704526);
  const barkTop = toonMat(0x95623a);
  const moss = toonMat(0x4e8d43);
  const status = new THREE.MeshBasicMaterial({ color: accent });

  const limb = addMesh(group, new THREE.CylinderGeometry(width * 0.38, width * 0.56, length, 12), bark, [0, 0.18, 0], 'world-tree-jump-limb');
  limb.rotation.z = Math.PI / 2;
  addMesh(group, new THREE.CylinderGeometry(width * 0.5, width * 0.58, 0.18, 14), barkTop, [0, 0.32, 0], 'world-tree-landing-platform');
  const mossPatch = addMesh(group, new THREE.CircleGeometry(width * 0.48, 16), moss, [0, 0.42, 0], 'world-tree-branch-moss');
  mossPatch.rotation.x = -Math.PI / 2;
  for (const side of [-1, 1]) {
    const twig = addMesh(group, new THREE.CylinderGeometry(0.035, 0.06, width * 0.95, 7), bark, [side * length * 0.24, 0.2, side * width * 0.52], 'world-tree-branch-twig');
    twig.rotation.x = Math.PI / 2;
    leafCluster(group, side * length * 0.31, 0.48, side * width * 0.72, width * 0.55);
  }
  const beacon = addMesh(group, new THREE.SphereGeometry(0.105, 12, 8), status, [0, 0.72, 0], 'world-tree-branch-beacon');
  const trainerRing = addMesh(group, new THREE.TorusGeometry(width * 0.4, 0.035, 7, 18), status, [0, 0.44, 0], 'world-tree-trainer-ring');
  trainerRing.rotation.x = Math.PI / 2;
  group.add(makeBlobShadow(width * 0.65));

  const neutral = new THREE.Color(accent);
  const visitedColor = new THREE.Color(0x8cff91);
  const selectedColor = new THREE.Color(0xfff07a);
  let selected = 0;
  let visited = 0;
  let cue = 0;
  return {
    group,
    setState(nextVisited, nextSelected, elevation, trainerActive, nextCue) {
      visited = THREE.MathUtils.clamp(nextVisited, 0, 1);
      selected = THREE.MathUtils.clamp(nextSelected, 0, 1);
      cue = THREE.MathUtils.clamp(nextCue, 0, 1);
      group.position.y = Math.max(0, elevation);
      status.color.copy(neutral).lerp(visitedColor, visited).lerp(selectedColor, selected);
      trainerRing.visible = trainerActive > 0.02;
    },
    update(time) {
      const pulse = 0.88 + Math.sin(time * (selected > 0.5 ? 6.2 : 2.7)) * (0.08 + selected * 0.12);
      beacon.scale.setScalar(pulse + cue * 0.18);
      trainerRing.rotation.z = time * 0.55;
      mossPatch.position.y = 0.42 + Math.sin(time * 1.7 + yaw) * 0.008;
    },
  };
}

function buildSummit(accent: number): WorldTreeGymModel3D {
  const group = new THREE.Group();
  group.name = 'forest-gym-world-tree-summit';
  const bark = toonMat(0x74502f);
  const moss = toonMat(0x78b85a);
  const gold = new THREE.MeshBasicMaterial({ color: accent });
  addMesh(group, new THREE.CylinderGeometry(1.55, 1.35, 0.35, 22), bark, [0, 0.2, 0], 'world-tree-summit-platform');
  addMesh(group, new THREE.CylinderGeometry(1.36, 1.38, 0.1, 22), moss, [0, 0.42, 0], 'world-tree-summit-moss');
  const halo = addMesh(group, new THREE.TorusGeometry(1.25, 0.055, 8, 32), gold, [0, 0.5, 0], 'world-tree-summit-halo');
  halo.rotation.x = Math.PI / 2;
  for (let index = 0; index < 6; index++) {
    const angle = index / 6 * Math.PI * 2;
    leafCluster(group, Math.cos(angle) * 1.45, 0.72, Math.sin(angle) * 1.45, 0.58);
  }
  let selected = 0;
  return {
    group,
    setState(visited, nextSelected, elevation) {
      selected = THREE.MathUtils.clamp(nextSelected, 0, 1);
      group.position.y = Math.max(0, elevation);
      gold.color.set(visited > 0.5 ? 0x9dff8e : accent);
    },
    update(time) {
      halo.rotation.z = time * (0.18 + selected * 0.35);
      halo.scale.setScalar(1 + Math.sin(time * 2.4) * 0.025 + selected * 0.06);
    },
  };
}

export function buildWorldTreeGymProp3D(
  kind: WorldTreePropKind,
  length: number,
  width: number,
  yaw: number,
  accent: number,
): WorldTreeGymModel3D {
  if (kind === 'trunk') return buildTrunk();
  if (kind === 'summit') return buildSummit(accent);
  return buildBranch(length, width, yaw, accent);
}
