export type StrengthRune = 'circle' | 'triangle' | 'square';
export type StrengthBoulderId = 'granite' | 'basalt' | 'limestone';

export interface StrengthBoulderDef {
  id: StrengthBoulderId;
  rune: StrengthRune;
  startCol: number;
  startRow: number;
  targetCol: number;
  targetRow: number;
  accent: number;
}

export interface QuarryCell {
  col: number;
  row: number;
}

export interface StrengthPushResult {
  kind: 'move' | 'fill' | 'blocked';
  col: number;
  row: number;
  reason?: 'wall' | 'boulder' | 'chasm' | 'wrong-rune' | 'filled';
}

export const STRENGTH_QUARRY_WIDTH = 18;
export const STRENGTH_QUARRY_HEIGHT = 18;
export const STRENGTH_CHASM_ROWS = { min: 7, max: 8 } as const;

/** Three rune stones approach the fissure along separate, mutually safe lanes. */
export const STRENGTH_BOULDERS: readonly StrengthBoulderDef[] = [
  { id: 'granite', rune: 'circle', startCol: 5, startRow: 14, targetCol: 6, targetRow: 8, accent: 0x72c9ff },
  { id: 'basalt', rune: 'triangle', startCol: 8, startRow: 15, targetCol: 8, targetRow: 8, accent: 0xffbd62 },
  { id: 'limestone', rune: 'square', startCol: 12, startRow: 14, targetCol: 10, targetRow: 8, accent: 0xdf9cff },
] as const;

/** Quarry blocks shape three readable northbound pushing lanes without deadlocking them. */
export const STRENGTH_QUARRY_BLOCKS: readonly QuarryCell[] = [
  { col: 2, row: 13 }, { col: 3, row: 13 }, { col: 14, row: 13 }, { col: 15, row: 13 },
  { col: 3, row: 11 }, { col: 4, row: 11 }, { col: 13, row: 11 }, { col: 14, row: 11 },
  { col: 2, row: 9 }, { col: 4, row: 9 }, { col: 12, row: 9 }, { col: 14, row: 9 },
] as const;

export function strengthBoulderColKey(boulder: StrengthBoulderDef): string {
  return `dolmoeStrength_${boulder.id}_col`;
}

export function strengthBoulderRowKey(boulder: StrengthBoulderDef): string {
  return `dolmoeStrength_${boulder.id}_row`;
}

export function strengthBoulderFilledFlag(boulder: StrengthBoulderDef): string {
  return `dolmoeStrengthFilled_${boulder.id}`;
}

export function strengthBoulderPosition(
  boulder: StrengthBoulderDef,
  read: (key: string) => unknown,
): QuarryCell {
  if (read('dolmoeGymDefeated') || read(strengthBoulderFilledFlag(boulder))) {
    return { col: boulder.targetCol, row: boulder.targetRow };
  }
  const col = Number(read(strengthBoulderColKey(boulder)));
  const row = Number(read(strengthBoulderRowKey(boulder)));
  return {
    col: Number.isInteger(col) ? col : boulder.startCol,
    row: Number.isInteger(row) ? row : boulder.startRow,
  };
}

export function strengthBoulderFilled(
  boulder: StrengthBoulderDef,
  read: (key: string) => unknown,
): boolean {
  return !!read('dolmoeGymDefeated') || !!read(strengthBoulderFilledFlag(boulder));
}

export function strengthQuarrySolved(read: (key: string) => unknown): boolean {
  return !!read('dolmoeGymDefeated') || STRENGTH_BOULDERS.every(boulder => strengthBoulderFilled(boulder, read));
}

export function strengthQuarryFilledCount(read: (key: string) => unknown): number {
  return STRENGTH_BOULDERS.filter(boulder => strengthBoulderFilled(boulder, read)).length;
}

export function isStrengthQuarryBlock(col: number, row: number): boolean {
  return STRENGTH_QUARRY_BLOCKS.some(cell => cell.col === col && cell.row === row);
}

export function strengthHoleAt(col: number, row: number): StrengthBoulderDef | undefined {
  return STRENGTH_BOULDERS.find(boulder => boulder.targetCol === col && boulder.targetRow === row);
}

export function resolveStrengthPush(
  boulder: StrengthBoulderDef,
  deltaCol: number,
  deltaRow: number,
  read: (key: string) => unknown,
): StrengthPushResult {
  const current = strengthBoulderPosition(boulder, read);
  if (strengthBoulderFilled(boulder, read)) return { kind: 'blocked', ...current, reason: 'filled' };
  if (Math.abs(deltaCol) + Math.abs(deltaRow) !== 1) return { kind: 'blocked', ...current, reason: 'wall' };
  const col = current.col + deltaCol;
  const row = current.row + deltaRow;
  if (col <= 0 || col >= STRENGTH_QUARRY_WIDTH - 1 || row <= 0 || row >= STRENGTH_QUARRY_HEIGHT - 1
    || isStrengthQuarryBlock(col, row)) {
    return { kind: 'blocked', ...current, reason: 'wall' };
  }
  for (const other of STRENGTH_BOULDERS) {
    if (other.id === boulder.id) continue;
    const position = strengthBoulderPosition(other, read);
    if (position.col === col && position.row === row) return { kind: 'blocked', ...current, reason: 'boulder' };
  }
  const hole = strengthHoleAt(col, row);
  if (hole) {
    if (hole.id !== boulder.id || hole.rune !== boulder.rune) {
      return { kind: 'blocked', ...current, reason: 'wrong-rune' };
    }
    return { kind: 'fill', col, row };
  }
  if (row >= STRENGTH_CHASM_ROWS.min && row <= STRENGTH_CHASM_ROWS.max) {
    return { kind: 'blocked', ...current, reason: 'chasm' };
  }
  return { kind: 'move', col, row };
}

/** Completed badges predate this puzzle and must never respawn a sealed fissure. */
export function reconcileStrengthQuarryProgress(
  read: (key: string) => unknown,
  write: (key: string, value: unknown) => void,
): number {
  if (read('dolmoeGymDefeated')) {
    for (const boulder of STRENGTH_BOULDERS) {
      write(strengthBoulderColKey(boulder), boulder.targetCol);
      write(strengthBoulderRowKey(boulder), boulder.targetRow);
      write(strengthBoulderFilledFlag(boulder), true);
    }
  }
  return strengthQuarryFilledCount(read);
}
