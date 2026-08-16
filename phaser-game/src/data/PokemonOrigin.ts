import { getLang, tr } from '../systems/i18n';

/** Human-readable capture locations for the status screen. */
const LOCATION_BY_SCENE: Record<string, string> = {
  RouteScene: 'Route 1',
  Route2Scene: "Route 2 — Scholar's Road",
  ScholarsRoadScene: "Scholar's Road",
  Route3Scene: 'Route 3',
  Route4Scene: 'Route 4',
  Route5Scene: 'Route 5',
  Route6Scene: 'Route 6',
  AhobiryongPassScene: 'Ahobiryong Pass',
  BaekduCheckpointScene: 'Baekdu Checkpoint',
  BaekduPassScene: 'Baekdu Plateau Pass',
  BaekduSummitScene: 'Baekdu Summit',
  ChilboHighlandsScene: 'Chilbo Highlands',
  DolmoeMineScene: 'Dolmoe Mine',
  DolmoeRuinsScene: 'Dolmoe Ruins',
  FerryScene: 'Onnuri Ferry Route',
  FogboundManorScene: 'Fogbound Manor',
  ForestShrineScene: 'Ancient Forest Shrine',
  HamhungMineScene: 'Hamhung Mine',
  JejuVentScene: 'Jeju Volcanic Vent',
  KaemaPlateauScene: 'Kaema Plateau',
  NampoBeachScene: 'Nampo Beach',
  NorthernReachesScene: 'Northern Reaches',
  OceanScene: 'Onnuri Sea',
  RyesongValleyScene: 'Ryesong Valley',
  SacredPeakScene: 'Sacred Peak',
  SeoraePassScene: 'Seorae Pass',
  SijungCoastScene: 'Sijung Coast',
  SinuijuIceCaveScene: 'Sinuiju Ice Cave',
  WonsanBeachScene: 'Wonsan Beach',
};

export function caughtLocationName(sceneKey?: string): string {
  if (!sceneKey) return 'Unknown location';
  return LOCATION_BY_SCENE[sceneKey]
    ?? sceneKey.replace(/Scene$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
}

const CAUGHT_LOCATION_KO: Record<string, string> = {
  'Unknown location': '알 수 없는 장소',
  "Prof. Song's Lab": '송 박사의 연구소',
  'Pine Needle Pokémon Nursery': '솔잎 포켓몬 키우미집',
  'Cheonji Lake — Baekdu Peak': '천지 — 백두산 정상',
  'Route 1': '1번도로',
  'Route 1 / Caves': '1번도로 / 동굴',
  'Route 1 — Mountain Pass': '1번도로 — 산길 고개',
  'Route 2': '2번도로',
  'Route 2 (rare)': '2번도로 (희귀)',
  'Route 2 / Forests': '2번도로 / 숲',
  'Route 2 / Towns': '2번도로 / 마을',
  'Route 3': '3번도로',
  'Route 4': '4번도로',
  'Route 5': '5번도로',
  'Route 6': '6번도로',
  'Route 6 (rare)': '6번도로 (희귀)',
  "Route 2 — Scholar's Road": '2번도로 — 학자의 길',
  "Scholar's Road": '학자의 길',
  'Capitol Gym': '소올 체육관',
  'Capitol Gym (Leader Jin)': '소올 체육관 (관장 진)',
  'Capitol Shadow Court': '소올 그림자 법정',
  'Capitol / Photographers': '소올 시티 / 사진가',
  'Geumgang Fairy Gym': '금강시티 페어리 체육관',
  'Pokémon League (Hwageum)': '포켓몬 리그 (화금)',
  'Ancient Forest': '고대 숲',
  'Forest Shrine': '고대 숲 사당',
  'Highland Shrine': '고원 사당',
  'Sacred peak': '신성한 봉우리',
  'Seolbong Highland Pass': '설봉고원고개',
  'Seolbong Highland Pass (rare)': '설봉고원고개 (희귀)',
  'Eastern Shore': '동쪽 해안',
  'Eastern Shore (rare)': '동쪽 해안 (희귀)',
  'Northern Reaches (rare)': '북부 변경 (희귀)',
  'Baekdu Snowfields': '백두 설원',
  'Baekdu Snowfields (rare)': '백두 설원 (희귀)',
  'Jeju coast & old village gates': '제주 해안과 옛 마을 어귀',
  'Uhangri tidal flats & coastal cliffs': '우항리 갯벌과 해안 절벽',
  '천지 (Cheonji Lake) — Onseong altar': '천지 — 온성 제단',
  'Onnuri Region — deep wilds': '온누리 지방 — 깊은 야생',
  'Onnuri skies': '온누리의 하늘',
  'Onnuri snowfields': '온누리 설원',
  'Onnuri festival grounds': '온누리 축제장',
  'Onnuri Sea': '온누리 바다',
  'Onnuri Ferry Route': '온누리 여객선 항로',
  'Open sea': '먼바다',
  'Coastal waters': '연안 바다',
  'Coast / Beaches': '해안 / 해변',
  'Nampo Beach': '남포 해변',
  'Wonsan Beach': '원산 해변',
  'Sijung Coast': '시중 해안',
  'Jeju Volcanic Vent': '제주 화산 분화구',
  'Ahobiryong Pass': '아홉이룡 고개',
  'Baekdu Checkpoint': '백두 검문소',
  'Baekdu Plateau Pass': '백두고원고개',
  'Baekdu Summit': '백두산 정상',
  'Chilbo Highlands': '칠보 고원',
  'Dolmoe Mine': '돌뫼 광산',
  'Dolmoe Ruins': '돌뫼 고인돌 유적',
  'Fogbound Manor': '안개 저택',
  'Ancient Forest Shrine': '고대 숲 사당',
  'Hamhung Mine': '함흥 광산',
  'Kaema Plateau': '개마고원',
  'Northern Reaches': '북부 변경',
  'Ryesong Valley': '례성 계곡',
  'Sacred Peak': '신성한 봉우리',
  'Seorae Pass': '서래 고개',
  'Sinuiju Ice Cave': '신의주 얼음동굴',
};

/** Localize both scene-derived and old-save English capture locations. */
export function localizedCaughtLocation(location?: string): string {
  if (!location) return getLang() === 'ko' ? '알 수 없는 장소' : 'Unknown location';
  if (getLang() !== 'ko') return location;
  const exact = CAUGHT_LOCATION_KO[location];
  if (exact) return exact;
  const dictionary = tr(location);
  if (dictionary !== location) return dictionary;

  // Habitat strings in the regional dex are deliberately compositional. This
  // fallback keeps old/custom entries readable even when an exact phrase was
  // added after the player's save was created.
  return location
    .replace(/Route\s+(\d+)/gi, '$1번도로')
    .replace(/\(rare\)/gi, '(희귀)')
    .replace(/Ancient/gi, '고대')
    .replace(/Forest/gi, '숲')
    .replace(/Shrine/gi, '사당')
    .replace(/Caves?/gi, '동굴')
    .replace(/Coastal?/gi, '해안')
    .replace(/Beaches?/gi, '해변')
    .replace(/Rivers?/gi, '강')
    .replace(/Mountains?/gi, '산')
    .replace(/Snowfields?/gi, '설원')
    .replace(/Grasslands?/gi, '초원')
    .replace(/Meadows?/gi, '들판')
    .replace(/Gardens?/gi, '정원')
    .replace(/Ruins?/gi, '유적')
    .replace(/Village/gi, '마을')
    .replace(/Town/gi, '마을')
    .replace(/City/gi, '도시')
    .replace(/Open sea/gi, '먼바다')
    .replace(/Onnuri/gi, '온누리');
}
