import Phaser from 'phaser';

const KEY = 'pedometerSteps';

/** Persistent, save-backed count of real map tiles travelled by the player. */
export const PedometerSystem = {
  get(registry: Phaser.Data.DataManager): number {
    return Math.max(0, Math.floor(Number(registry.get(KEY)) || 0));
  },

  add(registry: Phaser.Data.DataManager, steps: number): number {
    const amount = Math.max(0, Math.floor(steps));
    const total = this.get(registry) + amount;
    if (amount) registry.set(KEY, total);
    return total;
  },
};
