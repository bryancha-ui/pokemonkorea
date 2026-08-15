import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr } from '../systems/i18n';
import { drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { SaveManager } from '../utils/SaveManager';
import { playBgm } from '../systems/Music';

const TILE = 32, COLS = 20, ROWS = 16;
const T = { GRASS: 0, PATH: 1, WATER: 2, FALLS: 3, ROCK: 4, WALL: 5 } as const;
type Tile = typeof T[keyof typeof T];
const COLORS: Record<Tile, number> = {
  [T.GRASS]: 0x3a6a4a, [T.PATH]: 0x8a7a6a, [T.WATER]: 0x1f7fae, [T.FALLS]: 0x7fd0ee, [T.ROCK]: 0x33302c, [T.WALL]: 0x24302c,
};
const SOLID = new Set<Tile>([T.WATER, T.FALLS, T.ROCK, T.WALL]);

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GRASS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };

  // The cascading waterfall (top) pouring into an emerald pool
  fill(1, 5, 7, 13, T.FALLS);
  fill(5, 9, 5, 15, T.WATER);   // wide plunge pool

  // Rocky cliff walls framing the falls
  fill(0, 5, 0, 7, T.ROCK);
  fill(0, 5, 13, COLS, T.ROCK);
  m[5][4] = T.ROCK; m[5][15] = T.ROCK;
  m[8][3] = T.ROCK; m[8][16] = T.ROCK;

  // Viewing path around the pool
  fill(9, 11, 2, 18, T.PATH);
  fill(0, ROWS, 9, 11, T.PATH);

  // Boundary walls (bottom-center open as the exit)
  fill(0, ROWS, 0, 1, T.WALL);
  fill(0, ROWS, 19, COLS, T.WALL);
  fill(ROWS - 1, ROWS, 0, 9, T.WALL);
  fill(ROWS - 1, ROWS, 11, COLS, T.WALL);

  return m;
}

export class CheonjiyeonWaterfallScene extends Phaser.Scene {
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private px = 10 * TILE + 16;
  private py = 13 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private readonly SPEED = 120; private readonly RUN = 250;

  constructor() { super('CheonjiyeonWaterfallScene'); }

  create() {
    this.map = buildMap();
    this.drawMap();
    this.createPlayer();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [T.WATER], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.cameras.main.fadeIn(400);
    playBgm(this, 'forest');

    SaveManager.save(this.registry, this.px, this.py, 'CheonjiyeonWaterfallScene');
  }

  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);

      if (t === T.GRASS) { g.fillStyle(0x4a8a5a, 0.5); g.fillRect(x + 5, y + 8, 4, 5); g.fillRect(x + 20, y + 16, 3, 5); }
      if (t === T.PATH) { g.fillStyle(0x9a8a76, 0.5); g.fillRect(x + 4, y + 6, TILE - 8, 4); }
      if (t === T.FALLS) {
        g.fillStyle(0xbfeaf8, 0.9); g.fillRect(x + 3, y, 6, TILE);
        g.fillStyle(0xffffff, 0.7); g.fillRect(x + 12, y, 4, TILE);
        g.fillStyle(0xa0e0f4, 0.8); g.fillRect(x + 22, y, 6, TILE);
      }
      if (t === T.WATER) {
        g.fillStyle(0x2a94c0, 0.7); g.fillEllipse(x + 16, y + 16, 24, 16);
        g.fillStyle(0xbfeef8, 0.4); g.fillRect(x + 6, y + 9, 8, 2);
        g.fillStyle(0x7fd0ee, 0.4); g.fillCircle(x + 22, y + 20, 2);
      }
      if (t === T.ROCK) {
        g.fillStyle(0x1f1c19, 1); g.fillEllipse(x + 16, y + 18, 26, 20);
        g.fillStyle(0x3a352f, 1); g.fillEllipse(x + 13, y + 15, 16, 12);
        g.fillStyle(0x000000, 0.4); g.fillCircle(x + 12, y + 16, 1.5); g.fillCircle(x + 20, y + 14, 1.4);
      }
      if (t === T.WALL) {
        g.fillStyle(0x1a241f, 1); g.fillRect(x, y, TILE, TILE);
        g.fillStyle(0x2f4238, 1); g.fillEllipse(x + 16, y + 16, 26, 22);
      }
    }

    const key = '__cheonjiyeonWaterfallMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE);
    g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(COLS * TILE / 2, 0.8 * TILE, tr('💧 Cheonjiyeon Waterfall'), {
      fontSize: '13px', color: '#bfeef8', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(COLS * TILE / 2, (ROWS - 0.8) * TILE, tr('⬇ Return to Jeju City'), {
      fontSize: '10px', color: '#aaffff', backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);

    // Drifting mist particles over the pool
    for (let i = 0; i < 10; i++) {
      const mx = Phaser.Math.Between(5 * TILE, 15 * TILE);
      const my = Phaser.Math.Between(5 * TILE, 9 * TILE);
      const mist = this.add.circle(mx, my, Phaser.Math.Between(6, 12), 0xffffff, 0.12).setDepth(15);
      this.tweens.add({ targets: mist, y: my - 20, alpha: 0, duration: Phaser.Math.Between(2000, 4000), repeat: -1, delay: i * 250 });
    }
  }

  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }
  private setupCamera() {
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
  }
  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  }

  update(_: number, delta: number) {
    if (this.cutsceneActive) return;
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
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      return SOLID.has(this.map[row][col]);
    });
  }

  private checkExit() {
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        const returnScene = this.registry.get('interiorReturnScene') as string;
        const returnX = this.registry.get('interiorReturnX') as number;
        const returnY = this.registry.get('interiorReturnY') as number;
        this.registry.set('jejuCityReturnX', returnX);
        this.registry.set('jejuCityReturnY', returnY);
        this.scene.start(returnScene);
      });
    }
  }
}
