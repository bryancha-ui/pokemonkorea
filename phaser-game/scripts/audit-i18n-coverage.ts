import { KO_STRINGS, KO_SPEAKERS } from '../src/data/ko_strings';
import { JA_STRINGS, JA_SPEAKERS, JA_OFFICIAL_POKEMON } from '../src/data/ja_strings';

const translatedStrings = Object.keys(KO_STRINGS).filter(key => JA_STRINGS[key] !== undefined);
const missingStrings = Object.keys(KO_STRINGS).filter(key => JA_STRINGS[key] === undefined);
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
  officialPokemon: Object.keys(JA_OFFICIAL_POKEMON).length,
  quality: {
    hangulStringValues,
    hangulSpeakerValues,
    identicalStringValues,
  },
  failures,
  sampleMissingGameplay: missingStrings.filter(key => bucket(key) === 'gameplay/ui').slice(0, 300),
  sampleMissingWorld: missingStrings.filter(key => bucket(key) === 'world/sign').slice(0, 300),
  sampleMissingSpeakers: missingSpeakers.slice(0, 400),
}, null, 2));

if (failures.length) process.exitCode = 1;
