import { existsSync, readFileSync } from 'node:fs';
import { KO_STRINGS, KO_SPEAKERS } from '../src/data/ko_strings';
import { JA_STRINGS, JA_SPEAKERS, JA_OFFICIAL_POKEMON } from '../src/data/ja_strings';
import { KO_CONTENT_STRINGS } from '../src/data/ko_content_strings';

// KO_CONTENT_STRINGS is the Korean pass over Pokédex entries, habitats, item
// and place names that previously rendered in English for BOTH languages.
// Japanese still falls back to English for these (unchanged behaviour), so
// they are reported separately instead of counting as a parity regression.
const contentOnly = (key: string): boolean => key in KO_CONTENT_STRINGS;
const translatedStrings = Object.keys(KO_STRINGS).filter(key => JA_STRINGS[key] !== undefined);
const missingStrings = Object.keys(KO_STRINGS).filter(key => JA_STRINGS[key] === undefined && !contentOnly(key));
const contentPendingJapanese = Object.keys(KO_STRINGS).filter(key => JA_STRINGS[key] === undefined && contentOnly(key));
const translatedSpeakers = Object.keys(KO_SPEAKERS).filter(key => JA_SPEAKERS[key] !== undefined);
const missingSpeakers = Object.keys(KO_SPEAKERS).filter(key => JA_SPEAKERS[key] === undefined);
const hangulStringValues = Object.entries(KO_STRINGS)
  .filter(([key]) => /[가-힣]/.test(JA_STRINGS[key] ?? ''))
  .map(([key]) => [key, JA_STRINGS[key]]);
const hangulSpeakerValues = Object.entries(KO_SPEAKERS)
  .filter(([key]) => /[가-힣]/.test(JA_SPEAKERS[key] ?? ''))
  .map(([key]) => [key, JA_SPEAKERS[key]]);
const identicalStringValues = Object.keys(KO_STRINGS)
  .filter(key => JA_STRINGS[key] === key)
  .map(key => [key, JA_STRINGS[key]]);

// Different battle moves must never render as the same Korean label. That made
// Thunder Shock and Shock Wave look like two copies of one move even though
// their internal battle records were distinct.
const koStringSource = readFileSync('src/data/ko_strings.ts', 'utf8');
const moveSection = koStringSource.match(/\/\/ ── Move names ──([\s\S]*?)\/\/ ── Interpolated/);
const koMoveKeys = moveSection
  ? [...moveSection[1].matchAll(/^\s*'([^']+)':/gm)].map(match => match[1])
  : [];
const moveNamesByKorean = new Map<string, string[]>();
for (const key of koMoveKeys) {
  const localized = KO_STRINGS[key]?.trim();
  if (!localized) continue;
  const keys = moveNamesByKorean.get(localized) ?? [];
  keys.push(key);
  moveNamesByKorean.set(localized, keys);
}
const duplicateKoreanMoveNames = [...moveNamesByKorean.entries()]
  .filter(([, keys]) => keys.length > 1)
  .map(([localized, keys]) => ({ localized, keys }));
const requiredDynamicMoveNames = [
  'Air Slash', 'Aurora Veil', 'Body Slam', 'Brave Bird', 'Brick Break', 'Bug Buzz',
  'Close Combat', 'Dark Pulse', 'Dazzling Gleam', 'Draco Meteor', 'Dragon Pulse',
  'Earth Power', 'Energy Ball', 'Fire Blast', 'Flash Cannon', 'Hydro Pump', 'Ice Beam',
  'Iron Head', 'Leaf Blade', 'Rock Slide', 'Shadow Ball', 'Shadow Claw', 'Sludge Bomb',
  'Stone Edge', 'Venoshock', 'Wood Hammer',
] as const;
const missingKoreanMoveNames = requiredDynamicMoveNames.filter(name => !KO_STRINGS[name]?.trim());

const bucket = (key: string): string => {
  if (/^(?:[A-Z][\w .'-]{0,24}:|📟|✨|\(|The |A |You |Your |After |Before |With |As )/.test(key)) return 'dialogue/story';
  if (/battle|Pokémon|HP|PP|move|type|ability|party|Box|Bag|badge|heal|item|switch|caught/i.test(key)) return 'gameplay/ui';
  if (/Route|City|Town|Village|Forest|Beach|Mine|Peak|Pass|Gym|League|Center|Lab|Mart|↑|→|←|↓/i.test(key)) return 'world/sign';
  return 'other';
};

const missingByBucket = missingStrings.reduce<Record<string, number>>((out, key) => {
  const name = bucket(key);
  out[name] = (out[name] ?? 0) + 1;
  return out;
}, {});

const requiredJapanese = [
  '▶  NEW GAME', 'Hello there! Welcome to the world of Pokémon!', 'Who are you?',
  'Prof. Song: Welcome! Three Pokémon from this region are waiting for a trainer.\nChoose the one who calls to you.',
  'FIGHT', 'BAG', 'POKÉMON', 'RUN', 'POKÉMON STORAGE SYSTEM', 'Pokémon Center',
  'The Onnuri Pokémon League. Four masters guard the road to the Champion, each in their own hall.',
  'Hwangeum (extending his hand): Welcome to the Hall of Fame. You earned every step of it.',
];
const failures = requiredJapanese.filter(key => !JA_STRINGS[key]?.trim());
if (!moveSection || koMoveKeys.length === 0) failures.push('Korean move translation section could not be audited');
if (duplicateKoreanMoveNames.length) {
  failures.push(`duplicate Korean move labels: ${duplicateKoreanMoveNames
    .map(entry => `${entry.localized} (${entry.keys.join(', ')})`).join('; ')}`);
}
if (missingKoreanMoveNames.length) failures.push(`missing Korean move names: ${missingKoreanMoveNames.join(', ')}`);
if (KO_SPEAKERS['노스단 Scout Garam'] !== '노스단 정찰대 가람'
  || JA_SPEAKERS['노스단 Scout Garam'] !== 'ノス団 偵察兵 ガラム') {
  failures.push('Scout Garam trainer name is not localized consistently');
}
if (!KO_STRINGS["Let's battle!"]
  || !KO_STRINGS["You're the one nosing around the Chiefs' business. The valley road is ours tonight — cargo moves north. Turn back, Champion."]) {
  failures.push('Scout Garam encounter dialogue is not fully localized');
}
const i18nSource = readFileSync('src/systems/i18n.ts', 'utf8');
const menuSource = readFileSync('src/scenes/MenuScene.ts', 'utf8');
for (const fragment of [
  'export function moveName(name: string)',
  'KO_STRING_LC.get(clean.toLowerCase())',
  '/^(.+) wants to learn (.+), but it already knows 4 moves\\.$/',
  '${KMOVE(m[2])}(을)를 배우고 싶어하지만',
]) {
  if (!i18nSource.includes(fragment)) failures.push(`dynamic move localization guard missing: ${fragment}`);
}
if (!menuSource.includes('tr(`Teach ${move} to…`)')
  || !menuSource.includes('.map(typeName).join')
  || !menuSource.includes('msg = tr(msg);')) {
  failures.push('TM/HM teaching menu still has a path that bypasses localization');
}
const titleSource = readFileSync('src/scenes/TitleScene.ts', 'utf8');
if (!existsSync('public/assets/title/pokemon-string-logo-ja.webp')
  || !existsSync('public/assets/title/pokemon-string-opening-ja.webp')) {
  failures.push('Japanese title artwork is missing');
}
if (!titleSource.includes("getLang() === 'ja'")
  || !titleSource.includes('drawJapaneseTitleLogo()')
  || !titleSource.includes('drawJapaneseMenu()')
  || !titleSource.includes("url: 'assets/title/pokemon-string-opening-ja.webp'")) {
  failures.push('Japanese language selection does not activate its localized title design');
}
if (Object.keys(JA_OFFICIAL_POKEMON).length < 150) {
  failures.push(`official Pokémon dictionary too small: ${Object.keys(JA_OFFICIAL_POKEMON).length}`);
}
if (missingStrings.length) failures.push(`missing Japanese strings: ${missingStrings.length}`);
if (missingSpeakers.length) failures.push(`missing Japanese speakers: ${missingSpeakers.length}`);
if (hangulStringValues.length) failures.push(`Hangul remains in Japanese strings: ${hangulStringValues.length}`);
if (hangulSpeakerValues.length) failures.push(`Hangul remains in Japanese speakers: ${hangulSpeakerValues.length}`);

console.log(JSON.stringify({
  strings: {
    total: Object.keys(KO_STRINGS).length,
    translated: translatedStrings.length,
    missing: missingStrings.length,
    percent: Number((translatedStrings.length / Object.keys(KO_STRINGS).length * 100).toFixed(1)),
    missingByBucket,
  },
  speakers: {
    total: Object.keys(KO_SPEAKERS).length,
    translated: translatedSpeakers.length,
    missing: missingSpeakers.length,
    percent: Number((translatedSpeakers.length / Object.keys(KO_SPEAKERS).length * 100).toFixed(1)),
  },
  contentPendingJapanese: contentPendingJapanese.length,
  officialPokemon: Object.keys(JA_OFFICIAL_POKEMON).length,
  japaneseTitleDesign: failures.some(message => message.includes('Japanese title')) ? 'failed' : 'passed',
  quality: {
    hangulStringValues,
    hangulSpeakerValues,
    identicalStringValues,
    duplicateKoreanMoveNames,
    missingKoreanMoveNames,
  },
  failures,
  sampleMissingGameplay: missingStrings.filter(key => bucket(key) === 'gameplay/ui').slice(0, 300),
  sampleMissingWorld: missingStrings.filter(key => bucket(key) === 'world/sign').slice(0, 300),
  sampleMissingSpeakers: missingSpeakers.slice(0, 400),
}, null, 2));

if (failures.length) process.exitCode = 1;
