import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applyProductionMaterials } from './ModelMaterials';
import { performanceProfile } from './PerformanceProfile';

// The starter remasters are shipped with the game and remain discoverable even
// if the manifest itself is unavailable. This lets their local GLB attempt reach
// a definitive ready/failed state instead of silently substituting pixel art.
const CORE_LOCAL_MODELS = ['thanatoat', 'banderado', 'pipetiger'] as const;

/** Every registered creature GLB is authoritative on every device. Device
 * budgets may reduce cache size and effects, but must never change a Pokémon
 * from 3D to 2D and create a mixed visual presentation. */
function modelAllowedHere(key: string): boolean {
  return manifest?.has(normalizeKey(key)) === true;
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

type Entry = string | {
  key: string;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  scale?: number;
  lightweight?: boolean;
  generated?: boolean;
  proceduralVolumetric?: boolean;
  offsetX?: number;
  offsetZ?: number;
  companionOnly?: boolean;
  optimized?: boolean;
  source?: string;
};

/** A loaded model plus any animation clips baked into the GLB. */
export interface LoadedModel {
  group: THREE.Group;
  animations: THREE.AnimationClip[];
}

/** Registry value: where to load the GLB and optional orientation/size fixes. */
interface ModelSpec {
  rot?: { x: number; y: number; z: number }; // degrees, baked before normalization
  scale?: number;                           // normalized height (1 = default); <1 shrinks the model
  lightweight?: boolean;                    // safe to decode on memory-limited mobile devices
  generated?: boolean;                      // reproducible procedural GLB, not hand-authored
  proceduralVolumetric?: boolean;           // closed colour-mesh sculpture, never a 2D card
  // Per-species nudge on its battle/overworld mark, in model heights (so it
  // scales with the creature). +Z is the direction the model faces, so a
  // negative offsetZ seats a species further back from the viewer. Authored by
  // hand per Pokémon; absent means "leave exactly where the geometry lands".
  offsetX?: number;
  offsetZ?: number;
  // Rough artwork-relief model: good enough to walk beside the player, not good
  // enough for the battle camera. Battles use the species' 2D sprite instead.
  companionOnly?: boolean;
  source?: string;                          // provenance, e.g. 'pokemon-3d-api' for borrowed models
}

let manifest: Map<string, ModelSpec> | null = null;   // key → spec
let manifestLoading = false;
const models = new Map<string, LoadedModel | 'loading' | 'failed'>();
const modelUse = new Map<string, number>();
const modelPins = new Map<string, number>();
const modelFailures = new Map<string, { at: number; attempts: number; permanent: boolean }>();
let useClock = 0;
const loader = new GLTFLoader();
const assetUrl = (path: string): string => new URL(path, document.baseURI).toString();
let dracoReady = false;

/** Where the Draco decoder is served from. Copied out of three's package into
 *  `public/` so ONE path works in the dev server, in a production build, and
 *  under the GitHub Pages sub-path alike. */
const DRACO_PATH = 'assets/draco/';

/**
 * Pokémon 3D API models use KHR_draco_mesh_compression. Configure the shared
 * decoder lazily so Node-based audits can import this module without a DOM and
 * so the ~750 KB decoder is fetched only when a compressed GLB is requested.
 *
 * The decoder path is set EXPLICITLY. DRACOLoader's defaults resolve against
 * `import.meta.url` inside three's own package, which the dev server does not
 * serve — the request 404s, the dev server answers 404s with index.html, and
 * DRACOLoader then builds its worker out of that HTML. The result is the
 * infamous `Uncaught SyntaxError: Unexpected token '<'` from a blob: URL, which
 * fired for exactly those species whose GLB happens to be Draco-compressed.
 */
function ensureDracoDecoder(): void {
  if (dracoReady) return;
  const draco = new DRACOLoader();
  draco.setDecoderPath(assetUrl(DRACO_PATH));
  draco.setWorkerLimit(performanceProfile().mobile ? 1 : 2);
  loader.setDRACOLoader(draco);
  dracoReady = true;
  // Verify in the background. The decoder now lives at a path this project
  // controls, so this should always pass; if a deployment ever serves something
  // else there, detach the loader rather than let every later compressed model
  // spawn a worker built out of an HTML error page.
  void dracoDecoderUsable().then(usable => {
    if (usable) return;
    draco.dispose();
    loader.setDRACOLoader(null as unknown as DRACOLoader);
    dracoDisabled = true;
  });
}

/** True once a broken decoder has been detached; compressed models then fail
 *  cleanly and their owners fall back to 2D artwork. */
let dracoDisabled = false;
export function dracoUnavailable(): boolean { return dracoDisabled; }

/**
 * Confirm the decoder really is JavaScript before any compressed GLB is handed
 * to it.
 *
 * The failure this guards against is silent and fatal: a wrong path returns an
 * HTML error page with HTTP 200, DRACOLoader wraps it in a Worker, and the
 * SyntaxError surfaces asynchronously inside that worker where no caller can
 * catch it. One cheap fetch up front turns that into a normal missing-model
 * fallback (the partner simply uses its artwork instead).
 */
let dracoProbe: Promise<boolean> | null = null;
function dracoDecoderUsable(): Promise<boolean> {
  if (dracoProbe) return dracoProbe;
  dracoProbe = fetch(assetUrl(DRACO_PATH + 'draco_wasm_wrapper.js'))
    .then(async response => {
      if (!response.ok) return false;
      // An HTML fallback page is the exact thing that broke the worker.
      const head = (await response.text()).slice(0, 400).trimStart();
      const usable = !head.startsWith('<');
      if (!usable) {
        console.warn('[engine3d] Draco decoder path served HTML, not JS —'
          + ' compressed models will fall back to 2D artwork.');
      }
      return usable;
    })
    .catch(() => false);
  return dracoProbe;
}

/**
 * Remove LATERAL root motion from a model's clips.
 *
 * Every battler and follower is placed by the game: the battle mirror parks it on
 * an arena anchor, the companion parks it on the trail. A clip that also animates
 * its own root translation fights that, and the model walks away from the spot it
 * was placed on — which is why PokéAPI-sourced species drifted off their platform
 * while the blob shadow (drawn at the anchor) stayed behind. The project's own
 * generated models have no such tracks, so the bug only ever showed on borrowed
 * ones.
 *
 * Only X and Z are frozen. Y is deliberately preserved so a hover or a breathing
 * bob still reads; it is the horizontal drift that breaks placement.
 */
function stripRootMotion(scene: THREE.Object3D, clips: THREE.AnimationClip[], key: string): void {
  if (!clips.length) return;
  // Root motion lives on the scene itself or on the single rig node directly
  // under it ("Armature", "RootNode", …). Bone tracks sit deeper and must be
  // left completely alone — they are the animation.
  const rootNames = new Set<string>();
  if (scene.name) rootNames.add(scene.name);
  for (const child of scene.children) if (child.name) rootNames.add(child.name);

  let stripped = 0;
  for (const clip of clips) {
    for (const track of clip.tracks) {
      if (!track.name.endsWith('.position')) continue;
      const node = track.name.slice(0, -'.position'.length);
      if (!rootNames.has(node)) continue;
      const v = track.values;
      if (v.length < 3) continue;
      const x0 = v[0], z0 = v[2];
      let moved = false;
      for (let i = 0; i < v.length; i += 3) {
        if (v[i] !== x0 || v[i + 2] !== z0) moved = true;
        v[i] = x0;
        v[i + 2] = z0;
      }
      if (moved) stripped++;
    }
  }
  if (stripped) {
    console.info(`[engine3d] "${key}": froze lateral root motion on ${stripped} track(s) so it stays on its anchor.`);
  }
}

export type ModelLoadStatus = 'unavailable' | 'idle' | 'loading' | 'ready' | 'failed';

/** Distinguish an in-flight load from a confirmed failure. A registered model
 * remains 3D-only in both states; callers use 2D only for `unavailable`. */
export function modelLoadStatus(key: string): ModelLoadStatus {
  const k = normalizeKey(key);
  if (!manifest) return manifestLoading ? 'loading' : 'unavailable';
  if (!manifest.has(k)) return 'unavailable';
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

/** Shared scene-detail/cache budget. Creature registry entries deliberately
 * bypass this gate so device class can never change a Pokémon from 3D to 2D;
 * props and cache sizing still use it to protect mobile WebGL contexts. */
export function allowsHeavy3DAssets(): boolean {
  if (typeof navigator === 'undefined') return true;
  // `?touch=1` is the project's deterministic mobile QA shell; honour the same
  // scene-detail gate there as on a physical phone so performance tests exercise
  // the same prop and cache budgets as physical hardware.
  if (performanceProfile().mobile) return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) return false;
  const ipadDesktopMode = /Macintosh/i.test(nav.userAgent) && nav.maxTouchPoints > 1;
  if (ipadDesktopMode || /iPhone|iPad|iPod|Android|Mobile/i.test(nav.userAgent)) return false;
  return true;
}

/** Phaser texture keys sometimes carry a battle prefix (e.g. "wild-foxgeist"). */
/** True once the model manifest has been fetched (successfully or not), so
 *  callers can tell "no GLB for this key" apart from "manifest still loading".
 *  Without that distinction a caller cannot know when to give up waiting. */
export function manifestReady(): boolean {
  return manifest !== null;
}

export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/^(wild|enemy|foe|ally|player|te|api|gym|owned)-/, '');
}

/** Bumped whenever per-species manifest corrections change, so no browser can
 *  keep serving a stale copy of the registry. */
const MANIFEST_VERSION = '2026-08-25c';

/** Fetch attempts before settling for the bundled core registry. */
const MANIFEST_ATTEMPTS = 3;
let manifestAttempts = 0;

export function primeManifest(): void {
  if (manifest || manifestLoading) return;
  manifestLoading = true;
  // Cache-bust deliberately. manifest.json lives in public/, so browsers and
  // the dev server hand back a cached copy indefinitely — per-species fixes
  // (rotY, offsetX/offsetZ) were edited in the file and had NO effect in the
  // running game because the old manifest was still being served.
  fetch(assetUrl(`assets/models3d/manifest.json?v=${MANIFEST_VERSION}`), { cache: 'no-cache' })
    .then(r => {
      // A 404 or an HTML error page used to resolve to null and then build an
      // EMPTY manifest, which is indistinguishable from "this game has no 3D
      // models": every species reported hasModel() === false and silently fell
      // back to its 2D artwork for the rest of the session. Treat a bad response
      // as a failure so the retry path below can recover from it.
      if (!r.ok) throw new Error(`manifest HTTP ${r.status}`);
      return r.json();
    })
    .then((j: { models?: Entry[] } | null) => {
      if (!j?.models?.length) throw new Error('manifest empty');
      const m = new Map<string, ModelSpec>();
      for (const e of j?.models ?? []) {
        if (typeof e === 'string') m.set(normalizeKey(e), {});
        else if (e && e.key) {
          const rot = (e.rotX || e.rotY || e.rotZ)
            ? { x: e.rotX ?? 0, y: e.rotY ?? 0, z: e.rotZ ?? 0 }
            : undefined;
          m.set(normalizeKey(e.key), {
            rot,
            scale: e.scale,
            lightweight: e.lightweight === true,
            generated: e.generated === true,
            proceduralVolumetric: e.proceduralVolumetric === true,
            offsetX: typeof e.offsetX === 'number' ? e.offsetX : undefined,
            offsetZ: typeof e.offsetZ === 'number' ? e.offsetZ : undefined,
            companionOnly: e.companionOnly === true,
            source: e.source,
          });
        }
      }
      manifest = m;
      // GLBs remain lazy: only a Pokémon entering a scene is decoded. Its 2D
      // sprite stays hidden during that request to preserve visual consistency.
    })
    .catch((error) => {
      // One failed fetch used to be permanent: the 3-key core registry became the
      // answer for the whole session, so all 137 original Pokémon reported "no
      // model" and rendered as artwork instead of their shipped GLBs. A cold
      // cache, a service-worker miss or a dropped mobile connection is usually
      // transient, so retry with backoff before settling for the core registry.
      manifestAttempts++;
      manifestLoading = false;
      if (manifestAttempts < MANIFEST_ATTEMPTS) {
        console.warn(`[engine3d] model manifest fetch failed (attempt ${manifestAttempts}); retrying:`, error);
        globalThis.setTimeout(primeManifest, 1200 * manifestAttempts);
        return;
      }
      console.warn('[engine3d] model manifest unavailable; using the bundled core 3D registry:', error);
      manifest = new Map(CORE_LOCAL_MODELS.map(key => [key, {}]));
    })
    .finally(() => { manifestLoading = false; });
}

/** True for auto-generated colour-sculpture GLBs (the companion-generator
 *  output, flagged `generated`/`proceduralVolumetric` in the manifest). They are
 *  lumpy vertex-painted approximations of the artwork they were derived from,
 *  so presentation layers may prefer the creature's real 2D art over them. */
export function isGeneratedSculpture(key: string): boolean {
  const spec = manifest?.get(normalizeKey(key));
  return spec?.generated === true || spec?.proceduralVolumetric === true;
}

/** True for rough follower-only models: battles must keep the 2D sprite. */
export function isCompanionOnlyModel(key: string): boolean {
  return manifest?.get(normalizeKey(key))?.companionOnly === true;
}

export function hasModel(key: string): boolean {
  const k = normalizeKey(key);
  // Report manifest intent independently of load state. A registered key is
  // always a 3D presentation; only an absent key may use its original sprite.
  return !!manifest && manifest.has(k);
}

/** True for GLBs borrowed wholesale from the Pokémon 3D API (numeric national-dex
 *  species). These are auto-centred on their bounding box, so tail-heavy species
 *  read as standing forward of their mark; the battle arena nudges them back. The
 *  game's own named models are hand-authored and left untouched. */
export function isBorrowedApiModel(key: string): boolean {
  return manifest?.get(normalizeKey(key))?.source === 'pokemon-3d-api';
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

/** Keep shared GLB geometry resident while a long-lived overworld companion is
 * using one of its clones. Short battle/cutscene clones do not need to pin. */
export function pinModel(key: string): void {
  const normalized = normalizeKey(key);
  modelPins.set(normalized, (modelPins.get(normalized) ?? 0) + 1);
}

export function unpinModel(key: string): void {
  const normalized = normalizeKey(key);
  const count = modelPins.get(normalized) ?? 0;
  if (count <= 1) modelPins.delete(normalized);
  else modelPins.set(normalized, count - 1);
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
    // with exponential backoff while the registered 3D slot stays reserved.
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
  ensureDracoDecoder();
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
        // A skeleton with no clip to drive it stays in its bind pose, which needs
        // a different measurement (see normalizeBindPosed).
        const clips = gltf.animations ?? [];
        // Never replace the visible presentation with an empty/corrupt GLB. Empty
        // scenes previously normalized to Infinity and made that Pokémon vanish.
        if (!normalize(inner, spec.scale ?? 1, isBindPosed(gltf.scene, clips), spec) || !isRenderableModel(inner)) {
          return false;
        }
        // Dev-only placement readout. Repeated "is the fix live?" rounds cost more
        // than one log line: this states, per species, which anchoring path ran
        // and what per-model correction was applied.
        if (import.meta.env.DEV) {
          console.info(`[engine3d] model "${k}" · ${isBindPosed(gltf.scene, clips) ? 'bind-posed' : 'posed'}`
            + ` · offsetX=${spec.offsetX ?? 0} offsetZ=${spec.offsetZ ?? 0}`);
        }
        const root = new THREE.Group();
        root.add(inner);
        stripRootMotion(gltf.scene, clips, k);
        models.set(k, { group: root, animations: clips });
        modelFailures.delete(k);
        modelUse.set(k, ++useClock);
        trimModelCache(k);
        return true;
      } catch (err) {
        console.warn(`[engine3d] unusable creature model "${k}"; keeping its 3D-only slot hidden:`, err);
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
      console.warn(`[engine3d] local creature model "${k}" failed to load; keeping its 3D-only slot for retry.`, error);
      markModelFailure(k, false);         // a transient cache/service-worker miss may recover later
    },
  );
  return null;
}

// ── Bind-pose safety net ─────────────────────────────────────────────────────
// A skinned GLB with no animation clips has nothing to drive its skeleton, so it
// renders frozen in its BIND pose — arms straight out, legs splayed. That pose is
// an authoring artefact rather than how the creature stands, and measuring it
// breaks placement in two different ways depending on the species:
//   • the box grows sideways, so its centre no longer sits over the creature's
//     feet. The body drifts off its mark while the blob shadow — drawn at the
//     holder anchor — stays put, which is exactly the "shadow is right but the
//     Pokémon stands too far forward" symptom (Slowbro leaned 0.49 units).
//   • a raised crest or blade inflates the measured height, and because we scale
//     height→1 the whole creature shrinks (Gallade lost 15% of its size).
// Models carrying an animation clip, and plain static meshes, are authored in a
// real pose, so they keep the original box measurement untouched. On this roster
// that is 276 of 356 models; the 80 bind-posed ones are the set that misbehaved.
const SPIKE_TOLERANCE = 1.08;    // height inflation that counts as a thin spike
const SPIKE_PERCENTILE = 0.985;  // vertex height used in place of the absolute top
const MAX_SPIKE_GAIN = 1.25;     // most a spike trim may ever enlarge a model
const MAX_SAMPLES = 20000;       // cap the measurement cost on dense meshes
// How far the body centre must sit from the box centre, as a fraction of the
// model's height, before a normally-posed model is re-anchored onto its body.
// Below this the two agree and the model keeps its exact previous placement.
// Measured over the roster there is a clean gap here: models that already stand
// correctly reach 0.156 at worst (Bouffalant; Espeon 0.149, Sunflora 0.060) while
// the visibly forward-leaning ones start at 0.254 (Basculegion) and run to 1.281
// (Steelix). 0.20 sits in that gap, so only the leaners move.
const ANCHOR_DISAGREEMENT = 0.20;

// Height alone is a bad scale reference for a model authored lying down or with
// its wings spread flat: such a model has almost no height, so `1 / height` blows
// the whole creature up. Steelix's GLB lies lengthwise (5.5× longer than tall) and
// rendered 2047px wide on a 1280px canvas — it swallowed the entire arena. Falling
// back to the longest horizontal axis whenever that is what really governs the
// silhouette costs nothing for normal creatures: across this roster the median
// model measures 1.14 and the 90th percentile 1.94, so a 2.4 ceiling only moves the
// 18 genuine outliers (laid-out serpents and spread-wing birds).
const MAX_SPAN = 2.4;

/** Scale for `sizeScale` units tall, unless the model's length is what actually
 *  governs its silhouette — then fit the longest axis instead. */
function spanLimitedScale(sizeScale: number, height: number, longest: number): number {
  return sizeScale / Math.max(height, longest / MAX_SPAN);
}

/** True when nothing will ever pose this skeleton, so it renders in bind pose. */
function isBindPosed(root: THREE.Object3D, clips: readonly THREE.AnimationClip[]): boolean {
  if (clips.length > 0) return false;
  let skinned = false;
  root.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
  return skinned;
}

/** Rendered vertices in the space `Box3.setFromObject(root)` reports, with bone
 *  transforms applied — the geometry as the GPU draws it, not the untransformed
 *  bind-pose attribute. */
function sampleVertices(root: THREE.Group): THREE.Vector3[] {
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  let total = 0;
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.visible === false) return;
    const pos = mesh.geometry?.getAttribute?.('position');
    if (!pos || pos.count < 3) return;
    meshes.push(mesh);
    total += pos.count;
  });
  const stride = Math.max(1, Math.ceil(total / MAX_SAMPLES));
  const out: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  for (const mesh of meshes) {
    const count = mesh.geometry.getAttribute('position').count;
    for (let i = 0; i < count; i += stride) {
      mesh.getVertexPosition(i, v);
      v.applyMatrix4(mesh.matrixWorld);
      if (Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)) out.push(v.clone());
    }
  }
  return out;
}

/** Per-axis median of the sampled mesh — a robust stand-in for "where the body
 *  actually is". Unlike a bounding-box centre, which is only the midpoint of the
 *  two extremes, it ignores a back-swept tail, trailing fins or an outstretched
 *  wing — exactly the features that drag a creature off its mark. */
function bodyCentre(pts: readonly THREE.Vector3[]): { x: number; z: number } | null {
  if (pts.length < 3) return null;
  const xs = pts.map(p => p.x).sort((a, b) => a - b);
  const zs = pts.map(p => p.z).sort((a, b) => a - b);
  const x = xs[xs.length >> 1];
  const z = zs[zs.length >> 1];
  return (Number.isFinite(x) && Number.isFinite(z)) ? { x, z } : null;
}

/** Normalization for bind-posed models: size from a spike-tolerant height and a
 *  sprawl clamp, anchored on the body's median (its mass) instead of the box
 *  centre or the foot patch — so a leaning pose stands over its mark. */
function normalizeBindPosed(root: THREE.Group, sizeScale: number, spec: ModelSpec): boolean {
  const pts = sampleVertices(root);
  if (pts.length < 3) return false;
  const box = new THREE.Box3().setFromPoints(pts);
  const size = box.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y < 0.0001) return false;

  // A thin crest/antenna is a few dozen vertices; the body is thousands. Taking
  // a high percentile instead of the maximum ignores the spike but keeps a genuinely
  // tall creature tall.
  const ys = pts.map(p => p.y).sort((a, b) => a - b);
  const robustTop = ys[Math.min(ys.length - 1, Math.floor(ys.length * SPIKE_PERCENTILE))];
  const robustH = robustTop - box.min.y;
  // Bounded on purpose: trimming is only allowed to credit a spike with a fifth
  // of the model's height. Without the cap a serpentine model whose whole tail
  // sits in the top percentile got read as one big spike and grew 38%.
  const usableH = (robustH > 0.0001 && size.y / robustH > SPIKE_TOLERANCE)
    ? Math.max(robustH, size.y / MAX_SPIKE_GAIN)
    : size.y;

  const s = spanLimitedScale(sizeScale, usableH, Math.max(size.x, size.z));
  if (!Number.isFinite(s) || s <= 0) return false;

  // Anchor the DENSE BODY over the mark. The box centre is thrown off by splayed
  // bind-pose limbs, and the foot patch alone leaves a forward-leaning torso
  // (Slowbro, Gallade, Garchomp) hanging in front of the mark while its shadow
  // stays put. The per-axis MEDIAN sits in the bulk of the mesh, so a back-swept
  // tail, a thrown-out arm or a bowed head cannot drag the anchor off the body.
  // Anchor on the bounding-box centre — the SAME rule the static models use.
  // A per-axis median was tried here and is what pushed this whole group toward
  // the camera: the median lands wherever vertex density is highest, which on
  // these rigs is the densely-meshed head, so seating the head over the mark
  // shoved the body forward. Confirmed against play: every species reported too
  // far forward (Slowbro, Azumarill, Bibarel, Golduck) was on this path, and
  // every species reported correct (Bouffalant, Swellow, Whiscash, Quagsire) was
  // on the box path. Size corrections above still apply; only the anchor reverts.
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  if (![cx, cz, box.min.y].every(Number.isFinite)) return false;

  root.scale.setScalar(s);
  root.position.set(-cx * s, -box.min.y * s, -cz * s);
  applyAuthoredOffset(root, sizeScale, spec);
  root.updateMatrixWorld(true);
  return isRenderableModel(root);
}

/** Scale so the model is `sizeScale` units tall (default 1) with feet on y=0,
 *  centered. A sizeScale < 1 renders the creature proportionally smaller. */
function normalize(root: THREE.Group, sizeScale = 1, bindPosed = false, spec: ModelSpec = {}): boolean {
  if (!isRenderableModel(root) || !Number.isFinite(sizeScale) || sizeScale <= 0) return false;
  if (bindPosed) {
    if (normalizeBindPosed(root, sizeScale, spec)) return true;
    // Unusable vertex sample — reset and fall back to the plain box measurement
    // rather than leaving the model half-transformed.
    root.scale.setScalar(1);
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
  }
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (!Number.isFinite(size.y) || size.y < 0.0001) return false;
  const s = spanLimitedScale(sizeScale, size.y, Math.max(size.x, size.z));
  if (!Number.isFinite(s) || s <= 0) return false;
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  if (box2.isEmpty() || !Number.isFinite(box2.min.y)) return false;
  const center = new THREE.Vector3();
  box2.getCenter(center);
  if (![center.x, center.y, center.z].every(Number.isFinite)) return false;

  // One anchor rule for every model: the bounding-box centre. Vertex-median and
  // ground-patch anchors were both tried here and both read worse in play — they
  // chase wherever the mesh is densest, which is usually the head, and that seats
  // the body forward. Per-species corrections belong in the manifest (offsetX /
  // offsetZ), where they can be judged one Pokémon at a time.
  root.position.x -= center.x;
  root.position.z -= center.z;
  // Ground on the POSED silhouette. Box3.setFromObject reports a skinned mesh's
  // bind-pose bounds, so a model whose rest pose differs — Pikachu sits in a
  // mid-leap bind pose — was grounded on geometry that is not what the GPU draws
  // and ended up hovering above the floor.
  const pts = sampleVertices(root);
  const posedFloor = pts.length ? Math.min(...pts.map(p => p.y)) : box2.min.y;
  root.position.y -= Number.isFinite(posedFloor) ? posedFloor : box2.min.y;
  applyAuthoredOffset(root, sizeScale, spec);
  root.updateMatrixWorld(true);
  return isRenderableModel(root);
}

/** Apply the manifest's per-species nudge. Expressed in model heights so the
 *  same number means the same visual shift whatever the creature's real size. */
function applyAuthoredOffset(root: THREE.Group, sizeScale: number, spec: ModelSpec): void {
  const dx = Number.isFinite(spec.offsetX) ? (spec.offsetX as number) : 0;
  const dz = Number.isFinite(spec.offsetZ) ? (spec.offsetZ as number) : 0;
  if (!dx && !dz) return;
  root.position.x += dx * sizeScale;
  root.position.z += dz * sizeScale;
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
    const victimIndex = loaded.findIndex(([key]) => key !== except && !(modelPins.get(key) ?? 0));
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
  // SkeletonUtils.clone keeps skinned meshes bound to their own skeleton.
  //
  // It must be used for EVERY skinned model, not only animated ones. A naive
  // Object3D.clone copies the skeleton BY REFERENCE, so the clone renders
  // wherever the ORIGINAL's bones are — and the original lives in this cache at
  // the world origin, never added to the scene. Every skinned-but-clipless
  // species therefore drew at the arena's centre front, ignoring its holder,
  // anchor, targetH and manifest offsets alike (Slowbro, Bibarel, Gallade,
  // Azumarill, Golduck, Metagross), on both sides of the field, while static
  // meshes (Bouffalant, Swellow, Whiscash) and animated rigs (Espeon) placed
  // correctly. This single reference-copy was that whole positioning bug.
  let skinned = false;
  src.group.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
  const c = (skinned || src.animations.length ? skeletonClone(src.group) : src.group.clone(true)) as THREE.Group;
  c.traverse(o => { o.userData.sharedGeo = true; o.userData.sharedMat = true; });
  return { group: c, animations: src.animations };
}
