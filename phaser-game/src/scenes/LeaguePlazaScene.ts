import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { PartySystem } from '../systems/PartySystem';
import { DexTracker } from '../systems/DexTracker';

// ── Tiles ─────────────────────────────────────────────────────────────────────
// The grand courtyard before the Pokémon League — a great ancient-Korean palace.
const T = { PLAZA: 0, PATH: 1, WALL: 2, TREE: 3, LANTERN: 4, GRASS: 5, WATER: 6 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 28, ROWS = 30;
const COLORS: Record<Tile, number> = {
  [T.PLAZA]: 0xcabfa6, [T.PATH]: 0xb8a888, [T.WALL]: 0x5a3326, [T.TREE]: 0x216b2a,
  [T.LANTERN]: 0x8a7048, [T.GRASS]: 0x4f8a3f, [T.WATER]: 0x2f73b6,
};
const SOLID = new Set<Tile>([T.WALL, T.TREE, T.LANTERN]);

const DOOR = { col: 13, row: 11 };   // palace entrance (gap in the base)
const PC    = { col: 9,  row: 24 };  // Pokémon Center nurse (left of the entrance)
const PCBOX = { col: 6,  row: 24 };  // storage PC terminal, beside the Center
const MART  = { col: 18, row: 24 };  // Mart clerk (right of the entrance)

// Atmosphere NPCs in the courtyard (talk-only).
interface Talker { col: number; row: number; coat: number; cap: number; label: string; lines: string[]; id?: string; }
const TALKERS: Talker[] = [
  {
    col: 11, row: 14, coat: 0x3a4a8a, cap: 0xffd24a, label: 'Receptionist', id: 'reception',
    lines: [],   // generated dynamically — see receptionLines()
  },
  {
    col: 21, row: 22, coat: 0x6a6a72, cap: 0x222222, label: 'Veteran', id: 'veteran',
    lines: [
      "Veteran: I've stood in this courtyard four times. Reached the Champion twice. Never beat him.",
      "Veteran: Hwangeum kneels to his Pokémon before he stands. Win or lose. That's the trainer you have to surpass.",
    ],
  },
  {
    col: 5, row: 22, coat: 0xcc4466, cap: 0xffffff, label: 'Reporter', id: 'reporter',
    lines: [
      'Reporter: Onnuri News, live from the League steps! You — you came down from Baekdu Peak, didn\'t you?',
      'Reporter: The whole region is watching. If you take the title today, you\'ll be the trainer who healed the land AND became Champion. Some story!',
    ],
  },
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.PLAZA) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  // Border trees framing the courtyard
  fill(0, ROWS, 0, 2, T.TREE); fill(0, ROWS, COLS - 2, COLS, T.TREE);
  fill(ROWS - 2, ROWS, 0, COLS, T.TREE);
  // Palace base (solid) — a broad hall across the top
  fill(4, 11, 3, COLS - 3, T.WALL);
  // Entrance gap at the centre
  fill(10, 11, DOOR.col, DOOR.col + 2, T.PLAZA);
  // Ceremonial path up the middle of the courtyard
  fill(11, ROWS, 12, 16, T.PATH);
  // Lawn panels either side of the path
  fill(13, 27, 3, 11, T.GRASS); fill(13, 27, 17, COLS - 3, T.GRASS);
  // Stone lanterns lining the path
  for (const [r, c] of [[14,11],[14,16],[19,11],[19,16],[24,11],[24,16]] as [number,number][]) m[r][c] = T.LANTERN;
  // Lotus ponds in the lawns
  fill(16, 19, 6, 9, T.WATER); fill(16, 19, COLS - 9, COLS - 6, T.WATER);
  // South entry from Scholars' Road
  fill(ROWS - 2, ROWS, 12, 16, T.PATH);
  return m;
}

export class LeaguePlazaScene extends Phaser.Scene {
  private map!: Tile[][];
  /** The palace hall is the generated League building, centred on the entrance
   *  gap (DOOR.col 13) so its doorway lines up with where the player walks in.
   *  onlyNamedBuildings keeps everything else off. */
  public buildingPlots = [{ x: 3, y: 4, w: 21, h: 7, model: 'hanok-palace' }];
  public onlyNamedBuildings = true;
  /** Stone lanterns lining the ceremonial path, mirrored into 3D. Coordinates match
   *  the T.LANTERN tiles placed in buildMap() ([row, col]); the builder centres each
   *  prop on its tile. */
  public propPlots = ([[14, 11], [14, 16], [19, 11], [19, 16], [24, 11], [24, 16]] as [number, number][])
    .map(([r, c]) => ({ x: c, y: r, kind: 'lantern' as const, scale: 0.95 }));
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = 14 * TILE; private py = 26 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false; private spawnGuard = false;
  private readonly SPEED = 120; private readonly RUN = 250;

  constructor() { super('LeaguePlazaScene'); }

  create() {

    playBgm(this, 'leagueinterior');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.spawnGuard = true; this.time.delayedCall(600, () => { this.spawnGuard = false; });
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('leaguePlazaReturnX') as number | undefined;
    const ry = this.registry.get('leaguePlazaReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('leaguePlazaReturnX'); this.registry.remove('leaguePlazaReturnY');

    this.map = buildMap();
    this.drawMap();
    this.drawPalace();
    this.drawServices();
    this.createPlayer();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [T.WATER], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'LeaguePlazaScene');

    if (!this.registry.get('leaguePlazaSeen')) {
      this.registry.set('leaguePlazaSeen', true);
      this.time.delayedCall(600, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'Beyond the summit gate, the road opens onto a vast stone courtyard.',
          'The Onnuri Pokémon League rises before you — a great palace hall in the old style, its tiered roofs sweeping skyward, eaves bright with dancheong, vermilion pillars catching the light.',
          'Cross the courtyard and climb the steps. The Elite Four and the Champion wait within.',
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
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.PLAZA) { g.lineStyle(1, 0xb0a589, 0.5); g.strokeRect(c*TILE+2, r*TILE+2, TILE-4, TILE-4); }
      if (t === T.PATH)  { g.fillStyle(0xa89878, 0.7); g.fillRect(c*TILE+5, r*TILE, 3, TILE); g.fillRect(c*TILE+24, r*TILE, 3, TILE); }
      if (t === T.GRASS) { g.fillStyle(0x3f7a30, 0.7); g.fillCircle(c*TILE+9, r*TILE+10, 3); g.fillCircle(c*TILE+22, r*TILE+20, 3); }
      if (t === T.WATER) { g.fillStyle(0x7fc0ec, 0.5); g.fillEllipse(c*TILE+16, r*TILE+16, 22, 12); g.fillStyle(0xff7799,0.7); g.fillCircle(c*TILE+12,r*TILE+14,3); }
      if (t === T.TREE)  { g.fillStyle(0x14501c); g.fillCircle(c*TILE+16, r*TILE+12, 13); g.fillStyle(0x5a3a1a); g.fillRect(c*TILE+13, r*TILE+18, 6, 12); }
      if (t === T.LANTERN) { g.fillStyle(0x6e5a38); g.fillRect(c*TILE+12, r*TILE+6, 8, 22); g.fillStyle(0xffe0a0); g.fillRect(c*TILE+10, r*TILE+2, 12, 8); }
    }
    const key = '__leaguePlazaMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(14 * TILE, 28.4 * TILE, tr('↓ Scholars\' Road'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#00000088', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  // ── The grand palace (ancient-Korean style, drawn as an overlay) ───────────
  private drawPalace() {
    const g = this.add.graphics().setDepth(4);
    const cx = 14 * TILE;            // courtyard centre
    const baseY = 11 * TILE;         // ground level of the hall
    const bodyW = 21 * TILE;

    // Stone platform (woldae) with balustrade + central staircase.
    g.fillStyle(0xd0c7b3); g.fillRect(cx - bodyW/2 - 24, baseY - 4, bodyW + 48, 22);
    g.fillStyle(0xbcb29c); g.fillRect(cx - bodyW/2 - 44, baseY + 14, bodyW + 88, 18);
    g.lineStyle(2, 0x9a9080); g.strokeRect(cx - bodyW/2 - 44, baseY + 14, bodyW + 88, 18);
    g.fillStyle(0xc6bca6); g.fillRect(cx - 48, baseY + 4, 96, 28);
    g.lineStyle(1, 0x9a9080, 0.8); for (let i = 0; i < 4; i++) g.lineBetween(cx - 48, baseY + 9 + i*6, cx + 48, baseY + 9 + i*6);

    // Hall body — vermilion pillars over a dark wall.
    const bodyTop = 6 * TILE;
    g.fillStyle(0x6e1f1a); g.fillRect(cx - bodyW/2, bodyTop, bodyW, baseY - bodyTop);
    g.fillStyle(0xb23a2c);
    const nCol = 8;
    for (let i = 0; i <= nCol; i++) { const x = cx - bodyW/2 + bodyW*(i/nCol); g.fillRect(x - 7, bodyTop, 14, baseY - bodyTop); }
    this.dancheongBand(g, cx - bodyW/2 - 8, bodyTop - 8, bodyW + 16, 12);

    // Central double doors with golden studs.
    g.fillStyle(0x241208); g.fillRect(cx - 28, baseY - 60, 56, 60);
    g.fillStyle(0x49301a); g.fillRect(cx - 25, baseY - 56, 23, 56); g.fillRect(cx + 2, baseY - 56, 23, 56);
    g.fillStyle(0xe0b24a); for (let yy = baseY - 50; yy < baseY; yy += 12) { g.fillCircle(cx - 6, yy, 2); g.fillCircle(cx + 6, yy, 2); }

    // Two sweeping roof tiers with upturned eaves.
    this.drawRoof(g, cx, bodyTop - 2, bodyW + 96, 72, 0x33524a);
    this.drawRoof(g, cx, bodyTop - 60, bodyW - 40, 60, 0x3a5e53);

    // Signboard (현판).
    g.fillStyle(0x1b110a); g.fillRect(cx - 78, bodyTop - 46, 156, 30);
    g.lineStyle(3, 0xddb24a); g.strokeRect(cx - 78, bodyTop - 46, 156, 30);
    this.add.text(cx, bodyTop - 31, '온누리 포켓몬 리그', {
      fontSize: '13px', color: '#f4d68a', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);
    this.add.text(cx, baseY - 70, tr('⬆ THE POKÉMON LEAGUE'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(6);
  }

  private drawRoof(g: Phaser.GameObjects.Graphics, cx: number, topY: number, w: number, h: number, color: number) {
    const left = cx - w/2, right = cx + w/2, eaveY = topY + h, tw = w * 0.30;
    g.fillStyle(color);
    g.fillTriangle(left, eaveY, cx - tw, topY, cx + tw, topY);
    g.fillTriangle(left, eaveY, cx + tw, topY, right, eaveY);
    // upturned eave tips
    g.fillTriangle(left, eaveY, left - 20, eaveY - 16, left + 12, eaveY - 4);
    g.fillTriangle(right, eaveY, right + 20, eaveY - 16, right - 12, eaveY - 4);
    // ridge + end ornaments (chimi)
    g.fillStyle(0x223833); g.fillRect(cx - tw, topY - 4, tw * 2, 7);
    g.fillStyle(0x1a2a26); g.fillRect(cx - tw - 4, topY - 12, 10, 12); g.fillRect(cx + tw - 6, topY - 12, 10, 12);
    // tile lines
    g.lineStyle(1, 0x1d302b, 0.45);
    for (let yy = topY + 10; yy < eaveY; yy += 9) g.lineBetween(left + (yy - topY) * 0.34, yy, right - (yy - topY) * 0.34, yy);
    // dancheong band under the eave
    this.dancheongBand(g, left + 6, eaveY - 7, w - 12, 7);
  }

  /** A Pokémon Center kiosk + a Poké Mart stall flanking the courtyard entrance. */
  private drawServices() {
    // Pokémon Center kiosk (red roof + cross) behind the nurse.
    const px = PC.col * TILE + 16, py = PC.row * TILE + 16;
    const cg = this.add.graphics().setDepth(3);
    cg.fillStyle(0xf4ead6); cg.fillRect(px - 30, py - 44, 60, 40);
    cg.fillStyle(0xcc2a3a); cg.fillTriangle(px - 36, py - 44, px, py - 66, px + 36, py - 44);
    cg.fillStyle(0xffffff); cg.fillRect(px - 4, py - 58, 8, 4); cg.fillRect(px - 2, py - 62, 4, 12);
    cg.fillStyle(0x88ccff, 0.8); cg.fillRect(px - 22, py - 36, 14, 14); cg.fillRect(px + 8, py - 36, 14, 14);
    cg.fillStyle(0x6b4a28); cg.fillRect(px - 8, py - 20, 16, 16);
    this.add.text(px, py - 70, tr('🏥 Pokémon Center'), { fontSize: '8px', color: '#fff', backgroundColor: '#00000099', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    this.drawAttendant(px, py, 0xff7799, 0xffffff);   // Nurse (pink)

    // Storage PC terminal beside the Center.
    const qx = PCBOX.col * TILE + 16, qy = PCBOX.row * TILE + 16;
    const pg = this.add.graphics().setDepth(3);
    pg.fillStyle(0x000000, 0.2); pg.fillEllipse(qx, qy + 12, 30, 7);
    pg.fillStyle(0x3a3f4a); pg.fillRect(qx - 16, qy - 6, 32, 16);     // desk/base
    pg.fillStyle(0x12161f); pg.fillRect(qx - 14, qy - 30, 28, 22);    // monitor body
    pg.fillStyle(0x2a8acc); pg.fillRect(qx - 11, qy - 27, 22, 16);    // screen
    pg.fillStyle(0x7fd0ff, 0.85); pg.fillRect(qx - 9, qy - 25, 9, 4); pg.fillRect(qx - 9, qy - 19, 14, 3);
    this.add.text(qx, qy - 40, tr('💻 PC'), { fontSize: '8px', color: '#fff', backgroundColor: '#00000099', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);

    // Poké Mart stall (blue roof) behind the clerk.
    const mx = MART.col * TILE + 16, my = MART.row * TILE + 16;
    const mg = this.add.graphics().setDepth(3);
    mg.fillStyle(0xeae0cc); mg.fillRect(mx - 30, my - 44, 60, 40);
    mg.fillStyle(0x2a6aaa); mg.fillTriangle(mx - 36, my - 44, mx, my - 64, mx + 36, my - 44);
    mg.fillStyle(0xffe44e); mg.fillRect(mx - 16, my - 40, 32, 8);
    mg.fillStyle(0x88ccff, 0.8); mg.fillRect(mx - 22, my - 28, 14, 12); mg.fillRect(mx + 8, my - 28, 14, 12);
    this.add.text(mx, my - 68, tr('🛒 Poké Mart'), { fontSize: '8px', color: '#fff', backgroundColor: '#00000099', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    this.drawAttendant(mx, my, 0x2a8a5a, 0xffe0a0);   // Mart clerk (green apron)

    // Atmosphere NPCs.
    for (const t of TALKERS) {
      const x = t.col * TILE + 16, y = t.row * TILE + 16;
      this.drawAttendant(x, y, t.coat, t.cap);
      this.add.text(x, y - 26, tr(t.label), {
        fontSize: '8px', color: '#fff', backgroundColor: '#00000099', padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(9);
    }
  }

  private drawAttendant(x: number, y: number, coat: number, cap: number) {
    const g = this.add.graphics().setDepth(8);
    g.setPosition(x, y);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(coat); g.fillRect(-7, -8, 14, 12);
    g.fillStyle(0x222222); g.fillRect(-6, 4, 5, 8); g.fillRect(1, 4, 5, 8);
    g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
    g.fillStyle(cap); g.fillRect(-7, -22, 14, 5);
    g.fillStyle(0x000000); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2);
  }

  private dancheongBand(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    const palette = [0x2f7a44, 0x2f4f9a, 0xb83636, 0xeae2cf];
    const seg = 13;
    for (let i = 0, sx = x; sx < x + w - 1; i++, sx += seg) { g.fillStyle(palette[i % palette.length]); g.fillRect(sx, y, seg - 1, h); }
  }

  // ── Player / camera / input ──────────────────────────────────────────────
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
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 400, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🏯 The Pokémon League'), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 34, '', {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  SPACE: enter  M: menu'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  // ── Update ───────────────────────────────────────────────────────────────
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
    this.checkInteractions();
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

  /** Palace doors, the Pokémon Center nurse, and the Mart clerk. */
  private checkInteractions() {
    const targets = [
      { x: (DOOR.col + 1) * TILE, y: DOOR.row * TILE + 8, prompt: 'SPACE — Enter the Pokémon League', act: () => this.enterLeague() },
      { x: PC.col * TILE + 16,    y: PC.row * TILE + 16,  prompt: 'SPACE — Heal your team (Pokémon Center)', act: () => this.healTeam() },
      { x: PCBOX.col * TILE + 16, y: PCBOX.row * TILE + 16, prompt: 'SPACE — Access the Storage PC', act: () => this.openPC() },
      { x: MART.col * TILE + 16,  y: MART.row * TILE + 16, prompt: 'SPACE — Shop (Poké Mart)', act: () => this.openMart() },
      ...TALKERS.map(t => ({
        x: t.col * TILE + 16, y: t.row * TILE + 16,
        prompt: `${tr('SPACE — Talk to')} ${tr(t.label)}`,
        act: () => {
          this.cutsceneActive = true;
          this.dialog.show(this.linesFor(t), () => { this.cutsceneActive = false; });
        },
      })),
    ];
    let near: typeof targets[number] | null = null;
    for (const t of targets) { if (Math.hypot(this.px - t.x, this.py - t.y) < TILE * 1.5) { near = t; break; } }
    if (!near) { this.enterPrompt.setVisible(false); return; }
    this.enterPrompt.setText(tr(near.prompt)).setVisible(true);
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) { this.enterPrompt.setVisible(false); near.act(); }
  }

  private enterLeague() {
    // Post-game rematches only open once 환웅 (Hwanung) has been caught. Until then
    // the reigning Champion's title stands and the halls stay closed to a re-climb.
    const clearedBefore = !!(this.registry.get('hallOfFame') || this.registry.get('championDefeated'));
    if (clearedBefore && !DexTracker.isCaught(this.registry, 'hwanwoong')) {
      this.cutsceneActive = true;
      this.dialog.show([
        'Receptionist: Champion! Your title still stands — there is no one below to challenge you yet.',
        'Receptionist: They say a Sovereign sleeps in the far north. Should you ever bring 환웅 itself back down the mountain, the Elite Four have sworn to rise and challenge you anew.',
      ], () => { this.cutsceneActive = false; });
      return;
    }
    this.cutsceneActive = true;
    // Entering the tower starts a fresh gauntlet: reset all four Elite Four floors
    // and the Champion, so they must be cleared in one unbroken ascent — and can be
    // re-challenged freely after winning. (championDefeated / hallOfFame stay set:
    // this is a rematch, not an un-winning of the title.)
    for (const k of ['e4-gyeoul', 'e4-hwageum', 'e4-baram', 'e4-saleum', 'champion-hwangeum']) {
      this.registry.remove(`trainerDefeated_${k}`);
    }
    this.registry.set('hanbandoLeagueFloor', 1);
    this.registry.remove('leagueReturnX');
    this.registry.remove('leagueReturnY');
    this.cameras.main.fadeOut(500, 0, 0, 0, () => {
      this.scene.start('PokemonLeagueScene');
    });
  }

  /** Pick a talker's lines — the receptionist, veteran and reporter all react to progress. */
  private linesFor(t: Talker): string[] {
    if (t.id === 'reception') return this.receptionLines();
    const champ = !!(this.registry.get('championDefeated') || this.registry.get('hallOfFame'));
    if (champ && t.id === 'veteran') return [
      'Veteran: You did it. You actually beat him. Four times I stood in this courtyard and never could.',
      "Veteran: The trainer who finally surpassed Hwangeum... I'm glad I lived to see it. Congratulations, Champion.",
    ];
    if (champ && t.id === 'reporter') return [
      'Reporter: Onnuri News, LIVE — we have a NEW CHAMPION, and you saw it here first!',
      'Reporter: From Baekdu Peak to the throne of the League — the trainer who healed the land now wears the crown. What a day for the region!',
    ];
    return t.lines;
  }

  /** The receptionist's greeting adapts to your progress through the League. */
  private receptionLines(): string[] {
    if (this.registry.get('championDefeated') || this.registry.get('hallOfFame')) {
      return [
        'Receptionist: Champion! It is an honour to have you back. Your team is enshrined in the Hall of Fame.',
        'Receptionist: The whole region heard the news. Whenever you wish to defend your title, the halls are open to you.',
      ];
    }
    const e4 = ['e4-gyeoul', 'e4-hwageum', 'e4-baram', 'e4-saleum'];
    const beaten = e4.filter(k => this.registry.get('trainerDefeated_' + k)).length;
    if (beaten >= 4) {
      return [
        'Receptionist: All four of the Elite Four — defeated. Only the Champion remains beyond the final hall.',
        'Receptionist: Heal here, steady yourself, and walk through. Hwangeum is waiting at the throne.',
      ];
    }
    if (beaten > 0) {
      return [
        `Receptionist: ${beaten} of the Elite Four down already — the whole region is talking about you.`,
        'Receptionist: Remember, each hall restores your team before the match. Press on, challenger.',
      ];
    }
    return [
      'Receptionist: Welcome, challenger, to the Onnuri Pokémon League.',
      'Receptionist: Beyond these doors wait the Elite Four — Gyeoul, Hwageum, Baram, and Saleum — and then the Champion, Hwangeum.',
      'Receptionist: Each hall restores your team to full before its match, so battle freely. Stock up at the Mart, then climb. Good luck.',
    ];
  }

  private healTeam() {
    PartySystem.healAll(this.registry);
    this.cutsceneActive = true;
    this.dialog.show([
      'Nurse: Welcome to the League Pokémon Center.',
      'Nurse: Your Pokémon are fully healed. We hope to see your name in the Hall of Fame!',
    ], () => { this.cutsceneActive = false; });
  }

  private openMart() {
    this.scene.launch('ShopScene', { parentKey: this.scene.key });
    this.scene.pause();
  }

  private openPC() {
    this.scene.launch('BoxScene', { parentKey: this.scene.key });
    this.scene.pause();
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('scholarsRoadReturnX', 12 * 32 + 16);
        this.registry.set('scholarsRoadReturnY', 3 * 32 + 16);
        this.scene.start('ScholarsRoadScene');
      });
    }
  }
}
