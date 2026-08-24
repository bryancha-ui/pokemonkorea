import type { Pokemon } from '../battle/Pokemon';
import { advanceBattleWeather, battleWeather, type BattleWeather } from './AbilitySystem';
import type Phaser from 'phaser';

export interface EndTurnResult {
  messages: string[];
  firstHpChanged: boolean;
  secondHpChanged: boolean;
  weather: BattleWeather;
}

function indirectDamage(mon: Pokemon, amount: number): number {
  if (mon.isKO || mon.hasAbility('Magic Guard') || amount <= 0) return 0;
  const before = mon.hp;
  mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(amount)));
  return before - mon.hp;
}

function applyStatusBerry(mon: Pokemon, messages: string[]): boolean {
  if (!mon.heldItemActive('lumberry') || mon.status === 'none') return false;
  const item = mon.consumeHeldItem();
  if (!item) return false;
  mon.cureStatus();
  messages.push(`${mon.name}'s Lum Berry cured its status condition!`);
  return true;
}

function applyHealingHeldItem(mon: Pokemon, messages: string[]): boolean {
  if (mon.isKO) return false;
  if (mon.heldItemActive('leftovers') && mon.hp < mon.maxHp) {
    const before = mon.hp;
    mon.heal(Math.max(1, Math.floor(mon.maxHp / 16)));
    const healed = mon.hp - before;
    if (healed > 0) messages.push(`${mon.name} restored ${healed} HP with Leftovers!`);
    return healed > 0;
  }

  const threshold = mon.hasAbility('Gluttony') ? 0.5 : 0.25;
  if (mon.hp / mon.maxHp > threshold) return false;
  let amount = 0;
  let berryName = '';
  if (mon.heldItemActive('oranberry')) { amount = 10; berryName = 'Oran Berry'; }
  else if (mon.heldItemActive('sitrusberry')) { amount = Math.max(1, Math.floor(mon.maxHp / 4)); berryName = 'Sitrus Berry'; }
  if (!amount) return false;

  const item = mon.consumeHeldItem();
  if (!item) return false;
  const before = mon.hp;
  mon.heal(amount);
  messages.push(`${mon.name} restored ${mon.hp - before} HP with its ${berryName}!`);
  if (mon.hasAbility('Cheek Pouch') && mon.hp < mon.maxHp) {
    const cheekBefore = mon.hp;
    mon.heal(Math.max(1, Math.floor(mon.maxHp / 3)));
    messages.push(`${mon.name}'s Cheek Pouch restored ${mon.hp - cheekBefore} more HP!`);
  }
  return mon.hp !== before;
}

/** Resolve all shared end-of-turn rules once after both sides have acted. */
export function resolveBattleEndTurn(first: Pokemon, second: Pokemon): EndTurnResult {
  const messages: string[] = [];
  const firstBefore = first.hp;
  const secondBefore = second.hp;
  const weatherBefore = battleWeather(first, second);

  for (const mon of [first, second]) {
    applyStatusBerry(mon, messages);
    const residual = mon.takeResidualStatusDamage();
    if (residual.damage > 0) messages.push(`${mon.name} was hurt by ${residual.label}!`);

    if (!mon.isKO && weatherBefore === 'sand'
      && !mon.hasAbility('Overcoat')
      && !['rock', 'ground', 'steel'].includes(mon.data.type1)
      && (!mon.data.type2 || !['rock', 'ground', 'steel'].includes(mon.data.type2))) {
      const damage = indirectDamage(mon, mon.maxHp / 16);
      if (damage > 0) messages.push(`${mon.name} was buffeted by the sandstorm!`);
    }
  }

  // Leech Seed drains after status/weather damage and heals its original source.
  for (const target of [first, second]) {
    const source = target.leechSeedSource();
    if (!source || target.isKO) continue;
    const damage = indirectDamage(target, target.maxHp / 8);
    if (damage <= 0) continue;
    const before = source.hp;
    if (!source.isKO) source.heal(damage);
    messages.push(`${target.name}'s health was sapped by Leech Seed!`);
    if (source.hp > before) messages.push(`${source.name} absorbed ${source.hp - before} HP!`);
  }

  for (const mon of [first, second]) applyHealingHeldItem(mon, messages);
  for (const mon of [first, second]) {
    mon.tickDisabledMoves();
    // A slower combatant consumes flinch before acting. A combatant that already
    // moved must not carry the same flinch into the next turn.
    mon.clearFlinch();
  }

  const weatherMessage = advanceBattleWeather(first, second);
  if (weatherMessage) messages.push(weatherMessage);

  return {
    messages,
    firstHpChanged: first.hp !== firstBefore,
    secondHpChanged: second.hp !== secondBefore,
    weather: battleWeather(first, second),
  };
}

export interface EndTurnPresentation {
  scene: Phaser.Scene;
  first: Pokemon;
  second: Pokemon;
  animateFirst(done: () => void): void;
  animateSecond(done: () => void): void;
  showDialog(text: string, done: () => void): void;
  onComplete(result: EndTurnResult): void;
}

/** Mutate end-turn state and present the resulting HP/weather changes uniformly
 * across wild, rival, trainer and Gym battle scenes. */
export function playBattleEndTurn(ctx: EndTurnPresentation): void {
  const result = resolveBattleEndTurn(ctx.first, ctx.second);
  ctx.scene.events.emit('pk3d-weather', result.weather);
  const show = () => {
    if (result.messages.length) ctx.showDialog(result.messages.join('\n'), () => ctx.onComplete(result));
    else ctx.onComplete(result);
  };
  const second = () => result.secondHpChanged ? ctx.animateSecond(show) : show();
  if (result.firstHpChanged) ctx.animateFirst(second);
  else second();
}
