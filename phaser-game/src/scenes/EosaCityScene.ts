import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { PartySystem } from '../systems/PartySystem';
import { hasMapae, awardMapae } from '../data/Mapae';
import { vanishesAfterDefeat } from '../data/Villains';
import { markTrainerPortrait } from '../data/BattlePortraits';
import { showRewardCeremony } from '../systems/RewardCeremony';

// ── Shared base for the northern 어사대 (Inspectorate) circuit cities ─────────────
// Each city is a small subclass that passes an EosaCity config. The base builds a
// generic northern town — Pokémon Center, 어사대 Hall (with the Chief), Poké Mart —
// tinted to the city's palette, plus a linear north/south road linking the circuit.
// Clearing the Chief's exam awards that city's 마패.

export interface Exit { scene: string; x: number; y: number; returnKey?: string; }
export interface EosaCity {
  key: string; name: string; mapaeKey: string;
  chiefKey: string; chiefName: string; bgm: string;
  ground: number; accent: number; hallRoof: number; robe: number;
  team: { id: number; level: number; custom?: string }[]; expPool: number;
  intro: string[]; examLead: string; award: string[];
  mission?: EosaMission;      // a threat the Chief sends you to quell BEFORE the exam
  examBattle?: ExamBattle;    // pass the test by beating THIS opponent (e.g. a 노스단 officer) instead of the Chief
  water?: EosaWater;          // a Surf-only sea (e.g. Parangpo's West Sea, where the Gyarados lurks)
  trainers?: EosaTrainer[];   // roadside trainers to battle (e.g. on the way to the shore)
  npcs?: EosaNpc[];           // ambient townsfolk who chat when talked to (fills out a town)
  trees?: { col: number; row: number; kind?: 'palm' | 'pine' | 'cherry'; scale?: number }[]; // designed 3D trees (e.g. Parangpo's seaside palms)
  size?: { cols: number; rows: number };   // enlarge the city beyond the 28×20 default
  landmarks?: EosaLandmark[]; // extra decorative structures (docks, lighthouse, monuments…)
  buildingModels?: string[];  // named 3D models to cycle for this city's generic building landmarks (else free CC0 assets) — e.g. Binghagwan reuses the snowy Seorae models
  sideExit?: { col: number; scene: string; label: string; icon?: string; road?: boolean };   // a path down the south edge to another map (beach, mine…)
  gateExit?: { col: number; scene: string; label: string };   // a walk-through gateway in the NORTH wall (2-tile opening at `col`) — e.g. Haesol's gate up to Gwanmunseong
  accessRoads?: EosaAccessRoad[]; // authored spurs from the main street to remote landmarks
  prev?: Exit; next?: Exit;   // south / north neighbours on the circuit
}

export interface EosaAccessRoad {
  fromCol: number; fromRow: number;
  toCol: number; toRow: number;
  width?: number;
  label?: string;
}

// Some Chiefs let you earn the 마패 by defeating a specific foe — a captured 노스단
// officer, say — rather than dueling the Chief. Its `key`'s defeat awards the 마패.
export interface ExamBattle {
  key: string; name: string;
  team: { id: number; level: number; custom?: string }[]; expPool: number;
  intro: string[];   // shown when you accept the test, before the fight
}

// A unique errand each Chief sets before granting the exam: a rampaging Pokémon
// menacing the province. Beat it (a one-Pokémon boss battle keyed by `threatKey`,
// whose `trainerDefeated_<threatKey>` flag gates the exam) and report back.
export interface EosaMission {
  blurb: string[];      // Chief hands you the mission
  reminder: string;     // Chief's nudge while it's still loose
  cleared: string[];    // Chief's praise when you report back (shown once, then the exam)
  threatKey: string;    // e.g. 'eosa-nampo-threat'
  threatName: string;   // display name shown on the marker & battle
  threatMon: { id: number; level: number; custom?: string };
  col: number; row: number;   // where it lurks in the city
  approach: string[];   // shown when you reach it, before the fight
  color?: number;       // marker tint
  remote?: boolean;     // the threat is confronted on ANOTHER map (e.g. the beach) — no in-city marker
  gauntlet?: string[];  // instead of one threat, clear ALL these trainer keys (e.g. a dojo gauntlet)
}

const T = { GROUND: 0, ROAD: 1, BUILDING: 2, TREE: 3, ACCENT: 4, FLOWER: 5, WATER: 6, SAND: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, DEF_COLS = 28, DEF_ROWS = 20;   // default city size (per-city override via cfg.size)
const SOLID = new Set<Tile>([T.BUILDING, T.TREE]);   // WATER handled separately (crossable only with Surf)

/** A decorative city landmark (lighthouse, docks, monument…). Drawn on top of the
 *  map; a `solid` one also blocks its footprint. */
export interface EosaLandmark {
  col: number; row: number; w: number; h: number;
  color: number; label: string; kind?: 'building' | 'lighthouse' | 'monument' | 'pavilion' | 'station' | 'rail' | 'hideout'; solid?: boolean;
  enter?: string;    // a scene to enter via a door at the landmark's foot (e.g. a restaurant interior)
  enterId?: string;  // if `enter` is the generic NorthernBuildingScene, which building config to show
}

/** An optional sea a city can carve into its lower map — WATER tiles (cols c1..c2-1,
 *  rows r1..r2-1) crossable only by Surf, fronted by a SAND beach on column c2.
 *  Whirlpools are a surf mini-game hazard: drift into one and Gyarados's brood
 *  drags you into a wild battle, and you're swept back to the beach to try again. */
export interface EosaWater {
  c1: number; c2: number; r1: number; r2: number;
  whirlpools?: { c: number; r: number }[];
  minion?: { id: number; level: number; catchRate: number };
  beachX?: number; beachY?: number;   // where a whirlpool sweeps you back to (px,py)
}

/** A roadside trainer standing in a city (e.g. along the way down to the sea). */
export interface EosaTrainer {
  key: string; name: string; col: number; row: number; color: number; label: string;
  line: string; pokemon: string; expPool: number;
}

/** An ambient townsperson — stands around and speaks a line or two when talked to. */
export interface EosaNpc {
  col: number; row: number; color: number;
  lines: string[]; label?: string; hair?: number; frame?: number;
}

interface Bldg { label: string; scene: string; x: number; y: number; w: number; h: number; doorCol: number; roof: number; hall?: boolean; }
const BUILDINGS: Bldg[] = [
  { label: 'Pokémon Center', scene: 'PokemonCenterScene', x: 2,  y: 4, w: 5, h: 5, doorCol: 4,  roof: 0xcc2244 },
  { label: '어사대 Hall',     scene: '__HALL__',           x: 10, y: 3, w: 8, h: 6, doorCol: 13, roof: 0x9a3a2a, hall: true },
  { label: 'Poké Mart',      scene: '__SHOP__',           x: 21, y: 4, w: 5, h: 5, doorCol: 23, roof: 0x2a6a9a },
];
const CHIEF = { col: 13, row: 9 };   // stands in the 어사대 Hall doorway (door drawn at col 13, rows 8–9)

function buildMap(cols: number, rows: number, skipDefaultTrees = false): Tile[][] {
  const m: Tile[][] = Array.from({ length: rows }, () => Array(cols).fill(T.GROUND) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<rows&&c>=0&&c<cols) m[r][c] = t;
  };
  const set = (r: number, c: number, t: Tile) => { if (r>=0&&r<rows&&c>=0&&c<cols) m[r][c] = t; };
  fill(9, 11, 1, cols - 1, T.ROAD);      // main road
  fill(0, rows, 13, 15, T.ROAD);         // circuit road (N-S)
  for (const b of BUILDINGS) { fill(b.y, b.y + b.h, b.x, b.x + b.w, T.BUILDING); set(b.y + b.h, b.doorCol, T.ROAD); }
  // themed accents + greenery. Cities that design their own scenery (cfg.trees,
  // e.g. Parangpo's palms, or Binghagwan which wants a clean frozen ground) skip
  // ALL the flat decoration tiles so nothing renders as a stray bush/blob near the
  // buildings, gates and paths in 3D.
  if (!skipDefaultTrees) {
    for (const [r,c] of [[13,4],[14,7],[16,5],[13,22],[15,24],[17,21]] as [number,number][]) set(r, c, T.ACCENT);
    for (const [r,c] of [[3,2],[3,25],[16,2],[16,25],[12,9],[12,18]] as [number,number][]) set(r, c, T.TREE);
    for (const [r,c] of [[12,11],[12,16],[15,12],[15,16]] as [number,number][]) set(r, c, T.FLOWER);
  }
  return m;
}

export abstract class EosaCityScene extends Phaser.Scene {
  private map!: Tile[][];
  /** The three standard buildings reuse the custom Higgsfield models (Pokémon
   *  Center + Poké Mart), the 어사대 Hall uses the palace model, and every city
   *  landmark (fish market, tavern, lighthouse, monument…) rises as a 3D
   *  building too — lighthouses as towers, the rest as free CC0 city buildings.
   *  Non-structural landmarks (rail lines, cave hideouts) are left flat. */
  public get buildingPlots(): { x: number; y: number; w: number; h: number; model?: string }[] {
    const std = BUILDINGS.map((b, i) => ({
      x: b.x, y: b.y, w: b.w, h: b.h, model: ['pokecenter', 'palace', 'mart'][i],
    }));
    const MODEL: Record<string, string | undefined> = { lighthouse: 'tower' };
    const SKIP = new Set(['rail', 'hideout']);
    const pool = this.cfg.buildingModels;
    let bi = 0;
    const marks = (this.cfg.landmarks ?? [])
      .filter(l => l.w > 0 && l.h > 0 && !SKIP.has(l.kind ?? 'building'))
      .map(l => {
        const kind = l.kind ?? 'building';
        // Cities can opt their generic buildings into a named-model pool (e.g.
        // Binghagwan's snowy Seorae models); otherwise they fall back to free assets.
        let model = MODEL[kind];
        if (!model && pool && (kind === 'building' || kind === 'monument' || kind === 'pavilion')) {
          model = pool[bi++ % pool.length];
        }
        return { x: l.col, y: l.row, w: l.w, h: l.h, model };
      });
    return [...std, ...marks];
  }
  /** Rail landmarks (e.g. Binghagwan's line to the 미지의 대륙) become real 3D track —
   *  gravel bed, sleepers and steel rails — laid along the landmark's span. */
  public get propPlots(): ({ x: number; y: number; kind: 'rail'; len: number }
    | { x: number; y: number; kind: 'palm' | 'pine' | 'cherry'; scale?: number })[] {
    const rails = (this.cfg.landmarks ?? [])
      .filter(l => l.kind === 'rail' && l.w > 0)
      .map(l => ({ x: l.col + l.w / 2 - 0.5, y: l.row, kind: 'rail' as const, len: l.w }));
    const trees = (this.cfg.trees ?? [])
      .map(t => ({ x: t.col, y: t.row, kind: (t.kind ?? 'palm') as 'palm' | 'pine' | 'cherry', scale: t.scale }));
    return [...rails, ...trees];
  }
  /** Landmark plots without a named model fall back to free CC0 city buildings. */
  public freeBuildings = true;
  /** Coastal/industrial northern towns have tall rock/dock tiles that otherwise
   *  bury the player — cap wall height (daylight unchanged) so the view stays clear. */
  public caveFloorHint = true;
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = 13.5 * TILE; private py = 17 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false; private spawnPx = 0; private spawnPy = 0;
  private readonly SPEED = 120; private readonly RUN = 250;

  protected cfg: EosaCity;
  private threatG?: Phaser.GameObjects.Container;
  private cols = DEF_COLS; private rows = DEF_ROWS;
  constructor(cfg: EosaCity) { super(cfg.key); this.cfg = cfg; }

  create() {
    const cfg = this.cfg;
    this.cols = cfg.size?.cols ?? DEF_COLS; this.rows = cfg.size?.rows ?? DEF_ROWS;
    playBgm(this, cfg.bgm);
    this.cutsceneActive = false; this.walkFrame = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get(cfg.key + 'ReturnX') as number | undefined;
    const ry = this.registry.get(cfg.key + 'ReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove(cfg.key + 'ReturnX'); this.registry.remove(cfg.key + 'ReturnY');
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true; this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap(this.cols, this.rows, !!cfg.trees);
    this.carveWater();
    this.carveSidePath();
    this.applyLandmarkSolids();
    this.carveAccessRoads();
    this.carveGate();
    this.drawMap();
    this.drawLandmarks();
    this.drawWhirlpools();
    this.drawTrainers();
    this.drawNpcs();
    this.drawSideSign();
    this.drawAccessRoadSigns();
    this.drawGate();
    this.spawnThreat();
    this.createPlayer();
    this.cameras.main.setBounds(0, 0, this.cols * TILE, this.rows * TILE);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, cfg.key);

    const passKey = cfg.examBattle?.key ?? cfg.chiefKey;   // who you must beat to earn this 마패
    if (this.registry.get('trainerDefeated_' + passKey) && !hasMapae(this.registry, cfg.mapaeKey)) {
      awardMapae(this.registry, cfg.mapaeKey);
      this.cutsceneActive = true;
      showRewardCeremony(this, {
        kind: 'mapae', key: cfg.mapaeKey,
        onComplete: () => this.dialog.show(cfg.award, () => { this.cutsceneActive = false; }),
      });
    } else if (!this.registry.get(cfg.key + 'Visited')) {
      this.registry.set(cfg.key + 'Visited', true);
      this.time.delayedCall(550, () => { this.cutsceneActive = true; this.dialog.show(cfg.intro, () => { this.cutsceneActive = false; }); });
    } else {
      this.time.delayedCall(300, () => maybeLaunchEvolution(this));
    }
  }

  private drawMap() {
    const cfg = this.cfg;
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      const base = t === T.ROAD ? 0xc9bba4 : t === T.ACCENT ? cfg.accent
                 : t === T.WATER ? 0x2f78b4 : t === T.SAND ? 0xe4d6a8 : cfg.ground;
      g.fillStyle(base, 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.GROUND || t === T.FLOWER) { g.fillStyle(0xffffff, 0.06); g.fillRect(x+5, y+7, 5, 4);
        if (t === T.FLOWER) { const cs=[0xff6a9a,0xffffff,0xffdd55]; for(let i=0;i<3;i++){ g.fillStyle(cs[i],1); g.fillCircle(x+9+i*7, y+12+(i%2)*8, 2.4);} } }
      if (t === T.ROAD) { g.fillStyle(0xb6a686, 0.5); g.fillRect(x+3, y+6, TILE-6, 3); }
      if (t === T.ACCENT) { g.fillStyle(0xffffff, 0.15); g.fillRect(x+4, y+5, TILE-8, 4); }
      if (t === T.WATER) { g.fillStyle(0x66b0e0, 0.5); g.fillRect(x+4, y+8, 13, 3); g.fillRect(x+13, y+20, 11, 3); g.fillStyle(0x1f5f96, 0.4); g.fillRect(x+2, y+15, 9, 2); }
      if (t === T.SAND) { g.fillStyle(0xd6c48c, 0.7); g.fillRect(x+6, y+10, 4, 3); g.fillRect(x+18, y+20, 4, 3); }
      if (t === T.TREE) { g.fillStyle(0x1e421e); g.fillCircle(x+16, y+15, 12); g.fillStyle(0x347a34); g.fillCircle(x+12, y+12, 6); g.fillStyle(0x5a3a20); g.fillRect(x+14, y+24, 4, 6); }
    }
    const key = '__eosa_' + cfg.key + '__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, this.cols * TILE, this.rows * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    const bg = this.add.graphics().setDepth(2);
    for (const b of BUILDINGS) {
      const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
      const roof = b.hall ? cfg.hallRoof : b.roof;
      bg.fillStyle(0xe8dcc6); bg.fillRect(x, y, w, h); bg.lineStyle(2, 0x3a2a1a); bg.strokeRect(x, y, w, h);
      bg.fillStyle(roof); bg.fillTriangle(x - 5, y + 2, x + w / 2, y - TILE + 2, x + w + 5, y + 2);
      if (b.hall) { bg.fillStyle(0x2a7a4a, 0.9); bg.fillRect(x - 4, y - 2, w + 8, 4); bg.fillStyle(0x2a5aba, 0.9); bg.fillRect(x - 4, y + 1, w + 8, 3); }
      bg.fillStyle(0x88ccff, 0.7); for (let wx = 8; wx < w - 8; wx += 22) bg.fillRect(x + wx, y + 16, 14, 14);
      bg.fillStyle(0x5a3a1a); bg.fillRect(b.doorCol * TILE + 4, (b.y + b.h - 1) * TILE, TILE - 8, TILE);
      this.add.text((b.x + b.w / 2) * TILE, (b.y - 1.2) * TILE, b.hall ? `🏛️ ${tr('어사대 Hall')} — ${speakerName(cfg.chiefName)}` : tr(b.label), {
        fontSize: b.hall ? '10px' : '9px', color: b.hall ? '#ffe44e' : '#fff', fontStyle: b.hall ? 'bold' : 'normal',
        backgroundColor: '#00000099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(3);
    }
    // Chief
    const cg = this.add.graphics().setDepth(8); drawNpcBody(cg, cfg.robe, { hair: 0x2a2622 });
    cg.setPosition(CHIEF.col * TILE + 16, CHIEF.row * TILE + 16);
    markTrainerPortrait(cg, cfg.chiefKey);
    this.add.text(CHIEF.col * TILE + 16, CHIEF.row * TILE - 12, speakerName(cfg.chiefName), {
      fontSize: '8px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 2, y: 1 },
    }).setOrigin(0.5).setDepth(9);
    // City banner + exit signs
    this.add.rectangle(this.scale.width / 2, 22, 340, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr(cfg.name), { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    if (cfg.next) this.add.text(14 * TILE, 0.5 * TILE, '⬆ ' + tr(cfg.next.scene.replace('Scene', '')), { fontSize: '8px', color: '#eee', backgroundColor: '#00000099', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    if (cfg.prev) this.add.text(14 * TILE, (this.rows - 0.5) * TILE, tr('⬇ back'), { fontSize: '8px', color: '#eee', backgroundColor: '#00000099', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
  }

  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    const g = this.playerG, design = playerDesign(this.registry);
    if (this.onWater) {
      drawTrainerBody(g, this.facing, 0, design);   // sit still while surfing
      // 2D fallback mirrors the 3D mount: a seated rider with a visible
      // water-Pokémon head/body and wake, rather than a person walking on water.
      g.fillStyle(0x1f6fae, 1); g.fillEllipse(0, 11, 36, 15);
      g.fillStyle(0x53a6d8, 1); g.fillEllipse(0, 8, 28, 11);
      g.fillStyle(0x3a8fc0, 1); g.fillEllipse(0, -4, 13, 12);
      g.fillStyle(0x79cbe5, 1); g.fillEllipse(0, -1, 9, 5);
      g.fillStyle(0x101923, 1); g.fillRect(-4, -6, 2, 2); g.fillRect(2, -6, 2, 2);
      g.fillStyle(0xcdeeff, 0.8); g.fillEllipse(-12, 13, 9, 3); g.fillEllipse(12, 14, 8, 3);
      g.setData('characterSurfing3D', true);
    } else {
      (this.cycling ? drawRiderBody : drawTrainerBody)(g, this.facing, this.walkFrame, design);
      g.setData('characterSurfing3D', false);
    }
    g.setPosition(this.px, this.py);
  }
  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => { if (!this.cutsceneActive && hasBike(this.registry)) { this.cycling = !this.cycling; this.drawChar(); } });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 34, '', {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD move  SPACE enter/exam  C bike  M menu'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

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
      const len = Math.hypot(dx, dy);
      const nx = this.px + (dx / len) * speed * dt, ny = this.py + (dy / len) * speed * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta; if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.drawChar();
    if (this.checkWhirlpools()) return;   // drifting into a whirlpool drags you into a battle
    if (this.checkTrainers()) return;
    if (this.checkThreat()) return;       // menacing Pokémon takes interaction priority
    if (this.checkNpcs()) return;
    this.checkChief();
    this.checkBuildings();
    this.checkLandmarks();
    this.checkExits();
  }

  private drawNpcs() {
    for (const n of this.cfg.npcs ?? []) {
      const g = this.add.graphics().setDepth(8);
      drawNpcBody(g, n.color, { hair: n.hair ?? 0x2a2622, frame: n.frame ?? 0 });
      g.setPosition(n.col * TILE + 16, n.row * TILE + 16);
      if (n.label) this.add.text(n.col * TILE + 16, n.row * TILE - 12, speakerName(n.label), {
        fontSize: '8px', color: '#cfe6ff', backgroundColor: '#00000088', padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(9);
    }
  }

  private checkNpcs(): boolean {
    for (const n of this.cfg.npcs ?? []) {
      if (Math.hypot(this.px - (n.col * TILE + 16), this.py - (n.row * TILE + 16)) > TILE * 1.3) continue;
      this.enterPrompt.setText(tr('SPACE — Talk')).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.cutsceneActive = true; this.enterPrompt.setVisible(false);
        this.dialog.show(n.lines, () => { this.cutsceneActive = false; });
      }
      return true;
    }
    return false;
  }

  private checkLandmarks() {
    for (const lm of this.cfg.landmarks ?? []) {
      if (!lm.enter) continue;
      const doorX = (lm.col + lm.w / 2) * TILE, doorY = (lm.row + lm.h) * TILE + TILE / 2;
      if (Math.hypot(this.px - doorX, this.py - doorY) > TILE * 1.3) continue;
      this.enterPrompt.setText(`${tr('SPACE — Enter')} ${tr(lm.label)}`).setVisible(true);
      if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
      this.cutsceneActive = true; this.enterPrompt.setVisible(false);
      this.registry.set(this.cfg.key + 'ReturnX', doorX);
      this.registry.set(this.cfg.key + 'ReturnY', doorY + TILE);
      if (lm.enterId) {   // generic building interior — tell it which room to show and where to return
        this.registry.set('northBuildingId', lm.enterId);
        this.registry.set('northBuildingReturn', this.cfg.key);
      }
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(lm.enter!));
      return;
    }
  }

  // ── Mission: a rampaging Pokémon the Chief sends you to quell before the exam ──
  /** Is the Chief's pre-exam mission finished? (a threat beaten, or a whole gauntlet cleared) */
  private missionCleared(m: EosaMission): boolean {
    if (m.gauntlet) return m.gauntlet.every(k => !!this.registry.get('trainerDefeated_' + k));
    return !!this.registry.get('trainerDefeated_' + m.threatKey);
  }

  private spawnThreat() {
    const m = this.cfg.mission;
    if (!m || m.remote || m.gauntlet || this.missionCleared(m)) return;
    const col = m.color ?? 0x8a2a2a;
    const dark = Phaser.Display.Color.IntegerToColor(col).darken(25).color;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25); g.fillEllipse(0, 15, 32, 9);              // shadow
    g.fillStyle(col, 1); g.fillCircle(0, 0, 14);
    g.fillStyle(dark, 1); g.fillCircle(0, 5, 12);
    for (let i = -1; i <= 1; i++) g.fillTriangle(i * 8 - 3, -11, i * 8 + 3, -11, i * 8, -21); // spikes
    g.fillStyle(0xffe000, 1); g.fillCircle(-5, -3, 3.2); g.fillCircle(5, -3, 3.2);           // eyes
    g.fillStyle(0x000000, 1); g.fillCircle(-5, -2, 1.5); g.fillCircle(5, -2, 1.5);
    g.lineStyle(2, 0x000000, 1); g.beginPath();                                              // angry brows
    g.moveTo(-9, -8); g.lineTo(-2, -5); g.moveTo(9, -8); g.lineTo(2, -5); g.strokePath();
    const label = this.add.text(0, -30, '⚠ ' + tr(m.threatName), {
      fontSize: '9px', color: '#ff7a7a', fontStyle: 'bold', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5);
    const cont = this.add.container(m.col * TILE + 16, m.row * TILE + 16, [g, label]).setDepth(9);
    cont.setVisible(!!this.registry.get(this.cfg.key + 'MissionTaken'));
    this.tweens.add({ targets: cont, y: cont.y - 4, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.threatG = cont;
  }

  private checkThreat(): boolean {
    const m = this.cfg.mission;
    if (!m || m.remote || m.gauntlet) return false;   // a remote threat / gauntlet is confronted elsewhere
    if (!this.registry.get(this.cfg.key + 'MissionTaken')) return false;
    if (this.registry.get('trainerDefeated_' + m.threatKey)) return false;
    const near = Math.hypot(this.px - (m.col * TILE + 16), this.py - (m.row * TILE + 16)) < TILE * 1.4;
    if (!near) return false;
    this.enterPrompt.setText(`${tr('SPACE — Confront')} ${tr(m.threatName)}`).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return true;
    this.cutsceneActive = true; this.enterPrompt.setVisible(false);
    this.dialog.show(m.approach, () => {
      this.registry.set('trainerName', m.threatName);
      this.registry.set('trainerKey', m.threatKey);
      this.registry.set('trainerPokemon', JSON.stringify([m.threatMon]));
      this.registry.set('trainerExpPool', 1900);
      this.registry.set('trainerReturnScene', this.cfg.key);
      this.registry.set(this.cfg.key + 'ReturnX', m.col * TILE + 16);
      this.registry.set(this.cfg.key + 'ReturnY', (m.row + 1) * TILE + 16);
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    });
    return true;
  }

  // ── Sea, whirlpools & roadside trainers (config-driven; e.g. Parangpo's West Sea) ──
  private carveWater() {
    const w = this.cfg.water; if (!w) return;
    for (let r = w.r1; r < w.r2; r++) {
      for (let c = w.c1; c < w.c2; c++) if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) this.map[r][c] = T.WATER;
      if (w.c2 >= 0 && w.c2 < this.cols && r >= 0 && r < this.rows) this.map[r][w.c2] = T.SAND;   // beach fronting the sea
    }
  }

  private drawWhirlpools() {
    const w = this.cfg.water; if (!w?.whirlpools) return;
    for (const wp of w.whirlpools) {
      const g = this.add.graphics();
      g.lineStyle(2.5, 0xffffff, 0.85);
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, 6 + i * 4, i * 1.6, i * 1.6 + Math.PI * 1.4); g.strokePath(); }
      g.fillStyle(0x0d3a5c, 0.6); g.fillCircle(0, 0, 4);
      const c = this.add.container(wp.c * TILE + 16, wp.r * TILE + 16, [g]).setDepth(7);
      this.tweens.add({ targets: c, angle: 360, duration: 1400, repeat: -1, ease: 'Linear' });
    }
  }

  private checkWhirlpools(): boolean {
    const w = this.cfg.water;
    if (!w?.whirlpools || !w.minion || !this.onWater) return false;
    for (const wp of w.whirlpools) {
      if (Math.hypot(this.px - (wp.c * TILE + 16), this.py - (wp.r * TILE + 16)) < 18) {
        this.cutsceneActive = true; this.enterPrompt.setVisible(false);
        this.registry.set('wildId', w.minion.id);
        this.registry.set('wildLevel', w.minion.level);
        this.registry.set('wildCustom', false);
        this.registry.set('wildCatchRate', w.minion.catchRate);
        this.registry.set('wildReturnScene', this.cfg.key);
        this.registry.set(this.cfg.key + 'ReturnX', w.beachX ?? (w.c2 * TILE + 16));
        this.registry.set(this.cfg.key + 'ReturnY', w.beachY ?? (w.r1 * TILE + 16));
        this.dialog.show([
          'The current yanks you sideways — a whirlpool!',
          'Churned up out of the depths, one of Gyarados\'s brood lunges at you!',
        ], () => this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene')));
        return true;
      }
    }
    return false;
  }

  private drawTrainers() {
    for (const tr of this.cfg.trainers ?? []) {
      if (this.registry.get('trainerDefeated_' + tr.key) && vanishesAfterDefeat(tr.key)) continue;   // beaten trainers stay put
      const g = this.add.graphics().setDepth(8);
      drawNpcBody(g, tr.color, { hair: 0x2a2622 });
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      this.add.text(tr.col * TILE + 16, tr.row * TILE - 12, speakerName(tr.label), {
        fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(9);
    }
  }

  private checkTrainers(): boolean {
    for (const tr of this.cfg.trainers ?? []) {
      if (this.registry.get('trainerDefeated_' + tr.key)) continue;
      if (Math.hypot(this.px - (tr.col * TILE + 16), this.py - (tr.row * TILE + 16)) < TILE * 1.4) {
        this.cutsceneActive = true; this.enterPrompt.setVisible(false);
        this.registry.set('trainerName', tr.name);
        this.registry.set('trainerKey', tr.key);
        this.registry.set('trainerPokemon', tr.pokemon);
        this.registry.set('trainerExpPool', tr.expPool);
        this.registry.set('trainerReturnScene', this.cfg.key);
        this.registry.set(this.cfg.key + 'ReturnX', this.px);
        this.registry.set(this.cfg.key + 'ReturnY', this.py);
        this.dialog.show([tr.line, `${tr.name}: Let's battle!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return true;
      }
    }
    return false;
  }

  /** Carve a paved sand path from the main road down the south edge to the beach. */
  private carveSidePath() {
    const be = this.cfg.sideExit; if (!be) return;
    const tile = be.road ? T.ROAD : T.SAND;   // paved road (mine) vs sandy path (beach)
    for (let r = 10; r < this.rows; r++)
      for (let c = be.col - 1; c <= be.col + 1; c++)
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) this.map[r][c] = tile;
  }

  /** Carve a clear L-shaped connector from a remote landmark to the city's
   *  established road grid. Width is measured eastward from the authored col. */
  private carveAccessRoads() {
    for (const p of this.cfg.accessRoads ?? []) {
      const width = Math.max(1, Math.floor(p.width ?? 1));
      const paint = (col: number, row: number) => {
        for (let dc = 0; dc < width; dc++) {
          const c = col + dc;
          if (row >= 0 && row < this.rows && c >= 0 && c < this.cols) this.map[row][c] = T.ROAD;
        }
      };
      const rStep = p.toRow >= p.fromRow ? 1 : -1;
      for (let r = p.fromRow; r !== p.toRow + rStep; r += rStep) paint(p.fromCol, r);
      const cStep = p.toCol >= p.fromCol ? 1 : -1;
      for (let c = p.fromCol; c !== p.toCol + cStep; c += cStep) paint(c, p.toRow);
    }
  }

  /** Cut a 2-tile walkable gateway straight through the top wall: a paved passage
   *  flanked by solid rampart posts, so the player simply walks NORTH through the
   *  opening (off the top edge) to the next scene — no solid gate building to bump
   *  into, no SPACE prompt. Reads as an obvious road leading out of the city. */
  private carveGate() {
    const ge = this.cfg.gateExit; if (!ge) return;
    for (let r = 0; r < 11; r++)
      for (let c = ge.col; c <= ge.col + 1; c++)
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) this.map[r][c] = T.ROAD;
    for (let r = 0; r < 3; r++)
      for (const c of [ge.col - 1, ge.col + 2])
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) this.map[r][c] = T.BUILDING;
  }

  /** A stone gatehouse drawn over the top-wall opening (posts, lintel, barred
   *  passage, banners) so the gateway reads as a real gate, with a sign above. */
  private drawGate() {
    const ge = this.cfg.gateExit; if (!ge) return;
    const x = ge.col * TILE, w = 2 * TILE, h = 3 * TILE;
    const g = this.add.graphics().setDepth(6);
    g.fillStyle(0x3a3640); g.fillRect(x - 14, 0, w + 28, h);            // gatehouse mass
    g.fillStyle(0x4a4a52); g.fillRect(x - 14, 0, 14, h); g.fillRect(x + w, 0, 14, h);   // posts
    g.fillStyle(0x5a5a64); g.fillRect(x - 16, 0, w + 32, 12);           // lintel
    g.fillStyle(0x1a1a1f); g.fillRect(x + 1, 10, w - 2, h - 10);        // dark passage
    g.fillStyle(0x8a7a3a); for (let i = 0; i < 3; i++) g.fillRect(x + 6 + i * ((w - 12) / 3), 14, 3, h - 18);  // portcullis bars
    for (const bx of [x - 11, x + w + 1]) { g.fillStyle(0x2a2440); g.fillRect(bx, 14, 8, 26); g.fillStyle(0xffd24a); g.fillRect(bx, 14, 8, 4); }  // banners
    this.add.text(x + w / 2, h + 6, tr(ge.label), {
      fontSize: '9px', color: '#ffe9c0', backgroundColor: '#182238dd', padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(7);
  }

  /** Fill solid landmark footprints into the map so the player can't walk through them. */
  private applyLandmarkSolids() {
    for (const lm of this.cfg.landmarks ?? []) {
      if (!lm.solid) continue;
      for (let r = lm.row; r < lm.row + lm.h; r++)
        for (let c = lm.col; c < lm.col + lm.w; c++)
          if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) this.map[r][c] = T.BUILDING;
    }
  }

  private drawSideSign() {
    const be = this.cfg.sideExit; if (!be) return;
    this.add.text(be.col * TILE + 16, 11 * TILE + 16, (be.icon ?? '🏖') + ' ' + tr(be.label) + ' ↓', {
      fontSize: '9px', color: '#fff', backgroundColor: '#0a3a5acc', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(7);
  }

  private drawAccessRoadSigns() {
    for (const p of this.cfg.accessRoads ?? []) {
      if (!p.label) continue;
      this.add.text((p.toCol + (p.width ?? 1) / 2) * TILE, (p.toRow + 0.72) * TILE, tr(p.label), {
        fontSize: '10px', color: '#ffe9a8', backgroundColor: '#182238dd', padding: { x: 5, y: 2 },
      }).setOrigin(0.5).setDepth(7);
    }
  }

  private drawLandmarks() {
    for (const lm of this.cfg.landmarks ?? []) {
      const x = lm.col * TILE, y = lm.row * TILE, w = lm.w * TILE, h = lm.h * TILE;
      const g = this.add.graphics().setDepth(2);
      g.fillStyle(0x000000, 0.18); g.fillEllipse(x + w / 2, y + h - 2, w * 0.7, 8);
      if (lm.kind === 'lighthouse') {
        g.fillStyle(0xf2f2f2); g.fillRect(x + w * 0.3, y, w * 0.4, h);
        g.fillStyle(lm.color); for (let i = 0; i < 4; i++) g.fillRect(x + w * 0.3, y + i * (h / 4), w * 0.4, h / 8);
        g.fillStyle(0xffe066); g.fillRect(x + w * 0.24, y - 8, w * 0.52, 9);
        g.fillStyle(0x3a2f22); g.fillRect(x + w * 0.2, y + h - 6, w * 0.6, 6);
      } else if (lm.kind === 'monument') {
        g.fillStyle(lm.color); g.fillTriangle(x + w / 2, y, x + w * 0.32, y + h, x + w * 0.68, y + h);
        g.fillStyle(0xffffff, 0.18); g.fillTriangle(x + w / 2, y, x + w * 0.42, y + h, x + w / 2, y + h);
        g.fillStyle(0x5a5044); g.fillRect(x + w * 0.24, y + h - 6, w * 0.52, 6);
      } else if (lm.kind === 'pavilion') {
        g.fillStyle(0x6a4a2a); g.fillRect(x + 4, y + h * 0.4, 5, h * 0.6); g.fillRect(x + w - 9, y + h * 0.4, 5, h * 0.6);
        g.fillStyle(lm.color); g.fillTriangle(x - 4, y + h * 0.45, x + w / 2, y, x + w + 4, y + h * 0.45);
        g.fillStyle(0x8a6a3a); g.fillRect(x + 4, y + h * 0.42, w - 8, 4);
      } else if (lm.kind === 'station') {
        // Grand frontier railway terminal — stone hall, arched entrance, clock, green roof.
        g.fillStyle(0xd8cdb8); g.fillRect(x, y + h * 0.28, w, h * 0.72);
        g.lineStyle(2, 0x3a2f22); g.strokeRect(x, y + h * 0.28, w, h * 0.72);
        g.fillStyle(lm.color); g.fillRect(x - 3, y + h * 0.2, w + 6, h * 0.12);           // eaves
        g.fillStyle(0x2f5a3a); g.fillTriangle(x + w / 2, y - 4, x + w * 0.34, y + h * 0.2, x + w * 0.66, y + h * 0.2); // central gable
        g.fillStyle(0xf4e9c8); g.fillCircle(x + w / 2, y + h * 0.08, Math.min(w, h) * 0.06); // clock face
        g.lineStyle(1, 0x000000); g.beginPath(); g.moveTo(x + w / 2, y + h * 0.08); g.lineTo(x + w / 2, y + h * 0.05); g.strokePath();
        g.fillStyle(0x2a1c10); g.fillRect(x + w / 2 - 9, y + h - 22, 18, 22);              // arched doorway
        g.fillStyle(0xffcf6a); g.fillRect(x + w / 2 - 6, y + h - 19, 12, 17);
        g.fillStyle(0x88ccff, 0.75); for (let wx = 6; wx < w - 14; wx += 22) g.fillRect(x + wx, y + h * 0.42, 12, 14); // windows
      } else if (lm.kind === 'rail') {
        // Railway heading off toward the horizon — ballast bed, sleepers, twin steel rails.
        g.fillStyle(0x6a6156); g.fillRect(x, y, w, h);                                     // gravel ballast bed
        g.fillStyle(0x4a3826); for (let sy = y + 3; sy < y + h - 2; sy += 10) g.fillRect(x + 2, sy, w - 4, 5);  // sleepers
        g.fillStyle(0xcfd6dd); g.fillRect(x + w * 0.34, y, 3, h); g.fillRect(x + w * 0.62, y, 3, h);            // twin rails
        g.fillStyle(0xffffff, 0.35); g.fillRect(x + w * 0.34, y, 1, h); g.fillRect(x + w * 0.62, y, 1, h);      // rail shine
      } else if (lm.kind === 'hideout') {
        // ── Imposing 4-storey 노스단 fortress ──
        const FLOORS = 4;
        const floorH = h / FLOORS;
        // Main tower body — dark gunmetal steel
        g.fillStyle(0x000000, 0.35); g.fillEllipse(x + w / 2, y + h + 2, w * 0.85, 14);   // ground shadow
        g.fillStyle(0x1a1a26, 1); g.fillRect(x, y, w, h);
        g.fillStyle(0x22222e, 1); g.fillRect(x + 4, y + 4, w - 8, h - 6);
        // Crimson storey dividers + lit windows per floor
        for (let f = 0; f < FLOORS; f++) {
          const fy = y + f * floorH;
          g.fillStyle(0x8a1020, 1); g.fillRect(x + 4, fy + floorH - 4, w - 8, 4);           // crimson band
          g.fillStyle(0xff5a6a, 0.85);                                                      // red-lit windows
          const winCount = Math.max(2, Math.floor((w - 24) / 24));
          const winGap = (w - 24) / winCount;
          for (let wn = 0; wn < winCount; wn++) g.fillRect(x + 12 + wn * winGap, fy + 10, 14, Math.max(8, floorH - 22));
        }
        // Crimson banners flanking the tower
        for (const bx of [x + 6, x + w - 16]) {
          g.fillStyle(0x8a1020, 1); g.fillRect(bx, y + 6, 10, h - 20);
          g.fillStyle(0xffd24a, 1); g.fillCircle(bx + 5, y + h / 2, 4);                    // gold emblem on each banner
        }
        // Roof parapet with crimson trim
        g.fillStyle(0x0e0e16, 1); g.fillRect(x - 3, y - 6, w + 6, 8);
        g.fillStyle(0x8a1020, 1); g.fillRect(x - 3, y - 6, w + 6, 3);
        // Crenellations
        for (let cx = x - 2; cx < x + w; cx += 12) {
          g.fillStyle(0x0e0e16, 1); g.fillRect(cx, y - 14, 8, 10);
        }
        // Gate at the bottom centre
        const gateW = Math.min(32, w * 0.35), gateH = Math.min(28, floorH * 0.7);
        g.fillStyle(0x5a1024, 1); g.fillRect(x + w / 2 - gateW / 2 - 2, y + h - gateH - 2, gateW + 4, gateH + 2);
        g.fillStyle(0x8a1a34, 1); g.fillRect(x + w / 2 - gateW / 2, y + h - gateH, gateW, gateH);
        // 노스단 emblem above gate
        g.fillStyle(0xffd24a, 1); g.fillCircle(x + w / 2, y + h - gateH - 10, 6);
        g.fillStyle(0x8a1020, 1); g.fillCircle(x + w / 2, y + h - gateH - 10, 3);
      } else {
        g.fillStyle(0xe8dcc6); g.fillRect(x, y + h * 0.25, w, h * 0.75); g.lineStyle(2, 0x3a2a1a); g.strokeRect(x, y + h * 0.25, w, h * 0.75);
        g.fillStyle(lm.color); g.fillTriangle(x - 4, y + h * 0.28, x + w / 2, y, x + w + 4, y + h * 0.28);
        g.fillStyle(0x88ccff, 0.7); for (let wx = 8; wx < w - 8; wx += 20) g.fillRect(x + wx, y + h * 0.45, 12, 12);
      }
      if (lm.enter) {   // a doorway at the foot of the building
        g.fillStyle(0x3a2410); g.fillRect(x + w / 2 - 8, y + h - 18, 16, 18);
        g.fillStyle(0xffcf6a); g.fillRect(x + w / 2 - 5, y + h - 15, 10, 13);
        g.fillStyle(0x3a2410); g.fillRect(x + w / 2 - 1, y + h - 9, 2, 4);
      }
      this.add.text(x + w / 2, y - 6, tr(lm.label), {
        fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 1).setDepth(3);
    }
  }

  private collides(x: number, y: number): boolean {
    const hw = 6, canSurf = this.canSurf();
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return true;
      const t = this.map[row][col];
      if (t === T.WATER) return !canSurf;   // the sea is crossable only while surfing
      return SOLID.has(t);
    });
  }

  /** Does the player have a Pokémon that can Surf (or the Surf TM from Haean)? */
  private canSurf(): boolean {
    return !!this.registry.get('haeanGymDefeated') || PartySystem.anyKnows(this.registry, 'Surf');
  }
  private tileAt(x: number, y: number): Tile | undefined {
    return this.map[Math.floor(y / TILE)]?.[Math.floor(x / TILE)];
  }
  private get onWater(): boolean { return this.tileAt(this.px, this.py) === T.WATER; }

  private checkChief() {
    const cfg = this.cfg;
    const near = Math.hypot(this.px - (CHIEF.col * TILE + 16), this.py - (CHIEF.row * TILE + 16)) < TILE * 1.5;
    if (!near) { if (!this.nearBuilding()) this.enterPrompt.setVisible(false); return; }
    if (hasMapae(this.registry, cfg.mapaeKey)) {
      this.enterPrompt.setText(`${tr('SPACE:')} ${speakerName(cfg.chiefName)}`).setVisible(true);
      if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
      this.cutsceneActive = true; this.enterPrompt.setVisible(false);
      this.dialog.show([`${cfg.chiefName}: This province has taken your measure. Carry the 마패 with honour.`], () => { this.cutsceneActive = false; });
      return;
    }
    // A mission still hangs over the province → the Chief won't grant the exam yet.
    const m = cfg.mission;
    if (m && !this.missionCleared(m)) {
      this.enterPrompt.setText(`${tr('SPACE:')} ${speakerName(cfg.chiefName)}`).setVisible(true);
      if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
      this.cutsceneActive = true; this.enterPrompt.setVisible(false);
      if (!this.registry.get(cfg.key + 'MissionTaken')) {
        this.registry.set(cfg.key + 'MissionTaken', true);
        this.dialog.show(m.blurb, () => { this.cutsceneActive = false; this.threatG?.setVisible(true); });
      } else {
        this.dialog.show([m.reminder], () => { this.cutsceneActive = false; });
      }
      return;
    }
    const eb = cfg.examBattle;   // a 노스단 officer stands in for the Chief's duel, if set
    this.enterPrompt.setText(eb ? `${tr('SPACE:')} ${speakerName(cfg.chiefName)}` : tr('SPACE: take the exam')).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    this.cutsceneActive = true; this.enterPrompt.setVisible(false);
    const examLead = eb ? eb.intro : [cfg.examLead];
    let lead: string[];
    if (m && !this.registry.get(cfg.key + 'MissionCleared')) { this.registry.set(cfg.key + 'MissionCleared', true); lead = [...m.cleared, ...examLead]; }
    else lead = [...examLead];
    this.dialog.show(lead, () => {
      this.registry.set('trainerName', eb ? eb.name : cfg.chiefName);
      this.registry.set('trainerKey', eb ? eb.key : cfg.chiefKey);
      this.registry.set('trainerPokemon', JSON.stringify(eb ? eb.team : cfg.team));
      this.registry.set('trainerExpPool', eb ? eb.expPool : cfg.expPool);
      this.registry.set('trainerReturnScene', cfg.key);
      this.registry.set(cfg.key + 'ReturnX', CHIEF.col * TILE + 16);
      this.registry.set(cfg.key + 'ReturnY', (CHIEF.row + 1) * TILE + 16);
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    });
  }

  private nearBuilding(): boolean {
    return BUILDINGS.some(b => Math.hypot(this.px - (b.doorCol * TILE + TILE / 2), this.py - ((b.y + b.h) * TILE + TILE / 2)) < TILE * 1.3);
  }
  private checkBuildings() {
    const cfg = this.cfg;
    let near: Bldg | null = null;
    for (const b of BUILDINGS) if (Math.hypot(this.px - (b.doorCol * TILE + TILE / 2), this.py - ((b.y + b.h) * TILE + TILE / 2)) < TILE * 1.3) { near = b; break; }
    if (!near || near.hall) return;
    this.enterPrompt.setText(`${tr('SPACE — Enter')} ${tr(near.label)}`).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    const b = near;
    this.registry.set(cfg.key + 'ReturnX', b.doorCol * TILE + 16);
    this.registry.set(cfg.key + 'ReturnY', (b.y + b.h + 1) * TILE + 16);
    this.cutsceneActive = true;
    if (b.scene === '__SHOP__') { this.registry.set('martReturnScene', cfg.key); this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('MartScene')); return; }
    this.registry.set('pcReturnScene', cfg.key);
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(b.scene));
  }

  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;
    const cfg = this.cfg;
    const nearCentre = this.px > 12 * TILE && this.px < 16 * TILE;
    // Walk north through the top-wall gateway → its scene (e.g. Gwanmunseong checkpoint).
    const ge = cfg.gateExit;
    if (ge && this.py < 1.2 * TILE && this.px > ge.col * TILE && this.px < (ge.col + 2) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(ge.scene));
      return;
    }
    const be = cfg.sideExit;
    // A single side entrance: walk down the marked side path and off the south edge.
    if (be && this.py > (this.rows - 1) * TILE && this.px > (be.col - 1.5) * TILE && this.px < (be.col + 1.5) * TILE) {
      this.cutsceneActive = true;
      this.registry.set(cfg.key + 'ReturnX', be.col * TILE + 16);
      this.registry.set(cfg.key + 'ReturnY', (this.rows - 3) * TILE + 16);   // return inland on the path
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(be.scene));
    }
    else if (cfg.next && this.py < 1.2 * TILE && nearCentre) { this.go(cfg.next); }
    else if (cfg.prev && this.py > (this.rows - 1) * TILE && nearCentre) { this.go(cfg.prev); }
  }
  private go(e: Exit) {
    this.cutsceneActive = true;
    const rk = e.returnKey ?? e.scene;   // Eosa cities key returns off the scene name; endpoints override
    this.cameras.main.fadeOut(400, 0, 0, 0, () => {
      this.registry.set(rk + 'ReturnX', e.x);
      this.registry.set(rk + 'ReturnY', e.y);
      this.scene.start(e.scene);
    });
  }

  static healParty(scene: Phaser.Scene) { PartySystem.healAll(scene.registry); }
}
