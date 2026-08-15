import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, playerDesign, rivalDesign, rivalTrainerName } from '../data/CharacterSprite';
import { markRivalPortrait } from '../data/BattlePortraits';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = {
  SNOW: 0, PATH: 1, SNOWGRASS: 2, PINE: 3, ICE: 4, ROCK: 5, CLIFF: 6, CAVE: 7,
} as const;
type Tile = typeof T[keyof typeof T];

const TILE = 32;
const COLS = 24;
const ROWS = 60;

const COLORS: Record<Tile, number> = {
  [T.SNOW]:      0xe8eef5,
  [T.PATH]:      0xb9b2a4,
  [T.SNOWGRASS]: 0x8fb59a,
  [T.PINE]:      0x21503a,
  [T.ICE]:       0x9fd4e8,
  [T.ROCK]:      0x6f6558,
  [T.CLIFF]:     0x4a4239,
  [T.CAVE]:      0x2a2620,
};
const SOLID = new Set<Tile>([T.PINE, T.ROCK, T.CLIFF, T.CAVE]);
const ENCOUNTER = new Set<Tile>([T.SNOWGRASS]);

// The narrow choke the grunts block (rows 26-27, cols 9-14 of the central path)
const BARRIER_ROWS = [26, 27];
const BARRIER_COLS = [9, 10, 11, 12, 13, 14];

// Wild encounters — Ice & Rock highland Pokémon (crane / mountain-goat / bear motifs)
const PASS_ENCOUNTERS: EncounterEntry[] = [
  { id: 'bosongnun',   weight: 16, minLevel: 17, maxLevel: 18, isCustom: true,  catchRate: 190 }, // Ice/Fairy
  { id: 'gawlhawk',    weight: 12, minLevel: 17, maxLevel: 18, isCustom: true,  catchRate: 200 }, // Rock/Flying (crane)
  { id: 'crystbeetle', weight: 10, minLevel: 18, maxLevel: 18, isCustom: true,  catchRate: 180 }, // Bug/Rock
  { id: 220, weight: 16, minLevel: 17, maxLevel: 18, isCustom: false, catchRate: 225 }, // Swinub
  { id: 613, weight: 12, minLevel: 17, maxLevel: 18, isCustom: false, catchRate: 120 }, // Cubchoo (bear)
  { id: 459, weight: 10, minLevel: 17, maxLevel: 18, isCustom: false, catchRate: 120 }, // Snover
  { id: 74,  weight: 14, minLevel: 17, maxLevel: 18, isCustom: false, catchRate: 255 }, // Geodude
  { id: 361, weight: 8,  minLevel: 17, maxLevel: 18, isCustom: false, catchRate: 190 }, // Snorunt
  { id: 'arctorodon', weight: 3, minLevel: 20, maxLevel: 19, isCustom: true, catchRate: 45 }, // Rock/Ice leviathan (rare)
  { id: 'babymammoth', weight: 12, minLevel: 17, maxLevel: 19, isCustom: true, catchRate: 200 }, // Ice calf
  { id: 'glacewing',   weight: 12, minLevel: 17, maxLevel: 19, isCustom: true, catchRate: 200 }, // Ice/Bug (snowfields)
];

// Team Suri — the four Pokémon the two grunts field together (sequential).
const SURI_KEY = 'suri-grunts';
const SURI_TEAM = JSON.stringify([
  { id: 215, level: 19 }, // Sneasel
  { id: 461, level: 20 }, // Weavile
  { id: 228, level: 20 }, // Houndour
  { id: 229, level: 21 }, // Houndoom
]);

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.SNOW) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };

  // Central winding stone path (cols 9-15)
  fill(0, ROWS, 9, 15, T.PATH);

  // Rocky cliffs framing both sides
  fill(0, ROWS, 0, 4, T.CLIFF);
  fill(0, ROWS, 20, COLS, T.CLIFF);
  // Scattered boulders. Keep the northern approach open around the city gate.
  for (const [r, c] of [[34,6],[40,17],[48,5],[52,18],[20,18]] as [number,number][]) m[r][c] = T.ROCK;

  // Snowy pines
  for (const [r, c] of [[6,6],[6,17],[12,7],[18,16],[44,7],[50,16],[55,6],[55,17],[10,16]] as [number,number][]) m[r][c] = T.PINE;

  // Frozen tarn (small ice lake) mid-pass on the west shoulder
  fill(36, 40, 4, 8, T.ICE);

  // Snow-covered encounter meadows. Paired clearings on both shoulders make
  // the vegetation visible throughout the climb while keeping the central
  // road, blockade and cave exits unobstructed.
  fill(47, 55, 5, 9, T.SNOWGRASS);
  fill(46, 54, 15, 19, T.SNOWGRASS);
  fill(30, 36, 5, 9, T.SNOWGRASS);
  fill(31, 37, 15, 19, T.SNOWGRASS);
  fill(9, 16, 5, 9, T.SNOWGRASS);
  fill(10, 17, 15, 19, T.SNOWGRASS);

  // The city gate at the top. Leave two snow tiles between the road and each
  // mountain range so low-poly peaks cannot project into the travel lane.
  fill(0, 6, 4, 7, T.CLIFF);
  fill(0, 6, 17, 20, T.CLIFF);
  // Keep the entire six-tile road clear through the north edge. Previously a
  // CAVE strip was painted across it and only its middle four tiles were
  // restored; the two dark shoulder tiles were therefore raised by WallBuilder
  // as the pair of black blocks visible at the Seolbong City transition.
  fill(0, ROWS, 9, 15, T.PATH);

  return m;
}

export class BaekduPassScene extends Phaser.Scene {
  public grassTileIds3D = [T.SNOWGRASS];
  // Only continuous cliffs become mountain ranges. Isolated ROCK tiles are
  // ordinary boulders; turning a one-tile rock into a full peak can crowd roads.
  public mountainTileIds3D = [T.CLIFF];
  /** The authored travel lane is authoritative and must never become a 3D wall. */
  public flatTileIds3D = [T.PATH, T.CAVE];
  public treeTileIds3D = [T.PINE];
  private map!: Tile[][];
  /** A mountain pass, not a town: suppress any building the terrain heuristics
   *  hallucinate from cliff/rock shading (no named plots → nothing rises). */
  public onlyNamedBuildings = true;
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private grunts: Phaser.GameObjects.Graphics[] = [];

  private px = 12 * TILE + 16;
  private py = 57 * TILE + 16;   // enter from south
  private facing = 0; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;

  constructor() { super('BaekduPassScene'); }

  private get suriDefeated() { return !!this.registry.get(`trainerDefeated_${SURI_KEY}`); }

  create() {

    playBgm(this, 'baekdupass');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    this.grunts = [];
    this.input.keyboard?.resetKeys();

    const rx = this.registry.get('baekduPassReturnX') as number | undefined;
    const ry = this.registry.get('baekduPassReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('baekduPassReturnX'); this.registry.remove('baekduPassReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawSuriBlockade();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'BaekduPassScene');

    if (!this.registry.get('baekduPassVisited')) {
      this.registry.set('baekduPassVisited', true);
      this.time.delayedCall(650, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'You climb into the Seolbong Highland Pass (설봉 고갯길).',
          'Snow-capped peaks loom above the treeline. The wind carries the cry of cranes.',
          'The air is thin and cold — wild Pokémon here are hardened by ice and stone.',
        ], () => { this.cutsceneActive = false; });
      });
    } else {
      this.time.delayedCall(300, () => maybeLaunchEvolution(this));
    }
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.PINE)      this.drawSnowPine(g, c * TILE + 16, r * TILE + 16);
      if (t === T.SNOWGRASS) this.drawSnowGrass(g, c * TILE, r * TILE);
      if (t === T.ROCK)      this.drawRock(g, c * TILE, r * TILE);
      if (t === T.CLIFF)     { g.fillStyle(0x5a5246); g.fillRect(c*TILE+3, r*TILE+5, 7, 7); g.fillRect(c*TILE+18, r*TILE+16, 8, 9); }
      if (t === T.ICE)       { g.fillStyle(0xffffff, 0.5); g.fillRect(c*TILE+5, r*TILE+6, 14, 2); g.fillRect(c*TILE+9, r*TILE+16, 12, 2); }
    }
    const key = '__baekduPassMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(12 * TILE, 58.4 * TILE, tr('↓ Pine Needle Town'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(12 * TILE, 0.7 * TILE, tr('↑ Seolbong City'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }
  private drawSnowPine(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x163d28); g.fillTriangle(x, y - 14, x - 9, y + 2, x + 9, y + 2);
    g.fillTriangle(x, y - 6, x - 11, y + 8, x + 11, y + 8);
    g.fillStyle(0xffffff, 0.9); g.fillTriangle(x, y - 14, x - 4, y - 6, x + 4, y - 6); // snow cap
    g.fillStyle(0x4a3020); g.fillRect(x - 2, y + 8, 4, 5);
  }
  private drawSnowGrass(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x5a8a6a, 0.7);
    for (let i = 0; i < 3; i++) { g.fillRect(x + 5 + i * 8, y + 18, 2, 9); g.fillRect(x + 7 + i * 8, y + 15, 2, 12); }
    g.fillStyle(0xffffff, 0.6); g.fillRect(x + 6, y + 24, 18, 3);
  }
  private drawRock(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x6a5f50); g.fillTriangle(x + 16, y + 4, x + 3, y + 28, x + 29, y + 28);
    g.fillStyle(0xffffff, 0.7); g.fillTriangle(x + 16, y + 4, x + 10, y + 14, x + 22, y + 14);
  }

  // ── Team Suri blockade ─────────────────────────────────────────────────
  private drawSuriBlockade() {
    if (this.suriDefeated) return;
    // Red-thread rope across the choke
    const rope = this.add.graphics().setDepth(6);
    rope.lineStyle(3, 0xcc2233, 1);
    rope.lineBetween(9 * TILE, 26 * TILE + 16, 15 * TILE, 26 * TILE + 16);
    // Two grunts standing on the path
    for (const [col, row] of [[10, 27], [13, 27]] as [number, number][]) {
      const g = this.add.graphics().setDepth(8);
      g.setPosition(col * TILE + 16, row * TILE + 16);
      this.drawGruntSprite(g);
      this.grunts.push(g);
    }
    this.add.text(12 * TILE + 16, 27 * TILE - 12, tr('Team Suri'), {
      fontSize: '9px', color: '#ff6677', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(9);
    // Ranger Sooyeon, arguing nearby
    const r = this.add.graphics().setDepth(8);
    r.setPosition(8 * TILE + 16, 27 * TILE + 16);
    r.fillStyle(0x000000, 0.2); r.fillEllipse(0, 13, 16, 5);
    r.fillStyle(0x2e7d32); r.fillRect(-7, -8, 14, 12);              // ranger green coat
    r.fillStyle(0xffcc99); r.fillRect(-6, -20, 12, 11);
    r.fillStyle(0x3a2a18); r.fillRect(-7, -21, 14, 5);             // hat brim
    r.fillStyle(0x000000); r.fillRect(-3, -15, 2, 2); r.fillRect(1, -15, 2, 2);
    this.add.text(8 * TILE + 16, 27 * TILE - 12, tr('Ranger Sooyeon'), {
      fontSize: '8px', color: '#9fe0a0', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(9);
  }
  private drawGruntSprite(g: Phaser.GameObjects.Graphics) {
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(0x161616); g.fillRect(-7, -8, 14, 12);            // black coat
    g.fillStyle(0xcc2233); g.fillRect(-7, -8, 14, 2);             // red thread collar
    g.fillStyle(0x222222); g.fillRect(-6, 4, 5, 8); g.fillRect(1, 4, 5, 8);
    g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
    g.fillStyle(0x101010); g.fillRect(-6, -21, 12, 5);
    g.fillStyle(0xcc2233); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2); // red eyes
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
    this.wasd = {
      up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'),
      left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D'),
    };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => { if (!this.cutsceneActive && hasBike(this.registry)) { this.cycling = !this.cycling; this.drawChar(); } });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 400, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🏔️ Seolbong Highland Pass (설봉 고갯길)'), {
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
    this.checkSuriEvent();
    this.checkExits();
  }

  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      // The grunts' rope barrier blocks the choke until Team Suri is beaten
      if (!this.suriDefeated && BARRIER_ROWS.includes(row) && BARRIER_COLS.includes(col)) return true;
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
    const e = pickEncounter(PASS_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'BaekduPassScene');
    this.registry.set('baekduPassReturnX', this.px); this.registry.set('baekduPassReturnY', this.py);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  /** Fire the Team Suri confrontation when the player nears the choke. */
  private checkSuriEvent() {
    if (this.suriDefeated) return;
    if (this.py > 30 * TILE) return;  // only near the blockade

    const launchBattle = () => {
      this.registry.set('trainerName', 'Team Suri Grunts');
      this.registry.set('trainerKey', SURI_KEY);
      this.registry.set('trainerPokemon', SURI_TEAM);
      this.registry.set('trainerExpPool', 600);
      this.registry.set('trainerReturnScene', 'BaekduPassScene');
      this.registry.set('baekduPassReturnX', 12 * TILE + 16);
      this.registry.set('baekduPassReturnY', 30 * TILE + 16);
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    };

    this.cutsceneActive = true;
    if (!this.registry.get('suriEventSeen')) {
      this.registry.set('suriEventSeen', true);
      // The rival runs in at your side — draw their 2D sprite next to you for the standoff.
      const rival = this.add.graphics().setDepth(20);
      drawTrainerBody(rival, 1, 0, rivalDesign(this.registry));
      rival.setPosition(this.px + 30, this.py);
      markRivalPortrait(rival, this.registry);
      this.add.text(this.px + 30, this.py - 22, rivalTrainerName(this.registry), {
        fontSize: '9px', color: '#88ccff', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(21);
      this.dialog.show([
        "Ranger Sooyeon: You can't restrict this area — it's public land! The wild Pokémon habitat here is protected!",
        "Team Suri Grunt A: Team Suri operates under provisional research authority. Stand aside.",
        "Ranger Sooyeon: Provisional — issued by whom?! You've never shown me a single permit!",
        "You step between the ranger and the grunts.",
        "Rival: Oh, perfect timing. I was getting bored.",
        "Rival: Two of them, two of us. Let's clear this road.",
        "Team Suri Grunt A: ...Hmph. Locals AND tourists now. Fine. Don't say we didn't warn you.",
      ], launchBattle);
    } else {
      this.dialog.show([
        "Team Suri Grunt A: Back again? The road stays closed.",
      ], launchBattle);
    }
  }

  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // South → Pine Needle Town (spawn at its north entrance, clear of the return trigger)
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('pineReturnX', 15 * 32 + 16); this.registry.set('pineReturnY', 4 * 32);
        this.scene.start('PineNeedleTownScene');
      });
    }
    // North → Seolbong City (only passable once the blockade is cleared)
    if (this.py < 1 * TILE && this.suriDefeated) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('baekduCityReturnX', 15 * 32 + 16);
        // Baekdu City was expanded southward; arrive at its actual pass gate.
        this.registry.set('baekduCityReturnY', 34 * 32);
        this.scene.start('BaekduCityScene');
      });
    }
  }
}
