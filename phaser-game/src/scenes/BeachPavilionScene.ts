import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr } from '../systems/i18n';
import { drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { SaveManager } from '../utils/SaveManager';
import { playBgm } from '../systems/Music';

const TILE = 32, COLS = 20, ROWS = 16;
const T = { SAND: 0, PATH: 1, WATER: 2, BENCH: 3, WALL: 4 } as const;
type Tile = typeof T[keyof typeof T];
const COLORS: Record<Tile, number> = {
  [T.SAND]: 0x9a8a6a, [T.PATH]: 0x8a7a6a, [T.WATER]: 0x1d5e8a, [T.BENCH]: 0x8a6a4a, [T.WALL]: 0x5a5a5a,
};
const SOLID = new Set<Tile>([T.BENCH, T.WALL, T.WATER]);

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.SAND) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };

  // Ocean (top of screen)
  fill(0, 4, 0, COLS, T.WATER);

  // Pavilion benches facing ocean
  fill(6, 8, 2, 4, T.BENCH);
  fill(6, 8, 8, 10, T.BENCH);
  fill(6, 8, 16, 18, T.BENCH);

  fill(11, 13, 3, 5, T.BENCH);
  fill(11, 13, 9, 11, T.BENCH);
  fill(11, 13, 15, 17, T.BENCH);

  // Main pathway
  fill(0, ROWS, 9, 11, T.PATH);

  // Walls
  fill(0, ROWS, 0, 1, T.WALL);
  fill(0, ROWS, 19, COLS, T.WALL);
  fill(ROWS - 1, ROWS, 0, COLS, T.WALL);

  return m;
}

export class BeachPavilionScene extends Phaser.Scene {
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private px = 10 * TILE + 16;
  private py = 12 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private readonly SPEED = 120; private readonly RUN = 250;

  constructor() { super('BeachPavilionScene'); }

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
    playBgm(this, 'waterfall'); // Peaceful coastal atmosphere

    SaveManager.save(this.registry, this.px, this.py, 'BeachPavilionScene');
  }

  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);

      if (t === T.WATER) {
        g.fillStyle(0x3a7aff, 0.5); g.fillEllipse(c*TILE+16, r*TILE+16, 20, 16);
        g.fillStyle(0x5aaaff, 0.3); g.fillCircle(c*TILE+10, r*TILE+12, 2);
        g.fillStyle(0x5aaaff, 0.3); g.fillCircle(c*TILE+20, r*TILE+18, 2);
      }
      if (t === T.BENCH) {
        g.fillStyle(0x6a5a3a); g.fillRect(c*TILE+3, r*TILE+3, TILE-6, TILE-6);
        g.fillStyle(0x8a7a5a, 0.6); g.fillRect(c*TILE+4, r*TILE+6, TILE-8, 4);  // backrest
      }
      if (t === T.WALL) { g.fillStyle(0x4a4a4a); g.fillRect(c*TILE+3, r*TILE+3, TILE-6, TILE-6); }
    }

    // Add wave decorations
    g.fillStyle(0x5a8aff, 0.3);
    for (let i = 0; i < COLS; i++) {
      g.fillCircle(i * TILE + 8, 2 * TILE + 8, 2);
      g.fillCircle(i * TILE + 24, 3 * TILE + 12, 2);
    }

    const key = '__beachPavilionMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE);
    g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(COLS * TILE / 2, 0.8 * TILE, tr('🏖️ Beach Pavilion'), {
      fontSize: '13px', color: '#88ddff', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(COLS * TILE / 2, (ROWS - 0.8) * TILE, tr('⬇ Return to Jeju City'), {
      fontSize: '10px', color: '#ffff88', backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
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
    if (this.py > (ROWS - 2) * TILE) {
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
