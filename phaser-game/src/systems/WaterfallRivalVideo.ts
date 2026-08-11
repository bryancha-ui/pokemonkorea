import Phaser from 'phaser';
import { t } from './i18n';
import { fitCutsceneVideo } from './CutsceneVideoLayout';
import { MOBILE_ACTION_EVENT } from './TouchControls';

export type WaterfallRivalClip = 'stand-up' | 'girl-cheer';

const WATERFALL_RIVAL_VIDEO: Record<WaterfallRivalClip, string> = {
  'stand-up': 'assets/cutscenes/waterfall_rival_stand_up.mp4',
  // The girl is the encouraging focal character regardless of which trainer
  // the player selected; only the localized dialogue changes their story role.
  'girl-cheer': 'assets/cutscenes/waterfall_rival_boy_player.mp4',
} as const;

/**
 * Stream one muted Higgsfield epilogue clip. A codec or asset failure advances
 * to the next authored beat so the ending can never soft-lock.
 */
export function playWaterfallRivalClip(
  scene: Phaser.Scene,
  clip: WaterfallRivalClip,
  onComplete: () => void,
  onUnavailable: () => void,
): () => void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const video = scene.add.video(w / 2, h / 2);
  const backdrop = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 1);
  const touchLayer = scene.add.rectangle(w / 2, h / 2, w, h, 0xffffff, 0.001)
    .setInteractive({ useHandCursor: true });
  const hint = scene.add.text(w - 20, h - 18, t(
    'Tap / A / SPACE to skip',
    '탭 / A / SPACE: 건너뛰기',
  ), {
    fontSize: '15px', color: '#ffffff', backgroundColor: '#000000a8',
    padding: { x: 9, y: 5 },
  }).setOrigin(1, 1);
  const root = scene.add.container(0, 0, [backdrop, video, touchLayer, hint])
    .setScrollFactor(0).setDepth(1_000_000);

  let settled = false;
  let played = false;
  let lastActionAt = -Infinity;
  let fallbackTimer: Phaser.Time.TimerEvent | undefined;

  const dispose = (): boolean => {
    if (settled) return false;
    settled = true;
    fallbackTimer?.remove(false);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
    window.removeEventListener(MOBILE_ACTION_EVENT, action);
    touchLayer.off('pointerdown', action);
    if (video.isPlaying()) video.stop();
    root.destroy(true);
    return true;
  };
  const finish = () => {
    if (dispose()) onComplete();
  };
  const unavailable = () => {
    if (dispose()) onUnavailable();
  };
  const abort = () => { dispose(); };
  const fit = () => fitCutsceneVideo(scene, video);
  const playing = () => {
    played = true;
    fit();
    hint.setAlpha(0.38);
  };
  const action = () => {
    const now = performance.now();
    if (now - lastActionAt < 420 || settled) return;
    lastActionAt = now;
    if (video.touchLocked || !played || !video.isPlaying()) {
      video.setMute(true).setVolume(0);
      video.play(false);
      return;
    }
    finish();
  };

  video.once(Phaser.GameObjects.Events.VIDEO_COMPLETE, finish);
  video.once(Phaser.GameObjects.Events.VIDEO_ERROR, unavailable);
  video.once(Phaser.GameObjects.Events.VIDEO_UNSUPPORTED, unavailable);
  video.on(Phaser.GameObjects.Events.VIDEO_CREATED, fit);
  video.on(Phaser.GameObjects.Events.VIDEO_PLAY, playing);
  video.on(Phaser.GameObjects.Events.VIDEO_PLAYING, playing);
  video.on(Phaser.GameObjects.Events.VIDEO_LOCKED, () => {
    hint.setAlpha(1).setText(t('Tap or press A to play', '탭 또는 A 버튼을 눌러 재생'));
  });
  touchLayer.on('pointerdown', action);
  window.addEventListener(MOBILE_ACTION_EVENT, action);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);

  try {
    video.loadURL(WATERFALL_RIVAL_VIDEO[clip], false);
    video.setMute(true).setVolume(0);
    video.play(false);
  } catch (error) {
    console.warn(`[waterfall-finale] ${clip} movie unavailable; advancing:`, error);
    scene.time.delayedCall(0, unavailable);
  }

  fallbackTimer = scene.time.delayedCall(25_000, unavailable);
  return action;
}
