import { getEffectiveness, PokemonType } from './TypeChart';
import { hpAfterMaxHpIncrease } from './LevelUpHp';
import type { BattleWeather } from '../systems/AbilitySystem';

export type MoveCategory = 'physical' | 'special' | 'status';
export type BattleStat = 'atk' | 'def' | 'spAtk' | 'spDef' | 'spd' | 'accuracy' | 'evasion';

export interface MoveStatChange {
  stat: BattleStat;
  change: number;
}

export interface MoveData {
  name: string;
  type: PokemonType;
  category: MoveCategory;
  power: number;
  accuracy: number;
  pp: number;
  /** Optional PokeAPI/bespoke effect metadata used by the shared move engine. */
  healing?: number;       // percent of the user's max HP
  drain?: number;         // percent of damage dealt restored to the user
  recoil?: number;        // percent of damage dealt taken by the user
  statChanges?: MoveStatChange[];
  effectTarget?: 'user' | 'target';
  effectChance?: number;
  twoTurn?: 'air' | 'underground' | 'charge';
  priority?: number;
  statusCondition?: string;
  statusChance?: number;
}

export interface Move {
  data: MoveData;
  pp: number;
}

export interface PokemonData {
  id: number;
  name: string;
  ability?: string;
  gender?: 'male' | 'female' | 'genderless';
  status?: string;
  type1: PokemonType;
  type2?: PokemonType;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpAtk: number;
  baseSpDef: number;
  baseSpd: number;
  spriteUrl: string;
  /** Real species height in decimetres (PokéAPI `height`). Drives battle display
   *  size so API Pokémon roughly track their real-world scale. Optional: custom
   *  species and older cached entries omit it. */
  heightDm?: number;
}

export class Pokemon {
  readonly data: PokemonData;
  private _level: number;
  readonly moves: Move[];

  maxHp = 0;
  hp = 0;
  atk = 0;
  def = 0;
  spAtk = 0;
  spDef = 0;
  spd = 0;
  exp = 0;
  status = 'none';
  /** Battle-held item key. Berries may clear this when consumed. */
  heldItem?: string;
  private flashFireBoosted = false;
  private toxicCounter = 0;
  private confusionTurns = 0;
  private infatuatedBy?: Pokemon;
  private infatuatedTargets = new Set<Pokemon>();
  private flinched = false;
  private seededBy?: Pokemon;
  private seededTargets = new Set<Pokemon>();
  private disabledMoves = new Map<string, number>();
  private stages: Record<BattleStat, number> = {
    atk: 0, def: 0, spAtk: 0, spDef: 0, spd: 0, accuracy: 0, evasion: 0,
  };

  get level() { return this._level; }

  constructor(data: PokemonData, level: number, moves: MoveData[]) {
    // Copy the species record: in-battle type mutations (Protean / Color Change /
    // Mimicry below) must never write back into the shared singleton definition,
    // which would permanently strip a species' typing — e.g. wiping a Ghost's
    // Normal-immunity for every later battle in the session.
    this.data = { ...data };
    this._level = Number.isFinite(level) ? Math.max(1, Math.min(100, Math.floor(level))) : 1;
    // Old saves and partially hydrated API Pokémon can contain an empty or
    // malformed curated move array. A selected Pokémon must still enter battle
    // safely; discard invalid records and provide one deterministic fallback.
    const validMoves = (Array.isArray(moves) ? moves : []).filter((move): move is MoveData =>
      !!move && typeof move.name === 'string' && move.name.trim().length > 0
      && typeof move.type === 'string'
      && ['physical', 'special', 'status'].includes(move.category)
      && Number.isFinite(move.power) && move.power >= 0
      && Number.isFinite(move.accuracy) && move.accuracy > 0
      && Number.isFinite(move.pp) && move.pp > 0);
    const safeMoves = validMoves.length ? validMoves : [{
      name: 'Tackle', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35,
    } satisfies MoveData];
    this.moves = safeMoves.slice(0, 4).map(m => ({ data: { ...m }, pp: m.pp }));
    this.status = data.status ?? 'none';
    this.recalcStats();
    this.hp = this.maxHp;
  }

  private recalcStats() {
    const l = this._level, d = this.data;
    // Divider 25 (instead of 100) makes base-stat differences meaningful at
    // low levels and keeps HP high enough that individual hits feel fair.
    this.maxHp  = Math.floor((d.baseHp    * l) / 25) + l + 10;
    this.atk    = Math.floor((d.baseAtk   * l) / 25) + 5;
    this.def    = Math.floor((d.baseDef   * l) / 25) + 5;
    this.spAtk  = Math.floor((d.baseSpAtk * l) / 25) + 5;
    this.spDef  = Math.floor((d.baseSpDef * l) / 25) + 5;
    this.spd    = Math.floor((d.baseSpd   * l) / 25) + 5;
  }

  /** EXP needed to reach the next level.
   *  level 5→6: 75   level 6→7: 108   level 7→8: 147  */
  expToNextLevel(): number {
    return this._level * this._level * 3;
  }

  /**
   * Add EXP. Returns true if a level-up occurred (may level up multiple times).
   * Caller should loop while gainExp returns true.
   */
  gainExp(amount: number): boolean {
    this.exp += amount;
    if (this.exp >= this.expToNextLevel()) {
      this.exp -= this.expToNextLevel();
      this.levelUp();
      return true;
    }
    return false;
  }

  levelUp(): number {
    const previousMaxHp = this.maxHp;
    this._level++;
    this.recalcStats();
    // Preserve damage across a level-up. The Pokémon gains only the newly
    // added max-HP points instead of being silently healed to full.
    this.hp = hpAfterMaxHpIncrease(this.hp, previousMaxHp, this.maxHp);
    return this._level;
  }

  get isKO() { return this.hp <= 0; }
  get name()  { return this.data.name; }
  get ability() { return this.data.ability ?? ''; }

  hasAbility(name: string): boolean {
    const wanted = name.toLowerCase().replace(/[-_]+/g, ' ').trim();
    return this.ability.split('/').some(part =>
      part.toLowerCase().replace(/[-_]+/g, ' ').trim() === wanted);
  }

  getStage(stat: BattleStat): number { return this.stages[stat]; }

  modifyStage(stat: BattleStat, amount: number): number {
    if (amount < 0) {
      if (stat === 'accuracy' && this.hasAbility('Keen Eye')) return 0;
      if (stat === 'spd' && this.hasAbility('Sure-Footed')) return 0;
      if (this.hasAbility('Firm Conviction')) return 0;
      if (this.hasAbility('Flower Veil') && this.data.type1 === 'grass') return 0;
    }
    const before = this.stages[stat];
    this.stages[stat] = Math.max(-6, Math.min(6, before + amount));
    return this.stages[stat] - before;
  }

  clearNegativeStages(): void {
    for (const stat of Object.keys(this.stages) as BattleStat[]) {
      if (this.stages[stat] < 0) this.stages[stat] = 0;
    }
  }

  /** Effective in-battle stat after standard Pokémon stage multipliers. */
  battleStat(stat: Exclude<BattleStat, 'accuracy' | 'evasion'>): number {
    const raw = this[stat];
    const stage = this.stages[stat];
    const multiplier = stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
    let result = raw * multiplier;
    if (stat === 'spd' && this.status === 'par' && !this.hasAbility('Quick Feet')) result *= 0.5;
    if (stat === 'spd' && this.status !== 'none' && this.hasAbility('Quick Feet')) result *= 1.5;
    if (stat === 'atk' && this.status !== 'none' && this.hasAbility('Guts')) result *= 1.5;
    else if (stat === 'atk' && this.status === 'brn') result *= 0.5;
    return Math.max(1, result);
  }

  /** Apply a persistent battle status while respecting type and ability
   * immunities. Corrosion belongs to the source, so it may poison Steel and
   * Poison targets just like the main-series games. */
  trySetStatus(condition: string, source?: Pokemon): boolean {
    const next = condition.toLowerCase();
    if (this.status !== 'none') return false;
    if (next === 'par' && (this.hasAbility('Limber') || this.data.type1 === 'electric' || this.data.type2 === 'electric')) return false;
    if (next === 'slp' && this.hasAbility('Insomnia')) return false;
    if (next === 'brn' && (this.data.type1 === 'fire' || this.data.type2 === 'fire')) return false;
    if (next === 'frz' && (this.data.type1 === 'ice' || this.data.type2 === 'ice')) return false;
    if ((next === 'psn' || next === 'tox') && !source?.hasAbility('Corrosion')
      && ['poison', 'steel'].some(t => this.data.type1 === t || this.data.type2 === t)) return false;
    this.status = next;
    this.toxicCounter = next === 'tox' ? 1 : 0;
    return true;
  }

  cureStatus(): boolean {
    if (this.status === 'none') return false;
    this.status = 'none';
    this.toxicCounter = 0;
    return true;
  }

  accuracyMultiplier(): number {
    const stage = this.stages.accuracy;
    return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
  }

  evasionMultiplier(): number {
    const stage = this.stages.evasion;
    return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
  }

  setHeldItem(item?: string): this {
    this.heldItem = item || undefined;
    return this;
  }

  heldItemActive(key?: string): boolean {
    if (!this.heldItem || this.hasAbility('Klutz')) return false;
    return key ? this.heldItem === key : true;
  }

  consumeHeldItem(): string | undefined {
    if (!this.heldItemActive()) return undefined;
    const item = this.heldItem;
    this.heldItem = undefined;
    return item;
  }

  confuse(turns = 2 + Math.floor(Math.random() * 4)): boolean {
    if (this.confusionTurns > 0) return false;
    this.confusionTurns = Math.max(1, turns);
    return true;
  }

  confusionStep(): 'none' | 'active' | 'ended' {
    if (this.confusionTurns <= 0) return 'none';
    this.confusionTurns--;
    return this.confusionTurns <= 0 ? 'ended' : 'active';
  }

  confusionDamage(): number {
    const raw = ((2 * this.level / 5 + 2) * 40 * (this.battleStat('atk') / this.battleStat('def')) / 50 + 1);
    const damage = Math.max(1, Math.floor(raw));
    const before = this.hp;
    this.hp = Math.max(0, this.hp - damage);
    return before - this.hp;
  }

  attract(source: Pokemon): boolean {
    if (this.infatuatedBy || this.data.gender === 'genderless' || source.data.gender === 'genderless'
      || !this.data.gender || !source.data.gender || this.data.gender === source.data.gender) return false;
    this.infatuatedBy = source;
    source.infatuatedTargets.add(this);
    return true;
  }

  isInfatuated(): boolean { return !!this.infatuatedBy && !this.infatuatedBy.isKO; }
  markFlinch(): void { this.flinched = true; }
  consumeFlinch(): boolean { const value = this.flinched; this.flinched = false; return value; }
  clearFlinch(): void { this.flinched = false; }

  disableMove(name: string, turns = 4): void {
    this.disabledMoves.set(name.toLowerCase(), Math.max(1, turns));
  }
  isMoveDisabled(name: string): boolean { return (this.disabledMoves.get(name.toLowerCase()) ?? 0) > 0; }
  tickDisabledMoves(): void {
    for (const [name, turns] of this.disabledMoves) {
      if (turns <= 1) this.disabledMoves.delete(name);
      else this.disabledMoves.set(name, turns - 1);
    }
  }

  seed(source: Pokemon): boolean {
    if (this.seededBy || this.data.type1 === 'grass' || this.data.type2 === 'grass') return false;
    this.seededBy = source;
    source.seededTargets.add(this);
    return true;
  }

  leechSeedSource(): Pokemon | undefined { return this.seededBy; }

  /** Leech Seed belongs to the seeder's side, so a replacement receives the
   * drain healing. Keeping the reverse links here also prevents a withdrawn
   * target from continuing to feed a benched object. */
  transferSeededTargetsTo(replacement: Pokemon): void {
    for (const target of this.seededTargets) {
      if (!target.isKO && target.seededBy === this) {
        target.seededBy = replacement;
        replacement.seededTargets.add(target);
      }
    }
    this.seededTargets.clear();
  }

  /** Standard end-turn major-status damage. Magic Guard prevents indirect damage. */
  takeResidualStatusDamage(): { damage: number; label?: string } {
    if (this.isKO || this.hasAbility('Magic Guard')) return { damage: 0 };
    let amount = 0;
    let label: string | undefined;
    if (this.status === 'brn') {
      amount = Math.max(1, Math.floor(this.maxHp / 16)); label = 'burn';
    } else if (this.status === 'psn') {
      amount = Math.max(1, Math.floor(this.maxHp / 8)); label = 'poison';
    } else if (this.status === 'tox') {
      amount = Math.max(1, Math.floor(this.maxHp * Math.max(1, this.toxicCounter) / 16));
      this.toxicCounter = Math.min(15, this.toxicCounter + 1); label = 'poison';
    }
    const before = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    return { damage: before - this.hp, label };
  }

  /** Switching clears volatile effects while preserving major status. */
  resetVolatileOnSwitch(): void {
    this.confusionTurns = 0;
    if (this.infatuatedBy) this.infatuatedBy.infatuatedTargets.delete(this);
    this.infatuatedBy = undefined;
    for (const target of this.infatuatedTargets) {
      if (target.infatuatedBy === this) target.infatuatedBy = undefined;
    }
    this.infatuatedTargets.clear();
    this.flinched = false;
    if (this.seededBy) this.seededBy.seededTargets.delete(this);
    this.seededBy = undefined;
    this.disabledMoves.clear();
    this.toxicCounter = this.status === 'tox' ? 1 : 0;
    for (const stat of Object.keys(this.stages) as BattleStat[]) this.stages[stat] = 0;
  }

  takeDamage(move: Move, attacker: Pokemon, weather: BattleWeather = 'clear'): { dmg: number; critical: boolean; effectiveness: number; abilityMessages: string[] } {
    const messages: string[] = [];
    let moveType = move.data.type;
    let abilityPower = 1;
    if (attacker.hasAbility('Protean') && moveType !== attacker.data.type1) {
      attacker.data.type1 = moveType; attacker.data.type2 = undefined;
      messages.push(`${attacker.name}'s Protean changed it to ${moveType} type!`);
    }
    if (attacker.hasAbility('Pixilate') && moveType === 'normal') {
      moveType = 'fairy'; abilityPower *= 1.2;
      messages.push(`${attacker.name}'s Pixilate turned the move into Fairy type!`);
    }

    let effectiveness = getEffectiveness(moveType, this.data.type1, this.data.type2);
    // Exact type immunities and absorbing abilities resolve before damage.
    // Flying types are categorically immune to Ground moves — enforce it explicitly
    // (belt-and-suspenders over the type chart) so nothing, e.g. a mis-built form or
    // a stray effectiveness rounding, can ever let an Earthquake through on a flyer.
    // Grounding effects (Roost / Smack Down / Gravity) are not modelled here.
    if (moveType === 'ground' && (this.data.type1 === 'flying' || this.data.type2 === 'flying')) {
      return { dmg: 0, critical: false, effectiveness: 0, abilityMessages: messages };
    }
    // Ghost types are categorically immune to Normal and Fighting moves — enforce it
    // explicitly (belt-and-suspenders over the type chart) so nothing, e.g. a stray
    // effectiveness path, can ever let a Tackle chip a Ghost like Onnurian (학동자).
    if ((moveType === 'normal' || moveType === 'fighting')
      && !attacker.hasAbility('Scrappy')
      && (this.data.type1 === 'ghost' || this.data.type2 === 'ghost')) {
      return { dmg: 0, critical: false, effectiveness: 0, abilityMessages: messages };
    }
    if (moveType === 'ground' && this.hasAbility('Levitate')) {
      messages.push(`${this.name} is immune through Levitate!`);
      return { dmg: 0, critical: false, effectiveness: 0, abilityMessages: messages };
    }
    if (moveType === 'water' && this.hasAbility('Water Absorb')) {
      const before = this.hp; this.heal(Math.max(1, Math.floor(this.maxHp / 4)));
      messages.push(`${this.name}'s Water Absorb restored ${this.hp - before} HP!`);
      return { dmg: 0, critical: false, effectiveness: 0, abilityMessages: messages };
    }
    if (moveType === 'electric' && this.hasAbility('Volt Absorb')) {
      const before = this.hp; this.heal(Math.max(1, Math.floor(this.maxHp / 4)));
      messages.push(`${this.name}'s Volt Absorb restored ${this.hp - before} HP!`);
      return { dmg: 0, critical: false, effectiveness: 0, abilityMessages: messages };
    }
    if (moveType === 'electric' && this.hasAbility('Lightning Rod')) {
      this.modifyStage('spAtk', 1);
      messages.push(`${this.name}'s Lightning Rod nullified the attack and raised Sp. Atk!`);
      return { dmg: 0, critical: false, effectiveness: 0, abilityMessages: messages };
    }
    if (moveType === 'fire' && this.hasAbility('Flash Fire')) {
      this.flashFireBoosted = true;
      messages.push(`${this.name}'s Flash Fire absorbed the flames!`);
      return { dmg: 0, critical: false, effectiveness: 0, abilityMessages: messages };
    }

    const critRate = attacker.hasAbility('Merciless') && (this.status === 'psn' || this.status === 'tox')
      ? 1 : attacker.hasAbility('Fate Weaver') ? 0.125 : 0.0625;
    const blocksCritical = this.hasAbility('Battle Armor') || this.hasAbility('Shell Armor');
    const isCritical = effectiveness > 0 && !blocksCritical && Math.random() < critRate;
    const critical = isCritical ? 1.5 : 1;
    const atk = move.data.category === 'special' ? attacker.battleStat('spAtk') : attacker.battleStat('atk');
    const def = move.data.category === 'special' ? this.battleStat('spDef') : this.battleStat('def');
    const hasStab = moveType === attacker.data.type1 || moveType === attacker.data.type2;
    const stab = hasStab ? (attacker.hasAbility('Adaptability') ? 2 : 1.5) : 1;

    const lowHp = attacker.hp <= Math.floor(attacker.maxHp / 3);
    const pinchBoost = (moveType === 'grass' && attacker.hasAbility('Overgrow'))
      || (moveType === 'fire' && attacker.hasAbility('Blaze'))
      || (moveType === 'water' && attacker.hasAbility('Torrent'))
      || (moveType === 'bug' && attacker.hasAbility('Swarm'));
    if (lowHp && pinchBoost) {
      abilityPower *= 1.5;
      messages.push(`${attacker.name}'s ${attacker.ability} powered up the move!`);
    }
    if (attacker.hasAbility('Technician') && move.data.power > 0 && move.data.power <= 60) abilityPower *= 1.5;
    if (attacker.hasAbility('Tough Claws') && isContactMove(move.data)) abilityPower *= 1.3;
    if (attacker.hasAbility('Iron Fist') && isPunchMove(move.data.name)) abilityPower *= 1.2;
    if (attacker.hasAbility('Sheer Force') && (move.data.statChanges?.length || (move.data.effectChance ?? 100) < 100)) abilityPower *= 1.3;
    if (attacker.hasAbility('Heavenly Descent') && (moveType === 'flying' || moveType === 'psychic')) abilityPower *= 1.2;
    if (attacker.hasAbility('Nosemic Power') && (moveType === 'rock' || moveType === 'psychic')) abilityPower *= 1.2;
    if (attacker.hasAbility('Guardian Spirit') && (moveType === 'ghost' || moveType === 'fighting')) abilityPower *= 1.2;
    if (attacker.hasAbility('Ancient Activation')) abilityPower *= 1.2;
    if (attacker.hasAbility('Rivalry') && attacker.data.gender && this.data.gender
      && attacker.data.gender !== 'genderless' && this.data.gender !== 'genderless') {
      abilityPower *= attacker.data.gender === this.data.gender ? 1.25 : 0.75;
    }
    if (attacker.flashFireBoosted && moveType === 'fire') abilityPower *= 1.5;

    const weatherSuppressed = attacker.hasAbility('Cloud Nine') || this.hasAbility('Cloud Nine');
    if (!weatherSuppressed && weather === 'rain') {
      if (moveType === 'water') abilityPower *= 1.5;
      if (moveType === 'fire') abilityPower *= 0.5;
    }
    if (!weatherSuppressed && weather === 'sun') {
      if (moveType === 'fire') abilityPower *= 1.5;
      if (moveType === 'water') abilityPower *= 0.5;
    }
    if (!weatherSuppressed && attacker.hasAbility('Sand Force')
      && weather === 'sand'
      && ['rock', 'ground', 'steel'].includes(moveType)) abilityPower *= 1.3;
    const heldTypeBoost: Partial<Record<PokemonType, string>> = {
      fire: 'charcoal', water: 'mysticwater', grass: 'miracleseed', electric: 'magnet',
    };
    if (heldTypeBoost[moveType] && attacker.heldItemActive(heldTypeBoost[moveType])) abilityPower *= 1.2;
    if (attacker.heldItemActive('expertbelt') && effectiveness > 1) abilityPower *= 1.2;

    let defenseAbility = 1;
    if (this.hasAbility('Thick Fat') && (moveType === 'fire' || moveType === 'ice')) defenseAbility *= 0.5;
    if (this.hasAbility('Multiscale') && this.hp === this.maxHp) defenseAbility *= 0.5;
    if (this.hasAbility('Solid Rock') && effectiveness > 1) defenseAbility *= 0.75;
    if (this.hasAbility('Resilience') && this.hp <= this.maxHp / 2) defenseAbility *= 0.85;
    if (this.hasAbility('Friend Guard')) defenseAbility *= 0.9;
    if (!weatherSuppressed && weather === 'snow'
      && (this.data.type1 === 'ice' || this.data.type2 === 'ice') && move.data.category === 'physical') defenseAbility *= 2 / 3;
    if (!weatherSuppressed && weather === 'sand'
      && (this.data.type1 === 'rock' || this.data.type2 === 'rock') && move.data.category === 'special') defenseAbility *= 2 / 3;

    // Constant reduced from +2 → +1 so the floor term doesn't dominate
    // at low levels when atk/def stats are small.
    let dmg = move.data.power === 0 || effectiveness === 0 ? 0 : Math.max(1, Math.floor(
      ((2 * attacker.level / 5 + 2) * move.data.power * (atk / def) / 50 + 1)
      * stab * effectiveness * critical * abilityPower * defenseAbility
    ));

    const fullHp = this.hp === this.maxHp;
    if (fullHp && dmg >= this.hp && this.hasAbility('Sturdy')) {
      dmg = Math.max(0, this.hp - 1);
      messages.push(`${this.name} endured the hit with Sturdy!`);
    }

    this.hp = Math.max(0, this.hp - dmg);
    if (dmg > 0 && moveType === 'water' && this.hasAbility('Water Compaction')) {
      this.modifyStage('def', 2);
      messages.push(`${this.name}'s Water Compaction sharply raised Defense!`);
    }
    if (dmg > 0 && moveType === 'dark' && (this.hasAbility('Justified') || this.hasAbility('Heart of Justice'))) {
      this.modifyStage('atk', 1);
      messages.push(`${this.name}'s ${this.ability} raised Attack!`);
    }
    if (dmg > 0 && (this.hasAbility('Color Change') || this.hasAbility('Mimicry'))) {
      this.data.type1 = moveType; this.data.type2 = undefined;
      messages.push(`${this.name} changed to ${moveType} type!`);
    }
    if (dmg > 0 && this.hasAbility('Cursed Body') && Math.random() < 0.3) {
      attacker.disableMove(move.data.name, 4);
      messages.push(`${this.name}'s Cursed Body disabled ${move.data.name}!`);
    }
    if (dmg > 0 && isContactMove(move.data)) {
      if (this.hasAbility('Static') && Math.random() < 0.3) {
        if (attacker.trySetStatus('par', this)) messages.push(`${attacker.name} was paralyzed by Static!`);
      }
      if (this.hasAbility('Flame Body') && Math.random() < 0.3) {
        if (attacker.trySetStatus('brn', this)) messages.push(`${attacker.name} was burned by Flame Body!`);
      }
      if (this.hasAbility('Poison Point') && Math.random() < 0.3) {
        if (attacker.trySetStatus('psn', this)) messages.push(`${attacker.name} was poisoned by Poison Point!`);
      }
      if (this.hasAbility('Effect Spore') && Math.random() < 0.3) {
        const sporeStatus = (['par', 'psn', 'slp'] as const)[Math.floor(Math.random() * 3)];
        if (attacker.trySetStatus(sporeStatus, this)) messages.push(`${attacker.name} was afflicted by Effect Spore!`);
      }
      if (this.hasAbility('Cute Charm') && Math.random() < 0.3) {
        if (attacker.attract(this)) messages.push(`${attacker.name} fell in love through Cute Charm!`);
      }
    }
    if (dmg > 0 && attacker.hasAbility('Stench') && Math.random() < 0.1) {
      this.markFlinch(); messages.push(`${this.name} flinched from Stench!`);
    }
    return { dmg, critical: isCritical, effectiveness, abilityMessages: messages };
  }

  useMove(move: Move): boolean {
    if (move.pp <= 0) return false;
    move.pp--;
    return true;
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }
}

function isPunchMove(name: string): boolean {
  return /punch|meteor mash|hammer arm|ice hammer|plasma fists/i.test(name);
}

function isContactMove(move: MoveData): boolean {
  if (move.category !== 'physical') return false;
  return !/rock throw|rock slide|stone edge|earthquake|bulldoze|magnitude|bonemerang|icicle spear|razor leaf/i.test(move.name);
}
