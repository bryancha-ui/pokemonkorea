import { readFileSync } from 'node:fs';
import {
  STORM_INSULATED_PADS,
  STORM_RODS,
  activeStormRod,
  isStandingOnInsulatedPad,
  normalizeStormDirection,
  reconcileStormCliffProgress,
  resolveStormStrike,
  stormChargedFlag,
  stormCliffComplete,
  stormDirectionKey,
  stormHeightKey,
  stormRodConfigured,
  stormRodUnlocked,
} from '../src/systems/StormCliffGymPuzzle';

const failures: string[] = [];
const expect = (condition: unknown, message: string) => { if (!condition) failures.push(message); };
const state = new Map<string, unknown>();
const read = (key: string) => state.get(key);
const write = (key: string, value: unknown) => state.set(key, value);

expect(STORM_RODS.length === 3, 'Stormwatcher Cliffs must contain exactly three lightning rods');
expect(STORM_INSULATED_PADS.length === 3, 'each lightning rod needs one insulated safety pad');
expect(new Set(STORM_RODS.map(rod => rod.id)).size === STORM_RODS.length, 'lightning rod ids are not unique');
expect(new Set(STORM_RODS.map(rod => `${rod.col},${rod.row}`)).size === STORM_RODS.length, 'lightning rods overlap');
expect(new Set(STORM_INSULATED_PADS.map(pad => pad.rodId)).size === STORM_RODS.length, 'a rod lacks a dedicated insulated pad');
expect(normalizeStormDirection(-1) === 3 && normalizeStormDirection(4) === 0, 'rod rotation does not wrap cardinal directions');
expect(activeStormRod(read)?.id === 'dawn', 'fresh save does not activate Dawn Rod');
expect(!stormRodUnlocked(STORM_RODS[1], read), 'Gale Rod opens before Seongwoo is defeated');
expect(!stormRodUnlocked(STORM_RODS[2], read), 'Zenith Rod opens before Daehwi is defeated');

for (const rod of STORM_RODS) {
  write(stormDirectionKey(rod), rod.targetDirection);
  write(stormHeightKey(rod), rod.targetHeight);
  expect(stormRodConfigured(rod, read), `${rod.id} rejects its authored receiver direction/height`);
  expect(resolveStormStrike(rod, false, read) === 'shocked', `${rod.id} can be charged while exposed off the insulated pad`);
  expect(resolveStormStrike(rod, true, read) === 'charged', `${rod.id} does not charge from a safe aligned strike`);
  const pad = STORM_INSULATED_PADS.find(entry => entry.rodId === rod.id)!;
  expect(isStandingOnInsulatedPad(rod, pad.col, pad.row), `${rod.id} pad centre is not insulated`);
  expect(!isStandingOnInsulatedPad(rod, pad.col + 2, pad.row), `${rod.id} insulation radius covers exposed deck`);
  write(stormChargedFlag(rod), true);
  if (rod.id === 'dawn') write('trainerDefeated_sunrise-seongwoo', true);
  if (rod.id === 'gale') write('trainerDefeated_sunrise-daehwi', true);
}
expect(stormCliffComplete(read), 'three safe aligned strikes do not power the elevator');

state.clear();
state.set(stormDirectionKey(STORM_RODS[0]), STORM_RODS[0].targetDirection);
state.set(stormHeightKey(STORM_RODS[0]), STORM_RODS[0].targetHeight === 1 ? 0 : 1);
expect(resolveStormStrike(STORM_RODS[0], true, read) === 'misaligned', 'wrong mast height is accepted by the receiver');
state.clear();
state.set('trainerDefeated_sunrise-seongwoo', true);
reconcileStormCliffProgress(read, write);
expect(!!read(stormChargedFlag(STORM_RODS[0])), 'legacy Seongwoo victory does not recover Dawn Rod');
state.set('trainerDefeated_sunrise-daehwi', true);
reconcileStormCliffProgress(read, write);
expect(!!read(stormChargedFlag(STORM_RODS[1])), 'legacy Daehwi victory does not recover Gale Rod');
state.clear();
state.set('sunriseGymDefeated', true);
reconcileStormCliffProgress(read, write);
expect(stormCliffComplete(read), 'legacy Stormwatcher Badge save leaves rods discharged');
expect(!!read('sunriseStormElevatorRaised'), 'legacy badge save leaves the summit elevator lowered');

const scene = readFileSync('src/scenes/SunriseGymScene.ts', 'utf8');
const mirror = readFileSync('src/engine3d/OverworldMirror.ts', 'utf8');
const model = readFileSync('src/engine3d/StormCliffGym3D.ts', 'utf8');
expect(scene.includes('MOBILE_ACTION_EVENT'), 'mobile A-button cannot calibrate rods or activate the elevator');
expect(scene.includes('STORM_STRIKE_AT_MS'), 'lightning has no authored warning/strike timing');
expect(scene.includes('resolveStormStrike'), 'scene bypasses the authoritative strike safety rules');
expect(scene.includes('isStandingOnInsulatedPad'), 'scene does not enforce insulated-pad shelter');
expect(scene.includes("SaveManager.autoSave(this.registry, this.px, this.py, 'SunriseGymScene')"), 'rod/elevator checkpoints are not auto-saved');
expect(scene.includes('sanitizeRestoredPosition'), 'legacy or mid-puzzle saves can spawn across a sealed cliff gap');
expect(!scene.includes("this.registry.set('sunriseCityReturnX', this.px)"), 'Gym coordinates overwrite the safe city return point');
expect(mirror.includes('buildStormCliffProp3D'), '3D mirror cannot adopt Stormwatcher Cliff props');
expect(mirror.includes("kind: 'storm-cliff-prop'"), '3D mirror cannot track Stormwatcher Cliff props');
expect(model.includes('sunrise-adjustable-lightning-rod'), 'lightning rods are not volumetric');
expect(model.includes('sunrise-lightning-receiver-beacon'), 'receiver direction/height has no 3D clue');
expect(model.includes('sunrise-insulated-safety-pad'), 'insulated pads are not volumetric');
expect(model.includes('sunrise-volumetric-lightning-strike'), 'lightning strike lacks a 3D effect');
expect(model.includes('sunrise-lightning-powered-elevator'), 'summit elevator is not volumetric');

console.log(JSON.stringify({
  rodsChecked: STORM_RODS.map(rod => rod.id),
  insulatedPadsChecked: STORM_INSULATED_PADS.length,
  failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
