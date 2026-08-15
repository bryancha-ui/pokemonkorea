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

// ── Seolun Plateau (설운고원) ──────────────────────────────────────────────────────
// The high cold road from Muyeonhang (fog port, south end) to Binghagwan (Yalu border,
// north end). 설운고원 is the "roof of Korea": Korea's largest, highest plateau —
// endless highland meadows, golden larch forests (이깔나무), the great Jangjin Lake
// (장진호), tilled potato fields, and, toward the frozen border, a creeping frost mist.

const T = { MEADOW: 0, PATH: 1, TALLGRASS: 2, LARCH: 3, ROCK: 4, TARN: 5, FIELD: 6, SNOW: 7, STREAM: 8 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 52;
const COLORS: Record<Tile, number> = {
  [T.MEADOW]: 0x789a58, [T.PATH]: 0xc7bc8e, [T.TALLGRASS]: 0x47883a, [T.LARCH]: 0x2f5738,
  [T.ROCK]: 0x776f61, [T.TARN]: 0x3a7cae, [T.FIELD]: 0x9c7a48, [T.SNOW]: 0xe9eff4, [T.STREAM]: 0x7ec8ec,
};
const SOLID = new Set<Tile>([T.LARCH, T.ROCK, T.TARN, T.STREAM]);
const ENCOUNTER = new Set<Tile>([T.TALLGRASS]);

// Wild cold-highland Pokémon — deer of the meadows, ice things of the frozen north.
const KM_ENCOUNTERS: EncounterEntry[] = [
  { id: 234, weight: 14, minLevel: 70, maxLevel: 72, isCustom: false, catchRate: 120 }, // Stantler
  { id: 586, weight: 12, minLevel: 70, maxLevel: 72, isCustom: false, catchRate: 90  }, // Sawsbuck
  { id: 221, weight: 12, minLevel: 70, maxLevel: 72, isCustom: false, catchRate: 90  }, // Piloswine
  { id: 217, weight: 11, minLevel: 70, maxLevel: 72, isCustom: false, catchRate: 90  }, // Ursaring
  { id: 461, weight: 10, minLevel: 70, maxLevel: 72, isCustom: false, catchRate: 90  }, // Weavile
  { id: 225, weight: 10, minLevel: 70, maxLevel: 72, isCustom: false, catchRate: 120 }, // Delibird
  { id: 614, weight: 9,  minLevel: 70, maxLevel: 72, isCustom: false, catchRate: 60  }, // Beartic (frost north)
  { id: 473, weight: 6,  minLevel: 71, maxLevel: 73, isCustom: false, catchRate: 60  }, // Mamoswine (rare)
  { id: 615, weight: 5,  minLevel: 71, maxLevel: 73, isCustom: false, catchRate: 60  }, // Cryogonal (rare mist)
  { id: 359, weight: 5,  minLevel: 71, maxLevel: 73, isCustom: false, catchRate: 60  }, // Absol (rare omen)
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.MEADOW) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  fill(0, ROWS, 9, 13, T.PATH);        // central plateau track
  fill(0, ROWS, 0, 2, T.LARCH);        // west larch treeline
  fill(0, ROWS, 22, COLS, T.ROCK);     // east rocky plateau rim
  // 장진호 (Jangjin Lake) — the great highland reservoir, west of the road
  fill(29, 37, 3, 8, T.TARN);
  // a highland brook feeding the lake, crossed by a plank bridge on the road
  fill(33, 35, 8, 22, T.STREAM);
  fill(33, 35, 9, 13, T.PATH);         // bridge keeps the road passable
  // golden larch groves scattered across the plateau
  for (const [r, c] of [[6,14],[7,15],[12,6],[13,7],[19,16],[20,17],[24,6],[25,7],[40,15],[41,16],[44,6],[45,7],[10,17],[38,7]] as [number,number][]) m[r][c] = T.LARCH;
  // highland potato fields (고원 감자밭)
  fill(14, 18, 14, 20, T.FIELD);
  fill(43, 47, 14, 20, T.FIELD);
  // tall-grass meadow clearings — where the wild herds graze
  fill(3, 8, 13, 18, T.TALLGRASS);
  fill(10, 16, 3, 8, T.TALLGRASS);
  fill(21, 27, 13, 18, T.TALLGRASS);
  fill(37, 43, 3, 8, T.TALLGRASS);
  fill(23, 29, 4, 8, T.TALLGRASS);
  // frost-rimed patches near the frozen border (the north end)
  fill(0, 6, 2, 9, T.SNOW);
  fill(0, 5, 13, 22, T.SNOW);
  fill(6, 9, 18, 22, T.SNOW);
  // scattered highland boulders + a lone stone cairn (돌탑) beside the road
  for (const [r, c] of [[16,6],[28,17],[46,17],[31,13]] as [number,number][]) m[r][c] = T.ROCK;
  return m;
}

interface Trainer { key: string; name: string; col: number; row: number; color: number; label: string; line: string; pokemon: string; expPool: number; }

export class KaemaPlateauScene extends Phaser.Scene {
  // Open alpine plateau — no buildings. Erase every auto-detected building shape.
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
  private py = 47 * TILE + 16;   // default: enter from the south (Muyeonhang side), a few tiles inside
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false; private spawnPx = 0; private spawnPy = 0;
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;

  private readonly TRAINERS: Trainer[] = [
    {
      key: 'km-poksil', name: 'Herder Poksil', col: 11, row: 44, color: 0x6a7a3a, label: 'Highland\nHerder',
      line: "My deer graze this whole plateau, from lake to larch. They fear neither cold nor stranger — let's see if you do!",
      pokemon: JSON.stringify([{ id: 234, level: 70 }, { id: 586, level: 71 }, { id: 128, level: 71 }]), expPool: 2400,
    },
    {
      key: 'km-doam', name: 'Hiker Doam', col: 6, row: 38, color: 0x8a6a3a, label: 'Hiker',
      line: "Camped by 장진호 all season. The lake freezes so hard you can walk clear across it. My team's just as cold and hard!",
      pokemon: JSON.stringify([{ id: 221, level: 70 }, { id: 217, level: 71 }, { id: 473, level: 72 }]), expPool: 2500,
    },
    {
      key: 'km-seorin', name: 'Ace Trainer Seorin', col: 13, row: 25, color: 0x3a5a9a, label: 'Ace\nTrainer',
      line: "This is the roof of the whole country — 1,300 metres up. The air's thin, but my resolve is not. Battle me!",
      pokemon: JSON.stringify([{ id: 461, level: 71 }, { id: 614, level: 72 }, { id: 359, level: 72 }]), expPool: 2600,
    },
    {
      key: 'km-boram', name: 'Ranger Boram', col: 17, row: 15, color: 0x3a8a5a, label: 'Ranger',
      line: "I patrol the highland fields for poachers. The frost mist rolls in fast up here — travellers get lost. But you? You battle first.",
      pokemon: JSON.stringify([{ id: 225, level: 70 }, { id: 615, level: 71 }, { id: 234, level: 71 }]), expPool: 2400,
    },
    {
      key: 'km-cheol', name: '노스단 Courier Cheol', col: 11, row: 9, color: 0x24242e, label: '노스단\nCourier',
      line: "You crossed the whole plateau to sniff after us? 노스단 hauls its cargo over Seolun by night — bound for the peak. You've seen too much. Fall here!",
      pokemon: JSON.stringify([{ id: 461, level: 71 }, { id: 460, level: 72 }, { id: 461, level: 72 }]), expPool: 2700,
    },
  ];

  constructor() { super('KaemaPlateauScene'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    playBgm(this, 'kaema');
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('kaemaReturnX') as number | undefined;
    const ry = this.registry.get('kaemaReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('kaemaReturnX'); this.registry.remove('kaemaReturnY');

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
      waterTiles: [T.TARN, T.STREAM], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'KaemaPlateauScene');
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.MEADOW) { g.fillStyle(0x62864a, 0.5); g.fillRect(x + 6, y + 8, 4, 3); g.fillRect(x + 18, y + 20, 4, 3); }
      if (t === T.TALLGRASS) { g.fillStyle(0x2f6a26, 0.75); for (let i = 0; i < 3; i++) { g.fillRect(x + 5 + i * 8, y + 16, 2, 12); g.fillRect(x + 7 + i * 8, y + 12, 2, 16); } }
      if (t === T.LARCH) { // golden autumn larch conifer
        g.fillStyle(0x4a3418); g.fillRect(x + 14, y + 22, 4, 8);
        g.fillStyle(0x3f6a3a); g.fillTriangle(x + 16, y + 2, x + 5, y + 18, x + 27, y + 18);
        g.fillStyle(0xb7a338); g.fillTriangle(x + 16, y + 6, x + 8, y + 20, x + 24, y + 20);
        g.fillStyle(0xd8c24e); g.fillTriangle(x + 16, y + 12, x + 10, y + 24, x + 22, y + 24);
      }
      if (t === T.ROCK) { g.fillStyle(0x5c5347); g.fillTriangle(x + 16, y + 5, x + 3, y + 28, x + 29, y + 28); g.fillStyle(0x8f8672, 0.5); g.fillRect(x + 12, y + 12, 5, 4); }
      if (t === T.TARN) { g.fillStyle(0x66b0e0, 0.5); g.fillRect(x + 4, y + 8, 13, 3); g.fillRect(x + 13, y + 20, 11, 3); }
      if (t === T.FIELD) { g.fillStyle(0x7a5c34, 0.7); for (let i = 0; i < 4; i++) g.fillRect(x, y + 4 + i * 7, TILE, 2); g.fillStyle(0x6a9a4a, 0.6); for (let i = 0; i < 4; i++) g.fillRect(x + 4 + i * 8, y + 3, 2, 4); }
      if (t === T.SNOW) { g.fillStyle(0xffffff, 0.7); g.fillCircle(x + 9, y + 11, 3); g.fillCircle(x + 21, y + 22, 3); g.fillStyle(0xcdd8e0, 0.5); g.fillRect(x, y + 26, TILE, 6); }
      if (t === T.STREAM) { g.fillStyle(0xbfe6ff, 0.6); g.fillRect(x, y + 6, TILE, 6); g.fillStyle(0xffffff, 0.35); g.fillRect(x, y + 16, TILE, 3); }
    }
    const key = '__kaemaMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(11 * TILE, 51.4 * TILE, tr('↓ Muyeonhang'), { fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
    this.add.text(11 * TILE, 0.7 * TILE, tr('↑ Binghagwan'), { fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
    this.add.text(5.5 * TILE, 26.5 * TILE, tr('장진호\nJangjin Lake'), { fontSize: '8px', color: '#eaf6ff', align: 'center', backgroundColor: '#00000066', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    this.add.text(16 * TILE, 30 * TILE, tr('설운고원\n한국의 지붕'), { fontSize: '8px', color: '#ffe9c0', align: 'center', backgroundColor: '#00000066', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    this.add.text(17 * TILE, 45.5 * TILE, '고원 감자밭', { fontSize: '8px', color: '#ffe9c0', backgroundColor: '#00000055', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    this.add.text(3 * TILE, 10 * TILE, tr('이깔나무 숲\nLarch Forest'), { fontSize: '8px', color: '#ffeeb0', align: 'center', backgroundColor: '#00000055', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
  }

  private drawIcons() {
    // Stone cairn (돌탑) beside the road, a highland traveller's marker
    this.add.text(13 * TILE + 16, 30 * TILE - 14, '돌탑', { fontSize: '8px', color: '#eae0c8', backgroundColor: '#00000066', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(6);

    // Cold frost mist thickening toward the frozen Yalu border (the north end).
    // Tagged no3d so the 3D mirror never lifts this white overlay into a stray
    // floating structure by the entrance — it stays a flat 2D atmosphere only.
    const mist = this.add.graphics().setDepth(15).setData('no3d', true);
    for (let r = 0; r < 11; r++) {
      const a = 0.34 - r * 0.028;
      mist.fillStyle(0xeaf1f6, Math.max(0, a));
      for (let c = 0; c < COLS; c += 2) mist.fillEllipse(c * TILE + 24, r * TILE + 16, 60, 34);
    }
    this.add.text(11 * TILE, 4 * TILE, tr('❄ 서리 안개 (frost mist)'), { fontSize: '8px', color: '#25404e', backgroundColor: '#eaf1f6cc', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(16);
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
    this.add.rectangle(this.scale.width / 2, 22, 440, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('⛰ Seolun Plateau (설운고원)'), {
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
    const e = pickEncounter(KM_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'KaemaPlateauScene');
    this.registry.set('kaemaReturnX', this.px); this.registry.set('kaemaReturnY', this.py);
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
        this.registry.set('trainerReturnScene', 'KaemaPlateauScene');
        this.registry.set('kaemaReturnX', this.px); this.registry.set('kaemaReturnY', this.py);
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
    // South → back down to Muyeonhang (arrive at its north road).
    if (this.py > (ROWS - 1) * TILE && nearCentre) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('ChongjinCitySceneReturnX', 13.5 * 32); this.registry.set('ChongjinCitySceneReturnY', 2 * 32 + 16);
        this.scene.start('ChongjinCityScene');
      });
    }
    // North → up to Binghagwan (arrive at its south road).
    if (this.py < 1 * TILE && nearCentre) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('SinuijuCitySceneReturnX', 13.5 * 32); this.registry.set('SinuijuCitySceneReturnY', 17 * 32 + 16);
        this.scene.start('SinuijuCityScene');
      });
    }
  }
}
