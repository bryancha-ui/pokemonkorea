import { existsSync, readFileSync } from 'node:fs';

const failures: string[] = [];
const expect = (condition: unknown, message: string) => { if (!condition) failures.push(message); };

const moveSfx = readFileSync('src/systems/MoveSfx.ts', 'utf8');
const battleFx = readFileSync('src/systems/BattleFX.ts', 'utf8');
const moveFx3D = readFileSync('src/engine3d/MoveFX3D.ts', 'utf8');
const glbModels = readFileSync('src/engine3d/GlbModels.ts', 'utf8');
const battleMirror = readFileSync('src/engine3d/BattleMirror.ts', 'utf8');
const overworldMirror = readFileSync('src/engine3d/OverworldMirror.ts', 'utf8');
const starterPreview = readFileSync('src/engine3d/StarterPreview3D.ts', 'utf8');
const gymBattle = readFileSync('src/scenes/GymLeaderBattleScene.ts', 'utf8');
const rivalBattle = readFileSync('src/scenes/RivalBattleScene.ts', 'utf8');
const trainerBattle = readFileSync('src/scenes/TrainerBattleScene.ts', 'utf8');
const wildBattle = readFileSync('src/scenes/WildBattleScene.ts', 'utf8');
const battlePokemonSprite = readFileSync('src/systems/BattlePokemonSprite.ts', 'utf8');
const pokemonLeague = readFileSync('src/scenes/PokemonLeagueScene.ts', 'utf8');
const postBattleRewards = readFileSync('src/systems/PostBattleRewards.ts', 'utf8');
const postBattleRewardScene = readFileSync('src/scenes/PostBattleRewardScene.ts', 'utf8');
const main = readFileSync('src/main.ts', 'utf8');

const types = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];
for (const type of types) {
  expect(new RegExp(`\\n\\s*${type}: \\(`).test(moveSfx), `missing ${type} move sound voice`);
}
expect(battleFx.includes("playMoveSfx(scene, move.type, 'cast')"),
  'move launch/status/charge sound hook is missing');
expect(battleFx.includes("playMoveSfx(scene, move.type, 'impact')"),
  'damaging move impact sound hook is missing');
expect(battleFx.includes("if (move.category === 'status') playMoveSfx"),
  'status moves do not play their elemental sound');
expect(battleFx.includes("if (phase === 'charge') playMoveSfx"),
  'two-turn moves do not play a charge sound');

// Signature move presentation: these must not regress to a generic lunge/orb.
expect(battleMirror.includes("moveKey === 'rock throw' || moveKey === 'rock tomb'")
  && battleMirror.includes('this.fx.rockThrow(') && battleMirror.includes('this.fx.rockTomb('),
  'Rock Throw or Rock Tomb is not routed to its dedicated 3D effect');
expect(moveFx3D.includes('rockThrow(') && moveFx3D.includes('new THREE.DodecahedronGeometry(radius, 1)'),
  'Rock Throw has no single large 3D boulder');
expect(moveFx3D.includes('rockTomb(') && moveFx3D.includes('getRockTombSealTex()'),
  'Rock Tomb has no multi-rock burial and X seal');
expect(moveFx3D.includes("name === 'thunderbolt'") && moveFx3D.includes('private thunderbolt(')
  && battleMirror.includes("'thunderbolt',"),
  'Thunderbolt is not routed to its enlarged timed electric effect');
expect(battleFx.includes("moveKey === 'rock throw'") && battleFx.includes("moveKey === 'rock tomb'")
  && battleFx.includes("moveKey === 'thunderbolt'"),
  'signature move presentation is missing its 2D fallback');
expect(battleFx.includes('thunderbolt: 410') && battleFx.includes("moveKey === 'rock tomb' ? 675 : 505"),
  'signature move damage timing is no longer aligned with its visual contact');

// These three reported species are skinned GLBs without clips. They used to be
// copied with Object3D.clone(), leaving their Skeleton bones parented to the
// cached model at world origin and visually ignoring the enemy battle anchor.
const parseGlbJson = (key: string) => {
  const bytes = readFileSync(`public/assets/models3d/${key}.glb`);
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString().replace(/\0+$/, '')) as {
    skins?: unknown[];
    animations?: unknown[];
  };
};
for (const [key, name] of [['80', 'Slowbro'], ['475', 'Gallade'], ['445', 'Garchomp']] as const) {
  const json = parseGlbJson(key);
  expect((json.skins?.length ?? 0) > 0 && (json.animations?.length ?? 0) === 0,
    `${name} no longer exercises the skinned-without-clips anchor path`);
}
expect(glbModels.includes("import { clone as skeletonClone }"),
  'SkeletonUtils clone is not imported for skinned battle models');
expect(/skinned\s*\|\|\s*src\.animations\.length\s*\?\s*skeletonClone\(src\.group\)/.test(glbModels),
  'skinned battle models can still share cached skeletons and ignore their battle anchor');
expect(battleMirror.includes("'510': 1.65"),
  'Liepard lost its low-silhouette battle size correction');
expect(battleMirror.includes("'95': 90"),
  'Onix lost its -X to +Z battle-facing correction');
expect(/cameraFacingYaw\(cb\.holder\) \+ battleYawOffset/.test(battleMirror),
  'enemy camera tracking overwrites species-specific battle yaw corrections');

// getModel() clones scene nodes but shares the cached geometry, materials and
// textures. Mobile keeps only two decoded models, so loading a switch-in used
// to evict the GPU allocations backing an opponent that was still on screen.
// Every persistent owner must pin its cache entry, and global world cleanup
// must leave pinned entries intact.
expect(/if \(\(modelPins\.get\(key\) \?\? 0\) > 0\) continue;/.test(glbModels),
  'global GPU cleanup can still dispose a model that is visible in another owner');
expect(battleMirror.includes('pinnedGlbKey: string | null'),
  'battle combatants do not track which shared model cache entry they own');
expect(battleMirror.includes('pinModel(cb.glbKey)') && battleMirror.includes('unpinModel(cb.pinnedGlbKey)'),
  'battle Pokémon do not hold their shared GPU resources for their full visible lifetime');
expect(battleMirror.includes('pinModel(w.glbKey)') && battleMirror.includes('unpinModel(w.pinnedGlbKey)'),
  'battle trainer model loads can still evict a visible Pokémon');
expect(overworldMirror.includes('pinModel(t.creatureKey)') && overworldMirror.includes('unpinModel(t.pinnedCreatureKey)'),
  'tagged overworld creatures do not hold their shared GPU resources');
expect(overworldMirror.includes('pinModel(profile.key)') && overworldMirror.includes('unpinModel(this.hatchModelKey)'),
  'the hatch model is not protected while its cutscene is visible');
expect(starterPreview.includes('pinModel(this.currentKey)') && starterPreview.includes('unpinModel(this.pinnedModelKey)'),
  'starter preview models are not protected while visible');

// Every battle type must hand a fainted player's replacement choice back to
// the player. The final `false` makes this a forced, non-cancellable selection
// while still exposing all healthy bench slots on desktop and mobile.
for (const [name, source] of [
  ['gym leader', gymBattle], ['rival', rivalBattle],
  ['trainer', trainerBattle], ['wild', wildBattle],
] as const) {
  expect(source.includes("this.typeDialog('Choose your next Pokémon!')"),
    `${name} battles do not prompt for a replacement after a faint`);
  expect(/openSwitchPanel\(this, this\.activeSlot, \(\) => \{\}, \(idx\) => this\.sendInChosen\(idx\), false\)/.test(source),
    `${name} battles can still auto-select the next healthy Pokémon`);
}

// Slow mobile decoding/loading must never substitute a completely different
// Pokémon. Keep the battle slot's logical identity separate from its temporary
// Phaser texture so the Three.js mirror can still select the correct GLB.
expect(battlePokemonSprite.includes("const TRANSPARENT_BATTLE_TEXTURE = '__pk-battle-transparent'"),
  'battle sprites have no species-neutral loading placeholder');
expect(battlePokemonSprite.includes('sprite.setData(BATTLE_POKEMON_MODEL_KEY, requestedKey)'),
  'battle sprites do not retain their authoritative logical species key');
expect(battleMirror.includes('battlePokemonModelKey(im)') && battleMirror.includes('combatantSignature(im)'),
  'the 3D battle mirror can still infer species solely from a temporary 2D texture');
for (const [name, source] of [
  ['gym leader', gymBattle], ['rival', rivalBattle],
  ['trainer', trainerBattle], ['wild', wildBattle],
] as const) {
  expect(source.includes('battlePokemonTextureKey') && source.includes('setBattlePokemonSprite'),
    `${name} battles do not use the species-safe sprite path`);
}
expect(!trainerBattle.includes("textures.exists(teKey) ? teKey : pKey")
  && !trainerBattle.includes("textures.exists(teKey) ? teKey : 'vipour'")
  && !trainerBattle.includes("registry.set('_teKey'"),
  'trainer battles can still replace an unloaded opponent or reuse a stale opponent texture key');
expect(!wildBattle.includes("textures.exists(wKey) ? wKey : 'disguijar'"),
  'wild battles can still display Disguijar when the requested species is loading');
expect(!gymBattle.includes("this.add.image(900, 100, 'corrpanda')"),
  'gym battles can still display Corrpanda before the active opponent texture resolves');

// Champion Hwangeum's opening team member is Kkaakdang. Its authored 2D and
// 3D assets must both remain packaged so mobile never has to fall back.
expect(pokemonLeague.includes("custom: 'kkaakdang'"),
  "Champion Hwangeum's Kkaakdang is missing from the league roster");
expect(existsSync('public/assets/dex/kkaakdang.png'),
  "Champion Hwangeum's Kkaakdang 2D asset is missing");
expect(existsSync('public/assets/models3d/kkaakdang.glb'),
  "Champion Hwangeum's Kkaakdang 3D asset is missing");

// Badges and TMs used to be presented while the battle UI was still active.
// Both the bespoke Shadow Gym battle and the shared leader battle flow must
// defer their ceremony until the authored return map is visible.
for (const [name, source] of [
  ['shadow gym', gymBattle], ['shared gym leader', trainerBattle],
] as const) {
  expect(source.includes('queuePostBattleReward(this.registry'),
    `${name} does not queue its badge/TM for post-battle presentation`);
  expect(!source.includes('showRewardCeremony'),
    `${name} can still present a badge before its battle scene closes`);
}
expect(postBattleRewards.includes("scene.scene.key === pending.returnScene")
  && postBattleRewards.includes("game.scene.run('PostBattleRewardScene'"),
  'post-battle rewards can launch before the exact return map is active');
expect(postBattleRewardScene.includes('this.scene.pause(this.parentKey)')
  && postBattleRewardScene.includes('showRewardCeremony(this')
  && postBattleRewardScene.includes('this.resumeParent()'),
  'the return map is not safely paused for the complete badge/TM presentation');
expect(postBattleRewardScene.includes('Received TM')
  && postBattleRewardScene.includes('sfxItemGet(this)'),
  'the post-battle TM delivery panel or its item fanfare is missing');
expect(main.includes('PostBattleRewardScene, ...deferredSceneTypes')
  && main.includes('installPostBattleRewards(game)'),
  'the post-battle reward scene is not registered and globally installed');

console.log(JSON.stringify({
  moveTypesChecked: types.length,
  signatureMoveEffectsChecked: 3,
  anchoredSpeciesChecked: 3,
  speciesPresentationFixesChecked: 2,
  sharedModelOwnersChecked: 5,
  forcedReplacementFlowsChecked: 4,
  speciesSafeBattleFlowsChecked: 4,
  championKkaakdangAssetsChecked: 2,
  postBattleRewardFlowsChecked: 2,
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
