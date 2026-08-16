/**
 * Carry battle damage through a max-HP change. Leveling from 35 max HP to 39
 * therefore adds exactly four current HP, regardless of how injured the
 * Pokémon was, instead of silently restoring it to full health.
 */
export function hpAfterMaxHpIncrease(
  currentHp: number,
  previousMaxHp: number,
  nextMaxHp: number,
): number {
  const hp = Number.isFinite(currentHp) ? currentHp : 0;
  const previous = Number.isFinite(previousMaxHp) ? previousMaxHp : nextMaxHp;
  return Math.min(nextMaxHp, Math.max(0, hp + (nextMaxHp - previous)));
}
