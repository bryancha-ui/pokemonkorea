import * as THREE from 'three';

type Surface = 'fur' | 'feather' | 'cloth' | 'leaf' | 'wood' | 'metal' | 'eye' | 'spectral' | 'skin';

interface DetailPair {
  color: THREE.CanvasTexture;
  height: THREE.CanvasTexture;
}

const detailCache = new Map<Surface, DetailPair>();

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function makeDetails(surface: Surface): DetailPair {
  const cached = detailCache.get(surface);
  if (cached) return cached;
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  const heightCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = heightCanvas.width = heightCanvas.height = size;
  const color = colorCanvas.getContext('2d')!;
  const height = heightCanvas.getContext('2d')!;
  color.fillStyle = '#f4f4f4'; color.fillRect(0, 0, size, size);
  height.fillStyle = '#808080'; height.fillRect(0, 0, size, size);
  const random = seeded(surface.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0));

  if (surface === 'cloth') {
    for (let p = 0; p < size; p += 5) {
      color.strokeStyle = p % 10 ? 'rgba(255,255,255,.16)' : 'rgba(24,30,42,.09)';
      height.strokeStyle = p % 10 ? 'rgba(225,225,225,.28)' : 'rgba(42,42,42,.24)';
      color.beginPath(); color.moveTo(p, 0); color.lineTo(p, size); color.stroke();
      color.beginPath(); color.moveTo(0, p); color.lineTo(size, p); color.stroke();
      height.beginPath(); height.moveTo(p, 0); height.lineTo(p, size); height.stroke();
      height.beginPath(); height.moveTo(0, p); height.lineTo(size, p); height.stroke();
    }
  } else if (surface === 'fur' || surface === 'feather') {
    const count = surface === 'fur' ? 1900 : 900;
    for (let i = 0; i < count; i++) {
      const x = random() * size, y = random() * size;
      const len = (surface === 'fur' ? 2 : 5) + random() * (surface === 'fur' ? 6 : 12);
      const bend = (random() - 0.5) * 2.5;
      color.strokeStyle = `rgba(${random() > 0.5 ? 255 : 38},${random() > 0.5 ? 255 : 38},${random() > 0.5 ? 255 : 38},${surface === 'fur' ? 0.045 : 0.065})`;
      height.strokeStyle = random() > 0.48 ? 'rgba(235,235,235,.22)' : 'rgba(30,30,30,.14)';
      for (const ctx of [color, height]) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + bend, y + len * 0.5, x + bend * 0.5, y + len); ctx.stroke();
      }
    }
  } else if (surface === 'leaf') {
    for (let x = -size; x < size * 2; x += 26) {
      color.strokeStyle = 'rgba(255,255,210,.085)'; height.strokeStyle = 'rgba(225,225,225,.2)';
      for (const ctx of [color, height]) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + size * 0.55, size); ctx.stroke();
        for (let y = 24; y < size; y += 30) {
          const vx = x + y * 0.55;
          ctx.beginPath(); ctx.moveTo(vx, y); ctx.lineTo(vx - 20, y + 18); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(vx, y); ctx.lineTo(vx + 20, y + 18); ctx.stroke();
        }
      }
    }
  } else if (surface === 'wood') {
    for (let y = 0; y < size; y += 7) {
      const wave = Math.sin(y * 0.12) * 7;
      color.strokeStyle = y % 14 ? 'rgba(255,220,160,.08)' : 'rgba(45,22,8,.10)';
      height.strokeStyle = y % 14 ? 'rgba(220,220,220,.19)' : 'rgba(38,38,38,.17)';
      for (const ctx of [color, height]) {
        ctx.beginPath();
        for (let x = 0; x <= size; x += 8) {
          const yy = y + Math.sin(x * 0.08 + y) * 2 + wave * Math.sin(x * 0.016);
          if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }
  } else {
    for (let i = 0; i < 1300; i++) {
      const x = random() * size, y = random() * size, alpha = 0.018 + random() * 0.032;
      color.fillStyle = random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(24,24,24,${alpha})`;
      height.fillStyle = random() > 0.5 ? 'rgba(210,210,210,.12)' : 'rgba(46,46,46,.1)';
      color.fillRect(x, y, 1.2, 1.2); height.fillRect(x, y, 1.2, 1.2);
    }
  }

  const finish = (canvas: HTMLCanvasElement, isColor: boolean): THREE.CanvasTexture => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(surface === 'cloth' ? 7 : surface === 'fur' ? 5 : 3.5, surface === 'cloth' ? 9 : surface === 'fur' ? 7 : 4.5);
    texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.userData.pkSharedDetailTexture = true;
    texture.needsUpdate = true;
    return texture;
  };
  const pair = { color: finish(colorCanvas, true), height: finish(heightCanvas, false) };
  detailCache.set(surface, pair);
  return pair;
}

function surfaceFor(materialName: string, meshName: string): Surface {
  const name = `${materialName} ${meshName}`.toLowerCase();
  if (/wisp|smoke|spirit|glow|ember/.test(name)) return 'spectral';
  if (/eye|iris|pupil|catchlight/.test(name)) return 'eye';
  if (/gold|metal|blade|steel|beak|staff_tip/.test(name)) return 'metal';
  if (/pipe|wood|acorn|staff|bowl/.test(name)) return 'wood';
  if (/robe|cloth|collar|bow|band|ribbon/.test(name)) return 'cloth';
  if (/leaf|tail|green/.test(name)) return 'leaf';
  if (/feather|wing|plume|mane|crest/.test(name)) return 'feather';
  if (/fur|tiger|orange|stripe|body|head|arm|leg|paw/.test(name)) return 'fur';
  return 'skin';
}

function productionMaterial(source: THREE.MeshStandardMaterial, meshName: string): THREE.MeshStandardMaterial {
  const surface = surfaceFor(source.name, meshName);
  if (surface === 'spectral') {
    const spectral = source.clone();
    spectral.transparent = true;
    spectral.depthWrite = false;
    spectral.roughness = 0.22;
    spectral.metalness = 0;
    spectral.envMapIntensity = 1.25;
    spectral.userData.pkProductionMaterial = true;
    return spectral;
  }
  const detail = makeDetails(surface);
  // Higgsfield image-to-3D exports carry the Pokémon's painted colours in an
  // embedded base-colour texture. The earlier remaster pass replaced that map
  // with the neutral procedural detail texture, which is why textured models
  // such as Halubang rendered almost completely white. Keep every authored GLB
  // map and use our procedural texture only when the source truly has no map.
  const authoredBump = !!source.bumpMap;
  const parameters: THREE.MeshPhysicalMaterialParameters = {
    name: source.name,
    color: source.color.clone(),
    emissive: source.emissive.clone(),
    emissiveIntensity: source.emissiveIntensity,
    opacity: source.opacity,
    transparent: source.transparent,
    alphaTest: source.alphaTest,
    depthWrite: source.depthWrite,
    side: source.side,
    vertexColors: source.vertexColors,
    map: source.map ?? detail.color,
    alphaMap: source.alphaMap,
    aoMap: source.aoMap,
    aoMapIntensity: source.aoMapIntensity,
    emissiveMap: source.emissiveMap,
    lightMap: source.lightMap,
    lightMapIntensity: source.lightMapIntensity,
    metalnessMap: source.metalnessMap,
    normalMap: source.normalMap,
    normalScale: source.normalScale.clone(),
    roughnessMap: source.roughnessMap,
    bumpMap: source.bumpMap ?? detail.height,
    bumpScale: source.bumpScale,
    roughness: source.roughness,
    metalness: source.metalness,
    envMapIntensity: surface === 'metal' || surface === 'eye' ? 1.65 : 1.05,
  };
  const material = new THREE.MeshPhysicalMaterial(parameters);
  material.userData.pkProductionMaterial = true;
  material.userData.pkAuthoredBaseColorMap = !!source.map;

  if (surface === 'eye') {
    material.roughness = 0.08; material.metalness = 0; if (!authoredBump) material.bumpScale = 0.002;
    material.clearcoat = 1; material.clearcoatRoughness = 0.035; material.specularIntensity = 1;
  } else if (surface === 'metal') {
    material.roughness = 0.24; material.metalness = 0.72; if (!authoredBump) material.bumpScale = 0.008;
    material.clearcoat = 0.34; material.clearcoatRoughness = 0.18;
  } else if (surface === 'cloth') {
    material.roughness = 0.82; material.metalness = 0; if (!authoredBump) material.bumpScale = 0.035;
    material.sheen = 0.2; material.sheenColor.copy(source.color).lerp(new THREE.Color(0xffffff), 0.25);
    material.sheenRoughness = 0.82;
  } else if (surface === 'fur' || surface === 'feather') {
    material.roughness = surface === 'fur' ? 0.7 : 0.62; material.metalness = 0;
    if (!authoredBump) material.bumpScale = surface === 'fur' ? 0.024 : 0.032;
    material.sheen = surface === 'fur' ? 0.24 : 0.34;
    material.sheenColor.copy(source.color).lerp(new THREE.Color(0xffffff), 0.34);
    material.sheenRoughness = 0.72;
  } else if (surface === 'leaf') {
    material.roughness = 0.55; material.metalness = 0; if (!authoredBump) material.bumpScale = 0.028;
    material.clearcoat = 0.12; material.clearcoatRoughness = 0.48;
  } else if (surface === 'wood') {
    material.roughness = 0.6; material.metalness = 0.02; if (!authoredBump) material.bumpScale = 0.038;
    material.clearcoat = 0.08; material.clearcoatRoughness = 0.52;
  } else {
    material.roughness = Math.min(0.62, source.roughness); material.metalness = source.metalness;
    if (!authoredBump) material.bumpScale = 0.012;
    material.clearcoat = 0.08; material.clearcoatRoughness = 0.5;
  }
  return material;
}

/** Replace flat GLTF base-color materials with reusable micro-detailed PBR surfaces. */
export function applyProductionMaterials(root: THREE.Object3D): void {
  const materialCache = new Map<THREE.Material, THREE.Material>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const upgrade = (material: THREE.Material): THREE.Material => {
      const cached = materialCache.get(material);
      if (cached) return cached;
      if (!(material instanceof THREE.MeshStandardMaterial) || material.userData.pkProductionMaterial) return material;
      const next = productionMaterial(material, mesh.name);
      materialCache.set(material, next);
      return next;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(upgrade) : upgrade(mesh.material);
  });
}

/** Maximise texture clarity after a model reaches a renderer with known GPU limits. */
export function tuneModelTextures(root: THREE.Object3D, maxAnisotropy: number): void {
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.Material[];
    for (const material of materials) {
      const standard = material as THREE.MeshStandardMaterial;
      for (const texture of [standard.map, standard.bumpMap, standard.normalMap, standard.roughnessMap]) {
        if (!texture) continue;
        texture.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
        texture.needsUpdate = true;
      }
    }
  });
}
