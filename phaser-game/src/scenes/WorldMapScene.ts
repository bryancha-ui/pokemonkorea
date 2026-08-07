import Phaser from 'phaser';
import { tr, t } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, playerDesign, rivalDesign, rivalTrainerName, playerTrainerName } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { markRivalPortrait } from '../data/BattlePortraits';
import { DialogBox } from '../ui/DialogBox';
import { findForm } from '../data/StarterData';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';

// ── Tile types ────────────────────────────────────────────────────────────────
const T = {
  GRASS:    0,
  TREE:     1,
  ROAD_H:   2,
  ROAD_V:   3,
  ROAD_X:   4,
  WATER:    5,
  BUILDING: 6,
  ROOF:     7,
  MOUNTAIN: 8,
  FLOWER:   9,
  SAND:     10,
  BRIDGE:   11,
  SIGN:     12,
  PARK:     13,
} as const;

type Tile = typeof T[keyof typeof T];

const TILE = 32;   // px per tile
const COLS = 64;
const ROWS = 64;

// ── Waterfall City tile map ───────────────────────────────────────────────────
// prettier-ignore
function buildMap(): Tile[][] {
  const G = T.GRASS, TR = T.TREE, RH = T.ROAD_H, RV = T.ROAD_V,
        RX = T.ROAD_X, W = T.WATER, B = T.BUILDING, RF = T.ROOF,
        M = T.MOUNTAIN, FL = T.FLOWER, S = T.SAND, BR = T.BRIDGE,
        PK = T.PARK;

  // Fill with grass
  const map: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(G) as Tile[]);

  // ── Mountain range (north) rows 0-8 ──────────────────────────────────────
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < COLS; c++) {
      const d = Math.abs(c - 32) / 32;
      map[r][c] = (r < 6 - Math.floor(d * 3)) ? M : TR;
    }
  }

  // ── Waterfall river: col 14-16, rows 6-28 ────────────────────────────────
  for (let r = 6; r < 28; r++) {
    map[r][14] = S; map[r][15] = W; map[r][16] = S;
    if (r > 8) { map[r][13] = S; map[r][17] = S; }
  }
  // River bends east rows 28-34
  for (let r = 28; r < 35; r++) {
    map[r][15] = W; map[r][14] = S; map[r][16] = S;
    for (let c = 16; c < 16 + (r - 28) * 2; c++) {
      map[r][c] = c % 2 === 0 ? S : W;
    }
  }
  // River continues east rows 33-50, col 28-34
  for (let r = 33; r < 50; r++) {
    for (let c = 28; c < 35; c++) {
      map[r][c] = c === 29 || c === 31 || c === 33 ? W : S;
    }
  }

  // ── Bridge over river at row 22 ───────────────────────────────────────────
  map[22][14] = BR; map[22][15] = BR; map[22][16] = BR;

  // ── Forest belt: cols 0-8, rows 8-40 ─────────────────────────────────────
  for (let r = 8; r < 40; r++) {
    for (let c = 0; c < 9; c++) {
      map[r][c] = (r + c) % 3 === 0 ? FL : TR;
    }
  }

  // ── Main road (horizontal): row 24, full width ───────────────────────────
  for (let c = 0; c < COLS; c++) map[24][c] = RH;
  // Main road (vertical): col 22
  for (let r = 0; r < ROWS; r++) map[r][22] = RV;
  // Intersection
  map[24][22] = RX;

  // ── Side streets ─────────────────────────────────────────────────────────
  for (let c = 9; c < COLS; c++) map[18][c] = RH;
  for (let c = 9; c < COLS; c++) map[30][c] = RH;
  for (let r = 9;  r < ROWS; r++) map[r][30] = RV;
  for (let r = 9;  r < ROWS; r++) map[r][38] = RV;
  for (let r = 9;  r < ROWS; r++) map[r][46] = RV;
  map[18][22] = RX; map[18][30] = RX; map[18][38] = RX; map[18][46] = RX;
  map[24][30] = RX; map[24][38] = RX; map[24][46] = RX;
  map[30][22] = RX; map[30][30] = RX; map[30][38] = RX; map[30][46] = RX;

  // ── Residential blocks: fill blocks between roads with buildings ──────────
  function fillBlock(r1: number, c1: number, r2: number, c2: number) {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (map[r][c] === G) {
          const isBuilding = (r === r1 || r === r2 || c === c1 || c === c2);
          map[r][c] = isBuilding ? B : RF;
        }
      }
    }
  }

  // Block between rows 19-23, cols 23-29
  fillBlock(19, 23, 23, 29);
  fillBlock(19, 31, 23, 37);
  fillBlock(19, 39, 23, 45);
  fillBlock(19, 47, 23, 55);
  fillBlock(25, 23, 29, 29);
  fillBlock(25, 31, 29, 37);
  fillBlock(25, 39, 29, 45);
  fillBlock(25, 47, 29, 55);
  // Upper residential (rows 9-17)
  fillBlock(9,  23, 17, 29);
  fillBlock(9,  31, 17, 37);
  fillBlock(9,  39, 17, 45);
  fillBlock(9,  47, 17, 55);

  // ── Park area: rows 31-45, cols 9-20 ──────────────────────────────────────
  for (let r = 31; r < 46; r++) {
    for (let c = 9; c < 21; c++) {
      if (map[r][c] === G) {
        map[r][c] = (r + c) % 5 === 0 ? FL : (r + c) % 7 === 0 ? TR : PK;
      }
    }
  }
  // Keep clear yards around BOTH the player's home (door 11,36) and the rival's
  // home (door 17,36) — no trees/foliage blocking the doorways or their sides.
  for (let r = 31; r <= 41; r++) for (let c = 8; c <= 21; c++) { if (map[r][c] === TR || map[r][c] === FL) map[r][c] = PK; }

  // ── Town square / plaza: rows 31-37, cols 23-29 ────────────────────────────
  for (let r = 31; r < 38; r++) {
    for (let c = 23; c < 30; c++) {
      if (map[r][c] === G) map[r][c] = PK;
    }
  }
  // Town hall building center of plaza
  for (let r = 32; r < 36; r++) {
    for (let c = 24; c < 29; c++) {
      map[r][c] = r === 32 || r === 35 || c === 24 || c === 28 ? B : RF;
    }
  }

  // ── Southern grass/meadow rows 46-63 ─────────────────────────────────────
  for (let r = 50; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      map[r][c] = (r + c) % 6 === 0 ? FL : (r + c) % 9 === 0 ? TR : G;
    }
  }

  // ── Eastern mountains: cols 56-63 ────────────────────────────────────────
  for (let r = 0; r < 40; r++) {
    for (let c = 56; c < COLS; c++) {
      map[r][c] = r < 20 ? M : TR;
    }
  }

  // Stamp roads back over anything that got overwritten
  for (let c = 0; c < COLS; c++) { map[24][c] = RH; map[18][c] = RH; map[30][c] = RH; }
  for (let r = 0; r < ROWS; r++) { map[r][22] = RV; map[r][30] = RV; map[r][38] = RV; map[r][46] = RV; }
  [18, 24, 30].forEach(r => [22, 30, 38, 46].forEach(c => { map[r][c] = RX; }));
  map[22][14] = BR; map[22][15] = BR; map[22][16] = BR;

  return map;
}

// ── Tile colors ───────────────────────────────────────────────────────────────
const TILE_COLOR: Record<Tile, number> = {
  [T.GRASS]:    0x6abf4b,
  [T.TREE]:     0x2d7a2d,
  [T.ROAD_H]:   0x888888,
  [T.ROAD_V]:   0x888888,
  [T.ROAD_X]:   0x999999,
  [T.WATER]:    0x3399ff,
  [T.BUILDING]: 0xd4a96a,
  [T.ROOF]:     0xc0392b,
  [T.MOUNTAIN]: 0x8a7a6a,
  [T.FLOWER]:   0xf9d44a,
  [T.SAND]:     0xe8d8a0,
  [T.BRIDGE]:   0xa07840,
  [T.SIGN]:     0xffffff,
  [T.PARK]:     0x90d060,
};

const SOLID: Set<Tile> = new Set([T.TREE, T.BUILDING, T.ROOF, T.MOUNTAIN, T.WATER]);

// ── Special buildings ─────────────────────────────────────────────────────────
interface BuildingDef {
  id: string; label: string; scene: string;
  col: number; row: number; w: number; h: number;
  doorCol: number; doorRow: number;
  wallColor: number; roofColor: number; accentColor: number;
}
const BUILDINGS: BuildingDef[] = [
  { id: 'home',   label: "Your Home",        scene: 'PlayerHomeScene',
    col: 10, row: 32, w: 4, h: 4, doorCol: 11, doorRow: 36,
    wallColor: 0xf5deb3, roofColor: 0xcc4444, accentColor: 0xeecc88 },
  { id: 'pokecenter', label: 'Pokémon Center', scene: 'PokemonCenterScene',
    col: 23, row: 10, w: 6, h: 7, doorCol: 25, doorRow: 17,
    wallColor: 0xffffff, roofColor: 0xcc2244, accentColor: 0xaaccff },
  { id: 'rival',  label: "Minhyuk's House",  scene: 'RivalHomeScene',
    col: 16, row: 32, w: 4, h: 4, doorCol: 17, doorRow: 36,
    wallColor: 0xb0c4de, roofColor: 0x334466, accentColor: 0x8899bb },
  { id: 'lab',    label: "Prof. Song's Lab",  scene: 'PokemonLabScene',
    col: 31, row: 10, w: 6, h: 7, doorCol: 33, doorRow: 17,
    wallColor: 0xeeeeff, roofColor: 0x2255aa, accentColor: 0xaaddff },
];

export class WorldMapScene extends Phaser.Scene {
  private playerSprite!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
  private interactKey!: Phaser.Input.Keyboard.Key;
  private map!: Tile[][];
  /** Authoritative building footprints (+ their 3D model id) for the 3D engine:
   *  the overworld mirror places the named GLB on each exact plot. */
  buildingPlots!: { x: number; y: number; w: number; h: number; model: string }[];
  /** Only the named landmark buildings rise in 3D (no generic filler boxes). */
  onlyNamedBuildings = true;
  /** The painted forest/boundary trees grow as real 3D trees, not flat ground art. */
  treeTileIds3D = [T.TREE];
  /** Waterfall City's streets get the same 3D treatment as the capital: paved
   *  carriageways with centre lines and crossings at every painted intersection.
   *  Its lanes are a single tile wide with authored ROAD_X junction tiles, and
   *  it has no pavement tile — so grass/sand/park beside a road becomes a verge
   *  that carries lamps, benches and shop signs without a raised kerb. */
  cityTiles3D = {
    road: [T.ROAD_H, T.ROAD_V, T.ROAD_X] as number[],
    sidewalk: [] as number[],
    bridge: [T.BRIDGE] as number[],
    junction: [T.ROAD_X] as number[],
    verge: [T.GRASS, T.SAND, T.PARK, T.FLOWER] as number[],
    water: [T.WATER] as number[],
    // A waterfall resort, not a metropolis: cobbled lanes with no traffic paint,
    // wooden lanterns, flower beds and planted riverbanks.
    style: 'scenic' as const,
  };
  /** The city's namesake waterfall at the head of the river (col 15) as a 3D
   *  cascading water curtain. */
  propPlots = [{ x: 15, y: 6, kind: 'waterfall' as const, len: 3 }];
  /** Vehicles pinned to an exact tile for the 3D engine (the Songhyeon bus). */
  vehiclePlots!: { x: number; y: number; model: string; rot?: number }[];
  private mapGraphics!: Phaser.GameObjects.Graphics;
  private enterPrompt!: Phaser.GameObjects.Text;
  private shoesText!: Phaser.GameObjects.Text;
  private cutsceneDialog!: DialogBox;
  private shiftKey!: Phaser.Input.Keyboard.Key;

  private readonly BASE_SPEED = 120;
  private readonly RUN_SPEED  = 260;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private readonly PW = 14;
  private readonly PH = 18;

  private px = 22 * TILE + TILE / 2;
  private py = 24 * TILE + TILE / 2;
  private facing = 0;
  private walkFrame = 0;
  private walkTimer = 0;
  private isMoving = false;
  private cutsceneActive = false;
  private spawnGuard = false;
  private saveToast!: Phaser.GameObjects.Text;

  constructor() { super('WorldMapScene'); }

  create() {

    playBgm(this, 'waterfall');
    // Reset all per-session state
    this.cutsceneActive = false;
    this.isMoving       = false;
    this.walkFrame      = 0;
    this.walkTimer      = 0;

    // Grace period: ignore exit triggers for a moment after spawning so we never
    // bounce straight back through a doorway/route boundary we just entered from.
    this.spawnGuard = true;
    this.time.delayedCall(600, () => { this.spawnGuard = false; });

    // Clear any key states left over from previous scenes (e.g. StarterSelectScene)
    this.input.keyboard?.resetKeys();

    // Restore spawn position
    const rx = this.registry.get('returnX') as number | undefined;
    const ry = this.registry.get('returnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('returnX'); this.registry.remove('returnY');

    this.map = buildMap();

    // Publish the four landmark buildings (home / rival / lab / Pokémon Center)
    // to the 3D engine so each gets its own distinct GLB on its exact footprint,
    // instead of blurring together as generic extruded boxes.
    this.buildingPlots = BUILDINGS.map(b => ({ x: b.col, y: b.row, w: b.w, h: b.h, model: b.id }));
    // Replace the flat painted 2D mountain ranges with real 3D mountain backdrops.
    // Each plot footprint erases the painted mountain art and stops it extruding as
    // blocky walls; the foothill trees just below/beside them stay 3D.
    //  - north edge (rows 0-5, cols 2-55)
    //  - east edge  (rows 0-19, cols 56-63)
    this.buildingPlots.push({ x: 2,  y: 0, w: 54, h: 6,  model: 'mountainrange' });
    this.buildingPlots.push({ x: 56, y: 0, w: 8,  h: 20, model: 'mountainrange' });
    // Only those named landmarks should rise in 3D — the filler residential
    // blocks looked like stray red-brick boxes, so drop them from the 3D view.
    this.onlyNamedBuildings = true;
    // Pin the express bus GLB to its stop (the coach that heads to Songhyeon),
    // once it's unlocked, instead of scattering buses on random roads.
    this.vehiclePlots = this.busUnlocked()
      ? [{ x: this.BUS_COL, y: this.BUS_ROW, model: 'bus', rot: Math.PI / 2 }]
      : [];

    // Safety: never strand the player (e.g. a Fly landing boxed in by the trees
    // on the west side). Find the nearest OPEN tile that also has a walkable exit,
    // not just a solid check — a walkable pocket ringed by trees is still a trap.
    const spawnRow = Math.floor(this.py / TILE);
    const spawnCol = Math.floor(this.px / TILE);
    const isOpen = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS && !SOLID.has(this.map[r][c]);
    const hasExit = (r: number, c: number) => isOpen(r + 1, c) || isOpen(r - 1, c) || isOpen(r, c + 1) || isOpen(r, c - 1);
    if (!isOpen(spawnRow, spawnCol) || !hasExit(spawnRow, spawnCol)) {
      outer:
      for (let rad = 1; rad < 14; rad++) {
        for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
          const r = spawnRow + dr, c = spawnCol + dc;
          if (isOpen(r, c) && hasExit(r, c)) { this.px = c * TILE + TILE / 2; this.py = r * TILE + TILE / 2; break outer; }
        }
      }
    }

    this.drawMap();
    this.drawBuildings();
    this.drawBus();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.addLabels();

    // Trigger any pending evolutions on return from battle
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  // ── Map rendering ─────────────────────────────────────────────────────────
  private drawMap() {
    // Bake to a static texture (one draw call/frame instead of thousands)
    const g = this.make.graphics({ x: 0, y: 0 });
    this.mapGraphics = g as unknown as Phaser.GameObjects.Graphics; // keep ref for helper methods

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = this.map[r][c];
        g.fillStyle(TILE_COLOR[tile], 1);
        g.fillRect(c * TILE, r * TILE, TILE, TILE);
        if (tile === T.TREE)    this.drawTree(c * TILE + TILE / 2, r * TILE + TILE / 2);
        if (tile === T.MOUNTAIN) this.drawMountain(c * TILE, r * TILE);
        if (tile === T.ROAD_H || tile === T.ROAD_V) this.drawRoadLine(c * TILE, r * TILE, tile);
        if (tile === T.WATER)   this.drawWaterShimmer(c * TILE, r * TILE, c, r);
      }
    }

    const texKey = '__worldMapBaked__';
    if (this.textures.exists(texKey)) this.textures.remove(texKey);
    g.generateTexture(texKey, COLS * TILE, ROWS * TILE);
    g.destroy();
    this.add.image(0, 0, texKey).setOrigin(0, 0).setDepth(0);
  }

  private drawTree(x: number, y: number) {
    this.mapGraphics.fillStyle(0x1a5c1a, 1);
    this.mapGraphics.fillTriangle(x, y - 12, x - 9, y + 6, x + 9, y + 6);
    this.mapGraphics.fillStyle(0x4a3020, 1);
    this.mapGraphics.fillRect(x - 3, y + 6, 6, 6);
  }

  private drawMountain(x: number, y: number) {
    this.mapGraphics.fillStyle(0x6a6060, 1);
    this.mapGraphics.fillTriangle(x + TILE / 2, y + 2, x + 2, y + TILE - 2, x + TILE - 2, y + TILE - 2);
    this.mapGraphics.fillStyle(0xffffff, 0.7);
    this.mapGraphics.fillTriangle(x + TILE / 2, y + 2, x + TILE / 2 - 5, y + 10, x + TILE / 2 + 5, y + 10);
  }

  private drawRoadLine(x: number, y: number, tile: Tile) {
    this.mapGraphics.fillStyle(0xeeee55, 1);
    if (tile === T.ROAD_H) this.mapGraphics.fillRect(x, y + TILE / 2 - 1, TILE, 2);
    else this.mapGraphics.fillRect(x + TILE / 2 - 1, y, 2, TILE);
  }

  private drawWaterShimmer(x: number, y: number, c: number, r: number) {
    this.mapGraphics.fillStyle(0x66bbff, 0.5);
    const offset = (c + r) % 3;
    this.mapGraphics.fillRect(x + offset * 6, y + 4, 10, 3);
    this.mapGraphics.fillRect(x + offset * 4 + 4, y + 14, 8, 3);
    this.mapGraphics.fillRect(x + offset * 5 + 2, y + 22, 12, 3);
  }

  // ── Player ────────────────────────────────────────────────────────────────
  private createPlayer() {
    this.playerSprite = this.add.graphics();
    this.playerSprite.setDepth(20);
    this.drawCharacter();
  }

  private drawCharacter() {
    (this.cycling ? drawRiderBody : drawTrainerBody)(this.playerSprite, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerSprite.setPosition(this.px, this.py);
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  private setupCamera() {
    const worldW = COLS * TILE;
    const worldH = ROWS * TILE;

    // Main world camera: follows player, zoomed in
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.startFollow(this.playerSprite, true, 0.08, 0.08);

  }

  // ── Special buildings ─────────────────────────────────────────────────────
  private drawBuildings() {
    const g = this.add.graphics().setDepth(3);

    for (const b of BUILDINGS) {
      const x = b.col * TILE, y = b.row * TILE;
      const w = b.w * TILE,   h = b.h * TILE;

      // Wall
      g.fillStyle(b.wallColor, 1); g.fillRect(x, y, w, h);
      g.lineStyle(2, 0x333333, 1); g.strokeRect(x, y, w, h);

      // Roof (triangle)
      g.fillStyle(b.roofColor, 1);
      g.fillTriangle(x - 4, y, x + w / 2, y - TILE * 1.5, x + w + 4, y);

      // Windows
      g.fillStyle(b.accentColor, 1);
      g.fillRect(x + 4, y + 6, 18, 14);
      g.fillRect(x + w - 22, y + 6, 18, 14);
      g.lineStyle(1, 0xffffff, 0.8);
      g.strokeRect(x + 4, y + 6, 18, 14);
      g.strokeRect(x + w - 22, y + 6, 18, 14);
      // Window cross
      g.lineBetween(x + 13, y + 6, x + 13, y + 20);
      g.lineBetween(x + 4, y + 13, x + 22, y + 13);
      g.lineBetween(x + w - 13, y + 6, x + w - 13, y + 20);
      g.lineBetween(x + w - 22, y + 13, x + w - 4, y + 13);

      // Door
      const dx = b.doorCol * TILE, dy = (b.row + b.h - 1) * TILE;
      g.fillStyle(0x8b4513, 1); g.fillRect(dx + 4, dy, TILE - 8, TILE);
      g.fillStyle(0xddaa44, 1); g.fillCircle(dx + TILE - 10, dy + TILE / 2, 3);

      // Door step
      g.fillStyle(0xaaaaaa, 1); g.fillRect(dx, dy + TILE - 4, TILE, 8);
    }

    // Labels
    for (const b of BUILDINGS) {
      this.add.text(
        (b.col + b.w / 2) * TILE,
        (b.row - 2) * TILE,
        this.buildingLabel(b),
        { fontSize: '9px', color: '#ffffff', backgroundColor: '#00000099', padding: { x: 4, y: 2 } }
      ).setOrigin(0.5, 1).setDepth(4);
    }

    // Enter prompt (fixed to camera)
    this.enterPrompt = this.add.text(400, 460, '', {
      fontSize: '14px', color: '#ffe44e', backgroundColor: '#00000099',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.shiftKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    // C hops on/off the bike (once obtained) — same control as the routes/cities.
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => {
      if (!this.cutsceneActive && hasBike(this.registry)) { this.cycling = !this.cycling; this.drawCharacter(); }
    });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => {
      if (!this.cutsceneActive) this.scene.launch('MenuScene');
    });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => {
      if (!this.cutsceneActive) this.scene.launch('MenuScene');
    });
    this.input.keyboard!.on('keydown-F5', (e: KeyboardEvent) => {
      e.preventDefault();
      this.saveGame();
    });
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  private createUI() {
    // Controls hint
    this.add.text(8, 480, tr('WASD/Arrows  |  SPACE: enter  |  SHIFT: run  |  M: menu'), {
      fontSize: '11px', color: '#cccccc', backgroundColor: '#00000099', padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(100);

    // Running shoes indicator
    this.shoesText = this.add.text(8, 456, tr('👟 RUNNING'), {
      fontSize: '12px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(100).setVisible(false);

    // Cutscene dialog (same DialogBox, lives on overworld)
    this.cutsceneDialog = new DialogBox(this, 1280, 720);

    // Save toast notification
    this.saveToast = this.add.text(400, 440, tr('💾  Game Saved'), {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

    // Auto-save every 60 seconds
    this.time.addEvent({
      delay: 60_000,
      loop: true,
      callback: () => this.saveGame(),
    });
  }

  private addLabels() {
    const label = (text: string, col: number, row: number) =>
      this.add.text(col * TILE + TILE / 2, row * TILE + TILE / 2, tr(text), {
        fontSize: '8px', color: '#000', backgroundColor: '#ffffffaa',
        padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(5);

    label('폭포시티\nWaterfall City', 36, 20);
    label('Town Hall', 26, 33);
    label('Central Park', 15, 38);
    label('Waterfall', 15, 10);
    label('Mt. Bukhan\n북한산', 45, 3);
    label('Forest Path', 4, 25);
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(_: number, delta: number) {
    // During cutscene handle only dialog input
    if (this.cutsceneActive) {
      if (this.cutsceneDialog.isInChoice()) {
        // Navigate choices with the D-pad (up/down); confirm with A — never the B button.
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)   || Phaser.Input.Keyboard.JustDown(this.wasd.up))   this.cutsceneDialog.navigateChoice(-1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.down)) this.cutsceneDialog.navigateChoice(1);
        if (Phaser.Input.Keyboard.JustDown(this.interactKey)) this.cutsceneDialog.confirmChoice();
      } else if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.cutsceneDialog.advance();
      }
      return;
    }

    const dt = delta / 1000;
    let dx = 0, dy = 0;

    if (this.cursors.left.isDown  || this.wasd.left.isDown)  { dx = -1; this.facing = 2; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { dx =  1; this.facing = 3; }
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    { dy = -1; this.facing = 1; }
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  { dy =  1; this.facing = 0; }

    this.isMoving = dx !== 0 || dy !== 0;

    const hasShoes = !!this.registry.get('hasRunningShoes');
    const running  = hasShoes && this.shiftKey.isDown && this.isMoving;
    const speed    = this.cycling ? BIKE_SPEED : (running ? this.RUN_SPEED : this.BASE_SPEED);
    this.shoesText.setVisible(running);

    if (this.isMoving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len; dy /= len;

      const nx = this.px + dx * speed * dt;
      const ny = this.py + dy * speed * dt;
      if (!this.collidesAt(nx, this.py)) this.px = nx;
      if (!this.collidesAt(this.px, ny)) this.py = ny;

      this.walkTimer += delta;
      if (this.walkTimer > (running ? 100 : 180)) {
        this.walkFrame = this.walkFrame === 0 ? 1 : 0;
        this.walkTimer = 0;
      }
    } else {
      this.walkFrame = 0;
      this.walkTimer = 0;
    }

    this.drawCharacter();
    this.checkBuildingDoors();
    this.checkBus();
    this.checkTownExit();
  }

  // ── Northern express bus → Songhyeon (송현) ──────────────────────────────────
  // Once Phase 1 is done and the North has opened up (the envoy's invitation, or the
  // Onnuri Champion beaten), an inter-regional coach runs from Waterfall City
  // straight to Songhyeon, the first of the eight 어사대 provinces — so the player can
  // return to the northern circuit from the home hub without retracing the whole way.
  private busUnlocked() {
    return !!(this.registry.get('northInviteSeen') || this.registry.get('championDefeated') || this.registry.get('northLeagueDone'));
  }
  private readonly BUS_COL = 26;   // on the main east–west road
  private readonly BUS_ROW = 24;

  private drawBus() {
    if (!this.busUnlocked()) return;
    const x = this.BUS_COL * 32, y = this.BUS_ROW * 32;
    const g = this.add.graphics().setDepth(6);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(x + 30, y + 26, 60, 12);
    g.fillStyle(0xf2c14e); g.fillRoundedRect(x, y - 4, 60, 26, 5);
    g.fillStyle(0xcc3322); g.fillRect(x, y - 4, 60, 5);
    g.fillStyle(0x99e0ff); for (let i = 0; i < 4; i++) g.fillRect(x + 6 + i * 13, y + 3, 9, 8);
    g.fillStyle(0x222222); g.fillCircle(x + 14, y + 24, 5); g.fillCircle(x + 46, y + 24, 5);
    // Bus-stop sign
    g.fillStyle(0x3a3f52); g.fillRect(x - 16, y - 2, 3, 26);
    g.fillStyle(0x2a6ab0); g.fillRoundedRect(x - 26, y - 8, 22, 12, 2);
    this.add.text(x - 15, y - 2, '🚏', { fontSize: '11px' }).setOrigin(0.5);
    this.add.text(x + 30, y - 14, tr('🚌 Bus → Songhyeon 송현'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(7);
  }

  private checkBus() {
    if (!this.busUnlocked()) return;
    const bx = this.BUS_COL * 32 + 30, by = this.BUS_ROW * 32 + 12;
    if (Math.hypot(this.px - bx, this.py - by) > 32 * 1.8) return;
    this.enterPrompt.setText(tr('SPACE — 🚌 Express Bus to Songhyeon (송현)')).setVisible(true);
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.enterPrompt.setVisible(false);
      this.cutsceneActive = true;
      this.cutsceneDialog.show([
        '🚌 The northern express coach idles at the stop, engine rumbling.',
        'Driver: Non-stop to Songhyeon — first of the eight 어사대 provinces, up across the old border. Riding with me?',
      ], () => {
        this.cutsceneDialog.showChoice(
          () => this.rideBusToKaesong(),
          () => { this.cutsceneActive = false; },
        );
      });
    }
  }

  private rideBusToKaesong() {
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.graphics();
    g.fillStyle(0x0b1020, 1); g.fillRect(0, 0, W, H);
    g.fillStyle(0x141b30, 1); g.fillRect(0, H * 0.6, W, H * 0.4);
    g.fillStyle(0x1c2036, 1);
    g.fillTriangle(W * 0.10, H * 0.74, W * 0.30, H * 0.34, W * 0.52, H * 0.74);
    g.fillTriangle(W * 0.45, H * 0.74, W * 0.70, H * 0.28, W * 0.94, H * 0.74);
    g.fillStyle(0x3a3f52, 1); g.fillRect(0, H * 0.8, W, 6);   // highway
    const bus = this.add.graphics();
    bus.fillStyle(0xf2c14e); bus.fillRoundedRect(0, -20, 160, 38, 7);
    bus.fillStyle(0xcc3322); bus.fillRect(0, -20, 160, 6);
    bus.fillStyle(0x99e0ff); for (let i = 0; i < 6; i++) bus.fillRect(10 + i * 24, -10, 16, 13);
    bus.fillStyle(0x222222); bus.fillCircle(34, 18, 8); bus.fillCircle(126, 18, 8);
    bus.setPosition(-200, H * 0.8 - 6);
    this.tweens.add({ targets: bus, x: W + 240, duration: 3000, ease: 'Sine.easeIn' });
    const cap = this.add.text(W / 2, H * 0.14, tr('🚌  The express coach rolls north across the old border to Songhyeon…'), {
      fontSize: '15px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 5, align: 'center', wordWrap: { width: W * 0.8 },
    }).setOrigin(0.5);
    const root = this.add.container(0, 0, [g, bus, cap]).setScrollFactor(0).setDepth(200);
    const zoom = this.cameras.main?.zoom ?? 1, s = 1 / zoom;
    root.setScale(s); root.setPosition((W / 2) * (1 - s), (H / 2) * (1 - s));
    this.time.delayedCall(3200, () => {
      this.cameras.main.fadeOut(700, 0, 0, 0, () => {
        this.registry.set('kaesongReturnX', 17 * 32 + 16);
        this.registry.set('kaesongReturnY', 21 * 32 + 16);
        this.scene.start('KaesongCityScene');
      });
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  saveGame() {
    SaveManager.save(this.registry, this.px, this.py);
    this.tweens.add({
      targets: this.saveToast,
      alpha: { from: 0, to: 1 },
      duration: 300, yoyo: true, hold: 1200,
      onComplete: () => this.saveToast.setAlpha(0),
    });
  }

  private checkBuildingDoors() {
    let near: BuildingDef | null = null;
    for (const b of BUILDINGS) {
      const doorX = b.doorCol * TILE + TILE / 2;
      const doorY = b.doorRow * TILE + TILE / 2;
      if (Math.hypot(this.px - doorX, this.py - doorY) < TILE * 1.4) {
        near = b; break;
      }
    }

    if (near) {
      const lbl = this.buildingLabel(near);
      this.enterPrompt.setText(t(`SPACE — Enter ${lbl}`, `SPACE — ${lbl} 입장`)).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.registry.set('returnX', near.doorCol * TILE + TILE / 2);
        this.registry.set('returnY', (near.doorRow + 1) * TILE + TILE / 2);
        if (near.scene === 'PokemonCenterScene') this.registry.set('pcReturnScene', 'WorldMapScene');
        SaveManager.save(this.registry, this.px, this.py);
        this.cameras.main.fadeOut(400, 0, 0, 0, () => {
          this.scene.start(near!.scene);
        });
      }
    } else {
      this.enterPrompt.setVisible(false);
    }
  }

  private collidesAt(x: number, y: number): boolean {
    const half = this.PW / 2 - 2;
    const corners = [
      [x - half, y - 4], [x + half, y - 4],
      [x - half, y + 8], [x + half, y + 8],
    ];
    return corners.some(([cx, cy]) => {
      const col = Math.floor(cx / TILE);
      const row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      return SOLID.has(this.map[row][col]);
    });
  }

  // ── Town exit / rival cutscene ────────────────────────────────────────────
  private checkTownExit() {
    if (this.spawnGuard) return;   // don't trigger on the spawn frame
    const row = Math.floor(this.py / TILE);
    const rivalDone     = !!this.registry.get('rivalBattleDone');
    const starterChosen = !!this.registry.get('starterChosen');

    // First exit attempt → rival battle
    if (!rivalDone && starterChosen && row >= 46) {
      this.triggerRivalCutscene();
      return;
    }

    // After rival battle → enter Route 1 at its north end (clear of the north edge,
    // so we don't immediately bounce back to Waterfall City).
    if (rivalDone && row >= 56 && !this.cutsceneActive) {
      this.cutsceneActive = true;  // prevent multi-frame retrigger
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('routeReturnX', 13 * 32 + 16);
        this.registry.set('routeReturnY', 4 * 32 + 16);
        this.scene.start('RouteScene');
      });
    }
  }

  private triggerRivalCutscene() {
    this.cutsceneActive = true;

    // The rival runs in from the right. The whole challenge — dialogue and all — now plays
    // out HERE in the overworld; only when it ends do we cut to the battle window.
    const rival = this.add.graphics().setDepth(25);
    rival.setPosition(this.px + 320, this.py);
    this.drawMinhyukSprite(rival);
    markRivalPortrait(rival, this.registry);
    const nameTag = this.add.text(this.px + 320, this.py - 30, rivalTrainerName(this.registry), {
      fontSize: '10px', color: '#ffe44e', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(26);

    this.tweens.add({
      targets: [rival, nameTag],
      x: this.px + 64,
      duration: 600,
      ease: 'Power2',
      onComplete: () => {
        const rivalName  = rivalTrainerName(this.registry);
        const pName      = playerTrainerName(this.registry);
        const starterKey = (this.registry.get('starterKey') as string) ?? 'vipour';
        const rivalKey   = (this.registry.get('rivalKey')   as string) ?? 'onnurian';
        const sName = findForm(starterKey)?.data.name ?? 'that Pokémon';
        const rName = findForm(rivalKey)?.data.name ?? 'my partner';
        this.cutsceneDialog.show([
          `${rivalName}: Hey, ${pName}! Stop right there.`,
          `${rivalName}: You think you can just leave town with ${sName}?`,
          `${rivalName}: I chose ${rName}.\nWe have both been waiting for this.`,
          `${rivalName}: We battle. Right here, right now!`,
        ], () => {
          // Dialogue over → switch to the battle window (RivalBattleScene skips its own intro).
          this.registry.set('rivalIntroSeen', true);
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('RivalBattleScene'));
        });
      },
    });
  }

  private drawMinhyukSprite(g: Phaser.GameObjects.Graphics) {
    // The rival — opposite gender to the player — runs in facing left.
    drawTrainerBody(g, 2, 0, rivalDesign(this.registry));
    // Name-tag backdrop (the label text is added + tweened by the caller so it follows).
    g.fillStyle(0x000000, 0.7); g.fillRoundedRect(-20, -36, 40, 12, 3);
  }

  /** A building's display label — the rival's house is named after the (gender-based) rival. */
  private buildingLabel(b: BuildingDef): string {
    return b.id === 'rival' ? `${rivalTrainerName(this.registry)}${t("'s House", '네 집')}` : tr(b.label);
  }
}
