import type { Move, Pokemon } from '../battle/Pokemon';
import { getEffectiveness } from '../battle/TypeChart';
import { battleWeather } from './AbilitySystem';

export type BattleAiSkill = 'wild' | 'trainer' | 'rival' | 'boss';

const HEALING = /^(synthesis|recover|roost|soft boiled|slack off|milk drink|heal order|shore up|morning sun|moonlight|life dew|rest)$/;
const WEATHER: Record<string, 'rain' | 'sun' | 'sand' | 'snow'> = {
  'rain dance': 'rain', 'sunny day': 'sun', sandstorm: 'sand', snowscape: 'snow', hail: 'snow',
};
const TARGET_STATUS = /^(thunder wave|stun spore|will o wisp|toxic|poison powder|poison gas|spore|sleep powder|hypnosis|sing)$/;
const SETUP = /^(swords dance|howl|meditate|bulk up|dragon dance|growth|work up|calm mind|nasty plot|tail glow|quiver dance|agility|rock polish|harden|withdraw|defense curl|iron defense|acid armor|cotton guard|amnesia|double team|minimize|hone claws|coil|aurora veil)$/;
const DISRUPTION = /^(growl|charm|feather dance|leer|tail whip|screech|fake tears|metal sound|string shot|scary face|sand attack|smokescreen|kinesis|sweet scent|leech seed|supersonic|confuse ray|swagger)$/;

function key(move: Move): string { return move.data.name.toLowerCase().replace(/-/g, ' '); }

function moveScore(user: Pokemon, target: Pokemon, move: Move, turn: number): number {
  const name = key(move);
  if (move.pp <= 0 || user.isMoveDisabled(move.data.name)) return 0;
  if (move.data.power > 0) {
    const effectiveness = getEffectiveness(move.data.type, target.data.type1, target.data.type2);
    if (effectiveness === 0) return 0.5;
    const stab = move.data.type === user.data.type1 || move.data.type === user.data.type2 ? 1.35 : 1;
    const accuracy = Math.max(0.35, Math.min(1, move.data.accuracy / 100));
    const finish = target.hp / target.maxHp < 0.28 ? 1.25 : 1;
    return Math.max(2, move.data.power * effectiveness * stab * accuracy * finish);
  }
  if (HEALING.test(name)) {
    const missing = 1 - user.hp / user.maxHp;
    return missing < 0.2 ? 1 : 70 + missing * 150;
  }
  if (WEATHER[name]) {
    if (battleWeather(user, target) === WEATHER[name]) return 1;
    const matchingType = (WEATHER[name] === 'rain' && user.data.type1 === 'water')
      || (WEATHER[name] === 'sun' && user.data.type1 === 'fire')
      || (WEATHER[name] === 'sand' && ['rock', 'ground', 'steel'].includes(user.data.type1))
      || (WEATHER[name] === 'snow' && user.data.type1 === 'ice');
    return matchingType ? 105 : 50;
  }
  if (TARGET_STATUS.test(name)) return target.status === 'none' ? 82 : 1;
  if (name === 'leech seed') return target.leechSeedSource() ? 1 : 88;
  if (SETUP.test(name)) {
    const alreadySet = Math.max(user.getStage('atk'), user.getStage('spAtk'), user.getStage('def'), user.getStage('spDef'), user.getStage('spd'));
    return alreadySet >= 3 ? 8 : Math.max(25, 92 - turn * 7 - alreadySet * 18);
  }
  if (DISRUPTION.test(name)) return 58;
  return 18;
}

/** Weighted tactical choice with intentional imperfection. Higher-rank trainers
 * evaluate utility, recovery and setup instead of deleting every status move. */
export function chooseBattleMove(
  user: Pokemon,
  target: Pokemon,
  pool: Move[],
  skill: BattleAiSkill,
  turn = 1,
  previousMove?: string,
): Move {
  const usable = pool.filter(move => move.pp > 0 && !user.isMoveDisabled(move.data.name));
  const choices = usable.length ? usable : pool;
  if (choices.length === 1) return choices[0];
  // Bosses should still feel human, but throwing away a guaranteed recovery at
  // critical HP reads as broken rather than imperfect. Preserve variation above
  // this emergency threshold and make the survival decision deterministic here.
  if (skill === 'boss' && user.hp / user.maxHp <= 0.3) {
    const recovery = choices.find(move => HEALING.test(key(move)) || (move.data.healing ?? 0) > 0);
    if (recovery) return recovery;
  }
  const intelligence = skill === 'boss' ? 1 : skill === 'rival' ? 0.78 : skill === 'trainer' ? 0.55 : 0.25;
  if (Math.random() > intelligence) return choices[Math.floor(Math.random() * choices.length)];

  const scored = choices.map(move => {
    let score = moveScore(user, target, move, turn);
    if (previousMove && key(move) === previousMove.toLowerCase().replace(/-/g, ' ')) score *= 0.72;
    // Weighted—not deterministic—selection prevents bosses from repeating the
    // mathematically best button every single turn.
    score = Math.max(0.1, score * (0.82 + Math.random() * 0.36));
    return { move, score };
  });
  const total = scored.reduce((sum, entry) => sum + entry.score, 0);
  let roll = Math.random() * total;
  for (const entry of scored) {
    roll -= entry.score;
    if (roll <= 0) return entry.move;
  }
  return scored[scored.length - 1].move;
}
