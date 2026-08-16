export type BossTrainerRank = 'gym' | 'elite' | 'champion';

interface HealableBattler {
  hp: number;
  maxHp: number;
  heal(amount: number): void;
}

export interface BossPotionUse {
  itemName: 'Super Potion' | 'Hyper Potion' | 'Max Potion';
  healed: number;
}

interface PotionRule {
  maxUses: number;
  hpThreshold: number;
  chance: number;
}

const RULES: Record<BossTrainerRank, PotionRule> = {
  gym:      { maxUses: 1, hpThreshold: 0.38, chance: 0.42 },
  elite:    { maxUses: 2, hpThreshold: 0.42, chance: 0.50 },
  champion: { maxUses: 2, hpThreshold: 0.45, chance: 0.58 },
};

/**
 * Per-battle healing-item AI for major trainers. A successful use consumes the
 * trainer's turn, and each roster slot can receive at most one potion so a
 * low-HP opponent never stalls the battle by healing on consecutive turns.
 */
export class BossPotionAI {
  private usesRemaining: number;
  private readonly treatedSlots = new Set<number>();

  constructor(private readonly rank: BossTrainerRank) {
    this.usesRemaining = RULES[rank].maxUses;
  }

  tryUse(mon: HealableBattler, rosterSlot: number, roll = Math.random()): BossPotionUse | undefined {
    const rule = RULES[this.rank];
    if (this.usesRemaining <= 0 || this.treatedSlots.has(rosterSlot)) return undefined;
    if (mon.hp <= 0 || mon.maxHp <= 0 || mon.hp >= mon.maxHp) return undefined;

    const hpRatio = mon.hp / mon.maxHp;
    if (hpRatio > rule.hpThreshold) return undefined;
    // Critical HP makes a potion more likely, but never guaranteed.
    const chance = hpRatio <= 0.20 ? Math.min(0.78, rule.chance + 0.18) : rule.chance;
    if (roll >= chance) return undefined;

    const itemName: BossPotionUse['itemName'] = this.rank === 'champion'
      ? 'Max Potion'
      : this.rank === 'elite' || mon.maxHp > 120 ? 'Hyper Potion' : 'Super Potion';
    const amount = itemName === 'Max Potion' ? mon.maxHp
      : itemName === 'Hyper Potion' ? 120 : 60;
    const before = mon.hp;
    mon.heal(amount);

    this.usesRemaining--;
    this.treatedSlots.add(rosterSlot);
    return { itemName, healed: mon.hp - before };
  }
}
