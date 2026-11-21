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
const mainSource = await fs.readFile(path.join(srcRoot, 'main.ts'), 'utf8');
const sceneConfig = mainSource.match(/scene:\s*\[([^\]]+)\]/);
if (!sceneConfig) throw new Error('Could not parse eager scene config');
const eagerKeys = [...sceneConfig[1].matchAll(/\b([A-Z][A-Za-z0-9]+Scene)\b/g)].map(match => match[1]);
const registered = new Set([...eagerKeys, ...storyKeys]);

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

// Story actors must exist before they speak, and recurring arrivals should
// visibly enter the frame instead of popping into existence at the dialogue
// target. The Geumgang contest must also remain a real multi-entrant ranking.
const geumgangCity = await fs.readFile(path.join(srcRoot, 'scenes', 'GeumgangCityScene.ts'), 'utf8');
const geumgangContest = await fs.readFile(path.join(srcRoot, 'scenes', 'GeumgangContestScene.ts'), 'utf8');
const hwangeumStory = await fs.readFile(path.join(srcRoot, 'systems', 'HwangeumStory.ts'), 'utf8');
const storyActor = await fs.readFile(path.join(srcRoot, 'systems', 'StoryActor.ts'), 'utf8');
const propModels = await fs.readFile(path.join(srcRoot, 'engine3d', 'PropModels.ts'), 'utf8');
const terrainBuilder = await fs.readFile(path.join(srcRoot, 'engine3d', 'TerrainBuilder.ts'), 'utf8');
const forestCity = await fs.readFile(path.join(srcRoot, 'scenes', 'ForestCityScene.ts'), 'utf8');
const routeScene = await fs.readFile(path.join(srcRoot, 'scenes', 'RouteScene.ts'), 'utf8');
if (!geumgangCity.includes('playFirstVisitRivalEntrance(cityIntro)')
  || !geumgangCity.includes('markRivalPortrait(rival, this.registry)')) {
  failures.push('Geumgang first-arrival rival can still speak without a visible actor');
}
if (!hwangeumStory.includes('walkTo: (targetX, targetY, lookAt, onComplete')) {
  failures.push('recurring Champion actors have no shared walk-in presentation');
}
for (const scene of ['Route3Scene', 'Route5Scene', 'JejuVentScene', 'SunriseCityScene']) {
  const source = await fs.readFile(path.join(srcRoot, 'scenes', `${scene}.ts`), 'utf8');
  if (!source.includes('.walkTo(')) failures.push(`${scene} still pops Hwangeum directly onto the dialogue mark`);
}
const route3 = await fs.readFile(path.join(srcRoot, 'scenes', 'Route3Scene.ts'), 'utf8');
if (!route3.includes('runRyeoRivalFarewell(championRescuePending)')
  || !route3.includes("this.registry.set('ryeo1RivalFarewellDone', true)")
  || !route3.includes('targets: [rival.g, rival.label]')) {
  failures.push('Ryeo battle return still removes the Rival without dialogue and a visible walk-away');
}
if (!forestCity.includes("!this.registry.get('forestChapter7CallShown')")
  || !forestCity.includes("this.registry.set('forestChapter7CallShown', true)")) {
  failures.push('Forest City Professor Song call can still repeat on every entry');
}
if (!routeScene.includes("this.scene.start('CapitolCityScene')")) {
  failures.push('capital entry still passes through the empty black Seoul alias scene');
}
if (!propModels.includes("import { DRACOLoader }")
  || !propModels.includes("draco.setDecoderPath(new URL('assets/draco/'")
  || !propModels.includes('loader.setDRACOLoader(draco)')) {
  failures.push('compressed Higgsfield buildings still load without a Draco decoder');
}
if (!terrainBuilder.includes('makeDolmenFallback')
  || !terrainBuilder.includes("b.model === 'dolmen'")) {
  failures.push('dolmens can still appear as concrete building boxes while their model loads');
}
if (!storyActor.includes("kind: 'rival' | 'trainer'")
  || !storyActor.includes("setData('characterLabelTarget3D', this.graphic)")
  || !storyActor.includes('walkAway(')) {
  failures.push('shared story actors no longer synchronize walk-ins, labels and exits across 2D/3D');
}
const continuityChecks: Array<[string, string[], string]> = [
  ['FerryScene', ['bringRivalBeside(', 'dismissRival('], 'ferry Rival speaks without boarding the visible scene'],
  ['FerryDepartScene', ['spawnStoryActor(', 'this.rivalActor.walkTo('], 'departure Rival speaks over an empty ferry shot'],
  ['JejuPortScene', ['Your Rival follows you down the gangway', 'rival.walkTo('], 'Jeju arrival omits the Rival from the gangway'],
  ['BaekduPassScene', ['Rival runs up beside you', 'rival.walkTo('], 'Baekdu pass Rival still pops into the blockade scene'],
  ['BaekduCheckpointScene', ['drawDefeatedCaptain()', 'Garrison Loudspeaker', 'rival.walkTo('], 'checkpoint speakers are not spatially accounted for'],
  ['BaekduSummitScene', ['Director Suri stumbles down the path into view', 'suri.walkTo(', 'Prof. Song (comms): You have to SURVIVE', 'nabi.setData(\'creatureModel3DKey\', \'nabihalmang\')'], 'Baekdu summit still has disembodied or teleporting finale speakers'],
  ['SacredPeakScene', ['sacredPeakRivalArrived', 'rival.walkTo(', 'Jinnok (over comms)'], 'Sacred Peak speakers no longer match their on-screen arrival or location'],
  ['ScholarsRoadScene', ["!this.registry.get('leagueDoorsOpened')", 'this.rivalActor.walkTo('], 'final Rival disappears before the League send-off'],
  ['CapitolCityScene', ['playNewsRivalReaction()', 'Professor Song walks across the plaza to meet you'], 'capital story speakers still talk before entering the plaza'],
];
for (const [scene, needles, message] of continuityChecks) {
  const source = await fs.readFile(path.join(srcRoot, 'scenes', `${scene}.ts`), 'utf8');
  if (!needles.every(needle => source.includes(needle))) failures.push(message);
}
const hallOfFame = await fs.readFile(path.join(srcRoot, 'scenes', 'HallOfFameScene.ts'), 'utf8');
const sudoLab = await fs.readFile(path.join(srcRoot, 'scenes', 'SudoLabScene.ts'), 'utf8');
if (!hallOfFame.includes("this.registry.set('northReunionPending', true)")
  || !sudoLab.includes('the Northern League celebration belongs in the')) {
  failures.push('Northern League victory can still describe the Capitol street party inside the laboratory');
}
const entrantDefinitions = [...geumgangContest.matchAll(/key: '(?:jaemin|yuna|sora)'/g)].length;
if (entrantDefinitions !== 3 || !geumgangContest.includes('const CONTESTANT_COUNT = CONTEST_ENTRANTS.length + 2')) {
  failures.push('Geumgang Contest no longer has five functional entrants');
}
if (!geumgangContest.includes("this.registry.set('geumgangContestStandings'")
  || !geumgangContest.includes('entrant.roundScores[this.round]')) {
  failures.push('Geumgang Contest entrants are decorative and do not receive ranked round scores');
}

console.log(JSON.stringify({
  registeredScenes: registered.size,
  literalTransitions: literalTransitions.size,
  saveDestinations: literalSaveDestinations.size,
  safeResumeScenes: safeResume.size,
  staticAssets: staticAssets.size,
  incompleteStoryLines,
  storyEntrancesChecked: 15,
  contestEntrantsChecked: entrantDefinitions + 2,
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
