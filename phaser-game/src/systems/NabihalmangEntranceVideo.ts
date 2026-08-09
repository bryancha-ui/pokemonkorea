import Phaser from 'phaser';
import { t } from './i18n';
import { MOBILE_ACTION_EVENT } from './TouchControls';
import { fitCutsceneVideo } from './CutsceneVideoLayout';

export const NABIHALMANG_ENTRANCE_VIDEO_URL =
  'assets/cutscenes/nabihalmang_jeju_crater_entrance_final.mp4';

/**
 * Stream the Jeju-crater entrance movie as a screen-space cutscene. The video
 * is optional: codec, loading and autoplay failures all continue into the
 * authored in-engine 3D appearance instead of blocking the legendary battle.
 */
export function playNabihalmangEntranceVideo(
  scene: Phaser.Scene,
  onComplete: () => void,
  onDisposed?: () => void,
): () => void {
  const w = scene.scale.width, h = scene.scale.height;
  const cx = w / 2, cy = h / 2;
  const zoom = scene.cameras.main.zoom || 1;
  const screenScale = 1 / zoom;

  const backdrop = scene.add.rectangle(cx, cy, w, h, 0x000000, 1);
  const video = scene.add.video(cx, cy);
  const touchLayer = scene.add.rectangle(cx, cy, w, h, 0xffffff, 0.001)
    .setInteractive({ useHandCursor: true });
  const hint = scene.add.text(w - 22, h - 20, t('Tap / A / SPACE to skip', '탭 / A / SPACE: 건너뛰기'), {
    fontSize: '15px', color: '#ffffff', backgroundColor: '#000000a8',
    padding: { x: 9, y: 5 },
  }).setOrigin(1, 1);
  const root = scene.add.container(0, 0, [backdrop, video, touchLayer, hint])
    .setScrollFactor(0).setDepth(1_000_000)
    .setScale(screenScale)
    .setPosition(cx * (1 - screenScale), cy * (1 - screenScale));

  let settled = false;
  let hasPlayed = false;
  let lastActionAt = -Infinity;
  let fallbackTimer: Phaser.Time.TimerEvent | undefined;
  let hintFade: Phaser.Time.TimerEvent | undefined;
  let musicPaused = false;

  const dispose = (): boolean => {
    if (settled) return false;
    settled = true;
    fallbackTimer?.remove(false);
    hintFade?.remove(false);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
    video.off(Phaser.GameObjects.Events.VIDEO_COMPLETE, finish);
    video.off(Phaser.GameObjects.Events.VIDEO_ERROR, finish);
    video.off(Phaser.GameObjects.Events.VIDEO_UNSUPPORTED, finish);
    video.off(Phaser.GameObjects.Events.VIDEO_LOCKED, showUnlockHint);
    video.off(Phaser.GameObjects.Events.VIDEO_PLAY, showPlayingHint);
    video.off(Phaser.GameObjects.Events.VIDEO_PLAYING, showPlayingHint);
    video.off(Phaser.GameObjects.Events.VIDEO_STALLED, showBufferingHint);
    video.off(Phaser.GameObjects.Events.VIDEO_CREATED, fitVideo);
    touchLayer.off('pointerdown', handleAction);
    window.removeEventListener(MOBILE_ACTION_EVENT, handleAction);
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
  const fitVideo = () => fitCutsceneVideo(scene, video);
  const showUnlockHint = () => {
    hint.setAlpha(1).setText(t('Tap or press A to play with sound', '탭 또는 A 버튼을 눌러 소리와 함께 재생'));
  };
  const showPlayingHint = () => {
    hasPlayed = true;
    fitVideo();
    hint.setAlpha(1).setText(t('Tap / A / SPACE to skip', '탭 / A / SPACE: 건너뛰기'));
    hintFade?.remove(false);
    hintFade = scene.time.delayedCall(4200, () => {
      if (hint.active) hint.setAlpha(0.32);
    });
  };
  const showBufferingHint = () => {
    if (hasPlayed) hint.setAlpha(1).setText(t('Buffering video...', '영상을 불러오는 중...'));
  };
  const handleAction = () => {
    const now = performance.now();
    // Mobile A emits both a custom action and a synthetic SPACE press. Debounce
    // them so the gesture that unlocks playback cannot also skip the movie.
    if (now - lastActionAt < 420) return;
    lastActionAt = now;
    if (video.touchLocked || !video.isPlaying()) {
      video.setMute(!!scene.registry.get('bgmMuted'));
      video.setVolume(0.9);
      video.play(false);
      return;
    }
    finish();
  };

  video.once(Phaser.GameObjects.Events.VIDEO_COMPLETE, finish);
  video.once(Phaser.GameObjects.Events.VIDEO_ERROR, finish);
  video.once(Phaser.GameObjects.Events.VIDEO_UNSUPPORTED, finish);
  video.on(Phaser.GameObjects.Events.VIDEO_LOCKED, showUnlockHint);
  video.on(Phaser.GameObjects.Events.VIDEO_PLAY, showPlayingHint);
  video.on(Phaser.GameObjects.Events.VIDEO_PLAYING, showPlayingHint);
  video.on(Phaser.GameObjects.Events.VIDEO_STALLED, showBufferingHint);
  video.on(Phaser.GameObjects.Events.VIDEO_CREATED, fitVideo);
  touchLayer.on('pointerdown', handleAction);
  window.addEventListener(MOBILE_ACTION_EVENT, handleAction);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);

  scene.sound.pauseAll();
  musicPaused = true;
  try {
    video.loadURL(NABIHALMANG_ENTRANCE_VIDEO_URL, false);
    video.setMute(!!scene.registry.get('bgmMuted'));
    video.setVolume(0.9);
    video.play(false);
  } catch (error) {
    console.warn('[nabihalmang-entrance] movie unavailable; continuing in-engine:', error);
    scene.time.delayedCall(0, finish);
  }

  // The authored movie is 31 seconds. Allow generous buffering time while
  // guaranteeing an unresponsive media element can never soft-lock the scene.
  fallbackTimer = scene.time.delayedCall(50_000, finish);
  return handleAction;
}
