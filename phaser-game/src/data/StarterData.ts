import { PokemonData } from '../battle/Pokemon';
import { MoveData } from '../battle/Pokemon';
import { OUTLAW_LEAFSTORM, SOUL_FERRY_DELUGE } from './SignatureMoves';

export interface StarterDef {
  data: PokemonData;
  ability: string;
  flavorA: string;
  flavorB: string;
  startingMoves: MoveData[];
  spriteKey: string;
}

// ── Moves ─────────────────────────────────────────────────────────────────────

const TACKLE:       MoveData = { name: 'Tackle',       type: 'normal',  category: 'physical', power: 40, accuracy: 100, pp: 35 };

// Munkain (Grass)
const RAZOR_LEAF:   MoveData = { name: 'Razor Leaf',   type: 'grass',   category: 'physical', power: 55, accuracy:  95, pp: 25 };
const LEAF_BLADE:   MoveData = { name: 'Leaf Blade',   type: 'grass',   category: 'physical', power: 90, accuracy: 100, pp: 15 };
const SYNTHESIS:    MoveData = { name: 'Synthesis',    type: 'grass',   category: 'status',   power:  0, accuracy: 100, pp:  5 };

// Vipour (Fire / Poison)
const FLAME_BURST:  MoveData = { name: 'Flame Burst',  type: 'fire',    category: 'special',  power: 70, accuracy: 100, pp: 15 };
const FIRE_FANG:    MoveData = { name: 'Fire Fang',    type: 'fire',    category: 'physical', power: 65, accuracy:  95, pp: 15 };
const SMOKESCREEN:  MoveData = { name: 'Smokescreen',  type: 'normal',  category: 'status',   power:  0, accuracy: 100, pp: 20 };

// Onnurian (Water / Ghost)
const BUBBLEBEAM:   MoveData = { name: 'Bubblebeam',   type: 'water',   category: 'special',  power: 65, accuracy: 100, pp: 20 };
const SHADOW_BALL:  MoveData = { name: 'Shadow Ball',  type: 'ghost',   category: 'special',  power: 80, accuracy: 100, pp: 15 };
const MIST:         MoveData = { name: 'Mist',         type: 'ice',     category: 'status',   power:  0, accuracy: 100, pp: 30 };

// Evolved-form moves
const BITE_M:       MoveData = { name: 'Bite',         type: 'dark',    category: 'physical', power: 60, accuracy: 100, pp: 25 };
const NIGHT_SLASH:  MoveData = { name: 'Night Slash',  type: 'dark',    category: 'physical', power: 70, accuracy: 100, pp: 15 };
const WOOD_HAMMER:  MoveData = { name: 'Wood Hammer',  type: 'grass',   category: 'physical', power: 120, accuracy: 100, pp: 10 };
const SWORDS_DANCE: MoveData = { name: 'Swords Dance', type: 'normal',  category: 'status',   power:  0, accuracy: 100, pp: 20 };
const SLUDGE_BOMB:  MoveData = { name: 'Sludge Bomb',  type: 'poison',  category: 'special',  power: 90, accuracy: 100, pp: 10 };
const FLAMETHROWER: MoveData = { name: 'Flamethrower', type: 'fire',    category: 'special',  power: 90, accuracy: 100, pp: 15 };
const HYDRO_PUMP:   MoveData = { name: 'Hydro Pump',   type: 'water',   category: 'special',  power: 110, accuracy: 80, pp:  5 };
const SHADOW_SNEAK: MoveData = { name: 'Shadow Sneak', type: 'ghost',   category: 'physical', power: 40, accuracy: 100, pp: 30 };

// ── Starters ──────────────────────────────────────────────────────────────────
// Base stats are boosted ~30 % above the original sketches so battles feel
// fair at the levels players actually reach them (lv 12-13 at gym).

export const STARTERS: StarterDef[] = [
  {
    spriteKey: 'munkain',
    ability: 'Overgrow',
    flavorA: 'Its tail has a special power to keep food fresh. It always carries prey like fruit in its tail.',
    flavorB: 'Before winter it stores food in its tail. Fruit it forgets to eat sprouts and becomes part of the tail.',
    startingMoves: [TACKLE, RAZOR_LEAF, LEAF_BLADE, SYNTHESIS],
    data: {
      id: 901, name: 'Munkain',
      type1: 'grass', type2: undefined,
      baseHp:    60,   // was 45
      baseAtk:   65,   // was 49
      baseDef:   65,   // was 49
      baseSpAtk: 72,   // was 55
      baseSpDef: 72,   // was 55
      baseSpd:   60,   // was 45
      spriteUrl: 'assets/munkain.png',
    },
  },
  {
    spriteKey: 'vipour',
    ability: 'Blaze',
    flavorA: 'Smoke from burning food drifts from its neck organ. Elements in the smoke make prey feel strangely at ease.',
    flavorB: 'It draws attention with S-shaped movements. When prey lets its guard down, Vipour bites and paralyzes them.',
    startingMoves: [TACKLE, FLAME_BURST, FIRE_FANG, SMOKESCREEN],
    data: {
      id: 902, name: 'Vipour',
      type1: 'fire', type2: 'poison',
      baseHp:    55,   // was 39
      baseAtk:   70,   // was 52
      baseDef:   58,   // was 43
      baseSpAtk: 85,   // was 62  ← main boost so fire moves connect
      baseSpDef: 65,   // was 50
      baseSpd:   85,   // was 65
      spriteUrl: 'assets/vipour.png',
    },
  },
  {
    spriteKey: 'onnurian',
    ability: 'Torrent',
    flavorA: 'Based on the crane, the Korean Grim Reaper, and Hwatu cards. It silently guides lost souls across still water.',
    flavorB: 'Its hollow, mournful cry echoes across rivers at dusk. Fishermen say hearing it means rain — or something else.',
    startingMoves: [TACKLE, BUBBLEBEAM, SHADOW_BALL, MIST],
    data: {
      id: 903, name: 'Onnurian',
      type1: 'water', type2: 'ghost',
      baseHp:    60,   // was 44
      baseAtk:   55,   // was 40
      baseDef:   68,   // was 52
      baseSpAtk: 88,   // was 65  ← main boost for water/ghost offence
      baseSpDef: 78,   // was 58
      baseSpd:   65,   // was 50
      spriteUrl: 'assets/onnurian.png',
    },
  },
];

// ── Evolved forms ───────────────────────────────────────────────────────────
// Munkain → Munklift → Banderado  |  Vipour → Scorpent  |  Onnurian → Onnujang

export const EVOLVED_FORMS: StarterDef[] = [
  {
    spriteKey: 'munklift',
    ability: 'Overgrow',
    flavorA: 'Its tail has grown into a small tree. Fruit that sprouts there feeds the whole forest.',
    flavorB: 'It guards its grove fiercely, striking from shadow with leaf-bladed claws.',
    startingMoves: [RAZOR_LEAF, LEAF_BLADE, BITE_M, SYNTHESIS],
    data: {
      id: 911, name: 'Munklift',
      type1: 'grass', type2: 'dark',
      baseHp: 75, baseAtk: 88, baseDef: 80, baseSpAtk: 92, baseSpDef: 88, baseSpd: 78,
      spriteUrl: 'assets/munklift.png',
    },
  },
  {
    spriteKey: 'banderado',
    ability: 'Overgrow',
    flavorA: 'A masked forest bandit. Its acorn helm and leaf-blade tail are feared across the highlands.',
    flavorB: 'It moves between trees unseen, defending the wild from those who would harm it.',
    startingMoves: [LEAF_BLADE, NIGHT_SLASH, OUTLAW_LEAFSTORM, SWORDS_DANCE],
    data: {
      id: 912, name: 'Banderado',
      type1: 'grass', type2: 'dark',
      baseHp: 92, baseAtk: 110, baseDef: 95, baseSpAtk: 112, baseSpDef: 100, baseSpd: 98,
      spriteUrl: 'assets/remaster/banderado-hq.png',
    },
  },
  {
    spriteKey: 'scorpent',
    ability: 'Blaze',
    flavorA: 'When it twists and dances, heat pours from its flower-shaped scales, spreading toxic smoke.',
    flavorB: 'Its smoke carries a fascinating scent. In ancient times, nobles bred Scorpent for pleasure.',
    startingMoves: [FLAMETHROWER, FIRE_FANG, SLUDGE_BOMB, SMOKESCREEN],
    data: {
      id: 913, name: 'Scorpent',
      type1: 'fire', type2: 'poison',
      baseHp: 72, baseAtk: 90, baseDef: 72, baseSpAtk: 108, baseSpDef: 82, baseSpd: 102,
      spriteUrl: 'assets/scorpent.png',
    },
  },
  {
    spriteKey: 'onnujang',
    ability: 'Torrent',
    flavorA: 'A crane magistrate of the spirit world. Its fanned tail judges the worthy from the damned.',
    flavorB: 'Under the gat hat its eyes see beyond the veil. Where it walks, the drowned find peace.',
    startingMoves: [HYDRO_PUMP, SHADOW_BALL, SOUL_FERRY_DELUGE, MIST],
    data: {
      id: 914, name: 'Onnujang',
      type1: 'water', type2: 'ghost',
      baseHp: 80, baseAtk: 72, baseDef: 86, baseSpAtk: 110, baseSpDef: 96, baseSpd: 84,
      spriteUrl: 'assets/onnujang.png',
    },
  },
];

/** Look up a starter OR evolved form by sprite key. */
export function findForm(spriteKey: string): StarterDef | undefined {
  return STARTERS.find(s => s.spriteKey === spriteKey)
      ?? EVOLVED_FORMS.find(s => s.spriteKey === spriteKey);
}

// Battle constructors consume PokemonData directly, so mirror each form's
// declared ability onto that data object once at module initialization.
for (const form of [...STARTERS, ...EVOLVED_FORMS]) form.data.ability = form.ability;

/** Evolution chain: which form a Pokémon evolves into, at what level, and any
 *  moves learned on evolving (its "skill tree"). */
export const EVOLUTIONS: Record<string, { to: string; toName: string; level: number; addMoves?: string[] }> = {
  munkain:  { to: 'munklift',   toName: 'Munklift',   level: 16 },
  munklift: { to: 'banderado',  toName: 'Banderado',  level: 36 },  // grass final at 36
  vipour:   { to: 'scorpent',   toName: 'Scorpent',   level: 16 },  // fire mid
  scorpent: { to: 'feldaconda', toName: 'Feldaconda', level: 36 },  // fire final at 36
  onnurian: { to: 'onnujang',   toName: 'Onnujang',   level: 16 },  // water mid
  onnujang: { to: 'thanatoat',  toName: 'Thanatoat',  level: 36 },  // water final at 36
  // PokéAPI dragon line (caught as a rare wild on Route 6). Keyed by the party
  // sprite key `wild-<id>`; data/sprite resolve through the api-<id> dex entries.
  'wild-147': { to: 'wild-148', toName: 'Dragonair',  level: 30, addMoves: ['Twister', 'Dragon Breath'] },        // Dratini → Dragonair
  'wild-148': { to: 'wild-149', toName: 'Dragonite',  level: 55, addMoves: ['Dragon Claw', 'Dragon Pulse', 'Outrage'] }, // Dragonair → Dragonite
};

// Type badge colours
export const TYPE_COLORS: Record<string, number> = {
  grass:   0x4caf50,
  fire:    0xff5722,
  water:   0x2196f3,
  poison:  0x9c27b0,
  ghost:   0x5e35b1,
  normal:  0x9e9e9e,
  dark:    0x37474f,
  rock:    0x8d6e63,
  flying:  0x4fc3f7,
  ground:  0xd4a843,
  ice:     0x80deea,
  fighting:0xe53935,
  psychic: 0xe91e63,
  bug:     0x8bc34a,
  dragon:  0x4a148c,
  electric:0xffeb3b,
  steel:   0x78909c,
  fairy:   0xf48fb1,
};
