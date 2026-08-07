import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { vanishesAfterDefeat } from '../data/Villains';
import { drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { playBgm } from '../systems/Music';

// ── Below-deck ship interiors ────────────────────────────────────────────────
// A small shared framework for the walkable rooms below the ferry deck. Every
// area (corridor + 3 cabins) is its OWN Phaser scene, door-linked by fades, so
// each is genuinely separated. The 3D mirror renders them as riveted interiors.
//
// Concrete scenes subclass ShipInteriorScene and return a ShipConfig from cfg().

export const S = {
  VOID: 0, FLOOR: 1, WALL: 2, STAIRS: 3,
  DOOR1: 4, DOOR2: 5, DOOR3: 6, DOORBACK: 7,
  BUNK: 8, TABLE: 9, CRATE: 10, CARPET: 11, PORTHOLE: 12, ENGINE: 13,
} as const;
type Tile = typeof S[keyof typeof S];

const TILE = 32;
const SOLID = new Set<number>([S.VOID, S.WALL, S.BUNK, S.TABLE, S.CRATE, S.PORTHOLE, S.ENGINE]);
const TRIGGER = new Set<number>([S.STAIRS, S.DOOR1, S.DOOR2, S.DOOR3, S.DOORBACK]);

const COLORS: Record<number, number> = {
  [S.VOID]: 0x0a0d12, [S.FLOOR]: 0x6b7078, [S.WALL]: 0x3a4048, [S.STAIRS]: 0xcaa25a,
  [S.DOOR1]: 0x8a5a2a, [S.DOOR2]: 0x8a5a2a, [S.DOOR3]: 0x8a5a2a, [S.DOORBACK]: 0x8a5a2a,
  [S.BUNK]: 0x365a8a, [S.TABLE]: 0x6b4a2a, [S.CRATE]: 0x7a5630, [S.CARPET]: 0x8a3336,
  [S.PORTHOLE]: 0x3a4048, [S.ENGINE]: 0x24282e,
};

export interface ShipDoor {
  col: number; row: number; tile: Tile;
  target: string; spawnCol: number; spawnRow: number; label: string;
}
export interface ShipTrainer {
  key: string; name: string; col: number; row: number; color: number; label: string;
  line: string; pokemon: string; expPool: number;
}
export interface ShipNpc { name: string; col: number; row: number; color: number; lines: string[]; }
export interface ShipConfig {
  title: string; bgm: string; cols: number; rows: number; floor: Tile;
  build(fill: (r1: number, r2: number, c1: number, c2: number, t: Tile) => void, m: Tile[][]): void;
  spawn: { col: number; row: number };
  doors: ShipDoor[];
  trainers: ShipTrainer[];
  npcs?: ShipNpc[];
}

export abstract class ShipInteriorScene extends Phaser.Scene {
  /** Authored 3D interior: interior lighting, no outdoor props sprouting. */
  public interior3D = true;
  public grassTileIds3D: number[] = [];
  public onlyNamedBuildings = true;

  protected abstract cfg(): ShipConfig;

  private c!: ShipConfig;
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 0; private py = 0;
  private facing = 0; private walkFrame = 0; private walkTimer = 0;
  private busy = false;
  private spawnGuard = false; private spawnPx = 0; private spawnPy = 0;
  private readonly SPEED = 120; private readonly RUN = 240;

  create() {
    this.c = this.cfg();
    this.busy = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();

    // Arrival position: a door landing passed via registry, else the default spawn.
    const sc = this.registry.get('shipSpawnCol') as number | undefined;
    const sr = this.registry.get('shipSpawnRow') as number | undefined;
    const col = sc ?? this.c.spawn.col, row = sr ?? this.c.spawn.row;
    this.registry.remove('shipSpawnCol'); this.registry.remove('shipSpawnRow');
    this.px = col * TILE + 16; this.py = row * TILE + 16;
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(450, () => { this.spawnGuard = false; });

    this.buildMap();
    this.drawMap();
    this.drawTrainers();
    this.drawNpcs();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(350);
    playBgm(this, this.c.bgm);
    SaveManager.save(this.registry, this.px, this.py, this.scene.key);
  }

  // ── Map ───────────────────────────────────────────────────────────────────
  private buildMap() {
    const { cols, rows, floor } = this.c;
    this.map = Array.from({ length: rows }, () => Array(cols).fill(S.VOID) as Tile[]);
    const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
      for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
        if (r >= 0 && r < rows && c >= 0 && c < cols) this.map[r][c] = t;
    };
    // Hull box: floor interior, walls all round.
    fill(0, rows, 0, cols, S.WALL);
    fill(1, rows - 1, 1, cols - 1, floor);
    this.c.build(fill, this.map);
    // Stamp door / stairs trigger tiles last so build() can't overwrite them.
    for (const d of this.c.doors) this.map[d.row][d.col] = d.tile;
  }

  private drawMap() {
    const { cols, rows } = this.c;
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const t = this.map[r][c];
      const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t] ?? 0x333333, 1); g.fillRect(x, y, TILE, TILE);
      if (t === S.FLOOR || t === S.CARPET) {
        // Metal deck plating / carpet weave: rivets and seams.
        g.lineStyle(1, t === S.CARPET ? 0x6f2629 : 0x585c63, 0.7);
        g.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
        g.fillStyle(t === S.CARPET ? 0x9c4245 : 0x82868d, 0.9);
        for (const [dx, dy] of [[6, 6], [26, 6], [6, 26], [26, 26]] as const) g.fillRect(x + dx, y + dy, 2, 2);
      } else if (t === S.WALL) {
        g.lineStyle(1, 0x22262c, 1); g.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
        g.fillStyle(0x4a515a, 0.8); g.fillRect(x + 4, y + 4, TILE - 8, 3);
      } else if (t === S.PORTHOLE) {
        g.lineStyle(1, 0x22262c, 1); g.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
        g.fillStyle(0xb98a3a); g.fillCircle(x + 16, y + 16, 10);
        g.fillStyle(0x2a5c86); g.fillCircle(x + 16, y + 16, 7);
        g.fillStyle(0xbfe0f0, 0.6); g.fillCircle(x + 13, y + 13, 2);
      } else if (t === S.STAIRS) {
        for (let i = 0; i < 4; i++) { g.fillStyle(i % 2 ? 0xb98a44 : 0xd8ad5e); g.fillRect(x, y + i * 8, TILE, 8); }
        g.fillStyle(0x000000, 0.25); g.fillRect(x, y, TILE, 4);
      } else if (t === S.DOOR1 || t === S.DOOR2 || t === S.DOOR3 || t === S.DOORBACK) {
        g.fillStyle(0x5a3a1c); g.fillRect(x + 4, y + 2, TILE - 8, TILE - 4);
        g.fillStyle(0x8a5a2a); g.fillRect(x + 6, y + 4, TILE - 12, TILE - 8);
        g.fillStyle(0xe8c15a); g.fillCircle(x + TILE - 10, y + 16, 2);
      } else if (t === S.BUNK) {
        g.fillStyle(0x2a4a72); g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        g.fillStyle(0xcdd6e2); g.fillRect(x + 4, y + 4, TILE - 8, 10);   // pillow/sheet
        g.fillStyle(0x466fa6); g.fillRect(x + 4, y + 15, TILE - 8, TILE - 19);
      } else if (t === S.TABLE) {
        g.fillStyle(0x4a3218); g.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        g.fillStyle(0x7a5430); g.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
      } else if (t === S.CRATE) {
        g.fillStyle(0x5a3f22); g.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        g.lineStyle(2, 0x3a2a14); g.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
        g.lineBetween(x + 3, y + 3, x + TILE - 3, y + TILE - 3);
      } else if (t === S.ENGINE) {
        g.fillStyle(0x14171b); g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        g.fillStyle(0xd86a2a); g.fillCircle(x + 16, y + 16, 6);          // hot glow
        g.fillStyle(0x6a7078); g.fillRect(x + 6, y + 4, 4, TILE - 8);
        g.fillStyle(0x6a7078); g.fillRect(x + TILE - 10, y + 4, 4, TILE - 8);
      }
    }
    const key = `__ship_${this.scene.key}__`;
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, cols * TILE, rows * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    // Door / stairs signposts.
    for (const d of this.c.doors) {
      this.add.text(d.col * TILE + 16, d.row * TILE - 12, tr(d.label), {
        fontSize: '9px', color: '#fff', backgroundColor: '#1a2a3a99', padding: { x: 3, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(5);
    }
  }

  private drawTrainers() {
    for (const t of this.c.trainers) {
      if (this.registry.get(`trainerDefeated_${t.key}`) && vanishesAfterDefeat(t.key)) continue;
      const g = this.add.graphics().setDepth(8);
      g.setPosition(t.col * TILE + 16, t.row * TILE + 16);
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(t.color); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x1a1a2e); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -22, 12, 12);
      g.fillStyle(0x220000); g.fillRect(-6, -22, 12, 5);
      g.fillStyle(0x000000); g.fillRect(-3, -16, 2, 2); g.fillRect(1, -16, 2, 2);
      this.add.text(t.col * TILE + 16, t.row * TILE - 12, speakerName(t.label), {
        fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(9);
    }
  }

  private drawNpcs() {
    for (const n of this.c.npcs ?? []) {
      const g = this.add.graphics().setDepth(8);
      g.setPosition(n.col * TILE + 16, n.row * TILE + 16);
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(n.color); g.fillRect(-7, -8, 14, 12);
      g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
      g.fillStyle(0x222222); g.fillRect(-6, -21, 12, 5);
      g.fillStyle(0x000000); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2);
      this.add.text(n.col * TILE + 16, n.row * TILE - 12, speakerName(n.name), {
        fontSize: '8px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(9);
    }
  }

  // ── Player / camera / input ─────────────────────────────────────────────────
  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }
  private setupCamera() {
    this.cameras.main.setBounds(0, 0, this.c.cols * TILE, this.c.rows * TILE);
    this.cameras.main.setZoom(1.7);
    this.cameras.main.startFollow(this.playerG, true, 0.12, 0.12);
  }
  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.busy) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 380, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr(this.c.title), {
      fontSize: '14px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SPACE: talk  M: menu'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  update(_: number, delta: number) {
    if (this.busy) {
      if (this.dialog.isInChoice()) {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.dialog.navigateChoice(-1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.dialog.navigateChoice(1);
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.confirmChoice();
      } else if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
      return;
    }
    const dt = delta / 1000; let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) { dx = -1; this.facing = 2; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { dx = 1; this.facing = 3; }
    if (this.cursors.up.isDown || this.wasd.up.isDown) { dy = -1; this.facing = 1; }
    if (this.cursors.down.isDown || this.wasd.down.isDown) { dy = 1; this.facing = 0; }
    const moving = dx !== 0 || dy !== 0;
    const running = moving && !!this.registry.get('hasRunningShoes') && this.shiftKey.isDown;
    const speed = running ? this.RUN : this.SPEED;
    if (moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = this.px + (dx / len) * speed * dt, ny = this.py + (dy / len) * speed * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkTrainers();
    this.checkNpcs();
    this.checkDoors();
  }

  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x - hw, y - 4], [x + hw, y - 4], [x - hw, y + 8], [x + hw, y + 8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= this.c.cols || row < 0 || row >= this.c.rows) return true;
      return SOLID.has(this.map[row][col]);
    });
  }

  private checkTrainers() {
    for (const t of this.c.trainers) {
      if (this.registry.get(`trainerDefeated_${t.key}`)) continue;
      const wx = t.col * TILE + 16, wy = t.row * TILE + 16;
      if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.35) {
        this.busy = true;
        this.registry.set('trainerName', t.name);
        this.registry.set('trainerKey', t.key);
        this.registry.set('trainerPokemon', t.pokemon);
        this.registry.set('trainerExpPool', t.expPool);
        this.registry.set('trainerReturnScene', this.scene.key);
        this.registry.set('shipSpawnCol', Math.round(this.px / TILE));
        this.registry.set('shipSpawnRow', Math.round(this.py / TILE));
        this.dialog.show([t.line, `${t.name}: ${tr("Let's battle!")}`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkNpcs() {
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    for (const n of this.c.npcs ?? []) {
      const wx = n.col * TILE + 16, wy = n.row * TILE + 16;
      if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.4) {
        this.busy = true;
        this.dialog.show(n.lines.map(l => tr(l)), () => { this.busy = false; });
        return;
      }
    }
  }

  private checkDoors() {
    if (this.spawnGuard) { if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) > 0.9 * TILE) this.spawnGuard = false; return; }
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const here = this.map[row]?.[col];
    if (!here || !TRIGGER.has(here)) return;
    const door = this.c.doors.find(d => d.col === col && d.row === row);
    if (!door) return;
    this.busy = true;
    this.cameras.main.fadeOut(350, 0, 0, 0, () => {
      if (door.target === 'FerryScene') {
        // Climb back up onto the open deck (beside the hatch in the stern cabin).
        this.registry.set('ferryReturnX', door.spawnCol * TILE + 16);
        this.registry.set('ferryReturnY', door.spawnRow * TILE + 16);
      } else {
        this.registry.set('shipSpawnCol', door.spawnCol);
        this.registry.set('shipSpawnRow', door.spawnRow);
      }
      this.scene.start(door.target);
    });
  }
}

// ── Corridor ──────────────────────────────────────────────────────────────────
export class FerryCorridorScene extends ShipInteriorScene {
  constructor() { super('FerryCorridorScene'); }
  protected cfg(): ShipConfig {
    return {
      title: '⚓ Below Deck — Passageway', bgm: 'ferrynight', cols: 19, rows: 9, floor: S.FLOOR,
      build: (fill, m) => {
        // Portholes along the south hull wall.
        for (const c of [3, 9, 15]) m[8][c] = S.PORTHOLE;
        // A carpet runner down the middle of the passage.
        fill(4, 5, 1, 18, S.CARPET);
        // A couple of lashed crates by the stairs.
        m[6][17] = S.WALL;   // small alcove side
      },
      spawn: { col: 15, row: 6 },
      doors: [
        { col: 4, row: 1, tile: S.DOOR1, target: 'FerryRoomAScene', spawnCol: 6, spawnRow: 7, label: '↑ Passenger Lounge' },
        { col: 9, row: 1, tile: S.DOOR2, target: 'FerryRoomBScene', spawnCol: 6, spawnRow: 7, label: '↑ Crew Quarters' },
        { col: 14, row: 1, tile: S.DOOR3, target: 'FerryRoomCScene', spawnCol: 6, spawnRow: 7, label: '↑ Cargo Hold' },
        { col: 17, row: 4, tile: S.STAIRS, target: 'FerryScene', spawnCol: 10, spawnRow: 30, label: '→ Up to Deck' },
      ],
      trainers: [
        {
          key: 'ferry-cor-sailor', name: 'Sailor Yeongho', col: 8, row: 5, color: 0x2a6abb, label: 'Sailor',
          line: tr("Night watch's boring till a challenger walks by. You'll do!"),
          pokemon: JSON.stringify([{ id: 0, level: 44, custom: 'frysm' }, { id: 0, level: 45, custom: 'roundtailor' }]),
          expPool: 1040,
        },
      ],
      npcs: [
        { name: 'Steward', col: 12, row: 3, color: 0x8a6a3a, lines: [
          'Steward: Cabins are down this passage — lounge forward, crew berth amidships, cargo hold aft.',
          'Steward: Stairs at the end take you back up to the open deck. Mind the swell.',
        ] },
      ],
    };
  }
}

// ── Rooms ───────────────────────────────────────────────────────────────────
function backDoor(spawnCol: number): ShipDoor {
  // Every cabin exits through its south wall back into the passageway, landing
  // just below the corridor door it came from.
  return { col: 6, row: 8, tile: S.DOORBACK, target: 'FerryCorridorScene', spawnCol, spawnRow: 2, label: '↓ Passageway' };
}

export class FerryRoomAScene extends ShipInteriorScene {
  constructor() { super('FerryRoomAScene'); }
  protected cfg(): ShipConfig {
    return {
      title: '🛋️ Passenger Lounge', bgm: 'ferrynight', cols: 13, rows: 10, floor: S.CARPET,
      build: (fill, m) => {
        fill(1, 2, 1, 12, S.WALL);                 // upholstered forward bulkhead
        for (const c of [2, 10]) m[1][c] = S.PORTHOLE;
        m[3][3] = S.TABLE; m[3][9] = S.TABLE;       // café tables
        m[6][2] = S.BUNK; m[6][10] = S.BUNK;        // window sofas
      },
      spawn: { col: 6, row: 7 },
      doors: [backDoor(4)],
      trainers: [
        {
          key: 'ferry-lounge-beauty', name: 'Beauty Sora', col: 6, row: 3, color: 0xd85a9a, label: 'Beauty',
          line: tr('The sea air is divine — and so is a good battle. Care to entertain me?'),
          pokemon: JSON.stringify([{ id: 0, level: 45, custom: 'kingfisher' }, { id: 278, level: 45 }]),
          expPool: 1080,
        },
      ],
      npcs: [
        { name: 'Traveler', col: 3, row: 6, color: 0x5a7a9a, lines: [
          'Traveler: First crossing to Jeju? The vents glow at night — you can see them from the rail.',
        ] },
      ],
    };
  }
}

export class FerryRoomBScene extends ShipInteriorScene {
  constructor() { super('FerryRoomBScene'); }
  protected cfg(): ShipConfig {
    return {
      title: '🛏️ Crew Quarters', bgm: 'ferrynight', cols: 13, rows: 10, floor: S.FLOOR,
      build: (fill, m) => {
        // Bunks stacked along both berths.
        for (const r of [2, 4]) { m[r][2] = S.BUNK; m[r][3] = S.BUNK; m[r][9] = S.BUNK; m[r][10] = S.BUNK; }
        m[6][6] = S.TABLE;
        for (const c of [1, 11]) m[3][c] = S.PORTHOLE;
      },
      spawn: { col: 6, row: 7 },
      doors: [backDoor(9)],
      trainers: [
        {
          key: 'ferry-crew-boatswain', name: 'Boatswain Dukman', col: 6, row: 4, color: 0x3a6a3a, label: 'Boatswain',
          line: tr('Off-watch, but never off my guard. Show me the mainland trains its trainers right.'),
          pokemon: JSON.stringify([{ id: 0, level: 46, custom: 'roundtailor' }, { id: 0, level: 46, custom: 'squirrel2' }, { id: 279, level: 45 }]),
          expPool: 1160,
        },
      ],
    };
  }
}

export class FerryRoomCScene extends ShipInteriorScene {
  constructor() { super('FerryRoomCScene'); }
  protected cfg(): ShipConfig {
    return {
      title: '📦 Cargo Hold', bgm: 'ferrystorm', cols: 13, rows: 10, floor: S.FLOOR,
      build: (fill, m) => {
        // Stacked cargo crates and a thrumming engine block aft.
        for (const [r, c] of [[2, 2], [2, 3], [3, 2], [2, 9], [2, 10], [3, 10], [5, 3], [5, 9]] as [number, number][]) m[r][c] = S.CRATE;
        m[6][6] = S.ENGINE; m[6][7] = S.ENGINE; m[5][6] = S.ENGINE;
      },
      spawn: { col: 6, row: 8 },
      doors: [backDoor(14)],
      trainers: [
        {
          key: 'ferry-cargo-engineer', name: 'Engineer Cheolsu', col: 4, row: 5, color: 0xb5652a, label: 'Engineer',
          line: tr('Keep it down by the engine — she rattles enough. You want a bout? Quick, then.'),
          pokemon: JSON.stringify([{ id: 0, level: 47, custom: 'frysm' }, { id: 0, level: 47, custom: 'kingfisher' }]),
          expPool: 1200,
        },
      ],
      npcs: [
        { name: 'Deckhand', col: 9, row: 6, color: 0xddaa33, lines: [
          'Deckhand: Storm cracked a crate loose last run. Watch your step around the lashings.',
        ] },
      ],
    };
  }
}
