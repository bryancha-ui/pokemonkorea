import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { vanishesAfterDefeat } from '../data/Villains';
import { drawTrainerBody, drawRiderBody, markProceduralCharacter3D, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = {
  STONE: 0, PATH: 1, GRASS: 2, PINE: 3, LANTERN: 4, ROCK: 5, PAVILION: 6, WATER: 7,
} as const;
type Tile = typeof T[keyof typeof T];

const TILE = 32;
const COLS = 24;
const ROWS = 60;
const ROUTE_2_WILD_LEVEL_MIN = 13;
const ROUTE_2_WILD_LEVEL_MAX = 16;

// Stone-lantern positions (tile col,row) lining the path — now placed as real 3D
// props instead of painted 2D tiles. Shared by the map builder and propPlots.
const LANTERNS: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let r = 4; r < ROWS - 2; r += 6) { out.push([8, r], [15, r]); }
  return out;
})();

const COLORS: Record<Tile, number> = {
  [T.STONE]:   0x8a8278,
  [T.PATH]:    0xc9b98f,
  [T.GRASS]:   0x4a8a3a,
  [T.PINE]:    0x1e5c2e,
  [T.LANTERN]: 0x9a7a4a,
  [T.ROCK]:    0x7a6a5a,
  [T.PAVILION]:0x8a5a3a,
  [T.WATER]:   0x3a7acc,
};
const SOLID = new Set<Tile>([T.PINE, T.ROCK, T.LANTERN, T.WATER, T.PAVILION]);
const ENCOUNTER = new Set<Tile>([T.GRASS]);

// Wild encounters — Scholar's Road (pine forest, bug/normal + custom forest Pokémon)
const R2_ENCOUNTERS: EncounterEntry[] = [
  { id: 'ivelon',        weight: 16, minLevel: 13, maxLevel: 16, isCustom: true,  catchRate: 200 },
  { id: 'moranlovebird', weight: 16, minLevel: 13, maxLevel: 16, isCustom: true,  catchRate: 200 },
  { id: 'bookbug',       weight: 14, minLevel: 13, maxLevel: 16, isCustom: true,  catchRate: 220 },
  { id: 'squirrel1',     weight: 14, minLevel: 13, maxLevel: 16, isCustom: true,  catchRate: 220 },
  { id: 'venombee',      weight: 12, minLevel: 13, maxLevel: 16, isCustom: true,  catchRate: 200 }, // Poison/Bug (flower meadows)
  { id: 'saekomaga',     weight: 12, minLevel: 13, maxLevel: 16, isCustom: true,  catchRate: 210 }, // Grass → Saekomassi (orchards)
  { id: 13,  weight: 14, minLevel: 13, maxLevel: 16, isCustom: false, catchRate: 255 }, // Weedle
  { id: 16,  weight: 12, minLevel: 13, maxLevel: 16, isCustom: false, catchRate: 255 }, // Pidgey
  { id: 161, weight: 8,  minLevel: 13, maxLevel: 16, isCustom: false, catchRate: 255 }, // Sentret
  { id: 163, weight: 6,  minLevel: 14, maxLevel: 16, isCustom: false, catchRate: 200 }, // Hoothoot
  { id: 132, weight: 3,  minLevel: 14, maxLevel: 16, isCustom: false, catchRate: 35 },  // Ditto (rare, near the nursery)
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.PINE) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };

  // Central winding path (cols 9-14) with grass shoulders
  fill(0, ROWS, 9, 15, T.PATH);
  fill(0, ROWS, 6, 9, T.GRASS);
  fill(0, ROWS, 15, 18, T.GRASS);

  // Stone lanterns are grown as 3D props (see propPlots); their tiles stay walkable
  // grass shoulders so no flat 2D lantern art is baked into the ground.

  // Rocky cliffs on the far sides
  fill(0, ROWS, 0, 4, T.ROCK);
  fill(0, ROWS, 20, COLS, T.ROCK);

  // A small stream crossing (row 30) with stepping path
  fill(30, 32, 4, 20, T.WATER);
  fill(30, 32, 11, 13, T.PATH);  // bridge

  // Roadside rest spot (rows 20-22, cols 16-18): an OPEN stone clearing where the
  // 할아버지 stands. Uses walkable PATH instead of solid PAVILION tiles so nothing
  // boxes him in with a 3D wall, and clears the pines right beside him.
  fill(20, 23, 16, 19, T.PATH);
  fill(19, 23, 18, 20, T.GRASS);   // breathing room to the east (was pine)

  // Wider grassy clearings (encounter zones)
  fill(10, 16, 6, 9, T.GRASS);
  fill(40, 48, 15, 18, T.GRASS);

  // Scatter pine clusters in grass for detail (still walkable grass around)
  return m;
}

export class Route2Scene extends Phaser.Scene {
  public grassTileIds3D = [T.GRASS];
  // The painted pine forest grows as real 3D trees (2D pine art is erased under them);
  // the far-side rocky cliffs rise as 3D mountain ranges; the stone lanterns become
  // 3D props. No flat 2D scenery is left baked into the ground.
  public treeTileIds3D = [T.PINE];
  public mountainTileIds3D = [T.ROCK];
  public propPlots = LANTERNS.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5, kind: 'lantern' as const, scale: 0.9 }));
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private locationText!: Phaser.GameObjects.Text;

  private px = 12 * TILE + 16;
  private py = 57 * TILE + 16;   // enter from south
  private facing = 0; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves away from spawn
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;

  private readonly TRAINERS = [
    {
      key: 'r2-dongsu', name: 'Hiker Dongsu', col: 7, row: 36, color: 0x886644, label: 'Hiker',
      line: "This mountain road has been here for five hundred years. My legs have been here for fifty. That's enough for me!",
      after: "Strong, for someone fresh from the capital!",
      pokemon: JSON.stringify([{ id: 74, level: 16 }, { id: 95, level: 17 }]), expPool: 320,
    },
    {
      key: 'r2-yujin', name: 'School Kid Yujin', col: 16, row: 12, color: 0x3355cc, label: 'School\nKid',
      line: "I'm studying Pokémon for my science project. Would you mind if I observed your battle style? ...Actually I'm just going to battle you.",
      after: "Fascinating data! Thank you for the sample.",
      pokemon: JSON.stringify([{ id: 406, level: 16 }, { id: 315, level: 17 }]), expPool: 310, // Budew, Roselia
    },
  ] as const;

  constructor() { super('Route2Scene'); }

  create() {

    playBgm(this, 'route2');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    this.input.keyboard?.resetKeys();

    // Restore position if returning from a battle
    const rx = this.registry.get('r2ReturnX') as number | undefined;
    const ry = this.registry.get('r2ReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('r2ReturnX'); this.registry.remove('r2ReturnY');

    // Lock edge exits until the player steps inward, so entering from an adjacent
    // map (which spawns near an edge) can't immediately bounce them back.
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawTrainers();
    this.drawPavilionNPC();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'Route2Scene');

    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.PINE)    this.drawPine(g, c * TILE + 16, r * TILE + 16);
      if (t === T.GRASS)   this.drawGrass(g, c * TILE, r * TILE);
      if (t === T.ROCK)    this.drawRock(g, c * TILE, r * TILE);
      if (t === T.WATER)   { g.fillStyle(0x66aadd, 0.5); g.fillRect(c*TILE+4, r*TILE+8, 12, 3); }
    }
    const key = '__route2Map__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    // Pavilion roof + label
    this.add.text(17 * TILE + 16, 20 * TILE - 4, tr('🏯 Roadside Pavilion'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 3, y: 2 },
    }).setOrigin(0.5, 1).setDepth(5);
    this.add.text(12 * TILE, 58 * TILE, tr('↓ Capitol City'), {
      fontSize: '9px', color: '#444', backgroundColor: '#ffffffaa', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(12 * TILE, 1.5 * TILE, tr('↑ Pine Needle Town'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#2a6a2a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }
  private drawPine(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x14401f); g.fillTriangle(x, y - 14, x - 9, y + 2, x + 9, y + 2);
    g.fillTriangle(x, y - 6, x - 11, y + 8, x + 11, y + 8);
    g.fillStyle(0x4a3020); g.fillRect(x - 2, y + 8, 4, 5);
  }
  private drawGrass(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x2e7a22, 0.6);
    for (let i = 0; i < 3; i++) { g.fillRect(x + 5 + i * 8, y + 18, 2, 10); g.fillRect(x + 7 + i * 8, y + 14, 2, 14); }
  }
  private drawRock(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x6a5a4a); g.fillTriangle(x + 16, y + 4, x + 3, y + 28, x + 29, y + 28);
  }

  // ── Trainers + NPC ───────────────────────────────────────────────────────
  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`) && vanishesAfterDefeat(tr.key)) continue;
      const g = this.add.graphics().setDepth(8);
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      this.drawTrainerSprite(g, tr.color);
      this.add.text(tr.col * TILE + 16, tr.row * TILE - 10, speakerName(tr.label), {
        fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 3, y: 2 }, align: 'center',
      }).setOrigin(0.5).setDepth(9);
    }
  }
  private drawTrainerSprite(g: Phaser.GameObjects.Graphics, color: number) {
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(color); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
    g.fillStyle(0x1a1a6e); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
    g.fillStyle(0xffcc99); g.fillRect(-6, -22, 12, 12);
    g.fillStyle(0x220000); g.fillRect(-6, -22, 12, 5);
    g.fillStyle(0x000000); g.fillRect(-3, -16, 2, 2); g.fillRect(1, -16, 2, 2);
  }
  private drawPavilionNPC() {
    const g = this.add.graphics().setDepth(8);
    g.setPosition(17 * TILE + 16, 21 * TILE + 16);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(0x9a8a6a); g.fillRect(-7, -8, 14, 13);      // hanbok robe
    g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
    g.fillStyle(0xdddddd); g.fillRect(-6, -20, 12, 4);      // white hair
    g.fillStyle(0xeeeeee); g.fillRect(-5, -9, 10, 4);       // white beard
    g.fillStyle(0x000000); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2);
    markProceduralCharacter3D(g, {
      outfit: 0x9a8a6a, hair: 0xeeeeee, skin: 0xd9b58f,
      footY: 13, outfitStyle: 'hanbok', hairStyle: 'short',
    });
    this.add.text(17 * TILE + 16, 21 * TILE - 8, speakerName('Harabeoji'), {
      fontSize: '8px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
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
    this.add.rectangle(this.scale.width / 2, 22, 380, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.locationText = this.add.text(this.scale.width / 2, 22, tr('⛰ Route 2 — Scholar\'s Road (선비길)'), {
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
    this.checkPavilion();
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
    const e = pickEncounter(R2_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    // Route 2 is an early-game area. Clamp again at the hand-off boundary so
    // stale registry data or a future malformed table entry can never leak a
    // level-35 encounter into this road.
    this.registry.set('wildLevel', Phaser.Math.Clamp(
      randomLevel(e), ROUTE_2_WILD_LEVEL_MIN, ROUTE_2_WILD_LEVEL_MAX,
    ));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'Route2Scene');
    this.registry.set('r2ReturnX', this.px); this.registry.set('r2ReturnY', this.py);
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
        this.registry.set('trainerReturnScene', 'Route2Scene');
        this.registry.set('r2ReturnX', this.px); this.registry.set('r2ReturnY', this.py);
        this.dialog.show([tr.line, `${tr.name}: Let's battle!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkPavilion() {
    const npcX = 17 * TILE + 16, npcY = 21 * TILE + 16;
    if (Math.hypot(this.px - npcX, this.py - npcY) < TILE * 1.6 && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.cutsceneActive = true;
      this.dialog.show([
        "Harabeoji: You're heading to Solip Town? Fine place. Used to be a famous ink-and-brush village.",
        "Harabeoji: These days though... strangers in strange uniforms have been passing through.",
        "Harabeoji: Black coats. Red thread stitched on the collar. Never seen them before.",
        "Harabeoji: They didn't stop to rest. Just kept moving north.",
      ], () => { this.cutsceneActive = false; });
    }
  }

  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;
    // Don't fire an exit until the player has moved away from where they spawned.
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // South → Capitol City
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('capitalReturnX', 24 * 32); this.registry.set('capitalReturnY', 2 * 32);
        this.scene.start('CapitolCityScene');
      });
    }
    // North → Pine Needle Town
    if (this.py < 1 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('PineNeedleTownScene'));
    }
  }
}
