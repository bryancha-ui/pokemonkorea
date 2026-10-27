#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Import only GLBs whose basename is an exact Pokémon name in this game's dex.
 * Generic generator exports such as `base_basic_shaded.glb` and alternates such
 * as `doribi2.glb` are deliberately ignored. Imported models are optimized in a
 * staging directory before any live asset is replaced, then enabled for both
 * the overworld companion and battle renderers through the shared manifest.
 */

const projectRoot = path.resolve(import.meta.dirname, '..');
const modelDir = path.join(projectRoot, 'public/assets/models3d');
const manifestPath = path.join(modelDir, 'manifest.json');
const optimizationPath = path.join(modelDir, 'heavy-model-optimization.json');
const importReportPath = path.join(modelDir, 'local-pokemon3dmodels.json');
const sourceArg = process.argv.slice(2).find(arg => !arg.startsWith('--'));
if (!sourceArg) throw new Error('Pass the pokemon3dmodels source directory as the first argument.');
const sourceRoot = path.resolve(sourceArg);
const backupArg = process.argv.find(arg => arg.startsWith('--backup-dir='));
const backupDir = backupArg ? path.resolve(backupArg.slice('--backup-dir='.length)) : undefined;
const cliPath = process.env.GLTF_TRANSFORM_CLI;
const maxOutputBytes = 8 * 1024 * 1024;

const exactAliases = new Map([
  ['honupup', 'honupup'], ['aroryong', 'aroryong'], ['hwidoribi', 'hwidoribi'],
  ['dynabeetle', 'dynabeetle'], ['squirrel2', 'squirrel2'], ['disguijar', 'disguijar'],
  ['woosa', 'woosa'], ['월식매', 'prowlnox'], ['doribi', 'doribi'],
  ['seuphaisin', 'seuphaisin'], ['groundzoome', 'groundzoome'],
  ['beardiedragon', 'beardiedragon'], ['woonsa', 'woonsa'], ['kelpoxin', 'kelpoxin'],
  ['dundunguri', 'dundunguri'], ['longroffe', 'longroffe'], ['zoltile', 'zoltile'],
  ['falcrush', 'falcrush'], ['kingfisher', 'kingfisher'], ['squirrel1', 'squirrel1'],
  ['idolena', 'idolena'], ['noeryong', 'noeryong'], ['glacewing', 'glacewing'],
  ['onnujjang', 'onnujang'], ['moransae', 'moransae'], ['honutomb', 'honutomb'],
  ['chattyscream', 'chattyscream'],
]);
const expectedKeys = new Set(exactAliases.values());

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

function readGlb(bytes, label) {
  if (bytes.length < 28 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) {
    throw new Error(`${label}: invalid GLB 2.0 header`);
  }
  const jsonLength = bytes.readUInt32LE(12);
  if (jsonLength <= 2 || 20 + jsonLength > bytes.length) throw new Error(`${label}: invalid JSON chunk`);
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength).replace(/\0+$/, ''));
  if (!json.scenes?.length || !json.nodes?.length || !json.meshes?.length) {
    throw new Error(`${label}: no renderable scene`);
  }
  const positionAccessors = [];
  for (const mesh of json.meshes) for (const primitive of mesh.primitives ?? []) {
    const index = primitive.attributes?.POSITION;
    const accessor = Number.isInteger(index) ? json.accessors?.[index] : undefined;
    if (accessor?.min?.length === 3 && accessor?.max?.length === 3) positionAccessors.push(accessor);
  }
  if (!positionAccessors.length) throw new Error(`${label}: no bounded POSITION accessor`);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let vertices = 0;
  for (const accessor of positionAccessors) {
    vertices += Number(accessor.count ?? 0);
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], accessor.min[axis]);
      max[axis] = Math.max(max[axis], accessor.max[axis]);
    }
  }
  return {
    json, min, max, vertices,
    meshes: json.meshes.length,
    materials: json.materials?.length ?? 0,
    images: json.images?.length ?? 0,
    animations: json.animations?.length ?? 0,
  };
}

async function walk(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) files.push(full);
  }
  return files;
}

function runOptimizer(input, output) {
  const args = [
    'optimize', input, output,
    '--compress', 'draco',
    '--texture-compress', 'webp',
    '--texture-size', '1024',
    '--simplify', 'true',
    '--simplify-ratio', '0.35',
    '--simplify-error', '0.0005',
  ];
  const command = cliPath ? process.execPath : 'npx';
  const commandArgs = cliPath ? [cliPath, ...args] : ['--yes', '@gltf-transform/cli@4.2.1', ...args];
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: projectRoot, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`glTF Transform exited ${code}`)));
  });
}

function validateOutput(before, after, beforeBytes, afterBytes, key) {
  if (afterBytes.length >= beforeBytes.length) throw new Error(`${key}: optimized output did not shrink`);
  if (afterBytes.length > maxOutputBytes) throw new Error(`${key}: optimized output exceeds 8 MiB`);
  if (after.animations !== before.animations) throw new Error(`${key}: animations changed during optimization`);
  if (!after.meshes || !after.materials) throw new Error(`${key}: mesh or material was lost`);
  const required = new Set(after.json.extensionsRequired ?? after.json.extensionsUsed ?? []);
  if (!required.has('KHR_draco_mesh_compression')) throw new Error(`${key}: Draco compression missing`);
  if (after.images && !required.has('EXT_texture_webp')) throw new Error(`${key}: WebP textures missing`);
  for (let axis = 0; axis < 3; axis++) {
    const extent = Math.max(1e-6, before.max[axis] - before.min[axis]);
    const error = Math.max(
      Math.abs(after.min[axis] - before.min[axis]),
      Math.abs(after.max[axis] - before.max[axis]),
    ) / extent;
    if (error > 0.012) throw new Error(`${key}: bounds changed by ${(error * 100).toFixed(3)}%`);
  }
  if (after.vertices < before.vertices * 0.2) throw new Error(`${key}: excessive mesh simplification`);
}

if (sourceRoot === path.parse(sourceRoot).root) {
  throw new Error('Pass the pokemon3dmodels source directory as the first argument.');
}
const sourceStat = await fs.stat(sourceRoot).catch(() => null);
if (!sourceStat?.isDirectory()) throw new Error(`Source directory not found: ${sourceRoot}`);

const discovered = await walk(sourceRoot);
const selected = new Map();
const ignored = [];
for (const file of discovered.sort((a, b) => a.localeCompare(b, 'en'))) {
  const basename = path.basename(file, path.extname(file)).normalize('NFC').toLowerCase();
  const key = exactAliases.get(basename);
  if (!key) { ignored.push(path.relative(sourceRoot, file)); continue; }
  if (selected.has(key)) throw new Error(`Duplicate exact Pokémon model for ${key}`);
  selected.set(key, file);
}
const missing = [...expectedKeys].filter(key => !selected.has(key));
if (missing.length) throw new Error(`Missing exact Pokémon models: ${missing.join(', ')}`);

const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pokemon3dmodels-import-'));
const records = {};
const queue = [...selected.entries()];
let cursor = 0;
async function worker() {
  while (cursor < queue.length) {
    const [key, source] = queue[cursor++];
    const output = path.join(stagingDir, `${key}.glb`);
    const beforeBytes = await fs.readFile(source);
    const before = readGlb(beforeBytes, `${key}.source`);
    await runOptimizer(source, output);
    const afterBytes = await fs.readFile(output);
    const after = readGlb(afterBytes, `${key}.optimized`);
    validateOutput(before, after, beforeBytes, afterBytes, key);
    records[key] = {
      sourceFile: path.relative(sourceRoot, source).split(path.sep).join('/').normalize('NFC'),
      beforeBytes: beforeBytes.length,
      afterBytes: afterBytes.length,
      reductionPercent: Number((100 - afterBytes.length / beforeBytes.length * 100).toFixed(2)),
      beforeVertices: before.vertices,
      afterVertices: after.vertices,
      beforeSha256: sha256(beforeBytes),
      afterSha256: sha256(afterBytes),
    };
  }
}

try {
  await Promise.all([worker(), worker()]);
  if (backupDir) await fs.mkdir(backupDir, { recursive: true });
  for (const key of [...expectedKeys].sort()) {
    const target = path.join(modelDir, `${key}.glb`);
    if (backupDir) await fs.copyFile(target, path.join(backupDir, `${key}.glb`));
    const temporary = `${target}.importing.glb`;
    await fs.copyFile(path.join(stagingDir, `${key}.glb`), temporary);
    await fs.rename(temporary, target);
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  manifest.models = (manifest.models ?? []).map(entry => {
    const key = String(typeof entry === 'string' ? entry : entry.key).toLowerCase();
    if (!expectedKeys.has(key)) return entry;
    const next = { ...(typeof entry === 'string' ? { key } : entry) };
    delete next.generated;
    delete next.proceduralVolumetric;
    delete next.companionOnly;
    next.lightweight = true;
    next.optimized = true;
    next.source = 'local-pokemon3dmodels';
    return next;
  });
  const manifestTemporary = `${manifestPath}.importing`;
  await fs.writeFile(manifestTemporary, `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.rename(manifestTemporary, manifestPath);

  let optimization;
  try { optimization = JSON.parse(await fs.readFile(optimizationPath, 'utf8')); }
  catch { optimization = { settings: {}, models: {} }; }
  optimization.generatedAt = new Date().toISOString();
  optimization.models = { ...(optimization.models ?? {}), ...records };
  await fs.writeFile(optimizationPath, `${JSON.stringify(optimization, null, 2)}\n`);

  const report = {
    importedAt: new Date().toISOString(),
    sourceCollection: path.basename(sourceRoot),
    selectionRule: 'exact Pokédex basename only; generic and suffixed GLBs excluded',
    imported: [...expectedKeys].sort(),
    ignoredGlbs: ignored.map(file => file.normalize('NFC')).sort(),
    models: Object.fromEntries(Object.entries(records).sort(([a], [b]) => a.localeCompare(b))),
  };
  await fs.writeFile(importReportPath, `${JSON.stringify(report, null, 2)}\n`);

  const beforeTotal = Object.values(records).reduce((sum, model) => sum + model.beforeBytes, 0);
  const afterTotal = Object.values(records).reduce((sum, model) => sum + model.afterBytes, 0);
  console.log(JSON.stringify({
    imported: expectedKeys.size,
    ignored: ignored.length,
    beforeMiB: Number((beforeTotal / 1024 / 1024).toFixed(2)),
    afterMiB: Number((afterTotal / 1024 / 1024).toFixed(2)),
    reductionPercent: Number((100 - afterTotal / beforeTotal * 100).toFixed(2)),
    backupDir: backupDir ?? null,
  }, null, 2));
} finally {
  await fs.rm(stagingDir, { recursive: true, force: true });
}
