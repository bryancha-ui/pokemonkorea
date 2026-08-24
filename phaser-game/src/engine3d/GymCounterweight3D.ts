import * as THREE from 'three';
import { makeBlobShadow, toonMat } from './Props';

export interface GymCounterweightModel3D {
  group: THREE.Group;
  setAligned(progress: number): void;
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

/**
 * A true volumetric dojo counterweight: iron-edged stone drum, suspended chain,
 * overhead pulley and a broad top surface that doubles as the crossing stone.
 */
export function buildGymCounterweight3D(): GymCounterweightModel3D {
  const group = new THREE.Group();
  group.name = 'summit-dojo-counterweight';

  const stone = toonMat(0x615b54);
  const stoneTop = toonMat(0x8a8176);
  const iron = toonMat(0x25282c);
  const ironEdge = toonMat(0x4b5156);
  const bronze = toonMat(0xb17832);
  const status = toonMat(0x9a3e2f);

  // Broad enough to read as the only safe step across the floor gap.
  addMesh(group, new THREE.CylinderGeometry(0.66, 0.72, 0.28, 20), stone, [0, 0.2, 0], 'weight-stone-drum');
  addMesh(group, new THREE.CylinderGeometry(0.57, 0.63, 0.08, 20), stoneTop, [0, 0.38, 0], 'weight-step-surface');
  const rim = addMesh(group, new THREE.TorusGeometry(0.64, 0.055, 8, 24), ironEdge, [0, 0.35, 0], 'weight-iron-rim');
  rim.rotation.x = Math.PI / 2;
  addMesh(group, new THREE.CylinderGeometry(0.13, 0.16, 0.26, 12), bronze, [0, 0.55, 0], 'weight-chain-socket');
  addMesh(group, new THREE.BoxGeometry(0.34, 0.12, 0.08), status, [0, 0.55, 0.13], 'weight-alignment-plate');

  // Suspended mechanism sells the object as a moving counterweight rather than
  // another flat stepping stone. The floor collision remains Phaser-authoritative.
  for (const x of [-0.13, 0.13]) {
    addMesh(group, new THREE.CylinderGeometry(0.022, 0.022, 1.04, 8), iron, [x, 1.15, 0], 'weight-chain');
  }
  const pulley = addMesh(group, new THREE.CylinderGeometry(0.24, 0.24, 0.18, 16), ironEdge, [0, 1.72, 0], 'weight-pulley');
  pulley.rotation.z = Math.PI / 2;
  addMesh(group, new THREE.CylinderGeometry(0.085, 0.085, 0.28, 12), bronze, [0, 1.72, 0], 'weight-pulley-axle')
    .rotation.z = Math.PI / 2;
  addMesh(group, new THREE.BoxGeometry(1.15, 0.12, 0.2), iron, [0, 1.98, 0], 'weight-overhead-yoke');

  const lampMaterial = new THREE.MeshBasicMaterial({ color: 0xff5945 });
  const lamp = addMesh(group, new THREE.SphereGeometry(0.09, 12, 8), lampMaterial, [0, 0.56, 0.15], 'weight-status-lamp');
  const shadow = makeBlobShadow(0.72);
  group.add(shadow);

  const red = new THREE.Color(0xff5945);
  const green = new THREE.Color(0x7dff9c);
  const rust = new THREE.Color(0x9a3e2f);
  const gold = new THREE.Color(0xd7a24a);
  let alignment = 0;

  return {
    group,
    setAligned(progress: number) {
      alignment = THREE.MathUtils.clamp(progress, 0, 1);
      lampMaterial.color.copy(red).lerp(green, alignment);
      status.color.copy(rust).lerp(gold, alignment);
    },
    update(time: number) {
      const pulse = 0.88 + Math.sin(time * (alignment > 0.99 ? 2.8 : 5.4)) * 0.12;
      lamp.scale.setScalar(pulse);
      // A misaligned mechanism strains against its chain; aligned weights settle.
      group.rotation.z = alignment > 0.99 ? 0 : Math.sin(time * 2.1) * 0.018;
    },
  };
}
