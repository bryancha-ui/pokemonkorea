import Phaser from 'phaser';
import { installSurfing, isSurfing } from '../systems/SurfSystem';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawRiderBody, drawTrainerBody, playerDesign, rivalDesign, rivalTrainerName } from '../data/CharacterSprite';
import { BIKE_SPEED, hasBike, isBikeRiding, setBikeRiding } from '../data/Bike';
import { markRivalPortrait } from '../data/BattlePortraits';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { PartySystem } from '../systems/PartySystem';
import type { CrowdPlot } from '../engine3d/AmbientCrowd';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = {
  ROCK: 0, PATH: 1, BUILDING: 2, SAND: 3, SEA: 4, CLIFF: 5, LANTERN: 6, LOOKOUT: 7,
  GRASS: 8, LIGHTHOUSE: 9, FLOWER: 10, PIER: 11, TREE: 12, OBSERVATORY: 13, STALL: 14, BOAT: 15,
} as const;
type Tile = typeof T[keyof typeof T];
// Sunrise City grew east into a working harbour. The original 40×28 town keeps
// every coordinate it had (saves, spawns and exits are all row-based), and the
// new columns 40-55 hold the quay, fish market and ferry berths.
const TILE = 32, COLS = 56, ROWS = 28;
const COLORS: Record<Tile, number> = {
  [T.ROCK]: 0x5a5058,  [T.PATH]: 0xc9bba4,  [T.BUILDING]: 0xe2d6c4, [T.SAND]: 0x2f2f38,
  [T.SEA]: 0x2a72b8,   [T.CLIFF]: 0x6a5f58, [T.LANTERN]: 0x9a7a4a,  [T.LOOKOUT]: 0xd8a85a,
  [T.GRASS]: 0x4c7a3c, [T.LIGHTHOUSE]: 0xf0efe8, [T.FLOWER]: 0x4c7a3c, [T.PIER]: 0xb98a52,
  [T.TREE]: 0x2c5a2c,  [T.OBSERVATORY]: 0xbfc6d0, [T.STALL]: 0xc08a5a, [T.BOAT]: 0x7a4a2a,
};
const SOLID = new Set<Tile>([T.BUILDING, T.SEA, T.CLIFF, T.LANTERN, T.LIGHTHOUSE, T.TREE, T.OBSERVATORY, T.STALL, T.BOAT]);

interface Building { label: string; scene: string; x: number; y: number; w: number; h: number; doorCol: number; doorRow: number; roof: number; }
const BUILDINGS: Building[] = [
  { label: 'Pokémon Center', scene: 'SunrisePCScene',  x: 3,  y: 7, w: 6,  h: 5, doorCol: 5,  doorRow: 12, roof: 0xcc2244 },
  { label: 'Sunrise Gym',    scene: 'SunriseGymScene', x: 16, y: 6, w: 10, h: 6, doorCol: 20, doorRow: 12, roof: 0xd8a83a },
  { label: 'Poké Mart',      scene: '__SHOP__',        x: 31, y: 7, w: 6,  h: 5, doorCol: 33, doorRow: 12, roof: 0x2a6a9a },
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.ROCK) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };
  const set = (r: number, c: number, t: Tile) => { if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t; };

  // ── North: East Sea + the Sunrise Cliffs lookout deck ──
  fill(0, 1, 0, COLS, T.SEA);
  fill(1, 5, 4, COLS - 4, T.LOOKOUT);
  fill(5, 6, 4, COLS - 4, T.CLIFF);        // cliff edge below the lookout
  // Flanking stairways up to the deck (either side of the Gym), with gaps in the cliff.
  fill(1, 12, 12, 14, T.PATH); fill(5, 6, 12, 14, T.PATH);
  fill(1, 12, 26, 28, T.PATH); fill(5, 6, 26, 28, T.PATH);

  // ── Main streets ──
  fill(12, 15, 2, COLS - 2, T.PATH);       // horizontal boulevard
  fill(15, ROWS, 18, 22, T.PATH);          // south causeway to the Eastern Shore Road

  // ── Buildings ──
  for (const b of BUILDINGS) { fill(b.y, b.y + b.h, b.x, b.x + b.w, T.BUILDING); set(b.doorRow, b.doorCol, T.PATH); }

  // ── South: park, black-sand beach, sea ──
  fill(16, 21, 24, 33, T.GRASS);           // seaside park
  fill(22, 25, 2, COLS - 2, T.SAND);
  fill(25, ROWS, 0, COLS, T.SEA);
  fill(22, ROWS, 18, 22, T.PATH);          // causeway across the beach

  // Park greenery
  for (const [r,c] of [[17,25],[16,31],[18,29],[19,26],[20,31],[17,32]] as [number,number][]) set(r, c, T.TREE);
  for (const [r,c] of [[17,27],[18,32],[19,28],[20,25],[16,28]] as [number,number][]) set(r, c, T.FLOWER);

  // ── Landmarks ──
  fill(1, 5, 3, 5, T.LIGHTHOUSE);          // Lighthouse — west end of the lookout
  fill(1, 4, 33, 36, T.OBSERVATORY);       // Sunrise Observatory dome — east end
  fill(17, 19, 5, 12, T.STALL);            // Fish Market stalls (row of vendor stands)
  fill(22, 27, 8, 10, T.PIER); set(26, 8, T.BOAT); set(26, 9, T.BOAT);   // pier + moored boat

  // Stone lanterns — a pair framing the Gym gate, plus two along the boulevard
  for (const [r,c] of [[12,18],[12,22],[11,9],[11,29]] as [number,number][]) set(r, c, T.LANTERN);

  // ══ EAST: the working harbour (cols 40-55) ═════════════════════════════════
  // The clifftop lookout stops at the old town's edge; east of it the land
  // drops to a sheltered basin where the fleet ties up.
  fill(0, 6, 40, COLS, T.SEA);              // open water north of the breakwater
  fill(6, 12, 40, COLS, T.PATH);            // quayside apron behind the market
  fill(12, 16, 40, COLS - 1, T.PATH);       // boulevard continues as the quay road

  // Harbour basin, dredged out of the shore and held by a breakwater arm.
  fill(16, 25, 41, COLS - 4, T.SEA);
  fill(15, 16, 40, COLS - 1, T.PIER);       // quay edge along the north bank
  fill(16, 26, COLS - 4, COLS - 2, T.CLIFF);// breakwater arm (east)
  fill(25, 26, 40, COLS, T.CLIFF);          // breakwater arm (south)

  // Finger piers reaching into the basin, with berths for the boats.
  fill(16, 23, 44, 46, T.PIER);
  fill(16, 21, 50, 52, T.PIER);

  // Harbour buildings along the apron.
  fill(6, 11, 41, 47, T.BUILDING);          // Fish Market Hall
  fill(6, 10, 49, 54, T.BUILDING);          // Ferry Terminal
  set(11, 43, T.PATH); set(10, 51, T.PATH); // their doorways onto the apron

  // Vendor stalls line the quay in front of the market hall.
  fill(12, 13, 41, 47, T.STALL);

  // Moored boats at the pier heads.
  set(22, 44, T.BOAT); set(22, 45, T.BOAT);
  set(20, 50, T.BOAT); set(20, 51, T.BOAT);

  // Lanterns marking the quay road, and one at the breakwater root.
  for (const [r,c] of [[14,41],[14,47],[14,53],[15,COLS-5]] as [number,number][]) set(r, c, T.LANTERN);

  return m;
}

export class SunriseCityScene extends Phaser.Scene {
  private map!: Tile[][];
  public buildingPlots = [
    ...BUILDINGS.map((b, i) => ({ x: b.x, y: b.y, w: b.w, h: b.h, model: ['pokecenter', 'sunrisegym', 'mart'][i] })),
    { x: 3, y: 1, w: 2, h: 4, model: 'tower' },   // the clifftop lighthouse as a 3D tower
    // ── Harbour landmarks ──
    { x: 41, y: 6, w: 6, h: 5, model: 'jejumarket' },   // Fish Market Hall
    { x: 49, y: 6, w: 5, h: 4, model: 'soolstation' },  // Ferry Terminal
  ];
  public onlyNamedBuildings = true;
  // The clifftop city has tall rock/edge tiles that otherwise extrude into walls
  // that bury the player. caveFloorHint applies the wall-height cap (and dark-
  // floor rule) without switching to cave lighting, so the player stays visible.
  public caveFloorHint = true;
  // Street lamps framing the gym gate + boulevard, and the Fish Market row as 3D
  // vendor stalls (coords mirror the T.LANTERN / T.STALL tiles).
  public propPlots = [
    ...([[18, 12], [22, 12], [9, 11], [29, 11]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'streetlamp' as const })),
    ...([[6, 17], [8, 17], [10, 17]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'stall' as const })),
    // The moored rowboat (naruetbae) at the pier — the T.BOAT tiles (row 26,
    // cols 8-9) render as flat brown ground in 3D, so drop a real 3D boat that
    // spans the 2-wide berth (x 8.5 → world centre 9.0 straddles both cols).
    { x: 8.5, y: 26, kind: 'boat' as const },

    // ── Harbour: the fleet ──
    { x: 43.5, y: 22, kind: 'boat' as const },
    { x: 49.5, y: 20, kind: 'boat' as const, rot: 0.18 },
    // Fish market row along the quay (in front of the market hall).
    ...([41, 43, 45] as number[]).map(x => ({ x, y: 12, kind: 'fishstall' as const })),
    // Quayside working clutter.
    ...([[47, 12], [48, 15], [40, 15]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'crates' as const })),
    ...([[52, 12], [53, 15]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'dryingrack' as const })),
    ...([[46, 15], [51, 15], [42, 15]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'net' as const })),
    // Mooring bollards along the pier heads and quay edge.
    ...([[44, 16], [45, 22], [50, 16], [51, 20], [47, 15], [41, 15]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'bollard' as const })),
    // Channel buoys marking the harbour entrance.
    ...([[48, 24], [42, 24], [46, 19]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'buoy' as const })),
    // Lamps along the new quay road.
    ...([[41, 14], [47, 14], [53, 14]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'streetlamp' as const })),
    // A second aisle of stalls on the apron in front of the market hall, so the
    // quayside reads as a working market square rather than an empty forecourt.
    ...([48, 50, 52] as number[]).map(x => ({ x, y: 11, kind: 'fishstall' as const })),
    ...([[47, 10], [51, 10], [54, 11]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'crates' as const })),
    ...([[49, 13], [45, 10], [43, 15]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'dryingrack' as const })),
    ...([[40, 11], [44, 9], [52, 9]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'net' as const })),
    ...([[42, 9], [46, 9], [50, 9], [54, 9]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'streetlamp' as const })),
  ];

  /** Twenty individually authored 3D townsfolk. Their silhouettes, clothes and
   *  placement reflect a dawn fishing port rather than a repeated generic NPC. */
  public crowdPlots: CrowdPlot[] = [
    // Fish-market row: three generations of sellers behind the counters.
    { x: 41, y: 11, look: 'sunrise_fishmonger', rot: Math.PI, behaviour: 'stand', profile: {
      skin: 0xb8794f, hair: 0x30241d, outfit: 0x244f68, secondary: 0xe7dcc4, accent: 0xe46b32,
      trousers: 0x273842, shoes: 0x17191b, body: 'broad', outfitStyle: 'uniform', hairStyle: 'short', hat: 'wide', height: 1.04,
    } },
    { x: 43, y: 11, look: 'sunrise_crab_seller', rot: Math.PI, behaviour: 'stand', profile: {
      skin: 0xe1ad82, hair: 0x57504a, outfit: 0x8d3f52, secondary: 0xf0dfc8, accent: 0xe3a63c,
      trousers: 0x44313a, shoes: 0x272125, body: 'average', outfitStyle: 'hanbok', hairStyle: 'bun', glasses: true, height: 0.96,
    } },
    { x: 45, y: 11, look: 'sunrise_sashimi_vendor', rot: Math.PI, behaviour: 'stand', profile: {
      skin: 0xf0c49b, hair: 0x1b2024, outfit: 0x26786f, secondary: 0xe8f0df, accent: 0xf28a3a,
      trousers: 0x203b3a, shoes: 0x172020, body: 'slim', outfitStyle: 'uniform', hairStyle: 'braid', scarf: 0xf0d9a8, height: 1.01,
    } },

    // Early shoppers move slowly along the market frontage.
    { x: 41, y: 13, look: 'sunrise_photographer', rot: Math.PI, behaviour: 'stroll', axis: 'x', range: 1.1, speed: 0.34, profile: {
      skin: 0xd99d72, hair: 0x36231d, outfit: 0xb85b35, secondary: 0x2d4359, accent: 0xf0c85a,
      trousers: 0x26303b, shoes: 0x202126, body: 'slim', outfitStyle: 'coat', hairStyle: 'bob', hat: 'beret', glasses: true, height: 0.94,
    } },
    { x: 44, y: 13, look: 'sunrise_market_chef', rot: Math.PI, behaviour: 'stroll', axis: 'x', range: 0.9, speed: 0.3, profile: {
      skin: 0xf1c8a2, hair: 0x211c18, outfit: 0xeee8dc, secondary: 0x285d78, accent: 0xd34738,
      trousers: 0x283847, shoes: 0x1a1d20, body: 'average', outfitStyle: 'uniform', hairStyle: 'spiky', scarf: 0xd34738, height: 1.06,
    } },

    // Working waterfront: a rain-slicker fisher and a haenyeo diver.
    { x: 44, y: 18, look: 'sunrise_pier_fisher', rot: Math.PI / 2, behaviour: 'stand', profile: {
      skin: 0xc8895d, hair: 0x40342b, outfit: 0xe1ad2f, secondary: 0x24465e, accent: 0xf5df76,
      trousers: 0x293f50, shoes: 0x17222a, body: 'broad', outfitStyle: 'winter', hairStyle: 'short', hat: 'wide', scarf: 0xc64235, height: 1.08,
    } },
    { x: 50, y: 17, look: 'sunrise_haenyeo', rot: -Math.PI / 2, behaviour: 'stand', profile: {
      skin: 0xa96f49, hair: 0x17181b, outfit: 0x172f43, secondary: 0x3b8da3, accent: 0xf09a3e,
      trousers: 0x132638, shoes: 0x11191e, body: 'slim', outfitStyle: 'uniform', hairStyle: 'short', hat: 'hood', glasses: true, height: 0.92,
    } },
    { x: 48, y: 13, look: 'sunrise_harbour_foreman', rot: Math.PI, behaviour: 'stand', profile: {
      skin: 0xd39b72, hair: 0x76716b, outfit: 0x334e64, secondary: 0xd7e0df, accent: 0xe57b32,
      trousers: 0x293845, shoes: 0x171b1e, body: 'heroic', outfitStyle: 'uniform', hairStyle: 'short', glasses: true, height: 1.07,
    } },

    // Landmark keepers anchor the old town to the sunrise lookout.
    { x: 31.5, y: 4, look: 'sunrise_astronomer', rot: 0, behaviour: 'stand', profile: {
      skin: 0xf0c6a0, hair: 0x2c2538, outfit: 0xcadbe4, secondary: 0x3d5674, accent: 0xf2ba45,
      trousers: 0x35435a, shoes: 0x222632, body: 'slim', outfitStyle: 'coat', hairStyle: 'long', glasses: true, scarf: 0x596aa0, height: 1.03,
    } },
    { x: 6, y: 4, look: 'sunrise_lighthouse_keeper', rot: -Math.PI / 2, behaviour: 'stand', profile: {
      skin: 0xc98b63, hair: 0xe4e0d6, outfit: 0xf1ead9, secondary: 0x284d6b, accent: 0xc83e35,
      trousers: 0x294354, shoes: 0x20252a, body: 'average', outfitStyle: 'uniform', hairStyle: 'topknot', prop: 'lantern', height: 1.0,
    } },

    // A locally dressed couple watches dawn from the seaside park.
    { x: 27, y: 18, look: 'sunrise_park_artist', rot: Math.PI, behaviour: 'stand', profile: {
      skin: 0xf1caa5, hair: 0x5f3829, outfit: 0xd86d63, secondary: 0xf4d6b2, accent: 0x2e7185,
      trousers: 0x784d58, shoes: 0x392a2d, body: 'slim', outfitStyle: 'hanbok', hairStyle: 'braid', scarf: 0xf3b64a, height: 0.97,
    } },
    { x: 28, y: 18, look: 'sunrise_park_boatbuilder', rot: Math.PI, behaviour: 'stand', profile: {
      skin: 0xb87850, hair: 0x29211c, outfit: 0x527b9b, secondary: 0xe8d8bb, accent: 0xc67a35,
      trousers: 0x35495c, shoes: 0x25272a, body: 'broad', outfitStyle: 'hanbok', hairStyle: 'topknot', height: 1.1,
    } },

    // Second market aisle: shellfish, seaweed and ice vendors each read distinctly.
    { x: 48, y: 10, look: 'sunrise_shellfish_vendor', rot: Math.PI, behaviour: 'stand', profile: {
      skin: 0xdcaa82, hair: 0x462e23, outfit: 0xa74e2f, secondary: 0xe8c68d, accent: 0x315d76,
      trousers: 0x48352f, shoes: 0x211b19, body: 'broad', outfitStyle: 'coat', hairStyle: 'wild', hat: 'wide', height: 1.02,
    } },
    { x: 50, y: 10, look: 'sunrise_seaweed_vendor', rot: Math.PI, behaviour: 'stand', profile: {
      skin: 0xc98d65, hair: 0x272921, outfit: 0x3e714f, secondary: 0xd8d3a4, accent: 0x9fbd55,
      trousers: 0x30483a, shoes: 0x20241f, body: 'average', outfitStyle: 'hanbok', hairStyle: 'bun', scarf: 0xd4a543, height: 0.91,
    } },
    { x: 52, y: 10, look: 'sunrise_ice_vendor', rot: Math.PI, behaviour: 'stand', profile: {
      skin: 0xedc39e, hair: 0x73523a, outfit: 0x8fc7d8, secondary: 0xf2f4eb, accent: 0x276783,
      trousers: 0x3b6070, shoes: 0x1c2a31, body: 'slim', outfitStyle: 'winter', hairStyle: 'spiky', scarf: 0xf4e07b, height: 1.09,
    } },

    // Browsers, net-mender and ferry passenger fill the quay without cloning silhouettes.
    { x: 27, y: 13, look: 'sunrise_gym_fan', rot: Math.PI, behaviour: 'stroll', axis: 'x', range: 0.8, speed: 0.42, profile: {
      skin: 0xe2ad85, hair: 0x213552, outfit: 0xe4bb2e, secondary: 0x252c3a, accent: 0xf5e66b,
      trousers: 0x2b3140, shoes: 0x1a1c22, body: 'slim', outfitStyle: 'trainer', hairStyle: 'bob', hat: 'beret', height: 0.95,
    } },
    { x: 46, y: 11, look: 'sunrise_net_mender', rot: Math.PI, behaviour: 'stand', profile: {
      skin: 0xa86d48, hair: 0xe7e3da, outfit: 0x715641, secondary: 0xc6ad82, accent: 0x3f7181,
      trousers: 0x4a4038, shoes: 0x29231f, body: 'slim', outfitStyle: 'robe', hairStyle: 'bun', glasses: true, height: 0.89,
    } },
    { x: 53, y: 12, look: 'sunrise_ferry_traveller', rot: -Math.PI / 2, behaviour: 'stand', profile: {
      skin: 0xf0c7a1, hair: 0x362a43, outfit: 0x534f88, secondary: 0xd9d5eb, accent: 0xe49b3e,
      trousers: 0x363653, shoes: 0x252334, body: 'average', outfitStyle: 'coat', hairStyle: 'long', hat: 'beret', scarf: 0xe4c76f, height: 1.05,
    } },

    // Porters nearest the catch use the heaviest work silhouettes in the crowd.
    { x: 45, y: 14, look: 'sunrise_dock_porter', rot: 0, behaviour: 'stand', profile: {
      skin: 0x9f633f, hair: 0x241d18, outfit: 0xc5652f, secondary: 0x3f4b50, accent: 0xf0b94c,
      trousers: 0x343d43, shoes: 0x181b1d, body: 'heroic', outfitStyle: 'uniform', hairStyle: 'wild', scarf: 0x263f54, height: 1.12,
    } },
    { x: 51, y: 14, look: 'sunrise_deckhand', rot: 0, behaviour: 'stand', profile: {
      skin: 0xd9986c, hair: 0x101820, outfit: 0x2f6681, secondary: 0xd9e5e8, accent: 0xd8493d,
      trousers: 0x263e50, shoes: 0x151c22, body: 'broad', outfitStyle: 'uniform', hairStyle: 'short', scarf: 0xd8493d, height: 0.99,
    } },
  ];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = 19 * TILE + 16; private py = 24 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private readonly SPEED = 120; private readonly RUN = 250;

  private rivalCol = 26; private rivalRow = 14;
  /** The rival waits at Sunrise only until the last gym is cleared, then heads off. */
  private get rivalHere(): boolean { return !this.registry.get('sunriseGymDefeated'); }

  constructor() { super('SunriseCityScene'); }

  create() {
    playBgm(this, 'sunrise');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('sunriseCityReturnX') as number | undefined;
    const ry = this.registry.get('sunriseCityReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('sunriseCityReturnX'); this.registry.remove('sunriseCityReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    if (this.rivalHere) this.drawRival();
    this.createPlayer();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [T.SEA], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'SunriseCityScene');

    if (!this.registry.get('sunriseVisited')) {
      this.registry.set('sunriseVisited', true);
      this.time.delayedCall(700, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'You reach Sunrise City (일출 시티) — the easternmost city, first to greet the dawn.',
          'Volcanic rock, a black-sand beach, and a lighthouse over the East Sea. The great Gym crowns the plaza.',
          `${rivalTrainerName(this.registry)}: The Sunrise Gym is the LAST one. Take this leader down and the League is within reach.`,
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
      if (t === T.SEA) { g.fillStyle(0x66bbe6, 0.4); g.fillRect(x+4, y+10, 12, 3); g.fillRect(x+14, y+22, 10, 3); }
      if (t === T.SAND) { g.fillStyle(0x4a4a52, 0.7); g.fillCircle(x+8, y+10, 2); g.fillStyle(0x1e1e26, 0.7); g.fillCircle(x+22, y+20, 2); }
      if (t === T.PATH) { g.fillStyle(0xb2a48e, 0.5); g.fillRect(x+3, y+6, TILE-6, 3); }
      if (t === T.CLIFF) { g.fillStyle(0x55493f); g.fillTriangle(x+16, y+6, x+4, y+28, x+28, y+28); }
      if (t === T.LOOKOUT) { g.fillStyle(0xffc060, 0.35); g.fillRect(x, y, TILE, 4); g.fillStyle(0xb98a3a, 0.4); g.fillRect(x, y+TILE-3, TILE, 3); }
      if (t === T.GRASS) { g.fillStyle(0x5f9a4a, 0.5); g.fillRect(x+5, y+8, 4, 6); g.fillRect(x+20, y+16, 4, 6); }
      if (t === T.FLOWER) { const cs=[0xff6a9a,0xffffff,0xffdd55,0xd06aff]; for(let i=0;i<4;i++){ g.fillStyle(cs[i%4],1); g.fillCircle(x+8+(i%2)*14, y+9+Math.floor(i/2)*12, 2.4);} }
      if (t === T.TREE) { g.fillStyle(0x1e421e); g.fillCircle(x+16, y+16, 12); g.fillStyle(0x347a34); g.fillCircle(x+12, y+13, 6); g.fillCircle(x+21, y+16, 5); }
      if (t === T.LANTERN) { g.fillStyle(0x777066); g.fillRect(x+12, y+8, 8, 20); g.fillStyle(0xffdd88); g.fillRect(x+10, y+4, 12, 8); g.fillStyle(0xffb84a,0.6); g.fillCircle(x+16, y+8, 5); }
      if (t === T.STALL) { g.fillStyle(0xa0622f); g.fillRect(x+1, y+9, TILE-2, TILE-9); g.fillStyle(0xd84a3a); g.fillRect(x, y+2, TILE, 7); g.fillStyle(0xffd0a0,0.5); g.fillRect(x+2, y+3, TILE-4, 4); g.fillStyle(0x88b8ff,0.6); g.fillCircle(x+8, y+18, 3); g.fillStyle(0xff9a5a,0.7); g.fillCircle(x+22, y+18, 3); }
      if (t === T.PIER) { g.fillStyle(0x9a6a3a); for (let i=0;i<TILE;i+=8) g.fillRect(x, y+i, TILE, 2); g.fillStyle(0x6a4a24); g.fillRect(x+2, y, 3, TILE); g.fillRect(x+TILE-5, y, 3, TILE); }
    }
    // Sunrise glow over the lookout
    g.fillStyle(0xff9a3a, 0.25); g.fillRect(0, 0, COLS * TILE, 5 * TILE);
    const key = '__sunriseMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    // ── Landmark overlays (multi-tile) ──
    const lm = this.add.graphics().setDepth(2);
    // Lighthouse (cols 3-4, rows 1-5)
    { const x = 3 * TILE, y = 1 * TILE, w = 2 * TILE, h = 4 * TILE;
      lm.fillStyle(0xf4f2ec); lm.fillRect(x + 6, y, w - 12, h);
      lm.fillStyle(0xd83a3a); for (let i = 0; i < 4; i++) lm.fillRect(x + 6, y + 6 + i * 18, w - 12, 8);
      lm.fillStyle(0x3a3a44); lm.fillRect(x + 2, y - 12, w - 4, 14);         // lamp housing
      lm.fillStyle(0xffe066, 0.9); lm.fillCircle(x + w / 2, y - 5, 7);       // beacon
      lm.fillStyle(0xffe066, 0.2); lm.fillTriangle(x + w / 2, y - 5, x + w + 30, y - 20, x + w + 30, y + 10); }
    // Observatory dome (cols 33-35, rows 1-4)
    { const x = 33 * TILE, y = 1 * TILE, w = 3 * TILE;
      lm.fillStyle(0xcfd6de); lm.fillRect(x + 4, y + TILE, w - 8, 2 * TILE);
      lm.fillStyle(0xaeb6c2); lm.fillEllipse(x + w / 2, y + TILE, w - 6, TILE * 1.4);
      lm.fillStyle(0x2a2f3a); lm.fillRect(x + w / 2 - 3, y + 4, 6, TILE);    // dome slit
      lm.fillStyle(0xffffff, 0.4); lm.fillEllipse(x + w / 2 - 8, y + TILE - 6, 14, 10); }
    // The moored pier boat (row 26, cols 8-9) is now a real 3D model (see the
    // 'boat' propPlot), so its flat 2D hull/sail drawing is intentionally gone.

    // ── Enterable buildings ──
    const bg = this.add.graphics().setDepth(2);
    for (const b of BUILDINGS) {
      const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
      bg.fillStyle(0xefe4d0); bg.fillRect(x, y, w, h); bg.lineStyle(2, 0x333333); bg.strokeRect(x, y, w, h);
      bg.fillStyle(b.roof); bg.fillTriangle(x - 4, y, x + w / 2, y - TILE, x + w + 4, y);
      bg.fillStyle(0x88ccff, 0.7);
      for (let wx = 8; wx < w - 8; wx += 22) bg.fillRect(x + wx, y + 14, 14, 16);
      const dx = b.doorCol * TILE, dy = (b.y + b.h - 1) * TILE;
      bg.fillStyle(0x6b4a28); bg.fillRect(dx + 4, dy, TILE - 8, TILE);
      // The Gym gets a Poké Ball crest on its gable so it reads as THE gym.
      if (b.scene === 'SunriseGymScene') {
        const cx = x + w / 2, cy = y - TILE + 6;
        bg.fillStyle(0xcc2a2a); bg.fillCircle(cx, cy, 7);            // red ball
        bg.fillStyle(0x222222); bg.fillRect(cx - 7, cy - 1, 14, 3); // black equator band
        bg.fillStyle(0xffffff); bg.fillCircle(cx, cy, 2.4);         // white centre button
        bg.lineStyle(1, 0x222222); bg.strokeCircle(cx, cy, 2.4);
      }
      const isGym = b.scene === 'SunriseGymScene';
      this.add.text((b.x + b.w / 2) * TILE, (b.y - 1.2) * TILE, isGym ? '🏟️ Sunrise Gym — 8th Badge' : tr(b.label), {
        fontSize: isGym ? '10px' : '9px', color: isGym ? '#ffe44e' : '#fff', fontStyle: isGym ? 'bold' : 'normal',
        backgroundColor: '#00000099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(3);
    }

    // Landmark + directional labels
    const label = (col: number, row: number, text: string, color = '#fff', bgc = '#00000099') =>
      this.add.text(col * TILE, row * TILE, text, { fontSize: '9px', color, backgroundColor: bgc, padding: { x: 3, y: 2 } })
        .setOrigin(0.5).setDepth(5);
    label(4, 5.7, '🗼 Lighthouse', '#fff', '#1a3a6a99');
    label(34.5, 4.6, '🔭 Observatory', '#fff', '#1a3a6a99');
    label(8, 16.4, '🐟 Fish Market', '#fff', '#5a3a1a99');
    label(28, 20.6, '🌳 Seaside Park', '#dfffd0', '#1a4a1a99');
    this.add.text(20 * TILE, 2.5 * TILE, tr('⛰ The Sunrise Cliffs'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#aa5a1acc', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(20 * TILE, 27.4 * TILE, tr('↓ Eastern Shore Road'), {
      fontSize: '9px', color: '#444', backgroundColor: '#ffffffaa', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawRival() {
    const g = this.add.graphics().setDepth(8);
    g.setPosition(this.rivalCol * TILE + 16, this.rivalRow * TILE + 16);
    drawTrainerBody(g, 0, 0, rivalDesign(this.registry));
    markRivalPortrait(g, this.registry);
    this.add.text(this.rivalCol * TILE + 16, this.rivalRow * TILE - 12, rivalTrainerName(this.registry), {
      fontSize: '8px', color: '#88ccff', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(9);
  }

  // ── Player / camera / input ──────────────────────────────────────────────
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
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => {
      if (this.cutsceneActive || !hasBike(this.registry)) return;
      this.cycling = !this.cycling;
      this.drawChar();
    });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 340, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🌅 Sunrise City (일출 시티)'), {
      fontSize: '14px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 34, '', {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  C: bike  SPACE: enter/talk  M: menu'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(_: number, delta: number) {
    if (this.cutsceneActive) {
      if (this.dialog.isInChoice()) {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.dialog.navigateChoice(-1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.dialog.navigateChoice(1);
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.confirmChoice();
      } else if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
      return;
    }
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
    this.checkRival();
    this.checkCliffTrail();
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

  /** Talk to the Rival: once the last badge + seventh tablet are in hand, set out for
   *  Baekdu Peak (Chapter 11). Otherwise, a simple nudge toward the Gym. */
  private checkRival() {
    if (!this.rivalHere) return;   // rival has left after the final badge
    const dx = this.px - (this.rivalCol * TILE + 16), dy = this.py - (this.rivalRow * TILE + 16);
    if (Math.hypot(dx, dy) > TILE * 1.5) { if (!this.nearBuilding()) this.enterPrompt.setVisible(false); return; }
    this.enterPrompt.setText(`${tr('SPACE: talk to')} ${speakerName(rivalTrainerName(this.registry))}`).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    this.cutsceneActive = true;
    this.enterPrompt.setVisible(false);
    const rn = rivalTrainerName(this.registry);

    // Phase 1 ends at the Onnuri League — no more pre-League flight to Baekdu Peak.
    // (Baekdu / the Cheonji spirit is now a post-League, northern-region destination.)
    if (this.registry.get('sunriseGymDefeated')) {
      this.dialog.show([
        `${rn}: Eight badges — you did it. The Onnuri League is waiting; the Scholars' Road opens from the Capitol now.`,
        `${rn}: Baekdu Peak? That's a story for after we've earned the title. Let's go become Champions first.`,
      ], () => { this.cutsceneActive = false; });
    } else {
      this.dialog.show([
        `${rn}: The Sunrise Gym's right there in the plaza — the last badge before the League.`,
        `${rn}: Take the leader down, then it's straight on to the Onnuri League.`,
      ], () => { this.cutsceneActive = false; });
    }
  }

  /** The cliff lookout is the trailhead — climbing leads up the Sunrise Cliffs. */
  private checkCliffTrail() {
    if (isSurfing(this.playerG)) return;
    if (this.cutsceneActive) return;
    if (this.py < 2 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('sunCliff1ReturnX', 12 * 32 + 16); this.registry.set('sunCliff1ReturnY', 41 * 32 + 16);
        this.scene.start('SunriseCliff1Scene');
      });
    }
  }

  private nearBuilding(): boolean {
    for (const b of BUILDINGS) {
      const dx = this.px - (b.doorCol * TILE + TILE / 2), dy = this.py - ((b.y + b.h - 1) * TILE + TILE / 2);
      if (Math.hypot(dx, dy) < TILE * 1.3) return true;
    }
    return false;
  }

  private checkBuildings() {
    let near: Building | null = null;
    for (const b of BUILDINGS) {
      const dx = this.px - (b.doorCol * TILE + TILE / 2), dy = this.py - ((b.y + b.h - 1) * TILE + TILE / 2);
      if (Math.hypot(dx, dy) < TILE * 1.3) { near = b; break; }
    }
    if (near) {
      this.enterPrompt.setText(`${tr('SPACE — Enter')} ${tr(near.label)}`).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        const b = near;
        if (b.scene === '__SHOP__') { this.registry.set('martReturnScene', this.scene.key); this.registry.set('sunriseCityReturnX', b.doorCol * TILE + TILE / 2); this.registry.set('sunriseCityReturnY', (b.y + b.h) * TILE + TILE / 2); this.cutsceneActive = true; this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('MartScene')); return; }
        this.registry.set('sunriseCityReturnX', b.doorCol * TILE + TILE / 2);
        this.registry.set('sunriseCityReturnY', (b.y + b.h) * TILE + TILE / 2);
        this.cutsceneActive = true;
        this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(b.scene));
      }
    } else if (!this.nearRival()) this.enterPrompt.setVisible(false);
  }

  private nearRival(): boolean {
    return this.rivalHere && Math.hypot(this.px - (this.rivalCol * TILE + 16), this.py - (this.rivalRow * TILE + 16)) <= TILE * 1.5;
  }

  private checkExit() {
    if (isSurfing(this.playerG)) return;
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('seoraeReturnX', 11 * 32 + 16); this.registry.set('seoraeReturnY', 2 * 32);
        this.scene.start('SeoraeTownScene');   // back up to Seorae → Dolmoe → Route 6
      });
    }
  }

  static healParty(scene: Phaser.Scene) { PartySystem.healAll(scene.registry); }
}
