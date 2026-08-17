import Phaser from 'phaser';
import { installSurfing, isSurfing } from '../systems/SurfSystem';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, drawNpcBody, playerDesign, rivalDesign, rivalTrainerName } from '../data/CharacterSprite';
import { markRivalPortrait, markTrainerPortrait } from '../data/BattlePortraits';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { PartySystem } from '../systems/PartySystem';
import { Inventory } from '../systems/Items';
import { migrateLegacyCheonjiCapture } from '../systems/StoryMigrations';

// ── City tile types ────────────────────────────────────────────────────────────
const C = {
  ROAD:      0, SIDEWALK:  1, BUILDING:  2, TOWER:    3,
  WATER:     4, PARK:      5, PALACE:    6, WALL:     7,
  TREE:      8, PLAZA:     9, BRIDGE:    10, GRASS:   11,
} as const;
type CTile = typeof C[keyof typeof C];

const TILE  = 32;
// So-ol is the national capital: keep the original western core intact for old
// save coordinates, then extend the city east and south with two new districts.
// The footprint grows from 48×72 (3,456 tiles) to 64×84 (5,376 tiles).
const CCOLS = 64;
const CROWS = 84;

const CITY_COLORS: Record<CTile, number> = {
  [C.ROAD]:     0x5a5a5a,
  [C.SIDEWALK]: 0x9a9a8a,
  [C.BUILDING]: 0x7a8a9a,
  [C.TOWER]:    0x4a5a6a,
  [C.WATER]:    0x3399dd,
  [C.PARK]:     0x44aa44,
  [C.PALACE]:   0xd4a870,
  [C.WALL]:     0xa07040,
  [C.TREE]:     0x228822,
  [C.PLAZA]:    0xccbbaa,
  [C.BRIDGE]:   0x8a7060,
  [C.GRASS]:    0x55aa44,
};
const SOLID_C: Set<CTile> = new Set([C.BUILDING, C.TOWER, C.WATER, C.WALL]);

interface CapitalLandmark {
  label: string;
  x: number; y: number; w: number; h: number;
  model: string;
  wallColor: number; roofColor: number;
}

/** Non-enterable civic monuments. Each footprint is solid in 2D and is also
 *  published to the overworld mirror, which fits the named GLB to the plot. */
const CAPITAL_LANDMARKS: CapitalLandmark[] = [
  { label: 'Onnuri National Museum', x: 52, y: 44, w: 10, h: 7,  model: 'contesthall', wallColor: 0xd8d1c5, roofColor: 0x4b6078 },
  { label: 'State Shrine',           x: 5,  y: 72, w: 12, h: 7,  model: 'jongmyo',     wallColor: 0xcaa574, roofColor: 0x314d3a },
  // So-ol Central Station removed: its assets/map3d/soolstation.glb rendered as a
  // black box at the city's south-east corner. (Its bottom-left twin, jongmyo, uses
  // the same map3d pipeline — flag if that one also shows up black.)
];

function buildCityMap(): CTile[][] {
  const R = C.ROAD, SW = C.SIDEWALK, B = C.BUILDING, T = C.TOWER,
        W = C.WATER, PK = C.PARK, PA = C.PALACE,
        TR = C.TREE, PL = C.PLAZA, BR = C.BRIDGE, G = C.GRASS;

  const map: CTile[][] = Array.from({ length: CROWS }, () =>
    Array(CCOLS).fill(SW) as CTile[],
  );

  const fill = (r1: number, c1: number, r2: number, c2: number, t: CTile) => {
    for (let r = r1; r < r2; r++)
      for (let c = c1; c < c2; c++)
        if (r >= 0 && r < CROWS && c >= 0 && c < CCOLS) map[r][c] = t;
  };

  // ── Outer boundary trees ──────────────────────────────────────────────────
  fill(0, 0, CROWS, 2, TR); fill(0, CCOLS - 2, CROWS, CCOLS, TR);
  fill(0, 0, 2, CCOLS, TR); fill(CROWS - 2, 0, CROWS, CCOLS, TR);

  // ── Main N-S boulevard (cols 22-25) ──────────────────────────────────────
  fill(0, 22, CROWS, 26, R);
  // A second ceremonial axis serves the expanded government quarter and its
  // eastern bridge, so the capital reads as a broad metropolis.
  fill(0, 47, CROWS, 51, R);

  // ── E-W cross roads ────────────────────────────────────────────────────────
  fill(16, 2, 18, CCOLS - 2, R);   // gym approach road
  fill(34, 2, 36, CCOLS - 2, R);   // central road
  fill(51, 2, 53, CCOLS - 2, R);   // southern road

  // ── GYM district (rows 2-14) ─────────────────────────────────────────────
  fill(2, 2, 14, CCOLS - 2, PL);  // gym plaza
  // GYM sits on the RIGHT of the plaza (cols 26-45) so the central N-S road
  // (cols 22-25) runs clear up to the north gate → Route 2.
  fill(3, 26, 15, 46, B);          // GYM building
  // Gym entrance gap (south face, centred on the building)
  for (let c = 34; c < 38; c++) map[14][c] = PL;  // door tiles

  // Gym battle floor marker
  for (let c = 30; c < 42; c++) map[5][c] = PL;
  for (let c = 30; c < 42; c++) map[6][c] = PL;

  // North passage: a clear road on the LEFT of the gym running up to the Route 2
  // gate, so the way north is obvious and separate from the gym on the right.
  fill(0, 9, 18, 13, R);            // left N-S passage (rows 0-17, cols 9-12)
  for (let c = 22; c < 26; c++) { map[0][c] = TR; map[1][c] = TR; }  // close old central opening

  // Royal archives garden (new eastern district, rows 2-15).
  fill(2, 47, 16, CCOLS - 2, PK);

  // ── Tower district (rows 18-33) ──────────────────────────────────────────
  fill(18, 2, 33, CCOLS - 2, SW);
  fill(19, 31, 33, 44, T);          // Capitol Tower

  // Tower entrance gap
  for (let c = 36; c < 40; c++) map[32][c] = SW;

  // The national assembly faces a ceremonial stone square opposite the old
  // palace and modern Capitol Tower.
  fill(18, 46, 34, CCOLS - 2, PL);
  fill(20, 52, 32, 62, B);   // National Assembly Hall footprint (now enterable)

  // ── Ancient Palace (rows 18-30, cols 3-21) ───────────────────────────────
  fill(18, 3, 31, 21, PL);           // palace forecourt — flat stone plaza (no 3D brown mountain block)
  fill(19, 4, 30, 20, PA);           // palace grounds
  for (let c = 11; c < 13; c++) map[30][c] = SW;  // palace gate

  // ── Han River (rows 36-43) ───────────────────────────────────────────────
  fill(36, 2, 43, CCOLS - 2, W);
  // Bridges
  fill(36, 21, 43, 27, BR);     // main bridge
  fill(36, 46, 43, 52, BR);     // government bridge

  // ── Commercial district (rows 43-53) ─────────────────────────────────────
  fill(43, 2, 53, CCOLS - 2, SW);
  // Pokémon Center block
  fill(44, 3, 52, 13, B);
  for (let c = 7; c < 9; c++) map[51][c] = SW;   // PC door

  // Shops row (east side)
  fill(44, 27, 52, 44, B);
  for (let c = 35; c < 37; c++) map[51][c] = SW;  // shop door

  // Market row (west)
  fill(44, 15, 52, 21, B);
  for (let c = 17; c < 19; c++) map[51][c] = SW;  // market door

  // Museum promenade on the expanded east bank.
  fill(43, 46, 53, CCOLS - 2, PL);

  // ── Central plaza (rows 53-58) ────────────────────────────────────────────
  fill(53, 2, 58, CCOLS - 2, PL);
  // Fountain (center)
  fill(54, 22, 57, 26, W);
  map[55][23] = W; map[55][24] = W;

  // Benches & trees in plaza
  [[54,5],[54,10],[54,36],[54,41],[56,5],[56,10],[56,36],[56,41]].forEach(
    ([r, c]) => { map[r][c] = TR; }
  );

  // ── South residential (rows 58-68) ───────────────────────────────────────
  fill(58, 2, 68, CCOLS - 2, SW);
  // Apartment blocks. The two EASTERN blocks sit south of the river boulevard
  // (rows 63-66) so the avenue runs cleanly between buildings instead of slicing
  // through them; the western blocks keep their full height.
  [[59,3,67,8],[59,10,67,15],[63,28,67,34],[63,36,67,42]].forEach(
    ([r1,c1,r2,c2]) => fill(r1,c1,r2,c2,B)
  );
  // Parks
  fill(59, 17, 68, 26, PK);
  fill(59, 44, 68, CCOLS - 2, PK);
  // Park trees
  [[60,18],[60,22],[63,19],[63,23],[65,20]].forEach(([r,c]) => { map[r][c] = TR; });

  // ── Entry boulevard (rows 68-70) ─────────────────────────────────────────
  fill(68, 2, 70, CCOLS - 2, R);

  // ── Entry arch markers ────────────────────────────────────────────────────
  fill(69, 2, CROWS - 2, CCOLS - 2, SW);
  // Southern cultural ward: shrine gardens to the west and a civic forecourt
  // with the national library and central station to the east.
  fill(71, 2, 81, 20, PK);
  fill(71, 33, 81, CCOLS - 2, PL);
  for (let c = 22; c < 26; c++) map[70][c] = R;

  // Stamp roads back on top
  for (let r = 0; r < CROWS; r++) {
    for (let c = 22; c <= 25; c++) map[r][c] = R;
    for (let c = 47; c <= 50; c++) map[r][c] = R;
  }
  fill(16, 2, 18, CCOLS - 2, R);
  fill(34, 2, 36, CCOLS - 2, R);
  fill(51, 2, 53, CCOLS - 2, R);
  fill(68, 2, 70, CCOLS - 2, R);
  // Fold the market's isolated south-east kerb spur into the junction so the
  // crossing has one continuous, structure-free road surface.
  map[50][21] = R;
  // Restore both bridge decks after stamping the boulevards through the river.
  fill(36, 21, 43, 27, BR);
  fill(36, 46, 43, 52, BR);

  // ── West trailhead: the central road runs through the tree border to the
  //    map's west edge — the dedicated path to Scholars' Road (post-8th badge).
  fill(34, 0, 36, 2, R);

  // ── East avenue out to the Han River Park (rows 60-62) ──────────────────────
  // A grand tree-lined boulevard running from the central road east, opening a gate
  // to the riverside district. It runs BETWEEN the residential blocks (which sit to
  // its south), never through them.
  fill(60, 26, 63, CCOLS, R);
  for (const c of [27, 31, 35, 39, 43]) map[59][c] = TR;   // tree-lined north kerb

  // Landmark footprints are placed last so district paving cannot overwrite
  // their solid collision area. None intersects an exit or boulevard.
  for (const lm of CAPITAL_LANDMARKS) fill(lm.y, lm.x, lm.y + lm.h, lm.x + lm.w, B);
  // Professor Song's lab replaces the old non-enterable Royal Archives. Keep
  // the south-facing door walkable while the remaining footprint is solid.
  fill(4, 52, 14, 61, B);
  map[13][56] = SW;

  // National Assembly Hall + National Library are enterable — solid footprints.
  fill(20, 52, 32, 62, B);   // Assembly (door faces the square, row 32)
  fill(72, 35, 79, 45, B);   // Library (door faces the forecourt, row 71)

  // Clear every enterable building's doorway: carve the door tile, one step into
  // the building, and the approach tile just outside — so no solid tile is ever
  // wedged between the character and the door (you can walk straight in).
  for (const loc of LOCATIONS) {
    const dr = loc.doorRow, dc = loc.doorCol;
    for (const [rr, cc] of [[dr, dc], [dr, dc - 1], [dr, dc + 1], [dr + 1, dc], [dr - 1, dc]] as [number, number][]) {
      if (rr >= 0 && rr < CROWS && cc >= 0 && cc < CCOLS && (map[rr][cc] === B || map[rr][cc] === C.TOWER)) map[rr][cc] = SW;
    }
  }

  void G; void T;
  return map;
}

// ── Special locations ─────────────────────────────────────────────────────────
interface CityLocation {
  label: string;
  scene: string;
  doorRow: number; doorCol: number;
  x: number; y: number; w: number; h: number;
  roofColor: number; wallColor: number;
  /** 3D building model id (props.json) placed on this footprint. */
  model: string;
}

const LOCATIONS: CityLocation[] = [
  { label: "Professor Song's Lab", scene: 'SudoLabScene', model: 'lab',
    doorRow: 13, doorCol: 56,
    x: 52, y: 4, w: 9, h: 10, roofColor: 0x31584c, wallColor: 0xd9c39a },
  { label: "Pokémon Center",   scene: 'CapitolPCScene', model: 'pokecenter',
    doorRow: 51, doorCol: 7,
    x: 3, y: 44, w: 10, h: 8, roofColor: 0xcc2244, wallColor: 0xffffff },
  { label: "Capitol Tower",    scene: 'CapitolTowerScene', model: 'tower',
    doorRow: 32, doorCol: 37,
    x: 31, y: 19, w: 13, h: 14, roofColor: 0x1144cc, wallColor: 0x445566 },
  { label: "Ancient Palace",   scene: 'CapitolPalaceScene', model: 'palace',
    doorRow: 30, doorCol: 11,
    x: 3, y: 18, w: 18, h: 13, roofColor: 0x8a4a1a, wallColor: 0xd4a870 },
  { label: 'National Assembly Hall', scene: 'CapitolAssemblyScene', model: 'league',
    doorRow: 32, doorCol: 56,
    x: 52, y: 20, w: 10, h: 12, roofColor: 0x8f2e2e, wallColor: 0xe3d5b8 },
  { label: 'National Library', scene: 'CapitolLibraryScene', model: 'palace',
    doorRow: 71, doorCol: 40,
    x: 35, y: 72, w: 10, h: 7, roofColor: 0x315a70, wallColor: 0xe0cfaa },
  { label: "Central Market",   scene: 'CapitolMarketScene', model: 'mart',
    doorRow: 51, doorCol: 17,
    x: 15, y: 44, w: 6, h: 8, roofColor: 0xee8833, wallColor: 0xffcc88 },
  { label: "Dept. Store (6F)", scene: 'DeptStoreScene', model: 'deptstore',
    doorRow: 51, doorCol: 35,
    x: 27, y: 44, w: 17, h: 8, roofColor: 0x2a6a9a, wallColor: 0xcfd8e0 },
  { label: "Capitol GYM",      scene: 'CapitolGymScene', model: 'gym',
    doorRow: 14, doorCol: 35,
    x: 26, y: 3, w: 20, h: 12, roofColor: 0x222266, wallColor: 0x334477 },
];

interface CapitalBuildingPlot {
  x: number; y: number; w: number; h: number;
  model?: string;
}

/** Keep every 3D building footprint outside the authored street grid. Several
 *  commercial plots include their walkable door row in the 2D rectangle; using
 *  that same rectangle for 3D lets the model extend into the boulevard. */
function buildCapital3DBuildingPlots(): CapitalBuildingPlot[] {
  const map = buildCityMap();
  const isStreet = (r: number, c: number) => map[r]?.[c] === C.ROAD || map[r]?.[c] === C.BRIDGE;
  const trimStreetEdges = (source: CapitalBuildingPlot): CapitalBuildingPlot => {
    const p = { ...source };
    let changed = true;
    while (changed && p.w > 1 && p.h > 1) {
      changed = false;
      if (Array.from({ length: p.w }, (_, i) => p.x + i).some(c => isStreet(p.y, c))) {
        p.y++; p.h--; changed = true; continue;
      }
      if (Array.from({ length: p.w }, (_, i) => p.x + i).some(c => isStreet(p.y + p.h - 1, c))) {
        p.h--; changed = true; continue;
      }
      if (Array.from({ length: p.h }, (_, i) => p.y + i).some(r => isStreet(r, p.x))) {
        p.x++; p.w--; changed = true; continue;
      }
      if (Array.from({ length: p.h }, (_, i) => p.y + i).some(r => isStreet(r, p.x + p.w - 1))) {
        p.w--; changed = true;
      }
    }
    return p;
  };

  const authored = [...LOCATIONS, ...CAPITAL_LANDMARKS].map(l => ({
    x: l.x, y: l.y, w: l.w, h: l.h,
    // These two generated GLBs contain large dark exterior fragments. The clean
    // procedural versions retain their identity without spilling geometry into streets.
    model: l.model === 'mart' ? 'mart-procedural'
      : l.model === 'pokecenter' ? 'pokecenter-procedural'
        : l.model,
  }));
  const apartments: CapitalBuildingPlot[] = [
    { x: 3, y: 59, w: 5, h: 8 }, { x: 10, y: 59, w: 5, h: 8 },
    { x: 28, y: 63, w: 6, h: 4 }, { x: 36, y: 63, w: 6, h: 4 },
  ];
  return [...authored, ...apartments].map(trimStreetEdges);
}

// ── Scene ─────────────────────────────────────────────────────────────────────
export class CapitolCityScene extends Phaser.Scene {
  private map!: CTile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private locationText!: Phaser.GameObjects.Text;

  private px = 24 * TILE + 16;
  private py = 80 * TILE + 16;   // start at the expanded south entrance
  private facing = 0; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;

  /** Authoritative building rectangles (tiles) for the 3D renderer — includes
   *  the Gym and every landmark, so none depend on color detection. */
  public buildingPlots: CapitalBuildingPlot[] = buildCapital3DBuildingPlots();
  /** Every real building is now a named plot (landmarks + apartments), so the
   *  color/variance heuristic is off — no more phantom boxes around the palace. */
  public onlyNamedBuildings = true;
  /** Keep tall capital landmarks visible while allowing the camera to fade any
   *  structure that moves between the player and the view. */
  public clearSight3D = true;
  /** Disable authored props and colour-inferred boulders. The latter produced
   *  two stray rocks directly behind the Ancient Palace. */
  public propPlots: import('../engine3d/TerrainBuilder').PropPlot[] = [];
  public noVehicles = true;
  public noRocks3D = true;
  /** The painted street trees (가로수) grow as real 3D trees, not flat ground art. */
  public treeTileIds3D = [C.TREE];
  /** The capital's streets are rebuilt as real 3D infrastructure: asphalt with
   *  lane markings and crossings, kerbed pavements, lamps, signals and signage. */
  public cityTiles3D = {
    road: [C.ROAD] as number[],
    sidewalk: [C.SIDEWALK, C.PLAZA] as number[],
    bridge: [C.BRIDGE] as number[],
  };
  // Edge exits stay locked until the player has released all movement keys once
  // after arriving. A key held through the transition can't bounce us back out,
  // but a fresh, deliberate press toward the boundary returns immediately.
  private freshInput = false;
  private readonly SPEED = 120;
  private readonly RUN_SPEED = 260;

  constructor() { super('CapitolCityScene'); }

  preload() {
    if (!this.textures.exists('corrpanda'))
      this.load.image('corrpanda', 'assets/corrpanda.png');
  }

  create() {

    migrateLegacyCheonjiCapture(this.registry);

    playBgm(this, 'sudo');
    this.cutsceneActive = false;
    this.walkFrame = 0; this.walkTimer = 0;
    // Grace period: ignore edge exits briefly after spawning so we never bounce
    // straight back out through the boundary we just entered from.
    this.spawnGuard = true;
    this.freshInput = false;
    this.time.delayedCall(600, () => { this.spawnGuard = false; });
    this.input.keyboard?.resetKeys();

    // Restore position
    const rx = this.registry.get('capitalReturnX') as number | undefined;
    const ry = this.registry.get('capitalReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('capitalReturnX'); this.registry.remove('capitalReturnY');

    this.map = buildCityMap();
    this.drawCity();
    this.createPlayer();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [C.WATER], solidTiles: SOLID_C,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.addCityLabels();

    this.cameras.main.fadeIn(500);
    SaveManager.save(this.registry, this.px, this.py, 'CapitolCityScene');

    // Arrival message (first time only)
    if (!this.registry.get('visitedCapitol')) {
      this.registry.set('visitedCapitol', true);
      this.time.delayedCall(800, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'You have arrived at Capitol City!',
          'This vast capital holds the heart of the nation.',
          'Explore the city, visit the Capitol Tower,\nand challenge the Capitol Gym!',
          'The Gym Leader Jin awaits at the northern gym.\nPrepare well — her shadow Pokémon are powerful.',
        ], () => { this.cutsceneActive = false; });
      });
    } else if (this.registry.get('gymLeaderDefeated') && !this.registry.get('newsShown')) {
      // News broadcast cutscene — plays once after beating the gym
      this.registry.set('newsShown', true);
      this.time.delayedCall(700, () => this.playNewsBroadcast());
    } else if (this.registry.get('chapter11Done') && !this.registry.get('ch12IntroShown')) {
      // Epilogue / Chapter 12 hook — plays once on returning after Baekdu Peak
      this.registry.set('ch12IntroShown', true);
      this.time.delayedCall(700, () => this.playEpilogue());
    } else if (this.registry.get('championDefeated') && !this.registry.get('flyHmGiven')) {
      // Champion returns home — Professor Song awards HM Fly, then the Rival jogs up
      // with the northern news (playChampionReturn chains into playCapitolRivalNews).
      this.time.delayedCall(700, () => this.playChampionReturn());
    } else if (this.registry.get('capitolRivalNewsPending')) {
      // Fallback: the Rival's northern-news beat if the Professor cutscene already ran.
      this.time.delayedCall(700, () => this.playCapitolRivalNews());
    } else if (this.registry.get('sudoPartyPending')) {
      // POST-GAME finale — the Northern League victory is celebrated back in Sudo City,
      // which then unlocks the Ancient Altar shortcut to the Sacred Peak (환웅). Plays once.
      this.time.delayedCall(700, () => {
        this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('SudoLabScene'));
      });
    } else if (this.registry.get('northLeagueDone') && !this.registry.get('northReunionSeen')) {
      // POST-GAME I aftermath — Hwangeum meets you at the station. Plays once.
      this.time.delayedCall(700, () => this.playNorthernReunion());
    } else if (this.registry.get('partyDayDone') && !this.registry.get('partIIDone') && !this.registry.get('partIIStarted')) {
      // POST-GAME II hook — Professor Song's briefing + the road to the northern reaches.
      this.time.delayedCall(700, () => this.playPartIIBriefing());
    } else {
      // Trigger any pending evolutions on return from battle
      this.time.delayedCall(300, () => maybeLaunchEvolution(this));
    }

    if (this.registry.get('sunriseGymDefeated')) this.drawScholarsGate();
    this.drawExitSigns();
  }

  // ── Edge-exit signposts (Han River Park east gate, Scholars' Road west path) ──
  private drawExitSigns() {
    this.add.text((CCOLS - 3) * TILE, 60.4 * TILE, tr('Han River Park →'), {
      fontSize: '9px', color: '#d8f0ff', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(1, 0.5).setDepth(7);
    if (this.registry.get('sunriseGymDefeated')) {
      this.add.text(3 * TILE, 33.3 * TILE, tr('← Scholars\' Road'), {
        fontSize: '9px', color: '#ffe88a', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
      }).setOrigin(0, 0.5).setDepth(7);
    }
  }

  // ── Scholars' Road trailhead (post-Baekdu) ─────────────────────────────────
  private readonly SCHOLARS_GATE = { col: 6, row: 31 };
  private drawScholarsGate() {
    const x = this.SCHOLARS_GATE.col * TILE + 16, y = this.SCHOLARS_GATE.row * TILE + 16;
    // The old hand-drawn gate became two oversized brown cuboids when mirrored
    // into 3D directly behind the Ancient Palace. Keep the destination marker,
    // but remove that geometry so the palace rear court stays completely clear.
    this.add.text(x, y - 38, tr('⛩ Scholars\' Road'), {
      fontSize: '9px', color: '#ffe88a', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(7);
  }

  private playEpilogue() {
    this.cutsceneActive = true;
    this.dialog.show([
      'In the weeks after Baekdu Peak, the region steadies. Director Suri turns herself in with full documentation; her late repentance is noted in her case.',
      'Chaeyeon leads the regional restoration — real, patient work. Commander Ryeo and Executive Mubaek are taken into custody. Ryeo says only: "The cause was just. The method was wrong. I know the difference now."',
      'Freed from the matrix, 풍백, 우사, and 운사 return to roaming the wild peaks — Wind on the high ridges, Rain in the storm valleys, Clouds at the cloud-wreathed summits.',
      'Professor Song: The Spirit\'s return stabilized the region. The three old spirits are free. And 나비할망 found her guardian. Remarkable. Both of you.',
      'Professor Song: There\'s one road left to walk. The Onnuri Pokémon League sits beyond the mountains — and Scholars\' Road begins right here, behind the palace where your journey started.',
      'A grand stone gate has opened behind the palace. ⛩ Scholars\' Road is now open.',
    ], () => { this.cutsceneActive = false; });
  }

  /** Champion homecoming — Professor Song walks up to you and hands over HM Fly (one-time). */
  private playChampionReturn() {
    this.cutsceneActive = true;
    this.registry.set('flyHmGiven', true);
    this.facing = 1;                        // face up, toward the approaching Professor
    this.drawChar();

    const startY = this.py - TILE * 5.5;    // enters from the plaza to the north
    const stopY  = this.py - TILE * 1.6;    // halts just in front of the champion

    const prof = this.add.graphics().setDepth(21);
    markTrainerPortrait(prof, 'prof-song');
    const tag  = this.add.text(this.px, startY - 30, tr('Professor Song'), {
      fontSize: '10px', color: '#bfe4ff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(22);
    this.drawProfessor(prof, this.px, startY, 0);

    // Walk in → award + dialog → walk back out.
    this.walkProfessor(prof, tag, startY, stopY, () => {
      this.registry.set('hasFlyHM', true);
      Inventory.add(this.registry, 'hm_fly', 1);                  // HM goes in the Bag (reusable)

      // Auto-teach Fly to a Flying-type on the team, if any, so you can Fly right away.
      const party = PartySystem.get(this.registry);
      // Only auto-teach when there's a free move slot — never silently overwrite a
      // 4th move here. A full-moveset flyer is taught from the Bag, where the player
      // gets to choose which move to forget.
      const flyerIdx = party.findIndex(p =>
        [p.type1, p.type2].some(t => (t ?? '').toLowerCase() === 'flying') &&
        !p.moves.some(m => m.toLowerCase() === 'fly') &&
        p.moves.length < 4);
      let learnLine: string;
      if (flyerIdx >= 0) {
        PartySystem.teachMove(this.registry, flyerIdx, 'Fly');
        learnLine = `✈ You received HM01 FLY!  ${party[flyerIdx].name} learned Fly!`;
      } else {
        learnLine = '✈ You received HM01 FLY!  Use it from your Bag to teach Fly to a Flying-type — if its moves are full, you choose which to forget.';
      }

      SaveManager.save(this.registry, this.px, this.py, 'CapitolCityScene');   // persist the award
      this.dialog.show([
        'Professor Song hurries across the plaza to meet you as you return home, Champion.',
        'Professor Song: The whole region saw it. You did what no one else could — and you never once stopped putting your Pokémon first.',
        'Professor Song: Here — I had this prepared the moment I heard the news. Champions shouldn\'t have to walk everywhere.',
        learnLine,
        'Professor Song: The HM stays in your Bag — teach Fly to any Flying-type. Then open the Town Map, pick a city you\'ve visited, and Fly straight there.',
        'Professor Song: And there\'s something else. Word from beyond the northern border — the Northern League, and the eight 어사대 provinces that guard the road to it. They\'ve heard of you.',
        'Professor Song: They say a coach runs from Waterfall City now, all the way up to Songhyeon — first of the eight. If you mean to go north, that bus is how you\'ll get there. Go — see the region you saved, and the one beyond it.',
      ], () => {
        this.walkProfessor(prof, tag, stopY, startY, () => {
          prof.destroy(); tag.destroy();
          // Right after the Professor steps away, the Rival jogs up with the
          // northern news (the story half that used to live inside the Hall of Fame).
          if (this.registry.get('capitolRivalNewsPending')) this.playCapitolRivalNews();
          else this.cutsceneActive = false;
        });
      });
    });
  }

  /** The Rival crosses the plaza to deliver the northern news — the story beat that
   *  is now split out of the Hall of Fame ceremony. Their 3D sprite walks up, talks,
   *  and unlocks Phase 2 / the post-game, then walks back out. */
  private playCapitolRivalNews() {
    this.registry.remove('capitolRivalNewsPending');
    this.cutsceneActive = true;
    this.facing = 1;                        // face up, toward the approaching Rival
    this.drawChar();

    const startY = this.py - TILE * 5.5;    // enters from the plaza to the north
    const stopY  = this.py - TILE * 1.6;    // halts just in front of the Champion
    const rivalName = rivalTrainerName(this.registry);

    const rival = this.add.graphics().setDepth(21);
    markRivalPortrait(rival, this.registry);   // promotes the sprite to the Rival's 3D model
    const tag = this.add.text(this.px, startY - 30, rivalName, {
      fontSize: '10px', color: '#a9dcff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(22);
    this.drawRival(rival, this.px, startY, 0);

    this.walkRival(rival, tag, startY, stopY, () => {
      this.dialog.show([
        'Back in Capitol City, your Rival is already jogging over — because of course they are.',
        "Rival: Champion of the south. And 나비할망's chosen one. Has a ring to it.",
        'Rival: I found something while you were climbing the league. In the far north, beyond Baekdu Peak — old texts, older than the gym records. References to another spirit. One that predates the Dancheong calendar.',
        'Prof. Song (comms): That\'s... troubling. The north has always been volatile. If something wakes there before we understand it, the whole peninsula could—',
        'Rival: Easy, Professor. We\'re barely sitting down. But when you\'re ready, Champion — the Taebaek range has some climbing left to do.',
        "Rival: ...Starting tomorrow, though. Tonight, you've earned the sleep.",
        'Phase 2: Northern League — UNLOCKED',
        'Post-game unlocked: rechallenge the Rival in the Shadow Court, rematch Champion Hwangeum, explore the postgame world, and track the freed trio — 풍백, 우사, 운사 — at their mountain shrines.',
      ], () => {
        this.walkRival(rival, tag, stopY, startY, () => {
          rival.destroy(); tag.destroy();
          this.cutsceneActive = false;
        });
      });
    });
  }

  /** Draw the Rival's overworld sprite facing down (toward the player they approach). */
  private drawRival(g: Phaser.GameObjects.Graphics, x: number, y: number, frame: number) {
    drawTrainerBody(g, 0, frame, rivalDesign(this.registry));
    g.setPosition(x, y);
  }

  /** Tween the Rival sprite along the player's column with animated steps. */
  private walkRival(
    rival: Phaser.GameObjects.Graphics, tag: Phaser.GameObjects.Text,
    fromY: number, toY: number, onDone: () => void,
  ) {
    const proxy = { y: fromY };
    let frame = 0;
    const step = this.time.addEvent({ delay: 140, loop: true, callback: () => { frame ^= 1; } });
    this.tweens.add({
      targets: proxy, y: toY,
      duration: Math.max(500, (Math.abs(toY - fromY) / TILE) * 260),
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.drawRival(rival, this.px, proxy.y, frame);
        tag.setPosition(this.px, proxy.y - 30);
      },
      onComplete: () => {
        step.remove();
        this.drawRival(rival, this.px, toY, 0);   // settle to idle pose
        onDone();
      },
    });
  }

  /** Tween the Professor sprite along the player's column with animated steps. */
  private walkProfessor(
    prof: Phaser.GameObjects.Graphics, tag: Phaser.GameObjects.Text,
    fromY: number, toY: number, onDone: () => void,
  ) {
    const proxy = { y: fromY };
    let frame = 0;
    const step = this.time.addEvent({ delay: 140, loop: true, callback: () => { frame ^= 1; } });
    this.tweens.add({
      targets: proxy, y: toY,
      duration: Math.max(500, (Math.abs(toY - fromY) / TILE) * 260),
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.drawProfessor(prof, this.px, proxy.y, frame);
        tag.setPosition(this.px, proxy.y - 30);
      },
      onComplete: () => {
        step.remove();
        this.drawProfessor(prof, this.px, toY, 0);   // settle to idle pose
        onDone();
      },
    });
  }

  /** A grey-haired professor in a lab coat, drawn to match the town character style. */
  private drawProfessor(g: Phaser.GameObjects.Graphics, x: number, y: number, frame: number) {
    g.clear();
    const lx = -8, rx = 3;
    const ly = frame === 0 ? 9 : 6, ry = frame === 0 ? 6 : 9;
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 20, 6);
    g.fillStyle(0x3a2a18); g.fillRect(lx, ly, 6, 5); g.fillRect(rx, ry, 6, 5);      // shoes
    g.fillStyle(0x555560); g.fillRect(lx + 1, ly - 7, 4, 8); g.fillRect(rx + 1, ry - 7, 4, 8); // trousers
    g.fillStyle(0xffffff); g.fillRect(-9, -8, 18, 14);                              // lab coat
    g.fillStyle(0xdfe4ea); g.fillRect(-1, -8, 2, 14);                               // coat seam
    g.fillStyle(0xffffff); g.fillRect(-13, -7, 5, 11); g.fillRect(8, -7, 5, 11);    // sleeves
    g.fillStyle(0xffcc99); g.fillRect(-13, 4, 5, 4); g.fillRect(8, 4, 5, 4);        // hands
    g.fillStyle(0xffcc99); g.fillRect(-7, -22, 14, 13);                             // face/neck
    g.fillStyle(0x9a9a9a); g.fillRect(-7, -22, 14, 5); g.fillRect(-7, -22, 3, 10); g.fillRect(4, -22, 3, 10); // grey hair
    g.fillStyle(0x222222); g.fillRect(-5, -16, 4, 3); g.fillRect(1, -16, 4, 3); g.fillRect(-1, -15, 2, 1);    // glasses
    g.fillStyle(0x000000); g.fillRect(-4, -15, 1, 1); g.fillRect(2, -15, 1, 1);     // eyes
    g.setPosition(x, y);
  }

  /** Hwangeum meets the returning northern victor at the Capitol station (one-time). */
  /** Homecoming after the Northern League: the whole cast gathers at Capitol, a
   *  party runs into the night, and the next morning teases the road ahead. */
  private playNorthernReunion() {
    this.cutsceneActive = true;
    this.registry.set('northReunionSeen', true);
    this.registry.remove('northReunionPending');
    this.facing = 1; this.drawChar();   // face the crowd

    const guests = this.drawPartyGuests();
    this.dialog.show([
      'The Capitol station is packed — the whole region has come to meet the trainer who conquered the Northern League.',
      'Champion Hwangeum: ...You actually did it. You beat Taewang. Three years I carried that loss — you lifted it clean off me. Thank you.',
      'Professor Song: Two leagues, north and south. There has never been a trainer like you in all of Onnuri\'s history.',
      'Rival: I always said I\'d catch up to you someday. ...Yeah, I\'m nowhere close. And honestly? I have never been prouder to lose.',
      'Admin Chaeyeon: Even the people you once fought stood in this crowd tonight. The region you healed came out for you.',
      'Leader Byeoksan: Every Gym in Onnuri shut its doors today. Tonight — we drink to the Champion of Champions!',
      'The plaza erupts. Lanterns go up over the Han River, the markets roll out food, and music starts.',
    ], () => this.startParty(guests));
  }

  /** Draw the party guests in an arc around the champion. Returns them for cleanup. */
  private drawPartyGuests(): Phaser.GameObjects.GameObject[] {
    const objs: Phaser.GameObjects.GameObject[] = [];
    const guest = (
      dx: number, dy: number, name: string, color: number,
      special?: 'prof' | 'rival', trainerKey?: string,
    ) => {
      const g = this.add.graphics().setDepth(22);
      const x = this.px + dx, y = this.py + dy;
      if (special === 'prof')       this.drawProfessor(g, x, y, 0);
      else if (special === 'rival') {
        drawTrainerBody(g, 0, 0, rivalDesign(this.registry)); g.setPosition(x, y);
        markRivalPortrait(g, this.registry);
      }
      else                          { drawNpcBody(g, color); g.setPosition(x, y); }
      if (trainerKey) markTrainerPortrait(g, trainerKey);
      const t = this.add.text(x, y - 26, name, {
        fontSize: '8px', color: '#fff', backgroundColor: '#00000099', padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(23);
      objs.push(g, t);
    };
    guest(0,   -76, 'Champion Hwangeum', 0xffd54a, undefined, 'champion-hwangeum');
    guest(-92, -46, 'Prof. Song', 0, 'prof', 'prof-song');
    guest(92,  -46, 'Rival', 0, 'rival');
    guest(-64, -96, 'Leader Namsun', 0xe28aa0, undefined, 'geumgang-namsun');
    guest(64,  -96, 'Leader Harang', 0x3a7ad9, undefined, 'haean-harang');
    guest(-136, 4, 'Admin Chaeyeon', 0x3aa88a, undefined, 'suri-chaeyeon-1');
    guest(136,  4, 'Leader Byeoksan', 0xd98a3a, undefined, 'baekdu-byeoksan');
    return objs;
  }

  private startParty(guests: Phaser.GameObjects.GameObject[]) {
    const W = this.scale.width, H = this.scale.height;
    // Evening glow + floating lanterns / confetti (camera-fixed overlay).
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x1a1030, 0.42).setScrollFactor(0).setDepth(150);
    const festive: Phaser.GameObjects.GameObject[] = [dim];
    const icons = ['🏮', '🎉', '✨', '🎊', '🏮'];
    for (let i = 0; i < 12; i++) {
      const l = this.add.text(Math.random() * W, H + 20, icons[i % icons.length], { fontSize: '22px' })
        .setScrollFactor(0).setDepth(151);
      festive.push(l);
      this.tweens.add({ targets: l, y: 40 + Math.random() * H * 0.6, duration: 2200 + Math.random() * 2200, yoyo: true, repeat: -1, delay: Math.random() * 1500 });
    }
    const banner = this.add.text(W / 2, 74, tr('🎉  The Capitol throws a party in your honour!'), {
      fontSize: '18px', color: '#ffe44e', fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(152);
    festive.push(banner);

    this.dialog.show([
      'Lanterns drift over the Han River and the whole city stays out until dawn.',
      'Hwangeum: For one night — no titles, no battles. Just us and the region we love. Eat. Dance. You earned this.',
      'Rival: Come on, Champion — one last race. First to the fountain! ...For old times\' sake.',
      'The night blurs into music and light. For the first time since your journey began, there is nothing left to fight for. Only this.',
    ], () => {
      // The next morning.
      this.cameras.main.fadeOut(1000, 0, 0, 0, () => {
        festive.forEach(k => k.destroy());
        guests.forEach(k => k.destroy());
        this.registry.set('partyDayDone', true);
        this.cameras.main.fadeIn(800);
        this.dialog.show([
          '— The next morning —',
          '📟 Your Pokédex buzzes before you\'re even fully awake — an incoming call from Professor Song.',
          'Prof. Song (over the Pokédex, quietly): Champion. I let you have your night — you deserved a hundred of them. But those reports I mentioned...',
          'Prof. Song: Something is stirring in the sealed northern reaches. 노스단 is moving again — and this time they reach for something far older than the Spirit of Cheonji.',
          'Prof. Song: Rest today. Tomorrow, the last road begins. I\'ll call again when it\'s time.  (To be continued…)',
        ], () => { this.cutsceneActive = false; });
      });
    });
  }

  // ── POST-GAME II — The Descent of Hwanung ──────────────────────────────────
  /** Professor Song's briefing on 노스단's return + the road to the northern reaches. */
  private playPartIIBriefing() {
    this.cutsceneActive = true;
    const full = !this.registry.get('partIIBriefed');
    this.registry.set('partIIBriefed', true);
    const intro = full ? [
      '📟 Your Pokédex buzzes — an incoming call from Professor Song, back at the lab in Sudo City.',
      'Prof. Song (over the Pokédex, grim): 노스단. Again — but bigger. With Commander Ryeo imprisoned, someone new has taken the banner, and they\'ve abandoned the old plan entirely.',
      'Prof. Song: I\'m sending an image to your Pokédex now — an old scroll. A radiant figure descending, three spirits at its side. They reach for the one power above all others. 환웅 — Hwanung, the Sovereign Who Descended.',
      'Prof. Song: If 노스단 captures Hwanung, they command the very force that shaped the region — north and south, in a single stroke.',
      'Prof. Song: But the Sovereign only descends for one who has gathered his three attendants — 풍백 the Wind, 우사 the Rain, 운사 the Clouds. Find and catch them before 노스단 does.',
      'Prof. Song: One more thing. The northern reaches are guarded by the 어사대 — the Royal Inspectorate. They trust outsiders even less than 노스단 does. You\'ll have to earn them, city by city.',
      'Prof. Song: Ready the strongest team you have ever fielded, then take the road north. I\'ll stay on the Pokédex the whole way. Shall we go?',
    ] : [
      '📟 Your Pokédex buzzes — Professor Song.',
      'Prof. Song (over the Pokédex): The northern reaches are waiting, Champion — and 노스단 is already climbing toward the shrines. Ready to head north?',
    ];
    this.dialog.show(intro, () => {
      this.dialog.showChoice(() => this.travelToReaches(), () => { this.cutsceneActive = false; });
    });
  }

  private travelToReaches() {
    this.cutsceneActive = true;
    this.registry.set('partIIStarted', true);
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.graphics();
    g.fillStyle(0x0c1424, 1); g.fillRect(0, 0, W, H);
    g.fillStyle(0x1a2740, 1); g.fillTriangle(W * 0.1, H, W * 0.34, H * 0.28, W * 0.56, H);
    g.fillStyle(0x22314e, 1); g.fillTriangle(W * 0.44, H, W * 0.7, H * 0.2, W * 0.98, H);
    g.fillStyle(0xffffff, 0.85); g.fillTriangle(W * 0.7, H * 0.2, W * 0.66, H * 0.3, W * 0.74, H * 0.3);
    for (let i = 0; i < 60; i++) g.fillStyle(0xffffff, Math.random()), g.fillCircle(Math.random() * W, Math.random() * H * 0.7, Math.random() < 0.5 ? 1 : 2);
    const cap = this.add.text(W / 2, H * 0.12, tr('❄  Beyond the border tunnels — into the Northern Reaches…'), {
      fontSize: '17px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 5, align: 'center',
    }).setOrigin(0.5);
    const root = this.add.container(0, 0, [g, cap]).setScrollFactor(0).setDepth(200);
    const zoom = this.cameras.main?.zoom ?? 1, s = 1 / zoom;
    root.setScale(s); root.setPosition((W / 2) * (1 - s), (H / 2) * (1 - s));
    this.time.delayedCall(2600, () => {
      this.cameras.main.fadeOut(700, 0, 0, 0, () => this.scene.start('NorthernReachesScene'));
    });
  }

  private checkScholarsGate() {
    if (!this.registry.get('sunriseGymDefeated')) return;   // 8th badge opens the road to the Onnuri League
    const wx = this.SCHOLARS_GATE.col * TILE + 16, wy = this.SCHOLARS_GATE.row * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) > TILE * 1.4) return;
    this.enterPrompt.setText(tr('SPACE — Scholars\' Road → Pokémon League')).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) return;
    this.cutsceneActive = true;
    this.registry.set('scholarsRoadReturnX', 12 * 32 + 16);
    this.registry.set('scholarsRoadReturnY', 56 * 32 + 16);
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('ScholarsRoadScene'));
  }

  // ── News broadcast (post-gym) ─────────────────────────────────────────────
  private playNewsBroadcast() {
    this.cutsceneActive = true;

    // Big screen overlay in the plaza
    const sw = 520, sh = 300;
    const cx = this.scale.width / 2, cy = this.scale.height / 2 - 40;
    const screen = this.add.container(0, 0).setScrollFactor(0).setDepth(150);
    screen.add(this.add.rectangle(cx, cy, sw + 20, sh + 20, 0x111111).setStrokeStyle(4, 0x444444));
    screen.add(this.add.rectangle(cx, cy, sw, sh, 0x0a1a2a));
    // "LIVE" badge
    screen.add(this.add.rectangle(cx - sw / 2 + 44, cy - sh / 2 + 24, 60, 24, 0xcc2222));
    screen.add(this.add.text(cx - sw / 2 + 44, cy - sh / 2 + 24, tr('● LIVE'), { fontSize: '13px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
    // News graphic — mountains + lake
    const g = this.add.graphics().setScrollFactor(0).setDepth(151);
    g.fillStyle(0x223344); g.fillTriangle(cx - 180, cy + 60, cx - 90, cy - 60, cx, cy + 60);
    g.fillStyle(0x2a4055); g.fillTriangle(cx - 40, cy + 60, cx + 80, cy - 80, cx + 190, cy + 60);
    g.fillStyle(0xffffff, 0.8); g.fillTriangle(cx + 80, cy - 80, cx + 64, cy - 50, cx + 96, cy - 50);
    g.fillStyle(0x4488cc); g.fillEllipse(cx + 30, cy + 80, 220, 40);
    screen.add(g);
    screen.add(this.add.text(cx, cy + sh / 2 - 26, tr('ONNURI NEWS — Seolbong Highland'), {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#000000aa', padding: { x: 6, y: 3 },
    }).setOrigin(0.5));

    this.dialog.show([
      'NEWS: Unusual seismic activity reported near the Seolbong Highland area...',
      'NEWS: Researchers from the Onnuri Pokémon Institute are investigating a pattern linked to rare Pokémon migrations near Cheonji Lake...',
    ], () => {
      // Rival appears
      this.dialog.show([
        "Rival: That's the direction of Route 2. Seolbong Highland — that's where Professor Song said the trail leads.",
        "Rival: Let's see who gets there first. Again.",
        'Route 2 is now open to the NORTH of the city.',
      ], () => {
        screen.destroy(true);
        this.registry.set('route2Unlocked', true);
        this.cutsceneActive = false;
      });
    });
  }

  // ── Map drawing ───────────────────────────────────────────────────────────

  private drawCity() {
    const g = this.make.graphics({ x: 0, y: 0 });

    for (let r = 0; r < CROWS; r++) {
      for (let c = 0; c < CCOLS; c++) {
        const tile = this.map[r][c];
        g.fillStyle(CITY_COLORS[tile], 1);
        g.fillRect(c * TILE, r * TILE, TILE, TILE);

        // Details
        if (tile === C.TREE) this.drawTree(g, c * TILE + 16, r * TILE + 16);
        if (tile === C.WATER) this.drawWater(g, c * TILE, r * TILE, c, r);
        if (tile === C.ROAD)  this.drawRoadMarkings(g, c * TILE, r * TILE, c, r);
        if (tile === C.BUILDING) this.drawBuilding(g, c * TILE, r * TILE);
        if (tile === C.TOWER) this.drawSkyscraper(g, c * TILE, r * TILE);
      }
    }

    const texKey = '__capitalMap__';
    if (this.textures.exists(texKey)) this.textures.remove(texKey);
    g.generateTexture(texKey, CCOLS * TILE, CROWS * TILE);
    g.destroy();
    this.add.image(0, 0, texKey).setOrigin(0, 0).setDepth(0);

    // Building overlays with roofs and signs
    this.drawBuildings();
  }

  private drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x1a5c1a); g.fillTriangle(x, y - 12, x - 9, y + 6, x + 9, y + 6);
    g.fillStyle(0x4a3020); g.fillRect(x - 3, y + 6, 6, 6);
  }
  private drawWater(g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, r: number) {
    g.fillStyle(0x55aaee, 0.6);
    const o = (c + r) % 3;
    g.fillRect(x + o * 6, y + 8, 12, 3); g.fillRect(x + o * 4 + 2, y + 18, 10, 3);
  }
  private drawRoadMarkings(g: Phaser.GameObjects.Graphics, x: number, y: number, c: number, _r: number) {
    if (c % 4 === 0) { g.fillStyle(0xffff88, 0.5); g.fillRect(x + 14, y, 4, TILE); }
  }
  private drawBuilding(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    // Windows
    g.fillStyle(0xaabbcc, 0.4);
    for (let wy = 4; wy < TILE - 4; wy += 10)
      for (let wx = 4; wx < TILE - 4; wx += 9)
        g.fillRect(x + wx, y + wy, 6, 7);
  }
  private drawSkyscraper(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x778899, 0.3);
    for (let wy = 2; wy < TILE - 2; wy += 8)
      for (let wx = 2; wx < TILE - 2; wx += 8)
        g.fillRect(x + wx, y + wy, 5, 5);
    g.fillStyle(0x99ccff, 0.2); g.fillRect(x, y, TILE, 4);
  }

  private drawBuildings() {
    const g = this.add.graphics().setDepth(2);
    for (const loc of LOCATIONS) {
      const x = loc.x * TILE, y = loc.y * TILE;
      const w = loc.w * TILE, h = loc.h * TILE;
      g.fillStyle(loc.wallColor); g.fillRect(x, y, w, h);
      g.lineStyle(2, 0x222222); g.strokeRect(x, y, w, h);
      // Roof
      g.fillStyle(loc.roofColor);
      g.fillTriangle(x - 4, y, x + w / 2, y - TILE * 1.5, x + w + 4, y);
      // Windows
      g.fillStyle(0x88ccff, 0.7);
      for (let wx = 6; wx < w - 6; wx += 18)
        for (let wy = 10; wy < h - 10; wy += 18)
          g.fillRect(x + wx, y + wy, 12, 14);
      // Door
      const dx = loc.doorCol * TILE;
      const dy = (loc.y + loc.h - 1) * TILE;
      g.fillStyle(0x8b4513); g.fillRect(dx + 4, dy, TILE - 8, TILE);
      g.fillStyle(0xddaa44); g.fillCircle(dx + TILE - 10, dy + TILE / 2, 3);

      // Label
      this.add.text((loc.x + loc.w / 2) * TILE, (loc.y - 1.8) * TILE, tr(loc.label), {
        fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(3);
    }

    // Non-enterable civic landmarks still receive a clear 2D silhouette for
    // fallback mode; in 3D these same plots are replaced by their named models.
    for (const lm of CAPITAL_LANDMARKS) {
      const x = lm.x * TILE, y = lm.y * TILE;
      const w = lm.w * TILE, h = lm.h * TILE;
      g.fillStyle(lm.wallColor); g.fillRoundedRect(x, y, w, h, 8);
      g.lineStyle(3, 0x5a4528, 0.9); g.strokeRoundedRect(x, y, w, h, 8);
      g.fillStyle(lm.roofColor);
      g.fillTriangle(x - 5, y + 2, x + w / 2, y - TILE, x + w + 5, y + 2);
      g.fillStyle(0xe7c96a, 0.9); g.fillRect(x + 8, y + 8, w - 16, 5);
      g.fillStyle(0x8ec8e8, 0.75);
      for (let wx = 12; wx < w - 12; wx += 24)
        for (let wy = 22; wy < h - 12; wy += 22)
          g.fillRect(x + wx, y + wy, 14, 12);
      this.add.text((lm.x + lm.w / 2) * TILE, (lm.y - 1.25) * TILE, tr(lm.label), {
        fontSize: '9px', color: '#ffe9a6', backgroundColor: '#182033cc',
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(4);
    }
  }

  private addCityLabels() {
    const lbl = (text: string, col: number, row: number, size = 8) =>
      this.add.text(col * TILE, row * TILE, tr(text), {
        fontSize: `${size}px`, color: '#222', backgroundColor: '#ffffff88', padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(4);

    lbl('So-ol City\n소올 시티 · 온누리의 수도', 24, CROWS - 3, 10);
    lbl('Han River', 24, 39);
    lbl('Grand Civic Plaza', 33, 55);
    lbl('Residential District', 38, 62);
    lbl('Royal District', 55, 16);
    lbl('Government Quarter', 48, 33);
    lbl('Museum Promenade', 48, 50);
    lbl('Memorial Gardens', 53, 66);
    lbl('Cultural Ward', 24, 70);
  }

  // ── Player ────────────────────────────────────────────────────────────────
  private createPlayer() {
    this.playerG = this.add.graphics().setDepth(20);
    this.drawChar();
  }
  private drawChar() {
    (this.cycling ? drawRiderBody : drawTrainerBody)(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }

  private setupCamera() {
    this.cameras.main.setBounds(0, 0, CCOLS * TILE, CROWS * TILE);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.startFollow(this.playerG, true, 0.08, 0.08);
  }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.shiftKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    // C — hop on / off the Bicycle (once obtained from the Han River Bike Shop).
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => {
      if (this.cutsceneActive || !hasBike(this.registry)) return;
      this.cycling = !this.cycling; this.drawChar();
    });
  }

  private createUI() {
    this.dialog = new DialogBox(this, 1280, 720);
    this.add.rectangle(640, 22, 420, 34, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.locationText = this.add.text(640, 22, tr('🏙 Capitol City'), {
      fontSize: '15px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.enterPrompt = this.add.text(640, 690, '', {
      fontSize: '14px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    this.add.text(640, 710, tr('WASD: move  SPACE: enter  M: menu  SHIFT: run'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(_: number, delta: number) {
    if (this.cutsceneActive) {
      if (this.dialog.isInChoice()) {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up))    this.dialog.navigateChoice(-1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down))  this.dialog.navigateChoice(1);
        if (Phaser.Input.Keyboard.JustDown(this.interactKey))   this.dialog.confirmChoice();
      } else if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.dialog.advance();
      }
      return;
    }

    const dt = delta / 1000;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  { dx = -1; this.facing = 2; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { dx =  1; this.facing = 3; }
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    { dy = -1; this.facing = 1; }
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  { dy =  1; this.facing = 0; }

    const moving = dx !== 0 || dy !== 0;
    if (!moving) this.freshInput = true;   // released keys → edge exits go live
    const running = moving && !!this.registry.get('hasRunningShoes') && this.shiftKey.isDown;
    const speed   = this.cycling ? BIKE_SPEED : (running ? this.RUN_SPEED : this.SPEED);

    if (moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = this.px + (dx / len) * speed * dt;
      const ny = this.py + (dy / len) * speed * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else { this.walkFrame = 0; }

    this.drawChar();
    this.checkBuildings();
    this.checkScholarsGate();
    this.checkSouthExit();
    this.checkNorthExit();
    this.checkEastExit();
    this.checkWestExit();
    const district = this.py >= 69 * TILE ? 'Cultural Ward'
      : this.px >= 46 * TILE && this.py < 35 * TILE ? 'Government Quarter'
        : this.px >= 46 * TILE && this.py < 54 * TILE ? 'Museum Promenade'
          : this.py < 18 * TILE ? 'Gym District'
            : this.py < 35 * TILE ? 'Royal District'
              : this.py < 44 * TILE ? 'Han River'
                : this.py < 58 * TILE ? 'Commercial District'
                  : 'Grand Civic Plaza';
    this.locationText.setText(`${tr('🏙 Capitol City')} — ${tr(district)}`);
  }

  private checkNorthExit() {
    if (isSurfing(this.playerG)) return;
    if (this.spawnGuard) return;
    // North gate opens after the gym is defeated → Route 2 (Scholar's Road)
    if (!this.registry.get('route2Unlocked')) return;
    // A key held through the transition can't bounce us back; a fresh press does.
    if (!this.freshInput) return;
    if (this.py < 1.2 * TILE && !this.cutsceneActive) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.scene.start('Route2Scene');
      });
    }
  }

  private collides(x: number, y: number): boolean {
    const hw = 6;
    const pts = [[x - hw, y - 4], [x + hw, y - 4], [x - hw, y + 8], [x + hw, y + 8]];
    return pts.some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= CCOLS || row < 0 || row >= CROWS) return true;
      return SOLID_C.has(this.map[row][col]);
    });
  }

  private checkBuildings() {
    let near: CityLocation | null = null;
    for (const loc of LOCATIONS) {
      const dx2 = this.px - (loc.doorCol * TILE + TILE / 2);
      const dy2 = this.py - (loc.doorRow * TILE + TILE / 2);
      if (Math.sqrt(dx2 * dx2 + dy2 * dy2) < TILE * 1.4) { near = loc; break; }
    }
    if (near) {
      this.enterPrompt.setText(`${tr('SPACE — Enter')} ${tr(near.label)}`).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        const loc = near;
        this.registry.set('capitalReturnX', loc.doorCol * TILE + TILE / 2);
        this.registry.set('capitalReturnY', (loc.doorRow + 1) * TILE + TILE / 2);
        if (loc.scene === 'SudoLabScene') this.registry.set('sudoLabReturnScene', 'CapitolCityScene');
        this.cutsceneActive = true;
        this.cameras.main.fadeOut(400, 0, 0, 0, () => {
          this.scene.start(loc.scene);
        });
      }
    } else {
      this.enterPrompt.setVisible(false);
    }
  }

  private checkEastExit() {
    if (isSurfing(this.playerG)) return;
    if (this.spawnGuard) return;
    // A key held through the transition can't bounce us back; a fresh press does.
    if (!this.freshInput) return;
    const row = Math.floor(this.py / TILE);
    if (this.px > (CCOLS - 1.2) * TILE && row >= 60 && row <= 62 && !this.cutsceneActive) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('hanRiverReturnX', 23 * 32 + 16);
        this.registry.set('hanRiverReturnY', 24 * 32 + 16);
        this.scene.start('HanRiverParkScene');
      });
    }
  }

  /** West edge, central-road rows → Scholars' Road (opens with the 8th badge,
   *  same condition and spawn point as the in-city trailhead gate). */
  private checkWestExit() {
    if (isSurfing(this.playerG)) return;
    if (this.spawnGuard) return;
    if (!this.registry.get('sunriseGymDefeated')) return;
    if (!this.freshInput) return;
    const row = Math.floor(this.py / TILE);
    if (this.px < 1.2 * TILE && row >= 33 && row <= 36 && !this.cutsceneActive) {
      this.cutsceneActive = true;
      this.registry.set('scholarsRoadReturnX', 12 * 32 + 16);
      this.registry.set('scholarsRoadReturnY', 56 * 32 + 16);
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('ScholarsRoadScene'));
    }
  }

  private checkSouthExit() {
    if (isSurfing(this.playerG)) return;
    if (this.spawnGuard) return;
    // A key held through the transition can't bounce us back; a fresh press does.
    if (!this.freshInput) return;
    if (this.py > (CROWS - 2) * TILE && !this.cutsceneActive) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('routeReturnX', 13 * 32 + 16);
        this.registry.set('routeReturnY', 76 * 32 + 16);
        this.scene.start('RouteScene');
      });
    }
  }
}
