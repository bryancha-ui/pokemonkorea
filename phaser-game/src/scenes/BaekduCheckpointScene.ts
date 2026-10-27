import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { vanishesAfterDefeat } from '../data/Villains';
import { drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { PartySystem } from '../systems/PartySystem';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';
import { markTrainerPortrait } from '../data/BattlePortraits';

// ── Tiles ─────────────────────────────────────────────────────────────────────
// A militarized mountain checkpoint: snow paths threaded between iron walls,
// flanking watchtowers, and the great gate at the top.
const T = { ROCK: 0, SNOW: 1, WALL: 2, GATE: 3, DRIFT: 4, TOWER: 5, COURT: 6 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 46;
const COLORS: Record<Tile, number> = {
  [T.ROCK]: 0x3a3640, [T.SNOW]: 0xd8dce6, [T.WALL]: 0x4a4a52, [T.GATE]: 0x2a2a30,
  [T.DRIFT]: 0xb6c2d2, [T.TOWER]: 0x5a5460, [T.COURT]: 0xc2c8d4,
};
const SOLID = new Set<Tile>([T.ROCK, T.WALL, T.GATE, T.TOWER]);
const ENCOUNTER = new Set<Tile>([T.DRIFT]);

// Cold-mountain wild Pokémon (ice / dark / steel), mostly customs
const SNOW_ENCOUNTERS: EncounterEntry[] = [
  { id: 'bosongnun', weight: 14, minLevel: 50, maxLevel: 52, isCustom: true, catchRate: 170 }, // Ice/Fairy
  { id: 'luninari',  weight: 12, minLevel: 50, maxLevel: 52, isCustom: true, catchRate: 160 }, // Ice/Fairy
  { id: 'martbadger',weight: 12, minLevel: 50, maxLevel: 52, isCustom: true, catchRate: 150 }, // Dark/Steel
  { id: 'corrpanda', weight: 12, minLevel: 50, maxLevel: 52, isCustom: true, catchRate: 160 }, // Dark
  { id: 461, weight: 8, minLevel: 50, maxLevel: 52, isCustom: false, catchRate: 120 },         // Weavile
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.ROCK) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  // Approach road from the south (bottom)
  fill(40, ROWS, 9, 15, T.SNOW);
  // Outer perimeter — switchbacks between iron walls
  fill(34, 42, 4, 20, T.SNOW);
  fill(4, 38, 0, 4, T.WALL);          // west wall
  fill(4, 38, 20, COLS, T.WALL);      // east wall
  fill(28, 34, 4, 12, T.SNOW);
  fill(22, 30, 12, 20, T.SNOW);
  fill(16, 24, 4, 14, T.SNOW);
  // Snowdrift patches (wild encounters)
  fill(35, 39, 6, 10, T.DRIFT);
  fill(23, 27, 13, 18, T.DRIFT);
  // Inner courtyard before the gate
  fill(8, 16, 4, 20, T.COURT);
  fill(16, 18, 9, 15, T.SNOW);        // approach into the courtyard
  // Two flanking watchtowers
  fill(8, 12, 4, 8, T.TOWER);         // west tower
  fill(8, 12, 16, 20, T.TOWER);       // east tower
  // The great iron gate (top wall with the gate cells the captain holds)
  fill(4, 8, 4, 20, T.WALL);
  fill(4, 8, 10, 14, T.GATE);         // the gate itself (opens after the captain falls)
  fill(0, 4, 10, 14, T.SNOW);         // the trail beyond, up the mountain
  return m;
}

interface Soldier {
  key: string; name: string; col: number; row: number; label: string;
  line: string; pokemon: { id: number; level: number; custom?: string }[]; expPool: number;
}

export class BaekduCheckpointScene extends Phaser.Scene {
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = 12 * TILE + 16;
  private py = 44 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;

  // Perimeter soldiers + the two watchtower sentries.
  private readonly SOLDIERS: Soldier[] = [
    {
      key: 'baekdu-soldier-1', name: '노스단 Soldier', col: 7, row: 31, label: '노스단\nSoldier',
      line: "노스단 Soldier: The southern road ends at this gate. You should have turned back.",
      pokemon: [{ id: 461, level: 53 }, { id: 0, level: 53, custom: 'martbadger' }], // Weavile (Ice/Dark), Martbadger (Steel)
      expPool: 2200,
    },
    {
      key: 'baekdu-soldier-2', name: '노스단 Soldier', col: 16, row: 25, label: '노스단\nSoldier',
      line: "노스단 Soldier: Hold the line! Nothing reaches the towers!",
      pokemon: [{ id: 0, level: 53, custom: 'balchataek' }, { id: 0, level: 54, custom: 'snoqueen' }], // Dark/Fighting, Ice
      expPool: 2300,
    },
    {
      key: 'baekdu-sentry-w', name: 'Watchtower Sentry', col: 6, row: 11, label: 'West\nTower',
      line: "Watchtower Sentry: You'll not cut my searchlight, southerner!",
      pokemon: [{ id: 0, level: 54, custom: 'palmcockatoo' }, { id: 0, level: 55, custom: 'metdoyaroe' }], // Dark/Flying, Electric
      expPool: 2500,
    },
    {
      key: 'baekdu-sentry-e', name: 'Watchtower Sentry', col: 17, row: 11, label: 'East\nTower',
      line: "Watchtower Sentry: The east light stays lit. Come and put it out.",
      pokemon: [{ id: 225, level: 54 }, { id: 0, level: 55, custom: 'martbadger' }], // Delibird (Ice/Flying), Martbadger (Dark/Steel)
      expPool: 2500,
    },
  ];

  constructor() { super('BaekduCheckpointScene'); }

  private get gateOpen() { return !!this.registry.get('baekduCheckpointDone'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    playBgm(this, 'baekducheck');
    // Seollan's defeat (a normal trainer win) opens the gate.
    if (this.registry.get('trainerDefeated_baekdu-seollan')) this.registry.set('baekduCheckpointDone', true);
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('baekduCheckpointReturnX') as number | undefined;
    const ry = this.registry.get('baekduCheckpointReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('baekduCheckpointReturnX'); this.registry.remove('baekduCheckpointReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawSoldiers();
    if (!this.gateOpen) this.drawCaptain();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'BaekduCheckpointScene');

    if (!this.registry.get('baekduCheckpointSeen')) {
      this.registry.set('baekduCheckpointSeen', true);
      this.time.delayedCall(600, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'The plane sets down on a wind-scoured snowfield at the foot of Baekdu. The highland pass ahead has been sealed — a fortified 노스단 checkpoint blocks the trail, with an iron gate, watchtowers, and searchlights sweeping the snow.',
          '노스단 Garrison Officer: This pass is closed by order of the Commander. The southern road ends here. There is nothing past this gate but the future of the north.',
          'Chaeyeon: This is a full garrison — they\'ve dug in. We push through one position at a time, take the watchtowers, and force the gate. Stay close. I\'ll keep your team standing.',
        ], () => { this.cutsceneActive = false; });
      });
    } else {
      this.time.delayedCall(300, () => maybeLaunchEvolution(this));
    }
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.gateOpen && this.map[r][c] === T.GATE ? T.SNOW : this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.ROCK) { g.fillStyle(0x2a2630); g.fillRect(c*TILE+4, r*TILE+5, 8, 7); g.fillRect(c*TILE+18, r*TILE+18, 9, 8); }
      if (t === T.SNOW || t === T.COURT) { g.fillStyle(0xffffff, 0.5); g.fillRect(c*TILE+6, r*TILE+8, 3, 3); g.fillRect(c*TILE+20, r*TILE+20, 3, 3); }
      if (t === T.WALL) { g.fillStyle(0x33333a); for (let i=0;i<2;i++){ g.fillRect(c*TILE, r*TILE+i*16+2, TILE, 2);} g.fillStyle(0x5a5a64); g.fillRect(c*TILE+2,r*TILE+4,6,10); g.fillRect(c*TILE+14,r*TILE+18,6,10); }
      if (t === T.GATE) { g.fillStyle(0x1a1a1f); g.fillRect(c*TILE, r*TILE, TILE, TILE); g.fillStyle(0x6a6a76); for (let i=0;i<3;i++) g.fillRect(c*TILE+4+i*9, r*TILE+2, 3, TILE-4); }
      if (t === T.TOWER) { g.fillStyle(0x6a6470); g.fillRect(c*TILE+2, r*TILE+2, TILE-4, TILE-4); g.fillStyle(0xffe44e, this.gateOpen ? 0.15 : 0.85); g.fillCircle(c*TILE+16, r*TILE+10, 5); }
      if (t === T.DRIFT) { g.fillStyle(0xffffff, 0.7); g.fillEllipse(c*TILE+12, r*TILE+22, 18, 8); g.fillEllipse(c*TILE+22, r*TILE+16, 14, 6); }
    }
    const key = '__baekduCheckpointMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(12 * TILE, 0.6 * TILE, this.gateOpen ? tr('↑ Baekdu Peak — the climb') : tr('⛓ The Iron Gate'), {
      fontSize: '10px', color: '#ffd0d0', backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(12 * TILE, 45.4 * TILE, tr('↓ back south'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawSoldiers() {
    for (const s of this.SOLDIERS) {
      if (this.registry.get(`trainerDefeated_${s.key}`) && vanishesAfterDefeat(s.key)) continue;
      this.drawFigure(s.col, s.row, 0x14141c, 0xaab0c0, s.label, '#bcd0ff');
    }
  }
  private drawCaptain() {
    if (this.registry.get('trainerDefeated_baekdu-seollan')) return;
    const captain = this.drawFigure(12, 8, 0x0e0e16, 0x88ccff, 'Gate Captain\nSeollan', '#aee0ff');
    markTrainerPortrait(captain, 'baekdu-seollan');
  }
  private drawFigure(col: number, row: number, coat: number, trim: number, label: string, labelColor: string) {
    const g = this.add.graphics().setDepth(8);
    g.setPosition(col * TILE + 16, row * TILE + 16);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(coat); g.fillRect(-7, -8, 14, 12);
    g.fillStyle(trim); g.fillRect(-7, -8, 14, 2);
    g.fillStyle(0x222222); g.fillRect(-6, 4, 5, 8); g.fillRect(1, 4, 5, 8);
    g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
    g.fillStyle(0x0a0a10); g.fillRect(-6, -21, 12, 5);
    g.fillStyle(trim); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2);
    this.add.text(col * TILE + 16, row * TILE - 14, label, {
      fontSize: '8px', color: labelColor, backgroundColor: '#00000099', padding: { x: 2, y: 1 }, align: 'center',
    }).setOrigin(0.5).setDepth(9);
    return g;
  }

  // ── Player / camera / input ──────────────────────────────────────────────
  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }
  private setupCamera() {
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.setZoom(1.6);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
  }
  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 420, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('⛓ Seolbong Pass — The Garrison Gate'), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 34, '', {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  SPACE: talk  M: menu'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(_: number, delta: number) {
    if (this.cutsceneActive) {
      if (this.dialog.isInChoice()) {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.dialog.navigateChoice(-1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.dialog.navigateChoice(1);
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.confirmChoice();
      } else if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
      return;
    }
    const dt = delta / 1000; let dx = 0, dy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  { dx = -1; this.facing = 2; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { dx =  1; this.facing = 3; }
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    { dy = -1; this.facing = 1; }
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  { dy =  1; this.facing = 0; }
    const moving = dx !== 0 || dy !== 0;
    const running = moving && !!this.registry.get('hasRunningShoes') && this.shiftKey.isDown;
    const speed = running ? this.RUN : this.SPEED;
    if (moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = this.px + (dx / len) * speed * dt, ny = this.py + (dy / len) * speed * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; this.steps++; this.checkEncounter(); }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkSoldiers();
    this.checkCaptain();
    this.checkExits();
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      const t = this.map[row][col];
      if (t === T.GATE && this.gateOpen) return false;   // the gate stands open
      return SOLID.has(t);
    });
  }

  private checkEncounter() {
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (!t || !ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.20) return;
    this.steps = 0; this.nextEnc = 8 + Math.floor(Math.random() * 8);
    const e = pickEncounter(SNOW_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'BaekduCheckpointScene');
    this.registry.set('baekduCheckpointReturnX', this.px); this.registry.set('baekduCheckpointReturnY', this.py);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  private startBattle(name: string, key: string, pokemon: object, expPool: number) {
    this.registry.set('trainerName', name);
    this.registry.set('trainerKey', key);
    this.registry.set('trainerPokemon', JSON.stringify(pokemon));
    this.registry.set('trainerExpPool', expPool);
    this.registry.set('trainerReturnScene', 'BaekduCheckpointScene');
    this.registry.set('baekduCheckpointReturnX', this.px); this.registry.set('baekduCheckpointReturnY', this.py);
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
  }

  private checkSoldiers() {
    for (const s of this.SOLDIERS) {
      if (this.registry.get(`trainerDefeated_${s.key}`)) continue;
      const wx = s.col * TILE + 16, wy = s.row * TILE + 16;
      if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.5) {
        this.cutsceneActive = true;
        this.dialog.show([s.line, `${s.name}: For the north!`], () => {
          PartySystem.healAll(this.registry);   // Chaeyeon field-heals before each assault
          this.startBattle(s.name, s.key, s.pokemon, s.expPool);
        });
        return;
      }
    }
  }

  /** The Gate Captain blocks the iron gate until both towers are dark and she falls. */
  private checkCaptain() {
    if (this.gateOpen) return;
    const wx = 12 * TILE + 16, wy = 8 * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) > TILE * 2) return;
    const towersDark = this.registry.get('trainerDefeated_baekdu-sentry-w')
      && this.registry.get('trainerDefeated_baekdu-sentry-e');
    this.cutsceneActive = true;
    if (!towersDark) {
      this.dialog.show([
        'Gate Captain Seollan: My searchlights still sweep this courtyard. Cut them both before you dare approach my gate.',
      ], () => {
        // Push the player well clear of the trigger radius so the warning
        // doesn't re-fire every frame (infinite-dialogue bug).
        this.py = 12 * TILE + 16;
        this.cutsceneActive = false;
      });
      return;
    }
    const launch = () => {
      PartySystem.healAll(this.registry);
      this.registry.set('trainerName', 'Gate Captain Seollan');
      this.registry.set('trainerKey', 'baekdu-seollan');
      this.registry.set('trainerPokemon', JSON.stringify([
        { id: 0,   level: 75, custom: 'snoqueen' },     // Ice — Aurora Veil
        { id: 0,   level: 76, custom: 'martbadger' },    // Steel/Dark — wall
        { id: 0,   level: 76, custom: 'corrpanda' },     // Dark — Sucker Punch
        { id: 699, level: 78 },                           // Aurorus (Rock/Ice ace) — Avalanche + Stealth Rock
      ]));
      this.registry.set('trainerExpPool', 3000);
      this.registry.set('trainerReturnScene', 'BaekduCheckpointScene');
      this.registry.set('baekduCheckpointReturnX', 12 * TILE + 16);
      this.registry.set('baekduCheckpointReturnY', 9 * TILE + 16);
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    };
    if (!this.registry.get('seollanSeen')) {
      this.registry.set('seollanSeen', true);
      this.dialog.show([
        'With the towers dark, the garrison\'s commanding officer plants herself before the iron gate.',
        "Gate Captain Seollan: You've cut my lights and scattered my line. Impressive, for a southerner.",
        "Seollan: But this gate does not open for the likes of you.",
      ], launch);
    } else {
      this.dialog.show(["Seollan: Still here? Then we settle it at the gate."], launch);
    }
  }

  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // South → back down the approach (return toward Sunrise City)
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('sunriseCityReturnX', 15 * 32); this.registry.set('sunriseCityReturnY', 3 * 32);
        this.scene.start('SunriseCityScene');
      });
      return;
    }
    // North through the open gate → the summit climb
    if (this.gateOpen && this.py < 1 * TILE) {
      this.cutsceneActive = true;
      if (!this.registry.get('baekduGatePassed')) {
        this.registry.set('baekduGatePassed', true);
        this.dialog.show([
          'Seollan steps aside from the gate. "The gate is yours. But the mountain will not forgive you the way I have."',
          'The iron gate grinds open. Beyond it, the snow-swept switchbacks of Baekdu Peak rise into a bruised red sky — and far above, six towers pulse.',
          "Rival: That was just the front door. Whatever's waiting up there is worse. ...Let's finish it.",
        ], () => this.toSummit());
      } else {
        this.toSummit();
      }
    }
  }

  private toSummit() {
    this.cameras.main.fadeOut(400, 0, 0, 0, () => {
      this.registry.set('baekduSummitReturnX', 12 * 32 + 16);
      this.registry.set('baekduSummitReturnY', 64 * 32 + 16);
      this.scene.start('BaekduSummitScene');
    });
  }
}
