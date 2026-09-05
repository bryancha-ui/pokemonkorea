import Phaser from 'phaser';

export const PENDING_POST_BATTLE_REWARD = 'pendingPostBattleReward';

export interface PendingPostBattleReward {
  badgeFlag: string;
  badgeName: string;
  tmName?: string;
  returnScene: string;
}

export function queuePostBattleReward(
  registry: Phaser.Data.DataManager,
  reward: PendingPostBattleReward,
): void {
  registry.set(PENDING_POST_BATTLE_REWARD, JSON.stringify(reward));
}

export function pendingPostBattleReward(
  registry: Phaser.Data.DataManager,
): PendingPostBattleReward | null {
  const raw = registry.get(PENDING_POST_BATTLE_REWARD) as string | undefined;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingPostBattleReward>;
    if (!parsed.badgeFlag || !parsed.badgeName || !parsed.returnScene) throw new Error('invalid reward payload');
    return parsed as PendingPostBattleReward;
  } catch {
    registry.remove(PENDING_POST_BATTLE_REWARD);
    return null;
  }
}

export function clearPostBattleReward(registry: Phaser.Data.DataManager): void {
  registry.remove(PENDING_POST_BATTLE_REWARD);
}

/** Launch the award overlay only after the battle scene has stopped and the
 * authored return map is active. Keeping this global makes all eight gyms obey
 * the same ordering without patching every map's create() lifecycle. */
export function installPostBattleRewards(game: Phaser.Game): void {
  let launching = false;
  const check = () => {
    const rewardSceneActive = game.scene.isActive('PostBattleRewardScene');
    // SceneManager.run() is queued until the next scene-manager update. Keep
    // the latch closed across that frame so a fast POST_STEP cannot enqueue a
    // duplicate overlay before the first one becomes active.
    if (launching) {
      if (!rewardSceneActive) return;
      launching = false;
    }
    if (rewardSceneActive) return;
    const pending = pendingPostBattleReward(game.registry);
    if (!pending) return;
    const parent = game.scene.getScenes(true).find(scene => scene.scene.key === pending.returnScene);
    if (!parent || (parent as Phaser.Scene & { __deferredScene?: boolean }).__deferredScene) return;
    launching = true;
    game.scene.run('PostBattleRewardScene', { parentKey: pending.returnScene });
  };
  game.events.on(Phaser.Core.Events.POST_STEP, check);
}
