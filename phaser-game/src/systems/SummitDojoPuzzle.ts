export interface SummitCounterweight {
  id: 'lower' | 'upper' | 'summit';
  row: number;
  startCol: number;
  targetCol: number;
  trainerKey?: 'baekdu-taeguk' | 'baekdu-nari';
}

/** Two movable counterweights and the fixed summit marker they must line up with. */
export const SUMMIT_COUNTERWEIGHTS: readonly SummitCounterweight[] = [
  { id: 'lower', row: 8.5, startCol: 5.35, targetCol: 8.5, trainerKey: 'baekdu-taeguk' },
  { id: 'upper', row: 4.5, startCol: 10.85, targetCol: 8.5, trainerKey: 'baekdu-nari' },
  { id: 'summit', row: 3.05, startCol: 8.5, targetCol: 8.5 },
] as const;

export function summitWeightAlignmentFlag(weight: SummitCounterweight): string {
  return `baekduWeightAligned_${weight.id}`;
}

export function summitWeightTrainerDefeated(
  weight: SummitCounterweight,
  read: (key: string) => unknown,
): boolean {
  return !weight.trainerKey || !!read('baekduGymDefeated') || !!read(`trainerDefeated_${weight.trainerKey}`);
}

/** Imported/legacy badge saves are authoritative even if their animation flag predates the puzzle. */
export function summitWeightVisuallyAligned(
  weight: SummitCounterweight,
  read: (key: string) => unknown,
): boolean {
  return !weight.trainerKey || !!read('baekduGymDefeated') || !!read(summitWeightAlignmentFlag(weight));
}

export function summitPassageComplete(read: (key: string) => unknown): boolean {
  return SUMMIT_COUNTERWEIGHTS
    .filter(weight => !!weight.trainerKey)
    .every(weight => summitWeightTrainerDefeated(weight, read));
}
