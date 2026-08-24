// Generate rough, artwork-faithful follower GLBs.
//
// For each species: read its 2D art, lift the silhouette into a rounded
// "inflated card" (balloon heightfield from a distance transform), texture it
// with the artwork itself, and write an uncompressed GLB. These are follower-
// only stand-ins — battles keep the original 2D sprite.
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { Document, NodeIO } from '@gltf-transform/core';

const REPO = '/sessions/wizardly-vigilant-pasteur/mnt/PokemonKorea/phaser-game';
const OUT  = path.join(REPO, 'public/assets/models3d');
const GRID = 56;            // cells across the longer axis
const THICK = 0.20;         // balloon thickness, fraction of the shorter axis
const TEX = 256;            // max texture edge

function readImage(file) {
  const buf = fs.readFileSync(file);
  if (file.endsWith('.png')) { const p = PNG.sync.read(buf); return { w: p.width, h: p.height, data: p.data, alpha: true }; }
  const j = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 512 });
  return { w: j.width, h: j.height, data: j.data, alpha: false };
}
const px = (img, x, y) => {
  x = Math.max(0, Math.min(img.w - 1, x | 0)); y = Math.max(0, Math.min(img.h - 1, y | 0));
  const i = (y * img.w + x) * 4; const d = img.data;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
};
// Coverage: PNG alpha, or white-key for JPGs.
function cover(img, x, y) {
  const [r, g, b, a] = px(img, x, y);
  if (img.alpha) return a / 255;
  const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
  return (mn > 236 && mx - mn < 22) ? 0 : 1;
}

const ART_ALIAS = { groundzomber: 'groundzoome' };   // intentionally shared sprite
function artFor(key) {
  const k = ART_ALIAS[key] ?? key;
  for (const c of [`assets/dex/${k}.png`, `assets/${k}.png`, `assets/dex/${k}.jpg`, `assets/${k}.jpg`]) {
    const f = path.join(REPO, 'public', c);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

function build(key, artFile) {
  const img = readImage(artFile);
  // Art with a painted BACKGROUND (opaque border) needs keying before the
  // silhouette lift: region-grow from the border, absorbing pixels that stay
  // colour-close to their neighbour. Gradient scenery clears; the creature's
  // contrasted edge stops the fill. Rough, but these are rough models.
  let bg = null;
  {
    let border = 0, opaque = 0;
    const st = Math.max(1, img.w >> 5);
    for (let x = 0; x < img.w; x += st) { for (const y of [0, img.h - 1]) { border++; if (px(img, x, y)[3] > 240 && (img.alpha ? true : true)) opaque += img.alpha ? (px(img,x,y)[3] > 240 ? 1 : 0) : 1; } }
    if (!img.alpha || opaque > border * 0.5) {
      bg = new Uint8Array(img.w * img.h);
      const q = [];
      const push = (x, y) => { const i = y * img.w + x; if (!bg[i]) { bg[i] = 1; q.push(i); } };
      for (let x = 0; x < img.w; x++) { push(x, 0); push(x, img.h - 1); }
      for (let y = 0; y < img.h; y++) { push(0, y); push(img.w - 1, y); }
      while (q.length) {
        const i = q.pop(); const x = i % img.w, y = (i / img.w) | 0;
        const [r, g, b] = px(img, x, y);
        for (const [dx2, dy2] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const X = x + dx2, Y = y + dy2;
          if (X < 0 || Y < 0 || X >= img.w || Y >= img.h) continue;
          const j = Y * img.w + X; if (bg[j]) continue;
          const [r2, g2, b2, a2] = px(img, X, Y);
          if (img.alpha && a2 < 128) { bg[j] = 1; q.push(j); continue; }
          if (Math.abs(r - r2) + Math.abs(g - g2) + Math.abs(b - b2) < 30) { bg[j] = 1; q.push(j); }
        }
      }
    }
  }
  const covered = (x, y) => {
    if (bg && bg[(Math.min(img.h-1,Math.max(0,y|0))) * img.w + Math.min(img.w-1,Math.max(0,x|0))]) return 0;
    return cover(img, x, y);
  };
  // Trim to the silhouette
  let x0 = img.w, x1 = 0, y0 = img.h, y1 = 0;
  for (let y = 0; y < img.h; y += 2) for (let x = 0; x < img.w; x += 2)
    if (covered(x, y) > 0.5) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 <= x0 || y1 <= y0) throw new Error('empty silhouette');
  const mW = Math.max(8, (x1 - x0) * 0.04) | 0, mH = Math.max(8, (y1 - y0) * 0.04) | 0;
  x0 = Math.max(0, x0 - mW); x1 = Math.min(img.w - 1, x1 + mW);
  y0 = Math.max(0, y0 - mH); y1 = Math.min(img.h - 1, y1 + mH);
  const W = x1 - x0, H = y1 - y0;

  // Grid + mask + chamfer distance (inside only)
  const long = Math.max(W, H);
  const gw = Math.max(12, Math.round(GRID * W / long)), gh = Math.max(12, Math.round(GRID * H / long));
  const nx = gw + 1, ny = gh + 1;
  const at = (gx, gy) => [x0 + gx * W / gw, y0 + gy * H / gh];
  const mask = new Float32Array(nx * ny), dist = new Float32Array(nx * ny);
  for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
    const [ix, iy] = at(gx, gy);
    // supersample coverage 2x2 for stable rims
    let c = 0; for (const [dx2, dy2] of [[0,0],[1,0],[0,1],[1,1]]) c += covered(ix + dx2, iy + dy2);
    const m = c / 4; const i = gy * nx + gx;
    mask[i] = m;
  }
  // Clean the grid mask before lifting it:
  //  - close single-cell nibbles (a low-contrast background key bites into the
  //    body; a majority vote heals one-cell holes and notches)
  //  - keep only the largest connected component (drops shadow specks under the
  //    feet and background fragments the key missed)
  for (let pass = 0; pass < 2; pass++) {
    const src = Float32Array.from(mask);
    for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
      let onn = 0, tot = 0;
      for (let dy2 = -1; dy2 <= 1; dy2++) for (let dx2 = -1; dx2 <= 1; dx2++) {
        const X = gx + dx2, Y = gy + dy2;
        if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue;
        tot++; if (src[Y * nx + X] > 0.5) onn++;
      }
      const i = gy * nx + gx;
      if (src[i] <= 0.5 && onn >= tot - 2) mask[i] = 1;        // fill nibble
      else if (src[i] > 0.5 && onn <= 2) mask[i] = 0;          // drop speck
    }
  }
  {
    const comp = new Int32Array(nx * ny).fill(-1);
    const sizes = [];
    for (let seed = 0; seed < nx * ny; seed++) {
      if (mask[seed] <= 0.5 || comp[seed] >= 0) continue;
      const id = sizes.length; let count = 0; const q2 = [seed]; comp[seed] = id;
      while (q2.length) {
        const i = q2.pop(); count++;
        const x = i % nx, y = (i / nx) | 0;
        for (const [dx2, dy2] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const X = x + dx2, Y = y + dy2;
          if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue;
          const j = Y * nx + X;
          if (mask[j] > 0.5 && comp[j] < 0) { comp[j] = id; q2.push(j); }
        }
      }
      sizes.push(count);
    }
    const main = sizes.indexOf(Math.max(...sizes, 0));
    for (let i = 0; i < nx * ny; i++) if (mask[i] > 0.5 && comp[i] !== main) mask[i] = 0;
  }
  for (let i = 0; i < nx * ny; i++) dist[i] = mask[i] > 0.5 ? 1e9 : 0;
  const relax = (i, j, w) => { if (dist[j] + w < dist[i]) dist[i] = dist[j] + w; };
  for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) { const i = gy*nx+gx;
    if (gx>0) relax(i, i-1, 1); if (gy>0) relax(i, i-nx, 1);
    if (gx>0&&gy>0) relax(i, i-nx-1, 1.414); if (gx<nx-1&&gy>0) relax(i, i-nx+1, 1.414); }
  for (let gy = ny-1; gy >= 0; gy--) for (let gx = nx-1; gx >= 0; gx--) { const i = gy*nx+gx;
    if (gx<nx-1) relax(i, i+1, 1); if (gy<ny-1) relax(i, i+nx, 1);
    if (gx<nx-1&&gy<ny-1) relax(i, i+nx+1, 1.414); if (gx>0&&gy<ny-1) relax(i, i+nx-1, 1.414); }
  const dmax = Math.max(2, 0.35 * Math.min(gw, gh));
  const T = THICK * Math.min(W, H);
  const hgt = new Float32Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) hgt[i] = T * Math.sqrt(Math.min(1, dist[i] / dmax));

  // Vertices (front + back sheets), CCW front facing +Z; y up (image y flipped)
  const pos = [], nrm = [], uv = [], idx = [];
  const vid = new Int32Array(nx * ny).fill(-1);
  const grad = (gx, gy) => {
    const g = (a, b) => (hgt[Math.min(ny-1,Math.max(0,gy))*nx + Math.min(nx-1,Math.max(0,a))] ?? 0) - (hgt[Math.min(ny-1,Math.max(0,gy))*nx + Math.min(nx-1,Math.max(0,b))] ?? 0);
    const gxv = (hgt[gy*nx + Math.min(nx-1,gx+1)] - hgt[gy*nx + Math.max(0,gx-1)]) / (2 * W / gw);
    const gyv = (hgt[Math.min(ny-1,gy+1)*nx + gx] - hgt[Math.max(0,gy-1)*nx + gx]) / (2 * H / gh);
    return [gxv, gyv];
  };
  const need = new Uint8Array(nx * ny);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const c = [gy*nx+gx, gy*nx+gx+1, (gy+1)*nx+gx, (gy+1)*nx+gx+1];
    if (c.some(i => mask[i] > 0.25)) for (const i of c) need[i] = 1;
  }
  for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
    const i = gy * nx + gx; if (!need[i]) continue;
    const [ix, iy] = at(gx, gy);
    const X = ix - (x0 + W / 2), Y = (y1 - iy), Z = hgt[i];
    const [gxv, gyv] = grad(gx, gy);
    const u = (ix - x0) / W, v = (iy - y0) / H;
    vid[i] = pos.length / 3;
    pos.push(X, Y, Z);  { const l = Math.hypot(gxv, gyv, 1); nrm.push(-gxv/l,  gyv/l, 1/l); } uv.push(u, v);   // front
    pos.push(X, Y, -Z); { const l = Math.hypot(gxv, gyv, 1); nrm.push( gxv/l, -gyv/l, -1/l); } uv.push(u, v);  // back
  }
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const a = vid[gy*nx+gx], b = vid[gy*nx+gx+1], c = vid[(gy+1)*nx+gx], d = vid[(gy+1)*nx+gx+1];
    if (a < 0 || b < 0 || c < 0 || d < 0) continue;
    // vid[] already IS the front vertex index (nodes push front,back pairs, so
    // back = front+1). An earlier draft doubled it and produced triangle soup.
    idx.push(a, c, b, b, c, d);                             // front: image y grows down; flipped Y => CCW toward +Z
    idx.push(a+1, b+1, c+1, b+1, d+1, c+1);                 // back sheet reversed
  }

  // Texture: trimmed art with colour bleed into transparent areas, JPEG ≤256
  const scale = Math.min(1, TEX / Math.max(W, H));
  const tw = Math.max(16, Math.round(W * scale)), th = Math.max(16, Math.round(H * scale));
  const rgba = Buffer.alloc(tw * th * 4);
  const solid = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const sx = x0 + x / scale, sy = y0 + y / scale;
    const c = covered(sx, sy); const [r, g, b] = px(img, sx, sy);
    const o = (y * tw + x) * 4;
    if (c > 0.35) { rgba[o]=r; rgba[o+1]=g; rgba[o+2]=b; rgba[o+3]=255; solid[y*tw+x]=1; }
  }
  for (let pass = 0; pass < 6; pass++) {                    // dilate colours outward
    const next = Buffer.from(rgba); const ns = new Uint8Array(solid);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      if (solid[y*tw+x]) continue;
      let rs=0, gs=0, bs=0, n=0;
      for (const [dx2, dy2] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const X = x+dx2, Y = y+dy2;
        if (X<0||Y<0||X>=tw||Y>=th||!solid[Y*tw+X]) continue;
        const q=(Y*tw+X)*4; rs+=rgba[q]; gs+=rgba[q+1]; bs+=rgba[q+2]; n++;
      }
      if (n) { const o=(y*tw+x)*4; next[o]=rs/n; next[o+1]=gs/n; next[o+2]=bs/n; next[o+3]=255; ns[y*tw+x]=1; }
    }
    next.copy(rgba); ns.forEach((v,i)=>solid[i]=v);
  }
  for (let i = 0; i < tw*th; i++) if (!solid[i]) {          // far background: neutral grey
    const o=i*4; rgba[o]=rgba[o+1]=rgba[o+2]=168; rgba[o+3]=255;
  }
  const jpg = jpeg.encode({ data: rgba, width: tw, height: th }, 82).data;

  // GLB via gltf-transform
  const doc = new Document();
  const buffer = doc.createBuffer();
  const p = doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer);
  const n = doc.createAccessor().setType('VEC3').setArray(new Float32Array(nrm)).setBuffer(buffer);
  const t = doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv)).setBuffer(buffer);
  const ii = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buffer);
  const tex = doc.createTexture(key).setImage(jpg).setMimeType('image/jpeg');
  const mat = doc.createMaterial('artcard').setBaseColorTexture(tex)
    .setMetallicFactor(0).setRoughnessFactor(0.9).setDoubleSided(true);
  const prim = doc.createPrimitive().setAttribute('POSITION', p).setAttribute('NORMAL', n)
    .setAttribute('TEXCOORD_0', t).setIndices(ii).setMaterial(mat);
  const mesh = doc.createMesh(key).addPrimitive(prim);
  const node = doc.createNode(key).setMesh(mesh);
  doc.createScene(key).addChild(node);
  return { doc, tris: idx.length / 3, verts: pos.length / 3 };
}

const keys = JSON.parse(process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : '[]');
const io = new NodeIO();
let ok = 0, fail = [];
for (const key of keys) {
  const art = artFor(key);
  if (!art) { fail.push([key, 'no artwork']); continue; }
  try {
    const { doc, tris, verts } = build(key, art);
    await io.write(path.join(OUT, `${key}.glb`), doc);
    const kb = (fs.statSync(path.join(OUT, `${key}.glb`)).size / 1024) | 0;
    ok++;
    if (ok <= 4 || ok % 25 === 0) console.log(`  ${key}: ${verts}v/${tris}t ${kb}KB (${path.basename(art)})`);
  } catch (e) { fail.push([key, String(e).slice(0, 60)]); }
}
console.log(`done: ${ok} generated, ${fail.length} failed`, fail.slice(0, 6));
