import Phaser from 'phaser';
import { pushBgm, popBgm, stopBgm, playJingle } from '../systems/Music';
import { expMultiplierFor } from '../data/NorthernRegion';
import {
  deckShowBattleActions, deckHideBattleActions, deckShowMoves, deckHideMoves, deckSetBattleMode,
} from '../systems/TouchControls';
import { executeBattleMove, pendingMoveFor } from '../systems/MoveEffects';
import { battle2DSpriteScale } from '../data/SpriteScale';
import { performanceProfile } from '../engine3d/PerformanceProfile';
import { HWANGEUM_FRAMES, hwangeumFramesReady, playHwangeumIntro, preloadHwangeumFrames, throwChampionBall } from '../systems/HwangeumIntro2D';
import { runLevelUpLearning, runBenchLevelUpLearning } from '../systems/MoveLearning';
import type { BenchLevelUp } from '../systems/BattleExp';
import { Pokemon, Move, MoveData } from '../battle/Pokemon';
import { STARTERS, findForm } from '../data/StarterData';
import { fetchPokemon } from '../data/PokeAPI';
import { customForm } from '../data/CustomBattle';
import { SIGNATURE_MOVE_BY_SPECIES } from '../data/SignatureMoves';
import { PartySystem } from '../systems/PartySystem';
import { blackoutToCenter, blackoutMessage } from '../systems/Blackout';
import { tr, pokeNameEn} from '../systems/i18n';
import { fontScaleForScene } from '../systems/UiScale';
import { awardBenchExp } from '../systems/BattleExp';
import { buildFromEntry, buildReplacement, ensurePartyTexture, persistMovePP, persistSwitchOut, transferReplacementState } from '../systems/PartyBattle';
import { deLegendify } from '../data/Legendaries';
import { openSwitchPanel } from '../systems/SwitchPanel';
import { portraitFor, fitPortrait } from '../data/BattlePortraits';
import { trainerClassPortrait } from '../data/TrainerClassPortrait';
import { AVATAR_URL, rivalAvatarKey } from '../data/PlayerAvatar';
import { DexTracker } from '../systems/DexTracker';
import { Inventory, formatMoney, ITEMS, useItemOnSlot, itemDef, itemName } from '../systems/Items';
import { tmForMove } from '../data/TMs';
import { SaveManager } from '../utils/SaveManager';
import { playBallSendOut } from '../systems/BattleBallFX';
import { genderedName } from '../data/PokemonGender';
import { actsBefore, battleWeather } from '../systems/AbilitySystem';
import { enemyLearnset, mergeLearnset } from '../data/Learnsets';
import { BattleStatusBadge } from '../systems/BattleStatusBadge';
import { showRewardCeremony } from '../systems/RewardCeremony';
import { createBattleHud, hpColor, modernButton, modernMoveButton, syncBattleHudTypes, type BattleHud } from '../systems/ProductionUi';
import { animateBattleHp, BATTLE_PACING, snapBattleHp } from '../systems/BattlePacing';
import { BossPotionAI, type BossTrainerRank, type BossPotionUse } from '../systems/BossTrainerItems';
import { playBattleEndTurn } from '../systems/BattleEndTurn';
import { chooseBattleMove } from '../systems/BattleAI';

// ── Enemy movesets ──────────────────────────────────────────────────────────
// Strong authored move data is reserved for Elite Four / Champion teams below.
// Ordinary trainers use the shared level-gated learnset imported above.
const mv = (name: string, type: string, category: 'physical' | 'special', power: number, accuracy = 100, pp = 10): MoveData =>
  ({ name, type: type as MoveData['type'], category, power, accuracy, pp });

const TYPE_MOVES: Record<string, MoveData[]> = {
  normal:   [mv('Body Slam', 'normal', 'physical', 85, 100, 15), mv('Hyper Beam', 'normal', 'special', 95, 90, 5)],
  fire:     [mv('Flamethrower', 'fire', 'special', 90, 100, 15), mv('Fire Blast', 'fire', 'special', 95, 85, 5)],
  water:    [mv('Surf', 'water', 'special', 90, 100, 15), mv('Hydro Pump', 'water', 'special', 95, 80, 5)],
  grass:    [mv('Energy Ball', 'grass', 'special', 90, 100, 10), mv('Leaf Blade', 'grass', 'physical', 90, 100, 15)],
  electric: [mv('Thunderbolt', 'electric', 'special', 90, 100, 15), mv('Thunder', 'electric', 'special', 95, 70, 10)],
  ice:      [mv('Ice Beam', 'ice', 'special', 90, 100, 10), mv('Blizzard', 'ice', 'special', 95, 70, 5)],
  fighting: [mv('Close Combat', 'fighting', 'physical', 95, 100, 5), mv('Brick Break', 'fighting', 'physical', 75, 100, 15)],
  poison:   [mv('Sludge Bomb', 'poison', 'special', 90, 100, 10), mv('Poison Jab', 'poison', 'physical', 80, 100, 20)],
  ground:   [mv('Earthquake', 'ground', 'physical', 95, 100, 10), mv('Earth Power', 'ground', 'special', 90, 100, 10)],
  flying:   [{ ...mv('Brave Bird', 'flying', 'physical', 95, 100, 15), recoil: 33 }, mv('Air Slash', 'flying', 'special', 85, 95, 15)],
  psychic:  [mv('Psychic', 'psychic', 'special', 90, 100, 10), mv('Psyshock', 'psychic', 'special', 80, 100, 10)],
  bug:      [mv('Bug Buzz', 'bug', 'special', 90, 100, 10), mv('X-Scissor', 'bug', 'physical', 80, 100, 15)],
  rock:     [mv('Stone Edge', 'rock', 'physical', 95, 80, 5), mv('Rock Slide', 'rock', 'physical', 85, 90, 10)],
  ghost:    [mv('Shadow Ball', 'ghost', 'special', 90, 100, 15), mv('Shadow Claw', 'ghost', 'physical', 80, 100, 15)],
  dragon:   [mv('Draco Meteor', 'dragon', 'special', 95, 90, 5), mv('Dragon Pulse', 'dragon', 'special', 85, 100, 10)],
  dark:     [mv('Dark Pulse', 'dark', 'special', 85, 100, 15), mv('Crunch', 'dark', 'physical', 80, 100, 15)],
  steel:    [mv('Flash Cannon', 'steel', 'special', 85, 100, 10), mv('Iron Head', 'steel', 'physical', 80, 100, 15)],
  fairy:    [mv('Moonblast', 'fairy', 'special', 95, 100, 10), mv('Dazzling Gleam', 'fairy', 'special', 80, 100, 10)],
};
const FALLBACK_MOVE: MoveData = mv('Tackle', 'normal', 'physical', 40, 100, 35);

// Off-type "coverage" move for each type — chosen to threaten the things that
// usually counter that type (e.g. Steel → Earthquake to punish Fire/Electric/Steel
// switch-ins). Used to make the Elite Four + Champion hard to exploit one weakness.
// Earthquake is deliberately limited to ~half the types (the natural EdgeQuake /
// anti-Steel users: steel, poison, rock) so the Elite Four / Champion aren't all
// carrying the same ground move; the rest get distinct, type-appropriate coverage.
const COVERAGE_BY_TYPE: Record<string, MoveData> = {
  steel:    mv('Earthquake', 'ground', 'physical', 95, 100, 10),
  ice:      mv('Focus Blast', 'fighting', 'special', 95, 70, 5),
  flying:   mv('Ice Beam', 'ice', 'special', 90, 100, 10),
  psychic:  mv('Focus Blast', 'fighting', 'special', 95, 70, 5),
  dragon:   mv('Fire Blast', 'fire', 'special', 95, 85, 5),
  electric: mv('Ice Beam', 'ice', 'special', 90, 100, 10),
  ghost:    mv('Focus Blast', 'fighting', 'special', 95, 70, 5),
  fire:     mv('Energy Ball', 'grass', 'special', 90, 100, 10),
  water:    mv('Ice Beam', 'ice', 'special', 90, 100, 10),
  grass:    mv('Ice Beam', 'ice', 'special', 90, 100, 10),
  fighting: mv('Stone Edge', 'rock', 'physical', 95, 80, 5),
  poison:   mv('Earthquake', 'ground', 'physical', 95, 100, 10),
  ground:   mv('Stone Edge', 'rock', 'physical', 95, 80, 5),
  rock:     mv('Earthquake', 'ground', 'physical', 95, 100, 10),
  bug:      mv('Rock Slide', 'rock', 'physical', 85, 90, 10),
  dark:     mv('Sludge Bomb', 'poison', 'special', 90, 100, 10),
  fairy:    mv('Flamethrower', 'fire', 'special', 90, 100, 10),
  normal:   mv('Brick Break', 'fighting', 'physical', 75, 100, 15),
};

/** Elite Four / Champion kit: STAB + off-type coverage so a single super-effective
 *  matchup can't sweep them (dual-types get 2 STAB + 2 coverage). */
function eliteMovesForTypes(t1?: string, t2?: string, speciesKey?: string): MoveData[] {
  const moves: MoveData[] = [];
  const add = (m?: MoveData) => { if (m && !moves.some(x => x.name === m.name)) moves.push(m); };
  // A species with a signature move always leads with it — e.g. Hwangeum's
  // Thanatoat (두루광) keeps 혼백도강 (Soul-Ferry Deluge) in its elite kit.
  if (speciesKey) add(SIGNATURE_MOVE_BY_SPECIES[speciesKey]);
  if (t1) add(TYPE_MOVES[t1]?.[0]);
  if (t2) add(TYPE_MOVES[t2]?.[0]);
  if (t1) add(COVERAGE_BY_TYPE[t1]);
  if (t2) add(COVERAGE_BY_TYPE[t2]); else if (t1) add(TYPE_MOVES[t1]?.[1]);
  if (!moves.length) add(FALLBACK_MOVE);
  // Top up to 4 with strong neutral coverage if anything was a duplicate.
  add(TYPE_MOVES.normal[0]);
  return moves.slice(0, 4);
}

type State = 'loading' | 'intro' | 'playerAction' | 'playerMove' | 'bag' | 'busy' | 'over';
const HP_W = 180;
const ENEMY_STAGE_X = 560;
const ENEMY_STAGE_Y = 130;

export class TrainerBattleScene extends Phaser.Scene {
  private player!: Pokemon;
  private enemy!: Pokemon;
  private trainerName   = 'Trainer';
  private trainerKey    = '';
  private activeSlot    = 0;
  private participants  = new Set<number>([0]);   // slots that battled → all gain EXP
  private _returnScene  = 'RouteScene';  // filled from registry in create()
  private enemyQueue: { id: number; level: number; custom?: string }[] = [];
  private enemyIdx = 0;
  // A faint/EXP sequence is asynchronous. Keep it from advancing the roster
  // twice if two delayed callbacks finish on the same frame (which previously
  // allowed Byeoksan's Balchataek slot to be jumped over).
  private advancingEnemy = false;
  private battleTurn = 1;
  private lastEnemyMove = '';
  private awaitingForcedSwitch = false;
  private totalExp = 0;
  private state: State = 'loading';
  // Gym-leader reward (snapshotted at create so it can't leak to later battles)
  private badgeFlag = '';
  private badgeName = '';
  private badgeTM   = '';
  private winLine   = '';
  private bossPotionAI?: BossPotionAI;

  private dialogText!: Phaser.GameObjects.Text;
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private hpW = HP_W;   // actual bar width — widened on mobile to fill the enlarged name box
  private playerHpText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
  private playerLvText!: Phaser.GameObjects.Text;
  private playerNameText!: Phaser.GameObjects.Text;
  private enemyLvText!: Phaser.GameObjects.Text;
  private enemyNameText!: Phaser.GameObjects.Text;
  private playerStatusBadge?: BattleStatusBadge;
  private enemyStatusBadge?: BattleStatusBadge;
  private playerBattleHud?: BattleHud;
  private enemyBattleHud?: BattleHud;
  private enemySprite!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Image;
  private trainerPortrait?: Phaser.GameObjects.Image;
  /** True when the Champion's hand-posed 2D frames are driving his entrance. */
  private hwangeum2D = false;
  private stopHwangeumIntro?: () => void;
  private actionPanel!: Phaser.GameObjects.Container;
  private movePanel!: Phaser.GameObjects.Container;
  private bagPanel!: Phaser.GameObjects.Container;
  private spaceKey!: Phaser.Input.Keyboard.Key;

  private W = 1280;
  private H = 720;

  constructor() { super('TrainerBattleScene'); }

  preload() {
    // The Champion's hand-posed entrance frames. Queued only for his battle, so
    // no other trainer pays for them.
    // Read the registry, not this.trainerKey: that field is assigned in create(),
    // which runs after preload(), so the guard would never have fired.
    if (this.registry.get('trainerKey') === 'champion-hwangeum') preloadHwangeumFrames(this);
    const queued = new Set<string>();
    STARTERS.forEach(s => {
      if (!this.textures.exists(s.spriteKey) && !queued.has(s.spriteKey)) {
        this.load.image(s.spriteKey, s.data.spriteUrl);
        queued.add(s.spriteKey);
      }
    });
    // Load sprites for the whole party so any lead Pokémon renders correctly.
    PartySystem.get(this.registry).forEach(e => {
      if (e.spriteKey && e.spriteUrl && !this.textures.exists(e.spriteKey) && !queued.has(e.spriteKey)) {
        this.load.image(e.spriteKey, e.spriteUrl);
        queued.add(e.spriteKey);
      }
    });
  }

  async create() {
    this.cameras.main.fadeIn(350);
    this.trainerName = (this.registry.get('trainerName')     as string) ?? 'Trainer';
    this.trainerKey  = (this.registry.get('trainerKey')      as string) ?? 'trainer';
    this.totalExp    = (this.registry.get('trainerExpPool')  as number) ?? 30;
    // Which scene to return to after the battle (route or gym)
    this._returnScene = (this.registry.get('trainerReturnScene') as string) ?? 'RouteScene';
    const raw = this.registry.get('trainerPokemon') ?? '[]';
    let decodedTeam: unknown = [];
    try { decodedTeam = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch (error) { console.error('[TrainerBattle] Invalid trainer roster.', error); }
    this.enemyQueue = (Array.isArray(decodedTeam) ? decodedTeam : []) as { id: number; level: number; custom?: string }[];
    this.enemyQueue = this.enemyQueue
      // Guard: ordinary trainers never field a box-legendary — swap any for a strong
      // non-legendary. (Custom species are untouched.)
      .map(e => e.custom ? e : { ...e, id: deLegendify(e.id) });
    // Reset per-battle state: Phaser reuses the scene instance across scene.start(),
    // so these instance fields persist from the previous battle. Without this, a
    // trainer fought after another multi-Pokémon trainer loses Pokémon equal to the
    // previous team's size (e.g. Director Suri only sending out 1 after Commander Ryeo).
    this.enemyIdx = 0;
    this.advancingEnemy = false;
    this.battleTurn = 1;
    this.lastEnemyMove = '';
    this.awaitingForcedSwitch = false;
    this.activeSlot = 0;
    this.participants = new Set<number>([0]);

    // Snapshot any gym-leader reward, then clear the keys so a later plain
    // trainer battle never inherits a stale badge.
    this.badgeFlag = (this.registry.get('trainerBadgeFlag') as string) ?? '';
    this.badgeName = (this.registry.get('trainerBadgeName') as string) ?? '';
    this.badgeTM   = (this.registry.get('trainerBadgeTM')   as string) ?? '';
    this.winLine   = (this.registry.get('trainerWinLine')   as string) ?? '';
    const bossRank: BossTrainerRank | undefined = this.trainerKey.startsWith('champion-')
      || this.trainerKey.startsWith('north-taewang') ? 'champion'
      : this.trainerKey.startsWith('e4-') || this.trainerKey.startsWith('north-') ? 'elite'
        : this.badgeFlag ? 'gym' : undefined;
    this.bossPotionAI = bossRank ? new BossPotionAI(bossRank) : undefined;
    this.registry.set('trainerBadgeFlag', '');
    this.registry.set('trainerBadgeName', '');
    this.registry.set('trainerBadgeTM', '');
    this.registry.set('trainerWinLine', '');

    // Pick the battle theme by opponent, then restore the ambient track on exit.
    const k = this.trainerKey;
    let track = 'trainer';
    if (this.badgeName)                 track = 'gymleader';   // any of the 8 gym leaders
    else if (k.startsWith('rival'))     track = 'rival';       // rival showdowns (Geumgang etc.)
    else if (k.includes('sovereign'))   track = 'sovereign';  // 노스단 Sovereign-Claimant (post-game final)
    else if (k.startsWith('eosa-'))     track = 'eosa';        // 어사대장 exams (northern 마패 circuit)
    else if (k.includes('ryeo'))        track = 'suri';       // Commander Ryeo (Team Suri / Jeju finale)
    else if (k.includes('nosdan'))      track = 'groupnorth'; // 노스단 (Group North)
    else if (k.includes('suri'))        track = 'suri';       // Team Suri
    else if (k.startsWith('north-taewang')) track = 'taewang';   // Northern Champion
    else if (k.startsWith('north-'))    track = 'northelite';  // Northern League Elite Four
    else if (k.startsWith('champion'))  track = 'champion';    // Champion Hwangeum
    else if (k.startsWith('e4-'))       track = 'elitefour';   // Onnuri League Elite Four
    pushBgm(this, track);
    deckSetBattleMode(true);   // battle is touch-only: hide the walking stick + A/B
    this.events.once('shutdown', () => { deckSetBattleMode(false); popBgm(this); deckHideBattleActions(); deckHideMoves(); });

    this.drawBackground();
    this.createDialogBox();
    this.typeDialog('Loading…');
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    // Open party/bag menu anytime
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => this.scene.launch('MenuScene'));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => this.scene.launch('MenuScene'));

    await this.loadPlayerPokemon();
    await this.loadEnemyPokemon(0);
    this.buffBoss();   // 우두머리 bosses get extra HP

    // Load this trainer's battle portrait (shown only during the intro).
    const portrait = this.resolvePortrait();
    if (portrait && !this.textures.exists(portrait.key)) {
      this.load.image(portrait.key, portrait.url);
      await new Promise<void>(r => { this.load.once('complete', r); this.load.start(); });
    }

    // Guarantee the lead's sprite texture is loaded before we build the battler.
    // A party entry can lose its spriteUrl after an evolution/restore, which made
    // preload() skip it (its guard requires a truthy spriteUrl) and left the
    // Pokémon invisible in battle (e.g. an evolved 염흥왕/Pipetiger). ensurePartyTexture
    // re-derives the URL from the species form.
    const lead = PartySystem.get(this.registry)[this.activeSlot];
    if (lead) await ensurePartyTexture(this, lead);

    this.createSprites();
    this.createHUDs();
    this.createActionPanel();
    this.createMovePanel();
    this.createBagPanel();
    this.hideAllPanels();

    // Intro. Send the enemy out, then lead with the player.
    this.enemySprite.setAlpha(0);
    this.dialogText.setText('');   // clear the "Loading…" text so the portrait hold reads clean
    const leadPlayer = () => playBallSendOut(this, this.playerSprite, {
      side: 'player', targetX: 180, targetY: 260,
      onComplete: () => this.typeDialog(`Go! ${pokeNameEn(this.player.name).toUpperCase()}!`, () => this.playerAction()),
    });
    const sendOut = () => {
      if (this.trainerPortrait) this.tweens.add({ targets: this.trainerPortrait, alpha: 0, duration: 300 });
      // A 우두머리 is a WILD Pokémon — it does not emerge from a trainer's ball.
      if (this.isWildBoss) {
        this.revealWildBoss(() =>
          this.typeDialog(`A wild ${pokeNameEn(this.enemy.name).toUpperCase()} appeared!`, leadPlayer));
        return;
      }
      playBallSendOut(this, this.enemySprite, {
        side: 'enemy', targetX: ENEMY_STAGE_X, targetY: ENEMY_STAGE_Y,
        // The Champion's 3D routine already threw a real ball across the arena;
        // drawing the flat one on top would show two balls for one send-out.
        // The Champion already threw a real ball across the arena — in 3D, or as
        // his own 2D frames. Drawing the flat one on top would show two balls
        // for one send-out.
        skipBall: (this.isChampionHwangeum && this.using3D) || this.hwangeum2D,
        onComplete: () => this.typeDialog(`${this.trainerName} sent out ${pokeNameEn(this.enemy.name).toUpperCase()}!`, leadPlayer),
      });
    };
    // Hold the trainer's portrait on screen for ~3s before the Pokémon come out. Rival
    // showdowns already made their challenge in the overworld, so they skip the
    // "wants to battle!" card; everyone else still gets it.
    if (this.trainerPortrait) this.tweens.add({ targets: this.trainerPortrait, alpha: 1, duration: 300 });
    if (!this.trainerKey.startsWith('rival')) this.typeDialog(`${this.trainerName} wants to battle!`);

    if (this.hwangeum2D && this.trainerPortrait) {
      // Dance, then throw — on his own artwork. The send-out is fired from the
      // release frame itself rather than a fixed delay, so the Pokémon always
      // emerges exactly when the ball leaves his hand no matter how the routine
      // is retimed later.
      const portrait = this.trainerPortrait;
      this.time.delayedCall(420, () => {
        if (!portrait.scene) return;
        this.stopHwangeumIntro = playHwangeumIntro(this, portrait, {
          onRelease: () => {
            // Launch from his hand, not the middle of the picture: on the release
            // frame the ball is up and to his right.
            throwChampionBall(this,
              portrait.x + portrait.displayWidth * 0.17,
              portrait.y - portrait.displayHeight * 0.20,
              ENEMY_STAGE_X, ENEMY_STAGE_Y, () => sendOut());
          },
        });
      });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopHwangeumIntro?.());
      return;
    }
    // The Champion's 3D routine releases the ball at 3.50s and it lands ~0.30s
    // later. Fire the send-out to coincide with that landing so the Pokémon
    // emerges FROM the ball it was thrown in, instead of appearing a beat after
    // the ball has already opened and faded.
    this.time.delayedCall(this.isChampionHwangeum && this.using3D ? 3780 : 3000, sendOut);
  }

  // ── Pokémon loading ───────────────────────────────────────────────────────

  private async loadPlayerPokemon() {
    PartySystem.syncSlot0FromStarter(this.registry);
    const party = PartySystem.get(this.registry);
    // Lead with the first NON-fainted Pokémon so a fainted lead never enters battle.
    this.activeSlot = Math.max(0, party.findIndex(e => e && e.hp > 0));
    if (party.length > 0) {
      this.player = buildFromEntry(party[this.activeSlot]);
      this.participants = new Set<number>([this.activeSlot]);
    } else {
      const key   = (this.registry.get('starterKey')   as string) ?? 'vipour';
      const level = (this.registry.get('starterLevel') as number) ?? 5;
      const def   = findForm(key) ?? STARTERS[1];
      this.player = new Pokemon(def.data, level,
        mergeLearnset(def.startingMoves, def.spriteKey, def.data.type1, def.data.type2, level));
      this.player.exp = (this.registry.get('starterExp') as number) ?? 0;
    }
  }

  private async loadEnemyPokemon(idx: number) {
    const entry = this.enemyQueue[idx];
    if (!entry) return;

    // Custom-species enemy (e.g. a gym leader's signature or a rival's starter).
    if (entry.custom) {
      const form = customForm(entry.custom);
      if (form) {
        DexTracker.markSeen(this.registry, form.data.id);
        const texKey = entry.custom;  // custom sprite keys double as texture keys
        if (!this.textures.exists(texKey)) {
          this.load.image(texKey, form.data.spriteUrl);
          await new Promise<void>(r => { this.load.once('complete', r); this.load.start(); });
        }
        // Ordinary trainers follow the same gradual move progression as the
        // player. Elite teams retain their authored high-level coverage kits.
        this.enemy = new Pokemon(form.data, entry.level,
          this.isElite
            ? eliteMovesForTypes(form.data.type1, form.data.type2, entry.custom)
            : enemyLearnset(form.moves, texKey, form.data.type1, form.data.type2, entry.level));
        this.registry.set('_teKey', texKey);
        return;
      }
      // Starter / evolved-starter forms (munklift, scorpent, banderado…) live in StarterData.
      const sf = findForm(entry.custom);
      if (sf) {
        DexTracker.markSeen(this.registry, entry.custom);
        const texKey = entry.custom;
        if (!this.textures.exists(texKey)) {
          this.load.image(texKey, sf.data.spriteUrl);
          await new Promise<void>(r => { this.load.once('complete', r); this.load.start(); });
        }
        this.enemy = new Pokemon(sf.data, entry.level,
          this.isElite
            ? eliteMovesForTypes(sf.data.type1, sf.data.type2, entry.custom)
            : enemyLearnset(sf.startingMoves, texKey, sf.data.type1, sf.data.type2, entry.level));
        this.registry.set('_teKey', texKey);
        return;
      }
    }

    DexTracker.markSeen(this.registry, entry.id);
    const data = await fetchPokemon(entry.id);
    const texKey = `te-${entry.id}`;
    if (!this.textures.exists(texKey)) {
      this.load.image(texKey, data.spriteUrl);
      await new Promise<void>(r => { this.load.once('complete', r); this.load.start(); });
    }
    this.enemy = new Pokemon(data, entry.level,
      this.isElite
        ? eliteMovesForTypes(data.type1, data.type2)
        : enemyLearnset([FALLBACK_MOVE], texKey, data.type1, data.type2, entry.level));
    this.enemy.data.spriteUrl = data.spriteUrl;
    // Store tex key for sprite creation
    this.registry.set('_teKey', texKey);
  }

  // ── Background ────────────────────────────────────────────────────────────

  private drawBackground() {
    const g = this.add.graphics();
    g.fillStyle(0x6688bb); g.fillRect(0, 0, this.W, 300);
    g.fillStyle(0x4a7a3a); g.fillRect(0, 200, this.W, this.H - 320);   // green field down to the dialog box (no black gap)
    g.fillStyle(0x8a9a6a);
    g.fillTriangle(0, 200, 150, 80, 300, 200);
    g.fillTriangle(200, 200, 400, 60, 600, 200);
    g.fillStyle(0xb09060);
    g.fillEllipse(180, 280, 160, 28); g.fillEllipse(580, 155, 120, 22);
    g.fillStyle(0x0d0d2e, 0.96); g.fillRect(0, this.H - 120, this.W, 120);
    g.lineStyle(2, 0x5577aa); g.lineBetween(0, this.H - 120, this.W, this.H - 120);
    this.add.text(this.W / 2, this.H - 108, tr('▶ SPACE to advance'),
      { fontSize: '11px', color: '#5577aa' }).setOrigin(0.5).setDepth(2);
  }

  // ── HUDs ──────────────────────────────────────────────────────────────────

  private playerHudName(): string {
    const entry = PartySystem.get(this.registry)[this.activeSlot];
    return genderedName(pokeNameEn(this.player.name).toUpperCase(), {
      name: this.player.name,
      key: entry?.spriteKey,
      id: this.player.data.id,
      gender: entry?.gender,
    }, entry?.breedingId ?? `party-${this.activeSlot}`);
  }

  private enemyHudName(): string {
    const spec = this.enemyQueue[this.enemyIdx];
    const key = spec?.custom ?? (spec ? `wild-${spec.id}` : undefined);
    return genderedName(pokeNameEn(this.enemy.name).toUpperCase(), {
      name: this.enemy.name,
      key,
      id: this.enemy.data.id,
    }, `${this.trainerKey}-${this.enemyIdx}`);
  }

  private createHUDs() {
    const enemy = createBattleHud(this, {
      side: 'enemy', name: this.enemyHudName(), level: this.enemy.level,
      hp: this.enemy.hp, maxHp: this.enemy.maxHp,
      types: [this.enemy.data.type1, this.enemy.data.type2],
    });
    this.enemyBattleHud = enemy;
    this.enemyNameText = enemy.nameText;
    this.enemyLvText = enemy.levelText;
    this.enemyHpBar = enemy.hpBar;
    this.enemyHpText = enemy.hpText;
    this.enemyStatusBadge = new BattleStatusBadge(this.enemyNameText, () => this.enemyLvText.x - 34);

    const player = createBattleHud(this, {
      side: 'player', name: this.playerHudName(), level: this.player.level,
      hp: this.player.hp, maxHp: this.player.maxHp,
      types: [this.player.data.type1, this.player.data.type2],
    });
    this.playerBattleHud = player;
    this.playerNameText = player.nameText;
    this.playerLvText = player.levelText;
    this.playerHpBar = player.hpBar;
    this.playerHpText = player.hpText;
    this.playerStatusBadge = new BattleStatusBadge(this.playerNameText, () => this.playerLvText.x - 34);
    this.hpW = player.hpWidth;
  }

  private createSprites() {
    // Use the actual lead's sprite (it may not be slot 0 if slot 0 was fainted).
    const pKey  = PartySystem.get(this.registry)[this.activeSlot]?.spriteKey
                ?? (this.registry.get('starterKey') as string) ?? 'vipour';
    const teKey = (this.registry.get('_teKey') as string) ?? 'vipour';

    this.enemySprite  = this.add.image(900, 60, this.textures.exists(teKey) ? teKey : pKey)
      .setDepth(5).setAlpha(0).setData('battlePokemonSide', 'enemy');
    this.playerSprite = this.add.image(-80, 320, pKey)
      .setDepth(5).setFlipX(true).setAlpha(0).setData('battlePokemonSide', 'player');

    this.fitSprite(this.enemySprite, this.enemySpriteSize());
    this.fitSprite(this.playerSprite, 140);
    if (this.isBossThreat) this.addBossAura();

    // Every resolved trainer portrait is already authored/generated as a 2D
    // battle image. Keep it on Phaser's foreground above the 3D arena instead
    // of replacing it with a procedural 3D character.
    const portrait = this.resolvePortrait();
    // The Champion's entrance frames all share one canvas and one foot mark, so
    // he starts ON the standing frame. fitPortrait() measures the OPAQUE bounding
    // box, which differs per pose — fitting each frame would rescale and recentre
    // him every swap, and the routine would jitter. Fit once, here, and hold that
    // scale for the whole routine.
    const useFrames = this.isChampionHwangeum && hwangeumFramesReady(this);
    const startKey = useFrames ? HWANGEUM_FRAMES.stand : portrait?.key;
    if (startKey && this.textures.exists(startKey)) {
      this.trainerPortrait = this.add.image(ENEMY_STAGE_X, ENEMY_STAGE_Y, startKey)
        .setDepth(6)
        .setAlpha(0);
      if (useFrames) {
        // Hand-posed 2D frames of the champion himself — stand, four dance beats,
        // five throwing frames. This replaces the rigged GLB's baked dance clip:
        // that figure moved, but it was a different drawing from the Hwangeum the
        // rest of the game shows, and on mobile the clip often never played at
        // all. Frames run on every device, phone included.
        this.trainerPortrait
          .setData('no3d', true)
          .setData('battleTrainer2DAnchor', 'enemy');
        this.hwangeum2D = true;
      } else if (this.isChampionHwangeum && !performanceProfile().mobile) {
        // The frames are not on this build; fall back to the 3D figure so the
        // Champion still gets an entrance rather than a static portrait.
        this.trainerPortrait
          .setData('battleTrainerEnemyAnchor', true)
          .setData('characterModel3DKey', 'npc_hwangeum')
          .setData('characterGender3D', 'boy')
          .setData('battleChoreo', true);
      } else {
        this.trainerPortrait
          .setData('no3d', true)
          .setData('battleTrainer2DAnchor', 'enemy');
      }
      fitPortrait(this.trainerPortrait);
    }

  }

  /** The portrait for this battle: the gender-based rival avatar for any rival fight,
   *  otherwise the NPC portrait mapped to the trainer key. */
  private resolvePortrait(): { key: string; url: string } | undefined {
    if (this.trainerKey.startsWith('rival')) {
      const key = rivalAvatarKey(this.registry);
      return { key, url: AVATAR_URL[key] };
    }
    const authored = portraitFor(this.trainerKey);
    if (authored) return authored;
    // 우두머리 threats are wild Pokémon, not trainers — no human portrait for them.
    if (this.isBossThreat) return undefined;
    // No authored portrait: reuse a procedural per-CLASS trainer figure (Bug
    // Catcher, Ace Trainer, Fisher…) read from the trainer's name.
    return trainerClassPortrait(this, this.trainerName);
  }

  /** A 우두머리 (boss) — the 어사대 mission threats (Rampaging Gyarados, Fog-Wraith
   *  Gengar, Berserk Steelix…). They loom larger in battle than ordinary Pokémon. */
  private get isBossThreat() { return this.trainerKey.endsWith('-threat'); }
  /** A boss that is a lone WILD Pokémon (the one-Pokémon 어사대 threats) — as opposed
   *  to a multi-Pokémon human "threat" (e.g. Haegang's Disciples). Wild bosses do
   *  not emerge from a Poké Ball. */
  private get isWildBoss() { return this.isBossThreat && this.enemyQueue.length === 1; }
  private enemySpriteSize() { return this.isBossThreat ? 200 : 130; }

  /** Reveal a wild 우두머리 with a menacing fade-in — no trainer, no Poké Ball. */
  private revealWildBoss(onComplete: () => void) {
    const s = this.enemySprite;
    const baseSX = Math.abs(s.scaleX) || 1, baseSY = Math.abs(s.scaleY) || baseSX;
    s.setPosition(ENEMY_STAGE_X, ENEMY_STAGE_Y).setVisible(true).setAlpha(0)
      .setScale(baseSX * 0.7, baseSY * 0.7);
    // Tell the 3D arena where to place the boss model (mirrors playBallSendOut).
    this.events.emit('pk3d-screen-target',
      { target: s, x: ENEMY_STAGE_X, y: ENEMY_STAGE_Y, heightRatio: 0.48 });
    this.tweens.add({
      targets: s, alpha: 1, scaleX: baseSX, scaleY: baseSY, duration: 560, ease: 'Back.easeOut',
      onComplete: () => { s.setScale(baseSX, baseSY).setAlpha(1); onComplete(); },
    });
  }

  /** A 우두머리 boss is far hardier than a normal Pokémon — double its HP. */
  private buffBoss() {
    if (!this.isBossThreat || !this.enemy) return;
    this.enemy.maxHp = Math.round(this.enemy.maxHp * 2);
    this.enemy.hp = this.enemy.maxHp;
  }

  /** A menacing aura behind a boss Pokémon so its extra size reads as "우두머리". */
  private addBossAura() {
    const aura = this.add.graphics().setDepth(4);
    aura.fillStyle(0x8a1a3a, 0.32); aura.fillCircle(0, 0, 118);
    aura.fillStyle(0xd8324a, 0.22); aura.fillCircle(0, 0, 86);
    // Track the Pokémon's LIVE on-screen position. In the 3D arena the creature is
    // rendered by the mirror at a screen anchor that differs from the flat 2D
    // enemySprite (which sits at ENEMY_STAGE_X/Y); querying pk3d-screen-target
    // keeps the aura wrapped around the actual Pokémon (falls back to the 2D sprite
    // position in F3 2D mode, where the request is left untouched).
    const anchorAura = () => {
      const req = { target: this.enemySprite, x: this.enemySprite.x, y: this.enemySprite.y, heightRatio: 0.5 };
      this.events.emit('pk3d-screen-target', req);
      aura.setPosition(req.x, req.y);
    };
    anchorAura();
    // follow the enemy as it appears, and pulse ominously
    this.enemySprite.on('destroy', () => aura.destroy());
    this.tweens.add({ targets: aura, scale: { from: 0.9, to: 1.08 }, alpha: { from: 0.9, to: 0.55 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.time.addEvent({ delay: 16, loop: true, callback: () => { if (aura.active && this.enemySprite.active) anchorAura(); } });
  }

  /** Scale an image so its largest dimension fits `size` px (works for any sprite). */
  private fitSprite(img: Phaser.GameObjects.Image, size: number) {
    const t = this.textures.get(img.texture.key).getSourceImage();
    const s = size * battle2DSpriteScale(img.texture.key);
    img.setScale(s / Math.max((t.width as number) || size, (t.height as number) || size));
  }

  // ── Dialog ────────────────────────────────────────────────────────────────

  private createDialogBox() {
    this.dialogText = this.add.text(16, this.H - 108, '', {
      fontSize: '16px', color: '#fff', wordWrap: { width: this.W * 0.58 }, lineSpacing: 5,
    }).setDepth(10);
  }

  private typeDialog(text: string, onDone?: () => void) {
    text = tr(text);   // translate static battle lines present in the KO dictionary
    this.dialogText.setText('');
    let i = 0;
    const ev = this.time.addEvent({
      delay: BATTLE_PACING.dialogCharacterMs, repeat: text.length - 1,
      callback: () => {
        this.dialogText.setText(text.slice(0, ++i));
        if (i >= text.length) { ev.destroy(); if (onDone) this.time.delayedCall(BATTLE_PACING.dialogHoldMs, onDone); }
      },
    });
  }

  // ── Panels ────────────────────────────────────────────────────────────────

  private createActionPanel() {
    this.actionPanel = this.add.container(0, this.H - 120).setDepth(10);
    const actions = [
      { label: '⚔ FIGHT', accent: 0xef776b, cb: () => this.onFight(), enabled: true },
      { label: '◉ BAG', accent: 0xe0b64d, cb: () => this.onBag(), enabled: true },
      { label: "× CAN'T RUN", accent: 0x596573, cb: () => {}, enabled: false },
      { label: '◇ POKÉMON', accent: 0x62bde7, cb: () => this.onSwitchPokemon(), enabled: true },
    ];
    const left = this.W * 0.61;
    const gap = 8;
    const buttonW = (this.W - left - 16 - gap) / 2;
    actions.forEach((action, index) => {
      modernButton(this, this.actionPanel, {
        label: tr(action.label), x: left + buttonW / 2 + (index % 2) * (buttonW + gap),
        y: 29 + Math.floor(index / 2) * 58, width: buttonW, height: 50,
        accent: action.accent, disabled: !action.enabled, onPick: action.cb,
      });
    });
  }

  private createMovePanel() {
    this.movePanel = this.add.container(0, this.H - 120).setDepth(10).setVisible(false);
    const backW = 110;
    const gap = 8;
    const cardW = (this.W - 24 - backW - gap * 4) / 4;
    this.player.moves.forEach((move, i) => {
      modernMoveButton(this, this.movePanel, {
        move, x: 12 + cardW / 2 + i * (cardW + gap), y: 60,
        width: cardW, height: 102, onPick: () => this.onMoveSelected(move),
      });
    });
    modernButton(this, this.movePanel, {
      label: tr('← BACK'), x: this.W - 12 - backW / 2, y: 60,
      width: backW, height: 102, accent: 0x60758a, onPick: () => this.playerAction(),
    });
  }

  private refreshMovePanel() { this.movePanel.destroy(true); this.createMovePanel(); this.movePanel.setVisible(false); }
  private showActionPanel() {
    deckHideMoves();
    const onDeck = deckShowBattleActions([
      { label: 'FIGHT', onPick: () => this.onFight(), accent: '#f08a78' },
      { label: 'BAG', onPick: () => this.onBag(), accent: '#d7b85c' },
      { label: 'POKÉMON', onPick: () => this.onSwitchPokemon(), accent: '#72b9df' },
      { label: "CAN'T RUN", onPick: () => {}, disabled: true },
    ]);
    this.actionPanel.setVisible(!onDeck);
    this.movePanel.setVisible(false);
    this.bagPanel.setVisible(false);
  }
  private showMovePanel()   { const onDeck = deckShowMoves(this.player.moves, i => this.onMoveSelected(this.player.moves[i]), () => this.playerAction()); this.movePanel.setVisible(!onDeck); this.actionPanel.setVisible(false); }
  private hideAllPanels()   { deckHideBattleActions(); this.actionPanel.setVisible(false); this.movePanel.setVisible(false); this.bagPanel.setVisible(false); }

  // ── Bag panel (heal / status / revive items — no balls in trainer battles) ──
  private createBagPanel() {
    this.bagPanel = this.add.container(0, this.H - 120).setDepth(10).setVisible(false);
    this.rebuildBagPanel();
  }

  private rebuildBagPanel() {
    this.bagPanel.removeAll(true);
    const bg = this.add.rectangle(this.W / 2, 60, this.W - 16, 120, 0x111133, 0.95).setStrokeStyle(1, 0x5577aa);
    this.bagPanel.add(bg);
    this.bagPanel.add(this.add.text(this.W - 30, 10, tr('← BACK'), { fontSize: '12px', color: '#aaa' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.playerAction()));

    const inv = Inventory.all(this.registry);
    const usable = ITEMS.filter(it => (inv[it.key] ?? 0) > 0 &&
      (it.category === 'heal' || it.category === 'status' || it.category === 'revive'));
    if (usable.length === 0) {
      this.bagPanel.add(this.add.text(30, 40, tr('No usable items in the bag.'), { fontSize: '15px', color: '#ccc' }));
      return;
    }
    const cols = [20, 250, 480, 710];
    usable.slice(0, 8).forEach((def, i) => {
      const x = cols[i % 4], y = 18 + Math.floor(i / 4) * 50;
      const r = this.add.rectangle(x + 100, y + 14, 210, 40, 0x1a3a2a)
        .setStrokeStyle(1, 0x3a5a8a).setInteractive({ useHandCursor: true });
      this.bagPanel.add(r);
      this.bagPanel.add(this.add.text(x + 8, y + 4, `${def.icon} ${itemName(def)}`, { fontSize: '13px', color: '#fff', fontStyle: 'bold' }));
      this.bagPanel.add(this.add.text(x + 8, y + 20, `×${inv[def.key]}`, { fontSize: '11px', color: '#ffe44e' }));
      r.on('pointerover', () => r.setFillStyle(0x2a5a3a));
      r.on('pointerout',  () => r.setFillStyle(0x1a3a2a));
      r.on('pointerdown', () => this.useHealItem(def.key));
    });
  }

  private onBag() {
    if (this.state !== 'playerAction' && this.state !== 'bag') return;
    this.state = 'bag';
    this.rebuildBagPanel();
    this.actionPanel.setVisible(false); this.movePanel.setVisible(false);
    this.bagPanel.setVisible(true);
    this.typeDialog('Choose an item!');
  }

  private useHealItem(itemKey: string) {
    if (this.state !== 'bag') return;
    // Choose which Pokémon to use it on (Revive targets a fainted one; heals/cures a healthy one).
    const wantFainted = itemDef(itemKey)?.category === 'revive';
    this.hideAllPanels();
    openSwitchPanel(
      this, this.activeSlot,
      () => this.onBag(),                                   // cancel → back to the bag
      (slot) => this.useItemOnTarget(itemKey, slot),
      true,
      (entry) => wantFainted ? entry.hp <= 0 : entry.hp > 0,
      wantFainted ? 'Revive which Pokémon?' : 'Use on which Pokémon?',
    );
  }

  private useItemOnTarget(itemKey: string, slot: number) {
    const r = useItemOnSlot(this.registry, itemKey, slot);
    if (!r.ok) { this.typeDialog(r.message, () => this.onBag()); return; }
    // If the ACTIVE Pokémon was affected, sync its battle HP + bar.
    if (slot === this.activeSlot) {
      const e = PartySystem.get(this.registry)[this.activeSlot];
      if (e) this.player.hp = e.hp;
    }
    this.hideAllPanels();
    this.state = 'busy';
    const finish = () => this.typeDialog(r.message, () => this.enemyTurn());   // using an item costs your turn
    if (slot === this.activeSlot) this.animateHpBar('player', finish); else finish();
  }

  // ── Battle flow ───────────────────────────────────────────────────────────

  private playerAction() {
    // Mirror the field weather into the 3D battle (Snow Warning → 3D snowfall).
    this.events.emit('pk3d-weather', battleWeather(this.player, this.enemy));
    const pending = pendingMoveFor(this.player);
    if (pending) {
      this.hideAllPanels();
      this.runTurn(pending);
      return;
    }
    this.state = 'playerAction';
    this.typeDialog(`What will ${pokeNameEn(this.player.name).toUpperCase()} do?`);
    this.showActionPanel();
  }

  private onFight() {
    if (this.state !== 'playerAction') return;
    this.state = 'playerMove';
    this.refreshMovePanel();   // rebuild so PP counts reflect moves used this battle
    this.showMovePanel();
    this.typeDialog('Choose a move!');
  }

  private onMoveSelected(move: Move) {
    if (this.state !== 'playerMove') return;
    if (move.pp <= 0) { this.typeDialog('No PP left!', () => this.onFight()); return; }
    // Lock the turn IMMEDIATELY. A touch move-button can fire twice (touchstart +
    // synthetic click, or a fast double-tap); without this, both calls pass the
    // 'playerMove' guard and runTurn executes twice — the enemy attacks twice in
    // one turn (e.g. 월식매 using Stone Edge twice).
    this.state = 'busy';
    deckHideMoves();
    this.hideAllPanels();
    this.runTurn(move);
  }

  private runTurn(playerMove: Move) {
    this.state = 'busy';
    if (this.maybeUseBossPotion(() =>
      this.doPlayerMove(playerMove, () => this.finishTurn(() => this.playerAction())))) return;
    const enemyMoves = this.enemy.moves.filter(m => m.pp > 0);
    const enemyMove = pendingMoveFor(this.enemy)
      ?? this.pickEnemyMove(enemyMoves.length ? enemyMoves : this.enemy.moves);
    // Two-turn moves (Dig/Fly/Solar Beam) span two FULL turns — the opponent acts on
    // BOTH the charge turn and the release turn (its charge-turn move simply misses a
    // dug-in / airborne target via semi-invulnerability). The release auto-runs on the
    // next turn from playerAction() via pendingMoveFor.
    const playerFirst = actsBefore(this.player, playerMove, this.enemy, enemyMove);
    if (playerFirst) {
      this.doPlayerMove(playerMove, () => this.doEnemyMove(() => this.finishTurn(() => this.playerAction()), enemyMove));
    } else {
      this.doEnemyMove(() => this.doPlayerMove(playerMove, () => this.finishTurn(() => this.playerAction())), enemyMove);
    }
  }

  /** Resolve the player's move; on a KO, hand off to afterEnemyKO instead of continuing. */
  private doPlayerMove(playerMove: Move, onDone: () => void) {
    executeBattleMove({
      scene: this,
      user: this.player,
      target: this.enemy,
      move: playerMove,
      userSprite: this.playerSprite,
      targetSprite: this.enemySprite,
      userLabel: pokeNameEn(this.player.name).toUpperCase(),
      showDialog: (text, done) => this.typeDialog(text, done),
      animateUserHp: done => this.animateHpBar('player', done),
      animateTargetHp: done => this.animateHpBar('enemy', done),
      onPpUsed: () => persistMovePP(this.registry, this.activeSlot, this.player),
      onComplete: () => {
        PartySystem.updateSlotHP(this.registry, this.activeSlot, this.player.hp, this.player.status, this.player.heldItem ?? null);
        if (this.enemy.isKO) {
          this.typeDialog(`${pokeNameEn(this.enemy.name).toUpperCase()} fainted!`, () => this.afterEnemyKO());
          return;
        }
        if (this.player.isKO) {
          this.typeDialog(`${pokeNameEn(this.player.name).toUpperCase()} fainted!`, () => this.sendNextOrLose());
          return;
        }
        onDone();
      },
    });
  }

  private get isElite() {
    return this.trainerKey.startsWith('e4-') || this.trainerKey.startsWith('champion-');
  }

  /** Major trainers may spend their action healing a badly injured Pokémon. */
  private maybeUseBossPotion(onDone: () => void): boolean {
    // A Pokémon committed to Fly/Dig/etc. must release that move rather than
    // silently abandoning its stored two-turn state to use an item.
    if (!this.bossPotionAI || pendingMoveFor(this.enemy)) return false;
    const use = this.bossPotionAI.tryUse(this.enemy, this.enemyIdx);
    if (!use) return false;
    this.playBossPotion(use, onDone);
    return true;
  }

  private playBossPotion(use: BossPotionUse, onDone: () => void): void {
    const name = pokeNameEn(this.enemy.name).toUpperCase();
    this.typeDialog(`${this.trainerName} used ${use.itemName} on ${name}!`, () =>
      this.animateHpBar('enemy', () =>
        this.typeDialog(`${name} restored ${use.healed} HP!`, onDone)));
  }

  /** Hwangeum is an idol before he is a battler: he gets a real 3D figure on the
   *  arena floor, a choreographed opening and a hand-thrown ball. */
  private get isChampionHwangeum() { return this.trainerKey === 'champion-hwangeum'; }

  /** True only while the 3D battle mirror is actually drawing this scene. The 2D
   *  presentation stays byte-for-byte unchanged when it is not. */
  private get using3D() {
    const engine = (window as unknown as {
      __pk3d?: { isRendering(scene: Phaser.Scene): boolean };
    }).__pk3d;
    return !!engine?.isRendering(this);
  }

  /** Enemy move choice. E4/Champion pick a WEIGHTED-random move (weight = power ×
   *  type effectiveness vs the player), so they mix their own STAB with super-effective
   *  coverage — leaning toward damage without spamming a single best move. Others random. */
  private pickEnemyMove(pool: Move[]): Move {
    const move = chooseBattleMove(this.enemy, this.player, pool,
      this.isElite || !!this.badgeFlag ? 'boss' : 'trainer', this.battleTurn, this.lastEnemyMove);
    this.lastEnemyMove = move.data.name;
    return move;
  }

  /** The enemy attacks (after a switch or item use, this is its single turn). */
  private enemyTurn() {
    if (this.maybeUseBossPotion(() => this.finishTurn(() => this.playerAction()))) return;
    this.doEnemyMove(() => this.finishTurn(() => this.playerAction()));
  }

  /** Resolve the enemy's move; on a KO, hand off to sendNextOrLose instead of continuing. */
  private doEnemyMove(onDone: () => void, selectedMove?: Move) {
    const moves = this.enemy.moves.filter(m => m.pp > 0);
    const move = selectedMove ?? pendingMoveFor(this.enemy)
      ?? this.pickEnemyMove(moves.length ? moves : this.enemy.moves);
    executeBattleMove({
      scene: this,
      user: this.enemy,
      target: this.player,
      move,
      userSprite: this.enemySprite,
      targetSprite: this.playerSprite,
      userLabel: pokeNameEn(this.enemy.name).toUpperCase(),
      showDialog: (text, done) => this.typeDialog(text, done),
      animateUserHp: done => this.animateHpBar('enemy', done),
      animateTargetHp: done => this.animateHpBar('player', done),
      onComplete: () => {
        PartySystem.updateSlotHP(this.registry, this.activeSlot, this.player.hp, this.player.status, this.player.heldItem ?? null);
        if (this.enemy.isKO) {
          this.typeDialog(`${pokeNameEn(this.enemy.name).toUpperCase()} fainted!`, () => this.afterEnemyKO());
          return;
        }
        if (this.player.isKO) {
          this.typeDialog(`${pokeNameEn(this.player.name).toUpperCase()} fainted!`, () => this.sendNextOrLose());
        } else {
          onDone();
        }
      },
    });
  }

  private finishTurn(onDone: () => void): void {
    playBattleEndTurn({
      scene: this,
      first: this.player,
      second: this.enemy,
      animateFirst: done => this.animateHpBar('player', done),
      animateSecond: done => this.animateHpBar('enemy', done),
      showDialog: (text, done) => this.typeDialog(text, done),
      onComplete: () => {
        this.battleTurn++;
        PartySystem.updateSlotHP(this.registry, this.activeSlot, this.player.hp, this.player.status, this.player.heldItem ?? null);
        if (this.enemy.isKO) {
          this.typeDialog(`${pokeNameEn(this.enemy.name).toUpperCase()} fainted!`, () => this.afterEnemyKO());
        } else if (this.player.isKO) {
          this.typeDialog(`${pokeNameEn(this.player.name).toUpperCase()} fainted!`, () => this.sendNextOrLose());
        } else onDone();
      },
    });
  }

  private afterEnemyKO() {
    if (this.advancingEnemy) return;
    this.advancingEnemy = true;
    this.state = 'busy';

    // Award EXP to the active Pokémon for this defeated enemy, mid-battle.
    // Northern (Phase 2) battles award extra EXP to keep up with the steep level curve.
    this.awardExp(Math.round(this.enemy.level * 24 * expMultiplierFor(this.registry)), () => {
      const nextIdx = this.enemyIdx + 1;
      if (nextIdx >= this.enemyQueue.length) {
        this.advancingEnemy = false;
        this.handleWin();
        return;
      }

      // The Champion steps back out when his FIFTH Pokémon falls — one line
      // before his ace. This only wraps the roster advance; the advance itself
      // still runs through sendNextEnemy untouched.
      if (this.isChampionHwangeum && nextIdx === 5) {
        this.championCutIn(() => void this.sendNextEnemy(nextIdx));
        return;
      }

      // Resolve exactly the captured next slot. enemyIdx changes only after the
      // Pokémon has loaded, so an asset delay cannot mutate or skip the roster.
      void this.sendNextEnemy(nextIdx);
    });
  }

  /** Hwangeum returns to the floor after his fifth Pokémon faints, says his one
   *  line, and steps aside for his ace. Purely a cut-in: no battle state is read
   *  or changed here, and `onDone` continues the roster exactly as before. */
  private championCutIn(onDone: () => void): void {
    const portrait = this.resolvePortrait();
    if (!portrait || !this.textures.exists(portrait.key)) { onDone(); return; }
    // Clear the Pokémon from the field so Hwangeum himself owns the moment: hide
    // the enemy battler (in 3D this also drops its mirrored model), and the next
    // roster send-out fades a Pokémon back in when the cut-in ends.
    this.enemySprite?.setVisible(false);
    // Always his authored 2D character walks onto the field — even in 3D mode we
    // want the flat portrait here, not a 3D walker, so tag it no3d.
    const cut = this.add.image(ENEMY_STAGE_X, ENEMY_STAGE_Y, portrait.key)
      .setDepth(7)
      .setAlpha(0)
      .setData('no3d', true)
      .setData('battleTrainer2DAnchor', 'enemy');
    fitPortrait(cut);
    this.tweens.add({ targets: cut, alpha: 1, duration: 320 });
    this.typeDialog(
      "Hwangeum: How long has it been since anyone pushed me this far!",
      () => this.tweens.add({
        targets: cut, alpha: 0, duration: 320,
        onComplete: () => {
          cut.destroy();
          // Leave the sprite hidden: the ace send-out (playBallSendOut) re-textures
          // it and calls setVisible(true) itself, so restoring it here would flash
          // the previous Pokémon for a frame before the ace loads.
          onDone();
        },
      }),
    );
  }

  /** Load and present one exact opponent roster slot without advancing past it. */
  private async sendNextEnemy(nextIdx: number): Promise<void> {
    try {
      const outgoing = this.enemy;
      await this.loadEnemyPokemon(nextIdx);
      if (!this.enemy) throw new Error(`Opponent roster slot ${nextIdx} did not produce a Pokémon`);
      if (outgoing && outgoing !== this.enemy) transferReplacementState(outgoing, this.enemy);
      syncBattleHudTypes(this.enemyBattleHud, [this.enemy.data.type1, this.enemy.data.type2]);
      this.enemyIdx = nextIdx;
      this.buffBoss();   // extra HP for a 우두머리 boss
      const teKey = (this.registry.get('_teKey') as string);
      this.enemySprite.setTexture(this.textures.exists(teKey) ? teKey : 'vipour');
      this.fitSprite(this.enemySprite, this.enemySpriteSize());
      this.enemyNameText?.setText(this.enemyHudName());
      this.enemyLvText.setText(`Lv.${this.enemy.level}`);
      snapBattleHp(this.enemyHpBar, this.enemyHpText, this.hpW, this.enemy.hp, this.enemy.maxHp);
      playBallSendOut(this, this.enemySprite, {
        side: 'enemy', targetX: ENEMY_STAGE_X, targetY: ENEMY_STAGE_Y,
        onComplete: () => this.typeDialog(
          `${this.trainerName} sent out ${pokeNameEn(this.enemy.name).toUpperCase()}!`,
          () => {
            this.advancingEnemy = false;
            if (this.player.isKO) {
              this.typeDialog(`${pokeNameEn(this.player.name).toUpperCase()} fainted!`, () => this.sendNextOrLose());
            } else {
              this.offerSwitchAfterKO();
            }
          },
        ),
      });
    } catch (error) {
      // Do not increment again or silently continue to the following slot. A
      // transient asset/API failure retries this same Pokémon after a clear log.
      console.error(`[TrainerBattle] Failed to load roster slot ${nextIdx}; retrying without skipping.`, error);
      this.typeDialog('The next Pokémon is entering the battle…', () => {
        void this.sendNextEnemy(nextIdx);
      });
    }
  }

  /** Grant EXP to the active Pokémon, persist it, and show the message + level-up. */
  private awardExp(amount: number, onDone: () => void) {
    const oldLevel = this.player.level;
    const levelled = this.player.gainExp(amount);
    PartySystem.updateSlotProgress(
      this.registry, this.activeSlot,
      this.player.level, this.player.exp, this.player.hp, this.player.maxHp,
    );
    // Every other Pokémon that participated also gains EXP.
    const bench: BenchLevelUp[] = [];
    const benchLines = awardBenchExp(this.registry, this.participants, this.activeSlot, amount, bench);
    const after = () => this.playBenchLines(benchLines, () =>
      runBenchLevelUpLearning(this, bench, (t, cb) => this.typeDialog(t, cb), onDone));
    const msg = `${pokeNameEn(this.player.name).toUpperCase()} gained ${amount} EXP!`;
    if (levelled) {
      this.playerLvText.setText(`Lv.${this.player.level}`);
      this.typeDialog(msg, () => {
        this.animateHpBar('player', () => {
          this.typeDialog(`✨ ${pokeNameEn(this.player.name).toUpperCase()} grew to Lv. ${this.player.level}!`, () => {
            runLevelUpLearning(this, this.activeSlot, this.player, oldLevel, this.player.level,
              (t, cb) => this.typeDialog(t, cb), after);
          });
        });
      });
    } else {
      this.typeDialog(msg, after);
    }
  }

  /** Show queued benched-participant level-up notices, then continue. */
  private playBenchLines(lines: string[], onDone: () => void) {
    if (lines.length === 0) { onDone(); return; }
    this.typeDialog(lines[0], () => this.playBenchLines(lines.slice(1), onDone));
  }

  private handleWin() {
    this.state = 'over';
    // Silence the battle theme so only the win jingle plays (not both at once).
    stopBgm(this);
    // Milestone jingle: badge get for gym leaders, victory fanfare otherwise.
    if (!this.badgeFlag) playJingle(this, 'victory');

    // Commit the Chapter 7 milestone at victory time. If the lab return is
    // interrupted or reloaded, Haean City will no longer replay the summons.
    if (this.trainerKey === 'rival-3') this.registry.set('chapter7Done', true);

    // ── Gym-leader victory (badge + TM reward) ────────────────────────────
    if (this.badgeFlag) {
      const badgeName = this.badgeName || 'Badge';
      const tmName    = this.badgeTM;
      const winLine   = this.winLine || `${this.trainerName}: A worthy challenger.`;
      const prize = Math.round(this.totalExp * 6);
      Inventory.addMoney(this.registry, prize);
      this.registry.set(this.badgeFlag, true);

      const lines = [winLine, `You got ${formatMoney(prize)} for winning!`];
      lines.push(`Congratulations! ${badgeName} obtained! 🏅`);
      if (tmName) {
        const tm = tmForMove(tmName);
        if (tm) Inventory.add(this.registry, tm.key, 1);   // add the TM to the bag
        lines.push(`Received: TM — ${tmName}!  (Check your Bag to teach it.)`);
      }

      const playSeq = (i: number) => {
        if (i >= lines.length) {
          this.saveProgress();
          this.returnToRoute();
          return;
        }
        this.typeDialog(lines[i], () => playSeq(i + 1));
      };
      showRewardCeremony(this, { kind: 'badge', key: this.badgeFlag, onComplete: () => playSeq(0) });
      return;
    }

    const trainerLines: Record<string, string> = {
      'bug-catcher': "Bug Catcher: Whoa! Your Pokémon is so strong!",
      'hiker':       "Hiker: You've got real mountain spirit, kid.",
      'youngster':   "Youngster: No way! I just polished my sneakers…",
      'suri-grunts': "Team Suri: ...You're stronger than the locals. The Director will hear of this.",
      'nosdan-ryeo-1': "Commander Ryeo: ...The Jeju vent will erupt. The only question is who controls what happens next — and it will NOT be Team Suri.",
      'nosdan-ryeo-2': "Commander Ryeo: ...This changes nothing. The array will be ready when the vent erupts. (She withdraws south.)",
      'rival-2': "Rival: ...Okay. Not luck. You're the real thing. My starter's almost ready for its final form. Next time, you won't recognize it.",
      'rival-3': "Rival: Final form and all — and you STILL beat me. You're the real deal. Let's go save that moth grandmother.",
      'suri-chaeyeon-1': "Admin Chaeyeon: Team Suri isn't the only organization moving through this region anymore. And the other one — they're not here for research.",
      'suri-chaeyeon-2': "Admin Chaeyeon: 노스단 isn't here for healing. They've followed our digs for months, waiting. I've filed reports — the Director calls them a myth. She's wrong. And I don't know what to do with that.",
      'nosdan-ryeo-cliff': "Commander Ryeo: ...You've beaten me on the cliff. But the array is the real threat — and it is not yet finished.",
      'suri-director': "Director Suri: ...Enough. You and your friend fight like the region itself is at your back. Perhaps it is.",
      'baekdu-soldier-1': "노스단 Soldier: The perimeter's yours. It won't matter — the towers will hold.",
      'baekdu-soldier-2': "노스단 Soldier: Fall back! Fall back to the courtyard!",
      'baekdu-sentry-w': "Watchtower Sentry: The west light's dead... the courtyard's exposed!",
      'baekdu-sentry-e': "Watchtower Sentry: Searchlight down! The captain's on her own now.",
      'baekdu-seollan': "Seollan: ...The Commander said you might reach this far. I didn't believe her. The gate is yours — but the mountain will not forgive you the way I have.",
      'baekdu-grunt-1': "노스단 Grunt: You don't understand — the machine doesn't care who wins down here!",
      'baekdu-admin-1': "노스단 Admin: Climb all you like. The matrix completes with or without us.",
      'nosdan-mubaek': "Executive Mubaek: ...Six partners, and still you broke through. Go, then. The Spirit will not be so easily reasoned with.",
      'road-hyeonu': "Hyeonu: A clean answer. The road has measured you well.",
      'road-dawon': "Dawon: My dragons bow to yours. Go — the gate's just above.",
      'road-munseok': "Munseok: Forty years, and you've still got something to teach me. Hah! Go on up.",
      'rival-4': "Rival: ...Yeah. Yeah, that's the trainer I've been chasing this whole time. Go on — the Four are waiting, and so is HE.",
      'e4-gyeoul': "Gyeoul: The thaw comes for us all. You've earned the next hall.",
      'e4-hwageum': "Hwageum: My steel held nothing back, and you broke through it. Impressive.",
      'e4-baram': "Baram: Like the wind itself — I couldn't pin you down. Go higher.",
      'e4-saleum': "Saleum: The vision held after all. The throne is yours to challenge.",
      'champion-hwangeum': "Hwangeum: ...Good. Three years I've wondered when someone would come who could do this.",
      // ── POST-GAME I — The Northern League ──
      'rival-5': "Rival: Yeah. YEAH. Go show these northerners what an Onnuri trainer looks like. I'll be in the stands, losing my voice for you.",
      'north-seorak': "Seorak: ...You moved the stone. The next hall is yours to enter, southerner.",
      'north-hanseol': "Hanseol: The cold couldn't hold you. Go on — climb higher.",
      'north-cheolgang': "Cheolgang: My steel broke before you did. That has not happened in years. Pass.",
      'north-baekho': "Baekho: The white tiger yields. Only the Great King remains above you now.",
      'north-taewang': "Taewang: ...Thirty years, and the first to take my throne is a southerner. The north acknowledges Onnuri.",
      // ── POST-GAME II — The Descent of Hwanung ──
      'inspector-jito': "어사대장 Jito: ...Strong, and you fight clean — no tricks, no cruelty. That tells me more than words. Travel our cities. Show me WHY you're here.",
      'nosdan-admin': "노스단 Admin: ...The stars already gave us the shrines. Beating me changes nothing — the Sovereign will descend for US.",
      'inspector-salmu': "어사대장 Salmu: The trainer beneath the legend is real after all. The order takes note.",
      'inspector-gapcheol': "어사대장 Gapcheol: Iron tested, iron held. You have the 어사대's respect — and mine.",
      'inspector-jinnok': "어사대장 Jinnok: The head of the order is satisfied. The wards will open. We climb together, Champion.",
      'nosdan-sovereign': "노스단 Sovereign-Claimant: ...Impossible. The throne was ours to take — the pantheon, the peninsula, all of it... (The 어사대 close in around the fallen claimant.)",
    };
    const defeatLine = trainerLines[this.trainerKey] ??
      `${this.trainerName}: You battled well…`;

    // Prize money for winning (EXP was already awarded per defeated Pokémon).
    const prize = Math.round(this.totalExp * 4);
    Inventory.addMoney(this.registry, prize);

    this.typeDialog(`${defeatLine}\nYou got ${formatMoney(prize)} for winning!`, () => {
      this.registry.set('trainerDefeated_' + this.trainerKey, true);
      // Every Taewang victory must hand control to the Northern Hall of Fame.
      // The old northLeagueDone guard skipped this on rematches, leaving the
      // defeated champion room with no NPC and no way back down.
      if (this.trainerKey === 'north-taewang') {
        this.registry.set('northHallOfFamePending', true);
        if (this.registry.get('northLeagueDone')) {
          this.registry.set('northHallOfFameRematchPending', true);
        } else {
          this.registry.remove('northHallOfFameRematchPending');
        }
      }
      // Beating Hwangeum must always hand control back to the League's Hall of Fame
      // ceremony — including on rematches. Without this the second-run champion room
      // had no NPC, no stairs and no exit, trapping the player on the fifth floor.
      if (this.trainerKey === 'champion-hwangeum') {
        this.registry.set('leagueHallOfFamePending', true);
        if (this.registry.get('hallOfFame')) {
          this.registry.set('leagueHallOfFameRematchPending', true);
        } else {
          this.registry.remove('leagueHallOfFameRematchPending');
        }
      }
      this.saveProgress();
      this.returnToRoute();
    });
  }

  /** Save badge/progress against the last RESUMABLE overworld scene (the city/route
   *  the player came from) — never the WorldMap default, which strands the player. */
  private saveProgress() {
    if (this.registry.get('ryeoBattleTest')) return;
    const scene = (this.registry.get('lastScene') as string) ?? this._returnScene;
    const px = (this.registry.get('lastX') as number) ?? this.returnPx;
    const py = (this.registry.get('lastY') as number) ?? this.returnPy;
    SaveManager.save(this.registry, px, py, scene);
  }

  private get returnPx() { return (this.registry.get('routeReturnX') as number) ?? 0; }
  private get returnPy() { return (this.registry.get('routeReturnY') as number) ?? 0; }

  // ── Party switching ───────────────────────────────────────────────────────

  private onSwitchPokemon() {
    if (this.state !== 'playerAction') return;
    this.state = 'busy';
    this.hideAllPanels();
    openSwitchPanel(
      this, this.activeSlot,
      () => {
        this.state = 'playerAction';
        this.showActionPanel();
        this.typeDialog(`What will ${pokeNameEn(this.player.name).toUpperCase()} do?`);
      },
      (idx) => this.voluntarySwitch(idx),
    );
  }

  /** After the opponent sends out a fresh Pokémon, offer the player a FREE switch
   *  (does not cost the turn) — the classic "Will you switch?" prompt. */
  private offerSwitchAfterKO() {
    const party = PartySystem.get(this.registry);
    const hasBench = party.some((e, i) => i !== this.activeSlot && e.hp > 0);
    if (!hasBench) { this.playerAction(); return; }   // nothing to switch to

    this.state = 'busy';
    this.hideAllPanels();
    this.typeDialog(`${this.trainerName} sent out ${pokeNameEn(this.enemy.name).toUpperCase()}.\nWill you switch your Pokémon?`);

    // Stacked vertically with scale-aware spacing, and the box is sized from those
    // metrics so it fully contains both options at any (mobile-enlarged) font size.
    const S = fontScaleForScene(this);
    const lineH = Math.round(30 * S);          // room for one enlarged label
    const padX = Math.round(24 * S), padY = Math.round(16 * S), gap = Math.round(22 * S);
    const boxW = Math.round(210 * S);
    const boxH = padY * 2 + lineH * 2 + gap;
    // Desktop: sit in the bottom-right action-console area (where FIGHT/BAG normally
    // are), so the choice reads as part of the console. Mobile: the console lives on
    // the deck, not the canvas, so centre the box in the play area instead (clear of
    // the bottom dialog and the player HUD, which the enlarged font would collide with).
    const consoleCx = this.W * 0.60 + 80, consoleCy = this.H - 120 + 60;
    const boxX = S > 1 ? Math.round((this.W - boxW) / 2) : Math.round(consoleCx - boxW / 2);
    const boxY = S > 1 ? Math.round(this.H * 0.30)       : Math.round(consoleCy - boxH / 2);

    const panel = this.add.container(0, 0).setDepth(12);
    panel.add(this.add.rectangle(boxX, boxY, boxW, boxH, 0x111133, 0.98)
      .setOrigin(0, 0).setStrokeStyle(2, 0x5577aa));
    const mk = (label: string, row: number, cb: () => void) => {
      const t = this.add.text(boxX + padX, boxY + padY + row * (lineH + gap), label,
        { fontSize: '20px', color: '#ffffff' })
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => t.setColor('#ffe44e'))
        .on('pointerout',  () => t.setColor('#ffffff'))
        .on('pointerdown', () => { panel.destroy(true); cb(); });
      panel.add(t);
    };
    mk('▶ SWITCH', 0, () => this.openKOSwitch());
    mk('▶ STAY IN', 1, () => this.playerAction());
  }

  private openKOSwitch() {
    this.hideAllPanels();
    openSwitchPanel(
      this, this.activeSlot,
      () => this.offerSwitchAfterKO(),     // BACK → re-show the switch/stay prompt
      (idx) => this.freeSwitch(idx),
    );
  }

  /** Swap in a chosen party member WITHOUT spending the turn (the enemy already
   *  used its turn fainting). Mirrors voluntarySwitch but ends at playerAction(). */
  private async freeSwitch(slotIdx: number) {
    this.state = 'busy';
    persistSwitchOut(this.registry, this.activeSlot, this.player);
    this.activeSlot = slotIdx;
    this.participants.add(slotIdx);
    const entry = PartySystem.get(this.registry)[slotIdx];
    this.player = buildReplacement(this.player, entry);
    syncBattleHudTypes(this.playerBattleHud, [this.player.data.type1, this.player.data.type2]);
    this.refreshMovePanel();

    this.playerNameText.setText(this.playerHudName());
    this.playerLvText.setText(`Lv.${this.player.level}`);
    snapBattleHp(this.playerHpBar, this.playerHpText, this.hpW, this.player.hp, this.player.maxHp);

    if (this.textures.exists(entry.spriteKey)) {
      this.playerSprite.setTexture(entry.spriteKey);
      const tex = this.textures.get(entry.spriteKey).getSourceImage();
      const dim = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
      this.playerSprite.setScale((140 * battle2DSpriteScale(entry.spriteKey)) / dim);
    }
    if (!this.textures.exists(entry.spriteKey)) await ensurePartyTexture(this, entry);
    if (this.textures.exists(entry.spriteKey) && this.playerSprite.texture.key !== entry.spriteKey) {
      this.playerSprite.setTexture(entry.spriteKey);
      const tex = this.textures.get(entry.spriteKey).getSourceImage();
      const dim = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
      this.playerSprite.setScale((140 * battle2DSpriteScale(entry.spriteKey)) / dim);
    }
    playBallSendOut(this, this.playerSprite, {
      side: 'player', targetX: 180, targetY: 260,
      onComplete: () => this.typeDialog(`Go, ${pokeNameEn(this.player.name).toUpperCase()}!`, () => this.playerAction()),
    });
  }

  private async voluntarySwitch(slotIdx: number) {
    this.state = 'busy';
    persistSwitchOut(this.registry, this.activeSlot, this.player);
    this.activeSlot = slotIdx;
    this.participants.add(slotIdx);
    const party = PartySystem.get(this.registry);
    const entry = party[slotIdx];
    this.player = buildReplacement(this.player, entry);
    syncBattleHudTypes(this.playerBattleHud, [this.player.data.type1, this.player.data.type2]);
    this.refreshMovePanel();

    this.playerNameText.setText(this.playerHudName());
    this.playerLvText.setText(`Lv.${this.player.level}`);
    snapBattleHp(this.playerHpBar, this.playerHpText, this.hpW, this.player.hp, this.player.maxHp);

    if (this.textures.exists(entry.spriteKey)) {
      this.playerSprite.setTexture(entry.spriteKey);
      const tex = this.textures.get(entry.spriteKey).getSourceImage();
      const dim = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
      this.playerSprite.setScale((140 * battle2DSpriteScale(entry.spriteKey)) / dim);
    }
    if (!this.textures.exists(entry.spriteKey)) await ensurePartyTexture(this, entry);
    if (this.textures.exists(entry.spriteKey) && this.playerSprite.texture.key !== entry.spriteKey) {
      this.playerSprite.setTexture(entry.spriteKey);
      const tex = this.textures.get(entry.spriteKey).getSourceImage();
      const dim = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
      this.playerSprite.setScale((140 * battle2DSpriteScale(entry.spriteKey)) / dim);
    }
    playBallSendOut(this, this.playerSprite, {
      side: 'player', targetX: 180, targetY: 260,
      onComplete: () => this.typeDialog(`Go, ${pokeNameEn(this.player.name).toUpperCase()}!`, () => this.enemyTurn()),
    });
  }

  private sendNextOrLose() {
    if (this.awaitingForcedSwitch) return;
    const party = PartySystem.get(this.registry);

    // Mark current slot as fainted
    if (party[this.activeSlot]) {
      party[this.activeSlot].hp = 0;
      PartySystem.set(this.registry, party);
    }

    // No healthy Pokémon left → trainer wins.
    const anyHealthy = party.some((e, i) => i !== this.activeSlot && e.hp > 0);
    if (!anyHealthy) {
      // Losing anywhere in a League gauntlet fails the whole run — the four masters
      // must be beaten again from the first, in one attempt. Those return to the lobby;
      // every other loss is a normal whiteout to the nearest Pokémon Center.
      const inLeague = this.trainerKey.startsWith('e4-') || this.trainerKey.startsWith('champion-') || this.trainerKey.startsWith('north-');
      this.typeDialog(`${this.trainerName}: You're out of Pokémon! Better luck next time.`, () => {
        if (inLeague) {
          PartySystem.healAll(this.registry);
          if (this.trainerKey.startsWith('north-')) this.registry.set('northLeagueRunFailed', true);
          else this.registry.set('leagueRunFailed', true);
          this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start(this._returnScene));
        } else if (this.registry.get('ryeoBattleTest')) {
          // A test loss returns to the local test screen instead of sending the
          // copied party through the normal Pokémon Center flow.
          PartySystem.healAll(this.registry);
          this.returnToRoute();
        } else {
          this.typeDialog(blackoutMessage(this.registry), () => blackoutToCenter(this));
        }
      });
      return;
    }

    // Let the player CHOOSE which Pokémon to send next (forced switch — no cancel).
    this.state = 'busy';
    this.hideAllPanels();
    this.typeDialog('Choose your next Pokémon!');
    this.awaitingForcedSwitch = true;
    openSwitchPanel(this, this.activeSlot, () => {}, (idx) => this.sendInChosen(idx), false);
  }

  /** Bring in the player-chosen Pokémon after a faint, then resume the player's turn. */
  private async sendInChosen(nextIdx: number) {
    if (!this.awaitingForcedSwitch) return;
    this.awaitingForcedSwitch = false;
    this.state = 'busy';
    this.activeSlot = nextIdx;
    this.participants.add(nextIdx);
    const entry = PartySystem.get(this.registry)[nextIdx];
    this.player = buildReplacement(this.player, entry);
    syncBattleHudTypes(this.playerBattleHud, [this.player.data.type1, this.player.data.type2]);
    this.refreshMovePanel();

    // Update HUD
    this.playerNameText.setText(this.playerHudName());
    this.playerLvText.setText(`Lv.${this.player.level}`);
    const switchRatio = Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1);
    this.playerHpBar.fillColor = hpColor(switchRatio);
    this.playerHpBar.width     = this.hpW * switchRatio;
    this.playerHpText.setText(`${this.player.hp}/${this.player.maxHp}`);

    // Swap sprite
    const key = entry.spriteKey;
    await ensurePartyTexture(this, entry);
    if (this.textures.exists(key)) {
      this.playerSprite.setTexture(key);
      const tex = this.textures.get(key).getSourceImage();
      const dim = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
      this.playerSprite.setScale((140 * battle2DSpriteScale(key)) / dim);
    }
    playBallSendOut(this, this.playerSprite, {
      side: 'player', targetX: 180, targetY: 260,
      onComplete: () => this.typeDialog(`Go, ${pokeNameEn(this.player.name).toUpperCase()}!`, () => this.playerAction()),
    });
  }

  private returnToRoute() {
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start(this._returnScene));
  }

  // ── Shared HP animation ───────────────────────────────────────────────────

  update(): void {
    this.enemyStatusBadge?.sync(this.enemy?.status);
    this.playerStatusBadge?.sync(this.player?.status);
  }

  private animateHpBar(who: 'player' | 'enemy', onDone: () => void) {
    const mon   = who === 'player' ? this.player  : this.enemy;
    const bar   = who === 'player' ? this.playerHpBar  : this.enemyHpBar;
    const label = who === 'player' ? this.playerHpText : this.enemyHpText;
    animateBattleHp({
      scene: this, bar, label, maxWidth: this.hpW,
      targetHp: mon.hp, maxHp: mon.maxHp, onDone,
    });
  }
}
