import Phaser from 'phaser';
import { customForm } from '../data/CustomBattle';
import { cachedPokemon } from '../data/PokeAPI';
import { genderForPokemon, isLegendaryPokemon } from '../data/PokemonGender';
import { findForm } from '../data/StarterData';
import { dexEntry, dexKeyFor } from '../data/Pokedex';
import { DexTracker } from './DexTracker';
import { resolveJosa } from './i18n';
import { PartySystem, type PartyEntry, baseStatsFromData } from './PartySystem';

const STATE_KEY = 'pokemonNursery';
const ID_KEY = 'breedingIdCounter';
const DEFAULT_HATCH_STEPS = 640;

export type BreedingGender = 'male' | 'female' | 'genderless';
export type StorageSource = 'party' | 'box';

export interface NurseryParent {
  mon: PartyEntry;
  depositedFrom: StorageSource;
}

export interface NurseryEgg {
  child: PartyEntry;
  stepsRemaining: number;
  totalSteps: number;
}

export interface NurseryState {
  parents: NurseryParent[];
  eggProgress: number;
  eggReady?: NurseryEgg;
  carriedEgg?: NurseryEgg;
  totalSteps: number;
}

export interface Compatibility {
  compatible: boolean;
  rating: 'none' | 'normal' | 'excellent';
  requiredSteps: number;
  reason: string;
}

export interface BreedingCandidate {
  source: StorageSource;
  index: number;
  mon: PartyEntry;
  gender: BreedingGender;
}

export interface BreedingAdvanceResult {
  eggBecameReady: boolean;
  hatched?: { child: PartyEntry; destination: 'party' | 'box' };
}

const BASE_SPECIES: Record<string, string> = {
  munklift: 'munkain', banderado: 'munkain',
  scorpent: 'vipour', feldaconda: 'vipour',
  onnujang: 'onnurian', thanatoat: 'onnurian',
  'wild-148': 'wild-147', 'wild-149': 'wild-147',
};

function blankState(): NurseryState {
  return { parents: [], eggProgress: 0, totalSteps: 0 };
}

function readState(registry: Phaser.Data.DataManager): NurseryState {
  const raw = registry.get(STATE_KEY) as string | NurseryState | undefined;
  if (!raw) return blankState();
  try {
    const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<NurseryState>;
    const state: NurseryState = {
      parents: Array.isArray(parsed.parents) ? parsed.parents.slice(0, 2) : [],
      eggProgress: Math.max(0, Number(parsed.eggProgress) || 0),
      eggReady: parsed.eggReady,
      carriedEgg: parsed.carriedEgg,
      totalSteps: Math.max(0, Number(parsed.totalSteps) || 0),
    };
    // Repair saves made before Eggs occupied a party slot. Preserve every
    // Pokémon by moving overflow from slot six into the PC Box.
    if (state.carriedEgg) {
      const party = PartySystem.get(registry);
      if (party.length >= 6) {
        const overflow = party.splice(5);
        PartySystem.set(registry, party);
        overflow.forEach(mon => PartySystem.boxAdd(registry, mon));
      }
    }
    return state;
  } catch {
    return blankState();
  }
}

function writeState(registry: Phaser.Data.DataManager, state: NurseryState): void {
  registry.set(STATE_KEY, JSON.stringify(state));
}

function numericSpeciesId(entry: PartyEntry): number | undefined {
  const match = entry.spriteKey.match(/(?:wild-|api-|te-)?(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

function isDitto(entry: PartyEntry): boolean {
  return entry.name.toLowerCase() === 'ditto' || numericSpeciesId(entry) === 132;
}

function nextIdentity(registry: Phaser.Data.DataManager, prefix = 'pkm'): string {
  const next = Math.max(1, Number(registry.get(ID_KEY)) || 1);
  registry.set(ID_KEY, next + 1);
  return `${prefix}-${next}`;
}

function inferredGender(entry: PartyEntry): BreedingGender {
  return genderForPokemon({
    name: entry.name, key: entry.spriteKey, id: numericSpeciesId(entry), gender: entry.gender,
  }, entry.breedingId ?? entry.spriteUrl ?? entry.spriteKey) as BreedingGender;
}

function ensureEntryIdentity(registry: Phaser.Data.DataManager, entry: PartyEntry): boolean {
  let changed = false;
  if (!entry.gender) { entry.gender = inferredGender(entry); changed = true; }
  if (!entry.breedingId) { entry.breedingId = nextIdentity(registry); changed = true; }
  return changed;
}

function isLegendaryEntry(entry: PartyEntry): boolean {
  return isLegendaryPokemon({ name: entry.name, key: entry.spriteKey, id: numericSpeciesId(entry), gender: entry.gender });
}

function ensureStorageIdentities(registry: Phaser.Data.DataManager): void {
  const party = PartySystem.get(registry);
  const box = PartySystem.getBox(registry);
  let partyChanged = false, boxChanged = false;
  for (const mon of party) partyChanged = ensureEntryIdentity(registry, mon) || partyChanged;
  for (const mon of box) boxChanged = ensureEntryIdentity(registry, mon) || boxChanged;
  if (partyChanged) PartySystem.set(registry, party);
  if (boxChanged) PartySystem.setBox(registry, box);
}

function sharesType(a: PartyEntry, b: PartyEntry): boolean {
  const at = new Set([a.type1, a.type2].filter(Boolean));
  return [b.type1, b.type2].some(t => !!t && at.has(t));
}

function baseKey(entry: PartyEntry): string {
  return BASE_SPECIES[entry.spriteKey] ?? entry.spriteKey;
}

function speciesMatches(a: PartyEntry, b: PartyEntry): boolean {
  return baseKey(a) === baseKey(b);
}

function dataForKey(key: string) {
  const local = findForm(key)?.data ?? customForm(key)?.data;
  if (local) return local;
  const id = key.match(/(?:wild-|api-|te-)?(\d+)$/)?.[1];
  return id ? cachedPokemon(id) : undefined;
}

function childParent(a: PartyEntry, b: PartyEntry): PartyEntry {
  if (isDitto(a)) return b;
  if (isDitto(b)) return a;
  return a.gender === 'female' ? a : b;
}

function makeChild(registry: Phaser.Data.DataManager, a: PartyEntry, b: PartyEntry): PartyEntry {
  const source = childParent(a, b);
  const key = baseKey(source);
  const data = dataForKey(key);
  const inheritedMoves = [...new Set([
    ...(findForm(key)?.startingMoves.map(m => m.name) ?? customForm(key)?.moves.map(m => m.name) ?? []),
    ...(a.moves ?? []), ...(b.moves ?? []),
  ])].slice(0, 4);
  const stats = data ? baseStatsFromData(data) : source.baseStats;
  const baseHp = stats?.hp ?? 45;
  const maxHp = Math.floor(baseHp / 25) + 11;
  const breedingId = nextIdentity(registry, 'hatched');
  const child: PartyEntry = {
    name: data?.name ?? source.name,
    level: 1,
    hp: maxHp,
    maxHp,
    type1: data?.type1 ?? source.type1,
    type2: data?.type2 ?? source.type2,
    spriteKey: key,
    spriteUrl: data?.spriteUrl ?? source.spriteUrl,
    isCustom: !!findForm(key) || !!customForm(key) || source.isCustom,
    moves: inheritedMoves.length ? inheritedMoves : ['Tackle'],
    ability: data?.ability ?? findForm(key)?.ability ?? dexEntry(dexKeyFor(key))?.ability ?? source.ability,
    abilityKo: source.abilityKo,
    abilityJa: source.abilityJa,
    nameKo: source.nameKo,
    nameJa: source.nameJa,
    caughtAt: 'Pine Needle Pokémon Nursery',
    baseStats: stats ? { ...stats } : undefined,
    exp: 0,
    status: 'none',
    breedingId,
  };
  child.gender = inferredGender(child);
  return child;
}

function makeEgg(registry: Phaser.Data.DataManager, a: PartyEntry, b: PartyEntry): NurseryEgg {
  return { child: makeChild(registry, a, b), stepsRemaining: DEFAULT_HATCH_STEPS, totalSteps: DEFAULT_HATCH_STEPS };
}

export const BreedingSystem = {
  getState(registry: Phaser.Data.DataManager): NurseryState {
    return readState(registry);
  },

  genderOf(entry: PartyEntry): BreedingGender {
    return entry.gender ?? inferredGender(entry);
  },

  compatibility(a?: PartyEntry, b?: PartyEntry): Compatibility {
    if (!a || !b) return { compatible: false, rating: 'none', requiredSteps: 256, reason: '두 마리의 포켓몬을 맡겨야 합니다.' };
    if (isLegendaryEntry(a) || isLegendaryEntry(b)) {
      return { compatible: false, rating: 'none', requiredSteps: 256, reason: '전설의 포켓몬은 교배할 수 없습니다.' };
    }
    const aDitto = isDitto(a), bDitto = isDitto(b);
    if (aDitto && bDitto) return { compatible: false, rating: 'none', requiredSteps: 256, reason: '메타몽끼리는 알을 만들 수 없습니다.' };
    if (aDitto || bDitto) return { compatible: true, rating: 'normal', requiredSteps: 224, reason: '서로 사이가 좋아 보입니다.' };
    const ag = this.genderOf(a), bg = this.genderOf(b);
    if (ag === 'genderless' || bg === 'genderless') return { compatible: false, rating: 'none', requiredSteps: 256, reason: '이 조합에서는 알이 발견되지 않습니다.' };
    if (ag === bg) return { compatible: false, rating: 'none', requiredSteps: 256, reason: '서로 같은 성별이라 알을 만들 수 없습니다.' };
    if (!sharesType(a, b)) return { compatible: false, rating: 'none', requiredSteps: 256, reason: '서로의 알 그룹이 달라 보입니다.' };
    if (speciesMatches(a, b)) return { compatible: true, rating: 'excellent', requiredSteps: 160, reason: '둘은 아주 사이가 좋습니다!' };
    return { compatible: true, rating: 'normal', requiredSteps: 256, reason: '둘은 제법 사이가 좋습니다.' };
  },

  candidates(registry: Phaser.Data.DataManager): BreedingCandidate[] {
    ensureStorageIdentities(registry);
    const party = PartySystem.get(registry);
    const box = PartySystem.getBox(registry);
    return [
      ...party.map((mon, index) => ({ source: 'party' as const, index, mon, gender: this.genderOf(mon) })),
      ...box.map((mon, index) => ({ source: 'box' as const, index, mon, gender: this.genderOf(mon) })),
    ];
  },

  deposit(registry: Phaser.Data.DataManager, source: StorageSource, index: number): { ok: boolean; message: string } {
    const state = readState(registry);
    if (state.parents.length >= 2) return { ok: false, message: '키우미집에는 두 마리까지만 맡길 수 있습니다.' };
    ensureStorageIdentities(registry);
    const list = source === 'party' ? PartySystem.get(registry) : PartySystem.getBox(registry);
    if (source === 'party' && list.length <= 1) return { ok: false, message: '동료 포켓몬은 최소 한 마리 남겨야 합니다.' };
    const mon = list.splice(index, 1)[0];
    if (!mon) return { ok: false, message: '선택한 포켓몬을 찾을 수 없습니다.' };
    if (source === 'party') {
      PartySystem.set(registry, list);
      PartySystem.syncStarterFromLead(registry);
    } else {
      PartySystem.setBox(registry, list);
    }
    state.parents.push({ mon, depositedFrom: source });
    state.eggProgress = 0;
    writeState(registry, state);
    return { ok: true, message: resolveJosa(`${mon.name}을(를) 키우미집에 맡겼습니다.`) };
  },

  withdraw(registry: Phaser.Data.DataManager, parentIndex: number): { ok: boolean; message: string } {
    const state = readState(registry);
    const parent = state.parents.splice(parentIndex, 1)[0];
    if (!parent) return { ok: false, message: '맡겨진 포켓몬이 없습니다.' };
    const inParty = PartySystem.add(registry, parent.mon);
    state.eggProgress = 0;
    writeState(registry, state);
    return { ok: true, message: resolveJosa(`${parent.mon.name}을(를) ${inParty ? '동료로' : '보관함으로'} 데려왔습니다.`) };
  },

  claimEgg(registry: Phaser.Data.DataManager): { ok: boolean; message: string } {
    const state = readState(registry);
    if (!state.eggReady) return { ok: false, message: '아직 발견된 알이 없습니다.' };
    if (state.carriedEgg) return { ok: false, message: '이미 부화 중인 알을 가지고 있습니다.' };
    if (!PartySystem.hasOpenSlot(registry)) {
      return { ok: false, message: '동료가 6마리라 알을 받을 수 없습니다. PC에 한 마리를 맡겨 빈자리를 만들어 주세요.' };
    }
    state.carriedEgg = state.eggReady;
    delete state.eggReady;
    state.eggProgress = 0;
    writeState(registry, state);
    return { ok: true, message: '포켓몬의 알을 받았습니다! 걸으면서 알을 부화시켜 보세요.' };
  },

  hasStepWork(registry: Phaser.Data.DataManager): boolean {
    const state = readState(registry);
    return !!state.carriedEgg || (state.parents.length === 2 && !state.eggReady);
  },

  advanceSteps(registry: Phaser.Data.DataManager, steps: number): BreedingAdvanceResult {
    const state = readState(registry);
    const amount = Math.max(0, Math.floor(steps));
    const result: BreedingAdvanceResult = { eggBecameReady: false };
    if (!amount) return result;
    state.totalSteps += amount;

    if (state.carriedEgg) {
      state.carriedEgg.stepsRemaining = Math.max(0, state.carriedEgg.stepsRemaining - amount);
      if (state.carriedEgg.stepsRemaining === 0) {
        const child = state.carriedEgg.child;
        // Release the Egg's reserved party slot before adding the hatchling.
        // Otherwise PartySystem correctly sees six occupied slots and sends the
        // newborn to the PC instead of replacing the Egg in-place.
        delete state.carriedEgg;
        writeState(registry, state);
        const inParty = PartySystem.add(registry, child);
        DexTracker.markCaught(registry, child.spriteKey);
        result.hatched = { child, destination: inParty ? 'party' : 'box' };
      }
    }

    if (state.parents.length === 2 && !state.eggReady) {
      const [a, b] = state.parents.map(p => p.mon);
      const match = this.compatibility(a, b);
      if (match.compatible) {
        state.eggProgress += amount;
        if (state.eggProgress >= match.requiredSteps) {
          state.eggReady = makeEgg(registry, a, b);
          state.eggProgress = 0;
          result.eggBecameReady = true;
        }
      }
    }

    writeState(registry, state);
    return result;
  },
};
