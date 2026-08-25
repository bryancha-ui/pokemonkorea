// High-quality procedural follower models.
//
// Target look: the hand-authored secommamma model — clean smooth-shaded
// geometry in a small palette of FLAT colours, no textures at all. Previous
// attempt textured an inflated card, which read as a blurry pillow.
//
// Pipeline: silhouette -> smoothed inflated volume -> Laplacian mesh relaxation
// -> k-means palette -> one primitive per colour with a flat baseColorFactor.
import fs from 'fs'; import path from 'path';
import { PNG } from 'pngjs'; import jpeg from 'jpeg-js';
import { Document, NodeIO } from '@gltf-transform/core';

const REPO = '/sessions/wizardly-vigilant-pasteur/mnt/PokemonKorea/phaser-game';
const OUT  = path.join(REPO, 'public/assets/models3d');
const GRID = 104;      // silhouette cells on the long axis
const THICK = 0.26;    // balloon depth as a fraction of the short axis
const SMOOTH_H = 5;    // height-field blur passes
const RELAX = 6;       // mesh relaxation passes
const K = 9;          // palette size
const ART_ALIAS = { groundzomber: 'groundzoome' };

// How to build the far side of a model, per species.
//
//   'mirror' — the artwork is a SIDE profile, so the far side is the creature's
//              other flank: mirror it and keep every detail, including the eye.
//              Front and back then read as the same creature from either side.
//   'infer'  — the artwork FACES the viewer, so the far side is a genuine back:
//              sample it wide so eyes, mouth and chest markings dissolve into the
//              body colour and the creature does not wear a face behind its head.
//
// This cannot be decided reliably from the image. Shape symmetry, colour symmetry
// and eye-blob asymmetry were all measured across the roster and none separated a
// profile fish from a front-facing lizard, so it is authored per species in the
// manifest via `backView`, defaulting to 'mirror'.
const BACK_VIEW = (() => {
  const map = new Map();
  try {
    const man = JSON.parse(fs.readFileSync(
      path.join(REPO, 'public/assets/models3d/manifest.json'), 'utf8')).models;
    for (const e of man) if (e && typeof e === 'object' && e.backView) map.set(e.key, e.backView);
  } catch { /* default for everything */ }
  return map;
})();

function readImage(file) {
  const buf = fs.readFileSync(file);
  if (file.endsWith('.png')) { const p = PNG.sync.read(buf); return { w: p.width, h: p.height, data: p.data, alpha: true }; }
  const j = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 512 });
  return { w: j.width, h: j.height, data: j.data, alpha: false };
}
const px = (img, x, y) => {
  x = Math.max(0, Math.min(img.w - 1, x | 0)); y = Math.max(0, Math.min(img.h - 1, y | 0));
  const i = (y * img.w + x) * 4, d = img.data;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
};
function artFor(key) {
  const k = ART_ALIAS[key] ?? key;
  for (const c of [`assets/dex/${k}.png`, `assets/${k}.png`, `assets/dex/${k}.jpg`, `assets/${k}.jpg`]) {
    const f = path.join(REPO, 'public', c); if (fs.existsSync(f)) return f;
  }
  return null;
}

function build(key, artFile) {
  const backMode = BACK_VIEW.get(key) ?? 'mirror';
  let holesFilled = 0;
  const img = readImage(artFile);
  // Deterministic RNG. k-means++ seeding with Math.random made the palette — and
  // therefore the model's whole colour scheme — change on every regeneration.
  let seed = 0; for (const c of key) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  // ── background key ────────────────────────────────────────────────────────
  let bg = null;
  {
    let border = 0, opaque = 0;
    const st = Math.max(1, img.w >> 5);
    for (let x = 0; x < img.w; x += st) for (const y of [0, img.h - 1]) { border++; if (!img.alpha || px(img, x, y)[3] > 240) opaque++; }
    if (opaque > border * 0.5) {
      bg = new Uint8Array(img.w * img.h); const q = [];
      const push = (x, y) => { const i = y * img.w + x; if (!bg[i]) { bg[i] = 1; q.push(i); } };
      for (let x = 0; x < img.w; x++) { push(x, 0); push(x, img.h - 1); }
      for (let y = 0; y < img.h; y++) { push(0, y); push(img.w - 1, y); }
      while (q.length) {
        const i = q.pop(), x = i % img.w, y = (i / img.w) | 0;
        const [r, g, b] = px(img, x, y);
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= img.w || Y >= img.h) continue;
          const j = Y * img.w + X; if (bg[j]) continue;
          const [r2, g2, b2, a2] = px(img, X, Y);
          if (img.alpha && a2 < 128) { bg[j] = 1; q.push(j); continue; }
          if (Math.abs(r-r2) + Math.abs(g-g2) + Math.abs(b-b2) < 30) { bg[j] = 1; q.push(j); }
        }
      }
    }
  }
  const covered = (x, y) => {
    const xi = Math.min(img.w-1, Math.max(0, x|0)), yi = Math.min(img.h-1, Math.max(0, y|0));
    if (bg && bg[yi * img.w + xi]) return 0;
    return img.alpha ? px(img, xi, yi)[3] / 255 : 1;
  };

  // ── trim ──────────────────────────────────────────────────────────────────
  let x0 = img.w, x1 = 0, y0 = img.h, y1 = 0;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++)
    if (covered(x, y) > 0.5) { if (x<x0)x0=x; if (x>x1)x1=x; if (y<y0)y0=y; if (y>y1)y1=y; }
  if (x1 <= x0 || y1 <= y0) throw new Error('empty silhouette');
  const W = x1 - x0, H = y1 - y0;
  const long = Math.max(W, H);
  const gw = Math.max(16, Math.round(GRID * W / long)), gh = Math.max(16, Math.round(GRID * H / long));
  const nx = gw + 1, ny = gh + 1;
  const ipx = (gx) => x0 + gx * W / gw, ipy = (gy) => y0 + gy * H / gh;

  // ── mask (4x4 supersampled), cleanup, largest component ───────────────────
  const mask = new Float32Array(nx * ny);
  for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
    let c = 0; const bx = ipx(gx), by = ipy(gy);
    const sx = W / gw / 4, sy = H / gh / 4;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) c += covered(bx + a*sx, by + b*sy);
    mask[gy*nx+gx] = c / 16;
  }
  for (let pass = 0; pass < 2; pass++) {
    const src = Float32Array.from(mask);
    for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
      let on = 0, tot = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = gx+dx, Y = gy+dy; if (X<0||Y<0||X>=nx||Y>=ny) continue;
        tot++; if (src[Y*nx+X] > 0.5) on++;
      }
      const i = gy*nx+gx;
      if (src[i] <= 0.5 && on >= tot - 2) mask[i] = 1;
      else if (src[i] > 0.5 && on <= 1) mask[i] = 0;
    }
  }
  { const comp = new Int32Array(nx*ny).fill(-1), sizes = [];
    for (let s = 0; s < nx*ny; s++) {
      if (mask[s] <= 0.5 || comp[s] >= 0) continue;
      const id = sizes.length; let n = 0; const q = [s]; comp[s] = id;
      while (q.length) { const i = q.pop(); n++; const x = i%nx, y = (i/nx)|0;
        for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const X=x+dx, Y=y+dy;
          if (X<0||Y<0||X>=nx||Y>=ny) continue; const j=Y*nx+X;
          if (mask[j] > 0.5 && comp[j] < 0) { comp[j] = id; q.push(j); } } }
      sizes.push(n);
    }
    const main = sizes.indexOf(Math.max(...sizes, 0));
    for (let i = 0; i < nx*ny; i++) if (mask[i] > 0.5 && comp[i] !== main) mask[i] = 0;
  }

  // Blur-then-threshold the mask: a hard pixel boundary leaves a stair-stepped
  // rim that survives all later smoothing, because the rim is held fixed.
  for (let pass = 0; pass < 2; pass++) {
    const src = Float32Array.from(mask);
    for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
      let s2 = 0, n2 = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = gx+dx, Y = gy+dy; if (X<0||Y<0||X>=nx||Y>=ny) continue;
        s2 += src[Y*nx+X] > 0.5 ? 1 : 0; n2++;
      }
      mask[gy*nx+gx] = (s2/n2) >= 0.5 ? 1 : 0;
    }
  }

  // ── height field: chamfer distance, then blur (kills stair-stepping) ──────
  const dist = new Float32Array(nx*ny);
  for (let i = 0; i < nx*ny; i++) dist[i] = mask[i] > 0.5 ? 1e9 : 0;
  const relax2 = (i, j, w) => { if (dist[j] + w < dist[i]) dist[i] = dist[j] + w; };
  for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) { const i = gy*nx+gx;
    if (gx>0) relax2(i,i-1,1); if (gy>0) relax2(i,i-nx,1);
    if (gx>0&&gy>0) relax2(i,i-nx-1,1.414); if (gx<nx-1&&gy>0) relax2(i,i-nx+1,1.414); }
  for (let gy = ny-1; gy >= 0; gy--) for (let gx = nx-1; gx >= 0; gx--) { const i = gy*nx+gx;
    if (gx<nx-1) relax2(i,i+1,1); if (gy<ny-1) relax2(i,i+nx,1);
    if (gx<nx-1&&gy<ny-1) relax2(i,i+nx+1,1.414); if (gx>0&&gy<ny-1) relax2(i,i+nx-1,1.414); }
  // Fill enclosed background pockets. A gap the artist drew INSIDE the outline —
  // between an ear and the head, the loop of a curled tail, the space under a
  // raised arm — is not a hole through the creature's body, but leaving it in the
  // mask punched a real hole in the mesh and showed daylight through the head.
  // Anything not reachable from the border is interior, so fill it.
  {
    const outside = new Uint8Array(nx*ny);
    const q = [];
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= nx || y >= ny) return;
      const i = y*nx+x;
      if (outside[i] || mask[i] > 0.5) return;
      outside[i] = 1; q.push(i);
    };
    for (let x = 0; x < nx; x++) { push(x, 0); push(x, ny-1); }
    for (let y = 0; y < ny; y++) { push(0, y); push(nx-1, y); }
    while (q.length) {
      const i = q.pop(); const x = i % nx, y = (i / nx) | 0;
      push(x+1, y); push(x-1, y); push(x, y+1); push(x, y-1);
    }
    let filled = 0;
    for (let i = 0; i < nx*ny; i++) if (mask[i] <= 0.5 && !outside[i]) { mask[i] = 1; filled++; }
    if (filled) holesFilled = filled;
  }

  // The rim is the ring of grid nodes OUTSIDE the silhouette. Deriving it from a
  // height threshold failed the moment the profile became circular: that profile
  // is already at ~46% thickness one cell in, so nothing fell under the
  // threshold, nothing welded, and the model split open down the middle.
  const isRim = new Uint8Array(nx*ny);
  for (let i = 0; i < nx*ny; i++) isRim[i] = mask[i] <= 0.5 ? 1 : 0;

  const dmax = Math.max(2, 0.30 * Math.min(gw, gh));
  const T = THICK * Math.min(W, H);
  let hgt = new Float32Array(nx*ny);
  for (let i = 0; i < nx*ny; i++) {
    // Circular arc, not a sine dome. Its tangent is vertical where the height
    // reaches zero, so the surface rolls over the outline instead of tapering to
    // a knife edge — which is what made every model read as a flat almond from
    // the side.
    const x = Math.min(1, dist[i]/dmax);
    hgt[i] = T * Math.sqrt(Math.max(0, 1 - (1 - x) * (1 - x)));
  }

  // ── shape from shading ────────────────────────────────────────────────────
  // A distance transform only knows the OUTLINE, so every model came out as the
  // same uniform pillow. The artwork already encodes its own form: the artist
  // lit it, so bright areas face the viewer and shaded areas recede. Sampling
  // that lets a snout, a belly or a curled tail read as separate volumes.
  //
  // The raw luminance is dominated by base colour (a yellow belly is brighter
  // than a green back regardless of form), so it is high-pass filtered against a
  // heavily blurred copy — what survives is the SHADING gradient, not the hue.
  {
    const lum = new Float32Array(nx*ny), inside = new Uint8Array(nx*ny);
    for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
      const i = gy*nx+gx; if (mask[i] <= 0.5) continue;
      const [r,g,b] = px(img, ipx(gx), ipy(gy));
      lum[i] = (0.299*r + 0.587*g + 0.114*b) / 255; inside[i] = 1;
    }
    // blur only across covered cells so the background never bleeds inward
    const blur = (src, passes) => {
      let cur = Float32Array.from(src);
      for (let p = 0; p < passes; p++) {
        const prev = Float32Array.from(cur);
        for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
          const i = gy*nx+gx; if (!inside[i]) continue;
          let s2 = 0, n2 = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const X = gx+dx, Y = gy+dy; if (X<0||Y<0||X>=nx||Y>=ny) continue;
            const j = Y*nx+X; if (!inside[j]) continue;
            s2 += prev[j]; n2++;
          }
          cur[i] = n2 ? s2/n2 : prev[i];
        }
      }
      return cur;
    };
    const base = blur(lum, Math.max(3, Math.round(Math.min(gw, gh) / 7)));
    let lo = 1e9, hi = -1e9;
    const detail = new Float32Array(nx*ny);
    for (let i = 0; i < nx*ny; i++) {
      if (!inside[i]) continue;
      detail[i] = lum[i] - base[i];
      if (detail[i] < lo) lo = detail[i];
      if (detail[i] > hi) hi = detail[i];
    }
    const span = Math.max(1e-4, Math.max(Math.abs(lo), Math.abs(hi)));
    // Internal contour creases: where the palette/colour changes sharply the
    // artist drew a form boundary (a limb against a body). Pinching the surface
    // there separates the parts instead of welding them into one blob.
    const edge = new Float32Array(nx*ny);
    for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
      const i = gy*nx+gx; if (!inside[i]) continue;
      const [r,g,b] = px(img, ipx(gx), ipy(gy));
      let worst = 0;
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const X = gx+dx, Y = gy+dy; if (X<0||Y<0||X>=nx||Y>=ny) continue;
        if (!inside[Y*nx+X]) continue;
        const [r2,g2,b2] = px(img, ipx(X), ipy(Y));
        worst = Math.max(worst, (Math.abs(r-r2)+Math.abs(g-g2)+Math.abs(b-b2)) / 765);
      }
      edge[i] = Math.min(1, worst * 2.6);
    }
    const edgeSoft = blur(edge, 1);
    for (let i = 0; i < nx*ny; i++) {
      if (!inside[i]) continue;
      const lit = detail[i] / span;                    // -1 shaded .. +1 lit
      hgt[i] *= (1 + 0.42 * lit) * (1 - 0.26 * edgeSoft[i]);
      if (hgt[i] < 0) hgt[i] = 0;
    }
  }
  for (let pass = 0; pass < SMOOTH_H; pass++) {
    const src = Float32Array.from(hgt);
    for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = gx+dx, Y = gy+dy; if (X<0||Y<0||X>=nx||Y>=ny) continue;
        s += src[Y*nx+X]; n++;
      }
      hgt[gy*nx+gx] = s / n;
    }
  }
  // Blurring lifts the boundary off zero; pin it back so the two sides still
  // share a vertex and the surface stays closed.
  for (let i = 0; i < nx*ny; i++) if (isRim[i]) hgt[i] = 0;

  // ── shared vertex ring (front/back pair per grid node) ───────────────────
  const need = new Uint8Array(nx*ny);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const c = [gy*nx+gx, gy*nx+gx+1, (gy+1)*nx+gx, (gy+1)*nx+gx+1];
    if (c.some(i => mask[i] > 0.25)) for (const i of c) need[i] = 1;
  }
  // Front and back are ONE closed surface, not two sheets laid back to back.
  // They used to be separate vertex sets: at the outline their normals met head
  // on, which drew a thick weld seam straight down the body, and because the
  // material was single-sided any sliver where they failed to meet showed as a
  // hole. Where the height falls to zero (the silhouette edge) both sides now
  // share ONE vertex, so normals average across it and the surface closes and
  // rounds over instead of creasing.
  const vidF = new Int32Array(nx*ny).fill(-1);
  const vidB = new Int32Array(nx*ny).fill(-1);
  const P = [], onRim = [];
  for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
    const i = gy*nx+gx; if (!need[i]) continue;
    const X = ipx(gx) - (x0 + W/2), Y = (y1 - ipy(gy)), Z = hgt[i];
    const rim = isRim[i] === 1;
    vidF[i] = P.length / 3;
    P.push(X, Y, rim ? 0 : Z); onRim.push(rim);
    if (rim) {
      vidB[i] = vidF[i];                       // welded: one vertex, both sides
    } else {
      vidB[i] = P.length / 3;
      P.push(X, Y, -Z); onRim.push(false);
    }
  }
  const tri = [], triSide = [];
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i0 = gy*nx+gx, i1 = gy*nx+gx+1, i2 = (gy+1)*nx+gx, i3 = (gy+1)*nx+gx+1;
    const a = vidF[i0], b = vidF[i1], c = vidF[i2], d = vidF[i3];
    if (a<0||b<0||c<0||d<0) continue;
    const ab = vidB[i0], bb = vidB[i1], cb = vidB[i2], db = vidB[i3];
    // A cell whose four corners are ALL on the rim has no thickness: front and
    // back collapse onto the same quad. Emitting just the front left a flat flap
    // whose outer edge belonged to one triangle only — an open boundary, i.e. a
    // hole. Such cells are outside the body, so drop them entirely; the closing
    // fold is then formed by cells that have at least one interior corner, whose
    // front and back sheets meet at the shared rim vertices.
    if (ab === a && bb === b && cb === c && db === d) continue;
    tri.push([a,c,b], [b,c,d]); triSide.push(0, 0);
    tri.push([ab,bb,cb], [bb,db,cb]); triSide.push(1, 1);
  }
  // ── Laplacian relaxation (rim held, so the silhouette stays sharp) ────────
  const nbr = new Map();
  for (const t of tri) for (let k = 0; k < 3; k++) {
    const u = t[k], v = t[(k+1)%3];
    (nbr.get(u) ?? nbr.set(u, new Set()).get(u)).add(v);
    (nbr.get(v) ?? nbr.set(v, new Set()).get(v)).add(u);
  }
  for (let pass = 0; pass < RELAX; pass++) {
    const src = Float32Array.from(P);
    for (const [v, set] of nbr) {
      if (onRim[v]) continue;
      let sx=0, sy=0, sz=0;
      for (const u of set) { sx += src[u*3]; sy += src[u*3+1]; sz += src[u*3+2]; }
      const n = set.size, w = 0.5;
      P[v*3]   = src[v*3]   * (1-w) + (sx/n) * w;
      P[v*3+1] = src[v*3+1] * (1-w) + (sy/n) * w;
      P[v*3+2] = src[v*3+2] * (1-w) + (sz/n) * w;
    }
  }

  // ── palette: k-means over silhouette colours ─────────────────────────────
  const samples = [];
  for (let y = y0; y <= y1; y += Math.max(1, (H/90)|0)) for (let x = x0; x <= x1; x += Math.max(1, (W/90)|0)) {
    if (covered(x, y) < 0.6) continue;
    const [r,g,b] = px(img, x, y); samples.push([r,g,b]);
  }
  if (!samples.length) throw new Error('no colour samples');
  let cent = [samples[0]];
  while (cent.length < Math.min(K, samples.length)) {                 // k-means++
    let best = null, bestD = -1;
    for (let t = 0; t < 64; t++) {
      const s = samples[(rnd()*samples.length)|0];
      let d = Infinity;
      for (const c of cent) d = Math.min(d, (s[0]-c[0])**2 + (s[1]-c[1])**2 + (s[2]-c[2])**2);
      if (d > bestD) { bestD = d; best = s; }
    }
    cent.push(best);
  }
  for (let it = 0; it < 12; it++) {
    const acc = cent.map(() => [0,0,0,0]);
    for (const s of samples) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < cent.length; i++) {
        const d = (s[0]-cent[i][0])**2 + (s[1]-cent[i][1])**2 + (s[2]-cent[i][2])**2;
        if (d < bd) { bd = d; bi = i; }
      }
      acc[bi][0]+=s[0]; acc[bi][1]+=s[1]; acc[bi][2]+=s[2]; acc[bi][3]++;
    }
    cent = cent.map((c, i) => acc[i][3] ? [acc[i][0]/acc[i][3], acc[i][1]/acc[i][3], acc[i][2]/acc[i][3]] : c);
  }
  const nearest = (r,g,b) => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < cent.length; i++) {
      const d = (r-cent[i][0])**2 + (g-cent[i][1])**2 + (b-cent[i][2])**2;
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  };
  // triangle -> palette index, by its centroid's art colour
  const uvOf = (v) => {
    const X = P[v*3], Y = P[v*3+1];
    return [ (X + W/2) / W, 1 - (Y / H) ];
  };
  // Sample an AREA, not a pixel. Single-pixel sampling landed on dark ink
  // outlines and stray highlights, scattering the surface with speckles.
  const rad = Math.max(1, Math.round(Math.min(W, H) / 90));
  const areaColour = (cx, cy, r0 = rad) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -r0; dy <= r0; dy++) for (let dx = -r0; dx <= r0; dx++) {
      const X = cx + dx, Y = cy + dy;
      if (covered(X, Y) < 0.6) continue;
      const [pr,pg,pb] = px(img, X, Y); r+=pr; g+=pg; b+=pb; n++;
    }
    if (!n) { const [pr,pg,pb] = px(img, cx, cy); return [pr,pg,pb]; }
    return [r/n, g/n, b/n];
  };
  // The back is INFERRED, not a copy of the front. Two changes make it read as
  // the far side of the same creature: the artwork is mirrored horizontally, so
  // an asymmetric marking wraps around the body instead of appearing twice
  // facing the same way; and it is sampled over a much wider area, which averages
  // small high-contrast features — eyes, mouth, chest badges — into the
  // surrounding body colour, so the creature no longer has a face on its back.
  let triPal = tri.map((t, ti) => {
    let u = 0, vv = 0, depth = 0;
    for (const v of t) { const [a,b] = uvOf(v); u += a/3; vv += b/3; depth += Math.abs(P[v*3+2])/3; }
    if (triSide[ti] !== 1) return nearest(...areaColour(x0 + u*W, y0 + vv*H, rad));
    // Ease the back INTO being a back. Right at the outline it samples exactly
    // what the front samples, so the two palettes meet with no visible seam;
    // further from the rim it mirrors and widens until it is a proper back view.
    const k = Math.min(1, depth / Math.max(1e-6, T));
    const blend = k * k * (3 - 2 * k);                 // smoothstep
    const su = u * (1 - blend) + (1 - u) * blend;
    // Only an inferred back widens its sampling; a mirrored flank keeps the
    // artwork's full detail so both sides of the creature match.
    const r = backMode === 'infer' ? rad * (1 + 3 * blend) : rad;
    return nearest(...areaColour(x0 + su*W, y0 + vv*H, r));
  });
  // Majority-vote over shared-edge neighbours: removes any speckle that survived.
  {
    const edge = new Map();
    tri.forEach((t, ti) => { for (let k = 0; k < 3; k++) {
      const a = t[k], b = t[(k+1)%3], key2 = a < b ? `${a}_${b}` : `${b}_${a}`;
      (edge.get(key2) ?? edge.set(key2, []).get(key2)).push(ti);
    }});
    const adj = tri.map(() => []);
    for (const list of edge.values()) if (list.length === 2) { adj[list[0]].push(list[1]); adj[list[1]].push(list[0]); }
    for (let pass = 0; pass < 3; pass++) {
      const src = triPal.slice();
      for (let ti = 0; ti < tri.length; ti++) {
        const tally = new Map([[src[ti], 1]]);
        for (const j of adj[ti]) tally.set(src[j], (tally.get(src[j]) ?? 0) + 1);
        let best = src[ti], bc = -1;
        for (const [p, c] of tally) if (c > bc) { bc = c; best = p; }
        triPal[ti] = best;
      }
    }
  }
  const groups = new Map();
  tri.forEach((t, ti) => { const gi = triPal[ti];
    (groups.get(gi) ?? groups.set(gi, []).get(gi)).push(t); });

  // ── emit one primitive per palette colour, smooth normals ────────────────
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(key);
  const node = doc.createNode(key);
  scene.addChild(node);
  const mesh = doc.createMesh(key);
  node.setMesh(mesh);
  let prims = 0;
  // shared smooth normals across the whole surface
  const N = new Float32Array(P.length);
  for (const t of tri) {
    const [a,b,c] = t;
    const ax=P[a*3],ay=P[a*3+1],az=P[a*3+2];
    const ux=P[b*3]-ax, uy=P[b*3+1]-ay, uz=P[b*3+2]-az;
    const vx=P[c*3]-ax, vy=P[c*3+1]-ay, vz=P[c*3+2]-az;
    const nxv=uy*vz-uz*vy, nyv=uz*vx-ux*vz, nzv=ux*vy-uy*vx;
    for (const v of t) { N[v*3]+=nxv; N[v*3+1]+=nyv; N[v*3+2]+=nzv; }
  }
  for (let v = 0; v < P.length/3; v++) {
    const l = Math.hypot(N[v*3],N[v*3+1],N[v*3+2]) || 1;
    N[v*3]/=l; N[v*3+1]/=l; N[v*3+2]/=l;
  }
  for (const [gi, ts] of groups) {
    if (!ts.length) continue;
    const remap = new Map(); const pos = [], nor = [], idx = [];
    for (const t of ts) for (const v of t) {
      let r = remap.get(v);
      if (r === undefined) { r = pos.length/3; remap.set(v, r);
        pos.push(P[v*3], P[v*3+1], P[v*3+2]); nor.push(N[v*3], N[v*3+1], N[v*3+2]); }
      idx.push(r);
    }
    const c = cent[gi];
    const lin = (u) => { const s = u/255; return s <= 0.04045 ? s/12.92 : ((s+0.055)/1.055)**2.4; };
    const mat = doc.createMaterial(`palette_${gi}`)
      .setBaseColorFactor([lin(c[0]), lin(c[1]), lin(c[2]), 1])
      .setMetallicFactor(0).setRoughnessFactor(0.8).setDoubleSided(true);
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
      .setAttribute('NORMAL',   doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR')
        .setArray(pos.length/3 < 65536 ? new Uint16Array(idx) : new Uint32Array(idx)).setBuffer(buffer))
      .setMaterial(mat);
    mesh.addPrimitive(prim); prims++;
  }
  return { doc, prims, verts: P.length/3, tris: tri.length, holesFilled };
}

const keys = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const io = new NodeIO();
let ok = 0, totalHoles = 0; const fail = [];
for (const key of keys) {
  const art = artFor(key);
  if (!art) { fail.push([key, 'no artwork']); continue; }
  try {
    const { doc, prims, verts, tris, holesFilled } = build(key, art);
    await io.write(path.join(OUT, `${key}.glb`), doc);
    const kb = (fs.statSync(path.join(OUT, `${key}.glb`)).size/1024)|0;
    ok++;
    totalHoles += holesFilled;
    if (ok <= 3 || ok % 30 === 0) console.log(`  ${key}: ${prims} colour prims, ${verts}v/${tris}t, ${kb}KB${holesFilled ? `, ${holesFilled} pockets filled` : ''}`);
  } catch (e) { fail.push([key, String(e).slice(0,60)]); }
}
console.log(`done: ${ok} generated, ${fail.length} failed, ${totalHoles} interior pockets filled`, fail.slice(0,5));
