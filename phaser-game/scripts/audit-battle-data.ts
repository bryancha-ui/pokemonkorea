import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pokemon, type MoveData, type PokemonData } from '../src/battle/Pokemon';
import type { PokemonType } from '../src/battle/TypeChart';
import { customForm } from '../src/data/CustomBattle';
import { mergeLearnset } from '../src/data/Learnsets';
import { POKEDEX } from '../src/data/Pokedex';
import { findForm } from '../src/data/StarterData';
import { actsBefore, battleWeather, setBattleWeather } from '../src/systems/AbilitySystem';

const failures: string[] = [];
const warnings: string[] = [];
const typeSet = new Set<string>([
  'normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] satisfies PokemonType[]);
const levels = [1, 5, 15, 30, 50, 75, 100];

function fail(message: string): void { failures.push(message); }
function warn(message: string): void { warnings.push(message); }

function validMove(key: string, move: MoveData): void {
  if (!move?.name?.trim()) fail(`${key}: move has no name`);
  if (!typeSet.has(move.type)) fail(`${key}/${move.name}: invalid type ${String(move.type)}`);
  if (!['physical', 'special', 'status'].includes(move.category)) fail(`${key}/${move.name}: invalid category ${String(move.category)}`);
  if (!Number.isFinite(move.power) || move.power < 0) fail(`${key}/${move.name}: invalid power ${move.power}`);
  if (!Number.isFinite(move.accuracy) || move.accuracy <= 0 || move.accuracy > 100) fail(`${key}/${move.name}: invalid accuracy ${move.accuracy}`);
  if (!Number.isFinite(move.pp) || move.pp <= 0) fail(`${key}/${move.name}: invalid PP ${move.pp}`);
  if (move.category === 'status' && move.power !== 0) fail(`${key}/${move.name}: status move has power ${move.power}`);
}

function testDamage(key: string, data: PokemonData, move: MoveData): void {
  if (move.power <= 0) return;
  const targetData: PokemonData = {
    id: 1, name: 'Audit Target', type1: 'normal', baseHp: 90, baseAtk: 80,
    baseDef: 90, baseSpAtk: 80, baseSpDef: 90, baseSpd: 80, spriteUrl: '',
  };
  const user = new Pokemon(data, 50, [move]);
  const target = new Pokemon(targetData, 50, [{ name: 'Tackle', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35 }]);
  const result = target.takeDamage(user.moves[0], user);
  if (!Number.isFinite(result.dmg) || result.dmg < 0 || !Number.isFinite(target.hp)) {
    fail(`${key}/${move.name}: non-finite damage outcome`);
  }
  user.useMove(user.moves[0]);
  if (user.moves[0].pp < 0 || user.moves[0].pp >= move.pp) fail(`${key}/${move.name}: PP did not decrement safely`);
}

for (const entry of POKEDEX) {
  const starterForm = findForm(entry.key);
  const form = starterForm
    ? { data: starterForm.data, moves: starterForm.startingMoves }
    : customForm(entry.key);
  if (!form) {
    // api-* records are hydrated from PokeAPI at runtime. Every authored local
    // species, however, must have a deterministic offline battle form.
    if (!entry.key.startsWith('api-')) warn(`${entry.key}: no local custom battle form`);
    continue;
  }
  if (!typeSet.has(form.data.type1)) fail(`${entry.key}: invalid primary type ${form.data.type1}`);
  if (form.data.type2 && !typeSet.has(form.data.type2)) fail(`${entry.key}: invalid secondary type ${form.data.type2}`);
  for (const stat of ['baseHp', 'baseAtk', 'baseDef', 'baseSpAtk', 'baseSpDef', 'baseSpd'] as const) {
    if (!Number.isFinite(form.data[stat]) || form.data[stat] <= 0) fail(`${entry.key}: invalid ${stat}`);
  }
  try {
    await access(resolve('public', form.data.spriteUrl));
  } catch {
    fail(`${entry.key}: missing sprite ${form.data.spriteUrl}`);
  }
  for (const level of levels) {
    const moves = mergeLearnset(form.moves, entry.key, form.data.type1, form.data.type2, level);
    if (moves.length < 1 || moves.length > 4) fail(`${entry.key}@${level}: invalid move count ${moves.length}`);
    const names = new Set<string>();
    for (const move of moves) {
      validMove(entry.key, move);
      const normalized = move.name.toLowerCase();
      if (names.has(normalized)) fail(`${entry.key}@${level}: duplicate ${move.name}`);
      names.add(normalized);
      testDamage(entry.key, form.data, move);
    }
    const battler = new Pokemon(form.data, level, moves);
    if (![battler.maxHp, battler.hp, battler.atk, battler.def, battler.spAtk, battler.spDef, battler.spd].every(Number.isFinite)) {
      fail(`${entry.key}@${level}: non-finite battle stats`);
    }
    if (!battler.moves.length) fail(`${entry.key}@${level}: selection creates a Pokémon with no moves`);
  }
}

// Exercise cross-cutting weather and turn-order helpers with real Pokémon.
const weatherA = new Pokemon({ id: 998, name: 'Weather A', type1: 'fire', baseHp: 80, baseAtk: 80, baseDef: 80, baseSpAtk: 80, baseSpDef: 80, baseSpd: 80, spriteUrl: '' }, 50,
  [{ name: 'Sunny Day', type: 'fire', category: 'status', power: 0, accuracy: 100, pp: 5 }]);
const weatherB = new Pokemon({ id: 999, name: 'Weather B', type1: 'ice', baseHp: 80, baseAtk: 80, baseDef: 80, baseSpAtk: 80, baseSpDef: 80, baseSpd: 80, spriteUrl: '' }, 50,
  [{ name: 'Snowscape', type: 'ice', category: 'status', power: 0, accuracy: 100, pp: 5 }]);
setBattleWeather(weatherA, weatherB, 'sun');
if (battleWeather(weatherA, weatherB) !== 'sun') fail('field weather did not persist for both combatants');
actsBefore(weatherA, weatherA.moves[0], weatherB, weatherB.moves[0]);

// Every supported weather-producing ability must resolve to the same canonical
// state consumed by both battle rules and the 3D weather mirror.
const weatherAbility = (name: string, ability: string) => new Pokemon({
  id: 1000 + name.length, name, type1: 'normal', ability,
  baseHp: 80, baseAtk: 80, baseDef: 80, baseSpAtk: 80, baseSpDef: 80, baseSpd: 80,
  spriteUrl: '',
}, 50, [{ name: 'Tackle', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35 }]);
const neutralWeatherMon = weatherAbility('Neutral Weather', 'Run Away');
const abilityWeatherCases = [
  ['Drizzle', 'rain'],
  ['Drought', 'sun'],
  ['Sand Stream', 'sand'],
  ['Snow Warning', 'snow'],
] as const;
for (const [ability, expected] of abilityWeatherCases) {
  const source = weatherAbility(`${ability} Source`, ability);
  if (battleWeather(source, neutralWeatherMon) !== expected) {
    fail(`${ability} did not resolve to ${expected} weather`);
  }
}
const cloudNine = weatherAbility('Cloud Nine Source', 'Cloud Nine');
const sandStream = weatherAbility('Sand Stream Source', 'Sand Stream');
setBattleWeather(sandStream, cloudNine, 'sand');
if (battleWeather(sandStream, cloudNine) !== 'clear') fail('Cloud Nine did not suppress active field weather');

console.log(JSON.stringify({
  species: POKEDEX.length,
  customForms: POKEDEX.filter(entry => !!findForm(entry.key) || !!customForm(entry.key)).length,
  levelsTested: levels.length,
  warnings,
  failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
