import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { POKEDEX } from '../src/data/Pokedex';
import offlineBundleJson from '../src/data/pokemon-offline.json';
import { appendFollowerPoint, followerPointBehind, type FollowPoint } from '../src/engine3d/FollowerPath';

const failures: string[] = [];
const expect = (value: boolean, message: string) => { if (!value) failures.push(message); };
const close = (a: number, b: number) => Math.abs(a - b) < 0.0001;

const straight: FollowPoint[] = [];
for (let x = 0; x <= 4; x++) appendFollowerPoint(straight, { x, z: 0 });
const straightTarget = followerPointBehind(straight, 1.5, { x: 0, z: 0 });
expect(close(straightTarget.x, 2.5) && close(straightTarget.z, 0), 'straight path follow distance was incorrect');

const corner: FollowPoint[] = [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }];
const cornerTarget = followerPointBehind(corner, 3, { x: 0, z: 0 });
expect(close(cornerTarget.x, 1) && close(cornerTarget.z, 0), 'corner path was cut instead of retraced');

const jitter: FollowPoint[] = [{ x: 0, z: 0 }];
appendFollowerPoint(jitter, { x: 0.01, z: 0.01 });
expect(jitter.length === 1, 'sub-pixel player jitter created breadcrumbs');

const bounded: FollowPoint[] = [];
for (let x = 0; x < 140; x++) appendFollowerPoint(bounded, { x, z: 0 }, 0.01, 32);
expect(bounded.length === 32 && bounded[0].x === 108, 'breadcrumb history was not bounded');

const canonical = (key: string) => key.toLowerCase()
  .replace(/^(wild|enemy|foe|ally|player|te|api|gym|owned)-/, '');
const offline = offlineBundleJson as unknown as { pokemon: Record<string, { id: number }> };
const expectedModels = new Set([
  ...POKEDEX.map(entry => canonical(entry.key)),
  ...Object.values(offline.pokemon).map(entry => String(entry.id)),
]);
const manifestPath = path.join(process.cwd(), 'public/assets/models3d/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  models?: Array<string | {
    key: string;
    lightweight?: boolean;
    generated?: boolean;
    proceduralVolumetric?: boolean;
    optimized?: boolean;
    source?: string;
  }>;
};
const registered = new Map((manifest.models ?? []).map(entry => [
  canonical(typeof entry === 'string' ? entry : entry.key), entry,
]));
for (const key of expectedModels) {
  expect(registered.has(key), `Pokémon has no GLB manifest entry: ${key}`);
  const file = path.join(process.cwd(), `public/assets/models3d/${key}.glb`);
  expect(existsSync(file), `Pokémon GLB file is missing: ${key}.glb`);
  if (!existsSync(file)) continue;
  const glb = readFileSync(file);
  expect(glb.length >= 20 && glb.readUInt32LE(0) === 0x46546c67 && glb.readUInt32LE(4) === 2,
    `invalid GLB 2.0 header: ${key}.glb`);
  const manifestEntry = registered.get(key);
  if (typeof manifestEntry !== 'string' && manifestEntry?.generated && glb.length >= 20) {
    try {
      const jsonLength = glb.readUInt32LE(12);
      const payload = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength)) as {
        asset?: { generator?: string };
        images?: unknown[];
        textures?: unknown[];
        meshes?: Array<{
          extras?: { proceduralVolumetric?: boolean };
          primitives?: Array<{ attributes?: { POSITION?: number } }>;
        }>;
        accessors?: Array<{ min?: number[]; max?: number[] }>;
      };
      expect(payload.asset?.generator === 'Pokemon Korea volumetric companion generator',
        `generated Pokémon still uses the legacy flat shell: ${key}.glb`);
      expect((payload.images?.length ?? 0) === 0 && (payload.textures?.length ?? 0) === 0,
        `generated Pokémon still depends on 2D artwork at runtime: ${key}.glb`);
      expect((payload.meshes?.[0]?.primitives?.length ?? 0) === 2,
        `generated GLB is missing sculpted surface/side geometry: ${key}.glb`);
      expect(payload.meshes?.[0]?.extras?.proceduralVolumetric === true,
        `generated GLB is not marked as volumetric: ${key}.glb`);
      const positionAccessorIndex = payload.meshes?.[0]?.primitives?.[0]?.attributes?.POSITION;
      const bounds = positionAccessorIndex === undefined ? undefined : payload.accessors?.[positionAccessorIndex];
      const xSpan = (bounds?.max?.[0] ?? 0) - (bounds?.min?.[0] ?? 0);
      const ySpan = (bounds?.max?.[1] ?? 0) - (bounds?.min?.[1] ?? 0);
      const zSpan = (bounds?.max?.[2] ?? 0) - (bounds?.min?.[2] ?? 0);
      expect(zSpan >= Math.max(0.001, Math.min(xSpan, ySpan) * 0.1),
        `generated GLB has insufficient body depth: ${key}.glb`);
    } catch (error) {
      failures.push(`generated GLB JSON is invalid: ${key}.glb (${String(error)})`);
    }
  }
}
const generatedCount = [...registered.values()].filter(entry => typeof entry !== 'string' && entry.generated).length;
expect(generatedCount > 0, 'generated lightweight companion GLBs were not registered');
expect([...registered.values()].filter(entry => typeof entry !== 'string' && entry.generated)
  .every(entry => typeof entry !== 'string' && entry.lightweight === true && entry.proceduralVolumetric === true),
  'a generated GLB is not marked mobile-lightweight and volumetric');

const officialIds = Object.keys(offline.pokemon);
let highDetailOfficial = 0;
for (const id of officialIds) {
  const entry = registered.get(id);
  if (typeof entry === 'string' || entry?.source !== 'pokemon-3d-api') continue;
  highDetailOfficial++;
  expect(entry.lightweight === true, `official high-detail GLB is mobile-gated: ${id}.glb`);
  try {
    const glb = readFileSync(path.join(process.cwd(), `public/assets/models3d/${id}.glb`));
    const jsonLength = glb.readUInt32LE(12);
    const payload = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength)) as {
      extensionsRequired?: string[];
      images?: Array<{ uri?: string; bufferView?: number }>;
      meshes?: unknown[];
    };
    expect((payload.meshes?.length ?? 0) > 0, `official high-detail GLB has no meshes: ${id}.glb`);
    expect(payload.extensionsRequired?.includes('KHR_draco_mesh_compression') === true,
      `official high-detail GLB is not Draco optimized: ${id}.glb`);
    expect((payload.images ?? []).every(image => image.bufferView !== undefined && !image.uri),
      `official high-detail GLB has an external texture: ${id}.glb`);
  } catch (error) {
    failures.push(`official high-detail GLB is invalid: ${id}.glb (${String(error)})`);
  }
}
expect(highDetailOfficial === officialIds.length,
  `PokeAPI species still use sprite shells: ${officialIds.length - highDetailOfficial}`);

// Presentation policy regression guard: a registered Pokémon must never flash
// or fall back to 2D in battle, scripted overworld appearances, or the lead
// companion system. Only a manifest-confirmed absence may retain original art.
const glbModelsSource = readFileSync(path.join(process.cwd(), 'src/engine3d/GlbModels.ts'), 'utf8');
const battleMirrorSource = readFileSync(path.join(process.cwd(), 'src/engine3d/BattleMirror.ts'), 'utf8');
const overworldMirrorSource = readFileSync(path.join(process.cwd(), 'src/engine3d/OverworldMirror.ts'), 'utf8');
const companionSource = readFileSync(path.join(process.cwd(), 'src/engine3d/OverworldCompanion.ts'), 'utf8');
expect(glbModelsSource.includes('return manifest?.has(normalizeKey(key)) === true'),
  'registered creature models are still device-gated into 2D');
expect(battleMirrorSource.includes('private reserve3DOnlySlot'),
  'battle mirror has no registered-model 3D-only state');
expect(battleMirrorSource.includes('manifestReady() && !combatant.glbKey'),
  'battle mirror does not wait for the manifest before choosing 2D');
expect(battleMirrorSource.includes('private use2DTrainer'),
  'trainers without a working GLB do not retain their 2D portrait');
expect(overworldMirrorSource.includes('manifestReady() && !hasModel(t.creatureKey)'),
  'scripted overworld creatures can expose 2D before model intent is known');
expect(companionSource.includes('manifestReady() && !this.fallbackRequested'),
  'lead companion can expose 2D before model intent is known');
expect(!companionSource.includes('buildSpriteShell3D'),
  'a GLB-less companion is still extruded into pseudo-3D instead of retaining flat art');

const oversizedModels = [...registered.keys()].filter(key => {
  const file = path.join(process.cwd(), `public/assets/models3d/${key}.glb`);
  return existsSync(file) && readFileSync(file).length > 16 * 1024 * 1024;
});
expect(oversizedModels.length === 0,
  `registered creature GLBs exceed the mobile budget: ${oversizedModels.join(', ')}`);
const optimizedEntries = [...registered.values()].filter(entry =>
  typeof entry !== 'string' && entry.optimized === true);
expect(optimizedEntries.length >= 19 && optimizedEntries.every(entry =>
  typeof entry !== 'string' && entry.lightweight === true),
  'optimized heavy-model batch is missing from the lightweight registry');
try {
  const optimization = JSON.parse(readFileSync(
    path.join(process.cwd(), 'public/assets/models3d/heavy-model-optimization.json'), 'utf8')) as {
    models?: Record<string, { afterBytes?: number }>;
  };
  expect(Object.keys(optimization.models ?? {}).length >= 19,
    'heavy-model optimization report is incomplete');
  for (const [key, metadata] of Object.entries(optimization.models ?? {})) {
    const file = path.join(process.cwd(), `public/assets/models3d/${key}.glb`);
    const bytes = readFileSync(file);
    expect(bytes.length === metadata.afterBytes,
      `optimized model no longer matches its report: ${key}.glb`);
    const jsonLength = bytes.readUInt32LE(12);
    const payload = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) as {
      extensionsRequired?: string[];
      images?: Array<{ mimeType?: string }>;
    };
    expect(payload.extensionsRequired?.includes('KHR_draco_mesh_compression') === true,
      `optimized model lost Draco compression: ${key}.glb`);
    expect((payload.images ?? []).every(image => image.mimeType === 'image/webp'),
      `optimized model contains a non-WebP texture: ${key}.glb`);
  }
} catch (error) {
  failures.push(`heavy-model optimization report is invalid (${String(error)})`);
}

// 새콤마마 previously used the generic textured sprite shell. Its dedicated
// model must stay genuinely volumetric and texture-free on future regenerations.
const secommammaEntry = registered.get('secommamma');
expect(typeof secommammaEntry !== 'string' && secommammaEntry?.lightweight === true,
  'Secommamma dedicated model is not mobile-lightweight');
expect(typeof secommammaEntry !== 'string' && secommammaEntry?.generated !== true,
  'Secommamma regressed to the generic generated sprite shell');
try {
  const file = path.join(process.cwd(), 'public/assets/models3d/secommamma.glb');
  const glb = readFileSync(file);
  const jsonLength = glb.readUInt32LE(12);
  const payload = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength)) as {
    asset?: { generator?: string };
    images?: unknown[];
    meshes?: unknown[];
    nodes?: Array<{ name?: string; mesh?: number }>;
  };
  const meshNodes = (payload.nodes ?? []).filter(node => node.mesh !== undefined);
  const meshNames = new Set(meshNodes.map(node => node.name));
  expect((payload.images?.length ?? 0) === 0, 'Secommamma still embeds a 2D sprite texture');
  expect((payload.meshes?.length ?? 0) >= 18 && meshNodes.length >= 50,
    'Secommamma has too few volumetric body parts');
  for (const required of ['BerryBody', 'Head', 'Torso', 'CrownLeaf', 'EyeRim_-1', 'EyeRim_1']) {
    expect(meshNames.has(required), `Secommamma dedicated mesh is missing: ${required}`);
  }
} catch (error) {
  failures.push(`Secommamma dedicated GLB is invalid (${String(error)})`);
}

console.log(JSON.stringify({
  rulesChecked: 33,
  coveredPokemon: expectedModels.size,
  generatedGlbs: generatedCount,
  highDetailOfficial,
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
