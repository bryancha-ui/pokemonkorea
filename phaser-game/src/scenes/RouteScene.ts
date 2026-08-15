import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { vanishesAfterDefeat } from '../data/Villains';
import { drawTrainerBody, drawRiderBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import {
  OUTDOOR_ENCOUNTERS, CAVE_ENCOUNTERS,
  pickEncounter, randomLevel,
} from '../data/CustomPokemon';
import { prefetchPokemon } from '../data/PokeAPI';

// ── Tile types ────────────────────────────────────────────────────────────────
const RT = {
  MOUNTAIN:   0,
  PATH:       1,
  TALL_GRASS: 2,
  ROCK:       3,
  CAVE_PATH:  4,
  CAVE_WALL:  5,
  WATER:      6,
  TREE:       7,
  FLOWERS:    8,
  GATE:       9,
} as const;
type RTile = typeof RT[keyof typeof RT];

const TILE = 32;
const RCOLS = 26;
const RROWS = 80;

const SOLID_R: Set<RTile> = new Set([RT.MOUNTAIN, RT.ROCK, RT.CAVE_WALL, RT.WATER, RT.TREE]);
const ENCOUNTER_R: Set<RTile> = new Set([RT.TALL_GRASS, RT.CAVE_PATH]);

const RTILE_COLOR: Record<RTile, number> = {
  [RT.MOUNTAIN]:   0x7a6a5a,
  [RT.PATH]:       0xc8b490,
  [RT.TALL_GRASS]: 0x3a9a2a,
  [RT.ROCK]:       0x8a7a6a,
  [RT.CAVE_PATH]:  0x4a4040,
  [RT.CAVE_WALL]:  0x222020,
  [RT.WATER]:      0x3399ff,
  [RT.TREE]:       0x2a6a1a,
  [RT.FLOWERS]:    0xddaa44,
  [RT.GATE]:       0xddcc88,
};

// ── Map builder ───────────────────────────────────────────────────────────────

function buildRouteMap(): RTile[][] {
  const M = RT.MOUNTAIN, P = RT.PATH, G = RT.TALL_GRASS,
        R = RT.ROCK, CP = RT.CAVE_PATH, CW = RT.CAVE_WALL,
        T = RT.TREE, F = RT.FLOWERS, GA = RT.GATE;

  const map: RTile[][] = Array.from({ length: RROWS }, () =>
    Array(RCOLS).fill(M) as RTile[],
  );

  // Helper: carve a horizontal strip
  const fill = (r1: number, r2: number, c1: number, c2: number, tile: RTile) => {
    for (let r = r1; r < r2; r++)
      for (let c = Math.max(0, c1); c < Math.min(RCOLS, c2); c++)
        map[r][c] = tile;
  };

  // ── SECTION 1: Entry from Waterfall City (rows 0-7) ──────────────────────
  fill(0, 7, 10, 16, P);
  fill(0, 7, 8,  10, G);
  fill(0, 7, 16, 18, G);

  // ── SECTION 2: Foothills with tall grass (rows 7-20) ─────────────────────
  fill(7,  14, 10, 16, P);
  fill(7,  14, 7,  10, G);
  fill(7,  14, 16, 19, G);
  fill(7,  14, 5,  7,  T);
  fill(7,  14, 19, 21, T);
  // Flowers
  fill(9,  11, 7, 10, F);
  fill(11, 13, 17, 20, F);

  // ── Disguijar Nest (rows 9-14, dense tall grass) ─────────────────────────
  // Extra wide grass patch so players notice it and walk in
  fill(9, 14, 5, 7,  G);  // left side nest
  fill(9, 14, 3, 5,  G);  // even further left
  fill(9, 14, 19, 22, G); // right side nest
  fill(9, 14, 22, 24, G); // even further right

  // ── SECTION 3: Path curves left (rows 20-30) ─────────────────────────────
  fill(14, 20, 7, 13, P);
  fill(14, 20, 5, 7,  G);
  fill(14, 20, 13, 15, G);
  // Rocky walls start appearing
  fill(17, 20, 3, 5, R);
  fill(17, 20, 15, 18, R);

  // ── SECTION 4: Narrow rocky mountain pass (rows 20-35) ───────────────────
  fill(20, 30, 8, 13, P);
  fill(20, 30, 6, 8,  G);
  fill(20, 30, 13, 15, G);
  fill(20, 30, 3, 6,  R);
  fill(20, 30, 15, 19, R);

  // Zigzag: path shifts right
  fill(28, 35, 12, 18, P);
  fill(28, 35, 10, 12, G);
  fill(28, 35, 18, 20, G);
  fill(28, 35, 7, 10, R);
  fill(28, 35, 20, 23, R);

  // ── SECTION 5: Cave entrance area (rows 35-37) ────────────────────────────
  fill(35, 37, 10, 20, P);
  // Cave mouth visual (wider)
  fill(36, 37, 8, 22, P);

  // ── SECTION 6: Cave interior (rows 37-56) ────────────────────────────────
  // Winding cave passage
  fill(37, 44, 10, 16, CP);   // left passage
  fill(37, 44, 9, 10,  CW);
  fill(37, 44, 16, 17, CW);

  fill(43, 50, 12, 18, CP);   // shifts right
  fill(43, 50, 11, 12, CW);
  fill(43, 50, 18, 19, CW);

  fill(49, 56, 9, 15, CP);    // shifts left again
  fill(49, 56, 8, 9,  CW);
  fill(49, 56, 15, 16, CW);

  // Hiker Minsu's rest alcove. His authored position (11,44) used to be a
  // CAVE_WALL cell, so the tall black 3D wall rose through and trapped him.
  // Carve a shallow room that opens directly onto the c12 main passage.
  fill(43, 47, 10, 13, CP);

  // Enclose the cave: every tile still left as open MOUNTAIN inside the cave rows
  // becomes CAVE_WALL, so the 3D engine renders low cave rock here (via
  // caveFloorHint) instead of growing 3D mountain peaks INSIDE the cave. The
  // outdoor mountains (the cave mouth above, and the second stretch below) stay 3D.
  for (let r = 37; r < 56; r++) for (let c = 0; c < RCOLS; c++) if (map[r][c] === M) map[r][c] = CW;

  // ── SECTION 7: Cave exit to valley (rows 56-62) ───────────────────────────
  fill(55, 57, 8, 20, P);  // cave exit widens
  fill(56, 62, 8, 14, P);
  fill(56, 62, 6, 8,  G);
  fill(56, 62, 14, 17, G);
  fill(59, 62, 5, 7, T);
  fill(59, 62, 17, 20, T);

  // ── SECTION 8: Second mountain stretch (rows 62-70) ──────────────────────
  fill(62, 68, 6, 12, P);
  fill(62, 68, 4, 6,  G);
  fill(62, 68, 12, 14, G);
  fill(62, 68, 2, 4,  R);
  fill(62, 68, 14, 17, R);

  // Path back to center
  fill(67, 74, 10, 17, P);
  fill(67, 74, 8, 10,  G);
  fill(67, 74, 17, 19, G);

  // ── SECTION 9: Seoul gate approach (rows 74-80) ───────────────────────────
  fill(74, 79, 9, 17, P);
  fill(79, 80, 9, 17, GA);

  // Scatter some rocks for detail
  const rockPos = [[15,12],[16,20],[22,3],[24,21],[32,7],[33,20],[40,7],[42,18],[60,3],[65,19]];
  for (const [r,c] of rockPos) if (map[r][c] === M) map[r][c] = R;

  void T; void F; void GA;
  return map;
}

// ── Route Scene ───────────────────────────────────────────────────────────────

export class RouteScene extends Phaser.Scene {
  public grassTileIds3D = [RT.TALL_GRASS];
  private map!: RTile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;

  private px = 13 * TILE + 16;
  private py = 2  * TILE + 16;
  private facing = 0;
  private walkFrame = 0;
  private walkTimer = 0;
  private isMoving = false;

  private readonly SPEED = 110;
  private readonly RUN_SPEED = 230;

  private stepsSinceEncounter = 0;
  private nextEncounterAt = 12;
  private inCave = false;
  /** Tell the 3D engine this route has a dark cave section whose floor must stay
   *  walkable ground (not extrude into walls that bury the player). */
  caveFloorHint = true;
  /** The whole route is a path carved through mountain. Auto-cover EVERY painted
   *  mountain tile (outdoor stretch AND the mountains around the cave) with 3D
   *  mountain-range models, and erase the flat 2D mountain art from the floor. */
  mountainTileIds3D = [RT.MOUNTAIN];
  onlyNamedBuildings = true;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // edge exits fire once you've stepped away from spawn

  private dialog!: DialogBox;
  private locationText!: Phaser.GameObjects.Text;
  private pokeballText!: Phaser.GameObjects.Text;
  private saveToast!: Phaser.GameObjects.Text;

  constructor() { super('RouteScene'); }

  preload() {
    if (!this.textures.exists('disguijar'))
      this.load.image('disguijar', 'assets/disguijar.png');
  }

  create() {

    playBgm(this, 'route1');
    // Reset per-session state
    this.cutsceneActive       = false;
    this.isMoving             = false;
    this.walkFrame            = 0;
    this.walkTimer            = 0;
    this.stepsSinceEncounter  = 0;
    // Grace period so we never bounce straight back out the edge we entered from.
    this.spawnGuard = true;
    this.time.delayedCall(600, () => { this.spawnGuard = false; });
    this.input.keyboard?.resetKeys();

    const rx = this.registry.get('routeReturnX') as number | undefined;
    const ry = this.registry.get('routeReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('routeReturnX');
    this.registry.remove('routeReturnY');
    this.spawnPx = this.px; this.spawnPy = this.py;

    this.map = buildRouteMap();
    this.drawMap();
    this.createPlayer();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [RT.WATER], solidTiles: SOLID_R,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.drawTrainers();
    this.cameras.main.fadeIn(400);
    this.warmBattleData();   // background-fetch this route's dex Pokémon so the first battle is instant

    // Kisun cutscene on first visit
    const kisunDone = !!this.registry.get('kisunDone');
    if (!kisunDone) {
      this.time.delayedCall(600, () => this.triggerKisun());
    } else {
      // Otherwise, trigger any pending evolutions on return from battle
      this.time.delayedCall(300, () => maybeLaunchEvolution(this));
    }
  }

  // ── Map drawing ───────────────────────────────────────────────────────────

  private drawMap() {
    // ── Bake the entire map into one static texture ───────────────────────
    // Graphics that are added to the scene replay ALL draw commands every frame.
    // With 80×26 tiles this is ~thousands of commands/frame → lag.
    // `make.graphics({add:false})` creates an off-screen scratch buffer,
    // `generateTexture` renders it once to a GPU texture, then we display
    // that single image — one draw call per frame instead of thousands.

    const W = RCOLS * TILE;
    const H = RROWS * TILE;
    const g = this.make.graphics({ x: 0, y: 0 });

    for (let r = 0; r < RROWS; r++) {
      for (let c = 0; c < RCOLS; c++) {
        const tile = this.map[r][c];
        g.fillStyle(RTILE_COLOR[tile], 1);
        g.fillRect(c * TILE, r * TILE, TILE, TILE);

        if (tile === RT.TREE)       this.drawTree(g, c * TILE + 16, r * TILE + 16);
        if (tile === RT.TALL_GRASS) this.drawGrass(g, c * TILE, r * TILE);
        if (tile === RT.ROCK || tile === RT.MOUNTAIN) this.drawRock(g, c * TILE, r * TILE, tile);
        if (tile === RT.CAVE_WALL)  this.drawCaveWall(g, c * TILE, r * TILE);
        if (tile === RT.GATE)       this.drawGate(g, c * TILE, r * TILE);
        if (tile === RT.FLOWERS)    this.drawFlowers(g, c * TILE, r * TILE);
      }
    }

    // Cave darkness (baked into the same texture)
    for (let r = 36; r < 57; r++) {
      for (let c = 0; c < RCOLS; c++) {
        const tile = this.map[r][c];
        if (tile === RT.CAVE_PATH || tile === RT.CAVE_WALL) {
          // Kept light enough that the 3D pass still reads the cave FLOOR as
          // walkable ground (composited lightness stays above the cave-floor
          // threshold) rather than extruding it into player-burying walls.
          g.fillStyle(0x000000, 0.22);
          g.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
      }
    }

    // Render once → destroy scratch buffer → display static image
    const texKey = '__routeMapBaked__';
    if (this.textures.exists(texKey)) this.textures.remove(texKey);
    g.generateTexture(texKey, W, H);
    g.destroy();

    this.add.image(0, 0, texKey).setOrigin(0, 0).setDepth(0);

    // Route labels (text objects are already efficient — one draw call each)
    this.add.text(13 * TILE, 3 * TILE, tr('← Waterfall City'), {
      fontSize: '9px', color: '#444', backgroundColor: '#ffffffaa', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    // Disguijar Nest sign
    this.add.text(13 * TILE, 11 * TILE, tr('🪺 Disguijar Nest'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#2a6a2a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(13 * TILE, 11 * TILE + 14, tr('← walk in the grass to find them'), {
      fontSize: '7px', color: '#aaddaa', backgroundColor: '#00000066', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(13 * TILE, 36 * TILE + 4, tr('⛰ Cave Entrance'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#00000088', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(13 * TILE, 78 * TILE + 4, tr('CAPITOL CITY →'), {
      fontSize: '11px', color: '#ffe44e', backgroundColor: '#000000aa', padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x1a5c1a); g.fillTriangle(x, y - 12, x - 9, y + 6, x + 9, y + 6);
    g.fillStyle(0x4a3020); g.fillRect(x - 3, y + 6, 6, 6);
  }

  private drawGrass(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x2a8a1a, 0.6);
    for (let i = 0; i < 4; i++) {
      g.fillRect(x + 3 + i * 7, y + 18, 2, 10);
      g.fillRect(x + 5 + i * 7, y + 14, 2, 14);
    }
  }

  private drawRock(g: Phaser.GameObjects.Graphics, x: number, y: number, tile: RTile) {
    const col = tile === RT.MOUNTAIN ? 0x6a5a4a : 0x9a8a7a;
    g.fillStyle(col);
    g.fillTriangle(x + 16, y + 4, x + 4, y + 28, x + 28, y + 28);
    g.fillStyle(0xffffff, 0.15);
    g.fillTriangle(x + 16, y + 4, x + 16, y + 14, x + 22, y + 14);
  }

  private drawCaveWall(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x1a1818);
    for (let i = 0; i < 3; i++) {
      g.fillTriangle(x + 2 + i * 10, y + TILE, x + 6 + i * 10, y + 10, x + 10 + i * 10, y + TILE);
    }
  }

  private drawGate(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0xcc9933); g.fillRect(x + 2, y + 4, 4, 28);  // left pillar
    g.fillRect(x + TILE - 6, y + 4, 4, 28);                   // right pillar
    g.fillRect(x + 2, y + 4, TILE - 4, 6);                    // top beam
    g.fillStyle(0xeecc66); g.fillRect(x + 8, y + 10, TILE - 16, 4); // inner
  }

  private drawFlowers(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x6abf4b); g.fillRect(x, y, TILE, TILE);
    const cols = [0xffdd44, 0xff88aa, 0xaaddff];
    for (let i = 0; i < 3; i++) {
      g.fillStyle(cols[i % cols.length]);
      g.fillCircle(x + 6 + i * 10, y + 20, 4);
    }
  }

  // ── Player ────────────────────────────────────────────────────────────────

  private createPlayer() {
    this.playerG = this.add.graphics().setDepth(10);
    this.drawCharacter();
  }

  private drawCharacter() {
    const g = this.playerG;
    // Gender-aware body so the player isn't reset to the default red-shirt sprite.
    (this.cycling ? drawRiderBody : drawTrainerBody)(g, this.facing, this.walkFrame, playerDesign(this.registry));
    g.setPosition(this.px, this.py);
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  private setupCamera() {
    this.cameras.main.setBounds(0, 0, RCOLS * TILE, RROWS * TILE);
    this.cameras.main.setZoom(1.4);   // reduced from 1.8 so scrollFactor(0) UI renders correctly
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
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
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => { if (!this.cutsceneActive && hasBike(this.registry)) { this.cycling = !this.cycling; this.drawCharacter(); } });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => {
      if (!this.cutsceneActive) this.scene.launch('MenuScene');
    });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => {
      if (!this.cutsceneActive) this.scene.launch('MenuScene');
    });
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  private createUI() {
    this.dialog = new DialogBox(this, 1280, 720);

    this.add.rectangle(400, 22, 360, 34, 0x000000, 0.65).setScrollFactor(0).setDepth(50);
    this.locationText = this.add.text(400, 22, tr('🗺 Route 1 — Mountain Pass'), {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

    this.pokeballText = this.add.text(10, 10, '', {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(51);

    this.add.text(400, 490, tr('WASD/Arrows: move  |  SHIFT: run  |  M: menu'), {
      fontSize: '10px', color: '#cccccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);

    this.saveToast = this.add.text(400, 455, tr('💾 Saved'), {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(52).setAlpha(0);

    this.updateUI();
  }

  private updateUI() {
    const balls = (this.registry.get('pokeballs') as number) ?? 0;
    this.pokeballText.setText(`🔴 ×${balls}`);
    const row = Math.floor(this.py / TILE);
    const inCave = row >= 37 && row < 56;
    this.locationText.setText(inCave ? '🕳 Cave Passage' : '🗺 Route 1 — Mountain Pass');
    this.inCave = inCave;
  }

  // ── Kisun cutscene ────────────────────────────────────────────────────────

  private triggerKisun() {
    this.cutsceneActive = true;

    // Draw Kisun (female trainer, orange outfit)
    const kisun = this.add.graphics().setDepth(12);
    kisun.setPosition(13 * TILE + 48, 5 * TILE + 16);
    this.drawKisun(kisun);

    this.add.text(13 * TILE + 48, 5 * TILE - 8, speakerName('Kisun'), {
      fontSize: '9px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(13);

    this.dialog.show([
      'Kisun: Hey! You must be heading to Capitol City for the first time!',
      'Kisun: These mountains are full of wild Pokémon. You will need these!',
      'Kisun: I am giving you 20 Pokéballs. Use them to catch Pokémon on the route!',
      'Kisun: Press A in battle to throw a ball. Good luck, trainer! 🔴',
    ], () => {
      this.registry.set('pokeballs', 20);
      this.registry.set('kisunDone', true);
      this.cutsceneActive = false;
      SaveManager.save(this.registry, this.px, this.py, 'RouteScene');
      this.showSaveToast();
      this.updateUI();
    });
  }

  private drawKisun(g: Phaser.GameObjects.Graphics) {
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 18, 6);
    // Orange outfit
    g.fillStyle(0xdd6611); g.fillRect(-8, -8, 16, 11);
    g.fillStyle(0xdd6611); g.fillRect(-12, -7, 5, 9); g.fillRect(7, -7, 5, 9);
    g.fillStyle(0xeeaa22); g.fillRect(-6, 3, 5, 10); g.fillRect(1, 3, 5, 10);
    g.fillStyle(0x333388); g.fillRect(-8, -8, 5, 22); // skirt left
    g.fillRect(3, -8, 5, 22); // skirt right
    g.fillStyle(0xffcc99); g.fillRect(-7, -22, 14, 12);
    g.fillStyle(0xcc5500); g.fillRect(-7, -22, 14, 4); // orange hair
    g.fillRect(-7, -18, 3, 8); g.fillRect(4, -18, 3, 8); // side locks
    g.fillStyle(0x000000); g.fillRect(-4, -16, 2, 2); g.fillRect(2, -16, 2, 2);
  }

  // ── NPC Trainers ─────────────────────────────────────────────────────────

  private readonly TRAINERS = [
    {
      key:    'bug-catcher',
      name:   'Bug Catcher Billy',
      col:    12, row: 13,
      color:  0x55aa22,
      label:  'Bug\nCatcher',
      pokemon:  JSON.stringify([{ id: 13, level: 5 }, { id: 10, level: 4 }]), // Weedle, Caterpie
      expPool:  120,   // Bug Catcher — 2 Pokémon ~level 4-5
    },
    {
      key:    'hiker',
      name:   'Hiker Minsu',
      col:    11, row: 44,
      color:  0x886644,
      label:  'Hiker',
      pokemon:  JSON.stringify([{ id: 74, level: 7 }, { id: 95, level: 6 }]), // Geodude, Onix
      expPool:  200,   // Hiker — 2 tougher Pokémon ~level 6-7
    },
    {
      key:    'youngster',
      name:   'Youngster Junho',
      col:    9, row: 65,
      color:  0x3355cc,
      label:  'Youngster',
      pokemon:  JSON.stringify([{ id: 19, level: 8 }, { id: 21, level: 8 }]), // Rattata, Spearow
      expPool:  160,   // Youngster — 2 Pokémon ~level 8
    },
  ] as const;

  // Warm the PokeAPI cache for every standard-dex Pokémon on this route — the
  // trainers' teams (e.g. Bug Catcher Billy's Weedle/Caterpie) and the wild
  // tables — so the first battle doesn't stall on a cold network fetch.
  private warmBattleData() {
    const ids = new Set<number>();
    for (const tr of this.TRAINERS) {
      try {
        for (const p of JSON.parse(tr.pokemon) as { id: number; custom?: string }[])
          if (!p.custom && typeof p.id === 'number') ids.add(p.id);
      } catch { /* ignore malformed team */ }
    }
    for (const e of [...OUTDOOR_ENCOUNTERS, ...CAVE_ENCOUNTERS])
      if (!e.isCustom && typeof e.id === 'number') ids.add(e.id);
    prefetchPokemon([...ids]);
  }

  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      const defeated = !!this.registry.get(`trainerDefeated_${tr.key}`);
      if (defeated && vanishesAfterDefeat(tr.key)) continue;

      const wx = tr.col * TILE + 16;
      const wy = tr.row * TILE + 16;

      const g = this.add.graphics().setDepth(8);
      g.setPosition(wx, wy);
      this.drawTrainerSprite(g, tr.color);

      this.add.text(wx, wy - 24, speakerName(tr.label), {
        fontSize: '8px', color: '#fff', backgroundColor: '#00000088',
        padding: { x: 3, y: 2 }, align: 'center',
      }).setOrigin(0.5).setDepth(9);
    }
  }

  private drawTrainerSprite(g: Phaser.GameObjects.Graphics, color: number) {
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(color);         g.fillRect(-7, -8, 14, 11);
    g.fillStyle(color);         g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
    g.fillStyle(0x1a1a6e);      g.fillRect(-6, 3, 5, 9);  g.fillRect(1, 3, 5, 9);
    g.fillStyle(0xffcc99);      g.fillRect(-6, -22, 12, 12);
    g.fillStyle(0x220000);      g.fillRect(-6, -22, 12, 5);
    g.fillStyle(0x000000);      g.fillRect(-3, -16, 2, 2); g.fillRect(1, -16, 2, 2);
  }

  private checkTrainerEncounters() {
    for (const tr of this.TRAINERS) {
      if (!!this.registry.get(`trainerDefeated_${tr.key}`)) continue;

      const wx = tr.col * TILE + 16;
      const wy = tr.row * TILE + 16;
      if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.5) {
        this.cutsceneActive = true;
        this.registry.set('trainerName',        tr.name);
        this.registry.set('trainerKey',         tr.key);
        this.registry.set('trainerPokemon',     tr.pokemon);
        this.registry.set('trainerExpPool',     tr.expPool);
        this.registry.set('trainerReturnScene', 'RouteScene');
        this.registry.set('routeReturnX', this.px);
        this.registry.set('routeReturnY', this.py);

        this.dialog.show([
          `${tr.name}: Hey, I spotted you! You look like a trainer!`,
          `${tr.name}: Let's battle!`,
        ], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => {
            this.scene.start('TrainerBattleScene');
          });
        });
        return;
      }
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(_: number, delta: number) {
    if (this.cutsceneActive) {
      if (this.dialog.isInChoice()) {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up))    this.dialog.navigateChoice(-1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down))  this.dialog.navigateChoice(1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) this.dialog.confirmChoice();
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
        this.dialog.advance();   // advance with A (SPACE), like every other dialogue
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
    const speed    = this.cycling ? BIKE_SPEED : (running ? this.RUN_SPEED : this.SPEED);

    if (this.isMoving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = this.px + (dx / len) * speed * dt;
      const ny = this.py + (dy / len) * speed * dt;
      if (!this.collidesAt(nx, this.py)) this.px = nx;
      if (!this.collidesAt(this.px, ny)) this.py = ny;

      this.walkTimer += delta;
      if (this.walkTimer > (running ? 100 : 180)) {
        this.walkFrame = this.walkFrame === 0 ? 1 : 0;
        this.walkTimer = 0;
        this.stepsSinceEncounter++;
        this.checkEncounter();
      }
    } else {
      this.walkFrame = 0;
      this.walkTimer = 0;
    }

    this.drawCharacter();
    this.updateUI();
    this.checkExits();
    this.checkTrainerEncounters();
  }

  private collidesAt(x: number, y: number): boolean {
    const hw = 6, hh = 5;
    const corners = [
      [x - hw, y - 4], [x + hw, y - 4],
      [x - hw, y + hh], [x + hw, y + hh],
    ];
    return corners.some(([cx, cy]) => {
      const col = Math.floor(cx / TILE);
      const row = Math.floor(cy / TILE);
      if (col < 0 || col >= RCOLS || row < 0 || row >= RROWS) return true;
      return SOLID_R.has(this.map[row][col]);
    });
  }

  // ── Wild encounters ───────────────────────────────────────────────────────

  private checkEncounter() {
    const col = Math.floor(this.px / TILE);
    const row = Math.floor(this.py / TILE);
    const tile = this.map[row]?.[col];
    if (!tile || !ENCOUNTER_R.has(tile)) { this.stepsSinceEncounter = 0; return; }

    const inCave = tile === RT.CAVE_PATH;
    const threshold = this.nextEncounterAt;
    if (this.stepsSinceEncounter < threshold) return;

    // Roll encounter chance: 20% per step after threshold
    if (Math.random() > 0.20) return;

    this.stepsSinceEncounter = 0;
    this.nextEncounterAt = 8 + Math.floor(Math.random() * 8);

    const table = inCave ? CAVE_ENCOUNTERS : OUTDOOR_ENCOUNTERS;
    const entry = pickEncounter(table);
    const level = randomLevel(entry);

    this.registry.set('wildId',       entry.id);
    this.registry.set('wildLevel',    level);
    this.registry.set('wildCustom',   entry.isCustom);
    this.registry.set('wildCatchRate', entry.catchRate);
    this.registry.set('wildReturnScene', 'RouteScene');
    this.registry.set('routeReturnX', this.px);
    this.registry.set('routeReturnY', this.py);

    this.cameras.main.fadeOut(400, 255, 255, 255, () => {
      this.scene.start('WildBattleScene');
    });
  }

  // ── Exit detection ────────────────────────────────────────────────────────

  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;   // already transitioning / just spawned
    // Only exit once the player has stepped away from where they spawned, so arriving
    // near an edge can't bounce you back — yet you can leave in one continuous walk.
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.5 * TILE) return;
    const row = Math.floor(this.py / TILE);

    // North exit → back to Waterfall City.
    if (row < 1) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('returnX', 22 * 32 + 16);
        this.registry.set('returnY', 50 * 32 + 16);
        this.scene.start('WorldMapScene');
      });
    }
    // South exit → Seoul (Capitol).
    else if (row >= RROWS - 1) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(500, 0, 0, 0, () => {
        this.scene.start('SeoulScene');
      });
    }
  }

  private showSaveToast() {
    this.tweens.add({
      targets: this.saveToast, alpha: { from: 0, to: 1 },
      duration: 300, yoyo: true, hold: 1200,
      onComplete: () => this.saveToast.setAlpha(0),
    });
  }
}
