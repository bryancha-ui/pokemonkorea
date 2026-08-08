import type { MoveData } from '../battle/Pokemon';

/**
 * Production signature moves for the three remastered final evolutions.
 * Keeping these definitions shared prevents the player, rival and custom-trainer
 * battle builders from drifting onto different balance or effect metadata.
 */
export const SOUL_FERRY_DELUGE: MoveData = {
  name: 'Soul-Ferry Deluge',
  type: 'ghost',
  category: 'special',
  power: 105,
  accuracy: 100,
  pp: 5,
  drain: 50,
};

export const OUTLAW_LEAFSTORM: MoveData = {
  name: 'Outlaw Leafstorm',
  type: 'grass',
  category: 'physical',
  power: 105,
  accuracy: 100,
  pp: 5,
  statChanges: [{ stat: 'def', change: -1 }],
  effectTarget: 'target',
  effectChance: 30,
};

export const ROYAL_KILN_ROAR: MoveData = {
  name: 'Royal Kiln Roar',
  type: 'fire',
  category: 'special',
  power: 110,
  accuracy: 90,
  pp: 5,
  statusCondition: 'brn',
  statusChance: 30,
  statChanges: [{ stat: 'spDef', change: -1 }],
  effectTarget: 'target',
  effectChance: 30,
};

export const SIGNATURE_MOVE_BY_SPECIES: Readonly<Record<string, MoveData>> = {
  thanatoat: SOUL_FERRY_DELUGE,
  banderado: OUTLAW_LEAFSTORM,
  pipetiger: ROYAL_KILN_ROAR,
};
