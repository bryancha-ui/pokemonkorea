import fs from 'node:fs';
import path from 'node:path';

const cacheDir = path.join(process.env.HOME, 'Library/Caches/Google/Chrome/Default/Cache/Cache_Data');
const repo = '/Users/hyungjucha/Documents/PokemonKorea/phaser-game';
const props = JSON.parse(fs.readFileSync(path.join(repo,'public/assets/models3d/props.json'),'utf8'));

// uuid -> building id, from props.json remote entries
const uuidToId = new Map();
for (const p of props.props) {
  if (!p.url) continue;
  const m = p.url.match(/([0-9a-f-]{36})\.glb/i);
  if (m) uuidToId.set(m[1], p.id);
}

const GLTF = Buffer.from('glTF');
const files = fs.readdirSync(cacheDir);
const found = new Map(); // id -> buffer

for (const f of files) {
  const fp = path.join(cacheDir, f);
  let buf;
  try { buf = fs.readFileSync(fp); } catch { continue; }
  // find a cloudfront glb uuid key in this entry
  const txt = buf.toString('latin1');
  const km = txt.match(/d3u0tzju9qaucj\.cloudfront\.net\/[0-9a-f-]+\/([0-9a-f-]{36})\.glb/i);
  if (!km) continue;
  const uuid = km[1];
  const id = uuidToId.get(uuid);
  if (!id) continue;
  // locate glTF magic and read GLB total length (bytes 8..11 LE)
  const gi = buf.indexOf(GLTF);
  if (gi < 0) { console.log(`[skip] ${id}: key present but no glTF body (maybe compressed)`); continue; }
  const total = buf.readUInt32LE(gi + 8);
  if (total < 1000 || gi + total > buf.length) { console.log(`[skip] ${id}: bad length ${total}`); continue; }
  const glb = buf.slice(gi, gi + total);
  // keep the largest if duplicates
  if (!found.has(id) || found.get(id).length < glb.length) found.set(id, glb);
}

console.log('Recovered', found.size, 'of', uuidToId.size, 'remote building/vehicle models');
const outDir = path.join(repo,'public/assets/models3d');
for (const [id, glb] of found) {
  fs.writeFileSync(path.join(outDir, id+'.glb'), glb);
  console.log(`  ✓ ${id}.glb  ${(glb.length/1024/1024).toFixed(2)} MB`);
}
const missing = [...uuidToId.values()].filter(id => !found.has(id));
if (missing.length) console.log('MISSING:', missing.join(', '));
