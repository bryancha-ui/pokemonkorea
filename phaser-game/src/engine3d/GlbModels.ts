import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applyProductionMaterials } from './ModelMaterials';
import { performanceProfile } from './PerformanceProfile';

// Small hero/boss GLBs that are allowed even on mobile, where
// `allowsHeavy3DAssets()` otherwise keeps the authored 2D presentation. The
// Higgsfield starter finals are deliberately absent: their PBR meshes are
// 49–59 MB / ~800k triangles each and must never be decoded on a mobile GPU.
const MOBILE_ALLOWED = new Set<string>([
  // The final Hwanung encounter must always use its shipped GLB in battle and
  // on the altar, even on phones. It is intentionally the one large boss-model
  // exception to the normal mobile memory gate.
  'hwanwoong',
  'snoqueen',    // 스노퀸 — Ice/Fairy frost sovereign
  'yeomtaeja',   // 염태자 — the flame prince
  'vipour',      // 염혈목이 — local optimized GLB (4.0 MB); it is a starter, so
                 //            its 3D form must survive the mobile gate too
  'onnurian',    // 온누리안 — local optimized GLB (3.5 MB)
  'munkain',     // 월식매 — local optimized GLB (4.6 MB)
  'bosongnun', 'camerghoost', 'hambillet', 'kkaakdang', 'luninari',
  'samdumae', 'silicutis', 'supiryeong', 'unsilgami', // local 3–5 MB GLBs
]);

// The starter remasters are shipped with the game and remain discoverable even
// if the manifest itself is unavailable. This lets their local GLB attempt reach
// a definitive ready/failed state, so a failure can restore the authored 2D art.
const CORE_LOCAL_MODELS = ['thanatoat', 'banderado', 'pipetiger'] as const;

/** True when `key`'s GLB may load on the current device: heavy assets are gated
 *  off on mobile except for the small hero allowlist. */
function modelAllowedHere(key: string): boolean {
  return allowsHeavy3DAssets() || MOBILE_ALLOWED.has(key);
}

// ── Production GLB model registry ───────────────────────────────────────────
// Approved true-3D creature models shipped with the game are listed in
// `public/assets/models3d/manifest.json`. Two entry forms are supported:
//
//   { "models": ["vipour", { "key": "munkain", "rotY": 90, "scale": 0.8 }] }
//
// Every entry loads only the vendored file assets/models3d/<key>.glb. Remote or
// generated CDN URLs are intentionally never used at runtime. Object entries
// retain optional orientation and scale corrections for their local GLB.
//
// Battle sprites automatically use a listed model instead of the relief-
// extruded art. A missing manifest still probes the three bundled starter GLBs.

type Entry = string | { key: string; rotX?: number; rotY?: number; rotZ?: number; scale?: number };

/** A loaded model plus any animation clips baked into the GLB. */
export interface LoadedModel {
  group: THREE.Group;
  animations: THREE.AnimationClip[];
}

/** Registry value: where to load the GLB and optional orientation/size fixes. */
interface ModelSpec {
  rot?: { x: number; y: number; z: number }; // degrees, baked before normalization
  scale?: number;                           // normalized height (1 = default); <1 shrinks the model
}

let manifest: Map<string, ModelSpec> | null = null;   // key → spec
let manifestLoading = false;
const models = new Map<string, LoadedModel | 'loading' | 'failed'>();
const modelUse = new Map<string, number>();
const modelFailures = new Map<string, { at: number; attempts: number; permanent: boolean }>();
let useClock = 0;
const loader = new GLTFLoader();
const assetUrl = (path: string): string => new URL(path, document.baseURI).toString();

export type ModelLoadStatus = 'unavailable' | 'idle' | 'loading' | 'ready' | 'failed';

/** Distinguish an in-flight load from a confirmed failure so callers can use
 * the authored 2D sprite only when the GLB has actually failed. */
export function modelLoadStatus(key: string): ModelLoadStatus {
  const k = normalizeKey(key);
  if (!manifest) return manifestLoading ? 'loading' : 'unavailable';
  if (!manifest.has(k)) return 'unavailable';
  // A manifest-backed GLB that is intentionally gated on this device must use
  // the same authored 2D fallback as a file/parse failure, never a relief model.
  if (!modelAllowedHere(k)) return 'failed';
  const state = models.get(k);
  if (state === 'loading') return 'loading';
  if (state === 'failed') return 'failed';
  if (state) return 'ready';
  return 'idle';
}

function markModelFailure(key: string, permanent: boolean): void {
  const previous = modelFailures.get(key);
  modelFailures.set(key, {
    at: Date.now(),
    attempts: (previous?.attempts ?? 0) + 1,
    permanent,
  });
  models.set(key, 'failed');
}

/** Some production GLBs can exceed 40 MB / 700k vertices each. Two of
 * those plus Phaser exceed the WebGL budget on iOS and many Android devices.
 * Heavy models are skipped there to avoid a lost context; their authored 2D
 * sprites remain visible instead. */
export function allowsHeavy3DAssets(): boolean {
  if (typeof navigator === 'undefined') return true;
  // `?touch=1` is the project's deterministic mobile QA shell; honour the same
  // heavy-model gate there as on a physical phone so performance tests exercise
  // the real authored-2D fallback path instead of decoding an 800k-poly GLB.
  if (performanceProfile().mobile) return false;
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
  fetch(assetUrl('assets/models3d/manifest.json'))
    .then(r => (r.ok ? r.json() : null))
    .then((j: { models?: Entry[] } | null) => {
      const m = new Map<string, ModelSpec>();
      for (const e of j?.models ?? []) {
        if (typeof e === 'string') m.set(normalizeKey(e), {});
        else if (e && e.key) {
          const rot = (e.rotX || e.rotY || e.rotZ)
            ? { x: e.rotX ?? 0, y: e.rotY ?? 0, z: e.rotZ ?? 0 }
            : undefined;
          m.set(normalizeKey(e.key), { rot, scale: e.scale });
        }
      }
      manifest = m;
      // High-density Higgsfield GLBs are loaded only when their Pokémon enters
      // a scene. BattleMirror keeps the authored 2D sprite visible during that
      // request, so boot never downloads/decodes all three ~50 MB files at once.
    })
    .catch((error) => {
      console.warn('[engine3d] model manifest unavailable; using original 2D sprites:', error);
      manifest = new Map(CORE_LOCAL_MODELS.map(key => [key, {}]));
    })
    .finally(() => { manifestLoading = false; });
}

export function hasModel(key: string): boolean {
  const k = normalizeKey(key);
  // Report manifest intent independently of the current device budget. Callers
  // then ask modelLoadStatus(); a gated/missing GLB resolves to the clean 2D
  // sprite instead of silently constructing an extruded substitute.
  return !!manifest && manifest.has(k);
}

/** The model's baked Y-orientation fix (manifest rotY) in radians, or 0. Callers
 *  that dynamically yaw a model (e.g. facePlayer3D) must subtract this so the
 *  baked-in front, not the raw GLB front, is what ends up aimed at the target. */
export function modelBaseYawRad(key: string): number {
  const spec = manifest?.get(normalizeKey(key));
  return spec?.rot ? THREE.MathUtils.degToRad(spec.rot.y) : 0;
}

/** The normalized height authored by the manifest (1 when no correction exists). */
export function modelNormalizedHeight(key: string): number {
  const scale = manifest?.get(normalizeKey(key))?.scale ?? 1;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/**
 * Get a normalized clone of the model for `key` (height 1, feet at y=0)
 * together with its animation clips, or null while it loads / when unavailable.
 */
export function getModel(key: string): LoadedModel | null {
  const k = normalizeKey(key);
  if (!manifest || !manifest.has(k) || !modelAllowedHere(k)) return null;
  const spec = manifest.get(k)!;
  let entry = models.get(k);
  if (entry === 'loading') return null;
  if (entry === 'failed') {
    const failure = modelFailures.get(k);
    if (!failure || failure.permanent) return null;
    // A temporary 404/service-worker race or dropped mobile connection should
    // not poison this Pokémon for the rest of the session. Polling callers retry
    // with exponential backoff while callers keep the authored 2D sprite visible.
    const retryAfter = Math.min(60_000, 4_000 * 2 ** Math.min(4, failure.attempts - 1));
    if (Date.now() - failure.at < retryAfter) return null;
    models.delete(k);
    entry = undefined;
  }
  if (entry) {
    modelUse.set(k, ++useClock);
    return cloneNormalized(entry);
  }

  models.set(k, 'loading');
  const localUrl = assetUrl(`assets/models3d/${k}.glb`);
  const accept = (gltf: GLTF): boolean => {
      try {
        // Normalization (height→1, feet at y=0, centered) is baked onto an inner
        // wrapper — NOT the root — because the root's position/rotation/scale are
        // owned and overwritten every frame by CreatureAnimator. Baking it on the
        // root would let the animator wipe it, leaving the model at its raw GLB
        // scale and pivot (→ mis-sized and sunk into the ground).
        const inner = new THREE.Group();
        inner.add(gltf.scene);
        applyProductionMaterials(gltf.scene);
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
        // Never replace the visible presentation with an empty/corrupt GLB. Empty
        // scenes previously normalized to Infinity and made that Pokémon vanish.
        if (!normalize(inner, spec.scale ?? 1) || !isRenderableModel(inner)) {
          return false;
        }
        const root = new THREE.Group();
        root.add(inner);
        models.set(k, { group: root, animations: gltf.animations ?? [] });
        modelFailures.delete(k);
        modelUse.set(k, ++useClock);
        trimModelCache(k);
        return true;
      } catch (err) {
        console.warn(`[engine3d] unusable creature model "${k}", retaining original 2D sprite:`, err);
        return false;
      }
  };
  loader.load(
    localUrl,
    (gltf) => {
      if (!accept(gltf)) markModelFailure(k, true); // parsed, but structurally unusable
    },
    undefined,
    (error) => {
      console.warn(`[engine3d] local creature model "${k}" failed to load; using original 2D sprite.`, error);
      markModelFailure(k, false);         // a transient cache/service-worker miss may recover later
    },
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

/** Release GPU allocations between worlds. Memory-constrained devices also
 * evict decoded models: HTTP cache still avoids a network download if a model
 * reappears, while tens of MB of vertex arrays no longer accumulate in RAM. */
export function releaseModelGpuResources(): void {
  const evictDecoded = performanceProfile().constrained;
  for (const [key, entry] of models) {
    if (entry === 'loading' || entry === 'failed') continue;
    disposeModelGpu(entry.group);
    if (evictDecoded) {
      models.delete(key);
      modelUse.delete(key);
    }
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
      for (const value of Object.values(mat)) {
        if (value instanceof THREE.Texture && !value.userData.pkSharedDetailTexture) textures.add(value);
      }
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
