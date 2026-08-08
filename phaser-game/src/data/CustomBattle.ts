/**
 * Battle data for every custom Pokémon (stats + moves), generated compactly
 * from a type + stage description so they can be caught, used, and evolved.
 */
import { PokemonData, MoveData } from '../battle/Pokemon';
import { PokemonType } from '../battle/TypeChart';
import { POKEDEX } from './Pokedex';
import { ROYAL_KILN_ROAR } from './SignatureMoves';

// One reliable attacking move per type
const MOVE_BY_TYPE: Record<string, MoveData> = {
  normal:   { name: 'Body Slam',    type: 'normal',   category: 'physical', power: 70, accuracy: 100, pp: 15 },
  fire:     { name: 'Flamethrower', type: 'fire',     category: 'special',  power: 80, accuracy: 100, pp: 15 },
  water:    { name: 'Water Pulse',  type: 'water',    category: 'special',  power: 70, accuracy: 100, pp: 20 },
  grass:    { name: 'Energy Ball',  type: 'grass',    category: 'special',  power: 80, accuracy: 100, pp: 10 },
  electric: { name: 'Thunderbolt',  type: 'electric', category: 'special',  power: 80, accuracy: 100, pp: 15 },
  ice:      { name: 'Ice Beam',     type: 'ice',      category: 'special',  power: 80, accuracy: 100, pp: 10 },
  fighting: { name: 'Brick Break',  type: 'fighting', category: 'physical', power: 75, accuracy: 100, pp: 15 },
  poison:   { name: 'Sludge Bomb',  type: 'poison',   category: 'special',  power: 80, accuracy: 100, pp: 10 },
  ground:   { name: 'Earth Power',  type: 'ground',   category: 'special',  power: 80, accuracy: 100, pp: 10 },
  flying:   { name: 'Air Slash',    type: 'flying',   category: 'special',  power: 75, accuracy:  95, pp: 15 },
  psychic:  { name: 'Psychic',      type: 'psychic',  category: 'special',  power: 80, accuracy: 100, pp: 10 },
  bug:      { name: 'Bug Buzz',     type: 'bug',      category: 'special',  power: 80, accuracy: 100, pp: 10 },
  rock:     { name: 'Rock Slide',   type: 'rock',     category: 'physical', power: 75, accuracy:  90, pp: 10 },
  ghost:    { name: 'Shadow Ball',  type: 'ghost',    category: 'special',  power: 80, accuracy: 100, pp: 15 },
  dragon:   { name: 'Dragon Pulse', type: 'dragon',   category: 'special',  power: 85, accuracy: 100, pp: 10 },
  dark:     { name: 'Crunch',       type: 'dark',     category: 'physical', power: 80, accuracy: 100, pp: 15 },
  steel:    { name: 'Iron Head',    type: 'steel',    category: 'physical', power: 80, accuracy: 100, pp: 15 },
  fairy:    { name: 'Moonblast',    type: 'fairy',    category: 'special',  power: 85, accuracy: 100, pp: 10 },
};
const TACKLE: MoveData = { name: 'Tackle', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35 };

// Stat tier by evolution stage (1 = base, 2 = mid, 3 = final, 4 = legendary)
const TIER: Record<number, { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }> = {
  1: { hp: 52, atk: 56, def: 52, spa: 56, spd: 52, spe: 56 },
  2: { hp: 68, atk: 76, def: 70, spa: 74, spd: 70, spe: 74 },
  3: { hp: 88, atk: 98, def: 90, spa: 95, spd: 90, spe: 94 },
  4: { hp: 106, atk: 106, def: 106, spa: 110, spd: 106, spe: 100 },
};

interface CB { key: string; name: string; t1: string; t2?: string; stage: number; }

// stage drives stats; types drive moves. Keys must match Pokédex + sprite keys.
const CUSTOM: CB[] = [
  { key: 'maewoyong',     name: 'Maewoyong',     t1: 'grass',    t2: 'dragon',  stage: 2 },
  { key: 'seuphaisin',    name: 'Seuphaisin',    t1: 'grass',    t2: 'dragon',  stage: 3 },
  { key: 'honupup',       name: 'Honupup',       t1: 'ghost',    t2: 'fire',    stage: 1 },
  { key: 'honutomb',      name: 'Honutomb',      t1: 'grass',    t2: 'ghost',   stage: 3 },
  { key: 'disguijar',     name: 'Disguijar',     t1: 'rock',     t2: 'flying',  stage: 2 },
  { key: 'corrpanda',     name: 'Corrpanda',     t1: 'dark',                    stage: 2 },
  { key: 'gawlhawk',      name: 'Gawlhawk',      t1: 'rock',     t2: 'flying',  stage: 1 },
  { key: 'prowlrock',     name: 'Prowlrock',     t1: 'rock',     t2: 'flying',  stage: 2 },
  { key: 'prowlnox',      name: 'Prowlnox',      t1: 'rock',     t2: 'flying',  stage: 3 },
  { key: 'nosepassx',     name: 'Nosepass',      t1: 'rock',     t2: 'psychic', stage: 1 },
  { key: 'oribioass',     name: 'Oribioass',     t1: 'rock',     t2: 'psychic', stage: 2 },
  { key: 'sandygastx',    name: 'Sandygast',     t1: 'ground',   t2: 'fairy',   stage: 1 },
  { key: 'palossandx',    name: 'Palossand',     t1: 'ground',   t2: 'fairy',   stage: 2 },
  { key: 'bosongnun',     name: 'Bosongnun',     t1: 'ice',      t2: 'fairy',   stage: 1 },
  { key: 'luninari',      name: 'Luninari',      t1: 'ice',      t2: 'fairy',   stage: 2 },
  { key: 'snoqueen',      name: 'Snoqueen',      t1: 'ice',      t2: 'fairy',   stage: 3 },
  { key: 'kidstrel',      name: 'Kidstrel',      t1: 'flying',   t2: 'fighting',stage: 1 },
  { key: 'falcrush',      name: 'Falcrush',      t1: 'flying',   t2: 'fighting',stage: 2 },
  { key: 'ureunggul',     name: 'Ureunggul',     t1: 'electric',                stage: 1 },
  { key: 'metdoyaroe',    name: 'Metdoyaroe',    t1: 'electric',                stage: 2 },
  { key: 'redheadagama',  name: 'Redhead Agama', t1: 'fire',     t2: 'dragon',  stage: 1 },
  { key: 'beardiedragon', name: 'Beardie Dragon',t1: 'fire',     t2: 'dragon',  stage: 2 },
  { key: 'aroryong',      name: 'Aroryong',      t1: 'water',    t2: 'dragon',  stage: 1 },
  { key: 'dracopaia',     name: 'Dracopaia',     t1: 'water',    t2: 'dragon',  stage: 2 },
  { key: 'moranlovebird', name: 'Moran Lovebird',t1: 'grass',    t2: 'flying',  stage: 1 },
  { key: 'moransae',      name: 'Moransae',      t1: 'grass',    t2: 'flying',  stage: 2 },
  { key: 'squirrel1',     name: 'Acornip',       t1: 'normal',                  stage: 1 },
  { key: 'squirrel2',     name: 'Soarrel',       t1: 'normal',   t2: 'flying',  stage: 2 },
  { key: 'nabicocoon',    name: 'Nabihalmang',   t1: 'steel',    t2: 'fairy',   stage: 3 },
  { key: 'nabihalmang',   name: 'Nabihalmang',   t1: 'steel',    t2: 'fairy',   stage: 4 },
  { key: 'hambillet',     name: 'Hambillet',     t1: 'steel',    t2: 'flying',  stage: 2 },
  { key: 'ivelon',        name: 'Ivelon',        t1: 'grass',    t2: 'normal',  stage: 1 },
  { key: 'palmcockatoo',  name: 'Palm Cockatoo', t1: 'dark',     t2: 'flying',  stage: 2 },
  { key: 'peacockrose',   name: 'Peacockrose',   t1: 'grass',    t2: 'flying',  stage: 2 },
  { key: 'bookbug',       name: 'Bookbug',       t1: 'bug',      t2: 'normal',  stage: 1 },
  { key: 'camerghoost',   name: 'Camerghoost',   t1: 'ghost',    t2: 'steel',   stage: 2 },
  { key: 'burinao',       name: 'Burinao',       t1: 'ghost',                   stage: 2 },
  { key: 'chattyscream',  name: 'Chatty Scream', t1: 'normal',   t2: 'dark',    stage: 2 },
  { key: 'balchataek',    name: 'Balchataek',    t1: 'dark',     t2: 'fighting',stage: 2 },
  { key: 'crystbeetle',   name: 'Crystbeetle',   t1: 'bug',      t2: 'rock',    stage: 2 },
  { key: 'unsilgami',     name: 'Unsilgami',     t1: 'psychic',  t2: 'bug',     stage: 3 },
  { key: 'kkorisagwi',    name: 'Kkorisagwi',    t1: 'ghost',    t2: 'psychic', stage: 1 },
  { key: 'supiryeong',    name: 'Supiryeong',    t1: 'ghost',    t2: 'psychic', stage: 2 },
  { key: 'bonejoillion',  name: 'Bonejoillion',  t1: 'electric', t2: 'steel',   stage: 3 },
  { key: 'samdumae',      name: 'Samdumae',      t1: 'flying',   t2: 'fairy',   stage: 3 },
  { key: 'salmua',        name: 'Salmua',        t1: 'poison',                  stage: 1 },
  { key: 'doksalsa',      name: 'Doksalsa',      t1: 'poison',   t2: 'ground',  stage: 2 },
  { key: 'dundunguri',    name: 'Dundunguri',    t1: 'normal',                  stage: 1 },
  { key: 'neogulgamyeon', name: 'Neogulgamyeon', t1: 'normal',   t2: 'fighting',stage: 2 },
  { key: 'doribi',        name: 'Doribi',        t1: 'normal',                  stage: 1 },
  { key: 'hwidoribi',     name: 'Hwidoribi',     t1: 'normal',   t2: 'fighting',stage: 2 },
  { key: 'paratoxin',     name: 'Paratoxin',     t1: 'water',    t2: 'poison',  stage: 2 },
  { key: 'silicutis',     name: 'Silicutis',     t1: 'steel',    t2: 'bug',     stage: 2 },
  { key: 'plumpypu',      name: 'Plumpypu',      t1: 'ground',                  stage: 1 },
  { key: 'capaludar',     name: 'Capaludar',     t1: 'ground',   t2: 'fairy',   stage: 2 },
  { key: 'ottershaman',   name: 'Ottershaman',   t1: 'water',                   stage: 1 },
  { key: 'ottermudang',   name: 'Ottermudang',   t1: 'water',    t2: 'ghost',   stage: 2 },
  { key: 'liondance',     name: 'Liondance',     t1: 'fire',     t2: 'normal',  stage: 2 },
  { key: 'turtleship',    name: 'Turtleship',    t1: 'steel',    t2: 'dragon',  stage: 2 },
  { key: 'kingfisher',    name: 'Kingfisher',    t1: 'flying',   t2: 'electric',stage: 1 },
  { key: 'thunderon',     name: 'Thunderon',     t1: 'electric', t2: 'flying',  stage: 2 },
  { key: 'kudzu',         name: 'Kudzu',         t1: 'grass',    t2: 'normal',  stage: 1 },
  { key: 'wildcat',       name: 'Wildcat',       t1: 'grass',    t2: 'electric',stage: 2 },
  { key: 'foxgeist',      name: 'Foxgeist',      t1: 'poison',   t2: 'ghost',   stage: 2 },
  { key: 'cerrapin',      name: 'Cerrapin',      t1: 'rock',     t2: 'water',   stage: 1 },
  { key: 'booktoise',     name: 'Booktoise',     t1: 'water',    t2: 'grass',   stage: 2 },
  { key: 'strawtle',      name: 'Strawtle',      t1: 'grass',    t2: 'water',   stage: 2 },
  { key: 'roundtailor',   name: 'Roundtailor',   t1: 'water',                   stage: 1 },
  { key: 'sandfox',       name: 'Sandfox',       t1: 'ground',                  stage: 1 },
  { key: 'bookkuddoong',  name: 'Bookkuddoong',  t1: 'normal',   t2: 'fairy',   stage: 1 },
  { key: 'odamryul',      name: 'Odamryul',      t1: 'water',                   stage: 1 },
  { key: 'mushvenom',     name: 'Mushvenom',     t1: 'rock',     t2: 'poison',  stage: 2 },
  { key: 'ghograss',      name: 'Ghograss',      t1: 'grass',    t2: 'ghost',   stage: 1 },
  { key: 'trumpetcreeper',name: 'Trumpetcreeper',t1: 'grass',                   stage: 1 },
  { key: 'tokkigongju',   name: 'Tokkigongju',   t1: 'dark',     t2: 'fairy',   stage: 3 },
  { key: 'tigerbabe',     name: 'Tigerbabe',     t1: 'fire',     t2: 'steel',   stage: 1 },
  { key: 'yeomtaeja',     name: 'Yeomtaeja',     t1: 'fire',     t2: 'steel',   stage: 2 },
  { key: 'pipetiger',     name: 'Pipetiger',     t1: 'fire',     t2: 'steel',   stage: 3 },
  { key: 'layone',        name: 'Layone',        t1: 'normal',                  stage: 1 },
  { key: 'hwanwoong',     name: 'Hwanwoong',     t1: 'flying',   t2: 'psychic', stage: 4 },
  { key: 'sotori',        name: 'Sotori',        t1: 'ghost',    t2: 'fighting',stage: 3 },
  { key: 'gorcobat',      name: 'Gorcobat',      t1: 'grass',    t2: 'fighting',stage: 2 },
  { key: 'blazekunk',     name: 'Blazekunk',     t1: 'fire',     t2: 'poison',  stage: 2 },
  { key: 'frysm',         name: 'Frysm',         t1: 'water',    t2: 'psychic', stage: 2 },
  { key: 'martbadger',    name: 'Martbadger',    t1: 'dark',     t2: 'steel',   stage: 2 },
  { key: 'poongbaek',     name: 'Poongbaek',     t1: 'normal',                  stage: 3 },
  { key: 'waterdeer',     name: 'Waterdeer',     t1: 'electric', t2: 'normal',  stage: 4 },
  { key: 'woosa',         name: 'Woosa',         t1: 'water',    t2: 'flying',  stage: 4 },
  { key: 'woonsa',        name: 'Woonsa',        t1: 'flying',   t2: 'electric',stage: 4 },
  { key: 'ssangdungori',  name: 'Ssangdungori',  t1: 'electric', t2: 'flying',  stage: 1 },
  { key: 'ampere',        name: 'Ampere',        t1: 'electric', t2: 'flying',  stage: 2 },
  { key: 'rideer',        name: 'Rideer',        t1: 'normal',   t2: 'electric',stage: 2 },
  { key: 'feldaconda',    name: 'Feldaconda',    t1: 'fire',     t2: 'fairy',   stage: 4 },
  { key: 'thanatoat',     name: 'Thanatoat',     t1: 'water',    t2: 'ghost',   stage: 4 },
  { key: 'cheonjisin',    name: 'Spirit of Cheonji', t1: 'dragon', t2: 'water', stage: 4 },
  { key: 'jakdangsae',    name: 'Jakdangsae',    t1: 'flying',   t2: 'dark',    stage: 1 },
  { key: 'jakdangchi',    name: 'Jakdangchi',    t1: 'flying',   t2: 'dark',    stage: 2 },
  { key: 'kkaakdang',     name: 'Kkaakdang',     t1: 'flying',   t2: 'dark',    stage: 3 },
  { key: 'mugunga',       name: 'Mugunga',       t1: 'grass',    t2: 'normal',  stage: 1 },
  { key: 'norigung',      name: 'Norigung',      t1: 'grass',    t2: 'normal',  stage: 2 },
  { key: 'mugungmama',    name: 'Mugungmama',    t1: 'grass',    t2: 'normal',  stage: 3 },
  { key: 'gatnannu',      name: 'Gatnannu',      t1: 'bug',                     stage: 1 },
  { key: 'danachungi',    name: 'Danachungi',    t1: 'bug',      t2: 'normal',  stage: 2 },
  { key: 'nabiguni',      name: 'Nabiguni',      t1: 'bug',      t2: 'flying',  stage: 3 },
  { key: 'komodread',     name: 'Komodread',     t1: 'poison',   t2: 'dragon',  stage: 3 },
  { key: 'noeryong',      name: 'Noeryong',      t1: 'electric', t2: 'dragon',  stage: 4 },
  { key: 'merrloween',    name: 'Merrloween',    t1: 'ghost',    t2: 'fairy',   stage: 3 },
  { key: 'hallowknight',  name: 'Hallowknight',  t1: 'bug',      t2: 'steel',   stage: 3 },
  { key: 'halubang',      name: 'Halubang',      t1: 'rock',     t2: 'dark',    stage: 3 },
  { key: 'ratouille',     name: 'Ratouille',     t1: 'electric',                stage: 2 },
  { key: 'mperodactyl',   name: 'Mperodactyl',   t1: 'rock',     t2: 'dragon',  stage: 3 },
  { key: 'dracoelido',    name: 'Dracoelido',    t1: 'rock',     t2: 'dragon',  stage: 3 },
  { key: 'daejangseung',  name: 'Daejangseung',  t1: 'ghost',    t2: 'fighting',stage: 4 },
  { key: 'butlerawn',     name: 'Butlerawn',     t1: 'water',                   stage: 2 },
  { key: 'arctorodon',    name: 'Arctorodon',    t1: 'rock',     t2: 'ice',     stage: 4 },
  { key: 'zoltile',       name: 'Zoltile',       t1: 'electric', t2: 'rock',    stage: 2 },
  { key: 'ssaktrin',      name: 'Ssaktrin',      t1: 'grass',                   stage: 1 },
  { key: 'longroffe',     name: 'Longroffe',     t1: 'grass',    t2: 'rock',    stage: 2 },
  { key: 'onnurigrowlithe', name: 'Growlithe',   t1: 'ice',                     stage: 1 },
  { key: 'onnuriarcanine',name: 'Onnurian Arcanine',  t1: 'ice',  t2: 'fairy',  stage: 3 },
  { key: 'onnurismoochum',name: 'Smoochum',      t1: 'fairy',                   stage: 1 },
  { key: 'idolena',       name: 'Idolena',       t1: 'fire',     t2: 'fairy',   stage: 2 },
  { key: 'groundzoome',   name: 'Groundzoome',   t1: 'ground',   t2: 'ghost',   stage: 1 },
  { key: 'groundzomber',  name: 'Groundzomber',  t1: 'ground',   t2: 'ghost',   stage: 2 },
  { key: 'kelpoxin',      name: 'Kelpoxin',      t1: 'poison',   t2: 'water',   stage: 2 },
  { key: 'twinkluppy',    name: 'Twinkluppy',    t1: 'water',    t2: 'fairy',   stage: 1 },
  { key: 'nootillunar',   name: 'Nootillunar',   t1: 'water',    t2: 'fairy',   stage: 2 },
  { key: 'babymammoth',   name: 'Babymammoth',   t1: 'ice',                     stage: 1 },
  { key: 'bookmoth',      name: 'Bookmoth',      t1: 'bug',      t2: 'psychic',  stage: 2 },
  { key: 'venombee',      name: 'Venombee',      t1: 'poison',   t2: 'bug',      stage: 2 },
  { key: 'glacewing',     name: 'Glacewing',     t1: 'ice',      t2: 'bug',      stage: 2 },
  { key: 'volthopper',    name: 'Volthopper',    t1: 'electric', t2: 'bug',      stage: 2 },
  { key: 'dynabeetle',    name: 'Dynabeetle',    t1: 'bug',      t2: 'fire',     stage: 2 },
  { key: 'saekomaga',     name: 'Saekomaga',     t1: 'grass',                    stage: 1 },
  { key: 'saekomassi',    name: 'Saekomassi',    t1: 'grass',    t2: 'electric', stage: 2 },
  { key: 'secommamma',    name: 'Secommamma',    t1: 'grass',    t2: 'electric', stage: 3 },
  { key: 'moktakgwi',     name: 'Moktakgwi',     t1: 'ghost',    t2: 'grass',    stage: 3 },
];

function spriteUrlFor(key: string): string {
  const e = POKEDEX.find(p => p.key === key);
  return e?.spriteUrl ?? `assets/dex/${key}.png`;
}

export interface CustomForm { data: PokemonData; moves: MoveData[]; }

const FORMS: Record<string, CustomForm> = {};
let idc = 950;
for (const cb of CUSTOM) {
  const t = TIER[cb.stage];
  const ability = POKEDEX.find(entry => entry.key === cb.key)?.ability;
  const data: PokemonData = {
    id: idc++, name: cb.name, ability,
    type1: cb.t1 as PokemonType, type2: cb.t2 as PokemonType | undefined,
    baseHp: t.hp, baseAtk: t.atk, baseDef: t.def, baseSpAtk: t.spa, baseSpDef: t.spd, baseSpd: t.spe,
    spriteUrl: spriteUrlFor(cb.key),
  };
  const moves: MoveData[] = [TACKLE];
  if (MOVE_BY_TYPE[cb.t1]) moves.push(MOVE_BY_TYPE[cb.t1]);
  if (cb.t2 && MOVE_BY_TYPE[cb.t2]) moves.push(MOVE_BY_TYPE[cb.t2]);
  if (cb.key === 'pipetiger') moves.push(ROYAL_KILN_ROAR);
  FORMS[cb.key] = { data, moves };
}

export function customForm(key: string): CustomForm | undefined { return FORMS[key]; }
export function isCustomKey(key: string): boolean { return key in FORMS; }
