export type LanternId = 'blossom' | 'moon' | 'starlight';
export type DancePadId = 'moon-step' | 'blossom-step' | 'star-step';

export interface LanternStageLantern {
  id: LanternId;
  trainerKey: 'geum-boram' | 'geum-junho' | 'geum-areum';
  col: number;
  row: number;
  color: number;
  initialRotation: number;
  targetRotation: number;
}

export interface LanternDancePad {
  id: DancePadId;
  col: number;
  row: number;
  color: number;
  symbol: 'moon' | 'blossom' | 'star';
}

/** Cardinal rotations: 0 north, 1 east, 2 south, 3 west. */
export const LANTERN_STAGE_LANTERNS: readonly LanternStageLantern[] = [
  { id: 'blossom', trainerKey: 'geum-boram', col: 3.2, row: 7, color: 0xff75c8, initialRotation: 0, targetRotation: 1 },
  { id: 'moon', trainerKey: 'geum-junho', col: 13.8, row: 7, color: 0x69d9ff, initialRotation: 2, targetRotation: 3 },
  { id: 'starlight', trainerKey: 'geum-areum', col: 8.5, row: 10.6, color: 0xffd45c, initialRotation: 1, targetRotation: 0 },
] as const;

export const LANTERN_DANCE_PADS: readonly LanternDancePad[] = [
  { id: 'moon-step', col: 6.35, row: 4.75, color: 0x69d9ff, symbol: 'moon' },
  { id: 'blossom-step', col: 8.5, row: 4.75, color: 0xff75c8, symbol: 'blossom' },
  { id: 'star-step', col: 10.65, row: 4.75, color: 0xffd45c, symbol: 'star' },
] as const;

export const LANTERN_DANCE_SEQUENCE: readonly DancePadId[] = [
  'moon-step', 'blossom-step', 'star-step', 'blossom-step',
] as const;

export function normalizeLanternRotation(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  const rotation = Number.isFinite(numeric) ? Math.round(numeric) : fallback;
  return ((rotation % 4) + 4) % 4;
}

export function lanternLitFlag(lantern: LanternStageLantern): string {
  return `geumgangLanternLit_${lantern.id}`;
}

export function lanternRotationFlag(lantern: LanternStageLantern): string {
  return `geumgangLanternRotation_${lantern.id}`;
}

export function lanternTrainerDefeated(
  lantern: LanternStageLantern,
  read: (key: string) => unknown,
): boolean {
  return !!read('geumgangGymDefeated') || !!read(`trainerDefeated_${lantern.trainerKey}`);
}

export function lanternVisuallyLit(
  lantern: LanternStageLantern,
  read: (key: string) => unknown,
): boolean {
  return !!read('geumgangGymDefeated') || !!read(lanternLitFlag(lantern));
}

export function lanternRotation(
  lantern: LanternStageLantern,
  read: (key: string) => unknown,
): number {
  if (read('geumgangGymDefeated')) return lantern.targetRotation;
  return normalizeLanternRotation(read(lanternRotationFlag(lantern)), lantern.initialRotation);
}

export function lanternAligned(
  lantern: LanternStageLantern,
  read: (key: string) => unknown,
): boolean {
  return lanternVisuallyLit(lantern, read) && lanternRotation(lantern, read) === lantern.targetRotation;
}

export function allLanternTrainersDefeated(read: (key: string) => unknown): boolean {
  return LANTERN_STAGE_LANTERNS.every(lantern => lanternTrainerDefeated(lantern, read));
}

export function allLanternsAligned(read: (key: string) => unknown): boolean {
  return LANTERN_STAGE_LANTERNS.every(lantern => lanternAligned(lantern, read));
}

export function lanternDanceComplete(read: (key: string) => unknown): boolean {
  return !!read('geumgangGymDefeated') || !!read('geumgangLanternDanceComplete');
}
