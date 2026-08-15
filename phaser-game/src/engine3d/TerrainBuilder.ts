import * as THREE from 'three';
import {
  InstancedProp, WallBuilder, makeBronzeStatue, makeFlowers, makeGrandObelisk,
  makeCherryTree, makeFlowerBed, makeForestTree, makeGlowPlants, makeGrassTufts, makeIceStatue, makeMineCart, makePineTree, makePines, makePot, makeRailTrack,
  makeBollard, makeBuoy, makeCrateStack, makeDryingRack, makeFishStall, makeFishingNet,
  makePokeBallProp,
  makeStarterBenchProp,
  makeBellFrame, makeFirewoodStack, makeMeditationRock, makeSchoolBanner, makeSparringRing,
  makeStrawDummy, makeTrainingPost, makeWeaponRack,
  makeAlpineLake,
  makeRocks, makeScenicRock, makeFerry, makeFrostGym, makeGrandPalace, makeHanokPalace, makeMountainRange, makeNosdanHQ, makePalmTree, makePokemonCenter, makePokeMart, makeSacredPeakCloudSea, makeStall, makeStoneLantern, makeStoreFixture, makeStreetlamp, makeTrees, makeTriumphalArch, makeWater, makeWaterfall, makeWoodBridge, makeBoat, toonRamp,
  type StoreFixtureKind,
} from './Props';
import { buildCityDetail, CityTileSpec } from './CityDetail3D';
import { buildAmbientCrowd, type CrowdPlot } from './AmbientCrowd';

/** A decorative procedural prop the scene pins to an exact tile. */
export interface PropPlot {
  x: number; y: number;
  kind: 'tree' | 'pine' | 'palm' | 'lantern' | 'rock' | 'flower' | 'glowplant' | 'woodbridge' | 'icestatue' | 'rail' | 'obelisk' | 'statue' | 'arch' | 'pot' | 'streetlamp' | 'minecart' | 'cherry' | 'stall' | 'waterfall' | 'boat' | 'fishstall' | 'crates' | 'dryingrack' | 'bollard' | 'buoy' | 'net'
  | 'trainingpost' | 'strawdummy' | 'weaponrack' | 'sparringring' | 'banner' | 'bellframe' | 'meditationrock' | 'firewood' | 'pokeball' | 'starterbench' | 'ferry'
  | StoreFixtureKind;
  scale?: number; rot?: number;
  len?: number;   // rail span or ferry length in tiles
  w?: number; d?: number; color?: number; // fixture footprint / ferry beam / theme
}
import { getProp, pickProp, primeProps, propById, propFailed, propLoading, propsFor } from './PropModels';
import type { EnvProfile } from './ThreeStage';

/** Procedural warm-soil texture for the diorama slab sides: layered earth
 *  bands with darker strata lines and scattered pebble speckles (low-poly). */
function makeSoilTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 48;
  const ctx = c.getContext('2d')!;
  const grd = ctx.createLinearGradient(0, 0, 0, 48);
  grd.addColorStop(0, '#8a6a46');   // topsoil (just under the grass lip)
  grd.addColorStop(1, '#6e5238');   // deeper earth
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 96, 48);
  // Horizontal strata bands.
  ctx.fillStyle = 'rgba(60,42,28,0.35)';
  for (let y = 12; y < 48; y += 14) ctx.fillRect(0, y, 96, 2);
  // Pebble / grit speckles.
  let s = 0x1234abcd;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(120,92,64,0.6)' : 'rgba(52,38,26,0.5)';
    ctx.fillRect(Math.floor(rnd() * 96), Math.floor(rnd() * 48), 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Terrain builder ──────────────────────────────────────────────────────────
// The composited map painting (rasterized from the scene's own Graphics) is
// projected onto the 3D ground plane — guaranteeing the exact original layout
// in every scene — and then each 32px tile is classified by color so real 3D
// volume grows out of it: cliff/cave walls rise as blocks, dark-green cells
// become trees, saturated green becomes tall-grass tufts, blue water gets an
// animated surface, flower tones get blossoms, grey gets boulders.

export const PX = 32;            // game pixels per tile == world units per tile: 1 tile = 1 unit

export interface TerrainResult {
  group: THREE.Group;
  env: EnvProfile;
  /** playerPos is local to this terrain group (tiles, x/z). */
  update(t: number, playerPos?: { x: number; z: number } | null): void;
  /** world size in tiles */
  cols: number; rows: number;
  /** detected building plots (debug/inspection) */
  plots: { x: number; z: number; w: number; d: number }[];
  /** occluders the camera may need to see through (buildings/props) */
  blockers: { node: THREE.Object3D; r: number; fade: number }[];
  /** environment classifier inputs (debug) */
  envStats: { dark: number; vivid: number; light: number };
}

interface HSL { h: number; s: number; l: number }

function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

type Cell =
  | 'flat' | 'wall-high' | 'wall-low' | 'tree' | 'pine' | 'grass' | 'flower'
  | 'water' | 'rock' | 'building';

// ── Facade texture (generated asset with procedural fallback) ───────────────
// Drop a tileable facade at public/assets/textures3d/facade.png (e.g. generated
// with Higgsfield) and every extruded building picks it up automatically.
let facadeLoaded: THREE.Texture | null = null;
let facadeTried = false;
const facadeWaiters: THREE.MeshToonMaterial[] = [];

function proceduralFacade(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f2ede4'; ctx.fillRect(0, 0, 96, 96);
  ctx.fillStyle = '#d8d2c6'; ctx.fillRect(0, 88, 96, 8);         // base course
  for (let ry = 0; ry < 2; ry++) {
    for (let rx = 0; rx < 2; rx++) {
      const x = 14 + rx * 44, y = 14 + ry * 38;
      ctx.fillStyle = '#5f7f9f'; ctx.fillRect(x - 2, y - 2, 28, 26);
      ctx.fillStyle = '#bcd8ee'; ctx.fillRect(x, y, 24, 22);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x + 2, y + 2, 8, 18);
    }
  }
  return c;
}

function facadeMaterial(tint: number, repX: number, repY: number): THREE.MeshToonMaterial {
  const base = new THREE.CanvasTexture(proceduralFacade());
  base.colorSpace = THREE.SRGBColorSpace;
  base.wrapS = base.wrapT = THREE.RepeatWrapping;
  base.repeat.set(repX, repY);
  const mat = new THREE.MeshToonMaterial({ map: base, color: tint, gradientMap: toonRamp() });
  if (facadeLoaded) {
    swapFacade(mat, facadeLoaded);
  } else {
    facadeWaiters.push(mat);
    if (!facadeTried) {
      facadeTried = true;
      new THREE.TextureLoader().load(
        'assets/textures3d/facade.png',
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          facadeLoaded = t;
          for (const w of facadeWaiters) swapFacade(w, t);
          facadeWaiters.length = 0;
        },
        undefined,
        () => { facadeWaiters.length = 0; },     // keep procedural fallback
      );
    }
  }
  return mat;
}

function swapFacade(mat: THREE.MeshToonMaterial, tex: THREE.Texture): void {
  const rep = mat.map ? mat.map.repeat.clone() : new THREE.Vector2(1, 1);
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.copy(rep);
  t.needsUpdate = true;
  mat.map = t;
  mat.needsUpdate = true;
}

// ── Roof texture (generated asset; falls back to the painted footprint) ─────
let roofLoaded: THREE.Texture | null = null;
let roofTried = false;
const roofWaiters: { mat: THREE.MeshBasicMaterial; w: number; d: number }[] = [];

function roofMaterial(
  groundTex: THREE.Texture,
  b: { x: number; z: number; w: number; d: number },
  cols: number, rows: number,
): THREE.MeshBasicMaterial {
  // Default: the building's own painted footprint (keeps the original design).
  const crop = groundTex.clone();
  crop.repeat.set(b.w / cols, b.d / rows);
  crop.offset.set(b.x / cols, (rows - (b.z + b.d)) / rows);
  crop.needsUpdate = true;
  // Unlit for the same reason as the ground: the roof IS the original painting.
  const mat = new THREE.MeshBasicMaterial({ map: crop });

  if (roofLoaded) {
    applyRoof(mat, roofLoaded, b.w, b.d);
  } else {
    roofWaiters.push({ mat, w: b.w, d: b.d });
    if (!roofTried) {
      roofTried = true;
      new THREE.TextureLoader().load(
        'assets/textures3d/roof.png',
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          roofLoaded = t;
          for (const w of roofWaiters) applyRoof(w.mat, t, w.w, w.d);
          roofWaiters.length = 0;
        },
        undefined,
        () => { roofWaiters.length = 0; },
      );
    }
  }
  return mat;
}

function applyRoof(mat: THREE.MeshBasicMaterial, tex: THREE.Texture, w: number, d: number): void {
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(d / 3)));
  t.needsUpdate = true;
  mat.map = t;
  mat.needsUpdate = true;
}

function classify(hsl: HSL, snowy: boolean, variance = 0, cavey = false, interior = false, grass3D = false): Cell {
  const { h, s, l } = hsl;
  if (l < 0.10) return 'wall-high';                                   // cave walls / voids
  // In a cave/mine the entire floor is dark brown/grey, so the dark low-sat
  // buckets below would extrude the whole walkable floor into a field of low
  // walls that swallow the player. There, only the very darkest tiles are true
  // walls (caught by wall-high above); everything mid-dark is floor.
  const caveFloor = cavey && l >= 0.18;
  // Blue-roofed buildings would read as water, so only calm (low-detail) blue
  // counts as a water surface — window grids and roof tiling are busy.
  // (l ≥ 0.32: dark navy building roofs must not read as water)
  // Indoor rooms have no ocean — a shop's blue walls/shelves must never animate
  // as water, so water is only detected outdoors.
  if (!interior && h >= 185 && h <= 255 && s > 0.28 && l >= 0.32 && l < 0.75 && variance < 420) return 'water';
  if (h >= 60 && h <= 170) {                                          // green family
    if (l < 0.30) return snowy ? 'pine' : 'tree';                     // darker greens = foliage
    // When grass3D is enabled, treat more greens as grass for 3D representation
    if (grass3D && s > 0.20 && l < 0.55) return 'grass';              // expanded grass range for 3D
    if (s > 0.34 && l < 0.50) return 'grass';                         // mid greens = tall grass (brighter lawns, l≥0.50, stay flat)
    // Snowy passes paint their tall-grass clearings a pale frosted green (low
    // saturation, light) — treat that as grass so it grows snow-dusted tufts.
    if (snowy && s > 0.12 && l >= 0.5 && l < 0.75) return 'grass';
    return 'flat';
  }
  if (h >= 20 && h <= 60 && s > 0.45 && l > 0.5 && l < 0.82) return 'flower'; // warm blossom tones (wood floors are duller)
  if (s < 0.22 && l >= 0.10 && l < 0.34) return caveFloor ? 'flat' : 'wall-low';  // dark grey rock walls
  if (s < 0.25 && l >= 0.34 && l < 0.52) return 'rock';               // mid grey — boulders
  if (h >= 15 && h <= 45 && s > 0.18 && s < 0.5 && l < 0.42) return caveFloor ? 'flat' : 'wall-low'; // brown cliffs
  return 'flat';
}

/** Target 3D height (world units) for a building on a `w`×`d`-tile plot. Bigger
 *  plots get taller buildings so a landmark GLB fills its footprint instead of
 *  sitting as a small box on a large lot (e.g. the palace / gym / dept store). */
function plotHeight(w: number, d: number): number {
  return Math.max(2.0, Math.min(10, 1.2 + Math.sqrt(w * d) * 0.72));
}

/** A compact hipped roof with a central ridge. Replacing the old perfectly flat
 * roof planes gives even procedural towns the friendly miniature architecture
 * and strong silhouettes of a modern handheld Pokémon overworld. */
function makeHipRoofGeometry(width: number, depth: number, height: number): THREE.BufferGeometry {
  const buildAlongX = (w: number, d: number) => {
    const hw = w / 2, hd = d / 2;
    const ridge = Math.max(0, (w - d * 0.55) * 0.5);
    const A = [-hw, 0, -hd] as const, B = [hw, 0, -hd] as const;
    const C = [hw, 0, hd] as const, D = [-hw, 0, hd] as const;
    const E = [-ridge, height, 0] as const, F = [ridge, height, 0] as const;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const face = (points: readonly (readonly [number, number, number])[]) => {
      const base = pos.length / 3;
      for (let i = 0; i < points.length; i++) {
        pos.push(...points[i]);
        const u = points.length === 3 ? [0, 0.5, 1][i] : [0, 0.18, 0.82, 1][i];
        uv.push(u, i === 0 || i === points.length - 1 ? 0 : 1);
      }
      if (points.length === 3) idx.push(base, base + 1, base + 2);
      else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    face([A, E, F, B]);
    face([D, C, F, E]);
    face([A, D, E]);
    face([B, F, C]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  if (width >= depth) return buildAlongX(width, depth);
  const geo = buildAlongX(depth, width);
  geo.rotateY(Math.PI / 2);
  return geo;
}

/**
 * Build terrain from the painted world canvas.
 * `worldW/worldH` are the world's pixel dimensions (from camera bounds).
 * `interior` suppresses outdoor-only props (flowers/tall grass) on indoor floors.
 */
export function buildTerrain(
  ground: HTMLCanvasElement, worldW: number, worldH: number, interior = false,
  tileMap: number[][] | null = null,
  knownPlots: { x: number; y: number; w: number; h: number; model?: string }[] = [],
  sceneKey = '',
  // When set, only footprints the scene explicitly named (knownPlots with a
  // `model`) are built as 3D volumes — every other detected building is left as
  // clean ground (its flat 2D art still gets erased). Declutters towns whose
  // generic residential blocks looked like stray brick boxes in 3D.
  onlyNamedBuildings = false,
  // Vehicles the scene pins to an exact tile (e.g. the express bus at its stop).
  // Only authored placements are rendered; inferred roadside vehicles could
  // overlap a walkable lane without matching the scene's collision map.
  placedVehicles: { x: number; y: number; model: string; rot?: number }[] = [],
  // Mixed scenes (an outdoor route with a cave section) that aren't dark enough
  // to auto-detect as a cave, but whose dark walkable floor must NOT extrude
  // into walls that bury the player, set this. Only the classifier's cave-floor
  // rule is affected — lighting stays daylight.
  caveFloorHint = false,
  // Suppress even scene-authored vehicles when a map needs a completely clear
  // route (kept for scene-level control).
  noVehicles = false,
  // Place free CC0 city-building GLBs (KayKit, tagged 'cityfree' in props.json)
  // on every detected building that has no named model, instead of the
  // procedural facade — for towns we haven't authored custom models for.
  freeBuildings = false,
  // Decorative procedural props (pines, stone lanterns, ice statues) the scene
  // pins to exact tiles — built from primitives, so no assets/credits needed.
  propPlots: PropPlot[] = [],
  // Some puzzle rooms need their authored tile colours/collision but cannot
  // tolerate any automatically raised wall/rock/foliage volumes in the camera
  // lane. Keep the painted ground and authored objects, but leave auto terrain
  // completely flat so gameplay markers and the player stay visible.
  clearSight3D = false,
  // Enable 3D grass tufts in grass areas (set by scenes that want more detailed foliage)
  grass3D = false,
  // Some maps publish the exact tile ids that represent tall grass.  Those ids
  // take priority over colour sampling, which can otherwise mistake the dark
  // painted blades for trees.
  grassTileIds3D: number[] = [],
  // Average number of crossed-plane tufts placed in each grass tile.  The
  // legacy behaviour was one tuft plus a 45% chance of a second.
  grassDensity3D = 1.45,
  grassTone3D = 0x49b23a,
  // Tile ids that must stay flush with the ground even if their painted colour
  // resembles rock or a low wall (e.g. wooden pond bridges and forest paths).
  flatTileIds3D: number[] = [],
  // Fully flat: skip EVERY raised wall/rock volume and all foliage so a cramped
  // dark cave / puzzle room never buries the player behind extruded tiles. This
  // is stronger than clearSight3D (which Task-17 turned into low 3D mountains)
  // and interiorTerrain3D (which still raises height-capped walls).
  flatTerrain3D = false,
  // Tile ids the scene paints as trees — forced to grow real 3D trees (see above).
  treeTileIds3D: number[] = [],
  // Tile ids the scene paints as 2D mountains — auto-covered by 3D mountain-range
  // models (their painted art is erased), instead of flat blocky wall extrusions.
  mountainTileIds3D: number[] = [],
  // Street-detail spec: when a city scene declares which tile ids are road and
  // pavement, the entire street layer is rebuilt in 3D — asphalt with lane
  // markings and crossings, kerbed sidewalks, lamps, signals, benches, signage.
  cityTiles3D: CityTileSpec | null = null,
  // Dense city artwork can share the same rough grey palette as natural stone.
  // Disable only automatically inferred boulders while retaining buildings,
  // authored props and collision.
  noRocks3D = false,
  // Sacred Peak's building-free summit uses animated cloud banks around the
  // non-walkable outer ridge while the shared stage supplies its sky dome.
  sacredPeakNature3D = false,
  // Preserve authored ground decals even when their detailed pixels resemble
  // a building footprint to the heuristic detector.
  preservePaintedGround3D = false,
  // Decorative townspeople (merchants, strollers). Visual only — they are not
  // Phaser objects and never affect collision, events or save state.
  crowdPlots: CrowdPlot[] = [],
  // 'alpine' swaps flat blue water for a layered glacial lake (deep base,
  // shallow shore ring, drifting sun glitter).
  waterStyle3D: 'default' | 'alpine' = 'default',
): TerrainResult {
  const group = new THREE.Group();
  const cols = Math.max(1, Math.round(worldW / PX));
  const rows = Math.max(1, Math.round(worldH / PX));

  // ── Ground plane with the painted map ──
  const tex = new THREE.CanvasTexture(ground);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  // A small emissive share preserves dark authored maps, while Lambert lighting
  // lets people, trees and buildings cast soft grounding shadows onto them.
  const groundMat = new THREE.MeshLambertMaterial({
    map: tex, color: 0xffffff, emissive: 0xffffff,
    emissiveMap: tex, emissiveIntensity: 0.14,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(cols, rows), groundMat);
  plane.name = 'generated-terrain-ground';
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(cols / 2, 0, rows / 2);
  group.add(plane);

  // Skirt below the map edge so the world reads like a floating diorama slab.
  // A procedural soil texture (warm dirt + strata bands + speckles) gives the
  // slab sides the crisp low-poly earth look instead of a flat brown box.
  const skirtTex = makeSoilTexture();
  skirtTex.wrapS = skirtTex.wrapT = THREE.RepeatWrapping;
  skirtTex.repeat.set(Math.max(1, cols / 5), 1);
  const skirtMat = new THREE.MeshToonMaterial({ map: skirtTex, gradientMap: toonRamp() });
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(cols, 0.46, rows), skirtMat);
  skirt.name = 'generated-terrain-skirt';
  skirt.position.set(cols / 2, -0.25, rows / 2);
  group.add(skirt);

  // ── Sample average color per tile ──
  const sctx = ground.getContext('2d', { willReadFrequently: true })!;
  const sx = ground.width / cols, sy = ground.height / rows;
  let img: Uint8ClampedArray;
  try { img = sctx.getImageData(0, 0, ground.width, ground.height).data; }
  catch { img = new Uint8ClampedArray(4); }
  const gw = ground.width;

  const avg = (c: number, r: number): [number, number, number, number] => {
    let rr = 0, gg = 0, bb = 0, n = 0;
    let sr = 0, sg = 0, sb = 0;
    const x0 = Math.floor(c * sx), y0 = Math.floor(r * sy);
    const x1 = Math.min(ground.width, Math.floor((c + 1) * sx)), y1 = Math.min(ground.height, Math.floor((r + 1) * sy));
    const step = Math.max(1, Math.floor((x1 - x0) / 4));
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const i = (y * gw + x) * 4;
        if (img[i + 3] < 10) continue;
        rr += img[i]; gg += img[i + 1]; bb += img[i + 2]; n++;
        sr += img[i] * img[i]; sg += img[i + 1] * img[i + 1]; sb += img[i + 2] * img[i + 2];
      }
    }
    if (!n) return [0, 0, 0, 0];
    const mr = rr / n, mg = gg / n, mb = bb / n;
    const variance = (sr / n - mr * mr + sg / n - mg * mg + sb / n - mb * mb) / 3;
    return [mr, mg, mb, variance];
  };

  // Snow detection: overall very light, low-sat map → use pines + snow env.
  let lightCells = 0, darkCells = 0, vividCells = 0, total = 0;
  const cellColors: [number, number, number][] = new Array(cols * rows);
  const cellVar = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [mr, mg, mb, variance] = avg(c, r);
      cellColors[r * cols + c] = [mr, mg, mb];
      cellVar[r * cols + c] = variance;
      const hsl = rgbToHsl(mr, mg, mb);
      total++;
      if (hsl.l > 0.78 && hsl.s < 0.3) lightCells++;
      if (hsl.l < 0.16) darkCells++;
      if (hsl.s > 0.35 && hsl.l > 0.25) vividCells++;
    }
  }
  const snowy = lightCells / total > 0.4;
  const caveNamed = /cave|mine|vent|cavern|tunnel|grotto|hideout|ruins/i.test(sceneKey);
  const cavey = caveNamed
    ? darkCells / total > 0.3
    : darkCells / total > 0.45 && vividCells / total < 0.02;   // dark-toned outdoor towns (basalt Jeju: vivid≈5%) stay daylight; true caves have almost no vivid color
  const env: EnvProfile = cavey ? 'cave' : snowy ? 'snow' : 'day';
  // The cave-floor rule (don't extrude dark walkable floor) applies to real dark
  // caves AND to mixed scenes that ask for it via caveFloorHint — without
  // turning the whole scene's lighting to cave mode.
  const classifyCavey = cavey || caveFloorHint;

  // ── Classify + spawn ──
  const cells: Cell[] = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const [rr, gg, bb] = cellColors[i];
      cells[i] = classify(rgbToHsl(rr, gg, bb), snowy, cellVar[i], classifyCavey, interior, grass3D);
    }
  }

  // Tile maps are authoritative for encounter grass.  Colour sampling is only
  // a fallback for baked image maps: on authored tile maps it made ordinary
  // lawns, green paths and decorative ground sprout misleading 3D grass even
  // though wild encounters could never happen there.
  if (tileMap) {
    const grassIds = new Set(grassTileIds3D);
    const treeIds = new Set(treeTileIds3D);
    const flatIds = new Set(flatTileIds3D);
    // City streets must be flattened before WallBuilder consumes the classified
    // cells. The street-detail pass also flattens them later, but that was too
    // late: a misclassified dark road pixel had already become merged wall geometry.
    const streetIds = new Set([
      ...(cityTiles3D?.road ?? []),
      ...(cityTiles3D?.sidewalk ?? []),
      ...(cityTiles3D?.bridge ?? []),
    ]);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const tileId = tileMap[r]?.[c];
        // Scenes can publish their painted tree tiles so they grow real 3D trees
        // instead of being flattened to painted ground by the grass suppression below.
        if (tileId !== undefined && streetIds.has(tileId)) cells[i] = 'flat';
        else if (tileId !== undefined && flatIds.has(tileId)) cells[i] = 'flat';
        else if (tileId !== undefined && treeIds.has(tileId)) cells[i] = snowy ? 'pine' : 'tree';
        else if (tileId !== undefined && grassIds.has(tileId)) cells[i] = 'grass';
        else if (cells[i] === 'grass') cells[i] = 'flat';
      }
    }
  }

  // ── Building detection (exterior scenes) ──
  // Painted building footprints are busy (window grids, roof tiling) — high
  // per-cell color variance — while roads/grass/water paint flat. Contiguous
  // high-variance regions of walkable-classified cells become extruded
  // buildings: facade walls + the original painted footprint as the roof.
  const buildings: { x: number; z: number; w: number; d: number; tint: number; model?: string; authored?: boolean }[] = [];

  // Authoritative plots first: scenes that know their building rectangles
  // (e.g. a LOCATIONS table) publish them via `scene.buildingPlots`, so
  // landmark buildings like gyms never depend on color heuristics.
  if (!interior) {
    for (const p of knownPlots) {
      if (p.w < 1 || p.h < 1 || p.x < 0 || p.y < 0 || p.x + p.w > cols || p.y + p.h > rows) continue;
      let mr = 0, mg = 0, mb = 0, n = 0;
      for (let zz = p.y; zz < p.y + p.h; zz++) {
        for (let xx = p.x; xx < p.x + p.w; xx++) {
          const cc = cellColors[zz * cols + xx];
          mr += cc[0]; mg += cc[1]; mb += cc[2]; n++;
          cells[zz * cols + xx] = 'building';
        }
      }
      const tint = new THREE.Color(mr / n / 255, mg / n / 255, mb / n / 255)
        .lerp(new THREE.Color(0xffffff), 0.45).getHex();
      buildings.push({ x: p.x, z: p.y, w: p.w, d: p.h, tint, model: p.model, authored: true });
    }
  }

  // Auto-cover painted 2D mountain tiles with 3D mountain-range models. Greedily
  // decompose the mountain mass into maximal rectangles; each becomes a
  // 'mountainrange' plot (its flat art is erased, no blocky wall extrusion).
  if (!interior && mountainTileIds3D.length && tileMap) {
    const mtn = new Set(mountainTileIds3D);
    const taken = new Uint8Array(cols * rows);
    const isMtn = (x: number, z: number) =>
      x >= 0 && z >= 0 && x < cols && z < rows && !taken[z * cols + x] &&
      cells[z * cols + x] !== 'building' && mtn.has(tileMap[z]?.[x] ?? -1);
    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < cols; x++) {
        if (!isMtn(x, z)) continue;
        let w = 1;
        while (isMtn(x + w, z)) w++;
        let d = 1;
        outer: while (z + d < rows) {
          for (let xx = x; xx < x + w; xx++) if (!isMtn(xx, z + d)) break outer;
          d++;
        }
        for (let zz = z; zz < z + d; zz++)
          for (let xx = x; xx < x + w; xx++) { taken[zz * cols + xx] = 1; cells[zz * cols + xx] = 'building'; }
        buildings.push({ x, z, w, d, tint: 0x8a7a6a, model: 'mountainrange' });
      }
    }
  }

  // Preferred path: the scene's own tile grid. Buildings are rectangular blocks
  // of a dedicated tile id, so components of the discrete grid identify plots
  // exactly — far more reliable than reading the painted pixels.
  const usedTileMap = !interior && !!tileMap && tileMap.length === rows && (tileMap[0]?.length ?? 0) === cols;
  if (usedTileMap && tileMap) {
    const freq = new Map<number, number>();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const t = tileMap[r][c];
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    const seen = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (seen[idx]) continue;
        if (cells[idx] === 'building') { seen[idx] = 1; continue; }   // claimed by a known plot
        const id = tileMap[r][c];
        // Skip terrain classes we already render (ground, water, foliage) and
        // any tile that unambiguously blankets the map (roads, grass, pavement).
        const cell = cells[idx];
        if (cell === 'water' || cell === 'tree' || cell === 'pine' || cell === 'grass' || cell === 'flower') continue;
        // Only skip tiles that cover a huge share of the map outright — several
        // buildings sharing one tile id (a dense town) can legitimately total
        // ~15-20% of tiles, so the real road/plaza vs building distinction is
        // made per-connected-component below (a road is one sprawling blob; a
        // building is a compact rectangle), not by this coarse total.
        if ((freq.get(id) ?? 0) > cols * rows * 0.34) continue;
        const queue = [idx];
        const comp: number[] = [];
        seen[idx] = 1;
        while (queue.length) {
          const i2 = queue.pop()!;
          comp.push(i2);
          const cx = i2 % cols, cz = (i2 / cols) | 0;
          for (const [nx, nz] of [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]] as const) {
            if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
            const ni = nz * cols + nx;
            if (!seen[ni] && tileMap[nz][nx] === id && cells[ni] !== 'building') { seen[ni] = 1; queue.push(ni); }
          }
        }
        if (comp.length < 6) continue;
        // A single connected blob covering a big slice of the map is ground
        // (a plaza, a road network, a courtyard) — not a building footprint.
        if (comp.length > cols * rows * 0.10) continue;
        let x0 = cols, z0 = rows, x1 = -1, z1 = -1;
        for (const i2 of comp) {
          const cx = i2 % cols, cz = (i2 / cols) | 0;
          if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
          if (cz < z0) z0 = cz; if (cz > z1) z1 = cz;
        }
        const bw = x1 - x0 + 1, bd = z1 - z0 + 1;
        if (bw < 2 || bd < 2 || bw > 26 || bd > 26) continue;
        if (comp.length / (bw * bd) < 0.75) continue;          // must be a solid block
        // Rock outcrops and cliff blocks on wild routes form solid tile
        // rectangles too — but they paint in wall/rock tones. That's terrain,
        // not architecture: leave them to the cliff extruder.
        let wallish = 0;
        for (const i2 of comp) {
          const cl = cells[i2];
          if (cl === 'wall-low' || cl === 'wall-high' || cl === 'rock') wallish++;
        }
        if (wallish / comp.length >= 0.78) continue;   // grey-roofed houses stay; pure rock goes
        let mr = 0, mg = 0, mb = 0;
        for (const i2 of comp) { const cc = cellColors[i2]; mr += cc[0]; mg += cc[1]; mb += cc[2]; }
        const n = comp.length;
        // Tiny 3×2 patches (flowerbeds, planters) aren't buildings — real
        // structures in this game are at least 3×3.
        if (comp.length < 9 || bw < 3 || bd < 3) continue;
        const tint = new THREE.Color(mr / n / 255, mg / n / 255, mb / n / 255)
          .lerp(new THREE.Color(0xffffff), 0.45).getHex();
        for (let zz = z0; zz <= z1; zz++) {
          for (let xx = x0; xx <= x1; xx++) cells[zz * cols + xx] = 'building';
        }
        buildings.push({ x: x0, z: z0, w: bw, d: bd, tint });
      }
    }
  }

  // Second pass: buildings painted as scene overlays never reach the tile grid,
  // so also scan the artwork for busy blocks that aren't already plots.
  // OPT-IN: only where there is evidence of a town (authoritative plots or
  // tile-grid buildings) — wild routes' busy mountain/cave shading otherwise
  // sprouts phantom buildings all over the field.
  const urbanEvidence = knownPlots.length > 0 || buildings.length >= 2;
  if (!interior && !cavey && urbanEvidence) {
    // Seeds: busy cells (window grids, roof tiling, signage) sitting on
    // otherwise walkable ground.
    const cand = new Uint8Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) {
      const cell = cells[i];
      if ((cell === 'flat' || cell === 'rock') && cellVar[i] > 620) cand[i] = 1;
    }
    const seen = new Uint8Array(cols * rows);
    const colorDist = (a: [number, number, number], b: [number, number, number]) =>
      Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (!cand[idx] || seen[idx]) continue;
        // BFS over seed cells first…
        const queue = [idx];
        const comp: number[] = [];
        seen[idx] = 1;
        while (queue.length) {
          const i2 = queue.pop()!;
          comp.push(i2);
          const cx = i2 % cols, cz = (i2 / cols) | 0;
          for (const [nx, nz] of [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]] as const) {
            if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
            const ni = nz * cols + nx;
            if (cand[ni] && !seen[ni]) { seen[ni] = 1; queue.push(ni); }
          }
        }

        // …then grow into the building's uniform wall interior: neighbouring
        // cells whose colour matches the component's average. Without this a
        // facade is detected only where its windows are, splitting one
        // building into thin strips.
        let ar = 0, ag = 0, ab = 0;
        for (const i2 of comp) { const cc = cellColors[i2]; ar += cc[0]; ag += cc[1]; ab += cc[2]; }
        const mean: [number, number, number] = [ar / comp.length, ag / comp.length, ab / comp.length];
        const grow = [...comp];
        let guard = 0;
        while (grow.length && guard++ < 4000) {
          const i2 = grow.pop()!;
          const cx = i2 % cols, cz = (i2 / cols) | 0;
          for (const [nx, nz] of [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]] as const) {
            if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
            const ni = nz * cols + nx;
            if (seen[ni]) continue;
            const cell = cells[ni];
            if (cell !== 'flat' && cell !== 'rock') continue;
            if (colorDist(cellColors[ni], mean) > 70) continue;
            seen[ni] = 1;
            comp.push(ni);
            grow.push(ni);
          }
        }
        // bbox + fill gate
        let x0 = cols, z0 = rows, x1 = -1, z1 = -1;
        for (const i2 of comp) {
          const cx = i2 % cols, cz = (i2 / cols) | 0;
          if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
          if (cz < z0) z0 = cz; if (cz > z1) z1 = cz;
        }
        const bw = x1 - x0 + 1, bd = z1 - z0 + 1;
        if (bw >= 3 && bd >= 3 && bw <= 24 && bd <= 24 && comp.length / (bw * bd) >= 0.5) {
          let mr = 0, mg = 0, mb = 0;
          for (const i2 of comp) { const cc = cellColors[i2]; mr += cc[0]; mg += cc[1]; mb += cc[2]; }
          const n = comp.length;
          const tint = new THREE.Color(mr / n / 255, mg / n / 255, mb / n / 255)
            .lerp(new THREE.Color(0xffffff), 0.45).getHex();
          for (let zz = z0; zz <= z1; zz++) {
            for (let xx = x0; xx <= x1; xx++) cells[zz * cols + xx] = 'building';
          }
          buildings.push({ x: x0, z: z0, w: bw, d: bd, tint });
        }
      }
    }
  }

  // ── Erase the flat 2D building art under every plot ──
  // The painted map bakes buildings (walls, roofs, windows) into the ground.
  // Once a plot becomes a real 3D volume, that flat artwork would still show
  // around/through it, so we repaint each footprint with the ground tone
  // sampled just outside it (pavement/plaza), padded upward to also wipe the
  // roof art that overhangs the footprint in the 2D projection.
  if (buildings.length && !preservePaintedGround3D) {
    const gctx = ground.getContext('2d');
    if (gctx) {
      const sampleGround = (b: { x: number; z: number; w: number; d: number }): string => {
        const cands: [number, number][] = [];
        for (let k = 1; k <= 3; k++) {
          cands.push([b.x - k, b.z + b.d + k], [b.x + b.w + k, b.z + b.d + k],
                     [b.x + (b.w >> 1), b.z + b.d + k], [b.x - k, b.z + (b.d >> 1)]);
        }
        for (const [cx, cz] of cands) {
          if (cx < 0 || cz < 0 || cx >= cols || cz >= rows) continue;
          if (cells[cz * cols + cx] === 'building') continue;
          const [r0, g0, b0] = cellColors[cz * cols + cx];
          return `rgb(${Math.round(r0)},${Math.round(g0)},${Math.round(b0)})`;
        }
        return '#9a9484';
      };
      for (const b of buildings) {
        // Mountain footprints sit inside a sea of other mountain tiles, so sampling a
        // neighbour would just repaint mountain (leaving the 2D mountain visible). Wipe
        // them to a neutral earthy ground so only the 3D range shows.
        const fillStyle = b.model === 'mountainrange' ? '#6f7a5c' : sampleGround(b);
        // 2D roofs overhang upward; the painted DOOR / steps / red-cross sign sits
        // at the bottom edge and often spills a tile below and to the sides. Pad the
        // wipe in every direction so no "ghost entrance" of the old flat art peeks
        // out around the 3D building (Pokémon Centers were showing a second doorway).
        const isDolmen = b.model === 'dolmen';
        const padTop = isDolmen ? 0.18 : 2.2;
        const padBottom = isDolmen ? 0.18 : 1.2;
        const padSide = isDolmen ? 0.18 : 0.7;
        const x0 = Math.max(0, (b.x - padSide) * sx);
        const y0 = Math.max(0, (b.z - padTop) * sy);
        const w0 = (b.w + padSide * 2) * sx;
        const h0 = (b.d + padTop + padBottom) * sy;
        gctx.fillStyle = fillStyle;
        gctx.fillRect(x0, y0, w0, h0);
      }
      tex.needsUpdate = true;
    }
  }

  // ── Erase the flat 2D tree art under opted-in tree tiles ──
  // treeTileIds3D grows real 3D trees, but (unlike mountains) the scene's painted
  // pine/tree sprites stay baked into the ground and peek out from under the 3D
  // canopy. Wipe each such cell to the surrounding ground tone: street trees on
  // pavement sample the road; a dense forest whose neighbours are all trees falls
  // back to a forest-floor tone (snow on frosted passes).
  if (!interior && treeTileIds3D.length && tileMap) {
    const gctx = ground.getContext('2d');
    if (gctx) {
      const treeIds = new Set(treeTileIds3D);
      const isTreeCell = (cc: number, rr: number) =>
        cc >= 0 && rr >= 0 && cc < cols && rr < rows && treeIds.has(tileMap[rr]?.[cc] as number);
      const floorFallback = snowy ? '#dfe7ec' : '#40632f';
      const sampleFloor = (c: number, r: number): string => {
        for (let k = 1; k <= 2; k++) {
          for (const [cc, rr] of [[c - k, r], [c + k, r], [c, r + k], [c, r - k], [c + k, r + k], [c - k, r + k]] as [number, number][]) {
            if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
            const cell = cells[rr * cols + cc];
            if (isTreeCell(cc, rr) || cell === 'building') continue;
            const [r0, g0, b0] = cellColors[rr * cols + cc];
            return `rgb(${Math.round(r0)},${Math.round(g0)},${Math.round(b0)})`;
          }
        }
        return floorFallback;
      };
      // Pad the wipe slightly upward: painted pines are drawn taller than their
      // tile, so their crown overhangs the cell above along a forest edge.
      const padTop = 0.55;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!treeIds.has(tileMap[r]?.[c] as number)) continue;
          gctx.fillStyle = sampleFloor(c, r);
          gctx.fillRect(c * sx, Math.max(0, (r - padTop) * sy), sx + 1, (1 + padTop) * sy + 1);
        }
      }
      tex.needsUpdate = true;
    }
  }

  // Suppress overlapping plots — known plots come first, so heuristic
  // re-detections of the same building (or fragments inside it) are dropped.
  {
    const kept: typeof buildings = [];
    for (const b of buildings) {
      let overlapped = false;
      for (const k of kept) {
        const ix = Math.max(0, Math.min(b.x + b.w, k.x + k.w) - Math.max(b.x, k.x));
        const iz = Math.max(0, Math.min(b.z + b.d, k.z + k.d) - Math.max(b.z, k.z));
        if ((ix * iz) / (b.w * b.d) > 0.35) { overlapped = true; break; }
      }
      if (!overlapped) kept.push(b);
    }
    buildings.length = 0;
    buildings.push(...kept);
  }

  let nTree = 0, nGrass = 0, nFlower = 0, nRock = 0;
  for (let i = 0; i < cols * rows; i++) {
    const cell = cells[i];
    if (cell === 'tree' || cell === 'pine') nTree++;
    else if (cell === 'grass') nGrass++;
    else if (cell === 'flower') nFlower++;
    else if (cell === 'rock') nRock++;
  }

  const trees: InstancedProp = snowy ? makePines(nTree + 8) : makeTrees(nTree + 8);
  const safeGrassDensity = Math.max(0, Math.min(6, grassDensity3D));
  const grassCapacity = Math.ceil(nGrass * safeGrassDensity) + 8;
  const grass = snowy
    ? makeGrassTufts(grassCapacity, 0x5f8769, true)
    : makeGrassTufts(grassCapacity, grassTone3D);
  const flowers = makeFlowers(nFlower * 2 + 8);
  const rocks = makeRocks(nRock + 8);
  const walls = new WallBuilder();
  const waterRects: { x: number; z: number; w: number; d: number }[] = [];

  // Blend a bounded number of locally vendored CC0 nature models into the
  // instanced procedural foliage. The cap keeps large routes draw-call friendly
  // while giving forests and rocky areas authored silhouettes and variation.
  primeProps();
  const sceneryDefs = propsFor('scenery').filter(d => d.tags?.includes('naturefree'));
  const natureTreeDefs = sceneryDefs.filter(d => d.tags?.includes('tree') && (!snowy || d.tags?.includes('pine')));
  const natureRockDefs = sceneryDefs.filter(d => d.tags?.includes('rock'));
  const pendingScenery: {
    group: THREE.Group;
    def: import('./PropModels').PropDef;
    scale: number;
    rot: number;
    wait: number;
  }[] = [];
  let communityNatureCount = 0;
  // How many authored Kenney nature models a single map may place (trees, rocks and
  // the rocks/pines that dress mountain ridges all draw from this shared budget).
  // Each is its own draw call, so this trades a fuller Pokémon-style world against
  // mobile frame-rate — bump it up on desktop-only builds.
  const NATURE_BUDGET = 120;

  const rnd = mulberry(12345);

  // Merge horizontal runs of wall cells into single blocks; place props per cell.
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const cell = cells[r * cols + c];
      if (cell === 'wall-high' || cell === 'wall-low') {
        let run = c;
        const kind = cell;
        while (run < cols && cells[r * cols + run] === kind) run++;
        const [rr, gg, bb] = cellColors[r * cols + ((c + run - 1) >> 1)];
        const color = (Math.round(rr) << 16) | (Math.round(gg) << 8) | Math.round(bb);
        const isEdge = r === 0 || r === rows - 1 || c === 0 || run === cols;
        let h = kind === 'wall-high' ? (isEdge ? 2.6 : 2.0) : 1.25;
        // Inside rooms and caves a static, angled camera can't see over tall
        // walls, so the player vanishes behind them. Keep interior/cave walls
        // low (a diorama look) so the character is always visible.
        if (interior || classifyCavey) h = Math.min(h, isEdge ? 1.0 : 0.7);
        // clearSight3D outdoor scenes now raise hills/mountains in 3D too (user opted into
        // "trees + mountains everywhere"); cap the height a little so the character stays
        // visible against the static camera even where the painted terrain is a tall ridge.
        else if (clearSight3D) h = Math.min(h, isEdge ? 2.2 : 1.5);
        // flatTerrain3D scenes (cramped dark caves) raise NOTHING — the painted 2D
        // tile stays on the ground so no black wall ever hides the player.
        if (!flatTerrain3D) walls.add(c, r, run, r + 1, h, color === 0 ? 0x1c1a24 : color);
        c = run;
        continue;
      }
      if (cell === 'water') {
        let run = c;
        while (run < cols && cells[r * cols + run] === 'water') run++;
        waterRects.push({ x: c, z: r, w: run - c, d: 1 });
        c = run;
        continue;
      }
      const cx = c + 0.5, cz = r + 0.5;
      if (flatTerrain3D) { c++; continue; }   // cramped caves stay flat: no props/foliage either
      // Formerly clearSight3D scenes skipped ALL foliage, leaving flat painted trees on the
      // 3D ground. They now grow real 3D trees/grass/flowers/rocks like every other scene
      // (user opted into "trees everywhere"), trading a little sight-line for a fuller world.
      switch (cell) {
        case 'tree': case 'pine':
          if (interior) break;
          {
            const x = cx + (rnd() - 0.5) * 0.3;
            const z = cz + (rnd() - 0.5) * 0.3;
            const rot = rnd() * Math.PI * 2;
            // Prefer an authored Kenney tree for most trees (clean, Pokémon-style
            // silhouettes); fall back to the cheap instanced blob for the rest.
            const natureDef = communityNatureCount < NATURE_BUDGET && rnd() > 0.42
              ? pickProp(natureTreeDefs, c * 31 + r * 17)
              : null;
            if (natureDef) {
              const holder = new THREE.Group();
              holder.position.set(x, 0, z);
              group.add(holder);
              pendingScenery.push({ group: holder, def: natureDef, scale: 1.5 + rnd() * 0.8, rot, wait: 0 });
              communityNatureCount++;
            } else {
              trees.place(x, z, 0.85 + rnd() * 0.45, rot);
            }
          }
          break;
        case 'grass':
          if (interior) break;
          {
            const whole = Math.floor(safeGrassDensity);
            const count = whole + (rnd() < safeGrassDensity - whole ? 1 : 0);
            for (let i = 0; i < count; i++) {
              grass.place(cx + (rnd() - 0.5) * 0.72, cz + (rnd() - 0.5) * 0.72, 0.72 + rnd() * 0.45, rnd() * Math.PI);
            }
          }
          break;
        case 'flower':
          if (interior) break;
          flowers.place(cx + (rnd() - 0.5) * 0.5, cz + (rnd() - 0.5) * 0.5, 0.8 + rnd() * 0.5, rnd() * Math.PI);
          break;
        case 'rock': {
          // Boulders only in real rocky AREAS — thin grey strips (curbs, road
          // edges) share the color but have few same-class neighbors. Wide grey
          // roads DO have many neighbors, so also require the cell to carry
          // genuine surface texture: painted asphalt is a flat single colour
          // (near-zero variance) while real rock artwork is speckled/rough.
          // This keeps gravel off city roads (e.g. 소올/Capitol) everywhere.
          let rockNeighbors = 0;
          for (let dz = -1; dz <= 1; dz++) {
            for (let dxx = -1; dxx <= 1; dxx++) {
              if (!dxx && !dz) continue;
              const nx = c + dxx, nz = r + dz;
              if (nx >= 0 && nz >= 0 && nx < cols && nz < rows && cells[nz * cols + nx] === 'rock') rockNeighbors++;
            }
          }
          const rough = cellVar[r * cols + c] > 300;
          if (!noRocks3D && !interior && rough && rockNeighbors >= 4 && rnd() > 0.72) {
            const x = cx + (rnd() - 0.5) * 0.4;
            const z = cz + (rnd() - 0.5) * 0.4;
            const rot = rnd() * Math.PI * 2;
            const natureDef = communityNatureCount < NATURE_BUDGET && rnd() > 0.4
              ? pickProp(natureRockDefs, c * 19 + r * 37)
              : null;
            if (natureDef) {
              const holder = new THREE.Group();
              holder.position.set(x, 0, z);
              group.add(holder);
              pendingScenery.push({ group: holder, def: natureDef, scale: 0.6 + rnd() * 0.55, rot, wait: 0 });
              communityNatureCount++;
            } else {
              rocks.place(x, z, 0.7 + rnd() * 0.6, rot);
            }
          }
          break;
        }
        default: break;
      }
      c++;
    }
  }

  trees.finalize(); grass.finalize(); flowers.finalize(); rocks.finalize();
  for (const p of [...trees.meshes, ...grass.meshes, ...flowers.meshes, ...rocks.meshes]) group.add(p);
  const grassMotion = grass.placements.map((_, i) => ({
    phase: i * 1.618,
    age: 99,
    near: false,
    dirX: 0,
    dirZ: 1,
    pitch: 0,
    roll: 0,
  }));
  // Grass interaction is local to the player, so index clumps in coarse cells
  // instead of running trigonometry across every tuft on a large route each
  // frame. Recently kicked clumps remain active until they settle naturally.
  const grassBucketSize = 3;
  const grassBuckets = new Map<string, number[]>();
  const grassBucketKey = (x: number, z: number) => `${Math.floor(x / grassBucketSize)}:${Math.floor(z / grassBucketSize)}`;
  grass.placements.forEach((p, i) => {
    const key = grassBucketKey(p.x, p.z);
    const bucket = grassBuckets.get(key);
    if (bucket) bucket.push(i);
    else grassBuckets.set(key, [i]);
  });
  const activeGrass = new Set<number>();
  let lastGrassPlayer: { x: number; z: number } | null = null;
  const wallMesh = walls.build();
  if (wallMesh) group.add(wallMesh);

  // ── Buildings ──
  // If generated building models are available they're placed on the detected
  // plots (deterministically chosen, fitted to the footprint); otherwise the
  // engine extrudes facade+roof volumes from the original painted art.
  const blockers: { node: THREE.Object3D; r: number; fade: number }[] = [];
  const pendingProps: { group: THREE.Group; fallback: THREE.Group; def: import('./PropModels').PropDef; b: typeof buildings[number]; h: number; wait: number; rot?: number }[] = [];

  /** Facade+roof volume built from the original painted art (always available). */
  const extrudeBuilding = (b: typeof buildings[number], into: THREE.Object3D, local = false) => {
    const h = plotHeight(b.w, b.d);
    const floors = Math.max(1, Math.round(h / 1.15));
    const cx = local ? 0 : b.x + b.w / 2, cz = local ? 0 : b.z + b.d / 2;
    const wallMat = facadeMaterial(b.tint, Math.max(1, Math.round((b.w + b.d) / 2 * 0.8)), floors);
    const wallsBox = new THREE.Mesh(new THREE.BoxGeometry(b.w, h, b.d), wallMat);
    wallsBox.position.set(cx, h / 2, cz);
    into.add(wallsBox);
    // Layered plinth and corner rhythm make a generic extrusion read as a
    // designed building rather than a single texture-wrapped cube.
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 0.08, 0.18, b.d + 0.08),
      new THREE.MeshToonMaterial({ color: 0xd8d1c4, gradientMap: toonRamp() }),
    );
    base.position.set(cx, 0.09, cz);
    into.add(base);
    const roofH = Math.max(0.48, Math.min(1.25, Math.min(b.w, b.d) * 0.24));
    const roof = new THREE.Mesh(
      makeHipRoofGeometry(b.w + 0.54, b.d + 0.54, roofH),
      roofMaterial(tex, b, cols, rows),
    );
    roof.position.set(cx, h + 0.02, cz);
    into.add(roof);
    const eave = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 0.5, 0.11, b.d + 0.5),
      new THREE.MeshToonMaterial({ color: 0x4a4038, gradientMap: toonRamp() }),
    );
    eave.position.set(cx, h + 0.015, cz);
    into.add(eave);
  };

  // Generic building GLBs (house/hanok/…) were being stamped onto EVERY detected
  // footprint, so the same one or two models blanketed every town — hanok and
  // plain houses everywhere. Until per-city, purpose-built models exist (and a
  // way to match them to the right footprint, e.g. a red-roofed Pokémon Center),
  // the default is the procedural facade+roof extruded straight from each
  // scene's own painted art, which keeps every city looking like itself. Flip
  // USE_GENERIC_BUILDING_GLBS back on once tagged per-building models land.
  // Generic building GLBs (house/hanok/…) were being stamped onto EVERY detected
  // footprint, so the same one or two models blanketed every town. So a footprint
  // only gets a GLB when the SCENE names a specific model for it (b.model — e.g.
  // Waterfall City's home / rival / lab / Pokémon Center published via
  // scene.buildingPlots). Every other footprint falls back to the procedural
  // facade+roof extruded straight from that scene's own painted art, so each
  // city keeps looking like itself.
  const cityfreeDefs = freeBuildings ? propsFor('building').filter(d => d.tags?.includes('cityfree')) : [];
  for (const b of buildings) {
    // The 노스단 approach names its original painted four-storey facade. Build
    // that exact single structure procedurally instead of composing several
    // unrelated generic landmark GLBs.
    if (b.model === 'nosdan-hq') {
      const holder = new THREE.Group();
      holder.position.set(b.x + b.w / 2, 0, b.z + b.d / 2);
      holder.add(makeNosdanHQ(b.w, b.d));
      group.add(holder);
      blockers.push({ node: holder, r: Math.max(b.w, b.d) / 2 + 0.6, fade: 0 });
      continue;
    }
    // The southern Onnuri League hall is reproduced from its painted 2D palace
    // (LeaguePlazaScene.drawPalace) rather than a generic landmark GLB.
    if (b.model === 'hanok-palace') {
      const holder = new THREE.Group();
      holder.position.set(b.x + b.w / 2, 0, b.z + b.d / 2);
      holder.add(makeHanokPalace(b.w, b.d));
      group.add(holder);
      blockers.push({ node: holder, r: Math.max(b.w, b.d) / 2 + 0.6, fade: 0 });
      continue;
    }
    // The northern capital's grand granite palace (Gwanmunseong) — a bespoke
    // procedural landmark so it renders as a majestic hall on every device,
    // never the flat grey box a disabled 'palace' GLB would fall back to.
    if (b.model === 'grand-palace') {
      const holder = new THREE.Group();
      holder.position.set(b.x + b.w / 2, 0, b.z + b.d / 2);
      holder.add(makeGrandPalace(b.w, b.d));
      group.add(holder);
      blockers.push({ node: holder, r: Math.max(b.w, b.d) / 2 + 0.6, fade: 0 });
      continue;
    }
    // The Seorae ice gym (서리종 체육관) — a bespoke glacier-blue hall with a
    // crystal spire and golden frost-bell, guaranteed on every device instead of
    // the old shrine GLB fallback.
    if (b.model === 'frostgym') {
      const holder = new THREE.Group();
      holder.position.set(b.x + b.w / 2, 0, b.z + b.d / 2);
      holder.add(makeFrostGym(b.w, b.d));
      group.add(holder);
      blockers.push({ node: holder, r: Math.max(b.w, b.d) / 2 + 0.6, fade: 0 });
      continue;
    }
    // A scenic 3D mountain range backdrop in place of flat painted 2D mountains.
    // No fade-blocker: it sits at the map edge, behind all gameplay.
    if (b.model === 'mountainrange') {
      const holder = new THREE.Group();
      holder.position.set(b.x + b.w / 2, 0, b.z + b.d / 2);
      holder.add(makeMountainRange(b.w, b.d));
      group.add(holder);
      continue;
    }
    // Scene-authored safe aliases opt out of generated GLBs whose meshes or
    // textures contain stray exterior fragments. These procedural exteriors are
    // bounded exactly by the road-trimmed plot and never project into a street.
    if (b.model === 'pokecenter-procedural' || b.model === 'mart-procedural') {
      const holder = new THREE.Group();
      holder.position.set(b.x + b.w / 2, 0, b.z + b.d / 2);
      // Both procedural roofs have a 0.7-unit overhang. Inset the body by the
      // same amount so even the eaves remain inside the road-cleared plot.
      const safeW = Math.max(1, b.w - 0.7);
      const safeD = Math.max(1, b.d - 0.7);
      holder.add(b.model === 'pokecenter-procedural'
        ? makePokemonCenter(safeW, safeD)
        : makePokeMart(safeW, safeD));
      group.add(holder);
      blockers.push({ node: holder, r: Math.max(b.w, b.d) / 2 + 0.6, fade: 0 });
      continue;
    }
    const def = b.model ? propById(b.model) : null;
    if (def) {
      const holder = new THREE.Group();
      holder.position.set(b.x + b.w / 2, 0, b.z + b.d / 2);
      // Never expose an empty plot while a large GLB streams in. The local shell
      // remains the failure fallback and is hidden when the model is ready.
      const fallback = new THREE.Group();
      extrudeBuilding(b, fallback, true);
      holder.add(fallback);
      group.add(holder);
      const h = plotHeight(b.w, b.d);
      // Named landmark buildings face the street (door side toward +z / camera)
      // rather than a random hash rotation.
      pendingProps.push({ group: holder, fallback, def, b, h, wait: 0, rot: 0 });
      blockers.push({ node: holder, r: Math.max(b.w, b.d) / 2 + 0.6, fade: 0 });
      continue;
    }
    // A named remote GLB may be intentionally disabled on a memory-constrained
    // device (mobile) or absent from the registry. Pokémon Centers and Marts get a
    // purpose-built procedural exterior so they stay recognizable (red-cross / blue
    // sign) instead of collapsing to a generic grey box.
    if (b.model === 'pokecenter' || b.model === 'mart') {
      const holder = new THREE.Group();
      holder.position.set(b.x + b.w / 2, 0, b.z + b.d / 2);
      holder.add(b.model === 'pokecenter' ? makePokemonCenter(b.w, b.d) : makePokeMart(b.w, b.d));
      group.add(holder);
      blockers.push({ node: holder, r: Math.max(b.w, b.d) / 2 + 0.6, fade: 0 });
      continue;
    }
    // Any other named remote GLB: preserve the building as a local procedural 3D
    // extrusion instead of leaving an empty/black footprint.
    if (b.model) {
      const fallback = new THREE.Group();
      fallback.position.set(b.x + b.w / 2, 0, b.z + b.d / 2);
      group.add(fallback);
      extrudeBuilding(b, fallback, true);
      blockers.push({ node: fallback, r: Math.max(b.w, b.d) / 2 + 0.6, fade: 0 });
      continue;
    }
    // Explicit model-less plots are still real buildings. Named-only cities use
    // these for procedural apartments/civic blocks; previously their painted
    // footprint was erased and then skipped, leaving a permanent skyline hole.
    if (b.authored) {
      const bg = new THREE.Group();
      bg.position.set(b.x + b.w / 2, 0, b.z + b.d / 2);
      group.add(bg);
      extrudeBuilding(b, bg, true);
      blockers.push({ node: bg, r: Math.max(b.w, b.d) / 2 + 0.6, fade: 0 });
      continue;
    }
    // Scene wants only its named landmarks in 3D — heuristic footprints are
    // skipped, while authored plots above remain visible.
    if (onlyNamedBuildings) continue;
    // Towns without authored models can opt into free CC0 city buildings: pick
    // one deterministically per footprint (so it's varied but stable).
    if (freeBuildings) {
      const fdef = pickProp(cityfreeDefs, b.x * 31 + b.z * 17);
      if (fdef) {
        const holder = new THREE.Group();
        holder.position.set(b.x + b.w / 2, 0, b.z + b.d / 2);
        group.add(holder);
        // Face every free city building the same way — facade toward the camera (+z)
        // like the named landmarks — instead of a random per-tile hash rotation.
        const fallback = new THREE.Group();
        extrudeBuilding(b, fallback, true);
        holder.add(fallback);
        pendingProps.push({ group: holder, fallback, def: fdef, b, h: plotHeight(b.w, b.d), wait: 0, rot: 0 });
        blockers.push({ node: holder, r: Math.max(b.w, b.d) / 2 + 0.6, fade: 0 });
        continue;
      }
    }
    const bg = new THREE.Group();
    bg.position.set(b.x + b.w / 2, 0, b.z + b.d / 2);
    group.add(bg);
    extrudeBuilding(b, bg, true);
    blockers.push({ node: bg, r: Math.max(b.w, b.d) / 2 + 0.6, fade: 0 });
  }

  // ── Vehicles parked along the roads (generated models only) ────────────────
  let lastT = -1;                       // for real-time deltas in update()
  const sacredPeakNature = sacredPeakNature3D ? makeSacredPeakCloudSea(cols, rows) : null;
  if (sacredPeakNature) group.add(sacredPeakNature.group);
  const pendingVehicles: { group: THREE.Group; def: import('./PropModels').PropDef; scale: number; rot: number }[] = [];
  if (!interior && !noVehicles && placedVehicles.length) {
    // The scene pins its vehicles (e.g. the Songhyeon express bus at its stop) —
    // place those exact models at their collision-aware authored locations.
    for (const v of placedVehicles) {
      const def = propById(v.model);
      if (!def) continue;
      const holder = new THREE.Group();
      holder.position.set(v.x + 0.5, 0, v.y + 0.5);
      group.add(holder);
      pendingVehicles.push({ group: holder, def, scale: 1.3, rot: v.rot ?? 0 });
      blockers.push({ node: holder, r: 1.35, fade: 0 });
    }
  }

  // Merge water rows into one animated sheet spanning their bounding box each row-run.
  const waters: { mesh: THREE.Mesh; update(t: number): void }[] = [];
  for (const wr of waterRects) {
    const w = waterStyle3D === 'alpine' ? makeAlpineLake(wr.w, wr.d) : makeWater(wr.w, wr.d);
    w.mesh.position.set(wr.x + wr.w / 2, 0.06, wr.z + wr.d / 2);
    group.add(w.mesh);
    waters.push(w);
  }

  // Scene-pinned decorative props (pines, stone lanterns, ice statues), placed
  // at the centre of their tile.
  for (const p of propPlots) {
    const storeFixture = p.kind.startsWith('store-');
    const obj = storeFixture ? makeStoreFixture(p.kind as StoreFixtureKind, p.w ?? 1, p.d ?? 1, p.color)
      : p.kind === 'tree' ? makeForestTree()
      : p.kind === 'pine' ? makePineTree()
      : p.kind === 'palm' ? makePalmTree(p.x * 7 + p.y * 13)
      : p.kind === 'lantern' ? makeStoneLantern()
        : p.kind === 'rock' ? makeScenicRock()
          : p.kind === 'flower' ? makeFlowerBed()
            : p.kind === 'glowplant' ? makeGlowPlants()
              : p.kind === 'woodbridge' ? makeWoodBridge(p.w ?? 2, p.d ?? 3)
        : p.kind === 'rail' ? makeRailTrack(p.len ?? 4)
          : p.kind === 'obelisk' ? makeGrandObelisk()
            : p.kind === 'statue' ? makeBronzeStatue()
              : p.kind === 'arch' ? makeTriumphalArch()
                : p.kind === 'pot' ? makePot()
                  : p.kind === 'streetlamp' ? makeStreetlamp()
                    : p.kind === 'minecart' ? makeMineCart()
                      : p.kind === 'cherry' ? makeCherryTree()
                        : p.kind === 'stall' ? makeStall()
                          : p.kind === 'waterfall' ? makeWaterfall(p.len ?? 3)
                            : p.kind === 'boat' ? makeBoat()
                              : p.kind === 'ferry' ? makeFerry(p.len ?? 6.5, p.w ?? 2.4)
                              : p.kind === 'fishstall' ? makeFishStall()
                                : p.kind === 'crates' ? makeCrateStack()
                                  : p.kind === 'dryingrack' ? makeDryingRack()
                                    : p.kind === 'bollard' ? makeBollard()
                                      : p.kind === 'buoy' ? makeBuoy()
                                        : p.kind === 'net' ? makeFishingNet()
                                          : p.kind === 'trainingpost' ? makeTrainingPost()
                                            : p.kind === 'strawdummy' ? makeStrawDummy()
                                              : p.kind === 'weaponrack' ? makeWeaponRack()
                                                : p.kind === 'sparringring' ? makeSparringRing(p.len ?? 3)
                                                  : p.kind === 'banner' ? makeSchoolBanner(p.color)
                                                    : p.kind === 'bellframe' ? makeBellFrame()
                                                      : p.kind === 'meditationrock' ? makeMeditationRock()
                                                        : p.kind === 'firewood' ? makeFirewoodStack()
                                                          : p.kind === 'pokeball' ? makePokeBallProp()
                                                          : p.kind === 'starterbench' ? makeStarterBenchProp()
                                                          : makeIceStatue();
    obj.position.set(p.x + (storeFixture ? (p.w ?? 1) / 2 : 0.5), 0, p.y + (storeFixture ? (p.d ?? 1) / 2 : 0.5));
    if (p.scale) obj.scale.setScalar(p.scale);
    if (p.rot) obj.rotation.y = p.rot;
    group.add(obj);
    const propRadius = p.kind === 'ferry'
      ? Math.max(p.len ?? 6.5, p.w ?? 2.4) / 2
      : storeFixture ? Math.max(p.w ?? 1, p.d ?? 1) / 2 : (p.scale ?? 1);
    blockers.push({ node: obj, r: Math.max(0.7, propRadius), fade: 0 });
  }

  // ── AAA street layer ──
  // Rebuild roads and pavements as real 3D surfaces. The painted versions are
  // wiped from the ground decal first so nothing shows through the new meshes.
  let cityDetail: { group: THREE.Group; update(t: number): void } | null = null;
  if (!interior && cityTiles3D && tileMap && tileMap.length === rows && (tileMap[0]?.length ?? 0) === cols) {
    const gctx = ground.getContext('2d');
    if (gctx) {
      const streetIds = new Set<number>([
        ...cityTiles3D.road, ...cityTiles3D.sidewalk, ...(cityTiles3D.bridge ?? []),
      ]);
      gctx.fillStyle = '#4a4a50';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!streetIds.has(tileMap[r][c])) continue;
          gctx.fillRect(c * sx, r * sy, sx + 1, sy + 1);
          cells[r * cols + c] = 'flat';        // never sprout foliage on a street
        }
      }
      tex.needsUpdate = true;
    }
    cityDetail = buildCityDetail(tileMap, cityTiles3D, {
      seed: sceneKey.length * 7919,
      buildingPlots: knownPlots,
    });
    group.add(cityDetail.group);
  }

  // ── Ambient townsfolk ──
  const crowd = (!interior && crowdPlots.length) ? buildAmbientCrowd(crowdPlots) : null;
  if (crowd) group.add(crowd.group);

  return {
    group, env, cols, rows,
    plots: buildings.map(b => ({ x: b.x, z: b.z, w: b.w, d: b.d })),
    blockers,
    envStats: { dark: darkCells / total, vivid: vividCells / total, light: lightCells / total },
    update(t: number, playerPos?: { x: number; z: number } | null) {
      const dt = lastT < 0 ? 0 : Math.max(0, Math.min(0.5, t - lastT));
      lastT = t;
      cityDetail?.update(t);
      crowd?.update(dt);
      sacredPeakNature?.update(t);
      for (const w of waters) w.update(t);

      // Rustle only the tufts around a moving player. Each contact produces a
      // quick oscillation that bends with travel direction and eases back to
      // rest; a faint local breeze keeps the patch from looking mechanical.
      const dx = playerPos && lastGrassPlayer ? playerPos.x - lastGrassPlayer.x : 0;
      const dz = playerPos && lastGrassPlayer ? playerPos.z - lastGrassPlayer.z : 0;
      const moved = Math.hypot(dx, dz);
      const moving = moved > 0.002;
      const invMove = moving ? 1 / moved : 0;
      if (playerPos) {
        const bx = Math.floor(playerPos.x / grassBucketSize);
        const bz = Math.floor(playerPos.z / grassBucketSize);
        for (let oz = -1; oz <= 1; oz++) {
          for (let ox = -1; ox <= 1; ox++) {
            const bucket = grassBuckets.get(`${bx + ox}:${bz + oz}`);
            if (bucket) for (const index of bucket) activeGrass.add(index);
          }
        }
      }

      let grassDirty = false;
      for (const i of activeGrass) {
        const motion = grassMotion[i];
        const p = grass.placements[i];
        const pdx = playerPos ? playerPos.x - p.x : 99;
        const pdz = playerPos ? playerPos.z - p.z : 99;
        const distSq = pdx * pdx + pdz * pdz;
        const near = distSq < 0.82 * 0.82;
        motion.age += dt;
        if (near && moving && (!motion.near || motion.age > 0.2)) {
          motion.age = 0;
          motion.dirX = dx * invMove;
          motion.dirZ = dz * invMove;
        }
        motion.near = near;

        const energy = Math.exp(-motion.age * 3.8);
        if (!near && energy < 0.0008 && Math.abs(motion.pitch) < 0.001 && Math.abs(motion.roll) < 0.001) {
          activeGrass.delete(i);
          continue;
        }
        const kick = Math.sin(motion.age * 19) * 0.34 * energy;
        const breeze = distSq < 2.4 * 2.4 ? Math.sin(t * 3.1 + motion.phase) * 0.025 : 0;
        const pitch = -motion.dirZ * kick + breeze;
        const roll = motion.dirX * kick + breeze * 0.55;
        if (Math.abs(pitch - motion.pitch) > 0.001 || Math.abs(roll - motion.roll) > 0.001) {
          motion.pitch = pitch;
          motion.roll = roll;
          grass.setSway(i, pitch, roll);
          grassDirty = true;
        }
      }
      if (grassDirty) grass.commit();
      if (playerPos) {
        if (lastGrassPlayer) { lastGrassPlayer.x = playerPos.x; lastGrassPlayer.z = playerPos.z; }
        else lastGrassPlayer = { x: playerPos.x, z: playerPos.z };
      } else {
        lastGrassPlayer = null;
      }

      // Generated building/vehicle models stream in asynchronously — attach and
      // fit each one to its plot as soon as its GLB finishes loading.
      for (let i = pendingProps.length - 1; i >= 0; i--) {
        const p = pendingProps[i];
        const model = getProp(p.def);
        if (!model) {
          // If the generated model can't be fetched (offline / bad URL), fall
          // back to the painted-art extrusion so the city is never empty. Keep
          // waiting as long as the GLB is still loading — big models take several
          // seconds to decode on a phone the first time, and giving up early left
          // the fallback until the scene was re-entered (GLB cached by then).
          p.wait += dt;
          if (propFailed(p.def) || (!propLoading(p.def) && p.wait > 2.5)) {
            pendingProps.splice(i, 1);
          }
          continue;
        }
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        // Model is 1 unit tall; scale so its footprint fills the plot without
        // overflowing, then let height follow (capped to the plot-derived h).
        const fit = Math.min(
          p.b.w / Math.max(0.001, size.x),
          p.b.d / Math.max(0.001, size.z),
          p.h,
        );
        model.scale.multiplyScalar(fit);
        model.rotation.y = p.rot ?? ((p.b.x * 7 + p.b.z * 13) % 4) * (Math.PI / 2);
        p.fallback.visible = false;
        p.group.add(model);
        pendingProps.splice(i, 1);
      }
      for (let i = pendingScenery.length - 1; i >= 0; i--) {
        const p = pendingScenery[i];
        const model = getProp(p.def);
        if (!model) {
          p.wait += dt;
          if (propFailed(p.def) || (!propLoading(p.def) && p.wait > 2.5)) pendingScenery.splice(i, 1);
          continue;
        }
        model.scale.multiplyScalar(p.scale);
        model.rotation.y = p.rot;
        p.group.add(model);
        pendingScenery.splice(i, 1);
      }
      for (let i = pendingVehicles.length - 1; i >= 0; i--) {
        const v = pendingVehicles[i];
        const model = getProp(v.def);
        if (!model) continue;
        model.scale.multiplyScalar(v.scale);
        model.rotation.y = v.rot;
        v.group.add(model);
        pendingVehicles.splice(i, 1);
      }
    },
  };
}

/** Small deterministic PRNG so prop placement is stable between rebuilds. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
