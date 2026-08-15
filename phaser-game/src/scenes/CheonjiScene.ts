import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';

// ── 천지 (Cheonji) — the hidden crater lake ─────────────────────────────────────────
// A secret reached only through the Ancient Statue in the Onseong 제단의 방. A vast
// frozen caldera lake ringed in snow, peaceful under a gentle sky. A place of deep
// contemplation where the sacred waters gather in eternal stillness. It returns to RangrimAltarScene.

const T = { SNOW: 0, ROCK: 1, LAKE: 2, ICE: 3 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 20, ROWS = 22;
const COLORS: Record<Tile, number> = {
  [T.SNOW]: 0xe6ecf4, [T.ROCK]: 0x54505c, [T.LAKE]: 0x2f6aa8, [T.ICE]: 0x9fd0ec,
};
const SOLID = new Set<Tile>([T.ROCK, T.LAKE]);

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.SNOW) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  // Rock rim around the whole caldera.
  fill(0, ROWS, 0, 2, T.ROCK); fill(0, ROWS, COLS - 2, COLS, T.ROCK);
  fill(0, 2, 0, COLS, T.ROCK); fill(ROWS - 1, ROWS, 0, COLS, T.ROCK);
  // The great crater lake, filling the middle; a fringe of ice you can stand on.
  fill(3, 15, 4, 16, T.LAKE);
  fill(2, 3, 3, 17, T.ICE); fill(15, 16, 3, 17, T.ICE);
  fill(3, 16, 3, 4, T.ICE); fill(3, 16, 16, 17, T.ICE);
  // Snow shore / entrance at the bottom.
  fill(16, ROWS - 1, 2, COLS - 2, T.SNOW);
  return m;
}

export class CheonjiScene extends Phaser.Scene {
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 10 * TILE + 16;
  private py = 19 * TILE + 16;   // enter from the south shore
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private spawnGuard = false; private spawnPx = 0; private spawnPy = 0;
  private readonly SPEED = 120; private readonly RUN = 250;

  constructor() { super('CheonjiScene'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    playBgm(this, 'sacredpeak');
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('cheonjiReturnX') as number | undefined;
    const ry = this.registry.get('cheonjiReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    else { this.px = 10 * TILE + 16; this.py = 19 * TILE + 16; }
    this.registry.remove('cheonjiReturnX'); this.registry.remove('cheonjiReturnY');

    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
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
    SaveManager.save(this.registry, this.px, this.py, 'CheonjiScene');

    if (!this.registry.get('cheonjiSeen')) {
      this.registry.set('cheonjiSeen', true);
      this.time.delayedCall(600, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'The statue\'s base grinds aside — and a hidden stair opens onto blinding white. You climb out onto the rim of 천지 (Cheonji), the sacred crater lake, frozen mirror-still under a gentle sky.',
          'A profound peace settles over you as you gaze across the ancient waters. This is a place of deep contemplation, where the sacred waters gather in eternal stillness.',
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
      if (t === T.ROCK) { g.fillStyle(0x413c48); g.fillRect(x + 4, y + 5, 9, 8); g.fillRect(x + 17, y + 17, 10, 9); }
      if (t === T.LAKE) { g.fillStyle(0x255d94, 0.9); g.fillRect(x, y, TILE, TILE); g.fillStyle(0x4f8fc8, 0.5); g.fillRect(x + 5, y + 8, 12, 3); g.fillRect(x + 14, y + 20, 10, 3); }
      if (t === T.ICE) { g.fillStyle(0xbfe4f6, 0.8); g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4); g.fillStyle(0xffffff, 0.5); g.fillRect(x + 5, y + 6, 8, 2); }
    }
    const key = '__cheonjiMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(10 * TILE, 0.6 * TILE, tr('천지 (Cheonji) — the crater lake'), { fontSize: '10px', color: '#eaf6ff', backgroundColor: '#00000088', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
    this.add.text(10 * TILE, (ROWS - 0.6) * TILE, tr('↓ 제단의 방 (Altar Hall)'), { fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
  }

  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
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
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 380, 30, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('❄ 천지 (Cheonji Lake)'), { fontSize: '13px', color: '#eaf6ff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  SPACE: exit  M: menu'), {
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
    const speed = running ? this.RUN : this.SPEED;
    if (moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = this.px + (dx / len) * speed * dt, ny = this.py + (dy / len) * speed * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.drawChar();
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

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // South off the shore → back down the hidden stair to the Altar Hall.
    if (this.py > (ROWS - 1) * TILE && this.px > 3 * TILE && this.px < 17 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('rgAltarReturnX', 11 * TILE + 16);
        this.registry.set('rgAltarReturnY', 17 * TILE + 16);
        this.scene.start('RangrimAltarScene');
      });
    }
  }
}
