import Phaser from 'phaser';
import { STARTERS, findForm } from '../data/StarterData';
import { customForm } from '../data/CustomBattle';
import { DISGUIJAR_DATA } from '../data/CustomPokemon';
import { cachedPokemon } from '../data/PokeAPI';
import type { PokemonData } from '../battle/Pokemon';
import { genderForPokemon } from '../data/PokemonGender';
import { dexEntry, dexKeyFor, remasteredSpriteUrl } from '../data/Pokedex';

export interface PartyBaseStats {
  hp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  spd: number;
}

export function baseStatsFromData(data: PokemonData): PartyBaseStats {
  return {
    hp: data.baseHp, atk: data.baseAtk, def: data.baseDef,
    spAtk: data.baseSpAtk, spDef: data.baseSpDef, spd: data.baseSpd,
  };
}

export interface PartyEntry {
  name:     string;
  level:    number;
  hp:       number;
  maxHp:    number;
  type1:    string;
  type2?:   string;
  spriteKey: string;
  spriteUrl: string;
  isCustom: boolean;
  moves:    string[];
  battleMoves?: import('../battle/Pokemon').MoveData[];   // player-curated moveset (TM forget-choice); overrides auto-derived moves
  movePP?:  Record<string, number>;   // remaining PP per move name (persists across battles; cleared on heal)
  evoReady?: boolean;   // set on an actual level-up; evolution only triggers when this is true
  exp?:     number;   // per-slot EXP tracking
  status?:  string;   // 'none' | 'psn' | 'par' | 'brn' | 'frz' | 'slp'
  /** Species base stats, persisted so captures retain their battle identity. */
  baseStats?: PartyBaseStats;
  /** Stable daycare identity and sex. Added lazily for old saves. */
  breedingId?: string;
  gender?: 'male' | 'female' | 'genderless';
  /** Localized/profile metadata shown on the separate status screen. */
  ability?: string;
  abilityKo?: string;
  nameKo?: string;
  caughtAt?: string;
}

const KEY = 'party';
const NURSERY_KEY = 'pokemonNursery';
const MAX_PARTY_SLOTS = 6;

/** Eggs are stored in the nursery state until they hatch, but occupy a real
 * party slot for capacity purposes. Reading the small flag here avoids a
 * PartySystem ↔ BreedingSystem import cycle. */
function carriedEggOccupiesSlot(registry: Phaser.Data.DataManager): boolean {
  const raw = registry.get(NURSERY_KEY) as string | { carriedEgg?: unknown } | undefined;
  if (!raw) return false;
  try {
    const state = typeof raw === 'string' ? JSON.parse(raw) as { carriedEgg?: unknown } : raw;
    return !!state.carriedEgg;
  } catch { return false; }
}

/** Recompute maxHp for an entry from its form's base HP (matches Pokemon formula). */
export function recomputeMaxHp(entry: PartyEntry): number {
  const baseHp = entry.baseStats?.hp
    ?? (entry.spriteKey === 'disguijar' ? DISGUIJAR_DATA.baseHp : undefined)
    ?? findForm(entry.spriteKey)?.data.baseHp
    ?? customForm(entry.spriteKey)?.data.baseHp
    ?? 50;
  return Math.floor((baseHp * entry.level) / 25) + entry.level + 10;
}

function dataForEntry(entry: PartyEntry): PokemonData | undefined {
  if (entry.spriteKey === 'disguijar') return DISGUIJAR_DATA;
  const local = findForm(entry.spriteKey)?.data ?? customForm(entry.spriteKey)?.data;
  if (local) return local;
  const id = entry.spriteKey.match(/(?:wild-|api-|te-)?(\d+)$/)?.[1];
  return id ? cachedPokemon(id) : undefined;
}

/** Add missing stats to old saves and normalize invalid values. */
function ensureBaseStats(entry: PartyEntry): boolean {
  const current = entry.baseStats;
  if (current && [current.hp, current.atk, current.def, current.spAtk, current.spDef, current.spd]
    .every(v => Number.isFinite(v) && v > 0)) return false;
  const data = dataForEntry(entry);
  if (data) {
    entry.baseStats = baseStatsFromData(data);
  } else {
    // Last-resort migration if an older save's browser API cache was cleared.
    const hp = Math.max(10, Math.round((entry.maxHp - entry.level - 10) * 25 / Math.max(1, entry.level)));
    entry.baseStats = { hp, atk: 55, def: 55, spAtk: 55, spDef: 55, spd: 55 };
  }
  return true;
}

function ensureAllBaseStats(entries: PartyEntry[]): boolean {
  let changed = false;
  for (const entry of entries) {
    changed = ensureBaseStats(entry) || changed;
    const remastered = remasteredSpriteUrl(entry.spriteKey);
    if (remastered && entry.spriteUrl !== remastered) {
      entry.spriteUrl = remastered;
      changed = true;
    }
    // Old saves created starters with their entire authored four-move catalog
    // at level 5. Migrate only uncurated pre-level-7 local Pokémon; TM choices
    // already have battleMoves and are deliberately preserved.
    const earlyForm = findForm(entry.spriteKey);
    const earlySeed = earlyForm?.startingMoves[0]?.name;
    if (entry.level < 7 && earlySeed && !entry.battleMoves?.length
      && (entry.moves.length !== 1 || entry.moves[0]?.toLowerCase() !== earlySeed.toLowerCase())) {
      entry.moves = [earlySeed];
      changed = true;
    }
    if (!entry.gender) {
      const id = Number(entry.spriteKey.match(/(?:wild-|api-|te-)?(\d+)$/)?.[1]) || undefined;
      entry.gender = genderForPokemon({ name: entry.name, key: entry.spriteKey, id },
        entry.breedingId ?? entry.spriteUrl ?? entry.spriteKey);
      changed = true;
    }
    if (!entry.ability) {
      const ability = dataForEntry(entry)?.ability ?? findForm(entry.spriteKey)?.ability
        ?? dexEntry(dexKeyFor(entry.spriteKey))?.ability;
      if (ability) { entry.ability = ability; changed = true; }
    }
  }
  return changed;
}

export const PartySystem = {

  get(registry: Phaser.Data.DataManager): PartyEntry[] {
    const raw = registry.get(KEY) as string | undefined;
    if (!raw) return [];
    try {
      const party = JSON.parse(raw) as PartyEntry[];
      if (ensureAllBaseStats(party)) registry.set(KEY, JSON.stringify(party));
      return party;
    } catch { return []; }
  },

  set(registry: Phaser.Data.DataManager, party: PartyEntry[]): void {
    ensureAllBaseStats(party);
    registry.set(KEY, JSON.stringify(party));
  },

  initFromStarter(registry: Phaser.Data.DataManager): void {
    const existing = this.get(registry);
    if (existing.length > 0) return; // already initialised

    const name     = (registry.get('starterName') as string) ?? '';
    const level    = (registry.get('starterLevel') as number) ?? 5;
    const key      = (registry.get('starterKey')  as string) ?? '';
    if (!name) return;

    // Look up actual types and base HP from StarterData
    const def   = STARTERS.find(s => s.spriteKey === key);
    const baseHp = def?.data.baseHp ?? 45;
    const maxHp  = Math.floor((baseHp * level) / 25) + level + 10;
    const entry: PartyEntry = {
      name, level, hp: maxHp, maxHp,
      type1:    def?.data.type1  ?? 'normal',
      type2:    def?.data.type2,
      spriteKey: key,
      spriteUrl: `assets/${key}.jpg`,
      isCustom: true,
      moves: def?.startingMoves[0] ? [def.startingMoves[0].name] : [],
      ability: def?.ability,
      caughtAt: "Prof. Song's Lab",
      baseStats: def ? baseStatsFromData(def.data) : { hp: baseHp, atk: 45, def: 45, spAtk: 45, spDef: 45, spd: 45 },
      exp: 0,
    };
    this.set(registry, [entry]);
  },

  /** Number of occupied slots, including a carried nursery Egg. */
  occupiedSlots(registry: Phaser.Data.DataManager): number {
    return this.get(registry).length + (carriedEggOccupiesSlot(registry) ? 1 : 0);
  },

  hasOpenSlot(registry: Phaser.Data.DataManager): boolean {
    return this.occupiedSlots(registry) < MAX_PARTY_SLOTS;
  },

  /** Add to party; if all six slots (including an Egg) are occupied, store in the PC box instead.
   *  Returns 'party' or 'box' to tell the caller where it went. */
  add(registry: Phaser.Data.DataManager, entry: PartyEntry): boolean {
    const party = this.get(registry);
    if (party.length + (carriedEggOccupiesSlot(registry) ? 1 : 0) >= MAX_PARTY_SLOTS) {
      this.boxAdd(registry, entry);
      return false;
    }
    party.push(entry);
    this.set(registry, party);
    return true;
  },

  isFull(registry: Phaser.Data.DataManager): boolean {
    return this.occupiedSlots(registry) >= MAX_PARTY_SLOTS;
  },

  // ── PC Box storage ────────────────────────────────────────────────────────
  getBox(registry: Phaser.Data.DataManager): PartyEntry[] {
    const raw = registry.get('box') as string | undefined;
    if (!raw) return [];
    try {
      const box = JSON.parse(raw) as PartyEntry[];
      if (ensureAllBaseStats(box)) registry.set('box', JSON.stringify(box));
      return box;
    } catch { return []; }
  },
  setBox(registry: Phaser.Data.DataManager, box: PartyEntry[]): void {
    ensureAllBaseStats(box);
    registry.set('box', JSON.stringify(box));
  },
  boxAdd(registry: Phaser.Data.DataManager, entry: PartyEntry): void {
    const box = this.getBox(registry); box.push(entry); this.setBox(registry, box);
  },

  /** Swap a party slot with a box slot (or move box→party / party→box). */
  swapWithBox(registry: Phaser.Data.DataManager, partySlot: number, boxIdx: number): void {
    const party = this.get(registry);
    const box   = this.getBox(registry);
    const p = party[partySlot];
    const b = box[boxIdx];
    if (p && b) { party[partySlot] = b; box[boxIdx] = p; }
    this.set(registry, party); this.setBox(registry, box);
    if (partySlot === 0) this.syncStarterFromLead(registry);
  },
  /** Move a box Pokémon into the party (if room). Returns true on success. */
  boxToParty(registry: Phaser.Data.DataManager, boxIdx: number): boolean {
    const party = this.get(registry);
    if (party.length + (carriedEggOccupiesSlot(registry) ? 1 : 0) >= MAX_PARTY_SLOTS) return false;
    const box = this.getBox(registry);
    const mon = box.splice(boxIdx, 1)[0];
    if (!mon) return false;
    party.push(mon);
    this.set(registry, party); this.setBox(registry, box);
    return true;
  },
  /** Move a party Pokémon into the box (must keep at least 1 in party). */
  partyToBox(registry: Phaser.Data.DataManager, partySlot: number): boolean {
    const party = this.get(registry);
    if (party.length <= 1) return false;
    const mon = party.splice(partySlot, 1)[0];
    if (!mon) return false;
    this.boxAdd(registry, mon);
    this.set(registry, party);
    if (partySlot === 0) this.syncStarterFromLead(registry);   // lead removed → new lead
    return true;
  },

  /** Sync HP of slot 0 (active Pokémon) after battle */
  updateSlot0HP(registry: Phaser.Data.DataManager, hp: number): void {
    this.updateSlotHP(registry, 0, hp);
  },

  /** Sync HP of any slot after battle */
  updateSlotHP(registry: Phaser.Data.DataManager, slot: number, hp: number, status?: string): void {
    const party = this.get(registry);
    if (party[slot] !== undefined) {
      party[slot].hp = hp;
      if (status !== undefined) party[slot].status = status;
      this.set(registry, party);
    }
  },

  /** Sync level + exp + hp + maxHp of a slot. The party entry is the source of truth. */
  updateSlotProgress(
    registry: Phaser.Data.DataManager,
    slot: number, level: number, exp: number, hp: number, maxHp: number,
  ): void {
    const party = this.get(registry);
    if (party[slot] === undefined) return;
    if (level > party[slot].level) party[slot].evoReady = true;   // actually leveled up → allow evolution
    party[slot].level = level;
    party[slot].exp   = exp;
    party[slot].hp    = hp;
    party[slot].maxHp = maxHp;
    this.set(registry, party);
    // Keep legacy starter registry in sync for slot 0
    if (slot === 0) {
      registry.set('starterLevel', level);
      registry.set('starterExp',   exp);
    }
  },

  /** Award EXP to a party slot by data (works for benched Pokémon too).
   *  Applies the same level curve as the live Pokémon class (level² × 3) and
   *  recomputes HP on level-up. Returns the new level if it leveled, else null. */
  gainExpForSlot(registry: Phaser.Data.DataManager, slot: number, amount: number):
    { name: string; leveledTo: number | null } {
    const party = this.get(registry);
    const e = party[slot];
    if (!e) return { name: '', leveledTo: null };
    e.exp = (e.exp ?? 0) + amount;
    let leveled = false;
    while (e.exp >= e.level * e.level * 3 && e.level < 100) {
      e.exp -= e.level * e.level * 3;
      e.level += 1;
      leveled = true;
    }
    if (leveled) {
      e.maxHp = recomputeMaxHp(e);
      e.hp = e.maxHp;   // level-up fully restores HP
      e.evoReady = true;   // leveled up → allow evolution
    }
    this.set(registry, party);
    if (slot === 0) { registry.set('starterLevel', e.level); registry.set('starterExp', e.exp); }
    return { name: e.name, leveledTo: leveled ? e.level : null };
  },

  /** Make the party member at `index` the lead (slot 0), shifting the rest down.
   *  Keeps the legacy starter-mirror registry (key/level/exp) pointed at the new lead
   *  so battle scenes load the correct sprite and syncSlot0FromStarter stays consistent. */
  setLead(registry: Phaser.Data.DataManager, index: number): void {
    const party = this.get(registry);
    if (index <= 0 || index >= party.length) return;
    const [chosen] = party.splice(index, 1);
    party.unshift(chosen);
    this.set(registry, party);
    registry.set('starterKey',   chosen.spriteKey);
    registry.set('starterLevel', chosen.level);
    registry.set('starterExp',   chosen.exp ?? 0);
  },

  /** Before a battle, ensure slot 0's stored level/exp match the legacy starter registry
   *  (historical data may be stale). Returns nothing; mutates the party. */
  syncSlot0FromStarter(registry: Phaser.Data.DataManager): void {
    const party = this.get(registry);
    if (party[0] === undefined) return;
    const level = (registry.get('starterLevel') as number) ?? party[0].level;
    const exp   = (registry.get('starterExp')   as number) ?? party[0].exp ?? 0;
    if (party[0].level !== level || party[0].exp !== exp) {
      party[0].level = level;
      party[0].exp   = exp;
      party[0].maxHp = recomputeMaxHp(party[0]);
      party[0].hp    = Math.min(party[0].hp, party[0].maxHp);
      this.set(registry, party);
    }
  },

  /** Re-point the legacy starter-mirror registry (key/level/exp) at whatever is
   *  currently in slot 0. Call after any operation that replaces the lead directly
   *  (e.g. swapping a freshly-caught Pokémon into slot 0), otherwise the stale
   *  starterLevel gets forced back onto the new lead by syncSlot0FromStarter. */
  syncStarterFromLead(registry: Phaser.Data.DataManager): void {
    const p = this.get(registry)[0];
    if (!p) return;
    registry.set('starterKey',   p.spriteKey);
    registry.set('starterLevel', p.level);
    registry.set('starterExp',   p.exp ?? 0);
  },

  firstHealthy(registry: Phaser.Data.DataManager): PartyEntry | null {
    return this.get(registry).find(p => p.hp > 0) ?? null;
  },

  healAll(registry: Phaser.Data.DataManager): void {
    const party = this.get(registry);
    party.forEach(p => { p.hp = p.maxHp; p.status = 'none'; delete p.movePP; });   // restore HP, status AND PP
    this.set(registry, party);
  },

  /** Does any party member know the given move? */
  anyKnows(registry: Phaser.Data.DataManager, move: string): boolean {
    const m = move.toLowerCase();
    return this.get(registry).some(p => p.moves.some(x => x.toLowerCase() === m));
  },

  /** Teach a field move (e.g. Fly) to the party member at `index`. Appends the
   *  move if there's room, otherwise replaces the last slot. No-op if already known. */
  teachMove(registry: Phaser.Data.DataManager, index: number, move: string): void {
    const party = this.get(registry);
    const p = party[index];
    if (!p) return;
    if (p.moves.some(x => x.toLowerCase() === move.toLowerCase())) return;
    if (p.moves.length < 4) p.moves.push(move);
    else p.moves[3] = move;
    this.set(registry, party);
  },
};
