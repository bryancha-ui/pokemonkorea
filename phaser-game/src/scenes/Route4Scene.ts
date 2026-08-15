import Phaser from 'phaser';
import { installSurfing, isSurfing } from '../systems/SurfSystem';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { vanishesAfterDefeat } from '../data/Villains';
import { drawTrainerBody, drawRiderBody, playerDesign, rivalDesign, rivalTrainerName } from '../data/CharacterSprite';
import { markRivalPortrait } from '../data/BattlePortraits';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';
import type { PropPlot } from '../engine3d/TerrainBuilder';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = { GRASS: 0, PATH: 1, TALLGRASS: 2, CLIFF: 3, ROCK: 4, SEA: 5, SAND: 6, RAIL: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 60;
const COLORS: Record<Tile, number> = {
  [T.GRASS]: 0x6aa84a, [T.PATH]: 0xcabf95, [T.TALLGRASS]: 0x3f8a32, [T.CLIFF]: 0x9a8f7a,
  [T.ROCK]: 0x6f6658, [T.SEA]: 0x2570c0, [T.SAND]: 0xe6d8a8, [T.RAIL]: 0x8a7a5a,
};
const SOLID = new Set<Tile>([T.CLIFF, T.ROCK, T.SEA, T.RAIL]);
const ENCOUNTER = new Set<Tile>([T.TALLGRASS]);

const BARRIER_ROWS = [24, 25];
const BARRIER_COLS = [9, 10, 11, 12, 13, 14];
const R4_ROCKS: Array<[number, number]> = [[8,5],[20,5],[40,6],[52,5],[14,16],[34,16],[48,16]];

// Coastal cliffside encounters — seabirds, cliff goats, shallows fish (mostly new)
const R4_ENCOUNTERS: EncounterEntry[] = [
  { id: 'frysm',       weight: 14, minLevel: 27, maxLevel: 29, isCustom: true,  catchRate: 170 }, // Water/Psychic
  { id: 'roundtailor', weight: 16, minLevel: 27, maxLevel: 29, isCustom: true,  catchRate: 200 }, // Water
  { id: 'ottershaman', weight: 12, minLevel: 27, maxLevel: 29, isCustom: true,  catchRate: 190 }, // Water
  { id: 'gorcobat',    weight: 12, minLevel: 27, maxLevel: 29, isCustom: true,  catchRate: 170 }, // Grass/Fighting (cliffs)
  { id: 'kingfisher',  weight: 12, minLevel: 27, maxLevel: 29, isCustom: true,  catchRate: 190 }, // Flying/Electric
  { id: 'disguijar',   weight: 10, minLevel: 27, maxLevel: 29, isCustom: true,  catchRate: 190 }, // Rock/Flying
  { id: 278, weight: 14, minLevel: 27, maxLevel: 29, isCustom: false, catchRate: 225 }, // Wingull
  { id: 98,  weight: 10, minLevel: 27, maxLevel: 29, isCustom: false, catchRate: 225 }, // Krabby
  { id: 'twinkluppy', weight: 12, minLevel: 27, maxLevel: 29, isCustom: true, catchRate: 190 }, // Water/Fairy pup
  { id: 'kelpoxin',   weight: 10, minLevel: 27, maxLevel: 28, isCustom: true, catchRate: 170 }, // Poison/Water
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GRASS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  fill(0, ROWS, 9, 15, T.PATH);
  // Cliff wall on the west, open sea on the east (the road hugs the coast)
  fill(0, ROWS, 0, 4, T.CLIFF);
  fill(0, ROWS, 18, COLS, T.SEA);
  fill(0, ROWS, 16, 18, T.SAND);   // thin beach edge
  // Cliff rocks and tide pools
  for (const [r, c] of R4_ROCKS) m[r][c] = T.ROCK;
  // Tall grass clearings
  fill(8, 14, 15, 16, T.TALLGRASS); // narrow strip
  fill(34, 42, 5, 9, T.TALLGRASS);
  fill(50, 56, 15, 16, T.TALLGRASS);
  fill(10, 16, 5, 9, T.TALLGRASS);
  return m;
}

export class Route4Scene extends Phaser.Scene {
  public grassTileIds3D = [T.TALLGRASS];
  /** Replace the complete painted west cliff with continuous 3D mountain ranges. */
  public mountainTileIds3D = [T.CLIFF];
  /** Road, beach and boulder footprints remain ground-level in the 3D pass. */
  public flatTileIds3D = [T.PATH, T.SAND, T.ROCK];
  public noRocks3D = true;
  /** Isolated rock markings become correctly sized 3D boulders, not full peaks. */
  public propPlots: PropPlot[] = R4_ROCKS.map(([r, c], i) => ({
    x: c, y: r, kind: 'rock' as const,
    scale: 0.86 + (i % 3) * 0.08, rot: i * 0.71,
  }));
  private map!: Tile[][];
  /** Coastal road: no random bus scatter (its flat road tiles were sprouting buses). */
  public noVehicles = true;
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 12 * TILE + 16;
  private py = 57 * TILE + 16;   // enter from south (Geumgang side)
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;

  private readonly TRAINERS = [
    {
      key: 'r4-mansik', name: 'Sailor Mansik', col: 6, row: 44, color: 0x2266bb, label: 'Sailor',
      line: "Ahoy! Salt in my beard, salt in my blood. My sea-Pokémon will wash you right off this cliff!",
      pokemon: JSON.stringify([{ id: 0, level: 27, custom: 'paratoxin' }, { id: 0, level: 27, custom: 'ottermudang' }]),
      expPool: 760,
    },
    {
      key: 'r4-dalsu', name: 'Fisherman Dalsu', col: 16, row: 12, color: 0x227755, label: 'Fisher-\nman',
      line: "Been castin' this stretch forty years. Reel one in with me — winner keeps their pride!",
      pokemon: JSON.stringify([{ id: 0, level: 27, custom: 'roundtailor' }, { id: 0, level: 28, custom: 'frysm' }]),
      expPool: 740,
    },
  ] as const;

  constructor() { super('Route4Scene'); }

  private get ryeoDone() { return !!this.registry.get('trainerDefeated_nosdan-ryeo-2'); }

  create() {

    playBgm(this, 'route4');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('route4ReturnX') as number | undefined;
    const ry = this.registry.get('route4ReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('route4ReturnX'); this.registry.remove('route4ReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawTrainers();
    if (!this.ryeoDone) this.drawRyeo();
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
    SaveManager.save(this.registry, this.px, this.py, 'Route4Scene');
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.TALLGRASS) { g.fillStyle(0x2c6a22, 0.7); for (let i=0;i<3;i++){ g.fillRect(c*TILE+5+i*8, r*TILE+16, 2, 12); g.fillRect(c*TILE+7+i*8, r*TILE+12, 2, 16);} }
      if (t === T.CLIFF) { g.fillStyle(0x7f7565); g.fillRect(c*TILE+3, r*TILE+5, 7, 7); g.fillRect(c*TILE+18, r*TILE+17, 8, 8); }
      if (t === T.SEA) { g.fillStyle(0x66bbe6, 0.4); g.fillRect(c*TILE+4, r*TILE+8, 12, 3); g.fillRect(c*TILE+12, r*TILE+22, 10, 3); }
    }
    const key = '__route4Map__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(12 * TILE, 58.4 * TILE, tr('↓ Geumgang City'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(12 * TILE, 0.7 * TILE, tr('↑ Haean City'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#2a6a8a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`) && vanishesAfterDefeat(tr.key)) continue;
      const g = this.add.graphics().setDepth(8);
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(tr.color); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x1a1a6e); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -22, 12, 12);
      g.fillStyle(0x220000); g.fillRect(-6, -22, 12, 5);
      g.fillStyle(0x000000); g.fillRect(-3, -16, 2, 2); g.fillRect(1, -16, 2, 2);
      this.add.text(tr.col * TILE + 16, tr.row * TILE - 12, speakerName(tr.label), {
        fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(9);
    }
  }

  private drawRyeo() {
    const rope = this.add.graphics().setDepth(6);
    rope.lineStyle(3, 0x222244, 1);
    rope.lineBetween(9 * TILE, 24 * TILE + 16, 15 * TILE, 24 * TILE + 16);
    const g = this.add.graphics().setDepth(8);
    g.setPosition(12 * TILE + 16, 25 * TILE + 16);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(0x14141e); g.fillRect(-7, -8, 14, 12);
    g.fillStyle(0xaab0c0); g.fillRect(-7, -8, 14, 2);
    g.fillStyle(0x222222); g.fillRect(-6, 4, 5, 8); g.fillRect(1, 4, 5, 8);
    g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
    g.fillStyle(0x0a0a10); g.fillRect(-6, -21, 12, 5);
    g.fillStyle(0x88ccff); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2);
    this.add.text(12 * TILE + 16, 25 * TILE - 12, speakerName('노스단 Commander Ryeo'), {
      fontSize: '8px', color: '#aab8ff', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(9);
  }

  /** The rival appears beside the player for the Commander Ryeo confrontation.
   *  Marked with the gender-based rival avatar so the 3D mirror renders a real 3D
   *  character (previously the "Rival:" lines had no on-screen figure at all). */
  private rivalG?: Phaser.GameObjects.Graphics;
  private drawRival() {
    if (this.rivalG) return;
    const g = this.add.graphics().setDepth(20);
    drawTrainerBody(g, 1, 0, rivalDesign(this.registry));   // 2D: facing up, toward Ryeo
    g.setPosition(this.px - 34, this.py + 2);
    markRivalPortrait(g, this.registry);
    // In 3D the model's facing is independent of the 2D sprite — hold eye contact
    // with Commander Ryeo (his fixed Phaser position) so the rival squares up to him.
    g.setData('characterLookAt3D', { x: 12 * TILE + 16, y: 25 * TILE + 16 });
    this.rivalG = g;
    this.add.text(this.px - 34, this.py - 22, rivalTrainerName(this.registry), {
      fontSize: '9px', color: '#88ccff', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(21);
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
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 410, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🌊 Route 4 — Coastal Cliffside Road (해안 절벽길)'), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  SPACE: talk  M: menu'), {
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
    this.checkRyeo();
    this.checkExits();
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      if (!this.ryeoDone && BARRIER_ROWS.includes(row) && BARRIER_COLS.includes(col)) return true;
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
    const e = pickEncounter(R4_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'Route4Scene');
    this.registry.set('route4ReturnX', this.px); this.registry.set('route4ReturnY', this.py);
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
        this.registry.set('trainerReturnScene', 'Route4Scene');
        this.registry.set('route4ReturnX', this.px); this.registry.set('route4ReturnY', this.py);
        this.dialog.show([tr.line, `${tr.name}: Let's battle!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkRyeo() {
    if (this.ryeoDone) return;
    if (this.py > 29 * TILE) return;
    this.cutsceneActive = true;
    this.drawRival();   // the rival steps up beside you to confront Ryeo (3D character)
    const launch = () => {
      this.registry.set('trainerName', 'Commander Ryeo');
      this.registry.set('trainerKey', 'nosdan-ryeo-2');
      this.registry.set('trainerPokemon', JSON.stringify([
        { id: 0, level: 28, custom: 'corrpanda' },
        { id: 0, level: 29, custom: 'martbadger' },   // Dark/Steel
        { id: 229, level: 31 },                         // Houndoom (Fire/Dark ace)
      ]));
      this.registry.set('trainerExpPool', 980);
      this.registry.set('trainerReturnScene', 'Route4Scene');
      this.registry.set('route4ReturnX', 12 * TILE + 16);
      this.registry.set('route4ReturnY', 29 * TILE + 16);
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    };
    if (!this.registry.get('ryeo2Seen')) {
      this.registry.set('ryeo2Seen', true);
      this.dialog.show([
        "Commander Ryeo: You again. Then you should hear it plainly.",
        "Commander Ryeo: When the Spirit of Cheonji wakes, its first-moment energy output will be immeasurable. We intend to collect that energy.",
        "Rival: Collect it for WHAT? What do you mean, useful?",
        "Commander Ryeo: The south has prospered for decades while the north has suffered. The imbalance ends.",
        "Commander Ryeo: The Spirit's awakening energy — properly weaponized — will correct it.",
        "Rival: ...That's insane. Move.",
      ], launch);
    } else {
      this.dialog.show(["Commander Ryeo: Still set on stopping us? Come, then."], launch);
    }
  }

  private checkExits() {
    if (isSurfing(this.playerG)) return;
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // South → Geumgang City
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('geumgangCityReturnX', 15 * 32); this.registry.set('geumgangCityReturnY', 2 * 32);
        this.scene.start('GeumgangCityScene');
      });
    }
    // North → Haean City (after Ryeo withdraws)
    if (this.py < 1 * TILE && this.ryeoDone) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('haeanCityReturnX', 3 * 32);
        this.registry.set('haeanCityReturnY', 12 * 32);
        this.scene.start('HaeanCityScene');
      });
    }
  }
}
