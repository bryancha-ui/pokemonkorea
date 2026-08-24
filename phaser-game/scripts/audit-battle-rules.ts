import { Pokemon, type MoveData, type PokemonData } from '../src/battle/Pokemon';
import {
  activateEntryAbilities, advanceBattleWeather, applySwitchOutAbility,
  battleWeather, setBattleWeather, statusBeforeMove, transferBattleWeather,
} from '../src/systems/AbilitySystem';
import { chooseBattleMove } from '../src/systems/BattleAI';
import { resolveBattleEndTurn } from '../src/systems/BattleEndTurn';

const failures: string[] = [];
const expect = (value: boolean, message: string) => { if (!value) failures.push(message); };
const oldRandom = Math.random;
Math.random = () => 0.99; // deterministic: no random criticals or status immobilisation

const TACKLE: MoveData = { name: 'Tackle', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35 };
const FIRE: MoveData = { name: 'Flamethrower', type: 'fire', category: 'special', power: 90, accuracy: 100, pp: 15 };
const WATER: MoveData = { name: 'Surf', type: 'water', category: 'special', power: 90, accuracy: 100, pp: 15 };
const data = (name: string, type1: PokemonData['type1'] = 'normal', ability?: string): PokemonData => ({
  id: name.length + 10000, name, type1, ability,
  baseHp: 90, baseAtk: 90, baseDef: 90, baseSpAtk: 90, baseSpDef: 90, baseSpd: 90, spriteUrl: '',
});
const mon = (name: string, type: PokemonData['type1'] = 'normal', moves: MoveData[] = [TACKLE], ability?: string) =>
  new Pokemon(data(name, type, ability), 50, moves);
const damage = (move: MoveData, weather: Parameters<Pokemon['takeDamage']>[2]) => {
  const user = mon('Attacker', 'normal', [move]);
  const target = mon('Target');
  return target.takeDamage(user.moves[0], user, weather).dmg;
};

expect(damage(FIRE, 'sun') > damage(FIRE, 'clear'), 'sunlight did not strengthen Fire damage');
expect(damage(WATER, 'sun') < damage(WATER, 'clear'), 'sunlight did not weaken Water damage');
expect(damage(WATER, 'rain') > damage(WATER, 'clear'), 'rain did not strengthen Water damage');

const weatherA = mon('Weather A'); const weatherB = mon('Weather B');
setBattleWeather(weatherA, weatherB, 'rain', 2);
advanceBattleWeather(weatherA, weatherB);
expect(battleWeather(weatherA, weatherB) === 'rain', 'weather expired one turn too early');
advanceBattleWeather(weatherA, weatherB);
expect(battleWeather(weatherA, weatherB) === 'clear', 'weather did not expire at its duration');

const oldWeatherUser = mon('Old Weather User'); const weatherFoe = mon('Weather Foe');
const newWeatherUser = mon('New Weather User');
setBattleWeather(oldWeatherUser, weatherFoe, 'sun', 1);
transferBattleWeather(oldWeatherUser, newWeatherUser);
advanceBattleWeather(newWeatherUser, weatherFoe);
expect(battleWeather(oldWeatherUser, newWeatherUser) === 'clear', 'expired weather leaked back from a withdrawn combatant');

const toxic = mon('Toxic Target'); const neutral = mon('Neutral');
toxic.trySetStatus('tox');
const toxicStart = toxic.hp;
resolveBattleEndTurn(toxic, neutral);
const toxicFirst = toxicStart - toxic.hp;
const toxicAfterFirst = toxic.hp;
resolveBattleEndTurn(toxic, neutral);
expect(toxicAfterFirst - toxic.hp > toxicFirst, 'bad poison damage did not increase each turn');

const seedSource = mon('Seeder', 'grass'); const seeded = mon('Seeded');
seedSource.hp -= 30;
expect(seeded.seed(seedSource), 'Leech Seed failed on a valid target');
const seededHp = seeded.hp; const sourceHp = seedSource.hp;
resolveBattleEndTurn(seedSource, seeded);
expect(seeded.hp < seededHp && seedSource.hp > sourceHp, 'Leech Seed did not drain and restore HP');
const seedReplacement = mon('Seed Replacement');
seedReplacement.hp -= 30;
seedSource.transferSeededTargetsTo(seedReplacement);
const replacementHp = seedReplacement.hp;
resolveBattleEndTurn(seedReplacement, seeded);
expect(seedReplacement.hp > replacementHp, 'Leech Seed healing did not transfer to the replacement side');

const charmer = new Pokemon({ ...data('Charmer', 'fairy'), gender: 'male' }, 50, [TACKLE]);
const charmed = new Pokemon({ ...data('Charmed'), gender: 'female' }, 50, [TACKLE]);
expect(charmed.attract(charmer), 'valid attraction was rejected');
charmer.resetVolatileOnSwitch();
expect(!charmed.isInfatuated(), 'attraction persisted after its source switched out');

const intimidator = mon('Intimidator', 'normal', [TACKLE], 'Intimidate');
const intimidated = mon('Intimidated');
activateEntryAbilities(intimidator, intimidated);
applySwitchOutAbility(intimidator);
activateEntryAbilities(intimidator, intimidated);
expect(intimidated.getStage('atk') === -2, 'entry ability did not reactivate after switching back in');

const lum = mon('Lum Holder').setHeldItem('lumberry');
lum.trySetStatus('brn');
resolveBattleEndTurn(lum, mon('Lum Foe'));
expect(lum.status === 'none' && !lum.heldItem, 'Lum Berry did not cure and consume');
const leftovers = mon('Leftovers Holder').setHeldItem('leftovers');
leftovers.hp -= 24; const beforeLeftovers = leftovers.hp;
resolveBattleEndTurn(leftovers, mon('Leftovers Foe'));
expect(leftovers.hp > beforeLeftovers, 'Leftovers did not restore HP');

const confused = mon('Confused'); const confusionFoe = mon('Confusion Foe');
confused.confuse(3);
Math.random = () => 0;
const confusionHp = confused.hp;
const confusion = statusBeforeMove(confused, confusionFoe, confused.moves[0]);
expect(confusion.blocked && confused.hp < confusionHp, 'confusion did not support self-hit turn loss');

const disabled = mon('Disabled');
disabled.disableMove('Tackle', 2);
expect(statusBeforeMove(disabled, neutral, disabled.moves[0]).blocked, 'disabled move was still usable');
disabled.tickDisabledMoves(); disabled.tickDisabledMoves();
expect(!disabled.isMoveDisabled('Tackle'), 'Disable did not expire');

Math.random = () => 0.1;
const aiUser = mon('Boss', 'normal', [
  TACKLE,
  { name: 'Recover', type: 'normal', category: 'status', power: 0, accuracy: 100, pp: 10, healing: 50, effectTarget: 'user' },
]);
aiUser.hp = Math.floor(aiUser.maxHp * 0.2);
const aiChoice = chooseBattleMove(aiUser, neutral, aiUser.moves, 'boss', 4);
expect(aiChoice.data.name === 'Recover', 'boss AI ignored critical recovery opportunity');

Math.random = oldRandom;
console.log(JSON.stringify({ rulesChecked: 17, failures }, null, 2));
if (failures.length) process.exitCode = 1;
