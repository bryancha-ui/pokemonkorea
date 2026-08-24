import * as THREE from 'three';

// ── Procedural prop library ──────────────────────────────────────────────────
// Low-poly trees, rocks, grass tufts, flowers, water and wall blocks in a soft
// toon style. Everything is built from primitives at runtime — no asset files.

let gradientMap: THREE.DataTexture | null = null;

/** Five-step pastel ramp. The extra mid-tones keep curved silhouettes readable
 * without the hard cubic bands that made the procedural world feel voxelled. */
export function toonRamp(): THREE.DataTexture {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([
    82, 82, 88, 255,
    132, 132, 138, 255,
    180, 180, 184, 255,
    221, 221, 224, 255,
    255, 255, 255, 255,
  ]);
  gradientMap = new THREE.DataTexture(data, 5, 1, THREE.RGBAFormat);
  gradientMap.magFilter = THREE.LinearFilter;
  gradientMap.minFilter = THREE.LinearFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

export function toonMat(color: number, opts: { transparent?: boolean; opacity?: number } = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color, gradientMap: toonRamp(),
    transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
  });
}

// Creature geometry must come from an approved local GLB. This prop module
// intentionally contains no code-built Pokémon substitutes.

// ── Blob shadow (shared geometry+material, cloned cheaply) ──────────────────
let blobGeo: THREE.CircleGeometry | null = null;
let blobMat: THREE.MeshBasicMaterial | null = null;

export function makeBlobShadow(radius: number): THREE.Mesh {
  if (!blobGeo) blobGeo = new THREE.CircleGeometry(1, 20);
  if (!blobMat) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    g.addColorStop(0, 'rgba(20,24,40,0.42)');
    g.addColorStop(1, 'rgba(20,24,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    blobMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  }
  const m = new THREE.Mesh(blobGeo, blobMat);
  // Geometry/material (and its texture) are intentionally shared by every
  // character. Scene cleanup must not dispose them out from under the next map.
  m.userData.sharedGeo = true;
  m.userData.sharedMat = true;
  m.rotation.x = -Math.PI / 2;
  m.scale.setScalar(radius);
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}

// ── Trees ───────────────────────────────────────────────────────────────────
export interface InstancedProp {
  meshes: THREE.InstancedMesh[];
  /** Original transforms, shared by every mesh part of an instance. */
  placements: ReadonlyArray<{ x: number; z: number; s: number; rot: number }>;
  /** Place one instance; call finalize() when done. */
  place(x: number, z: number, s: number, rot: number): void;
  /** Tilt one placed instance around its rooted position (used by grass rustle). */
  setSway(index: number, pitch: number, roll: number): void;
  /** Upload changed instance matrices after a batch of setSway calls. */
  commit(): void;
  finalize(): void;
  count: number;
}

interface InstancedPart {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  y: number;
  /** Local offsets/scale let organic props use clustered silhouettes while
   * retaining the single instanced draw call per component. */
  x?: number;
  z?: number;
  scale?: number;
}

function makeInstanced(parts: InstancedPart[], max: number): InstancedProp {
  const meshes = parts.map(p => {
    const im = new THREE.InstancedMesh(p.geo, p.mat, max);
    im.count = 0;
    im.frustumCulled = false;
    return im;
  });
  const dummy = new THREE.Object3D();
  const placements: { x: number; z: number; s: number; rot: number }[] = [];
  let n = 0;
  const writeTransform = (index: number, pitch = 0, roll = 0) => {
    const p = placements[index];
    if (!p) return;
    for (let i = 0; i < meshes.length; i++) {
      const part = parts[i];
      const lx = (part.x ?? 0) * p.s, lz = (part.z ?? 0) * p.s;
      const sin = Math.sin(p.rot), cos = Math.cos(p.rot);
      dummy.position.set(
        p.x + lx * cos + lz * sin,
        part.y * p.s,
        p.z - lx * sin + lz * cos,
      );
      dummy.scale.setScalar(p.s * (part.scale ?? 1));
      dummy.rotation.set(pitch, p.rot, roll);
      dummy.updateMatrix();
      meshes[i].setMatrixAt(index, dummy.matrix);
    }
  };
  return {
    meshes,
    placements,
    count: 0,
    place(x, z, s, rot) {
      if (n >= max) return;
      placements.push({ x, z, s, rot });
      writeTransform(n);
      n++;
      this.count = n;
    },
    setSway(index, pitch, roll) { writeTransform(index, pitch, roll); },
    commit() { for (const m of meshes) m.instanceMatrix.needsUpdate = true; },
    finalize() {
      for (const m of meshes) { m.count = n; m.instanceMatrix.needsUpdate = true; }
    },
  };
}

/** Round leafy tree (temperate zones). */
export function makeTrees(max: number, canopy = 0x3f9e3a, trunk = 0x6d4c33): InstancedProp {
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.15, 0.7, 10);
  const rootGeo = new THREE.CylinderGeometry(0.17, 0.22, 0.12, 10);
  const crown = new THREE.DodecahedronGeometry(0.46, 1); crown.scale(1, 0.82, 1);
  const puff = new THREE.DodecahedronGeometry(0.34, 1); puff.scale(1, 0.86, 1);
  const highlight = mixColor(canopy, 0xffffdc, 0.22);
  const shade = mixColor(canopy, 0x183d22, 0.24);
  return makeInstanced([
    { geo: rootGeo, mat: toonMat(mixColor(trunk, 0x3c2418, 0.22)), y: 0.06 },
    { geo: trunkGeo, mat: toonMat(trunk), y: 0.36 },
    { geo: crown, mat: toonMat(shade), y: 0.93, scale: 1.12 },
    { geo: puff, mat: toonMat(canopy), y: 1.12, x: -0.3, z: 0.02 },
    { geo: puff, mat: toonMat(canopy), y: 1.1, x: 0.3, z: 0.05, scale: 0.94 },
    { geo: puff, mat: toonMat(mixColor(canopy, 0xffffff, 0.08)), y: 1.12, z: -0.28, scale: 0.9 },
    { geo: puff, mat: toonMat(highlight), y: 1.38, x: 0.03, z: -0.02, scale: 0.86 },
  ], max);
}

/** Conifer (snow / highland zones) — snow-laden: each green tier carries a thin
 *  white snow cap and a bright snow crown, so the pines read as snow-covered
 *  evergreens (Samho / Baekdu highlands). */
export function makePines(max: number, needles = 0x2e6b46, trunk = 0x5a4030): InstancedProp {
  const trunkGeo = new THREE.CylinderGeometry(0.07, 0.13, 0.62, 10);
  const c1 = new THREE.ConeGeometry(0.58, 0.82, 12);
  const c2 = new THREE.ConeGeometry(0.44, 0.76, 12);
  const c3 = new THREE.ConeGeometry(0.3, 0.64, 12);
  // Flatter white caps sitting on each tier's shoulders like settled snow.
  const s1 = new THREE.ConeGeometry(0.6, 0.24, 12);
  const s2 = new THREE.ConeGeometry(0.46, 0.22, 12);
  const s3 = new THREE.ConeGeometry(0.32, 0.2, 12);
  const snowMat = () => toonMat(0xf4f8ff);
  return makeInstanced([
    { geo: trunkGeo, mat: toonMat(trunk), y: 0.25 },
    { geo: c1, mat: toonMat(needles), y: 0.75 },
    { geo: s1, mat: snowMat(), y: 0.99 },
    { geo: c2, mat: toonMat(mixColor(needles, 0xffffff, 0.10)), y: 1.25 },
    { geo: s2, mat: snowMat(), y: 1.46 },
    { geo: c3, mat: toonMat(mixColor(needles, 0xffffff, 0.22)), y: 1.7 },
    { geo: s3, mat: snowMat(), y: 1.88 },
  ], max);
}

/** A wide low-poly toon mountain range used as a scenic 3D backdrop behind a
 *  town's edge (replaces flat painted 2D mountains). Faceted rock peaks with snow
 *  caps and forested foothills toward the town side. 1 unit = 1 tile; built to fill
 *  a `width`×`depth` footprint. Deterministic (seeded by peak index). */
export function makeMountainRange(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const rock = toonMat(0x8a7a6a), rockDark = toonMat(0x6b5f54);
  const snow = toonMat(0xeef3f8), forest = toonMat(0x3f7a45);
  // Run the peaks along the LONGER axis so the range fills tall/narrow plots (an
  // east-edge range) as well as wide/shallow ones (a north-edge range).
  const horizontal = width >= depth;
  const along = horizontal ? width : depth;
  const across = horizontal ? depth : width;
  const peaks = Math.max(1, Math.round(along / 5));
  const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const place = (mesh: THREE.Mesh, a: number, y: number, o: number) => {
    mesh.position.set(horizontal ? a : o, y, horizontal ? o : a);
  };
  for (let i = 0; i < peaks; i++) {
    const t = peaks === 1 ? 0.5 : i / (peaks - 1);
    const a = (t - 0.5) * along * 0.9;
    const r1 = hash(i + 1), r2 = hash(i + 7), r3 = hash(i + 13);
    const h = 2.6 + r1 * 2.8;            // 2.6–5.4 tiles tall
    const rad = 1.3 + r2 * 1.1;
    const o = (r3 - 0.5) * across * 0.5;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 7), i % 2 ? rock : rockDark);
    place(cone, a, h / 2, o); cone.rotation.y = r1 * Math.PI;
    g.add(cone);
    const capH = h * 0.34;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.44, capH, 7), snow);
    place(cap, a, h - capH / 2, o); cap.rotation.y = cone.rotation.y;
    g.add(cap);
    const fh = 0.9 + r2 * 0.8;           // a forested foothill tucked beside each peak
    const hill = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.85, fh, 7), forest);
    place(hill, a + (r2 - 0.5) * rad, fh / 2, o + (r3 - 0.5) * rad * 1.4);
    g.add(hill);
  }
  return g;
}

/**
 * A true-3D cloud sea for Sacred Peak. It occupies only the sky tiles along
 * both sides of the ridge, stays below eye level, and has no camera blocker so
 * the summit cast and the player's route remain unobstructed.
 */
export function makeSacredPeakCloudSea(width: number, depth: number): {
  group: THREE.Group;
  update(t: number): void;
} {
  const group = new THREE.Group();
  group.name = 'sacred-peak-cloud-sea';
  const cloudMaterial = new THREE.MeshToonMaterial({
    color: 0xf5f8ff,
    gradientMap: toonRamp(),
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
  });
  const mistMaterial = new THREE.MeshBasicMaterial({
    color: 0xdcecff,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // A thin mist floor ties the individual cloud masses into a continuous sea.
  for (const x of [2.35, width - 2.35]) {
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(4.7, depth), mistMaterial);
    mist.rotation.x = -Math.PI / 2;
    mist.position.set(x, -0.16, depth / 2);
    mist.renderOrder = -2;
    group.add(mist);
  }

  const puffGeometry = new THREE.SphereGeometry(1, 14, 9);
  const banks: THREE.Group[] = [];
  const zRows = [2.2, 5.8, 9.6, 14.3, 20.2, 27.1, 34.1, 38.2];
  for (let row = 0; row < zRows.length; row++) {
    for (const side of [-1, 1]) {
      const bank = new THREE.Group();
      const baseX = side < 0 ? 2.15 + (row % 2) * 0.45 : width - 2.15 - (row % 2) * 0.45;
      const baseY = -0.12 + (row % 3) * 0.06;
      bank.position.set(baseX, baseY, zRows[row]);
      bank.userData.baseX = baseX;
      bank.userData.baseY = baseY;
      bank.userData.phase = row * 0.83 + (side > 0 ? 1.7 : 0);

      for (let i = 0; i < 6; i++) {
        const puff = new THREE.Mesh(puffGeometry, cloudMaterial);
        const spread = (i - 2.5) * 0.62;
        const scale = 0.72 + ((row * 7 + i * 5) % 6) * 0.09;
        puff.position.set(spread, (i % 3) * 0.13, ((i * 11 + row * 3) % 5 - 2) * 0.28);
        puff.scale.set(scale * 1.45, scale * 0.48, scale * 0.92);
        puff.castShadow = false;
        puff.receiveShadow = false;
        puff.renderOrder = -1;
        bank.add(puff);
      }
      banks.push(bank);
      group.add(bank);
    }
  }

  return {
    group,
    update(t: number) {
      for (const bank of banks) {
        const phase = bank.userData.phase as number;
        bank.position.x = (bank.userData.baseX as number) + Math.sin(t * 0.09 + phase) * 0.12;
        bank.position.y = (bank.userData.baseY as number) + Math.sin(t * 0.18 + phase) * 0.055;
      }
    },
  };
}

/** Rocks / boulders. */
export function makeRocks(max: number, color = 0x8d8578): InstancedProp {
  const g = new THREE.IcosahedronGeometry(0.34, 1);
  g.scale(1.3, 0.72, 1.02);
  const cap = new THREE.DodecahedronGeometry(0.18, 0);
  cap.scale(1.25, 0.45, 0.9);
  return makeInstanced([
    { geo: g, mat: toonMat(color), y: 0.22 },
    { geo: cap, mat: toonMat(mixColor(color, 0xffffff, 0.18)), y: 0.39, x: -0.07, z: -0.02 },
  ], max);
}

/** Tall-grass tufts, Pokémon-style: a dense rounded bush of bright blades on
 *  three crossed alpha planes, with a darker base and lighter sun-lit tips. */
export function makeGrassTufts(max: number, tone = 0x49b23a, snowy = false): InstancedProp {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 56;
  const ctx = c.getContext('2d')!;
  const base = new THREE.Color(tone);
  const dark = base.clone().multiplyScalar(0.62);
  const tip  = base.clone().lerp(new THREE.Color(0xffffff), snowy ? 0.72 : 0.35);
  const rgb = (col: THREE.Color) => `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`;
  // Base mound so the clump reads as a solid tuft, not floating blades.
  ctx.fillStyle = rgb(dark);
  ctx.beginPath(); ctx.ellipse(32, 52, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
  // Dense blades fanning up into a rounded bush; back rows darker, front brighter.
  const blade = (x: number, topY: number, sway: number, w: number, shade: THREE.Color) => {
    ctx.strokeStyle = rgb(shade); ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, 54);
    ctx.quadraticCurveTo(x + sway * 0.5, (54 + topY) / 2, x + sway, topY); ctx.stroke();
  };
  const snowTips: [number, number, number][] = [];
  for (let i = 0; i < 22; i++) {
    const t = i / 21;                          // 0..1 across the clump
    const x = 8 + t * 48 + (i % 2) * 2;
    const front = i % 3 === 0;                 // front blades brighter + taller
    const topY = 6 + Math.abs(t - 0.5) * 26 + (front ? -4 : 4);   // rounded top
    const sway = (i % 2 ? 1 : -1) * (5 + (i % 4) * 3);
    blade(x, topY, sway, front ? 4.2 : 3.4, front ? tip.clone().lerp(base, 0.4) : (i % 2 ? base : dark.clone().lerp(base, 0.5)));
    if (snowy && (front || i % 4 === 1)) snowTips.push([x + sway, topY + 1, front ? 3.4 : 2.6]);
  }
  if (snowy) {
    // Snow catches on blade tips and settles in a thin bank around the roots.
    ctx.fillStyle = 'rgba(247,252,255,0.94)';
    for (const [x, y, r] of snowTips) {
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(238,247,252,0.88)';
    ctx.beginPath(); ctx.ellipse(32, 51, 24, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.28, side: THREE.DoubleSide });
  const p1 = new THREE.PlaneGeometry(1.15, 1.0);
  const p2 = p1.clone(); p2.rotateY(Math.PI / 3);
  const p3 = p1.clone(); p3.rotateY(-Math.PI / 3);
  return makeInstanced([
    { geo: p1, mat, y: 0.48 },
    { geo: p2, mat, y: 0.48 },
    { geo: p3, mat, y: 0.48 },
  ], max);
}

/** Flower patches: small colored dots on crossed planes. */
export function makeFlowers(max: number, petal = 0xe8b64a): InstancedProp {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const col = new THREE.Color(petal);
  ctx.strokeStyle = '#3f7d2f'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const x = 5 + i * 7;
    ctx.beginPath(); ctx.moveTo(x, 32); ctx.lineTo(x + 2, 18); ctx.stroke();
    ctx.fillStyle = `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`;
    ctx.beginPath(); ctx.arc(x + 2, 15, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff7dd';
    ctx.beginPath(); ctx.arc(x + 2, 15, 1.7, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  const p1 = new THREE.PlaneGeometry(0.6, 0.5);
  const p2 = p1.clone(); p2.rotateY(Math.PI / 2);
  return makeInstanced([{ geo: p1, mat, y: 0.24 }, { geo: p2, mat, y: 0.24 }], max);
}

export function mixColor(a: number, b: number, t: number): number {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return ca.lerp(cb, t).getHex();
}

// ── Placed decorative props (single 3D objects pinned to a tile) ─────────────

/** The single four-storey 노스단 headquarters from the original 2D facade.
 *  It deliberately remains one uninterrupted building volume: dark inset
 *  walls, four bands of red windows, a central crimson gate and the two long
 *  faction banners are lifted directly from the painted version. */
/**
 * The Onnuri Pokémon League hall — a 3D reproduction of LeaguePlazaScene's painted
 * hanok palace (drawPalace): a stone woldae platform with a central stair, a dark
 * hall wall fronted by vermilion pillars, dancheong bands, gold-studded double
 * doors, a gilt signboard, and a two-tier (중층) hip roof.
 *
 * It is deliberately built as ONE continuous vertical mass: the second tier is a
 * real clerestory WALL sitting on the lower roof (not a free-floating roof), so the
 * whole thing reads as a single grand hall rather than two stacked buildings.
 * Built to the plot's own width/depth; front (doors) faces +Z toward the courtyard.
 */
export function makeHanokPalace(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const RED_WALL = 0x6e1f1a, PILLAR = 0xb23a2c, STONE = 0xd0c7b3, STONE_DK = 0xbcb29c;
  const ROOF_LO = 0x33524a, ROOF_HI = 0x3a5e53, RIDGE = 0x223833, GOLD = 0xddb24a, DOOR = 0x241208;
  const bodyH = Math.max(3.6, Math.min(5.4, width * 0.24));
  const bodyD = depth * 0.72;
  const frontZ = bodyD / 2;

  // A frustum roof (truncated 4-sided pyramid) so the tier above has a flat top to
  // sit on — the flat top is what ties the two tiers into one building.
  const addRoof = (baseW: number, baseD: number, topRatio: number, h: number, yBottom: number, color: number, ridgeFrac = 0.5) => {
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(topRatio, 1, h, 4), toonMat(color));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(baseW / Math.SQRT2, 1, baseD / Math.SQRT2);
    roof.position.y = yBottom + h / 2;
    g.add(roof);
    const topY = yBottom + h;
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(baseW * ridgeFrac, 0.24, 0.34), toonMat(RIDGE));
    ridge.position.set(0, topY - 0.06, 0); g.add(ridge);
    for (const rx of [-baseW * ridgeFrac / 2, baseW * ridgeFrac / 2]) {
      const chimi = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.36), toonMat(0x1a2a26));
      chimi.position.set(rx, topY, 0); g.add(chimi);
    }
    return topY;
  };
  // A dark wall fronted by vermilion pillars + a dancheong band — the shared look of
  // both storeys, so the clerestory clearly belongs to the same building.
  const addStorey = (w: number, d: number, h: number, yBottom: number, nCol: number) => {
    const fz = d / 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMat(RED_WALL));
    wall.position.y = yBottom + h / 2; g.add(wall);
    for (let i = 0; i <= nCol; i++) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.42, h, 0.34), toonMat(PILLAR));
      pillar.position.set(-w / 2 + (w * i) / nCol, yBottom + h / 2, fz + 0.02); g.add(pillar);
    }
    const bandPalette = [0x2b6ea8, 0x2f9c5a, 0xc7402f, 0xe0b24a];
    const segW = (w + 0.4) / 4;
    for (let s = 0; s < 4; s++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.28, 0.12), toonMat(bandPalette[s]));
      band.position.set(-((w + 0.4) / 2) + segW * (s + 0.5), yBottom + h - 0.18, fz + 0.14); g.add(band);
    }
  };

  // Stone platform (woldae) with a lower apron, the hall sits on top.
  const woldaeH = 0.6;
  const apron = new THREE.Mesh(new THREE.BoxGeometry(width + 1.6, 0.34, depth + 1.6), toonMat(STONE_DK));
  apron.position.y = 0.17; g.add(apron);
  const woldae = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, woldaeH, depth + 0.6), toonMat(STONE));
  woldae.position.y = 0.34 + woldaeH / 2; g.add(woldae);
  const platTop = 0.34 + woldaeH;
  // Central staircase down the front.
  for (let s = 0; s < 3; s++) {
    const h = platTop * (1 - s / 3);
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.6, h, 0.5), toonMat(s % 2 ? STONE_DK : STONE));
    step.position.set(0, h / 2, depth / 2 + 0.3 + s * 0.5); g.add(step);
  }

  // First storey (the tall main hall).
  addStorey(width, bodyD, bodyH, platTop, 8);

  // Gold-studded double doors at the centre front of the first storey.
  const doorH = Math.min(2.2, bodyH * 0.62), doorW = 1.9;
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.2), toonMat(DOOR));
  door.position.set(0, platTop + doorH / 2, frontZ + 0.12); g.add(door);
  const studMat = toonMat(0xe0b24a);
  for (let yy = 0; yy < 4; yy++) for (const sx of [-0.45, 0.45]) {
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), studMat);
    stud.rotation.x = Math.PI / 2;
    stud.position.set(sx, platTop + 0.35 + yy * (doorH - 0.5) / 3, frontZ + 0.23); g.add(stud);
  }

  // Lower (skirt) roof — its flat top carries the clerestory.
  const eaveY = platTop + bodyH;
  const loBaseW = width + 2.4, loBaseD = depth + 1.6, loTopRatio = 0.52, loH = 1.4;
  const loTopY = addRoof(loBaseW, loBaseD, loTopRatio, loH, eaveY - 0.25, ROOF_LO, 0.5);

  // Second storey (clerestory) — sits ON the lower roof's flat top, tying the tiers
  // together so the hall reads as a single building.
  const clW = loBaseW * loTopRatio - 0.6, clD = loBaseD * loTopRatio - 0.4, clH = bodyH * 0.44;
  addStorey(clW, clD, clH, loTopY - 0.1, 5);

  // Upper (crowning) roof over the clerestory.
  addRoof(clW + 1.8, clD + 1.4, 0.22, 1.4, loTopY - 0.1 + clH - 0.1, ROOF_HI, 0.42);

  // Signboard (현판) hung on the first storey under the lower eave.
  const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 0.16), toonMat(GOLD));
  boardFrame.position.set(0, eaveY + 0.05, frontZ + 0.2); g.add(boardFrame);
  const boardFace = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.66, 0.1), toonMat(0x1b110a));
  boardFace.position.set(0, eaveY + 0.05, frontZ + 0.29); g.add(boardFace);

  return g;
}

/**
 * The Onnuri Pokémon League — a 3D reconstruction of the hall the courtyard paints
 * in 2D (LeaguePlazaScene.drawPalace): stone woldae with a balustrade and a central
 * stair, one continuous vermilion colonnade over a dark wall, gold-studded double
 * doors, a dancheong band under each eave, and two sweeping tiers with upturned
 * eave tips and chimi ridge ornaments.
 *
 * It replaces the shared `hanok-palace` here for one reason: EVERY piece is built
 * symmetrically about x = 0 and spans the full plot width, so the facade is one
 * flat mass. The generic palace sized several of its parts independently, which
 * left one end standing proud of the wall and read as a separate block bolted onto
 * the side of the building.
 *
 * Front (doors) faces +Z toward the courtyard; feet at y = 0.
 */
export function makeOnnuriLeague(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const WALL = 0x6e1f1a, PILLAR = 0xb23a2c, STONE = 0xd0c7b3, STONE_DK = 0xbcb29c, STONE_RAIL = 0xc6bca6;
  const ROOF_LO = 0x33524a, ROOF_HI = 0x3a5e53, RIDGE = 0x223833, CHIMI = 0x1a2a26;
  const GOLD = 0xddb24a, DOOR_DK = 0x241208, DOOR = 0x49301a;
  const DANCHEONG = [0x2f7a44, 0x2f4f9a, 0xb83636, 0xeae2cf];

  const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMat(color));
    m.position.set(x, y, z); g.add(m); return m;
  };

  const bodyD = Math.max(2.4, depth * 0.66);
  const frontZ = bodyD / 2;
  const bodyH = Math.max(3.8, Math.min(5.6, width * 0.23));

  // ── Woldae: apron, platform, balustrade, central stair ───────────────────
  const apronH = 0.32, platH = 0.58;
  box(width + 2.2, apronH, depth + 1.8, STONE_DK, 0, apronH / 2, 0);
  box(width + 1.0, platH, depth + 0.9, STONE, 0, apronH + platH / 2, 0);
  const platTop = apronH + platH;
  // Balustrade along the front edge, broken by the stair.
  const railZ = (depth + 0.9) / 2;
  const stairW = Math.min(4.2, width * 0.22);
  for (const side of [-1, 1]) {
    const runW = (width + 1.0) / 2 - stairW / 2;
    box(runW, 0.34, 0.26, STONE_RAIL, side * (stairW / 2 + runW / 2), platTop + 0.17, railZ);
  }
  for (let s = 0; s < 3; s++) {
    const h = platTop * (1 - s / 3);
    box(stairW, h, 0.46, s % 2 ? STONE_DK : STONE_RAIL, 0, h / 2, railZ + 0.23 + s * 0.46);
  }

  // ── One continuous hall: dark wall, full-width colonnade, dancheong band ──
  box(width, bodyH, bodyD, WALL, 0, platTop + bodyH / 2, 0);
  const nCol = 9;
  for (let i = 0; i <= nCol; i++) {
    box(0.46, bodyH, 0.36, PILLAR, -width / 2 + (width * i) / nCol, platTop + bodyH / 2, frontZ + 0.03);
  }
  const bandY = platTop + bodyH - 0.2;
  const bandW = width / 12;
  for (let i = 0; i < 12; i++) {
    box(bandW * 0.94, 0.3, 0.14, DANCHEONG[i % DANCHEONG.length],
      -width / 2 + bandW * (i + 0.5), bandY, frontZ + 0.16);
  }

  // ── Gold-studded double doors ────────────────────────────────────────────
  const doorH = Math.min(2.4, bodyH * 0.6), doorW = 2.4;
  box(doorW + 0.34, doorH + 0.24, 0.18, DOOR_DK, 0, platTop + (doorH + 0.24) / 2, frontZ + 0.1);
  for (const side of [-1, 1]) {
    box(doorW / 2 - 0.08, doorH, 0.12, DOOR, side * (doorW / 4 + 0.04), platTop + doorH / 2, frontZ + 0.2);
  }
  const studMat = toonMat(0xe0b24a);
  for (let yy = 0; yy < 4; yy++) for (const sx of [-0.55, 0.55]) {
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), studMat);
    stud.rotation.x = Math.PI / 2;
    stud.position.set(sx, platTop + 0.42 + yy * (doorH - 0.7) / 3, frontZ + 0.28);
    g.add(stud);
  }

  /** One sweeping tier: hip roof, ridge, chimi, upturned eave tips, dancheong. */
  const tier = (baseW: number, baseD: number, topRatio: number, h: number, yBottom: number, color: number) => {
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(topRatio, 1, h, 4), toonMat(color));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(baseW / Math.SQRT2, 1, baseD / Math.SQRT2);
    roof.position.y = yBottom + h / 2;
    g.add(roof);
    const topY = yBottom + h;
    // Ridge + the pair of chimi that cap it.
    box(baseW * topRatio * 0.92, 0.26, 0.36, RIDGE, 0, topY - 0.05, 0);
    for (const rx of [-1, 1]) {
      box(0.38, 0.46, 0.38, CHIMI, rx * baseW * topRatio * 0.46, topY + 0.16, 0);
    }
    // Upturned eave tips — the same wedge at BOTH ends, which is what keeps the
    // silhouette symmetrical.
    for (const sx of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, baseD * 0.9), toonMat(color));
      tip.position.set(sx * (baseW / 2 + 0.32), yBottom + 0.34, 0);
      tip.rotation.z = sx * -0.42;
      g.add(tip);
    }
    // Dancheong under the eave.
    const segW = baseW / 12;
    for (let i = 0; i < 12; i++) {
      box(segW * 0.92, 0.2, 0.12, DANCHEONG[i % DANCHEONG.length],
        -baseW / 2 + segW * (i + 0.5), yBottom + 0.12, baseD / 2 + 0.04);
    }
    return topY;
  };

  // Lower tier spans the whole facade; the clerestory sits on its flat top so the
  // hall reads as one building with a raised centre, never as two structures.
  const eaveY = platTop + bodyH;
  const loW = width + 2.0, loD = depth + 1.4, loRatio = 0.5, loH = 1.5;
  const loTop = tier(loW, loD, loRatio, loH, eaveY - 0.2, ROOF_LO);

  const clW = loW * loRatio - 0.8, clD = loD * loRatio - 0.5, clH = bodyH * 0.4;
  box(clW, clH, clD, WALL, 0, loTop + clH / 2 - 0.08, 0);
  const clFrontZ = clD / 2;
  for (let i = 0; i <= 5; i++) {
    box(0.4, clH, 0.3, PILLAR, -clW / 2 + (clW * i) / 5, loTop + clH / 2 - 0.08, clFrontZ + 0.03);
  }
  tier(clW + 1.6, clD + 1.1, 0.24, 1.4, loTop + clH - 0.24, ROOF_HI);

  // ── Signboard (현판) under the lower eave ────────────────────────────────
  const boardW = Math.min(4.6, width * 0.24);
  box(boardW, 1.02, 0.16, GOLD, 0, eaveY + 0.1, frontZ + 0.22);
  box(boardW - 0.34, 0.74, 0.1, 0x1b110a, 0, eaveY + 0.1, frontZ + 0.31);

  return g;
}

/**
 * A grand northern-capital palace — a wide granite hall raised on a stone woldae,
 * a full front colonnade under a gold cornice, flanking corner towers, and a
 * crowning central pavilion topped with a gold spire. Built entirely from toon
 * primitives (no GLB) so its full majesty renders on every device instead of the
 * flat grey box a disabled/absent landmark GLB falls back to. Front faces +Z;
 * feet at y=0; sized to fill a `width`×`depth` plot.
 */
export function makeGrandPalace(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const GRANITE = 0x6c6f77, GRANITE_DK = 0x53565e, STONE = 0x9297a2, STONE_DK = 0x777b84;
  const ROOF = 0x2e323b, ROOF_HI = 0x3b404a, GOLD = 0xd8b44a, DOOR = 0x181209, NAVY = 0x24314d;
  const bodyD = Math.max(2.6, depth * 0.82);
  const frontZ = bodyD / 2;
  const bodyH = Math.max(4.5, Math.min(6.6, width * 0.26));
  const mesh = (w: number, h: number, d: number, color: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMat(color));
    m.position.set(x, y, z); g.add(m); return m;
  };

  // ── Woldae (raised stone platform) + apron, with a balustrade and grand stair ──
  mesh(width + 1.8, 0.34, depth + 1.6, STONE_DK, 0, 0.17, 0);
  const platH = 0.8;
  mesh(width + 0.9, platH, depth + 0.9, STONE, 0, 0.34 + platH / 2, 0);
  const platTop = 0.34 + platH;
  for (let i = 0; i <= 12; i++) mesh(0.16, 0.5, 0.16, STONE_DK, -width / 2 + (width * i) / 12, platTop + 0.25, frontZ + 0.55);
  for (let s = 0; s < 4; s++) { const h = platTop * (1 - s / 4); mesh(width * 0.34, h, 0.5, s % 2 ? STONE_DK : STONE, 0, h / 2, frontZ + 0.55 + s * 0.5); }

  // ── Main granite hall with an inset facade ──
  mesh(width * 0.92, bodyH, bodyD, GRANITE, 0, platTop + bodyH / 2, 0);
  mesh(width * 0.7, bodyH * 0.84, 0.2, GRANITE_DK, 0, platTop + bodyH * 0.5, frontZ + 0.02);

  // ── Full front colonnade (fluted columns with bases + capitals) ──
  const nCol = 11;
  for (let i = 0; i < nCol; i++) {
    const cx = -width * 0.44 + width * 0.88 * (i / (nCol - 1));
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, bodyH * 0.9, 12), toonMat(STONE));
    col.position.set(cx, platTop + bodyH * 0.45 + 0.1, frontZ + 0.14); g.add(col);
    mesh(0.76, 0.24, 0.5, STONE_DK, cx, platTop + 0.12, frontZ + 0.14);
    mesh(0.76, 0.26, 0.5, STONE_DK, cx, platTop + bodyH * 0.9, frontZ + 0.14);
  }
  // Entablature beam + gold cornice crowning the columns.
  mesh(width * 0.94, 0.5, bodyD + 0.4, GRANITE_DK, 0, platTop + bodyH + 0.05, 0);
  mesh(width * 0.97, 0.16, bodyD + 0.55, GOLD, 0, platTop + bodyH + 0.33, 0);

  // ── Wide low hip roof over the hall ──
  const roofBase = platTop + bodyH + 0.42;
  g.add(hipRoof(width * 1.0, bodyD + 1.3, 1.4, roofBase, ROOF));

  // ── Flanking corner towers (grand wide silhouette) ──
  for (const sx of [-1, 1]) {
    const tx = sx * width * 0.42, tw = Math.max(1.4, width * 0.1), tH = bodyH * 1.28;
    mesh(tw, tH, bodyD * 0.72, GRANITE, tx, platTop + tH / 2, 0);
    mesh(tw + 0.3, 0.14, bodyD * 0.72 + 0.3, GOLD, tx, platTop + tH, 0);
    g.add(hipRoof(tw + 1.0, bodyD * 0.72 + 0.8, 1.0, platTop + tH, ROOF_HI));
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 6), toonMat(GOLD));
    fin.position.set(tx, platTop + tH + 1.15, 0); g.add(fin);
  }

  // ── Crowning central pavilion + grand gold spire ──
  const pavW = width * 0.34, pavD = bodyD * 0.82, pavH = bodyH * 0.62;
  const pavBase = roofBase + 0.9;
  mesh(pavW, pavH, pavD, GRANITE, 0, pavBase + pavH / 2, 0);
  mesh(pavW * 0.8, pavH * 0.5, 0.16, NAVY, 0, pavBase + pavH * 0.55, pavD / 2 + 0.02);
  g.add(hipRoof(pavW + 1.6, pavD + 1.2, 1.5, pavBase + pavH, ROOF_HI));
  const spireBase = pavBase + pavH + 1.5;
  mesh(0.5, 0.5, 0.5, GOLD, 0, spireBase + 0.1, 0);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.28, 1.6, 8), toonMat(GOLD));
  spire.position.set(0, spireBase + 1.0, 0); g.add(spire);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), toonMat(GOLD));
  orb.position.set(0, spireBase + 1.95, 0); g.add(orb);

  // ── Grand central doorway (gold frame + studded doors) + banners + signboard ──
  const doorH = Math.min(2.6, bodyH * 0.6), doorW = 2.0;
  mesh(doorW + 0.4, doorH + 0.4, 0.16, GOLD, 0, platTop + (doorH + 0.4) / 2, frontZ + 0.16);
  mesh(doorW, doorH, 0.2, DOOR, 0, platTop + doorH / 2, frontZ + 0.22);
  const studMat = toonMat(GOLD);
  for (let yy = 0; yy < 5; yy++) for (const sx of [-0.5, 0.5]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), studMat);
    s.rotation.x = Math.PI / 2; s.position.set(sx, platTop + 0.4 + yy * (doorH - 0.6) / 4, frontZ + 0.33); g.add(s);
  }
  for (const sx of [-1, 1]) {
    const bx = sx * doorW * 1.15;
    mesh(0.5, doorH * 1.1, 0.1, NAVY, bx, platTop + doorH * 0.6, frontZ + 0.2);
    mesh(0.5, 0.24, 0.12, GOLD, bx, platTop + doorH * 1.12, frontZ + 0.22);
  }
  mesh(3.2, 0.8, 0.16, GOLD, 0, platTop + doorH + 0.6, frontZ + 0.2);
  mesh(2.9, 0.56, 0.1, 0x1b120a, 0, platTop + doorH + 0.6, frontZ + 0.29);

  return g;
}

/**
 * A coastal palm tree — a gently leaning tan trunk with segment rings and a crown
 * of drooping green fronds (with a couple of coconuts). Toon-styled, feet at y=0.
 * Suits seaside cities like Parangpo. Vary `seed` so a row of palms isn't identical.
 */
export function makePalmTree(seed = 0): THREE.Group {
  const g = new THREE.Group();
  const rnd = (n: number) => ((Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  const trunkH = 2.6 + rnd(1) * 0.9;
  const lean = (rnd(2) - 0.5) * 0.5;
  const trunkMat = toonMat(0xb08a4a);
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - t * 0.05, 0.2 - t * 0.05, trunkH / segs + 0.04, 8), trunkMat);
    seg.position.set(lean * t * trunkH * 0.4, (i + 0.5) * (trunkH / segs), 0);
    seg.rotation.z = -lean * 0.5;
    g.add(seg);
  }
  const topX = lean * trunkH * 0.4, topY = trunkH;
  // Coconuts clustered under the crown.
  const nutMat = toonMat(0x5a3a1e);
  for (const a of [0.3, -0.5, 1.4]) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), nutMat);
    nut.position.set(topX + Math.cos(a) * 0.22, topY - 0.15, Math.sin(a) * 0.22);
    g.add(nut);
  }
  // Crown of fronds — flattened, drooping blades radiating out.
  const frondMat = toonMat(0x2f8a3f);
  const nFronds = 7;
  for (let i = 0; i < nFronds; i++) {
    const a = (i / nFronds) * Math.PI * 2 + rnd(3) * 0.6;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.5, 4), frondMat);
    frond.position.set(topX + Math.cos(a) * 0.75, topY + 0.15, Math.sin(a) * 0.75);
    frond.rotation.z = Math.PI / 2 - 0.5;   // lay it near-horizontal, drooping
    frond.rotation.y = -a;
    frond.scale.set(1, 1, 0.4);   // flatten into a blade
    g.add(frond);
  }
  return g;
}

/** A hip roof (truncated wide pyramid) sized to a footprint, apex at the centre. */
function hipRoof(w: number, d: number, h: number, yBottom: number, color: number): THREE.Mesh {
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1, h, 4), toonMat(color));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w / Math.SQRT2, 1, d / Math.SQRT2);
  roof.position.y = yBottom + h / 2;
  return roof;
}

/**
 * Recognizable Pokémon Center — cream hall, red hip roof, white cross, glass front
 * doors. Used as the everywhere-safe procedural building (e.g. the GLB is disabled
 * on mobile to protect the GPU), so the Center is never an unmarked grey box.
 * Front faces +Z toward the street.
 */
export function makePokemonCenter(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const h = Math.max(2.6, Math.min(3.8, Math.min(width, depth) * 0.7));
  const frontZ = depth / 2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, h, depth), toonMat(0xf4ead6));
  body.position.y = h / 2; g.add(body);
  g.add(hipRoof(width + 0.7, depth + 0.7, Math.min(1.5, width * 0.35), h, 0xcc2a3a));
  // White cross on the facade.
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.14), toonMat(0xffffff));
  crossV.position.set(0, h * 0.62, frontZ + 0.08); g.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.34, 0.14), toonMat(0xffffff));
  crossH.position.set(0, h * 0.62, frontZ + 0.08); g.add(crossH);
  // Glass doors + side windows.
  const door = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.6, width * 0.28), h * 0.42, 0.12), toonMat(0x6b4a28));
  door.position.set(0, h * 0.21, frontZ + 0.06); g.add(door);
  for (const sx of [-width * 0.3, width * 0.3]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(width * 0.18, h * 0.24, 0.1), toonMat(0x88ccff));
    win.position.set(sx, h * 0.5, frontZ + 0.06); g.add(win);
  }
  return g;
}

/**
 * Recognizable Poké Mart — cream hall, blue hip roof, yellow signboard, glass doors.
 * Everywhere-safe procedural counterpart to the Mart GLB. Front faces +Z.
 */
export function makePokeMart(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const h = Math.max(2.6, Math.min(3.8, Math.min(width, depth) * 0.7));
  const frontZ = depth / 2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, h, depth), toonMat(0xeae0cc));
  body.position.y = h / 2; g.add(body);
  g.add(hipRoof(width + 0.7, depth + 0.7, Math.min(1.5, width * 0.35), h, 0x2a6aaa));
  // Yellow signboard band across the top of the facade.
  const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.6, 0.5, 0.12), toonMat(0xffe44e));
  sign.position.set(0, h * 0.78, frontZ + 0.08); g.add(sign);
  const door = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.6, width * 0.28), h * 0.42, 0.12), toonMat(0x6b4a28));
  door.position.set(0, h * 0.21, frontZ + 0.06); g.add(door);
  for (const sx of [-width * 0.3, width * 0.3]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(width * 0.18, h * 0.24, 0.1), toonMat(0x88ccff));
    win.position.set(sx, h * 0.5, frontZ + 0.06); g.add(win);
  }
  return g;
}

export function makeNosdanHQ(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const height = Math.max(5.2, Math.min(7.2, width * 0.36));
  const frontZ = depth / 2;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    toonMat(0x22222e),
  );
  body.position.y = height / 2;
  g.add(body);

  // Slightly raised front panel reproduces the lighter inset rectangle in the
  // 2D building while giving the facade real depth.
  const inset = new THREE.Mesh(
    new THREE.BoxGeometry(width - 0.48, height - 0.38, 0.16),
    toonMat(0x303040),
  );
  inset.position.set(0, height / 2 - 0.02, frontZ + 0.09);
  g.add(inset);

  // Four floors, separated by the same dark horizontal storey lines.
  const floorH = height / 4;
  for (let floor = 1; floor < 4; floor++) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.42, 0.1, 0.22),
      toonMat(0x14141c),
    );
    band.position.set(0, floor * floorH, frontZ + 0.19);
    g.add(band);
  }

  // Three red-lit windows on every floor, matching the original sprite.
  const glow = new THREE.MeshBasicMaterial({ color: 0xff5a6a });
  const windowW = Math.min(1.18, width * 0.075);
  const windowH = Math.min(0.52, floorH * 0.38);
  for (let floor = 0; floor < 4; floor++) {
    const y = floor * floorH + floorH * 0.62;
    for (const x of [-width * 0.2, 0, width * 0.2]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(windowW, windowH, 0.12), glow);
      win.position.set(x, y, frontZ + 0.23);
      g.add(win);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(windowW + 0.16, 0.08, 0.18), toonMat(0x161620));
      sill.position.set(x, y - windowH / 2 - 0.07, frontZ + 0.24);
      g.add(sill);
    }
  }

  // Central entrance aligned with the map's single walkable gate tile.
  const doorW = Math.min(2.0, width * 0.15);
  const doorH = Math.min(2.1, height * 0.34);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.22), toonMat(0x5a1024));
  gate.position.set(0, doorH / 2, frontZ + 0.25);
  g.add(gate);
  const gateInset = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.26, doorH - 0.22, 0.1), toonMat(0x8a1a34));
  gateInset.position.set(0, doorH / 2, frontZ + 0.39);
  g.add(gateInset);

  // The two crimson vertical banners and gold round emblems are the strongest
  // identifying marks in the existing 2D art.
  for (const x of [-width * 0.42, width * 0.42]) {
    const bannerH = height - 0.58;
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.36, width * 0.035), bannerH, 0.1),
      toonMat(0x8a1020),
    );
    banner.position.set(x, height / 2, frontZ + 0.27);
    g.add(banner);
    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16), toonMat(0xffd24a));
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(x, height / 2, frontZ + 0.36);
    g.add(emblem);
  }

  // One flat roof and parapet complete the single-building silhouette.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.32, 0.22, depth + 0.32), toonMat(0x111119));
  roof.position.y = height + 0.11;
  g.add(roof);
  const base = new THREE.Mesh(new THREE.BoxGeometry(width + 0.18, 0.18, depth + 0.18), toonMat(0x171720));
  base.position.y = 0.09;
  g.add(base);

  return g;
}

/**
 * Bespoke Ice-type Gym — the Frostbell Gym of Seorae (서리종 체육관). A pale
 * glacier-blue hall crowned by a translucent crystal spire and flanked by
 * ice-shard towers, with a great golden frost-bell hung above glowing cyan
 * doors and icicles dripping from the eaves. Procedural (like the Nosdan HQ and
 * the two palaces) so it always reads as a proper ice gym on every device,
 * never a flat grey fallback box. Front faces +Z toward the street.
 */
export function makeFrostGym(width: number, depth: number): THREE.Group {
  const g = new THREE.Group();
  const h = Math.max(3.2, Math.min(4.6, Math.min(width, depth) * 0.8));
  const frontZ = depth / 2;
  const ICE = 0xcfe8f5, ICE_DEEP = 0x7fb4d4, ICE_GLASS = 0x9fd8f0, GOLD = 0xe8c34a;

  // Frozen plinth the whole hall sits on.
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.4, depth + 0.4), toonMat(0x9fc6dc));
  plinth.position.y = 0.2; g.add(plinth);

  // Main glacier-blue hall.
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, h, depth), toonMat(ICE));
  body.position.y = h / 2 + 0.4; g.add(body);

  // Deep-blue corner pilasters give the facade some crystalline structure.
  for (const sx of [-width / 2 + 0.25, width / 2 - 0.25]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), toonMat(ICE_DEEP));
    col.position.set(sx, h / 2 + 0.4, frontZ - 0.25); g.add(col);
  }

  // Eave band + a row of hanging icicles across the front.
  const eave = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.26, depth + 0.4), toonMat(ICE_DEEP));
  eave.position.y = h + 0.4; g.add(eave);
  for (let i = 0; i < 6; i++) {
    const icicle = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.35 + (i % 3) * 0.18, 6),
      toonMat(0xdff4ff, { transparent: true, opacity: 0.9 }),
    );
    icicle.rotation.x = Math.PI;   // point the tip downward
    icicle.position.set(-width / 2 + 0.5 + i * (width - 1) / 5, h + 0.26, frontZ + 0.04);
    g.add(icicle);
  }

  // Great translucent crystal spire crowning the hall.
  const spireH = Math.min(3.4, width * 0.5);
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(width * 0.6, spireH, 4),
    toonMat(ICE_GLASS, { transparent: true, opacity: 0.8 }),
  );
  spire.rotation.y = Math.PI / 4;
  spire.position.y = h + 0.53 + spireH / 2; g.add(spire);
  const spireTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), toonMat(0xeafbff, { transparent: true, opacity: 0.95 }));
  spireTip.position.y = h + 0.53 + spireH + 0.2; g.add(spireTip);

  // Flanking ice-shard towers.
  for (const sx of [-width * 0.42, width * 0.42]) {
    const shardH = h * 0.95;
    const shard = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, shardH, 5),
      toonMat(0xafe0f5, { transparent: true, opacity: 0.85 }),
    );
    shard.position.set(sx, 0.4 + shardH / 2, frontZ - 0.5); g.add(shard);
  }

  // Glowing cyan windows either side of the door.
  const glow = new THREE.MeshBasicMaterial({ color: 0x7fefff });
  for (const sx of [-width * 0.29, width * 0.29]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(width * 0.15, h * 0.34, 0.12), glow);
    win.position.set(sx, h * 0.55 + 0.4, frontZ + 0.06); g.add(win);
  }

  // Icy entrance.
  const doorW = Math.min(1.8, width * 0.26), doorH = h * 0.5;
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.14), toonMat(0x274a5e));
  door.position.set(0, doorH / 2 + 0.4, frontZ + 0.07); g.add(door);
  const doorGlow = new THREE.Mesh(
    new THREE.BoxGeometry(doorW - 0.24, doorH - 0.22, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x4a86a6 }),
  );
  doorGlow.position.set(0, doorH / 2 + 0.4, frontZ + 0.13); g.add(doorGlow);

  // The gym's emblem — a great golden frost-bell hung on a beam over the door.
  const yBell = doorH + 0.4 + 0.55;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.7, 0.18, 0.3), toonMat(0x6b4a2c));
  beam.position.set(0, yBell + 0.34, frontZ + 0.26); g.add(beam);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.44, 0.52, 14), toonMat(GOLD));
  bell.position.set(0, yBell, frontZ + 0.26); g.add(bell);
  const bellCrown = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), toonMat(GOLD));
  bellCrown.position.set(0, yBell + 0.28, frontZ + 0.26); g.add(bellCrown);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), toonMat(0x8a6a2a));
  clapper.position.set(0, yBell - 0.3, frontZ + 0.26); g.add(clapper);

  return g;
}

/** Snow-dusted alpine pine: a trunk under three stacked needle tiers, each
 *  capped with a little snow cone — a true 3D version of the town's 2D pines. */
export function makePineTree(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.5, 6), toonMat(0x5a4030));
  trunk.position.y = 0.25;
  g.add(trunk);
  const needles = 0x2e6b46;
  for (const [r, h, y] of [[0.55, 0.7, 0.7], [0.42, 0.6, 1.0], [0.28, 0.5, 1.3]] as [number, number, number][]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), toonMat(needles));
    cone.position.y = y;
    g.add(cone);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.86, h * 0.34, 7), toonMat(0xffffff));
    snow.position.y = y + h * 0.33;
    g.add(snow);
  }
  return g;
}

/** Korean stone lantern (석등): a stacked stone post topped by a warm glowing
 *  light box under a hip roof — the light uses an unlit bright material so it
 *  reads as lit without a per-lantern point light (mobile-friendly). */
export function makeStoneLantern(): THREE.Group {
  const g = new THREE.Group();
  const stone = 0x9a978f, dark = 0x7a776f;
  const add = (mesh: THREE.Mesh, y: number) => { mesh.position.y = y; g.add(mesh); };
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.16, 6), toonMat(dark)), 0.08);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 6), toonMat(stone)), 0.42);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.08, 6), toonMat(dark)), 0.71);
  // Glowing light chamber.
  add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), new THREE.MeshBasicMaterial({ color: 0xffd680 })), 0.9);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.22, 6), toonMat(stone)), 1.14);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), toonMat(dark)), 1.29);
  return g;
}

/** A hand-placed coastal boulder cluster. Unlike the broad colour-based terrain
 * classifier, this only appears where a scene has an authored rock tile. */
export function makeScenicRock(): THREE.Group {
  const g = new THREE.Group();
  const rocks = makeRocks(3, 0x817a70);
  rocks.place(0, 0, 1.25, 0.25);
  rocks.place(-0.28, 0.18, 0.62, 1.4);
  rocks.place(0.3, 0.2, 0.48, 2.2);
  rocks.finalize();
  g.add(...rocks.meshes);
  return g;
}

/** One lush broadleaf tree for authored parks and forest towns. */
export function makeForestTree(): THREE.Group {
  const g = new THREE.Group();
  const trees = makeTrees(1, 0x3f9345, 0x604329);
  trees.place(0, 0, 1.2, 0);
  trees.finalize();
  g.add(...trees.meshes);
  return g;
}

/** A compact flower bed that keeps the underlying walkable tile natural green. */
export function makeFlowerBed(): THREE.Group {
  const g = new THREE.Group();
  const pink = makeFlowers(2, 0xf27fc2);
  pink.place(-0.18, 0, 1.05, 0.2);
  pink.place(0.2, 0.08, 0.9, 1.2);
  pink.finalize();
  g.add(...pink.meshes);
  return g;
}

/** Bioluminescent woodland mushrooms. MeshBasic caps remain softly luminous
 * without adding expensive point lights on mobile. */
export function makeGlowPlants(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = toonMat(0xb8e7d1);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x70f5cf });
  for (const [x, z, s] of [[-0.22, 0.08, 1], [0.18, -0.08, 0.72], [0.04, 0.22, 0.55]] as [number, number, number][]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.05 * s, 0.28 * s, 7), stemMat);
    stem.position.set(x, 0.14 * s, z);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), glowMat);
    cap.position.set(x, 0.3 * s, z);
    g.add(stem, cap);
  }
  return g;
}

/** Low wooden footbridge for ponds. The deck sits close to the ground so the
 * Phaser collision grid remains authoritative and characters never appear sunk. */
export function makeWoodBridge(width = 2, depth = 3): THREE.Group {
  const g = new THREE.Group();
  const deckMat = toonMat(0x9a7448), edgeMat = toonMat(0x60452e);
  const planks = Math.max(4, Math.round(depth * 3));
  for (let i = 0; i < planks; i++) {
    const z = -depth / 2 + (i + 0.5) * depth / planks;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(width, 0.11, depth / planks * 0.88), deckMat);
    plank.position.set(0, 0.14 + Math.sin((i / (planks - 1)) * Math.PI) * 0.08, z);
    g.add(plank);
  }
  for (const x of [-width / 2 + 0.08, width / 2 - 0.08]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, depth), edgeMat);
    beam.position.set(x, 0.11, 0);
    g.add(beam);
  }
  return g;
}

/** A straight run of railway track (gravel bed + wooden sleepers + two steel
 *  rails) `len` world-units long, laid along the X axis and centred on origin.
 *  Low profile so it never blocks the player. */
export function makeRailTrack(len: number): THREE.Group {
  const g = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.92), toonMat(0x6b6560));
  bed.position.y = 0.04;
  g.add(bed);
  const nTies = Math.max(2, Math.round(len / 0.5));
  for (let i = 0; i < nTies; i++) {
    const x = -len / 2 + (i + 0.5) * (len / nTies);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.82), toonMat(0x5a4433));
    tie.position.set(x, 0.1, 0);
    g.add(tie);
  }
  for (const z of [-0.28, 0.28]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.06), toonMat(0x9098a0));
    rail.position.set(0, 0.16, z);
    g.add(rail);
  }
  return g;
}

/** Translucent ice sculpture on a pedestal: stacked ice-blue snow-figure
 *  spheres crowned by a faceted crystal — the 3D take on the town's snow
 *  sculptures / Ice Bell landmarks. */
export function makeIceStatue(): THREE.Group {
  const g = new THREE.Group();
  const ice = toonMat(0xbfeaff, { transparent: true, opacity: 0.72 });
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.3, 8), toonMat(0x9fbfd6));
  ped.position.y = 0.15;
  g.add(ped);
  const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), ice); b1.position.y = 0.72; g.add(b1);
  const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), ice); b2.position.y = 1.36; g.add(b2);
  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), ice);
  crown.position.y = 1.9; crown.rotation.y = 0.5;
  g.add(crown);
  return g;
}

/** Traditional Korean 옹기 pottery jar — glossy dark-clay body with a narrow
 *  mouth and rolled rim, a wide-bellied fermenting urn. */
export function makePot(): THREE.Group {
  const g = new THREE.Group();
  const clay = 0x4a3324, glaze = 0x6a4a34;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 9), toonMat(glaze));
  body.scale.set(1, 1.12, 1); body.position.y = 0.36;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 12), toonMat(clay));
  foot.position.y = 0.04;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.13, 12), toonMat(glaze));
  neck.position.y = 0.66;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 14), toonMat(clay));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.72;
  g.add(foot, body, neck, rim);
  return g;
}

/** Street lamp: a slim post with a warm glowing lantern head (unlit bright
 *  material so it reads as lit without a per-lamp light — mobile-friendly). */
export function makeStreetlamp(): THREE.Group {
  const g = new THREE.Group();
  const metal = 0x3a3a42;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.16, 8), toonMat(metal));
  base.position.y = 0.08;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 8), toonMat(metal));
  post.position.y = 0.9;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 6), toonMat(metal));
  arm.rotation.z = Math.PI / 2; arm.position.set(0, 1.7, 0);
  // Warm glowing lamp head.
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.2), new THREE.MeshBasicMaterial({ color: 0xffe6a0 }));
  glass.position.y = 1.62;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 6), toonMat(metal));
  cap.position.y = 1.8;
  g.add(base, post, arm, glass, cap);
  return g;
}

/** Wooden mine cart heaped with ore, on four steel wheels. */
export function makeMineCart(): THREE.Group {
  const g = new THREE.Group();
  const wood = 0x6a4a2a, metal = 0x39332f, ore = 0x5a5262;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.34, 0.42), toonMat(wood));
  body.position.y = 0.34;
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.46), toonMat(metal));
  rim.position.y = 0.5;
  const heap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), toonMat(ore));
  heap.scale.set(1.2, 0.6, 0.85); heap.position.y = 0.54;
  for (const [x, z] of [[-0.22, -0.17], [0.22, -0.17], [-0.22, 0.17], [0.22, 0.17]] as [number, number][]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10), toonMat(metal));
    w.rotation.x = Math.PI / 2; w.position.set(x, 0.1, z); g.add(w);
  }
  g.add(body, rim, heap);
  return g;
}

/** Cherry-blossom tree — a trunk under two soft pink canopy puffs. */
export function makeCherryTree(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.62, 6), toonMat(0x6d4c33));
  trunk.position.y = 0.31;
  const blossom = 0xffb7d5;
  const lo = new THREE.Mesh(new THREE.SphereGeometry(0.56, 8, 6), toonMat(blossom));
  lo.scale.set(1, 0.85, 1); lo.position.y = 0.98;
  const hi = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), toonMat(mixColor(blossom, 0xffffff, 0.22)));
  hi.position.y = 1.4;
  g.add(trunk, lo, hi);
  return g;
}

/** Open-front market stall: a wooden counter with goods under a striped awning
 *  on two posts — a street vendor / fish-market stand. */
export function makeStall(): THREE.Group {
  const g = new THREE.Group();
  const wood = 0x9a6a3a, awning = 0xd84a3a;
  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.5), toonMat(wood));
  counter.position.set(0, 0.2, 0.05);
  const goods = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.4), toonMat(0x9fd0e6));
  goods.position.set(0, 0.46, 0.05);
  for (const x of [-0.42, 0.42]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 6), toonMat(0x6a4a2a));
    post.position.set(x, 0.55, -0.18); g.add(post);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.06, 0.56), toonMat(awning));
  roof.position.set(0, 1.0, 0.02); roof.rotation.x = -0.18;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.12, 0.04), toonMat(0xf0f0f0));
  trim.position.set(0, 0.95, 0.28); trim.rotation.x = -0.18;
  g.add(counter, goods, roof, trim);
  return g;
}

/** A small moored wooden rowboat (나룻배): a tapered plank hull with a hollow
 *  interior well, two seat thwarts and a pair of oars resting across the
 *  gunwales. Built from primitives so it works offline. Long axis runs along X
 *  (~2 tiles), so it spans a 2-wide pier berth without extra rotation. */
export function makeBoat(): THREE.Group {
  const g = new THREE.Group();
  const hull = 0x7a4a2a, hullDark = 0x4f3320, seat = 0x8a5a34, oarWood = 0x9a6a3a;
  const L = 1.9, W = 0.64, H = 0.3;
  const top = 0.18 + H / 2;                                    // gunwale height
  // Hull body — the surrounding rim reads as the gunwale once the well is inset.
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), toonMat(hull));
  body.position.y = 0.18;
  g.add(body);
  // Pointed bow + stern: 4-sided cones (square pyramids) laid on their sides.
  for (const dir of [1, -1]) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(W / 2, 0.5, 4), toonMat(hull));
    tip.rotation.y = Math.PI / 4;                              // align square base with hull
    tip.rotation.z = -dir * Math.PI / 2;                       // point along ±X
    tip.position.set(dir * (L / 2 + 0.18), 0.18, 0);
    g.add(tip);
  }
  // Hollow interior well (its open top sits flush with the gunwale).
  const well = new THREE.Mesh(new THREE.BoxGeometry(L * 0.82, H * 0.7, W * 0.66), toonMat(hullDark));
  well.position.y = top - (H * 0.7) / 2;
  g.add(well);
  // Two seat thwarts across the beam.
  for (const x of [-0.42, 0.42]) {
    const thwart = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, W * 0.9), toonMat(seat));
    thwart.position.set(x, top - 0.02, 0);
    g.add(thwart);
  }
  // A pair of oars laid across the gunwales, blades outboard.
  for (const side of [-1, 1]) {
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.3, 6), toonMat(oarWood));
    oar.rotation.z = Math.PI / 2; oar.rotation.y = 0.28 * side;
    oar.position.set(0, top + 0.04, side * 0.16);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.12), toonMat(hullDark));
    blade.position.set(side * 0.62, top + 0.04, side * 0.34);
    g.add(oar, blade);
  }
  return g;
}

/** A vertical cascading waterfall: a tall water sheet with white flow streaks,
 *  a foam pool at the base and a rock ledge at the crest. Built from primitives
 *  (no external asset), so it works offline and reads as falling water. */
export function makeWaterfall(height = 3, width = 1.4): THREE.Group {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const ctx = c.getContext('2d')!;
  const grd = ctx.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#cdeeff'); grd.addColorStop(0.16, '#5fc8f0'); grd.addColorStop(1, '#2f9fd8');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.78)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) {
    const x = 4 + i * 6 + (i % 2) * 2;
    ctx.beginPath(); ctx.moveTo(x, 0);
    for (let y = 0; y <= 128; y += 8) ctx.lineTo(x + Math.sin(y * 0.11 + i) * 2, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sheetMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.93, side: THREE.DoubleSide });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(width, height), sheetMat);
  sheet.position.y = height / 2; g.add(sheet);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.06, height), sheetMat);
  back.position.set(0, height / 2, -0.07); g.add(back);
  const foam = new THREE.Mesh(new THREE.CircleGeometry(width * 0.72, 16), new THREE.MeshBasicMaterial({ color: 0xeaffff, transparent: true, opacity: 0.85 }));
  foam.rotation.x = -Math.PI / 2; foam.position.y = 0.04; g.add(foam);
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(width * 1.3, 0.3, 0.55), toonMat(0x6a6058));
  ledge.position.y = height + 0.08; g.add(ledge);
  return g;
}

// ── Department-store interior fixtures ─────────────────────────────────────
// These are deliberately procedural: every floor can share a coherent visual
// language without depending on external model downloads, and the 2D fallback
// remains usable when WebGL is unavailable.
export type StoreFixtureKind =
  | 'store-wall' | 'store-counter' | 'store-shelf' | 'store-display'
  | 'store-tmrack' | 'store-table' | 'store-elevator' | 'store-planter'
  | 'store-bench' | 'store-directory' | 'store-sofa' | 'store-vending'
  | 'store-railing';

/** Low-poly fixture sized in world tiles and centred on the origin. */
export function makeStoreFixture(
  kind: StoreFixtureKind,
  width = 1,
  depth = 1,
  color = 0x6a7f9a,
): THREE.Group {
  const g = new THREE.Group();
  const w = Math.max(0.18, width), d = Math.max(0.12, depth);
  const dark = 0x343946, metal = 0xaeb8c4, wood = 0x8b623e;
  const box = (bw: number, bh: number, bd: number, matColor: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), toonMat(matColor));
    m.position.set(x, y, z); g.add(m); return m;
  };

  if (kind === 'store-wall') {
    box(w, 1.3, d, color, 0, 0.65, 0);
    box(w, 0.08, d + 0.04, 0xe1c77c, 0, 1.18, 0);
  } else if (kind === 'store-counter') {
    box(w * 0.96, 0.78, d * 0.86, color, 0, 0.39, 0);
    box(w, 0.12, d, 0xe5d4b0, 0, 0.84, 0);
    box(w * 0.78, 0.08, 0.04, dark, 0, 0.48, d * 0.45);
  } else if (kind === 'store-shelf') {
    for (const x of [-w * 0.46, w * 0.46]) box(0.08, 1.45, d * 0.84, dark, x, 0.73, 0);
    for (const y of [0.16, 0.62, 1.08, 1.46]) box(w, 0.08, d * 0.9, color, 0, y, 0);
    const count = Math.max(3, Math.min(10, Math.round(w * 3)));
    const productColors = [0xf26b5b, 0x5ba8e8, 0xf0c44f, 0x70c98b, 0xb787d7];
    for (let i = 0; i < count; i++) {
      const x = -w * 0.42 + (i + 0.5) * (w * 0.84 / count);
      box(Math.max(0.08, w * 0.55 / count), 0.22, d * 0.46, productColors[i % productColors.length], x, 0.31 + (i % 3) * 0.46, 0);
    }
  } else if (kind === 'store-display' || kind === 'store-tmrack') {
    box(w * 0.82, 0.48, d * 0.82, color, 0, 0.24, 0);
    box(w * 0.94, 0.1, d * 0.94, 0xf0dfbd, 0, 0.53, 0);
    if (kind === 'store-tmrack') {
      for (const [x, c] of [[-0.22, 0x55c8ff], [0, 0xffd85a], [0.22, 0xff6cae]] as [number, number][]) {
        const disc = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 6, 14), toonMat(c));
        disc.position.set(x * Math.min(1, w), 0.86, 0); disc.rotation.x = Math.PI / 2.8; g.add(disc);
      }
    } else {
      const gift = new THREE.Mesh(new THREE.DodecahedronGeometry(Math.min(0.3, w * 0.24), 0), toonMat(0xff8ab4));
      gift.position.y = 0.84; gift.rotation.y = 0.45; g.add(gift);
      box(0.06, 0.58, 0.06, 0xf4d04e, 0, 0.86, 0);
    }
  } else if (kind === 'store-table') {
    box(w * 0.72, 0.12, d * 0.72, 0xd8b47a, 0, 0.72, 0);
    box(0.13, 0.68, 0.13, dark, 0, 0.35, 0);
    for (const [x, z] of [[-w * 0.43, 0], [w * 0.43, 0], [0, -d * 0.43], [0, d * 0.43]] as [number, number][]) {
      box(0.34, 0.1, 0.34, color, x, 0.42, z);
      box(0.09, 0.4, 0.09, dark, x, 0.2, z);
    }
  } else if (kind === 'store-elevator') {
    box(w, 2.4, d * 0.34, dark, 0, 1.2, -d * 0.33);
    box(0.16, 2.35, d, metal, -w * 0.45, 1.17, 0);
    box(0.16, 2.35, d, metal, w * 0.45, 1.17, 0);
    box(w, 0.2, d, metal, 0, 2.28, 0);
    box(w * 0.43, 2.0, 0.08, 0x7297b8, -w * 0.22, 1.1, d * 0.42);
    box(w * 0.43, 2.0, 0.08, 0x7297b8, w * 0.22, 1.1, d * 0.42);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd85a }));
    lamp.position.set(w * 0.38, 1.45, d * 0.5); g.add(lamp);
  } else if (kind === 'store-planter') {
    box(w * 0.94, 0.42, d * 0.94, color, 0, 0.21, 0);
    box(w * 0.82, 0.08, d * 0.82, 0x4a3324, 0, 0.44, 0);
    const n = Math.max(2, Math.round(w * 2));
    for (let i = 0; i < n; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5), toonMat(i % 2 ? 0x4e9b52 : 0x397a45));
      leaf.scale.set(0.8, 1.45, 0.8);
      leaf.position.set(-w * 0.34 + (i + 0.5) * (w * 0.68 / n), 0.75, (i % 2 ? 0.12 : -0.1) * d);
      g.add(leaf);
    }
  } else if (kind === 'store-bench') {
    box(w, 0.12, d * 0.72, wood, 0, 0.48, 0);
    box(w, 0.5, 0.1, color, 0, 0.76, -d * 0.28);
    for (const x of [-w * 0.36, w * 0.36]) box(0.1, 0.48, 0.1, dark, x, 0.24, 0);
  } else if (kind === 'store-directory') {
    box(w * 0.85, 1.35, 0.14, 0x334863, 0, 1.05, 0);
    box(w, 0.12, d * 0.62, metal, 0, 0.08, 0);
    for (let i = 0; i < 6; i++) box(w * 0.62, 0.055, 0.02, i % 2 ? 0xffd76a : 0xcfe8ff, 0, 1.48 - i * 0.18, 0.08);
  } else if (kind === 'store-sofa') {
    box(w, 0.42, d * 0.88, color, 0, 0.31, 0);
    box(w, 0.58, 0.22, color, 0, 0.68, -d * 0.34);
    for (const x of [-w * 0.46, w * 0.46]) box(0.16, 0.42, d, dark, x, 0.42, 0);
  } else if (kind === 'store-vending') {
    box(w * 0.9, 1.72, d * 0.78, color, 0, 0.86, 0);
    box(w * 0.68, 0.82, 0.05, 0xc8efff, 0, 1.12, d * 0.41);
    for (let i = 0; i < 6; i++) box(0.1, 0.18, 0.06, [0x5cc9ff, 0xff6d73, 0xffd04f][i % 3], -0.22 + (i % 3) * 0.22, 1.37 - Math.floor(i / 3) * 0.32, d * 0.46);
    box(w * 0.42, 0.16, 0.05, dark, 0, 0.3, d * 0.42);
  } else if (kind === 'store-railing') {
    box(w, 0.1, Math.max(0.08, d), metal, 0, 0.9, 0);
    const n = Math.max(2, Math.round(w / 0.7));
    for (let i = 0; i <= n; i++) box(0.07, 0.92, Math.max(0.08, d), dark, -w / 2 + i * (w / n), 0.46, 0);
  }
  return g;
}

/** Grey-granite civic obelisk with a stepped base and gold finial. */
export function makeGrandObelisk(): THREE.Group {
  const g = new THREE.Group();
  const granite = toonMat(0x62666f);
  const dark = toonMat(0x454952);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), dark);
  base.position.y = 0.11;
  g.add(base);
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.62), granite);
  step.position.y = 0.34;
  g.add(step);
  const shaft = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.65, 4), granite);
  shaft.position.y = 1.78;
  shaft.rotation.y = Math.PI / 4;
  g.add(shaft);
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.17), toonMat(0xd8b44a));
  finial.position.y = 3.22;
  g.add(finial);
  return g;
}

/** Bronze civic figure on a low granite plinth. */
export function makeBronzeStatue(): THREE.Group {
  const g = new THREE.Group();
  const bronze = toonMat(0x98743a);
  const stone = toonMat(0x4b4f58);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.72), stone);
  plinth.position.y = 0.21;
  g.add(plinth);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.65, 0.24), bronze);
  legs.position.y = 0.78;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.72, 0.3), bronze);
  torso.position.y = 1.43;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), bronze);
  head.position.y = 1.96;
  g.add(head);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.72, 6), bronze);
    arm.position.set(side * 0.38, 1.5 + (side > 0 ? 0.08 : 0), 0);
    arm.rotation.z = side * (Math.PI / 2.8);
    g.add(arm);
  }
  return g;
}

/** Walk-through ceremonial arch sized for a two-tile avenue. */
export function makeTriumphalArch(): THREE.Group {
  const g = new THREE.Group();
  const stone = toonMat(0x5b5f68);
  const trim = toonMat(0x3f434b);
  for (const x of [-0.78, 0.78]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.62), trim);
    foot.position.set(x, 0.09, 0);
    g.add(foot);
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 2.15, 0.48), stone);
    pillar.position.set(x, 1.17, 0);
    g.add(pillar);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.48, 0.58), stone);
  beam.position.y = 2.28;
  g.add(beam);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.16, 0.7), trim);
  crown.position.y = 2.6;
  g.add(crown);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), toonMat(0xd8b44a));
  star.position.set(0, 2.3, 0.34);
  g.add(star);
  return g;
}

// ── Water surface ───────────────────────────────────────────────────────────
/** Paint one bright-cyan water tile with curved light ribbons and soft glints. */
function paintWaterTile(sparkleSeed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  // Flat vivid cyan base with a soft vertical brighten toward the top-left.
  const grd = ctx.createLinearGradient(0, 0, 128, 128);
  grd.addColorStop(0, '#38c6f4');
  grd.addColorStop(1, '#1ba3e6');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 128);
  // Broad curved ribbons imply a continuous surface instead of pixel chunks.
  ctx.strokeStyle = 'rgba(218,248,255,0.48)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let band = 0; band < 5; band++) {
    const y0 = 16 + band * 24;
    ctx.beginPath();
    for (let x = -8; x <= 136; x += 8) {
      const y = y0 + Math.sin(x * 0.07 + band * 1.7) * 4;
      if (x === -8) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Small highlights keep the surface lively without a pixel-art checker.
  let s = sparkleSeed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
  ctx.fillStyle = 'rgba(236,252,255,0.86)';
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rnd() * 120) + 4;
    const y = Math.floor(rnd() * 120) + 4;
    ctx.beginPath(); ctx.ellipse(x, y, 3 + rnd() * 3, 1.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

/** Animated bright-cyan water sheet placed over painted water regions.
 *  Two crossfading sparkle layers drift slowly for a gentle shimmer. */
export function makeWater(width: number, depth: number): { mesh: THREE.Mesh; update(t: number): void } {
  const mkTex = (seed: number) => {
    const t = new THREE.CanvasTexture(paintWaterTile(seed));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.repeat.set(Math.max(1, width / 3.2), Math.max(1, depth / 3.2));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const tex = mkTex(0x9e3779b9);
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: 0.94, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return {
    mesh,
    update(t: number) {
      // Slow drift + a subtle vertical bob so the glints twinkle rather than slide.
      tex.offset.x = t * 0.012;
      tex.offset.y = Math.sin(t * 0.5) * 0.03;
      (mat).opacity = 0.9 + Math.sin(t * 1.3) * 0.05;
    },
  };
}

/**
 * A stylized passenger/car ferry — the overnight 남해 연락선. Built from toon
 * primitives so it renders anywhere without an asset file. The bow points toward
 * +Z; the model sits with its waterline at y≈0 (hull below, deck above) so it can
 * be dropped straight onto a sea plane. `length` runs along Z, `beam` along X.
 */
export function makeFerry(length = 9, beam = 3.2): THREE.Group {
  const g = new THREE.Group();
  const hullH = beam * 0.5;
  const halfL = length / 2;

  // ── Hull ── dark navy body, most of it below the waterline.
  const hull = new THREE.Mesh(new THREE.BoxGeometry(beam, hullH, length * 0.82), toonMat(0x1b3b5f));
  hull.position.set(0, -hullH * 0.28, -length * 0.04);
  g.add(hull);
  // Red boot-topping stripe along the waterline.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(beam + 0.04, hullH * 0.16, length * 0.82), toonMat(0xb5352f));
  stripe.position.set(0, hullH * 0.02, -length * 0.04);
  g.add(stripe);
  // Bow wedge — a 4-sided prism narrowing to a point at the bow (+Z).
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.001, hullH * 0.9, beam, 4), toonMat(0x1b3b5f));
  bow.rotation.z = Math.PI / 2;              // point along ±X → then aim down +Z
  bow.rotation.y = Math.PI / 2;
  bow.scale.set(1, length * 0.16, 1);
  bow.position.set(0, -hullH * 0.2, halfL * 0.82);
  g.add(bow);

  // ── Main deck ── pale planked platform on top of the hull.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.98, 0.18, length * 0.86), toonMat(0xd8c39a));
  deck.position.set(0, hullH * 0.22, -length * 0.02);
  g.add(deck);

  // ── Superstructure ── two white cabin tiers set back from the bow.
  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.8, hullH * 0.7, length * 0.5), toonMat(0xf2f0ea));
  tier1.position.set(0, hullH * 0.22 + hullH * 0.35, -length * 0.12);
  g.add(tier1);
  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(beam * 0.6, hullH * 0.55, length * 0.34), toonMat(0xf6f5f0));
  tier2.position.set(0, hullH * 0.22 + hullH * 0.7 + hullH * 0.27, -length * 0.14);
  g.add(tier2);
  // Bridge windows — blue bands wrapping each tier.
  for (const [y, w, z] of [
    [hullH * 0.22 + hullH * 0.35, beam * 0.82, length * 0.5],
    [hullH * 0.22 + hullH * 0.7 + hullH * 0.27, beam * 0.62, length * 0.34],
  ] as const) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w, hullH * 0.16, z), toonMat(0x2f6fa8));
    band.position.set(0, y + hullH * 0.08, -length * 0.13);
    g.add(band);
  }

  // ── Funnel ── red stack with a black cap, set aft (−Z).
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(beam * 0.16, beam * 0.19, hullH * 0.75, 12), toonMat(0xc23a30));
  funnel.position.set(0, hullH * 0.22 + hullH * 0.7 + hullH * 0.55, -length * 0.22);
  g.add(funnel);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(beam * 0.18, beam * 0.18, hullH * 0.12, 12), toonMat(0x1c1c22));
  cap.position.set(0, funnel.position.y + hullH * 0.4, funnel.position.z);
  g.add(cap);

  // ── Rails ── thin posts + a top rail down both deck edges.
  const railMat = toonMat(0xece7db);
  const deckY = hullH * 0.22 + 0.09;
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, length * 0.8), railMat);
    rail.position.set(sx * beam * 0.47, deckY + 0.34, -length * 0.02);
    g.add(rail);
    for (let i = -4; i <= 4; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), railMat);
      post.position.set(sx * beam * 0.47, deckY + 0.17, i * (length * 0.8 / 9) - length * 0.02);
      g.add(post);
    }
  }

  g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// ── Merged wall/cliff blocks (vertex-colored) ───────────────────────────────
export class WallBuilder {
  private pos: number[] = [];
  private col: number[] = [];
  private idx: number[] = [];
  private tmp = new THREE.Color();

  /** Add one box spanning tile-space [x0,x1)×[z0,z1) with height h, tinted `color`. */
  add(x0: number, z0: number, x1: number, z1: number, h: number, color: number): void {
    const c = this.tmp.set(color);
    const shade = (f: number) => [c.r * f, c.g * f, c.b * f] as const;
    const top = shade(1.08), bevelTone = shade(0.94), front = shade(0.82), side = shade(0.7);
    const base = () => this.pos.length / 3;
    const quad = (
      pts: number[], rgb: readonly [number, number, number],
    ) => {
      const b = base();
      this.pos.push(...pts);
      for (let i = 0; i < 4; i++) this.col.push(rgb[0], rgb[1], rgb[2]);
      this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    // Chamfered cap: a small sloped shoulder catches the sun and prevents long
    // cliff runs from reading as stacked rectangular blocks.
    const bevel = Math.min(0.14, (x1 - x0) * 0.12, (z1 - z0) * 0.12, h * 0.18);
    const yShoulder = h - bevel;
    const ix0 = x0 + bevel, ix1 = x1 - bevel, iz0 = z0 + bevel, iz1 = z1 - bevel;
    quad([ix0, h, iz0, ix1, h, iz0, ix1, h, iz1, ix0, h, iz1], top);
    quad([x0, yShoulder, z0, x1, yShoulder, z0, ix1, h, iz0, ix0, h, iz0], bevelTone);
    quad([x1, yShoulder, z1, x0, yShoulder, z1, ix0, h, iz1, ix1, h, iz1], bevelTone);
    quad([x0, yShoulder, z1, x0, yShoulder, z0, ix0, h, iz0, ix0, h, iz1], bevelTone);
    quad([x1, yShoulder, z0, x1, yShoulder, z1, ix1, h, iz1, ix1, h, iz0], bevelTone);
    // Vertical faces stop at the shoulder.
    quad([x0, 0, z1, x1, 0, z1, x1, yShoulder, z1, x0, yShoulder, z1], front);
    quad([x1, 0, z0, x0, 0, z0, x0, yShoulder, z0, x1, yShoulder, z0], front);
    quad([x0, 0, z0, x0, 0, z1, x0, yShoulder, z1, x0, yShoulder, z0], side);
    quad([x1, 0, z1, x1, 0, z0, x1, yShoulder, z0, x1, yShoulder, z1], side);
  }

  build(): THREE.Mesh | null {
    if (this.idx.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp() });
    return new THREE.Mesh(g, m);
  }
}

// ── Coastal harbour dressing ─────────────────────────────────────────────────
// A fishing town lives on its quayside clutter: iced fish counters under bright
// awnings, stacked crates, drying racks, mooring bollards and floating buoys.
// All primitive-built, so the harbour works offline and stays cheap to draw.

/** A fish-market counter: iced tray of the day's catch under a striped awning,
 *  with a hanging scale and a chalk price board. Faces −Z (toward the shopper). */
export function makeFishStall(): THREE.Group {
  const g = new THREE.Group();
  const wood = 0x9a6a3a, post = 0x6a4a2a;

  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.44, 0.72), toonMat(wood));
  counter.position.set(0, 0.22, 0);
  const iceTray = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.1, 0.58), toonMat(0xdfeef6));
  iceTray.position.set(0, 0.49, 0);
  g.add(counter, iceTray);

  // The catch: silver, red-snapper and squid tones laid on the ice.
  const catchTones = [0xbfc9d4, 0xd8654f, 0xe8d9c0, 0xa9b6c4];
  for (let i = 0; i < 7; i++) {
    const fish = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 5), toonMat(catchTones[i % catchTones.length]));
    fish.scale.set(1.7, 0.5, 0.7);
    fish.position.set(-0.52 + (i % 4) * 0.34, 0.56, -0.12 + Math.floor(i / 4) * 0.24);
    fish.rotation.y = (i % 3) * 0.4;
    g.add(fish);
  }

  // Posts + striped awning.
  for (const x of [-0.72, 0.72]) {
    for (const z of [-0.3, 0.3]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), toonMat(post));
      p.position.set(x, 0.75, z);
      g.add(p);
    }
  }
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(1.72 / stripes, 0.06, 1.0),
      toonMat(i % 2 ? 0xf2f2ee : 0x2f8fd0),
    );
    seg.position.set(-0.86 + (i + 0.5) * (1.72 / stripes), 1.54, -0.06);
    seg.rotation.x = -0.14;
    g.add(seg);
  }
  // Valance along the shopper side.
  const valance = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.16, 0.04), toonMat(0x2f8fd0));
  valance.position.set(0, 1.46, 0.44);
  g.add(valance);

  // Hanging scale + chalk board.
  const scaleArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 5), toonMat(0x555a60));
  scaleArm.position.set(0.6, 1.28, 0.1);
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.05, 10), toonMat(0xb9bfc6));
  pan.position.set(0.6, 1.09, 0.1);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.3, 0.03), toonMat(0x2a2f36));
  board.position.set(-0.62, 0.72, 0.37);
  board.rotation.x = 0.2;
  g.add(scaleArm, pan, board);
  return g;
}

/** A stack of quayside crates, some open with fish or nets inside. */
export function makeCrateStack(): THREE.Group {
  const g = new THREE.Group();
  const tones = [0xa87a48, 0x926a3e, 0xb98a52];
  const boxes: [number, number, number, number][] = [
    [0, 0.22, 0, 0.44], [0.34, 0.2, 0.22, 0.4], [-0.28, 0.19, 0.26, 0.38],
    [0.08, 0.62, 0.06, 0.4],
  ];
  boxes.forEach(([x, y, z, s], i) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), toonMat(tones[i % tones.length]));
    c.position.set(x, y, z);
    c.rotation.y = (i * 0.5) % 1.2;
    g.add(c);
    // slat lines
    const slat = new THREE.Mesh(new THREE.BoxGeometry(s * 1.02, s * 0.08, s * 1.02), toonMat(0x6f4f2c));
    slat.position.copy(c.position);
    slat.rotation.y = c.rotation.y;
    g.add(slat);
  });
  const catchTop = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), toonMat(0xbfc9d4));
  catchTop.scale.set(1.6, 0.5, 0.8);
  catchTop.position.set(0.08, 0.83, 0.06);
  g.add(catchTop);
  return g;
}

/** A drying rack: split fish hung from a timber frame, a coastal-village staple. */
export function makeDryingRack(): THREE.Group {
  const g = new THREE.Group();
  const timber = 0x8a6238;
  for (const x of [-0.7, 0.7]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.5, 6), toonMat(timber));
    leg.position.set(x, 0.75, 0);
    g.add(leg);
  }
  for (const y of [1.42, 1.05]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), toonMat(timber));
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, y, 0);
    g.add(bar);
  }
  for (let i = 0; i < 8; i++) {
    const row = i % 2;
    const fish = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.04), toonMat(row ? 0xd8c9a8 : 0xc7b494));
    fish.position.set(-0.6 + (i % 4) * 0.4 + row * 0.1, (row ? 1.05 : 1.42) - 0.2, row ? 0.05 : -0.05);
    g.add(fish);
  }
  return g;
}

/** A cast-iron mooring bollard with a coiled rope at its foot. */
export function makeBollard(): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.5, 8), toonMat(0x3a4048));
  post.position.y = 0.25;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), toonMat(0x3a4048));
  cap.scale.y = 0.6; cap.position.y = 0.5;
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 6, 12), toonMat(0xcbb388));
  rope.rotation.x = Math.PI / 2; rope.position.y = 0.045;
  g.add(post, cap, rope);
  return g;
}

/** A floating harbour buoy — bobbing is applied by the caller if desired. */
export function makeBuoy(): THREE.Group {
  const g = new THREE.Group();
  const float = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), toonMat(0xd8483a));
  float.scale.y = 0.85; float.position.y = 0.2;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 10), toonMat(0xf2f2ee));
  band.position.y = 0.24;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 5), toonMat(0x55606a));
  mast.position.y = 0.6;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 5), new THREE.MeshBasicMaterial({ color: 0xfff0a8 }));
  lamp.position.y = 0.82;
  g.add(float, band, mast, lamp);
  return g;
}

/** A fishing net draped over a frame, drying on the quay. */
export function makeFishingNet(): THREE.Group {
  const g = new THREE.Group();
  const frame = 0x7f5a34;
  for (const x of [-0.5, 0.5]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.05, 6), toonMat(frame));
    leg.position.set(x, 0.52, 0);
    g.add(leg);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), toonMat(frame));
  bar.rotation.z = Math.PI / 2; bar.position.y = 1.02;
  g.add(bar);
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.85),
    new THREE.MeshLambertMaterial({ color: 0xbfc4ae, transparent: true, opacity: 0.75, side: THREE.DoubleSide, wireframe: true }),
  );
  net.position.set(0, 0.6, 0.03);
  g.add(net);
  const floats = [-0.34, 0, 0.34];
  for (const fx of floats) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), toonMat(0xe2a13c));
    f.position.set(fx, 0.2, 0.05);
    g.add(f);
  }
  return g;
}

// ── Summit training village ──────────────────────────────────────────────────
// Seolbong's dojo district: the gear a mountain martial-arts school leaves out
// in the snow. Primitive-built so the whole terrace costs almost nothing.

/** A wooden striking post (목인방) — a padded trunk with three strike arms. */
export function makeTrainingPost(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.7, 8), toonMat(0x7d5a34));
  trunk.position.y = 0.85;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.18, 8), toonMat(0x574024));
  base.position.y = 0.09;
  g.add(trunk, base);
  // Strike arms at staggered heights/angles.
  const arms: [number, number][] = [[1.24, 0], [1.06, 2.1], [0.82, 4.2]];
  for (const [y, a] of arms) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.62, 6), toonMat(0x8f6a3e));
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = a;
    arm.position.y = y;
    g.add(arm);
  }
  // Rope wrap where the strikes land, and a cap of settled snow.
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.34, 8), toonMat(0xd8c39a));
  wrap.position.y = 1.42;
  const snow = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 8), toonMat(0xf2f7fb));
  snow.position.y = 1.72;
  g.add(wrap, snow);
  return g;
}

/** A straw practice dummy on a stake, snow gathered on its shoulders. */
export function makeStrawDummy(): THREE.Group {
  const g = new THREE.Group();
  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.1, 6), toonMat(0x6b4e2c));
  stake.position.y = 0.55;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.72, 9), toonMat(0xd9c184));
  body.position.y = 1.16;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 9, 7), toonMat(0xe0cb94));
  head.position.y = 1.64;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.09, 9), toonMat(0x9a3c34));
  belt.position.y = 1.1;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), toonMat(0xf4f8fc));
  cap.position.y = 1.66;
  g.add(stake, body, head, belt, cap);
  return g;
}

/** A rack of training staves and practice blades leaning under a small roof. */
export function makeWeaponRack(): THREE.Group {
  const g = new THREE.Group();
  const frame = 0x6f5230;
  for (const x of [-0.55, 0.55]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.25, 0.09), toonMat(frame));
    leg.position.set(x, 0.62, 0);
    g.add(leg);
  }
  for (const y of [1.18, 0.5]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.1), toonMat(frame));
    bar.position.set(0, y, 0);
    g.add(bar);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.44), toonMat(0x3f4a58));
  roof.position.set(0, 1.34, 0.06);
  roof.rotation.x = -0.16;
  g.add(roof);
  // Staves and a couple of wooden blades.
  const staves = [-0.42, -0.2, 0.04, 0.28, 0.48];
  staves.forEach((x, i) => {
    const isBlade = i % 3 === 2;
    const w = new THREE.Mesh(
      isBlade ? new THREE.BoxGeometry(0.07, 1.0, 0.03) : new THREE.CylinderGeometry(0.032, 0.032, 1.25, 6),
      toonMat(isBlade ? 0xb98f52 : 0x8d6a3c),
    );
    w.position.set(x, 0.66, 0.12);
    w.rotation.z = 0.1 - i * 0.045;
    g.add(w);
    if (isBlade) {
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.06), toonMat(0x55402a));
      guard.position.set(x, 0.3, 0.12);
      g.add(guard);
    }
  });
  return g;
}

/** A roped sparring ring: four posts, a hemp rope and a swept-clear floor. */
export function makeSparringRing(size = 3): THREE.Group {
  const g = new THREE.Group();
  const h = size / 2;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(h * 0.98, 24), toonMat(0xb9a685));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.03;
  g.add(floor);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(h * 0.99, 0.05, 6, 28), toonMat(0xd8c8a4));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.62;
  g.add(ring);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.86, 7), toonMat(0x6b4e2c));
    post.position.set(Math.cos(a) * h, 0.43, Math.sin(a) * h);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), toonMat(0x54402a));
    knob.position.set(post.position.x, 0.9, post.position.z);
    g.add(post, knob);
  }
  return g;
}

/** A tall banner pole with a school pennant that hangs stiff in the cold. */
export function makeSchoolBanner(color = 0x9a3c34): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 3.1, 7), toonMat(0x5f462a));
  pole.position.y = 1.55;
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 7), toonMat(0xd8b45a));
  finial.position.y = 3.2;
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.52), toonMat(color));
  cloth.position.set(0.06, 2.2, 0.28);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.54), toonMat(0xf0e6cc));
  trim.position.set(0.06, 1.5, 0.28);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.2, 8), toonMat(0x6d6560));
  base.position.y = 0.1;
  g.add(pole, finial, cloth, trim, base);
  return g;
}

/** A temple bell hung in a timber frame — struck at dawn to start training. */
export function makeBellFrame(): THREE.Group {
  const g = new THREE.Group();
  const timber = 0x6f5230;
  for (const x of [-0.7, 0.7]) {
    for (const z of [-0.28, 0.28]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.0, 7), toonMat(timber));
      leg.position.set(x, 1.0, z);
      leg.rotation.z = -Math.sign(x) * 0.07;
      g.add(leg);
    }
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.2), toonMat(0x54401f));
  beam.position.y = 2.02;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.5, 4), toonMat(0x3a4b5c));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.34;
  g.add(beam, roof);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.72, 12), toonMat(0x7a6a3c));
  bell.position.y = 1.5;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 14), toonMat(0x5d5030));
  lip.rotation.x = Math.PI / 2; lip.position.y = 1.16;
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 10), toonMat(0x5d5030));
  crown.position.y = 1.9;
  // The striking beam, slung on ropes beside the bell.
  const striker = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.9, 7), toonMat(0x8a6438));
  striker.rotation.z = Math.PI / 2;
  striker.position.set(0.85, 1.5, 0);
  g.add(bell, lip, crown, striker);
  return g;
}

/** A snow-capped meditation boulder with a swept stone apron. */
export function makeMeditationRock(): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.62, 0);
  geo.scale(1.25, 0.85, 1.1);
  const rock = new THREE.Mesh(geo, toonMat(0x6f6a66));
  rock.position.y = 0.5;
  const snow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), toonMat(0xf4f8fc));
  snow.scale.set(1.2, 0.7, 1.05);
  snow.position.y = 0.86;
  const apron = new THREE.Mesh(new THREE.CircleGeometry(1.0, 18), toonMat(0xa9a29a));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = 0.02;
  g.add(apron, rock, snow);
  return g;
}

/** A stack of split firewood under a plank lid, snow on top. */
export function makeFirewoodStack(): THREE.Group {
  const g = new THREE.Group();
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.9, 7), toonMat(row % 2 ? 0x8a6438 : 0x77552f));
      log.rotation.z = Math.PI / 2;
      log.position.set(0, 0.09 + row * 0.16, -0.32 + i * 0.16);
      g.add(log);
    }
  }
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.9), toonMat(0x5f4a2e));
  lid.position.y = 0.52;
  const snow = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.07, 0.92), toonMat(0xf2f7fb));
  snow.position.y = 0.57;
  g.add(lid, snow);
  return g;
}

/**
 * An alpine crater lake: deep glacial water rather than a flat blue plane.
 *
 * Three stacked layers sell the depth — an opaque dark base, the animated
 * surface sheet drifting over it, and a pale shallow ring where the water meets
 * the shore — plus a slow sun glitter band. Same interface as makeWater(), so a
 * scene can swap one for the other.
 */
export function makeAlpineLake(width: number, depth: number): { mesh: THREE.Mesh; update(t: number): void } {
  const group = new THREE.Group() as unknown as THREE.Mesh;   // container, used as the "mesh"

  // ── Deep base: a dark teal floor read through the translucent surface. ──
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ color: 0x0e3a5c }),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.06;
  group.add(base);

  // ── Shallow shelf: a lighter inset ring that fades the shoreline. ──
  const shelfTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 30, 64, 64, 64);
    g.addColorStop(0, 'rgba(120,200,230,0)');
    g.addColorStop(0.72, 'rgba(150,215,235,0.35)');
    g.addColorStop(1, 'rgba(225,245,252,0.85)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const shelf = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map: shelfTex, transparent: true, depthWrite: false }),
  );
  shelf.rotation.x = -Math.PI / 2;
  shelf.position.y = -0.03;
  shelf.renderOrder = 2;
  group.add(shelf);

  // ── Surface: the existing animated ripple sheet, tinted colder. ──
  const surface = makeWater(width, depth);
  surface.mesh.position.y = 0.01;
  (surface.mesh.material as THREE.MeshLambertMaterial).color = new THREE.Color(0x9fd8ee);
  (surface.mesh.material as THREE.MeshLambertMaterial).opacity = 0.72;
  group.add(surface.mesh);

  // ── Sun glitter: a soft bright band that drifts across the water. ──
  const glintTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 32;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 32);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.4})`;
      ctx.fillRect(Math.random() * 128, 8 + Math.random() * 16, 2 + Math.random() * 4, 1.5);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const glint = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth * 0.34),
    new THREE.MeshBasicMaterial({
      map: glintTex, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  glint.rotation.x = -Math.PI / 2;
  glint.position.y = 0.03;
  glint.renderOrder = 4;
  group.add(glint);

  return {
    mesh: group,
    update(t: number) {
      surface.update(t);
      glint.position.z = Math.sin(t * 0.16) * depth * 0.22;
      (glint.material as THREE.MeshBasicMaterial).opacity = 0.34 + Math.sin(t * 0.7) * 0.14;
      glintTex.offset.x = t * 0.02;
    },
  };
}

/** A Poké Ball resting on a bench — the classic red/white shell with a lit
 *  centre button, sized for a lab table (about a third of a tile across). */
/** Prof. Song's presentation bench: a lab counter with a felt tray and the
 *  three starter Poké Balls resting on top, at a height a visitor actually
 *  reads from the interior camera. One prop so the set always stays aligned. */
export function makeStarterBenchProp(): THREE.Group {
  const g = new THREE.Group();
  const W = 2.8, D = 1.0, H = 0.62;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    new THREE.MeshToonMaterial({ color: 0xe7ecf5 }),
  );
  body.position.y = H / 2;
  body.castShadow = body.receiveShadow = true;
  g.add(body);

  // Brushed-steel worktop with a slight overhang.
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.12, 0.08, D + 0.12),
    new THREE.MeshToonMaterial({ color: 0xb4bfd2 }),
  );
  top.position.y = H + 0.04;
  top.castShadow = top.receiveShadow = true;
  g.add(top);

  // Navy felt tray the balls sit in.
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.06, 0.52),
    new THREE.MeshToonMaterial({ color: 0x2c4a6e }),
  );
  tray.position.set(0, H + 0.11, 0.02);
  g.add(tray);

  for (let i = 0; i < 3; i++) {
    const ball = makePokeBallProp();
    ball.scale.setScalar(1.15);
    ball.position.set(-0.66 + i * 0.66, H + 0.14, 0.02);
    g.add(ball);
  }
  return g;
}

export function makePokeBallProp(): THREE.Group {
  const g = new THREE.Group();
  const R = 0.17;
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(R, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    toonMat(0xd8342c),
  );
  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(R, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    toonMat(0xf2f2f0),
  );
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.01, R * 1.01, R * 0.14, 16), toonMat(0x24262b));
  const button = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.3, R * 0.3, R * 0.16, 12), toonMat(0x24262b));
  button.rotation.x = Math.PI / 2;
  button.position.set(0, 0, R * 0.94);
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.17, R * 0.17, R * 0.2, 12),
    new THREE.MeshBasicMaterial({ color: 0xfdfdfa }),
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0, R * 1.0);
  for (const part of [top, bottom, band, button, lens]) { part.position.y += R; g.add(part); }
  // A shallow cradle so the ball sits on the bench instead of floating.
  const cradle = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.8, R * 0.9, 0.04, 14), toonMat(0x8f9aa8));
  cradle.position.y = 0.02;
  g.add(cradle);
  return g;
}
