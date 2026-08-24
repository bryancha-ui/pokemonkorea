export type StormRodId = 'dawn' | 'gale' | 'zenith';
export type StormDirection = 0 | 1 | 2 | 3;
export type StormRodHeight = 0 | 1;

export interface StormRodDef {
  id: StormRodId;
  index: number;
  col: number;
  row: number;
  deckMinRow: number;
  deckMaxRow: number;
  startDirection: StormDirection;
  startHeight: StormRodHeight;
  targetDirection: StormDirection;
  targetHeight: StormRodHeight;
  prerequisiteTrainerKey?: 'sunrise-seongwoo' | 'sunrise-daehwi';
  accent: number;
}

export interface InsulatedPadDef {
  rodId: StormRodId;
  col: number;
  row: number;
}

export const STORM_RODS: readonly StormRodDef[] = [
  {
    id: 'dawn', index: 0, col: 6, row: 23,
    deckMinRow: 20, deckMaxRow: 27,
    startDirection: 0, startHeight: 1,
    targetDirection: 1, targetHeight: 0,
    accent: 0xffd34d,
  },
  {
    id: 'gale', index: 1, col: 14, row: 15,
    deckMinRow: 12, deckMaxRow: 19,
    startDirection: 2, startHeight: 0,
    targetDirection: 3, targetHeight: 1,
    prerequisiteTrainerKey: 'sunrise-seongwoo',
    accent: 0x68dcff,
  },
  {
    id: 'zenith', index: 2, col: 6, row: 8,
    deckMinRow: 4, deckMaxRow: 11,
    startDirection: 3, startHeight: 0,
    targetDirection: 0, targetHeight: 1,
    prerequisiteTrainerKey: 'sunrise-daehwi',
    accent: 0xd29aff,
  },
] as const;

export const STORM_INSULATED_PADS: readonly InsulatedPadDef[] = [
  { rodId: 'dawn', col: 10.5, row: 24.5 },
  { rodId: 'gale', col: 10.5, row: 16.5 },
  { rodId: 'zenith', col: 10.5, row: 8.5 },
] as const;

export function stormDirectionKey(rod: StormRodDef): string {
  return `sunriseStormRod_${rod.id}_direction`;
}

export function stormHeightKey(rod: StormRodDef): string {
  return `sunriseStormRod_${rod.id}_height`;
}

export function stormChargedFlag(rod: StormRodDef): string {
  return `sunriseStormRodCharged_${rod.id}`;
}

export function normalizeStormDirection(value: unknown, fallback: StormDirection = 0): StormDirection {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return (((Math.round(numeric) % 4) + 4) % 4) as StormDirection;
}

export function stormRodDirection(rod: StormRodDef, read: (key: string) => unknown): StormDirection {
  if (read('sunriseGymDefeated') || read(stormChargedFlag(rod))) return rod.targetDirection;
  return normalizeStormDirection(read(stormDirectionKey(rod)), rod.startDirection);
}

export function stormRodHeight(rod: StormRodDef, read: (key: string) => unknown): StormRodHeight {
  if (read('sunriseGymDefeated') || read(stormChargedFlag(rod))) return rod.targetHeight;
  const value = Number(read(stormHeightKey(rod)));
  return value === 0 || value === 1 ? value : rod.startHeight;
}

export function stormRodCharged(rod: StormRodDef, read: (key: string) => unknown): boolean {
  if (read('sunriseGymDefeated') || read(stormChargedFlag(rod))) return true;
  if (rod.id === 'dawn') {
    return !!read('trainerDefeated_sunrise-seongwoo') || !!read('trainerDefeated_sunrise-daehwi');
  }
  if (rod.id === 'gale') return !!read('trainerDefeated_sunrise-daehwi');
  return false;
}

export function stormRodConfigured(rod: StormRodDef, read: (key: string) => unknown): boolean {
  return stormRodDirection(rod, read) === rod.targetDirection
    && stormRodHeight(rod, read) === rod.targetHeight;
}

export function stormRodUnlocked(rod: StormRodDef, read: (key: string) => unknown): boolean {
  return !rod.prerequisiteTrainerKey
    || !!read('sunriseGymDefeated')
    || !!read(`trainerDefeated_${rod.prerequisiteTrainerKey}`);
}

export function activeStormRod(read: (key: string) => unknown): StormRodDef | undefined {
  return STORM_RODS.find(rod => stormRodUnlocked(rod, read) && !stormRodCharged(rod, read));
}

export function stormCliffChargedCount(read: (key: string) => unknown): number {
  return STORM_RODS.filter(rod => stormRodCharged(rod, read)).length;
}

export function stormCliffComplete(read: (key: string) => unknown): boolean {
  return STORM_RODS.every(rod => stormRodCharged(rod, read));
}

export function stormPadForRod(rod: StormRodDef): InsulatedPadDef {
  return STORM_INSULATED_PADS.find(pad => pad.rodId === rod.id)!;
}

export function isStandingOnInsulatedPad(
  rod: StormRodDef,
  col: number,
  row: number,
  radius = 0.82,
): boolean {
  const pad = stormPadForRod(rod);
  return Math.hypot(col - pad.col, row - pad.row) <= radius;
}

export function resolveStormStrike(
  rod: StormRodDef,
  safelyInsulated: boolean,
  read: (key: string) => unknown,
): 'charged' | 'misaligned' | 'shocked' {
  if (!safelyInsulated) return 'shocked';
  return stormRodConfigured(rod, read) ? 'charged' : 'misaligned';
}

/** Legacy Trainer and badge saves become authoritative electrical checkpoints. */
export function reconcileStormCliffProgress(
  read: (key: string) => unknown,
  write: (key: string, value: unknown) => void,
): number {
  if (read('sunriseGymDefeated')) {
    for (const rod of STORM_RODS) {
      write(stormDirectionKey(rod), rod.targetDirection);
      write(stormHeightKey(rod), rod.targetHeight);
      write(stormChargedFlag(rod), true);
    }
    write('sunriseStormElevatorRaised', true);
  } else {
    if (read('trainerDefeated_sunrise-seongwoo')) {
      const rod = STORM_RODS[0];
      write(stormDirectionKey(rod), rod.targetDirection);
      write(stormHeightKey(rod), rod.targetHeight);
      write(stormChargedFlag(rod), true);
    }
    if (read('trainerDefeated_sunrise-daehwi')) {
      for (const rod of STORM_RODS.slice(0, 2)) {
        write(stormDirectionKey(rod), rod.targetDirection);
        write(stormHeightKey(rod), rod.targetHeight);
        write(stormChargedFlag(rod), true);
      }
    }
  }
  return stormCliffChargedCount(read);
}
