import * as THREE from 'three';

// ── Sprite → 3D relief extruder ──────────────────────────────────────────────
// Converts any 2D artwork (creature PNGs, rasterized character graphics, text
// labels) into a real 3D mesh: the opaque silhouette is scanned on a coarse
// grid, merged into horizontal slabs, and extruded with depth so the art gains
// genuine volume while staying 100% recognizable — the original art IS the
// texture. Results are cached by key so walk-cycle frames and repeated
// creatures cost nothing after first build.

export interface ReliefMesh {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
  /** Size of the source art in pixels (after trim). */
  pxWidth: number; pxHeight: number;
  /** Offset of trimmed art from the original top-left, px. */
  trimX: number; trimY: number;
  origWidth: number; origHeight: number;
}

const cache = new Map<string, ReliefMesh>();

export function clearReliefCache(): void {
  for (const r of cache.values()) { r.geometry.dispose(); r.texture.dispose(); }
  cache.clear();
}

function makeTexture(canvas: HTMLCanvasElement | HTMLImageElement): THREE.Texture {
  const tex = new THREE.Texture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;             // keep the pixel-art crisp
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** Draw an image/canvas into a fresh canvas so we can read pixels. */
function toCanvas(src: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  if (src instanceof HTMLCanvasElement) return src;
  const c = document.createElement('canvas');
  c.width = src.naturalWidth || src.width;
  c.height = src.naturalHeight || src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

/**
 * Build (or fetch from cache) a relief mesh for the given artwork.
 * `key` must uniquely identify the art content (texture key + frame + hash).
 * `depthPx` is the extrusion thickness in source pixels (auto if omitted).
 */
export function buildRelief(
  key: string,
  source: HTMLImageElement | HTMLCanvasElement,
  depthPx?: number,
): ReliefMesh | null {
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = toCanvas(source);
  const W = canvas.width, H = canvas.height;
  if (W < 1 || H < 1) return null;
  let data: Uint8ClampedArray;
  try {
    data = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
  } catch { return null; }                          // tainted canvas — shouldn't happen locally

  // ── Trim transparent border ──
  let tx0 = W, ty0 = H, tx1 = -1, ty1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 24) {
        if (x < tx0) tx0 = x; if (x > tx1) tx1 = x;
        if (y < ty0) ty0 = y; if (y > ty1) ty1 = y;
      }
    }
  }
  if (tx1 < 0) return null;                         // fully transparent
  const tw = tx1 - tx0 + 1, th = ty1 - ty0 + 1;

  // ── Occupancy grid (finer resolution; two-tier solidity test) ──
  // A cell is "core" when ≥10% of its pixels are opaque. Cells with even a
  // sliver of coverage (≥2.5%) are kept too as long as they touch the body —
  // that preserves thin tails, crests, whiskers and wing tips which the old
  // flat threshold amputated — while isolated specks (which caused floating
  // slabs outside the silhouette) still get dropped.
  const GRID = Math.max(1, Math.ceil(Math.max(tw, th) / 72));
  const gw = Math.ceil(tw / GRID), gh = Math.ceil(th / GRID);
  const occ = new Uint8Array(gw * gh);
  const cover = new Float32Array(gw * gh);
  const cellCol = new Float32Array(gw * gh * 3);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const px0 = tx0 + gx * GRID, py0 = ty0 + gy * GRID;
      const px1 = Math.min(tx0 + tw, px0 + GRID), py1 = Math.min(ty0 + th, py0 + GRID);
      let n = 0, rr = 0, gg = 0, bb = 0;
      const total = Math.max(1, (px1 - px0) * (py1 - py0));
      for (let y = py0; y < py1; y++) {
        for (let x = px0; x < px1; x++) {
          const i4 = (y * W + x) * 4;
          if (data[i4 + 3] > 40) { n++; rr += data[i4]; gg += data[i4 + 1]; bb += data[i4 + 2]; }
        }
      }
      const idx = gy * gw + gx;
      cover[idx] = n / total;
      occ[idx] = cover[idx] >= 0.10 ? 1 : 0;
      if (n > 0) {
        cellCol[idx * 3] = (rr / n) / 255;
        cellCol[idx * 3 + 1] = (gg / n) / 255;
        cellCol[idx * 3 + 2] = (bb / n) / 255;
      }
    }
  }
  // Grow the body outward into faintly-covered neighbors (thin extremities can
  // span several cells, so iterate: each pass reclaims the next link of a tail).
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const idx = gy * gw + gx;
        if (occ[idx] || cover[idx] < 0.025) continue;
        let touch = false;
        for (let dy = -1; dy <= 1 && !touch; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = gx + dx, ny = gy + dy;
            if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && occ[ny * gw + nx]) { touch = true; break; }
          }
        }
        if (touch) { occ[idx] = 1; changed = true; }
      }
    }
    if (!changed) break;
  }

  // ── Greedy horizontal runs → one continuous extruded silhouette ──
  // Front/back faces carry the artwork texture (material group 0); side, top
  // and bottom faces are painted with the cell's average color via vertex
  // colors (material group 1) so silhouette edges look cleanly "carved"
  // instead of smearing neighboring texture rows.
  const depth = depthPx ?? Math.max(3, Math.min(tw, th) * 0.16);
  const pos: number[] = [], uv: number[] = [], norm: number[] = [], col: number[] = [];
  const idxTex: number[] = [], idxSide: number[] = [];
  const U = (px: number) => (tx0 + px) / W;
  const V = (px: number) => 1 - (ty0 + px) / H;     // three.js UV origin bottom-left

  // Art plane: x → right, y → up (art top at +h), z → thickness.
  const quad = (
    into: number[],
    ax: number, ay: number, az: number, bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number, dx: number, dy: number, dz: number,
    nx: number, ny: number, nz: number,
    ua: number, va: number, ub: number, vb: number, uc: number, vc: number, ud: number, vd: number,
    r = 1, g = 1, b = 1,
  ) => {
    const base = pos.length / 3;
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
    for (let k = 0; k < 4; k++) { norm.push(nx, ny, nz); col.push(r, g, b); }
    uv.push(ua, va, ub, vb, uc, vc, ud, vd);
    into.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  const yUp = (py: number) => th - py;              // art px y → mesh y (art bottom = 0)
  const hz = depth / 2;

  for (let gy = 0; gy < gh; gy++) {
    let gx = 0;
    while (gx < gw) {
      if (!occ[gy * gw + gx]) { gx++; continue; }
      let run = gx;
      while (run < gw && occ[gy * gw + run]) run++;
      const x0 = gx * GRID, x1 = Math.min(tw, run * GRID);
      const y0 = gy * GRID, y1 = Math.min(th, (gy + 1) * GRID);
      const edge = 0.82;                            // side faces slightly darker (fake AO)
      // Emit only the parts of this run that are actually exposed above or
      // below. Testing just the first cell would cap an entire changing-width
      // row and leave internal shelves through the model (the "accordion"
      // look on thick Pokémon reliefs).
      const horizontalBoundary = (neighborY: number, py: number, top: boolean) => {
        let start = -1;
        for (let cx = gx; cx <= run; cx++) {
          const exposed = cx < run
            && (neighborY < 0 || neighborY >= gh || !occ[neighborY * gw + cx]);
          if (exposed && start < 0) {
            start = cx;
          } else if (!exposed && start >= 0) {
            const end = cx;
            const bx0 = start * GRID, bx1 = Math.min(tw, end * GRID);
            const colorCell = gy * gw + ((start + end - 1) >> 1);
            const br = cellCol[colorCell * 3];
            const bg = cellCol[colorCell * 3 + 1];
            const bb = cellCol[colorCell * 3 + 2];
            if (top) {
              quad(idxSide, bx0, yUp(py), hz, bx1, yUp(py), hz, bx1, yUp(py), -hz, bx0, yUp(py), -hz,
                0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, br, bg, bb);
            } else {
              quad(idxSide, bx0, yUp(py), -hz, bx1, yUp(py), -hz, bx1, yUp(py), hz, bx0, yUp(py), hz,
                0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, br * edge, bg * edge, bb * edge);
            }
            start = -1;
          }
        }
      };
      // front (+z)
      quad(idxTex, x0, yUp(y1), hz, x1, yUp(y1), hz, x1, yUp(y0), hz, x0, yUp(y0), hz,
        0, 0, 1, U(x0), V(y1), U(x1), V(y1), U(x1), V(y0), U(x0), V(y0));
      // back (−z) — mirrored so the art reads correctly from behind
      quad(idxTex, x1, yUp(y1), -hz, x0, yUp(y1), -hz, x0, yUp(y0), -hz, x1, yUp(y0), -hz,
        0, 0, -1, U(x1), V(y1), U(x0), V(y1), U(x0), V(y0), U(x1), V(y0));
      horizontalBoundary(gy - 1, y0, true);
      horizontalBoundary(gy + 1, y1, false);
      // left side
      if (gx === 0 || !occ[gy * gw + gx - 1]) {
        const lc = gy * gw + gx;
        quad(idxSide, x0, yUp(y1), -hz, x0, yUp(y1), hz, x0, yUp(y0), hz, x0, yUp(y0), -hz,
          -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          cellCol[lc * 3] * edge, cellCol[lc * 3 + 1] * edge, cellCol[lc * 3 + 2] * edge);
      }
      // right side
      if (run === gw || !occ[gy * gw + run]) {
        const rc = gy * gw + (run - 1);
        quad(idxSide, x1, yUp(y1), hz, x1, yUp(y1), -hz, x1, yUp(y0), -hz, x1, yUp(y0), hz,
          1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          cellCol[rc * 3] * edge, cellCol[rc * 3 + 1] * edge, cellCol[rc * 3 + 2] * edge);
      }
      gx = run;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex([...idxTex, ...idxSide]);
  geo.addGroup(0, idxTex.length, 0);                // textured artwork faces
  geo.addGroup(idxTex.length, idxSide.length, 1);   // vertex-colored carved sides
  // Center on x, feet at y=0, centered depth.
  geo.translate(-tw / 2, 0, 0);

  const relief: ReliefMesh = {
    geometry: geo,
    texture: makeTexture(canvas),
    pxWidth: tw, pxHeight: th,
    trimX: tx0, trimY: ty0, origWidth: W, origHeight: H,
  };
  cache.set(key, relief);
  return relief;
}

/**
 * Fallback when pixels can't be read (rare CORS-tainted sources): a flat
 * textured card with the same interface as a relief — always renderable.
 */
export function buildFlatCard(
  key: string,
  source: HTMLImageElement | HTMLCanvasElement,
): ReliefMesh | null {
  const hit = cache.get(key);
  if (hit) return hit;
  const W = (source as HTMLImageElement).naturalWidth || source.width;
  const H = (source as HTMLImageElement).naturalHeight || source.height;
  if (W < 1 || H < 1) return null;
  const geo = new THREE.PlaneGeometry(W, H);
  geo.translate(0, H / 2, 0);          // feet at y=0, centered x
  const relief: ReliefMesh = {
    geometry: geo,
    texture: makeTexture(source as HTMLCanvasElement),
    pxWidth: W, pxHeight: H,
    trimX: 0, trimY: 0, origWidth: W, origHeight: H,
  };
  cache.set(key, relief);
  return relief;
}

/** Build a companion-specific 3D sprite shell. Unlike the general relief
 * builder, the artwork is one continuous front/back surface and only the
 * alpha silhouette boundary is extruded. This removes the visible horizontal
 * shelves that can make narrow or multi-lobed Pokémon look like an accordion
 * when they turn sideways in the overworld. */
export function buildSpriteShell3D(
  key: string,
  source: HTMLImageElement | HTMLCanvasElement,
): ReliefMesh | null {
  const cacheKey = `sprite-shell:${key}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const canvas = toCanvas(source);
  const W = canvas.width, H = canvas.height;
  if (W < 1 || H < 1) return null;
  let data: Uint8ClampedArray;
  try {
    data = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
  } catch { return null; }

  let tx0 = W, ty0 = H, tx1 = -1, ty1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] <= 24) continue;
      if (x < tx0) tx0 = x; if (x > tx1) tx1 = x;
      if (y < ty0) ty0 = y; if (y > ty1) ty1 = y;
    }
  }
  if (tx1 < 0) return null;
  const tw = tx1 - tx0 + 1, th = ty1 - ty0 + 1;

  // A ~96-cell long edge is smooth at overworld scale while keeping the
  // boundary under a few thousand quads even for high-resolution artwork.
  const CELL = Math.max(1, Math.ceil(Math.max(tw, th) / 96));
  const gw = Math.ceil(tw / CELL), gh = Math.ceil(th / CELL);
  const occupied = new Uint8Array(gw * gh);
  const colors = new Float32Array(gw * gh * 3);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const px0 = tx0 + gx * CELL, py0 = ty0 + gy * CELL;
      const px1 = Math.min(tx0 + tw, px0 + CELL), py1 = Math.min(ty0 + th, py0 + CELL);
      let opaque = 0, r = 0, g = 0, b = 0;
      const total = Math.max(1, (px1 - px0) * (py1 - py0));
      for (let y = py0; y < py1; y++) {
        for (let x = px0; x < px1; x++) {
          const i = (y * W + x) * 4;
          if (data[i + 3] <= 32) continue;
          opaque++; r += data[i]; g += data[i + 1]; b += data[i + 2];
        }
      }
      const index = gy * gw + gx;
      occupied[index] = opaque / total >= 0.06 ? 1 : 0;
      if (opaque) {
        colors[index * 3] = r / opaque / 255;
        colors[index * 3 + 1] = g / opaque / 255;
        colors[index * 3 + 2] = b / opaque / 255;
      }
    }
  }

  const positions: number[] = [], uvs: number[] = [], normals: number[] = [], vertexColors: number[] = [];
  const artIndices: number[] = [], sideIndices: number[] = [];
  const depth = Math.max(2, Math.min(tw, th) * 0.045);
  const halfDepth = depth / 2;
  const U = (x: number) => (tx0 + x) / W;
  const V = (y: number) => 1 - (ty0 + y) / H;
  const yUp = (y: number) => th - y;
  const quad = (
    indices: number[],
    a: [number, number, number], b: [number, number, number],
    c: [number, number, number], d: [number, number, number],
    normal: [number, number, number],
    uv: [number, number, number, number, number, number, number, number],
    color: [number, number, number] = [1, 1, 1],
  ) => {
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    for (let i = 0; i < 4; i++) {
      normals.push(...normal);
      vertexColors.push(...color);
    }
    uvs.push(...uv);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };

  // One uninterrupted textured sheet on each face. Alpha testing preserves the
  // exact antennae, wings and tails without constructing a stack per image row.
  quad(artIndices,
    [0, 0, halfDepth], [tw, 0, halfDepth], [tw, th, halfDepth], [0, th, halfDepth],
    [0, 0, 1], [U(0), V(th), U(tw), V(th), U(tw), V(0), U(0), V(0)]);
  quad(artIndices,
    [tw, 0, -halfDepth], [0, 0, -halfDepth], [0, th, -halfDepth], [tw, th, -halfDepth],
    [0, 0, -1], [U(tw), V(th), U(0), V(th), U(0), V(0), U(tw), V(0)]);

  const isOccupied = (x: number, y: number) => x >= 0 && y >= 0 && x < gw && y < gh && !!occupied[y * gw + x];
  const side = (x1: number, y1: number, x2: number, y2: number, index: number) => {
    const color: [number, number, number] = [
      colors[index * 3] * 0.82, colors[index * 3 + 1] * 0.82, colors[index * 3 + 2] * 0.82,
    ];
    quad(sideIndices,
      [x1, yUp(y1), halfDepth], [x2, yUp(y2), halfDepth],
      [x2, yUp(y2), -halfDepth], [x1, yUp(y1), -halfDepth],
      [0, 1, 0], [0, 0, 0, 0, 0, 0, 0, 0], color);
  };

  // Emit only exposed cell edges. Adjacent cells share no internal faces, so
  // the result is a single thin shell rather than an accordion of row slabs.
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const index = gy * gw + gx;
      if (!occupied[index]) continue;
      const x0 = gx * CELL, x1 = Math.min(tw, (gx + 1) * CELL);
      const y0 = gy * CELL, y1 = Math.min(th, (gy + 1) * CELL);
      if (!isOccupied(gx, gy - 1)) side(x0, y0, x1, y0, index);
      if (!isOccupied(gx + 1, gy)) side(x1, y0, x1, y1, index);
      if (!isOccupied(gx, gy + 1)) side(x1, y1, x0, y1, index);
      if (!isOccupied(gx - 1, gy)) side(x0, y1, x0, y0, index);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  geometry.setIndex([...artIndices, ...sideIndices]);
  geometry.addGroup(0, artIndices.length, 0);
  geometry.addGroup(artIndices.length, sideIndices.length, 1);
  geometry.translate(-tw / 2, 0, 0);

  const shell: ReliefMesh = {
    geometry,
    texture: makeTexture(canvas),
    pxWidth: tw, pxHeight: th,
    trimX: tx0, trimY: ty0, origWidth: W, origHeight: H,
  };
  cache.set(cacheKey, shell);
  return shell;
}

/** Material pair for relief meshes: [0] textured artwork faces (alpha cutout),
 *  [1] vertex-colored carved side faces. Apply opacity/tint to both.
 *  UNLIT on purpose: scene lighting washed the original art with a grey/blue
 *  cast — the sprite must read exactly as the 2D game authored it. Phaser's
 *  hit-flash tint is a color multiply, which MeshBasic reproduces 1:1. */
export function reliefMaterials(tex: THREE.Texture): [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial] {
  const art = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.22,        // keep soft anti-aliased edges (HOME renders)
    side: THREE.FrontSide,
  });
  const sides = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
  });
  return [art, sides];
}
