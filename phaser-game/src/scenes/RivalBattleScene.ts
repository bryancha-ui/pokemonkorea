import Phaser from 'phaser';
import { pushBgm, popBgm, stopBgm, playJingle, TRACKS } from '../systems/Music';
import {
  deckShowBattleActions, deckHideBattleActions, deckShowMoves, deckHideMoves, deckSetBattleMode,
} from '../systems/TouchControls';
import { executeBattleMove, pendingMoveFor } from '../systems/MoveEffects';
import { battle2DSpriteScale } from '../data/SpriteScale';
import { Pokemon, Move } from '../battle/Pokemon';
import { STARTERS, findForm } from '../data/StarterData';
import { SaveManager } from '../utils/SaveManager';
import { PartySystem } from '../systems/PartySystem';
import { awardBenchExp } from '../systems/BattleExp';
import { buildFromEntry, buildReplacement, persistMovePP, persistSwitchOut } from '../systems/PartyBattle';
import { openSwitchPanel } from '../systems/SwitchPanel';
import { DexTracker } from '../systems/DexTracker';
import { AVATAR_URL, playerAvatarKey, rivalAvatarKey } from '../data/PlayerAvatar';
import { fitPortrait } from '../data/BattlePortraits';
import { rivalTrainerName } from '../data/CharacterSprite';
import { t, tr, pokeNameEn, speakerName } from '../systems/i18n';
import { genderedName } from '../data/PokemonGender';
import { actsBefore, battleWeather } from '../systems/AbilitySystem';
import { enemyLearnset, mergeLearnset } from '../data/Learnsets';
import { BattleStatusBadge } from '../systems/BattleStatusBadge';
import { createBattleHud, modernButton, modernMoveButton, syncBattleHudTypes, type BattleHud } from '../systems/ProductionUi';
import { animateBattleHp, BATTLE_PACING, snapBattleHp } from '../systems/BattlePacing';
import { playBattleEndTurn } from '../systems/BattleEndTurn';
import { chooseBattleMove } from '../systems/BattleAI';

type BattleState = 'intro' | 'playerAction' | 'playerMove' | 'busy' | 'levelUp' | 'over';
const RIVAL_STAGE_X = 580;
const RIVAL_STAGE_Y = 130;

export class RivalBattleScene extends Phaser.Scene {
  private player!: Pokemon;
  private rival!: Pokemon;
  private state: BattleState = 'intro';
  private lastRivalMoveName = '';
  private battleTurn = 1;
  /** Gender-based rival trainer name: 'Minhyuk' (male) / 'Soohyun' (female). */
  private get rivalTName() { return rivalTrainerName(this.registry); }

  // UI
  private dialogText!: Phaser.GameObjects.Text;
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private rivalHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpText!: Phaser.GameObjects.Text;
  private rivalHpText!: Phaser.GameObjects.Text;
  private playerLvText!: Phaser.GameObjects.Text;
  private rivalLvText!: Phaser.GameObjects.Text;
  private playerNameText!: Phaser.GameObjects.Text;
  private rivalNameText!: Phaser.GameObjects.Text;
  private playerStatusBadge?: BattleStatusBadge;
  private rivalStatusBadge?: BattleStatusBadge;
  private playerBattleHud?: BattleHud;
  private playerSprite!: Phaser.GameObjects.Image;
  private rivalSprite!: Phaser.GameObjects.Image;
  private playerTrainer?: Phaser.GameObjects.Image;
  private rivalTrainer?: Phaser.GameObjects.Image;
  private actionPanel!: Phaser.GameObjects.Container;
  private movePanel!: Phaser.GameObjects.Container;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  // All battle-visible elements hidden until after the intro dialogue
  private hudGroup: Phaser.GameObjects.GameObject[] = [];

  private W = 1280;
  private H = 720;
  private HP_BAR_W = 200;   // widened on mobile to fill the enlarged name box
  private activeSlot = 0;
  private participants = new Set<number>([0]);
  // Guards rivalSendNextOrLose against a duplicate trigger for the same KO, which
  // would otherwise zero the freshly sent-in Pokémon and falsely report a wipe.
  private resolvingFaint = false;

  constructor() { super('RivalBattleScene'); }

  preload() {
    STARTERS.forEach(s => {
      if (!this.textures.exists(s.spriteKey))
        this.load.image(s.spriteKey, s.data.spriteUrl);
    });
    PartySystem.get(this.registry).forEach(e => {
      if (e.spriteKey && e.spriteUrl && !this.textures.exists(e.spriteKey))
        this.load.image(e.spriteKey, e.spriteUrl);
    });
    for (const [key, url] of Object.entries(AVATAR_URL)) {
      if (!this.textures.exists(key)) this.load.image(key, url);
    }
  }

  create() {
    this.cameras.main.fadeIn(400);
    this.battleTurn = 1;
    this.lastRivalMoveName = '';
    // Keep the ambient track playing through the rival's run-in + dialogue, and preload
    // the rival battle theme now so it can start the INSTANT the battle begins (revealBattle).
    if (!this.cache.audio.exists('rival') && TRACKS.rival) { this.load.audio('rival', TRACKS.rival); this.load.start(); }
    deckSetBattleMode(true);   // battle is touch-only: hide the walking stick + A/B
    this.events.once('shutdown', () => { deckSetBattleMode(false); popBgm(this); deckHideBattleActions(); deckHideMoves(); });
    this.buildPokemon();
    this.drawBackground();
    this.createHUDs();
    this.createSprites();
    this.createDialogBox();
    this.createActionPanel();
    this.createMovePanel();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    // Open party/bag menu anytime
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => this.scene.launch('MenuScene'));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => this.scene.launch('MenuScene'));
    this.hideAllPanels();
    // The first rival battle plays its challenge dialogue in the OVERWORLD; if that already
    // happened, skip straight to the fight. Otherwise fall back to the in-battle intro.
    if (this.registry.get('rivalIntroSeen')) { this.registry.remove('rivalIntroSeen'); this.enterRivalBattle(); }
    else this.startIntro();
  }

  // ── Pokémon construction ──────────────────────────────────────────────────

  private buildPokemon() {
    const starterKey   = (this.registry.get('starterKey')   as string) ?? 'vipour';
    const starterLevel = (this.registry.get('starterLevel') as number) ?? 5;
    const rivalKey     = (this.registry.get('rivalKey')     as string) ?? 'onnurian';

    // Player from party slot 0
    PartySystem.syncSlot0FromStarter(this.registry);
    const party = PartySystem.get(this.registry);
    // Lead with the first NON-fainted Pokémon so a fainted lead never enters battle.
    this.activeSlot = Math.max(0, party.findIndex(e => e && e.hp > 0));
    if (party.length > 0) {
      this.player = buildFromEntry(party[this.activeSlot]);
      this.participants = new Set<number>([this.activeSlot]);
    } else {
      const playerDef = findForm(starterKey) ?? STARTERS[1];
      this.player = new Pokemon(playerDef.data, starterLevel,
        mergeLearnset(playerDef.startingMoves, playerDef.spriteKey,
          playerDef.data.type1, playerDef.data.type2, starterLevel));
      this.player.exp = (this.registry.get('starterExp') as number) ?? 0;
    }

    // The first rival also follows early progression. Grass gets a weak Rock
    // option beside Tackle so Hakdongja's Ghost typing is not a free immunity.
    const rivalDef = findForm(rivalKey) ?? STARTERS[2];
    let rivalMoves = enemyLearnset(rivalDef.startingMoves, rivalDef.spriteKey,
      rivalDef.data.type1, rivalDef.data.type2, starterLevel);
    // Against a Grass starter, the rival's Vipour gets BOTH Fire STAB and a
    // super-effective Poison Sting, which spikes the opening difficulty. Drop the
    // Poison Sting here so the rival still has its fair Fire-type edge but no extra
    // Poison coverage. (A player-owned Vipour keeps Poison Sting for the Ghost matchup.)
    if (rivalKey === 'vipour') {
      const trimmed = rivalMoves.filter(m => m.name.toLowerCase() !== 'poison sting');
      if (trimmed.length) rivalMoves = trimmed;
    }
    this.rival = new Pokemon(rivalDef.data, starterLevel, rivalMoves);
    DexTracker.markSeen(this.registry, rivalKey);
  }

  // ── Background ────────────────────────────────────────────────────────────

  private drawBackground() {
    const g = this.add.graphics();
    // Sky gradient simulation
    g.fillStyle(0x87ceeb, 1); g.fillRect(0, 0, this.W, this.H * 0.55);
    // Distant hills
    g.fillStyle(0x7aaa55, 1);
    g.fillTriangle(0, 200, 120, 100, 240, 200);
    g.fillTriangle(160, 210, 320, 80, 480, 210);
    g.fillTriangle(380, 205, 560, 70, 740, 205);
    // Ground
    g.fillStyle(0x5a9a3a, 1); g.fillRect(0, 195, this.W, this.H - 315);   // green field down to the dialog box (no black gap)
    // Dirt patch (player side)
    g.fillStyle(0xc8a870, 1); g.fillEllipse(220, 280, 160, 30);
    // Dirt patch (rival side)
    g.fillEllipse(580, 155, 130, 22);
    // Road between them
    g.fillStyle(0x888866, 0.4); g.fillRect(0, 295, this.W, 8);
    // Dialog box bg
    g.fillStyle(0x0d0d2e, 0.95); g.fillRect(0, this.H - 120, this.W, 120);
    g.lineStyle(2, 0x5577aa, 1); g.lineBetween(0, this.H - 120, this.W, this.H - 120);
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

  private rivalHudName(): string {
    const key = (this.registry.get('rivalKey') as string) ?? 'onnurian';
    return genderedName(pokeNameEn(this.rival.name).toUpperCase(), {
      name: this.rival.name,
      key,
      id: this.rival.data.id,
    }, `rival-${key}`);
  }

  private createHUDs() {
    const rival = createBattleHud(this, {
      side: 'enemy', name: this.rivalHudName(), level: this.rival.level,
      hp: this.rival.hp, maxHp: this.rival.maxHp,
      types: [this.rival.data.type1, this.rival.data.type2], hidden: true,
    });
    this.hudGroup.push(...rival.objects);
    this.rivalNameText = rival.nameText;
    this.rivalLvText = rival.levelText;
    this.rivalHpBar = rival.hpBar;
    this.rivalHpText = rival.hpText;
    this.rivalStatusBadge = new BattleStatusBadge(this.rivalNameText, () => this.rivalLvText.x - 36);
    this.rivalStatusBadge.text.setAlpha(0);
    this.hudGroup.push(this.rivalStatusBadge.text);

    const player = createBattleHud(this, {
      side: 'player', name: this.playerHudName(), level: this.player.level,
      hp: this.player.hp, maxHp: this.player.maxHp,
      types: [this.player.data.type1, this.player.data.type2], hidden: true,
    });
    this.playerBattleHud = player;
    this.hudGroup.push(...player.objects);
    this.playerNameText = player.nameText;
    this.playerLvText = player.levelText;
    this.playerHpBar = player.hpBar;
    this.playerHpText = player.hpText;
    this.playerStatusBadge = new BattleStatusBadge(this.playerNameText, () => this.playerLvText.x - 36);
    this.playerStatusBadge.text.setAlpha(0);
    this.hudGroup.push(this.playerStatusBadge.text);
    this.HP_BAR_W = player.hpWidth;
  }

  // ── Sprites ───────────────────────────────────────────────────────────────

  private createSprites() {
    const rKey = (this.registry.get('rivalKey') as string) ?? 'onnurian';
    const pKey = PartySystem.get(this.registry)[this.activeSlot]?.spriteKey
               ?? (this.registry.get('starterKey') as string) ?? 'vipour';

    // Start off-screen: rival enters from top-right, player from bottom-left
    this.rivalSprite  = this.add.image(960, 60,  rKey)
      .setDepth(5).setAlpha(0).setData('battlePokemonSide', 'enemy');
    this.playerSprite = this.add.image(-80, 320,  pKey)
      .setDepth(5).setFlipX(true).setAlpha(0).setData('battlePokemonSide', 'player');
    this.fitSprite(this.rivalSprite, 168);   // enlarge the rival's Pokémon so it reads as a real threat
    this.fitSprite(this.playerSprite, 150);

    // The player and rival both have authored 2D trainer images. Keep those
    // images on Phaser's foreground while the arena itself remains 3D.
    const pAvatar = playerAvatarKey(this.registry), rAvatar = rivalAvatarKey(this.registry);
    if (this.textures.exists(pAvatar)) {
      this.playerTrainer = this.add.image(200, 268, pAvatar).setDepth(6).setAlpha(0)
        .setData('no3d', true)
        .setData('battleTrainer2DAnchor', 'player');
      fitPortrait(this.playerTrainer);
    }
    if (this.textures.exists(rAvatar)) {
      this.rivalTrainer = this.add.image(RIVAL_STAGE_X, RIVAL_STAGE_Y, rAvatar).setDepth(6).setAlpha(0).setFlipX(true)
        .setData('no3d', true)
        .setData('battleTrainer2DAnchor', 'enemy');
      fitPortrait(this.rivalTrainer);
    }
  }

  private fitSprite(img: Phaser.GameObjects.Image, targetSize: number) {
    const tex = this.textures.get(img.texture.key).getSourceImage();
    const dim = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
    img.setScale((targetSize * battle2DSpriteScale(img.texture.key)) / dim);
  }

  // ── Dialog ────────────────────────────────────────────────────────────────

  private createDialogBox() {
    this.dialogText = this.add.text(16, this.H - 112, '', {
      fontSize: '16px', color: '#ffffff', wordWrap: { width: this.W * 0.6 - 32 }, lineSpacing: 5,
    }).setDepth(10);
  }

  private typeDialog(text: string, onDone?: () => void) {
    text = tr(text);
    this.dialogText.setText('');
    let i = 0;
    const ev = this.time.addEvent({
      delay: BATTLE_PACING.dialogCharacterMs, repeat: text.length - 1,
      callback: () => {
        this.dialogText.setText(text.slice(0, ++i));
        if (i >= text.length) {
          ev.destroy();
          if (onDone) this.time.delayedCall(BATTLE_PACING.dialogHoldMs, onDone);
        }
      },
    });
  }

  // ── Action panel ──────────────────────────────────────────────────────────

  private createActionPanel() {
    this.actionPanel = this.add.container(0, this.H - 120).setDepth(10);
    const actions = [
      { label: '⚔ FIGHT', accent: 0xef776b, cb: () => this.onFight(), disabled: false },
      { label: "× CAN'T RUN", accent: 0x596573, cb: () => {}, disabled: true },
      { label: '◉ BAG', accent: 0xe0b64d, cb: () => {
        this.typeDialog(`${this.rivalTName}: No items in a fair fight!`, () => this.playerAction());
      }, disabled: false },
      { label: '◇ POKÉMON', accent: 0x62bde7, cb: () => this.onSwitchPokemon(), disabled: false },
    ];
    const left = this.W * 0.61;
    const gap = 8;
    const buttonW = (this.W - left - 16 - gap) / 2;
    actions.forEach((action, index) => modernButton(this, this.actionPanel, {
      label: tr(action.label), x: left + buttonW / 2 + (index % 2) * (buttonW + gap),
      y: 29 + Math.floor(index / 2) * 58, width: buttonW, height: 50,
      accent: action.accent, disabled: action.disabled, onPick: action.cb,
    }));
  }

  // ── Move panel ────────────────────────────────────────────────────────────

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
      width: backW, height: 102, accent: 0x60758a,
      onPick: () => { this.state = 'playerAction'; this.showActionPanel(); },
    });
  }

  // ── Battle flow ───────────────────────────────────────────────────────────

  private startIntro() {
    // Phase 1 — the rival RUNS in from the right; only then does the dialogue start.
    if (this.playerTrainer) this.tweens.add({ targets: this.playerTrainer, alpha: 1, duration: 300 });
    if (this.rivalTrainer) {
      this.rivalTrainer.setAlpha(1);
      this.rivalTrainer.x = this.W + 100;
      this.tweens.add({
        targets: this.rivalTrainer,
        x: RIVAL_STAGE_X,
        y: RIVAL_STAGE_Y,
        duration: 620,
        ease: 'Cubic.out',
        onComplete: () => this.introDialogue(),
      });
    } else {
      this.introDialogue();
    }
  }

  private introDialogue() {
    const sName = this.player.name;
    const rName = this.rival.name;   // dynamic — matches actual rival Pokémon
    this.typeDialog(`${this.rivalTName}: Hey! Stop right there.`, () => {
      this.typeDialog(`${this.rivalTName}: You think you can just leave town with ${sName}?`, () => {
        this.typeDialog(`${this.rivalTName}: I chose ${rName}.\nWe have both been waiting for this.`, () => {
          this.typeDialog(`${this.rivalTName}: We battle. Right here, right now!`, () => {
            // Phase 2 — dialogue over: the battle begins and the rival theme kicks in.
            this.revealBattle();
          });
        });
      });
    });
  }

  /** After the overworld challenge, the battle window still opens on the rival trainer
   *  (gender-based, opposite the player) standing there for a beat before sending out. */
  private enterRivalBattle() {
    pushBgm(this, 'rival');
    const portraits = [this.playerTrainer, this.rivalTrainer].filter(Boolean) as Phaser.GameObjects.Image[];
    if (portraits.length) {
      portraits.forEach((p) => p.setAlpha(0));
      this.tweens.add({ targets: portraits, alpha: 1, duration: 300 });
      this.time.delayedCall(3000, () => this.revealBattle());   // hold the trainers on screen for ~3s
    } else {
      this.revealBattle();
    }
  }

  private revealBattle() {
    pushBgm(this, 'rival');   // rival battle music starts exactly as the battle begins
    // Portraits fade out; the Pokémon take their places.
    if (this.playerTrainer) this.tweens.add({ targets: this.playerTrainer, alpha: 0, duration: 300 });
    if (this.rivalTrainer)  this.tweens.add({ targets: this.rivalTrainer, alpha: 0, duration: 300 });
    // Rival Pokémon slides in from top-right
    this.rivalSprite.setAlpha(1);
    this.tweens.add({
      targets: this.rivalSprite,
      x: RIVAL_STAGE_X, y: RIVAL_STAGE_Y,
      duration: 500, ease: 'Power2',
      onComplete: () => {
        this.typeDialog(`${this.rivalTName} sent out ${this.rival.name}!`, () => {
          // Player Pokémon slides in from bottom-left
          this.playerSprite.setAlpha(1);
          this.tweens.add({
            targets: this.playerSprite,
            x: 200, y: 258,
            duration: 500, ease: 'Power2',
            onComplete: () => {
              // Fade in HUDs
              this.tweens.add({
                targets: this.hudGroup,
                alpha: 1,
                duration: 350,
                onComplete: () => {
                  this.typeDialog(`Go! ${this.player.name}!`, () => this.playerAction());
                },
              });
            },
          });
        });
      },
    });
  }

  private playerAction() {
    // Mirror the field weather into the 3D battle (Snow Warning → 3D snowfall).
    this.events.emit('pk3d-weather', battleWeather(this.player, this.rival));
    const pending = pendingMoveFor(this.player);
    if (pending) {
      this.hideAllPanels();
      this.runTurn(pending);
      return;
    }
    this.state = 'playerAction';
    this.typeDialog('What will you do?');
    this.showActionPanel();
  }

  private onFight() {
    if (this.state !== 'playerAction') return;
    this.state = 'playerMove';
    this.refreshMovePP();
    this.showMovePanel();
    this.typeDialog('Choose a move!');
  }

  private onMoveSelected(move: Move) {
    if (this.state !== 'playerMove') return;
    if (move.pp <= 0) { this.typeDialog('No PP left!', () => this.onFight()); return; }
    // Lock the turn IMMEDIATELY so a double-fired touch tap can't run two turns
    // (both calls would otherwise pass the 'playerMove' guard and act twice).
    this.state = 'busy';
    deckHideMoves();
    this.hideAllPanels();
    this.runTurn(move);
  }

  private runTurn(playerMove: Move) {
    this.state = 'busy';
    const availableMoves = this.rival.moves.filter(m => m.pp > 0);
    const rivalMove = pendingMoveFor(this.rival) ?? (availableMoves.length > 0
      ? this.pickRivalMove(availableMoves) : this.rival.moves[0]);
    // Two-turn moves span two FULL turns — the opponent acts on both the charge and
    // release turns (its charge-turn move misses a dug-in/airborne target).
    const playerFirst = actsBefore(this.player, playerMove, this.rival, rivalMove);
    if (playerFirst) {
      this.doPlayerMove(playerMove, () => this.doRivalMove(() => this.finishTurn(() => this.playerAction()), rivalMove));
    } else {
      this.doRivalMove(() => this.doPlayerMove(playerMove, () => this.finishTurn(() => this.playerAction())), rivalMove);
    }
  }

  private doPlayerMove(playerMove: Move, onDone: () => void) {
    executeBattleMove({
      scene: this,
      user: this.player,
      target: this.rival,
      move: playerMove,
      userSprite: this.playerSprite,
      targetSprite: this.rivalSprite,
      userLabel: pokeNameEn(this.player.name).toUpperCase(),
      showDialog: (text, done) => this.typeDialog(text, done),
      animateUserHp: done => this.animateHpBar('player', done),
      animateTargetHp: done => this.animateHpBar('rival', done),
      onPpUsed: () => persistMovePP(this.registry, this.activeSlot, this.player),
      onComplete: result => {
        PartySystem.updateSlotHP(this.registry, this.activeSlot, this.player.hp, this.player.status, this.player.heldItem ?? null);
        if (this.rival.isKO) {
          this.typeDialog(`${pokeNameEn(this.rival.name).toUpperCase()} fainted!`, () => this.handleWin());
          return;
        }
        if (this.player.isKO) {
          this.typeDialog(`${pokeNameEn(this.player.name).toUpperCase()} fainted...`, () => this.rivalSendNextOrLose());
          return;
        }
        void result;
        onDone();
      },
    });
  }

  private afterPlayerAttack(_dmg: number) {
    void _dmg;
    this.doRivalMove(() => this.finishTurn(() => this.playerAction()));
  }

  /**
   * Keep the opening Grass rival capable of hurting Hakdongja without letting
   * Rock Throw dominate the fight. It is selected only 25% of eligible turns
   * and never twice in succession while another move still has PP.
   */
  private pickRivalMove(pool: Move[]): Move {
    const rockThrow = pool.find(m => m.data.name.toLowerCase() === 'rock throw');
    const alternatives = pool.filter(m => m !== rockThrow);
    const canUseRock = !!rockThrow && alternatives.length > 0
      && this.lastRivalMoveName !== 'rock throw' && Math.random() < 0.25;
    const choices = canUseRock ? [rockThrow] : (alternatives.length ? alternatives : pool);
    const selected = chooseBattleMove(this.rival, this.player, choices, 'rival', this.battleTurn, this.lastRivalMoveName);
    this.lastRivalMoveName = selected.data.name.toLowerCase();
    return selected;
  }

  private doRivalMove(onDone: () => void, selectedMove?: Move) {
    // Rival attacks back using the opening-battle frequency tuning above.
    const availableMoves = this.rival.moves.filter(m => m.pp > 0);
    const rivalMove = selectedMove ?? pendingMoveFor(this.rival) ?? (availableMoves.length > 0
      ? this.pickRivalMove(availableMoves)
      : this.rival.moves[0]);

    executeBattleMove({
      scene: this,
      user: this.rival,
      target: this.player,
      move: rivalMove,
      userSprite: this.rivalSprite,
      targetSprite: this.playerSprite,
      userLabel: `${this.rivalTName}'s ${pokeNameEn(this.rival.name).toUpperCase()}`,
      showDialog: (text, done) => this.typeDialog(text, done),
      animateUserHp: done => this.animateHpBar('rival', done),
      animateTargetHp: done => this.animateHpBar('player', done),
      onComplete: () => {
        PartySystem.updateSlotHP(this.registry, this.activeSlot, this.player.hp, this.player.status, this.player.heldItem ?? null);
        if (this.rival.isKO) {
          this.typeDialog(`${pokeNameEn(this.rival.name).toUpperCase()} fainted!`, () => this.handleWin());
          return;
        }
        if (this.player.isKO) {
          this.typeDialog(`${pokeNameEn(this.player.name).toUpperCase()} fainted...`, () => this.rivalSendNextOrLose());
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
      second: this.rival,
      animateFirst: done => this.animateHpBar('player', done),
      animateSecond: done => this.animateHpBar('rival', done),
      showDialog: (text, done) => this.typeDialog(text, done),
      onComplete: () => {
        this.battleTurn++;
        PartySystem.updateSlotHP(this.registry, this.activeSlot, this.player.hp, this.player.status, this.player.heldItem ?? null);
        if (this.rival.isKO) {
          this.typeDialog(`${pokeNameEn(this.rival.name).toUpperCase()} fainted!`, () => this.handleWin());
        } else if (this.player.isKO) {
          this.typeDialog(`${pokeNameEn(this.player.name).toUpperCase()} fainted...`, () => this.rivalSendNextOrLose());
        } else onDone();
      },
    });
  }

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
        this.typeDialog(`What will ${this.player.name} do?`);
      },
      (idx) => this.voluntarySwitch(idx),
    );
  }

  private voluntarySwitch(slotIdx: number) {
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
    snapBattleHp(this.playerHpBar, this.playerHpText, this.HP_BAR_W, this.player.hp, this.player.maxHp);

    if (this.textures.exists(entry.spriteKey)) {
      this.playerSprite.setTexture(entry.spriteKey);
      this.fitSprite(this.playerSprite, 150);
    }
    this.playerSprite.setAlpha(0);
    this.tweens.add({
      targets: this.playerSprite, alpha: 1, x: 200, y: 258, duration: 400,
      onComplete: () => {
        // Voluntary switch costs the turn — rival gets to attack
        this.typeDialog(`Go, ${this.player.name}!`, () => this.afterPlayerAttack(0));
      },
    });
  }

  private rivalSendNextOrLose() {
    if (this.resolvingFaint) return;   // a duplicate trigger for the same KO — ignore
    this.resolvingFaint = true;
    const party = PartySystem.get(this.registry);
    if (party[this.activeSlot]) { party[this.activeSlot].hp = 0; PartySystem.set(this.registry, party); }

    const nextIdx = party.findIndex((e, i) => i !== this.activeSlot && e && e.hp > 0);
    if (nextIdx === -1) { this.handleLoss(); return; }

    this.activeSlot = nextIdx;
    this.participants.add(nextIdx);
    const entry = party[nextIdx];
    this.player = buildReplacement(this.player, entry);
    syncBattleHudTypes(this.playerBattleHud, [this.player.data.type1, this.player.data.type2]);
    this.refreshMovePanel();
    this.playerNameText.setText(this.playerHudName());
    this.playerLvText.setText(`Lv.${this.player.level}`);
    snapBattleHp(this.playerHpBar, this.playerHpText, this.HP_BAR_W, this.player.hp, this.player.maxHp);

    const key = entry.spriteKey;
    if (this.textures.exists(key)) {
      this.playerSprite.setTexture(key);
      this.fitSprite(this.playerSprite, 150);
    }
    this.playerSprite.setAlpha(0);
    this.tweens.add({
      targets: this.playerSprite, alpha: 1, x: 200, y: 258, duration: 400,
      onComplete: () => {
        this.resolvingFaint = false;   // switch-in done — ready for the next KO
        this.typeDialog(`Go, ${this.player.name}!`, () => this.playerAction());
      },
    });
  }

  // ── Win / Loss ────────────────────────────────────────────────────────────

  private handleWin() {
    this.state = 'over';
    stopBgm(this);               // silence the rival theme so only the victory jingle plays
    playJingle(this, 'victory');
    this.hideAllPanels();
    this.registry.set('rivalBattleDone', true);

    const expGained  = this.rival.level * 25;  // generous: ensures level-up at level 5
    const levelledUp = this.player.gainExp(expGained);
    PartySystem.updateSlotProgress(
      this.registry, this.activeSlot,
      this.player.level, this.player.exp, this.player.hp, this.player.maxHp,
    );

    // Build the victory message from translated lines — this panel writes straight
    // to the Text object (no typeDialog), so each fragment must be tr()'d itself or
    // it renders in English. The first two lines together match a battle pattern.
    let text = tr(`${this.rivalTName}: Tch. You got me this time.\n${this.player.name} gained ${expGained} EXP!`);
    if (levelledUp) {
      this.playerLvText.setText(`Lv.${this.player.level}`);
      text += `\n${tr(`✨ ${this.player.name} grew to Lv. ${this.player.level}!`)}`;
    }
    // Other participants share the EXP too.
    for (const line of awardBenchExp(this.registry, this.participants, this.activeSlot, expGained)) {
      text += `\n${tr(line)}`;
    }
    text += `\n${tr('Returning to Waterfall City...')}`;

    this.dialogText.setText(text);

    const px = 22 * 32 + 16, py = 50 * 32 + 16;
    this.registry.set('returnX', px);
    this.registry.set('returnY', py);
    SaveManager.save(this.registry, px, py);

    this.time.delayedCall(3000, () => {
      this.cameras.main.fadeOut(600, 0, 0, 0, () => {
        this.scene.start('WorldMapScene');
      });
    });
  }

  private handleLoss() {
    this.state = 'over';
    this.hideAllPanels();

    this.dialogText.setText(
      `${t('You lost...', '패배했다...')}\n`
      + `${speakerName(this.rivalTName)}: ${t("Don't give up. Come back stronger!", '포기하지 마. 더 강해져서 돌아와!')}\n`
      + `${t('Mom healed your Pokémon at home.', '엄마가 집에서 포켓몬을 회복시켜 주었다.')}`,
    );

    this.registry.set('playerHealed', true);
    this.registry.set('rivalBattleDone', false);
    PartySystem.healAll(this.registry);

    // Return to home — safely above the rival trigger zone (row 46)
    // so checkTownExit() won't immediately re-trigger the rival cutscene
    this.registry.set('returnX', 10 * 32 + 16);   // inside player's home door
    this.registry.set('returnY', 36 * 32 + 16);

    this.time.delayedCall(3000, () => {
      this.cameras.main.fadeOut(600, 0, 0, 0, () => {
        this.scene.start('WorldMapScene');
      });
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  update(): void {
    this.rivalStatusBadge?.sync(this.rival?.status);
    this.playerStatusBadge?.sync(this.player?.status);
  }

  private refreshMovePanel() { this.movePanel.destroy(true); this.createMovePanel(); this.movePanel.setVisible(false); }
  private showActionPanel() {
    deckHideMoves();
    const onDeck = deckShowBattleActions([
      { label: 'FIGHT', onPick: () => this.onFight(), accent: '#f08a78' },
      {
        label: 'BAG', accent: '#d7b85c',
        onPick: () => this.typeDialog(`${this.rivalTName}: No items in a fair fight!`, () => this.playerAction()),
      },
      { label: 'POKÉMON', onPick: () => this.onSwitchPokemon(), accent: '#72b9df' },
      { label: "CAN'T RUN", onPick: () => {}, disabled: true },
    ]);
    this.actionPanel.setVisible(!onDeck);
    this.movePanel.setVisible(false);
  }
  private showMovePanel()   { const onDeck = deckShowMoves(this.player.moves, i => this.onMoveSelected(this.player.moves[i]), () => this.playerAction()); this.movePanel.setVisible(!onDeck); this.actionPanel.setVisible(false); }
  private hideAllPanels()   { deckHideBattleActions(); this.actionPanel.setVisible(false); this.movePanel.setVisible(false); }

  private refreshMovePP() {
    this.player.moves.forEach((move, i) => {
      const ppTxt = this.movePanel.list.find(
        (o, idx) => idx > 0 && o instanceof Phaser.GameObjects.Text &&
          (o as Phaser.GameObjects.Text).text.startsWith('PP') &&
          Math.floor((idx - 1) / 4) === i
      ) as Phaser.GameObjects.Text | undefined;
      if (ppTxt) ppTxt.setText(`PP ${move.pp}/${move.data.pp}`);
    });
  }

  private animateHpBar(who: 'player' | 'rival', onDone: () => void) {
    const pokemon = who === 'player' ? this.player : this.rival;
    const bar     = who === 'player' ? this.playerHpBar : this.rivalHpBar;
    const hpText  = who === 'player' ? this.playerHpText : this.rivalHpText;
    animateBattleHp({
      scene: this, bar, label: hpText, maxWidth: this.HP_BAR_W,
      targetHp: pokemon.hp, maxHp: pokemon.maxHp, onDone,
    });
  }
}
