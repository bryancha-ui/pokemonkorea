import { MoveData, PokemonData } from '../battle/Pokemon';
import { PokemonType } from '../battle/TypeChart';
import { registerSpeciesHeight } from './SpriteScale';

const BASE = 'https://pokeapi.co/api/v2';

// ── Caching ──────────────────────────────────────────────────────────────────
// Every battle used to re-fetch Pokémon + move data from the live PokeAPI, and
// each call is awaited during battle setup — so the very first battle (Bug Catcher
// Billy) froze while the network warmed up, and every later battle paid the same
// round-trip. We cache results in memory (instant within a session) and mirror
// them to localStorage (instant across reloads), so each species/move is fetched
// from the network at most once, ever.
const POKE_CACHE = 'pokeapi_pokemon_v4';   // v4: adds species height (real-scale battle sizing)
const MOVE_CACHE = 'pokeapi_move_v4';   // v4 adds major-status metadata for abilities and move effects
const SPECIES_CACHE = 'pokeapi_species_v1';
const ABILITY_CACHE = 'pokeapi_ability_v1';

const pokeMem = new Map<string, PokemonData>();
const moveMem = new Map<string, MoveData>();
const speciesMem = new Map<string, PokemonSpeciesInfo>();
const abilityMem = new Map<string, PokemonAbilityInfo>();

export interface PokemonSpeciesInfo {
  nameKo?: string;
}

export interface PokemonAbilityInfo {
  nameKo?: string;
}

function loadDisk<T>(key: string): Record<string, T> {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, T>; }
  catch { return {}; }
}
function saveDisk<T>(key: string, id: string, val: T) {
  try {
    const all = loadDisk<T>(key);
    all[id] = val;
    localStorage.setItem(key, JSON.stringify(all));
  } catch { /* quota / private mode — memory cache still applies */ }
}

/** Synchronous lookup used when migrating an older caught Pokémon whose party
 * entry predates persisted base stats. Encountered species are cached before
 * they can be caught, so migration does not need a network request. */
export function cachedPokemon(idOrName: number | string): PokemonData | undefined {
  const id = String(idOrName).toLowerCase();
  const mem = pokeMem.get(id);
  if (mem) { if (mem.heightDm) registerSpeciesHeight(mem.id, mem.heightDm); return mem; }
  const disk = loadDisk<PokemonData>(POKE_CACHE)[id];
  if (disk) { pokeMem.set(id, disk); if (disk.heightDm) registerSpeciesHeight(disk.id, disk.heightDm); }
  return disk;
}

export async function fetchPokemon(idOrName: number | string): Promise<PokemonData> {
  const id = String(idOrName).toLowerCase();
  const mem = pokeMem.get(id);
  if (mem) { if (mem.heightDm) registerSpeciesHeight(mem.id, mem.heightDm); return mem; }
  const disk = loadDisk<PokemonData>(POKE_CACHE)[id];
  if (disk) { pokeMem.set(id, disk); if (disk.heightDm) registerSpeciesHeight(disk.id, disk.heightDm); return disk; }

  const res = await fetch(`${BASE}/pokemon/${idOrName}`);
  if (!res.ok) throw new Error(`PokeAPI: pokemon "${idOrName}" not found`);
  const json = await res.json();

  const stat = (name: string) =>
    (json.stats as { base_stat: number; stat: { name: string } }[])
      .find(s => s.stat.name === name)?.base_stat ?? 45;

  const data: PokemonData = {
    id: json.id,
    name: json.name as string,
    ability: (json.abilities as { is_hidden: boolean; ability: { name: string } }[] | undefined)
      ?.find(a => !a.is_hidden)?.ability.name
      ?? json.abilities?.[0]?.ability?.name,
    type1: json.types[0].type.name as PokemonType,
    type2: json.types[1]?.type.name as PokemonType | undefined,
    baseHp:    stat('hp'),
    baseAtk:   stat('attack'),
    baseDef:   stat('defense'),
    baseSpAtk: stat('special-attack'),
    baseSpDef: stat('special-defense'),
    baseSpd:   stat('speed'),
    // Prefer the Pokémon HOME renders (portraits of the actual 3D models) over
    // the 96px pixel sprites — they extrude into far better 3D battlers and
    // match the game's 3D presentation. Fallback chain keeps older entries safe.
    spriteUrl: (json.sprites?.other?.home?.front_default
      ?? json.sprites?.other?.['official-artwork']?.front_default
      ?? json.sprites.front_default) as string,
    heightDm: Number(json.height) || undefined,
  };
  pokeMem.set(id, data);
  saveDisk(POKE_CACHE, id, data);
  if (data.heightDm) registerSpeciesHeight(data.id, data.heightDm);
  return data;
}

/** Korean species name used by menus and the status screen. Kept separate from
 * the battle-data request because PokeAPI exposes localized names on species. */
export async function fetchPokemonSpeciesInfo(idOrName: number | string): Promise<PokemonSpeciesInfo> {
  const id = String(idOrName).toLowerCase();
  const mem = speciesMem.get(id);
  if (mem) return mem;
  const disk = loadDisk<PokemonSpeciesInfo>(SPECIES_CACHE)[id];
  if (disk) { speciesMem.set(id, disk); return disk; }

  const res = await fetch(`${BASE}/pokemon-species/${idOrName}`);
  if (!res.ok) throw new Error(`PokeAPI: pokemon species "${idOrName}" not found`);
  const json = await res.json();
  const data: PokemonSpeciesInfo = {
    nameKo: (json.names as { name: string; language: { name: string } }[] | undefined)
      ?.find(n => n.language.name === 'ko')?.name,
  };
  speciesMem.set(id, data);
  saveDisk(SPECIES_CACHE, id, data);
  return data;
}

/** Localized display name for an official ability. */
export async function fetchPokemonAbilityInfo(idOrName: number | string): Promise<PokemonAbilityInfo> {
  const id = String(idOrName).toLowerCase();
  const mem = abilityMem.get(id);
  if (mem) return mem;
  const disk = loadDisk<PokemonAbilityInfo>(ABILITY_CACHE)[id];
  if (disk) { abilityMem.set(id, disk); return disk; }

  const res = await fetch(`${BASE}/ability/${idOrName}`);
  if (!res.ok) throw new Error(`PokeAPI: ability "${idOrName}" not found`);
  const json = await res.json();
  const data: PokemonAbilityInfo = {
    nameKo: (json.names as { name: string; language: { name: string } }[] | undefined)
      ?.find(n => n.language.name === 'ko')?.name,
  };
  abilityMem.set(id, data);
  saveDisk(ABILITY_CACHE, id, data);
  return data;
}

/**
 * Warm the cache for a set of Pokémon in the background (fire-and-forget).
 * Requests are staggered so we don't burst PokeAPI (which rate-limits), and
 * anything already cached is skipped for free by fetchPokemon. Call this from
 * an overworld scene so the first battle there doesn't pay a cold network fetch.
 * Errors (e.g. offline) are swallowed — battles still fetch on demand as before.
 */
const warmedSprites = new Set<string>();
/** Pull a sprite into the browser's HTTP cache so Phaser's loader gets it instantly later. */
function warmSprite(url: string) {
  if (!url || warmedSprites.has(url)) return;
  warmedSprites.add(url);
  const img = new Image();
  img.src = url;   // decode/keep in cache; not attached to the DOM
}

export function prefetchPokemon(ids: (number | string)[], gapMs = 140): void {
  const todo = ids.filter(id => !pokeMem.has(String(id).toLowerCase()));
  todo.forEach((id, i) => {
    setTimeout(() => {
      // Warm the data, then the remote sprite image — the two things a battle
      // awaits on. Both are cached, so the fight starts without a network stall.
      void fetchPokemon(id).then(d => warmSprite(d.spriteUrl)).catch(() => {});
    }, i * gapMs);
  });
}

export async function fetchMove(idOrName: number | string): Promise<MoveData> {
  const id = String(idOrName).toLowerCase();
  const mem = moveMem.get(id);
  if (mem) return mem;
  const disk = loadDisk<MoveData>(MOVE_CACHE)[id];
  if (disk) { moveMem.set(id, disk); return disk; }

  const res = await fetch(`${BASE}/move/${idOrName}`);
  if (!res.ok) throw new Error(`PokeAPI: move "${idOrName}" not found`);
  const json = await res.json();
  // PokeAPI represents draining attacks with a positive meta.drain value and
  // recoil attacks with a negative one. Preserve both halves instead of
  // clamping recoil (for example Brave Bird's -33) away.
  const drainPercent = Number(json.meta?.drain ?? 0);

  const data: MoveData = {
    name:     json.name as string,
    type:     json.type.name as PokemonType,
    category: json.damage_class.name as MoveData['category'],
    power:    (json.power as number) ?? 0,
    accuracy: (json.accuracy as number) ?? 100,
    pp:       json.pp as number,
    priority: Number(json.priority ?? 0),
    healing:  Math.max(0, Number(json.meta?.healing ?? 0)),
    drain:    Math.max(0, drainPercent),
    recoil:   Math.max(0, -drainPercent),
    statChanges: (json.stat_changes as { change: number; stat: { name: string } }[] ?? [])
      .map(s => ({ stat: ({
        attack: 'atk', defense: 'def', 'special-attack': 'spAtk',
        'special-defense': 'spDef', speed: 'spd', accuracy: 'accuracy', evasion: 'evasion',
      } as Record<string, import('../battle/Pokemon').BattleStat>)[s.stat.name], change: s.change }))
      .filter((s): s is import('../battle/Pokemon').MoveStatChange => !!s.stat),
    effectTarget: /user|users-field/.test(String(json.target?.name ?? ''))
      || String(json.meta?.category?.name ?? '') === 'damage+raise' ? 'user' : 'target',
    effectChance: Number(json.effect_chance ?? json.meta?.stat_chance ?? 100) || 100,
    statusCondition: ({
      paralysis: 'par', burn: 'brn', poison: 'psn', 'bad-poison': 'psn',
      sleep: 'slp', freeze: 'frz',
    } as Record<string, string>)[String(json.meta?.ailment?.name ?? '')],
    statusChance: String(json.meta?.ailment?.name ?? 'none') !== 'none'
      ? (Number(json.meta?.ailment_chance ?? 0) > 0
        ? Number(json.meta.ailment_chance)
        : String(json.meta?.category?.name ?? '') === 'ailment' ? 100 : Number(json.effect_chance ?? 0))
      : undefined,
    twoTurn: ({ fly: 'air', bounce: 'air', dig: 'underground', dive: 'underground',
      'solar-beam': 'charge', 'solar-blade': 'charge', 'sky-attack': 'charge',
      'phantom-force': 'charge', 'shadow-force': 'charge' } as Record<string, MoveData['twoTurn']>)[String(json.name).toLowerCase()],
  };
  moveMem.set(id, data);
  saveDisk(MOVE_CACHE, id, data);
  return data;
}
