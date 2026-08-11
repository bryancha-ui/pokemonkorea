import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawRiderBody, drawTrainerBody, playerDesign, rivalDesign, rivalTrainerName } from '../data/CharacterSprite';
import { BIKE_SPEED, hasBike, isBikeRiding, setBikeRiding } from '../data/Bike';
import { markRivalPortrait } from '../data/BattlePortraits';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { PartySystem } from '../systems/PartySystem';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = {
  ROCK: 0, PATH: 1, BUILDING: 2, SAND: 3, SEA: 4, CLIFF: 5, LANTERN: 6, LOOKOUT: 7,
  GRASS: 8, LIGHTHOUSE: 9, FLOWER: 10, PIER: 11, TREE: 12, OBSERVATORY: 13, STALL: 14, BOAT: 15,
} as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 40, ROWS = 28;
const COLORS: Record<Tile, number> = {
  [T.ROCK]: 0x5a5058,  [T.PATH]: 0xc9bba4,  [T.BUILDING]: 0xe2d6c4, [T.SAND]: 0x2f2f38,
  [T.SEA]: 0x2a72b8,   [T.CLIFF]: 0x6a5f58, [T.LANTERN]: 0x9a7a4a,  [T.LOOKOUT]: 0xd8a85a,
  [T.GRASS]: 0x4c7a3c, [T.LIGHTHOUSE]: 0xf0efe8, [T.FLOWER]: 0x4c7a3c, [T.PIER]: 0xb98a52,
  [T.TREE]: 0x2c5a2c,  [T.OBSERVATORY]: 0xbfc6d0, [T.STALL]: 0xc08a5a, [T.BOAT]: 0x7a4a2a,
};
const SOLID = new Set<Tile>([T.BUILDING, T.SEA, T.CLIFF, T.LANTERN, T.LIGHTHOUSE, T.TREE, T.OBSERVATORY, T.STALL, T.BOAT]);

interface Building { label: string; scene: string; x: number; y: number; w: number; h: number; doorCol: number; doorRow: number; roof: number; }
const BUILDINGS: Building[] = [
  { label: 'Pokémon Center', scene: 'SunrisePCScene',  x: 3,  y: 7, w: 6,  h: 5, doorCol: 5,  doorRow: 12, roof: 0xcc2244 },
  { label: 'Sunrise Gym',    scene: 'SunriseGymScene', x: 16, y: 6, w: 10, h: 6, doorCol: 20, doorRow: 12, roof: 0xd8a83a },
  { label: 'Poké Mart',      scene: '__SHOP__',        x: 31, y: 7, w: 6,  h: 5, doorCol: 33, doorRow: 12, roof: 0x2a6a9a },
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.ROCK) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };
  const set = (r: number, c: number, t: Tile) => { if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t; };

  // ── North: East Sea + the Sunrise Cliffs lookout deck ──
  fill(0, 1, 0, COLS, T.SEA);
  fill(1, 5, 4, COLS - 4, T.LOOKOUT);
  fill(5, 6, 4, COLS - 4, T.CLIFF);        // cliff edge below the lookout
  // Flanking stairways up to the deck (either side of the Gym), with gaps in the cliff.
  fill(1, 12, 12, 14, T.PATH); fill(5, 6, 12, 14, T.PATH);
  fill(1, 12, 26, 28, T.PATH); fill(5, 6, 26, 28, T.PATH);

  // ── Main streets ──
  fill(12, 15, 2, COLS - 2, T.PATH);       // horizontal boulevard
  fill(15, ROWS, 18, 22, T.PATH);          // south causeway to the Eastern Shore Road

  // ── Buildings ──
  for (const b of BUILDINGS) { fill(b.y, b.y + b.h, b.x, b.x + b.w, T.BUILDING); set(b.doorRow, b.doorCol, T.PATH); }

  // ── South: park, black-sand beach, sea ──
  fill(16, 21, 24, 33, T.GRASS);           // seaside park
  fill(22, 25, 2, COLS - 2, T.SAND);
  fill(25, ROWS, 0, COLS, T.SEA);
  fill(22, ROWS, 18, 22, T.PATH);          // causeway across the beach

  // Park greenery
  for (const [r,c] of [[17,25],[16,31],[18,29],[19,26],[20,31],[17,32]] as [number,number][]) set(r, c, T.TREE);
  for (const [r,c] of [[17,27],[18,32],[19,28],[20,25],[16,28]] as [number,number][]) set(r, c, T.FLOWER);

  // ── Landmarks ──
  fill(1, 5, 3, 5, T.LIGHTHOUSE);          // Lighthouse — west end of the lookout
  fill(1, 4, 33, 36, T.OBSERVATORY);       // Sunrise Observatory dome — east end
  fill(17, 19, 5, 12, T.STALL);            // Fish Market stalls (row of vendor stands)
  fill(22, 27, 8, 10, T.PIER); set(26, 8, T.BOAT); set(26, 9, T.BOAT);   // pier + moored boat

  // Stone lanterns — a pair framing the Gym gate, plus two along the boulevard
  for (const [r,c] of [[12,18],[12,22],[11,9],[11,29]] as [number,number][]) set(r, c, T.LANTERN);

  return m;
}

export class SunriseCityScene extends Phaser.Scene {
  private map!: Tile[][];
  public buildingPlots = [
    ...BUILDINGS.map((b, i) => ({ x: b.x, y: b.y, w: b.w, h: b.h, model: ['pokecenter', 'sunrisegym', 'mart'][i] })),
    { x: 3, y: 1, w: 2, h: 4, model: 'tower' },   // the clifftop lighthouse as a 3D tower
  ];
  public onlyNamedBuildings = true;
  // The clifftop city has tall rock/edge tiles that otherwise extrude into walls
  // that bury the player. caveFloorHint applies the wall-height cap (and dark-
  // floor rule) without switching to cave lighting, so the player stays visible.
  public caveFloorHint = true;
  // Street lamps framing the gym gate + boulevard, and the Fish Market row as 3D
  // vendor stalls (coords mirror the T.LANTERN / T.STALL tiles).
  public propPlots = [
    ...([[18, 12], [22, 12], [9, 11], [29, 11]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'streetlamp' as const })),
    ...([[6, 17], [8, 17], [10, 17]] as [number, number][])
      .map(([x, y]) => ({ x, y, kind: 'stall' as const })),
    // The moored rowboat (naruetbae) at the pier — the T.BOAT tiles (row 26,
    // cols 8-9) render as flat brown ground in 3D, so drop a real 3D boat that
    // spans the 2-wide berth (x 8.5 → world centre 9.0 straddles both cols).
    { x: 8.5, y: 26, kind: 'boat' as const },
  ];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = 19 * TILE + 16; private py = 24 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private readonly SPEED = 120; private readonly RUN = 250;

  private rivalCol = 26; private rivalRow = 14;
  /** The rival waits at Sunrise only until the last gym is cleared, then heads off. */
  private get rivalHere(): boolean { return !this.registry.get('sunriseGymDefeated'); }

  constructor() { super('SunriseCityScene'); }

  create() {
    playBgm(this, 'sunrise');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('sunriseCityReturnX') as number | undefined;
    const ry = this.registry.get('sunriseCityReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('sunriseCityReturnX'); this.registry.remove('sunriseCityReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    if (this.rivalHere) this.drawRival();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'SunriseCityScene');

    if (!this.registry.get('sunriseVisited')) {
      this.registry.set('sunriseVisited', true);
      this.time.delayedCall(700, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'You reach Sunrise City (일출 시티) — the easternmost city, first to greet the dawn.',
          'Volcanic rock, a black-sand beach, and a lighthouse over the East Sea. The great Gym crowns the plaza.',
          `${rivalTrainerName(this.registry)}: The Sunrise Gym is the LAST one. Take this leader down and the League is within reach.`,
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
      const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.SEA) { g.fillStyle(0x66bbe6, 0.4); g.fillRect(x+4, y+10, 12, 3); g.fillRect(x+14, y+22, 10, 3); }
      if (t === T.SAND) { g.fillStyle(0x4a4a52, 0.7); g.fillCircle(x+8, y+10, 2); g.fillStyle(0x1e1e26, 0.7); g.fillCircle(x+22, y+20, 2); }
      if (t === T.PATH) { g.fillStyle(0xb2a48e, 0.5); g.fillRect(x+3, y+6, TILE-6, 3); }
      if (t === T.CLIFF) { g.fillStyle(0x55493f); g.fillTriangle(x+16, y+6, x+4, y+28, x+28, y+28); }
      if (t === T.LOOKOUT) { g.fillStyle(0xffc060, 0.35); g.fillRect(x, y, TILE, 4); g.fillStyle(0xb98a3a, 0.4); g.fillRect(x, y+TILE-3, TILE, 3); }
      if (t === T.GRASS) { g.fillStyle(0x5f9a4a, 0.5); g.fillRect(x+5, y+8, 4, 6); g.fillRect(x+20, y+16, 4, 6); }
      if (t === T.FLOWER) { const cs=[0xff6a9a,0xffffff,0xffdd55,0xd06aff]; for(let i=0;i<4;i++){ g.fillStyle(cs[i%4],1); g.fillCircle(x+8+(i%2)*14, y+9+Math.floor(i/2)*12, 2.4);} }
      if (t === T.TREE) { g.fillStyle(0x1e421e); g.fillCircle(x+16, y+16, 12); g.fillStyle(0x347a34); g.fillCircle(x+12, y+13, 6); g.fillCircle(x+21, y+16, 5); }
      if (t === T.LANTERN) { g.fillStyle(0x777066); g.fillRect(x+12, y+8, 8, 20); g.fillStyle(0xffdd88); g.fillRect(x+10, y+4, 12, 8); g.fillStyle(0xffb84a,0.6); g.fillCircle(x+16, y+8, 5); }
      if (t === T.STALL) { g.fillStyle(0xa0622f); g.fillRect(x+1, y+9, TILE-2, TILE-9); g.fillStyle(0xd84a3a); g.fillRect(x, y+2, TILE, 7); g.fillStyle(0xffd0a0,0.5); g.fillRect(x+2, y+3, TILE-4, 4); g.fillStyle(0x88b8ff,0.6); g.fillCircle(x+8, y+18, 3); g.fillStyle(0xff9a5a,0.7); g.fillCircle(x+22, y+18, 3); }
      if (t === T.PIER) { g.fillStyle(0x9a6a3a); for (let i=0;i<TILE;i+=8) g.fillRect(x, y+i, TILE, 2); g.fillStyle(0x6a4a24); g.fillRect(x+2, y, 3, TILE); g.fillRect(x+TILE-5, y, 3, TILE); }
    }
    // Sunrise glow over the lookout
    g.fillStyle(0xff9a3a, 0.25); g.fillRect(0, 0, COLS * TILE, 5 * TILE);
    const key = '__sunriseMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    // ── Landmark overlays (multi-tile) ──
    const lm = this.add.graphics().setDepth(2);
    // Lighthouse (cols 3-4, rows 1-5)
    { const x = 3 * TILE, y = 1 * TILE, w = 2 * TILE, h = 4 * TILE;
      lm.fillStyle(0xf4f2ec); lm.fillRect(x + 6, y, w - 12, h);
      lm.fillStyle(0xd83a3a); for (let i = 0; i < 4; i++) lm.fillRect(x + 6, y + 6 + i * 18, w - 12, 8);
      lm.fillStyle(0x3a3a44); lm.fillRect(x + 2, y - 12, w - 4, 14);         // lamp housing
      lm.fillStyle(0xffe066, 0.9); lm.fillCircle(x + w / 2, y - 5, 7);       // beacon
      lm.fillStyle(0xffe066, 0.2); lm.fillTriangle(x + w / 2, y - 5, x + w + 30, y - 20, x + w + 30, y + 10); }
    // Observatory dome (cols 33-35, rows 1-4)
    { const x = 33 * TILE, y = 1 * TILE, w = 3 * TILE;
      lm.fillStyle(0xcfd6de); lm.fillRect(x + 4, y + TILE, w - 8, 2 * TILE);
      lm.fillStyle(0xaeb6c2); lm.fillEllipse(x + w / 2, y + TILE, w - 6, TILE * 1.4);
      lm.fillStyle(0x2a2f3a); lm.fillRect(x + w / 2 - 3, y + 4, 6, TILE);    // dome slit
      lm.fillStyle(0xffffff, 0.4); lm.fillEllipse(x + w / 2 - 8, y + TILE - 6, 14, 10); }
    // Moored boat at the pier (row 26, cols 8-9)
    { const x = 8 * TILE, y = 26 * TILE, w = 2 * TILE;
      lm.fillStyle(0x7a4a2a); lm.fillEllipse(x + w / 2, y + 18, w - 4, 20);
      lm.fillStyle(0x9a6a3a); lm.fillRect(x + 6, y + 6, w - 12, 10);
      lm.fillStyle(0xeeeeee); lm.fillTriangle(x + w / 2, y - 12, x + w / 2, y + 8, x + w / 2 + 16, y + 4); }   // sail

    // ── Enterable buildings ──
    const bg = this.add.graphics().setDepth(2);
    for (const b of BUILDINGS) {
      const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
      bg.fillStyle(0xefe4d0); bg.fillRect(x, y, w, h); bg.lineStyle(2, 0x333333); bg.strokeRect(x, y, w, h);
      bg.fillStyle(b.roof); bg.fillTriangle(x - 4, y, x + w / 2, y - TILE, x + w + 4, y);
      bg.fillStyle(0x88ccff, 0.7);
      for (let wx = 8; wx < w - 8; wx += 22) bg.fillRect(x + wx, y + 14, 14, 16);
      const dx = b.doorCol * TILE, dy = (b.y + b.h - 1) * TILE;
      bg.fillStyle(0x6b4a28); bg.fillRect(dx + 4, dy, TILE - 8, TILE);
      // The Gym gets a Poké Ball crest on its gable so it reads as THE gym.
      if (b.scene === 'SunriseGymScene') {
        const cx = x + w / 2, cy = y - TILE + 6;
        bg.fillStyle(0xcc2a2a); bg.fillCircle(cx, cy, 7);            // red ball
        bg.fillStyle(0x222222); bg.fillRect(cx - 7, cy - 1, 14, 3); // black equator band
        bg.fillStyle(0xffffff); bg.fillCircle(cx, cy, 2.4);         // white centre button
        bg.lineStyle(1, 0x222222); bg.strokeCircle(cx, cy, 2.4);
      }
      const isGym = b.scene === 'SunriseGymScene';
      this.add.text((b.x + b.w / 2) * TILE, (b.y - 1.2) * TILE, isGym ? '🏟️ Sunrise Gym — 8th Badge' : tr(b.label), {
        fontSize: isGym ? '10px' : '9px', color: isGym ? '#ffe44e' : '#fff', fontStyle: isGym ? 'bold' : 'normal',
        backgroundColor: '#00000099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(3);
    }

    // Landmark + directional labels
    const label = (col: number, row: number, text: string, color = '#fff', bgc = '#00000099') =>
      this.add.text(col * TILE, row * TILE, text, { fontSize: '9px', color, backgroundColor: bgc, padding: { x: 3, y: 2 } })
        .setOrigin(0.5).setDepth(5);
    label(4, 5.7, '🗼 Lighthouse', '#fff', '#1a3a6a99');
    label(34.5, 4.6, '🔭 Observatory', '#fff', '#1a3a6a99');
    label(8, 16.4, '🐟 Fish Market', '#fff', '#5a3a1a99');
    label(28, 20.6, '🌳 Seaside Park', '#dfffd0', '#1a4a1a99');
    this.add.text(20 * TILE, 2.5 * TILE, tr('⛰ The Sunrise Cliffs'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#aa5a1acc', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(20 * TILE, 27.4 * TILE, tr('↓ Eastern Shore Road'), {
      fontSize: '9px', color: '#444', backgroundColor: '#ffffffaa', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawRival() {
    const g = this.add.graphics().setDepth(8);
    g.setPosition(this.rivalCol * TILE + 16, this.rivalRow * TILE + 16);
    drawTrainerBody(g, 0, 0, rivalDesign(this.registry));
    markRivalPortrait(g, this.registry);
    this.add.text(this.rivalCol * TILE + 16, this.rivalRow * TILE - 12, rivalTrainerName(this.registry), {
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
    this.cameras.main.setZoom(1.5);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
  }
  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => {
      if (this.cutsceneActive || !hasBike(this.registry)) return;
      this.cycling = !this.cycling;
      this.drawChar();
    });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 340, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🌅 Sunrise City (일출 시티)'), {
      fontSize: '14px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 34, '', {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  C: bike  SPACE: enter/talk  M: menu'), {
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
    this.checkCliffTrail();
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

  /** Talk to the Rival: once the last badge + seventh tablet are in hand, set out for
   *  Baekdu Peak (Chapter 11). Otherwise, a simple nudge toward the Gym. */
  private checkRival() {
    if (!this.rivalHere) return;   // rival has left after the final badge
    const dx = this.px - (this.rivalCol * TILE + 16), dy = this.py - (this.rivalRow * TILE + 16);
    if (Math.hypot(dx, dy) > TILE * 1.5) { if (!this.nearBuilding()) this.enterPrompt.setVisible(false); return; }
    this.enterPrompt.setText(`${tr('SPACE: talk to')} ${speakerName(rivalTrainerName(this.registry))}`).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    this.cutsceneActive = true;
    this.enterPrompt.setVisible(false);
    const rn = rivalTrainerName(this.registry);

    // Phase 1 ends at the Onnuri League — no more pre-League flight to Baekdu Peak.
    // (Baekdu / the Cheonji spirit is now a post-League, northern-region destination.)
    if (this.registry.get('sunriseGymDefeated')) {
      this.dialog.show([
        `${rn}: Eight badges — you did it. The Onnuri League is waiting; the Scholars' Road opens from the Capitol now.`,
        `${rn}: Baekdu Peak? That's a story for after we've earned the title. Let's go become Champions first.`,
      ], () => { this.cutsceneActive = false; });
    } else {
      this.dialog.show([
        `${rn}: The Sunrise Gym's right there in the plaza — the last badge before the League.`,
        `${rn}: Take the leader down, then it's straight on to the Onnuri League.`,
      ], () => { this.cutsceneActive = false; });
    }
  }

  /** The cliff lookout is the trailhead — climbing leads up the Sunrise Cliffs. */
  private checkCliffTrail() {
    if (this.cutsceneActive) return;
    if (this.py < 2 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('sunCliff1ReturnX', 12 * 32 + 16); this.registry.set('sunCliff1ReturnY', 41 * 32 + 16);
        this.scene.start('SunriseCliff1Scene');
      });
    }
  }

  private nearBuilding(): boolean {
    for (const b of BUILDINGS) {
      const dx = this.px - (b.doorCol * TILE + TILE / 2), dy = this.py - ((b.y + b.h - 1) * TILE + TILE / 2);
      if (Math.hypot(dx, dy) < TILE * 1.3) return true;
    }
    return false;
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
        if (b.scene === '__SHOP__') { this.registry.set('martReturnScene', this.scene.key); this.registry.set('sunriseCityReturnX', b.doorCol * TILE + TILE / 2); this.registry.set('sunriseCityReturnY', (b.y + b.h) * TILE + TILE / 2); this.cutsceneActive = true; this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('MartScene')); return; }
        this.registry.set('sunriseCityReturnX', b.doorCol * TILE + TILE / 2);
        this.registry.set('sunriseCityReturnY', (b.y + b.h) * TILE + TILE / 2);
        this.cutsceneActive = true;
        this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(b.scene));
      }
    } else if (!this.nearRival()) this.enterPrompt.setVisible(false);
  }

  private nearRival(): boolean {
    return this.rivalHere && Math.hypot(this.px - (this.rivalCol * TILE + 16), this.py - (this.rivalRow * TILE + 16)) <= TILE * 1.5;
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('seoraeReturnX', 11 * 32 + 16); this.registry.set('seoraeReturnY', 2 * 32);
        this.scene.start('SeoraeTownScene');   // back up to Seorae → Dolmoe → Route 6
      });
    }
  }

  static healParty(scene: Phaser.Scene) { PartySystem.healAll(scene.registry); }
}
