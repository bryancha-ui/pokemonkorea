import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { vanishesAfterDefeat } from '../data/Villains';
import { drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { DexTracker } from '../systems/DexTracker';
import { PartySystem } from '../systems/PartySystem';
import { Inventory } from '../systems/Items';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';
import { markTrainerPortrait } from '../data/BattlePortraits';
import { customForm } from '../data/CustomBattle';
import { migrateLegacyCheonjiCapture } from '../systems/StoryMigrations';

// Sprites depicted on-screen during the capture finale (the Spirit of Cheonji's advent +
// 나비할망's Dancheong shield with the freed trio).
const FINALE_CAST = ['cheonjisin', 'nabihalmang', 'poongbaek', 'woosa', 'woonsa'] as const;

// ── Tiles ─────────────────────────────────────────────────────────────────────
const T = { ROCK: 0, SNOW: 1, DRIFT: 2, GATE: 3, SUMMIT: 4, TOWER: 5, ALTAR: 6, LAKE: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 68;
const COLORS: Record<Tile, number> = {
  [T.ROCK]: 0x322c34, [T.SNOW]: 0xd6dae6, [T.DRIFT]: 0xb4c0d2, [T.GATE]: 0x241f2a,
  [T.SUMMIT]: 0x4a3a4a, [T.TOWER]: 0x2a2238, [T.ALTAR]: 0x6a5a7a, [T.LAKE]: 0x3a2a6a,
};
const SOLID = new Set<Tile>([T.ROCK, T.GATE, T.TOWER, T.LAKE]);
const ENCOUNTER = new Set<Tile>([T.DRIFT]);

// Cold-summit wild Pokémon (ice / dark), all customs
const SUMMIT_ENCOUNTERS: EncounterEntry[] = [
  { id: 'luninari',   weight: 14, minLevel: 52, maxLevel: 54, isCustom: true, catchRate: 150 },
  { id: 'snoqueen',   weight: 10, minLevel: 53, maxLevel: 55, isCustom: true, catchRate: 130 },
  { id: 'corrpanda',  weight: 12, minLevel: 52, maxLevel: 54, isCustom: true, catchRate: 150 },
  { id: 'martbadger', weight: 12, minLevel: 52, maxLevel: 54, isCustom: true, catchRate: 150 },
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.ROCK) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  // ── Switchback climb up the peak ────────────────────────────────────────────
  fill(60, ROWS, 10, 14, T.SNOW);   // entry, bottom (from the gate)
  fill(58, 62, 3, 14, T.SNOW);
  fill(48, 62, 3, 7, T.SNOW);
  fill(46, 50, 3, 21, T.SNOW);
  fill(36, 50, 17, 21, T.SNOW);
  fill(34, 38, 3, 21, T.SNOW);
  fill(24, 38, 3, 7, T.SNOW);
  fill(22, 26, 3, 21, T.SNOW);
  fill(12, 26, 17, 21, T.SNOW);
  fill(10, 14, 3, 21, T.SNOW);
  fill(2, 14, 9, 15, T.SNOW);        // final climb to the summit gate
  // Snowdrift encounter patches along the ledges
  fill(58, 61, 8, 12, T.DRIFT);
  fill(46, 49, 9, 14, T.DRIFT);
  fill(34, 37, 8, 13, T.DRIFT);
  fill(22, 25, 9, 14, T.DRIFT);
  // ── Summit ──────────────────────────────────────────────────────────────────
  fill(1, 9, 3, 21, T.SUMMIT);       // the summit plateau
  fill(8, 10, 10, 14, T.GATE);       // Executive Mubaek's gate (opens when he falls)
  fill(2, 5, 9, 15, T.LAKE);         // the churning volcanic lake at the center
  m[5][11] = T.ALTAR; m[5][12] = T.ALTAR;   // the central pedestal for the seventh tablet
  // The six energy towers ringing the lake
  for (const [r, c] of [[1,5],[1,11],[1,17],[7,5],[7,11],[7,17]] as [number,number][]) {
    m[r][c] = T.TOWER; if (m[r]?.[c+1] !== undefined) m[r][c+1] = T.TOWER;
  }
  return m;
}

interface Foe {
  key: string; name: string; col: number; row: number; label: string;
  line: string; pokemon: { id: number; level: number; custom?: string }[]; expPool: number;
}

export class BaekduSummitScene extends Phaser.Scene {
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 12 * TILE + 16;
  private py = 64 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;
  // Finale visuals (the Spirit of Cheonji's advent; calmed when the shield goes up).
  private cheonjisinImg?: Phaser.GameObjects.Image;
  private cheonjisinCalm = false;

  private readonly FOES: Foe[] = [
    {
      key: 'baekdu-grunt-1', name: '노스단 Grunt', col: 18, row: 47, label: '노스단\nGrunt',
      line: "노스단 Grunt: The matrix is almost complete. You're too late to matter!",
      pokemon: [{ id: 0, level: 63, custom: 'corrpanda' }, { id: 0, level: 64, custom: 'palmcockatoo' }],
      expPool: 2300,
    },
    {
      key: 'baekdu-admin-1', name: '노스단 Admin', col: 5, row: 30, label: '노스단\nAdmin',
      line: "노스단 Admin: Commander Ryeo's last order still stands. The trio's power will wake the Spirit of Cheonji — and the south will kneel.",
      pokemon: [{ id: 0, level: 64, custom: 'martbadger' }, { id: 0, level: 65, custom: 'balchataek' }, { id: 0, level: 65, custom: 'foxgeist' }],
      expPool: 2800,
    },
  ];

  constructor() { super('BaekduSummitScene'); }

  preload() {
    // Load the four legendaries shown during the Dancheong-shield capture cutscene.
    for (const key of FINALE_CAST) {
      if (this.textures.exists(key)) continue;
      const url = customForm(key)?.data.spriteUrl ?? `assets/dex/${key}.png`;
      this.load.image(key, url);
    }
  }

  private get gateOpen() { return !!this.registry.get('trainerDefeated_nosdan-mubaek'); }
  private get caught() {
    return DexTracker.isCaught(this.registry, 'cheonjisin')
      || PartySystem.get(this.registry).some(e => e.spriteKey === 'cheonjisin')
      || (this.registry.get('box') as string ?? '').includes('cheonjisin');
  }

  create() {

    migrateLegacyCheonjiCapture(this.registry);

    playBgm(this, 'baekdupeak');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    this.cheonjisinImg = undefined; this.cheonjisinCalm = false;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('baekduSummitReturnX') as number | undefined;
    const ry = this.registry.get('baekduSummitReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('baekduSummitReturnX'); this.registry.remove('baekduSummitReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawFoes();
    if (!this.gateOpen) this.drawFigure(12, 10, 0x0c0c14, 0xcc3344, 'Executive\nMubaek', '#ff99aa');
    this.createPlayer();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [T.LAKE], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'BaekduSummitScene');

    // Returned from the legendary encounter with the Spirit of Cheonji → the ending note.
    if (this.caught && !this.registry.get('chapter11Done')) {
      this.time.delayedCall(300, () => this.runEnding());
    } else if (this.registry.get('chapter11Done')) {
      // Finale already complete — never strand the player at the peak; descend to Altar.
      this.cutsceneActive = true;
      this.time.delayedCall(300, () => {
        this.cameras.main.fadeOut(500, 0, 0, 0, () => {
          this.registry.set('rgAltarReturnX', 11 * 32 + 16);
          this.registry.set('rgAltarReturnY', 20 * 32 + 16);
          this.scene.start('RangrimAltarScene');
        });
      });
    } else if (!this.registry.get('baekduSummitSeen')) {
      this.registry.set('baekduSummitSeen', true);
      this.time.delayedCall(500, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'Past the broken gate, the snow-swept switchbacks of Baekdu Peak rise into a bruised red-and-violet sky, crackling with siphoned energy bleeding off the six towers.',
          "Chaeyeon: Keep moving. I'll patch your Pokémon between their patrols. You'll need every one of them at full strength up top.",
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
      if (t === T.ROCK) { g.fillStyle(0x231e26); g.fillRect(c*TILE+4, r*TILE+5, 8, 7); g.fillRect(c*TILE+18, r*TILE+18, 9, 8); }
      if (t === T.SNOW || t === T.SUMMIT) { g.fillStyle(0xffffff, 0.45); g.fillRect(c*TILE+6, r*TILE+8, 3, 3); g.fillRect(c*TILE+20, r*TILE+20, 3, 3); }
      if (t === T.DRIFT) { g.fillStyle(0xffffff, 0.7); g.fillEllipse(c*TILE+12, r*TILE+22, 18, 8); g.fillEllipse(c*TILE+22, r*TILE+16, 14, 6); }
      if (t === T.GATE) { g.fillStyle(0x18141c); g.fillRect(c*TILE, r*TILE, TILE, TILE); g.fillStyle(0x5a4a6a); for (let i=0;i<3;i++) g.fillRect(c*TILE+4+i*9, r*TILE+2, 3, TILE-4); }
      if (t === T.LAKE) { g.fillStyle(0x6a3aaa, 0.6); g.fillRect(c*TILE+3, r*TILE+6, TILE-6, 5); g.fillStyle(0xcc4466, 0.5); g.fillRect(c*TILE+8, r*TILE+18, TILE-16, 4); }
      if (t === T.TOWER) { g.fillStyle(0x6a3acc, 0.9); g.fillRect(c*TILE+6, r*TILE-6, TILE-12, TILE+8); g.fillStyle(0xff5577, 0.7); g.fillRect(c*TILE+10, r*TILE-2, TILE-20, 8); }
      if (t === T.ALTAR) { g.fillStyle(0x9a8aba); g.fillRect(c*TILE+4, r*TILE+6, TILE-8, TILE-10); g.fillStyle(0xffe44e, 0.8); g.fillRect(c*TILE+11, r*TILE+9, 8, 8); }
    }
    // Bruised sky tint over the summit
    g.fillStyle(0xaa2255, 0.18); g.fillRect(0, 0, COLS * TILE, 12 * TILE);
    const key = '__baekduSummitMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(12 * TILE, 0.6 * TILE, tr('🌋 Cheonji — the summit lake'), {
      fontSize: '10px', color: '#ffd0d0', backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(12 * TILE, 67.4 * TILE, tr('↓ the gate'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(0.6 * TILE, 34 * TILE, tr('← Ancient Altar'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0, 0.5).setDepth(5);
  }

  private drawFoes() {
    for (const f of this.FOES) {
      if (this.registry.get(`trainerDefeated_${f.key}`) && vanishesAfterDefeat(f.key)) continue;
      const figure = this.drawFigure(f.col, f.row, 0x14141c, 0xaab0c0, f.label, '#bcd0ff');
      markTrainerPortrait(figure, f.key);
    }
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
    // Debug: press 0 to replay the Spirit of Cheonji capture finale from the top.
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO).on('down', () => this.debugReplayFinale());
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 420, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🏔 Baekdu Peak — The Final Confrontation'), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  SPACE: talk  M: menu  [0: replay finale]'), {
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
    this.checkSuri();
    this.checkFoes();
    this.checkMubaek();
    this.checkSummit();
    this.checkExits();
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      const t = this.map[row][col];
      if (t === T.GATE && this.gateOpen) return false;
      return SOLID.has(t);
    });
  }

  private checkEncounter() {
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (!t || !ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.18) return;
    this.steps = 0; this.nextEnc = 8 + Math.floor(Math.random() * 8);
    const e = pickEncounter(SUMMIT_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'BaekduSummitScene');
    this.registry.set('baekduSummitReturnX', this.px); this.registry.set('baekduSummitReturnY', this.py);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  /** Director Suri intercepts mid-climb — pale and shaken, warning of the eruption. */
  private checkSuri() {
    if (this.registry.get('baekduSuriSeen')) return;
    if (this.py > 40 * TILE) return;
    this.registry.set('baekduSuriSeen', true);
    this.cutsceneActive = true;
    this.dialog.show([
      'Director Suri stumbles down the path to meet you — pale, shaken, the seventh tablet\'s rubbing clutched in her notes.',
      "Director Suri: I ran the numbers on 노스단's matrix. They didn't. The trio's siphoned energy isn't stabilizing anything — it's CONCENTRATING heat into the magma chamber beneath this peak.",
      "Director Suri: If that machine runs to completion, it won't just wake the Spirit of Cheonji. It will trigger an eruption that takes the entire northern range with it.",
      "Director Suri: I spent thirty years chasing a way to heal this region. I won't let my work be the thing that ends it. You carry the seventh tablet — and 나비할망. Stop them. Please.",
    ], () => { this.cutsceneActive = false; });
  }

  private checkFoes() {
    for (const f of this.FOES) {
      if (this.registry.get(`trainerDefeated_${f.key}`)) continue;
      const wx = f.col * TILE + 16, wy = f.row * TILE + 16;
      if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.5) {
        this.cutsceneActive = true;
        this.dialog.show([f.line, "Chaeyeon: I've got your team — go!"], () => {
          PartySystem.healAll(this.registry);   // Chaeyeon heals between gauntlet fights
          this.registry.set('trainerName', f.name);
          this.registry.set('trainerKey', f.key);
          this.registry.set('trainerPokemon', JSON.stringify(f.pokemon));
          this.registry.set('trainerExpPool', f.expPool);
          this.registry.set('trainerReturnScene', 'BaekduSummitScene');
          this.registry.set('baekduSummitReturnX', this.px); this.registry.set('baekduSummitReturnY', this.py);
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  /** Executive Mubaek blocks the summit gate; the Rival fights at your side. */
  private checkMubaek() {
    if (this.gateOpen) return;
    const wx = 12 * TILE + 16, wy = 10 * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) > TILE * 2.2) return;
    this.cutsceneActive = true;
    const launch = () => {
      PartySystem.healAll(this.registry);
      this.registry.set('trainerName', 'Executive Mubaek');
      this.registry.set('trainerKey', 'nosdan-mubaek');
      this.registry.set('trainerPokemon', JSON.stringify([
        { id: 0,   level: 75, custom: 'corrpanda' },    // Dark — Snarl / screens
        { id: 0,   level: 76, custom: 'martbadger' },    // Steel/Dark — Iron Defense
        { id: 553, level: 77 },                           // Krookodile (Ground/Dark) — Earthquake
        { id: 0,   level: 77, custom: 'snoqueen' },       // Ice — Icicle Crash
        { id: 0,   level: 78, custom: 'foxgeist' },       // Poison/Ghost — Toxic / Sludge Bomb
        { id: 0,   level: 79, custom: 'dracopaia' },      // Water/Dragon ace — Blizzard / Draco Meteor
      ]));
      this.registry.set('trainerExpPool', 3800);
      this.registry.set('trainerReturnScene', 'BaekduSummitScene');
      this.registry.set('baekduSummitReturnX', 12 * TILE + 16);
      this.registry.set('baekduSummitReturnY', 11 * TILE + 16);
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    };
    if (!this.registry.get('mubaekSeen')) {
      this.registry.set('mubaekSeen', true);
      this.dialog.show([
        'At the summit gate, a towering, severe figure blocks the way — an Executive answering only to Ryeo herself.',
        "Executive Mubaek: Commander Ryeo retreated. I did not. The matrix completes in minutes, and you will not reach the altar before it does.",
        "Rival: I didn't take the title of Magistrate just for show. Go! I'll break their line — you fix the sky!",
        "Rival: Six of them and he still won't move? Fine by me. We hold this gate together!",
      ], launch);
    } else {
      this.dialog.show(["Executive Mubaek: The gate holds while I stand. Come, then."], launch);
    }
  }

  /** Debug helper: strip the captured Spirit of Cheonji + finale flags and respawn on the
   *  plateau so the whole advent → shield → catch sequence replays. (Press 0.) */
  private debugReplayFinale() {
    if (this.cutsceneActive) return;
    const strip = (key: string) => {
      const raw = this.registry.get(key) as string | undefined;
      if (!raw) return;
      try {
        const arr = JSON.parse(raw) as unknown[];
        this.registry.set(key, JSON.stringify(arr.filter(x =>
          typeof x === 'string' ? x !== 'cheonjisin' : (x as { spriteKey?: string }).spriteKey !== 'cheonjisin')));
      } catch { /* ignore */ }
    };
    ['party', 'box', 'dexCaught', 'dexSeen'].forEach(strip);
    this.registry.set('chapter11Done', false);
    this.registry.set('baekduFinaleSeen', false);
    this.registry.set('trainerDefeated_nosdan-mubaek', true);   // keep the gate open
    this.registry.set('baekduSummitReturnX', 12 * TILE + 16);
    this.registry.set('baekduSummitReturnY', 6 * TILE + 16);    // on the plateau → auto-triggers
    this.scene.restart();
  }

  /** Reaching the summit plateau triggers the survival → release → catch finale. */
  private checkSummit() {
    if (!this.gateOpen || this.caught) return;
    if (this.py > 7 * TILE) return;
    this.cutsceneActive = true;
    const toShield = () => {
      this.playDancheong();   // depict 나비할망 + the freed trio on-screen
      this.dialog.show([
        '▶ You release 나비할망.',
        '나비할망 launches into the center of the storm. Her metallic, dancheong-patterned wings unfurl — wider, and wider — into a vast translucent dome whose patterns exactly match the ancient tablets.',
        "The dome drinks in the chaotic red-and-purple spikes torn from 풍백, 우사, and 운사 — and converts them into a slow, gentle aurora that washes down across the peak.",
        'Far across the Taebaek range, three cries echo — Wind, Rain, and Clouds, set free. The chains of the matrix shatter; the trio scatter back into the wild peaks.',
        "The Spirit of Cheonji, its borrowed agony lifted, slowly stills. Its corona fades from violent red to a calm, deep blue.",
        "Prof. Song (comms): Now — while it's calm. This is your chance. End its suffering, or make it yours.",
      ], this.launchCatch);
    };
    const releasePrompt = () => {
      this.dialog.show([
        "Prof. Song: You have to SURVIVE. Hold out — keep your team alive — until the moment is right. Then release her.",
        "The aura grows more violent each round as the towers strain... until the moment comes.",
        "▶ RELEASE 나비할망?  (Yes — release her / No — hold on)",
      ], () => {
        this.dialog.showChoice(toShield, () => {
          this.dialog.show(["You steel yourself and weather another wave of the Spirit's fury..."], releasePrompt);
        });
      });
    };
    const revealAdvent = () => {
      this.playAdvent();   // The Spirit of Cheonji rises from the lake, depicted on-screen
      this.dialog.show([
        'The Spirit of Cheonji rises, dragging the siphoned power of the captured trio in a thrashing red-and-purple corona around its body.',
        'It is not attacking out of malice. It is in agony — the matrix is wrenching at its waking mind, and the trio\'s chained energy feeds the overload.',
        "Prof. Song (comms): Listen to me — you can't DEFEAT it! That energy isn't its own; it's 풍백, 우사, and 운사's power forced through it! Every hit you land just feeds the matrix more!",
      ], releasePrompt);
    };
    if (!this.registry.get('baekduFinaleSeen')) {
      this.registry.set('baekduFinaleSeen', true);
      this.dialog.show([
        'You burst onto the summit. At the center of the ring of towers, the volcanic lake churns as the matrix tears open the sky.',
      ], () => {
        revealAdvent();
      });
    } else {
      this.playAdvent();
      releasePrompt();
    }
  }

  private launchCatch = () => {
    PartySystem.healAll(this.registry);
    if (Inventory.count(this.registry, 'masterball') <= 0) Inventory.add(this.registry, 'masterball', 1);
    this.registry.set('wildId', 'cheonjisin');
    this.registry.set('wildLevel', 80);
    this.registry.set('wildCustom', true);
    this.registry.set('wildCatchRate', 3);
    this.registry.set('wildReturnScene', 'BaekduSummitScene');
    this.registry.set('baekduSummitReturnX', 12 * TILE + 16);
    this.registry.set('baekduSummitReturnY', 9 * TILE + 16);
    this.cameras.main.fadeOut(600, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  };

  /** Scale an overlay image so its larger dimension equals `size`. */
  private fitOverlay(img: Phaser.GameObjects.Image, size: number) {
    const src = this.textures.get(img.texture.key).getSourceImage();
    const dim = Math.max((src.width as number) || 1, (src.height as number) || 1);
    img.setScale(size / dim);
  }

  /**
   * The Spirit of Cheonji's advent: it rises from the volcanic lake wreathed in a
   * thrashing red-and-purple corona (the siphoned trio's power). The corona reads
   * `cheonjisinCalm`, so when 나비할망's shield goes up it shifts to a calm deep blue.
   */
  private playAdvent() {
    if (this.cheonjisinImg) return;   // already on-screen this session
    const W = this.scale.width, H = this.scale.height;
    const cx = W / 2, cy = H * 0.40;

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x1a0014, 0).setOrigin(0.5);
    const corona = this.add.graphics();
    const kids: Phaser.GameObjects.GameObject[] = [dim, corona];
    const label = this.add.text(cx, cy + 168, tr('Spirit of Cheonji — 천지신'), {
      fontSize: '14px', color: '#ffd6e0', fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);
    let img: Phaser.GameObjects.Image | undefined;
    if (this.textures.exists('cheonjisin')) {
      img = this.add.image(cx, H * 0.74, 'cheonjisin').setAlpha(0);
      this.fitOverlay(img, 300);
      this.cheonjisinImg = img;
      kids.push(img);
    }
    kids.push(label);

    const root = this.add.container(0, 0, kids).setScrollFactor(0).setDepth(116);
    const zoom = this.cameras.main?.zoom ?? 1, s = 1 / zoom;
    root.setScale(s); root.setPosition((W / 2) * (1 - s), (H / 2) * (1 - s));

    // Entrance: dark sky, the Spirit of Cheonji rises from the lake.
    this.tweens.add({ targets: dim, alpha: 0.5, duration: 800 });
    this.tweens.add({ targets: label, alpha: 1, duration: 1000, delay: 300 });
    if (img) {
      this.tweens.add({ targets: img, alpha: 1, duration: 1000, delay: 300 });
      this.tweens.add({ targets: img, y: cy, duration: 1500, delay: 300, ease: 'Cubic.Out' });
    }

    // Writhing corona — violent red/purple while in agony, calm blue once shielded.
    let phase = 0;
    this.time.addEvent({ delay: 40, loop: true, callback: () => {
      phase += 0.09;
      const calm = this.cheonjisinCalm;
      const my = (this.cheonjisinImg?.y ?? cy);
      corona.clear();
      const cA = calm ? 0x3a7adf : 0xcc2244;
      const cB = calm ? 0x7ad6ff : 0x8a2acc;
      for (let i = 0; i < 12; i++) {
        const a = phase + i * (Math.PI * 2 / 12);
        const rr = 140 + Math.sin(phase * 2 + i) * (calm ? 10 : 36);
        corona.fillStyle(i % 2 ? cA : cB, calm ? 0.28 : 0.5);
        corona.fillCircle(cx + Math.cos(a) * rr, my + Math.sin(a) * rr * 0.78, calm ? 13 : 18);
      }
    }});
  }

  /**
   * The Dancheong-shield set-piece: 나비할망 unfurls her wings into a glowing dome
   * at the center of the summit while the freed trio — 풍백, 우사, 운사 — appear and
   * scatter back to the wild peaks. Rendered as a zoom-compensated screen overlay
   * (matching DialogBox) so it stays framed regardless of the world camera.
   */
  private playDancheong() {
    const W = this.scale.width, H = this.scale.height;
    const make = (key: string, x: number, y: number, size: number, label: string, color: string) => {
      const items: Phaser.GameObjects.GameObject[] = [];
      if (this.textures.exists(key)) {
        const img = this.add.image(x, y, key).setAlpha(0);
        this.fitOverlay(img, size);
        items.push(img);
        const txt = this.add.text(x, y + size / 2 + 6, label, {
          fontSize: '13px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5).setAlpha(0);
        items.push(txt);
      }
      return items;
    };

    // The shield calms the risen Spirit (its corona shifts red → blue) and lifts it.
    this.cheonjisinCalm = true;
    if (this.cheonjisinImg) this.tweens.add({ targets: this.cheonjisinImg, y: H * 0.30, duration: 1400, ease: 'Sine.Out' });

    // Light dim (the advent already darkened the sky) + the dancheong dome over 나비할망.
    const domeCx = W / 2, domeCy = H * 0.60;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x0a1430, 0).setOrigin(0.5);
    const dome = this.add.graphics();
    const drawDome = (radius: number, alpha: number) => {
      dome.clear();
      for (let i = 0; i < 4; i++) {
        const r = radius - i * 26;
        if (r <= 0) continue;
        dome.lineStyle(5, i % 2 === 0 ? 0x66ddff : 0xffe44e, alpha * (1 - i * 0.18));
        dome.strokeEllipse(domeCx, domeCy, r * 2, r * 1.5);
      }
    };

    const nabi  = make('nabihalmang', domeCx,  domeCy, 200, '🦋 나비할망', '#aee9ff');
    const poong = make('poongbaek',   W * 0.15, H * 0.66, 140, '풍백 — Wind',  '#cfe9ff');
    const woo   = make('woosa',       W * 0.85, H * 0.66, 140, '우사 — Rain',  '#bfe6ff');
    const woon  = make('woonsa',      W * 0.5,  H * 0.13, 130, '운사 — Clouds','#dfeaff');

    const root = this.add.container(0, 0, [dim, dome, ...poong, ...woo, ...woon, ...nabi])
      .setScrollFactor(0).setDepth(120);
    // Match DialogBox zoom compensation so design coords map 1:1 to the screen.
    const zoom = this.cameras.main?.zoom ?? 1, s = 1 / zoom;
    root.setScale(s); root.setPosition((W / 2) * (1 - s), (H / 2) * (1 - s));

    // Animate: dim in → dome blooms → 나비할망 rises → trio appear → trio scatter free.
    this.tweens.add({ targets: dim, alpha: 0.25, duration: 500 });
    this.tweens.add({ targets: nabi, alpha: 1, duration: 700, delay: 200 });
    let domeR = 30;
    this.tweens.addCounter({
      from: 30, to: 240, duration: 1200, delay: 200, ease: 'Cubic.Out',
      onUpdate: t => { domeR = t.getValue() ?? domeR; drawDome(domeR, 0.9); },
      onComplete: () => {
        // gentle shimmer
        this.tweens.addCounter({
          from: 0, to: 1, duration: 1400, repeat: -1, yoyo: true,
          onUpdate: t => drawDome(domeR, 0.5 + 0.4 * (t.getValue() ?? 0)),
        });
      },
    });

    // The trio fade in, hover, then are released — scattering off their own side.
    const trio: Array<{ items: Phaser.GameObjects.GameObject[]; dx: number; dy: number }> = [
      { items: poong, dx: -260, dy: 120 },
      { items: woo,   dx:  260, dy: 120 },
      { items: woon,  dx:    0, dy: -200 },
    ];
    for (const t of trio) {
      this.tweens.add({ targets: t.items, alpha: 1, duration: 600, delay: 900 });
      this.tweens.add({
        targets: t.items, x: `+=${t.dx}`, y: `+=${t.dy}`, alpha: 0,
        duration: 1100, delay: 2600, ease: 'Sine.In',
      });
    }
  }

  /** After the Spirit of Cheonji is caught or stilled — place the seventh tablet. */
  private runEnding() {
    this.registry.set('chapter11Done', true);
    this.registry.set('phase2Complete', true);
    this.registry.set('phase2Legendary', 'cheonjisin');
    this.cutsceneActive = true;
    this.dialog.show([
      "The Spirit of Cheonji is yours — its corona gone, the lake mirror-still beneath a clearing sky.",
      "Rival climbs to the summit, Executive Mubaek defeated behind them, and joins you at the central altar.",
      "Rival: ...We actually did it. Together, then. Like always.",
      "Together, you place the final seventh tablet into the central pedestal. The six towers don't shut down — they HARMONIZE.",
      "The bruised red sky clears. Gentle lines of golden light spread outward from the peak, flowing back down across the entire peninsula, settling the disturbed land and restoring its natural balance.",
      "Prof. Song (comms, quiet with relief): The geothermal readings are stabilizing. The eruption threat is gone. The trio are free. And the whole region is breathing again.",
      "Prof. Song: You've done something no one has in a thousand years. The south has its guardian in 나비할망, and the Spirit of Cheonji has restored balance to the northern range. You carry the trust of both now.",
      "나비할망 folds her glowing wings and settles beside you. The first clean stars appear over Baekdu Peak.",
      "You and the Rival make the long descent together, off the sacred mountain.",
      "▶ Chapter 11 complete — the Cheonji crisis is over. ✓",
      "The Onnuri League now awaits beyond Scholars' Road.",
    ], () => {
      // Descend off the summit and head home to the Capitol, where the post-game
      // reunion / epilogue beats pick up.
      this.cameras.main.fadeOut(700, 0, 0, 0, () => {
        this.registry.set('capitalReturnX', 24 * 32 + 16);
        this.registry.set('capitalReturnY', 31 * 32 + 16);
        this.scene.start('CapitolCityScene');
      });
    });
  }

  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // South → back down through the gate to the checkpoint
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('baekduCheckpointReturnX', 12 * 32 + 16); this.registry.set('baekduCheckpointReturnY', 2 * 32);
        this.scene.start('BaekduCheckpointScene');
      });
    }
    // West → to the Ancient Altar (RangrimAltarScene)
    if (this.px < 1 * TILE && this.py > 25 * TILE && this.py < 45 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('rgAltarReturnX', 11 * 32 + 16);
        this.registry.set('rgAltarReturnY', 20 * 32 + 16);
        this.scene.start('RangrimAltarScene');
      });
    }
  }
}
