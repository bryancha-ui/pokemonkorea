import Phaser from 'phaser';
import { PartySystem } from '../systems/PartySystem';

export const RYEO_BATTLE_TEST_TEAM = [
  { id: 248, level: 51 },
  { id: 0, level: 51, custom: 'corrpanda' },
  { id: 0, level: 52, custom: 'martbadger' },
  { id: 462, level: 52 },
  { id: 373, level: 53 },
  { id: 381, level: 54 },
] as const;

/** Apply the same battle setup used by the post-capture Jeju Vents scene. */
export function configureRyeoBattleTest(registry: Phaser.Data.DataManager): void {
  PartySystem.healAll(registry);
  registry.set('ryeoBattleTest', true);
  registry.set('trainerName', 'Commander Ryeo');
  registry.set('trainerKey', 'jeju-ryeo-final');
  registry.set('trainerPokemon', JSON.stringify(RYEO_BATTLE_TEST_TEAM));
  registry.set('trainerExpPool', 3600);
  registry.set('trainerReturnScene', 'JejuVentScene');
  registry.set('trainerDefeated_jeju-ryeo-final', false);
  registry.set('ryeoDefeatScene', false);
  registry.set('commanderRyeoDefeated', false);
}
