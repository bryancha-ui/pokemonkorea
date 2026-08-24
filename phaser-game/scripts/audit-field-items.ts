import { readFileSync } from 'node:fs';
import { FIELD_ITEM_PLACEMENTS } from '../src/data/FieldItemData';
import { STONE_EVOLUTIONS } from '../src/data/EvolutionStones';
import { POKEDEX } from '../src/data/Pokedex';

const failures: string[] = [];
const expect = (condition: unknown, message: string) => { if (!condition) failures.push(message); };
const itemsSource = readFileSync('src/systems/Items.ts', 'utf8');
const lazySource = readFileSync('src/systems/LazyScenes.ts', 'utf8');
const storyBlock = lazySource.match(/export const STORY_SCENE_KEYS = \[([\s\S]*?)\] as const;/);
const sceneKeys = new Set<string>(storyBlock
  ? [...storyBlock[1].matchAll(/['"]([A-Za-z0-9]+Scene)['"]/g)].map(match => match[1])
  : []);
const itemKeys = new Set([...itemsSource.matchAll(/\{ key: '([^']+)'/g)].map(match => match[1]));
const ids = new Set<string>();
const scenes = new Set<string>();

expect(FIELD_ITEM_PLACEMENTS.length >= 50, 'fewer than 50 rewards were distributed across the world');
for (const placement of FIELD_ITEM_PLACEMENTS) {
  expect(!ids.has(placement.id), `duplicate field item id: ${placement.id}`);
  ids.add(placement.id);
  scenes.add(placement.scene);
  expect(sceneKeys.has(placement.scene), `field item targets an unregistered scene: ${placement.scene}`);
  expect(itemKeys.has(placement.itemKey), `unknown field item key: ${placement.itemKey}`);
  expect(placement.ratio.every(value => value > .05 && value < .95), `unsafe edge ratio: ${placement.id}`);
  expect((placement.quantity ?? 1) >= 1, `invalid item quantity: ${placement.id}`);
}
expect(scenes.size >= 35, 'field rewards do not cover enough distinct overworld maps');

const stones = [...itemsSource.matchAll(/\{ key: '([^']+)'[^\n]+category: 'evolution'/g)].map(match => match[1]);
const placedKeys = new Set(FIELD_ITEM_PLACEMENTS.map(item => item.itemKey));
const dexKeys = new Set(POKEDEX.map(entry => entry.key));
expect(stones.length === 10, 'the complete ten-stone set is not defined');
for (const stone of stones) {
  expect(placedKeys.has(stone), `${stone} is not obtainable in the field`);
  expect(STONE_EVOLUTIONS.some(rule => rule.stoneKey === stone), `${stone} has no evolution trigger`);
}
for (const rule of STONE_EVOLUTIONS) {
  expect(dexKeys.has(rule.fromKey), `stone evolution source is missing from Pokédex: ${rule.fromKey}`);
  expect(dexKeys.has(rule.toKey), `stone evolution target is missing from Pokédex: ${rule.toKey}`);
}

const fieldSource = readFileSync('src/systems/FieldItems.ts', 'utf8');
const mainSource = readFileSync('src/main.ts', 'utf8');
const mirrorSource = readFileSync('src/engine3d/OverworldMirror.ts', 'utf8');
const modelSource = readFileSync('src/engine3d/FieldItem3D.ts', 'utf8');
const menuSource = readFileSync('src/scenes/MenuScene.ts', 'utf8');
const sfxSource = readFileSync('src/systems/UiSfx.ts', 'utf8');
expect(mainSource.includes('installFieldItems(game)'), 'global field item installer is not bootstrapped');
expect(fieldSource.includes('SaveManager.save'), 'picked-up field items are not durably saved');
expect(fieldSource.includes('sfxItemGet(this.scene)'), 'pickup does not play the item-get sound');
expect(fieldSource.includes('this.scene.collides?.(x, y)'), 'placements are not corrected against map collision');
expect(mirrorSource.includes("kind: 'field-item'"), '3D overworld cannot track field pickups');
expect(mirrorSource.includes('buildFieldItem3D'), '3D overworld cannot build field pickups');
expect(modelSource.includes('field-item-pickup'), 'field pickup has no volumetric model');
expect(menuSource.includes("this.scene.launch('EvolutionScene'"), 'Bag cannot launch stone evolution');
expect(sfxSource.includes('export function sfxItemGet'), 'item pickup fanfare is missing');

console.log(JSON.stringify({
  placements: FIELD_ITEM_PLACEMENTS.length,
  scenesCovered: scenes.size,
  evolutionStones: stones,
  stoneEvolutionRules: STONE_EVOLUTIONS.length,
  failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
