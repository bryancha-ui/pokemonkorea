import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr, speakerName } from '../systems/i18n';
import { vanishesAfterDefeat } from '../data/Villains';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';

// ── Kalma Beach (갈마 해변) ──────────────────────────────────────────────────────
// Haesol's famous East-Sea bathing beach, reached by the paved shore road out of
// town: golden sand and low dunes, the Songdowon pines, a lighthouse and beach
// umbrellas — and, at the water's edge, the last of Chief Haegang's three disciples.

const T = { SAND: 0, DUNE: 1, SEA: 2, PINE: 3, ROCK: 4, BOARDWALK: 5, WET_SAND: 6 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 22, ROWS = 18;
const COLORS: Record<Tile, number> = {
  [T.SAND]: 0xe7d7a9, [T.DUNE]: 0xd4c49d, [T.SEA]: 0x2f78b4,
  [T.PINE]: 0x1c4a2a, [T.ROCK]: 0x6f6658, [T.BOARDWALK]: 0xb88752,
  [T.WET_SAND]: 0xb9a77f,
};
const SOLID = new Set<Tile>([T.SEA, T.PINE, T.ROCK]);
// Beach Pokémon now appear naturally on the open sand instead of requiring a
// patch of tall grass in the middle of a bathing beach.
const ENCOUNTER = new Set<Tile>([T.SAND, T.DUNE, T.WET_SAND]);

// Beach & shallows wild Pokémon.
const KB_ENCOUNTERS: EncounterEntry[] = [
  { id: 278, weight: 16, minLevel: 64, maxLevel: 66, isCustom: false, catchRate: 190 }, // Wingull
  { id: 98,  weight: 14, minLevel: 64, maxLevel: 66, isCustom: false, catchRate: 190 }, // Krabby
  { id: 120, weight: 12, minLevel: 64, maxLevel: 66, isCustom: false, catchRate: 150 }, // Staryu
  { id: 90,  weight: 12, minLevel: 64, maxLevel: 66, isCustom: false, catchRate: 150 }, // Shellder
  { id: 27,  weight: 12, minLevel: 64, maxLevel: 66, isCustom: false, catchRate: 190 }, // Sandshrew
  { id: 222, weight: 8,  minLevel: 65, maxLevel: 67, isCustom: false, catchRate: 120 }, // Corsola
  { id: 279, weight: 8,  minLevel: 65, maxLevel: 67, isCustom: false, catchRate: 120 }, // Pelipper
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.SAND) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  // A broad dry beach leads through darker wet sand to the East Sea.
  fill(11, 13, 0, COLS, T.WET_SAND);
  fill(13, ROWS, 0, COLS, T.SEA);
  // Sandy dunes replace every former grass encounter patch.
  fill(3, 6, 1, 6, T.DUNE);
  fill(2, 5, 16, 21, T.DUNE);
  fill(7, 10, 18, 21, T.DUNE);
  // Timber promenade from Haesol, opening into a cross-beach boardwalk.
  fill(0, 7, 10, 13, T.BOARDWALK);
  fill(6, 8, 3, 19, T.BOARDWALK);
  // a small rock jetty reaching into the sea
  for (const [r, c] of [[12, 9], [12, 10], [13, 10]] as [number, number][]) m[r][c] = T.ROCK;
  // Songdowon pines along the flanks
  for (const [r, c] of [[2, 1], [5, 1], [9, 2], [2, 20], [5, 20], [9, 19], [11, 4], [11, 17]] as [number, number][]) m[r][c] = T.PINE;
  return m;
}

interface Trainer { key: string; name: string; col: number; row: number; color: number; label: string; line: string; pokemon: string; expPool: number; }

export class WonsanBeachScene extends Phaser.Scene {
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 11 * TILE + 16;
  private py = 3 * TILE + 16;   // enter from the top (the road down from Haesol)
  private facing = 0; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false; private spawnPx = 0; private spawnPy = 0;
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;

  private readonly TRAINERS: Trainer[] = [
    { key: 'wonsan-disciple-3', name: 'Disciple Cheon', col: 11, row: 11, color: 0x9a4a3a, label: 'Disciple\n③ Beach',
      line: "Two down, and you've reached the water's edge — the last of us. No rest now. Bring everything!",
      pokemon: JSON.stringify([{ id: 237, level: 68 }, { id: 534, level: 69 }, { id: 62, level: 69 }]), expPool: 2200 },
    { key: 'kalma-swimmer', name: 'Swimmer Haram', col: 4, row: 12, color: 0x2a8ab0, label: 'Swimmer',
      line: "The East Sea's cold but it keeps you sharp! Care for a match on the sand?",
      pokemon: JSON.stringify([{ id: 91, level: 66 }, { id: 195, level: 66 }]), expPool: 1900 },
    { key: 'kalma-fisher', name: 'Fisher Baram', col: 16, row: 11, color: 0x4a7a5a, label: 'Fisher',
      line: "Been casting off this jetty since dawn. Reel in a battle with me!",
      pokemon: JSON.stringify([{ id: 119, level: 66 }, { id: 340, level: 66 }]), expPool: 1900 },
  ];

  constructor() { super('WonsanBeachScene'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    playBgm(this, 'wonsanbeach');
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('WonsanBeachSceneReturnX') as number | undefined;
    const ry = this.registry.get('WonsanBeachSceneReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; } else { this.px = 11 * TILE + 16; this.py = 3 * TILE + 16; }
    this.registry.remove('WonsanBeachSceneReturnX'); this.registry.remove('WonsanBeachSceneReturnY');
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true; this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawIcons();
    this.drawTrainers();
    this.playerG = this.add.graphics().setDepth(20); this.drawChar();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [T.SEA], solidTiles: SOLID,
    });
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.setZoom(1.6);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'WonsanBeachScene');
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.SAND) { g.fillStyle(0xd6c48c, 0.7); g.fillRect(x + 6, y + 10, 4, 3); g.fillRect(x + 18, y + 20, 4, 3); }
      if (t === T.DUNE) { g.fillStyle(0xbeac83, 0.55); g.fillEllipse(x + 16, y + 22, 27, 11); g.fillStyle(0xeee0bb, 0.7); g.fillEllipse(x + 13, y + 18, 18, 5); }
      if (t === T.WET_SAND) { g.fillStyle(0xd9ceb4, 0.28); g.fillRect(x + 2, y + 8, 20, 2); g.fillRect(x + 13, y + 23, 16, 2); }
      if (t === T.BOARDWALK) { g.fillStyle(0x8f6138, 0.7); for (let i = 0; i < TILE; i += 8) g.fillRect(x, y + i, TILE, 2); g.fillStyle(0xe0b77b, 0.45); g.fillRect(x + 3, y + 3, 3, TILE - 6); }
      if (t === T.SEA) { g.fillStyle(0x66b0e0, 0.5); g.fillRect(x + 4, y + 8, 13, 3); g.fillRect(x + 13, y + 20, 11, 3); g.fillStyle(0xffffff, 0.45); g.fillRect(x + 2, y + 2, 18, 2); }
      if (t === T.PINE) { g.fillStyle(0x123a1e); g.fillTriangle(x + 16, y + 1, x + 4, y + 20, x + 28, y + 20); g.fillStyle(0x1f5630); g.fillTriangle(x + 16, y + 8, x + 6, y + 26, x + 26, y + 26); g.fillStyle(0x4a3020); g.fillRect(x + 14, y + 26, 5, 5); }
      if (t === T.ROCK) { g.fillStyle(0x5a5044); g.fillTriangle(x + 16, y + 5, x + 3, y + 28, x + 29, y + 28); }
    }
    const key = '__kalmaBeach__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
    this.add.text(11 * TILE, 0.6 * TILE, tr('↑ Haesol'), { fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
    this.add.text(COLS * TILE / 2, (ROWS - 0.6) * TILE, tr('～ East Sea (동해) ～'), { fontSize: '9px', color: '#eaf6ff', backgroundColor: '#00000066', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
  }

  private drawIcons() {
    // Lighthouse on the eastern point
    const lx = 19 * TILE + 8, ly = 1 * TILE;
    const lg = this.add.graphics().setDepth(6);
    lg.fillStyle(0xf2f2f2); lg.fillRect(lx, ly, 16, 46);
    lg.fillStyle(0xd63b3b); for (let i = 0; i < 4; i++) lg.fillRect(lx, ly + i * 12, 16, 6);
    lg.fillStyle(0xffe066); lg.fillRect(lx - 3, ly - 8, 22, 9);
    this.add.text(lx + 8, ly - 12, '🗼 등대', { fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(7);

    // A lifeguard tower near the shore
    const tg = this.add.graphics().setDepth(6);
    const tx = 14 * TILE + 8, ty = 9 * TILE;
    tg.fillStyle(0x8a6a3a); tg.fillRect(tx, ty, 4, 24); tg.fillRect(tx + 16, ty, 4, 24);
    tg.fillStyle(0xdd6644); tg.fillRect(tx - 3, ty - 10, 26, 12);
    tg.fillStyle(0xffffff); tg.fillRect(tx - 1, ty - 8, 22, 3);

    // Beach umbrellas dotted along the sand
    const umb = [[6, 9, 0xdd4455], [15, 8, 0x3a7ad0], [9, 8, 0xf0b52a]] as [number, number, number][];
    for (const [c, r, col] of umb) {
      const ug = this.add.graphics().setDepth(6);
      const ux = c * TILE + 16, uy = r * TILE + 16;
      ug.fillStyle(0x6a4a2a); ug.fillRect(ux - 1, uy - 4, 2, 14);
      ug.fillStyle(col); ug.fillTriangle(ux - 14, uy - 4, ux + 14, uy - 4, ux, uy - 18);
      ug.fillStyle(0xffffff, 0.85); ug.fillTriangle(ux - 5, uy - 6, ux + 5, uy - 6, ux, uy - 15);
    }
  }

  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`) && vanishesAfterDefeat(tr.key)) continue;   // beaten trainers stay put
      const g = this.add.graphics().setDepth(8);
      drawNpcBody(g, tr.color, { hair: 0x2a2622 });
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      this.add.text(tr.col * TILE + 16, tr.row * TILE - 14, speakerName(tr.label), { fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 }, align: 'center' }).setOrigin(0.5).setDepth(9);
    }
  }

  private drawChar() {
    (this.cycling ? drawRiderBody : drawTrainerBody)(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }
  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => { if (!this.cutsceneActive && hasBike(this.registry)) { this.cycling = !this.cycling; this.drawChar(); } });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 380, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🏖 Kalma Beach (갈마 해변)'), { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  C: bike  SPACE: talk  M: menu'), { fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 } }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
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
      this.walkTimer += delta; if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; this.steps++; this.checkEncounter(); }
    } else this.walkFrame = 0;
    this.drawChar();
    if (this.checkTrainers()) return;
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

  private checkEncounter() {
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (t === undefined || !ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.22) return;
    this.steps = 0; this.nextEnc = 8 + Math.floor(Math.random() * 8);
    const e = pickEncounter(KB_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'WonsanBeachScene');
    this.registry.set('WonsanBeachSceneReturnX', this.px); this.registry.set('WonsanBeachSceneReturnY', this.py);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  private checkTrainers(): boolean {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`)) continue;
      if (Math.hypot(this.px - (tr.col * TILE + 16), this.py - (tr.row * TILE + 16)) < TILE * 1.5) {
        this.cutsceneActive = true;
        this.registry.set('trainerName', tr.name);
        this.registry.set('trainerKey', tr.key);
        this.registry.set('trainerPokemon', tr.pokemon);
        this.registry.set('trainerExpPool', tr.expPool);
        this.registry.set('trainerReturnScene', 'WonsanBeachScene');
        this.registry.set('WonsanBeachSceneReturnX', this.px); this.registry.set('WonsanBeachSceneReturnY', this.py);
        this.dialog.show([tr.line, `${tr.name}: Let's battle!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return true;
      }
    }
    return false;
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // North edge → back up the shore road to Haesol.
    if (this.py < 1 * TILE && this.px > 8 * TILE && this.px < 14 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('WonsanCitySceneReturnX', 30 * 32 + 16);
        this.registry.set('WonsanCitySceneReturnY', 21 * 32 + 16);
        this.scene.start('WonsanCityScene');
      });
    }
  }
}
