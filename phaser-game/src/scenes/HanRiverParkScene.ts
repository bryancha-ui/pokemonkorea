import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';

// ── Han River Park (한강공원) — a grand riverside district east of the Capitol ─────
// A wide waterfront: the Han River along the north, a bicycle road with cyclists,
// picnickers on the lawns, cherry trees, a riverside pavilion, a great bridge, a
// bicycle shop and a convenience store. Enter from the Capitol's east avenue.

const T = {
  GRASS: 0, PATH: 1, BIKE: 2, WATER: 3, SAND: 4, BUILDING: 5, TREE: 6,
  BRIDGE: 7, FLOWER: 8, PLAZA: 9, BENCH: 10,
} as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 46, ROWS = 26;
const COLORS: Record<Tile, number> = {
  [T.GRASS]: 0x74b85e, [T.PATH]: 0xcabb9a, [T.BIKE]: 0x9a4636, [T.WATER]: 0x2f78b4,
  [T.SAND]: 0xcdba86, [T.BUILDING]: 0xe6dcc6, [T.TREE]: 0x2c5a2c, [T.BRIDGE]: 0x8a8f98,
  [T.FLOWER]: 0x4f8a3e, [T.PLAZA]: 0xbfb59a, [T.BENCH]: 0x8a5a2a,
};
const SOLID = new Set<Tile>([T.WATER, T.BUILDING, T.TREE, T.BENCH]);

interface Spot { label: string; scene?: string; x: number; y: number; w: number; h: number; doorCol: number; doorRow: number; roof: number; model?: string; }
const BUILDINGS: Spot[] = [
  { label: '🚲 Bicycle Shop', x: 5,  y: 12, w: 5, h: 4, doorCol: 7,  doorRow: 16, roof: 0x2a8a5a, model: 'bikeshop' },
  { label: '🏪 Convenience Store', x: 33, y: 12, w: 5, h: 4, doorCol: 35, doorRow: 16, roof: 0xd85a3a, model: 'convenience' },
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GRASS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };
  const set = (r: number, c: number, t: Tile) => { if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t; };

  // The Han River along the north, a sandy bank, then the bike road.
  fill(0, 5, 0, COLS, T.WATER);
  fill(5, 6, 0, COLS, T.SAND);
  fill(6, 8, 0, COLS, T.BIKE);         // the riverside bicycle road (자전거길)
  // The great bridge striding across the river (Banpo-style), cols 20-23.
  fill(0, 8, 20, 24, T.BRIDGE);

  // Promenade + park paths
  fill(9, 10, 0, COLS, T.PATH);        // walking promenade under the bike road
  fill(8, ROWS, 21, 25, T.PATH);       // central mall down to the south gate
  fill(16, 17, 2, COLS - 2, T.PATH);   // cross path

  // Riverside pavilion plaza (정자) with benches, centre
  fill(11, 15, 19, 27, T.PLAZA);
  for (const [r,c] of [[11,19],[11,26],[14,19],[14,26]] as [number,number][]) set(r, c, T.BENCH);

  // Buildings (bike shop / convenience store)
  for (const b of BUILDINGS) { fill(b.y, b.y + b.h, b.x, b.x + b.w, T.BUILDING); set(b.doorRow, b.doorCol, T.PATH); }

  // Cherry-blossom rows + flower beds
  for (const c of [3, 7, 12, 16, 30, 34, 39, 43]) set(10, c, T.TREE);
  for (const [r,c] of [[19,4],[19,9],[21,6],[20,38],[22,40],[19,42]] as [number,number][]) set(r, c, T.TREE);
  for (const [r,c] of [[18,12],[18,15],[19,13],[20,33],[21,35],[18,30]] as [number,number][]) set(r, c, T.FLOWER);

  // Picnic-lawn benches
  for (const [r,c] of [[13,6],[13,38],[20,20],[20,25]] as [number,number][]) set(r, c, T.BENCH);

  return m;
}

interface Cyclist { g: Phaser.GameObjects.Graphics; dir: number; speed: number; y: number; }
interface Picnicker { col: number; row: number; food: string; }
const PICNICS: Picnicker[] = [
  { col: 12, row: 19, food: '🍱' }, { col: 15, row: 20, food: '🍉' },
  { col: 30, row: 19, food: '🍗' }, { col: 34, row: 21, food: '🧺' }, { col: 26, row: 22, food: '☕' },
];

export class HanRiverParkScene extends Phaser.Scene {
  private map!: Tile[][];
  /** The bike shop + convenience store get their own 3D GLBs; only those named
   *  landmarks rise in 3D, so no stray generic box blocks the river view. */
  public buildingPlots = BUILDINGS.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h, model: b.model! }));
  public onlyNamedBuildings = true;
  // The park's cherry-blossom trees as 3D pink-canopy trees (coords mirror the
  // T.TREE tiles).
  public propPlots = ([[3, 10], [7, 10], [12, 10], [16, 10], [30, 10], [34, 10], [39, 10], [43, 10],
    [4, 19], [9, 19], [6, 21], [38, 20], [40, 22], [42, 19]] as [number, number][])
    .map(([x, y]) => ({ x, y, kind: 'cherry' as const }));
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private cyclists: Cyclist[] = [];
  private px = 23 * TILE + 16; private py = 24 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private spawnGuard = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private readonly SPEED = 120; private readonly RUN = 250;

  constructor() { super('HanRiverParkScene'); }

  create() {
    playBgm(this, 'sudo');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.cyclists = [];
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('hanRiverReturnX') as number | undefined;
    const ry = this.registry.get('hanRiverReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('hanRiverReturnX'); this.registry.remove('hanRiverReturnY');

    this.spawnGuard = true; this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.spawnCyclists();
    this.spawnPicnickers();
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
    SaveManager.save(this.registry, this.px, this.py, 'HanRiverParkScene');

    if (!this.registry.get('hanRiverVisited')) {
      this.registry.set('hanRiverVisited', true);
      this.time.delayedCall(600, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'The Han River opens wide before you — sunlight scattering off the water, a great bridge striding across to the far bank.',
          'Cyclists whir along the riverside road; families picnic on the lawns; cherry petals drift over the promenade.',
          'A perfect place to breathe between battles. (Rent a bike at the shop, grab a snack at the store, or just take it in.)',
        ], () => { this.cutsceneActive = false; });
      });
    } else {
      this.time.delayedCall(300, () => maybeLaunchEvolution(this));
    }
  }

  // ── Map ──────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.WATER) { g.fillStyle(0x66bbe6, 0.4); g.fillRect(x+4, y+9, 12, 3); g.fillRect(x+14, y+22, 10, 3); g.fillStyle(0xbfe4f4, 0.25); g.fillRect(x+20, y+6, 8, 2); }
      if (t === T.SAND) { g.fillStyle(0xe0cf9a, 0.5); g.fillRect(x+6, y+8, 5, 3); g.fillRect(x+20, y+16, 5, 3); }
      if (t === T.BIKE) { g.fillStyle(0xb85a44, 1); g.fillRect(x, y+2, TILE, TILE-4); g.fillStyle(0xffe8b0, 0.8); g.fillRect(x+6, y+TILE/2-1, TILE-12, 2); } // red lane + dashed centre line
      if (t === T.PATH) { g.fillStyle(0xb6a686, 0.5); g.fillRect(x+3, y+6, TILE-6, 3); }
      if (t === T.PLAZA) { g.fillStyle(0xa89e82, 0.6); g.fillRect(x+2, y+2, TILE-4, TILE-4); }
      if (t === T.GRASS || t === T.FLOWER) { g.fillStyle(0x64a24e, 0.5); g.fillRect(x+5, y+8, 4, 6); g.fillRect(x+20, y+17, 4, 6);
        if (t === T.FLOWER) { const cs=[0xff6a9a,0xffffff,0xffdd55]; for(let i=0;i<3;i++){ g.fillStyle(cs[i],1); g.fillCircle(x+9+i*7, y+12+(i%2)*8, 2.4);} } }
      if (t === T.TREE) { g.fillStyle(0xffb7d0); g.fillCircle(x+16, y+14, 12); g.fillStyle(0xff9ec2); g.fillCircle(x+12, y+11, 6); g.fillCircle(x+21, y+15, 5); g.fillStyle(0x6a4a2a); g.fillRect(x+14, y+24, 4, 6); } // cherry blossom
      if (t === T.BRIDGE) { g.fillStyle(0x9aa0aa); g.fillRect(x, y, TILE, TILE); g.fillStyle(0x6a7078); g.fillRect(x, y, 3, TILE); g.fillRect(x+TILE-3, y, 3, TILE); g.fillStyle(0xd85050, 0.5); g.fillRect(x+TILE/2-1, y, 2, TILE); }
      if (t === T.BENCH) { g.fillStyle(0x6a4522); g.fillRect(x+4, y+12, TILE-8, 8); g.fillStyle(0x8a5f30); g.fillRect(x+4, y+8, TILE-8, 4); }
    }
    // Bake the building shapes INTO the map texture so the 3D mirror reads them
    // as ground art it erases under each GLB — drawn as a separate graphics
    // object they were adopted as their own flat relief, showing a duplicate
    // "2D" building beside the real 3D model.
    for (const b of BUILDINGS) {
      const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
      g.fillStyle(0xefe4d0); g.fillRect(x, y, w, h); g.lineStyle(2, 0x3a2a1a); g.strokeRect(x, y, w, h);
      g.fillStyle(b.roof); g.fillTriangle(x - 5, y + 2, x + w / 2, y - TILE + 2, x + w + 5, y + 2);
      g.fillStyle(0x88ccff, 0.7); for (let wx = 8; wx < w - 8; wx += 22) g.fillRect(x + wx, y + 16, 14, 14);
      const dx = b.doorCol * TILE, dy = (b.y + b.h - 1) * TILE;
      g.fillStyle(0x5a3a1a); g.fillRect(dx + 4, dy, TILE - 8, TILE);
    }
    const key = '__hanRiverMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    // Building name labels (kept as separate world-space text over the baked art).
    for (const b of BUILDINGS) {
      this.add.text((b.x + b.w / 2) * TILE, (b.y - 1.2) * TILE, tr(b.label), {
        fontSize: '10px', color: '#fff', backgroundColor: '#00000099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(3);
    }

    // Labels
    this.add.text(23 * TILE, 1.2 * TILE, tr('🌉 Han River'), {
      fontSize: '11px', color: '#dff', backgroundColor: '#1a3a5a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(23 * TILE, 12.8 * TILE, tr('⛩ Riverside Pavilion'), {
      fontSize: '9px', color: '#ffe', backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(23 * TILE, 25.4 * TILE, tr('↓ Capitol City'), {
      fontSize: '9px', color: '#eee', backgroundColor: '#00000099', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  // ── Cyclists gliding along the bike road ───────────────────────────────────
  private spawnCyclists() {
    const roadY = 6.7 * TILE, W = COLS * TILE;
    const seeds = [ { dir: 1, y: roadY, s: 90 }, { dir: 1, y: roadY + 14, s: 130 }, { dir: -1, y: roadY + 6, s: 110 },
                    { dir: -1, y: roadY + 20, s: 80 }, { dir: 1, y: roadY + 22, s: 150 } ];
    for (const sd of seeds) {
      const g = this.add.graphics().setDepth(9);
      this.drawCyclist(g, sd.dir);
      const startX = sd.dir === 1 ? -40 : W + 40;
      g.setPosition(startX, sd.y);
      this.cyclists.push({ g, dir: sd.dir, speed: sd.s, y: sd.y });
      // stagger the initial x so they aren't bunched
      g.x = Math.random() * W;
    }
  }
  private drawCyclist(g: Phaser.GameObjects.Graphics, dir: number) {
    g.clear();
    const f = dir; // faces travel direction
    g.fillStyle(0x000000, 0.18); g.fillEllipse(0, 12, 22, 5);       // shadow
    g.fillStyle(0x222222); g.fillCircle(-7 * f, 8, 4); g.fillCircle(7 * f, 8, 4);  // wheels
    g.lineStyle(2, 0x9a9a9a); g.strokeCircle(-7 * f, 8, 4); g.strokeCircle(7 * f, 8, 4);
    g.fillStyle(0xcc3344); g.fillRect(-7 * f, 5, 14 * f, 2);        // frame
    g.fillStyle(0x2a5aaa); g.fillRect(-2, -6, 5, 10);              // rider torso
    g.fillStyle(0xf0c8a0); g.fillCircle(1, -9, 4);                 // head
    g.fillStyle(0xdd3333); g.fillRect(-2, -13, 6, 3);              // helmet
    // Use the full player rig (including its bicycle) in the 3D mirror while
    // retaining this compact 2D fallback.
    g.setData('characterModel3DKey', 'trainer_boy');
    g.setData('characterGender3D', 'boy');
    g.setData('characterVehicle3D', 'bike');
    g.setData('characterFootY3D', 12);
  }

  private spawnPicnickers() {
    for (const p of PICNICS) {
      const x = p.col * TILE + 16, y = p.row * TILE + 16;
      // mat
      const mat = this.add.graphics().setDepth(6); mat.fillStyle(0xd85a5a, 0.85); mat.fillRoundedRect(x - 22, y - 6, 44, 26, 4);
      mat.fillStyle(0xffffff, 0.5); for (let i = -18; i < 22; i += 10) mat.fillRect(x + i, y - 6, 2, 26);
      // seated person (use the NPC body, nudged down as if sitting)
      const g = this.add.graphics().setDepth(7); drawNpcBody(g, 0x6a4a8a, { hair: 0x2a2622 }); g.setPosition(x - 8, y + 6);
      this.add.text(x + 10, y + 8, p.food, { fontSize: '13px' }).setOrigin(0.5).setDepth(7);
    }
  }

  // ── Player / camera / input ────────────────────────────────────────────────
  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    (this.cycling ? drawRiderBody : drawTrainerBody)(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
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
    // C — hop on / off the Bicycle (once you own one).
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => {
      if (this.cutsceneActive || !hasBike(this.registry)) return;
      this.cycling = !this.cycling; this.drawChar();
    });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 360, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🚲 Han River Park (한강공원)'), {
      fontSize: '14px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 34, '', {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SPACE: talk  C: bike  M: menu'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(_: number, delta: number) {
    const dt = delta / 1000;
    // Cyclists loop across the bike road regardless of cutscene state.
    const W = COLS * TILE;
    for (const cy of this.cyclists) {
      cy.g.x += cy.dir * cy.speed * dt;
      if (cy.dir === 1 && cy.g.x > W + 40) cy.g.x = -40;
      if (cy.dir === -1 && cy.g.x < -40) cy.g.x = W + 40;
    }
    if (this.cutsceneActive) {
      if (this.dialog.isInChoice()) {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.dialog.navigateChoice(-1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.dialog.navigateChoice(1);
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.confirmChoice();
      } else if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
      return;
    }
    let dx = 0, dy = 0;
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
    this.checkBuildings();
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

  private checkBuildings() {
    let near: Spot | null = null;
    for (const b of BUILDINGS) {
      const dx = this.px - (b.doorCol * TILE + TILE / 2), dy = this.py - ((b.y + b.h - 1) * TILE + TILE / 2);
      if (Math.hypot(dx, dy) < TILE * 1.3) { near = b; break; }
    }
    if (!near) { this.enterPrompt.setVisible(false); return; }
    this.enterPrompt.setText(`SPACE — ${tr(near.label)}`).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    this.cutsceneActive = true;
    const scene = near.label.includes('Bicycle') ? 'BikeShopScene' : 'ConvenienceStoreScene';
    this.registry.set('hanRiverReturnX', near.doorCol * TILE + 16);
    this.registry.set('hanRiverReturnY', (near.doorRow + 1) * TILE + 16);
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(scene));
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    // South → back to the Capitol's east avenue.
    if (this.py > (ROWS - 1) * TILE && this.px > 20 * TILE && this.px < 26 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        // Return beside the expanded capital's eastern riverside gate.
        this.registry.set('capitalReturnX', 61 * TILE + 16);
        this.registry.set('capitalReturnY', 61 * TILE + 16);
        this.scene.start('CapitolCityScene');
      });
    }
  }
}
