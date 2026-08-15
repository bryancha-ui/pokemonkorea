import Phaser from 'phaser';
import { installSurfing, isSurfing } from '../systems/SurfSystem';
import { tr } from '../systems/i18n';
import { drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { PartySystem } from '../systems/PartySystem';
import { playBgm } from '../systems/Music';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = { SAND: 0, PATH: 1, BUILDING: 2, SEA: 3, DOCK: 4, ROCK: 5, PALM: 6, VENT: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 26, ROWS = 24;
const COLORS: Record<Tile, number> = {
  [T.SAND]: 0x3a3a44, [T.PATH]: 0x6a5a52, [T.BUILDING]: 0xe0d6c0, [T.SEA]: 0x1d4e74,
  [T.DOCK]: 0x8a6a44, [T.ROCK]: 0x2a2228, [T.PALM]: 0x2a6a3a, [T.VENT]: 0x9a4a2a,
};
const SOLID = new Set<Tile>([T.BUILDING, T.SEA, T.ROCK, T.PALM]);

interface Building { label: string; scene: string; x: number; y: number; w: number; h: number; doorCol: number; doorRow: number; roof: number; }
const BUILDINGS: Building[] = [
  { label: 'Pokémon Center', scene: 'JejuPCScene', x: 3,  y: 4, w: 6, h: 5, doorCol: 5,  doorRow: 8, roof: 0xcc2244 },
  { label: 'Supply Hut',     scene: '__SHOP__',   x: 17, y: 4, w: 6, h: 5, doorCol: 19, doorRow: 8, roof: 0x2a6a9a },
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.SAND) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };
  // Main inland path (cols 11-14) from the dock up to the mountain trail
  fill(0, ROWS, 11, 15, T.PATH);
  fill(9, 13, 2, COLS - 2, T.PATH);   // a cross street through the port
  // Buildings
  for (const b of BUILDINGS) { fill(b.y, b.y + b.h, b.x, b.x + b.w, T.BUILDING); m[b.doorRow][b.doorCol] = T.PATH; }
  // Sea + the ferry pier reaching out from the south shore (to the map edge)
  fill(19, ROWS, 0, COLS, T.SEA);
  fill(16, ROWS, 11, 15, T.DOCK);     // the pier (player disembarks here; south edge = re-board)
  // Volcanic rock walls framing the north trail (the mountain looms above)
  fill(0, 3, 0, 9, T.ROCK); fill(0, 3, 17, COLS, T.ROCK);
  for (const [r,c] of [[3,9],[3,16],[6,2],[6,23]] as [number,number][]) m[r][c] = T.ROCK;
  // Decorative palms + a steaming vent
  for (const [r,c] of [[14,4],[14,21],[7,11],[7,14]] as [number,number][]) m[r][c] = T.PALM;
  m[2][12] = T.VENT;
  return m;
}

export class JejuPortScene extends Phaser.Scene {
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = 12 * TILE + 16; private py = 17 * TILE + 16;   // disembark on the pier
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private readonly SPEED = 120; private readonly RUN = 250;

  private workerCol = 8; private workerRow = 11;

  constructor() { super('JejuPortScene'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('jejuPortReturnX') as number | undefined;
    const ry = this.registry.get('jejuPortReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('jejuPortReturnX'); this.registry.remove('jejuPortReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawWorker();
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
    playBgm(this, 'vents');   // eerie volcanic shore — Approach to the Vents
    // Reaching Jeju IS the sea crossing — from here the ferry runs onward (Route 6)
    // and back to Haean. The 나비할망 vents event is separate, gated on the 7th badge.
    if (!this.registry.get('chapter9Done')) this.registry.set('chapter9Done', true);
    SaveManager.save(this.registry, this.px, this.py, 'JejuPortScene');

    if (!this.registry.get('jejuPortVisited')) {
      this.registry.set('jejuPortVisited', true);
      this.time.delayedCall(700, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          '🌅 You step off the ferry onto the black-sand dock. Sulfur hangs on the dawn wind.',
          'The volcanic coast of Jeju rises ahead — and far above, the vents glow at the summit.',
          "Prof. Song (comms): You made it across! 노스단's barge hit the same storm, so their head start is gone.",
          "Prof. Song: 나비할망 sleeps at the summit. Rest and stock up here, then climb. Run — they're already on the mountain.",
          "Rival: Heal up, grab supplies, and let's go. The trail north leads straight up the vents.",
        ], () => { this.cutsceneActive = false; });
      });
    } else {
      this.time.delayedCall(300, () => maybeLaunchEvolution(this));
    }
  }

  // ── Map ──────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.SEA) { g.fillStyle(0x3a78a8, 0.5); g.fillRect(c*TILE+3, r*TILE+10, 12, 3); g.fillRect(c*TILE+14, r*TILE+22, 10, 3); }
      if (t === T.DOCK) { g.fillStyle(0x6a4a28); g.fillRect(c*TILE+2, r*TILE+2, TILE-4, TILE-4); g.lineStyle(1, 0x4a3018); g.strokeRect(c*TILE+2, r*TILE+2, TILE-4, TILE-4); }
      if (t === T.ROCK) { g.fillStyle(0x3a3038); g.fillRect(c*TILE+4, r*TILE+5, 9, 8); g.fillRect(c*TILE+18, r*TILE+18, 9, 8); }
      if (t === T.PALM) { g.fillStyle(0x1a5c1a); g.fillCircle(c*TILE+16, r*TILE+8, 11); g.fillStyle(0x6a4a28); g.fillRect(c*TILE+13, r*TILE+10, 6, 18); }
      if (t === T.VENT) { g.fillStyle(0xff6a2a, 0.5); g.fillCircle(c*TILE+16, r*TILE+18, 8); }
    }
    const key = '__jejuPortMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    const bg = this.add.graphics().setDepth(2);
    for (const b of BUILDINGS) {
      const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
      bg.fillStyle(0xefe4d0); bg.fillRect(x, y, w, h); bg.lineStyle(2, 0x333); bg.strokeRect(x, y, w, h);
      bg.fillStyle(b.roof); bg.fillTriangle(x - 4, y, x + w / 2, y - TILE, x + w + 4, y);
      bg.fillStyle(0x88ccff, 0.7);
      for (let wx = 8; wx < w - 8; wx += 22) bg.fillRect(x + wx, y + 14, 14, 16);
      const dx = b.doorCol * TILE, dy = (b.y + b.h - 1) * TILE;
      bg.fillStyle(0x6b4a28); bg.fillRect(dx + 4, dy, TILE - 8, TILE);
      this.add.text((b.x + b.w / 2) * TILE, (b.y - 1.2) * TILE, tr(b.label), {
        fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(3);
    }
    this.add.text(13 * TILE, 0.6 * TILE, tr('↑ Vent Trail (the climb)'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#7a3a1a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(13 * TILE, 22.4 * TILE, tr('↓ Ferry → back to Haean City'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#1a4a6a99', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawWorker() {
    const g = this.add.graphics().setDepth(8);
    g.setPosition(this.workerCol * TILE + 16, this.workerRow * TILE + 16);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(0xddaa33); g.fillRect(-7, -8, 14, 12);
    g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
    g.fillStyle(0x222222); g.fillRect(-6, -21, 12, 5);
    g.fillStyle(0x000000); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2);
    this.add.text(this.workerCol * TILE + 16, this.workerRow * TILE - 12, tr('Dock Worker'), {
      fontSize: '8px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(9);
  }

  // ── Player / camera / input ──────────────────────────────────────────────
  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
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
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 360, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('⚓ Jeju Port (제주 포구)'), {
      fontSize: '14px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 34, '', {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SPACE: enter/talk  M: menu'), {
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
    this.checkWorker();
    this.checkBuildings();
    this.checkExit();
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      return SOLID.has(this.map[row][col]);
    });
  }

  private checkWorker() {
    const wx = this.workerCol * TILE + 16, wy = this.workerRow * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.6 && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.cutsceneActive = true;
      this.dialog.show([
        "Dock Worker: The black-coats unloaded heavy gear an hour ago and marched straight up the vent trail.",
        "Dock Worker: Nobody climbs that fast without a reason. The summit's no place for tourists — mind the lava.",
      ], () => { this.cutsceneActive = false; });
    }
  }

  private checkBuildings() {
    let near: Building | null = null;
    for (const b of BUILDINGS) {
      const dx = this.px - (b.doorCol * TILE + TILE / 2), dy = this.py - ((b.y + b.h - 1) * TILE + TILE / 2);
      if (Math.hypot(dx, dy) < TILE * 1.3) { near = b; break; }
    }
    if (near) {
      this.enterPrompt.setText(`${tr('SPACE — Enter')} ${tr(near.label)}`).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        const b = near;
        if (b.scene === '__SHOP__') { this.registry.set('martReturnScene', this.scene.key); this.registry.set('jejuPortReturnX', b.doorCol * TILE + TILE / 2); this.registry.set('jejuPortReturnY', (b.y + b.h) * TILE + TILE / 2); this.cutsceneActive = true; this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('MartScene')); return; }
        const returnX = b.doorCol * TILE + TILE / 2;
        const returnY = (b.y + b.h) * TILE + TILE / 2;
        this.registry.set('jejuPortReturnX', returnX);
        this.registry.set('jejuPortReturnY', returnY);
        if (b.scene === 'JejuPCScene') {
          this.registry.set('pcReturnScene', 'JejuPortScene');
          this.registry.set('pcReturnX', returnX);
          this.registry.set('pcReturnY', returnY);
        }
        this.cutsceneActive = true;
        this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(b.scene));
      }
    } else this.enterPrompt.setVisible(false);
  }

  private checkExit() {
    if (isSurfing(this.playerG)) return;
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // North → to Jeju City
    if (this.py < 1 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('jejuCityReturnX', 16 * 32 + 16); this.registry.set('jejuCityReturnY', 20 * 32 + 16);
        this.scene.start('JejuCityScene');
      });
      return;
    }
    // South → the ferry.
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      // Before Chapter 9 is done, the only run is the inbound ferry back to Forest City.
      if (!this.registry.get('chapter9Done')) {
        this.cameras.main.fadeOut(400, 0, 0, 0, () => {
          this.registry.set('ferryReturnX', 9 * 32 + 16); this.registry.set('ferryReturnY', 4 * 32 + 16);
          this.scene.start('FerryScene');
        });
        return;
      }
      // Jeju is a detour reached from Haean — the only ferry run is back to Haean City.
      this.dialog.show(['The ferry idles at the pier. Sail back to Haean City on the mainland?'], () => {
        this.dialog.showChoice(
          () => this.sailTo('HaeanCityScene', () => {
            this.registry.set('haeanCityReturnX', 3 * 32); this.registry.set('haeanCityReturnY', 12 * 32);
          }),
          () => { this.py = (ROWS - 2) * TILE; this.cutsceneActive = false; },   // stay
        );
      });
    }
  }

  private sailTo(scene: string, setReturn: () => void) {
    setReturn();
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(scene));
  }

  static healParty(scene: Phaser.Scene) { PartySystem.healAll(scene.registry); }
}
