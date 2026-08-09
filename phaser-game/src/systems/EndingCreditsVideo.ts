import Phaser from 'phaser';
import { t } from './i18n';
import { MOBILE_ACTION_EVENT } from './TouchControls';
import { fitCutsceneVideo } from './CutsceneVideoLayout';

export const ENDING_CREDITS_VIDEO_URL =
  'assets/cutscenes/pokemon_korea_ending_credits_original_audio_bug_backup.mp4';

export const ENDING_BGM_VOLUME = 0.45;
export const ENDING_CREDITS_DURATION_MS = 300_000;
export const ENDING_CREDITS_BGM_KEYS = ['endingcredits', 'endingcredits2'] as const;

/**
 * Play the two local ending themes as one five-minute soundtrack. The first
 * piece is 130.351 seconds; the second starts on its completion and is cut at
 * the movie's exact 300-second boundary (looping only as a safety net if an
 * asset is replaced by a shorter master later).
 */
export function playEndingCreditsBgm(scene: Phaser.Scene): () => void {
  const registry = scene.game.registry;
  let stopped = false;
  let current: Phaser.Sound.BaseSound | undefined;
  let stopTimer: Phaser.Time.TimerEvent | undefined;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    stopTimer?.remove(false);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stop);
    if (current) {
      current.stop();
      current.destroy();
      if (registry.get('bgmSound') === current) registry.remove('bgmSound');
    }
    if (ENDING_CREDITS_BGM_KEYS.includes(registry.get('bgmKey'))) registry.remove('bgmKey');
    registry.remove('bgmWanted');
  };

  const playTrack = (index: number) => {
    if (stopped) return;
    const key = ENDING_CREDITS_BGM_KEYS[index];
    if (!key || !scene.cache.audio.exists(key)) {
      console.warn(`[ending-credits] soundtrack asset missing: ${key ?? 'unknown'}`);
      return;
    }
    if (current) current.destroy();
    current = scene.sound.add(key, {
      loop: index === ENDING_CREDITS_BGM_KEYS.length - 1,
      volume: ENDING_BGM_VOLUME,
    });
    (current as Phaser.Sound.WebAudioSound).setMute?.(!!registry.get('bgmMuted'));
    registry.set('bgmSound', current);
    registry.set('bgmKey', key);
    registry.set('bgmWanted', 'ending-credits-sequence');
    if (index + 1 < ENDING_CREDITS_BGM_KEYS.length) {
      current.once(Phaser.Sound.Events.COMPLETE, () => playTrack(index + 1));
    }
    current.play();
  };

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  stopTimer = scene.time.delayedCall(ENDING_CREDITS_DURATION_MS, stop);
  playTrack(0);
  return stop;
}

/**
 * Stream the five-minute mobile-optimised ending movie without putting its
 * payload into Phaser's preload queue. Its own audio is always muted because
 * the owning scene supplies a dedicated two-part local soundtrack.
 *
 * Returns a debounced SPACE/A/tap action. The first gesture unlocks playback
 * on iOS; a later gesture skips. Load/codec failures invoke the
 * legacy-credits fallback rather than leaving the ending stuck on black.
 */
export function playEndingCreditsVideo(
  scene: Phaser.Scene,
  onComplete: () => void,
  onUnavailable: () => void,
  onPlaybackStarted?: () => void,
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
  let playbackStartNotified = false;

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
  const fitVideo = () => fitCutsceneVideo(scene, video);
  const showUnlockHint = () => {
    hint.setAlpha(1).setText(t('Tap or press A to play', '탭 또는 A 버튼을 눌러 재생'));
  };
  const showPlayingHint = () => {
    hasPlayed = true;
    if (!playbackStartNotified) {
      playbackStartNotified = true;
      onPlaybackStarted?.();
    }
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
      video.setMute(true);
      video.setVolume(0);
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
    video.setMute(true);
    video.setVolume(0);
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
