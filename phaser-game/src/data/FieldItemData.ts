export interface FieldItemPlacement {
  id: string;
  scene: string;
  itemKey: string;
  quantity?: number;
  /** Position as a fraction of the authored camera/world bounds. */
  ratio: readonly [number, number];
}

const p = (
  scene: string, id: string, itemKey: string, x: number, y: number, quantity = 1,
): FieldItemPlacement => ({ scene, id: `${scene}:${id}`, itemKey, ratio: [x, y], quantity });

/** Curated rewards across towns, routes, coasts, caves, ruins and late-game
 * wilderness. Evolution stones occupy distinctive locations and never replace
 * an existing story reward. */
export const FIELD_ITEM_PLACEMENTS: readonly FieldItemPlacement[] = [
  p('SeoraeTownScene', 'village-potion', 'potion', .31, .61, 2),
  p('SeoraeTownScene', 'orchard-ball', 'pokeball', .72, .34, 3),
  p('RouteScene', 'ridge-antidote', 'antidote', .27, .38, 2),
  p('RouteScene', 'summit-berry', 'oranberry', .72, .68, 2),
  p('CapitolCityScene', 'river-greatball', 'greatball', .18, .55, 2),
  p('CapitolCityScene', 'palace-ether', 'ether', .76, .22),
  p('Route2Scene', 'forest-heal', 'paralyzeheal', .28, .65, 2),
  p('Route2Scene', 'old-leaf-stone', 'leafstone', .72, .27),
  p('PineNeedleTownScene', 'grove-seed', 'miracleseed', .71, .34),
  p('PineNeedleTownScene', 'well-potion', 'superpotion', .30, .70),
  p('Route3Scene', 'snow-revive', 'revive', .30, .62),
  p('Route3Scene', 'moonlit-rock', 'moonstone', .74, .25),
  p('BaekduPassScene', 'frozen-heal', 'iceheal', .27, .66, 2),
  p('BaekduPassScene', 'glacier-stone', 'icestone', .72, .28),
  p('BaekduCityScene', 'hot-spring-potion', 'hyperpotion', .68, .33),
  p('Route4Scene', 'mountain-ball', 'greatball', .28, .62, 2),
  p('Route4Scene', 'ember-stone', 'firestone', .72, .24),
  p('GeumgangCityScene', 'studio-ether', 'ether', .73, .36),
  p('GeumgangCityScene', 'festival-heal', 'fullheal', .29, .68),
  p('Route5Scene', 'coast-potion', 'superpotion', .27, .65, 2),
  p('Route5Scene', 'tide-stone', 'waterstone', .73, .27),
  p('HaeanCityScene', 'dock-water', 'mysticwater', .72, .36),
  p('HaeanCityScene', 'market-ball', 'ultraball', .27, .68),
  p('OceanScene', 'open-sea-ball', 'ultraball', .67, .35, 2),
  p('JejuPortScene', 'pier-lemonade', 'lemonade', .30, .65, 2),
  p('JejuCityScene', 'garden-heal', 'fullheal', .27, .66),
  p('JejuCityScene', 'sunrise-stone', 'sunstone', .74, .27),
  p('JejuVentScene', 'vent-elixir', 'elixir', .30, .66),
  p('JejuVentScene', 'black-vent-stone', 'duskstone', .72, .25),
  p('SunriseCityScene', 'grid-magnet', 'magnet', .27, .66),
  p('SunriseCityScene', 'lighthouse-stone', 'thunderstone', .73, .25),
  p('ScholarsRoadScene', 'scholar-max-potion', 'maxpotion', .28, .68),
  p('ScholarsRoadScene', 'crystal-stone', 'shinystone', .73, .29),
  p('LeaguePlazaScene', 'league-revive', 'maxrevive', .72, .34),
  p('DolmoeCityScene', 'quarry-belt', 'expertbelt', .28, .65),
  p('DolmoeMineScene', 'mine-revive', 'revive', .70, .63, 2),
  p('DolmoeRuinsScene', 'dolmen-stone', 'dawnstone', .70, .30),
  p('ForestCityScene', 'canopy-leftovers', 'leftovers', .71, .34),
  p('ForestShrineScene', 'shrine-elixir', 'elixir', .29, .67),
  p('SeoraePassScene', 'pass-hyper-potion', 'hyperpotion', .29, .67, 2),
  p('KaemaPlateauScene', 'plateau-revive', 'maxrevive', .70, .30),
  p('ChilboHighlandsScene', 'highland-ball', 'ultraball', .30, .66, 2),
  p('AhobiryongPassScene', 'dragon-elixir', 'elixir', .72, .29),
  p('RyesongValleyScene', 'valley-water', 'freshwater', .28, .65, 3),
  p('SijungCoastScene', 'coast-berry', 'sitrusberry', .72, .31, 2),
  p('WonsanBeachScene', 'beach-heal', 'fullheal', .29, .68, 2),
  p('NampoBeachScene', 'beach-ball', 'ultraball', .70, .32, 2),
  p('NorthernReachesScene', 'reaches-max-potion', 'maxpotion', .29, .68, 2),
  p('RangrimSnowfieldScene', 'rangrim-elixir', 'elixir', .71, .29, 2),
  p('BaekduSummitScene', 'summit-revive', 'maxrevive', .29, .67),
  p('CheonjiScene', 'cheonji-lum', 'lumberry', .71, .32, 2),
  p('SacredPeakScene', 'sacred-max-potion', 'maxpotion', .28, .66, 2),
  p('HanRiverParkScene', 'park-soda', 'sodapop', .72, .34, 2),
  p('PyeongyangCityScene', 'city-full-heal', 'fullheal', .30, .68, 2),
  p('NorthernPlazaScene', 'plaza-ultra-ball', 'ultraball', .70, .33, 2),
  p('SamjiyonAjitRoadScene', 'ajit-max-revive', 'maxrevive', .29, .67),
] as const;

