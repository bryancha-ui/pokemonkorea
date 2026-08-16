import Phaser from 'phaser';
import { t } from './i18n';

/**
 * Early-game objective guidance, shown as translucent white text in the top-left
 * corner so a new player always knows the next step. The active hint is derived
 * from story flags (not stored), so it updates automatically as the player
 * progresses and vanishes once the opening tutorial — receiving a starter — is
 * done. Add later objectives here as new `if` branches, most-recent first.
 */
export function currentQuestHint(registry: Phaser.Data.DataManager): string | null {
  // Tutorial complete once the player owns a starter — hand the game back over.
  if (registry.get('starterChosen')) return null;
  // After Mom mentions Professor Song, point the player at the lab.
  if (registry.get('metMomAboutSong')) {
    return t("Go to Prof. Song's Lab and choose your Pokémon!", '송 박사 연구소에 가서 포켓몬을 고르자!');
  }
  // Very first objective: nudge the player home to talk to Mom.
  return t("(Ugh, I'm exhausted… maybe I should head home first?)", '(아 피곤해.. 일단 집에 갈까?)');
}

/**
 * Mount the top-left quest guide onto a scene — call once in create(). The text
 * is screen-fixed and stays out of the way; it renders nothing when there is no
 * active objective. Re-derived on every scene create, so returning to a scene
 * always shows the current step.
 */
export function mountQuestHint(scene: Phaser.Scene): Phaser.GameObjects.Text | undefined {
  const hint = currentQuestHint(scene.registry);
  if (!hint) return undefined;
  return scene.add.text(12, 12, `▸ ${hint}`, {
    fontSize: '13px',
    color: '#ffffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
    wordWrap: { width: 340 },
  }).setOrigin(0, 0).setScrollFactor(0).setDepth(300).setAlpha(0.82);
}
