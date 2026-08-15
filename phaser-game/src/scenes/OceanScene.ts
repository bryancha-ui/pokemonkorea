import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';

// ── The Open Ocean (surf) ────────────────────────────────────────────────────
// Reached by surfing off any coast. The player rides the water on a mount; wild
// sea Pokémon and Swimmer trainers roam, and the currents lead to Haean, Route 6,
// and Jeju City's southern harbour.

const T = { WATER: 0, DEEP: 1, ROCK: 2, FOAM: 3 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 32, ROWS = 44;
const COLORS: Record<Tile, number> = {
  [T.WATER]: 0x2f7fc4, [T.DEEP]: 0x1f5f9c, [T.ROCK]: 0x6f6658, [T.FOAM]: 0x5aa8dc,
};
const SOLID = new Set<Tile>([T.ROCK]);
const ENCOUNTER = new Set<Tile>([T.WATER, T.DEEP]);

const SEA_ENCOUNTERS: EncounterEntry[] = [
  { id: 'roundtailor', weight: 16, minLevel: 36, maxLevel: 43, isCustom: true,  catchRate: 200 }, // Water
  { id: 'odamryul',    weight: 14, minLevel: 36, maxLevel: 43, isCustom: true,  catchRate: 200 }, // Water
  { id: 'ottershaman', weight: 12, minLevel: 36, maxLevel: 41, isCustom: true,  catchRate: 190 }, // Water
  { id: 'cerrapin',    weight: 12, minLevel: 36, maxLevel: 41, isCustom: true,  catchRate: 180 }, // Rock/Water
  { id: 'kelpoxin',    weight: 10, minLevel: 38, maxLevel: 43, isCustom: true,  catchRate: 180 }, // Poison/Water
  { id: 72,  weight: 14, minLevel: 36, maxLevel: 41, isCustom: false, catchRate: 220 }, // Tentacool
  { id: 129, weight: 12, minLevel: 36, maxLevel: 40, isCustom: false, catchRate: 255 }, // Magikarp
  { id: 320, weight: 10, minLevel: 40, maxLevel: 43, isCustom: false, catchRate: 200 }, // Wailmer
  { id: 'aroryong', weight: 6, minLevel: 41, maxLevel: 45, isCustom: true, catchRate: 90 }, // Water/Dragon (rare)
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.WATER) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  // Deep-water channels (darker, still surfable)
  fill(10, 34, 6, 10, T.DEEP);
  fill(6, 20, 20, 26, T.DEEP);
  // Rock outcrops (obstacles)
  for (const [r, c] of [[8,4],[14,15],[22,12],[26,22],[30,8],[18,26],[34,18],[12,28],[38,24],[6,12]] as [number,number][]) m[r][c] = T.ROCK;
  // Foam / whitecaps decoration lanes
  for (const [r, c] of [[16,10],[24,17],[32,14],[20,6],[28,26]] as [number,number][]) m[r][c] = T.FOAM;
  return m;
}

interface Swimmer {
  key: string; name: string; label: string; col: number; row: number; color: number;
  line: string; pokemon: string; expPool: number;
}

export class OceanScene extends Phaser.Scene {
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private mountG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 16 * TILE + 16;
  private py = 40 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;
  private steps = 0; private nextEnc = 12;
  private readonly SPEED = 130; private readonly RUN = 250;

  private readonly TRAINERS: Swimmer[] = [
    { key: 'ocean-miho', name: 'Swimmer Miho', label: 'Swim-\nmer', col: 12, row: 30, color: 0x3aa0d0,
      line: "You surfed all the way out here? Then you can spare a match!",
      pokemon: JSON.stringify([{ id: 0, level: 44, custom: 'roundtailor' }, { id: 0, level: 45, custom: 'odamryul' }]), expPool: 1200 },
    { key: 'ocean-jinsu', name: 'Swimmer Jinsu', label: 'Swim-\nmer', col: 22, row: 16, color: 0x2a80b0,
      line: "The current's strong here — but my Pokémon are stronger.",
      pokemon: JSON.stringify([{ id: 0, level: 45, custom: 'cerrapin' }, { id: 320, level: 46 }]), expPool: 1260 },
    { key: 'ocean-baek', name: 'Sailor Baek', label: 'Sailor', col: 8, row: 20, color: 0x4a6a8a,
      line: "Forty years at sea. Let's see if the land-folk can hold a wave.",
      pokemon: JSON.stringify([{ id: 0, level: 46, custom: 'ottermudang' }, { id: 226, level: 47 }]), expPool: 1320 },
  ];

  constructor() { super('OceanScene'); }

  create() {
    playBgm(this, 'ferrynight');   // calm sea theme
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    this.input.keyboard?.resetKeys();
    this.px = 16 * TILE + 16; this.py = 40 * TILE + 16;
    const rx = this.registry.get('oceanReturnX') as number | undefined;
    const ry = this.registry.get('oceanReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('oceanReturnX'); this.registry.remove('oceanReturnY');

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
    SaveManager.save(this.registry, this.px, this.py, 'OceanScene');

    if (!this.registry.get('oceanSeen')) {
      this.registry.set('oceanSeen', true);
      this.time.delayedCall(500, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'You paddle out onto the open sea, your Pokémon carrying you over the swells.',
          'Currents run north to Jeju City, east to the Route 6 shore, and back south to Haean. Sea Pokémon surface all around you.',
        ], () => { this.cutsceneActive = false; });
      });
    } else {
      this.time.delayedCall(300, () => maybeLaunchEvolution(this));
    }
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.WATER || t === T.DEEP) { g.fillStyle(0x8ad0f0, 0.25); g.fillRect(c*TILE+4, r*TILE+10, 12, 2); g.fillRect(c*TILE+14, r*TILE+22, 10, 2); }
      if (t === T.FOAM)  { g.fillStyle(0xffffff, 0.7); g.fillCircle(c*TILE+10, r*TILE+14, 3); g.fillCircle(c*TILE+20, r*TILE+20, 3); g.fillCircle(c*TILE+16, r*TILE+10, 2); }
      if (t === T.ROCK)  { g.fillStyle(0x5a5044); g.fillTriangle(c*TILE+16, r*TILE+4, c*TILE+3, r*TILE+28, c*TILE+29, r*TILE+28); g.fillStyle(0x7a7060); g.fillRect(c*TILE+12, r*TILE+16, 8, 6); }
    }
    const key = '__oceanMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    const sign = (x: number, y: number, text: string) => this.add.text(x, y, text, {
      fontSize: '10px', color: '#fff', backgroundColor: '#0a3a5a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    sign(16 * TILE, 0.7 * TILE, tr('↑ Jeju City'));
    sign(16 * TILE, (ROWS - 1.4) * TILE, '↓ Haean City');
    sign((COLS - 1.5) * TILE, 20 * TILE, 'Route 6 →');
  }

  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`)) continue;
      const g = this.add.graphics().setDepth(8);
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      g.fillStyle(0x8ad0f0, 0.5); g.fillEllipse(0, 12, 22, 8);   // their surf wake
      g.fillStyle(tr.color); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
      g.fillStyle(0x224466); g.fillRect(-6, -20, 12, 4);
      g.fillStyle(0x000000); g.fillRect(-3, -14, 2, 2); g.fillRect(1, -14, 2, 2);
      this.add.text(tr.col * TILE + 16, tr.row * TILE - 12, speakerName(tr.label), {
        fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(9);
    }
  }

  private createPlayer() {
    this.mountG = this.add.graphics().setDepth(19);
    this.playerG = this.add.graphics().setDepth(20);
    this.drawChar();
  }
  private drawChar() {
    // Surf mount — a curling wave/board under the rider.
    const m = this.mountG; m.clear();
    m.setPosition(this.px, this.py);
    m.fillStyle(0x1f5f9c, 1); m.fillEllipse(0, 12, 30, 14);
    m.fillStyle(0x5aa8dc, 1); m.fillEllipse(0, 10, 26, 10);
    m.fillStyle(0x3a8fc0, 1); m.fillEllipse(0, -4, 13, 12);
    m.fillStyle(0x79cbe5, 1); m.fillEllipse(0, -1, 9, 5);
    m.fillStyle(0x101923, 1); m.fillRect(-4, -6, 2, 2); m.fillRect(2, -6, 2, 2);
    m.fillStyle(0xffffff, 0.85); m.fillEllipse(-10, 12, 8, 4); m.fillEllipse(11, 13, 7, 4);
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setData('characterSurfing3D', true);
    this.playerG.setPosition(this.px, this.py - 4);
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
    this.add.rectangle(this.scale.width / 2, 22, 300, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🌊 The Open Sea'), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: surf  SHIFT: sprint  SPACE: talk  M: menu'), {
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
    const running = moving && this.shiftKey.isDown;
    const speed = running ? this.RUN : this.SPEED;
    if (moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = this.px + (dx / len) * speed * dt, ny = this.py + (dy / len) * speed * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > (running ? 110 : 190)) { this.walkFrame ^= 1; this.walkTimer = 0; this.steps++; this.checkEncounter(); }
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
        this.registry.set('trainerReturnScene', 'OceanScene');
        this.registry.set('oceanReturnX', this.px); this.registry.set('oceanReturnY', this.py);
        this.dialog.show([tr.line, `${tr.name}: Ride or drown!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkEncounter() {
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (!t && t !== 0) { this.steps = 0; return; }
    if (!ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.14) return;
    this.steps = 0; this.nextEnc = 10 + Math.floor(Math.random() * 8);
    const e = pickEncounter(SEA_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'OceanScene');
    this.registry.set('oceanReturnX', this.px); this.registry.set('oceanReturnY', this.py);
    this.cameras.main.fadeOut(400, 30, 90, 150, () => this.scene.start('WildBattleScene'));
  }

  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    if (this.py > (ROWS - 1) * TILE) {   // south → land at Haean City
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('haeanCityReturnX', 15 * 32); this.registry.set('haeanCityReturnY', 20 * 32);
        this.scene.start('HaeanCityScene');
      });
    } else if (this.py < 1 * TILE) {   // north → Jeju City's southern harbour
      this.cutsceneActive = true;
      this.registry.set('chapter9Done', true);   // reaching Jeju by sea keeps the return ferry available
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        // Land on the central waterfront road, far enough inside the map that
        // Jeju City's south-edge exit cannot immediately bounce the player out.
        this.registry.set('jejuCityReturnX', 20 * TILE + TILE / 2);
        this.registry.set('jejuCityReturnY', 24 * TILE + TILE / 2);
        this.scene.start('JejuCityScene');
      });
    } else if (this.px > (COLS - 1) * TILE) {   // east → Route 6 shore
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('route6ReturnX', 15 * 32); this.registry.set('route6ReturnY', 30 * 32);
        this.scene.start('Route6Scene');
      });
    }
  }
}
