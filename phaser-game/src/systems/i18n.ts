import Phaser from 'phaser';
import { dexEntry, POKEDEX } from '../data/Pokedex';
import { KO_STRINGS, KO_TYPES, KO_SPEAKERS } from '../data/ko_strings';
import { KO_ABILITIES } from '../data/ko_abilities';

// Korean names for the region's custom Pokémon, from public/assets/pokemon_dictionary.xlsx.
export const POKE_KR: Record<string, string> = {
  // Official Pokémon used by story trainers but not listed in the custom dex.
  // (Most borrowed official species are covered by OFFICIAL_POKE_KR below.)
  houndoom: '헬가',

  bosongnun: '보송눈', snoqueen: '스노퀸', kkaakdang: '까악단',
  onnurian: '학동자', onnujang: '화투루미', thanatoat: '두루광',
  vipour: '염혈목이', scorpent: '춤추사', feldaconda: '비얌마담',
  munkain: '다람톨', munklift: '훔치람쥐', banderado: '활빈다람',
  nabihalmang: '나비할망', daejangseung: '천하대장승', sottori: '솟오리',
  // Mythological pantheon (already Korean in the story text).
  hwanwoong: '환웅', poongbaek: '풍백', woosa: '우사', woonsa: '운사',

  // ── Auto-transliterated species (full dex KO coverage) ──
  disguijar: '돌제비',
  corrpanda: '그림삵',
  gawlhawk: '바위매',
  prowlrock: '벼랑매',
  prowlnox: '월식매',
  nosepassx: '코코파스',
  oribioass: '자침포',
  sandygastx: '모래꿍',
  palossandx: '사다이스',
  luninari: '달빙희',
  kidstrel: '발차매',
  falcrush: '격파매',
  ureunggul: '우렁꿀',
  metdoyaroe: '멧도야뢰',
  redheadagama: '홍염도마',
  beardiedragon: '염수룡',
  aroryong: '여울미르',
  dracopaia: '창해미르',
  maewoyong: '이내룡',
  seuphaisin: '장마룡',
  honupup: '촛불개',
  honutomb: '이끼묘견',
  arctorodon: '빙하거수',
  zoltile: '파치랩터',
  ssaktrin: '싹트린',
  longroffe: '길어프',
  onnurigrowlithe: '가디',
  onnuriarcanine: '윈디',
  onnurismoochum: '뽀뽀라',
  idolena: '불티돌',
  groundzoome: '흙무령',
  groundzomber: '흙강시',
  kelpoxin: '독미역',
  twinkluppy: '윤슬개',
  nootillunar: '달조수',
  babymammoth: '털매머',
  bookmoth: '책나방',
  venombee: '독침벌',
  glacewing: '서리나비',
  volthopper: '번개뚜기',
  dynabeetle: '화염장수',
  saekomaga: '새콤싹',
  saekomassi: '짜릿새콤',
  secommamma: '새콤마마',
  moktakgwi: '목탁귀',
  moranlovebird: '모란잉꼬',
  moransae: '모란새',
  squirrel1: '도토람',
  squirrel2: '하늘다람',
  nabicocoon: '천년고치',
  hambillet: '무쇠오리',
  ivelon: '잎멜레온',
  palmcockatoo: '북앵무',
  peacockrose: '장미공작',
  bookbug: '책벌레',
  camerghoost: '사진귀',
  burinao: '오뚝귀',
  chattyscream: '수다괴',
  balchataek: '발차택',
  crystbeetle: '수정풍뎅',
  unsilgami: '운실가미',
  kkorisagwi: '꼬리사귀',
  supiryeong: '수피령',
  bonejoillion: '보내조에일리언',
  samdumae: '삼두매',
  salmua: '살무아',
  doksalsa: '독살사',
  dundunguri: '든든구리',
  neogulgamyeon: '너굴가면',
  doribi: '도리비',
  hwidoribi: '휘도리비',
  paratoxin: '기생독',
  silicutis: '유리갑충',
  plumpypu: '포동두지',
  capaludar: '버섯동자',
  ottershaman: '수달제',
  ottermudang: '수달무당',
  liondance: '사자탈',
  turtleship: '거북선',
  kingfisher: '물총새',
  thunderon: '뇌백로',
  kudzu: '칡동이',
  wildcat: '들삵',
  foxgeist: '여우귀',
  cerrapin: '조약거북',
  booktoise: '서책거북',
  strawtle: '짚풀거북',
  roundtailor: '꼬리각시',
  sandfox: '모래여우',
  bookkuddoong: '부끄뚱',
  odamryul: '오담률',
  mushvenom: '독돌버섯',
  ghograss: '넋풀',
  trumpetcreeper: '능소풀',
  tokkigongju: '토끼공주',
  tigerbabe: '불범이',
  yeomtaeja: '염태자',
  pipetiger: '염흥왕',
  layone: '라온이',
  sotori: '솟대지기',
  gorcobat: '곡예산양',
  blazekunk: '불스컹',
  frysm: '몽개복치',
  martbadger: '무쇠오소리',
  waterdeer: '고라니',
  ssangdungori: '쌍둥오리',
  ampere: '뇌폭오리',
  rideer: '배달록',
  cheonjisin: '천지신',
  jakdangsae: '작당새',
  jakdangchi: '작당치',
  mugunga: '무궁아',
  norigung: '노리궁',
  mugungmama: '무궁마마',
  gatnannu: '갓난누',
  danachungi: '단아충이',
  nabiguni: '나비구니',
  komodread: '독왕도마',
  noeryong: '뇌룡',
  merrloween: '사탕령',
  hallowknight: '갑충기사',
  halubang: '하르방',
  ratouille: '요리쥐',
  mperodactyl: '해남익룡',
  dracoelido: '방패공룡',
  butlerawn: '집사새우',
  'api-10': '캐터피',
  'api-13': '뿔충이',
  'api-16': '구구',
  'api-19': '꼬렛',
  'api-21': '깨비참',
  'api-41': '주뱃',
  'api-66': '알통몬',
  'api-74': '꼬마돌',
  'api-95': '롱스톤',
  'api-161': '꼬리선',
  'api-163': '부우부',
  'api-198': '니로우',
  'api-197': '블래키',
  'api-246': '애버라스',
  'api-261': '포챠나',
  'api-228': '델빌',
  'api-215': '포푸니',
  'api-315': '로젤리아',
  'api-406': '꽃봉오',
  'api-147': '미뇽',
  'api-148': '신뇽',
  'api-149': '망나뇽',
  'api-132': '메타몽',
};

// ── Localization ─────────────────────────────────────────────────────────────
// The game supports English and Korean. The chosen language is a global preference
// (localStorage), independent of any save slot, and is also mirrored into the Phaser
// registry so scenes can react. Strings are localized at the call site with `t(en, ko)`
// — pass the English text plus its Korean translation; the current language decides.

export type Lang = 'en' | 'ko';

const LS_KEY = 'pk_lang';
let currentLang: Lang = 'en';
let gameRef: Phaser.Game | undefined;

/**
 * Fired whenever the active language is established or changed.
 *
 * Scenes re-read strings when they are created, so they need nothing. DOM UI that
 * lives OUTSIDE Phaser is the problem: the mobile shell is built before
 * `initI18n` has even read the saved preference, so any label it renders with
 * `t()` at construction time is frozen in whichever language happened to be
 * active at boot. Those listeners re-render on this event instead.
 */
export const LANG_EVENT = 'pokemonkorea:lang';

function announceLang(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: { lang: currentLang } }));
}

export function initI18n(game: Phaser.Game): void {
  gameRef = game;
  let saved: string | null = null;
  try { saved = localStorage.getItem(LS_KEY); } catch { /* private mode */ }
  currentLang = saved === 'ko' ? 'ko' : 'en';
  game.registry.set('lang', currentLang);
  announceLang();
}

export function getLang(): Lang { return currentLang; }

export function setLang(l: Lang, persist = true): void {
  currentLang = l;
  if (persist) {
    try { localStorage.setItem(LS_KEY, l); } catch { /* ignore */ }
  }
  gameRef?.registry.set('lang', l);
  announceLang();
}

export function toggleLang(): Lang {
  setLang(currentLang === 'ko' ? 'en' : 'ko');
  return currentLang;
}

// ── Korean particle (josa) resolution ───────────────────────────────────────
// Many dynamic Korean lines interpolate a name/word then a particle that depends
// on whether that word ends in a 받침 (final consonant): 은/는, 이/가, 을/를,
// 과/와, (으)로. Templates author these as placeholders like "(은)는" or "을(를)";
// this post-pass reads the character right before the placeholder and picks the
// correct particle, so the player never sees a raw "다람톨(으)로".
function lastHangulJong(word: string): number {
  const ch = word.charCodeAt(word.length - 1);
  if (Number.isNaN(ch) || ch < 0xAC00 || ch > 0xD7A3) return -1;   // not a Hangul syllable
  return (ch - 0xAC00) % 28;                                        // 0 = no 받침, 8 = ㄹ
}
/** Resolve every josa placeholder in a finished Korean string. Non-Hangul words
 *  (e.g. an English name) fall back to the no-받침 form, which reads naturally. */
export function resolveJosa(s: string): string {
  if (typeof s !== 'string' || s.indexOf('(') < 0) return s;   // fast path: no placeholders
  const hasB = (b: string) => lastHangulJong(b) > 0;
  return s
    .replace(/(.)(?:\(은\)는|은\(는\))/g, (_, b) => b + (hasB(b) ? '은' : '는'))
    .replace(/(.)(?:\(이\)가|이\(가\))/g, (_, b) => b + (hasB(b) ? '이' : '가'))
    .replace(/(.)(?:을\(를\)|\(을\)를|를\(을\)|\(를\)을)/g, (_, b) => b + (hasB(b) ? '을' : '를'))
    .replace(/(.)(?:\(과\)와|과\(와\)|\(와\)과|와\(과\))/g, (_, b) => b + (hasB(b) ? '과' : '와'))
    .replace(/(.)\(으\)로/g, (_, b) => { const j = lastHangulJong(b); return b + (j > 0 && j !== 8 ? '으로' : '로'); })
    .replace(/(.)\(도\)/g, (_, b) => b + '도');
}

/** Pick the localized string for the current language (falls back to English). */
export function t(en: string, ko?: string): string {
  return currentLang === 'ko' && ko !== undefined ? resolveJosa(ko) : en;
}

/** Look up an English string in the Korean dictionary. Unmapped strings (and English
 *  mode) return the original unchanged, so callers can wrap freely without risk. */
// Korean names for the OFFICIAL PokeAPI species the game fields (trainer teams and
// wild encounters). PokeAPI's battle `name` is a lower-hyphen slug (e.g. "graveler",
// "mr-mime", "farfetchd"), while these keys are the localized display names, so both
// sides are normalized (strip non-alphanumerics) before matching. This makes every
// borrowed official Pokémon read in Korean offline, without a per-species fetch.
const OFFICIAL_POKE_KR: Record<string, string> = {
  'Abomasnow': '눈설왕', 'Absol': '앱솔', 'Aggron': '보스로라', 'Altaria': '파비코리',
  'Aurorus': '아마루르가', 'Azumarill': '마릴리', 'Banette': '다크펫', 'Basculegion': '대쓰여너',
  'Bastiodon': '바리톱스', 'Beartic': '툰베어', 'Bellsprout': '모다피', 'Bibarel': '비버통',
  'Bisharp': '절각참', 'Boldore': '암트르', 'Bouffalant': '버프론', 'Braviary': '워글',
  'Bronzong': '동탁군', 'Bronzor': '동미러', 'Budew': '꼬몽울', 'Caterpie': '캐터피',
  'Chimecho': '치렁', 'Clefairy': '삐삐', 'Cloyster': '파르셀', 'Conkeldurr': '노보청',
  'Corsola': '코산호', 'Cryogonal': '프리지오', 'Cubchoo': '코고미', 'Delibird': '딜리버드',
  'Ditto': '메타몽', 'Dragonair': '신뇽', 'Dragonite': '망나뇽', 'Drapion': '드래피온',
  'Dratini': '미뇽', 'Drifblim': '둥실라이드', 'Drifloon': '흔들풍손', 'Drilbur': '두더류',
  'Dugtrio': '닥트리오', 'Dusclops': '미라몽', 'Duskull': '해골몽', 'Empoleon': '엠페르트',
  'Enamorus': '러브로스', 'Espeon': '에브이', 'Excadrill': '몰드류', 'Farfetch’d': '파오리',
  'Flygon': '플라이곤', 'Froslass': '눈여아', 'Gallade': '엘레이드', 'Garchomp': '한카리아스',
  'Gardevoir': '가디안', 'Gengar': '팬텀', 'Geodude': '꼬마돌', 'Gigalith': '기가이어스',
  'Glaceon': '글레이시아', 'Glalie': '얼음귀신', 'Gligar': '글라이거', 'Gliscor': '글라이온',
  'Golbat': '골뱃', 'Goldeen': '콘치', 'Golduck': '골덕', 'Golem': '딱구리',
  'Goodra': '미끄래곤', 'Graveler': '데구리', 'Gyarados': '갸라도스', 'Hariyama': '하리뭉',
  'Haunter': '고우스트', 'Hawlucha': '루차불', 'Haxorus': '액스라이즈', 'Hitmonlee': '시라소몬',
  'Hitmontop': '카포에라', 'Honchkrow': '돈크로우', 'Hoothoot': '부우부', 'Houndoom': '헬가',
  'Houndour': '델빌', 'Hydreigon': '삼삼드래', 'Jellicent': '탱탱겔', 'Kakuna': '딱충이',
  'Kingdra': '킹드라', 'Krabby': '크랩', 'Krookodile': '악비아르', 'Lairon': '갱도라',
  'Lanturn': '랜턴', 'Lapras': '라프라스', 'Larvitar': '애버라스', 'Latios': '라티오스',
  'Liepard': '레파르다스', 'Linoone': '직구리', 'Lucario': '루카리오', 'Ludicolo': '로파파',
  'Machamp': '괴력몬', 'Machoke': '근육몬', 'Machop': '알통몬', 'Magikarp': '잉어킹',
  'Magmar': '마그마', 'Magnemite': '코일', 'Magneton': '레어코일', 'Magnezone': '자포코일',
  'Mamoswine': '맘모꾸리', 'Mandibuzz': '버랜지나', 'Mankey': '망키', 'Mantine': '만타인',
  'Mantyke': '타만타', 'Mareep': '메리프', 'Medicham': '요가램', 'Metagross': '메타그로스',
  'Metapod': '단데기', 'Milotic': '밀로틱', 'Miltank': '밀탱크', 'Misdreavus': '무우마',
  'Mismagius': '무우마직', 'Murkrow': '니로우', 'Noctowl': '야부엉', 'Octillery': '대포무노',
  'Oddish': '뚜벅쵸', 'Onix': '롱스톤', 'Overqwil': '장침바루', 'Pelipper': '패리퍼',
  'Pichu': '피츄', 'Pidgey': '구구', 'Pikachu': '피카츄', 'Piloswine': '메꾸리', 'Poliwrath': '강챙이', 'Poochyena': '포챠나',
  'Primarina': '누리레느', 'Primeape': '성원숭', 'Quagsire': '누오', 'Quaquaval': '웨이니발',
  'Quaxly': '꾸왁스', 'Quaxwell': '아꾸왁', 'Qwilfish': '침바루', 'Rattata': '꼬렛',
  'Raichu': '라이츄', 'Rayquaza': '레쿠쟈', 'Rhydon': '코뿌리', 'Rhyhorn': '뿔카노', 'Rhyperior': '거대코뿌리',
  'Riolu': '리오르', 'Roselia': '로젤리아', 'Roserade': '로즈레이드', 'Rotom': '로토무',
  'Sableye': '깜까미', 'Salamence': '보만다', 'Sandshrew': '모래두지', 'Sandslash': '고지',
  'Sawsbuck': '바라철록', 'Scrafty': '곤율거니', 'Seaking': '왕콘치', 'Sentret': '꼬리선',
  'Sharpedo': '샤크니아', 'Shellder': '셀러', 'Shuppet': '어둠대신', 'Skarmory': '무장조',
  'Skeledirge': '라우드본', 'Skuntank': '스컹탱크', 'Slowbro': '야도란', 'Slugma': '마그마그',
  'Sneasel': '포푸니', 'Sneasler': '포푸니크', 'Snorunt': '눈꼬마', 'Snover': '눈쓰개',
  'Spearow': '깨비참', 'Stantler': '노라키', 'Staraptor': '찌르호크', 'Starmie': '아쿠스타',
  'Staryu': '별가사리', 'Steelix': '강철톤', 'Stoutland': '바랜드', 'Sudowoodo': '꼬지모',
  'Sunflora': '해루미', 'Swablu': '파비코', 'Swellow': '스왈로', 'Swinub': '꾸꾸리',
  'Tangrowth': '덩쿠림보', 'Tauros': '켄타로스', 'Tentacool': '왕눈해', 'Tentacruel': '독파리',
  'Torterra': '토대부기', 'Toxicroak': '독개굴', 'Tyranitar': '마기라스', 'Umbreon': '블래키',
  'Ursaluna': '다투곰', 'Ursaring': '링곰', 'Vanilluxe': '배바닐라', 'Vibrava': '비브라바',
  'Wailmer': '고래왕자', 'Weavile': '포푸니라', 'Weedle': '뿔충이', 'Whiscash': '메깅',
  'Wingull': '갈모매', 'Woobat': '또르박쥐', 'Yanmega': '메가자리', 'Zubat': '주뱃',
};

/** Normalize a species name for matching: lower-case, drop spaces/punctuation so a
 *  PokeAPI slug ("mr-mime") and a display name ("Mr. Mime") collapse to one key. */
const normPoke = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Reverse index: a Pokémon's English name (any case/format) → its Korean name.
// Battle UIs only have the English `data.name` (a slug, often upper-cased), so we
// match on the normalized form and fall back to the original for unmapped species.
const EN_TO_KR_POKE: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const e of POKEDEX) {
    const kr = POKE_KR[e.key];
    if (kr) map[normPoke(e.name)] = kr;
  }
  // Official PokeAPI-backed species (not in the custom regional dex).
  for (const [en, kr] of Object.entries(OFFICIAL_POKE_KR)) map[normPoke(en)] = kr;
  return map;
})();

/** Translate a Pokémon's English display name (any case/format) to Korean, else return it. */
export function pokeNameEn(name: string): string {
  if (currentLang !== 'ko' || typeof name !== 'string') return name;
  return EN_TO_KR_POKE[normPoke(name)] ?? name;
}

// Case-insensitive speaker lookup for trainer nameplates / battle intros.
const SPEAKER_LC: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const k of Object.keys(KO_SPEAKERS)) map[k.toLowerCase()] = KO_SPEAKERS[k];
  return map;
})();

// Exact strings returned by speakerName() are nameplates when passed directly
// to Phaser Text. UiScale uses this to keep overworld labels compact without
// shrinking the same name when it appears inside a longer dialogue sentence.
const SPEAKER_LABEL_TEXTS = new Set<string>();

/** Translate a trainer/NPC name to Korean (from KO_SPEAKERS), else return it. */
export function speakerName(name: string): string {
  const result = currentLang !== 'ko' || typeof name !== 'string'
    ? name
    : SPEAKER_LC[name.toLowerCase()] ?? name;
  if (typeof result === 'string') SPEAKER_LABEL_TEXTS.add(result);
  return result;
}

export function isSpeakerLabelText(value: unknown): value is string {
  return typeof value === 'string' && SPEAKER_LABEL_TEXTS.has(value);
}

// Dynamic battle lines embed a Pokémon's (English) name; translate the template and
// localize the embedded name so every battle reads in Korean.
const P = (s: string) => pokeNameEn(s);
const S = (s: string) => speakerName(s);
// Battle-message helpers: localize an embedded stat name, ability name or type.
const STAT_KR: Record<string, string> = {
  'Attack': '공격', 'Defense': '방어', 'Sp. Atk': '특수공격', 'Sp. Def': '특수방어',
  'Speed': '스피드', 'Accuracy': '명중률', 'Evasion': '회피율',
};
const ST = (s: string) => STAT_KR[s] ?? s;
const AB = (s: string) => KO_ABILITIES[s.trim().replace(/[-_]+/g, ' ').toLowerCase()] ?? s;
const TY = (s: string) => KO_TYPES[s.toLowerCase()] ?? s;
const BATTLE_PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^What will (.+) do\?  🔴×(\d+)$/, m => `${P(m[1])}는 무엇을 할까?  🔴×${m[2]}`],
  [/^What will (.+) do\?$/, m => `${P(m[1])}는 무엇을 할까?`],
  [/^(.+) fainted!$/,       m => `${P(m[1])}은 쓰러졌다!`],
  [/^Go, (.+)!$/,           m => `가랏, ${P(m[1])}!`],
  [/^Go (.+)!$/,            m => `가랏, ${P(m[1])}!`],
  [/^A wild (.+) appeared!$/, m => `앗! 야생 ${P(m[1])}이 나타났다!`],
  [/^Wild (.+) used (.+)!$/, m => `야생 ${P(m[1])}의 ${KO_STRINGS[m[2]] ?? m[2]}!`],
  [/^(.+) used (Potion|Super Potion|Hyper Potion|Max Potion) on (.+)!$/,
    m => `${S(m[1])}는 ${P(m[3])}에게 ${KO_STRINGS[m[2]] ?? m[2]}을(를) 사용했다!`],
  [/^You caught (.+)!$/,    m => `${P(m[1])}을 잡았다!`],
  [/^(.+) threw a Pokéball!$/, m => `${S(m[1])}가 몬스터볼을 던졌다!`],
  [/^(.+) used (.+)!$/,     m => `${P(m[1])}의 ${KO_STRINGS[m[2]] ?? m[2]}!`],
  [/^(.+) is already in battle!$/, m => `${P(m[1])}은 이미 배틀에 나와 있어!`],
  [/^Go! (.+)!$/,           m => `가랏! ${P(m[1])}!`],
  [/^(.+) sent out (.+)!$/, m => `${S(m[1])}가 ${P(m[2])}을 내보냈다!`],
  [/^✨ (.+) grew to Lv\. (\d+)!$/, m => `✨ ${P(m[1])}(은)는 Lv. ${m[2]}로 성장했다!`],
  [/^(.+) gained (\d+) EXP!$/, m => `${P(m[1])}(은)는 ${m[2]} 경험치를 얻었다!`],
  [/^(.+) also gained (\d+) EXP!$/, m => `${P(m[1])}(도) ${m[2]} 경험치를 얻었다!`],
  // ── Battle results, capture, party/PC and trainer lines ──
  [/^(.+) fainted! You win!$/,  m => `${P(m[1])}(은)는 쓰러졌다! 승리했다!`],
  [/^(.+) fainted! You lose!$/, m => `${P(m[1])}(은)는 쓰러졌다! 패배했다...`],
  [/^You got (.+) for winning!$/, m => `이겨서 ${m[1]}을(를) 얻었다!`],
  [/^(.+) wants to battle!$/,   m => `${S(m[1])}(이)가 승부를 걸어왔다!`],
  [/^(.+) sent out (.+)\.$/,    m => `${S(m[1])}가 ${P(m[2])}을(를) 내보냈다.`],
  [/^Will you switch your Pokémon\?$/, () => `포켓몬을 교체할까요?`],
  [/^(.+): You're out of Pokémon! Better luck next time\.$/, m => `${S(m[1])}: 네 포켓몬이 다 쓰러졌군! 다음 기회를 노려봐.`],
  [/^Leader Jin: (.+), step forward!$/, m => `관장 진: ${P(m[1])}, 나서라!`],
  [/^(.+) threw a (.+)!$/,      m => `${P(m[1])}(은)는 ${KO_STRINGS[m[2]] ?? m[2]}을(를) 던졌다!`],
  [/^✨ Gotcha! (.+) was caught!$/, m => `✨ 좋았어! ${P(m[1])}(을)를 잡았다!`],
  [/^Added to your party!$/,    () => `파티에 추가되었다!`],
  [/^But your party is full\.$/, () => `하지만 파티가 가득 찼다.`],
  [/^Oh no! (.+) broke free!$/, m => `안 돼! ${P(m[1])}(이)가 튀어나왔다!`],
  [/^(.+) joined the party!$/,  m => `${P(m[1])}(이)가 파티에 합류했다!`],
  [/^(.+) was sent to the PC\.$/, m => `${P(m[1])}(은)는 PC로 보내졌다.`],
  [/^Max HP: (\d+)$/,           m => `최대 HP: ${m[1]}`],
  [/^(.+)'s (.+) prevents escape!$/, m => `${P(m[1])}의 ${AB(m[2])}(으)로 도망칠 수 없다!`],
  // ── Status conditions (inflicted / persistent turn effects) ──
  [/^(.+) was paralyzed!$/,   m => `${P(m[1])}(은)는 마비되어 버렸다!`],
  [/^(.+) was burned!$/,      m => `${P(m[1])}(은)는 화상을 입었다!`],
  [/^(.+) was poisoned!$/,    m => `${P(m[1])}(은)는 독에 걸렸다!`],
  [/^(.+) fell asleep!$/,     m => `${P(m[1])}(은)는 잠들어 버렸다!`],
  [/^(.+) was frozen!$/,      m => `${P(m[1])}(은)는 얼어붙었다!`],
  [/^(.+) was afflicted!$/,   m => `${P(m[1])}(은)는 상태이상에 걸렸다!`],
  [/^(.+) is paralyzed! It can't move!$/, m => `${P(m[1])}(은)는 몸이 저려서 움직일 수 없다!`],
  [/^(.+) is fast asleep\.$/, m => `${P(m[1])}(은)는 새근새근 잠들어 있다.`],
  [/^(.+) is frozen solid!$/, m => `${P(m[1])}(은)는 꽁꽁 얼어붙었다!`],
  [/^(.+) woke up!$/,         m => `${P(m[1])}(은)는 잠에서 깨어났다!`],
  [/^(.+) thawed out!$/,      m => `${P(m[1])}의 얼음이 녹았다!`],
  [/^(.+)'s Insomnia woke it up!$/, m => `${P(m[1])}의 불면 특성으로 잠에서 깨어났다!`],
  [/^(.+)'s Limber cured its paralysis!$/, m => `${P(m[1])}의 유연 특성으로 마비가 나았다!`],
  [/^(.+)'s Hydration cured its status condition!$/, m => `${P(m[1])}의 촉촉바디 특성으로 상태이상이 나았다!`],
  [/^(.+)'s Shed Skin cured its status condition!$/, m => `${P(m[1])}의 탈피 특성으로 상태이상이 나았다!`],
  [/^(.+)'s Natural Cure healed its status condition!$/, m => `${P(m[1])}의 자연회복 특성으로 상태이상이 나았다!`],
  // ── Stat-stage changes ──
  [/^(.+)'s (Attack|Defense|Sp\. Atk|Sp\. Def|Speed|Accuracy|Evasion) rose drastically!$/, m => `${P(m[1])}의 ${ST(m[2])}(이)가 매우 크게 올랐다!`],
  [/^(.+)'s (Attack|Defense|Sp\. Atk|Sp\. Def|Speed|Accuracy|Evasion) rose sharply!$/, m => `${P(m[1])}의 ${ST(m[2])}(이)가 크게 올랐다!`],
  [/^(.+)'s (Attack|Defense|Sp\. Atk|Sp\. Def|Speed|Accuracy|Evasion) rose!$/, m => `${P(m[1])}의 ${ST(m[2])}(이)가 올랐다!`],
  [/^(.+)'s (Attack|Defense|Sp\. Atk|Sp\. Def|Speed|Accuracy|Evasion) harshly fell!$/, m => `${P(m[1])}의 ${ST(m[2])}(이)가 크게 떨어졌다!`],
  [/^(.+)'s (Attack|Defense|Sp\. Atk|Sp\. Def|Speed|Accuracy|Evasion) fell!$/, m => `${P(m[1])}의 ${ST(m[2])}(이)가 떨어졌다!`],
  [/^(.+)'s (.+) won't go any higher!$/, m => `${P(m[1])}의 ${ST(m[2])}(은)는 더 이상 오르지 않는다!`],
  [/^(.+)'s (.+) won't go any lower!$/, m => `${P(m[1])}의 ${ST(m[2])}(은)는 더 이상 내려가지 않는다!`],
  [/^(.+)'s lowered stats returned to normal!$/, m => `${P(m[1])}의 떨어진 능력이 원래대로 돌아왔다!`],
  // ── Ability-inflicted status ──
  [/^(.+) was paralyzed by (.+)!$/, m => `${P(m[1])}은 ${AB(m[2])}(으)로 마비되었다!`],
  [/^(.+) was burned by (.+)!$/, m => `${P(m[1])}은 ${AB(m[2])}(으)로 화상을 입었다!`],
  [/^(.+) was poisoned by (.+)!$/, m => `${P(m[1])}은 ${AB(m[2])}(으)로 독에 걸렸다!`],
  [/^(.+) was afflicted by (.+)!$/, m => `${P(m[1])}은 ${AB(m[2])}(으)로 상태이상에 걸렸다!`],
  [/^(.+) was captivated by (.+)!$/, m => `${P(m[1])}은 ${AB(m[2])}(으)로 헤롱헤롱해졌다!`],
  // ── Weather / entry / stat abilities ──
  [/^(.+)'s Drizzle made it rain!$/, m => `${P(m[1])}의 잔비 특성으로 비가 내리기 시작했다!`],
  [/^(.+)'s Drought intensified the sunlight!$/, m => `${P(m[1])}의 가뭄 특성으로 햇살이 강해졌다!`],
  [/^(.+)'s Sand Stream whipped up a sandstorm!$/, m => `${P(m[1])}의 모래날림 특성으로 모래바람이 일었다!`],
  [/^(.+)'s Snow Warning summoned snow!$/, m => `${P(m[1])}의 눈퍼뜨리기 특성으로 눈이 내리기 시작했다!`],
  [/^(.+)'s Inner Focus prevented Intimidate!$/, m => `${P(m[1])}의 정신력 특성으로 위협을 막았다!`],
  [/^(.+)'s Ancient Activation boosted its strongest stat!$/, m => `${P(m[1])}의 고대의 태동으로 가장 높은 능력이 강해졌다!`],
  [/^(.+)'s Stonegaze lowered (.+)'s Speed!$/, m => `${P(m[1])}의 돌응시로 ${P(m[2])}의 스피드가 떨어졌다!`],
  [/^(.+)'s (.+) lowered (.+)'s Attack!$/, m => `${P(m[1])}의 ${AB(m[2])} 특성으로 ${P(m[3])}의 공격이 떨어졌다!`],
  // ── Move / ability effects ──
  [/^(.+)'s attack missed!$/, m => `${P(m[1])}의 공격은 빗나갔다!`],
  [/^(.+) began charging power!$/, m => `${P(m[1])}은 힘을 모으기 시작했다!`],
  [/^(.+) flew up high!$/, m => `${P(m[1])}은 하늘 높이 날아올랐다!`],
  [/^(.+) vanished from sight!$/, m => `${P(m[1])}은 모습을 감췄다!`],
  [/^(.+) restored (\d+) HP!$/, m => `${P(m[1])}은 HP를 ${m[2]} 회복했다!`],
  [/^(.+)'s HP is already full!$/, m => `${P(m[1])}의 HP는 이미 가득 찼다!`],
  [/^(.+) absorbed (\d+) HP!$/, m => `${P(m[1])}은 HP를 ${m[2]} 흡수했다!`],
  [/^(.+) was damaged by recoil!$/, m => `${P(m[1])}은 반동으로 데미지를 입었다!`],
  [/^(.+) flinched from Stench!$/, m => `${P(m[1])}은 악취 특성에 풀이 죽었다!`],
  [/^(.+) endured the hit with Sturdy!$/, m => `${P(m[1])}은 옹골참 특성으로 공격을 버텨냈다!`],
  [/^(.+) is immune through Levitate!$/, m => `${P(m[1])}은 부유 특성으로 공격을 받지 않았다!`],
  [/^(.+)'s Flash Fire absorbed the flames!$/, m => `${P(m[1])}의 타오르는불꽃 특성이 불꽃을 흡수했다!`],
  [/^(.+)'s Lightning Rod nullified the attack and raised Sp\. Atk!$/, m => `${P(m[1])}의 피뢰침 특성이 공격을 무효화하고 특수공격을 올렸다!`],
  [/^(.+)'s Volt Absorb restored (\d+) HP!$/, m => `${P(m[1])}의 축전 특성으로 HP를 ${m[2]} 회복했다!`],
  [/^(.+)'s Water Absorb restored (\d+) HP!$/, m => `${P(m[1])}의 저수 특성으로 HP를 ${m[2]} 회복했다!`],
  [/^(.+)'s Water Compaction sharply raised Defense!$/, m => `${P(m[1])}의 꾸덕꾸덕굳기 특성으로 방어가 크게 올랐다!`],
  [/^(.+)'s (.+) raised Attack!$/, m => `${P(m[1])}의 ${AB(m[2])} 특성으로 공격이 올랐다!`],
  [/^(.+)'s (.+) powered up the move!$/, m => `${P(m[1])}의 ${AB(m[2])} 특성으로 기술이 강해졌다!`],
  [/^(.+)'s Pixilate turned the move into Fairy type!$/, m => `${P(m[1])}의 페어리스킨 특성으로 기술이 페어리타입이 되었다!`],
  [/^(.+)'s Protean changed it to (.+) type!$/, m => `${P(m[1])}의 변환자재 특성으로 ${TY(m[2])}타입이 되었다!`],
  [/^(.+) changed to (.+) type!$/, m => `${P(m[1])}은 ${TY(m[2])}타입이 되었다!`],
  [/^(.+)'s Cursed Body disabled (.+)!$/, m => `${P(m[1])}의 저주받은바디 특성이 ${KO_STRINGS[m[2]] ?? m[2]}(을)를 사슬묶기했다!`],
  [/^(.+)'s Dancer copied (.+)!$/, m => `${P(m[1])}의 발놀림 특성이 ${KO_STRINGS[m[2]] ?? m[2]}(을)를 따라했다!`],
  [/^(.+)'s Overcoat blocked the powder!$/, m => `${P(m[1])}의 폭풍대비 특성으로 가루를 막았다!`],
  // Evolution
  [/^What\? (.+) is evolving!$/,                       m => `어라? ${P(m[1])}의 모습이...!`],
  [/^Congratulations! Your ([\s\S]+?)\nevolved into (.+)!$/, m => `축하해! ${P(m[1])}가\n${P(m[2])}(으)로 진화했다!`],
  [/^(.+) stopped evolving!$/,                         m => `${P(m[1])}의 진화가 멈췄다!`],
  // Trainer battle flow
  [/^(.+) wants to battle!$/,   m => `${S(m[1])}가 승부를 걸어왔다!`],
  [/^You got (.+) for winning!$/, m => `이겨서 ${m[1]}을 얻었다!`],
  // New-game name prompts (embed the chosen names)
  [/^Prof\. Song: This spirited young trainer will be your rival, (.+)\. What is their name\?$/,
    m => `송 박사: 이 활기찬 젊은 트레이너가 네 라이벌이 될 거야, ${m[1]}. 그 아이의 이름은?`],
  [/^Prof\. Song: Now you're all set, (.+)! (.+) is waiting to see how far you'll go\. I hope you enjoy your adventure!$/,
    m => `송 박사: 이제 다 됐구나, ${m[1]}! ${m[2]}이와 네가 얼마나 멀리 갈지 지켜보고 있어. 즐거운 모험이 되길 바란다!`],
  // Waterfall City — rival departure cutscene (speaker is the rival's chosen name)
  [/^(.+): Hey, (.+)! Stop right there\.$/,        m => `${S(m[1])}: 야, ${m[2]}! 거기 서.`],
  [/^(.+): You think you can just leave town with (.+)\?$/, m => `${S(m[1])}: 그 ${P(m[2])} 데리고 그냥 마을을 뜰 수 있을 것 같아?`],
  [/^(.+): I chose (.+)\.\nWe have both been waiting for this\.$/, m => `${S(m[1])}: 난 ${P(m[2])}(으)로 정했어.\n우리 둘 다 이 순간을 기다려왔잖아.`],
  // Waterfall City — Mom (home) and Prof. Song (lab), embedding the starter's name
  [/^Mom: So you chose (.+)! I'm so proud of you\.$/, m => `엄마: ${P(m[1])}(으)로 정했구나! 정말 자랑스러워.`],
  [/^Prof\. Song: How is (.+) settling in\? A fine choice — I can tell you two already trust each other\.$/,
    m => `송 박사: ${P(m[1])}(은)는 잘 적응하고 있니? 훌륭한 선택이야 — 너희 둘은 벌써 서로를 믿고 있는 게 보이는구나.`],
  // ── Battle results / wild capture / EXP / TM ──
  [/^(.+) fainted! You win!$/,  m => `${P(m[1])}은 쓰러졌다! 승리!`],
  [/^(.+) fainted! You lose!$/, m => `${P(m[1])}은 쓰러졌다! 패배...`],
  [/^(.+) fainted\.\.\.$/,      m => `${P(m[1])}은 쓰러졌다...`],
  [/^Leader Jin: (.+), step forward!$/,          m => `관장 진: ${P(m[1])}, 나서라!`],
  [/^Leader Jin: You are strong\. (.+), come!$/, m => `관장 진: 강하구나. ${P(m[1])}, 나와라!`],
  [/^Oh no! (.+) broke free!$/, m => `이런! ${P(m[1])}이 튀어나왔다!`],
  [/^(.+) joined the party!\n(.+) was sent to the PC\.$/, m => `${P(m[1])}이 동료에 합류했다!\n${P(m[2])}은 PC로 보내졌다.`],
  [/^(.+) was sent to the PC\.$/, m => `${P(m[1])}은 PC로 보내졌다.`],
  [/^Swap a Pokémon for (.+), or send it to the PC\?$/, m => `${P(m[1])}을 위해 포켓몬을 교체할까, 아니면 PC로 보낼까?`],
  [/^✨ Gotcha! (.+) was caught!\nAdded to your party!$/, m => `✨ 좋았어! ${P(m[1])}을 잡았다!\n동료에 추가됐다!`],
  [/^✨ Gotcha! (.+) was caught!\nBut your party is full\.$/, m => `✨ 좋았어! ${P(m[1])}을 잡았다!\n하지만 동료가 가득 찼다.`],
  [/^✨ (.+) grew to Lv\. (\d+)!\nMax HP: (\d+)$/, m => `✨ ${P(m[1])}(은)는 Lv. ${m[2]}로 성장했다!\n최대 HP: ${m[3]}`],
  [/^\n✨ (.+) grew to Lv\. (\d+)!$/, m => `\n✨ ${P(m[1])}(은)는 Lv. ${m[2]}로 성장했다!`],
  [/^Received: TM — (.+)!  \(Check your Bag to teach it\.\)$/, m => `받았다: 기술머신 — ${KO_STRINGS[m[1]] ?? m[1]}!  (가방에서 가르칠 수 있어.)`],
  // ── Trainer battle flow ──
  [/^(.+) sent out (.+)\.\nWill you switch your Pokémon\?$/, m => `${S(m[1])}가 ${P(m[2])}을 내보냈다.\n포켓몬을 교체할까?`],
  [/^([\s\S]+)\nYou got (.+) for winning!$/, m => `${tr(m[1])}\n이겨서 ${m[2]}을 얻었다!`],
  // ── Rival battle ──
  [/^(.+): Tch\. You got me this time\.\n(.+) gained (\d+) EXP!$/, m => `${S(m[1])}: 쳇. 이번엔 네가 이겼군.\n${P(m[2])}(은)는 ${m[3]} 경험치를 얻었다!`],
  [/^You lost\.\.\.\n(.+): Don't give up\. Come back stronger!\nMom healed your Pokémon at home\.$/, m => `졌다...\n${S(m[1])}: 포기하지 마. 더 강해져서 돌아와!\n엄마가 집에서 네 포켓몬을 회복시켜줬다.`],
  // ── Menu — moves / lead / badges ──
  [/^(.+) forgot (.+) and learned (.+)!$/, m => `${P(m[1])}(은)는 ${KO_STRINGS[m[2]] ?? m[2]}(을)를 잊고 ${KO_STRINGS[m[3]] ?? m[3]}(을)를 배웠다!`],
  [/^(.+) already knows (.+)\.$/, m => `${P(m[1])}(은)는 이미 ${KO_STRINGS[m[2]] ?? m[2]}(을)를 알고 있어.`],
  [/^(.+) did not learn (.+)\.$/, m => `${P(m[1])}(은)는 ${KO_STRINGS[m[2]] ?? m[2]}(을)를 배우지 않았다.`],
  [/^(.+) wants to learn (.+), but it already knows 4 moves\.$/, m => `${P(m[1])}(은)는 ${KO_STRINGS[m[2]] ?? m[2]}(을)를 배우고 싶어하지만, 이미 기술을 4개 배웠어.`],
  [/^(.+) wants to learn (.+)\.$/, m => `${P(m[1])}(은)는 ${KO_STRINGS[m[2]] ?? m[2]}(을)를 배우고 싶어해.`],
  [/^(.+) learned (.+)!$/, m => `${P(m[1])}(은)는 ${KO_STRINGS[m[2]] ?? m[2]}(을)를 배웠다!`],
  [/^(.+) is now your lead!$/, m => `${P(m[1])}(을)를 선두로 지정했다!`],
  [/^(\d+) of (\d+) badges collected\. Tap to view your case\.$/, m => `배지 ${m[2]}개 중 ${m[1]}개 획득. 탭하면 배지 케이스를 봐.`],
  [/^Teach (.+) to…$/, m => `${KO_STRINGS[m[1]] ?? m[1]}(을)를 누구에게 가르칠까…`],
  [/^Use (.+) on…$/, m => `${KO_STRINGS[m[1]] ?? m[1]}(을)를 누구에게 쓸까…`],
  // ── Quiz / checkpoints ──
  [/^Question (\d+) of (\d+)\.$/, m => `${m[2]}문제 중 ${m[1]}번.`],
  [/^어사대장 Hyeon: (\d+) of (\d+)\. A clear and ordered mind\. The academy is satisfied\.$/, m => `어사대장 현: ${m[2]}문제 중 ${m[1]}개 정답. 맑고 정연한 정신이군. 학원은 만족한다.`],
  [/^어사대장 Hyeon: (\d+) of (\d+)\. Not yet — a scholar who guesses is no scholar\.$/, m => `어사대장 현: ${m[2]}문제 중 ${m[1]}개 정답. 아직이다 — 찍는 자는 학자가 아니다.`],
  [/^Receptionist: (\d+) of the Elite Four down already — the whole region is talking about you\.$/, m => `안내원: 벌써 사천왕 중 ${m[1]}명 격파 — 온 지역이 네 이야기로 떠들썩해.`],
  [/^League Warden: You hold (\d+) of 8 마패\. Complete the inspectorate circuit, defeat Supreme Gwang in Gwanmunseong, and return\.$/, m => `리그 문지기: 너는 8개 중 ${m[1]}개의 마패를 지녔다. 어사대 순회를 마치고, 관문성에서 총수 광을 이기고 돌아와라.`],
  [/^Royal Warden: You bear (\d+) of the (\d+) regional tablets\. Complete the circuit and return\.$/, m => `왕실 관리인: 너는 ${m[2]}개 중 ${m[1]}개의 지방 석판을 지녔다. 순회를 마치고 돌아오라.`],
  [/^Royal Warden: You bear (\d+) of the (\d+) regional tablets\. Complete the circuit and return through this checkpoint\.$/, m => `왕실 관리인: 너는 ${m[2]}개 중 ${m[1]}개의 지방 마패를 지녔다. 순회를 마치고 이 검문소로 돌아오라.`],
  [/^Supreme Gwang: You have (\d+) of the 7 regional 마패\. Return when you have mastered all seven regional trials\.$/, m => `총수 광: 너는 7개 중 ${m[1]}개의 지방 마패를 지녔다. 일곱 지방 시험을 모두 통달한 뒤에 돌아오라.`],
  // ── Starter select / badge scanner ──
  [/^Choose (.+)\?$/, m => `${P(m[1])}(으)로 정할까?`],
  [/^Badge Scanner: Scanning trainer credentials\.\.\. (\d+) \/ (\d+) badges detected\.$/, m => `배지 스캐너: 트레이너 자격 확인 중... ${m[2]}개 중 ${m[1]}개 배지 감지됨.`],
  [/^Badge Scanner: Scanning trainer credentials\.\.\. all (\d+) region badges verified\.$/, m => `배지 스캐너: 트레이너 자격 확인 중... ${m[1]}개 지역 배지 전부 확인됨.`],
  [/^Badge Scanner: The gate is sealed\. Still missing: (.+)\.$/, m => `배지 스캐너: 관문이 봉인돼 있다. 아직 부족: ${m[1]}.`],
  // ── Starter select — Prof. Song hands over the Pokédex ──
  [/^Prof\. Song: Excellent choice! (.+) is happy to travel with you\.\nAnd take this — your very own Pokédex! Press M, open your BAG,\nand select the Pokémon Encyclopedia to study every Pokémon you meet\.$/,
    m => `송 박사: 훌륭한 선택이야! ${P(m[1])}(은)는 너와 함께 여행하게 되어 기뻐하고 있어.\n그리고 이걸 받아 — 너만의 포켓몬 도감이야! M을 눌러 가방을 열고,\n포켓몬 도감을 선택해 만나는 모든 포켓몬을 조사해봐.`],
  [/^Prof\. Song: One more thing — take this Exp\. Share\.\nWhile it's ON, every Pokémon in your party gains EXP from battle,\neven benched ones\. Open your BAG anytime to switch it on or off\.$/,
    () => `송 박사: 하나 더 — 이 학습장치를 받아.\n켜져 있는 동안엔 배틀에서 얻은 경험치를 파티의 모든 포켓몬이 나눠 받아,\n벤치에 있는 포켓몬도 말이야. 가방에서 언제든 켜고 끌 수 있어.`],
  // ── EXP-to-next-level suffix + map / city signposts ──
  [/^([\s\S]+)  \((\d+) to next level\)$/, m => `${tr(m[1])}  (다음 레벨까지 ${m[2]})`],
  [/^📍 You are here — (.+) \((.+)\)$/, m => `📍 현재 위치 — ${m[2]}`],
  [/^🏙 Capitol City( — .+)?$/, m => `🏙 소올 시티${m[1] ? tr(m[1]) : ''}`],
  [/^Teach (.+) to a Pokémon to fly between cities\.   ·   ESC\/M: close$/, m => `${KO_STRINGS[m[1]] ?? m[1]}을(를) 포켓몬에게 가르치면 도시 사이를 즉시 비행할 수 있어.   ·   ESC/M: 닫기`],
];

export function tr(en: string): string {
  if (currentLang !== 'ko' || typeof en !== 'string') return en;
  return resolveJosa(trKo(en));
}

function trKo(en: string): string {
  const exact = KO_STRINGS[en] ?? KO_STRINGS[en.trim()];
  if (exact) return exact;
  for (const [re, fn] of BATTLE_PATTERNS) {
    const m = en.match(re);
    if (m) return fn(m);
  }
  // "Speaker: spoken line" — translate the speaker and the line independently, so a
  // line only needs its spoken text in the dictionary to localize (and vice-versa).
  const idx = en.indexOf(': ');
  if (idx > 0 && idx <= 24) {
    const speaker = en.slice(0, idx);
    const rest = en.slice(idx + 2);
    const koRest = KO_STRINGS[rest] ?? KO_STRINGS[rest.trim()];
    const koSpeaker = KO_SPEAKERS[speaker];
    if (koRest || koSpeaker) return `${koSpeaker ?? speaker}: ${koRest ?? rest}`;
  }
  // Battle sequences show several messages as one string joined by newlines
  // (e.g. "Super effective!\nX's Defense fell!"). The per-line battle patterns
  // are anchored, so they never match the combined string — translate each line
  // on its own as a last resort (after the whole-string lookups above, which keep
  // any genuinely multi-line dictionary entry intact).
  if (en.includes('\n')) {
    const lines = en.split('\n');
    const translated = lines.map(line => tr(line));
    if (translated.some((line, i) => line !== lines[i])) return translated.join('\n');
  }
  return en;
}

/** A type's display name in the current language. */
export function typeName(type: string): string {
  if (currentLang === 'ko') return KO_TYPES[type?.toLowerCase?.()] ?? type;
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : type;
}

/** Localize both official and Onnuri-original ability names. `localizedKo` is
 * supplied for official abilities hydrated from PokeAPI; the local dictionary
 * keeps custom abilities and offline play fully translated. */
export function abilityName(ability: string, localizedKo?: string): string {
  if (!ability) return currentLang === 'ko' ? '알 수 없음' : 'Unknown';
  const humanize = (value: string) => value.trim().replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  if (currentLang !== 'ko') return ability.split('/').map(humanize).join(' / ');
  if (localizedKo) return localizedKo;
  return ability.split('/').map(part => {
    const normalized = part.trim().replace(/[-_]+/g, ' ').toLowerCase();
    return KO_ABILITIES[normalized] ?? humanize(part);
  }).join(' / ');
}

/** A Pokémon's display name in the current language (Korean from the dictionary). */
export function pokeName(key: string, fallback?: string): string {
  if (currentLang === 'ko' && POKE_KR[key]) return POKE_KR[key];
  return dexEntry(key)?.name ?? fallback ?? key;
}
