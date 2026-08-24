/// <reference types="vite/client" />

import Phaser from 'phaser';
import { t } from './i18n';

type SceneConstructor = new () => Phaser.Scene;
type SceneModule = Record<string, unknown>;

// Vite turns each matching module into a separate on-demand chunk. Base classes
// and test-only helpers are dependencies, not launchable scenes, so exclude them
// from the public registry. This keeps the title's initial JavaScript small while
// preserving every production story route.
const SCENE_MODULES = import.meta.glob<SceneModule>([
  '../scenes/**/*.ts',
  '!../scenes/TitleScene.ts',
  '!../scenes/CliffClimbScene.ts',
  '!../scenes/EosaCityScene.ts',
  '!../scenes/RyeoBattleTestScene.ts',
  '!../scenes/interior/BaseInteriorScene.ts',
]);

const MODULE_OVERRIDES: Record<string, string> = {
  PlayerHomeScene: '../scenes/interior/PlayerHomeScene.ts',
  PokemonCenterScene: '../scenes/interior/PokemonCenterScene.ts',
  PokemonLabScene: '../scenes/interior/PokemonLabScene.ts',
  RivalHomeScene: '../scenes/interior/RivalHomeScene.ts',
  HamhungNaengmyeonScene: '../scenes/interior/HamhungNaengmyeonScene.ts',
  NorthernBuildingScene: '../scenes/interior/NorthernBuildingScene.ts',

  // The four Shadow Gym rooms share one implementation/data chunk while still
  // remaining independent Phaser scenes with their own save/return positions.
  CapitolGymMirrorRoomScene: '../scenes/CapitolGymScene.ts',
  CapitolGymVeilRoomScene: '../scenes/CapitolGymScene.ts',
  CapitolGymSanctumScene: '../scenes/CapitolGymScene.ts',

  FerryCorridorScene: '../scenes/ShipInterior.ts',
  FerryRoomAScene: '../scenes/ShipInterior.ts',
  FerryRoomBScene: '../scenes/ShipInterior.ts',
  FerryRoomCScene: '../scenes/ShipInterior.ts',

  NampoCityScene: '../scenes/EosaCities.ts',
  WonsanCityScene: '../scenes/EosaCities.ts',
  HamhungCityScene: '../scenes/EosaCities.ts',
  ChongjinCityScene: '../scenes/EosaCities.ts',
  SinuijuCityScene: '../scenes/EosaCities.ts',
  SamjiyonCityScene: '../scenes/EosaCities.ts',

  RangrimFoothillsScene: '../scenes/RangrimMountain.ts',
  RangrimCavernScene: '../scenes/RangrimMountain.ts',
  RangrimAltarScene: '../scenes/RangrimMountain.ts',
  RangrimSnowfieldScene: '../scenes/RangrimMountain.ts',
  RangrimSummitScene: '../scenes/RangrimMountain.ts',
};

/** Every scene reachable by the production story or a production menu. */
export const STORY_SCENE_KEYS = [
  'WorldMapScene', 'PlayerHomeScene', 'PokemonCenterScene', 'RivalHomeScene',
  'StarterSelectScene', 'RivalBattleScene', 'MenuScene', 'RouteScene',
  'WildBattleScene', 'SeoulScene', 'TrainerBattleScene', 'CapitolCityScene',
  'CapitolTowerScene', 'CapitolGymScene', 'CapitolGymMirrorRoomScene',
  'CapitolGymVeilRoomScene', 'CapitolGymSanctumScene', 'GymLeaderBattleScene', 'CapitolPCScene',
  'CapitolPalaceScene', 'CapitolAssemblyScene', 'CapitolLibraryScene',
  'CapitolMarketScene', 'EvolutionScene', 'EggHatchScene', 'Route2Scene',
  'PineNeedleTownScene', 'PineNeedlePCScene', 'PineNeedleStudioScene',
  'NurseryScene', 'NurseryManageScene', 'PokedexScene', 'ShopScene', 'BoxScene',
  'BaekduPassScene', 'BaekduCityScene', 'BaekduPCScene', 'BaekduGymScene',
  'Route3Scene', 'GeumgangCityScene', 'GeumgangContestScene', 'GeumgangPCScene', 'GeumgangGymScene',
  'Route4Scene', 'HaeanCityScene', 'HaeanPCScene', 'HaeanGymScene', 'SudoLabScene',
  'Route5Scene', 'ForestCityScene', 'ForestPCScene', 'ForestGymScene',
  'ForestShrineScene', 'FerryScene', 'FerryDepartScene', 'FerryCorridorScene',
  'FerryRoomAScene', 'FerryRoomBScene', 'FerryRoomCScene', 'JejuPortScene',
  'JejuCityScene', 'JejuVentsPortScene', 'JejuPCScene', 'JejuVentScene',
  'Route6Scene', 'SunriseCityScene', 'SunrisePCScene', 'SunriseGymScene',
  'SunriseCliff1Scene', 'SunriseCliff2Scene', 'SunriseCliff3Scene',
  'BaekduCheckpointScene', 'BaekduSummitScene', 'ScholarsRoadScene',
  'LeaguePlazaScene', 'LeaguePCScene', 'PokemonLeagueScene', 'HallOfFameScene', 'RegionMapScene',
  'NorthernColiseumScene', 'NorthernPlazaScene', 'NorthernPCScene', 'PyeongyangCityScene',
  'NorthernReachesScene', 'SacredPeakScene', 'DolmoeCityScene', 'DolmoeGymScene',
  'DolmoeRuinsScene', 'DolmoePCScene', 'DolmoeMineScene', 'SeoraePassScene',
  'OceanScene', 'MartScene', 'DeptStoreScene', 'SeoraeTownScene', 'SeoraePCScene',
  'SeoraeBuildingScene', 'SeoraeGymScene', 'GenderSelectScene', 'IntroScene',
  'HaenyeoHotSpringScene', 'HallasanGardensScene', 'HarborTavernScene',
  'JejuLibraryScene', 'JejuMarketScene', 'BeachPavilionScene',
  'SanbangsanShrineScene', 'CheonjiyeonWaterfallScene', 'KaesongCityScene',
  'HanRiverParkScene', 'BikeShopScene', 'ConvenienceStoreScene', 'NampoCityScene',
  'WonsanCityScene', 'HamhungCityScene', 'ChongjinCityScene', 'SinuijuCityScene',
  'SamjiyonCityScene', 'RyesongValleyScene', 'PokemonLabScene', 'NampoBeachScene',
  'AhobiryongPassScene', 'WonsanBeachScene', 'SijungCoastScene',
  'HamhungMineScene', 'ChilboHighlandsScene', 'KaemaPlateauScene',
  'RangrimFoothillsScene', 'RangrimCavernScene', 'RangrimAltarScene',
  'RangrimSnowfieldScene', 'RangrimSummitScene', 'SamjiyonAjitRoadScene',
  'NosdanHideoutScene', 'CheonjiScene', 'PyeongseongCheckpointScene',
  'SinuijuIceCaveScene', 'FogboundManorScene', 'HamhungNaengmyeonScene',
  'NorthernBuildingScene', 'SeolbongInnScene', 'WaterfallFinaleScene',
  'LeaderboardScene',
] as const;

const scenePromises = new Map<string, Promise<SceneConstructor>>();
let gameplayPluginsPromise: Promise<void> | null = null;

// ── Stale-deployment recovery ────────────────────────────────────────────────
// Every build hashes its chunk filenames. A player who keeps the game open across
// a redeploy is running an index bundle that asks for chunk names the server no
// longer has, so the FIRST unvisited area they walk into 404s — which is exactly
// the "Unable to load this area" screen, and why it clustered late in long
// sessions rather than at boot. No amount of retrying can fix that: the running
// page itself is stale, and only a fresh document can name the new chunks.
//
// So a fetch failure that looks like a missing module reloads the page once. The
// game autosaves on entering every area, so the player resumes where they were.
// The guard is per-tab and cleared by the next successful chunk load, which makes
// a reload loop impossible while still protecting a later redeploy in the same
// session.
const STALE_RELOAD_KEY = 'pk_stale_chunk_reload';

function sessionFlag(key: string): boolean {
  try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
}
function setSessionFlag(key: string, on: boolean): void {
  try { if (on) sessionStorage.setItem(key, '1'); else sessionStorage.removeItem(key); } catch { /* private mode */ }
}

/** Does this failure mean the running page is asking for chunks that are gone? */
function isStaleChunkError(error: unknown): boolean {
  const err = error as { message?: string; name?: string } | undefined;
  const text = `${err?.name ?? ''} ${err?.message ?? String(error)}`;
  return /dynamically imported module|module script failed|Unable to preload|Loading chunk|ChunkLoadError|Failed to fetch|NetworkError|error loading/i.test(text);
}

/**
 * Reload to pick up the current deployment. Returns false when a reload has
 * already been spent this session, so the caller can fall back to its own error
 * surface rather than reloading forever.
 */
function recoverFromStaleDeployment(): boolean {
  if (sessionFlag(STALE_RELOAD_KEY)) return false;
  setSessionFlag(STALE_RELOAD_KEY, true);
  try { window.location.reload(); } catch { return false; }
  return true;
}

// Vite raises this on the window when a preloaded chunk cannot be fetched. Left
// unhandled it becomes an uncaught error banner over the game; handled here it is
// the earliest possible signal that the deployment moved under us.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', event => {
    event.preventDefault();          // the scene loader below owns the recovery
  });
}

/** TitleScene does not walk, breed, hatch eggs, or show the pedometer. Installing
 * this scene plugin only when the first production destination is requested
 * keeps its Party/Pokédex data graph out of the initial mobile bundle. Every
 * real scene is added after this promise, so gameplay coverage is unchanged. */
function ensureGameplayPlugins(game: Phaser.Game): Promise<void> {
  if (gameplayPluginsPromise) return gameplayPluginsPromise;
  gameplayPluginsPromise = import('./BreedingTracker')
    .then(({ BreedingTrackerPlugin }) => {
      game.plugins.installScenePlugin(
        'BreedingTracker',
        BreedingTrackerPlugin,
        'breedingTracker',
      );
    })
    .catch(error => {
      gameplayPluginsPromise = null;
      throw error;
    });
  return gameplayPluginsPromise;
}

/** Resolve one production scene class and retain only its lightweight module promise. */
export function loadSceneClass(key: string): Promise<SceneConstructor> {
  const cached = scenePromises.get(key);
  if (cached) return cached;
  const path = MODULE_OVERRIDES[key] ?? `../scenes/${key}.ts`;
  const importer = SCENE_MODULES[path];
  if (!importer) return Promise.reject(new Error(`No production scene module registered for ${key}`));
  const pending = importer().then(module => {
    const SceneType = module[key];
    if (typeof SceneType !== 'function') throw new Error(`Scene export ${key} is missing from ${path}`);
    return SceneType as SceneConstructor;
  });
  // Never RETAIN a rejected import. A dropped request on a flaky mobile connection —
  // or a stale hashed chunk still referenced after a redeploy — would otherwise be
  // cached forever, so every retry re-used the same failed promise and the "Tap to
  // retry" screen could never recover. Drop it on failure so a retry re-fetches.
  pending.catch(() => { scenePromises.delete(key); });
  scenePromises.set(key, pending);
  return pending;
}

/** Marker used by test fixtures that need the real scene before attaching events. */
interface DeferredSceneInstance extends Phaser.Scene {
  __deferredScene?: true;
}

/** Replace one placeholder with the real class without starting it. */
export async function materializeScene(game: Phaser.Game, key: string): Promise<Phaser.Scene> {
  const current = game.scene.getScene(key) as DeferredSceneInstance | null;
  if (current && !current.__deferredScene) return current;
  const [, SceneType] = await Promise.all([ensureGameplayPlugins(game), loadSceneClass(key)]);
  if (current) game.scene.remove(key);
  return game.scene.add(key, SceneType, false) as Phaser.Scene;
}

/**
 * Create tiny Phaser placeholders. The first time a key is entered, its chunk
 * loads, replaces the placeholder under the same key, and receives the original
 * init data. All existing `this.scene.start/launch` calls therefore keep working.
 */
export function createLazySceneTypes(keys: readonly string[]): SceneConstructor[] {
  return keys.map(key => {
    const sceneKey = key;
    return class DeferredScene extends Phaser.Scene {
      __deferredScene = true as const;
      private launchData: object = {};

      constructor() { super({ key: sceneKey }); }

      init(data?: object): void { this.launchData = data ?? {}; }

      create(): void {
        const message = this.add.text(this.scale.width / 2, this.scale.height / 2,
          t('Loading…', '불러오는 중…'), { fontSize: '18px', color: '#dce8ff' })
          .setOrigin(0.5).setAlign('center');
        const data = this.launchData;

        const attempt = (triesLeft: number): void => {
          void Promise.all([ensureGameplayPlugins(this.game), loadSceneClass(sceneKey)]).then(([, SceneType]) => {
            // This build's chunks are reachable, so re-arm the one-shot reload for
            // any redeploy that lands later in the same session.
            setSessionFlag(STALE_RELOAD_KEY, false);
            const manager = this.scene.manager;
            manager.remove(sceneKey);
            manager.add(sceneKey, SceneType, true, data);
          }).catch(error => {
            console.error(`[scene] Failed to load ${sceneKey} (${triesLeft} retries left):`, error);
            if (triesLeft > 0) {
              // Might still be a transient mobile fetch hiccup. The rejected import
              // promise was just dropped from the cache, so back off and re-fetch
              // before doing anything the player can notice.
              message.setText(t('Loading…\n(reconnecting)', '불러오는 중…\n(재연결)')).setColor('#dce8ff');
              this.time.delayedCall(500 * (3 - triesLeft), () => attempt(triesLeft - 1));
              return;
            }
            // Retries are exhausted. If this looks like a chunk that no longer
            // exists, the page is stale and reloading is the actual fix — do it
            // automatically instead of stranding the player behind a tap.
            if (isStaleChunkError(error) && recoverFromStaleDeployment()) {
              message.setText(t('Updating to the latest version…', '최신 버전을 적용하는 중…'))
                .setColor('#dce8ff');
              return;
            }
            message.setText(t('Unable to load this area.\nTap to reload.',
              '이 지역을 불러오지 못했습니다.\n탭하면 다시 시도합니다.')).setColor('#ffb9b9');
            this.input.once('pointerdown', () => {
              // A plain reload can be answered from the HTTP cache, which on a
              // stale document changes nothing. Force a fresh URL for this one.
              try {
                const url = new URL(window.location.href);
                url.searchParams.set('r', String(Date.now()));
                window.location.replace(url.toString());
              } catch { window.location.reload(); }
            });
          });
        };
        attempt(3);   // up to 4 total attempts before reloading or surfacing an error
      }
    };
  });
}
