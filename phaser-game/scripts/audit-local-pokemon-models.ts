import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const failures: string[] = [];
const expect = (condition: unknown, message: string) => { if (!condition) failures.push(message); };
const expected = [
  'aroryong', 'beardiedragon', 'chattyscream', 'disguijar', 'doribi', 'dundunguri',
  'dynabeetle', 'falcrush', 'glacewing', 'groundzoome', 'honupup', 'honutomb',
  'hwidoribi', 'idolena', 'kelpoxin', 'kingfisher', 'longroffe', 'moransae',
  'noeryong', 'onnujang', 'prowlnox', 'seuphaisin', 'squirrel1', 'squirrel2',
  'woonsa', 'woosa', 'zoltile',
] as const;

const manifest = JSON.parse(readFileSync('public/assets/models3d/manifest.json', 'utf8')) as {
  models?: Array<string | {
    key: string;
    source?: string;
    lightweight?: boolean;
    optimized?: boolean;
    generated?: boolean;
    proceduralVolumetric?: boolean;
    companionOnly?: boolean;
  }>;
};
const report = JSON.parse(readFileSync('public/assets/models3d/local-pokemon3dmodels.json', 'utf8')) as {
  imported?: string[];
  ignoredGlbs?: string[];
  models?: Record<string, { afterBytes?: number; afterSha256?: string; sourceFile?: string }>;
};
const byKey = new Map((manifest.models ?? []).map(entry => [
  typeof entry === 'string' ? entry : entry.key,
  entry,
]));

expect(expected.length === 27, 'local Pokémon model allow-list changed unexpectedly');
expect(JSON.stringify([...(report.imported ?? [])].sort()) === JSON.stringify([...expected].sort()),
  'local model import report does not contain exactly the approved 27 Pokémon');
expect((report.ignoredGlbs ?? []).includes('doribi/doribi2.glb'),
  'the non-canonical Doribi alternate was not explicitly excluded');
expect((report.ignoredGlbs ?? []).every(file => file.endsWith('/doribi2.glb') || /\/base_basic_(?:shaded|pbr)\.glb$/i.test(file)),
  'a Pokémon-named GLB was unexpectedly left out of the import');
expect(!existsSync('public/assets/models3d/doribi2.glb')
  && !existsSync('public/assets/models3d/base_basic_shaded.glb'),
  'a generic or suffixed source GLB leaked into runtime assets');

for (const key of expected) {
  const entry = byKey.get(key);
  expect(typeof entry !== 'string' && entry?.source === 'local-pokemon3dmodels',
    `${key} is not registered as a local pokemon3dmodels asset`);
  if (typeof entry !== 'string' && entry) {
    expect(entry.lightweight === true && entry.optimized === true,
      `${key} is not registered as a mobile-optimized model`);
    expect(entry.generated !== true && entry.proceduralVolumetric !== true && entry.companionOnly !== true,
      `${key} is still restricted to the rough companion-only presentation`);
  }

  const file = `public/assets/models3d/${key}.glb`;
  expect(existsSync(file), `${key}.glb is missing`);
  if (!existsSync(file)) continue;
  const bytes = readFileSync(file);
  expect(bytes.length < 8 * 1024 * 1024, `${key}.glb exceeds the 8 MiB mobile import budget`);
  expect(bytes.length === report.models?.[key]?.afterBytes,
    `${key}.glb no longer matches the audited import size`);
  expect(createHash('sha256').update(bytes).digest('hex') === report.models?.[key]?.afterSha256,
    `${key}.glb no longer matches the audited import digest`);
  expect(report.models?.[key]?.sourceFile?.toLowerCase().endsWith('.glb'),
    `${key} has no source file provenance`);

  const jsonLength = bytes.readUInt32LE(12);
  const payload = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString().replace(/\0+$/, '')) as {
    extensionsRequired?: string[];
    extensionsUsed?: string[];
    images?: Array<{ mimeType?: string; uri?: string }>;
    meshes?: unknown[];
  };
  const extensions = new Set([...(payload.extensionsUsed ?? []), ...(payload.extensionsRequired ?? [])]);
  expect((payload.meshes?.length ?? 0) > 0, `${key}.glb has no renderable mesh`);
  expect(extensions.has('KHR_draco_mesh_compression'), `${key}.glb is not Draco compressed`);
  expect(extensions.has('EXT_texture_webp'), `${key}.glb does not use WebP textures`);
  expect((payload.images ?? []).every(image => image.mimeType === 'image/webp' && !image.uri),
    `${key}.glb contains an external or non-WebP texture`);
}

const glbModels = readFileSync('src/engine3d/GlbModels.ts', 'utf8');
const battleMirror = readFileSync('src/engine3d/BattleMirror.ts', 'utf8');
const companion = readFileSync('src/engine3d/OverworldCompanion.ts', 'utf8');
expect(battleMirror.includes('!isCompanionOnlyModel(modelKey)'),
  'battle rendering no longer respects the shared model eligibility flag');
expect(companion.includes('const loaded = getModel(key)') && companion.includes('if (loaded) this.attachModel(key, loaded)'),
  'the companion system no longer consumes the shared imported GLBs');
expect(glbModels.includes("const MANIFEST_VERSION = '2026-10-26a'"),
  'browsers can retain the pre-import model registry');

console.log(JSON.stringify({
  importedModels: expected.length,
  ignoredSourceGlbs: report.ignoredGlbs?.length ?? 0,
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
