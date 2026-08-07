import * as THREE from 'three';
import { toonMat, toonRamp } from './Props';

// ── City street detail ───────────────────────────────────────────────────────
// Turns a painted city into a believable street scene, using only the scene's
// own tile grid (gameplay, collision and events are never touched):
//
//   • Roads become a real asphalt surface with a dashed centre line, painted
//     lane edges and zebra crossings at every intersection approach.
//   • Sidewalks are raised slabs with a curb face and a paving pattern, so
//     streets read with genuine height instead of flat colour.
//   • Street furniture (lamps, traffic signals, benches, planters, signs,
//     hydrants, manhole covers) is placed along kerbs with sensible spacing.
//
// Everything is merged/instanced: the whole overhaul is a handful of draw calls.

export interface CityTileSpec {
  /** tile ids that are drivable road */
  road: number[];
  /** tile ids that are walkable pavement (sidewalk, plaza) */
  sidewalk: number[];
  /** optional: bridge tiles treated as road */
  bridge?: number[];
}

export interface CityDetailResult {
  group: THREE.Group;
  update(t: number): void;
}

const ROAD_Y = 0.012;          // just above the painted ground decal
const WALK_TOP = 0.14;         // sidewalk slab height
const LANE = 0.9;

function isIn(list: number[] | undefined, v: number): boolean {
  return !!list && list.indexOf(v) !== -1;
}

/** Deterministic PRNG so a city looks identical on every load. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Painted textures ─────────────────────────────────────────────────────────

function asphaltTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#4a4a50';
  ctx.fillRect(0, 0, 128, 128);
  // aggregate speckle
  for (let i = 0; i < 2600; i++) {
    const g = 40 + Math.random() * 60;
    ctx.fillStyle = `rgba(${g},${g},${g + 4},${0.05 + Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1.4, 1.4);
  }
  // faint tyre polish bands
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fillRect(0, 26, 128, 12);
  ctx.fillRect(0, 90, 128, 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function pavingTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b9b3a6';
  ctx.fillRect(0, 0, 128, 128);
  // paving slabs, 4×4 with joints
  ctx.strokeStyle = 'rgba(120,114,104,0.85)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const p = i * 32;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(128, p); ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const g = 150 + Math.random() * 60;
    ctx.fillStyle = `rgba(${g},${g - 4},${g - 12},0.10)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ── Road markings (drawn once onto a big overlay canvas) ─────────────────────

/**
 * Paint lane markings for the whole city into one transparent canvas laid over
 * the road surface.
 *
 * Roads here are multi-tile corridors, so markings are derived from CORRIDOR
 * geometry rather than per tile: each tile knows how far the road runs through
 * it horizontally and vertically, which identifies real junctions (long runs on
 * both axes) and gives each corridor a true centre line and kerb edge lines.
 */
function markingsTexture(
  cols: number, rows: number,
  isRoad: (x: number, y: number) => boolean,
): THREE.CanvasTexture {
  const PXT = 16;                              // canvas px per tile
  const c = document.createElement('canvas');
  c.width = Math.min(4096, cols * PXT);
  c.height = Math.min(4096, rows * PXT);
  const sx = c.width / cols, sy = c.height / rows;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.lineCap = 'butt';

  // ── run lengths through every road tile ──
  const hRun = new Int16Array(cols * rows);
  const vRun = new Int16Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    let x = 0;
    while (x < cols) {
      if (!isRoad(x, y)) { x++; continue; }
      let e = x; while (e < cols && isRoad(e, y)) e++;
      for (let i = x; i < e; i++) hRun[y * cols + i] = e - x;
      x = e;
    }
  }
  for (let x = 0; x < cols; x++) {
    let y = 0;
    while (y < rows) {
      if (!isRoad(x, y)) { y++; continue; }
      let e = y; while (e < rows && isRoad(x, e)) e++;
      for (let i = y; i < e; i++) vRun[i * cols + x] = e - y;
      y = e;
    }
  }
  const CORRIDOR = 7;                          // a real street runs at least this far
  const isJunction = (x: number, y: number) =>
    isRoad(x, y) && hRun[y * cols + x] >= CORRIDOR && vRun[y * cols + x] >= CORRIDOR;

  // ── centre + edge lines along each corridor ──
  const dash = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.strokeStyle = 'rgba(238,206,90,0.92)';
    ctx.lineWidth = Math.max(1.6, sx * 0.06);
    ctx.setLineDash([sx * 0.5, sx * 0.42]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.setLineDash([]);
  };
  const solid = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.strokeStyle = 'rgba(240,240,235,0.5)';
    ctx.lineWidth = Math.max(1.2, sx * 0.04);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };

  // N-S corridors: for every row, mark the cross-section of each vertical street.
  for (let y = 0; y < rows; y++) {
    let x = 0;
    while (x < cols) {
      if (!isRoad(x, y)) { x++; continue; }
      let e = x; while (e < cols && isRoad(e, y)) e++;
      const width = e - x;
      const vertical = vRun[y * cols + x] >= CORRIDOR && width <= 10;
      if (vertical && !isJunction(x, y)) {
        const mid = (x + e) / 2;
        dash(mid * sx, y * sy, mid * sx, (y + 1) * sy);
        solid((x + 0.28) * sx, y * sy, (x + 0.28) * sx, (y + 1) * sy);
        solid((e - 0.28) * sx, y * sy, (e - 0.28) * sx, (y + 1) * sy);
      }
      x = e;
    }
  }
  // E-W corridors: same, per column.
  for (let x = 0; x < cols; x++) {
    let y = 0;
    while (y < rows) {
      if (!isRoad(x, y)) { y++; continue; }
      let e = y; while (e < rows && isRoad(x, e)) e++;
      const height = e - y;
      const horizontal = hRun[y * cols + x] >= CORRIDOR && height <= 10;
      if (horizontal && !isJunction(x, y)) {
        const mid = (y + e) / 2;
        dash(x * sx, mid * sy, (x + 1) * sx, mid * sy);
        solid(x * sx, (y + 0.28) * sy, (x + 1) * sx, (y + 0.28) * sy);
        solid(x * sx, (e - 0.28) * sy, (x + 1) * sx, (e - 0.28) * sy);
      }
      y = e;
    }
  }

  // ── zebra crossings on every junction approach ──
  // Stripes run along the traffic direction and repeat across the road, phased
  // on a global grid so they line up continuously across the whole corridor.
  ctx.fillStyle = 'rgba(242,242,238,0.9)';
  const BAR = 0.3, STEP = 0.55;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!isRoad(x, y) || isJunction(x, y)) continue;
      const nextToJunction =
        isJunction(x + 1, y) || isJunction(x - 1, y) ||
        isJunction(x, y + 1) || isJunction(x, y - 1);
      if (!nextToJunction) continue;
      const verticalRoad = vRun[y * cols + x] >= hRun[y * cols + x];
      if (verticalRoad) {
        for (let g = Math.floor(x / STEP) * STEP; g < x + 1; g += STEP) {
          const bx = Math.max(g, x), bw = Math.min(g + BAR, x + 1) - bx;
          if (bw > 0.02) ctx.fillRect(bx * sx, (y + 0.16) * sy, bw * sx, 0.68 * sy);
        }
      } else {
        for (let g = Math.floor(y / STEP) * STEP; g < y + 1; g += STEP) {
          const by = Math.max(g, y), bh = Math.min(g + BAR, y + 1) - by;
          if (bh > 0.02) ctx.fillRect((x + 0.16) * sx, by * sy, 0.68 * sx, bh * sy);
        }
      }
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── Street furniture builders ────────────────────────────────────────────────

function makeLampPost(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.5, 6), toonMat(0x3c4048));
  pole.position.y = 1.25;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 5), toonMat(0x3c4048));
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.22, 2.45, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.18), toonMat(0x2a2e34));
  head.position.set(0.44, 2.4, 0);
  const bulb = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.05, 0.13),
    new THREE.MeshBasicMaterial({ color: 0xfff2c4 }),
  );
  bulb.position.set(0.44, 2.34, 0);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.16, 6), toonMat(0x2f333a));
  base.position.y = 0.08;
  g.add(pole, arm, head, bulb, base);
  return g;
}

function makeTrafficSignal(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), toonMat(0x4a4f57));
  pole.position.y = 1.1;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.46, 0.16), toonMat(0x22262c));
  box.position.y = 2.3;
  g.add(pole, box);
  const colors = [0xff4436, 0xffc23c, 0x44dd66];
  for (let i = 0; i < 3; i++) {
    const lamp = new THREE.Mesh(
      new THREE.CircleGeometry(0.05, 10),
      new THREE.MeshBasicMaterial({ color: colors[i] }),
    );
    lamp.position.set(0, 2.44 - i * 0.14, 0.085);
    g.add(lamp);
  }
  return g;
}

function makeBench(): THREE.Group {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.36), toonMat(0x8a5f38));
  seat.position.y = 0.34;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.32, 0.07), toonMat(0x8a5f38));
  back.position.set(0, 0.5, -0.15);
  g.add(seat, back);
  for (const x of [-0.4, 0.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.32), toonMat(0x3f434a));
    leg.position.set(x, 0.17, 0);
    g.add(leg);
  }
  return g;
}

function makePlanter(): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.36, 8), toonMat(0xa8a096));
  box.position.y = 0.18;
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 8), toonMat(0x4a3a2a));
  soil.position.y = 0.37;
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), toonMat(0x3f8f3a));
  bush.scale.y = 0.8;
  bush.position.y = 0.56;
  g.add(box, soil, bush);
  return g;
}

function makeHydrant(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.42, 8), toonMat(0xcc3b32));
  body.position.y = 0.21;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), toonMat(0xcc3b32));
  cap.position.y = 0.44;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), toonMat(0xb0322a));
  arm.rotation.z = Math.PI / 2;
  arm.position.y = 0.3;
  g.add(body, cap, arm);
  return g;
}

/** A hanging shop sign on a short bracket, coloured per building. */
function makeShopSign(color: number): THREE.Group {
  const g = new THREE.Group();
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.05), toonMat(0x3a3e45));
  bracket.position.set(0.16, 0, 0);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.72), toonMat(color));
  board.position.set(0.34, -0.16, 0);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.74), toonMat(0xf2ede2));
  trim.position.set(0.34, -0.34, 0);
  g.add(bracket, board, trim);
  return g;
}

// ── Main builder ─────────────────────────────────────────────────────────────

export function buildCityDetail(
  tileMap: number[][],
  spec: CityTileSpec,
  opts: { seed?: number; buildingPlots?: { x: number; y: number; w: number; h: number }[] } = {},
): CityDetailResult {
  const group = new THREE.Group();
  const rows = tileMap.length;
  const cols = tileMap[0]?.length ?? 0;
  const rnd = mulberry(opts.seed ?? 90210);

  const at = (x: number, y: number): number =>
    (x < 0 || y < 0 || x >= cols || y >= rows) ? -1 : tileMap[y][x];
  const isRoad = (x: number, y: number) =>
    isIn(spec.road, at(x, y)) || isIn(spec.bridge, at(x, y));
  const isWalk = (x: number, y: number) => isIn(spec.sidewalk, at(x, y));

  // ── 1. Road surface (one merged plane grid) ──
  const asphalt = asphaltTexture();
  asphalt.repeat.set(cols * 0.55, rows * 0.55);
  const roadMat = new THREE.MeshLambertMaterial({ map: asphalt });
  const roadPos: number[] = [], roadUv: number[] = [], roadIdx: number[] = [];
  let rq = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!isRoad(x, y)) continue;
      const b = rq * 4;
      roadPos.push(x, ROAD_Y, y, x + 1, ROAD_Y, y, x + 1, ROAD_Y, y + 1, x, ROAD_Y, y + 1);
      roadUv.push(x / cols, 1 - y / rows, (x + 1) / cols, 1 - y / rows,
                  (x + 1) / cols, 1 - (y + 1) / rows, x / cols, 1 - (y + 1) / rows);
      roadIdx.push(b, b + 2, b + 1, b, b + 3, b + 2);
      rq++;
    }
  }
  if (rq) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUv, 2));
    geo.setIndex(roadIdx);
    geo.computeVertexNormals();
    // Asphalt uses the global UV so the texture tiles continuously; markings
    // reuse the same geometry with a city-sized overlay texture.
    const road = new THREE.Mesh(geo, roadMat);
    group.add(road);

    const marks = markingsTexture(cols, rows, isRoad);
    const markMat = new THREE.MeshBasicMaterial({
      map: marks, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const markGeo = geo.clone();
    markGeo.translate(0, 0.004, 0);
    const markMesh = new THREE.Mesh(markGeo, markMat);
    markMesh.renderOrder = 2;
    group.add(markMesh);
  }

  // ── 2. Sidewalks: raised slab + curb faces ──
  const paving = pavingTexture();
  paving.repeat.set(cols * 0.5, rows * 0.5);
  const walkTopMat = new THREE.MeshLambertMaterial({ map: paving });
  const curbMat = new THREE.MeshLambertMaterial({ color: 0xd6d0c4 });

  const topPos: number[] = [], topUv: number[] = [], topIdx: number[] = [];
  const curbPos: number[] = [], curbIdx: number[] = [];
  let tq = 0, cq = 0;
  const pushCurb = (
    ax: number, az: number, bx: number, bz: number,
  ) => {
    const b = cq * 4;
    curbPos.push(ax, 0, az, bx, 0, bz, bx, WALK_TOP, bz, ax, WALK_TOP, az);
    curbIdx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    cq++;
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!isWalk(x, y)) continue;
      const b = tq * 4;
      topPos.push(x, WALK_TOP, y, x + 1, WALK_TOP, y, x + 1, WALK_TOP, y + 1, x, WALK_TOP, y + 1);
      topUv.push(x / cols, 1 - y / rows, (x + 1) / cols, 1 - y / rows,
                 (x + 1) / cols, 1 - (y + 1) / rows, x / cols, 1 - (y + 1) / rows);
      topIdx.push(b, b + 2, b + 1, b, b + 3, b + 2);
      tq++;
      // curb faces only where the pavement meets something lower (road/water)
      if (!isWalk(x, y - 1)) pushCurb(x + 1, y, x, y);
      if (!isWalk(x, y + 1)) pushCurb(x, y + 1, x + 1, y + 1);
      if (!isWalk(x - 1, y)) pushCurb(x, y, x, y + 1);
      if (!isWalk(x + 1, y)) pushCurb(x + 1, y + 1, x + 1, y);
    }
  }
  if (tq) {
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(topPos, 3));
    g2.setAttribute('uv', new THREE.Float32BufferAttribute(topUv, 2));
    g2.setIndex(topIdx);
    g2.computeVertexNormals();
    group.add(new THREE.Mesh(g2, walkTopMat));
  }
  if (cq) {
    const g3 = new THREE.BufferGeometry();
    g3.setAttribute('position', new THREE.Float32BufferAttribute(curbPos, 3));
    g3.setIndex(curbIdx);
    g3.computeVertexNormals();
    group.add(new THREE.Mesh(g3, curbMat));
  }

  // ── 3. Street furniture along kerb lines ──
  type Slot = { x: number; z: number; yaw: number; junction: boolean };
  const slots: Slot[] = [];
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (!isWalk(x, y)) continue;
      // face the adjacent road
      let yaw = 0, road = false;
      if (isRoad(x, y + 1)) { yaw = 0; road = true; }
      else if (isRoad(x, y - 1)) { yaw = Math.PI; road = true; }
      else if (isRoad(x + 1, y)) { yaw = -Math.PI / 2; road = true; }
      else if (isRoad(x - 1, y)) { yaw = Math.PI / 2; road = true; }
      if (!road) continue;
      const junction =
        (isRoad(x + 1, y) || isRoad(x - 1, y)) && (isRoad(x, y + 1) || isRoad(x, y - 1));
      slots.push({ x: x + 0.5, z: y + 0.5, yaw, junction });
    }
  }

  const place = (node: THREE.Object3D, s: Slot, inset: number) => {
    const o = node.clone(true);
    o.position.set(s.x - Math.sin(s.yaw) * inset, WALK_TOP, s.z - Math.cos(s.yaw) * inset);
    o.rotation.y = s.yaw;
    o.traverse(n => { n.userData.sharedGeo = true; n.userData.sharedMat = true; });
    group.add(o);
  };

  const lamp = makeLampPost();
  const signal = makeTrafficSignal();
  const bench = makeBench();
  const planter = makePlanter();
  const hydrant = makeHydrant();

  let sinceLamp = 99, sinceProp = 3;
  for (const s of slots) {
    sinceLamp++; sinceProp++;
    if (s.junction) {
      if (rnd() > 0.35) { place(signal, s, 0.18); sinceLamp = 0; }
      continue;
    }
    if (sinceLamp >= 7 && rnd() > 0.25) { place(lamp, s, 0.2); sinceLamp = 0; continue; }
    if (sinceProp >= 5) {
      const r = rnd();
      if (r > 0.72) { place(bench, s, 0.3); sinceProp = 0; }
      else if (r > 0.52) { place(planter, s, 0.28); sinceProp = 0; }
      else if (r > 0.44) { place(hydrant, s, 0.22); sinceProp = 0; }
    }
  }

  // ── 4. Shop signs on building frontages that face a street ──
  const signColors = [0xd8503f, 0x3f79d8, 0x2fa36a, 0xe0a13a, 0x8a4fd0, 0xd84f8f];
  for (const [i, p] of (opts.buildingPlots ?? []).entries()) {
    // find a frontage tile: an edge of the plot adjacent to a sidewalk
    const cand: { x: number; z: number; yaw: number }[] = [];
    for (let x = p.x; x < p.x + p.w; x++) {
      if (isWalk(x, p.y + p.h)) cand.push({ x: x + 0.5, z: p.y + p.h, yaw: 0 });
      if (isWalk(x, p.y - 1)) cand.push({ x: x + 0.5, z: p.y, yaw: Math.PI });
    }
    for (let y = p.y; y < p.y + p.h; y++) {
      if (isWalk(p.x + p.w, y)) cand.push({ x: p.x + p.w, z: y + 0.5, yaw: -Math.PI / 2 });
      if (isWalk(p.x - 1, y)) cand.push({ x: p.x, z: y + 0.5, yaw: Math.PI / 2 });
    }
    if (!cand.length) continue;
    const pick = cand[Math.floor(rnd() * cand.length)];
    const sign = makeShopSign(signColors[i % signColors.length]);
    sign.position.set(pick.x, 2.15, pick.z);
    sign.rotation.y = pick.yaw;
    sign.traverse(n => { n.userData.sharedGeo = true; n.userData.sharedMat = true; });
    group.add(sign);
  }

  return {
    group,
    update() { /* static geometry; lamps could pulse at night later */ },
  };
}
