import Phaser from 'phaser';
import { t } from './i18n';

/**
 * Early-game objective guidance, shown as a translucent white notification widget
 * (with a "!" badge) in the top-left corner so a new player always knows the next
 * step. The active hint is derived from story flags (not stored), so it updates
 * automatically as the player progresses and vanishes once the opening tutorial —
 * receiving a starter — is done. Add later objectives as new `if` branches.
 */
export function currentQuestHint(registry: Phaser.Data.DataManager): string | null {
  // Tutorial complete once the player owns a starter — hand the game back over.
  if (registry.get('starterChosen')) return null;
  // After Mom mentions Professor Song, point the player at the lab.
  if (registry.get('metMomAboutSong')) {
    return t("Head to Prof. Song's Lab and get your Pokémon!", '송 박사 연구소로 가서 포켓몬을 받자!');
  }
  // Very first objective: the protagonist muses about swinging by home first.
  return t("Phew, I'm beat… maybe I'll swing by home first?", '아 피곤하네, 잠깐 집에 들를까?');
}

/**
 * Mount the top-left quest guide widget onto a scene — call once in create(). It
 * is screen-fixed and renders nothing when there is no active objective. Re-derived
 * on every scene create, so returning to a scene always shows the current step.
 */
export function mountQuestHint(scene: Phaser.Scene): Phaser.GameObjects.Container | undefined {
  const hint = currentQuestHint(scene.registry);
  if (!hint) return undefined;

  const padX = 11, padY = 9, badgeR = 12, gap = 10, wrap = 300;
  const textX = padX + badgeR * 2 + gap;

  const label = scene.add.text(0, 0, hint, {
    fontSize: '13px', color: '#16233b', fontStyle: 'bold',
    wordWrap: { width: wrap }, lineSpacing: 3,
  }).setOrigin(0, 0);

  const boxW = textX + Math.min(wrap, Math.ceil(label.width)) + padX;
  const boxH = Math.max(badgeR * 2 + padY * 2, Math.ceil(label.height) + padY * 2);
  label.setPosition(textX, (boxH - label.height) / 2);

  // Frosted white translucent panel.
  const panel = scene.add.graphics();
  panel.fillStyle(0xffffff, 0.72); panel.fillRoundedRect(0, 0, boxW, boxH, 9);
  panel.lineStyle(1.5, 0xffffff, 0.9); panel.strokeRoundedRect(0, 0, boxW, boxH, 9);

  // Gold "!" quest badge.
  const cx = padX + badgeR, cy = boxH / 2;
  const badge = scene.add.graphics();
  badge.fillStyle(0xffcf3a, 1); badge.fillCircle(cx, cy, badgeR);
  badge.lineStyle(1.5, 0x9a6a00, 0.75); badge.strokeCircle(cx, cy, badgeR);
  const bang = scene.add.text(cx, cy - 1, '!', {
    fontSize: '16px', color: '#5a3a00', fontStyle: 'bold',
  }).setOrigin(0.5);

  const widget = scene.add.container(12, 12, [panel, badge, bang, label]);
  widget.setScrollFactor(0).setDepth(400);
  // A soft entrance so the notification "pops" when it changes.
  widget.setAlpha(0).setScale(0.96);
  scene.tweens.add({ targets: widget, alpha: 1, scale: 1, duration: 260, ease: 'Back.out' });
  return widget;
}
