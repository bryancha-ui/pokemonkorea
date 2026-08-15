import Phaser from 'phaser';
import { installSurfing, isSurfing } from '../systems/SurfSystem';
import { tr, speakerName } from '../systems/i18n';
import { vanishesAfterDefeat } from '../data/Villains';
import { drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { playBgm } from '../systems/Music';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = { SEA: 0, DECK: 1, RAIL: 2, CABIN: 3, CARGO: 4, STORMGRASS: 5, GANGWAY: 6, HATCH: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 20, ROWS = 34;
const COLORS: Record<Tile, number> = {
  [T.SEA]: 0x1d4e74, [T.DECK]: 0xb98a52, [T.RAIL]: 0x7a5a32, [T.CABIN]: 0xd8d2c4,
  [T.CARGO]: 0x9a7a4a, [T.STORMGRASS]: 0x9b7448, [T.GANGWAY]: 0xc9b98f, [T.HATCH]: 0x5a5f66,
};
const SOLID = new Set<Tile>([T.SEA, T.RAIL, T.CABIN, T.CARGO]);
const ENCOUNTER = new Set<Tile>([T.STORMGRASS]);

// Storm-blown wild Pokémon (Water/Flying + a rare Electric/Water)
const FERRY_ENCOUNTERS: EncounterEntry[] = [
  { id: 278, weight: 22, minLevel: 43, maxLevel: 46, isCustom: false, catchRate: 200 }, // Wingull
  { id: 279, weight: 14, minLevel: 44, maxLevel: 47, isCustom: false, catchRate: 160 }, // Pelipper
  { id: 458, weight: 16, minLevel: 43, maxLevel: 46, isCustom: false, catchRate: 180 }, // Mantyke
  { id: 226, weight: 10, minLevel: 44, maxLevel: 47, isCustom: false, catchRate: 120 }, // Mantine
  { id: 'kingfisher', weight: 12, minLevel: 43, maxLevel: 46, isCustom: true, catchRate: 180 }, // Flying/Electric (new)
  { id: 171, weight: 5,  minLevel: 46, maxLevel: 48, isCustom: false, catchRate: 75  }, // Lanturn (rare Electric/Water)
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.SEA) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  // Hull / deck (cols 4-15, rows 2-32)
  fill(2, 32, 4, 16, T.DECK);
  // Rails around the deck edge
  fill(2, 32, 4, 5, T.RAIL); fill(2, 32, 15, 16, T.RAIL);
  fill(2, 3, 4, 16, T.RAIL); fill(31, 32, 4, 16, T.RAIL);
  // Stern cabin (superstructure) with a doorway
  fill(27, 31, 6, 14, T.CABIN);
  fill(27, 31, 9, 11, T.DECK);   // walkable corridor through the cabin (gangway → open deck)
  m[28][10] = T.HATCH;           // deck hatch → below-deck passageway (rooms + corridor)
  // Cargo crates (obstacles) mid-deck
  for (const [r, c] of [[20,6],[20,13],[24,9],[18,9]] as [number,number][]) m[r][c] = T.CARGO;
  // Forward open deck — the storm-blown chaos zone
  fill(7, 16, 6, 14, T.STORMGRASS);
  // Gangway at the stern (boarding point)
  m[31][9] = T.GANGWAY; m[31][10] = T.GANGWAY; m[32][9] = T.GANGWAY; m[32][10] = T.GANGWAY;
  // Bow disembark gap (break the front rail so you can step off to Jeju)
  m[2][9] = T.GANGWAY; m[2][10] = T.GANGWAY;
  return m;
}

export class FerryScene extends Phaser.Scene {
  // STORMGRASS is only an internal encounter-zone marker. A ship deck must
  // not sprout vegetation in the 3D terrain mirror.
  public grassTileIds3D: number[] = [];
  private map!: Tile[][];
  /** A boat deck at sea, not a town — drop any building the terrain heuristics
   *  hallucinate from the deck/cabin shading. */
  public onlyNamedBuildings = true;
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 9 * TILE + 16;
  private py = 30 * TILE + 16;   // board at the stern
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private steps = 0; private nextEnc = 6;
  private readonly SPEED = 120; private readonly RUN = 250;

  private readonly TRAINERS = [
    {
      key: 'ferry-hojun', name: 'Rich Boy Hojun', col: 6, row: 24, color: 0xddc24a, label: 'Rich\nBoy',
      line: "Daddy chartered the whole upper deck, but the battling's free. Try to scratch my Pokémon!",
      pokemon: JSON.stringify([{ id: 0, level: 43, custom: 'roundtailor' }, { id: 0, level: 44, custom: 'squirrel2' }]),
      expPool: 980,
    },
    {
      key: 'ferry-geumdol', name: 'Sailor Geumdol', col: 13, row: 22, color: 0x2a6abb, label: 'Sailor',
      line: "Thirty years on this strait, kid. The sea taught my Pokémon to hit like a rogue wave!",
      pokemon: JSON.stringify([{ id: 0, level: 44, custom: 'frysm' }, { id: 0, level: 45, custom: 'roundtailor' }]),
      expPool: 1040,
    },
  ] as const;

  constructor() { super('FerryScene'); }

  private get stormOn()    { return !!this.registry.get('ferryStorm'); }
  private get riggingDone() { return !!this.registry.get('ferryRiggingDone'); }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('ferryReturnX') as number | undefined;
    const ry = this.registry.get('ferryReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('ferryReturnX'); this.registry.remove('ferryReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawTrainers();
    this.drawMira();
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
    SaveManager.save(this.registry, this.px, this.py, 'FerryScene');

    // Sea-voyage suite, chosen by the phase we re-enter on.
    if (this.stormOn && !this.riggingDone)          playBgm(this, 'ferrystorm');
    else if (!this.registry.get('ferryBoarded'))    playBgm(this, 'ferrydusk');   // boarding at dusk
    else                                            playBgm(this, 'ferrynight');  // calm night crossing

    if (!this.registry.get('ferryBoarded')) {
      this.registry.set('ferryBoarded', true);
      this.time.delayedCall(650, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          "🌊 Haean is a dark line on the water behind you now; the sun sinks into the western sea.",
          "Rival: Old Dosik said to tell the Grandmother an old man from Haean still leaves rice cakes out for her.",
          "Rival: I've never actually left the mainland before. Now we're sailing through the dark to stop a doomsday weapon.",
          "Rival: I wouldn't trade it. For the record. (Explore the deck — and the hatch leads below to the cabins. Spar the trainers, then talk to the deckhand at the cargo.)",
        ], () => { this.cutsceneActive = false; playBgm(this, 'ferrynight'); });   // dusk departure → calm night
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
      if (t === T.SEA) { g.fillStyle(0x3a78a8, 0.5); g.fillRect(c*TILE+3, r*TILE+10, 12, 3); g.fillRect(c*TILE+14, r*TILE+22, 10, 3); }
      if (t === T.DECK) { g.lineStyle(1, 0x9a6e3a, 0.5); g.lineBetween(c*TILE, r*TILE+10, c*TILE+TILE, r*TILE+10); g.lineBetween(c*TILE, r*TILE+22, c*TILE+TILE, r*TILE+22); }
      if (t === T.RAIL) { g.fillStyle(0x5a4222); g.fillRect(c*TILE+2, r*TILE+2, TILE-4, TILE-4); g.fillStyle(0xcaa874); g.fillRect(c*TILE+4, r*TILE+4, TILE-8, 4); }
      if (t === T.CABIN) { g.fillStyle(0x88ccff, 0.6); g.fillRect(c*TILE+6, r*TILE+8, TILE-12, 10); }
      if (t === T.CARGO) { g.fillStyle(0x6a4a28); g.fillRect(c*TILE+3, r*TILE+3, TILE-6, TILE-6); g.lineStyle(2, 0x3a2a18); g.strokeRect(c*TILE+3, r*TILE+3, TILE-6, TILE-6); }
      if (t === T.HATCH) { g.fillStyle(0x3a3f46); g.fillRect(c*TILE+4, r*TILE+4, TILE-8, TILE-8); g.lineStyle(2, 0x22262c); g.strokeRect(c*TILE+4, r*TILE+4, TILE-8, TILE-8); g.fillStyle(0x14171b); g.fillRect(c*TILE+8, r*TILE+8, TILE-16, TILE-16); g.fillStyle(0xcaa25a); g.fillCircle(c*TILE+16, r*TILE+16, 3); }
      if (t === T.STORMGRASS) {
        // Wet, wind-lashed planks: the tile remains a wild-encounter zone but
        // no longer depicts reeds/grass on the deck.
        g.lineStyle(1, 0x6f5236, 0.55);
        g.lineBetween(c*TILE, r*TILE+10, c*TILE+TILE, r*TILE+10);
        g.lineBetween(c*TILE, r*TILE+22, c*TILE+TILE, r*TILE+22);
        g.fillStyle(0xbfd9df, 0.18);
        g.fillEllipse(c*TILE+17, r*TILE+17, 21, 7);
      }
    }
    const key = '__ferryMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(10 * TILE, 1 * TILE, this.riggingDone ? '↑ Disembark — Jeju City' : '↑ Bow', {
      fontSize: '10px', color: '#fff', backgroundColor: '#1a4a6a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(10 * TILE, 33 * TILE, tr('↓ Disembark — Haean City'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#1a4a6a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(10 * TILE + 16, 28 * TILE - 12, tr('↓ Below Deck'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#2a2f3699', padding: { x: 3, y: 1 },
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

  private drawMira() {
    if (this.riggingDone) return;
    const g = this.add.graphics().setDepth(8);
    g.setPosition(9 * TILE + 16, 19 * TILE + 16);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(0xddaa33); g.fillRect(-7, -8, 14, 12);   // yellow slicker
    g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
    g.fillStyle(0x222222); g.fillRect(-6, -21, 12, 5);
    g.fillStyle(0x000000); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2);
    this.add.text(9 * TILE + 16, 19 * TILE - 12, speakerName('Deckhand Mira'), {
      fontSize: '8px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(9);
  }

  // ── Player / camera / input ──────────────────────────────────────────────
  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
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
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 380, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('⛴️ The Overnight Ferry (남해 연락선)'), {
      fontSize: '14px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SPACE: talk  M: menu'), {
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
    const speed = running ? this.RUN : this.SPEED;
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
    this.checkMira();
    this.checkRigging();
    this.checkHatch();
    this.checkExits();
  }

  // Step onto the stern hatch → descend to the below-deck passageway and cabins.
  private checkHatch() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    if (this.map[row]?.[col] !== T.HATCH) return;
    this.cutsceneActive = true;
    this.registry.set('shipSpawnCol', 15); this.registry.set('shipSpawnRow', 6);
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('FerryCorridorScene'));
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
    if (!this.stormOn || this.riggingDone) return;   // storm-blown Pokémon only during the squall
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (!t || !ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.25) return;
    this.steps = 0; this.nextEnc = 6 + Math.floor(Math.random() * 6);
    const e = pickEncounter(FERRY_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'FerryScene');
    this.registry.set('ferryReturnX', this.px); this.registry.set('ferryReturnY', this.py);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  private checkTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`)) continue;
      const wx = tr.col * TILE + 16, wy = tr.row * TILE + 16;
      if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.4) {
        this.cutsceneActive = true;
        this.registry.set('trainerName', tr.name);
        this.registry.set('trainerKey', tr.key);
        this.registry.set('trainerPokemon', tr.pokemon);
        this.registry.set('trainerExpPool', tr.expPool);
        this.registry.set('trainerReturnScene', 'FerryScene');
        this.registry.set('ferryReturnX', this.px); this.registry.set('ferryReturnY', this.py);
        this.dialog.show([tr.line, `${tr.name}: Let's battle!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkMira() {
    if (this.stormOn) return;
    const wx = 9 * TILE + 16, wy = 19 * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.6) {
      this.cutsceneActive = true;
      this.registry.set('ferryStorm', true);
      playBgm(this, 'ferrystorm');   // The Strait's Fury
      this.dialog.show([
        "Deckhand Mira: We need trainers! A squall hit early — the cargo nets snapped!",
        "Deckhand Mira: Wild Pokémon got blown aboard and they're thrashing across the foredeck!",
        "Deckhand Mira: If they damage the hull lines we're in real trouble. Drive them back!",
        "Rival: You had me at 'real trouble.' The forward deck's crawling — let's go.",
        "(Storm-blown Pokémon now appear on the misty foredeck. Push through to the bow.)",
      ], () => { this.cutsceneActive = false; });
    }
  }

  private checkRigging() {
    if (!this.stormOn || this.riggingDone) return;
    if (this.py > 6 * TILE) return;   // only at the bow
    this.cutsceneActive = true;
    this.registry.set('ferryRiggingDone', true);
    playBgm(this, 'ferrynight');   // squall passes → calm night again
    this.dialog.show([
      "⛈️ A critical hull line whips loose in the wind!",
      "Together, you send out your lead and the Rival sends his starter — you HAUL the snapped line back into its cleat.",
      "Secured. The boat steadies and rides out the squall.",
      "Deckhand Mira: Three years on this route and I've never seen passengers do THAT.",
      "Deckhand Mira: Here — found it wedged in the cargo. You earned it more than the shipping company did.",
      "💧 Received Mystic Water and ⭐ Big Pearl ×2!",
      "Rival: Get some sleep. For real this time. We land at dawn.",
      "(The bow is clear — disembark to the north when you're ready.)",
    ], () => {
      this.cutsceneActive = false;
      // refresh signpost
      this.add.text(10 * TILE, 1 * TILE, tr('↑ Disembark — Jeju Vents'), {
        fontSize: '10px', color: '#fff', backgroundColor: '#1a4a6a99', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(5);
    });
  }

  private checkExits() {
    if (isSurfing(this.playerG)) return;
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // North → disembark at Jeju City (after the rigging is secured).
    // The bow gap is only at row 2 (cols 9-10), so this fires only there.
    if (this.py < 3 * TILE && this.riggingDone) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(500, 0, 0, 0, () => {
        this.registry.set('jejuCityReturnX', 16 * 32 + 16);
        this.registry.set('jejuCityReturnY', 22 * 32 + 16);  // Spawn at south edge of city
        this.scene.start('JejuCityScene');
      });
    }
    // South → step off the stern gangway (rows 31-32, cols 9-10) back to Haean City,
    // the ferry's home port. Row 33 is open sea, so the trigger sits on the gangway.
    if (this.py > 31.6 * TILE && this.px > 8 * TILE && this.px < 11.5 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('haeanCityReturnX', 3 * 32); this.registry.set('haeanCityReturnY', 12 * 32);
        this.scene.start('HaeanCityScene');
      });
    }
  }
}
