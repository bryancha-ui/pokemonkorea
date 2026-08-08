import Phaser from 'phaser';
import { t } from './i18n';
import { MOBILE_ACTION_EVENT } from './TouchControls';

export const ENDING_CREDITS_VIDEO_URL =
  'assets/cutscenes/pokemon_korea_ending_credits_original_audio_bug_backup.mp4';

// The two sources have similar mastered loudness. Keep the movie's authored
// soundtrack in front while leaving enough headroom for the looping game BGM.
export const ENDING_VIDEO_VOLUME = 0.55;
export const ENDING_BGM_VOLUME = 0.45;

/**
 * Stream the five-minute ending movie without putting its 195 MB payload into
 * Phaser's preload queue. The owning scene supplies the separately-looping
 * `bgm_endingcredits` track, producing the requested live audio mix.
 *
 * Returns a debounced SPACE/A/tap action. The first gesture unlocks audible
 * playback on iOS; a later gesture skips. Load/codec failures invoke the
 * legacy-credits fallback rather than leaving the ending stuck on black.
 */
export function playEndingCreditsVideo(
  scene: Phaser.Scene,
  onComplete: () => void,
  onUnavailable: () => void,
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

  const dispose = (): boolean => {
    if (settled) return false;
    settled = true;
    fallbackTimer?.remove(false);
    hintFade?.remove(false);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, abort);
    video.off(Phaser.GameObjects.Events.VIDEO_COMPLETE, finish);
    video.off(Phaser.GameObjects.Events.VIDEO_ERROR, unavailable);
    video.off(Phaser.GameObjects.Events.VIDEO_UNSUPPORTED, unavailable);
    video.off(Phaser.GameObjects.Events.VIDEO_LOCKED, showUnlockHint);
    video.off(Phaser.GameObjects.Events.VIDEO_PLAY, showPlayingHint);
    video.off(Phaser.GameObjects.Events.VIDEO_PLAYING, showPlayingHint);
    video.off(Phaser.GameObjects.Events.VIDEO_STALLED, showBufferingHint);
    video.off(Phaser.GameObjects.Events.VIDEO_CREATED, fitVideo);
    touchLayer.off('pointerdown', handleAction);
    window.removeEventListener(MOBILE_ACTION_EVENT, handleAction);
    if (video.isPlaying()) video.stop();
    root.destroy(true);
    return true;
  };
  const finish = () => {
    if (!dispose()) return;
    onComplete();
  };
  const unavailable = () => {
    if (!dispose()) return;
    onUnavailable();
  };
  const abort = () => { dispose(); };
  const fitVideo = () => video.setDisplaySize(w, h);
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
    // The mobile A button emits both a direct action event and a synthetic
    // SPACE key. Treat them as one gesture so the unlock tap cannot also skip.
    if (now - lastActionAt < 420) return;
    lastActionAt = now;
    if (video.touchLocked || !video.isPlaying()) {
      video.setMute(!!scene.registry.get('bgmMuted'));
      video.setVolume(ENDING_VIDEO_VOLUME);
      video.play(false);
      return;
    }
    finish();
  };

  video.once(Phaser.GameObjects.Events.VIDEO_COMPLETE, finish);
  video.once(Phaser.GameObjects.Events.VIDEO_ERROR, unavailable);
  video.once(Phaser.GameObjects.Events.VIDEO_UNSUPPORTED, unavailable);
  video.on(Phaser.GameObjects.Events.VIDEO_LOCKED, showUnlockHint);
  video.on(Phaser.GameObjects.Events.VIDEO_PLAY, showPlayingHint);
  video.on(Phaser.GameObjects.Events.VIDEO_PLAYING, showPlayingHint);
  video.on(Phaser.GameObjects.Events.VIDEO_STALLED, showBufferingHint);
  video.on(Phaser.GameObjects.Events.VIDEO_CREATED, fitVideo);
  touchLayer.on('pointerdown', handleAction);
  window.addEventListener(MOBILE_ACTION_EVENT, handleAction);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, abort);

  try {
    video.loadURL(ENDING_CREDITS_VIDEO_URL, false);
    video.setMute(!!scene.registry.get('bgmMuted'));
    video.setVolume(ENDING_VIDEO_VOLUME);
    video.play(false);
  } catch (error) {
    console.warn('[ending-credits] movie unavailable; using the in-game fallback:', error);
    scene.time.delayedCall(0, unavailable);
  }

  // Five-minute movie plus generous buffering allowance. This only protects
  // against a browser that emits neither `ended` nor an error.
  fallbackTimer = scene.time.delayedCall(330_000, unavailable);
  return handleAction;
}
