/// <reference types="vite/client" />

import Phaser from 'phaser';

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
  'CapitolTowerScene', 'CapitolGymScene', 'GymLeaderBattleScene', 'CapitolPCScene',
  'CapitolPalaceScene', 'CapitolAssemblyScene', 'CapitolLibraryScene',
  'CapitolMarketScene', 'EvolutionScene', 'EggHatchScene', 'Route2Scene',
  'PineNeedleTownScene', 'PineNeedlePCScene', 'PineNeedleStudioScene',
  'NurseryScene', 'NurseryManageScene', 'PokedexScene', 'ShopScene', 'BoxScene',
  'BaekduPassScene', 'BaekduCityScene', 'BaekduPCScene', 'BaekduGymScene',
  'Route3Scene', 'GeumgangCityScene', 'GeumgangPCScene', 'GeumgangGymScene',
  'Route4Scene', 'HaeanCityScene', 'HaeanPCScene', 'HaeanGymScene', 'SudoLabScene',
  'Route5Scene', 'ForestCityScene', 'ForestPCScene', 'ForestGymScene',
  'ForestShrineScene', 'FerryScene', 'FerryDepartScene', 'FerryCorridorScene',
  'FerryRoomAScene', 'FerryRoomBScene', 'FerryRoomCScene', 'JejuPortScene',
  'JejuCityScene', 'JejuVentsPortScene', 'JejuPCScene', 'JejuVentScene',
  'Route6Scene', 'SunriseCityScene', 'SunrisePCScene', 'SunriseGymScene',
  'SunriseCliff1Scene', 'SunriseCliff2Scene', 'SunriseCliff3Scene',
  'BaekduCheckpointScene', 'BaekduSummitScene', 'ScholarsRoadScene',
  'LeaguePlazaScene', 'PokemonLeagueScene', 'RegionMapScene',
  'NorthernColiseumScene', 'NorthernPlazaScene', 'PyeongyangCityScene',
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
          'Loading…', { fontSize: '18px', color: '#dce8ff' }).setOrigin(0.5);
        const data = this.launchData;
        void Promise.all([ensureGameplayPlugins(this.game), loadSceneClass(sceneKey)]).then(([, SceneType]) => {
          const manager = this.scene.manager;
          manager.remove(sceneKey);
          manager.add(sceneKey, SceneType, true, data);
        }).catch(error => {
          console.error(`[scene] Failed to load ${sceneKey}:`, error);
          message.setText('Unable to load this area.\nTap to retry.').setAlign('center').setColor('#ffb9b9');
          this.input.once('pointerdown', () => this.scene.restart(data));
        });
      }
    };
  });
}
