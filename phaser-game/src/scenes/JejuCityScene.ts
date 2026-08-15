import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr } from '../systems/i18n';
import { drawTrainerBody, drawRiderBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { playBgm } from '../systems/Music';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';

// ── Tiles ─────────────────────────────────────────────────────────────────
const T = {
  GRASS: 0, PATH: 1, STONE: 2, WATER: 3, SHALLOW: 4, SAND: 5, BUILDING: 6,
  TREE: 7, PALM: 8, TANGERINE: 9, CANOLA: 10, WALL: 11, DOLHARUBANG: 12,
  ROCK: 13, FLOWER: 14,
} as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 42, ROWS = 28;
const COLORS: Record<Tile, number> = {
  [T.GRASS]: 0x4c7a3c,  [T.PATH]: 0xcbb890,  [T.STONE]: 0x585450,  [T.WATER]: 0x1f5f9a,
  [T.SHALLOW]: 0x2f9fb0, [T.SAND]: 0x3a352f, [T.BUILDING]: 0xe4dcc8, [T.TREE]: 0x2c5a2c,
  [T.PALM]: 0x2f7a3a,   [T.TANGERINE]: 0x356a2c, [T.CANOLA]: 0x5a8a3a, [T.WALL]: 0x2f2b28,
  [T.DOLHARUBANG]: 0x8a857c, [T.ROCK]: 0x33302c, [T.FLOWER]: 0x4c7a3c,
};
const SOLID = new Set<Tile>([
  T.WATER, T.SHALLOW, T.BUILDING, T.TREE, T.PALM, T.TANGERINE, T.WALL, T.DOLHARUBANG, T.ROCK,
]);

interface Landmark {
  name: string; col: number; row: number; w: number; h: number; desc: string;
  type: 'temple' | 'waterfall' | 'market' | 'spring' | 'garden' | 'entrance' | 'center' | 'mart';
  doorCol?: number; doorRow?: number; scene?: string;
}
const LANDMARKS: Landmark[] = [
  { name: 'Vents Entrance', type: 'entrance', col: 17, row: 0, w: 8, h: 2, desc: 'Gateway to the volcanic vents' },
  { name: '산방산 Shrine', type: 'temple', col: 2, row: 5, w: 4, h: 4, desc: 'Sanbangsan — sacred peak shrine of the island spirits', doorCol: 6, doorRow: 7, scene: 'SanbangsanShrineScene' },
  { name: 'Harbor Tavern', type: 'market', col: 2, row: 10, w: 4, h: 2, desc: 'Sailors gather here to share tales', doorCol: 3, doorRow: 12, scene: 'HarborTavernScene' },
  { name: 'Pokémon Center', type: 'center', col: 10, row: 7, w: 4, h: 4, desc: 'Heal your Pokémon here', doorCol: 11, doorRow: 11, scene: 'JejuPCScene' },
  { name: 'Poké Mart', type: 'mart', col: 26, row: 8, w: 3, h: 3, desc: 'Buy supplies and items', doorCol: 27, doorRow: 11, scene: 'ShopScene' },
  { name: 'Cheonjiyeon Waterfall', type: 'waterfall', col: 34, row: 4, w: 4, h: 4, desc: 'Crystal falls flowing into emerald pools', doorCol: 35, doorRow: 8, scene: 'CheonjiyeonWaterfallScene' },
  { name: 'Haenyeo Hot Spring', type: 'spring', col: 3, row: 15, w: 5, h: 4, desc: 'Geothermal baths blessed by the diver women', doorCol: 5, doorRow: 14, scene: 'HaenyeoHotSpringScene' },
  { name: 'Jeju Library', type: 'market', col: 10, row: 15, w: 4, h: 4, desc: 'Ancient texts and island history', doorCol: 11, doorRow: 14, scene: 'JejuLibraryScene' },
  { name: 'Jeju Market', type: 'market', col: 26, row: 15, w: 5, h: 4, desc: 'Traditional market — rare herbs and souvenirs', doorCol: 28, doorRow: 14, scene: 'JejuMarketScene' },
  { name: 'Hallasan Gardens', type: 'garden', col: 33, row: 15, w: 4, h: 4, desc: 'Legendary alpine garden paths', doorCol: 35, doorRow: 14, scene: 'HallasanGardensScene' },
  { name: 'Beach Pavilion', type: 'market', col: 24, row: 20, w: 4, h: 3, desc: 'Rest spot overlooking the black-sand beach', doorCol: 25, doorRow: 19, scene: 'BeachPavilionScene' },
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GRASS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };
  const set = (r: number, c: number, t: Tile) => { if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t; };

  // ── Canola (rapeseed) flower fields — iconic Jeju spring gold ──
  fill(4, 6, 15, 19, T.CANOLA);    // north-central field
  fill(19, 21, 33, 37, T.CANOLA);  // east field near gardens
  fill(21, 23, 3, 7, T.CANOLA);    // south-west field

  // ── Harbour (deep water, north-west) ──
  fill(0, 5, 0, 9, T.WATER);

  // ── Black-sand beach (south) with sea in the corners ──
  fill(23, ROWS, 0, COLS, T.SAND);
  fill(25, ROWS, 0, 7, T.SHALLOW);      // south-west sea
  fill(25, ROWS, 35, COLS, T.SHALLOW);  // south-east sea

  // ── Basalt-paved streets forming a cross, with a central plaza ──
  fill(12, 14, 1, 41, T.STONE);   // horizontal boulevard
  fill(0, ROWS, 20, 22, T.STONE); // vertical boulevard (through gate & to beach)
  fill(11, 15, 18, 24, T.STONE);  // central plaza

  // ── Buildings (skip the north gate 'entrance') ──
  for (const lm of LANDMARKS) {
    if (lm.type === 'entrance') continue;
    fill(lm.row, lm.row + lm.h, lm.col, lm.col + lm.w, T.BUILDING);
  }

  // ── North gate: basalt pillars flanking the vent road ──
  fill(0, 2, 17, 20, T.WALL);
  fill(0, 2, 22, 25, T.WALL);

  // ── Carve door-front approach tiles so every entrance is reachable ──
  for (const [r, c] of [[11,11],[11,27],[14,5],[14,11],[14,28],[14,35]] as [number,number][]) set(r, c, T.PATH);
  fill(14, 20, 25, 26, T.PATH);   // lane down to the Beach Pavilion
  fill(7, 12, 6, 7, T.PATH);      // lane up to the Shrine's east gate
  fill(8, 12, 35, 36, T.PATH);    // lane up to the Waterfall grotto

  // ── Batdam (stone field walls) bordering the canola fields ──
  fill(6, 7, 15, 19, T.WALL);
  fill(21, 22, 33, 37, T.WALL);

  // ── Tangerine groves (orange citrus) ──
  for (const [r,c] of [[9,15],[9,17],[10,24],[10,25],[16,16],[17,16],[20,10],[20,11]] as [number,number][]) set(r, c, T.TANGERINE);

  // ── Shade trees ──
  for (const [r,c] of [[6,12],[6,25],[18,8],[18,32]] as [number,number][]) set(r, c, T.TREE);

  // ── Volcanic rocks ──
  for (const [r,c] of [[3,11],[6,7],[19,31],[22,9]] as [number,number][]) set(r, c, T.ROCK);

  // ── Palms lining the black-sand beach ──
  for (const c of [3,6,9,12,16,25,29,33,37]) set(23, c, T.PALM);
  for (const c of [5,14,31,38]) set(24, c, T.PALM);

  // ── Decorative wildflowers ──
  for (const [r,c] of [[8,20],[9,29],[16,24],[19,14],[10,7]] as [number,number][]) set(r, c, T.FLOWER);

  // ── Dolharubang stone grandfathers (guardians, placed in pairs) ──
  for (const [r,c] of [
    [3,19],[3,22],          // north gate
    [11,18],[11,23],[14,18],[14,23], // plaza corners
    [9,2],[9,5],            // shrine approach
    [22,18],[22,23],        // south beach gate
  ] as [number,number][]) set(r, c, T.DOLHARUBANG);

  return m;
}

export class JejuCityScene extends Phaser.Scene {
  private map!: Tile[][];
  // Major landmarks get their own generated GLBs (PC & mart reuse the shared
  // models); every other building keeps its original design via the procedural
  // facade extrusion (no onlyNamedBuildings). caveFloorHint keeps the dark
  // black-sand/basalt tiles walkable so they don't wall the player in.
  public buildingPlots = [
    { x: 10, y: 7,  w: 4, h: 4, model: 'pokecenter' },
    { x: 26, y: 8,  w: 3, h: 3, model: 'mart' },
    { x: 2,  y: 5,  w: 4, h: 4, model: 'sanbangsan' },
    { x: 34, y: 4,  w: 4, h: 4, model: 'cheonjiyeon' },
    { x: 26, y: 15, w: 5, h: 4, model: 'jejumarket' },
    { x: 2,  y: 10, w: 4, h: 2, model: 'hanok' },        // Harbor Tavern (선술집)
  ];
  public caveFloorHint = true;
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 20 * TILE + 16;
  private py = 24 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private readonly SPEED = 120; private readonly RUN = 250;

  constructor() { super('JejuCityScene'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('jejuCityReturnX') as number | undefined;
    const ry = this.registry.get('jejuCityReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('jejuCityReturnX'); this.registry.remove('jejuCityReturnY');

    this.map = buildMap();

    this.createPlayer();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [T.WATER, T.SHALLOW], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();

    // Defer drawing operations to avoid freeze on init
    this.time.delayedCall(100, () => {
      this.drawMap();
      this.drawLandmarks();
    });

    this.cameras.main.fadeIn(400);
    playBgm(this, 'jejudo');   // Beautiful Jeju island theme

    SaveManager.save(this.registry, this.px, this.py, 'JejuCityScene');

    if (!this.registry.get('jejuCityVisited')) {
      this.registry.set('jejuCityVisited', true);
    } else {
      this.time.delayedCall(300, () => maybeLaunchEvolution(this));
    }
  }

  private getLandmarkAtPos(col: number, row: number) {
    for (const lm of LANDMARKS) {
      if (lm.type === 'entrance') continue;
      if (col >= lm.col && col < lm.col + lm.w && row >= lm.row && row < lm.row + lm.h) return lm;
    }
    return null;
  }

  private isDoorTile(lm: Landmark, c: number, r: number): boolean {
    if (lm.doorCol === undefined || lm.doorRow === undefined) return false;
    const ac = lm.doorCol, ar = lm.doorRow;
    // Vertical door — approach is directly above or below the building
    if (ac >= lm.col && ac < lm.col + lm.w) {
      const doorRow = ar >= lm.row + lm.h ? lm.row + lm.h - 1 : lm.row;
      return c === ac && r === doorRow;
    }
    // Horizontal door — approach is to the left or right of the building
    if (ar >= lm.row && ar < lm.row + lm.h) {
      const doorCol = ac >= lm.col + lm.w ? lm.col + lm.w - 1 : lm.col;
      return r === ar && c === doorCol;
    }
    return false;
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    const rnd = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5; return s - Math.floor(s); };

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);

      switch (t) {
        case T.GRASS: case T.FLOWER: case T.CANOLA: {
          // grass texture — subtle blade variation
          const v = rnd(r, c);
          g.fillStyle(v > 0.5 ? 0x5a8a46 : 0x3f6a32, 0.5);
          g.fillRect(x + 3 + v * 6, y + 6, 3, 6);
          g.fillRect(x + 20, y + 14 + v * 6, 3, 6);
          if (t === T.CANOLA) {
            g.fillStyle(0xf5d020, 1);
            for (const [dx, dy] of [[6,8],[16,6],[24,12],[11,20],[22,22]] as [number,number][]) g.fillCircle(x+dx, y+dy, 2.4);
            g.fillStyle(0xffe870, 0.9);
            for (const [dx, dy] of [[6,8],[16,6],[24,12]] as [number,number][]) g.fillCircle(x+dx-0.5, y+dy-0.5, 1);
          }
          if (t === T.FLOWER) {
            const cols = [0xff6a9a, 0xffffff, 0xd06aff];
            for (let i = 0; i < 4; i++) { g.fillStyle(cols[i % 3], 1); g.fillCircle(x + 8 + (i % 2) * 14, y + 10 + Math.floor(i / 2) * 12, 2.2); }
          }
          break;
        }
        case T.PATH: {
          const v = rnd(r * 2, c);
          g.fillStyle(0xb8a578, 0.5); g.fillRect(x + 4 + v * 4, y + 5, 4, 3);
          g.fillStyle(0xd8c69a, 0.5); g.fillRect(x + 18, y + 20, 5, 3);
          break;
        }
        case T.STONE: {
          // basalt paving with lighter speckles + joints
          g.fillStyle(0x6a655e, 1); g.fillRect(x + 2, y + 2, 13, 13);
          g.fillStyle(0x504b46, 1); g.fillRect(x + 17, y + 2, 13, 13);
          g.fillStyle(0x615c55, 1); g.fillRect(x + 2, y + 17, 13, 13);
          g.fillStyle(0x565149, 1); g.fillRect(x + 17, y + 17, 13, 13);
          if (rnd(r, c * 3) > 0.6) { g.fillStyle(0x7a746c, 0.6); g.fillCircle(x + 6 + rnd(c, r) * 20, y + 8 + rnd(r, c) * 16, 1.5); }
          break;
        }
        case T.WATER: {
          g.fillStyle(0x2b74b2, 0.7); g.fillEllipse(x + 16, y + 15, 22, 12);
          g.fillStyle(0x5aa8de, 0.5); g.fillRect(x + 5, y + 9, 8, 2);
          g.fillStyle(0x8fd0f0, 0.4); g.fillRect(x + 18, y + 20, 7, 2);
          break;
        }
        case T.SHALLOW: {
          g.fillStyle(0x4fc0cd, 0.7); g.fillEllipse(x + 16, y + 16, 24, 16);
          g.fillStyle(0xaef0f0, 0.4); g.fillRect(x + 6, y + 10, 8, 2);
          break;
        }
        case T.SAND: {
          const v = rnd(r, c);
          g.fillStyle(0x4a443c, 0.8); g.fillCircle(x + 7 + v * 6, y + 9, 2);
          g.fillStyle(0x2a2620, 0.8); g.fillCircle(x + 20, y + 20 - v * 6, 1.6);
          g.fillStyle(0x565049, 0.5); g.fillCircle(x + 24, y + 8, 1.5);
          break;
        }
        case T.TREE: {
          g.fillStyle(0x1e421e, 1); g.fillCircle(x + 16, y + 17, 12);
          g.fillStyle(0x336633, 1); g.fillCircle(x + 12, y + 13, 6); g.fillCircle(x + 20, y + 15, 6);
          g.fillStyle(0x4a8a4a, 0.6); g.fillCircle(x + 13, y + 12, 3);
          break;
        }
        case T.TANGERINE: {
          g.fillStyle(0x274d22, 1); g.fillCircle(x + 16, y + 17, 12);
          g.fillStyle(0x3a7a34, 1); g.fillCircle(x + 12, y + 13, 6); g.fillCircle(x + 21, y + 16, 5);
          g.fillStyle(0xff8a1a, 1);
          for (const [dx, dy] of [[10,14],[20,12],[15,20],[22,21]] as [number,number][]) g.fillCircle(x+dx, y+dy, 2.4);
          g.fillStyle(0xffb64a, 0.9);
          for (const [dx, dy] of [[10,14],[20,12]] as [number,number][]) g.fillCircle(x+dx-0.6, y+dy-0.6, 1);
          break;
        }
        case T.PALM: {
          g.fillStyle(0x8a6a3a, 1); g.fillRect(x + 14, y + 14, 4, 16);
          g.fillStyle(0x6a4a22, 0.7); g.fillRect(x + 14, y + 20, 4, 2); g.fillRect(x + 14, y + 25, 4, 2);
          g.fillStyle(0x2f8a3a, 1);
          g.fillTriangle(x + 16, y + 12, x + 2, y + 8, x + 6, y + 15);
          g.fillTriangle(x + 16, y + 12, x + 30, y + 8, x + 26, y + 15);
          g.fillTriangle(x + 16, y + 12, x + 8, y + 2, x + 15, y + 6);
          g.fillTriangle(x + 16, y + 12, x + 24, y + 2, x + 17, y + 6);
          g.fillStyle(0x3fae4a, 0.7); g.fillTriangle(x + 16, y + 12, x + 6, y + 6, x + 12, y + 10);
          g.fillStyle(0x8a5a2a, 1); g.fillCircle(x + 13, y + 13, 1.6); g.fillCircle(x + 19, y + 13, 1.6);
          break;
        }
        case T.ROCK: {
          g.fillStyle(0x1f1c19, 1); g.fillEllipse(x + 16, y + 19, 24, 16);
          g.fillStyle(0x3a352f, 1); g.fillEllipse(x + 14, y + 16, 16, 11);
          g.fillStyle(0x000000, 0.5); g.fillCircle(x + 12, y + 17, 1.6); g.fillCircle(x + 19, y + 15, 1.4); g.fillCircle(x + 21, y + 20, 1.6);
          break;
        }
        case T.WALL: {
          // batdam — stacked rounded basalt stones
          g.fillStyle(0x211e1b, 1); g.fillRect(x, y, TILE, TILE);
          g.fillStyle(0x413b35, 1);
          g.fillRoundedRect(x + 1, y + 2, 13, 9, 3); g.fillRoundedRect(x + 16, y + 2, 14, 9, 3);
          g.fillRoundedRect(x + 8, y + 12, 14, 9, 3); g.fillRoundedRect(x + 1, y + 21, 12, 9, 3);
          g.fillRoundedRect(x + 18, y + 21, 13, 9, 3);
          g.fillStyle(0x565049, 0.7); g.fillRoundedRect(x + 3, y + 3, 6, 3, 2); g.fillRoundedRect(x + 18, y + 3, 6, 3, 2);
          break;
        }
        case T.BUILDING: {
          const lm = this.getLandmarkAtPos(c, r);
          if (lm) this.drawBuildingTile(g, lm, c, r);
          break;
        }
        case T.DOLHARUBANG: {
          // sit the statue on the underlying terrain (grass/stone already drawn)
          this.drawDolharubang(g, x, y);
          break;
        }
      }
    }

    // Central plaza inlay — a compass star on the basalt
    const px = 21 * TILE, py = 13 * TILE;
    g.lineStyle(2, 0x8a847a, 0.7);
    g.strokeCircle(px, py, 26);
    g.fillStyle(0x8a847a, 0.5);
    g.fillTriangle(px, py - 30, px - 6, py, px + 6, py);
    g.fillTriangle(px, py + 30, px - 6, py, px + 6, py);
    g.fillTriangle(px - 30, py, px, py - 6, px, py + 6);
    g.fillTriangle(px + 30, py, px, py - 6, px, py + 6);

    const key = '__jejuCityMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE);
    g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
  }

  private drawBuildingTile(g: Phaser.GameObjects.Graphics, lm: Landmark, c: number, r: number) {
    const x = c * TILE, y = r * TILE;
    const roofColors: Record<string, number> = {
      center: 0xd83a3a, mart: 0x3a6ad8, temple: 0x9a3a2a, waterfall: 0x2f9aae,
      market: 0xd8873a, garden: 0x4a9a44, spring: 0x3fa0a8,
    };
    const isTop = r === lm.row;
    const isBottom = r === lm.row + lm.h - 1;

    // cream plaster wall body
    g.fillStyle(0xe6decb, 1); g.fillRect(x, y, TILE, TILE);
    if (isBottom) { g.fillStyle(0x9a9086, 1); g.fillRect(x, y + TILE - 7, TILE, 7); }  // stone foundation
    g.fillStyle(0x000000, 0.05); g.fillRect(x, y + TILE - 1, TILE, 1);
    g.fillStyle(0xffffff, 0.06); g.fillRect(x, y, TILE, 1);

    if (isTop) {
      const rc = roofColors[lm.type] ?? 0x6a7a9a;
      g.fillStyle(rc, 1); g.fillRect(x, y, TILE, TILE);
      g.fillStyle(0x000000, 0.22); g.fillRect(x, y, TILE, 3);              // ridge
      g.fillStyle(0xffffff, 0.14); g.fillRect(x, y + 4, TILE, 3);          // highlight
      g.fillStyle(0x000000, 0.18); g.fillRect(x, y + TILE - 5, TILE, 5);   // eave shadow
      // curved-tile hint
      g.fillStyle(0x000000, 0.1);
      for (let i = 0; i < TILE; i += 8) g.fillRect(x + i, y + 7, 1, TILE - 12);
      if (lm.type === 'temple') { // dancheong trim
        g.fillStyle(0x2a8a4a, 0.9); g.fillRect(x, y + TILE - 9, TILE, 3);
        g.fillStyle(0x2a5aba, 0.9); g.fillRect(x, y + TILE - 6, TILE, 2);
      }
      if (lm.type === 'center') { g.fillStyle(0xffffff, 1); g.fillRect(x + TILE/2 - 6, y + TILE/2 - 2, 12, 4); g.fillRect(x + TILE/2 - 2, y + TILE/2 - 6, 4, 12); }
      if (lm.type === 'mart')   { g.fillStyle(0xffe08a, 1); g.fillRect(x + 7, y + 11, TILE - 14, 5); }
    } else if (this.isDoorTile(lm, c, r)) {
      g.fillStyle(0x3a2a1a, 1); g.fillRect(x + TILE/2 - 8, y + TILE - 18, 16, 18);
      g.fillStyle(0x14100a, 1); g.fillRect(x + TILE/2 - 6, y + TILE - 15, 12, 15);
      g.fillStyle(0xffd070, 0.45); g.fillRect(x + TILE/2 - 6, y + TILE - 15, 12, 3);
      g.fillStyle(0xcaa24a, 1); g.fillCircle(x + TILE/2 + 3, y + TILE - 8, 1.2);
    } else {
      // window
      g.fillStyle(0x2e3c58, 1); g.fillRect(x + 8, y + 9, TILE - 16, TILE - 17);
      g.fillStyle(0xffe9a8, 0.85); g.fillRect(x + 10, y + 11, TILE - 20, TILE - 21);
      g.fillStyle(0x000000, 0.25); g.fillRect(x + TILE/2 - 1, y + 11, 2, TILE - 21); g.fillRect(x + 10, y + TILE/2 - 1, TILE - 20, 2);
      if (lm.type === 'waterfall') { g.fillStyle(0x6ac8ee, 0.5); g.fillRect(x + TILE/2 - 2, y + 6, 4, TILE - 10); }
      if (lm.type === 'spring')    { g.fillStyle(0xffffff, 0.3); g.fillCircle(x + 24, y + 8, 3); g.fillCircle(x + 8, y + 6, 2); }
    }
  }

  private drawDolharubang(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x000000, 0.18); g.fillEllipse(x + 16, y + 29, 20, 6);       // shadow
    g.fillStyle(0x6f6a61, 1); g.fillEllipse(x + 16, y + 27, 18, 6);          // pedestal
    g.fillStyle(0x8f8a80, 1); g.fillRoundedRect(x + 7, y + 13, 18, 14, 4);   // body
    g.fillStyle(0x9a958b, 1); g.fillCircle(x + 16, y + 11, 8);               // head
    g.fillStyle(0x6f6a61, 1); g.fillEllipse(x + 16, y + 5, 20, 8);           // mushroom hat
    g.fillStyle(0x7d786f, 1); g.fillEllipse(x + 16, y + 6, 20, 4);           // hat brim shade
    g.fillStyle(0x2a2622, 1); g.fillCircle(x + 12, y + 11, 2.3); g.fillCircle(x + 20, y + 11, 2.3); // eyes
    g.fillStyle(0x7a756c, 1); g.fillTriangle(x + 16, y + 9, x + 14, y + 15, x + 18, y + 15);        // nose
    g.fillStyle(0x2a2622, 0.55); g.fillRect(x + 13, y + 16, 6, 1.5);         // mouth
    g.fillStyle(0x827d74, 1); g.fillRect(x + 9, y + 20, 4, 3); g.fillRect(x + 19, y + 20, 4, 3);    // hands on belly
    g.fillStyle(0xffffff, 0.1); g.fillCircle(x + 13, y + 8, 2);              // highlight
    g.fillStyle(0x000000, 0.12); g.fillRect(x + 7, y + 23, 18, 2);           // base shade
  }

  private drawLandmarks() {
    for (const lm of LANDMARKS) {
      const x = lm.col * TILE + lm.w * TILE / 2;
      const y = lm.row * TILE - 2;

      let color = '#ffe8c0';
      if (lm.type === 'temple') color = '#ff9aa8';
      else if (lm.type === 'waterfall') color = '#9ae6ff';
      else if (lm.type === 'spring') color = '#a8ecf0';
      else if (lm.type === 'garden') color = '#a6f0a0';
      else if (lm.type === 'center') color = '#ff9a9a';
      else if (lm.type === 'mart') color = '#a8c0ff';
      else if (lm.type === 'entrance') color = '#ffbfa0';

      this.add.text(x, y, lm.name, {
        fontSize: '9px', color, backgroundColor: '#000000aa', padding: { x: 3, y: 1 }, align: 'center',
      }).setOrigin(0.5, 1).setDepth(6);
    }

    // Directional signs
    this.add.text(21 * TILE, 0.5 * TILE, tr('⬆ Vents & Summit Trail'), {
      fontSize: '9px', color: '#ffb0a0', backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(6);
    this.add.text(21 * TILE, (ROWS - 0.5) * TILE, tr('⬇ Black-Sand Beach → Ferry'), {
      fontSize: '9px', color: '#bfe8ff', backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(6);
  }

  // ── Player / camera / input ──────────────────────────────────────────────
  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    (this.cycling ? drawRiderBody : drawTrainerBody)(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }
  private setupCamera() {
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.setZoom(1.4);
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
    this.add.rectangle(this.scale.width / 2, 22, 400, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🏝️ Jeju City — Island Heart'), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  SPACE: enter  M: menu'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(_: number, delta: number) {
    if (this.cutsceneActive) return;
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
    this.checkBuildings();
    this.checkExits();
  }

  private checkBuildings() {
    if (this.cutsceneActive) return;
    for (const lm of LANDMARKS) {
      if (!lm.doorCol || !lm.doorRow || !lm.scene) continue;
      const doorX = lm.doorCol * TILE + TILE / 2;
      const doorY = lm.doorRow * TILE + TILE / 2;
      if (Math.hypot(this.px - doorX, this.py - doorY) < TILE * 1.2) {
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
          if (lm.type === 'mart') {
            this.scene.launch('ShopScene', { parentKey: 'JejuCityScene' });
            // Match every other overlay mart: stop the city from consuming
            // movement/menu input behind the shop while a purchase is made.
            this.scene.pause();
            return;
          } else {
            this.cutsceneActive = true;
            this.cameras.main.fadeOut(400, 0, 0, 0, () => {
              if (lm.scene === 'JejuPCScene') {
                this.registry.set('pcReturnScene', 'JejuCityScene');
                this.registry.set('pcReturnX', doorX);
                this.registry.set('pcReturnY', doorY + TILE);
              }
              this.registry.set('interiorReturnScene', 'JejuCityScene');
              this.registry.set('interiorReturnX', this.px);
              this.registry.set('interiorReturnY', this.py);
              this.scene.start(lm.scene);
            });
          }
        }
      }
    }
  }

  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      return SOLID.has(this.map[row][col]);
    });
  }

  private checkExits() {
    if (this.cutsceneActive) return;
    const nearCenter = this.px > 17 * TILE && this.px < 25 * TILE;
    // North → Jeju Vents Portal (only through the central gate)
    if (this.py < 1.2 * TILE && nearCenter) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('jejuVentsPortReturnX', 10 * TILE + 16);
        this.registry.set('jejuVentsPortReturnY', 13 * TILE + 16);
        this.scene.start('JejuVentsPortScene');
      });
    }
    // South → Ferry back to Haean (through the beach)
    if (this.py > (ROWS - 0.6) * TILE && nearCenter) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('ferryReturnX', 9 * TILE + 16);
        this.registry.set('ferryReturnY', 4 * TILE + 16);
        this.scene.start('FerryScene');
      });
    }
  }
}
