import Phaser from 'phaser';
import { tr, pokeNameEn} from '../systems/i18n';
import { Pokemon, Move } from '../battle/Pokemon';
import {
  deckShowBattleActions, deckHideBattleActions, deckShowMoves, deckHideMoves,
} from '../systems/TouchControls';
import { fetchPokemon, fetchMove } from '../data/PokeAPI';
import { executeBattleMove, pendingMoveFor } from '../systems/MoveEffects';
import { genderedName } from '../data/PokemonGender';
import { actsBefore } from '../systems/AbilitySystem';
import { BattleStatusBadge } from '../systems/BattleStatusBadge';

type BattleState = 'loading' | 'start' | 'playerAction' | 'playerMove' | 'busy' | 'over';

export class BattleScene extends Phaser.Scene {
  private playerPokemon!: Pokemon;
  private enemyPokemon!: Pokemon;
  private state: BattleState = 'loading';

  // UI elements
  private dialogText!: Phaser.GameObjects.Text;
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
  private _playerNameText!: Phaser.GameObjects.Text;
  private _enemyNameText!: Phaser.GameObjects.Text;
  private playerStatusBadge?: BattleStatusBadge;
  private enemyStatusBadge?: BattleStatusBadge;
  private _playerSprite!: Phaser.GameObjects.Image;
  private _enemySprite!: Phaser.GameObjects.Image;
  private actionPanel!: Phaser.GameObjects.Container;
  private movePanel!: Phaser.GameObjects.Container;

  private W = 1280;
  private H = 720;

  constructor() { super('BattleScene'); }

  async create() {
    this.events.once('shutdown', () => { deckHideBattleActions(); deckHideMoves(); });
    this.createBackground();
    this.dialogText = this.add.text(20, this.H - 90, tr('Loading...'), {
      fontSize: '18px', color: '#fff', wordWrap: { width: this.W * 0.6 - 40 }
    });

    // Fetch two Pokemon from PokéAPI
    const [bulbData, charData, tackle, ember] = await Promise.all([
      fetchPokemon('bulbasaur'),
      fetchPokemon('charmander'),
      fetchMove('tackle'),
      fetchMove('ember'),
    ]);

    this.playerPokemon = new Pokemon(bulbData, 10, [tackle]);
    this.enemyPokemon  = new Pokemon(charData,  8,  [ember]);

    await Promise.all([
      this.loadSprite('player-sprite', this.playerPokemon.data.spriteUrl),
      this.loadSprite('enemy-sprite',  this.enemyPokemon.data.spriteUrl),
    ]);

    this.createHUDs();
    this.createSprites();
    this.createActionPanel();
    this.createMovePanel();

    this.startBattle();
  }

  // ── battle flow ──────────────────────────────────────────────────────────

  private startBattle() {
    this.hideAllPanels();
    this.typeDialog(`A wild ${this.enemyPokemon.name} appeared!`, () => {
      this.playerAction();
    });
  }

  private playerAction() {
    const pending = pendingMoveFor(this.playerPokemon);
    if (pending) {
      this.hideAllPanels();
      this.runTurn(pending);
      return;
    }
    this.state = 'playerAction';
    this.showActionPanel();
  }

  private onFight() {
    if (this.state !== 'playerAction') return;
    this.state = 'playerMove';
    this.showMovePanel();
  }

  private onRun() {
    if (this.state !== 'playerAction') return;
    this.typeDialog('Got away safely!', () => { this.state = 'over'; });
  }

  private onMoveSelected(move: Move) {
    if (this.state !== 'playerMove') return;
    if (move.pp <= 0) { this.typeDialog('No PP left!', () => this.showMovePanel()); return; }
    deckHideMoves();
    this.hideAllPanels();
    this.runTurn(move);
  }

  private runTurn(playerMove: Move) {
    this.state = 'busy';
    const available = this.enemyPokemon.moves.filter(m => m.pp > 0);
    const enemyMove = pendingMoveFor(this.enemyPokemon)
      ?? (available.length ? available[Math.floor(Math.random() * available.length)] : this.enemyPokemon.moves[0]);
    const playerFirst = actsBefore(this.playerPokemon, playerMove, this.enemyPokemon, enemyMove);
    if (playerFirst) {
      this.doPlayerMove(playerMove, () => this.doEnemyMove(() => this.playerAction(), enemyMove));
    } else {
      this.doEnemyMove(() => this.doPlayerMove(playerMove, () => this.playerAction()), enemyMove);
    }
  }

  private doPlayerMove(playerMove: Move, onDone: () => void) {
    executeBattleMove({
      scene: this,
      user: this.playerPokemon,
      target: this.enemyPokemon,
      move: playerMove,
      userSprite: this._playerSprite,
      targetSprite: this._enemySprite,
      userLabel: pokeNameEn(this.playerPokemon.name).toUpperCase(),
      showDialog: (text, done) => this.typeDialog(text, done),
      animateUserHp: done => this.animateHpBar('player', done),
      animateTargetHp: done => this.animateHpBar('enemy', done),
      onComplete: () => {
        if (this.enemyPokemon.isKO) {
          this.typeDialog(`${this.enemyPokemon.name} fainted! You win!`, () => { this.state = 'over'; });
          return;
        }
        onDone();
      },
    });
  }

  private doEnemyMove(onDone: () => void, selectedMove?: Move) {
    const available = this.enemyPokemon.moves.filter(m => m.pp > 0);
    const enemyMove = selectedMove ?? pendingMoveFor(this.enemyPokemon)
      ?? (available.length ? available[Math.floor(Math.random() * available.length)] : this.enemyPokemon.moves[0]);
    executeBattleMove({
      scene: this,
      user: this.enemyPokemon,
      target: this.playerPokemon,
      move: enemyMove,
      userSprite: this._enemySprite,
      targetSprite: this._playerSprite,
      userLabel: pokeNameEn(this.enemyPokemon.name).toUpperCase(),
      showDialog: (text, done) => this.typeDialog(text, done),
      animateUserHp: done => this.animateHpBar('enemy', done),
      animateTargetHp: done => this.animateHpBar('player', done),
      onComplete: () => {
        if (this.playerPokemon.isKO) {
          this.typeDialog(`${this.playerPokemon.name} fainted! You lose!`, () => { this.state = 'over'; });
          return;
        }
        onDone();
      },
    });
  }

  // ── UI creation ──────────────────────────────────────────────────────────

  private createBackground() {
    // Sky
    this.add.rectangle(this.W / 2, this.H * 0.3, this.W, this.H * 0.6, 0x87ceeb);
    // Ground
    this.add.rectangle(this.W / 2, this.H * 0.72, this.W, this.H * 0.35, 0x90c060);
    // Dialog box
    this.add.rectangle(this.W / 2, this.H - 62, this.W, 124, 0x222244).setStrokeStyle(2, 0xffffff);
  }

  private createHUDs() {
    const p = this.playerPokemon;
    const e = this.enemyPokemon;

    // Enemy HUD (top-left)
    this.add.rectangle(140, 60, 260, 70, 0x222244).setStrokeStyle(1, 0xffffff);
    this._enemyNameText = this.add.text(20, 32, `${genderedName(pokeNameEn(e.name).toUpperCase(), e, 'demo-enemy')}  Lv.${this.enemyPokemon.level}`, { fontSize: '14px', color: '#fff' });
    this.enemyStatusBadge = new BattleStatusBadge(this._enemyNameText, () => 260);
    this.add.rectangle(140, 72, 220, 12, 0x444444);
    this.enemyHpBar    = this.add.rectangle(30, 72, 220, 12, 0x44cc44).setOrigin(0, 0.5);
    this.enemyHpText   = this.add.text(20, 82, `${e.hp}/${e.maxHp}`, { fontSize: '12px', color: '#aaa' });

    // Player HUD (bottom-right)
    this.add.rectangle(640, 320, 260, 70, 0x222244).setStrokeStyle(1, 0xffffff);
    this._playerNameText = this.add.text(516, 292, `${genderedName(pokeNameEn(p.name).toUpperCase(), p, 'demo-player')}  Lv.${this.playerPokemon.level}`, { fontSize: '14px', color: '#fff' });
    this.playerStatusBadge = new BattleStatusBadge(this._playerNameText, () => 760);
    this.add.rectangle(640, 332, 220, 12, 0x444444);
    this.playerHpBar    = this.add.rectangle(530, 332, 220, 12, 0x44cc44).setOrigin(0, 0.5);
    this.playerHpText   = this.add.text(516, 342, `${p.hp}/${p.maxHp}`, { fontSize: '12px', color: '#aaa' });
  }

  private createSprites() {
    this._enemySprite  = this.add.image(580, 160, 'enemy-sprite')
      .setScale(3.3).setData('battlePokemonSide', 'enemy');
    this._playerSprite = this.add.image(220, 280, 'player-sprite')
      .setScale(3.3).setFlipX(true).setData('battlePokemonSide', 'player');
  }

  private createActionPanel() {
    this.actionPanel = this.add.container(this.W * 0.62, this.H - 124);
    const bg = this.add.rectangle(76, 62, 304, 124, 0x111133).setStrokeStyle(1, 0xffffff);
    this.actionPanel.add(bg);

    const actions = [
      { label: 'FIGHT',   x: 20,  y: 20,  cb: () => this.onFight() },
      { label: 'BAG',     x: 170, y: 20,  cb: () => {} },
      { label: 'POKEMON', x: 20,  y: 70,  cb: () => {} },
      { label: 'RUN',     x: 170, y: 70,  cb: () => this.onRun() },
    ];

    for (const a of actions) {
      const btn = this.add.text(a.x, a.y, tr(a.label), { fontSize: '20px', color: '#fff' })
        .setInteractive({ useHandCursor: true })
        .on('pointerover',  () => btn.setColor('#ffff00'))
        .on('pointerout',   () => btn.setColor('#ffffff'))
        .on('pointerdown',  a.cb);
      this.actionPanel.add(btn);
    }
  }

  private createMovePanel() {
    this.movePanel = this.add.container(0, this.H - 150);
    const bg = this.add.rectangle(this.W / 2 - 80, 75, this.W * 0.78, 150, 0x111133).setStrokeStyle(1, 0xffffff);
    this.movePanel.add(bg);

    const back = this.add.text(this.W - 40, 10, tr('← BACK'), { fontSize: '14px', color: '#aaa' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.state = 'playerAction'; this.showActionPanel(); });
    this.movePanel.add(back);

    const cols = [20, 210];
    const rows = [18, 82];
    this.playerPokemon.moves.forEach((move, i) => {
      const x = cols[i % 2];
      const y = rows[Math.floor(i / 2)];
      const btn = this.add.text(x, y,
        `${tr(move.data.name).toUpperCase()}\nPP ${move.pp}/${move.data.pp}  ${move.data.type.toUpperCase()}`,
        { fontSize: '16px', color: '#fff', lineSpacing: 4 }
      ).setInteractive({ useHandCursor: true })
        .on('pointerover',  () => btn.setColor('#ffff00'))
        .on('pointerout',   () => btn.setColor('#ffffff'))
        .on('pointerdown',  () => this.onMoveSelected(move));
      this.movePanel.add(btn);
    });

    this.movePanel.setVisible(false);
  }

  // ── UI helpers ───────────────────────────────────────────────────────────

  update(): void {
    this.enemyStatusBadge?.sync(this.enemyPokemon?.status);
    this.playerStatusBadge?.sync(this.playerPokemon?.status);
  }

  private showActionPanel() {
    deckHideMoves();
    const onDeck = deckShowBattleActions([
      { label: 'FIGHT', onPick: () => this.onFight(), accent: '#f08a78' },
      { label: 'BAG', onPick: () => {}, disabled: true },
      { label: 'POKÉMON', onPick: () => {}, disabled: true },
      { label: 'RUN', onPick: () => this.onRun(), accent: '#86c985' },
    ]);
    this.actionPanel.setVisible(!onDeck);
    this.movePanel.setVisible(false);
  }
  private showMovePanel()   { const onDeck = deckShowMoves(this.playerPokemon.moves, i => this.onMoveSelected(this.playerPokemon.moves[i]), () => { this.state = 'playerAction'; this.showActionPanel(); }); this.movePanel.setVisible(!onDeck); this.actionPanel.setVisible(false); }
  private hideAllPanels()   { deckHideBattleActions(); this.actionPanel.setVisible(false); this.movePanel.setVisible(false); }

  private animateHpBar(who: 'player' | 'enemy', onDone: () => void) {
    const pokemon = who === 'player' ? this.playerPokemon : this.enemyPokemon;
    const bar     = who === 'player' ? this.playerHpBar   : this.enemyHpBar;
    const hpText  = who === 'player' ? this.playerHpText  : this.enemyHpText;
    const maxW    = 220;
    const targetW = Math.max(0, (pokemon.hp / pokemon.maxHp) * maxW);
    bar.fillColor  = pokemon.hp / pokemon.maxHp > 0.5 ? 0x44cc44 : pokemon.hp / pokemon.maxHp > 0.25 ? 0xddcc00 : 0xcc4444;

    this.tweens.add({
      targets: bar, width: targetW, duration: 600, ease: 'Linear',
      onUpdate: () => { hpText.setText(`${pokemon.hp}/${pokemon.maxHp}`); },
      onComplete: onDone,
    });
  }

  private typeDialog(text: string, onDone?: () => void) {
    this.dialogText.setText('');
    let i = 0;
    const timer = this.time.addEvent({
      delay: 30,
      repeat: text.length - 1,
      callback: () => {
        this.dialogText.setText(text.slice(0, ++i));
        if (i >= text.length) {
          timer.destroy();
          if (onDone) this.time.delayedCall(800, onDone);
        }
      },
    });
  }

  private loadSprite(key: string, url: string): Promise<void> {
    return new Promise(resolve => {
      if (this.textures.exists(key)) { resolve(); return; }
      this.load.image(key, url);
      this.load.once('complete', resolve);
      this.load.start();
    });
  }
}
