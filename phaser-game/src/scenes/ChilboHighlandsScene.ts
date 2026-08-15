import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr, speakerName } from '../systems/i18n';
import { vanishesAfterDefeat } from '../data/Villains';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';

// ── Yeomyeong Highlands (여명산 길) ─────────────────────────────────────────────────
// The wild northeast-coast road from Gangcheoldo to Muyeonhang, winding through Mt. Yeomyeong
// (여명산) — the "Seven Treasures": jagged rock spires, sea cliffs plunging into the
// East Sea, a mountain waterfall, and blazing autumn maples. To the north, the road
// vanishes into the cold sea-fog that hangs over the port of Muyeonhang.

const T = { GRASS: 0, PATH: 1, TALLGRASS: 2, MAPLE: 3, CLIFF: 4, ROCK: 5, SEA: 6, STREAM: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 52;
const COLORS: Record<Tile, number> = {
  [T.GRASS]: 0x6a9a4a, [T.PATH]: 0xcabf95, [T.TALLGRASS]: 0x3f8a32, [T.MAPLE]: 0x9a3a1e,
  [T.CLIFF]: 0x877c6d, [T.ROCK]: 0x6f6658, [T.SEA]: 0x2f6faf, [T.STREAM]: 0x66b0e0,
};
const SOLID = new Set<Tile>([T.MAPLE, T.CLIFF, T.ROCK, T.SEA, T.STREAM]);
const ENCOUNTER = new Set<Tile>([T.TALLGRASS]);

// Wild rugged-coast & fog Pokémon.
const CB_ENCOUNTERS: EncounterEntry[] = [
  { id: 75,  weight: 14, minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 120 }, // Graveler
  { id: 112, weight: 12, minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 90  }, // Rhydon
  { id: 306, weight: 10, minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 90  }, // Aggron
  { id: 227, weight: 12, minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 90  }, // Skarmory
  { id: 430, weight: 10, minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 90  }, // Honchkrow (fog)
  { id: 215, weight: 10, minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 120 }, // Sneasel
  { id: 217, weight: 10, minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 90  }, // Ursaring
  { id: 526, weight: 8,  minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 90  }, // Gigalith
  { id: 630, weight: 8,  minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 90  }, // Mandibuzz (cliffs)
  { id: 359, weight: 5,  minLevel: 69, maxLevel: 71, isCustom: false, catchRate: 60  }, // Absol (rare omen)
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GRASS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  fill(0, ROWS, 9, 13, T.PATH);        // central mountain road
  fill(0, ROWS, 0, 3, T.CLIFF);        // west mountain wall
  fill(0, ROWS, 20, COLS, T.SEA);      // the East Sea
  fill(0, ROWS, 18, 20, T.CLIFF);      // sheer sea cliffs
  // mountain stream crossed by a plank bridge (on the road)
  fill(26, 29, 3, 18, T.STREAM);
  fill(26, 29, 9, 13, T.PATH);
  // a waterfall cascading off the west cliff into the stream
  fill(20, 26, 3, 4, T.STREAM);
  // Yeomyeong rock spires — the "Seven Treasures"
  for (const [r, c] of [[8,15],[9,15],[8,16],[20,6],[21,6],[15,7],[34,15],[35,15],[40,6],[41,6]] as [number,number][]) m[r][c] = T.CLIFF;
  // blazing autumn maples
  for (const [r, c] of [[6,14],[12,7],[18,16],[24,7],[32,6],[38,16],[44,7],[10,17],[30,17],[4,7]] as [number,number][]) m[r][c] = T.MAPLE;
  // scattered boulders
  for (const [r, c] of [[16,17],[28,6],[42,17]] as [number,number][]) m[r][c] = T.ROCK;
  // tall-grass encounter clearings
  fill(3, 8, 13, 17, T.TALLGRASS);
  fill(11, 17, 13, 17, T.TALLGRASS);
  fill(31, 37, 4, 8, T.TALLGRASS);
  fill(38, 44, 13, 17, T.TALLGRASS);
  fill(19, 25, 4, 8, T.TALLGRASS);
  return m;
}

interface Trainer { key: string; name: string; col: number; row: number; color: number; label: string; line: string; pokemon: string; expPool: number; }

export class ChilboHighlandsScene extends Phaser.Scene {
  // Open highlands — no buildings. Erase every auto-detected building shape.
  public onlyNamedBuildings = true;
  public grassTileIds3D = [T.TALLGRASS];

  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 10 * TILE + 16;
  private py = 47 * TILE + 16;   // default: enter from the south (Gangcheoldo side), a few tiles inside
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false; private spawnPx = 0; private spawnPy = 0;
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;

  private readonly TRAINERS: Trainer[] = [
    {
      key: 'cb-baekcheol', name: 'Hiker Baekcheol', col: 10, row: 45, color: 0x8a6a3a, label: 'Hiker',
      line: "Yeomyeong's rocks have broken tougher trainers than you. My team's carved from the same stone — come on!",
      pokemon: JSON.stringify([{ id: 75, level: 68 }, { id: 208, level: 69 }, { id: 526, level: 70 }]), expPool: 2200,
    },
    {
      key: 'cb-suna', name: 'Bird Keeper Suna', col: 14, row: 33, color: 0x3a8a6a, label: 'Bird\nKeeper',
      line: "My birds nest on the sea cliffs and ride the fog itself. You'll not catch them off guard!",
      pokemon: JSON.stringify([{ id: 227, level: 68 }, { id: 630, level: 69 }, { id: 628, level: 70 }]), expPool: 2200,
    },
    {
      key: 'cb-jihu', name: 'Ace Trainer Jihu', col: 10, row: 22, color: 0x3a5a9a, label: 'Ace\nTrainer',
      line: "The higher you climb Yeomyeong, the thinner the air — and the fiercer the battles. Prove you belong up here.",
      pokemon: JSON.stringify([{ id: 112, level: 69 }, { id: 461, level: 70 }, { id: 359, level: 71 }]), expPool: 2400,
    },
    {
      key: 'cb-doha', name: 'Camper Doha', col: 6, row: 20, color: 0x6a8a3a, label: 'Camper',
      line: "Camped under the maples all autumn. The wild Pokémon up here don't play nice — and neither do mine!",
      pokemon: JSON.stringify([{ id: 217, level: 69 }, { id: 215, level: 70 }]), expPool: 2100,
    },
    {
      key: 'cb-ryun', name: '노스단 Scout Ryun', col: 11, row: 9, color: 0x24242e, label: '노스단\nScout',
      line: "So the Inspectorate's errand-runner reaches Yeomyeong. Beyond this fog is Muyeonhang — and 노스단 runs that port. Turn back!",
      pokemon: JSON.stringify([{ id: 430, level: 69 }, { id: 461, level: 70 }, { id: 553, level: 71 }]), expPool: 2400,
    },
  ];

  constructor() { super('ChilboHighlandsScene'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    playBgm(this, 'chilbo');
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('chilboReturnX') as number | undefined;
    const ry = this.registry.get('chilboReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('chilboReturnX'); this.registry.remove('chilboReturnY');

    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawIcons();
    this.drawTrainers();
    this.createPlayer();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [T.SEA, T.STREAM], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'ChilboHighlandsScene');
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.GRASS) { g.fillStyle(0x578a3a, 0.5); g.fillRect(x + 6, y + 8, 4, 3); g.fillRect(x + 18, y + 20, 4, 3); }
      if (t === T.TALLGRASS) { g.fillStyle(0x2c6a22, 0.75); for (let i = 0; i < 3; i++) { g.fillRect(x + 5 + i * 8, y + 16, 2, 12); g.fillRect(x + 7 + i * 8, y + 12, 2, 16); } }
      if (t === T.MAPLE) { g.fillStyle(0xc85a1e); g.fillCircle(x + 16, y + 13, 12); g.fillStyle(0xe8902a); g.fillCircle(x + 11, y + 10, 6); g.fillStyle(0xa02a12); g.fillCircle(x + 21, y + 15, 5); g.fillStyle(0x5a3a20); g.fillRect(x + 14, y + 23, 4, 7); }
      if (t === T.CLIFF) { g.fillStyle(0x6f6456); g.fillRect(x + 3, y + 4, 9, 9); g.fillRect(x + 17, y + 16, 9, 9); g.fillStyle(0x9a8f7e, 0.5); g.fillRect(x + 4, y + 5, 4, 3); }
      if (t === T.ROCK) { g.fillStyle(0x5a5044); g.fillTriangle(x + 16, y + 5, x + 3, y + 28, x + 29, y + 28); }
      if (t === T.SEA) { g.fillStyle(0x66b0e0, 0.5); g.fillRect(x + 4, y + 8, 13, 3); g.fillRect(x + 13, y + 20, 11, 3); }
      if (t === T.STREAM) { g.fillStyle(0xbfe6ff, 0.6); g.fillRect(x + 6, y, 6, TILE); g.fillStyle(0xffffff, 0.35); g.fillRect(x + 14, y, 3, TILE); }
    }
    const key = '__chilboMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(10.5 * TILE, 51.4 * TILE, tr('↓ Gangcheoldo'), { fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
    this.add.text(10.5 * TILE, 0.7 * TILE, tr('↑ Muyeonhang'), { fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
    this.add.text(15 * TILE, 10 * TILE, tr('여명산\n(Mt. Yeomyeong)'), { fontSize: '8px', color: '#ffe9c0', align: 'center', backgroundColor: '#00000066', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    this.add.text(21.5 * TILE, 40 * TILE, tr('동해\nEast Sea'), { fontSize: '8px', color: '#eaf6ff', align: 'center', backgroundColor: '#00000055', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
  }

  private drawIcons() {
    // Yeomyeong waterfall pool label at the cascade
    this.add.text(3.5 * TILE, 24 * TILE, '여명 폭포', { fontSize: '8px', color: '#eaffff', backgroundColor: '#00000066', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(6);
    // white foam at the base of the waterfall
    const wf = this.add.graphics().setDepth(6);
    wf.fillStyle(0xffffff, 0.5); wf.fillEllipse(3.5 * TILE, 26 * TILE, 26, 10);

    // Cold sea-fog thickening toward Muyeonhang (the north end). Tagged no3d so the
    // 3D mirror never lifts this white overlay into a floating structure.
    const fog = this.add.graphics().setDepth(15).setData('no3d', true);
    fog.fillStyle(0xdfe6ee, 0.32);
    for (let r = 0; r < 12; r++) {
      const a = 0.34 - r * 0.026;
      fog.fillStyle(0xe4ebf2, Math.max(0, a));
      for (let c = 0; c < COLS; c += 2) fog.fillEllipse(c * TILE + 24, r * TILE + 16, 60, 34);
    }
    this.add.text(11 * TILE, 4 * TILE, tr('☁ 짙은 안개 (dense fog)'), { fontSize: '8px', color: '#20303a', backgroundColor: '#e4ebf2cc', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(16);
  }

  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`) && vanishesAfterDefeat(tr.key)) continue;   // beaten trainers stay put (villains vanish)
      const g = this.add.graphics().setDepth(8);
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(tr.color); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x1a1a2e); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -22, 12, 12);
      g.fillStyle(0x3a2410); g.fillRect(-6, -22, 12, 5);
      g.fillStyle(0x000000); g.fillRect(-3, -16, 2, 2); g.fillRect(1, -16, 2, 2);
      this.add.text(tr.col * TILE + 16, tr.row * TILE - 14, speakerName(tr.label), {
        fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(9);
    }
  }

  // ── Player / camera / input ──────────────────────────────────────────────
  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    (this.cycling ? drawRiderBody : drawTrainerBody)(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }
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
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 420, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('⛰ Yeomyeong Highlands (여명산 길)'), {
      fontSize: '14px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  C: bike  SPACE: talk  M: menu'), {
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
      if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; this.steps++; this.checkEncounter(); }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkTrainers();
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

  private checkEncounter() {
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (!t || !ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.22) return;
    this.steps = 0; this.nextEnc = 8 + Math.floor(Math.random() * 8);
    const e = pickEncounter(CB_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'ChilboHighlandsScene');
    this.registry.set('chilboReturnX', this.px); this.registry.set('chilboReturnY', this.py);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  private checkTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`)) continue;
      const wx = tr.col * TILE + 16, wy = tr.row * TILE + 16;
      if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.5) {
        this.cutsceneActive = true;
        this.registry.set('trainerName', tr.name);
        this.registry.set('trainerKey', tr.key);
        this.registry.set('trainerPokemon', tr.pokemon);
        this.registry.set('trainerExpPool', tr.expPool);
        this.registry.set('trainerReturnScene', 'ChilboHighlandsScene');
        this.registry.set('chilboReturnX', this.px); this.registry.set('chilboReturnY', this.py);
        this.dialog.show([tr.line, `${tr.name}: Let's battle!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    const nearCentre = this.px > 7 * TILE && this.px < 14 * TILE;
    // South → back to Gangcheoldo (arrive at its north road).
    if (this.py > (ROWS - 1) * TILE && nearCentre) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('HamhungCitySceneReturnX', 13.5 * 32); this.registry.set('HamhungCitySceneReturnY', 2 * 32 + 16);
        this.scene.start('HamhungCityScene');
      });
    }
    // North → on to Muyeonhang (arrive at its south road).
    if (this.py < 1 * TILE && nearCentre) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('ChongjinCitySceneReturnX', 13.5 * 32); this.registry.set('ChongjinCitySceneReturnY', 17 * 32 + 16);
        this.scene.start('ChongjinCityScene');
      });
    }
  }
}
