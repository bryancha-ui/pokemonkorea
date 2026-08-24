import { KO_SPEAKERS, KO_STRINGS } from '../src/data/ko_strings';
import { JA_SPEAKERS, JA_STRINGS } from '../src/data/ja_strings';

const kind = process.argv[2] === 'speakers' ? 'speakers' : 'strings';
const offset = Number.parseInt(process.argv[3] ?? '0', 10) || 0;
const limit = Number.parseInt(process.argv[4] ?? '100', 10) || 100;
const source = kind === 'speakers' ? KO_SPEAKERS : KO_STRINGS;
const translated = kind === 'speakers' ? JA_SPEAKERS : JA_STRINGS;
const missing = Object.entries(source).filter(([key]) => translated[key] === undefined);

console.log(JSON.stringify({
  kind,
  totalMissing: missing.length,
  offset,
  entries: missing.slice(offset, offset + limit),
}, null, 2));
