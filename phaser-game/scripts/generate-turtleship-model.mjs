import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Node has Blob but not FileReader. GLTFExporter only needs these two methods
// for this texture-free binary model.
globalThis.FileReader ??= class FileReader {
  result = null;
  onloadend = null;
  onerror = null;

  readAsArrayBuffer(blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      })
      .catch((error) => this.onerror?.(error));
  }

  readAsDataURL(blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
        this.onloadend?.();
      })
      .catch((error) => this.onerror?.(error));
  }
};

const palette = {
  armour: 0xc84a32,
  armourDark: 0x74302b,
  belly: 0x20242c,
  bellySoft: 0x34333a,
  cannon: 0x25262c,
  cannonEdge: 0x17181d,
  gold: 0xe7b84f,
  goldLight: 0xffd56d,
  jade: 0x4d8f87,
  eye: 0xa8fff1,
  pupil: 0x163b3b,
};

const materials = new Map();
function material(color, metalness = 0.1) {
  const key = `${color}:${metalness}`;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({
      color,
      roughness: metalness > 0.4 ? 0.42 : 0.72,
      metalness,
      flatShading: true,
    }));
  }
  return materials.get(key);
}

function mesh(parent, name, geometry, color, {
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  metalness = 0.1,
} = {}) {
  const object = new THREE.Mesh(geometry, material(color, metalness));
  object.name = name;
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function fin(parent, name, position, rotation, scale, color = palette.gold) {
  return mesh(parent, name, new THREE.ConeGeometry(0.22, 0.72, 4), color, {
    position, rotation, scale,
  });
}

const root = new THREE.Group();
root.name = 'Turtleship';

// Feet and legs anchor the silhouette. The teal toe armour echoes the source art.
for (const side of [-1, 1]) {
  mesh(root, `Leg_${side < 0 ? 'L' : 'R'}`,
    new THREE.CylinderGeometry(0.22, 0.27, 0.72, 8), palette.belly, {
      position: [side * 0.39, 0.46, 0.02],
      rotation: [0.08, 0, -side * 0.18],
      scale: [1, 1, 1.12],
    });
  mesh(root, `Foot_${side < 0 ? 'L' : 'R'}`,
    new THREE.SphereGeometry(0.3, 10, 7), palette.belly, {
      position: [side * 0.43, 0.17, 0.22],
      scale: [1.08, 0.55, 1.32],
    });
  mesh(root, `ToePlate_${side < 0 ? 'L' : 'R'}`,
    new THREE.SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), palette.jade, {
      position: [side * 0.43, 0.18, 0.48],
      rotation: [Math.PI / 2, 0, 0],
      scale: [1.0, 0.58, 0.55],
      metalness: 0.28,
    });
}

// Armoured turtle body and broad ship-like shell.
mesh(root, 'Belly', new THREE.SphereGeometry(0.68, 14, 10), palette.belly, {
  position: [0, 1.0, 0.08],
  scale: [0.86, 1.16, 0.72],
});
mesh(root, 'Shell', new THREE.SphereGeometry(0.84, 14, 10), palette.armour, {
  position: [0, 1.02, -0.28],
  scale: [1.03, 1.0, 0.62],
  metalness: 0.22,
});
mesh(root, 'ShellKeel', new THREE.CylinderGeometry(0.42, 0.58, 1.38, 8), palette.armourDark, {
  position: [0, 0.98, -0.66],
  rotation: [Math.PI / 2, 0, 0],
  scale: [1.05, 0.55, 0.62],
  metalness: 0.2,
});

// Decorative shell plating and gun ports give the hull a clear turtle-ship read.
for (const side of [-1, 1]) {
  for (const y of [0.72, 1.04, 1.36]) {
    mesh(root, `GunPort_${side}_${y}`,
      new THREE.CylinderGeometry(0.105, 0.105, 0.075, 10), palette.cannonEdge, {
        position: [side * 0.77, y, -0.24],
        rotation: [0, 0, Math.PI / 2],
        metalness: 0.65,
      });
  }
  mesh(root, `ShellRail_${side}`,
    new THREE.BoxGeometry(0.07, 1.08, 0.07), palette.gold, {
      position: [side * 0.64, 1.06, -0.64],
      rotation: [0.08, 0, side * 0.22],
      metalness: 0.42,
    });
}
for (const x of [-0.4, 0, 0.4]) {
  mesh(root, `ShellRidge_${x}`,
    new THREE.BoxGeometry(0.08, 1.0, 0.08), palette.armourDark, {
      position: [x, 1.06, -0.78],
      rotation: [0.06, 0, x * -0.28],
    });
}

// Shoulder flames and red forearms preserve the creature-like silhouette.
for (const side of [-1, 1]) {
  fin(root, `ShoulderFlame_${side}`, [side * 0.69, 1.48, -0.03], [0.2, 0, side * 1.02], [0.92, 1.05, 0.65]);
  mesh(root, `Arm_${side}`,
    new THREE.CylinderGeometry(0.15, 0.2, 0.68, 7), palette.armour, {
      position: [side * 0.69, 1.1, 0.18],
      rotation: [0.24, 0, side * 0.55],
    });
  mesh(root, `Claw_${side}`,
    new THREE.SphereGeometry(0.21, 8, 6), palette.armour, {
      position: [side * 0.86, 0.84, 0.31],
      scale: [0.9, 0.7, 1.08],
    });
}

// Dark upright neck with jade breast plates.
mesh(root, 'Neck', new THREE.CylinderGeometry(0.3, 0.44, 1.16, 10), palette.belly, {
  position: [0, 1.72, 0.04],
  rotation: [-0.08, 0, 0],
  scale: [0.9, 1, 0.82],
});
for (const [y, width] of [[1.34, 0.42], [1.56, 0.35], [1.78, 0.28]]) {
  mesh(root, `BreastPlate_${y}`,
    new THREE.SphereGeometry(0.25, 8, 6), palette.jade, {
      position: [0, y, 0.31],
      scale: [width / 0.25, 0.34, 0.18],
      metalness: 0.3,
    });
}

// Dragon head. The model's authored front is explicitly +Z; the battle mirror
// can therefore aim it at the opponent/camera without a manifest yaw correction.
mesh(root, 'Head', new THREE.SphereGeometry(0.43, 12, 8), palette.armour, {
  position: [0, 2.27, 0.13],
  scale: [1.08, 0.78, 0.9],
  metalness: 0.18,
});
mesh(root, 'Jaw', new THREE.SphereGeometry(0.34, 10, 7), palette.armourDark, {
  position: [0, 2.11, 0.35],
  scale: [1.08, 0.42, 0.78],
});
for (const side of [-1, 1]) {
  mesh(root, `Eye_${side}`, new THREE.SphereGeometry(0.085, 10, 7), palette.eye, {
    position: [side * 0.27, 2.32, 0.43],
    scale: [0.8, 1.1, 0.42],
    metalness: 0.05,
  });
  mesh(root, `Pupil_${side}`, new THREE.SphereGeometry(0.038, 8, 6), palette.pupil, {
    position: [side * 0.27, 2.32, 0.475],
    scale: [0.72, 1.15, 0.32],
  });
  fin(root, `CheekFin_${side}`, [side * 0.39, 2.17, 0.02], [Math.PI / 2, 0, side * 0.95], [0.68, 0.62, 0.45], palette.armourDark);
}

// Cannon snout: three iron rings and a large open muzzle, all pointing +Z.
for (const [z, radius] of [[0.48, 0.215], [0.68, 0.19], [0.87, 0.18]]) {
  mesh(root, `Cannon_${z}`,
    new THREE.CylinderGeometry(radius, radius * 1.04, 0.25, 12), palette.cannon, {
      position: [0, 2.31, z],
      rotation: [Math.PI / 2, 0, 0],
      metalness: 0.72,
    });
}
mesh(root, 'Muzzle', new THREE.CylinderGeometry(0.25, 0.2, 0.18, 14), palette.cannonEdge, {
  position: [0, 2.31, 1.02],
  rotation: [Math.PI / 2, 0, 0],
  metalness: 0.78,
});
mesh(root, 'MuzzleOpening', new THREE.CylinderGeometry(0.17, 0.17, 0.012, 14), 0x07090c, {
  position: [0, 2.31, 1.116],
  rotation: [Math.PI / 2, 0, 0],
  metalness: 0.3,
});

// Crown, dorsal spikes and the long golden tail flame finish the naval-dragon profile.
for (const [x, y, z, tilt] of [
  [0, 2.68, 0.02, 0],
  [-0.24, 2.58, -0.08, -0.35],
  [0.24, 2.58, -0.08, 0.35],
  [0, 1.78, -0.77, 0],
  [0, 1.40, -0.84, 0],
  [0, 1.02, -0.88, 0],
]) {
  mesh(root, `Spike_${x}_${y}`,
    new THREE.ConeGeometry(0.13, 0.44, 5), palette.armourDark, {
      position: [x, y, z],
      rotation: [tilt, 0, -tilt],
    });
}
mesh(root, 'TailCore', new THREE.ConeGeometry(0.26, 0.9, 7), palette.gold, {
  position: [0, 0.96, -1.08],
  rotation: [-Math.PI / 2, 0, 0],
  scale: [0.72, 1, 0.72],
});
fin(root, 'TailFlameL', [-0.14, 0.98, -1.46], [-Math.PI / 2, 0, -0.35], [0.72, 0.88, 0.55], palette.goldLight);
fin(root, 'TailFlameR', [0.14, 0.98, -1.46], [-Math.PI / 2, 0, 0.35], [0.72, 0.88, 0.55], palette.gold);

root.updateMatrixWorld(true);
const bounds = new THREE.Box3().setFromObject(root);
const size = bounds.getSize(new THREE.Vector3());
if ([size.x, size.y, size.z].some((v) => !Number.isFinite(v) || v <= 0)) {
  throw new Error('Generated Turtleship has invalid bounds.');
}

const exporter = new GLTFExporter();
const result = await exporter.parseAsync(root, {
  binary: true,
  onlyVisible: true,
  truncateDrawRange: true,
  maxTextureSize: 1024,
});
if (!(result instanceof ArrayBuffer) || result.byteLength < 1024) {
  throw new Error('GLTFExporter did not produce a valid binary model.');
}

const output = fileURLToPath(new URL('../public/assets/models3d/turtleship.glb', import.meta.url));
await writeFile(output, new Uint8Array(result));
console.log(`Wrote ${output} (${result.byteLength} bytes, bounds ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)})`);
