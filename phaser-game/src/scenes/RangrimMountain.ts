import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { vanishesAfterDefeat } from '../data/Villains';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';

// ── Onseong Range (온성산맥) — a five-map mountain ─────────────────────────────────
// Onnuri's Mt. Coronet, climbed as FIVE stacked, connected maps between Binghagwan
// (foot) and Samho (peak): rocky foothills → a pitch-dark lower cavern → the mystic
// Altar Hall at its heart → a windswept snowfield → the summit. Each map's north edge
// opens onto the next map's south edge, so the whole spine reads as one ascent.

const T = { GROUND: 0, PATH: 1, ROCK: 2, CAVE: 3, BOULDER: 4, LEDGE: 5, SNOW: 6, TALLGRASS: 7, STREAM: 8 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 28, MIDCOL = 11;
const COLORS: Record<Tile, number> = {
  [T.GROUND]: 0x6b6455, [T.PATH]: 0xc2b592, [T.ROCK]: 0x4f4940, [T.CAVE]: 0x3d3a4a,
  [T.BOULDER]: 0x6f665a, [T.LEDGE]: 0x8a7a58, [T.SNOW]: 0xe8eef2, [T.TALLGRASS]: 0x3f7a35, [T.STREAM]: 0x66b0e0,
};
const SOLID = new Set<Tile>([T.ROCK, T.BOULDER, T.STREAM, T.LEDGE]);

interface Trainer { key: string; name: string; col: number; row: number; color: number; label: string; line: string; pokemon: string; expPool: number; }
interface RgExit { scene: string; returnKey: string; x: number; y: number }
/** A hidden passage revealed by interacting (SPACE) with a fixed tile, e.g. the Ancient Altar. */
interface RgSecret extends RgExit { col: number; row: number; prompt: string; lines: string[] }
interface RgConfig {
  key: string; returnKey: string; title: string; bgm: string;
  southLabel: string; northLabel: string; westLabel?: string;
  enc: EncounterEntry[]; encTiles: Tile[]; trainers: Trainer[];
  prev: RgExit; next: RgExit; west?: RgExit; secret?: RgSecret; statue?: RgSecret;
  build: () => Tile[][]; darkCave?: boolean; decorate?: (s: RangrimBaseScene) => void;
}

const team = (...t: [number, number][]) => JSON.stringify(t.map(([id, level]) => ({ id, level })));
const grid = (): { m: Tile[][]; fill: (r1: number, r2: number, c1: number, c2: number, t: Tile) => void } => {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GROUND) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  return { m, fill };
};

// ── Base scene: movement, drawing, encounters, exits — driven by an RgConfig ──────
export class RangrimBaseScene extends Phaser.Scene {
  protected cfg!: RgConfig;
  public get grassTileIds3D(): number[] {
    return this.cfg.encTiles.includes(T.TALLGRASS) ? [T.TALLGRASS] : [];
  }
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = MIDCOL * TILE + 16; private py = (ROWS - 3) * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false; private spawnPx = 0; private spawnPy = 0;
  private steps = 0; private nextEnc = 10;
  private encTiles!: Set<Tile>;
  private secretPrompt?: Phaser.GameObjects.Text;
  private statuePrompt?: Phaser.GameObjects.Text;
  private readonly SPEED = 120; private readonly RUN = 250;

  constructor(cfg: RgConfig) { super(cfg.key); this.cfg = cfg; }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    this.encTiles = new Set(this.cfg.encTiles);
    playBgm(this, this.cfg.bgm);
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get(this.cfg.returnKey + 'ReturnX') as number | undefined;
    const ry = this.registry.get(this.cfg.returnKey + 'ReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    else { this.px = MIDCOL * TILE + 16; this.py = (ROWS - 3) * TILE + 16; }
    this.registry.remove(this.cfg.returnKey + 'ReturnX'); this.registry.remove(this.cfg.returnKey + 'ReturnY');

    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = this.cfg.build();
    this.drawMap();
    if (this.cfg.darkCave) this.drawDarkness();
    this.cfg.decorate?.(this);
    this.drawTrainers();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, this.cfg.key);
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  /** Exposed for decorate() hooks. */
  label(text: string, col: number, row: number, color = '#ffe9c0'): void {
    this.add.text(col * TILE + 16, row * TILE + 16, text, { fontSize: '8px', color, align: 'center', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(7);
  }
  glow(col: number, row: number, color: number): void {
    const g = this.add.graphics().setDepth(6);
    const x = col * TILE + 16, y = row * TILE + 16;
    g.fillStyle(0x1a1626, 0.6); g.fillEllipse(x, y + 12, 46, 14);
    g.fillStyle(0x4a4460); g.fillRect(x - 16, y - 4, 32, 16);
    g.fillStyle(0x6a6488); g.fillRect(x - 10, y - 22, 20, 20);
    g.fillStyle(color, 0.9); g.fillCircle(x, y - 14, 6);
    this.tweens.add({ targets: g, alpha: { from: 1, to: 0.55 }, duration: 1100, yoyo: true, repeat: -1 });
  }

  private drawDarkness() {
    const d = this.add.graphics().setDepth(15);
    d.fillStyle(0x05060c, 0.28); d.fillRect(0, 0, COLS * TILE, ROWS * TILE);   // dim, not pitch-black — the cavern must stay readable
  }

  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.GROUND) { g.fillStyle(0x585444, 0.5); g.fillRect(x + 6, y + 8, 4, 3); g.fillRect(x + 18, y + 20, 5, 3); }
      if (t === T.PATH) { g.fillStyle(0xa89a76, 0.6); g.fillRect(x + 5, y + 10, 5, 3); g.fillRect(x + 18, y + 20, 5, 3); }
      if (t === T.ROCK) { g.fillStyle(0x413c34); g.fillRect(x + 3, y + 4, 10, 10); g.fillRect(x + 16, y + 15, 11, 11); g.fillStyle(0x6a6356, 0.5); g.fillRect(x + 4, y + 5, 4, 3); }
      // Keep the cave floor lightness above the 0.18 cave-floor threshold so the 3D
      // mirror flattens it (caveFloorHint) instead of extruding the whole dark floor
      // into a field of tall black tiles that bury the player.
      if (t === T.CAVE) { g.fillStyle(0x000000, 0.1); g.fillRect(x, y, TILE, TILE); g.fillStyle(0x565270, 0.5); g.fillRect(x + 7, y + 9, 5, 4); g.fillRect(x + 19, y + 22, 4, 3); }
      if (t === T.BOULDER) { g.fillStyle(0x554d42); g.fillEllipse(x + 16, y + 18, 26, 22); g.fillStyle(0x7a7060, 0.6); g.fillEllipse(x + 12, y + 13, 9, 7); }
      if (t === T.LEDGE) { g.fillStyle(0x6a5c3e); g.fillRect(x, y + 20, TILE, 12); g.fillStyle(0x3a2f1a); g.fillRect(x, y + 30, TILE, 2); g.fillStyle(0xbfae82); g.fillTriangle(x + 12, y + 24, x + 20, y + 24, x + 16, y + 30); }
      if (t === T.SNOW) { g.fillStyle(0xffffff, 0.7); g.fillCircle(x + 9, y + 11, 3); g.fillCircle(x + 21, y + 22, 3); g.fillStyle(0xcdd8e0, 0.5); g.fillRect(x, y + 26, TILE, 6); }
      if (t === T.TALLGRASS) { g.fillStyle(0x2c6a22, 0.8); for (let i = 0; i < 3; i++) { g.fillRect(x + 5 + i * 8, y + 16, 2, 12); g.fillRect(x + 7 + i * 8, y + 12, 2, 16); } }
      if (t === T.STREAM) { g.fillStyle(0xbfe6ff, 0.6); g.fillRect(x + 6, y, 6, TILE); g.fillStyle(0xffffff, 0.4); g.fillRect(x + 14, y, 3, TILE); }
    }
    const key = '__rg_' + this.cfg.key + '__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(MIDCOL * TILE + 16, (ROWS - 0.6) * TILE, this.cfg.southLabel, { fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
    this.add.text(MIDCOL * TILE + 16, 0.6 * TILE, this.cfg.northLabel, { fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
    if (this.cfg.westLabel) {
      this.add.text(0.6 * TILE, MIDCOL * TILE + 16, this.cfg.westLabel, { fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0, 0.5).setDepth(5);
    }
  }

  private drawTrainers() {
    for (const tr of this.cfg.trainers) {
      if (this.registry.get(`trainerDefeated_${tr.key}`) && vanishesAfterDefeat(tr.key)) continue;
      const g = this.add.graphics().setDepth(8);
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(tr.color); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x1a1a2e); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -22, 12, 12);
      g.fillStyle(0x3a2410); g.fillRect(-6, -22, 12, 5);
      g.fillStyle(0x000000); g.fillRect(-3, -16, 2, 2); g.fillRect(1, -16, 2, 2);
      this.add.text(tr.col * TILE + 16, tr.row * TILE - 14, speakerName(tr.label), { fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 }, align: 'center' }).setOrigin(0.5).setDepth(9);
    }
  }

  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    (this.cycling ? drawRiderBody : drawTrainerBody)(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }
  private setupCamera() {
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.setZoom(1.7);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
  }
  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C).on('down', () => { if (!this.cutsceneActive && hasBike(this.registry)) { this.cycling = !this.cycling; this.drawChar(); } });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 460, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, this.cfg.title, { fontSize: '14px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  C: bike  SPACE: talk  M: menu'), { fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 } }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
    if (this.cfg.secret) {
      this.secretPrompt = this.add.text(this.scale.width / 2, this.scale.height - 34, '', {
        fontSize: '13px', color: '#cabaff', backgroundColor: '#00000099', padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    }
    if (this.cfg.statue) {
      this.statuePrompt = this.add.text(this.scale.width / 2, this.scale.height - 34, '', {
        fontSize: '13px', color: '#cabaff', backgroundColor: '#00000099', padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    }
  }

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
      if (!this.collides(this.px, ny) || (dy > 0 && this.ledgeBelow(this.px, ny))) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; this.steps++; this.checkEncounter(); }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkTrainers();
    this.checkAltar();
    this.checkStatue();
    this.checkExits();
  }

  /** Interact with the Ancient Altar (SPACE) to open the hidden stair to Sacred Peak (Hwanwoong). */
  private checkAltar() {
    const s = this.cfg.secret;
    if (!s || !this.secretPrompt) return;
    const wx = s.col * TILE + 16, wy = s.row * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) > TILE * 1.6) { this.secretPrompt.setVisible(false); return; }
    this.secretPrompt.setText(s.prompt).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    this.secretPrompt.setVisible(false);
    
    // Check if northern league is completed before allowing access
    if (!this.registry.get('northLeagueDone')) {
      this.cutsceneActive = true;
      this.dialog.show([
        'You lay your hand on the 고대 제단 (Ancient Altar). The stone is ice-cold, but it does not respond.',
        'A voice echoes from the stone: "Only those who have proven themselves in the Northern League may ascend. Return after you have conquered the north."',
      ], () => { this.cutsceneActive = false; });
      return;
    }
    
    // The Sudo City victory celebration plays automatically on returning to the Capitol
    // after the Northern League, so the altar no longer hard-gates on it — clearing the
    // Northern League is enough to ascend to the Sacred Peak.
    // After the league, the altar leads to Sacred Peak (Hwanwoong)
    this.cutsceneActive = true;
    this.dialog.show([
      '노스단 has sealed every pass up the Onseong Mountains — but they never knew about this.',
      'You lay your hand on the 고대 제단 (Ancient Altar). The stone hums with divine energy, and it responds to your presence.',
      'The hidden stair opens — a shortcut straight past the blockade to the Sacred Peak, where 환웅 (Hwanung) awaits...',
    ], () => {
      this.cameras.main.fadeOut(500, 0, 0, 0, () => {
        this.registry.set('sacredPeakReturnX', 9 * 32 + 16);
        this.registry.set('sacredPeakReturnY', 37 * 32 + 16);
        this.scene.start('SacredPeakScene');
      });
    });
  }

  /** Interact with the Statue (SPACE) to open the hidden stair to Cheonji (crater lake). */
  private checkStatue() {
    const s = this.cfg.statue;
    if (!s || !this.statuePrompt) return;
    const wx = s.col * TILE + 16, wy = s.row * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) > TILE * 1.6) { this.statuePrompt.setVisible(false); return; }
    this.statuePrompt.setText(s.prompt).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    this.statuePrompt.setVisible(false);
    
    // Check if northern league is completed before allowing access
    if (!this.registry.get('northLeagueDone')) {
      this.cutsceneActive = true;
      this.dialog.show([
        'You lay your hand on the ancient statue. The stone is ice-cold, but it does not respond.',
        'A voice echoes from the stone: "Only those who have proven themselves in the Northern League may descend. Return after you have conquered the north."',
      ], () => { this.cutsceneActive = false; });
      return;
    }
    
    // After northern league completion, statue leads to Cheonji
    this.cutsceneActive = true;
    this.dialog.show(s.lines, () => {
      this.cameras.main.fadeOut(500, 0, 0, 0, () => {
        this.registry.set(s.returnKey + 'ReturnX', s.x); this.registry.set(s.returnKey + 'ReturnY', s.y);
        this.scene.start(s.scene);
      });
    });
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      return SOLID.has(this.map[row][col]);
    });
  }
  private ledgeBelow(x: number, y: number): boolean {
    return this.map[Math.floor((y + 8) / TILE)]?.[Math.floor(x / TILE)] === T.LEDGE;
  }

  private checkEncounter() {
    const t = this.map[Math.floor(this.py / TILE)]?.[Math.floor(this.px / TILE)];
    if (t === undefined || !this.encTiles.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.22) return;
    this.steps = 0; this.nextEnc = 8 + Math.floor(Math.random() * 8);
    const e = pickEncounter(this.cfg.enc);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', this.cfg.key);
    this.registry.set(this.cfg.returnKey + 'ReturnX', this.px); this.registry.set(this.cfg.returnKey + 'ReturnY', this.py);
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('WildBattleScene'));
  }

  private checkTrainers() {
    for (const tr of this.cfg.trainers) {
      if (this.registry.get(`trainerDefeated_${tr.key}`)) continue;
      if (Math.hypot(this.px - (tr.col * TILE + 16), this.py - (tr.row * TILE + 16)) < TILE * 1.5) {
        this.cutsceneActive = true;
        this.registry.set('trainerName', tr.name);
        this.registry.set('trainerKey', tr.key);
        this.registry.set('trainerPokemon', tr.pokemon);
        this.registry.set('trainerExpPool', tr.expPool);
        this.registry.set('trainerReturnScene', this.cfg.key);
        this.registry.set(this.cfg.returnKey + 'ReturnX', this.px); this.registry.set(this.cfg.returnKey + 'ReturnY', this.py);
        this.dialog.show([tr.line, `${tr.name}: Let's battle!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private go(e: RgExit) {
    this.cutsceneActive = true;
    this.cameras.main.fadeOut(400, 0, 0, 0, () => {
      this.registry.set(e.returnKey + 'ReturnX', e.x); this.registry.set(e.returnKey + 'ReturnY', e.y);
      this.scene.start(e.scene);
    });
  }
  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    const nc = this.px > (MIDCOL - 4) * TILE && this.px < (MIDCOL + 4) * TILE;
    if (this.py > (ROWS - 1) * TILE && nc) this.go(this.cfg.prev);
    else if (this.py < 1 * TILE && nc) this.go(this.cfg.next);
    else if (this.cfg.west && this.px < 1 * TILE && this.py > 8 * TILE && this.py < 20 * TILE) this.go(this.cfg.west);
  }
}

// ── Shared spawn coords for the internal seams (south end / north end of a map) ──
const SOUTH_END = { x: MIDCOL * TILE + 16, y: (ROWS - 3) * TILE + 16 };
const NORTH_END = { x: MIDCOL * TILE + 16, y: 3 * TILE + 16 };
const rgExit = (scene: string, returnKey: string, end: { x: number; y: number }): RgExit => ({ scene, returnKey, ...end });

// ── Map builders ──────────────────────────────────────────────────────────────
function foothills(): Tile[][] {
  const { m, fill } = grid();
  fill(0, ROWS, 10, 14, T.PATH);
  fill(0, ROWS, 0, 3, T.ROCK); fill(0, ROWS, 21, COLS, T.ROCK);
  fill(0, 3, 4, 7, T.ROCK); fill(0, 3, 18, 20, T.ROCK);   // rocky face pulled back from the cave mouth
  fill(0, 4, 7, 18, T.CAVE);                               // wide walkable cave mouth = clear north exit
  fill(9, 15, 4, 9, T.TALLGRASS); fill(16, 22, 14, 20, T.TALLGRASS);
  fill(6, 21, 18, 19, T.STREAM);                           // a torrent tumbling down the east flank
  for (const [r, c] of [[7, 6], [13, 16], [20, 6], [11, 17]] as [number, number][]) m[r][c] = T.ROCK;
  for (const [r, c] of [[17, 6], [10, 15]] as [number, number][]) m[r][c] = T.BOULDER;
  return m;
}
function cavern(): Tile[][] {
  const { m, fill } = grid();
  fill(0, ROWS, 3, 21, T.CAVE);                            // dark hall, full height
  fill(0, ROWS, 0, 3, T.ROCK); fill(0, ROWS, 21, COLS, T.ROCK);
  fill(9, 20, 3, 4, T.STREAM);                             // an underground waterfall
  for (const [r, c] of [[6, 6], [7, 7], [10, 16], [11, 17], [15, 6], [16, 7], [18, 16], [19, 17], [21, 6], [8, 17]] as [number, number][]) m[r][c] = T.BOULDER;
  return m;
}
function altar(): Tile[][] {
  const { m, fill } = grid();
  fill(0, ROWS, 3, 21, T.CAVE);
  fill(0, ROWS, 0, 3, T.ROCK); fill(0, ROWS, 21, COLS, T.ROCK);
  fill(11, 16, 8, 16, T.ROCK); fill(12, 15, 9, 15, T.CAVE);   // the raised altar dais (rock rim, hollow centre)
  fill(13, 18, 11, 13, T.PATH);                              // aisle south from the hall, opening the rim onto the altar
  for (const [r, c] of [[6, 7], [7, 16], [20, 7], [21, 16], [9, 5], [22, 18]] as [number, number][]) m[r][c] = T.BOULDER;
  // Add statue platform at row 9
  fill(8, 10, 10, 14, T.ROCK);
  fill(9, 10, 11, 13, T.CAVE); // statue location
  return m;
}
function snowfield(): Tile[][] {
  const { m, fill } = grid();
  fill(0, ROWS, 0, COLS, T.SNOW);
  fill(0, ROWS, 0, 3, T.ROCK); fill(0, ROWS, 21, COLS, T.ROCK);
  for (const [r, c] of [[5, 6], [8, 17], [14, 6], [18, 16], [22, 7], [11, 18], [3, 15]] as [number, number][]) m[r][c] = T.ROCK;
  for (const c of [15, 16, 17]) m[13][c] = T.LEDGE;         // a one-way cornice you can drop but not climb
  for (const c of [6, 7, 8]) m[20][c] = T.LEDGE;
  return m;
}
function summit(): Tile[][] {
  const { m, fill } = grid();
  fill(0, ROWS, 0, COLS, T.SNOW);
  fill(0, ROWS, 0, 3, T.ROCK); fill(0, ROWS, 21, COLS, T.ROCK);
  fill(0, 4, 4, 9, T.ROCK); fill(0, 4, 15, 20, T.ROCK);     // the peak's crown of rock, framing the pass out
  for (const [r, c] of [[8, 6], [10, 17], [16, 7], [19, 16], [22, 6], [6, 16]] as [number, number][]) m[r][c] = T.ROCK;
  return m;
}

// ── The five connected maps (south = Binghagwan foot, north = Samho peak) ─────────
const FOOTHILLS: RgConfig = {
  key: 'RangrimFoothillsScene', returnKey: 'rgFoot', title: '⛰ 온성산 기슭 (Onseong Foothills)', bgm: 'rangrimfoothills',
  southLabel: '↓ Binghagwan', northLabel: '↑ 하부 동굴 (Lower Cavern)',
  encTiles: [T.TALLGRASS], enc: [
    { id: 75, weight: 14, minLevel: 73, maxLevel: 74, isCustom: false, catchRate: 120 },
    { id: 67, weight: 12, minLevel: 73, maxLevel: 74, isCustom: false, catchRate: 90 },
    { id: 42, weight: 12, minLevel: 73, maxLevel: 74, isCustom: false, catchRate: 120 },
    { id: 436, weight: 10, minLevel: 73, maxLevel: 74, isCustom: false, catchRate: 90 },
    { id: 217, weight: 9, minLevel: 73, maxLevel: 74, isCustom: false, catchRate: 90 },
    { id: 359, weight: 4, minLevel: 74, maxLevel: 75, isCustom: false, catchRate: 60 },
  ],
  trainers: [
    { key: 'rg-daljae', name: 'Hiker Daljae', col: 6, row: 13, color: 0x8a6a3a, label: 'Hiker', line: "Forty years I've climbed the Onseong spine. The mountain keeps its counsel — and so do my Pokémon!", pokemon: team([75, 73], [42, 73], [76, 74]), expPool: 2600 },
    { key: 'rg-boksun', name: 'Camper Boksun', col: 16, row: 18, color: 0x6a8a3a, label: 'Camper', line: "Base camp's just here. The wild things get bolder the higher you climb — better toughen up now!", pokemon: team([217, 73], [67, 74]), expPool: 2400 },
  ],
  prev: rgExit('SinuijuCityScene', 'SinuijuCityScene', { x: 13.5 * 32, y: 2 * 32 + 16 }),
  next: rgExit('RangrimCavernScene', 'rgCave', SOUTH_END),
  build: foothills,
  decorate: (s) => s.label('▲ 동굴 입구 (cave mouth)', MIDCOL, 4),
};
const CAVERN: RgConfig = {
  key: 'RangrimCavernScene', returnKey: 'rgCave', title: '⛰ 온성 하부 동굴 (Lower Cavern)', bgm: 'rangrimcavern',
  southLabel: '↓ 기슭 (Foothills)', northLabel: '↑ 제단의 방 (Altar Hall)',
  encTiles: [T.CAVE], enc: [
    { id: 42, weight: 15, minLevel: 73, maxLevel: 75, isCustom: false, catchRate: 120 },
    { id: 75, weight: 12, minLevel: 73, maxLevel: 75, isCustom: false, catchRate: 120 },
    { id: 67, weight: 11, minLevel: 73, maxLevel: 75, isCustom: false, catchRate: 90 },
    { id: 436, weight: 11, minLevel: 73, maxLevel: 75, isCustom: false, catchRate: 90 },
    { id: 527, weight: 10, minLevel: 73, maxLevel: 75, isCustom: false, catchRate: 120 },
    { id: 35, weight: 9, minLevel: 73, maxLevel: 75, isCustom: false, catchRate: 120 },
    { id: 359, weight: 4, minLevel: 74, maxLevel: 76, isCustom: false, catchRate: 60 },
  ],
  trainers: [
    { key: 'rg-museon', name: 'Black Belt Museon', col: 14, row: 16, color: 0x6a3a2a, label: 'Black\nBelt', line: "In the dark you fight by sound and instinct. My fists have never needed the light. Come!", pokemon: team([67, 73], [308, 74], [68, 75]), expPool: 2700 },
    { key: 'rg-cheol', name: 'Hiker Cheol', col: 7, row: 9, color: 0x8a6a3a, label: 'Hiker', line: "Careful of the drop by the falls. Lost a good pack down there once. Battle me while you're here!", pokemon: team([75, 74], [476, 74]), expPool: 2600 },
  ],
  prev: rgExit('RangrimFoothillsScene', 'rgFoot', NORTH_END),
  next: rgExit('RangrimAltarScene', 'rgAltar', SOUTH_END),
  build: cavern,
  decorate: (s) => { const wf = s.add.graphics().setDepth(6); wf.fillStyle(0xffffff, 0.5); wf.fillEllipse(3.5 * 32, 19.5 * 32, 24, 10); s.label('폭포', 4, 20, '#eaffff'); },
};
const ALTAR: RgConfig = {
  key: 'RangrimAltarScene', returnKey: 'rgAltar', title: '⛰ 온성 제단의 방 (Altar Hall)', bgm: 'sacredpeak', darkCave: true,
  southLabel: '↓ 하부 동굴 (Cavern)', northLabel: '↑ 설원 능선 (Snow Ridge)',
  encTiles: [T.CAVE], enc: [
    { id: 35, weight: 14, minLevel: 74, maxLevel: 75, isCustom: false, catchRate: 120 },
    { id: 437, weight: 10, minLevel: 74, maxLevel: 75, isCustom: false, catchRate: 90 },
    { id: 308, weight: 10, minLevel: 74, maxLevel: 75, isCustom: false, catchRate: 90 },
    { id: 302, weight: 9, minLevel: 74, maxLevel: 75, isCustom: false, catchRate: 120 },
    { id: 358, weight: 8, minLevel: 74, maxLevel: 75, isCustom: false, catchRate: 90 },
    { id: 359, weight: 6, minLevel: 74, maxLevel: 76, isCustom: false, catchRate: 60 },
  ],
  trainers: [
    { key: 'rg-hakryun', name: 'Ace Trainer Hakryun', col: 6, row: 9, color: 0x3a5a9a, label: 'Ace\nTrainer', line: "They say the altar chose this mountain, not the other way round. Prove your spirit before it!", pokemon: team([437, 74], [36, 75]), expPool: 2800 },
    { key: 'rg-myoja', name: 'Psychic Myoja', col: 17, row: 10, color: 0x7a3a8a, label: 'Psychic', line: "The stone hums to those who listen. My Pokémon and I have listened a long, long time.", pokemon: team([308, 74], [358, 74], [437, 75]), expPool: 2800 },
  ],
  prev: rgExit('RangrimCavernScene', 'rgCave', NORTH_END),
  next: rgExit('RangrimSnowfieldScene', 'rgSnow', SOUTH_END),
  // No direct walk-out to Baekdu Peak — the peak is reached only through the
  // Ancient Altar ritual below.
  // Interacting with the Ancient Altar (aisle at row 13) opens a hidden stair to Sacred Peak (Hwanwoong).
  secret: {
    scene: 'SacredPeakScene', returnKey: 'sacredPeak', x: 9 * 32 + 16, y: 37 * 32 + 16,
    col: 11, row: 13, prompt: 'SPACE — Touch the Ancient Altar',
    lines: [
      'You lay your hand on the 고대 제단 (Ancient Altar). The stone hums with divine energy, and it responds to your presence.',
      'The path to the Sacred Peak opens before you, where 환웅 (Hwanung) awaits...',
    ],
  },
  // Interacting with the statue (aisle at row 9) opens a hidden stair to Cheonji (crater lake).
  statue: {
    scene: 'CheonjiScene', returnKey: 'cheonji', x: 10 * 32 + 16, y: 19 * 32 + 16,
    col: 11, row: 9, prompt: 'SPACE — Touch the Statue',
    lines: [
      'You lay your hand on the ancient statue. The stone is ice-cold, and it hums — a deep, charged note that answers from somewhere far below.',
      'With a grinding of rock, the base splits, revealing a hidden stair winding down toward 천지 (Cheonji), the sacred crater lake...',
    ],
  },
  build: altar,
  decorate: (s) => { 
    s.glow(11, 13, 0x9a8ce0); 
    s.label('고대 제단 (Ancient Altar)', 11, 11, '#cabaff');
    s.glow(11, 9, 0x8ac8e0); 
    s.label('고대 조각상 (Ancient Statue)', 11, 7, '#a8d0f0');
  },
};
const SNOWFIELD: RgConfig = {
  key: 'RangrimSnowfieldScene', returnKey: 'rgSnow', title: '⛰ 온성 설원 능선 (Snow Ridge)', bgm: 'rangrimsnow',
  southLabel: '↓ 제단의 방 (Altar Hall)', northLabel: '↑ 정상 (Summit)',
  encTiles: [T.SNOW], enc: [
    { id: 461, weight: 13, minLevel: 74, maxLevel: 76, isCustom: false, catchRate: 90 },
    { id: 362, weight: 11, minLevel: 74, maxLevel: 76, isCustom: false, catchRate: 90 },
    { id: 221, weight: 12, minLevel: 74, maxLevel: 76, isCustom: false, catchRate: 90 },
    { id: 459, weight: 11, minLevel: 74, maxLevel: 76, isCustom: false, catchRate: 120 },
    { id: 215, weight: 10, minLevel: 74, maxLevel: 76, isCustom: false, catchRate: 120 },
    { id: 473, weight: 6, minLevel: 75, maxLevel: 77, isCustom: false, catchRate: 60 },
  ],
  trainers: [
    { key: 'rg-seolla', name: 'Veteran Seolla', col: 7, row: 15, color: 0x7a3a6a, label: 'Veteran', line: "I've wintered on this ridge more times than I can count. The cold sharpens a team. Battle me.", pokemon: team([362, 75], [461, 75], [473, 76]), expPool: 2900 },
    { key: 'rg-nunbyeol', name: 'Skier Nunbyeol', col: 16, row: 9, color: 0x3a8ab0, label: 'Skier', line: "I carve these slopes at dawn before the wind picks up. Race you? No — battle you!", pokemon: team([459, 74], [221, 75]), expPool: 2700 },
  ],
  prev: rgExit('RangrimAltarScene', 'rgAltar', NORTH_END),
  next: rgExit('RangrimSummitScene', 'rgPeak', SOUTH_END),
  build: snowfield,
  decorate: (s) => s.label('❄ 능선 (windswept ridge)', MIDCOL, 24, '#eaf6ff'),
};
const SUMMIT: RgConfig = {
  key: 'RangrimSummitScene', returnKey: 'rgPeak', title: '⛰ 온성산 정상 (Onseong Summit)', bgm: 'sacredpeak',
  southLabel: '↓ 설원 능선 (Snow Ridge)', northLabel: '↑ Samho',
  encTiles: [T.SNOW], enc: [
    { id: 461, weight: 12, minLevel: 75, maxLevel: 77, isCustom: false, catchRate: 90 },
    { id: 362, weight: 11, minLevel: 75, maxLevel: 77, isCustom: false, catchRate: 90 },
    { id: 473, weight: 9, minLevel: 75, maxLevel: 77, isCustom: false, catchRate: 60 },
    { id: 478, weight: 8, minLevel: 75, maxLevel: 77, isCustom: false, catchRate: 90 },
    { id: 615, weight: 7, minLevel: 75, maxLevel: 77, isCustom: false, catchRate: 60 },
    { id: 359, weight: 7, minLevel: 76, maxLevel: 77, isCustom: false, catchRate: 60 },
  ],
  trainers: [
    { key: 'rg-hyeol', name: '노스단 Scout Hyeol', col: 11, row: 6, color: 0x24242e, label: '노스단\nScout', line: "So the Inspectorate's dog reaches the very peak. Beyond lies Samho — and 노스단's road to the sacred mountain. You go no further!", pokemon: team([430, 75], [452, 76], [461, 76]), expPool: 2900 },
  ],
  prev: rgExit('RangrimSnowfieldScene', 'rgSnow', NORTH_END),
  next: rgExit('SamjiyonCityScene', 'SamjiyonCityScene', { x: 13.5 * 32, y: 17 * 32 + 16 }),
  build: summit,
  decorate: (s) => { const g = s.add.graphics().setDepth(6); for (let i = 0; i < 4; i++) { g.fillStyle(0x6a6356, 1); g.fillRect(11 * 32 + 10 - i, (11 - i) * 32 + 20, 12 + i * 2, 10); } s.label('돌탑 (summit cairn)', 11, 9, '#ffe9c0'); },
};

export class RangrimFoothillsScene extends RangrimBaseScene {
  // Rocks rise as real 3D — but caveFloorHint caps their height so they read as
  // low boulders/walls that never bury the player. Building shapes erased.
  public caveFloorHint = true;
  public onlyNamedBuildings = true;
  constructor() { super(FOOTHILLS); }
}
export class RangrimCavernScene extends RangrimBaseScene {
  // The pitch-dark lower cavern is cramped, so even height-capped walls block the
  // view — flatten every raised tile here so no black rock ever hides the player.
  // interiorTerrain3D also suppresses stray foliage/water in the cave.
  public caveFloorHint = true;
  public onlyNamedBuildings = true;
  public clearSight3D = true;
  public flatTerrain3D = true;   // cramped dark cavern: raise NOTHING so no black tile hides the player
  constructor() { super(CAVERN); }
}
export class RangrimAltarScene extends RangrimBaseScene {
  // The altar's dark painted rock is collision/layout information, not a set
  // of foreground towers. Keep it on the ground plane and suppress every
  // automatically raised tile so the altar, statue and player stay visible.
  public caveFloorHint = true;
  public onlyNamedBuildings = true;
  public clearSight3D = true;
  public flatTerrain3D = true;   // altar hall stays on the ground plane — no raised black rock towers
  constructor() { super(ALTAR); }
}
export class RangrimSnowfieldScene extends RangrimBaseScene {
  // Snow-ridge terrain rises in 3D, height-capped so rocks/drifts never bury the
  // player's view.
  public caveFloorHint = true;
  public onlyNamedBuildings = true;
  constructor() { super(SNOWFIELD); }
}
export class RangrimSummitScene extends RangrimBaseScene { constructor() { super(SUMMIT); } }
