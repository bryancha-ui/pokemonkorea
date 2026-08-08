import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { PartySystem } from '../systems/PartySystem';
import { drawTrainerBody, drawRiderBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';

// ── Dolmoe City (돌뫼 시티) — The Stonecutters' City ──────────────────────────────
// A granite quarry-country city on the way up from Route 6. Holds the Stonemason's
// Quarry gym (Rock · Leader Sandol), a Pokémon Center, and the road on to Seorae.

const T = { GROUND: 0, ROAD: 1, WALL: 2, ROOF: 3 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 32, ROWS = 24;
const COLORS: Record<Tile, number> = { [T.GROUND]: 0x8a8378, [T.ROAD]: 0x6f6a60, [T.WALL]: 0x5a544c, [T.ROOF]: 0x7a4a2a };
const SOLID = new Set<Tile>([T.WALL, T.ROOF]);

// A broad granite city: gym + ruins in the old west quarter, PC + Mart along the
// east commercial row, a central plaza between.
const GYM  = { col: 5,  row: 9 };
const NURSE = { col: 16, row: 9 };
const MART = { col: 25, row: 9 };
// Scenic stones that used to read as flat dolmen/mountain stamps on the granite
// ground. They now use the project's existing `dolmen` GLB at the same layer.
const CITY_DOLMENS = [[2, 14], [4, 18], [18, 12], [26, 13], [24, 20], [30, 14]] as const;
const TOWNS = [
  { col: 8,  row: 17, color: 0x8a6a4a, line: "Stonemason: Every dolmen in this valley was raised by hand. My grandfather cut those capstones himself." },
  { col: 22, row: 16, color: 0x6a8a9a, line: "Potter: 옹기 jars breathe, you know. Ferment anything in them and it keeps through the hardest winter." },
  { col: 14, row: 14, color: 0xcf9a5a, line: "Child: The moth grandmother watches over Dolmoe! We carved her statues so she'd never forget us." },
  { col: 27, row: 18, color: 0x9a7a5a, line: "Old Quarryman: This granite's older than the kingdoms. It'll outlast the next ten, too." },
];
const RUINS = { col: 2, row: 18 };   // cave-mouth in the west cliff → 고인돌 유적 (dolmen ruins)

export class DolmoeCityScene extends Phaser.Scene {
  private map!: Tile[][];
  // Keep the authored buildings and pottery, but suppress colour-inferred rock
  // mountains that otherwise grow through and cover the small onggi props.
  public clearSight3D = true;
  public flatTileIds3D = [T.GROUND, T.ROAD, T.WALL, T.ROOF];
  public noRocks3D = true;
  // Quarry gym, Pokémon Center and mart reuse the shared models; the moth-
  // grandmother (나비할망) statue gets its own generated model on the plaza.
  public buildingPlots = [
    { x: 3,  y: 4,  w: 6, h: 5, model: 'gym' },
    { x: 14, y: 4,  w: 6, h: 5, model: 'pokecenter' },
    { x: 23, y: 4,  w: 6, h: 5, model: 'mart' },
    { x: 7,  y: 12, w: 2, h: 2, model: 'nabihalmang' },
    ...CITY_DOLMENS.map(([x, y]) => ({ x, y, w: 1, h: 1, model: 'dolmen' })),
  ];
  public onlyNamedBuildings = true;
  // Traditional 옹기 pottery jars around the plaza, as real 3D urns (coords mirror
  // the 2D jar() spots).
  public propPlots = ([[4, 15], [5, 15], [21, 16], [30, 18], [13, 20], [14, 20]] as [number, number][])
    .map(([x, y]) => ({ x, y, kind: 'pot' as const }));
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = 11 * TILE + 16;
  private py = 19 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private readonly SPEED = 130;
  private readonly RUN = 250;

  constructor() { super('DolmoeCityScene'); }

  create() {

    playBgm(this, 'dolmoe');
    this.registry.set('hasRunningShoes', true);   // enable SHIFT to run
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();
    this.spawnGuard = true;
    this.time.delayedCall(600, () => { this.spawnGuard = false; });

    this.px = 11 * TILE + 16; this.py = 19 * TILE + 16;
    const rx = this.registry.get('dolmoeReturnX') as number | undefined;
    const ry = this.registry.get('dolmoeReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('dolmoeReturnX'); this.registry.remove('dolmoeReturnY');

    this.map = buildMap();
    this.drawMap();
    this.drawBuildings();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'DolmoeCityScene');

    if (!this.registry.get('dolmoeSeen')) {
      this.registry.set('dolmoeSeen', true);
      this.time.delayedCall(500, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'You climb into Dolmoe City (돌뫼 시티) — a city hewn entirely from granite, dolmen fields and rock-cut Buddha carvings watching from the cliffs.',
          'The Stonemason\'s Quarry gym lies to the west; the road north climbs into snow toward Seorae. Heal at the Center first if you like.',
        ], () => { this.cutsceneActive = false; });
      });
    }
  }

  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      // WALL remains authoritative for collision, but its old dark mountain
      // stamp is no longer baked into the ground. Authored 3D buildings cover
      // their own footprints; the map boundary stays as clean granite paving.
      const painted = t === T.WALL || t === T.ROOF ? T.GROUND : t;
      g.fillStyle(COLORS[painted], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (painted === T.ROAD) { g.fillStyle(0x807a70, 0.5); g.fillRect(c*TILE+1, r*TILE+1, TILE-2, TILE-2); }
    }
    const key = '__dolmoeMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(11 * TILE, 0.5 * TILE, tr('↑ Dolmoe Mine (→ Seorae)'), { fontSize: '9px', color: '#fff', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    this.add.text(11 * TILE, 21.5 * TILE, tr('↓ Route 6'), { fontSize: '9px', color: '#fff', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
  }

  private drawBuildings() {
    const g = this.add.graphics().setDepth(3);
    // Gym building (rows 4-8, cols 3-8) with a door.
    g.fillStyle(0x6a655c); g.fillRect(3*TILE, 4*TILE, 6*TILE, 5*TILE);
    g.fillStyle(0x4a2a12); g.fillTriangle(3*TILE-4, 4*TILE, 6*TILE, 2.4*TILE, 9*TILE+4, 4*TILE);
    g.fillStyle(0x2a2018); g.fillRect(GYM.col*TILE, (GYM.row-1)*TILE, TILE, TILE);   // door
    this.add.text(6*TILE, 3.4*TILE, tr('⛏ QUARRY GYM'), { fontSize: '9px', color: '#e8ddc8', backgroundColor: '#00000099', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(4);
    // Pokémon Center (rows 4-8, cols 14-19).
    g.fillStyle(0xe8e8ee); g.fillRect(14*TILE, 4*TILE, 6*TILE, 5*TILE);
    g.fillStyle(0xcc2233); g.fillTriangle(14*TILE-4, 4*TILE, 17*TILE, 2.4*TILE, 20*TILE+4, 4*TILE);
    g.fillStyle(0xffffff); g.fillRect(16*TILE+8, 2.9*TILE, 6, 2); g.fillRect(16*TILE+10, 2.9*TILE-2, 2, 6);
    g.fillStyle(0x225588); g.fillRect(NURSE.col*TILE, (NURSE.row-1)*TILE, TILE, TILE);   // door
    this.add.text(17*TILE, 3.4*TILE, tr('✚ Pokémon Center'), { fontSize: '9px', color: '#123', backgroundColor: '#ffffffcc', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(4);
    // (No nurse stands outside — the Pokémon Center is enterable, with the nurse inside.)

    // Poké Mart (rows 4-8, cols 23-28) — an ordinary blue-roofed mart on the east row.
    g.fillStyle(0xdfe4ea); g.fillRect(23*TILE, 4*TILE, 6*TILE, 5*TILE);
    g.fillStyle(0x2a6a9a); g.fillTriangle(23*TILE-4, 4*TILE, 26*TILE, 2.4*TILE, 29*TILE+4, 4*TILE);
    g.lineStyle(2, 0x11333a); g.strokeTriangle(23*TILE-4, 4*TILE, 26*TILE, 2.4*TILE, 29*TILE+4, 4*TILE);
    g.fillStyle(0x11557a); g.fillRect(MART.col*TILE, (MART.row-1)*TILE, TILE, TILE);   // door
    this.add.text(26*TILE, 3.4*TILE, tr('🛒 Poké Mart'), { fontSize: '9px', color: '#eaf4ff', backgroundColor: '#11557acc', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(4);

    // West gate — the road out to the great 고인돌 유적 (dolmen ruins) beyond the city.
    this.add.text(1.6 * TILE, 11.5 * TILE, '← 고인돌 유적', {
      fontSize: '10px', color: '#e8ddc8', backgroundColor: '#00000099', padding: { x: 4, y: 2 },
    }).setOrigin(0, 0.5).setDepth(5);

    // ── Decor: 나비할망 moth statues + traditional 옹기 pottery to liven the plaza ──
    const mothStatue = (col: number, row: number) => {
      const x = col*TILE, y = row*TILE;
      g.fillStyle(0x8a847a); g.fillRect(x+5, y+16, 22, 14);                          // granite pedestal
      g.fillStyle(0x9a948a); g.fillRect(x+7, y+13, 18, 4);
      g.fillStyle(0x2f5a56); g.fillEllipse(x+16, y+8, 8, 13);                        // moth body
      g.fillStyle(0x66c0b0); g.fillTriangle(x+16, y+7, x+1, y+1, x+5, y+16);         // wings
      g.fillTriangle(x+16, y+7, x+31, y+1, x+27, y+16);
      g.fillStyle(0xffe044); g.fillCircle(x+8, y+8, 2); g.fillCircle(x+24, y+8, 2);  // dancheong dots
    };
    // 2D moth-statue floor art removed — the 나비할망 statue is the 3D model on its
    // plot (leaving the flat images here left a stray statue afterimage on the ground).
    void mothStatue;
    this.add.text(8*TILE, 13.4*TILE, '나비할망 상', { fontSize: '8px', color: '#cfeee8', backgroundColor: '#00000088', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(4);

    const jar = (col: number, row: number) => {
      const x = col*TILE, y = row*TILE;
      g.fillStyle(0x5a3a24); g.fillEllipse(x+16, y+18, 17, 22);   // 옹기 belly
      g.fillStyle(0x3a2416); g.fillEllipse(x+16, y+9, 11, 6);     // mouth
      g.fillStyle(0x7a5238, 0.6); g.fillRect(x+11, y+13, 3, 9);   // glaze highlight
    };
    jar(4, 15); jar(5, 15); jar(21, 16); jar(30, 18); jar(13, 20); jar(14, 20);

    // Townsfolk — a little life in the plaza.
    for (const t of TOWNS) {
      const nb = this.add.graphics().setDepth(7);
      drawNpcBody(nb, t.color);
      nb.setPosition(t.col * TILE + 16, t.row * TILE + 16);
    }
  }

  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() { (this.cycling ? drawRiderBody : drawTrainerBody)(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry)); this.playerG.setPosition(this.px, this.py); }
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
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => { if (!this.cutsceneActive && hasBike(this.registry)) { this.cycling = !this.cycling; this.drawChar(); } });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 380, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('⛏ Dolmoe City — 돌뫼 시티'), { fontSize: '13px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 40, '', { fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 10, y: 5 } }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  SPACE: enter / heal  M: menu'), { fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 } }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  update(_: number, delta: number) {
    if (this.cutsceneActive) { if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance(); return; }
    const dt = delta / 1000; let dx = 0, dy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  { dx = -1; this.facing = 2; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { dx =  1; this.facing = 3; }
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    { dy = -1; this.facing = 1; }
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  { dy =  1; this.facing = 0; }
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const speed = this.cycling ? BIKE_SPEED : (this.registry.get('hasRunningShoes') && this.shiftKey.isDown ? this.RUN : this.SPEED);
      const nx = this.px + (dx / len) * speed * dt, ny = this.py + (dy / len) * speed * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > 170) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkInteractions();
    this.checkExits();
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      return SOLID.has(this.map[row][col]);
    });
  }

  private checkInteractions() {
    if (this.cutsceneActive) { this.enterPrompt.setVisible(false); return; }
    const gymD = Math.hypot(this.px - (GYM.col * TILE + 16), this.py - (GYM.row * TILE + 16));
    const nurD = Math.hypot(this.px - (NURSE.col * TILE + 16), this.py - (NURSE.row * TILE + 16));
    const martD = Math.hypot(this.px - (MART.col * TILE + 16), this.py - (MART.row * TILE + 16));
    if (martD < TILE * 1.3) {
      this.enterPrompt.setText(tr('SPACE — Enter the Poké Mart')).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.registry.set('martReturnScene', this.scene.key);
        this.registry.set('dolmoeReturnX', MART.col * TILE + 16); this.registry.set('dolmoeReturnY', (MART.row + 1) * TILE + 16);
        this.cutsceneActive = true;
        this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('MartScene'));
      }
      return;
    }
    for (const t of TOWNS) {
      if (Math.hypot(this.px - (t.col * TILE + 16), this.py - (t.row * TILE + 16)) < TILE * 1.3) {
        this.enterPrompt.setText(tr('SPACE — Talk')).setVisible(true);
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
          this.cutsceneActive = true;
          this.dialog.show([t.line], () => { this.cutsceneActive = false; });
        }
        return;
      }
    }
    if (gymD < TILE * 1.3) {
      this.enterPrompt.setText(tr('SPACE — Enter the Stonemason\'s Quarry')).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.registry.set('dolmoeReturnX', GYM.col * TILE + 16); this.registry.set('dolmoeReturnY', (GYM.row + 1) * TILE + 16);
        this.cutsceneActive = true;
        this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('DolmoeGymScene'));
      }
      return;
    }
    if (nurD < TILE * 1.3) {
      this.enterPrompt.setText(tr('SPACE — Enter the Pokémon Center')).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.registry.set('dolmoeReturnX', NURSE.col * TILE + 16); this.registry.set('dolmoeReturnY', (NURSE.row + 1) * TILE + 16);
        this.cutsceneActive = true;
        this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('DolmoePCScene'));
      }
      return;
    }
    this.enterPrompt.setVisible(false);
  }

  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (this.py < 1 * TILE) {   // north → Dolmoe Mine → Seorae Pass → Seorae Town
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('dolmoeMineReturnX', 10 * 32 + 16); this.registry.set('dolmoeMineReturnY', 40 * 32);
        this.scene.start('DolmoeMineScene');
      });
    } else if (this.py > (ROWS - 1) * TILE) {   // south → Route 6
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('route6ReturnX', 12 * 32 + 16); this.registry.set('route6ReturnY', 2 * 32 + 16);
        this.scene.start('Route6Scene');
      });
    } else if (this.px < 1 * TILE && this.py > 10.4 * TILE && this.py < 13.4 * TILE) {   // west → 고인돌 유적
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.remove('ruinsPosX'); this.registry.remove('ruinsPosY');   // spawn at the ruins' east entrance
        this.scene.start('DolmoeRuinsScene');
      });
    }
  }
}

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GROUND) as Tile[]);
  for (let c = 0; c < COLS; c++) { m[0][c] = T.WALL; m[ROWS - 1][c] = T.WALL; }
  for (let r = 0; r < ROWS; r++) { m[r][0] = T.WALL; m[r][COLS - 1] = T.WALL; }
  // Central road, with north + south openings.
  for (let r = 1; r < ROWS - 1; r++) { m[r][10] = T.ROAD; m[r][11] = T.ROAD; }
  m[0][10] = T.ROAD; m[0][11] = T.ROAD; m[ROWS - 1][10] = T.ROAD; m[ROWS - 1][11] = T.ROAD;
  // West arm out to the 고인돌 유적 (opens the west edge at rows 11-12).
  for (let c = 0; c < 12; c++) { m[11][c] = T.ROAD; m[12][c] = T.ROAD; }
  // Building footprints (solid) — three across the north row.
  for (let r = 4; r < 9; r++) for (let c = 3;  c < 9;  c++) m[r][c] = T.WALL;   // Quarry Gym (west)
  for (let r = 4; r < 9; r++) for (let c = 14; c < 20; c++) m[r][c] = T.WALL;   // Pokémon Center (centre)
  for (let r = 4; r < 9; r++) for (let c = 23; c < 29; c++) m[r][c] = T.WALL;   // Poké Mart (east)
  return m;
}
