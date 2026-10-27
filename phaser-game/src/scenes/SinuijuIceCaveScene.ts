import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';

// ── Binghagwan Ice Cave (빙하관 얼음 동굴) ────────────────────────────────────────────
// 어사대장 Amrok's exam trial: a FIVE-stage ice cavern under the frozen Amrok. Every
// chamber floor is sheer ice — step on it and you SLIDE until a boulder or wall stops
// you. Each stage is a zig-zag slide puzzle (up · across · down · across · up), the
// entrance weaving corner to corner as you descend to the heart, where the Ice-Bound
// Beartic (얼음 툰베어) shatters free of the wall as a 우두머리 boss.
//
// IMPORTANT — no dead-ends: in every stage the ENTRANCE COLUMN and the BOTTOM ROW are
// left clear of boulders, so from anywhere you can always slide back down to the
// entrance corner and out. However you slide, you can never get permanently stuck.

const T = { WALL: 0, SNOW: 1, ICE: 2, ROCK: 3, EXIT: 4 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 15, ROWS = 50;
const SOLID = new Set<Tile>([T.WALL, T.ROCK]);

const THREAT_KEY = 'eosa-sinuiju-threat';   // '-threat' → TrainerBattleScene 우두머리 (aura + 2× HP)
const BEAR_COL = 7, BEAR_ROW = 2;
const SPAWN_COL = 7, SPAWN_ROW = 47;

// Each stage: ice rows [top..bot], entered from a bottom corner (entry col) and exited
// through the opposite top corner (exit col). Boulders sit only in the interior — never
// on the entry column or the bottom row — so a slide-back-out is always possible.
interface StageDef { top: number; bot: number; entry: number; exit: number; rocks: [number, number][] }
const STAGES: StageDef[] = [
  { top: 38, bot: 44, entry: 1,  exit: 13, rocks: [[38, 7], [41, 10]] },  // Stage 1
  { top: 30, bot: 36, entry: 13, exit: 1,  rocks: [[30, 7], [33, 4]] },   // Stage 2
  { top: 22, bot: 28, entry: 1,  exit: 13, rocks: [[22, 7], [25, 9]] },   // Stage 3
  { top: 14, bot: 20, entry: 13, exit: 1,  rocks: [[14, 7], [17, 4]] },   // Stage 4
  { top: 6,  bot: 12, entry: 1,  exit: 7,  rocks: [[6, 8]] },             // Stage 5 → the heart
];

const IC_ENCOUNTERS: EncounterEntry[] = [
  { id: 220, weight: 16, minLevel: 70, maxLevel: 72, isCustom: false, catchRate: 120 }, // Swinub
  { id: 459, weight: 13, minLevel: 70, maxLevel: 72, isCustom: false, catchRate: 90  }, // Snover
  { id: 215, weight: 12, minLevel: 70, maxLevel: 72, isCustom: false, catchRate: 90  }, // Sneasel
  { id: 225, weight: 10, minLevel: 70, maxLevel: 72, isCustom: false, catchRate: 120 }, // Delibird
  { id: 615, weight: 7,  minLevel: 71, maxLevel: 73, isCustom: false, catchRate: 60  }, // Cryogonal (rare)
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.WALL) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  fill(1, 5, 1, 14, T.SNOW);        // heart chamber (rows 1-4)
  for (const s of STAGES) fill(s.top, s.bot + 1, 1, 14, T.ICE);
  fill(46, 49, 1, 14, T.SNOW);      // entrance snowdrift (rows 46-48)

  // Snow "landings" through each divider — exit of one stage = entrance of the next,
  // so the way weaves: entrance col7 → col1 → col13 → col1 → col13 → col1 → heart col7.
  m[45][STAGES[0].entry] = T.SNOW;                                   // entrance → stage 1
  for (let i = 0; i < STAGES.length; i++) m[STAGES[i].top - 1][STAGES[i].exit] = T.SNOW; // stage i exit
  m[49][SPAWN_COL] = T.EXIT;                                         // entrance floor → back to Binghagwan

  for (const s of STAGES) for (const [r, c] of s.rocks) m[r][c] = T.ROCK;
  return m;
}

export class SinuijuIceCaveScene extends Phaser.Scene {
  // Render the cavern with interior-style terrain in 3D — low visible walls (the
  // player is never hidden behind tall black tiles), and NO outdoor foliage/water,
  // so no stray trees or transparent structures block the ice path. The outdoor
  // follow-camera + daylight are kept (this map scrolls 50 rows deep) so it reads
  // bright rather than a dark cave.
  public interiorTerrain3D = true;
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private tc = SPAWN_COL; private tr = SPAWN_ROW;
  private facing = 1;
  private stepping = false;
  private dir = { dx: 0, dy: 0 };
  private cutscene = false;
  private beaten = false;

  constructor() { super('SinuijuIceCaveScene'); }

  create() {
    this.stepping = false; this.cutscene = false;
    playBgm(this, 'icecave');
    this.input.keyboard?.resetKeys();
    this.beaten = !!this.registry.get(`trainerDefeated_${THREAT_KEY}`);

    const rc = this.registry.get('iceCaveReturnCol') as number | undefined;
    const rr = this.registry.get('iceCaveReturnRow') as number | undefined;
    if (rc !== undefined) { this.tc = rc; this.tr = rr as number; } else { this.tc = SPAWN_COL; this.tr = SPAWN_ROW; }
    this.registry.remove('iceCaveReturnCol'); this.registry.remove('iceCaveReturnRow');

    this.map = buildMap();
    this.drawMap();
    if (!this.beaten) this.drawBeartic();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.tc * TILE + 16, this.tr * TILE + 16, 'SinuijuIceCaveScene');

    if (this.beaten && !this.registry.get('iceCaveCleared')) {
      this.registry.set('iceCaveCleared', true);
      this.cutscene = true;
      this.time.delayedCall(500, () => this.dialog.show([
        'The Ice-Bound Beartic is driven from the cavern. The groaning of the ice fades to a deep, settled quiet.',
        '어사대장 Amrok will want to know the crossing is safe. Head back to Binghagwan.',
      ], () => {
        this.registry.set('SinuijuCitySceneReturnX', 13 * 32 + 16);
        this.registry.set('SinuijuCitySceneReturnY', 12 * 32 + 16);
        this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('SinuijuCityScene'));
      }));
    }
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      if (t === T.WALL) { g.fillStyle(0x24303f, 1); g.fillRect(x, y, TILE, TILE); g.fillStyle(0x33475c, 1); g.fillRect(x + 2, y + 2, TILE - 4, TILE - 6); g.fillStyle(0x1a2330, 1); g.fillRect(x + 7, y + 8, 5, 4); }
      else if (t === T.ICE) { g.fillStyle(0x9fd6ee, 1); g.fillRect(x, y, TILE, TILE); g.fillStyle(0xc7ecf9, 0.9); g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2); g.lineStyle(1, 0x7fbfe0, 0.7); g.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6); g.fillStyle(0xffffff, 0.7); g.fillRect(x + 6, y + 6, 8, 2); g.fillRect(x + 18, y + 20, 6, 2); }
      else if (t === T.SNOW) { g.fillStyle(0xe9f1f7, 1); g.fillRect(x, y, TILE, TILE); g.fillStyle(0xffffff, 0.7); g.fillCircle(x + 10, y + 12, 3); g.fillCircle(x + 22, y + 22, 2); }
      else if (t === T.ROCK) { g.fillStyle(0x9fd6ee, 1); g.fillRect(x, y, TILE, TILE); g.fillStyle(0x5c6b7a, 1); g.fillTriangle(x + 16, y + 4, x + 3, y + 28, x + 29, y + 28); g.fillStyle(0x7f8f9e, 0.8); g.fillRect(x + 12, y + 12, 6, 5); g.fillStyle(0xdff0fb, 0.6); g.fillRect(x + 8, y + 24, TILE - 16, 4); }
      else if (t === T.EXIT) { g.fillStyle(0x1a2330, 1); g.fillRect(x, y, TILE, TILE); g.fillStyle(0x2a3a4a, 1); g.fillRect(x + 4, y + 2, TILE - 8, TILE - 4); g.fillStyle(0xffe44e, 1); g.fillRect(x + 14, y + 8, 4, 16); g.fillTriangle(x + 8, y + 20, x + 24, y + 20, x + 16, y + 28); }
    }
    const key = '__iceCaveMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(SPAWN_COL * TILE + 16, 49 * TILE + 4, tr('↓ Binghagwan'), { fontSize: '9px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    STAGES.forEach((s, i) => this.add.text(s.entry === 1 ? 1.6 * TILE : 12.4 * TILE, (s.top + 2) * TILE, tr(`STAGE ${i + 1}`), { fontSize: '8px', color: '#0a3a4a', fontStyle: 'bold', backgroundColor: '#cdeafacc', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(5));
    this.add.text(7.5 * TILE, 47 * TILE, tr('얼음길 — 미끄러진다!\n(ice slides you until a rock stops you)'), { fontSize: '8px', color: '#0a3a4a', align: 'center', backgroundColor: '#cdeafaee', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    if (!this.beaten) this.add.text(BEAR_COL * TILE + 16, 0.5 * TILE, '❄ 얼음 동굴의 심장부 ❄', { fontSize: '9px', color: '#bfe8ff', fontStyle: 'bold', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(6);
  }

  private drawBeartic() {
    const g = this.add.graphics().setDepth(7);
    // Draw the Beartic LOCALLY around (0,0) and POSITION the graphics object at the
    // heart. The 3D mirror derives a billboard's world position from the object's
    // x/y — drawing at absolute coords on an unpositioned (0,0) object snapped the
    // 3D shape to the map corner. Positioning it puts the boss centred in the heart.
    g.setPosition(BEAR_COL * TILE + 16, BEAR_ROW * TILE - 6);
    g.setScale(1.9);   // a looming 우두머리 boss — the raw drawing reads too small in 3D
    const cx = 0, cy = 0;
    g.fillStyle(0x000000, 0.2); g.fillEllipse(cx, cy + 20, 46, 12);
    g.fillStyle(0xeaf6ff, 1); g.fillEllipse(cx, cy, 34, 40);
    g.fillStyle(0xf6fcff, 1); g.fillCircle(cx, cy - 20, 16);
    g.fillStyle(0x2a3550, 1); g.fillCircle(cx - 6, cy - 22, 2.5); g.fillCircle(cx + 6, cy - 22, 2.5);
    g.fillStyle(0xbfe0f0, 1); g.fillTriangle(cx - 4, cy - 8, cx + 4, cy - 8, cx, cy + 6);
    g.fillStyle(0xffffff, 1); g.fillTriangle(cx - 14, cy - 30, cx - 10, cy - 30, cx - 12, cy - 40); g.fillTriangle(cx + 10, cy - 30, cx + 14, cy - 30, cx + 12, cy - 40);
    g.fillStyle(0xaad8f0, 0.28); g.fillRoundedRect(cx - 26, cy - 44, 52, 78, 8);
    this.tweens.add({ targets: g, alpha: { from: 1, to: 0.82 }, duration: 900, yoyo: true, repeat: -1 });
  }

  private createPlayer() {
    this.playerG = this.add.graphics().setDepth(20);
    this.drawChar();
    this.playerG.setPosition(this.tc * TILE + 16, this.tr * TILE + 16);
  }
  private drawChar() { this.playerG.clear(); drawTrainerBody(this.playerG, this.facing, 0, playerDesign(this.registry)); }
  private setupCamera() {
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.setZoom(1.9);
    this.cameras.main.startFollow(this.playerG, true, 0.12, 0.12);
  }
  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutscene) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 440, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('❄ 빙하관 얼음 동굴 — 5 stages to the heart'), {
      fontSize: '13px', color: '#eaf6ff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD/Arrows: move  (slide back down the entry side to escape any stage)  M: menu'), {
      fontSize: '10px', color: '#cbe6f5', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  // ── Grid-step movement with ice sliding ──────────────────────────────────
  update() {
    if (this.cutscene) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
      return;
    }
    if (this.stepping) return;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  { dx = -1; this.facing = 2; }
    else if (this.cursors.right.isDown || this.wasd.right.isDown) { dx = 1; this.facing = 3; }
    else if (this.cursors.up.isDown    || this.wasd.up.isDown)    { dy = -1; this.facing = 1; }
    else if (this.cursors.down.isDown  || this.wasd.down.isDown)  { dy = 1; this.facing = 0; }
    if (dx || dy) { this.drawChar(); this.tryStep(dx, dy); }
  }

  private tileAt(c: number, r: number): Tile | undefined { return this.map[r]?.[c]; }
  private solid(c: number, r: number): boolean {
    const t = this.tileAt(c, r);
    return t === undefined || SOLID.has(t);
  }

  private tryStep(dx: number, dy: number) {
    this.dir = { dx, dy };
    const nc = this.tc + dx, nr = this.tr + dy;
    if (this.solid(nc, nr)) { return; }
    const onIce = this.tileAt(this.tc, this.tr) === T.ICE || this.tileAt(nc, nr) === T.ICE;
    this.stepping = true;
    this.tweens.add({
      targets: this.playerG, x: nc * TILE + 16, y: nr * TILE + 16,
      duration: onIce ? 85 : 150, ease: 'Linear',
      onComplete: () => { this.tc = nc; this.tr = nr; this.stepping = false; this.onArrive(); },
    });
  }

  private onArrive() {
    if (this.tileAt(this.tc, this.tr) === T.ICE) { this.tryStep(this.dir.dx, this.dir.dy); return; }
    if (this.tileAt(this.tc, this.tr) === T.EXIT) { this.exitToSinuiju(); return; }
    this.checkBeartic();
    this.maybeEncounter();
  }

  private exitToSinuiju() {
    this.cutscene = true;
    this.cameras.main.fadeOut(400, 0, 0, 0, () => {
      this.registry.set('SinuijuCitySceneReturnX', 18 * 32 + 16); this.registry.set('SinuijuCitySceneReturnY', 21 * 32 + 16);
      this.scene.start('SinuijuCityScene');
    });
  }

  private checkBeartic() {
    if (this.beaten) return;
    if (Math.abs(this.tc - BEAR_COL) + Math.abs(this.tr - BEAR_ROW) > 1) return;
    this.cutscene = true;
    this.dialog.show([
      'At the heart of the cave, a great bear-shape sleeps frozen into the ice wall.',
      'As you draw near, a deep CRACK splinters the ice — and two cold eyes snap open.',
      'The Ice-Bound Beartic shatters free of the wall with a roar that shakes frost from the ceiling!',
    ], () => {
      this.registry.set('trainerName', '얼음 툰베어 (Ice-Bound Beartic)');
      this.registry.set('trainerKey', THREAT_KEY);
      this.registry.set('trainerPokemon', JSON.stringify([{ id: 614, level: 74 }]));
      this.registry.set('trainerExpPool', 3200);
      this.registry.set('trainerReturnScene', 'SinuijuIceCaveScene');
      this.registry.set('iceCaveReturnCol', this.tc); this.registry.set('iceCaveReturnRow', this.tr);
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    });
  }

  private maybeEncounter() {
    if (this.tileAt(this.tc, this.tr) !== T.SNOW || this.tr < 46) return;   // only the entrance snowdrift
    if (Math.random() > 0.12) return;
    const e = pickEncounter(IC_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'SinuijuIceCaveScene');
    this.registry.set('iceCaveReturnCol', this.tc); this.registry.set('iceCaveReturnRow', this.tr);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }
}
