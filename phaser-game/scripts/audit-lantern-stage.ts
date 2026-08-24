import { readFileSync } from 'node:fs';
import {
  LANTERN_DANCE_PADS,
  LANTERN_DANCE_SEQUENCE,
  LANTERN_STAGE_LANTERNS,
  allLanternTrainersDefeated,
  allLanternsAligned,
  lanternAligned,
  lanternDanceComplete,
  lanternLitFlag,
  lanternRotationFlag,
  normalizeLanternRotation,
} from '../src/systems/LanternStagePuzzle';

const failures: string[] = [];
const expect = (condition: unknown, message: string) => { if (!condition) failures.push(message); };

expect(LANTERN_STAGE_LANTERNS.length === 3, 'Lantern Stage must have blossom, moon and starlight lanterns');
expect(new Set(LANTERN_STAGE_LANTERNS.map(lantern => lantern.id)).size === 3, 'lantern ids are not unique');
expect(new Set(LANTERN_STAGE_LANTERNS.map(lantern => lantern.trainerKey)).size === 3, 'each lantern needs its own Trainer');
expect(LANTERN_STAGE_LANTERNS.every(lantern => lantern.initialRotation !== lantern.targetRotation), 'a lantern begins already solved');
expect(LANTERN_DANCE_PADS.length === 3, 'dance stage must contain moon, blossom and star pads');
expect(LANTERN_DANCE_SEQUENCE.length === 4, 'Namsun dance must remain a short four-step performance');
expect(LANTERN_DANCE_SEQUENCE[0] === 'moon-step' && LANTERN_DANCE_SEQUENCE.at(-1) === 'blossom-step', 'dance order changed unexpectedly');
expect(normalizeLanternRotation(-1) === 3 && normalizeLanternRotation(5) === 1, 'rotation normalization is broken');

// Every authored target direction must point from its lantern toward the central lotus.
const lotus = { col: 8.5, row: 7 };
const direction = (rotation: number): [number, number] => [[0, -1], [1, 0], [0, 1], [-1, 0]][rotation] as [number, number];
for (const lantern of LANTERN_STAGE_LANTERNS) {
  const [dx, dy] = direction(lantern.targetRotation);
  const toLotusX = Math.sign(lotus.col - lantern.col);
  const toLotusY = Math.sign(lotus.row - lantern.row);
  expect(dx === toLotusX && dy === toLotusY, `${lantern.id} target beam misses the central lotus`);
}

const state = new Map<string, unknown>();
const read = (key: string) => state.get(key);
expect(!allLanternTrainersDefeated(read), 'fresh save incorrectly defeats all performers');
expect(!allLanternsAligned(read), 'fresh save incorrectly solves the light puzzle');
expect(!lanternDanceComplete(read), 'fresh save incorrectly opens Namsun’s curtain');

for (const lantern of LANTERN_STAGE_LANTERNS) {
  state.set(`trainerDefeated_${lantern.trainerKey}`, true);
  state.set(lanternLitFlag(lantern), true);
  state.set(lanternRotationFlag(lantern), lantern.targetRotation);
  expect(lanternAligned(lantern, read), `${lantern.id} does not align at its target rotation`);
}
expect(allLanternTrainersDefeated(read), 'three victories do not unlock all lanterns');
expect(allLanternsAligned(read), 'three target rotations do not converge');
expect(!lanternDanceComplete(read), 'light convergence skips the dance trial');
state.set('geumgangLanternDanceComplete', true);
expect(lanternDanceComplete(read), 'completed dance does not open the curtain');

state.clear();
state.set('geumgangGymDefeated', true);
expect(allLanternTrainersDefeated(read), 'legacy badge save leaves a performer active');
expect(allLanternsAligned(read), 'legacy badge save leaves its lanterns unsolved');
expect(lanternDanceComplete(read), 'legacy badge save leaves the curtain closed');

const scene = readFileSync('src/scenes/GeumgangGymScene.ts', 'utf8');
const mirror = readFileSync('src/engine3d/OverworldMirror.ts', 'utf8');
const model = readFileSync('src/engine3d/LanternStage3D.ts', 'utf8');
expect(scene.includes("key: 'geum-areum'"), 'third lantern performer is missing');
expect(scene.includes('MOBILE_ACTION_EVENT'), 'mobile A-button cannot rotate lanterns');
expect(scene.includes('lanternDanceComplete(key => this.registry.get(key))'), 'leader gate is not dance-authoritative');
expect(scene.includes("SaveManager.autoSave(this.registry, this.px, this.py, 'GeumgangGymScene')"), 'puzzle state is not auto-saved');
expect(!scene.includes("this.registry.set('geumgangCityReturnX', this.px)"), 'Gym coordinates still overwrite the city return point');
expect(mirror.includes('buildLanternStageProp3D'), '3D mirror cannot adopt Lantern Stage props');
expect(model.includes('lantern-stage-light-beam'), '3D lantern lacks a projected beam');
expect(model.includes('lantern-stage-light-curtain'), '3D finale curtain is missing');

console.log(JSON.stringify({
  lanternsChecked: LANTERN_STAGE_LANTERNS.length,
  danceStepsChecked: LANTERN_DANCE_SEQUENCE.length,
  failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
