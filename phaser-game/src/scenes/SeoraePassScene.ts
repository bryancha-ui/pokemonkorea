import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { vanishesAfterDefeat } from '../data/Villains';
import { drawTrainerBody, drawRiderBody, markProceduralCharacter3D, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';

// ── Seorae Pass (설령 고개) ────────────────────────────────────────────────────
// A wind-blown snow pass climbing out of the Dolmoe Mine up to the frozen town of
// Seorae. Deep drifts hide Ice Pokémon; skiers and snow-workers hold the switchbacks.

const T = { SNOW: 0, PATH: 1, SNOWGRASS: 2, PINE: 3, ROCK: 4 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 20, ROWS = 56;
const COLORS: Record<Tile, number> = {
  [T.SNOW]: 0xdfe8f0, [T.PATH]: 0xc2ccd6, [T.SNOWGRASS]: 0x8fb59a, [T.PINE]: 0x2a4a3a, [T.ROCK]: 0x8a8478,
};
const SOLID = new Set<Tile>([T.PINE, T.ROCK]);
const ENCOUNTER = new Set<Tile>([T.SNOWGRASS]);

const PASS_ENCOUNTERS: EncounterEntry[] = [
  { id: 'babymammoth', weight: 16, minLevel: 42, maxLevel: 46, isCustom: true, catchRate: 200 }, // Ice
  { id: 'glacewing',   weight: 14, minLevel: 42, maxLevel: 46, isCustom: true, catchRate: 190 }, // Ice/Bug
  { id: 'bosongnun',   weight: 14, minLevel: 42, maxLevel: 46, isCustom: true, catchRate: 190 }, // Ice/Fairy
  { id: 220, weight: 12, minLevel: 42, maxLevel: 45, isCustom: false, catchRate: 220 }, // Swinub
  { id: 361, weight: 12, minLevel: 42, maxLevel: 45, isCustom: false, catchRate: 200 }, // Snorunt
  { id: 459, weight: 10, minLevel: 43, maxLevel: 46, isCustom: false, catchRate: 190 }, // Snover
  { id: 215, weight: 8,  minLevel: 44, maxLevel: 46, isCustom: false, catchRate: 120 }, // Sneasel (rare)
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.SNOW) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  fill(0, ROWS, 8, 12, T.PATH);
  // Frozen pine borders
  fill(0, ROWS, 0, 3, T.PINE);
  fill(0, ROWS, COLS - 3, COLS, T.PINE);
  // Scattered pines & boulders in the open snow
  for (const [r, c] of [[6,5],[10,14],[18,5],[24,15],[30,4],[36,14],[44,5],[50,14],[14,6],[40,15]] as [number,number][]) m[r][c] = T.PINE;
  for (const [r, c] of [[8,15],[22,4],[34,6],[46,15],[52,4]] as [number,number][]) m[r][c] = T.ROCK;
  // Snow-covered tall-grass clearings (wild encounters), alternating along
  // the switchbacks without covering the central travel corridor.
  fill(8, 14, 12, 16, T.SNOWGRASS);
  fill(20, 27, 4, 8, T.SNOWGRASS);
  fill(32, 39, 12, 16, T.SNOWGRASS);
  fill(44, 51, 4, 8, T.SNOWGRASS);
  return m;
}

interface PassTrainer {
  key: string; name: string; label: string; col: number; row: number; color: number;
  line: string; pokemon: string; expPool: number;
}

export class SeoraePassScene extends Phaser.Scene {
  // Painted tree tiles grow real 3D trees and their flat 2D art is wiped.
  public treeTileIds3D = [T.PINE];
  // Solid rock/cliff tiles become real 3D rock (masses → mountain range, lone
  // tiles → a boulder) and their flat painted icons are wiped from the ground.
  public mountainTileIds3D = [T.ROCK];
  // A snowy mountain pass has no buildings — only named-model plots (there are
  // none here) rise in 3D, so every auto-detected building is erased to clean
  // ground instead of extruding stray facades on the slopes.
  public onlyNamedBuildings = true;
  public grassTileIds3D = [T.SNOWGRASS];

  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 10 * TILE + 16;
  private py = 54 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;

  private readonly TRAINERS: PassTrainer[] = [
    { key: 'pass-yuna', name: 'Skier Yuna', label: 'Skier', col: 6, row: 46, color: 0xe06a8a,
      line: "Fresh powder and a fresh challenger! Both make my day. Ready?",
      pokemon: JSON.stringify([{ id: 0, level: 45, custom: 'babymammoth' }, { id: 0, level: 46, custom: 'glacewing' }]), expPool: 1300 },
    { key: 'pass-deok', name: 'Snow Worker Deok', label: 'Snow\nWorker', col: 14, row: 35, color: 0x5a7a9a,
      line: "I clear this pass every dawn. Nothing on it gets by me — not even you.",
      pokemon: JSON.stringify([{ id: 0, level: 45, custom: 'bosongnun' }, { id: 221, level: 47 }]), expPool: 1340 },
    { key: 'pass-han', name: 'Mountaineer Han', label: 'Moun-\ntaineer', col: 6, row: 22, color: 0x8a6a4a,
      line: "The summit tests everyone. Consider me your first foothold.",
      pokemon: JSON.stringify([{ id: 459, level: 46 }, { id: 461, level: 48 }]), expPool: 1400 },
  ];

  constructor() { super('SeoraePassScene'); }

  create() {
    playBgm(this, 'seoraepass');   // seoraepass theme
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    this.input.keyboard?.resetKeys();
    this.px = 10 * TILE + 16; this.py = 54 * TILE + 16;
    const rx = this.registry.get('seoraePassReturnX') as number | undefined;
    const ry = this.registry.get('seoraePassReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('seoraePassReturnX'); this.registry.remove('seoraePassReturnY');

    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawTrainers();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'SeoraePassScene');
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.SNOWGRASS) this.drawSnowGrass(g, c * TILE, r * TILE);
      if (t === T.PINE)  { g.fillStyle(0x1e3a2c); g.fillTriangle(c*TILE+16, r*TILE+2, c*TILE+4, r*TILE+24, c*TILE+28, r*TILE+24); g.fillStyle(0xf0f6ff, 0.7); g.fillTriangle(c*TILE+16, r*TILE+2, c*TILE+10, r*TILE+12, c*TILE+22, r*TILE+12); }
      if (t === T.ROCK)  { g.fillStyle(0x6f6a60); g.fillTriangle(c*TILE+16, r*TILE+6, c*TILE+4, r*TILE+27, c*TILE+28, r*TILE+27); g.fillStyle(0xffffff,0.6); g.fillRect(c*TILE+8, r*TILE+8, 10, 3); }
      if (t === T.PATH)  { g.fillStyle(0xb0bac6, 0.5); g.fillRect(c*TILE+6, r*TILE+13, TILE-12, 6); }
    }
    const key = '__seoraePassMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(10 * TILE, (ROWS - 1.4) * TILE, tr('↓ Dolmoe Mine'), {
      fontSize: '10px', color: '#123', backgroundColor: '#ffffffcc', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(10 * TILE, 0.6 * TILE, tr('↑ Seorae Town'), {
      fontSize: '10px', color: '#123', backgroundColor: '#ffffffcc', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawSnowGrass(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x5a8a6a, 0.75);
    for (let i = 0; i < 3; i++) {
      g.fillRect(x + 5 + i * 8, y + 18, 2, 9);
      g.fillRect(x + 7 + i * 8, y + 15, 2, 12);
    }
    // Uneven white caps make the patch read as grass buried in fresh powder.
    g.fillStyle(0xffffff, 0.72);
    g.fillEllipse(x + 10, y + 22, 12, 5);
    g.fillEllipse(x + 23, y + 24, 15, 5);
  }

  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`) && vanishesAfterDefeat(tr.key)) continue;
      const g = this.add.graphics().setDepth(8);
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      g.fillStyle(0x000000, 0.18); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(tr.color); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x333333); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -22, 12, 12);
      g.fillStyle(0xcc3333); g.fillRect(-7, -23, 14, 5);   // wool cap
      g.fillStyle(0x000000); g.fillRect(-3, -16, 2, 2); g.fillRect(1, -16, 2, 2);
      // These hand-drawn trainers had no explicit 3D identity. On the 3D-only
      // snow pass their flat Graphics were removed with the map, but no humanoid
      // was guaranteed to replace them. Give every pass trainer a winter model;
      // Yuna is authored as the female skier, the remaining trainers as male.
      markProceduralCharacter3D(g, {
        outfit: tr.color,
        hair: tr.key === 'pass-yuna' ? 0x5b3028 : 0x3a2410,
        gender: tr.key === 'pass-yuna' ? 'girl' : 'boy',
        footY: 13,
        outfitStyle: 'winter',
        hairStyle: tr.key === 'pass-yuna' ? 'long' : 'short',
      });
      this.add.text(tr.col * TILE + 16, tr.row * TILE - 12, speakerName(tr.label), {
        fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(9).setName(`${tr.key}__label`)
        .setData('characterLabel3D', true)
        .setData('characterLabelTarget3D', g);
    }
  }

  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() { (this.cycling ? drawRiderBody : drawTrainerBody)(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry)); this.playerG.setPosition(this.px, this.py); }
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
    this.add.rectangle(this.scale.width / 2, 22, 380, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('❄ Seorae Pass — 설령 고개'), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  SPACE: talk  M: menu'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(_: number, delta: number) {
    if (this.cutsceneActive) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
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

  private checkTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`)) continue;
      const wx = tr.col * TILE + 16, wy = tr.row * TILE + 16;
      const dx = Math.abs(this.px - wx), dy = Math.abs(this.py - wy);
      const spotted = Math.hypot(dx, dy) < TILE * 1.5
        || (dy < TILE * 0.7 && dx < TILE * 6) || (dx < TILE * 0.7 && dy < TILE * 6);
      if (spotted) {
        this.cutsceneActive = true;
        this.registry.set('trainerName', tr.name);
        this.registry.set('trainerKey', tr.key);
        this.registry.set('trainerPokemon', tr.pokemon);
        this.registry.set('trainerExpPool', tr.expPool);
        this.registry.set('trainerReturnScene', 'SeoraePassScene');
        this.registry.set('seoraePassReturnX', this.px); this.registry.set('seoraePassReturnY', this.py);
        this.dialog.show([tr.line, `${tr.name}: Let's battle!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkEncounter() {
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (!t || !ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.2) return;
    this.steps = 0; this.nextEnc = 8 + Math.floor(Math.random() * 8);
    const e = pickEncounter(PASS_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'SeoraePassScene');
    this.registry.set('seoraePassReturnX', this.px); this.registry.set('seoraePassReturnY', this.py);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    if (this.py > (ROWS - 1) * TILE) {   // south → Dolmoe Mine
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('dolmoeMineReturnX', 10 * 32 + 16); this.registry.set('dolmoeMineReturnY', 3 * 32);
        this.scene.start('DolmoeMineScene');
      });
    } else if (this.py < 1 * TILE) {   // north → Seorae Town
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('seoraeReturnX', 24 * 32 + 16); this.registry.set('seoraeReturnY', 40 * 32 + 16);
        this.scene.start('SeoraeTownScene');
      });
    }
  }
}
