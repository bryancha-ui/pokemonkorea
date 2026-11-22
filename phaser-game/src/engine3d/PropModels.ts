import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { allowsHeavy3DAssets, isRenderableModel } from './GlbModels';
import { performanceProfile } from './PerformanceProfile';

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
  /** Treat Wavefront `Tr 1` as opaque (some exporters write Tr like `d`). */
  invertTr?: boolean;
  /** optional authored scale hint (world units of height) */
  height?: number;
}

const localBuilding = (id: string, tags: string[] = [], url?: string): PropDef => ({
  id, role: 'building', ...(tags.length ? { tags } : {}), ...(url ? { url } : {}),
});

/** Complete synchronous copy of the vendored prop catalogue. Terrain building
 *  is synchronous, so relying on a fetch here let the first map beat props.json
 *  and permanently replace named gyms/shrines with a generic concrete shell.
 *  The fetch below still refreshes metadata, but every shipped model is known
 *  before the very first terrain pass and remains available offline. */
const SYNCHRONOUS_PROP_CATALOG: PropDef[] = [
  localBuilding('home', ['home'], 'assets/models3d/home.glb'),
  localBuilding('rival', ['home'], 'assets/models3d/rival.glb'),
  localBuilding('lab', ['lab']),
  localBuilding('pokecenter', ['center']),
  localBuilding('hanok', ['traditional'], 'assets/models3d/pinehouse.glb'),
  localBuilding('house', [], 'assets/models3d/alpinelodge.glb'),
  localBuilding('deptstore', ['shop']),
  localBuilding('gym', ['gym']),
  {
    id: 'dolmoe-pokemon-gym', role: 'building', tags: ['gym', 'dolmoe'],
    url: 'assets/bgm/DS%20_%20DSi%20-%20Pokemon%20Diamond%20_%20Pearl%20-%20Map%20Objects%20-%20Pokemon%20Gym/Poke%CC%81mon%20Gym.obj',
    mtl: 'assets/bgm/DS%20_%20DSi%20-%20Pokemon%20Diamond%20_%20Pearl%20-%20Map%20Objects%20-%20Pokemon%20Gym/Poke%CC%81mon%20Gym.mtl',
    invertTr: true,
  },
  localBuilding('palace', ['traditional']),
  localBuilding('mart', ['shop']),
  localBuilding('tower', ['landmark']),
  localBuilding('convenience', ['shop'], 'assets/models3d/mart.glb'),
  localBuilding('bikeshop', ['shop'], 'assets/models3d/gearshop.glb'),
  localBuilding('pinehouse', ['home']),
  localBuilding('dojo', ['gym']),
  localBuilding('gearshop', ['shop']),
  localBuilding('lanterngym', ['gym']),
  localBuilding('contesthall', ['hall']),
  localBuilding('tidalgym', ['gym']),
  localBuilding('templegym', ['gym']),
  localBuilding('shrine', ['shrine']),
  localBuilding('league', ['landmark']),
  localBuilding('nabihalmang', ['statue'], 'assets/models3d/nabistatue.glb'),
  localBuilding('dolmen', ['ruin']),
  localBuilding('sunrisegym', ['gym']),
  localBuilding('frostbell', ['shrine']),
  localBuilding('alpinelodge', ['home']),
  localBuilding('snowmeltbaths', ['bath']),
  localBuilding('skateshop', ['shop']),
  localBuilding('sanbangsan', ['shrine'], 'assets/models3d/shrine.glb'),
  localBuilding('jejumarket', ['market'], 'assets/models3d/deptstore.glb'),
  localBuilding('cheonjiyeon', ['pavilion'], 'assets/models3d/palace.glb'),
  ...'ABCDEFGH'.split('').map(letter => localBuilding(
    `cityfree_${letter.toLowerCase()}`, ['cityfree'], `assets/map3d/kaykit-city/building_${letter}.gltf`,
  )),
  localBuilding('pokemonvillage', ['village'], 'assets/map3d/original_pokemon_village.glb'),
  localBuilding('jongmyo', ['shrine'], 'assets/map3d/jongmyo.glb'),
  localBuilding('soolstation', ['station'], 'assets/map3d/soolstation.glb'),
  { id: 'nature_tree_default', role: 'scenery', tags: ['naturefree', 'tree', 'temperate'], url: 'assets/map3d/kenney-nature/tree_default.obj', mtl: 'assets/map3d/kenney-nature/tree_default.mtl' },
  { id: 'nature_tree_oak', role: 'scenery', tags: ['naturefree', 'tree', 'temperate'], url: 'assets/map3d/kenney-nature/tree_oak.obj', mtl: 'assets/map3d/kenney-nature/tree_oak.mtl' },
  { id: 'nature_tree_pine', role: 'scenery', tags: ['naturefree', 'tree', 'pine'], url: 'assets/map3d/kenney-nature/tree_pineRoundA.obj', mtl: 'assets/map3d/kenney-nature/tree_pineRoundA.mtl' },
  { id: 'nature_rock_a', role: 'scenery', tags: ['naturefree', 'rock'], url: 'assets/map3d/kenney-nature/rock_largeA.obj', mtl: 'assets/map3d/kenney-nature/rock_largeA.mtl' },
  { id: 'nature_rock_c', role: 'scenery', tags: ['naturefree', 'rock'], url: 'assets/map3d/kenney-nature/rock_largeC.obj', mtl: 'assets/map3d/kenney-nature/rock_largeC.mtl' },
];

let props: PropDef[] = [...SYNCHRONOUS_PROP_CATALOG];
let loading = false;
let catalogHydrated = false;
const cache = new Map<string, THREE.Group | 'loading' | 'failed'>();
const propUse = new Map<string, number>();
let propClock = 0;
const loader = new GLTFLoader();
const objLoader = new OBJLoader();
let dracoReady = false;

/** Higgsfield and optimized local scenery use KHR_draco_mesh_compression.
 * Creature loading configured a decoder, but the separate building loader did
 * not, so every compressed shrine/gym/dolmen failed and left its concrete-box
 * fallback on screen. Configure this loader against the same vendored decoder. */
function ensurePropDracoDecoder(): void {
  if (dracoReady || typeof document === 'undefined') return;
  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('assets/draco/', document.baseURI).toString());
  draco.setWorkerLimit(performanceProfile().mobile ? 1 : 2);
  loader.setDRACOLoader(draco);
  dracoReady = true;
}

export function primeProps(): void {
  if (catalogHydrated || loading) return;
  loading = true;
  fetch('assets/models3d/props.json')
    .then(r => (r.ok ? r.json() : null))
    .then((j: { props?: PropDef[] } | null) => {
      const merged = new Map(props.map(def => [def.id, def]));
      for (const def of j?.props ?? []) merged.set(def.id, def);
      props = [...merged.values()];
    })
    .catch(() => { /* synchronous vendored catalogue remains authoritative */ })
    .finally(() => { loading = false; catalogHydrated = true; });
}

export function propsFor(role: PropDef['role']): PropDef[] {
  return props.filter(p => p.role === role && propAllowed(p));
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
  ensurePropDracoDecoder();
  const url = def.url || `assets/models3d/${def.id}.glb`;
  const finish = (model: THREE.Object3D) => {
    try {
      sanitizeLegacyObjUvs(model);
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
      const materialLoader = new MTLLoader();
      if (def.invertTr) materialLoader.setMaterialOptions({ invertTrProperty: true });
      materialLoader.load(def.mtl, (materials) => {
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

/**
 * A few legacy map-object OBJs contain `NaN` in otherwise valid UV rows. Three's
 * OBJLoader preserves those values and the GPU then rejects or corrupts the
 * affected mesh. Keep the authored geometry/materials and repair only the bad
 * texture coordinates before renderability and bounds checks run.
 */
function sanitizeLegacyObjUvs(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const uv = object.geometry.getAttribute('uv');
    if (!uv || uv.itemSize < 2) return;
    let changed = false;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      if (Number.isFinite(u) && Number.isFinite(v)) continue;
      uv.setXY(i, Number.isFinite(u) ? u : 0, Number.isFinite(v) ? v : 0);
      changed = true;
    }
    if (changed) uv.needsUpdate = true;
  });
}

/** True once this prop's GLB is known to be unavailable (bad URL / offline). */
export function propFailed(def: PropDef): boolean {
  return cache.get(def.id) === 'failed';
}

/** True while this prop's GLB fetch/decode is still in flight. Callers waiting
 *  to swap in a model must not time out during this window — large GLBs can take
 *  several seconds to decode on a phone the first (uncached) time. */
export function propLoading(def: PropDef): boolean {
  return cache.get(def.id) === 'loading';
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
  const found = props.find(p => p.id === id) ?? null;
  return found && propAllowed(found) ? found : null;
}

/** Production/audit hook: all shipped props must be resolvable before fetch. */
export function synchronousPropIds(): string[] {
  return SYNCHRONOUS_PROP_CATALOG.map(def => def.id);
}

/** Drop cached prop GPU allocations between maps. On constrained devices keep
 * only the two most recently used decoded props, limiting JS heap growth while
 * retaining a small hot cache for commonly repeated buildings. */
export function releasePropGpuResources(): void {
  for (const entry of cache.values()) {
    if (entry === 'loading' || entry === 'failed') continue;
    disposePropGpu(entry);
  }
  if (!performanceProfile().constrained) return;
  const loaded = [...cache.entries()]
    .filter((entry): entry is [string, THREE.Group] => entry[1] !== 'loading' && entry[1] !== 'failed')
    .sort(([left], [right]) => (propUse.get(right) ?? 0) - (propUse.get(left) ?? 0));
  for (const [key] of loaded.slice(2)) {
    cache.delete(key);
    propUse.delete(key);
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
  const maxEntries = performanceProfile().constrained ? 4 : 10;
  const loaded = [...cache.entries()].filter(([, v]) => v !== 'loading' && v !== 'failed') as [string, THREE.Group][];
  while (loaded.length > maxEntries) {
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
