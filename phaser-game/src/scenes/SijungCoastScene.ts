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

// ── Sijung Coast (시중호 해안길) ─────────────────────────────────────────────────
// The East-Sea coast road linking Haesol to the steel city of Gangcheoldo: the famous
// Sijung lagoon (시중호) inland, dunes and a pine windbreak along the shore, the
// paddies of the Gangcheoldo plain to the north — and, on the horizon, the smokestacks
// of Gangcheoldo's great steelworks.

const T = { GRASS: 0, PATH: 1, TALLGRASS: 2, PINE: 3, SAND: 4, SEA: 5, ROCK: 6 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 52;
const COLORS: Record<Tile, number> = {
  [T.GRASS]: 0x6fa054, [T.PATH]: 0xcabf95, [T.TALLGRASS]: 0x3f8a32, [T.PINE]: 0x1c4a2a,
  [T.SAND]: 0xe4d6a8, [T.SEA]: 0x2f78b4, [T.ROCK]: 0x6f6658,
};
const SOLID = new Set<Tile>([T.PINE, T.SEA, T.ROCK]);
const ENCOUNTER = new Set<Tile>([T.TALLGRASS]);

// Wild coast & plain Pokémon.
const SJ_ENCOUNTERS: EncounterEntry[] = [
  { id: 279, weight: 14, minLevel: 66, maxLevel: 68, isCustom: false, catchRate: 120 }, // Pelipper
  { id: 226, weight: 12, minLevel: 66, maxLevel: 68, isCustom: false, catchRate: 90  }, // Mantine
  { id: 320, weight: 12, minLevel: 66, maxLevel: 68, isCustom: false, catchRate: 120 }, // Wailmer
  { id: 224, weight: 10, minLevel: 66, maxLevel: 68, isCustom: false, catchRate: 120 }, // Octillery
  { id: 626, weight: 12, minLevel: 66, maxLevel: 68, isCustom: false, catchRate: 100 }, // Bouffalant (plain)
  { id: 234, weight: 12, minLevel: 66, maxLevel: 68, isCustom: false, catchRate: 120 }, // Stantler (plain)
  { id: 195, weight: 10, minLevel: 66, maxLevel: 68, isCustom: false, catchRate: 140 }, // Quagsire (lagoon)
  { id: 83,  weight: 10, minLevel: 66, maxLevel: 68, isCustom: false, catchRate: 120 }, // Farfetch'd
  { id: 319, weight: 5,  minLevel: 67, maxLevel: 69, isCustom: false, catchRate: 60  }, // Sharpedo (rare, offshore)
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GRASS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  fill(0, ROWS, 8, 12, T.PATH);        // coastal road
  fill(0, ROWS, 19, COLS, T.SEA);      // the East Sea
  fill(0, ROWS, 17, 19, T.SAND);       // coastal dunes
  // Sijung lagoon (inland, west) with a sandy shore
  fill(22, 31, 1, 7, T.SEA);
  fill(21, 32, 6, 7, T.SAND);
  // a rice paddy of the Gangcheoldo plain, up north
  fill(4, 8, 2, 6, T.SEA);
  fill(3, 9, 5, 6, T.SAND);
  // tall-grass encounter clearings
  fill(11, 17, 12, 16, T.TALLGRASS);
  fill(25, 31, 12, 16, T.TALLGRASS);
  fill(39, 45, 2, 7, T.TALLGRASS);
  fill(44, 50, 12, 16, T.TALLGRASS);
  fill(3, 8, 12, 16, T.TALLGRASS);
  // pine windbreak + a couple inland pines
  for (const [r, c] of [[6,16],[14,16],[22,16],[30,16],[38,16],[46,16],[10,3],[34,4],[18,3]] as [number,number][]) m[r][c] = T.PINE;
  // rocky headlands jutting into the sea
  for (const [r, c] of [[15,18],[28,18],[42,18]] as [number,number][]) m[r][c] = T.ROCK;
  return m;
}

interface Trainer { key: string; name: string; col: number; row: number; color: number; label: string; line: string; pokemon: string; expPool: number; }

export class SijungCoastScene extends Phaser.Scene {
  public grassTileIds3D = [T.TALLGRASS];
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 9 * TILE + 16;
  private py = 47 * TILE + 16;   // default: enter from the south (Haesol side), a few tiles inside
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false; private spawnPx = 0; private spawnPy = 0;
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;

  private readonly TRAINERS: Trainer[] = [
    {
      key: 'sj-bora', name: 'Fisher Bora', col: 9, row: 45, color: 0x2f6f9a, label: 'Fisher',
      line: "Best mullet on the whole East Sea coast comes from these waters. Reel in a battle with me!",
      pokemon: JSON.stringify([{ id: 119, level: 66 }, { id: 211, level: 66 }, { id: 340, level: 67 }]), expPool: 2000,
    },
    {
      key: 'sj-sora', name: 'Bird Keeper Sora', col: 12, row: 31, color: 0x3a8a6a, label: 'Bird\nKeeper',
      line: "Waterfowl gather at the lagoon by the thousand. My flock rules these skies — care to test them?",
      pokemon: JSON.stringify([{ id: 279, level: 66 }, { id: 227, level: 67 }, { id: 398, level: 67 }]), expPool: 2000,
    },
    {
      key: 'sj-deok', name: 'Paddy Farmer Deok', col: 8, row: 22, color: 0x6a8a3a, label: 'Farmer',
      line: "The Gangcheoldo plain feeds the whole northeast. My beasts work these paddies — and they don't back down!",
      pokemon: JSON.stringify([{ id: 626, level: 66 }, { id: 241, level: 67 }, { id: 465, level: 67 }]), expPool: 2100,
    },
    {
      key: 'sj-haruki', name: 'Swimmer Haruki', col: 13, row: 17, color: 0x2a8ab0, label: 'Swimmer',
      line: "Cold water, warm heart! Swam the whole bay this morning. Let's see if you can keep pace on land!",
      pokemon: JSON.stringify([{ id: 226, level: 67 }, { id: 91, level: 67 }]), expPool: 1900,
    },
    {
      key: 'sj-cheolsu', name: 'Steelworker Cheolsu', col: 10, row: 8, color: 0x6a6f7a, label: 'Steel\nWorker',
      line: "Off-shift from the Gangcheoldo works. You'll want to be tough before you reach the steel city — try me first!",
      pokemon: JSON.stringify([{ id: 208, level: 68 }, { id: 462, level: 69 }]), expPool: 2100,
    },
  ];

  constructor() { super('SijungCoastScene'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    playBgm(this, 'sijung');
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('sijungReturnX') as number | undefined;
    const ry = this.registry.get('sijungReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('sijungReturnX'); this.registry.remove('sijungReturnY');

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
      waterTiles: [T.SEA], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'SijungCoastScene');
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.GRASS) { g.fillStyle(0x5c8f46, 0.5); g.fillRect(x + 6, y + 8, 4, 3); g.fillRect(x + 18, y + 20, 4, 3); }
      if (t === T.TALLGRASS) { g.fillStyle(0x2c6a22, 0.75); for (let i = 0; i < 3; i++) { g.fillRect(x + 5 + i * 8, y + 16, 2, 12); g.fillRect(x + 7 + i * 8, y + 12, 2, 16); } }
      if (t === T.PINE) { g.fillStyle(0x123a1e); g.fillTriangle(x + 16, y + 1, x + 4, y + 20, x + 28, y + 20); g.fillStyle(0x1f5630); g.fillTriangle(x + 16, y + 8, x + 6, y + 26, x + 26, y + 26); g.fillStyle(0x4a3020); g.fillRect(x + 14, y + 26, 5, 5); }
      if (t === T.SAND) { g.fillStyle(0xd6c48c, 0.7); g.fillRect(x + 6, y + 10, 4, 3); g.fillRect(x + 18, y + 20, 4, 3); }
      if (t === T.SEA) { g.fillStyle(0x66b0e0, 0.5); g.fillRect(x + 4, y + 8, 13, 3); g.fillRect(x + 13, y + 20, 11, 3); g.fillStyle(0xffffff, 0.28); g.fillRect(x + 2, y + 3, 9, 2); }
      if (t === T.ROCK) { g.fillStyle(0x5a5044); g.fillTriangle(x + 16, y + 5, x + 3, y + 28, x + 29, y + 28); }
    }
    const key = '__sijungMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(9.5 * TILE, 51.4 * TILE, tr('↓ Haesol'), { fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
    this.add.text(9.5 * TILE, 0.7 * TILE, tr('↑ Gangcheoldo'), { fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
    this.add.text(3.5 * TILE, 26 * TILE, tr('시중호\n(Sijung Lagoon)'), { fontSize: '8px', color: '#eaf6ff', align: 'center', backgroundColor: '#00000066', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    this.add.text(21.5 * TILE, 34 * TILE, tr('동해\nEast Sea'), { fontSize: '8px', color: '#eaf6ff', align: 'center', backgroundColor: '#00000055', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    this.add.text(3.5 * TILE, 12 * TILE, tr('강철도 평야\nHamhung Plain'), { fontSize: '8px', color: '#fff', align: 'center', backgroundColor: '#00000055', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
  }

  private drawIcons() {
    // Coastal lighthouse on a rocky point
    const lx = 18 * TILE + 8, ly = 11 * TILE;
    const lg = this.add.graphics().setDepth(6);
    lg.fillStyle(0xf2f2f2); lg.fillRect(lx, ly, 16, 40);
    lg.fillStyle(0xd63b3b); for (let i = 0; i < 3; i++) lg.fillRect(lx, ly + i * 14, 16, 7);
    lg.fillStyle(0xffe066); lg.fillRect(lx - 3, ly - 8, 22, 9);
    this.add.text(lx + 8, ly - 12, '🗼 등대', { fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(7);

    // Gangcheoldo steelworks smokestacks on the northern horizon
    const sg = this.add.graphics().setDepth(6);
    const sx = 2 * TILE + 4, sy = 1 * TILE + 8;
    sg.fillStyle(0x555a63); sg.fillRect(sx, sy, 40, 18);
    for (let i = 0; i < 3; i++) { sg.fillStyle(0x6a7078); sg.fillRect(sx + 4 + i * 13, sy - 22, 7, 24); sg.fillStyle(0xd8d8d8, 0.55); sg.fillCircle(sx + 7 + i * 13, sy - 26, 6); }
    this.add.text(sx + 20, sy - 34, tr('🏭 Gangcheoldo Steelworks'), { fontSize: '8px', color: '#fff', backgroundColor: '#00000099', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(7);
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
    this.add.text(this.scale.width / 2, 22, tr('🌅 Sijung Coast (시중호 해안길)'), {
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
    const e = pickEncounter(SJ_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'SijungCoastScene');
    this.registry.set('sijungReturnX', this.px); this.registry.set('sijungReturnY', this.py);
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
        this.registry.set('trainerReturnScene', 'SijungCoastScene');
        this.registry.set('sijungReturnX', this.px); this.registry.set('sijungReturnY', this.py);
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
    const nearCentre = this.px > 6 * TILE && this.px < 13 * TILE;
    // South → back to Haesol (arrive at its north road).
    if (this.py > (ROWS - 1) * TILE && nearCentre) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('WonsanCitySceneReturnX', 13.5 * 32); this.registry.set('WonsanCitySceneReturnY', 2 * 32 + 16);
        this.scene.start('WonsanCityScene');
      });
    }
    // North → on to Gangcheoldo (arrive at its south road).
    if (this.py < 1 * TILE && nearCentre) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('HamhungCitySceneReturnX', 13.5 * 32); this.registry.set('HamhungCitySceneReturnY', 17 * 32 + 16);
        this.scene.start('HamhungCityScene');
      });
    }
  }
}
