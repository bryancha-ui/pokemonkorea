/**
 * Shared level-up learnsets for the player's party and ordinary opponents.
 * Everyone begins with one simple move, then opens new move slots gradually.
 * Boss trainers may still use their authored end-game sets.
 */
import { MoveData } from '../battle/Pokemon';
import { PokemonType } from '../battle/TypeChart';
import { OUTLAW_LEAFSTORM, ROYAL_KILN_ROAR, SOUL_FERRY_DELUGE } from './SignatureMoves';

const M = (name: string, type: string, category: 'physical' | 'special', power: number, accuracy = 100, pp = 10): MoveData =>
  ({ name, type: type as PokemonType, category, power, accuracy, pp });

const S = (name: string, type: string, pp: number): MoveData =>
  ({ name, type: type as PokemonType, category: 'status', power: 0, accuracy: 100, pp });

const TACKLE: MoveData = M('Tackle', 'normal', 'physical', 40, 100, 35);

// The first same-type move is intentionally weak. At level 5 a starter has only
// Tackle; this arrives at level 7 and makes the second move feel earned.
const EARLY_STAB: Record<string, MoveData> = {
  normal:   M('Quick Attack', 'normal', 'physical', 40, 100, 30),
  fire:     M('Ember', 'fire', 'special', 40, 100, 25),
  water:    M('Water Gun', 'water', 'special', 40, 100, 25),
  grass:    M('Vine Whip', 'grass', 'physical', 40, 100, 25),
  electric: M('Thunder Shock', 'electric', 'special', 40, 100, 30),
  ice:      M('Powder Snow', 'ice', 'special', 40, 100, 25),
  fighting: M('Karate Chop', 'fighting', 'physical', 40, 100, 25),
  poison:   M('Poison Sting', 'poison', 'physical', 35, 100, 30),
  ground:   M('Mud Slap', 'ground', 'special', 30, 100, 20),
  flying:   M('Peck', 'flying', 'physical', 35, 100, 35),
  psychic:  M('Confusion', 'psychic', 'special', 40, 100, 25),
  bug:      M('Bug Bite', 'bug', 'physical', 40, 100, 25),
  rock:     M('Rock Throw', 'rock', 'physical', 40, 95, 20),
  ghost:    M('Shadow Sneak', 'ghost', 'physical', 40, 100, 30),
  dragon:   M('Twister', 'dragon', 'special', 40, 100, 20),
  dark:     M('Pursuit', 'dark', 'physical', 40, 100, 20),
  steel:    M('Metal Claw', 'steel', 'physical', 40, 100, 25),
  fairy:    M('Fairy Wind', 'fairy', 'special', 40, 100, 30),
};

// Coverage move that patches each type's common weaknesses (e.g. Fire/Fairy → Dig,
// a Ground move that answers the Rock/Steel/Poison threats those types fear).
const COVERAGE: Record<string, MoveData> = {
  normal:   M('Earthquake', 'ground', 'physical', 95, 100),
  fire:     M('Dig', 'ground', 'physical', 80, 100),
  water:    M('Ice Beam', 'ice', 'special', 90, 100),
  grass:    M('Rock Slide', 'rock', 'physical', 80, 90),
  electric: M('Ice Beam', 'ice', 'special', 90, 100),
  ice:      M('Earthquake', 'ground', 'physical', 95, 100),
  fighting: M('Stone Edge', 'rock', 'physical', 95, 80),
  poison:   M('Earthquake', 'ground', 'physical', 95, 100),
  ground:   M('Stone Edge', 'rock', 'physical', 95, 80),
  flying:   M('Ice Beam', 'ice', 'special', 90, 100),
  psychic:  M('Shadow Ball', 'ghost', 'special', 80, 100),
  bug:      M('Rock Slide', 'rock', 'physical', 80, 90),
  rock:     M('Earthquake', 'ground', 'physical', 95, 100),
  ghost:    M('Dazzling Gleam', 'fairy', 'special', 80, 100),
  dragon:   M('Fire Blast', 'fire', 'special', 90, 85),
  dark:     M('Sludge Bomb', 'poison', 'special', 85, 100),
  steel:    M('Earthquake', 'ground', 'physical', 95, 100),
  fairy:    M('Dig', 'ground', 'physical', 80, 100),
};

// An early, moderate same-type move so Pokémon stop being stuck on their two
// starting attacks in the early game — learned around level 9-13.
const STAB1: Record<string, MoveData> = {
  normal:   M('Headbutt', 'normal', 'physical', 70, 100),
  fire:     M('Flame Burst', 'fire', 'special', 70, 100),
  water:    M('Water Pulse', 'water', 'special', 60, 100),
  grass:    M('Razor Leaf', 'grass', 'physical', 60, 95),
  electric: M('Shock Wave', 'electric', 'special', 60, 100),
  ice:      M('Aurora Beam', 'ice', 'special', 65, 100),
  fighting: M('Brick Break', 'fighting', 'physical', 75, 100),
  poison:   M('Venoshock', 'poison', 'special', 65, 100),
  ground:   M('Bulldoze', 'ground', 'physical', 60, 100),
  flying:   M('Wing Attack', 'flying', 'physical', 60, 100),
  psychic:  M('Psybeam', 'psychic', 'special', 65, 100),
  bug:      M('Silver Wind', 'bug', 'special', 60, 100),
  rock:     M('Rock Tomb', 'rock', 'physical', 60, 95),
  ghost:    M('Hex', 'ghost', 'special', 65, 100),
  dragon:   M('Dragon Breath', 'dragon', 'special', 60, 100),
  dark:     M('Bite', 'dark', 'physical', 60, 100),
  steel:    M('Steel Wing', 'steel', 'physical', 70, 90),
  fairy:    M('Draining Kiss', 'fairy', 'special', 60, 100),
};

// A strong second STAB learned a little later.
const STAB2: Record<string, MoveData> = {
  normal:   M('Body Slam', 'normal', 'physical', 85, 100),
  fire:     M('Fire Blast', 'fire', 'special', 95, 85),
  water:    M('Hydro Pump', 'water', 'special', 95, 80),
  grass:    M('Energy Ball', 'grass', 'special', 90, 100),
  electric: M('Thunder', 'electric', 'special', 95, 70),
  ice:      M('Blizzard', 'ice', 'special', 95, 70),
  fighting: M('Close Combat', 'fighting', 'physical', 95, 100),
  poison:   M('Sludge Bomb', 'poison', 'special', 90, 100),
  ground:   M('Earthquake', 'ground', 'physical', 95, 100),
  flying:   M('Air Slash', 'flying', 'special', 85, 95),
  psychic:  M('Psychic', 'psychic', 'special', 90, 100),
  bug:      M('Bug Buzz', 'bug', 'special', 90, 100),
  rock:     M('Stone Edge', 'rock', 'physical', 95, 80),
  ghost:    M('Shadow Ball', 'ghost', 'special', 90, 100),
  dragon:   M('Draco Meteor', 'dragon', 'special', 95, 90),
  dark:     M('Dark Pulse', 'dark', 'special', 85, 100),
  steel:    M('Flash Cannon', 'steel', 'special', 85, 100),
  fairy:    M('Moonblast', 'fairy', 'special', 95, 100),
};

export interface LearnEntry { level: number; move: MoveData; }

// Per-Pokémon hand-tuned extras layered on top of the generic kit (by sprite key).
const OVERRIDES: Record<string, LearnEntry[]> = {
  // Starter utility moves arrive only after their first low-power STAB.
  munkain:    [{ level: 9, move: S('Synthesis', 'grass', 5) }],
  // Vipour must be able to damage the rival's Ghost-type Onnurian in the
  // opening battle. Poison Sting is deliberately weak, but gives it a legal
  // STAB attack from Lv.1 instead of leaving it with immune Normal-only damage.
  vipour:     [
    { level: 1, move: M('Poison Sting', 'poison', 'physical', 35, 100, 30) },
    { level: 9, move: S('Smokescreen', 'normal', 20) },
  ],
  onnurian:   [{ level: 9, move: S('Mist', 'ice', 30) }],
  feldaconda: [{ level: 38, move: M('Earth Power', 'ground', 'special', 90, 100) }], // extra Ground coverage
  // The three final starter evolutions unlock their signature moves together at
  // Lv.56. Keeping this out of the evolution level prevents the move from being
  // selected automatically before the dedicated level-up learning prompt.
  thanatoat:  [{ level: 38, move: M('Ice Beam', 'ice', 'special', 90, 100) }, { level: 56, move: SOUL_FERRY_DELUGE }],
  banderado:  [{ level: 38, move: M('Stone Edge', 'rock', 'physical', 95, 80) }, { level: 56, move: OUTLAW_LEAFSTORM }],
  pipetiger:  [{ level: 56, move: ROYAL_KILN_ROAR }],
  // 화투루미 (Onnujang) — a proper Ghost STAB in its early 20s, before it evolves
  // into Thanatoat at Lv.36 (fills the gap between Shadow Sneak @15 and Hex @25).
  onnujang:   [{ level: 21, move: M('Ominous Wind', 'ghost', 'special', 60, 100) }],
  // New custom lines — signature moves on top of the generic type kit.
  jakdangchi: [{ level: 20, move: M('Sucker Punch', 'dark', 'physical', 70, 100) }],
  kkaakdang:  [{ level: 36, move: { ...M('Brave Bird', 'flying', 'physical', 95, 100), recoil: 33 } }, { level: 40, move: M('Foul Play', 'dark', 'physical', 95, 100) }],
  norigung:   [{ level: 20, move: M('Mega Drain', 'grass', 'special', 60, 100) }],
  mugungmama: [{ level: 36, move: M('Giga Drain', 'grass', 'special', 85, 100) }, { level: 40, move: M('Hyper Voice', 'normal', 'special', 90, 100) }],
  danachungi: [{ level: 20, move: M('Bug Bite', 'bug', 'physical', 60, 100) }],
  nabiguni:   [{ level: 34, move: M('Psychic', 'psychic', 'special', 90, 100) }, { level: 40, move: M('Bug Buzz', 'bug', 'special', 90, 100) }], // 명상의 힘 — meditative might
  maewoyong:  [{ level: 24, move: M('Dragon Breath', 'dragon', 'special', 70, 100) }],
  seuphaisin: [{ level: 40, move: M('Monsoon Deluge', 'grass', 'special', 95, 100) }, { level: 44, move: M('Dragon Pulse', 'dragon', 'special', 85, 100) }], // 장마 — signature monsoon
  honupup:    [{ level: 22, move: M('Will-O-Wisp', 'fire', 'special', 55, 100) }],
  honutomb:   [{ level: 40, move: M('Grave Bloom', 'grass', 'special', 90, 100) }, { level: 44, move: M('Shadow Ball', 'ghost', 'special', 85, 100) }], // signature — the greening candle
  arctorodon: [{ level: 34, move: M('Glacial Crush', 'ice', 'physical', 100, 95) }, { level: 40, move: M('Stone Edge', 'rock', 'physical', 95, 80) }], // Rock/Ice leviathan signature
};

/** Every move the Pokémon has learned by `level`, from its types + any overrides.
 *  A move is gained roughly every 5-8 levels so teams keep getting stronger from
 *  the early game onward, not just at the level-24+ power spike. */
export function levelUpMoves(spriteKey: string, t1?: string, t2?: string, level = 1): MoveData[] {
  const learns: LearnEntry[] = [];
  if (t1 && EARLY_STAB[t1]) learns.push({ level:  7, move: EARLY_STAB[t1] });
  if (t1 && STAB1[t1])      learns.push({ level: 11, move: STAB1[t1] });
  if (t2 && EARLY_STAB[t2]) learns.push({ level: 15, move: EARLY_STAB[t2] });
  if (t1 && COVERAGE[t1])   learns.push({ level: 21, move: COVERAGE[t1] });
  if (t2 && STAB1[t2])      learns.push({ level: 25, move: STAB1[t2] });
  if (t2 && COVERAGE[t2])   learns.push({ level: 28, move: COVERAGE[t2] });
  if (t1 && STAB2[t1])      learns.push({ level: 31, move: STAB2[t1] });
  if (t2 && STAB2[t2])      learns.push({ level: 38, move: STAB2[t2] });
  for (const e of OVERRIDES[spriteKey] ?? []) learns.push(e);
  return learns.sort((a, b) => a.level - b.level).filter(e => level >= e.level).map(e => e.move);
}

/**
 * Build the moves known at this level. `base` describes the species' full
 * authored kit, but only its first move is a level-1 seed; the rest no longer
 * leak into a new level-5 Pokémon all at once.
 */
export function mergeLearnset(base: MoveData[], spriteKey: string, t1?: string, t2?: string, level = 1): MoveData[] {
  const learned = levelUpMoves(spriteKey, t1, t2, level);
  const seen = new Set<string>();
  const seed = base[0] ?? TACKLE;
  const all = [seed, ...learned].filter(m => {
    const k = m.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (all.length <= 4) return all;
  // Keep the four most recently learned moves, matching the normal progression
  // model. Sorting by raw power erased recovery, weather and status options and
  // made every late-game team a homogeneous four-attack set.
  return all.slice(-4);
}

const EARLY_GRASS_COVERAGE = M('Rock Throw', 'rock', 'physical', 40, 95, 20);

/**
 * Ordinary enemy progression. A level-5 Grass opponent gets one low-power Rock
 * move alongside Tackle so Ghost starters cannot make the opening battle a free
 * win; other enemies still begin with only one move.
 */
export function enemyLearnset(base: MoveData[], spriteKey: string, t1?: string, t2?: string, level = 1): MoveData[] {
  const moves = mergeLearnset(base.length ? base : [TACKLE], spriteKey, t1, t2, level);
  const isEarlyGrass = level >= 5 && level < 11 && (t1 === 'grass' || t2 === 'grass');
  if (isEarlyGrass && !moves.some(m => m.name.toLowerCase() === EARLY_GRASS_COVERAGE.name.toLowerCase())) {
    moves.push(EARLY_GRASS_COVERAGE);
  }
  return moves.slice(0, 4);
}
