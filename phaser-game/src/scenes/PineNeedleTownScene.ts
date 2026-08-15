import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { PartySystem } from '../systems/PartySystem';
import { markRivalPortrait } from '../data/BattlePortraits';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = { GRASS: 0, PATH: 1, BUILDING: 2, ROOF: 3, TREE: 4, LANTERN: 5, POND: 6, FENCE: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 30, ROWS = 26;
const COLORS: Record<Tile, number> = {
  [T.GRASS]: 0x6abf4b, [T.PATH]: 0xd8c89a, [T.BUILDING]: 0xe8d8c0, [T.ROOF]: 0x8a4a3a,
  [T.TREE]: 0x2a6a2a, [T.LANTERN]: 0x9a7a4a, [T.POND]: 0x3a7acc, [T.FENCE]: 0xa08868,
};
const SOLID = new Set<Tile>([T.BUILDING, T.ROOF, T.TREE, T.LANTERN, T.POND, T.FENCE]);

interface Building { label: string; scene: string; x: number; y: number; w: number; h: number; doorCol: number; doorRow: number; roof: number; }
const BUILDINGS: Building[] = [
  { label: 'Pokémon Center & Gallery', scene: 'PineNeedlePCScene', x: 4, y: 6, w: 6, h: 5, doorCol: 6, doorRow: 10, roof: 0xcc2244 },
  { label: "Artist's Studio", scene: 'PineNeedleStudioScene', x: 20, y: 6, w: 5, h: 5, doorCol: 22, doorRow: 10, roof: 0x3a5a8a },
  { label: 'Pokémon Nursery', scene: 'NurseryScene', x: 2, y: 17, w: 7, h: 5, doorCol: 5, doorRow: 21, roof: 0x4f8b58 },
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GRASS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };
  // Main vertical path + horizontal plaza
  fill(0, ROWS, 13, 17, T.PATH);
  fill(12, 16, 2, COLS - 2, T.PATH);
  // Buildings
  for (const b of BUILDINGS) {
    fill(b.y, b.y + b.h, b.x, b.x + b.w, T.BUILDING);
    m[b.doorRow][b.doorCol] = T.PATH;
  }
  // Nursery access lane: it leaves the plaza, bends around the east wall and
  // reaches the wide south-facing entrance without cutting through the house.
  fill(15, 23, 9, 11, T.PATH);
  fill(22, 23, 5, 11, T.PATH);
  // The old southwest pond moves east to make a real building lot.
  fill(19, 23, 25, 29, T.POND);
  for (const [r, c] of [[3,3],[3,26],[8,12],[8,18],[20,23],[23,21],[5,11],[5,19]] as [number,number][]) m[r][c] = T.TREE;
  // Stone lanterns flanking the plaza
  m[11][8] = T.LANTERN; m[11][21] = T.LANTERN;
  // Paper-lantern fence near food stall
  fill(17, 18, 18, 25, T.FENCE);
  return m;
}

export class PineNeedleTownScene extends Phaser.Scene {
  private map!: Tile[][];
  // 3D: Pokémon Center reuses the shared model; the studio and nursery reuse
  // the village's generated hanok-style house GLB. Only these named plots rise.
  public buildingPlots = BUILDINGS.map((b, i) => ({ x: b.x, y: b.y, w: b.w, h: b.h, model: ['pokecenter', 'pinehouse', 'pinehouse'][i] }));
  public onlyNamedBuildings = true;
  // The painted 2D village trees grow as real 3D trees (their flat art is erased
  // from the ground beneath the 3D canopy).
  public treeTileIds3D = [T.TREE];
  // The 떡볶이 (tteokbokki) street stall as a 3D vendor stand.
  public propPlots = [{ x: 21, y: 17, kind: 'stall' as const }];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;

  private px = 15 * TILE; private py = 24 * TILE;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private readonly SPEED = 120; private readonly RUN = 250;

  // Rival at the food stall
  private rivalCol = 21; private rivalRow = 18;

  constructor() { super('PineNeedleTownScene'); }

  create() {

    playBgm(this, 'pineneedle');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('pineReturnX') as number | undefined;
    const ry = this.registry.get('pineReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('pineReturnX'); this.registry.remove('pineReturnY');
    // Grace period so a spawn near an edge can't immediately re-trigger an exit.
    this.spawnGuard = true;
    this.time.delayedCall(600, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawRival();
    this.createPlayer();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [T.POND], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'PineNeedleTownScene');

    // First-visit arrival
    if (!this.registry.get('pineVisited')) {
      this.registry.set('pineVisited', true);
      this.time.delayedCall(700, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'You arrived at Pine Needle Town (솔잎 마을).',
          'A quiet artisan village famous for ink painting and hanji paper-making.',
          'Paper lanterns sway between the houses. The air smells of pine and ink.',
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
      if (t === T.TREE) { g.fillStyle(0x1a5c1a); g.fillTriangle(c*TILE+16, r*TILE+2, c*TILE+3, r*TILE+24, c*TILE+29, r*TILE+24); g.fillStyle(0x4a3020); g.fillRect(c*TILE+13, r*TILE+24, 6, 6); }
      if (t === T.LANTERN) { g.fillStyle(0x777066); g.fillRect(c*TILE+12, r*TILE+6, 8, 20); g.fillStyle(0xffdd88); g.fillRect(c*TILE+11, r*TILE+4, 10, 8); }
      if (t === T.POND) { g.fillStyle(0x66aadd, 0.5); g.fillRect(c*TILE+4, r*TILE+8, 12, 3); }
      if (t === T.FENCE) { g.fillStyle(0xcc4466); g.fillCircle(c*TILE+16, r*TILE+8, 5); } // paper lantern
    }
    const key = '__pineMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    // Buildings (roofs, windows, doors, labels)
    const bg = this.add.graphics().setDepth(2);
    for (const b of BUILDINGS) {
      const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
      bg.fillStyle(0xf0e6d2); bg.fillRect(x, y, w, h); bg.lineStyle(2, 0x333); bg.strokeRect(x, y, w, h);
      bg.fillStyle(b.roof); bg.fillTriangle(x - 4, y, x + w / 2, y - TILE, x + w + 4, y);
      bg.fillStyle(0x88ccff, 0.7);
      for (let wx = 8; wx < w - 8; wx += 22) bg.fillRect(x + wx, y + 14, 14, 16);
      const dx = b.doorCol * TILE, dy = (b.y + b.h - 1) * TILE;
      bg.fillStyle(0x8b4513); bg.fillRect(dx + 4, dy, TILE - 8, TILE);
      this.add.text((b.x + b.w / 2) * TILE, (b.y - 1.2) * TILE, tr(b.label), {
        fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(3);
    }
    // Food stall sign
    this.add.text(21 * TILE, 17 * TILE - 6, tr('🍢 Tteokbokki Stall'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#aa3322cc', padding: { x: 3, y: 2 },
    }).setOrigin(0.5, 1).setDepth(5);
    this.add.text(15 * TILE, 25 * TILE, tr('↓ Route 2'), {
      fontSize: '9px', color: '#444', backgroundColor: '#ffffffaa', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    if (this.registry.get('hasHighlandMap')) {
      this.add.text(15 * TILE, 0.6 * TILE, tr('↑ Seolbong Highland Pass'), {
        fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(5);
    }
  }

  private drawRival() {
    if (this.registry.get('pineRivalTalked')) return;
    const g = this.add.graphics().setDepth(8);
    g.setPosition(this.rivalCol * TILE + 16, this.rivalRow * TILE + 16);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(0x2255cc); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
    g.fillStyle(0x222244); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
    g.fillStyle(0xffcc99); g.fillRect(-6, -22, 12, 12);
    g.fillStyle(0x221100); g.fillRect(-6, -22, 12, 5);
    g.fillStyle(0x000000); g.fillRect(-3, -16, 2, 2); g.fillRect(1, -16, 2, 2);
    markRivalPortrait(g, this.registry);
    this.add.text(this.rivalCol * TILE + 16, this.rivalRow * TILE - 8, speakerName('Rival'), {
      fontSize: '8px', color: '#88ccff', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
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
    this.add.rectangle(this.scale.width / 2, 22, 360, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🏡 Pine Needle Town (솔잎 마을)'), {
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
    const speed = this.cycling ? BIKE_SPEED : (running ? this.RUN : this.SPEED);
    if (moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = this.px + (dx / len) * speed * dt, ny = this.py + (dy / len) * speed * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkRival();
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

  private checkRival() {
    if (this.registry.get('pineRivalTalked')) return;
    const wx = this.rivalCol * TILE + 16, wy = this.rivalRow * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.6 && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.cutsceneActive = true;
      this.registry.set('pineRivalTalked', true);
      this.dialog.show([
        "Rival: Finally. I've been here an hour. Try this — the lady makes it with a doenjang base. Incredible.",
        "Rival: Anyway. Some group has been up in the highland caves to the north — they keep locals away, call it 'research.'",
        "Rival: Research with that many people and that much equipment doesn't look like research to me.",
        "Rival: Professor Song sent me a message too. Something about Pokémon behaving strangely near Baekdu Peak.",
        "Rival: We should check it out after the next gym. Seolbong City — north through the highland pass.",
        "Rival: Oh — there's an artist near the studio looking for her lost Smeargle. You should help her. (Side quest!)",
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
        this.registry.set('pineReturnX', b.doorCol * TILE + TILE / 2);
        this.registry.set('pineReturnY', (b.y + b.h) * TILE + TILE / 2);
        this.cutsceneActive = true;
        this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(b.scene));
      }
    } else this.enterPrompt.setVisible(false);
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    // South → Route 2
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('r2ReturnX', 12 * 32 + 16); this.registry.set('r2ReturnY', 2 * 32);
        this.scene.start('Route2Scene');
      });
    }
    // North → Seolbong Highland Pass (unlocked once the Highland Map is obtained)
    if (this.py < 1 * TILE) {
      if (!this.registry.get('hasHighlandMap')) {
        this.px = 15 * TILE; this.py = 1.2 * TILE;
        if (!this.cutsceneActive) {
          this.cutsceneActive = true;
          this.dialog.show([
            'The path north climbs steeply into snow and cloud.',
            "You don't know the way yet — better find a guide or a map first.",
          ], () => { this.cutsceneActive = false; });
        }
        return;
      }
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('baekduPassReturnX', 12 * 32 + 16);
        this.registry.set('baekduPassReturnY', 57 * 32 + 16);
        this.scene.start('BaekduPassScene');
      });
    }
  }

  // expose for PC heal scene
  static healParty(scene: Phaser.Scene) { PartySystem.healAll(scene.registry); }
}
