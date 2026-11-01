import Phaser from 'phaser';
import { drawNpcBody } from '../data/CharacterSprite';
import { markTrainerPortrait } from '../data/BattlePortraits';
import { tr } from './i18n';

/**
 * The Champion's recurring story arc.  These keys deliberately live in one
 * place: old saves can encounter any missed beat on a later visit, while a new
 * journey sees the scenes in their authored order.
 */
export const HWANGEUM_STORY = {
  met: 'hwangeumMet',
  gorgeRescue: 'hwangeumGorgeRescueSeen',
  contest: 'hwangeumContestDone',
  forestGuard: 'hwangeumForestGuardSeen',
  jejuRescue: 'hwangeumJejuRescueSeen',
  leagueInvitation: 'hwangeumLeagueInvitationSeen',
} as const;

export type HwangeumStoryBeat = typeof HWANGEUM_STORY[keyof typeof HWANGEUM_STORY];

export interface HwangeumActor {
  graphic: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  walkTo(
    x: number,
    y: number,
    lookAt: { x: number; y: number } | undefined,
    onComplete: () => void,
    duration?: number,
  ): void;
  destroy(): void;
}

/** Mark a meeting and its individual story beat together. */
export function recordHwangeumBeat(
  registry: Phaser.Data.DataManager,
  beat: HwangeumStoryBeat,
): void {
  registry.set(HWANGEUM_STORY.met, true);
  registry.set(beat, true);
}

/** Number of pre-League appearances the player has personally witnessed. */
export function hwangeumMeetingCount(registry: Phaser.Data.DataManager): number {
  return [
    HWANGEUM_STORY.gorgeRescue,
    HWANGEUM_STORY.contest,
    HWANGEUM_STORY.forestGuard,
    HWANGEUM_STORY.jejuRescue,
    HWANGEUM_STORY.leagueInvitation,
  ].filter(flag => !!registry.get(flag)).length;
}

/**
 * Spawn the same authored Champion in every overworld scene.  The compact 2D
 * body remains the collision/dialogue marker; OverworldMirror reads the
 * portrait tag and replaces it with npc_hwangeum's dedicated 3D figure.
 */
export function spawnHwangeum(
  scene: Phaser.Scene,
  x: number,
  y: number,
  options: {
    depth?: number;
    lookAt?: { x: number; y: number };
    label?: boolean;
    entering?: boolean;
  } = {},
): HwangeumActor {
  const depth = options.depth ?? 19;
  const graphic = scene.add.graphics().setPosition(x, y).setDepth(depth);
  drawNpcBody(graphic, 0x14181e, { hair: 0x342a57, skin: 0xf0c8a0 });
  // Gold champion sash and shoulder lights distinguish the 2D fallback too.
  graphic.fillStyle(0xe0b52e, 1);
  graphic.fillRect(-8, -6, 3, 12);
  graphic.fillRect(5, -8, 3, 4);
  markTrainerPortrait(graphic, 'champion-hwangeum');
  graphic.setData('characterGender3D', 'boy');
  if (options.lookAt) graphic.setData('characterLookAt3D', options.lookAt);

  const label = scene.add.text(x, y - 27, tr('Champion Hwangeum'), {
    fontSize: '8px', color: '#ffe47a', backgroundColor: '#000000aa',
    padding: { x: 3, y: 1 }, align: 'center',
  }).setOrigin(0.5).setDepth(depth + 1).setVisible(options.label !== false);
  if (options.entering) {
    graphic.setAlpha(0);
    label.setAlpha(0);
  }

  return {
    graphic,
    label,
    walkTo: (targetX, targetY, lookAt, onComplete, duration = 950) => {
      // Keep the 3D mirror pointed along the approach path while the 2D marker,
      // its 3D replacement and the nameplate all move as one actor.
      graphic.setData('characterLookAt3D', { x: targetX, y: targetY });
      scene.tweens.add({
        targets: graphic,
        x: targetX,
        y: targetY,
        alpha: 1,
        duration,
        ease: 'Linear',
        onUpdate: () => label.setPosition(graphic.x, graphic.y - 27).setAlpha(graphic.alpha),
        onComplete: () => {
          label.setPosition(targetX, targetY - 27);
          if (lookAt) graphic.setData('characterLookAt3D', lookAt);
          onComplete();
        },
      });
    },
    destroy: () => { graphic.destroy(); label.destroy(); },
  };
}
