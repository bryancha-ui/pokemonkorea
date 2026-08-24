import { readFileSync } from 'node:fs';
import {
  SUMMIT_COUNTERWEIGHTS,
  summitPassageComplete,
  summitWeightAlignmentFlag,
  summitWeightTrainerDefeated,
  summitWeightVisuallyAligned,
} from '../src/systems/SummitDojoPuzzle';

const failures: string[] = [];
const expect = (condition: unknown, message: string) => { if (!condition) failures.push(message); };
const movable = SUMMIT_COUNTERWEIGHTS.filter(weight => !!weight.trainerKey);
const summit = SUMMIT_COUNTERWEIGHTS.find(weight => !weight.trainerKey);

expect(SUMMIT_COUNTERWEIGHTS.length === 3, 'dojo must contain two movable weights and one summit marker');
expect(movable.length === 2, 'exactly two weights must be Trainer-controlled');
expect(!!summit, 'fixed summit marker is missing');
expect(new Set(movable.map(weight => weight.trainerKey)).size === 2, 'the movable weights share a Trainer');
expect(movable.every(weight => weight.startCol !== weight.targetCol), 'a movable weight starts already aligned');
expect(SUMMIT_COUNTERWEIGHTS.every(weight => weight.targetCol === summit?.targetCol), 'weights do not share one summit line');
expect(movable[0]!.row > movable[1]!.row && movable[1]!.row > summit!.row, 'weights are not ordered from entrance to summit');

const state = new Map<string, unknown>();
const read = (key: string) => state.get(key);
expect(!summitPassageComplete(read), 'fresh save incorrectly opens the leader passage');
state.set(`trainerDefeated_${movable[0]!.trainerKey}`, true);
expect(summitWeightTrainerDefeated(movable[0]!, read), 'first Trainer victory does not unlock its weight');
expect(!summitPassageComplete(read), 'one Trainer victory incorrectly opens both floors');
state.set(`trainerDefeated_${movable[1]!.trainerKey}`, true);
expect(summitPassageComplete(read), 'two Trainer victories do not open the leader passage');
expect(!summitWeightVisuallyAligned(movable[0]!, read), 'victory skips the authored alignment animation');
state.set(summitWeightAlignmentFlag(movable[0]!), true);
expect(summitWeightVisuallyAligned(movable[0]!, read), 'alignment animation flag is ignored');

state.clear();
state.set('baekduGymDefeated', true);
expect(summitPassageComplete(read), 'legacy badge save does not recover an open passage');
expect(SUMMIT_COUNTERWEIGHTS.every(weight => summitWeightVisuallyAligned(weight, read)), 'legacy badge save leaves a weight offset');

const sceneSource = readFileSync('src/scenes/BaekduGymScene.ts', 'utf8');
const mirrorSource = readFileSync('src/engine3d/OverworldMirror.ts', 'utf8');
const modelSource = readFileSync('src/engine3d/GymCounterweight3D.ts', 'utf8');
expect(sceneSource.includes("setData('gymCounterweight3D'"), 'scene does not tag weights for true 3D adoption');
expect(sceneSource.includes('summitWeightTrainerDefeated(weight, read)'), 'floor collision is not driven by Trainer victory');
expect(sceneSource.includes("ease: 'Cubic.InOut'"), 'counterweight alignment tween is missing');
expect(sceneSource.includes("SaveManager.autoSave(this.registry, this.px, this.py, 'BaekduGymScene')"), 'alignment state is not auto-saved');
expect(mirrorSource.includes('buildGymCounterweight3D'), '3D mirror cannot build the authored counterweight');
expect(mirrorSource.includes("kind: 'gym-counterweight'"), '3D mirror cannot track moving counterweights');
expect(modelSource.includes('weight-pulley') && modelSource.includes('weight-chain'), '3D weight lacks its pulley/chain mechanism');

console.log(JSON.stringify({
  weightsChecked: SUMMIT_COUNTERWEIGHTS.length,
  trainerLocksChecked: movable.length,
  failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
