import Phaser from 'phaser';
import { pushBgm, popBgm, stopBgm, playJingle, TRACKS } from '../systems/Music';
import {
  deckShowBattleActions, deckHideBattleActions, deckShowMoves, deckHideMoves,
} from '../systems/TouchControls';
import { executeBattleMove, pendingMoveFor } from '../systems/MoveEffects';
import { battle2DSpriteScale } from '../data/SpriteScale';
import { Pokemon, Move } from '../battle/Pokemon';
import { STARTERS, TYPE_COLORS, findForm } from '../data/StarterData';
import { SaveManager } from '../utils/SaveManager';
import { PartySystem } from '../systems/PartySystem';
import { awardBenchExp } from '../systems/BattleExp';
import { buildFromEntry, persistMovePP, persistSwitchOut } from '../systems/PartyBattle';
import { openSwitchPanel } from '../systems/SwitchPanel';
import { DexTracker } from '../systems/DexTracker';
import { AVATAR_URL, playerAvatarKey, rivalAvatarKey } from '../data/PlayerAvatar';
import { fitPortrait } from '../data/BattlePortraits';
import { rivalTrainerName } from '../data/CharacterSprite';
import { tr, pokeNameEn} from '../systems/i18n';
import { fontScaleForScene } from '../systems/UiScale';
import { genderedName } from '../data/PokemonGender';
import { actsBefore } from '../systems/AbilitySystem';
import { enemyLearnset, mergeLearnset } from '../data/Learnsets';
import { BattleStatusBadge } from '../systems/BattleStatusBadge';

type BattleState = 'intro' | 'playerAction' | 'playerMove' | 'busy' | 'levelUp' | 'over';
const RIVAL_STAGE_X = 580;
const RIVAL_STAGE_Y = 130;

export class RivalBattleScene extends Phaser.Scene {
  private player!: Pokemon;
  private rival!: Pokemon;
  private state: BattleState = 'intro';
  private lastRivalMoveName = '';
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
  private playerSprite!: Phaser.GameObjects.Image;
  private rivalSprite!: Phaser.GameObjects.Image;
  private playerTrainer?: Phaser.GameObjects.Image;
  private rivalTrainer?: Phaser.GameObjects.Image;
  private actionPanel!: Phaser.GameObjects.Container;
  private movePanel!: Phaser.GameObjects.Container;
  private moveBtns: Phaser.GameObjects.Text[] = [];
  private spaceKey!: Phaser.Input.Keyboard.Key;
  // All battle-visible elements hidden until after the intro dialogue
  private hudGroup: Phaser.GameObjects.GameObject[] = [];

  private W = 1280;
  private H = 720;
  private HP_BAR_W = 200;   // widened on mobile to fill the enlarged name box
  private activeSlot = 0;
  private participants = new Set<number>([0]);

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
    // Keep the ambient track playing through the rival's run-in + dialogue, and preload
    // the rival battle theme now so it can start the INSTANT the battle begins (revealBattle).
    if (!this.cache.audio.exists('rival') && TRACKS.rival) { this.load.audio('rival', TRACKS.rival); this.load.start(); }
    this.events.once('shutdown', () => { popBgm(this); deckHideBattleActions(); deckHideMoves(); });
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
    this.rival = new Pokemon(rivalDef.data, starterLevel,
      enemyLearnset(rivalDef.startingMoves, rivalDef.spriteKey,
        rivalDef.data.type1, rivalDef.data.type2, starterLevel));
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
    const track = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.hudGroup.push(o);
      (o as unknown as { setAlpha(n: number): void }).setAlpha(0);
      return o;
    };

    // Widen the name boxes on mobile so enlarged names fit (rival grows right,
    // player grows left with its name/HP). ex = 0 on desktop → unchanged.
    const ex = Math.round(150 * (fontScaleForScene(this) - 1));
    // Grow the HP bar with the box (leaving 36px for the Lv label) so it isn't a stub
    // in a wide mobile box. ex = 0 on desktop → width unchanged.
    this.HP_BAR_W = 200 + Math.max(0, ex - 36);
    // Rival HUD — top left
    track(this.add.rectangle(130 + ex / 2, 52, 248 + ex, 68, 0x0d0d2e, 0.9).setStrokeStyle(1, 0x5577aa));
    this.rivalNameText = track(this.add.text(14, 24, this.rivalHudName(), { fontSize: '14px', color: '#fff', fontStyle: 'bold' }));
    this.rivalLvText = track(this.add.text(249 + ex, 24, `Lv.${this.rival.level}`, { fontSize: '13px', color: '#ffe44e' }).setOrigin(1, 0));
    this.rivalStatusBadge = new BattleStatusBadge(this.rivalNameText, () => this.rivalLvText.x - 36);
    this.hudGroup.push(this.rivalStatusBadge.text);
    track(this.add.rectangle(30 + this.HP_BAR_W / 2, 52, this.HP_BAR_W + 8, 12, 0x333355));
    this.rivalHpBar  = track(this.add.rectangle(30, 52, this.HP_BAR_W, 10, 0x44cc44).setOrigin(0, 0.5));
    this.rivalHpText = track(this.add.text(14, 62, `${this.rival.hp}/${this.rival.maxHp}`, { fontSize: '11px', color: '#aaa' }));

    // Player HUD — bottom right
    track(this.add.rectangle(1154 - (248 + ex) / 2, 545, 248 + ex, 68, 0x0d0d2e, 0.9).setStrokeStyle(1, 0x5577aa));
    this.playerNameText = track(this.add.text(910 - ex, 517, this.playerHudName(), { fontSize: '14px', color: '#fff', fontStyle: 'bold' }));
    this.playerLvText = track(this.add.text(1090, 517, `Lv.${this.player.level}`, { fontSize: '13px', color: '#ffe44e' }).setOrigin(1, 0));
    this.playerStatusBadge = new BattleStatusBadge(this.playerNameText, () => this.playerLvText.x - 36);
    this.hudGroup.push(this.playerStatusBadge.text);
    track(this.add.rectangle(930 - ex + this.HP_BAR_W / 2, 547, this.HP_BAR_W + 8, 12, 0x333355));
    this.playerHpBar  = track(this.add.rectangle(930 - ex, 547, this.HP_BAR_W, 10, 0x44cc44).setOrigin(0, 0.5));
    this.playerHpText = track(this.add.text(910 - ex, 557, `${this.player.hp}/${this.player.maxHp}`, { fontSize: '11px', color: '#aaa' }));

    // Type badges
    this.drawTypeBadges(14, 76, this.player);
    this.drawTypeBadges(14, 76 - 280, this.rival);
  }

  private drawTypeBadges(x: number, _y: number, pokemon: Pokemon) {
    const types = [pokemon.data.type1, pokemon.data.type2].filter(Boolean) as string[];
    const baseY = pokemon === this.player ? 345 : 65;
    types.forEach((t, i) => {
      const bx = x + i * 65;
      this.hudGroup.push(
        this.add.rectangle(bx + 26, baseY, 52, 14, TYPE_COLORS[t] ?? 0x888888).setStrokeStyle(1, 0x000000, 0.3).setAlpha(0),
        this.add.text(bx + 26, baseY, t.toUpperCase(), { fontSize: '8px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0),
      );
    });
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
      delay: 28, repeat: text.length - 1,
      callback: () => {
        this.dialogText.setText(text.slice(0, ++i));
        if (i >= text.length) {
          ev.destroy();
          if (onDone) this.time.delayedCall(700, onDone);
        }
      },
    });
  }

  // ── Action panel ──────────────────────────────────────────────────────────

  private createActionPanel() {
    this.actionPanel = this.add.container(this.W * 0.62, this.H - 120).setDepth(10);
    const bg = this.add.rectangle(76, 60, 296, 120, 0x111133).setStrokeStyle(1, 0x5577aa);
    this.actionPanel.add(bg);

    const actions = [
      { label: 'FIGHT',      x: 20,  y: 18, cb: () => this.onFight() },
      { label: "CAN'T RUN",  x: 155, y: 18, cb: () => {
        this.typeDialog("You can't run from a trainer battle!", () => this.playerAction());
      }},
      { label: 'BAG', x: 20, y: 72, cb: () => {
        this.typeDialog(`${this.rivalTName}: No items in a fair fight!`, () => this.playerAction());
      }},
      { label: 'POKÉMON',    x: 155, y: 72, cb: () => this.onSwitchPokemon() },
    ];

    for (const a of actions) {
      const t = this.add.text(a.x, a.y, tr(a.label), {
        fontSize: '20px',
        color: a.label === "CAN'T RUN" ? '#666688' : '#ffffff',
      }).setInteractive({ useHandCursor: a.label !== "CAN'T RUN" })
        .on('pointerover',  () => { if (a.label !== "CAN'T RUN") t.setColor('#ffff00'); })
        .on('pointerout',   () => { if (a.label !== "CAN'T RUN") t.setColor('#ffffff'); })
        .on('pointerdown',  a.cb);
      this.actionPanel.add(t);
    }
  }

  // ── Move panel ────────────────────────────────────────────────────────────

  private createMovePanel() {
    this.movePanel = this.add.container(0, this.H - 120).setDepth(10).setVisible(false);
    const bg = this.add.rectangle(this.W / 2 - 80, 60, this.W * 0.78, 120, 0x111133).setStrokeStyle(1, 0x5577aa);
    this.movePanel.add(bg);

    const back = this.add.text(this.W - 36, 12, tr('← BACK'), { fontSize: '13px', color: '#aaa' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.state = 'playerAction'; this.showActionPanel(); });
    this.movePanel.add(back);

    this.moveBtns = [];
    const cols = [16, 210, 404, 598];
    this.player.moves.forEach((move, i) => {
      const x = cols[i] ?? cols[3];
      const typeColor = TYPE_COLORS[move.data.type] ?? 0x888888;

      // Type pill bg
      const pill = this.add.rectangle(x + 80, 28, 158, 52, typeColor, 0.25)
        .setStrokeStyle(1, typeColor, 0.8).setOrigin(0.5);
      this.movePanel.add(pill);

      const btn = this.add.text(x + 6, 10, tr(move.data.name).toUpperCase(), {
        fontSize: '15px', color: '#fff', fontStyle: 'bold',
      }).setInteractive({ useHandCursor: true })
        .on('pointerover',  () => btn.setColor('#ffe44e'))
        .on('pointerout',   () => btn.setColor('#ffffff'))
        .on('pointerdown',  () => this.onMoveSelected(move));
      this.movePanel.add(btn);

      const ppTxt = this.add.text(x + 6, 32, `PP ${move.pp}/${move.data.pp}`, { fontSize: '11px', color: '#cccccc' });
      const typeTxt = this.add.text(x + 6, 48, move.data.type.toUpperCase(), { fontSize: '10px', color: '#aaaaaa' });
      this.movePanel.add([ppTxt, typeTxt]);
      this.moveBtns.push(btn);
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
      this.doPlayerMove(playerMove, () => this.doRivalMove(() => this.playerAction(), rivalMove));
    } else {
      this.doRivalMove(() => this.doPlayerMove(playerMove, () => this.playerAction()), rivalMove);
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
        if (this.rival.isKO) {
          this.typeDialog(`${pokeNameEn(this.rival.name).toUpperCase()} fainted!`, () => this.handleWin());
          return;
        }
        void result;
        onDone();
      },
    });
  }

  private afterPlayerAttack(_dmg: number) {
    void _dmg;
    this.doRivalMove(() => this.playerAction());
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
    const selected = choices[Math.floor(Math.random() * choices.length)];
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
        PartySystem.updateSlotHP(this.registry, this.activeSlot, this.player.hp, this.player.status);
        if (this.player.isKO) {
          this.typeDialog(`${pokeNameEn(this.player.name).toUpperCase()} fainted...`, () => this.rivalSendNextOrLose());
        } else {
          onDone();
        }
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
    this.player = buildFromEntry(entry);
    this.refreshMovePanel();

    this.playerNameText.setText(this.playerHudName());
    this.playerLvText.setText(`Lv.${this.player.level}`);
    this.animateHpBar('player', () => {});

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
    const party = PartySystem.get(this.registry);
    if (party[this.activeSlot]) { party[this.activeSlot].hp = 0; PartySystem.set(this.registry, party); }

    const nextIdx = party.findIndex((e, i) => i !== this.activeSlot && e && e.hp > 0);
    if (nextIdx === -1) { this.handleLoss(); return; }

    this.activeSlot = nextIdx;
    this.participants.add(nextIdx);
    const entry = party[nextIdx];
    this.player = buildFromEntry(entry);
    this.refreshMovePanel();
    this.playerNameText.setText(this.playerHudName());
    this.playerLvText.setText(`Lv.${this.player.level}`);
    this.animateHpBar('player', () => {});

    const key = entry.spriteKey;
    if (this.textures.exists(key)) {
      this.playerSprite.setTexture(key);
      this.fitSprite(this.playerSprite, 150);
    }
    this.playerSprite.setAlpha(0);
    this.tweens.add({
      targets: this.playerSprite, alpha: 1, x: 200, y: 258, duration: 400,
      onComplete: () => {
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

    let text = `${this.rivalTName}: Tch. You got me this time.\n${this.player.name} gained ${expGained} EXP!`;
    if (levelledUp) {
      this.playerLvText.setText(`Lv.${this.player.level}`);
      text += `\n✨ ${this.player.name} grew to Lv. ${this.player.level}!`;
    }
    // Other participants share the EXP too.
    for (const line of awardBenchExp(this.registry, this.participants, this.activeSlot, expGained)) {
      text += `\n${line}`;
    }
    text += '\nReturning to Waterfall City...';

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
      `You lost...\n${this.rivalTName}: Don't give up. Come back stronger!\nMom healed your Pokémon at home.`,
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
    const ratio   = pokemon.hp / pokemon.maxHp;

    bar.fillColor = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xddcc00 : 0xcc4444;
    this.tweens.add({
      targets: bar,
      width: Math.max(0, ratio * this.HP_BAR_W),
      duration: 500,
      ease: 'Linear',
      onComplete: () => {
        hpText.setText(`${pokemon.hp}/${pokemon.maxHp}`);
        onDone();
      },
    });
  }
}
