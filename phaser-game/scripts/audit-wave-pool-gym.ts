import { readFileSync } from 'node:fs';
import { customForm } from '../src/data/CustomBattle';
import {
  reconcileWaveGymProgress,
  WAVE_POOL_COURSES,
  waveCourseCleared,
  waveCourseClearedFlag,
  waveCourseUnlocked,
  waveGymComplete,
} from '../src/systems/WavePoolGymPuzzle';

const failures: string[] = [];
const expect = (condition: unknown, message: string) => { if (!condition) failures.push(message); };

expect(WAVE_POOL_COURSES.length === 3, 'Harang Gym must have exactly three wave pools');
expect(new Set(WAVE_POOL_COURSES.map(course => course.id)).size === 3, 'wave course ids are not unique');
expect(WAVE_POOL_COURSES.every(course => course.startRow > course.endRow), 'a wave course does not travel north');
expect(WAVE_POOL_COURSES.every((course, index) => !index || course.maxRow < WAVE_POOL_COURSES[index - 1]!.minRow), 'wave pools overlap instead of leaving checkpoint platforms');
expect(WAVE_POOL_COURSES.every((course, index) => !index || course.waveForce > WAVE_POOL_COURSES[index - 1]!.waveForce), 'wave force does not increase at each checkpoint');
expect(WAVE_POOL_COURSES.every((course, index) => !index || course.durationMs > WAVE_POOL_COURSES[index - 1]!.durationMs), 'later wave pools are not longer');
expect(WAVE_POOL_COURSES.every(course => !!customForm(course.encounter.custom)), 'a fall encounter references an unknown custom Water Pokémon');
expect(WAVE_POOL_COURSES.every(course => customForm(course.encounter.custom)?.data.type1 === 'water'
  || customForm(course.encounter.custom)?.data.type2 === 'water'), 'a fall encounter is not Water-type');
expect(WAVE_POOL_COURSES[0]!.destinationTrainerKey === WAVE_POOL_COURSES[1]!.unlockTrainerKey, 'Haedo does not unlock the second wave');
expect(WAVE_POOL_COURSES[1]!.destinationTrainerKey === WAVE_POOL_COURSES[2]!.unlockTrainerKey, 'Byungchan does not unlock the final wave');

const state = new Map<string, unknown>();
const read = (key: string) => state.get(key);
const write = (key: string, value: unknown) => state.set(key, value);
expect(waveCourseUnlocked(WAVE_POOL_COURSES[0]!, read), 'fresh save cannot enter the first wave');
expect(!waveCourseUnlocked(WAVE_POOL_COURSES[1]!, read), 'fresh save skips Haedo');
expect(!waveGymComplete(read), 'fresh save incorrectly opens Harang’s platform');

for (const course of WAVE_POOL_COURSES) {
  if (course.unlockTrainerKey) state.set(`trainerDefeated_${course.unlockTrainerKey}`, true);
  expect(waveCourseUnlocked(course, read), `${course.id} remains locked after its checkpoint victory`);
  state.set(waveCourseClearedFlag(course), true);
  expect(waveCourseCleared(course, read), `${course.id} clear flag is ignored`);
}
expect(waveGymComplete(read), 'three successful rides do not unlock Leader Harang');

state.clear();
state.set('trainerDefeated_haean-byungchan', true);
reconcileWaveGymProgress(read, write);
expect(waveCourseCleared(WAVE_POOL_COURSES[0]!, read) && waveCourseCleared(WAVE_POOL_COURSES[1]!, read), 'legacy Byungchan save is stranded south of its checkpoint');
state.clear();
state.set('haeanGymDefeated', true);
reconcileWaveGymProgress(read, write);
expect(waveGymComplete(read), 'legacy badge save leaves a wave pool uncleared');

const scene = readFileSync('src/scenes/HaeanGymScene.ts', 'utf8');
const mirror = readFileSync('src/engine3d/OverworldMirror.ts', 'utf8');
const model = readFileSync('src/engine3d/WavePoolGym3D.ts', 'utf8');
expect(scene.includes('MOBILE_ACTION_EVENT'), 'mobile A-button cannot start or advance the wave challenge');
expect(scene.includes("this.registry.set('wildReturnScene', 'HaeanGymScene')"), 'fall battle cannot return to the Gym checkpoint');
expect(scene.includes("this.registry.set('wildCustom', true)"), 'fall does not create its authored Water encounter');
expect(scene.includes("setData('characterSurfboard3D', true)"), 'player does not adopt the 3D surfing pose');
expect(scene.includes("SaveManager.autoSave(this.registry, this.px, this.py, 'HaeanGymScene')"), 'wave checkpoints are not auto-saved');
expect(!scene.includes("this.registry.set('haeanCityReturnX', this.px)"), 'Gym coordinates overwrite the safe city return point');
expect(mirror.includes('buildWaveGymProp3D'), '3D mirror cannot adopt wave-pool props');
expect(mirror.includes("kind: 'wave-gym-prop'"), '3D mirror cannot track the surfboard and wave pools');
expect(model.includes('wave-pool-foam-crest'), '3D wave pool has no animated foam crests');
expect(model.includes('gym-surfboard-deck'), 'rental surfboard lacks a true 3D deck');

console.log(JSON.stringify({
  coursesChecked: WAVE_POOL_COURSES.length,
  encountersChecked: WAVE_POOL_COURSES.map(course => course.encounter.custom),
  failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
