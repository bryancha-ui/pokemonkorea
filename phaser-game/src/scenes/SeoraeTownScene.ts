import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { drawTrainerBody, drawRiderBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';

// ── Seorae Town (서래 마을) — The Alpine Frost Town ───────────────────────────────
// A broad snowbound resort town: the Frostbell Gym, a full Pokémon Center,
// frozen market, hot springs, pine groves, and the eastbound Skate Link.

const T = { SNOW: 0, PATH: 1, WALL: 2, ROOF: 3 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 48, ROWS = 44;
const COLORS: Record<Tile, number> = { [T.SNOW]: 0xe4ecf2, [T.PATH]: 0xc2ccd4, [T.WALL]: 0x6a5a4a, [T.ROOF]: 0x4a5a6a };
const SOLID = new Set<Tile>([T.WALL, T.ROOF]);

const GYM = { col: 10, row: 11 };
const CENTER = { col: 34, row: 11 };
const SKATE_LINK = { col: 40, row: 26 };
const TOWNSFOLK = [
  { col: 18, row: 21, color: 0x6385a6, line: 'Skater: The Skate Link is the fastest way east. Keep your balance when the wind picks up!' },
  { col: 28, row: 23, color: 0x9b729f, line: 'Sculptor: Snow remembers every chisel stroke—until the spring asks it to become water again.' },
  { col: 12, row: 28, color: 0x71926a, line: 'Innkeeper: The hot spring is open to every traveler. Steam is Seorae’s warmest welcome.' },
  { col: 37, row: 19, color: 0xb68b59, line: 'Vendor: These frost-berry skewers stay cold all day. Perfect for a hike!' },
  { col: 7, row: 35, color: 0x7d7f9d, line: 'Ranger: The old pine grove shelters more than people realize. Listen closely in the snow.' },
  { col: 22, row: 15, color: 0x8a9eb0, line: 'Tourist: What a beautiful resort town! I could stay here all winter.' },
  { col: 42, row: 15, color: 0xc49070, line: 'Coach: The mountain trains champions. Come back strong after your climb.' },
  { col: 32, row: 31, color: 0x7b9d65, line: 'Youth: The snow sculptures here are incredible!' },
];

interface Building { x: number; y: number; w: number; h: number; doorCol: number; doorRow: number; roof: number; label: string; }
const SKATE_SHOP = { col: 40, row: 33 };
const ENTERABLE_BUILDINGS = [
  { kind: 'lodge' as const, col: 7, row: 22, prompt: 'Enter the Alpine Lodge' },
  { kind: 'baths' as const, col: 15, row: 34, prompt: 'Enter the Snowmelt Baths' },
  { kind: 'market' as const, col: 34, row: 22, prompt: 'Enter the Frost Market' },
  { kind: 'skateshop' as const, col: SKATE_SHOP.col, row: SKATE_SHOP.row, prompt: 'Enter the Skate Shop' },
];
const BUILDINGS: Building[] = [
  { x: 7, y: 6, w: 8, h: 6, doorCol: GYM.col, doorRow: GYM.row, roof: 0x3a5060, label: '🔔 FROSTBELL GYM' },
  { x: 31, y: 6, w: 7, h: 6, doorCol: CENTER.col, doorRow: CENTER.row, roof: 0xcc2233, label: '✚ Pokémon Center' },
  { x: 4, y: 18, w: 8, h: 5, doorCol: 7, doorRow: 22, roof: 0x76513a, label: '❄ Alpine Lodge' },
  { x: 12, y: 30, w: 8, h: 5, doorCol: 15, doorRow: 34, roof: 0x6f9a9c, label: '♨ Snowmelt Baths' },
  { x: 31, y: 18, w: 7, h: 5, doorCol: 34, doorRow: 22, roof: 0x5b7596, label: '🍡 Frost Market' },
  { x: 38, y: 31, w: 6, h: 4, doorCol: SKATE_SHOP.col, doorRow: SKATE_SHOP.row, roof: 0x4a8fa0, label: '⛸ Skate Shop' },
];

export class SeoraeTownScene extends Phaser.Scene {
  private map!: Tile[][];
  public buildingPlots = BUILDINGS.map((b, i) => ({ x: b.x, y: b.y, w: b.w, h: b.h, model: ['frostgym', 'pokecenter', 'alpinelodge', 'snowmeltbaths', 'mart', 'skateshop'][i] }));
  public onlyNamedBuildings = true;
  // The town's lanterns, pine groves and ice sculptures rendered as real 3D
  // props (coordinates mirror the 2D drawPine / lantern / snow-sculpture spots).
  public propPlots = [
    ...([[3, 4], [5, 5], [8, 6], [18, 4], [20, 5], [27, 4], [30, 6], [41, 5], [43, 7], [46, 6],
      [4, 28], [6, 31], [10, 32], [42, 33], [44, 36], [46, 38], [25, 37], [28, 39]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'pine' as const })),
    ...([[20, 20], [28, 20], [20, 31], [28, 31], [39, 18]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'lantern' as const })),
    ...([[17, 17], [25, 16], [28, 31], [39, 32], [44, 24]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'icestatue' as const })),
  ];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = 24 * TILE + 16;
  private py = 40 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private readonly SPEED = 130;
  private readonly RUN = 250;

  constructor() { super('SeoraeTownScene'); }

  create() {
    playBgm(this, 'seorae');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();
    this.spawnGuard = true;
    this.time.delayedCall(600, () => { this.spawnGuard = false; });

    this.px = 24 * TILE + 16; this.py = 40 * TILE + 16;
    const rx = this.registry.get('seoraeReturnX') as number | undefined;
    const ry = this.registry.get('seoraeReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('seoraeReturnX'); this.registry.remove('seoraeReturnY');

    this.map = buildMap();
    this.drawMap();
    this.drawTown();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'SeoraeTownScene');

    if (!this.registry.get('seoraeSeen')) {
      this.registry.set('seoraeSeen', true);
      this.time.delayedCall(500, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'The treeline opens into Seorae Town (서래 마을), a wide alpine village of pine groves, steaming baths, and enormous snow sculptures.',
          'The Frostbell Gym waits in the northwest. The Pokémon Center has a nurse and PC inside, while the Skate Link carries travelers east toward Sunrise City.',
        ], () => { this.cutsceneActive = false; });
      });
    }
  }

  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t]); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.SNOW) { g.fillStyle(0xffffff, 0.55); g.fillRect(c * TILE + 4, r * TILE + 5, 4, 4); g.fillRect(c * TILE + 21, r * TILE + 19, 4, 4); }
      if (t === T.PATH) { g.fillStyle(0xaebbc5, 0.62); g.fillRect(c * TILE + 1, r * TILE + 1, TILE - 2, TILE - 2); }
      if (t === T.WALL) { g.fillStyle(0x5a4a3a); g.fillRect(c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4); }
    }
    const key = '__seoraeMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(24 * TILE, 41.5 * TILE, tr('↓ Seorae Pass · Dolmoe'), { fontSize: '9px', color: '#123', backgroundColor: '#ffffffbb', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    this.add.text(43 * TILE, 24 * TILE, tr('⛸ Skate Link → Sunrise City'), { fontSize: '9px', color: '#123', backgroundColor: '#dff6ffdd', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
  }

  private drawTown() {
    const g = this.add.graphics().setDepth(3);
    for (const building of BUILDINGS) this.drawBuilding(g, building);

    // A broad frozen plaza makes the enlarged town feel like a destination, not a corridor.
    g.fillStyle(0xa9d9e9, 0.72); g.fillEllipse(24 * TILE, 26 * TILE, 14 * TILE, 8 * TILE);
    g.lineStyle(3, 0xffffff, 0.8); g.strokeEllipse(24 * TILE, 26 * TILE, 14 * TILE, 8 * TILE);
    this.add.text(24 * TILE, 26 * TILE - 4, tr('⛸  FROSTBELL PLAZA  ⛸'), { fontSize: '11px', color: '#2d6178', fontStyle: 'bold', stroke: '#fff', strokeThickness: 2 }).setOrigin(0.5).setDepth(5);

    this.drawSkateLink(g);
    // Pine trees scattered across town for forest feel
    [[3, 4], [5, 5], [8, 6], [18, 4], [20, 5], [27, 4], [30, 6], [41, 5], [43, 7], [46, 6], [4, 28], [6, 31], [10, 32], [42, 33], [44, 36], [46, 38], [25, 37], [28, 39]]
      .forEach(([c, r]) => this.drawPine(g, c, r));
    // Large snow sculptures as landmarks
    [[17, 17], [25, 16], [28, 31], [39, 32], [44, 24]].forEach(([c, r], i) => this.drawSnowSculpture(g, c, r, i % 2));

    // Hot-spring steam, lanterns, and market pennants provide extra visual motion and color.
    for (const [c, r] of [[14, 28], [16, 28], [18, 29]]) {
      g.fillStyle(0xffffff, 0.45); g.fillCircle(c * TILE + 16, r * TILE + 12, 11); g.fillCircle(c * TILE + 22, r * TILE + 2, 8);
    }
    for (const [c, r] of [[20, 20], [28, 20], [20, 31], [28, 31], [39, 18]]) {
      g.fillStyle(0x6b5130); g.fillRect(c * TILE + 14, r * TILE + 8, 4, 20); g.fillStyle(0xffdc6a); g.fillCircle(c * TILE + 16, r * TILE + 8, 5);
    }

    for (const townsperson of TOWNSFOLK) {
      const npc = this.add.graphics().setDepth(8);
      npc.setPosition(townsperson.col * TILE + 16, townsperson.row * TILE + 16);
      drawNpcBody(npc, townsperson.color);
    }
  }

  private drawBuilding(g: Phaser.GameObjects.Graphics, b: Building) {
    const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
    g.fillStyle(0x8a7a6a); g.fillRect(x, y, w, h);
    g.fillStyle(b.roof); g.fillTriangle(x - 5, y, x + w / 2, y - 1.9 * TILE, x + w + 5, y);
    g.fillStyle(0xffffff, 0.8); g.fillTriangle(x + w / 2, y - 1.9 * TILE, x + w / 2 - TILE, y - TILE, x + w / 2 + TILE, y - TILE);
    g.fillStyle(0x2a3a48); g.fillRect(b.doorCol * TILE, b.doorRow * TILE, TILE, TILE);
    this.add.text(x + w / 2, y - 15, tr(b.label), { fontSize: '9px', color: '#eaf7ff', backgroundColor: '#00000099', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(4);
  }

  private drawPine(g: Phaser.GameObjects.Graphics, col: number, row: number) {
    const x = col * TILE + 16, y = row * TILE + 16;
    // Trunk
    g.fillStyle(0x4a3220); g.fillRect(x - 4, y + 4, 8, 18);
    g.fillStyle(0x5a4230); g.fillRect(x - 3, y + 5, 6, 16);
    // Triple-layered foliage (dark green base + lighter highlights)
    g.fillStyle(0x1a4a28); g.fillTriangle(x, y - 24, x - 18, y + 6, x + 18, y + 6);
    g.fillStyle(0x245340); g.fillTriangle(x, y - 20, x - 15, y + 8, x + 15, y + 8);
    g.fillStyle(0x1a4a28); g.fillTriangle(x, y - 8, x - 22, y + 18, x + 22, y + 18);
    g.fillStyle(0x245340); g.fillTriangle(x, y - 4, x - 19, y + 16, x + 19, y + 16);
    // Snow on branches (light highlights)
    g.fillStyle(0xffffff, 0.75); g.fillTriangle(x, y - 20, x - 10, y - 2, x + 10, y - 2);
    g.fillTriangle(x, y - 6, x - 14, y + 10, x + 14, y + 10);
  }

  private drawSnowSculpture(g: Phaser.GameObjects.Graphics, col: number, row: number, variant: number) {
    const x = col * TILE + 16, y = row * TILE + 16;
    // Base: huge snow mound
    g.fillStyle(0x9fd9f0, 0.95); g.fillEllipse(x, y + 10, 40, 52);
    // Middle snowball
    g.fillStyle(0xb0e5f8, 0.95); g.fillCircle(x, y - 8, 22);
    // Head
    g.fillStyle(0xc5f0ff, 0.95); g.fillCircle(x, y - 32, 16);
    // Accent shading
    g.fillStyle(0x7abfe6, 0.5); g.fillEllipse(x - 8, y + 15, 24, 32);
    g.fillStyle(0x9acee8, 0.4); g.fillCircle(x - 7, y - 35, 8);
    // Features (wings/arms or crown)
    if (variant % 2 === 0) {
      g.fillStyle(0x5a9ac8); g.fillTriangle(x - 28, y - 5, x - 12, y - 18, x - 15, y + 15);
      g.fillTriangle(x + 28, y - 5, x + 12, y - 18, x + 15, y + 15);
      this.add.text(x, y + 42, tr('Snow Guardian'), { fontSize: '7px', color: '#2d6178', backgroundColor: '#f0fffabb', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(5);
    } else {
      g.fillStyle(0x6ab5d8); g.fillTriangle(x - 20, y - 42, x, y - 56, x + 20, y - 42);
      this.add.text(x, y + 42, tr('Ice Bell'), { fontSize: '7px', color: '#2d6178', backgroundColor: '#f0fffabb', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(5);
    }
  }

  private drawSkateLink(g: Phaser.GameObjects.Graphics) {
    const x = 38 * TILE, y = 25 * TILE;
    g.fillStyle(0x9edceb, 0.9); g.fillRect(x, y, 9 * TILE, 3 * TILE);
    g.lineStyle(2, 0xffffff, 0.85); for (let c = 0; c < 9; c++) g.lineBetween(x + c * TILE, y + 8, x + (c + 1) * TILE, y + 2 * TILE + 16);
    this.add.text(SKATE_LINK.col * TILE, (SKATE_LINK.row - 1) * TILE, tr('⛸ SKATE LINK'), { fontSize: '12px', color: '#24536c', fontStyle: 'bold', stroke: '#fff', strokeThickness: 2 }).setOrigin(0.5).setDepth(5);
  }

  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() { (this.cycling ? drawRiderBody : drawTrainerBody)(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry)); this.playerG.setPosition(this.px, this.py); }
  private setupCamera() { this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE); this.cameras.main.setZoom(1.45); this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1); }
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
    this.add.rectangle(this.scale.width / 2, 22, 390, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🔔 Seorae Town — 서래 마을'), { fontSize: '13px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 40, '', { fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 10, y: 5 } }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  SPACE: enter / talk  M: menu'), { fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 } }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  update(_: number, delta: number) {
    if (this.cutsceneActive) { if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance(); return; }
    const dt = delta / 1000; let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) { dx = -1; this.facing = 2; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { dx = 1; this.facing = 3; }
    if (this.cursors.up.isDown || this.wasd.up.isDown) { dy = -1; this.facing = 1; }
    if (this.cursors.down.isDown || this.wasd.down.isDown) { dy = 1; this.facing = 0; }
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      const speed = this.cycling ? BIKE_SPEED : (this.registry.get('hasRunningShoes') && this.shiftKey.isDown ? this.RUN : this.SPEED);
      const nx = this.px + (dx / len) * speed * dt, ny = this.py + (dy / len) * speed * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > 170) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.drawChar(); this.checkInteractions(); this.checkExits();
  }

  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x - hw, y - 4], [x + hw, y - 4], [x - hw, y + 8], [x + hw, y + 8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      return col < 0 || col >= COLS || row < 0 || row >= ROWS || SOLID.has(this.map[row][col]);
    });
  }

  private checkInteractions() {
    const distance = (col: number, row: number) => Math.hypot(this.px - (col * TILE + 16), this.py - (row * TILE + 16));
    if (distance(GYM.col, GYM.row) < TILE * 1.35) {
      this.enterPrompt.setText(tr('SPACE — Enter the Frostbell Gym')).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.enterScene('SeoraeGymScene', GYM.col, GYM.row);
      return;
    }
    if (distance(CENTER.col, CENTER.row) < TILE * 1.35) {
      this.enterPrompt.setText(tr('SPACE — Enter the Pokémon Center')).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.enterScene('SeoraePCScene', CENTER.col, CENTER.row);
      return;
    }
    for (const building of ENTERABLE_BUILDINGS) if (distance(building.col, building.row) < TILE * 1.35) {
      this.enterPrompt.setText(`SPACE — ${tr(building.prompt)}`).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.enterBuilding(building.kind, building.col, building.row);
      return;
    }
    for (const townsperson of TOWNSFOLK) if (distance(townsperson.col, townsperson.row) < TILE * 1.25) {
      this.enterPrompt.setText(tr('SPACE — Talk')).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) { this.cutsceneActive = true; this.dialog.show([townsperson.line], () => { this.cutsceneActive = false; }); }
      return;
    }
    if (distance(SKATE_LINK.col, SKATE_LINK.row) < TILE * 1.7) {
      this.enterPrompt.setText(tr('SPACE — Ask about the Skate Link')).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) { this.cutsceneActive = true; this.dialog.show(['Skate Link Attendant: The ice lane is clear to Sunrise City. Follow the blue markers and enjoy the glide!'], () => { this.cutsceneActive = false; }); }
      return;
    }
    this.enterPrompt.setVisible(false);
  }

  private enterScene(scene: string, col: number, row: number) {
    this.registry.set('seoraeReturnX', col * TILE + 16); this.registry.set('seoraeReturnY', (row + 1) * TILE + 16);
    this.cutsceneActive = true;
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(scene));
  }

  private enterBuilding(kind: 'lodge' | 'baths' | 'market' | 'skateshop', col: number, row: number) {
    this.registry.set('seoraeReturnX', col * TILE + 16); this.registry.set('seoraeReturnY', (row + 1) * TILE + 16);
    this.cutsceneActive = true;
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('SeoraeBuildingScene', { kind }));
  }

  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('seoraePassReturnX', 10 * TILE + 16); this.registry.set('seoraePassReturnY', 2 * TILE);
        this.scene.start('SeoraePassScene');
      });
    } else if (this.px > (COLS - 1) * TILE && this.py > 24 * TILE && this.py < 28 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('sunriseCityReturnX', 15 * TILE); this.registry.set('sunriseCityReturnY', 23 * TILE);
        this.scene.start('SunriseCityScene');
      });
    }
  }
}

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.SNOW) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, tile: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = tile;
  };
  for (let c = 0; c < COLS; c++) { m[0][c] = T.WALL; m[ROWS - 1][c] = T.WALL; }
  for (let r = 0; r < ROWS; r++) { m[r][0] = T.WALL; m[r][COLS - 1] = T.WALL; }
  fill(0, ROWS, 23, 25, T.PATH);                 // south pass → town heart
  fill(13, 15, 2, 46, T.PATH);                   // north commercial avenue
  fill(24, 29, 15, 35, T.PATH);                  // frozen plaza
  fill(25, 28, 34, COLS, T.PATH);                // eastbound Skate Link
  fill(18, 23, 3, 13, T.PATH); fill(30, 35, 11, 21, T.PATH); fill(18, 23, 30, 39, T.PATH);
  for (const b of BUILDINGS) { fill(b.y, b.y + b.h, b.x, b.x + b.w, T.WALL); m[b.doorRow][b.doorCol] = T.PATH; }
  return m;
}
