/**
 * Generate a compact local GLB for every in-game Pokémon that does not already
 * have a hand-authored model. Generated assets are lightweight, fully closed
 * low-poly sculptures derived from the species artwork: the silhouette and
 * colours are retained as vertex data while an inward distance field creates
 * rounded body volume. No 2D texture card is embedded or referenced.
 *
 * Run through scripts/run-audit.mjs so the TypeScript Pokédex can be imported:
 *   npm run generate:companion-glbs
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { POKEDEX } from '../src/data/Pokedex';
import offlineBundleJson from '../src/data/pokemon-offline.json';

type ManifestEntry = string | {
  key: string;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  scale?: number;
  lightweight?: boolean;
  generated?: boolean;
  proceduralVolumetric?: boolean;
};

interface PixelImage {
  width: number;
  height: number;
  rgba: Uint8Array;
}

interface SpeciesSource {
  key: string;
  spriteUrl: string;
}

const PROJECT = process.cwd();
const PUBLIC = path.join(PROJECT, 'public');
const MODEL_DIR = path.join(PUBLIC, 'assets/models3d');
const MANIFEST_FILE = path.join(MODEL_DIR, 'manifest.json');
const MAX_GRID_EDGE = 52;
const ALPHA_THRESHOLD = 24;

function canonicalKey(key: string): string {
  return key.toLowerCase().replace(/^(wild|enemy|foe|ally|player|te|gym)-/, '').replace(/^api-/, '');
}

function entryKey(entry: ManifestEntry): string {
  return canonicalKey(typeof entry === 'string' ? entry : entry.key);
}

function isGenerated(entry: ManifestEntry): boolean {
  return typeof entry !== 'string' && entry.generated === true;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decode the PNG formats shipped by the project without adding a 20 MB image
 * dependency. Supports the 8-bit RGBA custom art and bit-packed indexed
 * PokéAPI sprites (1/2/4/8 bit), plus RGB/grayscale fallbacks. */
function decodePng(bytes: Buffer): PixelImage {
  if (bytes.length < 33 || bytes.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error('not a PNG');
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const interlace = bytes[28];
  if (!width || !height || interlace !== 0) throw new Error('unsupported interlaced/empty PNG');

  let palette: Buffer | undefined;
  let transparency: Buffer | undefined;
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') transparency = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += length + 12;
  }

  const channels = colorType === 6 ? 4 : colorType === 4 ? 2 : colorType === 2 ? 3 : 1;
  if (![0, 2, 3, 4, 6].includes(colorType)) throw new Error(`unsupported PNG colour type ${colorType}`);
  if (colorType !== 3 && bitDepth !== 8) throw new Error(`unsupported PNG depth ${bitDepth}`);
  if (colorType === 3 && ![1, 2, 4, 8].includes(bitDepth)) throw new Error(`unsupported indexed depth ${bitDepth}`);
  const bitsPerPixel = channels * bitDepth;
  const stride = Math.ceil(width * bitsPerPixel / 8);
  const filterBytes = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const raw = inflateSync(Buffer.concat(idat));
  const scan = new Uint8Array(stride * height);
  let input = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[input++];
    const row = y * stride;
    const previous = row - stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[input++];
      const left = x >= filterBytes ? scan[row + x - filterBytes] : 0;
      const up = y > 0 ? scan[previous + x] : 0;
      const upperLeft = y > 0 && x >= filterBytes ? scan[previous + x - filterBytes] : 0;
      if (filter === 0) scan[row + x] = value;
      else if (filter === 1) scan[row + x] = (value + left) & 255;
      else if (filter === 2) scan[row + x] = (value + up) & 255;
      else if (filter === 3) scan[row + x] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) scan[row + x] = (value + paeth(left, up, upperLeft)) & 255;
      else throw new Error(`unsupported PNG filter ${filter}`);
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  const indexedSample = (row: number, x: number): number => {
    if (bitDepth === 8) return scan[row + x];
    const perByte = 8 / bitDepth;
    const packed = scan[row + Math.floor(x / perByte)];
    const shift = (perByte - 1 - (x % perByte)) * bitDepth;
    return (packed >> shift) & ((1 << bitDepth) - 1);
  };
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    for (let x = 0; x < width; x++) {
      const out = (y * width + x) * 4;
      if (colorType === 6) {
        const source = row + x * 4;
        rgba.set(scan.subarray(source, source + 4), out);
      } else if (colorType === 4) {
        const source = row + x * 2;
        rgba[out] = rgba[out + 1] = rgba[out + 2] = scan[source];
        rgba[out + 3] = scan[source + 1];
      } else if (colorType === 2) {
        const source = row + x * 3;
        rgba[out] = scan[source]; rgba[out + 1] = scan[source + 1]; rgba[out + 2] = scan[source + 2];
        rgba[out + 3] = 255;
      } else if (colorType === 0) {
        rgba[out] = rgba[out + 1] = rgba[out + 2] = scan[row + x];
        rgba[out + 3] = 255;
      } else {
        const index = indexedSample(row, x);
        rgba[out] = palette?.[index * 3] ?? 255;
        rgba[out + 1] = palette?.[index * 3 + 1] ?? 255;
        rgba[out + 2] = palette?.[index * 3 + 2] ?? 255;
        rgba[out + 3] = transparency?.[index] ?? 255;
      }
    }
  }
  return { width, height, rgba };
}

function align4(value: number): number {
  return (value + 3) & ~3;
}

function buildVolumetricGlb(image: PixelImage): Buffer {
  const { width: W, height: H, rgba } = image;
  let tx0 = W, ty0 = H, tx1 = -1, ty1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (rgba[(y * W + x) * 4 + 3] <= ALPHA_THRESHOLD) continue;
      if (x < tx0) tx0 = x;
      if (x > tx1) tx1 = x;
      if (y < ty0) ty0 = y;
      if (y > ty1) ty1 = y;
    }
  }
  // Fully opaque legacy artwork remains supported, but current custom Pokémon
  // art is transparent and therefore follows its exact authored silhouette.
  if (tx1 < 0) { tx0 = 0; ty0 = 0; tx1 = W - 1; ty1 = H - 1; }
  const tw = tx1 - tx0 + 1, th = ty1 - ty0 + 1;
  const cell = Math.max(1, Math.ceil(Math.max(tw, th) / MAX_GRID_EDGE));
  const gw = Math.ceil(tw / cell), gh = Math.ceil(th / cell);
  const occupied = new Uint8Array(gw * gh);
  const colours = new Float32Array(gw * gh * 3);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const px0 = tx0 + gx * cell, py0 = ty0 + gy * cell;
      const px1 = Math.min(tx0 + tw, px0 + cell), py1 = Math.min(ty0 + th, py0 + cell);
      let opaque = 0, alphaWeight = 0, red = 0, green = 0, blue = 0;
      const total = Math.max(1, (px1 - px0) * (py1 - py0));
      for (let y = py0; y < py1; y++) {
        for (let x = px0; x < px1; x++) {
          const index = (y * W + x) * 4;
          const alpha = rgba[index + 3];
          if (alpha <= 32) continue;
          const weight = alpha / 255;
          opaque++; alphaWeight += weight;
          red += rgba[index] * weight;
          green += rgba[index + 1] * weight;
          blue += rgba[index + 2] * weight;
        }
      }
      const index = gy * gw + gx;
      occupied[index] = opaque / total >= 0.055 ? 1 : 0;
      if (alphaWeight) {
        colours[index * 3] = red / alphaWeight / 255;
        colours[index * 3 + 1] = green / alphaWeight / 255;
        colours[index * 3 + 2] = blue / alphaWeight / 255;
      }
    }
  }

  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < gw && y < gh && !!occupied[y * gw + x];
  const distance = new Uint16Array(gw * gh);
  const queue: number[] = [];
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const index = gy * gw + gx;
      if (!occupied[index]) continue;
      if (!filled(gx - 1, gy) || !filled(gx + 1, gy) || !filled(gx, gy - 1) || !filled(gx, gy + 1)) {
        distance[index] = 1;
        queue.push(index);
      }
    }
  }

  // Breadth-first distance from the outline gives large body regions more
  // depth while ears, tails and thin limbs naturally remain slimmer.
  let cursor = 0;
  let maxDistance = 1;
  while (cursor < queue.length) {
    const index = queue[cursor++];
    const gx = index % gw, gy = Math.floor(index / gw);
    const nextDistance = distance[index] + 1;
    for (const [nx, ny] of [[gx - 1, gy], [gx + 1, gy], [gx, gy - 1], [gx, gy + 1]]) {
      if (!filled(nx, ny)) continue;
      const neighbor = ny * gw + nx;
      if (distance[neighbor]) continue;
      distance[neighbor] = nextDistance;
      maxDistance = Math.max(maxDistance, nextDistance);
      queue.push(neighbor);
    }
  }

  const shapeEdge = Math.max(1, Math.min(tw, th));
  const halfDepth = new Float32Array(gw * gh);
  let maxHalfDepth = 0;
  for (let index = 0; index < occupied.length; index++) {
    if (!occupied[index]) continue;
    const roundness = Math.sqrt(Math.max(1, distance[index]) / maxDistance);
    halfDepth[index] = shapeEdge * (0.035 + roundness * 0.15);
    maxHalfDepth = Math.max(maxHalfDepth, halfDepth[index]);
  }
  const cornerDepth = (cx: number, cy: number): number => {
    let total = 0, count = 0;
    for (const [gx, gy] of [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]]) {
      if (!filled(gx, gy)) continue;
      total += halfDepth[gy * gw + gx];
      count++;
    }
    return count ? total / count : shapeEdge * 0.035;
  };

  type Point3 = [number, number, number];
  type Colour3 = [number, number, number];
  const positions: number[] = [], normals: number[] = [], vertexColours: number[] = [];
  const surfaceIndices: number[] = [], sideIndices: number[] = [];
  const crossNormal = (a: Point3, b: Point3, c: Point3): Point3 => {
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
    const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
    const x = aby * acz - abz * acy;
    const y = abz * acx - abx * acz;
    const z = abx * acy - aby * acx;
    const length = Math.max(0.00001, Math.hypot(x, y, z));
    return [x / length, y / length, z / length];
  };
  const addQuad = (
    indices: number[], points: [Point3, Point3, Point3, Point3], colour: Colour3,
    forcedNormal?: Point3,
  ) => {
    const start = positions.length / 3;
    const normal = forcedNormal ?? crossNormal(points[0], points[1], points[2]);
    for (const point of points) {
      positions.push(...point);
      normals.push(...normal);
      vertexColours.push(...colour);
    }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const index = gy * gw + gx;
      if (!occupied[index]) continue;
      const x0 = gx * cell, x1 = Math.min(tw, (gx + 1) * cell);
      const top = th - gy * cell, bottom = th - Math.min(th, (gy + 1) * cell);
      const dTL = cornerDepth(gx, gy), dTR = cornerDepth(gx + 1, gy);
      const dBL = cornerDepth(gx, gy + 1), dBR = cornerDepth(gx + 1, gy + 1);
      const colour: Colour3 = [colours[index * 3], colours[index * 3 + 1], colours[index * 3 + 2]];
      const rear: Colour3 = [colour[0] * 0.84, colour[1] * 0.84, colour[2] * 0.84];
      const side: Colour3 = [colour[0] * 0.7, colour[1] * 0.7, colour[2] * 0.7];

      addQuad(surfaceIndices, [
        [x0, bottom, dBL], [x1, bottom, dBR], [x1, top, dTR], [x0, top, dTL],
      ], colour);
      addQuad(surfaceIndices, [
        [x1, bottom, -dBR], [x0, bottom, -dBL], [x0, top, -dTL], [x1, top, -dTR],
      ], rear);
      if (!filled(gx, gy - 1)) addQuad(sideIndices, [
        [x1, top, dTR], [x1, top, -dTR], [x0, top, -dTL], [x0, top, dTL],
      ], side, [0, 1, 0]);
      if (!filled(gx, gy + 1)) addQuad(sideIndices, [
        [x0, bottom, dBL], [x0, bottom, -dBL], [x1, bottom, -dBR], [x1, bottom, dBR],
      ], side, [0, -1, 0]);
      if (!filled(gx - 1, gy)) addQuad(sideIndices, [
        [x0, top, dTL], [x0, top, -dTL], [x0, bottom, -dBL], [x0, bottom, dBL],
      ], side, [-1, 0, 0]);
      if (!filled(gx + 1, gy)) addQuad(sideIndices, [
        [x1, bottom, dBR], [x1, bottom, -dBR], [x1, top, -dTR], [x1, top, dTR],
      ], side, [1, 0, 0]);
    }
  }

  // Centre X and keep feet at Y=0. GlbModels applies one final height
  // normalisation at runtime, so every generated species shares stable pivots.
  for (let i = 0; i < positions.length; i += 3) positions[i] -= tw / 2;
  const vertexCount = positions.length / 3;
  const IndexArray = vertexCount <= 65_535 ? Uint16Array : Uint32Array;
  const indexComponentType = vertexCount <= 65_535 ? 5123 : 5125;
  // Normalised byte attributes keep 109 procedural sculptures inexpensive on
  // mobile without changing their silhouette or visible colour range.
  const packedNormals = Int8Array.from(normals, value => Math.round(Math.max(-1, Math.min(1, value)) * 127));
  const packedColours = Uint8Array.from(vertexColours, value => Math.round(Math.max(0, Math.min(1, value)) * 255));
  const arrays: Array<Float32Array | Int8Array | Uint8Array | Uint16Array | Uint32Array> = [
    new Float32Array(positions), packedNormals, packedColours,
    new IndexArray(surfaceIndices), new IndexArray(sideIndices),
  ];
  const binaryOffsets: number[] = [];
  let binaryLength = 0;
  for (const array of arrays) { binaryLength = align4(binaryLength); binaryOffsets.push(binaryLength); binaryLength += array.byteLength; }
  const binary = Buffer.alloc(align4(binaryLength));
  arrays.forEach((array, index) => Buffer.from(array.buffer, array.byteOffset, array.byteLength).copy(binary, binaryOffsets[index]));
  const minX = -tw / 2, maxX = tw / 2;
  const json = {
    asset: { version: '2.0', generator: 'Pokemon Korea volumetric companion generator' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'PokemonCompanionSculpture', mesh: 0 }],
    meshes: [{ name: 'PokemonCompanionSculpture', extras: { proceduralVolumetric: true }, primitives: [
      { attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 3, material: 0 },
      { attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 }, indices: 4, material: 1 },
    ] }],
    materials: [
      {
        name: 'sculpted_colour', doubleSided: false,
        pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.78 },
      },
      {
        name: 'sculpted_sides', doubleSided: false,
        pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.92 },
      },
    ],
    buffers: [{ byteLength: binary.length }],
    bufferViews: arrays.map((array, index) => ({
      buffer: 0,
      byteOffset: binaryOffsets[index],
      byteLength: array.byteLength,
      target: index < 3 ? 34962 : 34963,
    })),
    accessors: [
      { bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3', min: [minX, 0, -maxHalfDepth], max: [maxX, th, maxHalfDepth] },
      { bufferView: 1, componentType: 5120, normalized: true, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5121, normalized: true, count: vertexColours.length / 3, type: 'VEC3' },
      { bufferView: 3, componentType: indexComponentType, count: surfaceIndices.length, type: 'SCALAR' },
      { bufferView: 4, componentType: indexComponentType, count: sideIndices.length, type: 'SCALAR' },
    ],
  };
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const jsonLength = align4(jsonBytes.length);
  const totalLength = 12 + 8 + jsonLength + 8 + binary.length;
  const glb = Buffer.alloc(totalLength, 0x20);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(totalLength, 8);
  glb.writeUInt32LE(jsonLength, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  jsonBytes.copy(glb, 20);
  const binHeader = 20 + jsonLength;
  glb.writeUInt32LE(binary.length, binHeader);
  glb.writeUInt32LE(0x004e4942, binHeader + 4);
  binary.copy(glb, binHeader + 8);
  return glb;
}

async function main(): Promise<void> {
  const offline = offlineBundleJson as unknown as {
    pokemon: Record<string, { id: number; spriteUrl: string }>;
  };
  const species = new Map<string, SpeciesSource>();
  for (const entry of POKEDEX) {
    species.set(canonicalKey(entry.key), { key: canonicalKey(entry.key), spriteUrl: entry.spriteUrl });
  }
  for (const entry of Object.values(offline.pokemon)) {
    const key = String(entry.id);
    if (!species.has(key)) species.set(key, { key, spriteUrl: entry.spriteUrl });
  }

  const manifest = JSON.parse(await fs.readFile(MANIFEST_FILE, 'utf8')) as { models?: ManifestEntry[] };
  const oldEntries = manifest.models ?? [];
  const authoredEntries = oldEntries.filter(entry => !isGenerated(entry));
  const authoredByKey = new Map(authoredEntries.map(entry => [entryKey(entry), entry]));
  const generatedEntries: ManifestEntry[] = [];
  const failures: string[] = [];
  let generated = 0, preserved = 0;

  await fs.mkdir(MODEL_DIR, { recursive: true });
  for (const source of [...species.values()].sort((a, b) => a.key.localeCompare(b.key, 'en'))) {
    const modelFile = path.join(MODEL_DIR, `${source.key}.glb`);
    if (authoredByKey.has(source.key)) {
      try { await fs.access(modelFile); preserved++; continue; }
      catch { authoredByKey.delete(source.key); }
    }
    const spriteFile = path.join(PUBLIC, source.spriteUrl.replace(/^\/+/, ''));
    try {
      const bytes = await fs.readFile(spriteFile);
      const image = decodePng(bytes);
      await fs.writeFile(modelFile, buildVolumetricGlb(image));
      generatedEntries.push({ key: source.key, lightweight: true, generated: true, proceduralVolumetric: true });
      generated++;
    } catch (error) {
      failures.push(`${source.key}: ${source.spriteUrl} (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  // Keep non-Pokémon authored objects such as npc_hwangeum and every orientation
  // correction exactly as they were. Replace stale generated records only.
  const stillAuthored = authoredEntries.filter(entry => authoredByKey.has(entryKey(entry)) || !species.has(entryKey(entry)));
  const models = [...stillAuthored, ...generatedEntries];
  await fs.writeFile(MANIFEST_FILE, `${JSON.stringify({ models }, null, 2)}\n`);

  console.log(JSON.stringify({ species: species.size, authored: preserved, generated, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
}

await main();
