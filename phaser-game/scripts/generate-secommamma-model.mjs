import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// GLTFExporter uses FileReader for its binary blob even though this model has
// no external textures. Node supplies Blob but not FileReader.
globalThis.FileReader ??= class FileReader {
  result = null;
  onloadend = null;
  onerror = null;

  readAsArrayBuffer(blob) {
    blob.arrayBuffer()
      .then(buffer => { this.result = buffer; this.onloadend?.(); })
      .catch(error => this.onerror?.(error));
  }

  readAsDataURL(blob) {
    blob.arrayBuffer()
      .then(buffer => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
        this.onloadend?.();
      })
      .catch(error => this.onerror?.(error));
  }
};

const palette = {
  berry: 0xc84968,
  leaf: 0x5e9e48,
  leafLight: 0x79b85b,
  leafDark: 0x376d38,
  eyeGold: 0xc98b3c,
  eyeDark: 0x3d2419,
  seed: 0xf3d35d,
  highlight: 0xfff7dd,
  mouth: 0x293424,
};

const materials = new Map();
function material(color, roughness = 0.78) {
  const key = `${color}:${roughness}`;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0,
      flatShading: false,
    }));
  }
  return materials.get(key);
}

function addMesh(parent, name, geometry, color, options = {}) {
  const object = new THREE.Mesh(geometry, material(color, options.roughness));
  object.name = name;
  object.position.set(...(options.position ?? [0, 0, 0]));
  object.rotation.set(...(options.rotation ?? [0, 0, 0]));
  object.scale.set(...(options.scale ?? [1, 1, 1]));
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function leafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.56);
  shape.bezierCurveTo(-0.34, -0.28, -0.38, 0.2, 0, 0.58);
  shape.bezierCurveTo(0.38, 0.2, 0.34, -0.28, 0, -0.56);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.11,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.035,
    bevelThickness: 0.035,
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

const leafGeo = leafGeometry();
function leaf(parent, name, position, rotation, scale, color = palette.leaf) {
  return addMesh(parent, name, leafGeo, color, { position, rotation, scale });
}

const UP = new THREE.Vector3(0, 1, 0);
function stemBetween(parent, name, start, end, startRadius, endRadius, color = palette.leaf) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const mesh = addMesh(parent, name,
    new THREE.CylinderGeometry(endRadius, startRadius, direction.length(), 10, 1), color,
    { position: a.clone().add(b).multiplyScalar(0.5).toArray() });
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  return mesh;
}

const root = new THREE.Group();
root.name = 'Secommamma';

// The 2D design's large strawberry lower body becomes a full lathed volume,
// tapered at both ends and flattened slightly in depth like the illustration.
const berryProfile = [
  [0.04, 0], [0.25, 0.06], [0.46, 0.2], [0.63, 0.48],
  [0.71, 0.82], [0.68, 1.12], [0.56, 1.38], [0.3, 1.55], [0.02, 1.61],
].map(([radius, y]) => new THREE.Vector2(radius, y));
const berry = addMesh(root, 'BerryBody', new THREE.LatheGeometry(berryProfile, 28), palette.berry, {
  position: [0, 0.08, -0.02],
  scale: [1, 1, 0.82],
  roughness: 0.7,
});

// Golden strawberry seeds wrap around the curved front and sides.
const seedRows = [
  { y: 0.34, radius: 0.59, angles: [-0.7, 0, 0.7] },
  { y: 0.67, radius: 0.73, angles: [-0.95, -0.45, 0.15, 0.78] },
  { y: 1.0, radius: 0.74, angles: [-0.75, -0.15, 0.5, 0.92] },
  { y: 1.28, radius: 0.66, angles: [-0.5, 0.1, 0.65] },
];
let seedIndex = 0;
for (const row of seedRows) {
  for (const angle of row.angles) {
    const x = Math.sin(angle) * row.radius;
    const z = Math.cos(angle) * row.radius * 0.82;
    const seed = addMesh(root, `BerrySeed_${seedIndex++}`,
      new THREE.SphereGeometry(0.045, 8, 6), palette.seed, {
        position: [x, row.y + 0.08, z], scale: [0.7, 1.35, 0.38], roughness: 0.62,
      });
    seed.rotation.z = -angle * 0.32;
  }
}

// Lower crown and upper calyx make the berry read correctly from every side.
for (let i = 0; i < 5; i++) {
  const angle = i / 5 * Math.PI * 2;
  leaf(root, `BottomLeaf_${i}`,
    [Math.sin(angle) * 0.22, 0.16, Math.cos(angle) * 0.2 - 0.02],
    [Math.PI / 2, angle, angle], [0.42, 0.5, 0.72], palette.leafDark);
}
for (let i = 0; i < 6; i++) {
  const angle = i / 6 * Math.PI * 2;
  leaf(root, `BerryCalyx_${i}`,
    [Math.sin(angle) * 0.25, 1.5, Math.cos(angle) * 0.2],
    [Math.PI / 2, angle, angle], [0.46, 0.56, 0.78], palette.leafDark);
}

// Rounded plant torso and head, both fully volumetric.
addMesh(root, 'Torso', new THREE.SphereGeometry(0.48, 18, 12), palette.leafDark, {
  position: [0, 1.73, 0.01], scale: [0.76, 0.9, 0.7],
});
addMesh(root, 'Chest', new THREE.SphereGeometry(0.37, 16, 10), palette.leaf, {
  position: [0, 1.83, 0.24], scale: [0.78, 0.82, 0.42],
});
addMesh(root, 'Head', new THREE.SphereGeometry(0.52, 20, 14), palette.leaf, {
  position: [0, 2.29, 0.03], scale: [0.88, 0.8, 0.76],
});
addMesh(root, 'FaceMuzzle', new THREE.SphereGeometry(0.35, 16, 10), palette.leafLight, {
  position: [0, 2.22, 0.32], scale: [0.82, 0.58, 0.34],
});

// Long vine arms with rounded leaf-hands match the relaxed matron pose.
for (const side of [-1, 1]) {
  const shoulder = [side * 0.3, 1.85, 0.06];
  const elbow = [side * 0.45, 1.48, 0.18];
  const hand = [side * 0.66, 1.22 + (side > 0 ? 0.08 : 0), 0.23];
  stemBetween(root, `UpperArm_${side}`, shoulder, elbow, 0.13, 0.1, palette.leaf);
  stemBetween(root, `LowerArm_${side}`, elbow, hand, 0.105, 0.075, palette.leafLight);
  addMesh(root, `LeafHand_${side}`, new THREE.SphereGeometry(0.12, 10, 7), palette.leafLight, {
    position: hand, scale: [0.72, 1.28, 0.62],
    rotation: [0, 0, side * 0.42],
  });
}

// Eyes are layered volumes rather than painted pixels.
for (const side of [-1, 1]) {
  addMesh(root, `EyeRim_${side}`, new THREE.SphereGeometry(0.135, 12, 9), palette.eyeDark, {
    position: [side * 0.2, 2.32, 0.393], scale: [0.82, 1.18, 0.34],
  });
  addMesh(root, `Iris_${side}`, new THREE.SphereGeometry(0.108, 12, 9), palette.eyeGold, {
    position: [side * 0.2, 2.31, 0.43], scale: [0.78, 1.14, 0.28], roughness: 0.5,
  });
  addMesh(root, `Pupil_${side}`, new THREE.SphereGeometry(0.055, 10, 8), palette.eyeDark, {
    position: [side * 0.2, 2.315, 0.458], scale: [0.72, 1.18, 0.24],
  });
  addMesh(root, `EyeShine_${side}`, new THREE.SphereGeometry(0.028, 8, 6), palette.highlight, {
    position: [side * 0.18, 2.37, 0.476], scale: [0.72, 1, 0.22], roughness: 0.35,
  });
}

// A small curved smile is built as a tube so it remains readable when the model
// turns, unlike a texture decal.
const smileCurve = new THREE.QuadraticBezierCurve3(
  new THREE.Vector3(-0.09, 2.16, 0.49),
  new THREE.Vector3(0, 2.11, 0.51),
  new THREE.Vector3(0.09, 2.16, 0.49),
);
addMesh(root, 'Smile', new THREE.TubeGeometry(smileCurve, 10, 0.012, 5, false), palette.mouth, {
  roughness: 0.9,
});

// Layered leaf hair: a broad brim, side locks, rear canopy and the tall crown
// leaf from the illustration. Every leaf has bevelled depth.
leaf(root, 'HairBrim', [-0.05, 2.62, 0.16], [0.08, -0.08, 1.48], [0.74, 1.24, 1.12], palette.leafLight);
leaf(root, 'HairBackLeft', [-0.32, 2.53, -0.15], [0.1, -0.32, -0.52], [0.62, 0.94, 1.2], palette.leaf);
leaf(root, 'HairBackRight', [0.32, 2.53, -0.14], [0.08, 0.32, 0.5], [0.6, 0.9, 1.2], palette.leaf);
leaf(root, 'SideLockLeft', [-0.4, 2.2, 0.04], [0.05, -0.15, -0.18], [0.35, 0.7, 0.9], palette.leafDark);
leaf(root, 'SideLockRight', [0.4, 2.2, 0.04], [0.05, 0.15, 0.18], [0.35, 0.7, 0.9], palette.leafDark);
leaf(root, 'CrownLeaf', [0, 3.03, -0.01], [0.02, 0, 0], [0.58, 0.9, 1.28], palette.leafLight);

// Subtle leaf veins help the model retain the illustrated design at companion
// scale without requiring an image texture.
stemBetween(root, 'CrownVein', [0, 2.73, 0.075], [0, 3.29, 0.075], 0.018, 0.012, palette.leafDark);

root.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(root);
const size = bounds.getSize(new THREE.Vector3());
let meshes = 0;
root.traverse(object => { if (object.isMesh) meshes++; });
if ([size.x, size.y, size.z].some(value => !Number.isFinite(value) || value <= 0)) {
  throw new Error('Generated Secommamma has invalid bounds.');
}
if (size.z < size.x * 0.45 || meshes < 35) {
  throw new Error(`Secommamma is not volumetric enough (${meshes} meshes, depth ${size.z.toFixed(2)}).`);
}

const exporter = new GLTFExporter();
const result = await exporter.parseAsync(root, {
  binary: true,
  onlyVisible: true,
  truncateDrawRange: true,
  maxTextureSize: 1024,
});
if (!(result instanceof ArrayBuffer) || result.byteLength < 20_000) {
  throw new Error('GLTFExporter did not produce a valid binary Secommamma model.');
}

const output = fileURLToPath(new URL('../public/assets/models3d/secommamma.glb', import.meta.url));
await writeFile(output, new Uint8Array(result));
console.log(`Wrote ${output} (${result.byteLength} bytes, ${meshes} meshes, bounds ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)})`);
