/**
 * Shared utilities for rebuilding a Pokemon object from a PartyEntry
 * so battle scenes can send in any party member, not just the starter.
 */
import Phaser from 'phaser';
import { Pokemon, PokemonData, MoveData } from '../battle/Pokemon';
import { PokemonType } from '../battle/TypeChart';
import { PartySystem, PartyEntry } from './PartySystem';
import { findForm } from '../data/StarterData';
import { DISGUIJAR_DATA, DISGUIJAR_MOVES } from '../data/CustomPokemon';
import { customForm } from '../data/CustomBattle';
import { mergeLearnset } from '../data/Learnsets';
import { TM_MOVE_DATA } from '../data/TMs';
import { applySwitchOutAbility, transferBattleWeather } from './AbilitySystem';

const TAUGHT_MOVE_DATA: Record<string, MoveData> = {
  ...TM_MOVE_DATA,
  fly: { name: 'Fly', type: 'flying', category: 'physical', power: 90, accuracy: 95, pp: 15 },
};

/** Fold taught TM/HM moves into the real battle set. Status moves are first-class
 *  battle actions now, and Fly retains its two-turn behavior through MoveEffects. */
function foldTaughtMoves(moves: MoveData[], entry: PartyEntry): MoveData[] {
  // A player-curated moveset (from choosing which move to forget for a TM) wins outright.
  if (entry.battleMoves && entry.battleMoves.length) {
    const safe = entry.battleMoves.filter(move => move && typeof move.name === 'string'
      && typeof move.type === 'string' && ['physical', 'special', 'status'].includes(move.category)
      && Number.isFinite(move.power) && Number.isFinite(move.accuracy) && move.accuracy > 0
      && Number.isFinite(move.pp) && move.pp > 0).slice(0, 4);
    if (safe.length) return safe;
  }
  const have = new Set(moves.map(m => m.name.toLowerCase()));
  const taught = (entry.moves ?? [])
    .map(n => TAUGHT_MOVE_DATA[n.toLowerCase()])
    .filter((m): m is MoveData => !!m && !have.has(m.name.toLowerCase()));
  if (taught.length === 0) return moves;
  const result = [...moves];
  for (const tm of taught) {
    if (result.length < 4) { result.push(tm); continue; }
    let wi = 0;
    for (let i = 1; i < result.length; i++) if (result[i].power < result[wi].power) wi = i;
    result[wi] = tm;   // evict the weakest to make room for the taught move
  }
  return result.slice(0, 4);
}

// Small lookup of moves that appear on PokéAPI wild Pokémon
const KNOWN_MOVES: Record<string, MoveData> = {
  'tackle':      { name: 'Tackle',      type: 'normal',  category: 'physical', power: 40, accuracy: 100, pp: 35 },
  'growl':       { name: 'Growl',       type: 'normal',  category: 'status',   power:  0, accuracy: 100, pp: 40 },
  'scratch':     { name: 'Scratch',     type: 'normal',  category: 'physical', power: 40, accuracy: 100, pp: 35 },
  'pound':       { name: 'Pound',       type: 'normal',  category: 'physical', power: 40, accuracy: 100, pp: 35 },
  'ember':       { name: 'Ember',       type: 'fire',    category: 'special',  power: 40, accuracy: 100, pp: 25 },
  'water gun':   { name: 'Water Gun',   type: 'water',   category: 'special',  power: 40, accuracy: 100, pp: 25 },
  'vine whip':   { name: 'Vine Whip',   type: 'grass',   category: 'physical', power: 45, accuracy: 100, pp: 25 },
  'bite':        { name: 'Bite',        type: 'dark',    category: 'physical', power: 60, accuracy: 100, pp: 25 },
  'rock throw':  { name: 'Rock Throw',  type: 'rock',    category: 'physical', power: 50, accuracy:  90, pp: 15 },
  'wing attack': { name: 'Wing Attack', type: 'flying',  category: 'physical', power: 60, accuracy: 100, pp: 35 },
  'absorb':      { name: 'Absorb',      type: 'grass',   category: 'special',  power: 20, accuracy: 100, pp: 25 },
  'swift':       { name: 'Swift',       type: 'normal',  category: 'special',  power: 60, accuracy: 100, pp: 20 },
  'leech seed':  { name: 'Leech Seed',  type: 'grass',   category: 'status',   power:  0, accuracy:  90, pp: 10 },
  'sand attack': { name: 'Sand Attack', type: 'ground',  category: 'status',   power:  0, accuracy: 100, pp: 15 },
  'screech':     { name: 'Screech',     type: 'normal',  category: 'status',   power:  0, accuracy:  85, pp: 40 },
  'supersonic':  { name: 'Supersonic',  type: 'normal',  category: 'status',   power:  0, accuracy:  55, pp: 20 },
  'confusion':   { name: 'Confusion',   type: 'psychic', category: 'special',  power: 50, accuracy: 100, pp: 25 },
  'mud-slap':    { name: 'Mud Slap',    type: 'ground',  category: 'special',  power: 20, accuracy: 100, pp: 10 },
  // Dragon line (Dratini → Dragonair → Dragonite skill tree)
  'twister':       { name: 'Twister',       type: 'dragon', category: 'special',  power: 40,  accuracy: 100, pp: 20 },
  'dragon breath': { name: 'Dragon Breath', type: 'dragon', category: 'special',  power: 60,  accuracy: 100, pp: 20 },
  'dragon claw':   { name: 'Dragon Claw',   type: 'dragon', category: 'physical', power: 80,  accuracy: 100, pp: 15 },
  'dragon pulse':  { name: 'Dragon Pulse',  type: 'dragon', category: 'special',  power: 85,  accuracy: 100, pp: 10 },
  'outrage':       { name: 'Outrage',       type: 'dragon', category: 'physical', power: 120, accuracy: 100, pp: 10 },
};

const TACKLE_FALLBACK: MoveData =
  { name: 'Tackle', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35 };

function movesForEntry(entry: PartyEntry): MoveData[] {
  const moves: MoveData[] = [];
  for (const name of entry.moves ?? []) {
    const key = name.toLowerCase();
    const md  = KNOWN_MOVES[key];
    if (md) moves.push(md);
  }
  return moves.length ? moves : [TACKLE_FALLBACK];
}

/** The move NAMES a Pokémon actually fights with at its current level — the same
 *  level-up learnset the battle uses — merged with any taught HM/utility moves
 *  already stored on the entry (so Fly, Cut, etc. aren't lost from the display). */
export function displayMoves(entry: PartyEntry): string[] {
  const battleMon = buildFromEntry(entry);
  const names = battleMon.moves.map(m => m.data.name);
  const seen = new Set(names.map(n => n.toLowerCase()));
  for (const m of entry.moves ?? []) {   // keep taught HMs / prior moves not in the level kit
    if (!seen.has(m.toLowerCase())) { names.push(m); seen.add(m.toLowerCase()); }
  }
  return names;
}

/** Refresh a stored entry's display move list to match its current level/form.
 *  Called after level-ups and evolutions so the menu shows newly-learned moves. */
export function syncEntryMoves(entry: PartyEntry): void {
  entry.moves = displayMoves(entry).slice(0, 6);
}

/** Reconstruct a battle-ready Pokemon from a stored PartyEntry. */
export function buildFromEntry(entry: PartyEntry): Pokemon {
  // Starter OR evolved form — use exact form data
  const form = findForm(entry.spriteKey);
  if (form) {
    const moves = foldTaughtMoves(mergeLearnset(form.startingMoves, entry.spriteKey, form.data.type1, form.data.type2, entry.level), entry);
    const p = new Pokemon({ ...form.data, ability: entry.ability ?? form.ability, gender: entry.gender, status: entry.status }, entry.level, moves);
    p.hp  = Math.min(entry.hp, p.maxHp);
    p.exp = entry.exp ?? 0;
    p.setHeldItem(entry.heldItem);
    restorePP(p, entry);
    return p;
  }

  // Custom Pokémon (Disguijar — exact tuned data)
  if (entry.spriteKey === 'disguijar') {
    const moves = foldTaughtMoves(mergeLearnset(DISGUIJAR_MOVES, 'disguijar', DISGUIJAR_DATA.type1, DISGUIJAR_DATA.type2, entry.level), entry);
    const p = new Pokemon({ ...DISGUIJAR_DATA, ability: entry.ability ?? DISGUIJAR_DATA.ability, gender: entry.gender, status: entry.status }, entry.level, moves);
    p.hp  = Math.min(entry.hp, p.maxHp);
    p.exp = entry.exp ?? 0;
    p.setHeldItem(entry.heldItem);
    restorePP(p, entry);
    return p;
  }

  // Other custom Pokémon (Pokédex designs)
  const cf = customForm(entry.spriteKey);
  if (cf) {
    const moves = foldTaughtMoves(mergeLearnset(cf.moves, entry.spriteKey, cf.data.type1, cf.data.type2, entry.level), entry);
    const p = new Pokemon({ ...cf.data, ability: entry.ability ?? cf.data.ability, gender: entry.gender, status: entry.status }, entry.level, moves);
    p.hp  = Math.min(entry.hp, p.maxHp);
    p.exp = entry.exp ?? 0;
    p.setHeldItem(entry.heldItem);
    restorePP(p, entry);
    return p;
  }

  // PokéAPI caught Pokémon — use all six persisted species stats. Older saves
  // are hydrated by PartySystem from the PokéAPI cache before reaching here.
  const stats = entry.baseStats ?? {
    hp: Math.max(10, Math.round((entry.maxHp - entry.level - 10) * 25 / Math.max(1, entry.level))),
    atk: 55, def: 55, spAtk: 55, spDef: 55, spd: 55,
  };
  const data: PokemonData = {
    id:          0,
    name:        entry.name,
    ability:     entry.ability,
    gender:      entry.gender,
    status:      entry.status,
    type1:       (entry.type1 as PokemonType) || 'normal',
    type2:       entry.type2 as PokemonType | undefined,
    baseHp:      stats.hp,
    baseAtk:     stats.atk, baseDef: stats.def,
    baseSpAtk:   stats.spAtk, baseSpDef: stats.spDef, baseSpd: stats.spd,
    spriteUrl:   entry.spriteUrl,
  };
  const moves = foldTaughtMoves(mergeLearnset(movesForEntry(entry), entry.spriteKey, data.type1, data.type2, entry.level), entry);
  const p = new Pokemon(data, entry.level, moves);
  p.hp  = Math.min(entry.hp, p.maxHp);
  p.exp = entry.exp ?? 0;
  p.setHeldItem(entry.heldItem);
  restorePP(p, entry);
  return p;
}

/** Finish a field replacement without losing side-owned effects such as active
 * weather or Leech Seed healing. Volatile effects tied to the withdrawn
 * combatant are cleared, while entry abilities are allowed to trigger again. */
export function transferReplacementState(outgoing: Pokemon, replacement: Pokemon): Pokemon {
  outgoing.transferSeededTargetsTo(replacement);
  outgoing.resetVolatileOnSwitch();
  transferBattleWeather(outgoing, replacement);
  return replacement;
}

export function buildReplacement(outgoing: Pokemon, entry: PartyEntry): Pokemon {
  return transferReplacementState(outgoing, buildFromEntry(entry));
}

/** Ensure a party member's current species texture exists before a switch-in.
 *  Old saves can retain a pre-evolution `.jpg` URL even after the key changes;
 *  prefer the canonical form/custom URL so the gameplay switch and visible
 *  sprite always change together on the first selection. */
export async function ensurePartyTexture(scene: Phaser.Scene, entry: PartyEntry): Promise<boolean> {
  const key = entry.spriteKey;
  if (scene.textures.exists(key)) return true;
  const url = findForm(key)?.data.spriteUrl ?? customForm(key)?.data.spriteUrl ?? entry.spriteUrl;
  if (!url) return false;

  scene.load.image(key, url);
  await new Promise<void>(resolve => {
    const finish = () => {
      scene.load.off('complete', finish);
      scene.load.off('loaderror', finish);
      resolve();
    };
    scene.load.once('complete', finish);
    scene.load.once('loaderror', finish);
    scene.load.start();
  });
  return scene.textures.exists(key);
}

/** Apply the entry's saved remaining-PP to a freshly built Pokémon so PP carries
 *  across battles (a fresh build otherwise starts every move at full PP). */
function restorePP(p: Pokemon, entry: PartyEntry): void {
  if (!entry.movePP) return;
  for (const m of p.moves) {
    const saved = entry.movePP[m.data.name.toLowerCase()];
    if (saved !== undefined) m.pp = Math.max(0, Math.min(m.data.pp, saved));
  }
}

/** Persist a battling Pokémon's current remaining-PP back onto its party entry. */
export function persistMovePP(registry: Phaser.Data.DataManager, slot: number, mon: Pokemon): void {
  const party = PartySystem.get(registry);
  const e = party[slot];
  if (!e) return;
  const pp: Record<string, number> = { ...(e.movePP ?? {}) };
  for (const m of mon.moves) pp[m.data.name.toLowerCase()] = m.pp;
  e.movePP = pp;
  PartySystem.set(registry, party);
}

/** Persist the outgoing combatant and apply switch-only abilities such as
 * Natural Cure before another party member replaces it. */
export function persistSwitchOut(registry: Phaser.Data.DataManager, slot: number, mon: Pokemon): string | undefined {
  const message = applySwitchOutAbility(mon);
  const party = PartySystem.get(registry);
  const entry = party[slot];
  if (!entry) return message;
  entry.hp = mon.hp;
  entry.status = mon.status;
  if (mon.heldItem) entry.heldItem = mon.heldItem;
  else delete entry.heldItem;
  const pp: Record<string, number> = { ...(entry.movePP ?? {}) };
  for (const move of mon.moves) pp[move.data.name.toLowerCase()] = move.pp;
  entry.movePP = pp;
  PartySystem.set(registry, party);
  return message;
}
