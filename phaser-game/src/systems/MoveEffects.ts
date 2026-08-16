import Phaser from 'phaser';
import { BattleStat, Move, MoveData, MoveStatChange, Pokemon } from '../battle/Pokemon';
import { playChargeFX, playDrainFX, playMoveFX, playStatusFX } from './BattleFX';
import {
  abilityEvasionMultiplier, activateEntryAbilities, blocksPowderMove,
  blocksSecondaryEffects, extraPpCost, statusBeforeMove,
} from './AbilitySystem';

type EffectTarget = 'user' | 'target';
type TwoTurnMode = 'air' | 'underground' | 'charge';

interface EffectSpec {
  healing?: number;
  drain?: number;
  recoil?: number;
  statChanges?: MoveStatChange[];
  target?: EffectTarget;
  chance?: number;
  twoTurn?: TwoTurnMode;
  clearNegative?: boolean;
  statusCondition?: string;
  statusChance?: number;
}

const sc = (stat: BattleStat, change: number): MoveStatChange => ({ stat, change });

/** Offline metadata for every utility/drain move shipped directly in this game. */
const EFFECTS: Record<string, EffectSpec> = {
  // Recovery
  synthesis: { healing: 50, target: 'user' }, recover: { healing: 50, target: 'user' },
  roost: { healing: 50, target: 'user' }, 'soft boiled': { healing: 50, target: 'user' },
  'slack off': { healing: 50, target: 'user' }, 'milk drink': { healing: 50, target: 'user' },
  'heal order': { healing: 50, target: 'user' }, 'shore up': { healing: 50, target: 'user' },
  'morning sun': { healing: 50, target: 'user' }, moonlight: { healing: 50, target: 'user' },
  'life dew': { healing: 25, target: 'user' }, rest: { healing: 100, target: 'user' },

  // Draining attacks
  absorb: { drain: 50 }, 'mega drain': { drain: 50 }, 'giga drain': { drain: 50 },
  'drain punch': { drain: 50 }, 'leech life': { drain: 50 }, 'horn leech': { drain: 50 },
  'parabolic charge': { drain: 50 }, 'dream eater': { drain: 50 },
  'draining kiss': { drain: 75 }, 'oblivion wing': { drain: 75 },

  // Recoil attacks. Brave Bird is authored locally as well as obtainable from
  // PokeAPI, so this fallback also repairs existing cached/local move records.
  'brave bird': { recoil: 33 },

  // Self rank-up moves
  'swords dance': { statChanges: [sc('atk', 2)], target: 'user' },
  howl: { statChanges: [sc('atk', 1)], target: 'user' },
  meditate: { statChanges: [sc('atk', 1)], target: 'user' },
  'bulk up': { statChanges: [sc('atk', 1), sc('def', 1)], target: 'user' },
  'dragon dance': { statChanges: [sc('atk', 1), sc('spd', 1)], target: 'user' },
  growth: { statChanges: [sc('atk', 1), sc('spAtk', 1)], target: 'user' },
  'work up': { statChanges: [sc('atk', 1), sc('spAtk', 1)], target: 'user' },
  'calm mind': { statChanges: [sc('spAtk', 1), sc('spDef', 1)], target: 'user' },
  'nasty plot': { statChanges: [sc('spAtk', 2)], target: 'user' },
  'tail glow': { statChanges: [sc('spAtk', 3)], target: 'user' },
  'quiver dance': { statChanges: [sc('spAtk', 1), sc('spDef', 1), sc('spd', 1)], target: 'user' },
  agility: { statChanges: [sc('spd', 2)], target: 'user' },
  'rock polish': { statChanges: [sc('spd', 2)], target: 'user' },
  harden: { statChanges: [sc('def', 1)], target: 'user' },
  withdraw: { statChanges: [sc('def', 1)], target: 'user' },
  'defense curl': { statChanges: [sc('def', 1)], target: 'user' },
  'iron defense': { statChanges: [sc('def', 2)], target: 'user' },
  'acid armor': { statChanges: [sc('def', 2)], target: 'user' },
  'cotton guard': { statChanges: [sc('def', 3)], target: 'user' },
  amnesia: { statChanges: [sc('spDef', 2)], target: 'user' },
  'double team': { statChanges: [sc('evasion', 1)], target: 'user' },
  minimize: { statChanges: [sc('evasion', 2)], target: 'user' },
  'hone claws': { statChanges: [sc('atk', 1), sc('accuracy', 1)], target: 'user' },
  coil: { statChanges: [sc('atk', 1), sc('def', 1), sc('accuracy', 1)], target: 'user' },
  'aurora veil': { statChanges: [sc('def', 1), sc('spDef', 1)], target: 'user' },
  mist: { clearNegative: true, target: 'user' },

  // Common target rank-down moves
  growl: { statChanges: [sc('atk', -1)], target: 'target' },
  charm: { statChanges: [sc('atk', -2)], target: 'target' },
  'feather dance': { statChanges: [sc('atk', -2)], target: 'target' },
  leer: { statChanges: [sc('def', -1)], target: 'target' },
  'tail whip': { statChanges: [sc('def', -1)], target: 'target' },
  screech: { statChanges: [sc('def', -2)], target: 'target' },
  'fake tears': { statChanges: [sc('spDef', -2)], target: 'target' },
  'metal sound': { statChanges: [sc('spDef', -2)], target: 'target' },
  'string shot': { statChanges: [sc('spd', -2)], target: 'target' },
  'scary face': { statChanges: [sc('spd', -2)], target: 'target' },
  'sand attack': { statChanges: [sc('accuracy', -1)], target: 'target' },
  smokescreen: { statChanges: [sc('accuracy', -1)], target: 'target' },
  kinesis: { statChanges: [sc('accuracy', -1)], target: 'target' },
  'sweet scent': { statChanges: [sc('evasion', -2)], target: 'target' },

  // Damaging moves with self drops (static move data has no PokeAPI metadata).
  'close combat': { statChanges: [sc('def', -1), sc('spDef', -1)], target: 'user' },
  'draco meteor': { statChanges: [sc('spAtk', -2)], target: 'user' },
  overheat: { statChanges: [sc('spAtk', -2)], target: 'user' },
  'leaf storm': { statChanges: [sc('spAtk', -2)], target: 'user' },

  // Major status conditions. PokeAPI supplies the same metadata for remotely
  // loaded moves; these fallbacks cover the game's hand-authored movesets.
  'thunder wave': { statusCondition: 'par', statusChance: 100 },
  'stun spore': { statusCondition: 'par', statusChance: 100 },
  'will o wisp': { statusCondition: 'brn', statusChance: 100 },
  toxic: { statusCondition: 'psn', statusChance: 90 },
  'poison powder': { statusCondition: 'psn', statusChance: 75 },
  'poison gas': { statusCondition: 'psn', statusChance: 90 },
  spore: { statusCondition: 'slp', statusChance: 100 },
  'sleep powder': { statusCondition: 'slp', statusChance: 75 },
  hypnosis: { statusCondition: 'slp', statusChance: 60 },
  sing: { statusCondition: 'slp', statusChance: 55 },
  ember: { statusCondition: 'brn', statusChance: 10 },
  flamethrower: { statusCondition: 'brn', statusChance: 10 },
  'ice beam': { statusCondition: 'frz', statusChance: 10 },
  thunderbolt: { statusCondition: 'par', statusChance: 10 },
  'body slam': { statusCondition: 'par', statusChance: 30 },
  'sludge bomb': { statusCondition: 'psn', statusChance: 30 },
  'poison jab': { statusCondition: 'psn', statusChance: 30 },

  // Two-turn moves
  fly: { twoTurn: 'air' }, bounce: { twoTurn: 'air' }, dig: { twoTurn: 'underground' },
  dive: { twoTurn: 'underground' }, 'phantom force': { twoTurn: 'charge' },
  'shadow force': { twoTurn: 'charge' }, 'solar beam': { twoTurn: 'charge' },
  'solar blade': { twoTurn: 'charge' }, 'sky attack': { twoTurn: 'charge' },
};

function moveKey(name: string): string { return name.toLowerCase().replace(/-/g, ' ').trim(); }

function specFor(move: MoveData): EffectSpec {
  const fallback = EFFECTS[moveKey(move.name)] ?? {};
  return {
    healing: move.healing && move.healing > 0 ? move.healing : fallback.healing,
    drain: move.drain && move.drain > 0 ? move.drain : fallback.drain,
    recoil: move.recoil && move.recoil > 0 ? move.recoil : fallback.recoil,
    statChanges: move.statChanges?.length ? move.statChanges : fallback.statChanges,
    // Hand-authored overrides win for exceptional damaging moves such as
    // Close Combat, whose stat drop affects the user although it targets a foe.
    target: fallback.target ?? move.effectTarget,
    chance: move.effectChance ?? fallback.chance ?? 100,
    twoTurn: move.twoTurn ?? fallback.twoTurn,
    clearNegative: fallback.clearNegative,
    statusCondition: move.statusCondition ?? fallback.statusCondition,
    statusChance: move.statusChance ?? fallback.statusChance,
  };
}

const charging = new WeakMap<Pokemon, { key: string; mode: TwoTurnMode }>();

export function pendingMoveFor(mon: Pokemon): Move | undefined {
  const pending = charging.get(mon);
  return pending ? mon.moves.find(m => moveKey(m.data.name) === pending.key) : undefined;
}

export function isCharging(mon: Pokemon): boolean { return charging.has(mon); }

/** True if using `move` now would BEGIN a two-turn move's charge (dig/fly/charge),
 *  as opposed to releasing a charge already in progress. The battle flow uses this
 *  to let the charging side act alone on the charge turn (the opponent waits), so a
 *  2-turn move costs the foe only one action instead of a free extra hit. */
export function willChargeThisTurn(mon: Pokemon, move: Move): boolean {
  const key = moveKey(move.data.name);
  if (charging.get(mon)?.key === key) return false;   // this is the release turn
  return !!specFor(move.data).twoTurn;
}

function beginMove(mon: Pokemon, move: Move): { phase: 'normal' | 'charge' | 'release'; mode?: TwoTurnMode; consumePP: boolean } {
  const key = moveKey(move.data.name);
  const spec = specFor(move.data);
  const pending = charging.get(mon);
  if (pending?.key === key) {
    charging.delete(mon);
    return { phase: 'release', mode: pending.mode, consumePP: false };
  }
  if (spec.twoTurn) {
    charging.set(mon, { key, mode: spec.twoTurn });
    return { phase: 'charge', mode: spec.twoTurn, consumePP: true };
  }
  return { phase: 'normal', consumePP: true };
}

function cancelCharge(scene: Phaser.Scene, mon: Pokemon, sprite: Phaser.GameObjects.Image): void {
  const pending = charging.get(mon);
  if (!pending) return;
  charging.delete(mon);
  scene.events.emit('pk3d-chargefx', {
    target: sprite, phase: 'release', mode: pending.mode, cancelled: true,
  });
  const originY = Number(sprite.getData('battleChargeOriginY'));
  if (Number.isFinite(originY)) sprite.setY(originY);
  sprite.setAlpha(1);
}

function canHit(user: Pokemon, target: Pokemon, move: MoveData): boolean {
  // Self-targeting utility moves (Synthesis, Swords Dance, etc.) do not roll
  // accuracy and must still work while the opponent is semi-invulnerable.
  const spec = specFor(move);
  if (move.category === 'status' && spec.target === 'user') return true;
  const targetCharge = charging.get(target);
  if (targetCharge) {
    const key = moveKey(move.name);
    const airHits = /^(thunder|hurricane|gust|twister|sky uppercut|smack down)$/.test(key);
    const groundHits = /^(earthquake|magnitude|fissure)$/.test(key);
    if (targetCharge.mode === 'air' && !airHits) return false;
    if (targetCharge.mode === 'underground' && !groundHits) return false;
  }
  if (/^(swift|aerial ace|magical leaf)$/.test(moveKey(move.name))) return true;
  const accuracy = Math.max(1, move.accuracy || 100) * user.accuracyMultiplier()
    / (target.evasionMultiplier() * abilityEvasionMultiplier(user, target));
  return Math.random() * 100 < Math.min(100, accuracy);
}

/** A ground shock that connects with a burrowed target also forces it back to
 * the surface. Without this, Earthquake dealt damage but left both the pending
 * Dig state and its underground model transform active for another turn. */
function breaksUndergroundCharge(target: Pokemon, move: MoveData): boolean {
  const targetCharge = charging.get(target);
  return targetCharge?.mode === 'underground'
    && /^(earthquake|magnitude|fissure)$/.test(moveKey(move.name));
}

const STAT_LABEL: Record<BattleStat, string> = {
  atk: 'Attack', def: 'Defense', spAtk: 'Sp. Atk', spDef: 'Sp. Def',
  spd: 'Speed', accuracy: 'Accuracy', evasion: 'Evasion',
};

interface AppliedEffects {
  healed: number;
  recoilDamage: number;
  hpTarget: EffectTarget;
  drain: boolean;
  messages: string[];
  changeTarget: EffectTarget;
  changeDirection: -1 | 0 | 1;
  visual: boolean;
}

function applyEffects(user: Pokemon, target: Pokemon, move: MoveData, damage: number): AppliedEffects {
  const spec = specFor(move);
  const messages: string[] = [];
  let healed = 0;
  let recoilDamage = 0;
  let changeDirection: -1 | 0 | 1 = 0;
  const changeTarget = spec.target ?? (move.category === 'status' ? 'target' : 'user');
  const affected = changeTarget === 'user' ? user : target;
  let hpTarget: EffectTarget = 'user';

  if (spec.healing) {
    hpTarget = changeTarget;
    const recipient = hpTarget === 'user' ? user : target;
    const before = recipient.hp;
    recipient.heal(Math.max(1, Math.floor(recipient.maxHp * spec.healing / 100)));
    healed += recipient.hp - before;
    messages.push(healed > 0 ? `${recipient.name} restored ${healed} HP!` : `${recipient.name}'s HP is already full!`);
  }
  if (spec.drain && damage > 0) {
    const before = user.hp;
    user.heal(Math.max(1, Math.floor(damage * spec.drain / 100)));
    const gained = user.hp - before;
    healed += gained;
    if (gained > 0) messages.push(`${user.name} absorbed ${gained} HP!`);
  }
  if (spec.recoil && damage > 0 && !user.hasAbility('Rock Head') && !user.hasAbility('Magic Guard')) {
    const before = user.hp;
    const recoil = Math.max(1, Math.floor(damage * spec.recoil / 100));
    user.hp = Math.max(0, user.hp - recoil);
    recoilDamage = before - user.hp;
    if (recoilDamage > 0) messages.push(`${user.name} was damaged by recoil!`);
  }
  if (spec.clearNegative) {
    affected.clearNegativeStages();
    messages.push(`${affected.name}'s lowered stats returned to normal!`);
    changeDirection = 1;
  }
  const secondaryBlocked = changeTarget === 'target'
    && (blocksSecondaryEffects(target, move) || (move.power > 0 && user.hasAbility('Sheer Force')));
  if (spec.statChanges?.length && !secondaryBlocked && Math.random() * 100 < (spec.chance ?? 100)) {
    for (const change of spec.statChanges) {
      const applied = affected.modifyStage(change.stat, change.change);
      if (applied === 0) {
        messages.push(`${affected.name}'s ${STAT_LABEL[change.stat]} won't go any ${change.change > 0 ? 'higher' : 'lower'}!`);
        continue;
      }
      changeDirection = applied > 0 ? 1 : -1;
      const degree = Math.abs(applied) >= 3 ? 'rose drastically'
        : Math.abs(applied) === 2 ? (applied > 0 ? 'rose sharply' : 'harshly fell')
          : applied > 0 ? 'rose' : 'fell';
      messages.push(`${affected.name}'s ${STAT_LABEL[change.stat]} ${degree}!`);
    }
    // Dancer immediately copies dance-based rank moves in a singles battle.
    if (changeTarget === 'user' && target.hasAbility('Dancer') && /dance/i.test(move.name)) {
      for (const change of spec.statChanges) target.modifyStage(change.stat, change.change);
      messages.push(`${target.name}'s Dancer copied ${move.name}!`);
    }
  }
  if (spec.statusCondition && (move.power === 0 || damage > 0) && !secondaryBlocked
    && Math.random() * 100 < (spec.statusChance ?? 100)) {
    if (target.trySetStatus(spec.statusCondition, user)) {
      const label: Record<string, string> = {
        par: 'was paralyzed', brn: 'was burned', psn: 'was poisoned',
        slp: 'fell asleep', frz: 'was frozen',
      };
      messages.push(`${target.name} ${label[spec.statusCondition] ?? 'was afflicted'}!`);
      changeDirection = -1;
    }
  }
  return {
    healed,
    recoilDamage,
    hpTarget,
    drain: !!spec.drain && damage > 0,
    messages,
    changeTarget,
    changeDirection,
    visual: !!(spec.healing || spec.drain || spec.statChanges?.length || spec.clearNegative || spec.statusCondition),
  };
}

export interface BattleMoveOutcome {
  damage: number;
  critical: boolean;
  effectiveness: number;
  charged: boolean;
  missed: boolean;
}

export interface BattleMoveContext {
  scene: Phaser.Scene;
  user: Pokemon;
  target: Pokemon;
  move: Move;
  userSprite: Phaser.GameObjects.Image;
  targetSprite: Phaser.GameObjects.Image;
  userLabel: string;
  showDialog(text: string, onDone: () => void): void;
  animateUserHp(onDone: () => void): void;
  animateTargetHp(onDone: () => void): void;
  onPpUsed?(): void;
  onComplete(result: BattleMoveOutcome): void;
}

function showMessages(ctx: BattleMoveContext, messages: string[], done: () => void): void {
  if (!messages.length) { done(); return; }
  ctx.showDialog(messages.join('\n'), done);
}

function effectAnimation(ctx: BattleMoveContext, fx: AppliedEffects, done: () => void): void {
  const affectedSprite = fx.changeTarget === 'user' ? ctx.userSprite : ctx.targetSprite;
  const afterUserHp = () => {
    if (fx.recoilDamage > 0) ctx.animateUserHp(done);
    else done();
  };
  const afterStatus = () => {
    if (fx.healed > 0) {
      if (fx.hpTarget === 'user') ctx.animateUserHp(afterUserHp);
      else ctx.animateTargetHp(afterUserHp);
    }
    else afterUserHp();
  };
  if (fx.drain) {
    playDrainFX(ctx.scene, ctx.targetSprite, ctx.userSprite, ctx.move.data, afterStatus);
  } else if (fx.visual) {
    const kind = fx.healed > 0 ? 'heal'
      : fx.changeDirection < 0 ? 'stat-down'
        : fx.changeDirection > 0 ? 'stat-up' : 'guard';
    playStatusFX(ctx.scene, affectedSprite, ctx.move.data, kind, afterStatus);
  } else {
    afterStatus();
  }
}

/** Resolve PP, accuracy, two-turn state, damage, healing/drain and rank effects. */
export function executeBattleMove(ctx: BattleMoveContext): void {
  const performMove = () => {
    const phase = beginMove(ctx.user, ctx.move);
    if (phase.consumePP) {
      ctx.user.useMove(ctx.move);
      for (let i = 0; i < extraPpCost(ctx.target); i++) ctx.user.useMove(ctx.move);
      ctx.onPpUsed?.();
    }
    ctx.showDialog(`${ctx.userLabel} used ${ctx.move.data.name}!`, () => {
    if (phase.phase === 'charge') {
      playChargeFX(ctx.scene, ctx.userSprite, ctx.move.data, 'charge', phase.mode!, () => {
        const msg = phase.mode === 'air' ? `${ctx.user.name} flew up high!`
          : phase.mode === 'underground' ? `${ctx.user.name} vanished from sight!`
            : `${ctx.user.name} began charging power!`;
        ctx.showDialog(msg, () => ctx.onComplete({ damage: 0, critical: false, effectiveness: 1, charged: true, missed: false }));
      });
      return;
    }

    const resolve = () => {
      if (blocksPowderMove(ctx.target, ctx.move.data)) {
        ctx.showDialog(`${ctx.target.name}'s Overcoat blocked the powder!`, () =>
          ctx.onComplete({ damage: 0, critical: false, effectiveness: 0, charged: false, missed: false }));
        return;
      }
      if (!canHit(ctx.user, ctx.target, ctx.move.data)) {
        ctx.showDialog(`${ctx.user.name}'s attack missed!`, () =>
          ctx.onComplete({ damage: 0, critical: false, effectiveness: 1, charged: false, missed: true }));
        return;
      }

      if (ctx.move.data.power > 0) {
        if (breaksUndergroundCharge(ctx.target, ctx.move.data)) {
          cancelCharge(ctx.scene, ctx.target, ctx.targetSprite);
        }
        const hpBeforeHit = ctx.target.hp;
        const hit = ctx.target.takeDamage(ctx.move, ctx.user);
        // Recoil and draining moves are based on damage actually removed, not
        // uncapped overkill damage from the raw damage formula.
        const damageDealt = Math.min(hpBeforeHit, hit.dmg);
        // Reactive abilities such as Cursed Body can alter the used move's PP
        // after impact; persist that final value for player-owned Pokémon.
        ctx.onPpUsed?.();
        if (ctx.target.isKO) cancelCharge(ctx.scene, ctx.target, ctx.targetSprite);
        playMoveFX(ctx.scene, ctx.userSprite, ctx.targetSprite, ctx.move.data, hit.effectiveness, () => ctx.animateTargetHp(() => {
          const fx = applyEffects(ctx.user, ctx.target, ctx.move.data, damageDealt);
          effectAnimation(ctx, fx, () => {
            const messages: string[] = [];
            if (hit.critical) messages.push('A critical hit!');
            if (hit.effectiveness > 1) messages.push('Super effective!');
            else if (hit.effectiveness > 0 && hit.effectiveness < 1) messages.push('Not very effective...');
            else if (hit.effectiveness === 0) messages.push('It had no effect!');
            messages.push(...hit.abilityMessages);
            messages.push(...fx.messages);
            showMessages(ctx, messages, () => ctx.onComplete({
              damage: damageDealt, critical: hit.critical, effectiveness: hit.effectiveness,
              charged: false, missed: false,
            }));
          });
        }));
        return;
      }

      const fx = applyEffects(ctx.user, ctx.target, ctx.move.data, 0);
      effectAnimation(ctx, fx, () => {
        const messages = fx.messages.length ? fx.messages : ['But it failed!'];
        showMessages(ctx, messages, () => ctx.onComplete({
          damage: 0, critical: false, effectiveness: 1, charged: false, missed: false,
        }));
      });
    };

    if (phase.phase === 'release') {
      playChargeFX(ctx.scene, ctx.userSprite, ctx.move.data, 'release', phase.mode!, resolve);
    } else {
      resolve();
    }
    });
  };

  const afterEntry = () => {
    const status = statusBeforeMove(ctx.user, ctx.target);
    const next = () => {
      if (status.blocked) {
        ctx.onComplete({ damage: 0, critical: false, effectiveness: 1, charged: false, missed: false });
      } else {
        performMove();
      }
    };
    if (status.messages.length) showMessages(ctx, status.messages, next);
    else next();
  };
  const entryMessages = activateEntryAbilities(ctx.user, ctx.target);
  if (entryMessages.length) showMessages(ctx, entryMessages, afterEntry);
  else afterEntry();
}
