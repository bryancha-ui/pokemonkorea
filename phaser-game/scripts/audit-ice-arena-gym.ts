import { readFileSync } from 'node:fs';
import {
  FIGURE_SKATING_SEQUENCE,
  ICE_SPORT_TRIALS,
  advanceShortTrackBalance,
  iceArenaComplete,
  iceSportClearedFlag,
  iceSportUnlocked,
  nextSpeedStride,
  reconcileIceArenaProgress,
  shortTrackRequiredLean,
} from '../src/systems/IceArenaGymPuzzle';

const failures: string[] = [];
const expect = (condition: unknown, message: string) => { if (!condition) failures.push(message); };
const state = new Map<string, unknown>();
const read = (key: string) => state.get(key);
const write = (key: string, value: unknown) => state.set(key, value);

expect(ICE_SPORT_TRIALS.length === 3, 'Seorae Gym must contain exactly three ice sports');
expect(ICE_SPORT_TRIALS.map(trial => trial.id).join(',') === 'short-track,speed-skating,figure-skating', 'ice sports are not in authored order');
expect(new Set(ICE_SPORT_TRIALS.map(trial => trial.id)).size === 3, 'ice sport ids are not unique');
expect(iceSportUnlocked(ICE_SPORT_TRIALS[0], read), 'short track is locked on a fresh save');
expect(!iceSportUnlocked(ICE_SPORT_TRIALS[1], read), 'speed skating opens before Nunsong is defeated');
state.set('trainerDefeated_seorae-nunsong', true);
expect(iceSportUnlocked(ICE_SPORT_TRIALS[1], read), 'Nunsong victory does not open speed skating');
expect(!iceSportUnlocked(ICE_SPORT_TRIALS[2], read), 'figure skating opens before Baram is defeated');
state.set('trainerDefeated_seorae-baram', true);
expect(iceSportUnlocked(ICE_SPORT_TRIALS[2], read), 'Baram victory does not open figure skating');

expect(shortTrackRequiredLean(0) === -1, 'right short-track bend does not request an inward left lean');
expect(shortTrackRequiredLean(Math.PI) === 1, 'left short-track bend does not request an inward right lean');
expect(shortTrackRequiredLean(Math.PI / 2) === 0, 'short-track straight incorrectly requests a lean');
let safeBalance = 0.72;
let idleBalance = 0.72;
let idleFailed = false;
const angularSpeed = 1.43;
for (let frame = 0; frame < Math.ceil((Math.PI * 4 / angularSpeed) * 60); frame++) {
  const elapsed = frame / 60;
  const angle = Math.PI / 2 - elapsed * angularSpeed;
  safeBalance = advanceShortTrackBalance(safeBalance, angle, shortTrackRequiredLean(angle), 1 / 60);
  idleBalance = advanceShortTrackBalance(idleBalance, angle, 0, 1 / 60);
  if (idleBalance === 0) idleFailed = true;
}
expect(safeBalance > 0.7, 'correct inward leaning cannot finish two short-track laps');
expect(idleFailed, 'short track can be cleared without steering through bends');

let expected: 'left' | 'right' = 'left';
for (let index = 0; index < 12; index++) {
  const pressed = index % 2 === 0 ? 'left' : 'right';
  const stride = nextSpeedStride(expected, pressed);
  expect(stride.correct, `alternating speed stride ${index + 1} was rejected`);
  expected = stride.next;
}
expect(!nextSpeedStride('left', 'right').correct, 'wrong speed-skating stride is accepted');
expect(FIGURE_SKATING_SEQUENCE.length === 6, 'figure-skating routine must contain six elements');
expect(FIGURE_SKATING_SEQUENCE.filter(move => move === 'spin').length === 2, 'figure routine lacks its two signature spins');
expect(['left', 'right', 'up', 'down'].every(move => FIGURE_SKATING_SEQUENCE.includes(move as never)), 'figure routine does not use every directional edge');

state.clear();
state.set('trainerDefeated_seorae-nunsong', true);
state.set('trainerDefeated_seorae-baram', true);
reconcileIceArenaProgress(read, write);
expect(!!read(iceSportClearedFlag(ICE_SPORT_TRIALS[0])), 'legacy Nunsong victory does not recover short-track progress');
expect(!!read(iceSportClearedFlag(ICE_SPORT_TRIALS[1])), 'legacy Baram victory does not recover speed-skating progress');
state.clear();
state.set('seoraeGymDefeated', true);
reconcileIceArenaProgress(read, write);
expect(iceArenaComplete(read), 'legacy Frostbell Badge save leaves an event gate sealed');

const scene = readFileSync('src/scenes/SeoraeGymScene.ts', 'utf8');
const mirror = readFileSync('src/engine3d/OverworldMirror.ts', 'utf8');
const model = readFileSync('src/engine3d/IceArenaGym3D.ts', 'utf8');
expect(scene.includes('MOBILE_ACTION_EVENT'), 'mobile A-button cannot start events or perform figure spins');
expect(scene.includes('advanceShortTrackBalance'), 'short-track scene bypasses the authoritative balance rules');
expect(scene.includes('nextSpeedStride'), 'speed-skating scene bypasses the alternating stride rules');
expect(scene.includes('FIGURE_SKATING_SEQUENCE'), 'figure-skating scene does not use the authored routine');
expect(scene.includes("SaveManager.autoSave(this.registry, this.px, this.py, 'SeoraeGymScene')"), 'event checkpoints are not auto-saved');
expect(scene.includes('sanitizeRestoredPosition'), 'mid-event saves can strand the player inside a closed gate');
expect(!scene.includes("this.registry.set('seoraeReturnX', this.px)"), 'Gym coordinates overwrite the safe town return point');
expect(mirror.includes('buildIceArenaProp3D'), '3D mirror cannot adopt ice arena props');
expect(mirror.includes("kind: 'ice-arena-prop'"), '3D mirror cannot track ice arena props');
expect(model.includes('seorae-short-track-rink'), 'short-track rink is not volumetric');
expect(model.includes('seorae-speed-skating-straight'), 'speed-skating lane is not volumetric');
expect(model.includes('seorae-figure-skating-rink'), 'figure-skating rink is not volumetric');
expect(model.includes('seorae-live-skate-trails'), 'skating motion lacks 3D blade trails');

console.log(JSON.stringify({
  sportsChecked: ICE_SPORT_TRIALS.map(trial => trial.id),
  figureElementsChecked: FIGURE_SKATING_SEQUENCE.length,
  failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
