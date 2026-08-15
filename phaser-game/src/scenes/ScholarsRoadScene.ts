import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { vanishesAfterDefeat } from '../data/Villains';
import { drawTrainerBody, drawRiderBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { PartySystem } from '../systems/PartySystem';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';
import { markRivalPortrait } from '../data/BattlePortraits';

// ── Tiles ─────────────────────────────────────────────────────────────────────
// Scholars' Road (선비로) — the region's Victory Road: a winding stone mountain
// pass dotted with scholar statues, pavilions and waterfalls.
const T = { ROCK: 0, PATH: 1, GRASS: 2, WATER: 3, STATUE: 4, GATE: 5, PAVILION: 6, SCANGATE: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 58;
const COLORS: Record<Tile, number> = {
  // GRASS is a vivid green (higher saturation) so the 3D pass reads it as tall
  // grass and grows animated tufts, instead of a flat green patch.
  [T.ROCK]: 0x4a4640, [T.PATH]: 0xc8bda4, [T.GRASS]: 0x3a7a2a, [T.WATER]: 0x3a78c8,
  [T.STATUE]: 0x8a8276, [T.GATE]: 0x2a2620, [T.PAVILION]: 0xb89a6a, [T.SCANGATE]: 0x2a3a4a,
};
const SOLID = new Set<Tile>([T.ROCK, T.WATER, T.STATUE, T.GATE]);
const ENCOUNTER = new Set<Tile>([T.GRASS]);

// The eight region badges scanned at the Scholars' Road checkpoint.
const BADGES: { flag: string; name: string }[] = [
  { flag: 'gymLeaderDefeated', name: 'Shadow Court Badge (Capitol)' },
  { flag: 'baekduGymDefeated', name: 'Summit Dojo Badge (Baekdu)' },
  { flag: 'geumgangGymDefeated', name: 'Lantern Stage Badge (Geumgang)' },
  { flag: 'haeanGymDefeated', name: 'Tidal Arena Badge (Haean)' },
  { flag: 'forestGymDefeated', name: 'Ancient Keeper Badge (Forest)' },
  { flag: 'dolmoeGymDefeated', name: 'Bedrock Badge (Dolmoe)' },
  { flag: 'seoraeGymDefeated', name: 'Frostbell Badge (Seorae)' },
  { flag: 'sunriseGymDefeated', name: 'Stormwatcher Badge (Sunrise)' },
];

// High-level wild Pokémon (Lv 58-62) — a grinding spot before the League.
const ROAD_ENCOUNTERS: EncounterEntry[] = [
  { id: 'dracopaia',     weight: 12, minLevel: 53, maxLevel: 56, isCustom: true, catchRate: 90 },  // Water/Dragon
  { id: 'beardiedragon', weight: 12, minLevel: 53, maxLevel: 56, isCustom: true, catchRate: 90 },  // Fire/Dragon
  { id: 'unsilgami',     weight: 10, minLevel: 53, maxLevel: 56, isCustom: true, catchRate: 80 },  // Psychic/Bug
  { id: 'sotori',        weight: 10, minLevel: 53, maxLevel: 56, isCustom: true, catchRate: 80 },  // Ghost/Fighting
  { id: 'gorcobat',      weight: 12, minLevel: 53, maxLevel: 56, isCustom: true, catchRate: 110 }, // Grass/Fighting
  { id: 'prowlrock',     weight: 12, minLevel: 53, maxLevel: 56, isCustom: true, catchRate: 110 }, // Rock/Flying
  { id: 248, weight: 8, minLevel: 55, maxLevel: 57, isCustom: false, catchRate: 45 },              // Tyranitar
  { id: 445, weight: 8, minLevel: 55, maxLevel: 57, isCustom: false, catchRate: 45 },              // Garchomp
];

interface RoadTrainer {
  key: string; name: string; col: number; row: number; label: string;
  line: string; pokemon: { id: number; level: number; custom?: string }[]; expPool: number;
}

/** Linear-interpolate between two 0xRRGGBB colours (t: 0 = a, 1 = b). */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.ROCK) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  // Switchback stone path up the mountain
  fill(52, ROWS, 10, 14, T.PATH);   // entry from Capitol
  fill(50, 54, 3, 14, T.PATH);
  fill(40, 54, 3, 7, T.PATH);
  fill(38, 42, 3, 21, T.PATH);
  fill(28, 42, 17, 21, T.PATH);
  fill(26, 30, 3, 21, T.PATH);
  fill(16, 30, 3, 7, T.PATH);
  fill(14, 18, 3, 21, T.PATH);
  fill(6, 18, 17, 21, T.PATH);
  fill(4, 8, 9, 21, T.PATH);
  fill(2, 8, 9, 15, T.PATH);        // final approach to the League gate
  // Grass patches along the ledges (wild encounters)
  fill(50, 53, 6, 10, T.GRASS);
  fill(38, 41, 9, 14, T.GRASS);
  fill(26, 29, 8, 13, T.GRASS);
  fill(14, 17, 10, 15, T.GRASS);
  fill(40, 53, 4, 6, T.GRASS);
  // A waterfall + stream crossing the rock face
  for (let r = 6; r < 40; r += 1) { if (m[r][22] === T.ROCK) m[r][22] = T.WATER; }
  fill(43, 46, 21, COLS, T.WATER);
  // Scholar statues lining the path
  for (const [r, c] of [[51,8],[39,15],[27,7],[15,16],[7,10],[7,18]] as [number,number][])
    if (m[r]?.[c] === T.ROCK) m[r][c] = T.STATUE;
  // Rest Pavilion (a heal spot) at the mid-point
  fill(31, 33, 12, 16, T.PAVILION);
  // Badge-scanner checkpoint across the entry chokepoint (needs every badge)
  for (let c = 10; c < 14; c++) m[54][c] = T.SCANGATE;
  // The League gate at the summit (opens once the Rival is beaten)
  fill(2, 4, 11, 13, T.GATE);
  fill(0, 2, 9, 15, T.PATH);        // the League doors beyond
  return m;
}

export class ScholarsRoadScene extends Phaser.Scene {
  public grassTileIds3D = [T.GRASS];
  private map!: Tile[][];
  /** A mountain road, not a town: drop any building the terrain heuristics
   *  hallucinate from cliff/forest shading. */
  public onlyNamedBuildings = true;
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private gateGfx!: Phaser.GameObjects.Graphics;
  private px = 12 * TILE + 16;
  private py = 56 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;
  private readonly PAV = { col: 13, row: 32 };

  private readonly TRAINERS: RoadTrainer[] = [
    {
      key: 'road-hyeonu', name: 'Scholar-Trainer Hyeonu', col: 6, row: 45, label: 'Scholar\nHyeonu',
      line: "Hyeonu: The road tests the prepared. Recite your answer in battle.",
      pokemon: [{ id: 0, level: 55, custom: 'unsilgami' }, { id: 437, level: 56 }], // Psychic/Bug, Bronzong (Steel/Psychic)
      expPool: 3200,
    },
    {
      key: 'road-dawon', name: 'Ace Trainer Dawon', col: 18, row: 33, label: 'Ace\nDawon',
      line: "Dawon: I've climbed this road three times. The dragons and I know every stone.",
      pokemon: [{ id: 0, level: 56, custom: 'dracopaia' }, { id: 445, level: 57 }], // Water/Dragon, Garchomp (Dragon/Ground)
      expPool: 3400,
    },
    {
      key: 'road-munseok', name: 'Veteran Munseok', col: 6, row: 20, label: 'Veteran\nMunseok',
      line: "Munseok: Forty years a trainer. The League gate is just over my shoulder — earn your way past me.",
      pokemon: [{ id: 0, level: 56, custom: 'gorcobat' }, { id: 464, level: 57 }, { id: 448, level: 57 }], // Grass/Fighting, Rhyperior (Rock/Ground), Lucario (Steel/Fighting)
      expPool: 3800,
    },
  ];

  constructor() { super('ScholarsRoadScene'); }

  private get gateOpen() { return !!this.registry.get('trainerDefeated_rival-4'); }
  private get badgeGateOpen() { return BADGES.every(b => !!this.registry.get(b.flag)); }

  create() {

    playBgm(this, 'scholarsroad');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('scholarsRoadReturnX') as number | undefined;
    const ry = this.registry.get('scholarsRoadReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('scholarsRoadReturnX'); this.registry.remove('scholarsRoadReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawBadgeGate();
    this.drawTrainers();
    if (!this.gateOpen) {
      const rival = this.drawFigure(12, 4, 0x2255cc, 0xffcc99, 'Rival', '#88ccff');
      markRivalPortrait(rival, this.registry);
    }
    this.createPlayer();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [T.WATER], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'ScholarsRoadScene');

    if (!this.registry.get('scholarsRoadSeen')) {
      this.registry.set('scholarsRoadSeen', true);
      this.time.delayedCall(600, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'A grand stone gate behind the palace marks the trailhead of Scholars\' Road (선비로), inscribed with a single line:',
          '"The road tests the prepared. Walk it, and be measured."',
          'In old Onnuri, scholars walked this road TO the capital to sit the royal exam. Today, trainers walk it OUT, to sit the highest exam of all — the Pokémon League.',
          'Rest at the pavilion midway (SPACE) to heal. The League waits at the summit.',
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
      const raw = this.map[r][c];
      // The badge gate is drawn as its own animated object — render plain path beneath it.
      const t = (this.gateOpen && raw === T.GATE) || raw === T.SCANGATE ? T.PATH : raw;
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.ROCK) { g.fillStyle(0x35322c); g.fillRect(c*TILE+4, r*TILE+5, 8, 7); g.fillRect(c*TILE+18, r*TILE+18, 9, 8); }
      if (t === T.PATH) { g.fillStyle(0xb0a488, 0.6); g.fillRect(c*TILE+5, r*TILE+6, TILE-10, 2); g.fillRect(c*TILE+5, r*TILE+20, TILE-10, 2); }
      if (t === T.GRASS) { g.fillStyle(0x33561f, 0.85); for (let i=0;i<3;i++){ g.fillRect(c*TILE+5+i*8, r*TILE+16, 2, 12); g.fillRect(c*TILE+7+i*8, r*TILE+12, 2, 16);} }
      if (t === T.WATER) { g.fillStyle(0x9fd0ff, 0.5); g.fillRect(c*TILE+6, r*TILE+3, 5, TILE-6); g.fillStyle(0xffffff, 0.4); g.fillRect(c*TILE+16, r*TILE+2, 3, TILE-4); }
      if (t === T.STATUE) { g.fillStyle(0x6e6a60); g.fillRect(c*TILE+10, r*TILE+6, 12, 22); g.fillStyle(0xb8b2a4); g.fillCircle(c*TILE+16, r*TILE+8, 6); }
      if (t === T.PAVILION) { g.fillStyle(0x7a5a2a); g.fillRect(c*TILE, r*TILE, TILE, 5); g.fillStyle(0xcc3344, 0.6); g.fillRect(c*TILE, r*TILE, TILE, 2); }
      if (t === T.GATE) { g.fillStyle(0x18140e); g.fillRect(c*TILE, r*TILE, TILE, TILE); g.fillStyle(0x6a5a3a); for (let i=0;i<3;i++) g.fillRect(c*TILE+4+i*9, r*TILE+2, 3, TILE-4); }
    }
    const key = '__scholarsRoadMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(12 * TILE, 0.6 * TILE, this.gateOpen ? '↑ Pokémon League' : '⛩ League Gate', {
      fontSize: '10px', color: '#ffe0a0', backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(13 * TILE, 31.4 * TILE, tr('⛩ Rest Pavilion'), {
      fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(12 * TILE, 57.4 * TILE, tr('↓ Capitol City'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`) && vanishesAfterDefeat(tr.key)) continue;
      this.drawFigure(tr.col, tr.row, 0x3a4a2a, 0xffcc99, tr.label, '#d7e8b0');
    }
  }
  private drawFigure(col: number, row: number, coat: number, skin: number, label: string, labelColor: string) {
    const g = this.add.graphics().setDepth(8);
    g.setPosition(col * TILE + 16, row * TILE + 16);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(coat); g.fillRect(-7, -8, 14, 12);
    g.fillStyle(0x222222); g.fillRect(-6, 4, 5, 8); g.fillRect(1, 4, 5, 8);
    g.fillStyle(skin); g.fillRect(-6, -20, 12, 11);
    g.fillStyle(0x1a1008); g.fillRect(-6, -21, 12, 5);
    g.fillStyle(0x000000); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2);
    this.add.text(col * TILE + 16, row * TILE - 14, label, {
      fontSize: '8px', color: labelColor, backgroundColor: '#00000099', padding: { x: 2, y: 1 }, align: 'center',
    }).setOrigin(0.5).setDepth(9);
    return g;
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
    this.add.rectangle(this.scale.width / 2, 22, 420, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('📜 Scholars\' Road (선비로)'), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 34, '', {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  SPACE: talk/rest  M: menu'), {
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
    this.checkBadgeGate();
    this.checkPavilion();
    this.checkTrainers();
    this.checkRival();
    this.checkExits();
  }

  // ── Badge gate visuals ─────────────────────────────────────────────────────
  /** A checkpoint arch across the path: sealed = red barrier, open = green & clear. */
  private drawBadgeGate() {
    this.gateGfx = this.add.graphics().setDepth(6);
    // OverworldMirror replaces this fallback drawing with a true 3D scanner.
    // Coordinates are pinned to the centre of the four collision tiles.
    this.gateGfx.setData('badgeScanner3D', { x: 12 * TILE, y: 54 * TILE + TILE / 2 });
    this.gateGfx.setData('badgeScannerTotal3D', BADGES.length);
    this.renderGate(this.registry.get('scholarsBadgeVerified') ? 0 : 1);
  }

  /** Redraw the gate at `closed` in [0=open, 1=sealed]. */
  private renderGate(closed: number) {
    const g = this.gateGfx; g.clear();
    g.setData('badgeScannerClosed3D', Phaser.Math.Clamp(closed, 0, 1));
    g.setData('badgeScannerBadges3D', BADGES.filter(b => !!this.registry.get(b.flag)).length);
    const x0 = 10 * TILE, x1 = 14 * TILE, y = 54 * TILE;
    const frame = lerpColor(0x3a9a3a, 0x9a3320, closed);   // green ↔ red
    const lamp  = lerpColor(0x9affa0, 0xff5a44, closed);
    // Stone posts either side of the path.
    g.fillStyle(0x5a4a32); g.fillRect(x0 - 2, y - 26, 9, TILE + 26); g.fillRect(x1 - 7, y - 26, 9, TILE + 26);
    g.fillStyle(0x6e5c3e); g.fillRect(x0 - 4, y - 30, 13, 6); g.fillRect(x1 - 9, y - 30, 13, 6);
    // Lintel beam (recolours with state).
    g.fillStyle(frame); g.fillRect(x0 - 6, y - 30, (x1 - x0) + 12, 10);
    g.lineStyle(2, 0x1c1c14, 0.6); g.strokeRect(x0 - 6, y - 30, (x1 - x0) + 12, 10);
    // Status lamps on each post.
    g.fillStyle(lamp); g.fillCircle(x0 + 3, y - 22, 4); g.fillCircle(x1 - 3, y - 22, 4);
    // The energy barrier — retracts upward as it opens.
    if (closed > 0.02) {
      const h = TILE * closed;
      g.fillStyle(0xff5a44, 0.35 * closed); g.fillRect(x0 + 5, y, (x1 - x0) - 10, h);
      g.fillStyle(0xffd24a, 0.9);
      for (let bx = x0 + 7; bx < x1 - 6; bx += 11) g.fillRect(bx, y, 4, h);
    }
  }

  /** Animate the gate from sealed to open (green glow + barrier lifts). */
  private openBadgeGate() {
    this.tweens.addCounter({
      from: 1, to: 0, duration: 850, ease: 'Cubic.Out',
      onUpdate: t => this.renderGate(t.getValue() ?? 0),
      onComplete: () => this.renderGate(0),
    });
  }

  /** The badge scanner at the chokepoint — verifies every region badge. */
  private checkBadgeGate() {
    const wx = 11.5 * TILE, wy = 54 * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) > TILE * 1.8) return;
    if (this.badgeGateOpen) {
      if (this.registry.get('scholarsBadgeVerified')) return;
      this.registry.set('scholarsBadgeVerified', true);
      this.openBadgeGate();   // the gate glows green and swings open
      this.cutsceneActive = true;
      this.dialog.show([
        `Badge Scanner: Scanning trainer credentials... all ${BADGES.length} region badges verified.`,
        'Badge Scanner: The road tests the prepared. It is yours. Pass.',
      ], () => { this.cutsceneActive = false; });
    } else {
      const have = BADGES.filter(b => !!this.registry.get(b.flag)).length;
      const missing = BADGES.filter(b => !this.registry.get(b.flag)).map(b => b.name);
      this.cutsceneActive = true;
      this.dialog.show([
        `Badge Scanner: Scanning trainer credentials... ${have} / ${BADGES.length} badges detected.`,
        `Badge Scanner: The gate is sealed. Still missing: ${missing.join(', ')}.`,
        'Badge Scanner: Return when you have earned every badge in the region.',
      ], () => { this.py = 56 * TILE + 16; this.cutsceneActive = false; });
    }
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      const t = this.map[row][col];
      if (t === T.GATE && this.gateOpen) return false;
      if (t === T.SCANGATE) return !this.registry.get('scholarsBadgeVerified');   // open once scanned
      return SOLID.has(t);
    });
  }

  private checkEncounter() {
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (!t || !ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.20) return;
    this.steps = 0; this.nextEnc = 8 + Math.floor(Math.random() * 8);
    const e = pickEncounter(ROAD_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'ScholarsRoadScene');
    this.registry.set('scholarsRoadReturnX', this.px); this.registry.set('scholarsRoadReturnY', this.py);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  /** Rest Pavilion — heal the whole party. */
  private checkPavilion() {
    const wx = this.PAV.col * TILE + 16, wy = this.PAV.row * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) > TILE * 1.6) return;
    this.enterPrompt.setText(tr('SPACE — Rest & heal your team')).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    PartySystem.healAll(this.registry);
    this.cutsceneActive = true;
    this.enterPrompt.setVisible(false);
    this.dialog.show(['You rest at the pavilion. Your Pokémon were fully healed!'], () => { this.cutsceneActive = false; });
  }

  private checkTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`)) continue;
      const wx = tr.col * TILE + 16, wy = tr.row * TILE + 16;
      if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.5) {
        this.cutsceneActive = true;
        this.registry.set('trainerName', tr.name);
        this.registry.set('trainerKey', tr.key);
        this.registry.set('trainerPokemon', JSON.stringify(tr.pokemon));
        this.registry.set('trainerExpPool', tr.expPool);
        this.registry.set('trainerReturnScene', 'ScholarsRoadScene');
        this.registry.set('scholarsRoadReturnX', this.px); this.registry.set('scholarsRoadReturnY', this.py);
        this.dialog.show([tr.line, `${tr.name}: Show me the road's lesson!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  /** Rival Battle #4 — the last test at the summit gate (their full strongest team). */
  private checkRival() {
    if (this.gateOpen) return;
    const wx = 12 * TILE + 16, wy = 4 * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) > TILE * 2.2) return;
    this.cutsceneActive = true;
    const rivalKey = (this.registry.get('rivalKey') as string) ?? 'vipour';
    const rivalFinal = rivalKey === 'munkain' ? 'banderado'
      : rivalKey === 'vipour' ? 'feldaconda' : 'thanatoat';
    const launch = () => {
      this.registry.set('trainerName', 'Rival');
      this.registry.set('trainerKey', 'rival-4');
      this.registry.set('trainerPokemon', JSON.stringify([
        { id: 0, level: 55, custom: 'corrpanda' },     // Dark — Haze / screens lead
        { id: 0, level: 56, custom: 'squirrel2' },      // Soarrel — Normal/Flying pivot
        { id: 0, level: 56, custom: 'martbadger' },     // Dark/Steel — Sucker Punch
        { id: 0, level: 57, custom: 'chattyscream' },   // Normal/Dark — Nasty Plot
        { id: 0, level: 57, custom: 'tokkigongju' },    // Baengmadam — Dark/Fairy longtime ace
        { id: 0, level: 59, custom: rivalFinal },       // Starter FINAL evo — signature closer
      ]));
      this.registry.set('trainerExpPool', 5200);
      this.registry.set('trainerReturnScene', 'ScholarsRoadScene');
      this.registry.set('scholarsRoadReturnX', 12 * TILE + 16);
      this.registry.set('scholarsRoadReturnY', 6 * TILE + 16);
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    };
    if (!this.registry.get('rival4Seen')) {
      this.registry.set('rival4Seen', true);
      this.dialog.show([
        "Your Rival leans against the final gate, arms crossed — exactly the way they did outside their house on the first morning.",
        "Rival: Knew you'd make it up here. I've been waiting since dawn.",
        "Rival: We started this whole thing racing each other to Capitol City. And now here we are — same city behind us, the very top of the region in front of us.",
        "Rival: I'm not the Magistrate right now. Not a Gym Leader. Just your friend who's chased you across this entire peninsula trying to stay one step ahead.",
        "Rival: One more battle. My best team — everything I've got. Get past me, and you're ready for the Four.",
        "Rival: Don't hold back. I'd never forgive you if you did.",
      ], launch);
    } else {
      this.dialog.show(["Rival: One more battle. Everything I've got. Ready?"], launch);
    }
  }

  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // South → back down to Capitol City
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('capitalReturnX', 24 * 32 + 16); this.registry.set('capitalReturnY', 31 * 32 + 16);
        this.scene.start('CapitolCityScene');
      });
      return;
    }
    // North through the open gate → the Pokémon League
    if (this.gateOpen && this.py < 1 * TILE) {
      this.cutsceneActive = true;
      if (!this.registry.get('leagueDoorsOpened')) {
        this.registry.set('leagueDoorsOpened', true);
        this.dialog.show([
          "Rival (stepping aside): ...Yeah. That's the trainer I've been chasing this whole time.",
          "Rival: Go on. The Four are waiting — and so is HE, at the very top.",
          "Rival: Whatever happens in there... you already proved everything you needed to prove. To me, anyway. Now go win it.",
          'The great doors of the Pokémon League swing open. You step through.',
        ], () => this.toLeague());
      } else {
        this.toLeague();
      }
    }
  }

  private toLeague() {
    this.cameras.main.fadeOut(500, 0, 0, 0, () => {
      this.registry.set('leaguePlazaReturnX', 14 * 32);
      this.registry.set('leaguePlazaReturnY', 26 * 32 + 16);
      this.scene.start('LeaguePlazaScene');
    });
  }
}
