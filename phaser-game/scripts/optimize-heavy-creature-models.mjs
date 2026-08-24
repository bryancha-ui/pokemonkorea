#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Loss-aware optimization for oversized static creature GLBs.
 *
 * - Targets only files larger than 16 MiB.
 * - Keeps 35% of mesh detail with a very small geometric error tolerance.
 * - Converts embedded textures to 1024px WebP and geometry to Draco.
 * - Validates scene structure, material/image/animation counts and bounds before
 *   atomically replacing a source file.
 * - Optionally copies every original to an out-of-tree recovery directory.
 *
 * Set GLTF_TRANSFORM_CLI to an installed @gltf-transform/cli entrypoint to avoid
 * npx. Without it, the script uses the pinned 4.2.1 CLI through npx.
 */

const root = path.resolve(import.meta.dirname, '..');
const modelDir = path.join(root, 'public/assets/models3d');
const reportPath = path.join(modelDir, 'heavy-model-optimization.json');
const manifestPath = path.join(modelDir, 'manifest.json');
const maxSourceBytes = 16 * 1024 * 1024;
const backupArg = process.argv.find(arg => arg.startsWith('--backup-dir='));
const backupDir = backupArg ? path.resolve(backupArg.slice('--backup-dir='.length)) : undefined;
const cliPath = process.env.GLTF_TRANSFORM_CLI;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readGlb(bytes, label) {
  if (bytes.length < 28 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) {
    throw new Error(`${label}: invalid GLB 2.0 header`);
  }
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  if (!json.scenes?.length || !json.nodes?.length || !json.meshes?.length) {
    throw new Error(`${label}: no renderable scene`);
  }
  const positionAccessors = [];
  for (const mesh of json.meshes) {
    for (const primitive of mesh.primitives ?? []) {
      const index = primitive.attributes?.POSITION;
      const accessor = Number.isInteger(index) ? json.accessors?.[index] : undefined;
      if (accessor?.min?.length === 3 && accessor?.max?.length === 3) positionAccessors.push(accessor);
    }
  }
  if (!positionAccessors.length) throw new Error(`${label}: no bounded POSITION accessor`);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let vertices = 0;
  for (const accessor of positionAccessors) {
    vertices += Number(accessor.count ?? 0);
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], accessor.min[axis]);
      max[axis] = Math.max(max[axis], accessor.max[axis]);
    }
  }
  return {
    json,
    min,
    max,
    vertices,
    meshes: json.meshes.length,
    nodes: json.nodes.length,
    materials: json.materials?.length ?? 0,
    images: json.images?.length ?? 0,
    animations: json.animations?.length ?? 0,
  };
}

function runCli(input, output) {
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
  const commandArgs = cliPath
    ? [cliPath, ...args]
    : ['--yes', '@gltf-transform/cli@4.2.1', ...args];
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`glTF Transform exited ${code}`)));
  });
}

function validateOptimized(before, after, beforeBytes, afterBytes, filename) {
  if (afterBytes.length >= beforeBytes.length) throw new Error(`${filename}: output did not shrink`);
  if (afterBytes.length > maxSourceBytes) throw new Error(`${filename}: output still exceeds 16 MiB`);
  for (const field of ['meshes', 'nodes', 'materials', 'images', 'animations']) {
    if (after[field] !== before[field]) {
      throw new Error(`${filename}: ${field} changed (${before[field]} -> ${after[field]})`);
    }
  }
  const required = new Set(after.json.extensionsRequired ?? after.json.extensionsUsed ?? []);
  if (!required.has('KHR_draco_mesh_compression')) throw new Error(`${filename}: Draco compression missing`);
  if (after.images > 0 && !required.has('EXT_texture_webp')) throw new Error(`${filename}: WebP textures missing`);
  for (let axis = 0; axis < 3; axis++) {
    const extent = Math.max(1e-6, before.max[axis] - before.min[axis]);
    const error = Math.max(
      Math.abs(after.min[axis] - before.min[axis]),
      Math.abs(after.max[axis] - before.max[axis]),
    ) / extent;
    if (error > 0.005) throw new Error(`${filename}: bounds changed by ${(error * 100).toFixed(3)}%`);
  }
  if (after.vertices < before.vertices * 0.25) throw new Error(`${filename}: excessive mesh simplification`);
}

const names = (await fs.readdir(modelDir))
  .filter(name => name.endsWith('.glb'))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
const targets = [];
for (const name of names) {
  const file = path.join(modelDir, name);
  if ((await fs.stat(file)).size > maxSourceBytes) targets.push(name);
}

if (backupDir) await fs.mkdir(backupDir, { recursive: true });
let report;
try {
  report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
} catch {
  report = { generatedAt: new Date().toISOString(), settings: {
    maxSourceMiB: 16, simplifyRatio: 0.35, simplifyError: 0.0005,
    textureSize: 1024, textureFormat: 'webp', geometryCompression: 'draco',
  }, models: {} };
}

for (const name of targets) {
  const source = path.join(modelDir, name);
  // glTF Transform chooses binary-vs-JSON output from the extension, so the
  // transactional temporary must itself end in `.glb`.
  const temporary = `${source}.optimizing.glb`;
  const beforeBytes = await fs.readFile(source);
  const before = readGlb(beforeBytes, name);
  if (backupDir) await fs.copyFile(source, path.join(backupDir, name));
  try {
    await runCli(source, temporary);
    const afterBytes = await fs.readFile(temporary);
    const after = readGlb(afterBytes, `${name}.optimized`);
    validateOptimized(before, after, beforeBytes, afterBytes, name);
    await fs.rename(temporary, source);
    report.models[name.replace(/\.glb$/, '')] = {
      beforeBytes: beforeBytes.length,
      afterBytes: afterBytes.length,
      reductionPercent: Number((100 - afterBytes.length / beforeBytes.length * 100).toFixed(2)),
      beforeVertices: before.vertices,
      afterVertices: after.vertices,
      beforeSha256: sha256(beforeBytes),
      afterSha256: sha256(afterBytes),
    };
  } catch (error) {
    try { await fs.unlink(temporary); } catch { /* no partial output */ }
    throw error;
  }
}

if (targets.length) {
  report.generatedAt = new Date().toISOString();
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

// The registry annotation is useful to audits and future cache policy even
// though the current renderer treats every registered creature as 3D-only.
const optimizedKeys = new Set(Object.keys(report.models ?? {}));
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
manifest.models = (manifest.models ?? []).map(entry => {
  const key = typeof entry === 'string' ? entry : entry.key;
  if (!optimizedKeys.has(key)) return entry;
  return { ...(typeof entry === 'string' ? { key } : entry), lightweight: true, optimized: true };
});
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const beforeTotal = Object.values(report.models).reduce((sum, model) => sum + model.beforeBytes, 0);
const afterTotal = Object.values(report.models).reduce((sum, model) => sum + model.afterBytes, 0);
console.log(JSON.stringify({
  optimized: targets.length,
  beforeMiB: Number((beforeTotal / 1024 / 1024).toFixed(2)),
  afterMiB: Number((afterTotal / 1024 / 1024).toFixed(2)),
  reductionPercent: beforeTotal ? Number((100 - afterTotal / beforeTotal * 100).toFixed(2)) : 0,
  backupDir: backupDir ?? null,
}, null, 2));
