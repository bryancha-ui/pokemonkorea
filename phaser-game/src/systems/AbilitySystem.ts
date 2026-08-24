import type { Move, MoveData, Pokemon } from '../battle/Pokemon';

export type BattleWeather = 'clear' | 'rain' | 'sun' | 'sand' | 'snow';

const entered = new WeakSet<Pokemon>();
interface WeatherState { weather: BattleWeather; turns: number }
const fieldWeather = new WeakMap<Pokemon, WeatherState>();
const weatherExhausted = new WeakSet<Pokemon>();

/** Set weather created by a field move for both active combatants. Weak keys
 * make it battle-local: new Pokémon objects start with a clean field. */
export function setBattleWeather(a: Pokemon, b: Pokemon, weather: BattleWeather, turns = 5): void {
  const state = { weather, turns: Math.max(1, turns) };
  fieldWeather.set(a, state);
  fieldWeather.set(b, state);
  weatherExhausted.delete(a);
  weatherExhausted.delete(b);
}

export function battleWeather(a: Pokemon, b: Pokemon): BattleWeather {
  if (a.hasAbility('Cloud Nine') || b.hasAbility('Cloud Nine')) return 'clear';
  const explicit = fieldWeather.get(a) ?? fieldWeather.get(b);
  if (explicit && explicit.turns > 0) return explicit.weather;
  if (!weatherExhausted.has(a) && !weatherExhausted.has(b)) {
    if (a.hasAbility('Drizzle') || b.hasAbility('Drizzle')) return 'rain';
    if (a.hasAbility('Drought') || b.hasAbility('Drought')) return 'sun';
    if (a.hasAbility('Sand Stream') || b.hasAbility('Sand Stream')) return 'sand';
    if (a.hasAbility('Snow Warning') || b.hasAbility('Snow Warning')) return 'snow';
  }
  return 'clear';
}

/** Advance move/ability-created weather exactly once after a completed turn. */
export function advanceBattleWeather(a: Pokemon, b: Pokemon): string | undefined {
  const state = fieldWeather.get(a) ?? fieldWeather.get(b);
  if (!state) return undefined;
  state.turns--;
  if (state.turns > 0) return undefined;
  state.turns = 0;
  fieldWeather.delete(a);
  fieldWeather.delete(b);
  weatherExhausted.add(a);
  weatherExhausted.add(b);
  return 'The weather returned to normal.';
}

/** Carry field weather to a replacement. The state is shared by reference so
 * its remaining turn count still advances exactly once for the whole field. */
export function transferBattleWeather(from: Pokemon, to: Pokemon): void {
  const state = fieldWeather.get(from);
  if (state && state.turns > 0) fieldWeather.set(to, state);
  if (weatherExhausted.has(from)) weatherExhausted.add(to);
  entered.delete(from);
}

/** Apply switch-in abilities lazily the first time a combatant participates.
 * This also covers replacements without requiring every battle scene to
 * duplicate Intimidate/weather/custom-ability handling. */
export function activateEntryAbilities(a: Pokemon, b: Pokemon): string[] {
  const messages: string[] = [];
  const activate = (mon: Pokemon, foe: Pokemon) => {
    if (entered.has(mon)) return;
    entered.add(mon);
    if (mon.hasAbility('Intimidate') || mon.hasAbility('Threat Stance')) {
      if (foe.hasAbility('Inner Focus')) messages.push(`${foe.name}'s Inner Focus prevented Intimidate!`);
      else {
        const changed = foe.modifyStage('atk', -1);
        if (changed < 0) messages.push(`${mon.name}'s ${mon.ability} lowered ${foe.name}'s Attack!`);
      }
    }
    if (mon.hasAbility('Stonegaze')) {
      const changed = foe.modifyStage('spd', -1);
      if (changed < 0) messages.push(`${mon.name}'s Stonegaze lowered ${foe.name}'s Speed!`);
    }
    if (mon.hasAbility('Ancient Activation')) {
      const stats = [
        ['atk', mon.atk], ['def', mon.def], ['spAtk', mon.spAtk],
        ['spDef', mon.spDef], ['spd', mon.spd],
      ] as const;
      const best = stats.reduce((x, y) => y[1] > x[1] ? y : x)[0];
      mon.modifyStage(best, 1);
      messages.push(`${mon.name}'s Ancient Activation boosted its strongest stat!`);
    }
    if (mon.hasAbility('Drizzle')) { setBattleWeather(mon, foe, 'rain'); messages.push(`${mon.name}'s Drizzle made it rain!`); }
    if (mon.hasAbility('Snow Warning')) { setBattleWeather(mon, foe, 'snow'); messages.push(`${mon.name}'s Snow Warning summoned snow!`); }
    if (mon.hasAbility('Drought')) { setBattleWeather(mon, foe, 'sun'); messages.push(`${mon.name}'s Drought intensified the sunlight!`); }
    if (mon.hasAbility('Sand Stream')) { setBattleWeather(mon, foe, 'sand'); messages.push(`${mon.name}'s Sand Stream whipped up a sandstorm!`); }
  };
  activate(a, b);
  activate(b, a);
  return messages;
}

export function effectiveBattleSpeed(mon: Pokemon, foe: Pokemon): number {
  let speed = mon.battleStat('spd');
  const weather = battleWeather(mon, foe);
  if (weather === 'rain' && mon.hasAbility('Swift Swim')) speed *= 2;
  if (weather === 'sun' && mon.hasAbility('Chlorophyll')) speed *= 2;
  if (weather === 'sand' && mon.hasAbility('Sand Rush')) speed *= 2;
  if (weather === 'snow' && mon.hasAbility('Slush Rush')) speed *= 2;
  if (mon.hasAbility('Sure-Footed')) speed *= 1.1;
  return speed;
}

export function abilityEvasionMultiplier(user: Pokemon, target: Pokemon): number {
  const weather = battleWeather(user, target);
  if (weather === 'sand' && target.hasAbility('Sand Veil')) return 1.25;
  if (weather === 'snow' && target.hasAbility('Snow Cloak')) return 1.25;
  return 1;
}

export function extraPpCost(target: Pokemon): number {
  return target.hasAbility('Pressure') ? 1 : 0;
}

export function guaranteedEscape(mon: Pokemon): boolean {
  return mon.hasAbility('Run Away');
}

export function preventsEscape(mon: Pokemon): boolean {
  return mon.hasAbility('Shadow Tag');
}

export function blocksSecondaryEffects(target: Pokemon, move: MoveData): boolean {
  return move.power > 0 && target.hasAbility('Shield Dust');
}

export function blocksPowderMove(target: Pokemon, move: MoveData): boolean {
  return target.hasAbility('Overcoat')
    && /^(cotton spore|magic powder|poison powder|powder|rage powder|sleep powder|spore|stun spore)$/.test(
      move.name.toLowerCase().replace(/-/g, ' '),
    );
}

export interface StatusTurnResult {
  blocked: boolean;
  messages: string[];
  hpChanged?: boolean;
}

/** Resolve abilities and major status conditions immediately before a move. */
export function statusBeforeMove(mon: Pokemon, foe: Pokemon, move?: Move): StatusTurnResult {
  const messages: string[] = [];
  if (mon.status === 'slp' && mon.hasAbility('Insomnia')) {
    mon.cureStatus();
    messages.push(`${mon.name}'s Insomnia woke it up!`);
  } else if (mon.status === 'par' && mon.hasAbility('Limber')) {
    mon.cureStatus();
    messages.push(`${mon.name}'s Limber cured its paralysis!`);
  } else if (mon.status !== 'none' && battleWeather(mon, foe) === 'rain' && mon.hasAbility('Hydration')) {
    mon.cureStatus();
    messages.push(`${mon.name}'s Hydration cured its status condition!`);
  } else if (mon.status !== 'none' && mon.hasAbility('Shed Skin') && Math.random() < 1 / 3) {
    mon.cureStatus();
    messages.push(`${mon.name}'s Shed Skin cured its status condition!`);
  }

  if (mon.consumeFlinch()) {
    messages.push(`${mon.name} flinched and couldn't move!`);
    return { blocked: true, messages };
  }
  if (mon.isInfatuated()) {
    messages.push(`${mon.name} is in love!`);
    if (Math.random() < 0.5) {
      messages.push(`${mon.name} is immobilized by love!`);
      return { blocked: true, messages };
    }
  }
  const confusion = mon.confusionStep();
  if (confusion === 'ended') {
    messages.push(`${mon.name} snapped out of confusion!`);
  } else if (confusion === 'active') {
    messages.push(`${mon.name} is confused!`);
    if (Math.random() < 1 / 3) {
      const damage = mon.confusionDamage();
      messages.push(`${mon.name} hurt itself in confusion for ${damage} HP!`);
      return { blocked: true, messages, hpChanged: damage > 0 };
    }
  }
  if (move && mon.isMoveDisabled(move.data.name)) {
    messages.push(`${mon.name}'s ${move.data.name} is disabled!`);
    return { blocked: true, messages };
  }

  if (mon.status === 'par' && Math.random() < 0.25) {
    messages.push(`${mon.name} is paralyzed! It can't move!`);
    return { blocked: true, messages };
  }
  if (mon.status === 'slp') {
    const wakeChance = mon.hasAbility('Early Bird') ? 2 / 3 : 1 / 3;
    if (Math.random() < wakeChance) {
      mon.cureStatus();
      messages.push(`${mon.name} woke up!`);
    } else {
      messages.push(`${mon.name} is fast asleep.`);
      return { blocked: true, messages };
    }
  }
  if (mon.status === 'frz') {
    if (Math.random() < 0.2) {
      mon.cureStatus();
      messages.push(`${mon.name} thawed out!`);
    } else {
      messages.push(`${mon.name} is frozen solid!`);
      return { blocked: true, messages };
    }
  }
  return { blocked: false, messages };
}

/** Called by switch flows so Natural Cure is not tied to a particular scene. */
export function applySwitchOutAbility(mon: Pokemon): string | undefined {
  const message = mon.hasAbility('Natural Cure') && mon.cureStatus()
    ? `${mon.name}'s Natural Cure healed its status condition!` : undefined;
  mon.resetVolatileOnSwitch();
  entered.delete(mon);
  return message;
}

// Priority (선공기) by move name. Moves built by the Learnset/custom factories
// don't carry a `priority` field (it stays undefined → 0), so a Quick Attack user
// only moved first if it was already faster. PokéAPI moves DO carry priority, so
// this is a fallback used only when the move data didn't specify one.
const MOVE_PRIORITY: Record<string, number> = {
  'quick attack': 1, 'shadow sneak': 1, 'sucker punch': 1, 'aqua jet': 1,
  'bullet punch': 1, 'mach punch': 1, 'ice shard': 1, 'vacuum wave': 1,
  'accelerock': 1, 'water shuriken': 1, 'jet punch': 1, 'baby-doll eyes': 1,
  'extreme speed': 2, 'first impression': 2, 'feint': 2, 'fake out': 3,
};

export function abilityPriority(mon: Pokemon, move: Move): number {
  let priority = move.data.priority ?? MOVE_PRIORITY[move.data.name.toLowerCase()] ?? 0;
  if (mon.hasAbility('Prankster') && move.data.category === 'status') priority += 1;
  if (mon.hasAbility('Gale Wings') && move.data.type === 'flying' && mon.hp === mon.maxHp) priority += 1;
  return priority;
}

export function actsBefore(a: Pokemon, aMove: Move, b: Pokemon, bMove?: Move): boolean {
  const ap = abilityPriority(a, aMove), bp = bMove ? abilityPriority(b, bMove) : 0;
  if (ap !== bp) return ap > bp;
  const as = effectiveBattleSpeed(a, b), bs = effectiveBattleSpeed(b, a);
  return as > bs || (as === bs && Math.random() < 0.5);
}
