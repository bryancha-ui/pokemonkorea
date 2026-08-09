import Phaser from 'phaser';
import { isTouchDevice } from './TouchControls';

/**
 * Fit a cutscene inside the logical game viewport without cropping it.
 *
 * Phaser can restore a video's native dimensions after VIDEO_CREATED, which
 * used to make the Hwanung movie overflow the mobile canvas. Phone layouts
 * also keep a small cinematic safe area so generated titles and characters at
 * the edge of all three movies remain visible after browser/UI scaling.
 */
export function fitCutsceneVideo(
  scene: Phaser.Scene,
  video: Phaser.GameObjects.Video,
): void {
  const viewportW = scene.scale.width;
  const viewportH = scene.scale.height;
  const sourceW = video.video?.videoWidth || 1280;
  const sourceH = video.video?.videoHeight || 720;
  const forcedTouch = typeof location !== 'undefined'
    && new URLSearchParams(location.search).has('touch');
  const mobile = forcedTouch || (typeof window !== 'undefined' && isTouchDevice());
  const safeScale = mobile ? 0.9 : 1;
  const scale = Math.min(
    (viewportW * safeScale) / Math.max(1, sourceW),
    (viewportH * safeScale) / Math.max(1, sourceH),
  );

  video
    .setPosition(viewportW / 2, viewportH / 2)
    .setDisplaySize(Math.round(sourceW * scale), Math.round(sourceH * scale));
}
