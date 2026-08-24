// ── Region map data ───────────────────────────────────────────────────────────
// A schematic map of the Onnuri (온누리) region. Each node is a place the player
// can travel through; the ones flagged `fly` are valid Fly destinations once the
// player has earned HM Fly by beating the Pokémon League.
//
// Positions (nx, ny) are normalised 0..1 and get projected into the map panel by
// RegionMapScene. Northern cities follow their real relative geography: Binghagwan
// in the far north-west, the west-coast line down through Gwanmunseong/Parangpo/
// Songhyeon, and the east-coast line through Muyeonhang/Gangcheoldo/Haesol.

export interface RegionNode {
  id:      string;
  /** Primary overworld scene for this place — where Fly drops you. */
  scene:   string;
  /** Short display name (English). */
  name:    string;
  /** Korean subtitle shown under the name. */
  kr:      string;
  /** Normalised position on the map panel. */
  nx:      number;
  ny:      number;
  /** City/landmark (large marker + fly target) vs. a route/passage (small marker). */
  kind:    'city' | 'route';
  /** Can you Fly here? (only cities/landmarks). */
  fly:     boolean;
  /** Which half of the peninsula this sits in. */
  region?: 'north' | 'south';
  /** Registry return-key prefix this scene reads for its spawn, e.g. 'capital'
   *  → 'capitalReturnX' / 'capitalReturnY'. Cleared before a Fly so the scene
   *  spawns at its own default entrance. */
  returnKey?: string;
  /** Every scene that counts as being "at" this node (gyms, PCs, interiors…). */
  scenes:  string[];
}

// The whole Korean peninsula: a NORTHERN region (Cheonji / Gwanmunseong / Northern
// League) across the border at the top, then ONNURI filling the body down to Jeju.
export const REGION_NODES: RegionNode[] = [
  // ── Northern region (across the border) ──────────────────────────────────
  { id: 'summit', scene: 'BaekduSummitScene', name: 'Cheonji · Baekdu', kr: '천지 · 백두산',
    nx: 0.50, ny: 0.035, kind: 'city', fly: true, region: 'north', returnKey: 'baekduSummit',
    scenes: ['BaekduSummitScene'] },

  { id: 'northleague', scene: 'NorthernPlazaScene', name: 'Northern League', kr: '북방 리그',
    nx: 0.13, ny: 0.105, kind: 'city', fly: true, region: 'north', returnKey: 'northPlaza',
    scenes: ['NorthernPlazaScene', 'NorthernColiseumScene'] },

  { id: 'pyeongyang', scene: 'PyeongyangCityScene', name: 'Gwanmunseong', kr: '관문성',
    nx: 0.35, ny: 0.135, kind: 'city', fly: true, region: 'north', returnKey: 'pyeongyang',
    scenes: ['PyeongyangCityScene'] },

  // ── Northern 어사대 마패 circuit cities ──
  { id: 'sinuiju', scene: 'SinuijuCityScene', name: 'Binghagwan', kr: '빙하관',
    nx: 0.20, ny: 0.045, kind: 'city', fly: true, region: 'north', returnKey: 'SinuijuCityScene',
    scenes: ['SinuijuCityScene'] },
  { id: 'nampo', scene: 'NampoCityScene', name: 'Parangpo', kr: '파랑포',
    nx: 0.27, ny: 0.18, kind: 'city', fly: true, region: 'north', returnKey: 'NampoCityScene',
    scenes: ['NampoCityScene'] },
  { id: 'kaesong', scene: 'KaesongCityScene', name: 'Songhyeon', kr: '송현',
    nx: 0.15, ny: 0.235, kind: 'city', fly: true, region: 'north', returnKey: 'KaesongCityScene',
    scenes: ['KaesongCityScene'] },
  { id: 'wonsan', scene: 'WonsanCityScene', name: 'Haesol', kr: '해솔',
    nx: 0.58, ny: 0.145, kind: 'city', fly: true, region: 'north', returnKey: 'WonsanCityScene',
    scenes: ['WonsanCityScene'] },
  { id: 'hamhung', scene: 'HamhungCityScene', name: 'Gangcheoldo', kr: '강철도',
    nx: 0.62, ny: 0.095, kind: 'city', fly: true, region: 'north', returnKey: 'HamhungCityScene',
    scenes: ['HamhungCityScene'] },
  { id: 'samjiyon', scene: 'SamjiyonCityScene', name: 'Samho', kr: '삼호',
    nx: 0.45, ny: 0.065, kind: 'city', fly: true, region: 'north', returnKey: 'SamjiyonCityScene',
    scenes: ['SamjiyonCityScene'] },
  { id: 'chongjin', scene: 'ChongjinCityScene', name: 'Muyeonhang', kr: '무연항',
    nx: 0.72, ny: 0.055, kind: 'city', fly: true, region: 'north', returnKey: 'ChongjinCityScene',
    scenes: ['ChongjinCityScene'] },

  // ── Onnuri (the south) ─────────────────────────────────────────────────
  { id: 'waterfall', scene: 'WorldMapScene', name: 'Waterfall City', kr: '폭포시티',
    nx: 0.15, ny: 0.3, kind: 'city', fly: true, region: 'south', returnKey: 'return',
    scenes: ['WorldMapScene', 'PlayerHomeScene', 'RivalHomeScene', 'PokemonCenterScene', 'StarterSelectScene'] },

  { id: 'route1', scene: 'RouteScene', name: 'Route 1', kr: '1번 도로',
    nx: 0.45, ny: 0.39, kind: 'route', fly: false, region: 'south', returnKey: 'route',
    scenes: ['RouteScene'] },

  { id: 'capitol', scene: 'CapitolCityScene', name: 'Capitol City', kr: '수도시티',
    nx: 0.54, ny: 0.45, kind: 'city', fly: true, region: 'south', returnKey: 'capital',
    scenes: ['CapitolCityScene', 'CapitolTowerScene', 'CapitolGymScene',
             'CapitolGymMirrorRoomScene', 'CapitolGymVeilRoomScene', 'CapitolGymSanctumScene', 'CapitolPCScene',
             'CapitolPalaceScene', 'CapitolMarketScene', 'SudoLabScene', 'SeoulScene'] },

  { id: 'route2', scene: 'Route2Scene', name: 'Route 2', kr: '2번 도로',
    nx: 0.62, ny: 0.52, kind: 'route', fly: false, region: 'south', returnKey: 'r2',
    scenes: ['Route2Scene'] },

  { id: 'pineneedle', scene: 'PineNeedleTownScene', name: 'Pine Needle Town', kr: '솔잎마을',
    nx: 0.37, ny: 0.53, kind: 'city', fly: true, region: 'south', returnKey: 'pine',
    scenes: ['PineNeedleTownScene', 'PineNeedlePCScene', 'PineNeedleStudioScene'] },

  { id: 'baekdupass', scene: 'BaekduPassScene', name: 'Seolbong Pass', kr: '설봉 고개',
    nx: 0.3, ny: 0.35, kind: 'route', fly: false, region: 'south', returnKey: 'baekduPass',
    scenes: ['BaekduPassScene', 'BaekduCheckpointScene', 'CliffClimbScene'] },

  { id: 'baekducity', scene: 'BaekduCityScene', name: 'Seolbong City', kr: '설봉시티',
    nx: 0.21, ny: 0.47, kind: 'city', fly: true, region: 'south', returnKey: 'baekduCity',
    scenes: ['BaekduCityScene', 'BaekduPCScene', 'BaekduGymScene'] },

  { id: 'route3', scene: 'Route3Scene', name: 'Route 3', kr: '3번 도로',
    nx: 0.83, ny: 0.55, kind: 'route', fly: false, region: 'south', returnKey: 'route3',
    scenes: ['Route3Scene'] },

  { id: 'geumgang', scene: 'GeumgangCityScene', name: 'Geumgang City', kr: '금강시티',
    nx: 0.79, ny: 0.44, kind: 'city', fly: true, region: 'south', returnKey: 'geumgangCity',
    scenes: ['GeumgangCityScene', 'GeumgangPCScene', 'GeumgangGymScene'] },

  { id: 'route4', scene: 'Route4Scene', name: 'Route 4', kr: '4번 도로',
    nx: 0.82, ny: 0.5, kind: 'route', fly: false, region: 'south', returnKey: 'route4',
    scenes: ['Route4Scene'] },

  { id: 'haean', scene: 'HaeanCityScene', name: 'Haean City', kr: '해안시티',
    nx: 0.85, ny: 0.62, kind: 'city', fly: true, region: 'south', returnKey: 'haeanCity',
    scenes: ['HaeanCityScene', 'HaeanPCScene', 'HaeanGymScene'] },

  { id: 'route5', scene: 'Route5Scene', name: 'Route 5', kr: '5번 도로',
    nx: 0.42, ny: 0.83, kind: 'route', fly: false, region: 'south', returnKey: 'route5',
    scenes: ['Route5Scene'] },

  { id: 'forest', scene: 'ForestCityScene', name: 'Forest City', kr: '숲시티',
    nx: 0.6, ny: 0.6, kind: 'city', fly: true, region: 'south', returnKey: 'forestCity',
    scenes: ['ForestCityScene', 'ForestPCScene', 'ForestGymScene'] },

  // The ferry to Jeju runs from Haean's port — place both off Haean's south-east coast.
  { id: 'ferry', scene: 'FerryScene', name: 'Ferry', kr: '여객선',
    nx: 0.90, ny: 0.80, kind: 'route', fly: false, region: 'south', returnKey: 'ferry',
    scenes: ['FerryScene'] },

  { id: 'jeju', scene: 'JejuCityScene', name: 'Jeju City', kr: '제주시티',
    nx: 0.94, ny: 0.93, kind: 'city', fly: true, region: 'south', returnKey: 'jejuCity',
    scenes: ['JejuCityScene', 'JejuPortScene', 'JejuPCScene', 'JejuVentScene'] },

  { id: 'route6', scene: 'Route6Scene', name: 'Route 6', kr: '6번 도로',
    nx: 0.62, ny: 0.50, kind: 'route', fly: false, region: 'south', returnKey: 'route6',
    scenes: ['Route6Scene'] },

  { id: 'dolmoe', scene: 'DolmoeCityScene', name: 'Dolmoe City', kr: '돌뫼 시티',
    nx: 0.66, ny: 0.38, kind: 'city', fly: true, region: 'south', returnKey: 'dolmoe',
    scenes: ['DolmoeCityScene', 'DolmoeGymScene', 'DolmoeRuinsScene'] },

  { id: 'dolmoemine', scene: 'DolmoeMineScene', name: 'Dolmoe Mine', kr: '돌뫼 광산',
    nx: 0.72, ny: 0.34, kind: 'route', fly: false, region: 'south', returnKey: 'dolmoeMine',
    scenes: ['DolmoeMineScene'] },

  { id: 'seoraepass', scene: 'SeoraePassScene', name: 'Seorae Pass', kr: '설령 고개',
    nx: 0.78, ny: 0.31, kind: 'route', fly: false, region: 'south', returnKey: 'seoraePass',
    scenes: ['SeoraePassScene'] },

  // Seorae is a snowbound mountain town — placed up north (above Geumgang), not in the warm south.
  { id: 'seorae', scene: 'SeoraeTownScene', name: 'Seorae Town', kr: '서래 마을',
    nx: 0.82, ny: 0.28, kind: 'city', fly: true, region: 'south', returnKey: 'seorae',
    scenes: ['SeoraeTownScene', 'SeoraeGymScene'] },

  { id: 'sunrise', scene: 'SunriseCityScene', name: 'Sunrise City', kr: '일출시티',
    nx: 0.64, ny: 0.79, kind: 'city', fly: true, region: 'south', returnKey: 'sunriseCity',
    scenes: ['SunriseCityScene', 'SunrisePCScene', 'SunriseGymScene',
             'SunriseCliff1Scene', 'SunriseCliff2Scene', 'SunriseCliff3Scene'] },

  // Scholar's Road runs from the Capitol up to the League, so both sit just north of Capitol.
  { id: 'scholars', scene: 'ScholarsRoadScene', name: "Scholar's Road", kr: '선비의 길',
    nx: 0.54, ny: 0.41, kind: 'route', fly: false, region: 'south', returnKey: 'scholarsRoad',
    scenes: ['ScholarsRoadScene'] },

  { id: 'league', scene: 'LeaguePlazaScene', name: 'Pokémon League', kr: '포켓몬 리그',
    nx: 0.54, ny: 0.36, kind: 'city', fly: true, region: 'south', returnKey: 'leaguePlaza',
    scenes: ['LeaguePlazaScene', 'PokemonLeagueScene'] },
];

/** Which node (if any) a given scene belongs to. */
export function nodeForScene(sceneKey: string): RegionNode | undefined {
  return REGION_NODES.find(n => n.scenes.includes(sceneKey));
}

// Minimal structural view of Phaser's registry, so this data module stays engine-light.
type Reg = { get(key: string): unknown; set(key: string, value: unknown): void };

const VISITED_KEY = 'visitedNodes';

/** Mark the node that owns `sceneKey` as visited (called whenever a scene saves). */
export function markVisited(registry: Reg, sceneKey: string): void {
  const node = nodeForScene(sceneKey);
  if (!node) return;
  const raw = registry.get(VISITED_KEY);
  const list: string[] = Array.isArray(raw) ? (raw as string[]) : [];
  if (!list.includes(node.id)) {
    list.push(node.id);
    registry.set(VISITED_KEY, list);
  }
}

/** The set of node ids the player has visited. */
export function visitedNodeIds(registry: Reg): Set<string> {
  const raw = registry.get(VISITED_KEY);
  return new Set(Array.isArray(raw) ? (raw as string[]) : []);
}

/** The Fly move's canonical display name (what a Pokémon "knows"). */
export const FLY_MOVE = 'Fly';
