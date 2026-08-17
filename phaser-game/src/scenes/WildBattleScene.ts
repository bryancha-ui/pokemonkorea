import Phaser from 'phaser';
import { pushBgm, popBgm } from '../systems/Music';
import { expMultiplierFor } from '../data/NorthernRegion';
import {
  deckShowBattleActions, deckHideBattleActions, deckShowMoves, deckHideMoves,
} from '../systems/TouchControls';
import { executeBattleMove, pendingMoveFor } from '../systems/MoveEffects';
import { battle2DSpriteScale } from '../data/SpriteScale';
import { runLevelUpLearning, runBenchLevelUpLearning } from '../systems/MoveLearning';
import type { BenchLevelUp } from '../systems/BattleExp';
import { Pokemon, Move } from '../battle/Pokemon';
import { STARTERS, findForm } from '../data/StarterData';
import { DISGUIJAR_DATA, DISGUIJAR_MOVES } from '../data/CustomPokemon';
import { customForm } from '../data/CustomBattle';
import { fetchPokemon, fetchMove } from '../data/PokeAPI';
import { PartySystem, PartyEntry, baseStatsFromData } from '../systems/PartySystem';
import { blackoutToCenter, blackoutMessage } from '../systems/Blackout';
import { tr, pokeNameEn} from '../systems/i18n';
import { awardBenchExp } from '../systems/BattleExp';
import { buildFromEntry, ensurePartyTexture, persistMovePP, persistSwitchOut } from '../systems/PartyBattle';
import { openSwitchPanel } from '../systems/SwitchPanel';
import { DexTracker } from '../systems/DexTracker';
import { LeaderboardProgress } from '../systems/LeaderboardProgress';
import { ITEMS, Inventory, itemDef, itemName, useItemOnSlot } from '../systems/Items';
import { SaveManager } from '../utils/SaveManager';
import { drawBattleBall, playBallSendOut } from '../systems/BattleBallFX';
import { genderedName, genderForPokemon } from '../data/PokemonGender';
import { caughtLocationName } from '../data/PokemonOrigin';
import { actsBefore, guaranteedEscape, preventsEscape, battleWeather } from '../systems/AbilitySystem';
import { enemyLearnset, mergeLearnset } from '../data/Learnsets';
import { BattleStatusBadge } from '../systems/BattleStatusBadge';
import { createBattleHud, hpColor, modernButton, modernMoveButton, syncBattleHudTypes, type BattleHud } from '../systems/ProductionUi';
import { animateBattleHp, BATTLE_PACING } from '../systems/BattlePacing';

type WildState = 'loading' | 'intro' | 'playerAction' | 'playerMove' | 'bag' | 'busy' | 'catching' | 'over';

const HP_W = 180;

export class WildBattleScene extends Phaser.Scene {
  private player!: Pokemon;
  private wild!: Pokemon;
  private wildCatchRate = 45;
  private ballRate = 1;
  private activeBallKey = 'pokeball';
  private state: WildState = 'loading';

  // UI
  private dialogText!: Phaser.GameObjects.Text;
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private wildHpBar!: Phaser.GameObjects.Rectangle;
  private hpW = HP_W;   // bar width — widened on mobile to fill the enlarged name box
  private playerHpText!: Phaser.GameObjects.Text;
  private wildHpText!: Phaser.GameObjects.Text;
  private playerLvText!: Phaser.GameObjects.Text;
  private playerNameText!: Phaser.GameObjects.Text;
  private wildLvText!: Phaser.GameObjects.Text;
  private wildNameText!: Phaser.GameObjects.Text;
  private playerStatusBadge?: BattleStatusBadge;
  private wildStatusBadge?: BattleStatusBadge;
  private playerBattleHud?: BattleHud;
  private wildSprite!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Image;
  private actionPanel!: Phaser.GameObjects.Container;
  private movePanel!: Phaser.GameObjects.Container;
  private bagPanel!: Phaser.GameObjects.Container;
  private ballGraphic!: Phaser.GameObjects.Graphics;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private aKey!: Phaser.Input.Keyboard.Key;

  private W = 1280;
  private H = 720;
  private activeSlot = 0;  // which party slot is currently battling
  private participants = new Set<number>([0]);   // all battlers share EXP
  private awaitingForcedSwitch = false;

  constructor() { super('WildBattleScene'); }

  preload() {
    if (!this.textures.exists('disguijar'))
      this.load.image('disguijar', 'assets/disguijar.png');
    STARTERS.forEach(s => {
      if (!this.textures.exists(s.spriteKey))
        this.load.image(s.spriteKey, s.data.spriteUrl);
    });
    PartySystem.get(this.registry).forEach(e => {
      if (e.spriteKey && e.spriteUrl && !this.textures.exists(e.spriteKey))
        this.load.image(e.spriteKey, e.spriteUrl);
    });
  }

  async create() {
    this.cameras.main.fadeIn(300);
    this.awaitingForcedSwitch = false;
    Inventory.ensureInit(this.registry);   // sync legacy Pokéballs into the item system
    this.registry.set('wildOutcome', 'none');   // set to won/caught/fled on exit (callers may gate on it)

    // Battle theme: the roaming legendaries get their own encounter music; else the wild theme.
    const wid = String(this.registry.get('wildId') ?? '');
    const LEGEND: Record<string, string> = {
      nabihalmang: 'nabihalmang', hwanwoong: 'hwanung', cheonjisin: 'cheonji',
      poongbaek: 'poongbaek', woosa: 'woosa', woonsa: 'woonsa',
    };
    pushBgm(this, LEGEND[wid] ?? 'wild');
    this.events.once('shutdown', () => { popBgm(this); deckHideBattleActions(); deckHideMoves(); });

    this.drawBackground();
    this.createDialogBox();
    this.typeDialog('Loading…');
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.aKey     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);

    // M or B opens the menu (party + bag) without interrupting the battle
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => this.scene.launch('MenuScene'));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => this.scene.launch('MenuScene'));

    await this.buildPokemon();

    this.createSprites();
    this.createHUDs();
    this.createActionPanel();
    this.createMovePanel();
    this.createBagPanel();
    this.hideAllPanels();

    this.wildCatchRate = (this.registry.get('wildCatchRate') as number) ?? 45;

    // Intro: wild Pokémon slides in
    this.wildSprite.setAlpha(0);
    this.tweens.add({
      targets: this.wildSprite, x: 560, y: 130, alpha: 1, duration: 400, ease: 'Power2',
      onComplete: () => {
        this.typeDialog(`A wild ${pokeNameEn(this.wild.name).toUpperCase()} appeared!`, () => {
          playBallSendOut(this, this.playerSprite, {
            side: 'player', targetX: 180, targetY: 260,
            onComplete: () => this.typeDialog(`Go! ${pokeNameEn(this.player.name).toUpperCase()}!`, () => this.playerAction()),
          });
        });
      },
    });
  }

  // ── Pokémon setup ─────────────────────────────────────────────────────────

  private async buildPokemon() {
    const wildId     = this.registry.get('wildId') as string | number;
    const requestedWildLevel = (this.registry.get('wildLevel') as number) ?? 5;
    // Route 2 is capped at Lv.16. Validate here as well as in the encounter
    // scene because the registry survives scene changes and old sessions can
    // otherwise carry a late-game wild level into this early road.
    const wildLevel = this.registry.get('wildReturnScene') === 'Route2Scene'
      ? Phaser.Math.Clamp(requestedWildLevel, 13, 16)
      : requestedWildLevel;
    if (wildLevel !== requestedWildLevel) this.registry.set('wildLevel', wildLevel);
    const wildCustom = !!(this.registry.get('wildCustom'));

    // Pokédex: mark this wild Pokémon as seen
    DexTracker.markSeen(this.registry, wildId);

    // Build wild Pokémon
    if (wildCustom && wildId === 'disguijar') {
      this.wild = new Pokemon(DISGUIJAR_DATA, wildLevel,
        enemyLearnset(DISGUIJAR_MOVES, 'disguijar', DISGUIJAR_DATA.type1, DISGUIJAR_DATA.type2, wildLevel));
      if (!this.textures.exists('disguijar')) {
        this.load.image('disguijar', 'assets/disguijar.png');
        await new Promise<void>(r => { this.load.once('complete', r); this.load.start(); });
      }
    } else if (wildCustom && customForm(wildId as string)) {
      // Any other custom Pokédex Pokémon
      const cf = customForm(wildId as string)!;
      this.wild = new Pokemon(cf.data, wildLevel,
        enemyLearnset(cf.moves, wildId as string, cf.data.type1, cf.data.type2, wildLevel));
      if (!this.textures.exists(wildId as string)) {
        this.load.image(wildId as string, cf.data.spriteUrl);
        await new Promise<void>(r => { this.load.once('complete', r); this.load.start(); });
      }
    } else {
      const [data, ...moves] = await Promise.all([
        fetchPokemon(wildId as number),
        fetchMove('tackle'),
        fetchMove('growl'),
      ]);
      // Load sprite from PokéAPI
      if (!this.textures.exists(`wild-${wildId}`)) {
        this.load.image(`wild-${wildId}`, data.spriteUrl);
        await new Promise<void>(r => { this.load.once('complete', r); this.load.start(); });
      }
      data.spriteUrl = `//${data.spriteUrl.split('//')[1]}`;
      this.wild = new Pokemon(data, wildLevel,
        enemyLearnset(moves, `wild-${wildId}`, data.type1, data.type2, wildLevel));
    }

    // Build player Pokémon from party slot 0 (party entry is the source of truth)
    PartySystem.syncSlot0FromStarter(this.registry);
    const party = PartySystem.get(this.registry);
    // Lead with the first NON-fainted Pokémon so a fainted lead never enters battle.
    this.activeSlot = Math.max(0, party.findIndex(e => e && e.hp > 0));
    if (party.length > 0) {
      this.player = buildFromEntry(party[this.activeSlot]);
      this.participants = new Set<number>([this.activeSlot]);
    } else {
      const starterKey   = (this.registry.get('starterKey')  as string) ?? 'vipour';
      const starterLevel = (this.registry.get('starterLevel') as number) ?? 5;
      const def = (findForm(starterKey)) ?? STARTERS[1];
      this.player = new Pokemon(def.data, starterLevel,
        mergeLearnset(def.startingMoves, def.spriteKey, def.data.type1, def.data.type2, starterLevel));
      this.player.exp = (this.registry.get('starterExp') as number) ?? 0;
    }
  }

  // ── Background ────────────────────────────────────────────────────────────

  private drawBackground() {
    const g = this.add.graphics();
    g.fillStyle(0x6688bb, 1); g.fillRect(0, 0, this.W, 300);
    g.fillStyle(0x4a7a3a, 1); g.fillRect(0, 200, this.W, this.H - 320);   // green field down to the dialog box (no black gap)
    g.fillStyle(0x8a9a6a, 1);
    g.fillTriangle(0, 200, 150, 80, 300, 200);
    g.fillTriangle(200, 200, 400, 60, 600, 200);
    g.fillStyle(0xb09060, 1); g.fillEllipse(180, 280, 160, 28);
    g.fillEllipse(580, 155, 120, 22);
    g.fillStyle(0x0d0d2e, 0.96); g.fillRect(0, this.H - 120, this.W, 120);
    g.lineStyle(2, 0x5577aa, 1); g.lineBetween(0, this.H - 120, this.W, this.H - 120);
    this.add.text(this.W / 2, this.H - 108, tr('▶ SPACE to advance  |  A to throw Pokéball'), {
      fontSize: '11px', color: '#5577aa',
    }).setOrigin(0.5).setDepth(2);
  }

  // ── HUDs ──────────────────────────────────────────────────────────────────

  private wildGenderSeed(): string {
    const wildId = this.registry.get('wildId') as string | number;
    return `wild-${String(wildId)}-${this.wild.level}`;
  }

  private wildHudName(): string {
    const wildId = this.registry.get('wildId') as string | number;
    return genderedName(pokeNameEn(this.wild.name).toUpperCase(), {
      name: this.wild.name,
      key: typeof wildId === 'string' ? wildId : `wild-${wildId}`,
      id: this.wild.data.id,
    }, this.wildGenderSeed());
  }

  private playerHudName(): string {
    const entry = PartySystem.get(this.registry)[this.activeSlot];
    return genderedName(pokeNameEn(this.player.name).toUpperCase(), {
      name: this.player.name,
      key: entry?.spriteKey,
      id: this.player.data.id,
      gender: entry?.gender,
    }, entry?.breedingId ?? `party-${this.activeSlot}`);
  }

  private createHUDs() {
    const wild = createBattleHud(this, {
      side: 'enemy', name: this.wildHudName(), level: this.wild.level,
      hp: this.wild.hp, maxHp: this.wild.maxHp,
      types: [this.wild.data.type1, this.wild.data.type2],
    });
    this.wildNameText = wild.nameText;
    this.wildLvText = wild.levelText;
    this.wildHpBar = wild.hpBar;
    this.wildHpText = wild.hpText;
    this.wildStatusBadge = new BattleStatusBadge(this.wildNameText, () => this.wildLvText.x - 34);

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

  // ── Sprites ───────────────────────────────────────────────────────────────

  private createSprites() {
    const wildId = this.registry.get('wildId') as string | number;
    const wKey = this.wild.data.id === 904
      ? 'disguijar'
      : customForm(wildId as string)
        ? (wildId as string)               // custom Pokédex key
        : `wild-${wildId}`;                 // PokéAPI
    const pKey = PartySystem.get(this.registry)[this.activeSlot]?.spriteKey
               ?? (this.registry.get('starterKey') as string) ?? 'vipour';

    this.wildSprite   = this.add.image(900, 60, this.textures.exists(wKey) ? wKey : 'disguijar')
      .setDepth(5).setAlpha(0).setData('battlePokemonSide', 'enemy');
    this.playerSprite = this.add.image(-80, 320, pKey)
      .setDepth(5).setFlipX(true).setAlpha(0).setData('battlePokemonSide', 'player');

    const fitImg = (img: Phaser.GameObjects.Image, size: number) => {
      const tex = this.textures.get(img.texture.key).getSourceImage();
      const dim = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
      img.setScale((size * battle2DSpriteScale(img.texture.key)) / dim);
    };
    fitImg(this.wildSprite, 130);
    fitImg(this.playerSprite, 140);
  }

  // ── Dialog ────────────────────────────────────────────────────────────────

  private createDialogBox() {
    this.dialogText = this.add.text(16, this.H - 108, '', {
      fontSize: '16px', color: '#fff',
      wordWrap: { width: this.W * 0.58 }, lineSpacing: 5,
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
      { label: '⚔ FIGHT', accent: 0xef776b, cb: () => this.onFight() },
      { label: '◉ BAG', accent: 0xe0b64d, cb: () => this.onBag() },
      { label: '◇ POKÉMON', accent: 0x62bde7, cb: () => this.onSwitchPokemon() },
      { label: '↗ RUN', accent: 0x6bc481, cb: () => this.onRun() },
    ];
    const left = this.W * 0.61;
    const gap = 8;
    const buttonW = (this.W - left - 16 - gap) / 2;
    actions.forEach((action, index) => {
      modernButton(this, this.actionPanel, {
        label: tr(action.label), x: left + buttonW / 2 + (index % 2) * (buttonW + gap),
        y: 29 + Math.floor(index / 2) * 58, width: buttonW, height: 50,
        accent: action.accent, onPick: action.cb,
      });
    });
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
      width: backW, height: 102, accent: 0x60758a, onPick: () => this.playerAction(),
    });
  }

  // ── Bag panel ─────────────────────────────────────────────────────────────

  private createBagPanel() {
    this.bagPanel = this.add.container(0, this.H - 120).setDepth(10).setVisible(false);
    this.rebuildBagPanel();
  }

  /** Rebuild the in-battle bag from the current inventory (balls + heals). */
  private rebuildBagPanel() {
    this.bagPanel.removeAll(true);
    const bg = this.add.rectangle(this.W / 2, 60, this.W - 16, 120, 0x111133, 0.95).setStrokeStyle(1, 0x5577aa);
    this.bagPanel.add(bg);
    this.bagPanel.add(this.add.text(this.W - 30, 10, tr('← BACK'), { fontSize: '12px', color: '#aaa' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.playerAction()));

    // Show owned balls + healing/status items
    const inv = Inventory.all(this.registry);
    const usable = ITEMS.filter(it => (inv[it.key] ?? 0) > 0 &&
      (it.category === 'ball' || it.category === 'heal' || it.category === 'status' || it.category === 'revive'));

    const cols = [20, 250, 480, 710];
    usable.slice(0, 8).forEach((def, i) => {
      const x = cols[i % 4], y = 18 + Math.floor(i / 4) * 50;
      const r = this.add.rectangle(x + 100, y + 14, 210, 40, def.category === 'ball' ? 0x1a2a4a : 0x1a3a2a)
        .setStrokeStyle(1, 0x3a5a8a).setInteractive({ useHandCursor: true });
      this.bagPanel.add(r);
      this.bagPanel.add(this.add.text(x + 8, y + 4, `${def.icon} ${itemName(def)}`, { fontSize: '13px', color: '#fff', fontStyle: 'bold' }));
      this.bagPanel.add(this.add.text(x + 8, y + 20, `×${inv[def.key]}`, { fontSize: '11px', color: '#ffe44e' }));
      r.on('pointerover', () => r.setFillStyle(def.category === 'ball' ? 0x2a4a7a : 0x2a5a3a));
      r.on('pointerout',  () => r.setFillStyle(def.category === 'ball' ? 0x1a2a4a : 0x1a3a2a));
      r.on('pointerdown', () => {
        if (def.category === 'ball') this.throwBall(def.key);
        else this.useHealItem(def.key);
      });
    });
  }

  private useHealItem(itemKey: string) {
    if (this.state !== 'bag') return;
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
    if (slot === this.activeSlot) {
      const e = PartySystem.get(this.registry)[this.activeSlot];
      if (e) this.player.hp = e.hp;
    }
    this.hideAllPanels();
    this.state = 'busy';
    const finish = () => this.typeDialog(r.message, () => this.enemyTurn(null));   // using an item costs the turn
    if (slot === this.activeSlot) this.animateHpBar('player', finish); else finish();
  }

  // ── Battle flow ───────────────────────────────────────────────────────────

  private playerAction() {
    const pending = pendingMoveFor(this.player);
    if (pending) {
      this.hideAllPanels();
      this.runTurn(pending);
      return;
    }
    this.state = 'playerAction';
    const balls = (this.registry.get('pokeballs') as number) ?? 0;
    this.typeDialog(`What will ${pokeNameEn(this.player.name).toUpperCase()} do?  🔴×${balls}`);
    this.showActionPanel();
  }

  private onFight() {
    if (this.state !== 'playerAction') return;
    this.state = 'playerMove';
    this.refreshMovePanel();   // rebuild so PP counts reflect moves used this battle
    this.showMovePanel();
    this.typeDialog('Choose a move!');
  }

  private onBag() {
    if (this.state !== 'playerAction' && this.state !== 'bag') return;
    this.state = 'bag';
    this.rebuildBagPanel();
    this.hideAllPanels();
    this.bagPanel.setVisible(true);
    this.typeDialog('Choose an item!');
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

  private onRun() {
    if (this.state !== 'playerAction') return;
    // Run success check (simplified: 50% + speed advantage)
    const runChance = 0.5 + (this.player.spd - this.wild.spd) / 200;
    if (!guaranteedEscape(this.player) && preventsEscape(this.wild)) {
      this.typeDialog(`${this.wild.name}'s Shadow Tag prevents escape!`, () => this.enemyTurn(null));
    } else if (guaranteedEscape(this.player) || Math.random() < runChance) {
      this.registry.set('wildOutcome', 'fled');
      this.typeDialog('Got away safely!', () => this.returnToRoute());
    } else {
      this.typeDialog("Can't escape!", () => {
        this.enemyTurn(null);
      });
    }
  }

  // ── Pokéball throw ────────────────────────────────────────────────────────

  private throwBall(ballKey = 'pokeball') {
    if (this.state !== 'bag' && this.state !== 'playerAction') return;
    if (Inventory.count(this.registry, ballKey) <= 0) {
      this.typeDialog('You have none of that ball!', () => this.onBag());
      return;
    }
    // Lock the action before mutating inventory and require the removal to
    // succeed. Rebuild the hidden panel immediately so opening the bag/menu
    // during the animation can never show the pre-throw Master Ball count.
    this.state = 'catching';
    if (!Inventory.remove(this.registry, ballKey, 1)) {
      this.state = 'bag';
      this.typeDialog('You have none of that ball!', () => this.onBag());
      return;
    }
    this.rebuildBagPanel();
    this.ballRate = itemDef(ballKey)?.ballRate ?? 1;
    this.activeBallKey = ballKey;
    this.hideAllPanels();

    // Ball animation
    if (!this.ballGraphic) {
      this.ballGraphic = this.add.graphics().setDepth(20);
    }
    const ballG = this.ballGraphic;
    const startX = 200, startY = 260;
    // In 3D mode the visible Pokémon no longer occupies the hidden 2D sprite's
    // coordinates. BattleMirror replaces these fallbacks with the live screen
    // projection of the 3D model's torso.
    const target = { target: this.wildSprite, x: this.wildSprite.x, y: this.wildSprite.y, heightRatio: 0.52 };
    this.events.emit('pk3d-screen-target', target);
    const endX = target.x;
    const endY = target.y;

    const drawBall = (x: number, y: number, tilt = 0) =>
      drawBattleBall(ballG, x, y, this.activeBallKey, 10, 0, tilt);
    drawBall(startX, startY);

    this.typeDialog(`${pokeNameEn(this.player.name).toUpperCase()} threw a ${itemDef(ballKey)?.name ?? 'Poké Ball'}!`);

    // Throw tween
    this.tweens.add({
      targets: { t: 0 },
      t: 1,
      duration: 500,
      ease: 'Power1',
      onUpdate: (_, obj: { t: number }) => {
        const t = obj.t;
        const bx = startX + (endX - startX) * t;
        const by = startY + (endY - startY) * t - Math.sin(t * Math.PI) * 80;
        drawBall(bx, by, t * Math.PI * 6);
      },
      onComplete: () => {
        // Wild Pokémon disappears
        this.wildSprite.setVisible(false);
        ballG.clear();
        drawBall(endX, endY);

        // Shake sequence
        this.doCatchShakes(endX, endY);
      },
    });
  }

  private doCatchShakes(bx: number, by: number) {
    const catchProb = this.ballRate >= 255 ? 1 : Math.min(0.99,
      (this.wildCatchRate / 255) *
      ((3 * this.wild.maxHp - 2 * this.wild.hp) / (3 * this.wild.maxHp)) *
      this.ballRate,
    );
    const caught = Math.random() < catchProb;
    const shakes = caught ? 3 : Math.floor(Math.random() * 3);

    let s = 0;
    const doShake = () => {
      if (s >= shakes) {
        this.time.delayedCall(400, () => {
          if (caught) {
            this.onCaught(bx, by);
          } else {
            this.ballGraphic.clear();
            this.wildSprite.setVisible(true);
            // A failed catch costs your turn — the wild Pokémon now attacks.
            this.typeDialog(`Oh no! ${pokeNameEn(this.wild.name).toUpperCase()} broke free!`, () => this.enemyTurn(null));
          }
        });
        return;
      }
      this.tweens.add({
        targets: { t: 0 }, t: 1, duration: 350,
        onUpdate: (_, obj: { t: number }) => {
          const offset = Math.sin(obj.t * Math.PI * 2) * 8;
          drawBattleBall(this.ballGraphic, bx + offset, by, this.activeBallKey, 10, 0, obj.t * Math.PI * 2);
        },
        onComplete: () => { s++; this.time.delayedCall(200, doShake); },
      });
    };
    doShake();
  }

  private onCaught(bx: number, by: number) {
    this.registry.set('wildOutcome', 'caught');
    // Sparkle effect
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const star = this.add.text(bx, by, '✨', { fontSize: '14px' }).setDepth(25);
      this.tweens.add({
        targets: star,
        x: bx + Math.cos(angle) * 40,
        y: by + Math.sin(angle) * 40,
        alpha: 0, duration: 800,
        onComplete: () => star.destroy(),
      });
    }
    this.ballGraphic.clear();

    // Add to party
    const wildId  = this.registry.get('wildId') as string | number;
    const isCust  = !!customForm(wildId as string) || this.wild.data.id === 904;
    const sprKey  = this.wild.data.id === 904 ? 'disguijar'
                  : isCust ? (wildId as string)
                  : `wild-${wildId}`;
    const entry: PartyEntry = {
      name:      this.wild.name,
      level:     this.wild.level,
      hp:        this.wild.hp,
      maxHp:     this.wild.maxHp,
      type1:     this.wild.data.type1,
      type2:     this.wild.data.type2,
      spriteKey: sprKey,
      spriteUrl: this.wild.data.spriteUrl,
      isCustom:  isCust,
      moves:     this.wild.moves.map(m => m.data.name),
      ability:   this.wild.data.ability,
      caughtAt:  caughtLocationName((this.registry.get('wildReturnScene') as string | undefined)
        ?? (this.registry.get('lastScene') as string | undefined)),
      baseStats: baseStatsFromData(this.wild.data),
      gender:    genderForPokemon(
        { name: this.wild.name, key: sprKey, id: this.wild.data.id },
        this.wildGenderSeed(),
      ),
      exp:       0,
    };

    DexTracker.markCaught(this.registry, this.registry.get('wildId') as string | number);
    LeaderboardProgress.recordWildCatch(this.registry);
    const name = pokeNameEn(this.wild.name).toUpperCase();
    const captureExp = Math.round(this.wild.level * 12 * expMultiplierFor(this.registry));   // capture rewards EXP to all battlers too (northern boost applies)
    // A full-party capture may replace a slot that participated in this battle.
    // Let that battler finish receiving its capture EXP before the replacement is
    // committed, otherwise showExpAndLevelUp would write the old battler's level
    // into the freshly caught Pokémon now occupying the same numeric slot.
    const finish = (afterExp: () => void = () => this.returnToRoute()) =>
      this.showExpAndLevelUp(captureExp, afterExp);

    if (!PartySystem.isFull(this.registry)) {
      PartySystem.add(this.registry, entry);
      this.saveAfterCatch();
      this.typeDialog(`✨ Gotcha! ${name} was caught!\nAdded to your party!`, () => finish());
    } else {
      // Party is full — let the player swap a Pokémon in or send the new one to the PC.
      this.typeDialog(`✨ Gotcha! ${name} was caught!\nBut your party is full.`,
        () => this.promptFullParty(entry, finish));
    }
  }

  /** Save against the resumable scene the player came from (not the WorldMap default). */
  private saveAfterCatch() {
    const sc = (this.registry.get('lastScene') as string)
      ?? (this.registry.get('wildReturnScene') as string) ?? 'WorldMapScene';
    const sx = (this.registry.get('lastX') as number) ?? this.px;
    const sy = (this.registry.get('lastY') as number) ?? this.py;
    SaveManager.save(this.registry, sx, sy, sc);
  }

  /** Party-full choice: swap a party member (it goes to the PC) or box the newcomer. */
  private promptFullParty(entry: PartyEntry, awardCaptureExp: (afterExp?: () => void) => void) {
    const cx = this.W / 2, cy = this.H / 2;
    const layer = this.add.container(0, 0).setDepth(60);
    layer.add(this.add.rectangle(cx, cy, this.W, this.H, 0x000000, 0.62));
    layer.add(this.add.rectangle(cx, cy, 500, 200, 0x10142a, 0.99).setStrokeStyle(2, 0x5577aa));
    layer.add(this.add.text(cx, cy - 58, tr('Your party is full!'), { fontSize: '18px', color: '#ffe44e', fontStyle: 'bold' }).setOrigin(0.5));
    layer.add(this.add.text(cx, cy - 26, `Swap a Pokémon for ${pokeNameEn(entry.name).toUpperCase()}, or send it to the PC?`, { fontSize: '13px', color: '#cde' }).setOrigin(0.5));

    const btn = (x: number, label: string, bg: string, onClick: () => void) => {
      const b = this.add.text(x, cy + 42, label, { fontSize: '15px', color: '#fff', backgroundColor: bg, padding: { x: 14, y: 9 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      b.on('pointerdown', onClick);
      layer.add(b);
    };
    btn(cx - 120, '↔  Swap a Pokémon', '#2a5a8a', () => { layer.destroy(true); this.swapForCaught(entry, awardCaptureExp); });
    btn(cx + 120, '📦  Send to PC', '#3a6a3a', () => {
      layer.destroy(true);
      PartySystem.boxAdd(this.registry, entry);
      this.saveAfterCatch();
      this.typeDialog(`${pokeNameEn(entry.name).toUpperCase()} was sent to the PC.`, () => awardCaptureExp());
    });
  }

  /** Pick a party member to send to the PC; the caught Pokémon takes its place. */
  private swapForCaught(entry: PartyEntry, awardCaptureExp: (afterExp?: () => void) => void) {
    openSwitchPanel(
      this, -1,
      () => this.promptFullParty(entry, awardCaptureExp),   // cancel → back to the choice
      (idx) => {
        // Keep the selected Pokémon in its original slot until every participant's
        // live battle state (level, EXP, HP and learned moves) has been persisted.
        awardCaptureExp(() => {
          const party = PartySystem.get(this.registry);
          const out = party[idx];
          if (!out) {
            // Defensive fallback for malformed/externally edited saves: never
            // discard the caught Pokémon just because the chosen slot vanished.
            PartySystem.boxAdd(this.registry, entry);
            this.saveAfterCatch();
            this.typeDialog(`${pokeNameEn(entry.name).toUpperCase()} was sent to the PC.`, () => this.returnToRoute());
            return;
          }
          party[idx] = entry;
          PartySystem.set(this.registry, party);
          // If the newcomer took the lead slot, re-point the legacy starter mirror at it,
          // otherwise the old lead's level (in starterLevel) gets forced back onto it.
          if (idx === 0) PartySystem.syncStarterFromLead(this.registry);
          PartySystem.boxAdd(this.registry, out);
          this.saveAfterCatch();
          this.typeDialog(`${pokeNameEn(entry.name).toUpperCase()} joined the party!\n${out.name.toUpperCase()} was sent to the PC.`, () => this.returnToRoute());
        });
      },
      true,          // allow cancel
      () => true,    // any of the 6 can be sent out
      'Send which Pokémon to the PC?',
    );
  }

  // ── Turn logic ────────────────────────────────────────────────────────────

  private runTurn(playerMove: Move) {
    this.state = 'busy';
    const available = this.wild.moves.filter(m => m.pp > 0);
    const wildMove = pendingMoveFor(this.wild)
      ?? (available.length ? available[Math.floor(Math.random() * available.length)] : this.wild.moves[0]);
    // Two-turn moves span two FULL turns — the opponent acts on both the charge and
    // release turns (its charge-turn move misses a dug-in/airborne target).
    const playerFirst = actsBefore(this.player, playerMove, this.wild, wildMove);
    if (playerFirst) {
      this.doPlayerMove(playerMove, () => this.doWildMove(() => this.playerAction(), wildMove));
    } else {
      this.doWildMove(() => this.doPlayerMove(playerMove, () => this.playerAction()), wildMove);
    }
  }

  private doPlayerMove(playerMove: Move, onDone: () => void) {
    executeBattleMove({
      scene: this,
      user: this.player,
      target: this.wild,
      move: playerMove,
      userSprite: this.playerSprite,
      targetSprite: this.wildSprite,
      userLabel: pokeNameEn(this.player.name).toUpperCase(),
      showDialog: (text, done) => this.typeDialog(text, done),
      animateUserHp: done => this.animateHpBar('player', done),
      animateTargetHp: done => this.animateHpBar('wild', done),
      onPpUsed: () => persistMovePP(this.registry, this.activeSlot, this.player),
      onComplete: () => {
        PartySystem.updateSlotHP(this.registry, this.activeSlot, this.player.hp, this.player.status);
        if (this.wild.isKO) {
          this.typeDialog(`${pokeNameEn(this.wild.name).toUpperCase()} fainted!`, () => {
            this.registry.set('wildOutcome', 'won');
            const gained = Math.round(this.wild.level * 15 * expMultiplierFor(this.registry));
            this.showExpAndLevelUp(gained, () => this.returnToRoute());
          });
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

  /** The wild Pokémon attacks (also used standalone after item use / a failed run). */
  private enemyTurn(_: null) { void _; this.doWildMove(() => this.playerAction()); }

  private doWildMove(onDone: () => void, selectedMove?: Move) {
    const available = this.wild.moves.filter(m => m.pp > 0);
    const move = selectedMove ?? pendingMoveFor(this.wild)
      ?? (available.length ? available[Math.floor(Math.random() * available.length)] : this.wild.moves[0]);
    executeBattleMove({
      scene: this,
      user: this.wild,
      target: this.player,
      move,
      userSprite: this.wildSprite,
      targetSprite: this.playerSprite,
      userLabel: `Wild ${pokeNameEn(this.wild.name).toUpperCase()}`,
      showDialog: (text, done) => this.typeDialog(text, done),
      animateUserHp: done => this.animateHpBar('wild', done),
      animateTargetHp: done => this.animateHpBar('player', done),
      onComplete: () => {
        PartySystem.updateSlotHP(this.registry, this.activeSlot, this.player.hp, this.player.status);
        if (this.wild.isKO) {
          this.typeDialog(`${pokeNameEn(this.wild.name).toUpperCase()} fainted!`, () => {
            this.registry.set('wildOutcome', 'won');
            const gained = Math.round(this.wild.level * 15 * expMultiplierFor(this.registry));
            this.showExpAndLevelUp(gained, () => this.returnToRoute());
          });
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  update(): void {
    this.wildStatusBadge?.sync(this.wild?.status);
    this.playerStatusBadge?.sync(this.player?.status);
  }

  private get px() { return (this.registry.get('routeReturnX') as number) ?? 0; }
  private get py() { return (this.registry.get('routeReturnY') as number) ?? 0; }

  private showActionPanel() {
    deckHideMoves();
    const onDeck = deckShowBattleActions([
      { label: 'FIGHT', onPick: () => this.onFight(), accent: '#f08a78' },
      { label: '🔴 BAG', onPick: () => this.onBag(), accent: '#d7b85c' },
      { label: 'POKÉMON', onPick: () => this.onSwitchPokemon(), accent: '#72b9df' },
      { label: 'RUN', onPick: () => this.onRun(), accent: '#86c985' },
    ]);
    this.actionPanel.setVisible(!onDeck);
    this.movePanel.setVisible(false);
    this.bagPanel.setVisible(false);
  }
  private showMovePanel()   { const onDeck = deckShowMoves(this.player.moves, i => this.onMoveSelected(this.player.moves[i]), () => this.playerAction()); this.movePanel.setVisible(!onDeck); this.actionPanel.setVisible(false); this.bagPanel.setVisible(false); }
  private hideAllPanels()   { deckHideBattleActions(); this.actionPanel.setVisible(false); this.movePanel.setVisible(false); this.bagPanel.setVisible(false); }
  private refreshMovePanel() { this.movePanel.destroy(true); this.createMovePanel(); this.movePanel.setVisible(false); }

  private animateHpBar(who: 'player' | 'wild', onDone: () => void) {
    const mon   = who === 'player' ? this.player  : this.wild;
    const bar   = who === 'player' ? this.playerHpBar : this.wildHpBar;
    const label = who === 'player' ? this.playerHpText : this.wildHpText;
    animateBattleHp({
      scene: this, bar, label, maxWidth: this.hpW,
      targetHp: mon.hp, maxHp: mon.maxHp, onDone,
    });
  }

  protected showExpAndLevelUp(expGained: number, onDone: () => void) {
    // this.player.exp already carries the active Pokémon's EXP (from buildFromEntry)
    const levelsGained: number[] = [];
    let levelled = this.player.gainExp(expGained);
    while (levelled) {
      levelsGained.push(this.player.level);
      levelled = this.player.gainExp(0);  // check overflow
    }

    // Persist level + exp + hp to the active party slot (source of truth)
    PartySystem.updateSlotProgress(
      this.registry, this.activeSlot,
      this.player.level, this.player.exp, this.player.hp, this.player.maxHp,
    );

    // Every other Pokémon that participated also gains EXP.
    const bench: BenchLevelUp[] = [];
    const benchLines = awardBenchExp(this.registry, this.participants, this.activeSlot, expGained, bench);
    // After the bench-EXP notices, prompt for any benched Pokémon that leveled up
    // so a shared-EXP level never silently swaps one of their moves.
    const after = () => this.playBenchLines(benchLines, () =>
      runBenchLevelUpLearning(this, bench, (msg, cb) => this.typeDialog(msg, cb), onDone));

    // Show message
    const expMsg = `${pokeNameEn(this.player.name).toUpperCase()} gained ${expGained} EXP!`;
    if (levelsGained.length > 0) {
      const lv = levelsGained[levelsGained.length - 1];
      this.typeDialog(expMsg, () => {
        this.playerLvText.setText(`Lv.${lv}`);
        this.animateHpBar('player', () => {
          this.typeDialog(`✨ ${pokeNameEn(this.player.name).toUpperCase()} grew to Lv. ${lv}!\nMax HP: ${this.player.maxHp}`, () => {
            runLevelUpLearning(this, this.activeSlot, this.player, levelsGained[0] - 1, this.player.level,
              (t, cb) => this.typeDialog(t, cb), after);
          });
        });
      });
    } else {
      const needed = this.player.expToNextLevel() - this.player.exp;
      this.typeDialog(`${expMsg}  (${needed} to next level)`, after);
    }
  }

  private playBenchLines(lines: string[], onDone: () => void) {
    if (lines.length === 0) { onDone(); return; }
    this.typeDialog(lines[0], () => this.playBenchLines(lines.slice(1), onDone));
  }

  // ── Party switching ───────────────────────────────────────────────────────

  private onSwitchPokemon() {
    if (this.state !== 'playerAction') return;
    // Lock the turn before the modal opens. Touch input can emit both a direct
    // action and a synthetic key event; neither may open or commit a second
    // switch while the first choice is pending.
    this.state = 'busy';
    this.hideAllPanels();
    openSwitchPanel(
      this,
      this.activeSlot,
      () => {
        this.state = 'playerAction';
        this.showActionPanel();
        this.typeDialog(`What will ${pokeNameEn(this.player.name).toUpperCase()} do?`);
      },
      (idx) => this.voluntarySwitch(idx),
    );
  }

  private async voluntarySwitch(slotIdx: number) {
    this.state = 'busy';
    persistSwitchOut(this.registry, this.activeSlot, this.player);
    this.activeSlot = slotIdx;
    this.participants.add(slotIdx);
    const party = PartySystem.get(this.registry);
    const entry = party[slotIdx];
    this.player = buildFromEntry(entry);
    syncBattleHudTypes(this.playerBattleHud, [this.player.data.type1, this.player.data.type2]);
    this.refreshMovePanel();

    this.playerNameText.setText(this.playerHudName());
    this.playerLvText.setText(`Lv.${this.player.level}`);
    const switchRatio = Phaser.Math.Clamp(this.player.hp / this.player.maxHp, 0, 1);
    this.playerHpBar.fillColor = hpColor(switchRatio);
    this.playerHpBar.width     = this.hpW * switchRatio;
    this.playerHpText.setText(`${this.player.hp}/${this.player.maxHp}`);

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
      onComplete: () => this.typeDialog(`Go, ${pokeNameEn(this.player.name).toUpperCase()}!`, () => {
        // Voluntary switch costs the turn — enemy attacks
        this.enemyTurn(null);
      }),
    });
  }

  private sendNextOrLose() {
    if (this.awaitingForcedSwitch) return;
    const party = PartySystem.get(this.registry);

    // Mark current slot fainted
    if (party[this.activeSlot]) {
      party[this.activeSlot].hp = 0;
      PartySystem.set(this.registry, party);
    }

    // All Pokémon fainted → whiteout to the nearest Pokémon Center.
    if (!party.some((e, i) => i !== this.activeSlot && e.hp > 0)) {
      this.typeDialog('You have no more Pokémon!', () => {
        this.typeDialog(blackoutMessage(this.registry), () => blackoutToCenter(this));
      });
      return;
    }

    // Let the player choose the next Pokémon (forced switch — no cancel).
    this.state = 'busy';
    this.hideAllPanels();
    this.typeDialog('Choose your next Pokémon!');
    this.awaitingForcedSwitch = true;
    openSwitchPanel(this, this.activeSlot, () => {}, (idx) => this.sendInChosen(idx), false);
  }

  private async sendInChosen(nextIdx: number) {
    if (!this.awaitingForcedSwitch) return;
    this.awaitingForcedSwitch = false;
    this.state = 'busy';
    this.activeSlot = nextIdx;
    this.participants.add(nextIdx);
    const nextEntry = PartySystem.get(this.registry)[nextIdx];
    this.player = buildFromEntry(nextEntry);
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
    const key = nextEntry.spriteKey;
    await ensurePartyTexture(this, nextEntry);
    if (this.textures.exists(key)) {
      this.playerSprite.setTexture(key);
      const tex2 = this.textures.get(key).getSourceImage();
      const dim2 = Math.max((tex2.width as number) || 1, (tex2.height as number) || 1);
      this.playerSprite.setScale((140 * battle2DSpriteScale(key)) / dim2);
    }
    playBallSendOut(this, this.playerSprite, {
      side: 'player', targetX: 180, targetY: 260,
      onComplete: () => this.typeDialog(`Go, ${pokeNameEn(this.player.name).toUpperCase()}!`, () => this.playerAction()),
    });
  }

  private returnToRoute() {
    const back = (this.registry.get('wildReturnScene') as string) ?? 'RouteScene';
    SaveManager.save(this.registry, this.px, this.py, back);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start(back));
  }
}
