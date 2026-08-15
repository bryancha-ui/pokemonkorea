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

// ── Yeoul Valley (예성강 들녘) ────────────────────────────────────────────────
// The iconic river-plain road linking Songhyeon (south) to the port of Parangpo (north):
// rice paddies behind earthen dikes, the Yeoul crossed by a stone-arch bridge,
// reed beds thick with wild Pokémon, orchard rows, and a roadside 장승 spirit-post.
// Level band sits between the Songhyeon and Parangpo Chiefs (mid-60s).

const T = { GRASS: 0, PATH: 1, TALLGRASS: 2, TREE: 3, DIKE: 4, ROCK: 5, WATER: 6, BRIDGE: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 54;
const COLORS: Record<Tile, number> = {
  [T.GRASS]: 0x62a850, [T.PATH]: 0xcabf95, [T.TALLGRASS]: 0x3f8a32, [T.TREE]: 0x1f5630,
  [T.DIKE]: 0xb59a68, [T.ROCK]: 0x6f6658, [T.WATER]: 0x3f93cf, [T.BRIDGE]: 0x9a6f40,
};
const SOLID = new Set<Tile>([T.TREE, T.ROCK, T.WATER]);
const ENCOUNTER = new Set<Tile>([T.TALLGRASS]);

// Wild encounters — a fertile river plain: waterfowl, paddy dwellers, grassland grazers.
const RV_ENCOUNTERS: EncounterEntry[] = [
  { id: 400, weight: 16, minLevel: 60, maxLevel: 63, isCustom: false, catchRate: 127 }, // Bibarel (riverbank)
  { id: 55,  weight: 12, minLevel: 60, maxLevel: 63, isCustom: false, catchRate: 130 }, // Golduck
  { id: 184, weight: 12, minLevel: 60, maxLevel: 63, isCustom: false, catchRate: 150 }, // Azumarill (reeds)
  { id: 195, weight: 12, minLevel: 60, maxLevel: 63, isCustom: false, catchRate: 140 }, // Quagsire (paddies)
  { id: 626, weight: 10, minLevel: 61, maxLevel: 64, isCustom: false, catchRate: 120 }, // Bouffalant (plain)
  { id: 277, weight: 12, minLevel: 60, maxLevel: 63, isCustom: false, catchRate: 130 }, // Swellow
  { id: 192, weight: 10, minLevel: 60, maxLevel: 63, isCustom: false, catchRate: 120 }, // Sunflora (fields)
  { id: 469, weight: 8,  minLevel: 61, maxLevel: 64, isCustom: false, catchRate: 100 }, // Yanmega (over the reeds)
  { id: 83,  weight: 8,  minLevel: 61, maxLevel: 64, isCustom: false, catchRate: 120 }, // Farfetch'd — cranes in the paddies
  { id: 340, weight: 5,  minLevel: 62, maxLevel: 65, isCustom: false, catchRate: 90  }, // Whiscash (deep river — rarer)
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GRASS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  // Winding central road (cols 10–14)
  fill(0, ROWS, 10, 14, T.PATH);

  // A diked rice paddy: a block of shallow water ringed by an earthen dike.
  const paddy = (r: number, c: number, h: number, w: number) => {
    fill(r - 1, r + h + 1, c - 1, c + w + 1, T.DIKE);
    fill(r, r + h, c, c + w, T.WATER);
  };
  paddy(6, 2, 6, 6);   paddy(6, 16, 6, 6);
  paddy(40, 2, 6, 6);  paddy(40, 16, 6, 6);

  // The Yeoul River cuts across the middle; a stone-arch bridge carries the road.
  fill(25, 29, 0, COLS, T.WATER);
  fill(25, 29, 10, 14, T.BRIDGE);
  fill(24, 25, 9, 15, T.DIKE); fill(29, 30, 9, 15, T.DIKE);  // bridge approaches

  // Reed beds (tall grass) — the wild-encounter zones, along the banks and field edges.
  fill(15, 21, 15, 19, T.TALLGRASS);
  fill(31, 37, 5, 9, T.TALLGRASS);
  fill(46, 51, 15, 20, T.TALLGRASS);
  fill(3, 8, 15, 19, T.TALLGRASS);
  fill(33, 38, 15, 19, T.TALLGRASS);

  // Orchard rows & roadside boulders for detail.
  for (const [r, c] of [[12,15],[20,5],[22,18],[34,4],[48,6],[10,8],[44,20],[18,20]] as [number,number][]) m[r][c] = T.TREE;
  for (const [r, c] of [[23,7],[31,16],[49,9],[9,20]] as [number,number][]) m[r][c] = T.ROCK;
  return m;
}

interface Trainer {
  key: string; name: string; col: number; row: number; color: number; label: string;
  line: string; pokemon: string; expPool: number;
}

export class RyesongValleyScene extends Phaser.Scene {
  public grassTileIds3D = [T.TALLGRASS];
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 12 * TILE + 16;
  private py = 52 * TILE + 16;   // default: enter from the south (Songhyeon side)
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
      key: 'rv-deoksu', name: 'Paddy Farmer Deoksu', col: 8, row: 47, color: 0x6a8a3a, label: 'Farmer',
      line: "This valley's fed the old capital for a thousand years. My Pokémon work these dikes — and they don't tire easy.",
      pokemon: JSON.stringify([{ id: 192, level: 62 }, { id: 465, level: 63 }, { id: 626, level: 63 }]),
      expPool: 1900,
    },
    {
      key: 'rv-miyeon', name: 'Angler Miyeon', col: 16, row: 30, color: 0x2f7fb0, label: 'Angler',
      line: "Best fishing on the whole Yeoul, right off this bridge. Care to wager a battle on who's got the bigger catch?",
      pokemon: JSON.stringify([{ id: 184, level: 63 }, { id: 340, level: 63 }, { id: 119, level: 64 }]),
      expPool: 2000,
    },
    {
      key: 'rv-jinho', name: 'Youngster Jinho', col: 12, row: 21, color: 0xcc7a3a, label: 'Youngster',
      line: "Walked all the way from Songhyeon! My team's tougher than it looks, mister!",
      pokemon: JSON.stringify([{ id: 264, level: 61 }, { id: 508, level: 62 }]),
      expPool: 1600,
    },
    {
      key: 'rv-bawoo', name: 'Hiker Bawoo', col: 6, row: 38, color: 0x8a6a3a, label: 'Hiker',
      line: "I follow the dikes up to the sea and back. Rock-hard legs, rock-hard team. Let's go!",
      pokemon: JSON.stringify([{ id: 76, level: 62 }, { id: 526, level: 63 }, { id: 208, level: 63 }]),
      expPool: 1950,
    },
    {
      key: 'rv-scout', name: '노스단 Scout Garam', col: 16, row: 13, color: 0x24242e, label: '노스단\nScout',
      line: "You're the one nosing around the Chiefs' business. The valley road is ours tonight — cargo moves north. Turn back, Champion.",
      pokemon: JSON.stringify([{ id: 510, level: 63 }, { id: 435, level: 63 }, { id: 553, level: 64 }]),
      expPool: 2100,
    },
  ];

  constructor() { super('RyesongValleyScene'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    playBgm(this, 'ryesong');
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('ryesongReturnX') as number | undefined;
    const ry = this.registry.get('ryesongReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('ryesongReturnX'); this.registry.remove('ryesongReturnY');

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
      waterTiles: [T.WATER], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'RyesongValleyScene');
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.GRASS) { g.fillStyle(0x4f8f40, 0.5); g.fillRect(x + 6, y + 8, 4, 3); g.fillRect(x + 18, y + 20, 4, 3); }
      if (t === T.TALLGRASS) { g.fillStyle(0x2c6a22, 0.75); for (let i = 0; i < 3; i++) { g.fillRect(x + 5 + i * 8, y + 16, 2, 12); g.fillRect(x + 7 + i * 8, y + 12, 2, 16); } }
      if (t === T.TREE) { g.fillStyle(0x1a4a24); g.fillCircle(x + 16, y + 15, 12); g.fillStyle(0x2f7a3a); g.fillCircle(x + 12, y + 12, 6); g.fillStyle(0x5a3a20); g.fillRect(x + 14, y + 24, 4, 6); }
      if (t === T.ROCK) { g.fillStyle(0x5a5044); g.fillTriangle(x + 16, y + 5, x + 3, y + 28, x + 29, y + 28); }
      if (t === T.WATER) { g.fillStyle(0x6fb6e6, 0.5); g.fillRect(x + 4, y + 8, 12, 3); g.fillRect(x + 12, y + 20, 10, 3); }
      if (t === T.DIKE) { g.fillStyle(0x9a824e, 0.6); g.fillRect(x, y + 12, TILE, 6); }
      if (t === T.BRIDGE) { g.fillStyle(0x6f4e28, 1); g.fillRect(x, y + 4, TILE, 3); g.fillRect(x, y + 25, TILE, 3); g.fillStyle(0x855e33, 0.8); for (let i = 0; i < 4; i++) g.fillRect(x + 2 + i * 8, y + 8, 5, 15); }
    }
    const key = '__ryesongMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    // Roadside 장승 (spirit-post) — a small iconic landmark by the bridge approach.
    const jang = this.add.graphics().setDepth(6);
    jang.setPosition(9 * TILE + 4, 30 * TILE + 20);
    jang.fillStyle(0x6a3f22); jang.fillRect(-4, -26, 8, 30);
    jang.fillStyle(0xd8c090); jang.fillRect(-7, -34, 14, 12);
    jang.fillStyle(0x000000); jang.fillRect(-4, -30, 3, 3); jang.fillRect(1, -30, 3, 3); jang.fillRect(-3, -24, 6, 2);
    this.add.text(9 * TILE + 4, 30 * TILE - 20, '장승', { fontSize: '8px', color: '#ffe', backgroundColor: '#00000088', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(7);

    this.add.text(12 * TILE, 53.4 * TILE, tr('↓ Songhyeon'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(12 * TILE, 0.7 * TILE, tr('↑ Parangpo'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`) && vanishesAfterDefeat(tr.key)) continue;   // only story villains vanish; regular trainers stay put
      const g = this.add.graphics().setDepth(8);
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(tr.color); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x1a1a2e); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -22, 12, 12);
      g.fillStyle(0x220000); g.fillRect(-6, -22, 12, 5);
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
    this.add.text(this.scale.width / 2, 22, tr('🌾 Yeoul Valley (예성강 들녘)'), {
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
    const e = pickEncounter(RV_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'RyesongValleyScene');
    this.registry.set('ryesongReturnX', this.px); this.registry.set('ryesongReturnY', this.py);
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
        this.registry.set('trainerReturnScene', 'RyesongValleyScene');
        this.registry.set('ryesongReturnX', this.px); this.registry.set('ryesongReturnY', this.py);
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
    // South → back to Songhyeon (arrive at its north road).
    if (this.py > (ROWS - 1) * TILE && nearCentre) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('kaesongReturnX', 13 * 32); this.registry.set('kaesongReturnY', 2 * 32 + 16);
        this.scene.start('KaesongCityScene');
      });
    }
    // North → on to Parangpo (arrive at its south road).
    if (this.py < 1 * TILE && nearCentre) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('NampoCitySceneReturnX', 13.5 * 32); this.registry.set('NampoCitySceneReturnY', 17 * 32 + 16);
        this.scene.start('NampoCityScene');
      });
    }
  }
}
