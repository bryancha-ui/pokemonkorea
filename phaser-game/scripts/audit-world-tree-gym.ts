import { readFileSync } from 'node:fs';
import {
  reconcileWorldTreeProgress,
  WORLD_TREE_NODES,
  WORLD_TREE_REQUIRED_BRANCHES,
  worldTreeComplete,
  worldTreeNode,
  worldTreeVisited,
  worldTreeVisitedCount,
  worldTreeVisitedFlag,
} from '../src/systems/WorldTreeGymPuzzle';

const failures: string[] = [];
const expect = (condition: unknown, message: string) => { if (!condition) failures.push(message); };

expect(WORLD_TREE_NODES.length === 11, 'World Tree must include root, nine branches and summit');
expect(WORLD_TREE_REQUIRED_BRANCHES.length === 9, 'exactly nine branches must be visited');
expect(new Set(WORLD_TREE_NODES.map(node => node.id)).size === WORLD_TREE_NODES.length, 'World Tree node ids are not unique');
expect(WORLD_TREE_NODES[0]?.id === 'root' && WORLD_TREE_NODES.at(-1)?.id === 'summit', 'root/summit anchors changed');
expect(new Set(WORLD_TREE_REQUIRED_BRANCHES.map(node => node.trainerKey).filter(Boolean)).size === 2, 'two different branches must hold the Gym Trainers');
expect(WORLD_TREE_NODES.every(node => node.connections.length >= 2), 'a branch is a dead end and can strand the player');

for (const node of WORLD_TREE_NODES) {
  for (const targetId of node.connections) {
    const target = worldTreeNode(targetId);
    expect(!!target, `${node.id} connects to missing node ${targetId}`);
    expect(!!target?.connections.includes(node.id), `${node.id} → ${targetId} is not reversible`);
  }
}

// Traverse the authored graph from the root to prove every branch is reachable.
const reached = new Set<string>();
const queue = ['root'];
while (queue.length) {
  const id = queue.shift()!;
  if (reached.has(id)) continue;
  reached.add(id);
  for (const next of worldTreeNode(id)?.connections ?? []) queue.push(next);
}
expect(reached.size === WORLD_TREE_NODES.length, 'World Tree graph is disconnected');
expect(WORLD_TREE_REQUIRED_BRANCHES.every(node => node.elevation > WORLD_TREE_NODES[0]!.elevation), 'a required branch is below the root');
expect(WORLD_TREE_NODES.at(-1)!.elevation > Math.max(...WORLD_TREE_REQUIRED_BRANCHES.map(node => node.elevation)), 'summit is not the highest platform');

const state = new Map<string, unknown>();
const read = (key: string) => state.get(key);
const write = (key: string, value: unknown) => state.set(key, value);
expect(worldTreeVisitedCount(read) === 0, 'fresh save starts with visited branches');
expect(!worldTreeComplete(read), 'fresh save opens the summit');
for (const node of WORLD_TREE_REQUIRED_BRANCHES) state.set(worldTreeVisitedFlag(node), true);
expect(worldTreeVisitedCount(read) === WORLD_TREE_REQUIRED_BRANCHES.length, 'all visit flags do not complete the branch counter');
expect(worldTreeComplete(read), 'all nine branches do not open the summit');

state.clear();
state.set('trainerDefeated_forest-minho', true);
reconcileWorldTreeProgress(read, write);
const minhoBranch = WORLD_TREE_REQUIRED_BRANCHES.find(node => node.trainerKey === 'forest-minho')!;
expect(worldTreeVisited(minhoBranch, read), 'legacy Minho victory does not recover his branch visit');
state.clear();
state.set('forestGymDefeated', true);
reconcileWorldTreeProgress(read, write);
expect(worldTreeComplete(read), 'legacy badge save leaves the World Tree sealed');

const scene = readFileSync('src/scenes/ForestGymScene.ts', 'utf8');
const mirror = readFileSync('src/engine3d/OverworldMirror.ts', 'utf8');
const model = readFileSync('src/engine3d/WorldTreeGym3D.ts', 'utf8');
expect(scene.includes('MOBILE_ACTION_EVENT'), 'mobile A-button cannot jump between branches');
expect(scene.includes('characterElevation3D'), 'jump arc does not raise the player in 3D');
expect(scene.includes('worldTreeComplete(key => this.registry.get(key))'), 'summit gate is not branch-authoritative');
expect(scene.includes("SaveManager.autoSave(this.registry, this.px, this.py, 'ForestGymScene')"), 'branch checkpoints are not auto-saved');
expect(!scene.includes("this.registry.set('forestCityReturnX', this.px)"), 'Gym coordinates overwrite the safe city return point');
expect(mirror.includes('buildWorldTreeGymProp3D'), '3D mirror cannot adopt World Tree props');
expect(mirror.includes("kind: 'world-tree-prop'"), '3D mirror cannot track elevated branches');
expect(model.includes('world-tree-massive-trunk'), 'World Tree lacks its volumetric trunk');
expect(model.includes('world-tree-jump-limb'), 'jump branches are not volumetric');
expect(model.includes('world-tree-summit-platform'), 'leader summit platform is missing');

console.log(JSON.stringify({
  nodesChecked: WORLD_TREE_NODES.length,
  requiredBranchesChecked: WORLD_TREE_REQUIRED_BRANCHES.length,
  trainersChecked: WORLD_TREE_REQUIRED_BRANCHES.filter(node => !!node.trainerKey).length,
  failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
