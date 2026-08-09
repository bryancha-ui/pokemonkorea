import Phaser from 'phaser';

// ── On-screen error catcher ──────────────────────────────────────────────────
// Surfaces any uncaught error / promise rejection as a red banner so problems
// are visible instead of silently freezing the game.
function showError(msg: string) {
  let box = document.getElementById('__err__');
  if (!box) {
    box = document.createElement('div');
    box.id = '__err__';
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;max-height:40%;overflow:auto;'
      + 'background:#aa0000;color:#fff;font:12px/1.4 monospace;padding:8px 12px;white-space:pre-wrap;'
      + 'border-top:2px solid #ff5555;';
    document.body.appendChild(box);
  }
  box.textContent = '⚠ ' + msg + '\n(tap to dismiss)';
  box.onclick = () => box && box.remove();
}
window.addEventListener('error', (e) => showError(`${e.message}\n${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) =>
  showError('Promise: ' + (e.reason?.stack || e.reason?.message || String(e.reason))));

import { TitleScene } from './scenes/TitleScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { BattleScene } from './scenes/BattleScene';
import { PlayerHomeScene } from './scenes/interior/PlayerHomeScene';
import { PokemonCenterScene } from './scenes/interior/PokemonCenterScene';
import { PokemonLabScene } from './scenes/interior/PokemonLabScene';
import { RivalHomeScene } from './scenes/interior/RivalHomeScene';
import { StarterSelectScene } from './scenes/StarterSelectScene';
import { RivalBattleScene } from './scenes/RivalBattleScene';
import { MenuScene } from './scenes/MenuScene';
import { RouteScene } from './scenes/RouteScene';
import { WildBattleScene } from './scenes/WildBattleScene';
import { SeoulScene } from './scenes/SeoulScene';
import { TrainerBattleScene } from './scenes/TrainerBattleScene';
import { configureRyeoBattleTest } from './scenes/RyeoBattleTestScene';
import { CapitolCityScene } from './scenes/CapitolCityScene';
import { CapitolTowerScene } from './scenes/CapitolTowerScene';
import { CapitolGymScene } from './scenes/CapitolGymScene';
import { GymLeaderBattleScene } from './scenes/GymLeaderBattleScene';
import { CapitolPCScene } from './scenes/CapitolPCScene';
import { CapitolPalaceScene } from './scenes/CapitolPalaceScene';
import { CapitolAssemblyScene } from './scenes/CapitolAssemblyScene';
import { CapitolLibraryScene } from './scenes/CapitolLibraryScene';
import { CapitolMarketScene } from './scenes/CapitolMarketScene';
import { EvolutionScene } from './scenes/EvolutionScene';
import { EggHatchScene } from './scenes/EggHatchScene';
import { Route2Scene } from './scenes/Route2Scene';
import { PineNeedleTownScene } from './scenes/PineNeedleTownScene';
import { PineNeedlePCScene } from './scenes/PineNeedlePCScene';
import { PineNeedleStudioScene } from './scenes/PineNeedleStudioScene';
import { NurseryScene } from './scenes/NurseryScene';
import { NurseryManageScene } from './scenes/NurseryManageScene';
import { PokedexScene } from './scenes/PokedexScene';
import { ShopScene } from './scenes/ShopScene';
import { BoxScene } from './scenes/BoxScene';
import { BaekduPassScene } from './scenes/BaekduPassScene';
import { BaekduCityScene } from './scenes/BaekduCityScene';
import { BaekduPCScene } from './scenes/BaekduPCScene';
import { BaekduGymScene } from './scenes/BaekduGymScene';
import { Route3Scene } from './scenes/Route3Scene';
import { GeumgangCityScene } from './scenes/GeumgangCityScene';
import { GeumgangPCScene } from './scenes/GeumgangPCScene';
import { GeumgangGymScene } from './scenes/GeumgangGymScene';
import { Route4Scene } from './scenes/Route4Scene';
import { HaeanCityScene } from './scenes/HaeanCityScene';
import { HaeanPCScene } from './scenes/HaeanPCScene';
import { HaeanGymScene } from './scenes/HaeanGymScene';
import { SudoLabScene } from './scenes/SudoLabScene';
import { Route5Scene } from './scenes/Route5Scene';
import { ForestCityScene } from './scenes/ForestCityScene';
import { ForestPCScene } from './scenes/ForestPCScene';
import { ForestGymScene } from './scenes/ForestGymScene';
import { ForestShrineScene } from './scenes/ForestShrineScene';
import { FerryScene } from './scenes/FerryScene';
import { FerryDepartScene } from './scenes/FerryDepartScene';
import { FerryCorridorScene, FerryRoomAScene, FerryRoomBScene, FerryRoomCScene } from './scenes/ShipInterior';
import { JejuPortScene } from './scenes/JejuPortScene';
import { JejuCityScene } from './scenes/JejuCityScene';
import { JejuVentsPortScene } from './scenes/JejuVentsPortScene';
import { JejuPCScene } from './scenes/JejuPCScene';
import { JejuVentScene } from './scenes/JejuVentScene';
import { Route6Scene } from './scenes/Route6Scene';
import { SunriseCityScene } from './scenes/SunriseCityScene';
import { SunrisePCScene } from './scenes/SunrisePCScene';
import { SunriseGymScene } from './scenes/SunriseGymScene';
import { SunriseCliff1Scene } from './scenes/SunriseCliff1Scene';
import { SunriseCliff2Scene } from './scenes/SunriseCliff2Scene';
import { SunriseCliff3Scene } from './scenes/SunriseCliff3Scene';
import { BaekduCheckpointScene } from './scenes/BaekduCheckpointScene';
import { BaekduSummitScene } from './scenes/BaekduSummitScene';
import { ScholarsRoadScene } from './scenes/ScholarsRoadScene';
import { LeaguePlazaScene } from './scenes/LeaguePlazaScene';
import { PokemonLeagueScene } from './scenes/PokemonLeagueScene';
import { RegionMapScene } from './scenes/RegionMapScene';
import { NorthernColiseumScene } from './scenes/NorthernColiseumScene';
import { NorthernPlazaScene } from './scenes/NorthernPlazaScene';
import { PyeongyangCityScene } from './scenes/PyeongyangCityScene';
import { NorthernReachesScene } from './scenes/NorthernReachesScene';
import { SacredPeakScene } from './scenes/SacredPeakScene';
import { DolmoeCityScene } from './scenes/DolmoeCityScene';
import { DolmoeGymScene } from './scenes/DolmoeGymScene';
import { DolmoeRuinsScene } from './scenes/DolmoeRuinsScene';
import { DolmoePCScene } from './scenes/DolmoePCScene';
import { DolmoeMineScene } from './scenes/DolmoeMineScene';
import { SeoraePassScene } from './scenes/SeoraePassScene';
import { OceanScene } from './scenes/OceanScene';
import { MartScene } from './scenes/MartScene';
import { DeptStoreScene } from './scenes/DeptStoreScene';
import { SeoraeTownScene } from './scenes/SeoraeTownScene';
import { SeoraePCScene } from './scenes/SeoraePCScene';
import { SeoraeBuildingScene } from './scenes/SeoraeBuildingScene';
import { SeoraeGymScene } from './scenes/SeoraeGymScene';
import { GenderSelectScene } from './scenes/GenderSelectScene';
import { IntroScene } from './scenes/IntroScene';
import { HaenyeoHotSpringScene } from './scenes/HaenyeoHotSpringScene';
import { HallasanGardensScene } from './scenes/HallasanGardensScene';
import { HarborTavernScene } from './scenes/HarborTavernScene';
import { JejuLibraryScene } from './scenes/JejuLibraryScene';
import { JejuMarketScene } from './scenes/JejuMarketScene';
import { BeachPavilionScene } from './scenes/BeachPavilionScene';
import { SanbangsanShrineScene } from './scenes/SanbangsanShrineScene';
import { CheonjiyeonWaterfallScene } from './scenes/CheonjiyeonWaterfallScene';
import { KaesongCityScene } from './scenes/KaesongCityScene';
import { HanRiverParkScene } from './scenes/HanRiverParkScene';
import { BikeShopScene } from './scenes/BikeShopScene';
import { ConvenienceStoreScene } from './scenes/ConvenienceStoreScene';
import { NampoCityScene, WonsanCityScene, HamhungCityScene, ChongjinCityScene, SinuijuCityScene, SamjiyonCityScene } from './scenes/EosaCities';
import { RyesongValleyScene } from './scenes/RyesongValleyScene';
import { NampoBeachScene } from './scenes/NampoBeachScene';
import { AhobiryongPassScene } from './scenes/AhobiryongPassScene';
import { WonsanBeachScene } from './scenes/WonsanBeachScene';
import { SijungCoastScene } from './scenes/SijungCoastScene';
import { HamhungMineScene } from './scenes/HamhungMineScene';
import { ChilboHighlandsScene } from './scenes/ChilboHighlandsScene';
import { KaemaPlateauScene } from './scenes/KaemaPlateauScene';
import { RangrimFoothillsScene, RangrimCavernScene, RangrimAltarScene, RangrimSnowfieldScene, RangrimSummitScene } from './scenes/RangrimMountain';
import { SamjiyonAjitRoadScene } from './scenes/SamjiyonAjitRoadScene';
import { NosdanHideoutScene } from './scenes/NosdanHideoutScene';
import { CheonjiScene } from './scenes/CheonjiScene';
import { PyeongseongCheckpointScene } from './scenes/PyeongseongCheckpointScene';
import { SinuijuIceCaveScene } from './scenes/SinuijuIceCaveScene';
import { FogboundManorScene } from './scenes/FogboundManorScene';
import { HamhungNaengmyeonScene } from './scenes/interior/HamhungNaengmyeonScene';
import { NorthernBuildingScene } from './scenes/interior/NorthernBuildingScene';
import { SeolbongInnScene } from './scenes/SeolbongInnScene';
import { setupMobileShell } from './systems/TouchControls';
import { installFontScaling } from './systems/UiScale';
import { initI18n } from './systems/i18n';
import { PokemonFxPlugin } from './systems/PokemonFx';
import { BreedingTrackerPlugin } from './systems/BreedingTracker';
import { bootstrap3D } from './engine3d';
import { SaveManager } from './utils/SaveManager';
import { PartySystem } from './systems/PartySystem';

function launchRyeoBattleTest(game: Phaser.Game): void {
  // Restore into this window's Phaser registry only. The battle scene's save
  // guard keeps all test damage/EXP/flags out of the real save slot.
  const saved = SaveManager.load();
  if (saved) SaveManager.restore(game.registry, saved);

  // A fresh install may not have a party yet, so give the test a usable lead.
  if (PartySystem.get(game.registry).length === 0) {
    game.registry.set('starterName', 'Test Trainer');
    game.registry.set('starterKey', 'vipour');
    game.registry.set('starterLevel', 50);
    game.registry.set('starterExp', 0);
    PartySystem.initFromStarter(game.registry);
  }

  configureRyeoBattleTest(game.registry);
  game.registry.set('nabiCaughtBeat', true);
  game.registry.set('jejuVentReturnX', 12 * 32 + 16);
  game.registry.set('jejuVentReturnY', 8 * 32 + 16);
  // READY can fire in the same frame that Phaser is starting TitleScene. Give
  // that startup transaction a tick to settle, then explicitly remove the
  // title so it cannot remain underneath the standalone battle window.
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('JejuVentScene');
}

async function bootGame() {
// Recover the IndexedDB mirror before TitleScene decides whether Continue is
// available. This protects game history when ordinary browser cache cleanup
// removes localStorage but leaves origin databases intact.
await SaveManager.bootstrapDurableStorage();

// On touch devices, split the page DS-style (game on top, control deck below) and
// mount the game into the top pane so the controls never cover it. ?touch=1 forces it.
const shell = setupMobileShell(new URLSearchParams(location.search).has('touch'));

// Touch devices enlarge on-canvas fonts/boxes in proportion to how far the
// 1280×720 canvas is shrunk to fit the screen — big on tiny phones, ~1× (no
// overlap) on large touchscreens. Must run before the game/scenes are created.
installFontScaling(shell.mobile);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: '#000000',
  parent: shell.parent,
  scene: [TitleScene, WorldMapScene, BattleScene, PlayerHomeScene, PokemonCenterScene, RivalHomeScene, StarterSelectScene, RivalBattleScene, MenuScene, RouteScene, WildBattleScene, SeoulScene, TrainerBattleScene, CapitolCityScene, CapitolTowerScene, CapitolGymScene, GymLeaderBattleScene, CapitolPCScene, CapitolPalaceScene, CapitolAssemblyScene, CapitolLibraryScene, CapitolMarketScene, EvolutionScene, EggHatchScene, Route2Scene, PineNeedleTownScene, PineNeedlePCScene, PineNeedleStudioScene, NurseryScene, NurseryManageScene, PokedexScene, ShopScene, BoxScene, BaekduPassScene, BaekduCityScene, BaekduPCScene, BaekduGymScene, Route3Scene, GeumgangCityScene, GeumgangPCScene, GeumgangGymScene, Route4Scene, HaeanCityScene, HaeanPCScene, HaeanGymScene, SudoLabScene, Route5Scene, ForestCityScene, ForestPCScene, ForestGymScene, ForestShrineScene, FerryScene, FerryDepartScene, FerryCorridorScene, FerryRoomAScene, FerryRoomBScene, FerryRoomCScene, JejuPortScene, JejuCityScene, JejuVentsPortScene, JejuPCScene, JejuVentScene, Route6Scene, SunriseCityScene, SunrisePCScene, SunriseGymScene, SunriseCliff1Scene, SunriseCliff2Scene, SunriseCliff3Scene, BaekduCheckpointScene, BaekduSummitScene, ScholarsRoadScene, LeaguePlazaScene, PokemonLeagueScene, RegionMapScene, NorthernColiseumScene, NorthernPlazaScene, PyeongyangCityScene, NorthernReachesScene, SacredPeakScene, DolmoeCityScene, DolmoeGymScene, DolmoeRuinsScene, DolmoePCScene, DolmoeMineScene, SeoraePassScene, OceanScene, MartScene, DeptStoreScene, SeoraeTownScene, SeoraePCScene, SeoraeBuildingScene, SeoraeGymScene, GenderSelectScene, IntroScene, HaenyeoHotSpringScene, HallasanGardensScene, HarborTavernScene, JejuLibraryScene, JejuMarketScene, BeachPavilionScene, SanbangsanShrineScene, CheonjiyeonWaterfallScene, KaesongCityScene, HanRiverParkScene, BikeShopScene, ConvenienceStoreScene, NampoCityScene, WonsanCityScene, HamhungCityScene, ChongjinCityScene, SinuijuCityScene, SamjiyonCityScene, RyesongValleyScene, PokemonLabScene, NampoBeachScene, AhobiryongPassScene, WonsanBeachScene, SijungCoastScene, HamhungMineScene, ChilboHighlandsScene, KaemaPlateauScene, RangrimFoothillsScene, RangrimCavernScene, RangrimAltarScene, RangrimSnowfieldScene, RangrimSummitScene, SamjiyonAjitRoadScene, NosdanHideoutScene, CheonjiScene, PyeongseongCheckpointScene, SinuijuIceCaveScene, FogboundManorScene, HamhungNaengmyeonScene, NorthernBuildingScene, SeolbongInnScene],
  // CORS-enabled loads let the 3D layer read pixels of CDN-hosted art
  // (PokeAPI HOME renders) to extrude battler meshes. Visual pipeline only.
  loader: { crossOrigin: 'anonymous' },
  render: {
    powerPreference: 'high-performance',   // prefer the discrete GPU on dual-GPU laptops
    antialias: true,
    // Transparent canvas lets the engine3d WebGL layer show through underneath
    // while Phaser keeps drawing all UI (and, in 2D mode, the whole game) on top.
    // The page behind the canvas is black, so 2D mode looks identical to before.
    transparent: true,
  },
  // Global "Pokémon-like" post-FX (colour grade + bloom + vignette) on every scene.
  plugins: {
    scene: [
      { key: 'PokemonFx', plugin: PokemonFxPlugin, mapping: 'pokemonFx', start: true },
      { key: 'BreedingTracker', plugin: BreedingTrackerPlugin, mapping: 'breedingTracker', start: true },
    ],
  },
  fps: { target: 60, min: 30 },
  scale: {
    mode: Phaser.Scale.FIT,
    // On mobile the game pane is taller than the 16:9 canvas, so anchor the canvas to
    // the TOP of its pane (centre only horizontally) instead of floating it in the
    // middle with wasted bars above. Desktop keeps full centring.
    autoCenter: shell.mobile ? Phaser.Scale.CENTER_HORIZONTALLY : Phaser.Scale.CENTER_BOTH,
  },
});

initI18n(game);   // load the saved KO/EN language preference before any scene renders

(window as unknown as { __game: Phaser.Game }).__game = game;

// ── 3D rendering layer ───────────────────────────────────────────────────────
// Renders the game world in 3D (terrain, extruded characters & creatures,
// third-person + cinematic battle cameras) beneath the Phaser canvas, which
// keeps drawing all UI. Game logic is untouched. Press F3 to toggle 2D ↔ 3D.
bootstrap3D(game);

// Open the test directly when the popup is launched with ?test=ryeo-battle.
if (new URLSearchParams(location.search).get('test') === 'ryeo-battle') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchRyeoBattleTest(game), 0);
  });
}
}

void bootGame().catch(e => showError(e?.stack || e?.message || String(e)));
