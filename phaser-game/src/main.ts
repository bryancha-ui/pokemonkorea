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
import { initI18n, setLang } from './systems/i18n';
import { PokemonFxPlugin } from './systems/PokemonFx';
import { BreedingTrackerPlugin } from './systems/BreedingTracker';
import { SaveManager } from './utils/SaveManager';
import { PartySystem } from './systems/PartySystem';
import { standaloneTestMode } from './systems/StandaloneTestMode';

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

/** Open the complete pre-capture summit staging without touching the real save. */
function launchNabihalmangEntranceTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('seoraeGymDefeated', true);
  game.registry.set('jejuSummitSeen', false);
  game.registry.set('nabiEntranceMovieSeen', false);
  game.registry.set('jejuClimbStarted', true);
  game.registry.set('trainerDefeated_jeju-suri-1', true);
  game.registry.set('trainerDefeated_jeju-suri-2', true);
  game.registry.set('jejuVentReturnX', 12 * 32 + 16);
  game.registry.set('jejuVentReturnY', 8 * 32 + 16);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('JejuVentScene');
}

/** Open the fully assembled summit and Hwanung descent without changing saves. */
function launchHwanungEntranceTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', JSON.stringify(['poongbaek', 'woosa', 'woonsa']));
  game.registry.set('sacredPeakSeen', true);
  game.registry.set('trainerDefeated_nosdan-sovereign', true);
  game.registry.set('trueEndDone', false);
  game.registry.set('sacredPeakReturnX', 9 * 32 + 16);
  game.registry.set('sacredPeakReturnY', 7 * 32 + 16);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('SacredPeakScene');
}

/** Isolated Hwanung GLB + Master Ball consumption regression fixture. */
function launchHwanungBattleTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', JSON.stringify(['poongbaek', 'woosa', 'woonsa']));
  game.registry.set('starterName', 'Vipour');
  game.registry.set('starterKey', 'vipour');
  game.registry.set('starterLevel', 80);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);
  game.registry.set('inventoryInit', true);
  game.registry.set('inventory', JSON.stringify({ masterball: 2 }));
  game.registry.set('hwanungMasterBallGranted', true);
  game.registry.set('wildId', 'hwanwoong');
  game.registry.set('wildLevel', 80);
  game.registry.set('wildCustom', true);
  game.registry.set('wildCatchRate', 2);
  game.registry.set('wildReturnScene', 'SacredPeakScene');
  game.registry.set('sacredPeakReturnX', 9 * 32 + 16);
  game.registry.set('sacredPeakReturnY', 7 * 32 + 16);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('WildBattleScene');
}

/** Isolated Close Combat 3D combo regression fixture. */
function launchCloseCombatTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('starterName', 'Vipour');
  game.registry.set('starterKey', 'vipour');
  game.registry.set('starterLevel', 56);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);
  const lead = PartySystem.get(game.registry)[0];
  if (lead) {
    const battleMoves = [
      { name: 'Close Combat', type: 'fighting' as const, category: 'physical' as const, power: 95, accuracy: 100, pp: 20 },
      { name: 'Rock Slide', type: 'rock' as const, category: 'physical' as const, power: 75, accuracy: 100, pp: 10 },
      { name: 'Stone Edge', type: 'rock' as const, category: 'physical' as const, power: 100, accuracy: 100, pp: 5 },
      { name: 'Ice Beam', type: 'ice' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 10 },
    ];
    PartySystem.set(game.registry, [{
      ...lead,
      name: 'Pipetiger', spriteKey: 'pipetiger', level: 56,
      type1: 'fire', type2: 'steel',
      moves: battleMoves.map(move => move.name), battleMoves,
    }]);
  }
  game.registry.set('wildId', 'ampere');
  game.registry.set('wildLevel', 40);
  game.registry.set('wildCustom', true);
  game.registry.set('wildCatchRate', 120);
  game.registry.set('wildReturnScene', 'SacredPeakScene');
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('WildBattleScene');
}

/** Ice Beam, Hydro Pump and Shadow Ball 3D timing regression fixture. */
function launchSpecialMoveFxTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('starterName', 'Onnurian');
  game.registry.set('starterKey', 'onnurian');
  game.registry.set('starterLevel', 56);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);
  const lead = PartySystem.get(game.registry)[0];
  if (lead) {
    const battleMoves = [
      { name: 'Ice Beam', type: 'ice' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 10 },
      { name: 'Hydro Pump', type: 'water' as const, category: 'special' as const, power: 110, accuracy: 100, pp: 5 },
      { name: 'Shadow Ball', type: 'ghost' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 15 },
      { name: 'Air Slash', type: 'flying' as const, category: 'special' as const, power: 85, accuracy: 100, pp: 15 },
    ];
    PartySystem.set(game.registry, [{
      ...lead,
      name: 'Thanatoat', spriteKey: 'thanatoat', level: 56,
      type1: 'water', type2: 'ghost',
      moves: battleMoves.map(move => move.name), battleMoves,
    }]);
  }
  game.registry.set('wildId', 'ampere');
  game.registry.set('wildLevel', 40);
  game.registry.set('wildCustom', true);
  game.registry.set('wildCatchRate', 120);
  game.registry.set('wildReturnScene', 'SacredPeakScene');
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('WildBattleScene');
}

/** Representative online-reference-inspired effect families. */
function launchMoveFxFamiliesTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('starterName', 'Yeomtaeja');
  game.registry.set('starterKey', 'yeomtaeja');
  game.registry.set('starterLevel', 56);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);
  const lead = PartySystem.get(game.registry)[0];
  if (lead) {
    const battleMoves = [
      { name: 'Flamethrower', type: 'fire' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 15 },
      { name: 'Psychic', type: 'psychic' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 10 },
      { name: 'Dark Pulse', type: 'dark' as const, category: 'special' as const, power: 80, accuracy: 100, pp: 15 },
      { name: 'Moonblast', type: 'fairy' as const, category: 'special' as const, power: 95, accuracy: 100, pp: 15 },
    ];
    PartySystem.set(game.registry, [{
      ...lead,
      name: 'Pipetiger', spriteKey: 'pipetiger', level: 56,
      type1: 'fire', type2: 'steel',
      moves: battleMoves.map(move => move.name), battleMoves,
    }]);
  }
  game.registry.set('wildId', 'ampere');
  game.registry.set('wildLevel', 40);
  game.registry.set('wildCustom', true);
  game.registry.set('wildCatchRate', 120);
  game.registry.set('wildReturnScene', 'SacredPeakScene');
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('WildBattleScene');
}

/** Persistent major-status visuals and localized HUD badge fixture.
 *  Use `&condition=frz|par|brn|psn` to select the condition. */
function launchStatusEffectsTest(game: Phaser.Game): void {
  const requested = new URLSearchParams(location.search).get('condition') ?? 'frz';
  const condition = ['frz', 'par', 'brn', 'psn'].includes(requested) ? requested : 'frz';
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('starterName', 'Onnurian');
  game.registry.set('starterKey', 'onnurian');
  game.registry.set('starterLevel', 56);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);
  const lead = PartySystem.get(game.registry)[0];
  if (lead) {
    const battleMoves = [
      { name: 'Ice Beam', type: 'ice' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 10 },
      { name: 'Hydro Pump', type: 'water' as const, category: 'special' as const, power: 110, accuracy: 100, pp: 5 },
      { name: 'Shadow Ball', type: 'ghost' as const, category: 'special' as const, power: 90, accuracy: 100, pp: 15 },
      { name: 'Air Slash', type: 'flying' as const, category: 'special' as const, power: 85, accuracy: 100, pp: 15 },
    ];
    PartySystem.set(game.registry, [{
      ...lead,
      name: 'Thanatoat', spriteKey: 'thanatoat', level: 56, status: condition,
      type1: 'water', type2: 'ghost',
      moves: battleMoves.map(move => move.name), battleMoves,
    }]);
  }
  game.registry.set('wildId', 'ampere');
  game.registry.set('wildLevel', 40);
  game.registry.set('wildCustom', true);
  game.registry.set('wildCatchRate', 120);
  game.registry.set('wildReturnScene', 'SacredPeakScene');
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('WildBattleScene');
}

/** Open the true-ending celebration, movie and homecoming without saving. */
function launchTrueEndingTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('finalePartyPending', true);
  game.registry.set('trueEndDone', true);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('SudoLabScene');
}

/**
 * Deterministic mobile regression fixture for the Route 2 level cap and
 * voluntary-switch confirmation. It never restores or writes the real save.
 */
function launchBattleRegressionTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  game.registry.set('party', '[]');
  game.registry.set('box', '[]');
  game.registry.set('dexCaught', '[]');
  game.registry.set('starterName', 'Vipour');
  game.registry.set('starterKey', 'vipour');
  game.registry.set('starterLevel', 20);
  game.registry.set('starterExp', 0);
  PartySystem.initFromStarter(game.registry);

  const lead = PartySystem.get(game.registry)[0];
  if (lead) {
    PartySystem.set(game.registry, [
      { ...lead, breedingId: 'battle-regression-lead' },
      { ...lead, name: 'Vipour B', breedingId: 'battle-regression-bench' },
    ]);
  }

  // Deliberately inject the reported bad value. WildBattleScene must clamp it
  // to Route 2's authored Lv.13–16 range before drawing the HUD.
  // Ampere exercises the heavy local GLB path as well as the common enemy-facing
  // alignment; the intentionally invalid level still validates Route 2's cap.
  game.registry.set('wildId', 'ampere');
  game.registry.set('wildLevel', 35);
  game.registry.set('wildCustom', true);
  game.registry.set('wildCatchRate', 200);
  game.registry.set('wildReturnScene', 'Route2Scene');
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('WildBattleScene');
}

/** Korean bag and old-save badge reconciliation fixture. */
function launchUiLocalizationTest(game: Phaser.Game): void {
  game.registry.set('sceneFlowTest', true);
  setLang('ko', false);
  game.registry.set('party', '[]');
  game.registry.set('starterName', 'Vipour');
  game.registry.set('starterKey', 'vipour');
  game.registry.set('starterLevel', 20);
  game.registry.set('starterExp', 0);
  game.registry.set('starterChosen', true);
  game.registry.set('hasPokedex', true);
  game.registry.set('hasRunningShoes', true);
  // Reproduce the old-save gap: only the seventh story badge remains set.
  // Opening the bag must reconcile this to seven earned badges.
  game.registry.set('seoraeGymDefeated', true);
  PartySystem.initFromStarter(game.registry);
  if (game.scene.isActive('TitleScene')) game.scene.stop('TitleScene');
  game.scene.start('MenuScene');
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
  // CORS-enabled loads keep remote authored 2D fallback art readable while
  // approved local GLBs load. Visual pipeline only.
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
// Renders the game world in 3D (terrain, characters and approved local GLBs,
// third-person + cinematic battle cameras) beneath the Phaser canvas, which
// keeps drawing all UI. Three.js is a separate lazy chunk so the title can
// become interactive without first parsing the full 3D engine on a phone.
const start3D = () => {
  void import('./engine3d')
    .then(({ bootstrap3D }) => bootstrap3D(game))
    .catch((err) => console.warn('[engine3d] lazy bootstrap failed; game remains 2D:', err));
};
if (standaloneTestMode()) start3D();
else {
  const idleWindow = window as Window & { requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number };
  if (typeof idleWindow.requestIdleCallback === 'function') idleWindow.requestIdleCallback(start3D, { timeout: 1200 });
  else globalThis.setTimeout(start3D, 0);
}

// Open isolated scene-flow checks directly from their dedicated URLs.
const testMode = standaloneTestMode();
if (testMode === 'ryeo-battle') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchRyeoBattleTest(game), 0);
  });
} else if (testMode === 'nabi-entrance') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchNabihalmangEntranceTest(game), 350);
  });
} else if (testMode === 'hwanung-entrance') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchHwanungEntranceTest(game), 350);
  });
} else if (testMode === 'hwanung-battle') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchHwanungBattleTest(game), 350);
  });
} else if (testMode === 'true-ending') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchTrueEndingTest(game), 350);
  });
} else if (testMode === 'battle-regressions') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchBattleRegressionTest(game), 350);
  });
} else if (testMode === 'ui-localization') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchUiLocalizationTest(game), 350);
  });
} else if (testMode === 'close-combat') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchCloseCombatTest(game), 350);
  });
} else if (testMode === 'special-move-fx') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchSpecialMoveFxTest(game), 350);
  });
} else if (testMode === 'move-fx-families') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchMoveFxFamiliesTest(game), 350);
  });
} else if (testMode === 'status-effects') {
  game.events.once(Phaser.Core.Events.READY, () => {
    window.setTimeout(() => launchStatusEffectsTest(game), 350);
  });
}
}

void bootGame().catch(e => showError(e?.stack || e?.message || String(e)));
