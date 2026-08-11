import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { PartySystem } from '../systems/PartySystem';
import { markRivalPortrait } from '../data/BattlePortraits';
import { Inventory } from '../systems/Items';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = { ROAD: 0, PATH: 1, BUILDING: 2, PALM: 3, LAMP: 4, SEA: 5, DOCK: 6, SAND: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 30, ROWS = 26;
const COLORS: Record<Tile, number> = {
  [T.ROAD]: 0xb8b0a0, [T.PATH]: 0xd8c89a, [T.BUILDING]: 0xe6dcc6, [T.PALM]: 0x2a7a3a,
  [T.LAMP]: 0x886644, [T.SEA]: 0x2570c0, [T.DOCK]: 0x9a7a4a, [T.SAND]: 0x3a3a44,
};
const SOLID = new Set<Tile>([T.BUILDING, T.PALM, T.LAMP, T.SEA]);

interface Building { label: string; scene: string; x: number; y: number; w: number; h: number; doorCol: number; doorRow: number; roof: number; }
const BUILDINGS: Building[] = [
  { label: 'Pokémon Center', scene: 'HaeanPCScene',   x: 3,  y: 6, w: 6, h: 5, doorCol: 5,  doorRow: 10, roof: 0xcc2244 },
  { label: 'Tidal Arena Gym', scene: 'HaeanGymScene', x: 21, y: 6, w: 6, h: 6, doorCol: 23, doorRow: 11, roof: 0x1a6a9a },
  { label: 'Fish Market',    scene: '__SHOP__',       x: 12, y: 6, w: 6, h: 5, doorCol: 14, doorRow: 10, roof: 0x2a8a6a },
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.ROAD) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };
  fill(0, ROWS, 13, 17, T.PATH);
  fill(11, 15, 2, COLS - 2, T.PATH);
  for (const b of BUILDINGS) { fill(b.y, b.y + b.h, b.x, b.x + b.w, T.BUILDING); m[b.doorRow][b.doorCol] = T.PATH; }
  // Black-sand beach + sea + container docks along the bottom
  fill(20, 22, 2, COLS - 2, T.SAND);
  fill(22, ROWS, 0, COLS, T.SEA);
  fill(19, 23, 9, 11, T.DOCK);   // a pier reaching into the water
  fill(19, 23, 18, 20, T.DOCK);
  // Decorative palms (kept clear of the main path and building door approaches)
  for (const [r,c] of [[17,5],[17,24]] as [number,number][]) m[r][c] = T.PALM;
  return m;
}

export class HaeanCityScene extends Phaser.Scene {
  private map!: Tile[][];
  public buildingPlots = BUILDINGS.map((b, i) => ({ x: b.x, y: b.y, w: b.w, h: b.h, model: ['pokecenter', 'tidalgym', 'mart'][i] }));
  public onlyNamedBuildings = true;
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private surfPrompt?: Phaser.GameObjects.Text;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = 3 * TILE; private py = 12 * TILE;   // west entrance on the main path (NOT the sea)
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private readonly SPEED = 120; private readonly RUN = 250;

  private rivalCol = 15; private rivalRow = 16;   // at the market
  private dosikCol = 10; private dosikRow = 18;   // on the dock

  constructor() { super('HaeanCityScene'); }

  create() {

    playBgm(this, 'haean');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('haeanCityReturnX') as number | undefined;
    const ry = this.registry.get('haeanCityReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('haeanCityReturnX'); this.registry.remove('haeanCityReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawNPCs();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'HaeanCityScene');

    if (!this.registry.get('haeanVisited')) {
      this.registry.set('haeanVisited', true);
      this.time.delayedCall(700, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'You descend into Haean City (해안 시티).',
          'Hillside houses stacked to the ridge, a roaring fish market, a container port, and a black-sand beach.',
          'Gulls wheel over the masts. The Tidal Arena juts out over the harbour.',
        ], () => { this.cutsceneActive = false; });
      });
    } else {
      // CHAPTER 7 (Professor Song's revelation + Rival battle #3) now triggers after
      // the FIFTH badge, from Forest City — see ForestCityScene. Nothing fires here
      // after the Tidekeeper Badge beyond the usual evolution check.
      this.time.delayedCall(300, () => maybeLaunchEvolution(this));
    }
  }

  // ── Map ──────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.PALM) { g.fillStyle(0x1a5c1a); g.fillCircle(c*TILE+16, r*TILE+8, 11); g.fillStyle(0x6a4a28); g.fillRect(c*TILE+13, r*TILE+10, 6, 18); }
      if (t === T.LAMP) { g.fillStyle(0x555); g.fillRect(c*TILE+14, r*TILE+6, 4, 20); g.fillStyle(0xffe488); g.fillCircle(c*TILE+16, r*TILE+5, 5); }
      if (t === T.SEA) { g.fillStyle(0x66bbe6, 0.4); g.fillRect(c*TILE+4, r*TILE+10, 12, 3); g.fillRect(c*TILE+14, r*TILE+22, 10, 3); }
      if (t === T.DOCK) { g.fillStyle(0x7a5a30); g.fillRect(c*TILE+2, r*TILE+2, TILE-4, TILE-4); }
    }
    const key = '__haeanMap__';
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
      bg.fillStyle(0x8b4513); bg.fillRect(dx + 4, dy, TILE - 8, TILE);
      this.add.text((b.x + b.w / 2) * TILE, (b.y - 1.2) * TILE, tr(b.label), {
        fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(3);
    }
    this.add.text(15 * TILE, 25.4 * TILE, tr('🌊 Harbour'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#1a4a8acc', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(2 * TILE, 12.5 * TILE, tr('← Coastal Road'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#2a6a8a99', padding: { x: 3, y: 2 },
    }).setOrigin(0, 0.5).setDepth(5);
    this.add.text((COLS - 0.5) * TILE, 12.5 * TILE, tr('Ancient Forest →'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#2a6a2a99', padding: { x: 3, y: 2 },
    }).setOrigin(1, 0.5).setDepth(5);
  }

  private drawNPCs() {
    // Rival (at the market) — always present in Haean City
    const r = this.add.graphics().setDepth(8);
    r.setPosition(this.rivalCol * TILE + 16, this.rivalRow * TILE + 16);
    r.fillStyle(0x000000, 0.2); r.fillEllipse(0, 13, 16, 5);
    r.fillStyle(0x2255cc); r.fillRect(-7, -8, 14, 11); r.fillRect(-11, -7, 5, 8); r.fillRect(6, -7, 5, 8);
    r.fillStyle(0xffcc99); r.fillRect(-6, -20, 12, 11); r.fillStyle(0x221100); r.fillRect(-6, -20, 12, 5);
    r.fillStyle(0x000000); r.fillRect(-3, -15, 2, 2); r.fillRect(1, -15, 2, 2);
    markRivalPortrait(r, this.registry);
    this.add.text(this.rivalCol * TILE + 16, this.rivalRow * TILE - 10, speakerName('Rival'), {
      fontSize: '8px', color: '#88ccff', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(9);
    // Old Fisherman Dosik (on the dock)
    const d = this.add.graphics().setDepth(8);
    d.setPosition(this.dosikCol * TILE + 16, this.dosikRow * TILE + 16);
    d.fillStyle(0x000000, 0.2); d.fillEllipse(0, 13, 16, 5);
    d.fillStyle(0x6a7a5a); d.fillRect(-7, -8, 14, 12);
    d.fillStyle(0xffcc99); d.fillRect(-6, -20, 12, 11);
    d.fillStyle(0xdddddd); d.fillRect(-6, -20, 12, 4); d.fillStyle(0xeeeeee); d.fillRect(-5, -9, 10, 3);
    d.fillStyle(0x000000); d.fillRect(-3, -15, 2, 2); d.fillRect(1, -15, 2, 2);
    this.add.text(this.dosikCol * TILE + 16, this.dosikRow * TILE - 10, speakerName('Old Dosik'), {
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
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => { if (!this.cutsceneActive && hasBike(this.registry)) { this.cycling = !this.cycling; this.drawChar(); } });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 340, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🏙️ Haean City (해안 시티)'), {
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
    this.checkNPCs();
    this.checkSurf();
    this.checkBuildings();
    this.checkExit();
  }

  /** On the black-sand beach, facing the sea with Surf earned (Tidekeeper Badge), ride out. */
  private checkSurf() {
    if (this.cutsceneActive) { this.surfPrompt?.setVisible(false); return; }
    const row = Math.floor(this.py / TILE);
    const canSurf = !!this.registry.get('haeanGymDefeated') || PartySystem.anyKnows(this.registry, 'Surf');
    const atBeach = row >= 19 && row <= 21 && this.facing === 0;   // on the sand, facing the water
    if (!canSurf || !atBeach) { this.surfPrompt?.setVisible(false); return; }
    if (!this.surfPrompt) {
      this.surfPrompt = this.add.text(this.scale.width / 2, 46, tr('🌊 SPACE — Surf out to sea'), {
        fontSize: '12px', color: '#fff', backgroundColor: '#0a3a5acc', padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(60).setVisible(false);
    }
    this.surfPrompt.setVisible(true);
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.surfPrompt.setVisible(false);
      this.cutsceneActive = true;
      this.registry.set('oceanReturnX', 16 * 32 + 16); this.registry.set('oceanReturnY', 40 * 32 + 16);
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('OceanScene'));
    }
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      return SOLID.has(this.map[row][col]);
    });
  }

  private checkNPCs() {
    // Only consume the SPACE press when actually standing next to an NPC —
    // otherwise it would eat the keypress meant for entering a building.
    const rx = this.rivalCol * TILE + 16, ry = this.rivalRow * TILE + 16;
    const dx0 = this.dosikCol * TILE + 16, dy0 = this.dosikRow * TILE + 16;
    const nearRival = Math.hypot(this.px - rx, this.py - ry) < TILE * 1.6;
    const nearDosik = Math.hypot(this.px - dx0, this.py - dy0) < TILE * 1.6;
    if (!nearRival && !nearDosik) return;
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    if (nearRival) {
      this.cutsceneActive = true;
      // Post-league the 노스단 container hunt is long resolved, so drop the stale
      // "win the Tidal badge" quest hint for a Champion-era line instead.
      const rivalLines = this.registry.get('championDefeated')
        ? [
            "Rival: The Champion, back haggling at the Haean market like old times.",
            "Rival: 노스단, the vents, all of it — we saw it through. Nothing left to chase but a rematch someday.",
          ]
        : [
            "Rival: Haggling for a fresh-caught water Pokémon. The market here is unreal.",
            "Rival: Win the Tidal Arena badge — then we figure out where 노스단 hauled those sealed containers.",
          ];
      this.dialog.show(rivalLines, () => { this.cutsceneActive = false; });
      return;
    }
    if (nearDosik) {
      this.cutsceneActive = true;
      // After the 7th badge (Frostbell), Dosik ferries you to the Jeju vents for the
      // 노스단 / 나비할망 confrontation.
      const offerFerry = () => {
        if (this.registry.get('seoraeGymDefeated')) {
          this.dialog.show([
            "Old Dosik: So the shadow-people struck at the Jeju vents. My ferry's fueled and waiting at the pier.",
            "Sail out to the Jeju vents now?",
          ], () => {
            this.dialog.showChoice(
              () => this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('FerryDepartScene')),
              () => { this.cutsceneActive = false; },
            );
          });
        } else {
          this.dialog.show(["Old Dosik: The sea's been restless lately. Mind yourself out there, child."],
            () => { this.cutsceneActive = false; });
        }
      };
      if (this.registry.get('gotMasterBall')) { offerFerry(); return; }
      this.registry.set('gotMasterBall', true);
      Inventory.add(this.registry, 'masterball', 1);
      this.dialog.show([
        "Old Dosik: You two have been chasing these shadow-people across half the peninsula.",
        "Old Dosik: I'm too old to fight. But my son worked for the League's research division before he passed.",
        "Old Dosik: He left me this — said it could catch anything. Even something that doesn't want to be caught.",
        "🎯 You received a MASTER BALL!",
        "Old Dosik: One of a kind. I've kept it ten years waiting for a reason. You're the reason. Use it when it matters.",
      ], () => { offerFerry(); });
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
        if (b.scene === '__SHOP__') { this.registry.set('martReturnScene', this.scene.key); this.registry.set('haeanCityReturnX', b.doorCol * TILE + TILE / 2); this.registry.set('haeanCityReturnY', (b.y + b.h) * TILE + TILE / 2); this.cutsceneActive = true; this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('MartScene')); return; }
        this.registry.set('haeanCityReturnX', b.doorCol * TILE + TILE / 2);
        this.registry.set('haeanCityReturnY', (b.y + b.h) * TILE + TILE / 2);
        this.cutsceneActive = true;
        this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(b.scene));
      }
    } else this.enterPrompt.setVisible(false);
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // West → Route 4 (Coastal Road)
    if (this.px < 1 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('route4ReturnX', 12 * 32 + 16); this.registry.set('route4ReturnY', 2 * 32);
        this.scene.start('Route4Scene');
      });
      return;
    }
    // East → Route 5 (Ancient Forest → Forest City)
    if (this.px > (COLS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('route5ReturnX', 12 * 32 + 16); this.registry.set('route5ReturnY', 57 * 32 + 16);
        this.scene.start('Route5Scene');
      });
    }
  }

  static healParty(scene: Phaser.Scene) { PartySystem.healAll(scene.registry); }
}
