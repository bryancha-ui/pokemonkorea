export type IceSportId = 'short-track' | 'speed-skating' | 'figure-skating';
export type FigureMove = 'left' | 'right' | 'up' | 'down' | 'spin';

export interface IceSportTrial {
  id: IceSportId;
  index: number;
  startCol: number;
  startRow: number;
  prerequisiteTrainerKey?: 'seorae-nunsong' | 'seorae-baram';
}

export const ICE_SPORT_TRIALS: readonly IceSportTrial[] = [
  { id: 'short-track', index: 0, startCol: 10, startRow: 27 },
  { id: 'speed-skating', index: 1, startCol: 10, startRow: 19, prerequisiteTrainerKey: 'seorae-nunsong' },
  { id: 'figure-skating', index: 2, startCol: 10, startRow: 10, prerequisiteTrainerKey: 'seorae-baram' },
] as const;

/** The routine is demonstrated first, then repeated with directions and A/SPACE for spins. */
export const FIGURE_SKATING_SEQUENCE: readonly FigureMove[] = [
  'left', 'right', 'up', 'spin', 'down', 'spin',
] as const;

export function iceSportClearedFlag(trial: IceSportTrial): string {
  return `seoraeIceSportCleared_${trial.id}`;
}

export function iceSportCleared(trial: IceSportTrial, read: (key: string) => unknown): boolean {
  if (read('seoraeGymDefeated') || read(iceSportClearedFlag(trial))) return true;
  // Trainer victories are durable legacy checkpoints from the original Gym.
  if (trial.id === 'short-track') {
    return !!read('trainerDefeated_seorae-nunsong') || !!read('trainerDefeated_seorae-baram');
  }
  if (trial.id === 'speed-skating') return !!read('trainerDefeated_seorae-baram');
  return false;
}

export function iceSportUnlocked(trial: IceSportTrial, read: (key: string) => unknown): boolean {
  return !trial.prerequisiteTrainerKey
    || !!read('seoraeGymDefeated')
    || !!read(`trainerDefeated_${trial.prerequisiteTrainerKey}`);
}

export function iceArenaComplete(read: (key: string) => unknown): boolean {
  return STAGE_ORDER.every(id => {
    const trial = ICE_SPORT_TRIALS.find(entry => entry.id === id)!;
    return iceSportCleared(trial, read);
  });
}

export function iceArenaClearedCount(read: (key: string) => unknown): number {
  return ICE_SPORT_TRIALS.filter(trial => iceSportCleared(trial, read)).length;
}

export const STAGE_ORDER: readonly IceSportId[] = ['short-track', 'speed-skating', 'figure-skating'] as const;

/** Clockwise oval: lean toward the infield only while entering either tight bend. */
export function shortTrackRequiredLean(angle: number): -1 | 0 | 1 {
  const curve = Math.cos(angle);
  if (curve > 0.55) return -1;
  if (curve < -0.55) return 1;
  return 0;
}

export function advanceShortTrackBalance(
  balance: number,
  angle: number,
  inputLean: number,
  dt: number,
): number {
  const requiredLean = shortTrackRequiredLean(angle);
  const change = requiredLean === 0 ? 0.08
    : inputLean === requiredLean ? 0.32
      : inputLean === 0 ? -0.3 : -0.62;
  return Math.max(0, Math.min(1, balance + change * Math.max(0, dt)));
}

export function nextSpeedStride(expected: 'left' | 'right', pressed: 'left' | 'right'):
{ correct: boolean; next: 'left' | 'right' } {
  return { correct: pressed === expected, next: pressed === 'left' ? 'right' : 'left' };
}

/** Old Gym victories and Trainer checkpoints must never reopen a completed event gate. */
export function reconcileIceArenaProgress(
  read: (key: string) => unknown,
  write: (key: string, value: unknown) => void,
): number {
  if (read('seoraeGymDefeated')) {
    for (const trial of ICE_SPORT_TRIALS) write(iceSportClearedFlag(trial), true);
  } else {
    if (read('trainerDefeated_seorae-nunsong')) write(iceSportClearedFlag(ICE_SPORT_TRIALS[0]), true);
    if (read('trainerDefeated_seorae-baram')) {
      write(iceSportClearedFlag(ICE_SPORT_TRIALS[0]), true);
      write(iceSportClearedFlag(ICE_SPORT_TRIALS[1]), true);
    }
  }
  return iceArenaClearedCount(read);
}
