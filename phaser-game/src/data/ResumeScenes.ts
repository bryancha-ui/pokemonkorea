/**
 * Scenes whose own create() path is safe to restore directly from a save.
 *
 * Keep this separate from TitleScene so automated production audits can compare
 * every SaveManager destination against the resume allow-list without importing
 * Phaser or booting the game. Transitional battle/menu/ceremony scenes are
 * deliberately absent; their saves point at the world scene they return to.
 */
export const SAFE_RESUME_SCENES = [
  'WorldMapScene', 'PlayerHomeScene',
  'RouteScene', 'Route2Scene', 'Route3Scene', 'Route4Scene', 'Route5Scene', 'Route6Scene',
  'CapitolCityScene', 'PineNeedleTownScene', 'HanRiverParkScene',
  'CapitolGymScene', 'CapitolGymMirrorRoomScene', 'CapitolGymVeilRoomScene', 'CapitolGymSanctumScene',
  'BaekduPassScene', 'BaekduCityScene', 'BaekduCheckpointScene', 'BaekduSummitScene',
  'GeumgangCityScene', 'GeumgangGymScene',
  'HaeanCityScene', 'HaeanGymScene',
  'ForestCityScene', 'ForestGymScene',
  'FerryScene', 'FerryCorridorScene', 'FerryRoomAScene', 'FerryRoomBScene', 'FerryRoomCScene',
  'JejuPortScene', 'JejuVentsPortScene', 'JejuVentScene', 'JejuCityScene', 'OceanScene',
  'HaenyeoHotSpringScene', 'HallasanGardensScene', 'HarborTavernScene',
  'JejuLibraryScene', 'JejuMarketScene', 'BeachPavilionScene',
  'SanbangsanShrineScene', 'CheonjiyeonWaterfallScene',
  'SunriseCityScene', 'SunriseGymScene', 'SunriseCliff1Scene', 'SunriseCliff2Scene', 'SunriseCliff3Scene',
  'ScholarsRoadScene', 'LeaguePlazaScene', 'PokemonLeagueScene',
  'NorthernColiseumScene', 'NorthernPlazaScene', 'PyeongseongCheckpointScene',
  'PyeongyangCityScene', 'NorthernReachesScene', 'SacredPeakScene',
  'DolmoeCityScene', 'DolmoeMineScene', 'DolmoeGymScene', 'SeoraeTownScene', 'SeoraeGymScene', 'SeoraePassScene',
  'KaesongCityScene', 'NampoCityScene', 'WonsanCityScene', 'HamhungCityScene',
  'ChongjinCityScene', 'SinuijuCityScene', 'SamjiyonCityScene',
  'RyesongValleyScene', 'AhobiryongPassScene', 'SijungCoastScene',
  'ChilboHighlandsScene', 'KaemaPlateauScene',
  'RangrimFoothillsScene', 'RangrimCavernScene', 'RangrimAltarScene',
  'RangrimSnowfieldScene', 'RangrimSummitScene',
  'NampoBeachScene', 'WonsanBeachScene', 'HamhungMineScene', 'FogboundManorScene',
  'SamjiyonAjitRoadScene', 'NosdanHideoutScene', 'SinuijuIceCaveScene', 'CheonjiScene',
  'NorthernBuildingScene', 'HamhungNaengmyeonScene',
  'BikeShopScene', 'ConvenienceStoreScene',
  // These cinematic scenes own explicit phase-resume logic. Excluding them
  // silently skipped credits/epilogues after the player closed a mobile tab.
  'SudoLabScene', 'WaterfallFinaleScene',
] as const;

const SAFE_RESUME_SET = new Set<string>(SAFE_RESUME_SCENES);

export function isSafeResumeScene(key: string | undefined): key is typeof SAFE_RESUME_SCENES[number] {
  return !!key && SAFE_RESUME_SET.has(key);
}
