import Phaser from 'phaser';
import { tr } from './i18n';

export const HWANUNG_ENTRANCE_VIDEO_KEY = 'hwanung-entrance-final';
const HWANUNG_ENTRANCE_VIDEO_URL = 'assets/cutscenes/hwanung_entrance_final.mp4';

/** Queue the shared Hwanung entrance movie without duplicating its video-cache entry. */
export function preloadHwanungEntranceVideo(scene: Phaser.Scene) {
  if (!scene.cache.video.exists(HWANUNG_ENTRANCE_VIDEO_KEY)) {
    scene.load.video(HWANUNG_ENTRANCE_VIDEO_KEY, HWANUNG_ENTRANCE_VIDEO_URL);
  }
}

/**
 * Play the generated 16:9 entrance movie as a screen-space cutscene.
 *
 * Returns the SPACE / tap action used by the owning scene. Unsupported media,
 * loading errors, autoplay restrictions and scene shutdowns are all handled so
 * the finale can never be left soft-locked by the optional movie.
 */
export function playHwanungEntranceVideo(
  scene: Phaser.Scene,
  onComplete: () => void,
  onDisposed?: () => void,
): (() => void) | undefined {
  if (!scene.cache.video.exists(HWANUNG_ENTRANCE_VIDEO_KEY)) {
    scene.time.delayedCall(0, onComplete);
    return undefined;
  }

  const W = scene.scale.width, H = scene.scale.height;
  const cx = W / 2, cy = H / 2;
  const zoom = scene.cameras.main.zoom || 1;
  const screenScale = 1 / zoom;

  const backdrop = scene.add.rectangle(cx, cy, W, H, 0x000000, 1);
  const video = scene.add.video(cx, cy, HWANUNG_ENTRANCE_VIDEO_KEY).setDisplaySize(W, H);
  const touchLayer = scene.add.rectangle(cx, cy, W, H, 0xffffff, 0.001)
    .setInteractive({ useHandCursor: true });
  const hint = scene.add.text(W - 24, H - 22, tr('탭 / SPACE: 건너뛰기'), {
    fontSize: '16px', color: '#ffffff', backgroundColor: '#00000099',
    padding: { x: 9, y: 5 },
  }).setOrigin(1, 1);
  const root = scene.add.container(0, 0, [backdrop, video, touchLayer, hint])
    .setScrollFactor(0).setDepth(500)
    .setScale(screenScale)
    .setPosition(cx * (1 - screenScale), cy * (1 - screenScale));

  let settled = false;
  let fallbackTimer: Phaser.Time.TimerEvent | undefined;
  let musicPaused = false;

  const dispose = () => {
    if (settled) return false;
    settled = true;
    fallbackTimer?.remove(false);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
    video.off(Phaser.GameObjects.Events.VIDEO_COMPLETE, finish);
    video.off(Phaser.GameObjects.Events.VIDEO_ERROR, finish);
    video.off(Phaser.GameObjects.Events.VIDEO_UNSUPPORTED, finish);
    video.off(Phaser.GameObjects.Events.VIDEO_LOCKED, showUnlockHint);
    video.off(Phaser.GameObjects.Events.VIDEO_PLAY, showSkipHint);
    touchLayer.off('pointerdown', handleAction);
    if (video.isPlaying()) video.stop();
    root.destroy(true);
    if (musicPaused) scene.sound.resumeAll();
    onDisposed?.();
    return true;
  };
  const finish = () => {
    if (!dispose()) return;
    onComplete();
  };
  const abort = () => { dispose(); };
  const showUnlockHint = () => hint.setText(tr('탭하여 영상 재생'));
  const showSkipHint = () => hint.setText(tr('탭 / SPACE: 건너뛰기'));
  const handleAction = () => {
    // A first real gesture unlocks audible video on restrictive mobile browsers.
    // Once playback is underway, the same gesture is the skip action.
    if (video.touchLocked || !video.isPlaying()) {
      video.play(false);
      return;
    }
    finish();
  };

  video.once(Phaser.GameObjects.Events.VIDEO_COMPLETE, finish);
  video.once(Phaser.GameObjects.Events.VIDEO_ERROR, finish);
  video.once(Phaser.GameObjects.Events.VIDEO_UNSUPPORTED, finish);
  video.on(Phaser.GameObjects.Events.VIDEO_LOCKED, showUnlockHint);
  video.on(Phaser.GameObjects.Events.VIDEO_PLAY, showSkipHint);
  touchLayer.on('pointerdown', handleAction);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);

  scene.sound.pauseAll();
  musicPaused = true;
  video.play(false);
  fallbackTimer = scene.time.delayedCall(30000, finish);
  return handleAction;
}
