/** Minimal runtime shape shared by the menu bridge and its headless audit. */
export interface MobileMenuSceneState {
  px?: unknown;
  py?: unknown;
  exiting?: unknown;
  cutscene?: unknown;
  cutsceneActive?: unknown;
  dialog?: { isOpen?: () => boolean };
  __deferredScene?: unknown;
}

/**
 * Only a fully materialised player-controlled map may claim the direct mobile
 * menu request. Story/selection screens have no player coordinates, while
 * cutscenes and open dialogue retain the same input lock used by map keyboards.
 */
export function mobileMenuAllowedInScene(scene: MobileMenuSceneState): boolean {
  if (scene.__deferredScene === true) return false;
  if (typeof scene.px !== 'number' || !Number.isFinite(scene.px)) return false;
  if (typeof scene.py !== 'number' || !Number.isFinite(scene.py)) return false;
  if (scene.exiting === true || scene.cutscene === true || scene.cutsceneActive === true) return false;
  try {
    if (scene.dialog?.isOpen?.() === true) return false;
  } catch {
    return false;
  }
  return true;
}
