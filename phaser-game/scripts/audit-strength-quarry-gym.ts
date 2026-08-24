import { readFileSync } from 'node:fs';
import {
  reconcileStrengthQuarryProgress,
  resolveStrengthPush,
  STRENGTH_BOULDERS,
  strengthBoulderColKey,
  strengthBoulderFilledFlag,
  strengthBoulderRowKey,
  strengthQuarrySolved,
} from '../src/systems/StrengthQuarryPuzzle';

const failures: string[] = [];
const expect = (condition: unknown, message: string) => { if (!condition) failures.push(message); };
const state = new Map<string, unknown>();
const read = (key: string) => state.get(key);
const write = (key: string, value: unknown) => state.set(key, value);

expect(STRENGTH_BOULDERS.length === 3, 'Strength Quarry must contain exactly three rune boulders');
expect(new Set(STRENGTH_BOULDERS.map(boulder => boulder.id)).size === 3, 'boulder ids are not unique');
expect(new Set(STRENGTH_BOULDERS.map(boulder => boulder.rune)).size === 3, 'rune shapes are not unique');
expect(new Set(STRENGTH_BOULDERS.map(boulder => `${boulder.targetCol},${boulder.targetRow}`)).size === 3, 'rune holes overlap');
expect(!strengthQuarrySolved(read), 'fresh quarry starts solved');

const routes: Record<string, readonly [number, number][]> = {
  granite: [[1, 0], [0, -1], [0, -1], [0, -1], [0, -1], [0, -1], [0, -1]],
  basalt: [[0, -1], [0, -1], [0, -1], [0, -1], [0, -1], [0, -1], [0, -1]],
  limestone: [[-1, 0], [-1, 0], [0, -1], [0, -1], [0, -1], [0, -1], [0, -1], [0, -1]],
};

for (const boulder of STRENGTH_BOULDERS) {
  for (const [deltaCol, deltaRow] of routes[boulder.id] ?? []) {
    const result = resolveStrengthPush(boulder, deltaCol, deltaRow, read);
    expect(result.kind !== 'blocked', `${boulder.id} authored solution is blocked (${result.reason ?? 'unknown'})`);
    if (result.kind === 'blocked') break;
    write(strengthBoulderColKey(boulder), result.col);
    write(strengthBoulderRowKey(boulder), result.row);
    if (result.kind === 'fill') write(strengthBoulderFilledFlag(boulder), true);
  }
  expect(!!read(strengthBoulderFilledFlag(boulder)), `${boulder.id} route does not end in its rune hole`);
}
expect(strengthQuarrySolved(read), 'three correct placements do not open the bridge');

state.clear();
const granite = STRENGTH_BOULDERS.find(boulder => boulder.id === 'granite')!;
write(strengthBoulderColKey(granite), 8);
write(strengthBoulderRowKey(granite), 9);
const wrongRune = resolveStrengthPush(granite, 0, -1, read);
expect(wrongRune.kind === 'blocked' && wrongRune.reason === 'wrong-rune', 'wrong rune can enter a mismatched hole');

state.clear();
write('dolmoeGymDefeated', true);
reconcileStrengthQuarryProgress(read, write);
expect(strengthQuarrySolved(read), 'legacy badge save leaves the fissure sealed');

const scene = readFileSync('src/scenes/DolmoeGymScene.ts', 'utf8');
const mirror = readFileSync('src/engine3d/OverworldMirror.ts', 'utf8');
const model = readFileSync('src/engine3d/StrengthQuarry3D.ts', 'utf8');
expect(scene.includes('MOBILE_ACTION_EVENT'), 'mobile A-button cannot operate the reset pedestal');
expect(scene.includes('resolveStrengthPush'), 'Gym movement bypasses the authoritative push rules');
expect(scene.includes("SaveManager.autoSave(this.registry, this.px, this.py, 'DolmoeGymScene')"), 'boulder checkpoints are not auto-saved');
expect(scene.includes('sanitizeRestoredPlayerCell'), 'mid-puzzle resume can strand the player in a boulder or fissure');
expect(!scene.includes("this.registry.set('dolmoeReturnX', this.px)"), 'Gym coordinates overwrite the safe city return point');
expect(mirror.includes('buildStrengthQuarryProp3D'), '3D mirror cannot adopt Strength Quarry props');
expect(mirror.includes("kind: 'strength-quarry-prop'"), '3D mirror cannot track Strength Quarry props');
expect(model.includes('strength-irregular-boulder'), 'rune boulders are not volumetric');
expect(model.includes('strength-bottomless-fissure'), 'the fissure is not volumetric');
expect(model.includes('strength-completed-boulder-bridge'), 'completed boulders do not form a 3D bridge');

console.log(JSON.stringify({
  bouldersChecked: STRENGTH_BOULDERS.length,
  solutionPushesChecked: Object.values(routes).reduce((sum, route) => sum + route.length, 0),
  failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
