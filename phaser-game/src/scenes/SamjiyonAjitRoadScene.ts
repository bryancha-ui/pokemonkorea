import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { vanishesAfterDefeat } from '../data/Villains';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';

// ── 노스단 아지트 진입로 (Team North HQ Approach) ────────────────────────────────────
// A separate mountain road climbing off Samho's plateau. At its head — right at the
// front of the road — looms the four-storey 노스단 아지트, banners snapping in the snow-wind,
// grunts posted on the switchbacks. Walk to the gate to storm the headquarters within.

const T = { SNOW: 0, PATH: 1, PINE: 2, ROCK: 3, DRIFT: 4, GATE: 5, BUILDING: 6 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 28, ROWS = 34;
const COLORS: Record<Tile, number> = {
  [T.SNOW]: 0xdfe8ef, [T.PATH]: 0xb9ad86, [T.PINE]: 0x2a4a38, [T.ROCK]: 0x6f6658,
  [T.DRIFT]: 0xf2f7fb, [T.GATE]: 0x5a1024, [T.BUILDING]: 0x22222e,
};
const SOLID = new Set<Tile>([T.PINE, T.ROCK, T.DRIFT, T.BUILDING]);

const GATE_COL = 14, GATE_ROW = 12;  // the HQ door, at the head of the road
const ROAD_LEFT = 13, ROAD_RIGHT = 16;

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.SNOW) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  fill(GATE_ROW, ROWS, ROAD_LEFT, ROAD_RIGHT, T.PATH);   // the climbing road
  // switchbacks so the climb winds a little
  fill(17, 19, 7, ROAD_RIGHT, T.PATH);
  fill(25, 27, ROAD_LEFT, 23, T.PATH);
  fill(0, ROWS, 0, 2, T.ROCK);           // west cliff wall
  fill(0, ROWS, 26, COLS, T.ROCK);        // east cliff wall
  // The original 2D four-storey HQ remains one large, uninterrupted building.
  fill(1, GATE_ROW, 6, 23, T.BUILDING);
  fill(GATE_ROW, GATE_ROW + 1, ROAD_LEFT, ROAD_RIGHT, T.PATH); // gate apron
  m[GATE_ROW][GATE_COL] = T.GATE;        // centred, walkable HQ door
  // snow drifts & pines flanking the road
  for (const [r, c] of [[14,8],[14,20],[21,18],[22,19],[29,8],[30,9],[28,18],[20,7]] as [number,number][]) m[r][c] = T.PINE;
  for (const [r, c] of [[19,9],[24,16],[31,17],[16,7]] as [number,number][]) m[r][c] = T.DRIFT;
  for (const [r, c] of [[16,22],[27,8],[32,8]] as [number,number][]) m[r][c] = T.ROCK;
  return m;
}

interface Sentry { key: string; name: string; col: number; row: number; line: string; pokemon: string; expPool: number; }

export class SamjiyonAjitRoadScene extends Phaser.Scene {
  // One authoritative footprint converts the existing painted HQ facade into
  // its matching purpose-built 3D structure.
  public buildingPlots = [{ x: 6, y: 1, w: 17, h: 11, model: 'nosdan-hq' }];
  public onlyNamedBuildings = true;
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = GATE_COL * TILE + 16;
  private py = 30 * TILE + 16;   // enter from the south (Samho side)
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false; private spawnPx = 0; private spawnPy = 0;
  private readonly SPEED = 120; private readonly RUN = 250;

  private readonly SENTRIES: Sentry[] = [
    {
      key: 'nosdan-ajit-road-1', name: '노스단 Sentry', col: 14, row: 24,
      line: "Halt! This road belongs to 노스단 now. Turn back to your little plateau — the ajit is off-limits!",
      pokemon: JSON.stringify([{ id: 553, level: 72 }, { id: 430, level: 72 }]), expPool: 2400,
    },
    {
      key: 'nosdan-ajit-road-2', name: '노스단 Sentry', col: 14, row: 16,
      line: "You got past the first post? The 간부 said to let no 어사대 dog near the gate. So you'll have to go through me!",
      pokemon: JSON.stringify([{ id: 452, level: 72 }, { id: 625, level: 73 }]), expPool: 2500,
    },
  ];

  constructor() { super('SamjiyonAjitRoadScene'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    playBgm(this, 'headquarternorth');
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('ajitRoadReturnX') as number | undefined;
    const ry = this.registry.get('ajitRoadReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('ajitRoadReturnX'); this.registry.remove('ajitRoadReturnY');

    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawTower();
    this.drawSentries();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'SamjiyonAjitRoadScene');

    // Cleared both sentries → the last grunt drops the 아지트 key. Award it once.
    const sentriesDefeated = this.SENTRIES.every(s => this.registry.get(`trainerDefeated_${s.key}`));
    if (sentriesDefeated && !this.registry.get('hasNosdanKey')) {
      this.time.delayedCall(600, () => {
        this.cutsceneActive = true;
        this.registry.set('hasNosdanKey', true);
        this.dialog.show([
          'The last 노스단 grunt flees, dropping a heavy iron key in the snow!',
          '🔑 You obtained the 노스단 아지트 열쇠! The gate ahead will now unlock.',
        ], () => { this.cutsceneActive = false; });
      });
    }
  }

  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.SNOW) { g.fillStyle(0xffffff, 0.6); g.fillCircle(x + 9, y + 12, 3); g.fillCircle(x + 22, y + 22, 2); }
      if (t === T.PATH) { g.fillStyle(0x9c9070, 0.6); g.fillRect(x + 6, y + 10, 5, 3); g.fillRect(x + 18, y + 20, 5, 3); }
      if (t === T.PINE) { g.fillStyle(0x24242e); g.fillRect(x + 14, y + 24, 4, 6); g.fillStyle(0x2f5a3a); g.fillTriangle(x + 16, y + 3, x + 6, y + 26, x + 26, y + 26); g.fillStyle(0xffffff, 0.5); g.fillTriangle(x + 16, y + 3, x + 12, y + 13, x + 20, y + 13); }
      if (t === T.ROCK) { g.fillStyle(0x5c5347); g.fillTriangle(x + 16, y + 5, x + 3, y + 28, x + 29, y + 28); g.fillStyle(0xffffff, 0.35); g.fillRect(x + 10, y + 8, 6, 3); }
      if (t === T.DRIFT) { g.fillStyle(0xffffff, 0.85); g.fillEllipse(x + 16, y + 20, 30, 18); }
    }
    const key = '__ajitRoadMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text((GATE_COL + 0.5) * TILE, 33.4 * TILE, tr('↓ Samho'), { fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
  }

  private drawTower() {
    // The original single four-storey HQ facade. Its dedicated 3D counterpart
    // repeats these exact shapes, colours, windows, banners and central gate.
    const g = this.add.graphics().setDepth(3);
    const bx = 6 * TILE, by = 1 * TILE, bw = 17 * TILE, bh = 11 * TILE;
    g.fillStyle(0x000000, 0.25); g.fillEllipse(bx + bw / 2, by + bh, bw * 0.8, 14);
    g.fillStyle(0x22222e, 1); g.fillRect(bx, by, bw, bh);
    g.fillStyle(0x303040, 1); g.fillRect(bx + 9, by + 6, bw - 18, bh - 12);
    // Four storeys and three red-lit windows on each floor.
    g.fillStyle(0x14141c, 1);
    for (let i = 1; i < 4; i++) g.fillRect(bx + 8, by + i * (bh / 4), bw - 16, 3);
    g.fillStyle(0xff5a6a, 0.85);
    for (let f = 0; f < 4; f++) for (const w of [0.3, 0.5, 0.7])
      g.fillRect(bx + bw * w - 10, by + 20 + f * (bh / 4), 20, 13);
    // gate
    g.fillStyle(0x5a1024, 1); g.fillRect(GATE_COL * TILE, GATE_ROW * TILE, TILE, TILE);
    g.fillStyle(0x8a1a34, 1); g.fillRect(GATE_COL * TILE + 4, GATE_ROW * TILE + 4, TILE - 8, TILE - 6);

    // Crimson 노스단 banners from the original image.
    const bn = this.add.graphics().setDepth(4);
    for (const cx of [bx + 18, bx + bw - 30]) {
      bn.fillStyle(0x8a1020, 1); bn.fillRect(cx, by + 12, 12, bh - 24);
      bn.fillStyle(0xffd24a, 1); bn.fillCircle(cx + 6, by + bh / 2, 4);
    }

    this.add.text(14.5 * TILE, 0.45 * TILE, tr('🏢 노스단 아지트 (Team North HQ)'), { fontSize: '11px', color: '#ff8aa0', fontStyle: 'bold', backgroundColor: '#000000cc', padding: { x: 5, y: 3 } }).setOrigin(0.5).setDepth(6);
    this.add.text(GATE_COL * TILE + TILE / 2, GATE_ROW * TILE + 40, tr('SPACE — Enter'), { fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(6);
  }

  private drawSentries() {
    for (const s of this.SENTRIES) {
      if (this.registry.get(`trainerDefeated_${s.key}`) && vanishesAfterDefeat(s.key)) continue;
      const g = this.add.graphics().setDepth(8);
      g.setPosition(s.col * TILE + 16, s.row * TILE + 16);
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(0x24242e); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x0e0e16); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -22, 12, 12);
      g.fillStyle(0x141420); g.fillRect(-6, -22, 12, 5);
      g.fillStyle(0x000000); g.fillRect(-3, -16, 2, 2); g.fillRect(1, -16, 2, 2);
      this.add.text(s.col * TILE + 16, s.row * TILE - 14, speakerName('노스단'), { fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(9);
    }
  }

  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    (this.cycling ? drawRiderBody : drawTrainerBody)(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }
  private setupCamera() {
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.setZoom(1.7);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
  }
  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => { if (!this.cutsceneActive && hasBike(this.registry)) { this.cycling = !this.cycling; this.drawChar(); } });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 440, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('⛰ 노스단 아지트 진입로 (HQ Approach)'), {
      fontSize: '14px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  C: bike  SPACE: enter/talk  M: menu'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  update(_: number, delta: number) {
    if (this.cutsceneActive) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
      return;
    }
    const dt = delta / 1000; let dx = 0, dy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  { dx = -1; this.facing = 2; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { dx =  1; this.facing = 3; }
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    { dy = -1; this.facing = 1; }
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  { dy =  1; this.facing = 0; }
    const moving = dx !== 0 || dy !== 0;
    const running = moving && !!this.registry.get('hasRunningShoes') && this.shiftKey.isDown;
    const speed = this.cycling ? BIKE_SPEED : (running ? this.RUN : this.SPEED);
    if (moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = this.px + (dx / len) * speed * dt, ny = this.py + (dy / len) * speed * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkSentries();
    this.checkGate();
    this.checkExit();
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x - hw, y - 4], [x + hw, y - 4], [x - hw, y + 8], [x + hw, y + 8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      return SOLID.has(this.map[row][col]);
    });
  }

  private checkSentries() {
    for (const s of this.SENTRIES) {
      if (this.registry.get(`trainerDefeated_${s.key}`)) continue;
      if (Math.hypot(this.px - (s.col * TILE + 16), this.py - (s.row * TILE + 16)) < TILE * 1.5) {
        this.cutsceneActive = true;
        this.registry.set('trainerName', s.name);
        this.registry.set('trainerKey', s.key);
        this.registry.set('trainerPokemon', s.pokemon);
        this.registry.set('trainerExpPool', s.expPool);
        this.registry.set('trainerReturnScene', 'SamjiyonAjitRoadScene');
        this.registry.set('ajitRoadReturnX', this.px); this.registry.set('ajitRoadReturnY', this.py);
        this.dialog.show([s.line, `${s.name}: 배틀이다!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkGate() {
    if (this.cutsceneActive) return;
    const gateX = GATE_COL * TILE + TILE / 2;
    const near = Math.hypot(this.px - gateX, this.py - (GATE_ROW * TILE + TILE / 2)) < TILE * 1.8;
    const touchingGate = (this.py <= (GATE_ROW + 0.8) * TILE) && (this.px >= ROAD_LEFT * TILE && this.px < ROAD_RIGHT * TILE);
    if (!near && !touchingGate) return;
    if (!touchingGate && !Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;

    // The grunts bar the gate until they're beaten and their key is taken.
    if (!this.registry.get('hasNosdanKey')) {
      this.cutsceneActive = true;
      this.dialog.show([
        '노스단 grunts bar the gate. "Beat us first if you think you\'re getting in!"',
      ], () => { this.cutsceneActive = false; });
      return;
    }

    this.cutsceneActive = true;
    this.dialog.show(['🔑 You unlock the 노스단 아지트 gate with the key.'], () => {
      this.registry.set('hideoutFloor', 1);
      this.registry.remove('nosdanReturnX'); this.registry.remove('nosdanReturnY');
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('NosdanHideoutScene'));
    });
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    if (this.py > (ROWS - 1) * TILE && this.px > (ROAD_LEFT - 1) * TILE && this.px < (ROAD_RIGHT + 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('SamjiyonCitySceneReturnX', 38 * 32 + 16); this.registry.set('SamjiyonCitySceneReturnY', 25 * 32 + 16);
        this.scene.start('SamjiyonCityScene');
      });
    }
  }
}
