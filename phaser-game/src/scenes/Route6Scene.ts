import Phaser from 'phaser';
import { canUseSurf, installSurfing, isSurfing } from '../systems/SurfSystem';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { vanishesAfterDefeat } from '../data/Villains';
import { drawTrainerBody, drawRiderBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { markTrainerPortrait } from '../data/BattlePortraits';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';
import type { PropPlot } from '../engine3d/TerrainBuilder';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = { GRASS: 0, PATH: 1, TALLGRASS: 2, CLIFF: 3, ROCK: 4, SEA: 5, SAND: 6, LANTERN: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 60;
const COLORS: Record<Tile, number> = {
  [T.GRASS]: 0x6aa84a, [T.PATH]: 0xcabf95, [T.TALLGRASS]: 0x3f8a32, [T.CLIFF]: 0x8a8070,
  [T.ROCK]: 0x6f6658, [T.SEA]: 0x2a72b8, [T.SAND]: 0xe6d8a8, [T.LANTERN]: 0x9a7a4a,
};
const SOLID = new Set<Tile>([T.CLIFF, T.ROCK, T.SEA, T.LANTERN]);
const ENCOUNTER = new Set<Tile>([T.TALLGRASS]);
const R6_ROCKS: Array<[number, number]> = [[8,5],[20,5],[40,6],[52,5],[14,16],[34,16],[48,16]];
const R6_LANTERNS: Array<[number, number]> = Array.from({ length: 7 }, (_, i) => [6 + i * 8, 8] as [number, number])
  .flatMap(([r]) => [[r, 8], [r, 15]] as Array<[number, number]>);

// East-coast encounters lean Electric & Dragon (Korean 용 dragon mythology)
const R6_ENCOUNTERS: EncounterEntry[] = [
  { id: 'ssangdungori', weight: 14, minLevel: 36, maxLevel: 40, isCustom: true,  catchRate: 170 }, // Electric/Flying
  { id: 'ureunggul',    weight: 14, minLevel: 36, maxLevel: 40, isCustom: true,  catchRate: 180 }, // Electric
  { id: 'kingfisher',   weight: 12, minLevel: 36, maxLevel: 40, isCustom: true,  catchRate: 180 }, // Flying/Electric
  { id: 'wildcat',      weight: 10, minLevel: 36, maxLevel: 40, isCustom: true,  catchRate: 170 }, // Grass/Electric
  { id: 'aroryong',     weight: 10, minLevel: 36, maxLevel: 40, isCustom: true,  catchRate: 120 }, // Water/Dragon
  { id: 'redheadagama', weight: 10, minLevel: 36, maxLevel: 40, isCustom: true,  catchRate: 130 }, // Fire/Dragon
  { id: 179, weight: 12, minLevel: 36, maxLevel: 40, isCustom: false, catchRate: 200 }, // Mareep
  { id: 81,  weight: 10, minLevel: 36, maxLevel: 40, isCustom: false, catchRate: 200 }, // Magnemite
  { id: 147, weight: 6,  minLevel: 36, maxLevel: 40, isCustom: false, catchRate: 45  }, // Dratini (rare)
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GRASS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  fill(0, ROWS, 9, 15, T.PATH);
  // Cliffs to the west, the East Sea to the east
  fill(0, ROWS, 0, 4, T.CLIFF);
  fill(0, ROWS, 18, COLS, T.SEA);
  fill(0, ROWS, 16, 18, T.SAND);
  for (const [r, c] of R6_ROCKS) m[r][c] = T.ROCK;
  // Stone lanterns lining a coastal shrine path
  for (const [r, c] of R6_LANTERNS) m[r][c] = T.LANTERN;
  // Tall-grass clearings
  fill(8, 14, 15, 16, T.TALLGRASS);
  fill(34, 42, 5, 9, T.TALLGRASS);
  fill(50, 56, 15, 16, T.TALLGRASS);
  fill(10, 16, 5, 9, T.TALLGRASS);
  return m;
}

export class Route6Scene extends Phaser.Scene {
  public grassTileIds3D = [T.TALLGRASS];
  public flatTileIds3D = [T.PATH, T.SAND, T.ROCK, T.LANTERN];
  public noRocks3D = true;
  public propPlots: PropPlot[] = [
    ...R6_LANTERNS.map(([r, c]) => ({ x: c, y: r, kind: 'lantern' as const, scale: 1.18 })),
    ...R6_ROCKS.map(([r, c], i) => ({ x: c, y: r, kind: 'rock' as const, scale: 0.9 + (i % 3) * 0.08, rot: i * 0.73 })),
    ...([[3,6],[18,5],[28,6],[45,5],[57,6]] as Array<[number, number]>)
      .map(([r, c], i) => ({ x: c, y: r, kind: 'tree' as const, scale: 1.1 + (i % 2) * 0.12, rot: i * 0.9 })),
    ...([[4,7],[17,7],[27,16],[44,7],[56,16]] as Array<[number, number]>)
      .map(([r, c], i) => ({ x: c, y: r, kind: 'flower' as const, scale: 0.9 + (i % 2) * 0.12, rot: i * 0.6 })),
  ];
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private surfPrompt?: Phaser.GameObjects.Text;
  private dialog!: DialogBox;
  private px = 12 * TILE + 16;
  private py = 57 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;

  private readonly TRAINERS = [
    {
      key: 'r6-sora', name: 'Bird Keeper Sora', col: 8, row: 44, color: 0x44aacc, label: 'Bird\nKeeper',
      line: "My birds ride the sea wind off these cliffs. Catch them if you can!",
      pokemon: JSON.stringify([{ id: 0, level: 40, custom: 'kingfisher' }, { id: 0, level: 41, custom: 'squirrel2' }]),
      expPool: 1100,
    },
    {
      key: 'r6-yunho', name: 'Dragon Tamer Yunho', col: 16, row: 12, color: 0x6633bb, label: 'Dragon\nTamer',
      line: "The old 용 dragons sleep beneath this coast. My partners carry their blood. Face them!",
      pokemon: JSON.stringify([{ id: 0, level: 40, custom: 'aroryong' }, { id: 0, level: 41, custom: 'dracopaia' }]),
      expPool: 1200,
    },
  ] as const;

  constructor() { super('Route6Scene'); }

  create() {

    playBgm(this, 'route6');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('route6ReturnX') as number | undefined;
    const ry = this.registry.get('route6ReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('route6ReturnX'); this.registry.remove('route6ReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawTrainers();
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
    SaveManager.save(this.registry, this.px, this.py, 'Route6Scene');
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.TALLGRASS) { g.fillStyle(0x2c6a22, 0.7); for (let i=0;i<3;i++){ g.fillRect(c*TILE+5+i*8, r*TILE+16, 2, 12); g.fillRect(c*TILE+7+i*8, r*TILE+12, 2, 16);} }
      if (t === T.ROCK) { g.fillStyle(0x5a5044); g.fillTriangle(c*TILE+16, r*TILE+5, c*TILE+3, r*TILE+28, c*TILE+29, r*TILE+28); }
      if (t === T.CLIFF) { g.fillStyle(0x6f665a); g.fillRect(c*TILE+3, r*TILE+5, 7, 7); g.fillRect(c*TILE+18, r*TILE+17, 8, 8); }
      if (t === T.SEA) { g.fillStyle(0x66bbe6, 0.4); g.fillRect(c*TILE+4, r*TILE+8, 12, 3); g.fillRect(c*TILE+12, r*TILE+22, 10, 3); }
      if (t === T.LANTERN) { g.fillStyle(0x777066); g.fillRect(c*TILE+12, r*TILE+6, 8, 20); g.fillStyle(0xffdd88); g.fillRect(c*TILE+11, r*TILE+4, 10, 8); }
    }
    const key = '__route6Map__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(12 * TILE, 58.4 * TILE, tr('↓ Forest City'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#2a5a8a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(12 * TILE, 0.7 * TILE, tr('↑ Dolmoe City'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#aa6a2a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`) && vanishesAfterDefeat(tr.key)) continue;
      const g = this.add.graphics().setDepth(8);
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(tr.color); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x1a1a6e); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -22, 12, 12);
      g.fillStyle(0x220000); g.fillRect(-6, -22, 12, 5);
      g.fillStyle(0x000000); g.fillRect(-3, -16, 2, 2); g.fillRect(1, -16, 2, 2);
      this.add.text(tr.col * TILE + 16, tr.row * TILE - 12, speakerName(tr.label), {
        fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(9);
    }
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
    this.add.rectangle(this.scale.width / 2, 22, 410, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🌅 Route 6 — Eastern Shore Road (동해 해안도로)'), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  SPACE: talk  M: menu'), {
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
      if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; this.steps++; this.checkEncounter(); }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkTrainers();
    this.checkSurf();
    this.checkRyeoWarning();
    this.checkExits();
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      return SOLID.has(this.map[row][col]);
    });
  }

  private checkEncounter() {
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (!t || !ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.22) return;
    this.steps = 0; this.nextEnc = 8 + Math.floor(Math.random() * 8);
    const e = pickEncounter(R6_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'Route6Scene');
    this.registry.set('route6ReturnX', this.px); this.registry.set('route6ReturnY', this.py);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  private checkTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`)) continue;
      const wx = tr.col * TILE + 16, wy = tr.row * TILE + 16;
      const dx = Math.abs(this.px - wx), dy = Math.abs(this.py - wy);
      // Proximity OR line-of-sight down the road (same row/column within ~7 tiles),
      // so a trainer beside the path still challenges you as you walk past.
      const spotted = Math.hypot(dx, dy) < TILE * 1.5
        || (dy < TILE * 0.7 && dx < TILE * 7)
        || (dx < TILE * 0.7 && dy < TILE * 7);
      if (spotted) {
        this.cutsceneActive = true;
        this.registry.set('trainerName', tr.name);
        this.registry.set('trainerKey', tr.key);
        this.registry.set('trainerPokemon', tr.pokemon);
        this.registry.set('trainerExpPool', tr.expPool);
        this.registry.set('trainerReturnScene', 'Route6Scene');
        this.registry.set('route6ReturnX', this.px); this.registry.set('route6ReturnY', this.py);
        this.dialog.show([tr.line, `${tr.name}: Let's battle!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkRyeoWarning() {
    if (this.registry.get('ryeoWarningSeen')) return;
    if (this.py > 28 * TILE) return;
    this.registry.set('ryeoWarningSeen', true);
    this.cutsceneActive = true;
    this.facing = 1;
    this.drawChar();

    // Ryeo is a real overworld character so OverworldMirror replaces this 2D
    // fallback with her named npc_ryeo model and derives walk/facing animation
    // from the tweened world position.
    const startX = 12 * TILE + 16, startY = 26 * TILE + 16;
    const ryeo = this.add.graphics().setDepth(19).setPosition(startX, startY);
    this.drawRyeoWalker(ryeo, 0);
    markTrainerPortrait(ryeo, 'nosdan-ryeo-cliff');
    ryeo.setData('characterGender3D', 'girl');
    ryeo.setData('characterLookAt3D', { x: this.px, y: this.py });
    const label = this.add.text(startX, startY - 28, speakerName('Commander Ryeo'), {
      fontSize: '8px', color: '#ff9fbd', backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(20);

    this.dialog.show([
      'Commander Ryeo studies a weathered statue of the Grandmother at the shrine gate, silhouetted against the rising sun.',
      "Commander Ryeo: So Dolmoe still remembers her. They say the Grandmother's wings can contain even a god's awakening.",
      "Commander Ryeo: If she still lives, 노스단 will find her first. I'm heading north — stay out of our path.",
    ], () => {
      ryeo.setData('characterLookAt3D', null);
      let frame = 0;
      const walkFrames = this.time.addEvent({
        delay: 150, loop: true,
        callback: () => { frame ^= 1; this.drawRyeoWalker(ryeo, frame); },
      });
      const endY = 18 * TILE + 16;
      this.tweens.add({ targets: label, y: endY - 28, duration: 2500, ease: 'Sine.easeInOut' });
      this.tweens.add({
        targets: ryeo, y: endY, duration: 2500, ease: 'Sine.easeInOut',
        onComplete: () => {
          walkFrames.destroy();
          ryeo.destroy();
          label.destroy();
          this.cutsceneActive = false;
        },
      });
    });
  }

  private drawRyeoWalker(g: Phaser.GameObjects.Graphics, frame: number) {
    drawNpcBody(g, 0x20242d, { hair: 0x93969c, skin: 0xf0c8a0, frame });
    g.fillStyle(0x9e2731, 1); g.fillRect(-8, -9, 16, 1);  // commander's red shoulder trim
    g.fillStyle(0x9e2731, 1); g.fillRect(-1, -7, 2, 8);   // coat placket
    g.fillStyle(0x9e2731, 1); g.fillCircle(-4, -3, 1.4);  // insignia
  }

  /** At the sandy east shore, facing the sea with Surf earned, ride out onto the ocean. */
  private checkSurf() {
    if (this.cutsceneActive) { this.surfPrompt?.setVisible(false); return; }
    const col = Math.floor(this.px / TILE);
    const onShore = (col === 16 || col === 17) && this.facing === 3;   // sand edge, facing the sea
    if (!canUseSurf(this.registry) || !onShore) { this.surfPrompt?.setVisible(false); return; }
    if (!this.surfPrompt) {
      this.surfPrompt = this.add.text(this.scale.width / 2, 46, tr('🌊 SPACE — Surf out to sea'), {
        fontSize: '12px', color: '#fff', backgroundColor: '#0a3a5acc', padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(60).setVisible(false);
    }
    this.surfPrompt.setVisible(true);
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.surfPrompt.setVisible(false);
      this.cutsceneActive = true;
      this.registry.set('oceanReturnX', 30 * 32 + 16); this.registry.set('oceanReturnY', 20 * 32 + 16);
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('OceanScene'));
    }
  }

  private checkExits() {
    if (isSurfing(this.playerG)) return;
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    if (this.py > (ROWS - 1) * TILE) {   // south → back to Forest City
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('forestCityReturnX', 15 * 32); this.registry.set('forestCityReturnY', 2 * 32);
        this.scene.start('ForestCityScene');
      });
    }
    if (this.py < 1 * TILE) {   // north → Dolmoe City → Seorae → Sunrise
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('dolmoeReturnX', 11 * 32 + 16); this.registry.set('dolmoeReturnY', 19 * 32);
        this.scene.start('DolmoeCityScene');
      });
    }
  }
}
