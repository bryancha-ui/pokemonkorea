#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Vendor the high-detail GLBs used for the official/PokeAPI species that are
 * actually present in this game. Runtime code never calls the remote service:
 * downloads happen here at development time and every model is served from the
 * same GitHub Pages deployment as the game.
 *
 * Source repository notice: the upstream project states that the Pokémon model
 * rights remain with Nintendo / Creatures / GAME FREAK. This script records the
 * exact source and digest for auditability; it does not claim an open license.
 */

const root = path.resolve(import.meta.dirname, '..');
const modelDir = path.join(root, 'public/assets/models3d');
const manifestFile = path.join(modelDir, 'manifest.json');
const provenanceFile = path.join(modelDir, 'pokemon3d-sources.json');
const sourceBase = 'https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt/regular';
const sourceRepo = 'https://github.com/Pokemon-3D-api/assets';
const sourceNotice = 'Models are identified upstream as property of Nintendo / Creatures Inc. / GAME FREAK Inc.';
const force = process.argv.includes('--force');
const concurrency = 8;
const maxModelBytes = 16 * 1024 * 1024;

function keyOf(entry) {
  return String(typeof entry === 'string' ? entry : entry.key).toLowerCase();
}

function parseGlb(bytes, id) {
  if (bytes.length < 28 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) {
    throw new Error(`${id}: invalid GLB 2.0 header`);
  }
  if (bytes.length > maxModelBytes) throw new Error(`${id}: model exceeds 16 MB mobile budget`);
  const jsonLength = bytes.readUInt32LE(12);
  if (jsonLength <= 2 || 20 + jsonLength > bytes.length) throw new Error(`${id}: invalid GLB JSON chunk`);
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  if (!json.meshes?.length || !json.nodes?.length) throw new Error(`${id}: GLB has no renderable scene`);
  return {
    extensions: json.extensionsRequired ?? json.extensionsUsed ?? [],
    meshes: json.meshes.length,
    animations: json.animations?.length ?? 0,
  };
}

async function fetchWithRetry(url, id) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const declared = Number(response.headers.get('content-length') ?? 0);
      if (declared > maxModelBytes) throw new Error('declared size exceeds mobile budget');
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 350));
    }
  }
  throw new Error(`${id}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

const offline = JSON.parse(await fs.readFile(path.join(root, 'src/data/pokemon-offline.json'), 'utf8'));
const ids = Object.keys(offline.pokemon ?? {}).map(Number).sort((a, b) => a - b);
const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
const oldModels = manifest.models ?? [];
const oldByKey = new Map(oldModels.map(entry => [keyOf(entry), entry]));
const provenance = { sourceRepo, rightsNotice: sourceNotice, models: {} };
const queue = [...ids];
const successes = [];
const failures = [];
let downloaded = 0;
let reused = 0;
let totalBytes = 0;

await fs.mkdir(modelDir, { recursive: true });

async function worker() {
  while (queue.length) {
    const id = queue.shift();
    const key = String(id);
    const target = path.join(modelDir, `${key}.glb`);
    const url = `${sourceBase}/${key}.glb`;
    const previous = oldByKey.get(key);
    try {
      let bytes;
      if (!force && typeof previous !== 'string' && previous?.source === 'pokemon-3d-api') {
        bytes = await fs.readFile(target);
        parseGlb(bytes, id);
        reused++;
      } else {
        bytes = await fetchWithRetry(url, id);
        parseGlb(bytes, id);
        const temporary = `${target}.download`;
        await fs.writeFile(temporary, bytes);
        await fs.rename(temporary, target);
        downloaded++;
      }
      const parsed = parseGlb(bytes, id);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      totalBytes += bytes.length;
      successes.push({ key, lightweight: true, source: 'pokemon-3d-api' });
      provenance.models[key] = {
        url,
        sha256,
        bytes: bytes.length,
        meshes: parsed.meshes,
        animations: parsed.animations,
        extensions: parsed.extensions,
      };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `${id}: ${String(error)}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

// A failed upstream model keeps its already-working local shell and manifest
// record. Successful official species replace only their numeric entries; all
// custom Pokémon and hand-authored models remain byte-for-byte unrelated.
const successKeys = new Set(successes.map(entry => entry.key));
const retained = oldModels.filter(entry => !successKeys.has(keyOf(entry)));
manifest.models = [...retained, ...successes].sort((a, b) => keyOf(a).localeCompare(keyOf(b), 'en', { numeric: true }));
await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(provenanceFile, `${JSON.stringify(provenance, null, 2)}\n`);

console.log(JSON.stringify({
  requested: ids.length,
  installed: successes.length,
  downloaded,
  reused,
  totalMiB: Number((totalBytes / 1024 / 1024).toFixed(2)),
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
