import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { makeGengar } from './Props';

// Procedural (code-built) creature models — no GLB and no generation credits, and
// cheap enough to render even on mobile. Keyed by normalized species key; a battle
// texture key like "te-94" / "wild-94" normalizes to "94".
const PROCEDURAL: Record<string, () => THREE.Object3D> = {
  '94': makeGengar,   // Fog-Wraith Gengar (안개 팬텀) — Fogbound Manor boss
};

// Lightweight hero/boss GLBs (~4–5 MB each) that are allowed even on mobile,
// where `allowsHeavy3DAssets()` would otherwise fall the whole roster back to the
// 2D relief. These species only appear in scripted, one-at-a-time boss battles —
// well inside the mobile 2-model cache — so the WebGL budget stays safe while the
// story's marquee custom Pokémon still get their true 3D form. Keyed by species
// key (see the Pokédex / CustomBattle keys), normalized.
const MOBILE_ALLOWED = new Set<string>([
  'snoqueen',    // 스노퀸 — Ice/Fairy frost sovereign
  'pipetiger',   // 염흥왕 — the flame king (evolves from 염태자)
  'yeomtaeja',   // 염태자 — the flame prince
]);

/** True when `key`'s GLB may load on the current device: heavy assets are gated
 *  off on mobile except for the small hero allowlist. */
function modelAllowedHere(key: string): boolean {
  return allowsHeavy3DAssets() || MOBILE_ALLOWED.has(key);
}

// ── Generated 3D model registry ─────────────────────────────────────────────
// True 3D creature models (generated from the game's own artwork) are listed in
// `public/assets/models3d/manifest.json`. Two entry forms are supported:
//
//   { "models": ["vipour", { "key": "munkain", "url": "https://…/x.glb" }] }
//
//   • plain string  → loads the vendored file  assets/models3d/<key>.glb
//   • {key, url}    → loads the GLB straight from the given URL (e.g. the
//                     generator's CDN), so models work before they're vendored.
//
// Run `node scripts/fetch-models.mjs` to download every remote entry into
// public/assets/models3d/ and rewrite the manifest to local form (offline play).
//
// Battle sprites automatically use a listed model instead of the relief-
// extruded art. A missing manifest quietly disables the feature.

type Entry = string | { key: string; url?: string; rotX?: number; rotY?: number; rotZ?: number; scale?: number };

/** A loaded model plus any animation clips baked into the GLB. */
export interface LoadedModel {
  group: THREE.Group;
  animations: THREE.AnimationClip[];
}

/** Registry value: where to load the GLB and optional orientation/size fixes. */
interface ModelSpec {
  url: string | null;                       // null = vendored local file
  rot?: { x: number; y: number; z: number }; // degrees, baked before normalization
  scale?: number;                           // normalized height (1 = default); <1 shrinks the model
}

let manifest: Map<string, ModelSpec> | null = null;   // key → spec
let manifestLoading = false;
const models = new Map<string, LoadedModel | 'loading' | 'failed'>();
const modelUse = new Map<string, number>();
let useClock = 0;
const loader = new GLTFLoader();

/** The generated sculpture GLBs can exceed 40 MB / 700k vertices each. Two of
 * those plus Phaser exceed the WebGL budget on iOS and many Android devices.
 * Those devices retain the lightweight 3D relief instead of risking a lost
 * context; authored/procedural maps remain fully 3D. */
export function allowsHeavy3DAssets(): boolean {
  if (typeof navigator === 'undefined') return true;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) return false;
  const ipadDesktopMode = /Macintosh/i.test(nav.userAgent) && nav.maxTouchPoints > 1;
  if (ipadDesktopMode || /iPhone|iPad|iPod|Android|Mobile/i.test(nav.userAgent)) return false;
  return true;
}

/** Phaser texture keys sometimes carry a battle prefix (e.g. "wild-foxgeist"). */
export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/^(wild|enemy|foe|ally|player|te)-/, '');
}

export function primeManifest(): void {
  if (manifest || manifestLoading) return;
  manifestLoading = true;
  fetch('assets/models3d/manifest.json')
    .then(r => (r.ok ? r.json() : null))
    .then((j: { models?: Entry[] } | null) => {
      const m = new Map<string, ModelSpec>();
      for (const e of j?.models ?? []) {
        if (typeof e === 'string') m.set(normalizeKey(e), { url: null });
        else if (e && e.key) {
          const rot = (e.rotX || e.rotY || e.rotZ)
            ? { x: e.rotX ?? 0, y: e.rotY ?? 0, z: e.rotZ ?? 0 }
            : undefined;
          m.set(normalizeKey(e.key), { url: e.url ?? null, rot, scale: e.scale });
        }
      }
      manifest = m;
    })
    .catch(() => { manifest = new Map(); })
    .finally(() => { manifestLoading = false; });
}

export function hasModel(key: string): boolean {
  const k = normalizeKey(key);
  if (PROCEDURAL[k]) return true;   // code-built models are cheap — allowed on mobile too
  return !!manifest && manifest.has(k) && modelAllowedHere(k);
}

/** The model's baked Y-orientation fix (manifest rotY) in radians, or 0. Callers
 *  that dynamically yaw a model (e.g. facePlayer3D) must subtract this so the
 *  baked-in front, not the raw GLB front, is what ends up aimed at the target. */
export function modelBaseYawRad(key: string): number {
  const spec = manifest?.get(normalizeKey(key));
  return spec?.rot ? THREE.MathUtils.degToRad(spec.rot.y) : 0;
}

/**
 * Get a normalized clone of the model for `key` (height 1, feet at y=0)
 * together with its animation clips, or null while it loads / when unavailable.
 */
export function getModel(key: string): LoadedModel | null {
  const k = normalizeKey(key);
  // Procedural creatures are built synchronously (no async GLB fetch), then cached
  // and cloned exactly like a loaded model.
  if (PROCEDURAL[k]) {
    const cached = models.get(k);
    if (cached && cached !== 'loading' && cached !== 'failed') { modelUse.set(k, ++useClock); return cloneNormalized(cached); }
    const inner = new THREE.Group();
    inner.add(PROCEDURAL[k]());
    if (!normalize(inner, 1) || !isRenderableModel(inner)) { models.set(k, 'failed'); return null; }
    const root = new THREE.Group();
    root.add(inner);
    const loaded: LoadedModel = { group: root, animations: [] };
    models.set(k, loaded);
    modelUse.set(k, ++useClock);
    return cloneNormalized(loaded);
  }
  if (!manifest || !manifest.has(k) || !modelAllowedHere(k)) return null;
  const spec = manifest.get(k)!;
  const entry = models.get(k);
  if (entry === 'loading' || entry === 'failed') return null;
  if (entry) {
    modelUse.set(k, ++useClock);
    return cloneNormalized(entry);
  }

  models.set(k, 'loading');
  const url = spec.url || `assets/models3d/${k}.glb`;
  loader.load(
    url,
    (gltf) => {
      try {
        // Normalization (height→1, feet at y=0, centered) is baked onto an inner
        // wrapper — NOT the root — because the root's position/rotation/scale are
        // owned and overwritten every frame by CreatureAnimator. Baking it on the
        // root would let the animator wipe it, leaving the model at its raw GLB
        // scale and pivot (→ mis-sized and sunk into the ground).
        const inner = new THREE.Group();
        inner.add(gltf.scene);
        // Per-model orientation fix (manifest rotX/Y/Z degrees) — for models the
        // generator reconstructed lying down or facing the wrong way, applied
        // BEFORE normalize so the height/centering measure the upright pose.
        if (spec.rot) {
          gltf.scene.rotation.set(
            THREE.MathUtils.degToRad(spec.rot.x),
            THREE.MathUtils.degToRad(spec.rot.y),
            THREE.MathUtils.degToRad(spec.rot.z),
          );
        }
        // Never replace the visible relief with an empty/corrupt GLB. Empty
        // scenes previously normalized to Infinity and made that Pokémon vanish.
        if (!normalize(inner, spec.scale ?? 1) || !isRenderableModel(inner)) {
          models.set(k, 'failed');
          return;
        }
        const root = new THREE.Group();
        root.add(inner);
        models.set(k, { group: root, animations: gltf.animations ?? [] });
        modelUse.set(k, ++useClock);
        trimModelCache(k);
      } catch (err) {
        console.warn(`[engine3d] unusable creature model "${k}", retaining 2D relief:`, err);
        models.set(k, 'failed');
      }
    },
    undefined,
    () => { models.set(k, 'failed'); },
  );
  return null;
}

/** Scale so the model is `sizeScale` units tall (default 1) with feet on y=0,
 *  centered. A sizeScale < 1 renders the creature proportionally smaller. */
function normalize(root: THREE.Group, sizeScale = 1): boolean {
  if (!isRenderableModel(root) || !Number.isFinite(sizeScale) || sizeScale <= 0) return false;
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (!Number.isFinite(size.y) || size.y < 0.0001) return false;
  const s = sizeScale / size.y;
  if (!Number.isFinite(s) || s <= 0) return false;
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  if (box2.isEmpty() || !Number.isFinite(box2.min.y)) return false;
  const center = new THREE.Vector3();
  box2.getCenter(center);
  if (![center.x, center.y, center.z].every(Number.isFinite)) return false;
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box2.min.y;
  root.updateMatrixWorld(true);
  return isRenderableModel(root);
}

/** True only when a model has visible, non-empty mesh data and finite bounds. */
export function isRenderableModel(root: THREE.Object3D): boolean {
  let hasVisibleGeometry = false;
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || mesh.visible === false) return;
    const position = mesh.geometry?.getAttribute?.('position');
    if (!position || position.count < 3) return;
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.Material[];
    if (!mats.some(m => m && m.visible !== false && m.opacity > 0.001)) return;
    let parent: THREE.Object3D | null = mesh.parent;
    while (parent && parent !== root) {
      if (!parent.visible) return;
      parent = parent.parent;
    }
    hasVisibleGeometry = true;
  });
  if (!hasVisibleGeometry) return false;
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return false;
  const size = box.getSize(new THREE.Vector3());
  return [size.x, size.y, size.z].every(Number.isFinite)
    && Math.max(size.x, size.y, size.z) > 0.0001
    && Math.max(size.x, size.y, size.z) < 1_000_000;
}

/** Release only GPU allocations; CPU model data remains cached and can be
 * re-uploaded without another network request if the species reappears. */
export function releaseModelGpuResources(): void {
  for (const entry of models.values()) {
    if (entry === 'loading' || entry === 'failed') continue;
    disposeModelGpu(entry.group);
  }
}

function trimModelCache(except: string): void {
  const max = allowsHeavy3DAssets() ? 6 : 2;
  const loaded = [...models.entries()].filter(([, v]) => v !== 'loading' && v !== 'failed') as [string, LoadedModel][];
  while (loaded.length > max) {
    loaded.sort(([a], [b]) => (modelUse.get(a) ?? 0) - (modelUse.get(b) ?? 0));
    const victimIndex = loaded.findIndex(([key]) => key !== except);
    if (victimIndex < 0) break;
    const [key, model] = loaded.splice(victimIndex, 1)[0];
    disposeModelGpu(model.group);
    models.delete(key);
    modelUse.delete(key);
  }
}

function disposeModelGpu(root: THREE.Object3D): void {
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

function cloneNormalized(src: LoadedModel): LoadedModel {
  // SkeletonUtils.clone keeps skinned meshes bound to their own skeleton, so
  // rigged models can animate independently per battler.
  const c = (src.animations.length ? skeletonClone(src.group) : src.group.clone(true)) as THREE.Group;
  c.traverse(o => { o.userData.sharedGeo = true; o.userData.sharedMat = true; });
  return { group: c, animations: src.animations };
}
