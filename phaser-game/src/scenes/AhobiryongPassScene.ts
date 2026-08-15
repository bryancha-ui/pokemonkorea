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

// ── Bukpung Pass (북풍 고개) ──────────────────────────────────────────────
// The high mountain crossing that carries the circuit from Parangpo on the West Sea
// over the peninsula's granite spine down toward Haesol on the East Sea: pine
// forests, sheer cliffs, a snow-fed stream crossed by a plank bridge, a wayfarers'
// stone cairn (돌탑) at the summit, wild highland Pokémon and hardy mountain trainers.

const T = { GRASS: 0, PATH: 1, TALLGRASS: 2, PINE: 3, CLIFF: 4, ROCK: 5, STREAM: 6, BRIDGE: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 52;
const COLORS: Record<Tile, number> = {
  [T.GRASS]: 0x6a9a5a, [T.PATH]: 0xcabf95, [T.TALLGRASS]: 0x3f8a32, [T.PINE]: 0x1c4a2a,
  [T.CLIFF]: 0x7d7468, [T.ROCK]: 0x6f6658, [T.STREAM]: 0x4a93c4, [T.BRIDGE]: 0x9a6f40,
};
const SOLID = new Set<Tile>([T.PINE, T.CLIFF, T.ROCK, T.STREAM]);
const ENCOUNTER = new Set<Tile>([T.TALLGRASS]);

// Wild highland Pokémon — rock, ground, fighting and mountain fliers.
const AB_ENCOUNTERS: EncounterEntry[] = [
  { id: 95,  weight: 14, minLevel: 63, maxLevel: 66, isCustom: false, catchRate: 120 }, // Onix
  { id: 75,  weight: 14, minLevel: 63, maxLevel: 66, isCustom: false, catchRate: 120 }, // Graveler
  { id: 111, weight: 12, minLevel: 63, maxLevel: 66, isCustom: false, catchRate: 120 }, // Rhyhorn
  { id: 67,  weight: 12, minLevel: 63, maxLevel: 66, isCustom: false, catchRate: 90  }, // Machoke
  { id: 164, weight: 12, minLevel: 63, maxLevel: 66, isCustom: false, catchRate: 100 }, // Noctowl
  { id: 227, weight: 10, minLevel: 64, maxLevel: 67, isCustom: false, catchRate: 90  }, // Skarmory
  { id: 207, weight: 10, minLevel: 63, maxLevel: 66, isCustom: false, catchRate: 120 }, // Gligar
  { id: 217, weight: 8,  minLevel: 64, maxLevel: 67, isCustom: false, catchRate: 90  }, // Ursaring
  { id: 185, weight: 8,  minLevel: 63, maxLevel: 66, isCustom: false, catchRate: 100 }, // Sudowoodo
  { id: 359, weight: 5,  minLevel: 65, maxLevel: 67, isCustom: false, catchRate: 60  }, // Absol (rare omen of the peaks)
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GRASS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  // Central winding pass road (cols 10-13)
  fill(0, ROWS, 10, 14, T.PATH);
  // Granite cliffs walling both flanks
  fill(0, ROWS, 0, 3, T.CLIFF);
  fill(0, ROWS, 21, COLS, T.CLIFF);
  // A snow-fed stream cuts across, crossed by a plank bridge on the road
  fill(25, 28, 3, 21, T.STREAM);
  fill(25, 28, 10, 14, T.BRIDGE);
  // Tall-grass clearings (wild-encounter zones)
  fill(6, 12, 4, 9, T.TALLGRASS);
  fill(16, 22, 15, 20, T.TALLGRASS);
  fill(31, 37, 4, 9, T.TALLGRASS);
  fill(40, 46, 14, 20, T.TALLGRASS);
  fill(3, 7, 15, 20, T.TALLGRASS);
  // Pines and boulders for detail
  for (const [r, c] of [[9,15],[14,6],[20,7],[30,16],[38,6],[44,8],[12,18],[34,18],[47,15],[5,9]] as [number,number][]) m[r][c] = T.PINE;
  for (const [r, c] of [[19,16],[23,7],[33,15],[43,7],[8,17],[29,6]] as [number,number][]) m[r][c] = T.ROCK;
  return m;
}

interface Trainer { key: string; name: string; col: number; row: number; color: number; label: string; line: string; pokemon: string; expPool: number; }

export class AhobiryongPassScene extends Phaser.Scene {
  // A mountain pass has no buildings — erase every auto-detected building shape
  // (only named-model plots, of which there are none, would rise in 3D).
  public onlyNamedBuildings = true;
  public grassTileIds3D = [T.TALLGRASS];

  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 11 * TILE + 16;
  private py = 47 * TILE + 16;   // default: enter from the south (Parangpo side), a few tiles inside the edge
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;

  private readonly TRAINERS: Trainer[] = [
    {
      key: 'ab-cheolho', name: 'Hiker Cheolho', col: 9, row: 44, color: 0x8a6a3a, label: 'Hiker',
      line: "I've climbed this pass a hundred times. My team's as hard as the granite up here — let's go!",
      pokemon: JSON.stringify([{ id: 75, level: 64 }, { id: 208, level: 65 }, { id: 526, level: 65 }]), expPool: 2000,
    },
    {
      key: 'ab-muljin', name: 'Black Belt Muljin', col: 12, row: 34, color: 0xaa5533, label: 'Black\nBelt',
      line: "The thin mountain air separates the strong from the weak. Which are you? Let's find out!",
      pokemon: JSON.stringify([{ id: 67, level: 64 }, { id: 297, level: 65 }, { id: 68, level: 66 }]), expPool: 2100,
    },
    {
      key: 'ab-sora', name: 'Bird Keeper Sora', col: 9, row: 20, color: 0x3a8a6a, label: 'Bird\nKeeper',
      line: "My birds ride the updrafts off these cliffs. You'll not clip their wings easily!",
      pokemon: JSON.stringify([{ id: 227, level: 64 }, { id: 164, level: 64 }, { id: 398, level: 65 }]), expPool: 2000,
    },
    {
      key: 'ab-yena', name: 'Picnicker Yena', col: 9, row: 23, color: 0xcc6a9a, label: 'Picnicker',
      line: "What a view from up here! Oh — you want to battle? By the cairn, then. For luck!",
      pokemon: JSON.stringify([{ id: 241, level: 64 }, { id: 185, level: 65 }]), expPool: 1800,
    },
    {
      key: 'ab-dohyeon', name: 'Camper Dohyeon', col: 12, row: 10, color: 0x6a8a3a, label: 'Camper',
      line: "Camped by the summit all week. The wild Pokémon here are no joke — and neither am I!",
      pokemon: JSON.stringify([{ id: 217, level: 65 }, { id: 472, level: 66 }]), expPool: 2000,
    },
  ];

  constructor() { super('AhobiryongPassScene'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    playBgm(this, 'ahobiryong');
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('ahobiryongReturnX') as number | undefined;
    const ry = this.registry.get('ahobiryongReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('ahobiryongReturnX'); this.registry.remove('ahobiryongReturnY');

    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawTrainers();
    this.createPlayer();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [T.STREAM], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'AhobiryongPassScene');
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.GRASS) { g.fillStyle(0x578a48, 0.5); g.fillRect(x + 6, y + 8, 4, 3); g.fillRect(x + 18, y + 20, 4, 3); }
      if (t === T.TALLGRASS) { g.fillStyle(0x2c6a22, 0.75); for (let i = 0; i < 3; i++) { g.fillRect(x + 5 + i * 8, y + 16, 2, 12); g.fillRect(x + 7 + i * 8, y + 12, 2, 16); } }
      if (t === T.PINE) { g.fillStyle(0x123a1e); g.fillTriangle(x + 16, y + 1, x + 4, y + 20, x + 28, y + 20); g.fillStyle(0x1f5630); g.fillTriangle(x + 16, y + 8, x + 6, y + 26, x + 26, y + 26); g.fillStyle(0x4a3020); g.fillRect(x + 14, y + 26, 5, 5); }
      if (t === T.CLIFF) { g.fillStyle(0x6a6156); g.fillRect(x + 3, y + 5, 8, 8); g.fillRect(x + 17, y + 16, 9, 9); g.fillStyle(0x8f867a, 0.5); g.fillRect(x + 4, y + 6, 4, 3); }
      if (t === T.ROCK) { g.fillStyle(0x5a5044); g.fillTriangle(x + 16, y + 5, x + 3, y + 28, x + 29, y + 28); }
      if (t === T.STREAM) { g.fillStyle(0x7ec2e6, 0.5); g.fillRect(x + 4, y + 8, 12, 3); g.fillRect(x + 12, y + 20, 10, 3); }
      if (t === T.BRIDGE) { g.fillStyle(0x6f4e28, 1); g.fillRect(x, y + 4, TILE, 3); g.fillRect(x, y + 25, TILE, 3); g.fillStyle(0x855e33, 0.8); for (let i = 0; i < 4; i++) g.fillRect(x + 2 + i * 8, y + 8, 5, 15); }
    }
    const key = '__ahobiryongMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    // Wayfarers' stone cairn (돌탑) at the summit, just north of the bridge.
    const cx = 8 * TILE + 16, cy = 22 * TILE + 20;
    const cg = this.add.graphics().setDepth(6);
    cg.fillStyle(0x000000, 0.2); cg.fillEllipse(cx, cy + 8, 26, 7);
    for (let i = 0; i < 5; i++) { cg.fillStyle(i % 2 ? 0x7a7064 : 0x8f867a, 1); const w = 22 - i * 3.5; cg.fillEllipse(cx, cy - i * 7, w, 6); }
    this.add.text(cx, cy - 44, '돌탑', { fontSize: '8px', color: '#ffe', backgroundColor: '#00000088', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(7);

    this.add.text(11.5 * TILE, 51.4 * TILE, tr('↓ Parangpo'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(11.5 * TILE, 0.7 * TILE, tr('↑ Haesol'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`) && vanishesAfterDefeat(tr.key)) continue;   // beaten trainers stay put
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
    this.add.text(this.scale.width / 2, 22, tr('⛰ Bukpung Pass (북풍 고개)'), {
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
    const e = pickEncounter(AB_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'AhobiryongPassScene');
    this.registry.set('ahobiryongReturnX', this.px); this.registry.set('ahobiryongReturnY', this.py);
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
        this.registry.set('trainerReturnScene', 'AhobiryongPassScene');
        this.registry.set('ahobiryongReturnX', this.px); this.registry.set('ahobiryongReturnY', this.py);
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
    const nearCentre = this.px > 9 * TILE && this.px < 15 * TILE;
    // South → back to Parangpo (arrive at its north road).
    if (this.py > (ROWS - 1) * TILE && nearCentre) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('NampoCitySceneReturnX', 13.5 * 32); this.registry.set('NampoCitySceneReturnY', 2 * 32 + 16);
        this.scene.start('NampoCityScene');
      });
    }
    // North → on to Haesol (arrive at its south road).
    if (this.py < 1 * TILE && nearCentre) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('WonsanCitySceneReturnX', 13.5 * 32); this.registry.set('WonsanCitySceneReturnY', 17 * 32 + 16);
        this.scene.start('WonsanCityScene');
      });
    }
  }
}
