import Phaser from 'phaser';
import { installSurfing, isSurfing } from '../systems/SurfSystem';
import { tr, speakerName } from '../systems/i18n';
import { vanishesAfterDefeat } from '../data/Villains';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, playerDesign, rivalDesign, rivalTrainerName } from '../data/CharacterSprite';
import { markRivalPortrait, markTrainerPortrait } from '../data/BattlePortraits';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = { GRASS: 0, PATH: 1, TALLGRASS: 2, PINE: 3, CLIFF: 4, ROCK: 5, RIVER: 6, SAND: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 60;
const COLORS: Record<Tile, number> = {
  [T.GRASS]: 0x5aa048, [T.PATH]: 0xcabf95, [T.TALLGRASS]: 0x3f8a32, [T.PINE]: 0x1f5630,
  [T.CLIFF]: 0x8a8070, [T.ROCK]: 0x6f6658, [T.RIVER]: 0x2f8fcf, [T.SAND]: 0xd8cda0,
};
const SOLID = new Set<Tile>([T.PINE, T.CLIFF, T.ROCK, T.RIVER]);
const ENCOUNTER = new Set<Tile>([T.TALLGRASS]);

// Choke the 노스단 commander blocks until defeated
const BARRIER_ROWS = [24, 25];
const BARRIER_COLS = [9, 10, 11, 12, 13, 14];

// Wild encounters — Diamond Gorge (granite cliffs + clear river): mostly new customs
const R3_ENCOUNTERS: EncounterEntry[] = [
  { id: 'cerrapin',    weight: 16, minLevel: 22, maxLevel: 26, isCustom: true,  catchRate: 180 }, // Rock/Water
  { id: 'roundtailor', weight: 16, minLevel: 22, maxLevel: 26, isCustom: true,  catchRate: 200 }, // Water
  { id: 'ottershaman', weight: 12, minLevel: 22, maxLevel: 26, isCustom: true,  catchRate: 190 }, // Water
  { id: 'odamryul',    weight: 10, minLevel: 22, maxLevel: 26, isCustom: true,  catchRate: 200 }, // Water
  { id: 'kingfisher',  weight: 12, minLevel: 22, maxLevel: 26, isCustom: true,  catchRate: 200 }, // Flying/Electric
  { id: 'doribi',      weight: 14, minLevel: 22, maxLevel: 26, isCustom: true,  catchRate: 220 }, // Normal
  { id: 'disguijar',   weight: 8,  minLevel: 22, maxLevel: 26, isCustom: true,  catchRate: 200 }, // Rock/Flying (cliffs)
  { id: 118,           weight: 10, minLevel: 22, maxLevel: 26, isCustom: false, catchRate: 225 }, // Goldeen
  { id: 'aroryong',    weight: 4,  minLevel: 25, maxLevel: 26, isCustom: true,  catchRate: 60  }, // Water/Dragon (rare)
  { id: 'tigerbabe',   weight: 12, minLevel: 22, maxLevel: 26, isCustom: true,  catchRate: 190 }, // Fire/Steel cub
  { id: 'volthopper',  weight: 12, minLevel: 22, maxLevel: 26, isCustom: true,  catchRate: 200 }, // Electric/Bug (grasslands)
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GRASS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  // Central path (cols 9-15)
  fill(0, ROWS, 9, 15, T.PATH);
  // Granite cliffs on both flanks
  fill(0, ROWS, 0, 4, T.CLIFF);
  fill(0, ROWS, 20, COLS, T.CLIFF);
  // The river runs down the west shoulder with sandy banks
  fill(0, ROWS, 4, 7, T.RIVER);
  fill(0, ROWS, 7, 9, T.SAND);
  // Stepping-stone crossings over the river
  for (const r of [12, 30, 46]) fill(r, r + 1, 4, 9, T.PATH);
  // Tall-grass clearings (east shoulder)
  fill(8, 14, 15, 19, T.TALLGRASS);
  fill(34, 42, 15, 19, T.TALLGRASS);
  fill(50, 56, 15, 19, T.TALLGRASS);
  // Boulders & pines for detail
  for (const [r, c] of [[6,17],[20,18],[44,16],[10,5]] as [number,number][]) m[r][c] = T.ROCK;
  for (const [r, c] of [[16,16],[28,17],[52,18],[5,18]] as [number,number][]) m[r][c] = T.PINE;
  return m;
}

export class Route3Scene extends Phaser.Scene {
  public grassTileIds3D = [T.TALLGRASS];
  // Diamond Gorge: the granite canyon walls (cliffs) and boulders rise as real 3D
  // mountain ranges instead of flat 2D art baked into the ground; pines grow 3D too.
  public mountainTileIds3D = [T.CLIFF, T.ROCK];
  public treeTileIds3D = [T.PINE];
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 12 * TILE + 16;
  private py = 57 * TILE + 16;   // enter from south (Baekdu side)
  private facing = 0; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private steps = 0; private nextEnc = 5;
  private ryeoCutsceneRival?: { g: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text };
  private readonly SPEED = 120; private readonly RUN = 250;

  private readonly TRAINERS = [
    {
      key: 'r3-seulgi', name: 'Photographer Seulgi', col: 17, row: 38, color: 0x44aacc, label: 'Photo-\ngrapher',
      line: "Hold still! ...Actually, my Pokémon are better subjects. And better fighters. Smile!",
      pokemon: JSON.stringify([{ id: 0, level: 22, custom: 'doribi' }, { id: 0, level: 23, custom: 'bookkuddoong' }]),
      expPool: 520,
    },
    {
      key: 'r3-hyunwoo', name: 'Ranger Hyunwoo', col: 16, row: 10, color: 0x33aa55, label: 'Ranger',
      line: "I patrol this gorge. Lately the wildlife's been spooked by people in dark coats. Let's spar — keeps me sharp.",
      pokemon: JSON.stringify([{ id: 0, level: 23, custom: 'liondance' }, { id: 0, level: 25, custom: 'kingfisher' }]),
      expPool: 560,
    },
  ] as const;

  constructor() { super('Route3Scene'); }

  private get ryeoDone() { return !!this.registry.get('trainerDefeated_nosdan-ryeo-1'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    playBgm(this, 'route3');
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('route3ReturnX') as number | undefined;
    const ry = this.registry.get('route3ReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('route3ReturnX'); this.registry.remove('route3ReturnY');

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
      waterTiles: [T.RIVER], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'Route3Scene');
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.PINE) { g.fillStyle(0x16441f); g.fillTriangle(c*TILE+16, r*TILE+2, c*TILE+3, r*TILE+26, c*TILE+29, r*TILE+26); g.fillStyle(0x4a3020); g.fillRect(c*TILE+13, r*TILE+26, 6, 5); }
      if (t === T.TALLGRASS) { g.fillStyle(0x2c6a22, 0.7); for (let i=0;i<3;i++){ g.fillRect(c*TILE+5+i*8, r*TILE+16, 2, 12); g.fillRect(c*TILE+7+i*8, r*TILE+12, 2, 16);} }
      if (t === T.ROCK) { g.fillStyle(0x5a5044); g.fillTriangle(c*TILE+16, r*TILE+5, c*TILE+3, r*TILE+28, c*TILE+29, r*TILE+28); }
      if (t === T.CLIFF) { g.fillStyle(0x6f665a); g.fillRect(c*TILE+3, r*TILE+5, 7, 7); g.fillRect(c*TILE+18, r*TILE+17, 8, 8); }
      if (t === T.RIVER) { g.fillStyle(0x66bbe6, 0.5); g.fillRect(c*TILE+4, r*TILE+8, 12, 3); g.fillRect(c*TILE+12, r*TILE+20, 10, 3); }
    }
    const key = '__route3Map__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(12 * TILE, 58.4 * TILE, tr('↓ Seolbong City'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(12 * TILE, 0.7 * TILE, tr('↑ Geumgang City'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 },
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
    // Rope barrier across the choke
    const rope = this.add.graphics().setDepth(6);
    rope.lineStyle(3, 0x222244, 1);
    rope.lineBetween(9 * TILE, 24 * TILE + 16, 15 * TILE, 24 * TILE + 16);
    // Commander Ryeo (dark coat, silver trim)
    const g = this.add.graphics().setDepth(8);
    g.setPosition(12 * TILE + 16, 25 * TILE + 16);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(0x14141e); g.fillRect(-7, -8, 14, 12);
    g.fillStyle(0xaab0c0); g.fillRect(-7, -8, 14, 2);   // silver collar
    g.fillStyle(0x222222); g.fillRect(-6, 4, 5, 8); g.fillRect(1, 4, 5, 8);
    g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
    g.fillStyle(0x0a0a10); g.fillRect(-6, -21, 12, 5);
    g.fillStyle(0x88ccff); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2);
    markTrainerPortrait(g, 'nosdan-ryeo-1');
    this.add.text(12 * TILE + 16, 25 * TILE - 12, speakerName('노스단 Commander Ryeo'), {
      fontSize: '8px', color: '#aab8ff', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
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
    this.add.rectangle(this.scale.width / 2, 22, 400, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🏞️ Route 3 — Diamond Gorge (금강 협곡)'), {
      fontSize: '14px', color: '#fff', fontStyle: 'bold',
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
    if (Math.random() > 0.35) return;
    this.steps = 0; this.nextEnc = 5 + Math.floor(Math.random() * 5);
    const e = pickEncounter(R3_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'Route3Scene');
    this.registry.set('route3ReturnX', this.px); this.registry.set('route3ReturnY', this.py);
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
        this.registry.set('trainerReturnScene', 'Route3Scene');
        this.registry.set('route3ReturnX', this.px); this.registry.set('route3ReturnY', this.py);
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
    this.spawnRyeoCutsceneRival();
    const launch = () => {
      this.registry.set('trainerName', 'Commander Ryeo');
      this.registry.set('trainerKey', 'nosdan-ryeo-1');
      this.registry.set('trainerPokemon', JSON.stringify([
        { id: 0, level: 21, custom: 'corrpanda' },     // Dark
        { id: 0, level: 22, custom: 'palmcockatoo' },  // Dark/Flying
        { id: 229, level: 23 },                         // Houndoom (Fire/Dark ace)
      ]));
      this.registry.set('trainerExpPool', 760);
      this.registry.set('trainerReturnScene', 'Route3Scene');
      this.registry.set('route3ReturnX', 12 * TILE + 16);
      this.registry.set('route3ReturnY', 29 * TILE + 16);
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    };
    if (!this.registry.get('ryeo1Seen')) {
      this.registry.set('ryeo1Seen', true);
      this.dialog.show([
        "A woman in a dark, silver-trimmed coat blocks the gorge. This is no Team Suri grunt.",
        "Commander Ryeo: You're not Team Suri. You're not authority. You're a trainer who keeps appearing everywhere.",
        "Commander Ryeo: We have no quarrel with you. Step aside.",
        "Rival: And if we don't?",
        "Commander Ryeo: ...Then we'll have a quarrel.",
      ], launch);
    } else {
      this.dialog.show(["Commander Ryeo: Still in my way? So be it."], launch);
    }
  }

  /** The rival's spoken line belongs to the pre-battle gorge confrontation,
   *  so their selected 3D avatar stands beside the player here—not in battle. */
  private spawnRyeoCutsceneRival() {
    if (this.ryeoCutsceneRival?.g.active) return;
    const side = this.px <= 12 * TILE + 16 ? TILE * 0.9 : -TILE * 0.9;
    const rx = Phaser.Math.Clamp(this.px + side, 9.5 * TILE, 14.5 * TILE);
    const ry = Phaser.Math.Clamp(this.py + TILE * 0.45, 27 * TILE, 30 * TILE);
    const g = this.add.graphics().setDepth(19);
    drawTrainerBody(g, 1, 0, rivalDesign(this.registry)); // face Ryeo to the north
    g.setPosition(rx, ry);
    markRivalPortrait(g, this.registry);
    // Keep the real 3D avatar facing Commander Ryeo rather than the mirror's
    // default south-facing idle direction.
    g.setData('characterLookAt3D', { x: 12 * TILE + 16, y: 25 * TILE + 16 });
    const label = this.add.text(rx, ry - 28, rivalTrainerName(this.registry), {
      fontSize: '8px', color: '#cfe8ff', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(20);
    this.ryeoCutsceneRival = { g, label };
  }

  private checkExits() {
    if (isSurfing(this.playerG)) return;
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // South → Seolbong City
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('baekduCityReturnX', 28 * 32); this.registry.set('baekduCityReturnY', 13 * 32);
        this.scene.start('BaekduCityScene');
      });
    }
    // North → Geumgang City (after Ryeo withdraws)
    if (this.py < 1 * TILE && this.ryeoDone) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('geumgangCityReturnX', 15 * 32 + 16);
        this.registry.set('geumgangCityReturnY', 24 * 32);
        this.scene.start('GeumgangCityScene');
      });
    }
  }
}
