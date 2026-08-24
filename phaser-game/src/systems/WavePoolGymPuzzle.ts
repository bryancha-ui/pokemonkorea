export type WaveCourseId = 'shore-break' | 'cross-current' | 'storm-swell';

export interface WavePoolCourse {
  id: WaveCourseId;
  index: number;
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
  minRow: number;
  maxRow: number;
  durationMs: number;
  waveForce: number;
  controlForce: number;
  frequency: number;
  unlockTrainerKey?: 'haean-haedo' | 'haean-byungchan';
  destinationTrainerKey?: 'haean-haedo' | 'haean-byungchan';
  encounter: { custom: string; level: number; catchRate: number };
}

/**
 * Courses run south → north. Their dry finish platforms hold Haedo, Byungchan
 * and finally Harang; each Trainer victory releases the next wave generator.
 */
export const WAVE_POOL_COURSES: readonly WavePoolCourse[] = [
  {
    id: 'shore-break', index: 0,
    startCol: 8, startRow: 14.72, endCol: 8, endRow: 11.3,
    minRow: 11.42, maxRow: 14.55,
    durationMs: 3600, waveForce: 1.08, controlForce: 3.25, frequency: 2.35,
    destinationTrainerKey: 'haean-haedo',
    encounter: { custom: 'ottershaman', level: 26, catchRate: 110 },
  },
  {
    id: 'cross-current', index: 1,
    startCol: 8, startRow: 10.22, endCol: 8, endRow: 7.0,
    minRow: 7.12, maxRow: 10.08,
    durationMs: 4200, waveForce: 1.44, controlForce: 3.35, frequency: 2.85,
    unlockTrainerKey: 'haean-haedo', destinationTrainerKey: 'haean-byungchan',
    encounter: { custom: 'paratoxin', level: 28, catchRate: 95 },
  },
  {
    id: 'storm-swell', index: 2,
    startCol: 8, startRow: 5.82, endCol: 8, endRow: 2.72,
    minRow: 2.84, maxRow: 5.68,
    durationMs: 4800, waveForce: 1.82, controlForce: 3.5, frequency: 3.35,
    unlockTrainerKey: 'haean-byungchan',
    encounter: { custom: 'frysm', level: 30, catchRate: 80 },
  },
] as const;

export function waveCourseClearedFlag(course: WavePoolCourse): string {
  return `haeanWaveCleared_${course.id}`;
}

export function waveCourseCleared(course: WavePoolCourse, read: (key: string) => unknown): boolean {
  return !!read('haeanGymDefeated') || !!read(waveCourseClearedFlag(course));
}

export function waveCourseUnlocked(course: WavePoolCourse, read: (key: string) => unknown): boolean {
  return !course.unlockTrainerKey
    || !!read('haeanGymDefeated')
    || !!read(`trainerDefeated_${course.unlockTrainerKey}`);
}

export function waveGymComplete(read: (key: string) => unknown): boolean {
  return WAVE_POOL_COURSES.every(course => waveCourseCleared(course, read));
}

/** New geometry must never strand a save that already reached a checkpoint Trainer. */
export function reconcileWaveGymProgress(
  read: (key: string) => unknown,
  write: (key: string, value: unknown) => void,
): number {
  if (read('haeanGymDefeated')) {
    for (const course of WAVE_POOL_COURSES) write(waveCourseClearedFlag(course), true);
  } else {
    if (read('trainerDefeated_haean-haedo')) write(waveCourseClearedFlag(WAVE_POOL_COURSES[0]), true);
    if (read('trainerDefeated_haean-byungchan')) {
      write(waveCourseClearedFlag(WAVE_POOL_COURSES[0]), true);
      write(waveCourseClearedFlag(WAVE_POOL_COURSES[1]), true);
    }
  }
  return WAVE_POOL_COURSES.filter(course => waveCourseCleared(course, read)).length;
}
