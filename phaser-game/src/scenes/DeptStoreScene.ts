import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, playerDesign, drawNpcBody } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { Inventory } from '../systems/Items';
import type { PropPlot } from '../engine3d/TerrainBuilder';

// ── Capitol Department Store — 6 floors + elevator ───────────────────────────
// 1F reception · 2F medicine & grocery · 3F TM corner · 4F souvenirs ·
// 5F food court · 6F rooftop garden with a balcony over Capitol City.

const TILE = 32, COLS = 15, ROWS = 11;

interface FloorDef {
  name: string;
  title?: string;
  stock?: string[];
  clerkLabel?: string;
  clerkColor?: number;
  greet?: string;
}

interface DeptFixture {
  kind: PropPlot['kind'];
  col: number; row: number; w?: number; d?: number;
  color?: number; solid?: boolean;
}

const FLOORS: Record<number, FloorDef> = {
  1: { name: '1F · Entrance & Reception' },
  2: { name: '2F · Medicine & Grocery', title: '💊  2F — Medicine & Grocery', clerkLabel: 'Pharmacist', clerkColor: 0x66bbdd,
       greet: 'Pharmacist: Potions, cures, Poké Balls — all your travelling needs.',
       stock: ['potion','superpotion','hyperpotion','maxpotion','revive','maxrevive','antidote','fullheal','ether','elixir','pokeball','greatball','ultraball'] },
  3: { name: '3F · TM Corner', title: '📀  3F — Technical Machines', clerkLabel: 'TM Seller', clerkColor: 0xaa88cc,
       greet: 'TM Seller: Broaden your team\'s horizons — teach them a new move.',
       stock: ['tm_bodyslam','tm_brickbreak','tm_shadowclaw','tm_icebeam','tm_flamethrower'] },
  4: { name: '4F · Held Items & Souvenirs', title: '🎁  4F — Held Items & Souvenirs', clerkLabel: 'Gift Clerk', clerkColor: 0xdd88aa,
       greet: 'Gift Clerk: Held items help your partners in battle — or take home a souvenir!',
       stock: ['oranberry','sitrusberry','lumberry','leftovers','expertbelt','charcoal','mysticwater','miracleseed','magnet',
         'sv_munkain','sv_vipour','sv_onnurian','sv_corrpanda','sv_nabi','sv_jangseung'] },
  5: { name: '5F · Food Court', title: '🥤  5F — Food Court', clerkLabel: 'Vendor', clerkColor: 0xddaa55,
       greet: 'Vendor: Fresh drinks and treats — they perk your Pokémon right up!',
       stock: ['freshwater','sodapop','lemonade','moomoomilk','lavacookie'] },
  6: { name: '6F · Rooftop Garden', title: '🥤  Rooftop Vending', clerkLabel: 'Vending', clerkColor: 0x88aacc,
       greet: 'The vending machine hums. Grab a drink and enjoy the view.',
       stock: ['freshwater','sodapop','lemonade'] },
};

export class DeptStoreScene extends Phaser.Scene {
  private playerG!: Phaser.GameObjects.Graphics;
  /** Authored 3D interior. Floor 6 deliberately switches back to an outdoor
   *  camera/environment so the rooftop garden keeps its open skyline. */
  public get interior3D() { return this.floor !== 6; }
  public clearSight3D = true;
  public noVehicles = true;
  public propPlots: PropPlot[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 0; private py = 0;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private readonly SPEED = 110;
  private floor = 1;
  private solids: { x1: number; y1: number; x2: number; y2: number }[] = [];
  private prompt!: Phaser.GameObjects.Text;
  // interactables
  private clerkAt = { col: 5, row: 2 };
  private elevatorAt = { col: 12, row: 4 };
  // elevator panel (keyboard-driven)
  private elevatorOpen = false;
  private elevatorLayer?: Phaser.GameObjects.Container;
  private elevatorBtns: { fl: number; txt: Phaser.GameObjects.Text }[] = [];
  private elevatorSel = 0;
  private xKey!: Phaser.Input.Keyboard.Key;
  private elevatorKey!: Phaser.Input.Keyboard.Key;
  private floorTransitioning = false;

  constructor() { super('DeptStoreScene'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.floorTransitioning = false;
    this.input.keyboard?.resetKeys();
    this.floor = (this.registry.get('deptFloor') as number) ?? 1;
    this.clerkAt = this.floor === 6 ? { col: 3, row: 6 } : { col: 5, row: 2 };
    this.propPlots = this.build3DProps();
    playBgm(this, this.floor === 6 ? 'sudo' : 'deptstore');

    // Spawn: at the elevator when arriving by lift, else at the entrance door (1F).
    const viaElevator = !!this.registry.get('deptViaElevator');
    if (viaElevator) {
      this.px = this.elevatorAt.col * TILE + 16; this.py = (this.elevatorAt.row + 1) * TILE + 16; this.facing = 0;
    } else {
      this.px = 7 * TILE + 16; this.py = 9 * TILE + 16; this.facing = 1;
    }
    this.registry.remove('deptViaElevator');

    this.solids = [];
    this.drawFloor();
    this.createPlayer();
    this.setupInput();
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.setZoom(1.7);
    this.cameras.main.startFollow(this.playerG, true, 0.12, 0.12);
    this.cameras.main.fadeIn(150);
    this.dialog = new DialogBox(this, 1280, 720);
    // Only checkpoint-save on first entry to the store — NOT on every elevator hop
    // (a full-registry save each floor change is what caused the stutter).
    if (!viaElevator) SaveManager.save(this.registry, this.px, this.py, 'CapitolCityScene');

    this.prompt = this.add.text(this.scale.width / 2, 44, '', {
      fontSize: '12px', color: '#fff', backgroundColor: '#000000cc', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(60).setVisible(false);

    // Returning from a paused sub-scene (a floor's shop / the vending machine) must
    // release the cutscene lock and clear held keys — otherwise the player comes back
    // frozen. Registered once; survives pause/resume (create() doesn't re-run on resume).
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.cutsceneActive = false;
      this.prompt.setVisible(false);
      this.input.keyboard?.resetKeys();
    });
  }

  private addSolid(c1: number, r1: number, c2: number, r2: number) {
    this.solids.push({ x1: c1 * TILE, y1: r1 * TILE, x2: (c2 + 1) * TILE, y2: (r2 + 1) * TILE });
  }

  /** Fixtures are the single source of truth for the 2D fallback, collision and
   *  the 3D store model, so every shelf the player sees is also physically real. */
  private floorFixtures(): DeptFixture[] {
    const counter: DeptFixture = { kind: 'store-counter', col: 3, row: 2, w: 5, d: 1, color: 0x9a6b42, solid: true };
    switch (this.floor) {
      case 1: return [
        counter,
        { kind: 'store-directory', col: 2, row: 5, w: 1, d: 2, color: 0x405f82, solid: true },
        { kind: 'store-sofa', col: 4, row: 6, w: 3, d: 1, color: 0x9e5266, solid: true },
        { kind: 'store-sofa', col: 8, row: 7, w: 2, d: 1, color: 0x9e5266, solid: true },
        { kind: 'store-planter', col: 2, row: 8, color: 0xb47a48, solid: true },
        { kind: 'store-planter', col: 11, row: 8, color: 0xb47a48, solid: true },
      ];
      case 2: return [
        counter,
        { kind: 'store-shelf', col: 2, row: 5, w: 3, d: 1, color: 0x68a4be, solid: true },
        { kind: 'store-shelf', col: 6, row: 5, w: 3, d: 1, color: 0x68a4be, solid: true },
        { kind: 'store-shelf', col: 2, row: 8, w: 3, d: 1, color: 0x68a4be, solid: true },
        { kind: 'store-shelf', col: 6, row: 8, w: 3, d: 1, color: 0x68a4be, solid: true },
        { kind: 'store-display', col: 10, row: 7, w: 2, d: 1, color: 0x6f9f79, solid: true },
      ];
      case 3: return [
        { ...counter, color: 0x765c96 },
        ...[[2, 5], [5, 5], [8, 5], [2, 8], [5, 8], [8, 8]].map(([col, row]) =>
          ({ kind: 'store-tmrack', col, row, color: 0x765c96, solid: true }) as DeptFixture),
        { kind: 'store-shelf', col: 10, row: 7, w: 2, d: 1, color: 0x765c96, solid: true },
      ];
      case 4: return [
        { ...counter, color: 0xb66b87 },
        ...[[2, 5], [6, 5], [10, 5], [3, 8], [7, 8], [11, 8]].map(([col, row]) =>
          ({ kind: 'store-display', col, row, w: 2, d: 1, color: 0xb66b87, solid: true }) as DeptFixture),
      ];
      case 5: return [
        { ...counter, color: 0xb88942 },
        ...[[3, 6], [6, 6], [9, 6], [3, 8], [6, 8], [9, 8]].map(([col, row]) =>
          ({ kind: 'store-table', col, row, color: 0xb88942, solid: true }) as DeptFixture),
      ];
      default: return [
        { kind: 'store-vending', col: 3, row: 6, color: 0x4f83aa, solid: true },
        { kind: 'store-planter', col: 1, row: 5, color: 0x8b6a48, solid: true },
        { kind: 'store-planter', col: 5, row: 5, color: 0x8b6a48, solid: true },
        { kind: 'store-planter', col: 11, row: 5, color: 0x8b6a48, solid: true },
        { kind: 'store-planter', col: 1, row: 8, color: 0x8b6a48, solid: true },
        { kind: 'store-planter', col: 12, row: 8, color: 0x8b6a48, solid: true },
        { kind: 'store-bench', col: 5, row: 8, w: 3, d: 1, color: 0x507a65, solid: true },
        { kind: 'store-bench', col: 9, row: 8, w: 2, d: 1, color: 0x507a65, solid: true },
      ];
    }
  }

  private build3DProps(): PropPlot[] {
    const fixtures = this.floorFixtures().map(f => ({
      x: f.col, y: f.row, kind: f.kind, w: f.w ?? 1, d: f.d ?? 1, color: f.color,
    } as PropPlot));
    const lift: PropPlot = { x: 11, y: 2, kind: 'store-elevator', w: 2, d: 2, color: 0x718da7 };
    if (this.floor === 6) {
      return [
        lift,
        { x: 0, y: 4, kind: 'store-railing', w: 15, d: 0.18, color: 0x9099a5 },
        ...fixtures,
      ];
    }
    return [
      { x: 0, y: 0, kind: 'store-wall', w: 15, d: 1, color: 0x8a6a4a },
      { x: 0, y: 1, kind: 'store-wall', w: 1, d: 9, color: 0x8a6a4a },
      { x: 14, y: 1, kind: 'store-wall', w: 1, d: 9, color: 0x8a6a4a },
      { x: 0, y: 10, kind: 'store-wall', w: 7, d: 1, color: 0x8a6a4a },
      { x: 8, y: 10, kind: 'store-wall', w: 7, d: 1, color: 0x8a6a4a },
      lift,
      ...fixtures,
    ];
  }

  private drawFixtureFootprint(g: Phaser.GameObjects.Graphics, f: DeptFixture) {
    const x = f.col * TILE, y = f.row * TILE, w = (f.w ?? 1) * TILE, d = (f.d ?? 1) * TILE;
    const color = f.color ?? 0x6a7f9a;
    g.fillStyle(0x000000, 0.14); g.fillEllipse(x + w / 2, y + d - 1, Math.max(16, w * 0.78), 8);
    g.fillStyle(color, 1); g.fillRect(x + 3, y + 3, w - 6, d - 6);
    if (f.kind === 'store-shelf') {
      g.fillStyle(0xe9dfc8, 1); for (let sx = x + 8; sx < x + w - 5; sx += 14) g.fillRect(sx, y + 7, 8, d - 14);
    } else if (f.kind === 'store-tmrack') {
      g.fillStyle(0x68d6ff, 1); g.fillCircle(x + w / 2, y + d / 2, 7);
    } else if (f.kind === 'store-display') {
      g.fillStyle(0xffd46a, 1); g.fillCircle(x + w / 2, y + d / 2, 6);
    } else if (f.kind === 'store-table') {
      g.fillStyle(0xf1dcc0, 1); g.fillCircle(x + w / 2, y + d / 2, 10);
    } else if (f.kind === 'store-planter') {
      g.fillStyle(0x3f8248, 1); g.fillCircle(x + w / 2, y + d / 2, Math.min(w, d) * 0.26);
    } else if (f.kind === 'store-sofa' || f.kind === 'store-bench') {
      g.fillStyle(0xffffff, 0.18); g.fillRect(x + 6, y + 6, w - 12, 5);
    } else if (f.kind === 'store-directory') {
      g.fillStyle(0xffd76a, 1); for (let sy = y + 9; sy < y + d - 6; sy += 9) g.fillRect(x + 7, sy, w - 14, 3);
    } else if (f.kind === 'store-vending') {
      g.fillStyle(0xbfeeff, 1); g.fillRect(x + 7, y + 6, w - 14, d - 15);
    }
    if (f.solid) this.addSolid(f.col, f.row, f.col + (f.w ?? 1) - 1, f.row + (f.d ?? 1) - 1);
  }

  private drawFloor() {
    const g = this.make.graphics({ x: 0, y: 0 });
    const W = COLS * TILE, H = ROWS * TILE;
    const rooftop = this.floor === 6;

    if (rooftop) {
      // Rooftop: sky + a Capitol City skyline seen over the balcony railing.
      g.fillGradientStyle(0x8ec6e6, 0x8ec6e6, 0xcfe6f2, 0xcfe6f2, 1); g.fillRect(0, 0, W, H * 0.42);
      g.fillStyle(0x5a6a52); g.fillRect(0, H * 0.42, W, H * 0.58);
      // distant skyline
      g.fillStyle(0x6a7a94, 0.9);
      const sky = [[10,130,60],[70,90,55],[120,150,80],[190,80,50],[240,120,70],[300,100,60],[350,160,90],[420,90,55]];
      for (const [x, h, w] of sky) { g.fillRect(x, H * 0.42 - h, w, h); g.fillStyle(0xffe488, 0.5); for (let wy = 0; wy < h - 14; wy += 16) g.fillRect(x + 6, H * 0.42 - h + 8 + wy, 6, 8); g.fillStyle(0x6a7a94, 0.9); }
    } else {
      // Interior: walls + tiled floor
      g.fillStyle(0x8a6a4a); g.fillRect(0, 0, W, H);
      g.fillStyle(0xe8e4dc); g.fillRect(TILE, TILE, W - 2 * TILE, H - 2 * TILE);
      for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) if ((r + c) % 2 === 0) { g.fillStyle(0xdcd6cc, 1); g.fillRect(c * TILE, r * TILE, TILE, TILE); }
    }

    // Elevator shaft (right side)
    g.fillStyle(0x3a3a44); g.fillRect(11 * TILE, 2 * TILE, 2 * TILE, 2 * TILE);
    g.fillStyle(0x8ab0d0); g.fillRect(11 * TILE + 4, 2 * TILE + 4, 2 * TILE - 8, 2 * TILE - 8);
    g.fillStyle(0x222); g.fillRect(12 * TILE - 1, 2 * TILE + 4, 2, 2 * TILE - 8);
    this.addSolid(11, 2, 12, 3);

    // Floor-specific counters, shelves, displays, seating and garden furniture.
    // The same definitions also feed the authored 3D prop pass.
    for (const fixture of this.floorFixtures()) this.drawFixtureFootprint(g, fixture);

    // Door (1F only) — bottom centre
    if (this.floor === 1) { g.fillStyle(0x6b4a28); g.fillRect(7 * TILE, (ROWS - 1) * TILE, TILE, TILE); }

    // Outer walls as solids (interior floors)
    if (!rooftop) {
      this.addSolid(0, 0, COLS - 1, 0); this.addSolid(0, 0, 0, ROWS - 1);
      this.addSolid(COLS - 1, 0, COLS - 1, ROWS - 1);
      this.addSolid(0, ROWS - 1, 6, ROWS - 1); this.addSolid(8, ROWS - 1, COLS - 1, ROWS - 1);
    } else {
      // Rooftop: a railing along the top edge (the balcony) blocks you from the drop.
      g.fillStyle(0x9a9488); g.fillRect(0, 4 * TILE, W, 8);
      for (let x = 8; x < W; x += 26) { g.fillStyle(0x7a7468); g.fillRect(x, 4 * TILE, 5, TILE); }
      this.addSolid(0, 0, COLS - 1, 3);
      this.addSolid(0, 0, 0, ROWS - 1); this.addSolid(COLS - 1, 0, COLS - 1, ROWS - 1); this.addSolid(0, ROWS - 1, COLS - 1, ROWS - 1);
    }

    const key = `__dept${this.floor}__`;
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, W, H); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    // Floor banner
    this.add.rectangle(this.scale.width / 2, 20, 360, 30, 0x000000, 0.55).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 20, `${tr('🏬 Capitol Dept. Store —')} ${tr(FLOORS[this.floor].name)}`, {
      fontSize: '12px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SPACE: talk / use elevator  M: menu'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);

    this.drawNPCs();
  }

  private drawNPCs() {
    const f = FLOORS[this.floor];
    // Elevator "call" marker
    this.add.text(this.elevatorAt.col * TILE + 16, 1.5 * TILE, '🛗', { fontSize: '16px' }).setOrigin(0.5).setDepth(5);

    // Clerk behind the counter (floors that sell)
    if (f.stock && this.floor !== 6) {
      const g = this.add.graphics().setDepth(10);
      g.setPosition(this.clerkAt.col * TILE + 16, this.clerkAt.row * TILE + 16);
      g.setData('characterModel3DKey', 'dept-clerk-girl');
      drawNpcBody(g, f.clerkColor ?? 0x66bbaa, { hair: 0x2a2018 });
      this.add.text(this.clerkAt.col * TILE + 16, this.clerkAt.row * TILE - 8, speakerName(f.clerkLabel ?? 'Clerk'),
        { fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(11);
    }

    if (this.floor === 1) {
      const g = this.add.graphics().setDepth(10);
      g.setPosition(this.clerkAt.col * TILE + 16, this.clerkAt.row * TILE + 16);
      g.setData('characterModel3DKey', 'dept-receptionist-girl');
      drawNpcBody(g, 0xcc6688, { hair: 0x2a2018 });
      this.add.text(this.clerkAt.col * TILE + 16, this.clerkAt.row * TILE - 8, speakerName('Receptionist'),
        { fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(11);
      // Keep the directory in screen space. As a world-space billboard it was
      // converted by the 3D mirror and ended up hidden behind the real directory
      // fixture / reception furniture.
      this.add.text(18, 78, tr('📋 FLOORS\n1 Reception\n2 Medicine\n3 TMs\n4 Souvenirs\n5 Food Court\n6 Rooftop'), {
        fontSize: '12px', color: '#f6fbff', backgroundColor: '#10213bee',
        padding: { x: 12, y: 10 }, lineSpacing: 5,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0, 0).setScrollFactor(0).setDepth(58);
    }

    if (this.floor === 6) {
      // Vending machine (buy drinks)
      this.add.text(this.clerkAt.col * TILE + 16, this.clerkAt.row * TILE + 20, '🥤', { fontSize: '20px' }).setOrigin(0.5).setDepth(6);
      this.add.text(this.clerkAt.col * TILE + 16, this.clerkAt.row * TILE - 4, speakerName('Vending'), { fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(6);
      // City-watcher NPC (a gift once)
      const g = this.add.graphics().setDepth(10);
      g.setPosition(9 * TILE + 16, 6 * TILE + 16);
      g.setData('characterModel3DKey', 'dept-collector-boy');
      drawNpcBody(g, 0x5a7a9a, { hair: 0x2a2018 });
      this.add.text(9 * TILE + 16, 6 * TILE - 8, speakerName('Collector'), { fontSize: '8px', color: '#cfe', backgroundColor: '#00000088', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(11);
      this.add.text(this.scale.width / 2, 66, tr('— Balcony over Capitol City —'), { fontSize: '11px', color: '#fff', backgroundColor: '#00000066', padding: { x: 6, y: 2 } }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    }
  }

  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.redraw(); }
  private redraw() { drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry)); this.playerG.setPosition(this.px, this.py); }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.elevatorKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.xKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }

  update(_: number, delta: number) {
    if (this.elevatorOpen) {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.up)) this.moveElevatorSel(-1);
      if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.down)) this.moveElevatorSel(1);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey) || Phaser.Input.Keyboard.JustDown(this.elevatorKey)) {
        const fl = this.elevatorBtns[this.elevatorSel]?.fl;
        this.closeElevator();
        if (fl !== undefined) this.goToFloor(fl);
      } else if (Phaser.Input.Keyboard.JustDown(this.xKey)) {
        this.closeElevator();
      }
      return;
    }
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
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = this.px + (dx / len) * this.SPEED * dt, ny = this.py + (dy / len) * this.SPEED * dt;
      if (!this.blocked(nx, this.py)) this.px = nx;
      if (!this.blocked(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > 170) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.redraw();
    this.checkInteract();
    this.checkExit();
  }

  private blocked(x: number, y: number): boolean {
    if (x < 10 || x > COLS * TILE - 10 || y < 10 || y > ROWS * TILE - 6) return true;
    return this.solids.some(s => x > s.x1 && x < s.x2 && y > s.y1 - 4 && y < s.y2 + 6);
  }

  private near(col: number, row: number, r = 1.4) {
    return Math.hypot(this.px - (col * TILE + 16), this.py - (row * TILE + 16)) < TILE * r;
  }

  private checkInteract() {
    const f = FLOORS[this.floor];
    // The visible lift occupies rows 2–3 and opens onto rows 4–5. Accept both
    // tiles so the prompt does not disappear at the edge of its collision box.
    const nearElevator = this.near(this.elevatorAt.col, this.elevatorAt.row + 1, 1.8) || this.near(this.elevatorAt.col, this.elevatorAt.row, 1.8);
    const nearClerk = (f.stock && this.floor !== 6 && this.near(this.clerkAt.col, this.clerkAt.row + 1, 1.4)) ||
                      (this.floor === 6 && this.near(this.clerkAt.col, this.clerkAt.row, 1.5));
    const nearCollector = this.floor === 6 && this.near(9, 6, 1.5);
    const near1F = this.floor === 1 && this.near(this.clerkAt.col, this.clerkAt.row + 1, 1.4);

    this.prompt.setVisible(false);
    if (nearElevator) { this.prompt.setText(tr('SPACE — Elevator')).setVisible(true); }
    else if (nearClerk) { this.prompt.setText(tr(this.floor === 6 ? 'SPACE — Vending machine' : 'SPACE — Shop')).setVisible(true); }
    else if (nearCollector) { this.prompt.setText(tr('SPACE — Talk')).setVisible(true); }
    else if (near1F) { this.prompt.setText(tr('SPACE — Info')).setVisible(true); }

    const usePressed = Phaser.Input.Keyboard.JustDown(this.spaceKey) || Phaser.Input.Keyboard.JustDown(this.elevatorKey);
    if (!usePressed) return;
    if (nearElevator) { this.openElevator(); return; }
    if (nearClerk && f.stock) { this.openShop(f); return; }
    if (nearCollector) { this.rooftopCollector(); return; }
    if (near1F) {
      this.cutsceneActive = true;
      this.dialog.show(['Receptionist: Welcome to the Capitol Department Store! Take the elevator up — six floors of everything a trainer needs.'],
        () => { this.cutsceneActive = false; });
    }
  }

  private openShop(f: FloorDef) {
    this.cutsceneActive = true;
    this.dialog.show([f.greet ?? 'Clerk: What can I get you?'], () => {
      this.registry.set('deptFloor', this.floor);
      this.scene.launch('ShopScene', { parentKey: this.scene.key, stock: f.stock, title: f.title });
      this.scene.pause();
    });
  }

  private rooftopCollector() {
    this.cutsceneActive = true;
    if (this.registry.get('deptRooftopGift')) {
      this.dialog.show(["Collector: Best view in the capital, isn't it? The whole city, laid out like a board."], () => { this.cutsceneActive = false; });
      return;
    }
    this.registry.set('deptRooftopGift', true);
    Inventory.add(this.registry, 'sv_nabi', 1);
    this.dialog.show([
      "Collector: You climbed all the way up? Then you appreciate a good view.",
      "Collector: Here — a 나비할망 charm, from my own collection. May it watch over your road.",
      "🦋 You received a 나비할망 Charm!",
    ], () => { this.cutsceneActive = false; });
  }

  private openElevator() {
    if (this.elevatorOpen || this.floorTransitioning) return;
    this.cutsceneActive = true;
    this.elevatorOpen = true;
    this.elevatorBtns = [];
    const cx = this.scale.width / 2, cy = this.scale.height / 2;
    const layer = this.add.container(0, 0).setScrollFactor(0).setDepth(500);
    // Every child must also be screen-fixed. Container scroll factors are not
    // inherited by the 3D mirror's object classifier; without these flags the
    // panel children were lifted into the world and disappeared from the UI.
    const dim = this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x000000, 0.68).setScrollFactor(0);
    const panel = this.add.rectangle(cx, cy, 430, 430, 0x10142a, 0.995)
      .setStrokeStyle(3, 0x9ed5ff).setScrollFactor(0);
    const title = this.add.text(cx, cy - 182, tr('🛗  ELEVATOR'), {
      fontSize: '21px', color: '#e9f8ff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0);
    layer.add([dim, panel, title]);

    for (let fl = 6, i = 0; fl >= 1; fl--, i++) {
      const y = cy - 132 + i * 46;
      const txt = this.add.text(cx, y, tr(FLOORS[fl].name), {
        fontSize: '16px', color: '#fff', backgroundColor: '#24406a',
        padding: { x: 12, y: 7 }, align: 'center',
      }).setOrigin(0.5).setFixedSize(320, 36).setScrollFactor(0).setInteractive({ useHandCursor: true });
      txt.on('pointerdown', () => {
        if (fl === this.floor || this.floorTransitioning) return;
        this.closeElevator();
        this.goToFloor(fl);
      });
      layer.add(txt);
      this.elevatorBtns.push({ fl, txt });
    }
    const help = this.add.text(cx, cy + 174, tr('↑ ↓ select    SPACE go    X cancel'), {
      fontSize: '13px', color: '#bcd2e8',
    }).setOrigin(0.5).setScrollFactor(0);
    layer.add(help);
    this.elevatorLayer = layer;

    // Start on the first floor that isn't the current one.
    this.elevatorSel = 0;
    if (this.elevatorBtns[0].fl === this.floor) this.moveElevatorSel(1);
    else this.highlightElevator();
  }

  private moveElevatorSel(dir: number) {
    const n = this.elevatorBtns.length;
    do { this.elevatorSel = (this.elevatorSel + dir + n) % n; }
    while (this.elevatorBtns[this.elevatorSel].fl === this.floor);   // skip the current floor
    this.highlightElevator();
  }

  private highlightElevator() {
    for (let i = 0; i < this.elevatorBtns.length; i++) {
      const b = this.elevatorBtns[i];
      const cur = b.fl === this.floor, sel = i === this.elevatorSel;
      b.txt.setColor(cur ? '#667' : (sel ? '#fff' : '#cdd'));
      b.txt.setBackgroundColor(cur ? '#161a2a' : (sel ? '#3a72b0' : '#24406a'));
    }
  }

  private closeElevator() {
    this.elevatorLayer?.destroy(true);
    this.elevatorLayer = undefined;
    this.elevatorBtns = [];
    this.elevatorOpen = false;
    this.cutsceneActive = false;
  }

  private goToFloor(fl: number) {
    if (this.floorTransitioning || fl === this.floor) return;
    this.floorTransitioning = true;
    this.cutsceneActive = true;
    this.registry.set('deptFloor', fl);
    this.registry.set('deptViaElevator', true);
    this.input.keyboard?.resetKeys();
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart();
    });
    this.cameras.main.fadeOut(180, 0, 0, 0);
  }

  private checkExit() {
    if (this.floor !== 1) return;
    if (this.py > (ROWS - 1) * TILE && this.px > 6.4 * TILE && this.px < 8.6 * TILE && !this.cutsceneActive) {
      this.cutsceneActive = true;
      this.registry.remove('deptFloor');
      this.cameras.main.fadeOut(300, 0, 0, 0, () => this.scene.start('CapitolCityScene'));
    }
  }
}
