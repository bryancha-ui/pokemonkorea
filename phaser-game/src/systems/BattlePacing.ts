import Phaser from 'phaser';
import { hpColor } from './ProductionUi';

/** Shared battle rhythm tuned against the supplied Scarlet/Violet clip. */
export const BATTLE_PACING = Object.freeze({
  // The first cinematic pass matched the clip literally but felt too slow in
  // repeated play. These are that pass at roughly 1.4× speed: readable, yet brisk.
  dialogCharacterMs: 14,
  dialogHoldMs: 440,
  effectWindupMs: 155,
  threeDEffectTimeScale: 0.95,
  physicalLungeMs: 300,
  specialProjectileMs: 540,
  impactHoldMs: 120,
  hpDrainMinMs: 630,
  hpDrainMaxMs: 1290,
  hpSettleMs: 200,
});

/** Match a Three.js effect's impact after the shared anticipation beat. */
export function cinematic3DImpactDelay(originalMs: number): number {
  return BATTLE_PACING.effectWindupMs
    + Math.round(originalMs / BATTLE_PACING.threeDEffectTimeScale);
}

interface BattleHpAnimationOptions {
  scene: Phaser.Scene;
  bar: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  maxWidth: number;
  targetHp: number;
  maxHp: number;
  onDone: () => void;
  /** Healing and level-up feedback can opt out of the post-impact pause. */
  impactDelayMs?: number;
}

/**
 * Replace a battler's HUD immediately when a different Pokémon is sent out.
 * This intentionally bypasses the damage/heal tween: a switch-in must reveal
 * its authoritative current HP at once instead of looking as if it recovered.
 */
export function snapBattleHp(
  bar: Phaser.GameObjects.Rectangle,
  label: Phaser.GameObjects.Text,
  maxWidth: number,
  hp: number,
  maxHp: number,
): void {
  const safeMaxHp = Math.max(1, Math.round(maxHp));
  const safeHp = Phaser.Math.Clamp(Math.round(hp), 0, safeMaxHp);
  const ratio = safeHp / safeMaxHp;
  bar.width = maxWidth * ratio;
  bar.fillColor = hpColor(ratio);
  label.setText(`${safeHp}/${safeMaxHp}`);
}

/**
 * Drain (or refill) HP with readable number ticks and a damage-sized duration.
 * Large knockout hits therefore carry more weight than small chip damage.
 */
export function animateBattleHp({
  scene, bar, label, maxWidth, targetHp, maxHp, onDone,
  impactDelayMs = BATTLE_PACING.impactHoldMs,
}: BattleHpAnimationOptions): void {
  const safeMaxHp = Math.max(1, Math.round(maxHp));
  const safeTargetHp = Phaser.Math.Clamp(Math.round(targetHp), 0, safeMaxHp);
  const targetRatio = safeTargetHp / safeMaxHp;
  const targetWidth = Math.max(0, targetRatio * maxWidth);
  const currentWidth = Phaser.Math.Clamp(Number(bar.width) || 0, 0, maxWidth);
  const currentRatio = maxWidth > 0 ? currentWidth / maxWidth : targetRatio;
  const match = label.text.match(/(\d+)\s*\/\s*(\d+)/);
  const parsedHp = match ? Number.parseInt(match[1], 10) : NaN;
  const startHp = Number.isFinite(parsedHp)
    ? Phaser.Math.Clamp(parsedHp, 0, safeMaxHp)
    : Math.round(currentRatio * safeMaxHp);
  const changeRatio = Math.abs(targetRatio - currentRatio);
  const weight = Phaser.Math.Clamp(changeRatio / 0.72, 0, 1);
  const duration = Math.round(Phaser.Math.Linear(
    BATTLE_PACING.hpDrainMinMs,
    BATTLE_PACING.hpDrainMaxMs,
    weight,
  ));

  const startTween = () => {
    const proxy = { hp: startHp, width: currentWidth };
    scene.tweens.add({
      targets: proxy,
      hp: safeTargetHp,
      width: targetWidth,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        const shownHp = Phaser.Math.Clamp(Math.round(proxy.hp), 0, safeMaxHp);
        const shownRatio = maxWidth > 0 ? proxy.width / maxWidth : shownHp / safeMaxHp;
        bar.width = Math.max(0, proxy.width);
        bar.fillColor = hpColor(shownRatio);
        label.setText(`${shownHp}/${safeMaxHp}`);
      },
      onComplete: () => {
        bar.width = targetWidth;
        bar.fillColor = hpColor(targetRatio);
        label.setText(`${safeTargetHp}/${safeMaxHp}`);
        scene.time.delayedCall(BATTLE_PACING.hpSettleMs, onDone);
      },
    });
  };

  if (impactDelayMs > 0) scene.time.delayedCall(impactDelayMs, startTween);
  else startTween();
}
