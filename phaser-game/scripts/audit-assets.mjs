import { promises as fs } from 'node:fs';
import path from 'node:path';

const failures = [];
const props = JSON.parse(await fs.readFile('public/assets/models3d/props.json', 'utf8'));
for (const prop of props.props ?? []) {
  if (/^https?:/i.test(prop.url ?? '')) failures.push(`remote prop URL: ${prop.id}`);
  const model = prop.url || `assets/models3d/${prop.id}.glb`;
  if (/\.(?:glb|gltf|obj)$/i.test(model)) {
    try { await fs.access(path.join('public', decodeURIComponent(model))); }
    catch { failures.push(`missing prop asset: ${prop.id} -> ${model}`); }
  }
}

const bundle = JSON.parse(await fs.readFile('public/assets/data/pokemon-offline.json', 'utf8'));
for (const entry of Object.values(bundle.pokemon ?? {})) {
  try { await fs.access(path.join('public', entry.spriteUrl)); }
  catch { failures.push(`missing official sprite: ${entry.id}`); }
}
const sourceBundle = await fs.readFile('src/data/pokemon-offline.json', 'utf8');
const publicBundle = await fs.readFile('public/assets/data/pokemon-offline.json', 'utf8');
if (sourceBundle !== publicBundle) failures.push('embedded and public offline Pokémon bundles differ');

console.log(JSON.stringify({ offlineSpecies: Object.keys(bundle.pokemon ?? {}).length, props: props.props?.length ?? 0, failures }, null, 2));
if (failures.length) process.exitCode = 1;
