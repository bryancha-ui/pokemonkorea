#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const csvBase = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const csvNames = [
  'pokemon.csv', 'pokemon_stats.csv', 'pokemon_types.csv', 'pokemon_abilities.csv',
  'pokemon_species_names.csv', 'ability_names.csv', 'languages.csv',
  'abilities.csv', 'types.csv',
];

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function rows(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines.shift().split(',');
  return lines.map(line => {
    // These PokeAPI tables contain identifiers/numbers only, so a compact CSV
    // parser is sufficient and avoids adding a build dependency.
    const cells = line.split(',');
    return Object.fromEntries(header.map((key, index) => [key, cells[index] ?? '']));
  });
}

async function sourceFiles(dir) {
  const result = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await sourceFiles(full));
    else if (entry.name.endsWith('.ts')) result.push(full);
  }
  return result;
}

const csv = Object.fromEntries(await Promise.all(csvNames.map(async name =>
  [name, rows(await fetchText(`${csvBase}/${name}`))])));
const knownPokemonIds = new Set(csv['pokemon.csv'].map(row => Number(row.id)));
const ids = new Set();
// Non-battle set dressing that still uses official Pokémon art.
[130, 235].forEach(id => ids.add(id));
for (const file of await sourceFiles(path.join(root, 'src'))) {
  const text = await fs.readFile(file, 'utf8');
  for (const match of text.matchAll(/\bid\s*:\s*(\d+)/g)) {
    const id = Number(match[1]);
    if (knownPokemonIds.has(id)) ids.add(id);
  }
  for (const match of text.matchAll(/fetchPokemon\(\s*(\d+)/g)) {
    const id = Number(match[1]);
    if (knownPokemonIds.has(id)) ids.add(id);
  }
  for (const match of text.matchAll(/\bapi\(\s*(\d+)/g)) {
    const id = Number(match[1]);
    if (knownPokemonIds.has(id)) ids.add(id);
  }
  for (const match of text.matchAll(/sprites\/pokemon\/(?:other\/home\/)?(\d+)\.png/g)) {
    const id = Number(match[1]);
    if (knownPokemonIds.has(id)) ids.add(id);
  }
}

const pokemon = new Map(csv['pokemon.csv'].map(row => [Number(row.id), row]));
const typeNames = new Map(csv['types.csv'].map(row => [Number(row.id), row.identifier]));
const abilityNames = new Map(csv['abilities.csv'].map(row => [Number(row.id), row.identifier]));
const languageNames = new Map(csv['languages.csv'].map(row => [Number(row.id), row.identifier]));
const statsByPokemon = new Map();
for (const row of csv['pokemon_stats.csv']) {
  const target = statsByPokemon.get(Number(row.pokemon_id)) ?? {};
  target[Number(row.stat_id)] = Number(row.base_stat);
  statsByPokemon.set(Number(row.pokemon_id), target);
}
const typesByPokemon = new Map();
for (const row of csv['pokemon_types.csv']) {
  const target = typesByPokemon.get(Number(row.pokemon_id)) ?? [];
  target[Number(row.slot) - 1] = typeNames.get(Number(row.type_id));
  typesByPokemon.set(Number(row.pokemon_id), target);
}
const abilityByPokemon = new Map();
for (const row of csv['pokemon_abilities.csv']) {
  if (row.is_hidden !== '0' || abilityByPokemon.has(Number(row.pokemon_id))) continue;
  abilityByPokemon.set(Number(row.pokemon_id), abilityNames.get(Number(row.ability_id)));
}

const spriteDir = path.join(root, 'public/assets/pokemon-official');
const dataDir = path.join(root, 'public/assets/data');
await fs.mkdir(spriteDir, { recursive: true });
await fs.mkdir(dataDir, { recursive: true });

const output = {};
for (const id of [...ids].sort((a, b) => a - b)) {
  const row = pokemon.get(id);
  const stat = statsByPokemon.get(id);
  const types = typesByPokemon.get(id);
  if (!row || !stat || !types?.[0]) continue;
  output[id] = {
    id,
    name: row.identifier,
    ability: abilityByPokemon.get(id),
    type1: types[0],
    type2: types[1] || undefined,
    baseHp: stat[1] ?? 45,
    baseAtk: stat[2] ?? 45,
    baseDef: stat[3] ?? 45,
    baseSpAtk: stat[4] ?? 45,
    baseSpDef: stat[5] ?? 45,
    baseSpd: stat[6] ?? 45,
    spriteUrl: `assets/pokemon-official/${id}.png`,
    heightDm: Number(row.height) || undefined,
  };
}
const speciesNames = {};
for (const row of csv['pokemon_species_names.csv']) {
  const speciesId = Number(row.pokemon_species_id);
  if (!output[speciesId]) continue;
  const language = languageNames.get(Number(row.local_language_id));
  if (language === 'ko' || language === 'ja-Hrkt') {
    speciesNames[speciesId] ??= {};
    speciesNames[speciesId][language === 'ko' ? 'nameKo' : 'nameJa'] = row.name;
  }
}
const usedAbilities = new Set(Object.values(output).map(entry => entry.ability).filter(Boolean));
const localizedAbilities = {};
for (const row of csv['ability_names.csv']) {
  const identifier = abilityNames.get(Number(row.ability_id));
  if (!identifier || !usedAbilities.has(identifier)) continue;
  const language = languageNames.get(Number(row.local_language_id));
  if (language === 'ko' || language === 'ja-Hrkt') {
    localizedAbilities[identifier] ??= {};
    localizedAbilities[identifier][language === 'ko' ? 'nameKo' : 'nameJa'] = row.name;
  }
}
const bundle = JSON.stringify({ version: 2, pokemon: output, species: speciesNames, abilities: localizedAbilities });
await fs.writeFile(path.join(dataDir, 'pokemon-offline.json'), bundle);
await fs.writeFile(path.join(root, 'src/data/pokemon-offline.json'), bundle);

const queue = Object.keys(output).map(Number);
let downloaded = 0;
async function worker() {
  while (queue.length) {
    const id = queue.shift();
    const target = path.join(spriteDir, `${id}.png`);
    try { await fs.access(target); downloaded++; continue; } catch { /* download */ }
    const response = await fetch(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`);
    if (!response.ok) throw new Error(`Missing official sprite ${id}`);
    await fs.writeFile(target, Buffer.from(await response.arrayBuffer()));
    downloaded++;
  }
}
await Promise.all(Array.from({ length: 12 }, () => worker()));
console.log(JSON.stringify({ species: Object.keys(output).length, sprites: downloaded, output: 'public/assets/data/pokemon-offline.json' }));
