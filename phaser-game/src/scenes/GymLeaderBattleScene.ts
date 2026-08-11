import Phaser from 'phaser';
import { Pokemon, Move } from '../battle/Pokemon';
import {
  deckShowBattleActions, deckHideBattleActions, deckShowMoves, deckHideMoves,
} from '../systems/TouchControls';
import { STARTERS, TYPE_COLORS, findForm } from '../data/StarterData';
import { fetchPokemon, fetchMove } from '../data/PokeAPI';
import { CORRPANDA_DATA, CORRPANDA_MOVES } from '../data/CustomPokemon';
import { PartySystem } from '../systems/PartySystem';
import { awardBenchExp } from '../systems/BattleExp';
import { buildFromEntry, persistMovePP, persistSwitchOut } from '../systems/PartyBattle';
import { openSwitchPanel } from '../systems/SwitchPanel';
import { DexTracker } from '../systems/DexTracker';
import { ITEMS, Inventory, itemName, useItemOnSlot } from '../systems/Items';
import { SaveManager } from '../utils/SaveManager';
import { portraitFor, fitPortrait } from '../data/BattlePortraits';
import { pushBgm, popBgm, stopBgm, playJingle } from '../systems/Music';
import { executeBattleMove, pendingMoveFor } from '../systems/MoveEffects';
import { battle2DSpriteScale } from '../data/SpriteScale';
import { runLevelUpLearning, runBenchLevelUpLearning } from '../systems/MoveLearning';
import type { BenchLevelUp } from '../systems/BattleExp';
import { tr, pokeNameEn} from '../systems/i18n';
import { fontScaleForScene } from '../systems/UiScale';
import { genderedName } from '../data/PokemonGender';
import { actsBefore } from '../systems/AbilitySystem';
import { mergeLearnset } from '../data/Learnsets';
import { BattleStatusBadge } from '../systems/BattleStatusBadge';
import { blackoutMessage, blackoutToCenter } from '../systems/Blackout';

type State = 'intro' | 'playerAction' | 'playerMove' | 'busy' | 'over';
const HP_W = 200;
const ENEMY_STAGE_X = 560;
const ENEMY_STAGE_Y = 130;

export class GymLeaderBattleScene extends Phaser.Scene {
  private player!: Pokemon;
  private enemy!: Pokemon;
  private activeSlot = 0;
  private participants = new Set<number>([0]);

  // Leader's team (Umbreon → Murkrow → Corrpanda)
  private leaderTeam: Pokemon[] = [];
  private leaderSlot = 0;

  private state: State = 'intro';
  private dialogText!: Phaser.GameObjects.Text;
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBar!:  Phaser.GameObjects.Rectangle;
  private hpW = HP_W;   // bar width — widened on mobile to fill the enlarged name box
  private playerHpText!: Phaser.GameObjects.Text;
  private enemyHpText!:  Phaser.GameObjects.Text;
  private playerLvText!: Phaser.GameObjects.Text;
  private enemyLvText!:  Phaser.GameObjects.Text;
  private playerNameText!: Phaser.GameObjects.Text;
  private enemyNameText!:  Phaser.GameObjects.Text;
  private playerStatusBadge?: BattleStatusBadge;
  private enemyStatusBadge?: BattleStatusBadge;
  private enemySprite!:  Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Image;
  private leaderPortrait?: Phaser.GameObjects.Image;
  private actionPanel!:  Phaser.GameObjects.Container;
  private movePanel!:    Phaser.GameObjects.Container;
  private bagPanel!:     Phaser.GameObjects.Container;
  private hudGroup: Phaser.GameObjects.GameObject[] = [];
  private spaceKey!: Phaser.Input.Keyboard.Key;

  private W = 1280; private H = 720;

  constructor() { super('GymLeaderBattleScene'); }

  preload() {
    if (!this.textures.exists('corrpanda'))
      this.load.image('corrpanda', 'assets/corrpanda.png');
    // Leader Jin's battle portrait (shown during the intro).
    const jin = portraitFor('capitol-jin');
    if (jin && !this.textures.exists(jin.key)) this.load.image(jin.key, jin.url);
    STARTERS.forEach(s => { if (!this.textures.exists(s.spriteKey)) this.load.image(s.spriteKey, s.data.spriteUrl); });
    PartySystem.get(this.registry).forEach(e => {
      if (e.spriteKey && e.spriteUrl && !this.textures.exists(e.spriteKey))
        this.load.image(e.spriteKey, e.spriteUrl);
    });
  }

  async create() {
    this.cameras.main.fadeIn(500);
    // Dark gym-leader battle theme; restore the ambient track when the fight ends.
    pushBgm(this, 'gymleader');
    this.events.once('shutdown', () => { popBgm(this); deckHideBattleActions(); deckHideMoves(); });
    Inventory.ensureInit(this.registry);
    await this.buildTeams();
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
    this.startIntro();
  }

  // ── Build teams ───────────────────────────────────────────────────────────

  private async buildTeams() {
    // Player — build from party slot 0 (party entry is the source of truth)
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

    // Leader's team
    const [umbreonData, tackle, bite] = await Promise.all([
      fetchPokemon(197),  // Umbreon (dark, level 10)
      fetchMove('tackle'),
      fetchMove('bite'),
    ]);
    const [murkrowData, wingAtk, peck] = await Promise.all([
      fetchPokemon(198),  // Murkrow (dark/flying, level 12)
      fetchMove('wing-attack'),
      fetchMove('peck'),
    ]);

    for (const [id, d] of [[197, umbreonData], [198, murkrowData]] as [number, typeof umbreonData][]) {
      const lv = id === 197 ? 10 : 12;
      const tex = `gym-${id}`;
      if (!this.textures.exists(tex)) {
        this.load.image(tex, d.spriteUrl);
        await new Promise<void>(r => { this.load.once('complete', r); this.load.start(); });
      }
    }
    void bite; void peck;

    // Umbreon's real base def=110, spDef=130 are too tanky for early-game balance.
    // Cap them at 70/90 so players at level 12 have a fair fight.
    const umbreonBalanced = {
      ...umbreonData,
      baseHp:    75,   // real: 95
      baseDef:   70,   // real: 110
      baseSpDef: 90,   // real: 130
    };
    const murkrowBalanced = {
      ...murkrowData,
      baseHp: 60,      // real: 60 (unchanged)
      baseAtk: 75,     // real: 85 — slight reduction
    };

    this.leaderTeam = [
      new Pokemon(umbreonBalanced, 10, [tackle, bite]),
      new Pokemon(murkrowBalanced, 12, [wingAtk]),
      new Pokemon(CORRPANDA_DATA,  13, CORRPANDA_MOVES),
    ];
    // Pokédex: Jin's team is now seen
    DexTracker.markSeen(this.registry, 197);
    DexTracker.markSeen(this.registry, 198);
    DexTracker.markSeen(this.registry, 'corrpanda');
    this.leaderSlot = 0;
    this.enemy = this.leaderTeam[0];
  }

  // ── Background ────────────────────────────────────────────────────────────

  private drawBackground() {
    // Explicitly identify this full-screen 2D artwork so BattleMirror always
    // removes it from the transparent Phaser layer in 3D mode.
    const g = this.add.graphics().setData('pk3dBackdrop', true);
    // Night city skyline
    g.fillGradientStyle(0x000022, 0x000022, 0x110033, 0x110033, 1);
    g.fillRect(0, 0, this.W, this.H * 0.65);
    // City silhouette
    g.fillStyle(0x0a0a22, 1);
    const buildings = [[0,400,120,200],[100,430,200,160],[200,350,280,240],[280,420,360,180],
                       [360,360,440,230],[440,410,520,190],[520,340,600,250],[600,400,680,200],
                       [680,370,760,220],[760,420,840,180],[840,350,920,240],[920,390,1000,210],
                       [1000,360,1100,230],[1100,400,1200,200],[1200,340,1280,260]];
    for (const [x1,y1,x2,y2] of buildings) {
      g.fillRect(x1, y1, x2-x1, this.H - y1);
      // Windows
      g.fillStyle(0xffee44, 0.4);
      for (let wy = y1 + 10; wy < Math.min(y1 + y2 - 10, this.H - 30); wy += 18)
        for (let wx = x1 + 5; wx < x2 - 5; wx += 14)
          if (Math.random() > 0.3) g.fillRect(wx, wy, 8, 10);
      g.fillStyle(0x0a0a22, 1);
    }
    // Ground
    g.fillStyle(0x1a0033, 1); g.fillRect(0, this.H * 0.60, this.W, this.H * 0.10);
    g.fillStyle(0x6600aa, 0.15);
    for (let x = 0; x < this.W; x += 40) g.fillRect(x, this.H * 0.60, 20, this.H * 0.10);
    // Dialog bar
    g.fillStyle(0x0d0d2e, 0.96); g.fillRect(0, this.H - 120, this.W, 120);
    g.lineStyle(2, 0x9933cc); g.lineBetween(0, this.H - 120, this.W, this.H - 120);
    // Purple energy effect
    g.fillStyle(0x9933cc, 0.08); g.fillRect(0, this.H * 0.60, this.W, 4);
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
    const key = this.leaderSlot === 0 ? 'wild-197' : this.leaderSlot === 1 ? 'wild-198' : 'corrpanda';
    return genderedName(pokeNameEn(this.enemy.name).toUpperCase(), {
      name: this.enemy.name,
      key,
      id: this.enemy.data.id,
    }, `jin-${this.leaderSlot}`);
  }

  private createHUDs() {
    const track = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.hudGroup.push(o);
      (o as unknown as { setAlpha(n: number): void }).setAlpha(0);
      return o;
    };
    // Widen the name boxes on mobile so enlarged names fit (enemy grows right,
    // player grows left with its name/HP). ex = 0 on desktop → unchanged.
    const ex = Math.round(150 * (fontScaleForScene(this) - 1));
    // Grow the HP bar with the box (leaving 36px for the Lv label) so it isn't a stub
    // in a wide mobile box. ex = 0 on desktop → hpW = HP_W, layout unchanged.
    this.hpW = HP_W + Math.max(0, ex - 36);
    track(this.add.rectangle(130 + ex / 2, 52, 260 + ex, 68, 0x0d0d2e, 0.9).setStrokeStyle(1, 0x9933cc));
    this.enemyNameText = track(this.add.text(14, 24, this.enemyHudName(), { fontSize: '14px', color: '#cc88ff', fontStyle: 'bold' }));
    this.enemyLvText  = track(this.add.text(255 + ex, 24, `Lv.${this.enemy.level}`, { fontSize: '13px', color: '#ffe44e' }).setOrigin(1, 0));
    this.enemyStatusBadge = new BattleStatusBadge(this.enemyNameText, () => this.enemyLvText.x - 36);
    this.hudGroup.push(this.enemyStatusBadge.text);
    track(this.add.rectangle(30 + this.hpW / 2, 52, this.hpW + 8, 12, 0x333355));
    this.enemyHpBar   = track(this.add.rectangle(30, 52, this.hpW, 10, 0x44cc44).setOrigin(0, 0.5));
    this.enemyHpText  = track(this.add.text(14, 62, `${this.enemy.hp}/${this.enemy.maxHp}`, { fontSize: '11px', color: '#aaa' }));

    track(this.add.rectangle(this.W - (260 + ex) / 2, this.H - 175, 260 + ex, 68, 0x0d0d2e, 0.9).setStrokeStyle(1, 0x9933cc));
    this.playerNameText = track(this.add.text(this.W - 258 - ex, this.H - 203, this.playerHudName(), { fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }));
    this.playerLvText = track(this.add.text(this.W - 12, this.H - 203, `Lv.${this.player.level}`, { fontSize: '13px', color: '#ffe44e' }).setOrigin(1, 0));
    this.playerStatusBadge = new BattleStatusBadge(this.playerNameText, () => this.playerLvText.x - 36);
    this.hudGroup.push(this.playerStatusBadge.text);
    track(this.add.rectangle(this.W - 258 - ex + this.hpW / 2, this.H - 173, this.hpW + 8, 12, 0x333355));
    this.playerHpBar  = track(this.add.rectangle(this.W - 258 - ex, this.H - 173, this.hpW, 10, 0x44cc44).setOrigin(0, 0.5));
    this.playerHpText = track(this.add.text(this.W - 258 - ex, this.H - 161, `${this.player.hp}/${this.player.maxHp}`, { fontSize: '11px', color: '#aaa' }));
  }

  private createSprites() {
    const pKey = PartySystem.get(this.registry)[this.activeSlot]?.spriteKey
               ?? (this.registry.get('starterKey') as string) ?? 'vipour';
    this.enemySprite  = this.add.image(900, 100, 'corrpanda')
      .setDepth(5).setAlpha(0).setData('battlePokemonSide', 'enemy');
    this.playerSprite = this.add.image(-80, 340, pKey)
      .setDepth(5).setFlipX(true).setAlpha(0).setData('battlePokemonSide', 'player');
    this.fitSprite(this.enemySprite, 150);
    this.fitSprite(this.playerSprite, 160);
    this.updateEnemySprite();

    // Jin keeps his existing authored 2D battle portrait, matching every other
    // Gym Leader, Elite Four member and Champion.
    const jin = portraitFor('capitol-jin');
    if (jin && this.textures.exists(jin.key)) {
      this.leaderPortrait = this.add.image(ENEMY_STAGE_X, ENEMY_STAGE_Y, jin.key).setDepth(6)
        .setData('no3d', true)
        .setData('battleTrainer2DAnchor', 'enemy');
      fitPortrait(this.leaderPortrait);
    }
  }

  private fitSprite(img: Phaser.GameObjects.Image, size: number) {
    const tex = this.textures.get(img.texture.key).getSourceImage();
    const dim = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
    img.setScale((size * battle2DSpriteScale(img.texture.key)) / dim);
  }

  private updateEnemySprite() {
    const key = this.leaderSlot === 2 ? 'corrpanda' : `gym-${this.leaderSlot === 0 ? 197 : 198}`;
    if (this.textures.exists(key)) {
      this.enemySprite.setTexture(key);
      this.fitSprite(this.enemySprite, 150);
    }
  }

  // ── Dialog ────────────────────────────────────────────────────────────────

  private createDialogBox() {
    this.dialogText = this.add.text(16, this.H - 108, '', {
      fontSize: '16px', color: '#fff', wordWrap: { width: this.W * 0.58 }, lineSpacing: 5,
    }).setDepth(10);
  }

  private typeDialog(text: string, onDone?: () => void) {
    text = tr(text);
    this.dialogText.setText('');
    let i = 0;
    const ev = this.time.addEvent({
      delay: 12, repeat: text.length - 1,   // faster typewriter for snappier battles
      callback: () => {
        this.dialogText.setText(text.slice(0, ++i));
        if (i >= text.length) { ev.destroy(); if (onDone) this.time.delayedCall(280, onDone); }
      },
    });
  }

  // ── Panels ────────────────────────────────────────────────────────────────

  private createActionPanel() {
    this.actionPanel = this.add.container(this.W * 0.60, this.H - 120).setDepth(10);
    const bg = this.add.rectangle(80, 60, 316, 120, 0x110022).setStrokeStyle(1, 0x9933cc);
    this.actionPanel.add(bg);
    const actions = [
      { label: 'FIGHT',    x: 16,  y: 16, cb: () => this.onFight() },
      { label: "CAN'T RUN",x: 155, y: 16, cb: () => this.typeDialog("You can't flee a Gym Battle!", () => this.playerAction()) },
      { label: 'BAG',      x: 16,  y: 70, cb: () => this.onBag() },
      { label: 'POKÉMON',  x: 155, y: 70, cb: () => this.onSwitchPokemon() },
    ];
    actions.forEach(a => {
      const t = this.add.text(a.x, a.y, tr(a.label), {
        fontSize: '18px', color: a.label === "CAN'T RUN" ? '#556677' : '#ffffff',
      }).setInteractive({ useHandCursor: !a.label.includes("RUN") })
        .on('pointerover', () => { if (!a.label.includes("RUN")) t.setColor('#cc88ff'); })
        .on('pointerout',  () => t.setColor(a.label.includes("RUN") ? '#556677' : '#ffffff'))
        .on('pointerdown', a.cb);
      this.actionPanel.add(t);
    });
  }

  private createMovePanel() {
    this.movePanel = this.add.container(0, this.H - 120).setDepth(10).setVisible(false);
    const bg = this.add.rectangle(this.W / 2 - 60, 60, this.W * 0.76, 120, 0x110022).setStrokeStyle(1, 0x9933cc);
    this.movePanel.add(bg);
    this.movePanel.add(
      this.add.text(this.W - 30, 10, tr('← BACK'), { fontSize: '12px', color: '#aaa' })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.playerAction()),
    );
    const cols = [40, 226, 412, 598];
    this.player.moves.forEach((move, i) => {
      const x = cols[i] ?? cols[3];
      const pill = this.add.rectangle(x + 80, 28, 164, 50, TYPE_COLORS[move.data.type] ?? 0x330066, 0.25)
        .setStrokeStyle(1, TYPE_COLORS[move.data.type] ?? 0x330066, 0.8).setOrigin(0.5);
      const btn = this.add.text(x + 6, 10, tr(move.data.name).toUpperCase(), { fontSize: '14px', color: '#fff', fontStyle: 'bold' })
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => btn.setColor('#cc88ff'))
        .on('pointerout',  () => btn.setColor('#ffffff'))
        .on('pointerdown', () => this.onMoveSelected(move));
      this.movePanel.add([pill, btn,
        this.add.text(x + 6, 30, `PP ${move.pp}/${move.data.pp}`, { fontSize: '10px', color: '#ccc' }),
        this.add.text(x + 6, 46, move.data.type.toUpperCase(), { fontSize: '9px', color: '#aaa' }),
      ]);
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
  }
  private showMovePanel()   { const onDeck = deckShowMoves(this.player.moves, i => this.onMoveSelected(this.player.moves[i]), () => this.playerAction()); this.movePanel.setVisible(!onDeck); this.actionPanel.setVisible(false); }
  private hideAllPanels()   { deckHideBattleActions(); this.actionPanel.setVisible(false); this.movePanel.setVisible(false); if (this.bagPanel) this.bagPanel.setVisible(false); }

  // ── Bag (healing items only — no catching in a gym) ───────────────────────
  private onBag() {
    if (this.state !== 'playerAction') return;
    this.state = 'busy';
    this.rebuildBagPanel();
    this.hideAllPanels();
    this.bagPanel.setVisible(true);
    this.typeDialog('Use which item?');
  }

  private rebuildBagPanel() {
    if (this.bagPanel) this.bagPanel.destroy(true);
    this.bagPanel = this.add.container(0, this.H - 120).setDepth(10);
    const bg = this.add.rectangle(this.W / 2 - 60, 60, this.W * 0.76, 120, 0x110022).setStrokeStyle(1, 0x9933cc);
    this.bagPanel.add(bg);
    this.bagPanel.add(this.add.text(this.W - 30, 10, tr('← BACK'), { fontSize: '12px', color: '#aaa' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.state = 'playerAction'; this.showActionPanel(); this.typeDialog(`What will ${pokeNameEn(this.player.name).toUpperCase()} do?`); }));

    const inv = Inventory.all(this.registry);
    const heals = ITEMS.filter(it => (inv[it.key] ?? 0) > 0 &&
      (it.category === 'heal' || it.category === 'status' || it.category === 'revive'));
    if (heals.length === 0) {
      this.bagPanel.add(this.add.text(this.W / 2 - 60, 50, tr('No usable items. Buy some at a Poké Mart!'),
        { fontSize: '14px', color: '#ccc' }).setOrigin(0.5));
      return;
    }
    const cols = [20, 250, 480, 710];
    heals.slice(0, 8).forEach((def, i) => {
      const x = cols[i % 4], y = 18 + Math.floor(i / 4) * 50;
      const r = this.add.rectangle(x + 100, y + 14, 210, 40, 0x1a3a2a).setStrokeStyle(1, 0x3a8a5a).setInteractive({ useHandCursor: true });
      this.bagPanel.add(r);
      this.bagPanel.add(this.add.text(x + 8, y + 4, `${def.icon} ${itemName(def)}`, { fontSize: '13px', color: '#fff', fontStyle: 'bold' }));
      this.bagPanel.add(this.add.text(x + 8, y + 20, `×${inv[def.key]}`, { fontSize: '11px', color: '#ffe44e' }));
      r.on('pointerover', () => r.setFillStyle(0x2a5a3a));
      r.on('pointerout',  () => r.setFillStyle(0x1a3a2a));
      r.on('pointerdown', () => this.useHealItem(def.key));
    });
  }

  private useHealItem(itemKey: string) {
    if (this.state !== 'busy') return;
    const res = useItemOnSlot(this.registry, itemKey, this.activeSlot);
    if (!res.ok) { this.typeDialog(res.message, () => this.onBag()); return; }
    const e = PartySystem.get(this.registry)[this.activeSlot];
    if (e) this.player.hp = e.hp;
    this.hideAllPanels();
    this.animateHp('player', () => {
      this.typeDialog(res.message, () => this.enemyTurn());   // using an item costs the turn
    });
  }

  // ── Intro ─────────────────────────────────────────────────────────────────

  private startIntro() {
    const rName = this.leaderTeam[this.leaderSlot].name;
    this.typeDialog('Leader Jin: Welcome to my domain of shadows.', () => {
      this.typeDialog('Leader Jin: Darkness is not weakness — it is depth.', () => {
        this.typeDialog(`Leader Jin: ${rName}, step forward!`, () => {
          this.revealBattle();
        });
      });
    });
  }

  private revealBattle() {
    // Jin steps aside; his Pokémon takes the field.
    if (this.leaderPortrait) {
      this.tweens.add({ targets: this.leaderPortrait, alpha: 0, duration: 300,
        onComplete: () => { this.leaderPortrait?.destroy(); this.leaderPortrait = undefined; } });
    }
    this.updateEnemySprite();
    this.enemySprite.setAlpha(1);
    this.tweens.add({
      targets: this.enemySprite, x: ENEMY_STAGE_X, y: ENEMY_STAGE_Y, duration: 500, ease: 'Power2',
      onComplete: () => {
        this.typeDialog(`Leader Jin sent out ${pokeNameEn(this.enemy.name).toUpperCase()}!`, () => {
          this.playerSprite.setAlpha(1);
          this.tweens.add({
            targets: this.playerSprite, x: 220, y: 310, duration: 400, ease: 'Power2',
            onComplete: () => {
              this.tweens.add({
                targets: this.hudGroup, alpha: 1, duration: 350,
                onComplete: () => {
                  this.typeDialog(`Go, ${pokeNameEn(this.player.name).toUpperCase()}!`, () => this.playerAction());
                },
              });
            },
          });
        });
      },
    });
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
    this.typeDialog(`What will ${pokeNameEn(this.player.name).toUpperCase()} do?`);
    this.showActionPanel();
  }

  private onFight() {
    if (this.state !== 'playerAction') return;
    this.state = 'playerMove';
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

  private runTurn(move: Move) {
    this.state = 'busy';
    const avail = this.enemy.moves.filter(m => m.pp > 0);
    const enemyMove = pendingMoveFor(this.enemy)
      ?? (avail.length ? avail[Math.floor(Math.random() * avail.length)] : this.enemy.moves[0]);
    // Two-turn moves span two FULL turns — the opponent acts on both the charge and
    // release turns (its charge-turn move misses a dug-in/airborne target).
    const playerFirst = actsBefore(this.player, move, this.enemy, enemyMove);
    if (playerFirst) {
      this.doPlayerMove(move, () => this.doEnemyMove(() => this.playerAction(), enemyMove));
    } else {
      this.doEnemyMove(() => this.doPlayerMove(move, () => this.playerAction()), enemyMove);
    }
  }

  private doPlayerMove(move: Move, onDone: () => void) {
    executeBattleMove({
      scene: this,
      user: this.player,
      target: this.enemy,
      move,
      userSprite: this.playerSprite,
      targetSprite: this.enemySprite,
      userLabel: pokeNameEn(this.player.name).toUpperCase(),
      showDialog: (text, done) => this.typeDialog(text, done),
      animateUserHp: done => this.animateHp('player', done),
      animateTargetHp: done => this.animateHp('enemy', done),
      onPpUsed: () => persistMovePP(this.registry, this.activeSlot, this.player),
      onComplete: () => {
        if (this.enemy.isKO) {
          this.typeDialog(`${pokeNameEn(this.enemy.name).toUpperCase()} fainted!`,
            () => this.awardExp(this.enemy.level * 28, () => this.leaderSendNext()));
          return;
        }
        onDone();
      },
    });
  }

  private enemyTurn() {
    this.doEnemyMove(() => this.playerAction());
  }

  private doEnemyMove(onDone: () => void, selectedMove?: Move) {
    const avail = this.enemy.moves.filter(m => m.pp > 0);
    const move = selectedMove ?? pendingMoveFor(this.enemy)
      ?? (avail.length ? avail[Math.floor(Math.random() * avail.length)] : this.enemy.moves[0]);
    executeBattleMove({
      scene: this,
      user: this.enemy,
      target: this.player,
      move,
      userSprite: this.enemySprite,
      targetSprite: this.playerSprite,
      userLabel: pokeNameEn(this.enemy.name).toUpperCase(),
      showDialog: (text, done) => this.typeDialog(text, done),
      animateUserHp: done => this.animateHp('enemy', done),
      animateTargetHp: done => this.animateHp('player', done),
      onComplete: () => {
        PartySystem.updateSlotHP(this.registry, this.activeSlot, this.player.hp, this.player.status);
        if (this.player.isKO) {
          this.typeDialog(`${pokeNameEn(this.player.name).toUpperCase()} fainted!`, () => this.playerFainted());
        } else {
          onDone();
        }
      },
    });
  }

  private leaderSendNext() {
    this.leaderSlot++;
    if (this.leaderSlot >= this.leaderTeam.length) { this.handleWin(); return; }
    this.enemy = this.leaderTeam[this.leaderSlot];
    this.updateEnemySprite();
    this.enemyNameText.setText(this.enemyHudName());
    this.enemyLvText.setText(`Lv.${this.enemy.level}`);
    this.enemyHpBar.width = this.hpW; this.enemyHpBar.fillColor = 0x44cc44;
    this.enemyHpText.setText(`${this.enemy.hp}/${this.enemy.maxHp}`);

    const names = ['', '', 'Corrpanda'];
    const intro = this.leaderSlot === 2
      ? 'Leader Jin: Now... my pride. Go, Corrpanda!'
      : `Leader Jin: You are strong. ${this.enemy.name}, come!`;
    this.typeDialog(intro, () => {
      this.enemySprite.setAlpha(0);
      this.tweens.add({
        targets: this.enemySprite, alpha: 1, x: ENEMY_STAGE_X, y: ENEMY_STAGE_Y, duration: 400,
        onComplete: () => this.playerAction(),
      });
    });
    void names;
  }

  private playerFainted() {
    const party = PartySystem.get(this.registry);
    if (party[this.activeSlot]) { party[this.activeSlot].hp = 0; PartySystem.set(this.registry, party); }
    const nextIdx = party.findIndex((e, i) => i !== this.activeSlot && e && e.hp > 0);
    if (nextIdx === -1) {
      this.typeDialog('All your Pokémon fainted!', () => {
        this.typeDialog('Leader Jin: Rest and recover. Your spirit is strong.', () => {
          // A Gym loss is a normal whiteout. Returning straight to a freshly
          // created gym scene replayed its entrance cutscene and looked like a
          // mid-Corrpanda warp; use the shared Pokémon Center recovery instead.
          this.typeDialog(blackoutMessage(this.registry), () => blackoutToCenter(this));
        });
      });
      return;
    }
    this.activeSlot = nextIdx;
    this.participants.add(nextIdx);
    const entry = PartySystem.get(this.registry)[nextIdx];
    this.player = buildFromEntry(entry);
    this.refreshMovePanel();
    this.refreshPlayerHud();
    if (this.textures.exists(entry.spriteKey)) {
      this.playerSprite.setTexture(entry.spriteKey);
      this.fitSprite(this.playerSprite, 160);
    }
    this.playerSprite.setAlpha(0);
    this.tweens.add({
      targets: this.playerSprite, alpha: 1, x: 220, y: 310, duration: 400,
      onComplete: () => {
        this.typeDialog(`Go, ${pokeNameEn(this.player.name).toUpperCase()}!`, () => this.playerAction());
      },
    });
  }

  private onSwitchPokemon() {
    if (this.state !== 'playerAction') return;
    this.state = 'busy';
    this.hideAllPanels();
    openSwitchPanel(this, this.activeSlot,
      () => {
        this.state = 'playerAction';
        this.showActionPanel();
        this.typeDialog(`What will ${pokeNameEn(this.player.name).toUpperCase()} do?`);
      },
      (idx) => {
        persistSwitchOut(this.registry, this.activeSlot, this.player);
        this.activeSlot = idx;
        this.participants.add(idx);
        const entry = PartySystem.get(this.registry)[idx];
        this.player = buildFromEntry(entry);
        this.refreshMovePanel();
        this.refreshPlayerHud();
        if (this.textures.exists(entry.spriteKey)) {
          this.playerSprite.setTexture(entry.spriteKey);
          this.fitSprite(this.playerSprite, 160);
        }
        this.playerSprite.setAlpha(0);
        this.tweens.add({
          targets: this.playerSprite, alpha: 1, x: 220, y: 310, duration: 400,
          onComplete: () => { this.typeDialog(`Go, ${pokeNameEn(this.player.name).toUpperCase()}!`, () => this.enemyTurn()); },
        });
      },
    );
  }

  // ── Win ───────────────────────────────────────────────────────────────────

  private handleWin() {
    this.state = 'over';
    stopBgm(this);               // silence the gym-leader theme so only the badge jingle plays
    playJingle(this, 'badge');   // Shadow Badge milestone
    this.hideAllPanels();
    this.registry.set('gymLeaderDefeated', true);
    Inventory.addMoney(this.registry, 3000);  // Gym Leader prize money (EXP already earned per Pokémon)

    const lines = [
      "Leader Jin: ...You defeated Corrpanda.",
      "Leader Jin: Your light was stronger than my shadows.",
      "Leader Jin: You have earned the Shadow Badge.",
    ];
    lines.push("Congratulations! Shadow Badge obtained! 🏅");
    Inventory.add(this.registry, 'tm_darkpulse', 1);   // first-gym TM reward
    lines.push("Received: TM — Dark Pulse!  (Check your Bag to teach it.)");
    lines.push("Capitol City's secrets are now open to you. Journey on, trainer.");

    let idx = 0;
    const next = () => {
      if (idx >= lines.length) {
        const px = 24 * 32, py = 69 * 32;
        this.registry.set('capitalReturnX', px); this.registry.set('capitalReturnY', py);
        SaveManager.save(this.registry, px, py, 'CapitolCityScene');
        this.cameras.main.fadeOut(600, 0, 0, 0, () => this.scene.start('CapitolCityScene'));
        return;
      }
      this.dialogText.setText(tr(lines[idx++]));
      this.time.delayedCall(300, () => { this.input.keyboard!.once('keydown-SPACE', next); });
    };
    this.time.delayedCall(500, next);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  update(): void {
    this.enemyStatusBadge?.sync(this.enemy?.status);
    this.playerStatusBadge?.sync(this.player?.status);
  }

  private animateHp(who: 'player' | 'enemy', onDone: () => void) {
    const mon  = who === 'player' ? this.player : this.enemy;
    const bar  = who === 'player' ? this.playerHpBar : this.enemyHpBar;
    const lbl  = who === 'player' ? this.playerHpText : this.enemyHpText;
    const r    = mon.hp / mon.maxHp;
    bar.fillColor = r > 0.5 ? 0x44cc44 : r > 0.25 ? 0xddcc00 : 0xcc4444;
    this.tweens.add({
      targets: bar, width: Math.max(0, r * this.hpW), duration: 260,
      onComplete: () => { lbl.setText(`${mon.hp}/${mon.maxHp}`); onDone(); },
    });
  }

  /** Grant EXP to the active Pokémon mid-battle and show the message + level-up. */
  private awardExp(amount: number, onDone: () => void) {
    const oldLevel = this.player.level;
    const levelled = this.player.gainExp(amount);
    PartySystem.updateSlotProgress(
      this.registry, this.activeSlot,
      this.player.level, this.player.exp, this.player.hp, this.player.maxHp,
    );
    const bench: BenchLevelUp[] = [];
    const benchLines = awardBenchExp(this.registry, this.participants, this.activeSlot, amount, bench);
    const after = () => this.playBenchLines(benchLines, () =>
      runBenchLevelUpLearning(this, bench, (t, cb) => this.typeDialog(t, cb), onDone));
    const msg = `${pokeNameEn(this.player.name).toUpperCase()} gained ${amount} EXP!`;
    if (levelled) {
      this.refreshPlayerHud();
      this.typeDialog(msg, () => {
        this.typeDialog(`✨ ${pokeNameEn(this.player.name).toUpperCase()} grew to Lv. ${this.player.level}!`, () => {
          runLevelUpLearning(this, this.activeSlot, this.player, oldLevel, this.player.level,
            (t, cb) => this.typeDialog(t, cb), after);
        });
      });
    } else {
      this.typeDialog(msg, after);
    }
  }

  private playBenchLines(lines: string[], onDone: () => void) {
    if (lines.length === 0) { onDone(); return; }
    this.typeDialog(lines[0], () => this.playBenchLines(lines.slice(1), onDone));
  }

  /** Snap the player HUD (name, level, HP bar/text) to the current this.player.
   *  Must be called after every switch so a fresh Pokémon's bar/name are correct. */
  private refreshPlayerHud() {
    this.playerNameText.setText(this.playerHudName());
    this.playerLvText.setText(`Lv.${this.player.level}`);
    const r = this.player.hp / this.player.maxHp;
    this.playerHpBar.width = Math.max(0, r * this.hpW);
    this.playerHpBar.fillColor = r > 0.5 ? 0x44cc44 : r > 0.25 ? 0xddcc00 : 0xcc4444;
    this.playerHpText.setText(`${this.player.hp}/${this.player.maxHp}`);
  }
}
