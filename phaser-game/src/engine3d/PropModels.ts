import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { allowsHeavy3DAssets, isRenderableModel } from './GlbModels';

// ── Generated environment prop registry ──────────────────────────────────────
// Buildings, vehicles and other scenery GLBs (generated from prompts / art) are
// listed in `public/assets/models3d/props.json`:
//
//   { "props": [
//       { "id": "house",   "role": "building", "url": "https://…/house.glb" },
//       { "id": "pokecenter", "role": "building", "tags": ["center"], "url": "…" },
//       { "id": "bus",     "role": "vehicle",  "url": "…" }
//   ]}
//
// `role: building` entries are placed on detected building footprints (chosen
// deterministically per footprint so a city looks varied but stable between
// loads); `role: vehicle` entries are parked along road tiles. Entries may use
// a local path instead of a URL — `assets/models3d/<id>.glb` — and
// `scripts/fetch-models.mjs` vendors remote ones for offline play.
//
// With no props.json the engine keeps its procedural extruded buildings.

export interface PropDef {
  id: string;
  role: 'building' | 'vehicle' | 'scenery';
  tags?: string[];
  url?: string;
  /** Optional material library for CC0 OBJ assets. */
  mtl?: string;
  /** optional authored scale hint (world units of height) */
  height?: number;
}

let props: PropDef[] | null = null;
let loading = false;
const cache = new Map<string, THREE.Group | 'loading' | 'failed'>();
const propUse = new Map<string, number>();
let propClock = 0;
const loader = new GLTFLoader();
const objLoader = new OBJLoader();
const mtlLoader = new MTLLoader();

export function primeProps(): void {
  if (props || loading) return;
  loading = true;
  fetch('assets/models3d/props.json')
    .then(r => (r.ok ? r.json() : null))
    .then((j: { props?: PropDef[] } | null) => { props = j?.props ?? []; })
    .catch(() => { props = []; })
    .finally(() => { loading = false; });
}

export function propsFor(role: PropDef['role']): PropDef[] {
  return (props ?? []).filter(p => p.role === role && propAllowed(p));
}

export function hasProps(role: PropDef['role']): boolean {
  return propsFor(role).length > 0;
}

/** Load (and cache) a prop, normalized to 1 unit tall with feet at y=0. */
export function getProp(def: PropDef): THREE.Group | null {
  if (!propAllowed(def)) return null;
  const hit = cache.get(def.id);
  if (hit === 'loading' || hit === 'failed') return null;
  if (hit) {
    propUse.set(def.id, ++propClock);
    const c = hit.clone(true);
    c.traverse(o => { o.userData.sharedGeo = true; o.userData.sharedMat = true; });
    return c;
  }
  cache.set(def.id, 'loading');
  const url = def.url || `assets/models3d/${def.id}.glb`;
  const finish = (model: THREE.Object3D) => {
    try {
      const root = new THREE.Group();
      root.add(model);
      if (!isRenderableModel(root)) { fail(); return; }
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      if (!Number.isFinite(size.y) || size.y < 0.0001) { fail(); return; }
      root.scale.setScalar(1 / size.y);
      root.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(root);
      const c = new THREE.Vector3();
      b2.getCenter(c);
      if (b2.isEmpty() || ![c.x, c.y, c.z, b2.min.y].every(Number.isFinite)) { fail(); return; }
      root.position.x -= c.x; root.position.z -= c.z; root.position.y -= b2.min.y;
      root.updateMatrixWorld(true);
      if (!isRenderableModel(root)) { fail(); return; }
      cache.set(def.id, root);
      propUse.set(def.id, ++propClock);
      trimPropCache(def.id);
    } catch { fail(); }
  };
  const fail = () => { cache.set(def.id, 'failed'); };

  if (url.toLowerCase().endsWith('.obj')) {
    if (def.mtl) {
      mtlLoader.load(def.mtl, (materials) => {
        materials.preload();
        const withMaterials = new OBJLoader();
        withMaterials.setMaterials(materials);
        withMaterials.load(url, finish, undefined, fail);
      }, undefined, fail);
    } else {
      objLoader.load(url, finish, undefined, fail);
    }
  } else {
    loader.load(url, gltf => finish(gltf.scene), undefined, fail);
  }
  return null;
}

/** True once this prop's GLB is known to be unavailable (bad URL / offline). */
export function propFailed(def: PropDef): boolean {
  return cache.get(def.id) === 'failed';
}

/** Footprint (in tiles) of a normalized prop, used to fit it to a plot. */
export function propFootprint(def: PropDef): { w: number; d: number } | null {
  const hit = cache.get(def.id);
  if (!hit || hit === 'loading' || hit === 'failed') return null;
  const box = new THREE.Box3().setFromObject(hit);
  const size = new THREE.Vector3();
  box.getSize(size);
  return { w: size.x, d: size.z };
}

/** Stable pick so the same plot always gets the same building model. */
export function pickProp(list: PropDef[], seed: number): PropDef | null {
  if (!list.length) return null;
  return list[Math.abs(Math.round(seed)) % list.length];
}

/** Look up a specific prop by id — used to place a named building (a scene's
 *  Pokémon Center / lab / home) on its exact authored footprint. */
export function propById(id: string): PropDef | null {
  const found = (props ?? []).find(p => p.id === id) ?? null;
  return found && propAllowed(found) ? found : null;
}

/** Drop cached prop GPU allocations between maps while retaining CPU data. */
export function releasePropGpuResources(): void {
  for (const entry of cache.values()) {
    if (entry === 'loading' || entry === 'failed') continue;
    disposePropGpu(entry);
  }
}

function propAllowed(def: PropDef): boolean {
  // Vendored local assets always load.
  if (!/^https?:/i.test(def.url ?? '')) return true;
  // Authored building / scenery props are only ~1–5 MB each (versus the 40–59 MB
  // creature GLBs the mobile heavy-asset gate really protects against), and
  // getProp caches one normalized model per id, clones it for every placement
  // (shared geometry/material) and LRU-caps distinct props at 10. Gating them off
  // on phones left cities showing only the grey procedural-extrusion fallback,
  // so keep the Higgsfield buildings/scenery on mobile too. Only heavier remote
  // roles (e.g. vehicles) stay behind the memory gate.
  if (def.role === 'building' || def.role === 'scenery') return true;
  return allowsHeavy3DAssets() || def.id === 'dolmen';
}

function trimPropCache(except: string): void {
  const loaded = [...cache.entries()].filter(([, v]) => v !== 'loading' && v !== 'failed') as [string, THREE.Group][];
  while (loaded.length > 10) {
    loaded.sort(([a], [b]) => (propUse.get(a) ?? 0) - (propUse.get(b) ?? 0));
    const index = loaded.findIndex(([key]) => key !== except);
    if (index < 0) break;
    const [key, group] = loaded.splice(index, 1)[0];
    disposePropGpu(group);
    cache.delete(key);
    propUse.delete(key);
  }
}

function disposePropGpu(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const mat of mats) {
      materials.add(mat);
      for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  textures.forEach(t => t.dispose());
  materials.forEach(m => m.dispose());
  geometries.forEach(g => g.dispose());
}
