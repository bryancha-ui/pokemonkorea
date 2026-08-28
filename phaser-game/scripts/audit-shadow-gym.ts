import {
  SHADOW_GYM_ROOMS,
  shadowCandidateKind,
  shadowCloneFlag,
  shadowRoomClearFlag,
} from '../src/systems/ShadowGymPuzzle';
import offlineData from '../src/data/pokemon-offline.json';
import { readFileSync } from 'node:fs';

const failures: string[] = [];
const expect = (condition: unknown, message: string) => { if (!condition) failures.push(message); };

expect(SHADOW_GYM_ROOMS.length === 4, 'shadow gym must contain three trainer rooms and one leader room');
expect(SHADOW_GYM_ROOMS[0]?.sceneKey === 'CapitolGymScene', 'city entrance no longer opens the first trial');
expect(SHADOW_GYM_ROOMS.at(-1)?.trainer.leader === true, 'final room does not contain Leader Jin');

const sceneKeys = new Set<string>();
const trainerKeys = new Set<string>();
const offlinePokemon = (offlineData as { pokemon: Record<string, unknown> }).pokemon;
const arenaThemes = readFileSync('src/engine3d/BattleArenaThemes.ts', 'utf8');
const leaderBattle = readFileSync('src/scenes/GymLeaderBattleScene.ts', 'utf8');
const roomScene = readFileSync('src/scenes/CapitolGymScene.ts', 'utf8');
SHADOW_GYM_ROOMS.forEach((room, roomIndex) => {
  expect(!sceneKeys.has(room.sceneKey), `duplicate room scene: ${room.sceneKey}`);
  expect(!trainerKeys.has(room.trainer.key), `duplicate trainer: ${room.trainer.key}`);
  sceneKeys.add(room.sceneKey);
  trainerKeys.add(room.trainer.key);
  expect(room.stage === roomIndex + 1, `${room.sceneKey} has a broken stage number`);
  expect(room.candidates.length === 3, `${room.sceneKey} must show exactly three identical figures`);
  expect(room.candidates.filter(candidate => candidate === null).length === 1,
    `${room.sceneKey} must contain exactly one real trainer`);
  expect(room.candidates.filter(candidate => candidate !== null).length === 2,
    `${room.sceneKey} must contain exactly two wild-Pokémon clones`);
  room.candidates.forEach((candidate, candidateIndex) => {
    const expected = candidate === null ? 'trainer' : 'clone';
    expect(shadowCandidateKind(room, candidateIndex) === expected,
      `${room.sceneKey} candidate ${candidateIndex} resolves incorrectly`);
    if (candidate) {
      expect(candidate.id > 0 && candidate.level > 0, `${room.sceneKey} has an invalid clone encounter`);
      expect(!!offlinePokemon[String(candidate.id)],
        `${room.sceneKey} clone ${candidate.id} is unavailable in the mobile offline Pokédex`);
      expect(shadowCloneFlag(room, candidateIndex).includes(room.sceneKey),
        `${room.sceneKey} clone clear flag can collide with another room`);
    }
  });
  if (roomIndex > 0) {
    expect(room.previousScene === SHADOW_GYM_ROOMS[roomIndex - 1].sceneKey,
      `${room.sceneKey} does not return to the previous room`);
  }
  expect(arenaThemes.includes(`${room.sceneKey}: 'capitol'`),
    `${room.sceneKey} trainer battles lost the Shadow Gym 3D arena`);
  if (roomIndex < SHADOW_GYM_ROOMS.length - 1) {
    expect(room.nextScene === SHADOW_GYM_ROOMS[roomIndex + 1].sceneKey,
      `${room.sceneKey} does not open into the next room`);
  } else {
    expect(room.nextScene === undefined, 'leader sanctum must be the final room');
  }
  expect(shadowRoomClearFlag(room) === (room.trainer.leader
    ? 'gymLeaderDefeated'
    : `trainerDefeated_${room.trainer.key}`), `${room.sceneKey} does not honor existing victory saves`);
});

expect(leaderBattle.includes("import { MOBILE_ACTION_EVENT } from '../systems/TouchControls'"),
  'Leader Jin victory dialog is not connected to the mobile A-button');
expect(leaderBattle.includes('window.addEventListener(MOBILE_ACTION_EVENT, advance, { once: true })'),
  'Leader Jin victory dialog does not arm a fresh mobile confirm for every line');
expect(leaderBattle.includes('window.removeEventListener(MOBILE_ACTION_EVENT, advance)'),
  'Leader Jin victory dialog leaks or double-fires its mobile confirm listener');
expect(leaderBattle.includes("this.input.once('pointerdown', advance)"),
  'Leader Jin victory dialog cannot be advanced by tapping the game screen');
expect(leaderBattle.includes("this.typeDialog('Choose your next Pokémon!')"),
  'Leader Jin still auto-selects a replacement after the player faints');
expect(/openSwitchPanel\(this, this\.activeSlot, \(\) => \{\}, \(idx\) => this\.sendInChosen\(idx\), false\)/.test(leaderBattle),
  'Leader Jin faint replacement is not a non-cancellable desktop/mobile party choice');
expect(roomScene.includes("import { maybeLaunchEvolution } from '../systems/EvolutionSystem'"),
  'Shadow Gym rooms cannot play a level evolution after battle');
expect(roomScene.includes('if (returnedFromBattle) this.time.delayedCall(300, () => maybeLaunchEvolution(this))'),
  'Shadow Gym postpones level evolution until an unrelated menu item is used');

console.log(JSON.stringify({
  roomsChecked: SHADOW_GYM_ROOMS.length,
  candidatesChecked: SHADOW_GYM_ROOMS.reduce((sum, room) => sum + room.candidates.length, 0),
  mobileVictoryReturnChecked: true,
  postBattleEvolutionChecked: true,
  forcedReplacementChoiceChecked: true,
  failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
