import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { drawTrainerBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { playBgm } from '../systems/Music';
import { hasBike, giveBike } from '../data/Bike';

// ── Han River Bicycle Shop interior ─────────────────────────────────────────────
const TILE = 32, COLS = 18, ROWS = 13;
const T = { FLOOR: 0, RUG: 1, COUNTER: 2, RACK: 3, WALL: 4, STAND: 5 } as const;
type Tile = typeof T[keyof typeof T];
const COLORS: Record<Tile, number> = {
  [T.FLOOR]: 0xdfceb0, [T.RUG]: 0x2a8a5a, [T.COUNTER]: 0x8a5a2a, [T.RACK]: 0x5a5a66, [T.WALL]: 0x3a4a3a, [T.STAND]: 0x6a6a72,
};
const SOLID = new Set<Tile>([T.COUNTER, T.RACK, T.WALL, T.STAND]);

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.FLOOR) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };
  fill(0, ROWS, 0, 1, T.WALL); fill(0, ROWS, COLS - 1, COLS, T.WALL); fill(0, 1, 0, COLS, T.WALL);
  fill(ROWS - 1, ROWS, 0, 8, T.WALL); fill(ROWS - 1, ROWS, 10, COLS, T.WALL);   // bottom wall w/ exit gap (cols 8-9)
  fill(2, 4, 6, 12, T.COUNTER);            // sales counter
  fill(4, 9, 1, 3, T.RACK);                // display racks (bikes) along the walls
  fill(4, 9, COLS - 3, COLS - 1, T.RACK);
  fill(6, 8, 8, 12, T.STAND);              // repair stand
  fill(9, 11, 5, 13, T.RUG);               // showroom rug
  return m;
}

export class BikeShopScene extends Phaser.Scene {
  // A shop interior: indoor treatment suppresses outdoor props, so its green
  // rug/floor never sprouts tall-grass tufts inside.
  public interior3D = true;

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
  private readonly CLERK = { col: 8, row: 3 };

  constructor() { super('BikeShopScene'); }

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
    playBgm(this, 'deptstore');
    SaveManager.save(this.registry, this.px, this.py, 'BikeShopScene');
  }

  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.FLOOR) { g.fillStyle(0xcbb894, 0.5); g.fillRect(x, y + TILE - 2, TILE, 2); }
      if (t === T.RUG) { g.fillStyle(0x1e6a44, 0.6); g.fillRect(x + 3, y + 3, TILE - 6, TILE - 6); }
      if (t === T.WALL) { g.fillStyle(0x2a3a2a); g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4); }
      if (t === T.COUNTER) { g.fillStyle(0x6a4420); g.fillRect(x, y, TILE, TILE - 6); g.fillStyle(0xcaa070); g.fillRect(x, y, TILE, 4); }
      if (t === T.STAND) { g.fillStyle(0x4a4a55); g.fillRect(x + 6, y + 4, 4, TILE - 8); g.fillStyle(0x8a8a95); g.fillRect(x + 3, y + 6, TILE - 6, 4); }
      if (t === T.RACK) { // a bike on the rack
        g.fillStyle(0x222222); g.fillCircle(x + 10, y + 22, 6); g.fillCircle(x + 24, y + 22, 6);
        g.lineStyle(2, 0xcfd6dd); g.strokeCircle(x + 10, y + 22, 6); g.strokeCircle(x + 24, y + 22, 6);
        g.fillStyle([0xd83a3a, 0x3a7ad8, 0x3aa85a][(r + c) % 3]); g.fillRect(x + 8, y + 14, 18, 4); g.fillRect(x + 22, y + 6, 3, 10);
      }
    }
    const key = '__bikeShopMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
    // clerk
    const cg = this.add.graphics().setDepth(8); drawNpcBody(cg, 0x2a8a5a, { hair: 0x2a2622 });
    cg.setPosition(this.CLERK.col * TILE + 16, this.CLERK.row * TILE + 16 + 20);
    this.add.text(this.CLERK.col * TILE + 16, this.CLERK.row * TILE + 4, speakerName('Shop Clerk'), {
      fontSize: '8px', color: '#aef0c0', backgroundColor: '#00000099', padding: { x: 2, y: 1 },
    }).setOrigin(0.5).setDepth(9);
    this.add.text(COLS * TILE / 2, 0.6 * TILE, tr('🚲 Han River Bicycle Shop'), {
      fontSize: '12px', color: '#dff', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
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
    if (near) this.prompt.setText(tr('SPACE — talk to Shop Clerk'));
    if (!near || !Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    this.cutsceneActive = true; this.prompt.setVisible(false);
    if (!hasBike(this.registry)) {
      giveBike(this.registry);
      this.dialog.show([
        'Shop Clerk: Off on your first big journey? Come on in — take a Bicycle, on the house.',
        '🚲 You received the Bicycle!',
        'Shop Clerk: Press C out on the road to hop on. The riverside path runs all the way to the bridge — enjoy the ride!',
      ], () => { this.cutsceneActive = false; });
    } else {
      this.dialog.show([
        'Shop Clerk: Everything running smoothly? Good. Press C anywhere to ride.',
        'Shop Clerk: These carbon frames on the rack? Someday, maybe. For now, the rental treats you fine.',
      ], () => { this.cutsceneActive = false; });
    }
  }

  private checkExit() {
    if (this.cutsceneActive) return;
    if (this.py > (ROWS - 1.2) * TILE && this.px > 7.5 * TILE && this.px < 10.5 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(300, 0, 0, 0, () => {
        this.registry.set('hanRiverReturnX', 7 * TILE + 16);
        this.registry.set('hanRiverReturnY', 17 * TILE + 16);
        this.scene.start('HanRiverParkScene');
      });
    }
  }
}
