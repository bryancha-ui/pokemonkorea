import { promises as fs } from 'node:fs';
import path from 'node:path';
import { SAFE_RESUME_SCENES } from '../src/data/ResumeScenes';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const failures: string[] = [];

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : Promise.resolve(full.endsWith('.ts') ? [full] : []);
  }));
  return nested.flat();
}

const lazyPath = path.join(srcRoot, 'systems', 'LazyScenes.ts');
const lazySource = await fs.readFile(lazyPath, 'utf8');
const storyBlock = lazySource.match(/export const STORY_SCENE_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/);
if (!storyBlock) throw new Error('Could not parse STORY_SCENE_KEYS');
const storyKeys = [...storyBlock[1].matchAll(/['"]([A-Za-z0-9]+Scene)['"]/g)].map(match => match[1]);
const registered = new Set(['TitleScene', ...storyKeys]);

const overrideBlock = lazySource.match(/const MODULE_OVERRIDES[^=]*=\s*\{([\s\S]*?)\n\};/);
if (!overrideBlock) throw new Error('Could not parse MODULE_OVERRIDES');
const overrides = new Map(
  [...overrideBlock[1].matchAll(/([A-Za-z0-9]+Scene):\s*['"]\.\.\/scenes\/([^'"]+)['"]/g)]
    .map(match => [match[1], match[2]] as const),
);

for (const key of storyKeys) {
  const relative = overrides.get(key) ?? `${key}.ts`;
  const scenePath = path.join(srcRoot, 'scenes', relative);
  try {
    const source = await fs.readFile(scenePath, 'utf8');
    if (!new RegExp(`export\\s+class\\s+${key}\\b`).test(source)) {
      failures.push(`registered scene export is missing: ${key} -> ${relative}`);
    }
  } catch {
    failures.push(`registered scene module is missing: ${key} -> ${relative}`);
  }
}

const sourceFiles = await walk(srcRoot);
const literalTransitions = new Set<string>();
const literalSaveDestinations = new Set<string>();
const staticAssets = new Map<string, string>();
const incompleteStoryLines: string[] = [];

for (const file of sourceFiles) {
  const source = await fs.readFile(file, 'utf8');
  for (const match of source.matchAll(/\.scene\.(?:start|launch|run|switch)\(\s*['"]([A-Za-z0-9]+Scene)['"]/g)) {
    literalTransitions.add(match[1]);
  }
  for (const line of source.split('\n')) {
    const save = line.match(/SaveManager\.save\([^\n]*['"]([A-Za-z0-9]+Scene)['"]/);
    if (save) literalSaveDestinations.add(save[1]);
  }
  for (const match of source.matchAll(/(['"`])(assets\/[^'"`\s?#$]+)\1/g)) {
    // Documentation may spell out a dynamic convention such as
    // assets/models3d/<id>.glb; only concrete runtime URLs belong here.
    if (!/[<>]/.test(match[2]) && !match[2].endsWith('/')) {
      staticAssets.set(match[2], path.relative(root, file));
    }
  }
  if (file.includes(`${path.sep}scenes${path.sep}`)) {
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const [index, line] of withoutComments.split('\n').entries()) {
      if (/To be continued|Coming soon|준비 중|미구현|未実装/i.test(line)) {
        incompleteStoryLines.push(`${path.relative(root, file)}:${index + 1}`);
      }
    }
  }
}

for (const target of literalTransitions) {
  if (!registered.has(target)) failures.push(`literal scene transition is not registered: ${target}`);
}

const safeResume = new Set<string>(SAFE_RESUME_SCENES);
for (const destination of literalSaveDestinations) {
  if (!safeResume.has(destination)) failures.push(`saved scene cannot be resumed: ${destination}`);
}
for (const dynamicDestination of [
  'FerryCorridorScene', 'FerryRoomAScene', 'FerryRoomBScene', 'FerryRoomCScene',
  'NampoCityScene', 'WonsanCityScene', 'HamhungCityScene', 'ChongjinCityScene',
  'SinuijuCityScene', 'SamjiyonCityScene',
]) {
  if (!safeResume.has(dynamicDestination)) failures.push(`dynamic saved scene cannot be resumed: ${dynamicDestination}`);
}
for (const safe of safeResume) {
  if (!registered.has(safe)) failures.push(`safe resume scene is not registered: ${safe}`);
}

for (const [asset, source] of staticAssets) {
  try { await fs.access(path.join(root, 'public', decodeURIComponent(asset))); }
  catch { failures.push(`missing static asset: ${asset} (${source})`); }
}
for (const line of incompleteStoryLines) failures.push(`unfinished player-facing story marker: ${line}`);

console.log(JSON.stringify({
  registeredScenes: storyKeys.length,
  literalTransitions: literalTransitions.size,
  saveDestinations: literalSaveDestinations.size,
  safeResumeScenes: safeResume.size,
  staticAssets: staticAssets.size,
  incompleteStoryLines,
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
