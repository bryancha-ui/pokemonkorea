import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { PartySystem, baseStatsFromData, recomputeMaxHp, PartyEntry } from '../systems/PartySystem';
import { DexTracker } from '../systems/DexTracker';
import { customForm } from '../data/CustomBattle';
import { installCeladonCityViewer } from '../systems/SketchfabCityViewer';
import type { PropPlot } from '../engine3d/TerrainBuilder';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = { MOSS: 0, PATH: 1, BUILDING: 2, TREE: 3, GLOW: 4, POND: 5, BRIDGE: 6, FLOWER: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 30, ROWS = 26;
const COLORS: Record<Tile, number> = {
  [T.MOSS]: 0x4a7a42, [T.PATH]: 0xb6a878, [T.BUILDING]: 0xdcd2b4, [T.TREE]: 0x143a18,
  [T.GLOW]: 0x4f8654, [T.POND]: 0x2f7acc, [T.BRIDGE]: 0x8a6a44, [T.FLOWER]: 0x568b4d,
};
const SOLID = new Set<Tile>([T.BUILDING, T.TREE, T.POND]);
const FOREST_TREES: Array<[number, number]> = [
  [2,2],[2,7],[2,11],[2,19],[2,24],[2,28],
  [5,2],[5,10],[5,19],[5,28],
  [8,11],[8,19],[16,2],[16,8],[16,22],[16,28],
  [17,5],[17,25],[22,12],[22,20],[23,25],[23,28],
];
const FOREST_GLOW: Array<[number, number]> = [[16,12],[16,18],[19,15],[23,10],[18,23]];
const FOREST_FLOWERS: Array<[number, number]> = [[18,12],[18,18],[15,10],[15,20],[23,16]];

interface Building { label: string; scene: string; x: number; y: number; w: number; h: number; doorCol: number; doorRow: number; roof: number; }
const BUILDINGS: Building[] = [
  { label: 'Pokémon Center',     scene: 'ForestPCScene',   x: 3,  y: 6, w: 6, h: 5, doorCol: 5,  doorRow: 10, roof: 0xcc2244 },
  { label: 'Living Temple Gym',  scene: 'ForestGymScene',  x: 21, y: 6, w: 6, h: 5, doorCol: 23, doorRow: 10, roof: 0x1f6a4a },
  { label: 'Poké Mart',          scene: '__SHOP__',        x: 12, y: 6, w: 6, h: 5, doorCol: 14, doorRow: 10, roof: 0x2a6a9a },
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.MOSS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };
  fill(0, ROWS, 13, 17, T.PATH);
  fill(11, 15, 2, COLS - 2, T.PATH);
  for (const b of BUILDINGS) { fill(b.y, b.y + b.h, b.x, b.x + b.w, T.BUILDING); m[b.doorRow][b.doorCol] = T.PATH; }
  // Forest pond + bridge (lower-left)
  fill(20, 23, 3, 10, T.POND);
  fill(20, 23, 6, 8, T.BRIDGE);
  // Giant trees, glow patches, flowers
  for (const [r,c] of FOREST_TREES) m[r][c] = T.TREE;
  for (const [r,c] of FOREST_GLOW) m[r][c] = T.GLOW;
  for (const [r,c] of FOREST_FLOWERS) m[r][c] = T.FLOWER;
  return m;
}

export class ForestCityScene extends Phaser.Scene {
  private map!: Tile[][];
  public buildingPlots = BUILDINGS.map((b, i) => ({ x: b.x, y: b.y, w: b.w, h: b.h, model: ['pokecenter', 'templegym', 'mart'][i] }));
  public onlyNamedBuildings = true;
  public treeTileIds3D = [T.TREE];
  public flatTileIds3D = [T.MOSS, T.PATH, T.GLOW, T.BRIDGE, T.FLOWER];
  public noRocks3D = true;
  public propPlots: PropPlot[] = [
    ...FOREST_GLOW.map(([r, c], i) => ({ x: c, y: r, kind: 'glowplant' as const, scale: 0.95 + (i % 2) * 0.12, rot: i * 0.7 })),
    ...FOREST_FLOWERS.map(([r, c], i) => ({ x: c, y: r, kind: 'flower' as const, scale: 1 + (i % 2) * 0.1, rot: i * 0.55 })),
    { x: 6.5, y: 21, kind: 'woodbridge', w: 2, d: 3 },
  ];
  // Keep camera sight-lines low while retaining authored 3D trees and scenery.
  public clearSight3D = true;
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
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private readonly SPEED = 120; private readonly RUN = 250;

  private elderCol = 20; private elderRow = 17;

  constructor() { super('ForestCityScene'); }

  create() {

    playBgm(this, 'forest');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('forestCityReturnX') as number | undefined;
    const ry = this.registry.get('forestCityReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('forestCityReturnX'); this.registry.remove('forestCityReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawElder();
    this.createPlayer();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [T.POND], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    // The third-party reference viewer is a development art-comparison aid,
    // not part of the shipped world (and it requires an external iframe).
    if (import.meta.env.DEV) installCeladonCityViewer(this);
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'ForestCityScene');

    // Self-heal: if 나비할망 is already owned but the chapter flag never stuck
    // (a save-timing bug could leave chapter9Done false), close the chapter so the
    // Jeju call below can't loop forever.
    const nabiOwned = this.ownsNabihalmang();
    if (nabiOwned && !this.registry.get('chapter9Done')) this.registry.set('chapter9Done', true);

    if (this.registry.get('forestGymDefeated') && DexTracker.isSeen(this.registry, 'nabihalmang')
        && !nabiOwned && !this.registry.get('chapter9Done')) {
      // RECOVERY (edge case): 나비할망 was met/caught at the vents but was lost — restore her.
      this.grantNabihalmang();
      this.registry.set('chapter9Done', true);
      this.time.delayedCall(600, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          '📟 Your Pokédex chirps — a guardian signal you know well.',
          '나비할망 — the moth grandmother you bonded with at the Jeju vents — sweeps back to your side, her dancheong wings folding gently. She was returned to your team (or your PC box, if your party was full).',
          'Prof. Song (over the Pokédex): There she is. She never truly left you — the bond holds.',
        ], () => { this.cutsceneActive = false; });
      });
    } else if (this.registry.get('forestGymDefeated') && !this.registry.get('chapter7Done')) {
      // CHAPTER 7 — after the Ancient Keeper Badge (the 5th badge), Professor Song calls
      // you back to 소올. You arrive OUTSIDE her lab in Capitol City (not straight into the
      // fight), so you can heal at the Pokémon Center first, then walk into the lab to
      // trigger Rival battle #3. Re-triggers until the chapter is done so a mid-chapter
      // save can't soft-lock.
      this.time.delayedCall(600, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          "Your Pokédex buzzes — it's Professor Song.",
          "Prof. Song: The Ancient Keeper Badge — your fifth. Well done. But drop everything and come back to 소올 (So-ol).",
          "Prof. Song: I've pieced together what Team Suri and 노스단 are really after. You need to hear this in person.",
          "Prof. Song: Heal your team at the Pokémon Center first, then come to my lab — you'll want to be at full strength.",
          "Rival: I'll meet you at the lab. Let's move.",
        ], () => {
          // Arrive in 소올 just south of Professor Song's lab door (col 56 / row 13).
          this.registry.set('capitalReturnX', 56 * 32 + 16);
          this.registry.set('capitalReturnY', 16 * 32 + 16);
          this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('CapitolCityScene'));
        });
      });
    } else if (this.registry.get('forestGymDefeated') && !this.registry.get('forestOnwardHintShown')) {
      // After the Forest gym the road climbs NORTH up Route 6 to Dolmoe (no Jeju detour here).
      this.registry.set('forestOnwardHintShown', true);
      this.time.delayedCall(600, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          "Your Pokédex chirps — Professor Song checking in.",
          "Prof. Song: The Ancient Keeper Badge is yours — well done. The road climbs north from Forest City, up Route 6 to Dolmoe City. Keep pressing on.",
        ], () => { this.cutsceneActive = false; });
      });
    } else if (!this.registry.get('forestVisited')) {
      this.registry.set('forestVisited', true);
      this.time.delayedCall(700, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'You arrive in Forest City (숲 시티).',
          'A city grown INTO the forest — homes nestled between titanic trees, linked by rope bridges.',
          'Bioluminescent plants light the paths with a soft green glow.',
          'The Living Temple gym rises among the roots ahead.',
        ], () => { this.cutsceneActive = false; });
      });
    } else {
      this.time.delayedCall(300, () => maybeLaunchEvolution(this));
    }
  }

  /** Does the player currently own 나비할망 anywhere (party / PC box / dex)? */
  private ownsNabihalmang(): boolean {
    return DexTracker.isCaught(this.registry, 'nabihalmang')
      || PartySystem.get(this.registry).some(e => e.spriteKey === 'nabihalmang')
      || ((this.registry.get('box') as string) ?? '').includes('nabihalmang');
  }

  /** Rebuild 나비할망 from her custom form and return her to the party (or PC box). */
  private grantNabihalmang() {
    const cf = customForm('nabihalmang');
    const entry: PartyEntry = {
      name: 'Nabihalmang', level: 55, hp: 1, maxHp: 1,
      type1: cf?.data.type1 ?? 'steel', type2: cf?.data.type2 ?? 'fairy',
      spriteKey: 'nabihalmang', spriteUrl: cf?.data.spriteUrl ?? 'assets/dex/nabihalmang.jpg',
      isCustom: true,
      moves: (cf?.moves ?? []).map(m => m.name).slice(0, 4),
      ability: 'Shed Skin',
      caughtAt: 'Jeju Volcanic Vent',
      baseStats: cf ? baseStatsFromData(cf.data) : { hp: 106, atk: 106, def: 106, spAtk: 110, spDef: 106, spd: 100 },
      exp: 0,
    };
    entry.maxHp = recomputeMaxHp(entry); entry.hp = entry.maxHp;
    PartySystem.add(this.registry, entry);
    DexTracker.markCaught(this.registry, 'nabihalmang');
    SaveManager.save(this.registry, this.px, this.py, 'ForestCityScene');
  }

  // ── Map ──────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.TREE) { g.fillStyle(0x0c2a10); g.fillTriangle(c*TILE+16, r*TILE-2, c*TILE+0, r*TILE+26, c*TILE+32, r*TILE+26); g.fillStyle(0x4a3420); g.fillRect(c*TILE+13, r*TILE+24, 6, 8); }
      if (t === T.GLOW) { g.fillStyle(0x88ffe0, 0.5); g.fillCircle(c*TILE+10, r*TILE+12, 5); g.fillCircle(c*TILE+22, r*TILE+22, 4); }
      if (t === T.POND) { g.fillStyle(0x66aadd, 0.5); g.fillRect(c*TILE+4, r*TILE+8, 12, 3); g.fillRect(c*TILE+14, r*TILE+18, 10, 3); }
      if (t === T.FLOWER) { g.fillStyle(0xee88cc); g.fillCircle(c*TILE+10, r*TILE+12, 4); g.fillCircle(c*TILE+22, r*TILE+20, 4); }
    }
    const key = '__forestMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    const bg = this.add.graphics().setDepth(2);
    for (const b of BUILDINGS) {
      const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
      bg.fillStyle(0xeee2c6); bg.fillRect(x, y, w, h); bg.lineStyle(2, 0x333); bg.strokeRect(x, y, w, h);
      bg.fillStyle(b.roof); bg.fillTriangle(x - 4, y, x + w / 2, y - TILE, x + w + 4, y);
      bg.lineStyle(2, 0x1a1a12); bg.strokeTriangle(x - 4, y, x + w / 2, y - TILE, x + w + 4, y);   // outline so a green roof isn't lost against the moss
      bg.fillStyle(0x88ccff, 0.7);
      for (let wx = 8; wx < w - 8; wx += 22) bg.fillRect(x + wx, y + 14, 14, 16);
      const dx = b.doorCol * TILE, dy = (b.y + b.h - 1) * TILE;
      bg.fillStyle(0x6b4a28); bg.fillRect(dx + 4, dy, TILE - 8, TILE);
      this.add.text((b.x + b.w / 2) * TILE, (b.y - 1.2) * TILE, tr(b.label), {
        fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(3);
    }
    this.add.text(15 * TILE, 25.4 * TILE, tr('↓ Ancient Forest'), {
      fontSize: '9px', color: '#444', backgroundColor: '#ffffffaa', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(15 * TILE, 0.5 * TILE, tr('↑ Route 6 · Dolmoe City'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawElder() {
    const g = this.add.graphics().setDepth(8);
    g.setPosition(this.elderCol * TILE + 16, this.elderRow * TILE + 16);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(0x3a6a3a); g.fillRect(-7, -8, 14, 13);
    g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
    g.fillStyle(0xdddddd); g.fillRect(-6, -20, 12, 4); g.fillStyle(0xeeeeee); g.fillRect(-5, -9, 10, 4);
    g.fillStyle(0x000000); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2);
    this.add.text(this.elderCol * TILE + 16, this.elderRow * TILE - 10, tr('Forest Elder'), {
      fontSize: '8px', color: '#aef0a0', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
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
    this.add.text(this.scale.width / 2, 22, tr('🌲 Forest City (숲 시티)'), {
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
    this.checkElder();
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

  private checkElder() {
    const wx = this.elderCol * TILE + 16, wy = this.elderRow * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.6 && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.cutsceneActive = true;
      // Once Chapter 9 is complete, the Elder can send you to relive the southern
      // voyage (sets 나비할망 free and restarts Ferry → Port → Climb) — handy for testing.
      if (this.registry.get('chapter9Done')) {
        this.dialog.show([
          'Forest Elder: You wish to walk the southern road once more?',
          'Forest Elder: Then I shall set the Grandmother free again, that she may test a worthy guardian anew.',
          '(The voyage to Jeju restarts — your team sails from Haean once more.)',
        ], () => this.replayChapter9());
      } else {
        this.dialog.show([
          "Forest Elder: The trees whisper of black-coated strangers heading for the eastern coast.",
          "Forest Elder: Keeper Noksaek guards the Living Temple. Earn his seal, and he may share what the roots remember.",
        ], () => { this.cutsceneActive = false; });
      }
    }
  }

  /** Reset Chapter 9 (releases 나비할망, clears voyage flags) and re-board the ferry. */
  private replayChapter9() {
    for (const f of ['chapter9Done', 'jejuSummitSeen', 'jejuSummitReturnSeen', 'nabiCaughtBeat',
      'jejuSeen', 'jejuArrived', 'jejuClimbStarted',
      'jejuPortVisited', 'ferryBoarded', 'ferryStorm', 'ferryRiggingDone']) this.registry.remove(f);
    for (const k of ['ferry-hojun', 'ferry-geumdol', 'jeju-suri-1', 'jeju-suri-2'])
      this.registry.remove('trainerDefeated_' + k);
    // Release 나비할망 from party, box, and the caught dex so the summit re-offers it.
    PartySystem.set(this.registry, PartySystem.get(this.registry).filter(e => e.spriteKey !== 'nabihalmang'));
    PartySystem.setBox(this.registry, PartySystem.getBox(this.registry).filter(e => e.spriteKey !== 'nabihalmang'));
    try {
      const c = JSON.parse((this.registry.get('dexCaught') as string) ?? '[]') as string[];
      this.registry.set('dexCaught', JSON.stringify(c.filter(x => x !== 'nabihalmang')));
    } catch { /* ignore */ }
    this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('FerryScene'));
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
        if (b.scene === '__SHOP__') { this.registry.set('martReturnScene', this.scene.key); this.registry.set('forestCityReturnX', b.doorCol * TILE + TILE / 2); this.registry.set('forestCityReturnY', (b.y + b.h) * TILE + TILE / 2); this.cutsceneActive = true; this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('MartScene')); return; }
        this.registry.set('forestCityReturnX', b.doorCol * TILE + TILE / 2);
        this.registry.set('forestCityReturnY', (b.y + b.h) * TILE + TILE / 2);
        this.cutsceneActive = true;
        this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(b.scene));
      }
    } else this.enterPrompt.setVisible(false);
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    if (this.py > (ROWS - 1) * TILE) {   // south → Route 5 → Haean
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('route5ReturnX', 12 * 32 + 16); this.registry.set('route5ReturnY', 2 * 32);
        this.scene.start('Route5Scene');
      });
    } else if (this.py < 1 * TILE && this.px > 12.5 * TILE && this.px < 16.5 * TILE) {   // north → Route 6 → Dolmoe
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('route6ReturnX', 12 * 32 + 16); this.registry.set('route6ReturnY', 57 * 32);
        this.scene.start('Route6Scene');
      });
    }
  }

  static healParty(scene: Phaser.Scene) { PartySystem.healAll(scene.registry); }
}
