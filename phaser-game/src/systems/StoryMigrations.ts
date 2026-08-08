import Phaser from 'phaser';
import { customForm } from '../data/CustomBattle';
import { baseStatsFromData, PartyEntry, PartySystem, recomputeMaxHp } from './PartySystem';

/**
 * Early versions of Chapter 11 accidentally awarded 환웅 at Cheonji even though
 * the story consistently calls that encounter the Spirit of Cheonji. Besides
 * breaking the lore, owning 환웅 made the later Sacred Peak finale skip itself.
 * Convert that one legacy reward in place while preserving its level, EXP and HP
 * ratio. New saves record `phase2Legendary = cheonjisin` and never enter here.
 */
export function migrateLegacyCheonjiCapture(registry: Phaser.Data.DataManager): boolean {
  if (registry.get('phase2Legendary') !== 'hwanwoong') return false;
  if (registry.get('cheonjiLegendaryMigrationDone')) return false;

  const form = customForm('cheonjisin');
  if (!form) return false;

  const convert = (entry: PartyEntry): PartyEntry => {
    if (entry.spriteKey !== 'hwanwoong') return entry;
    const hpRatio = entry.maxHp > 0 ? entry.hp / entry.maxHp : 1;
    const converted: PartyEntry = {
      ...entry,
      name: form.data.name,
      nameKo: '천지신',
      type1: form.data.type1,
      type2: form.data.type2,
      spriteKey: 'cheonjisin',
      spriteUrl: form.data.spriteUrl,
      moves: form.moves.map(move => move.name),
      battleMoves: undefined,
      movePP: undefined,
      ability: form.data.ability,
      baseStats: baseStatsFromData(form.data),
      gender: 'genderless',
      caughtAt: 'Cheonji Lake — Baekdu Peak',
    };
    converted.maxHp = recomputeMaxHp(converted);
    converted.hp = entry.hp <= 0 ? 0 : Math.max(1, Math.round(converted.maxHp * hpRatio));
    return converted;
  };

  PartySystem.set(registry, PartySystem.get(registry).map(convert));
  PartySystem.setBox(registry, PartySystem.getBox(registry).map(convert));

  for (const key of ['dexCaught', 'dexSeen']) {
    try {
      const values = JSON.parse((registry.get(key) as string | undefined) ?? '[]') as string[];
      registry.set(key, JSON.stringify([...new Set(values.map(value => value === 'hwanwoong' ? 'cheonjisin' : value))]));
    } catch { /* leave malformed legacy data to the normal save recovery path */ }
  }

  registry.set('phase2Legendary', 'cheonjisin');
  registry.set('cheonjiLegendaryMigrationDone', true);

  // A legacy 환웅 could make Sacred Peak mark the true ending complete before
  // its shrines or final battle ran. Re-open that finale when the boss is absent.
  if (!registry.get('trainerDefeated_nosdan-sovereign')) {
    registry.set('trueEndDone', false);
    registry.set('partIIDone', false);
    registry.remove('finalePartyPending');
  }
  return true;
}
