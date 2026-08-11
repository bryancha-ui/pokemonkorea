import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { drawTrainerBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { playBgm } from '../systems/Music';

// ── Han River Convenience Store interior ────────────────────────────────────────
const TILE = 32, COLS = 18, ROWS = 13;
const T = { FLOOR: 0, TILE2: 1, COUNTER: 2, SHELF: 3, FRIDGE: 4, WALL: 5 } as const;
type Tile = typeof T[keyof typeof T];
const COLORS: Record<Tile, number> = {
  [T.FLOOR]: 0xe6e2d6, [T.TILE2]: 0xd8d2c2, [T.COUNTER]: 0x8a5a2a, [T.SHELF]: 0xb0956a, [T.FRIDGE]: 0x2a6a8a, [T.WALL]: 0x3a4450,
};
const SOLID = new Set<Tile>([T.COUNTER, T.SHELF, T.FRIDGE, T.WALL]);
const SNACK_STOCK = ['potion', 'superpotion', 'antidote', 'paralyzeheal', 'freshwater', 'sodapop', 'lemonade', 'revive'];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.FLOOR) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };
  for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) if ((r + c) % 2 === 0) m[r][c] = T.TILE2;
  fill(0, ROWS, 0, 1, T.WALL); fill(0, ROWS, COLS - 1, COLS, T.WALL); fill(0, 1, 0, COLS, T.WALL);
  fill(ROWS - 1, ROWS, 0, 8, T.WALL); fill(ROWS - 1, ROWS, 10, COLS, T.WALL);   // bottom wall w/ exit (cols 8-9)
  fill(2, 4, 10, 16, T.COUNTER);        // checkout counter (right)
  // Aisle shelves. The upper row must NOT run in front of the checkout (cols
  // 10-15): a shelf there walled the clerk off so the player could never get
  // within interaction range and the shop never opened. Leave that span open.
  fill(4, 5, 3, 10, T.SHELF);           // upper aisle (stops before the counter)
  fill(7, 8, 3, 15, T.SHELF);           // lower aisle
  fill(2, 6, 1, 3, T.FRIDGE);           // drinks fridges along the left wall
  return m;
}

export class ConvenienceStoreScene extends Phaser.Scene {
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private prompt!: Phaser.GameObjects.Text;
  private px = 9 * TILE + 16; private py = 10 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private readonly SPEED = 110;
  private readonly CLERK = { col: 13, row: 3 };

  constructor() { super('ConvenienceStoreScene'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0;
    this.map = buildMap();
    this.drawMap();
    this.createPlayer();
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.setZoom(1.8);
    this.cameras.main.startFollow(this.playerG, true, 0.15, 0.15);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.prompt = this.add.text(this.scale.width / 2, this.scale.height - 30, '', {
      fontSize: '12px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(60).setVisible(false);
    this.cameras.main.fadeIn(300);
    playBgm(this, 'mart');
    SaveManager.save(this.registry, this.px, this.py, 'ConvenienceStoreScene');

    // Returning from the (paused) shop must release the cutscene lock — else frozen.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.cutsceneActive = false;
      this.prompt.setVisible(false);
      this.input.keyboard?.resetKeys();
    });
  }

  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.WALL) { g.fillStyle(0x2a333c); g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4); }
      if (t === T.COUNTER) { g.fillStyle(0x6a4420); g.fillRect(x, y, TILE, TILE - 6); g.fillStyle(0xcaa070); g.fillRect(x, y, TILE, 4); }
      if (t === T.SHELF) { g.fillStyle(0x8a6f48); g.fillRect(x + 1, y + 4, TILE - 2, TILE - 6);
        const cs = [0xd83a3a, 0x3a8ad8, 0x3aa85a, 0xf0c040]; for (let i = 0; i < 4; i++) { g.fillStyle(cs[(i + r + c) % 4]); g.fillRect(x + 3 + i * 7, y + 6, 5, 8); } }
      if (t === T.FRIDGE) { g.fillStyle(0x1f5f80); g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4); g.fillStyle(0x8fd0f0, 0.7); g.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        g.fillStyle(0xffffff, 0.5); g.fillRect(x + 6, y + 6, 3, TILE - 12); }
    }
    const key = '__convStoreMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
    const cg = this.add.graphics().setDepth(8); drawNpcBody(cg, 0xd85a3a, { hair: 0x2a2622 });
    cg.setPosition(this.CLERK.col * TILE + 16, this.CLERK.row * TILE + 16 + 20);
    this.add.text(this.CLERK.col * TILE + 16, this.CLERK.row * TILE + 4, tr('Store Clerk'), {
      fontSize: '8px', color: '#ffd0a0', backgroundColor: '#00000099', padding: { x: 2, y: 1 },
    }).setOrigin(0.5).setDepth(9);
    this.add.text(COLS * TILE / 2, 0.6 * TILE, tr('🏪 Han River Convenience Store'), {
      fontSize: '12px', color: '#ffe', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(9 * TILE, (ROWS - 0.6) * TILE, tr('⬇ Exit'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(5);
  }

  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() { drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry)); this.playerG.setPosition(this.px, this.py); }

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
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      const nx = this.px + (dx / len) * this.SPEED * dt, ny = this.py + (dy / len) * this.SPEED * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta; if (this.walkTimer > 180) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkClerk();
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

  private checkClerk() {
    const near = Math.hypot(this.px - (this.CLERK.col * TILE + 16), this.py - (this.CLERK.row * TILE + 16)) < TILE * 1.6;
    this.prompt.setVisible(near);
    if (near) this.prompt.setText(tr('SPACE — Shop'));
    if (!near || !Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    this.cutsceneActive = true; this.prompt.setVisible(false);
    this.dialog.show(['Store Clerk: Welcome! Drinks, rice balls, remedies — the riverside classics.'], () => {
      this.scene.launch('ShopScene', { parentKey: this.scene.key, stock: SNACK_STOCK, title: '🏪 CONVENIENCE STORE' });
      this.scene.pause();
    });
  }

  private checkExit() {
    if (this.cutsceneActive) return;
    if (this.py > (ROWS - 1.2) * TILE && this.px > 7.5 * TILE && this.px < 10.5 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(300, 0, 0, 0, () => {
        this.registry.set('hanRiverReturnX', 35 * TILE + 16);
        this.registry.set('hanRiverReturnY', 17 * TILE + 16);
        this.scene.start('HanRiverParkScene');
      });
    }
  }
}
