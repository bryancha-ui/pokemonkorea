import Phaser from 'phaser';
import { materializeScene } from './LazyScenes';
import { MOBILE_MENU_EVENT } from './TouchControls';
import { mobileMenuAllowedInScene, type MobileMenuSceneState } from './MobileMenuPolicy';

type RuntimeScene = Phaser.Scene & MobileMenuSceneState;

function activeGameplayScene(game: Phaser.Game): RuntimeScene | undefined {
  const active = game.scene.getScenes(true) as RuntimeScene[];
  // Only the top active scene may claim the tap. Searching past a box/map/story
  // overlay to the still-running world underneath would open a second menu on
  // top of that modal.
  const top = active[active.length - 1];
  return top && mobileMenuAllowedInScene(top) ? top : undefined;
}

/**
 * Route the DOM menu button directly to Phaser's scene manager. This removes
 * the dependency on every map independently registering a synthetic M key and
 * keeps a first tap alive while MenuScene's lazy chunk is materialising.
 */
export function installMobileMenuBridge(game: Phaser.Game): void {
  let opening = false;
  let menuReady: Promise<Phaser.Scene> | null = null;
  const prepareMenu = (): Promise<Phaser.Scene> => {
    if (menuReady) return menuReady;
    menuReady = materializeScene(game, 'MenuScene').catch(error => {
      menuReady = null;
      throw error;
    });
    return menuReady;
  };

  const requestMenu = (event: Event) => {
    // Leave an open menu unclaimed: TouchControls then sends its legacy M tap,
    // preserving the existing toggle-to-close behaviour.
    if (game.scene.isActive('MenuScene')) return;
    const source = activeGameplayScene(game);
    if (!source) return;

    // Claim immediately so the same touch cannot also reach a scene M handler.
    event.preventDefault();
    if (opening) return;
    opening = true;
    const sourceKey = source.scene.key;

    void prepareMenu()
      .then(() => {
        // Do not open over a transition/cutscene that began during the import.
        if (game.scene.isActive('MenuScene') || !game.scene.isActive(sourceKey)) return;
        const latest = activeGameplayScene(game);
        if (!latest || latest.scene.key !== sourceKey) return;
        game.scene.run('MenuScene');
      })
      .catch(error => {
        console.warn('[mobile-menu] preload failed; handing recovery to the lazy scene:', error);
        // materializeScene removes the placeholder only after a successful load.
        // Launching the remaining placeholder provides its retry/stale-build UI.
        if (!game.scene.isActive('MenuScene') && game.scene.isActive(sourceKey)) {
          game.scene.run('MenuScene');
        }
      })
      .finally(() => { opening = false; });
  };
  window.addEventListener(MOBILE_MENU_EVENT, requestMenu);

  // Prepare the menu chunk as soon as the first controllable map is visible.
  // Title/intro memory stays lean, while the first real menu tap becomes local.
  const prewarmMenu = () => {
    if (!activeGameplayScene(game)) return;
    game.events.off(Phaser.Core.Events.POST_STEP, prewarmMenu);
    void prepareMenu().catch(error => {
      // A later tap still launches the lazy placeholder with retries.
      console.warn('[mobile-menu] background preload deferred:', error);
    });
  };
  game.events.on(Phaser.Core.Events.POST_STEP, prewarmMenu);
}
