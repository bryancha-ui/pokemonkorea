/**
 * Evolution logic: detect when a party Pokémon is ready to evolve,
 * and apply the evolution to the stored party entry.
 */
import Phaser from 'phaser';
import { EVOLUTIONS, findForm } from '../data/StarterData';
import { POKEDEX, dexEntry, dexKeyFor } from '../data/Pokedex';
import { customForm, isCustomKey } from '../data/CustomBattle';
import { PartySystem, PartyEntry, baseStatsFromData, recomputeMaxHp } from './PartySystem';
import { syncEntryMoves } from './PartyBattle';
import { hpAfterMaxHpIncrease } from '../battle/LevelUpHp';
import { STONE_EVOLUTIONS } from '../data/EvolutionStones';
export { STONE_EVOLUTIONS } from '../data/EvolutionStones';

// Combine starter evolutions with custom Pokédex evolution lines.
const ALL_EVOLUTIONS: Record<string, { to: string; toName: string; level: number; addMoves?: string[] }> = { ...EVOLUTIONS };
for (const e of POKEDEX) {
  if (isCustomKey(e.key) && e.evolvesTo && e.evolvesAtLevel) {
    const toEntry = POKEDEX.find(p => p.key === e.evolvesTo);
    ALL_EVOLUTIONS[e.key] = { to: e.evolvesTo, toName: toEntry?.name ?? e.evolvesTo, level: e.evolvesAtLevel };
  }
}

export interface PendingEvolution {
  slot:     number;
  fromKey:  string;
  fromName: string;
  toKey:    string;
  toName:   string;
  addMoves?: string[];
  stoneKey?: string;
}

const PENDING_STONE = 'pendingStoneEvolution';

export function stoneEvolutionFor(entry: PartyEntry, stoneKey: string): PendingEvolution | null {
  const rule = STONE_EVOLUTIONS.find(candidate =>
    candidate.stoneKey === stoneKey && candidate.fromKey === entry.spriteKey,
  );
  if (!rule) return null;
  const target = dexEntry(rule.toKey);
  return {
    slot: -1,
    fromKey: entry.spriteKey,
    fromName: entry.name,
    toKey: rule.toKey,
    toName: target?.name ?? rule.toKey,
    stoneKey,
  };
}

/** Queue a stone evolution for EvolutionScene. The caller consumes the stone
 * only when this succeeds. */
export function queueStoneEvolution(
  registry: Phaser.Data.DataManager,
  slot: number,
  stoneKey: string,
): PendingEvolution | null {
  const entry = PartySystem.get(registry)[slot];
  if (!entry) return null;
  const pending = stoneEvolutionFor(entry, stoneKey);
  if (!pending) return null;
  pending.slot = slot;
  registry.set(PENDING_STONE, JSON.stringify(pending));
  return pending;
}

function pendingStoneEvolution(registry: Phaser.Data.DataManager): PendingEvolution | null {
  const raw = registry.get(PENDING_STONE) as string | undefined;
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw) as PendingEvolution;
    const current = PartySystem.get(registry)[pending.slot];
    if (!current || current.spriteKey !== pending.fromKey || !pending.stoneKey) {
      registry.remove(PENDING_STONE);
      return null;
    }
    return pending;
  } catch {
    registry.remove(PENDING_STONE);
    return null;
  }
}

/** Find the first party slot whose Pokémon has reached its evolution level. */
export function findPendingEvolution(registry: Phaser.Data.DataManager): PendingEvolution | null {
  const stone = pendingStoneEvolution(registry);
  if (stone) return stone;
  const party = PartySystem.get(registry);
  for (let i = 0; i < party.length; i++) {
    const e   = party[i];
    const evo = ALL_EVOLUTIONS[e.spriteKey];
    // Only evolve when the Pokémon has actually LEVELED UP (evoReady) — not the instant
    // it's caught already past its evolve level.
    if (evo && e.level >= evo.level && e.evoReady) {
      return { slot: i, fromKey: e.spriteKey, fromName: e.name, toKey: evo.to, toName: evo.toName, addMoves: evo.addMoves };
    }
  }
  return null;
}

export function hasPendingEvolution(registry: Phaser.Data.DataManager): boolean {
  return findPendingEvolution(registry) !== null;
}

/** Apply an evolution to the stored party entry (mutates the saved party). */
export function applyEvolution(registry: Phaser.Data.DataManager, pending: PendingEvolution): void {
  const party = PartySystem.get(registry);
  const e: PartyEntry | undefined = party[pending.slot];
  if (!e) return;

  const form = findForm(pending.toKey);
  const cf   = customForm(pending.toKey);
  e.spriteKey = pending.toKey;
  e.name      = pending.toName;
  // Localized name and ability are species-specific. Do not retain the
  // pre-evolution profile; MenuScene will hydrate missing official metadata.
  delete e.nameKo;
  delete e.nameJa;
  delete e.abilityKo;
  delete e.abilityJa;
  if (form) {
    e.spriteUrl = form.data.spriteUrl;
    e.type1 = form.data.type1;
    e.type2 = form.data.type2;
    e.baseStats = baseStatsFromData(form.data);
  } else if (cf) {
    e.spriteUrl = cf.data.spriteUrl;
    e.type1 = cf.data.type1;
    e.type2 = cf.data.type2;
    e.baseStats = baseStatsFromData(cf.data);
  } else {
    // Dex-only / PokéAPI Pokémon — resolve via the canonical dex key
    // (e.g. a party `wild-148` maps to the `api-148` dex entry).
    const de = dexEntry(pending.toKey) ?? dexEntry(dexKeyFor(pending.toKey));
    e.spriteUrl = de?.spriteUrl ?? `assets/dex/${pending.toKey}.png`;
    if (de) { e.type1 = de.type1; if (de.type2) e.type2 = de.type2; }
  }
  e.ability = form?.ability ?? cf?.data.ability
    ?? dexEntry(pending.toKey)?.ability ?? dexEntry(dexKeyFor(pending.toKey))?.ability;
  // Moves learned on evolving — append, dedupe, keep the 4 most recent so the
  // newly-learned skills are always retained.
  if (pending.addMoves?.length) {
    for (const mv of pending.addMoves) {
      if (!e.moves.some(m => m.toLowerCase() === mv.toLowerCase())) e.moves.push(mv);
    }
  }
  // Refresh the stored move list to the evolved form's level-appropriate kit,
  // while keeping any taught HMs / signature moves already known.
  syncEntryMoves(e);
  const oldMax = e.maxHp;
  e.maxHp = recomputeMaxHp(e);
  // Carry HP forward, adding the maxHp gained
  e.hp = hpAfterMaxHpIncrease(e.hp, oldMax, e.maxHp);
  delete e.evoReady;   // consumed — the next evolution needs another level-up
  PartySystem.set(registry, party);
  if (pending.stoneKey) registry.remove(PENDING_STONE);

  // Slot 0 is the active starter — keep legacy registry keys in sync
  if (pending.slot === 0) {
    registry.set('starterKey',  pending.toKey);
    registry.set('starterName', pending.toName);
  }
}

/**
 * If a party Pokémon is ready to evolve, launch the EvolutionScene as an
 * overlay and pause the calling scene. The EvolutionScene resumes it when done.
 */
export function maybeLaunchEvolution(scene: Phaser.Scene): boolean {
  if (hasPendingEvolution(scene.registry)) {
    scene.scene.launch('EvolutionScene', { parentKey: scene.scene.key });
    scene.scene.pause();
    return true;
  }
  return false;
}
