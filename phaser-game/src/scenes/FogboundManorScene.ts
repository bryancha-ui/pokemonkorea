import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { vanishesAfterDefeat } from '../data/Villains';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';

// ── Fogbound Manor (안개저택) ─────────────────────────────────────────────────────
// The abandoned manor on the fog road at the edge of Muyeonhang, reached from town.
// Dark halls thick with drifting mist and guttering candles, haunted by ghost
// Pokémon — and deep inside, the Fog-Wraith Gengar that Chief Mukyeong sends you
// to face. Beating it clears the way to the 노스단 officer's exam back in town.

const T = { FLOOR: 0, WALL: 1, FURN: 2, RUG: 3, GATE: 4 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 22, ROWS = 20;
const COLORS: Record<Tile, number> = { [T.FLOOR]: 0x3a3340, [T.WALL]: 0x24202c, [T.FURN]: 0x4a3a2e, [T.RUG]: 0x5a2a3a, [T.GATE]: 0x2a2434 };
const SOLID = new Set<Tile>([T.WALL, T.FURN]);   // GATE handled separately (locked until the vault key is won)
const ENCOUNTER = new Set<Tile>([T.FLOOR, T.RUG]);

const THREAT_KEY = 'eosa-chongjin-threat';
const THREAT = { col: 10, row: 16 };
const KEY_HOLDER = 'manor-yeong';                // the trainer who carries the 보석함 (vault) key
const GATE_ROW = 13, GATE_C1 = 9, GATE_C2 = 13;  // the séance-vault door across the corridor

// Wild ghosts of the manor.
const FM_ENCOUNTERS: EncounterEntry[] = [
  { id: 93,  weight: 16, minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 90  }, // Haunter
  { id: 200, weight: 14, minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 120 }, // Misdreavus
  { id: 353, weight: 12, minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 120 }, // Shuppet
  { id: 355, weight: 12, minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 120 }, // Duskull
  { id: 425, weight: 10, minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 90  }, // Drifloon
  { id: 354, weight: 8,  minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 90  }, // Banette
  { id: 356, weight: 8,  minLevel: 68, maxLevel: 70, isCustom: false, catchRate: 60  }, // Dusclops
  { id: 94,  weight: 4,  minLevel: 69, maxLevel: 71, isCustom: false, catchRate: 45  }, // Gengar (rare)
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.FLOOR) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  // outer walls
  fill(0, 2, 0, COLS, T.WALL); fill(ROWS - 2, ROWS, 0, COLS, T.WALL);
  fill(0, ROWS, 0, 2, T.WALL); fill(0, ROWS, COLS - 2, COLS, T.WALL);
  fill(0, 2, 9, 13, T.FLOOR);   // manor doorway (from the fog road)
  // interior partitions with a central-corridor gap
  fill(7, 8, 2, 9, T.WALL);  fill(7, 8, 13, 20, T.WALL);
  fill(13, 14, 2, 9, T.WALL); fill(13, 14, 13, 20, T.WALL);
  // a long crimson runner down the central corridor to the séance hall
  fill(2, ROWS - 2, 10, 12, T.RUG);
  // the locked séance-vault door across the corridor (the 보석함 door — needs the key)
  fill(GATE_ROW, GATE_ROW + 1, GATE_C1, GATE_C2, T.GATE);
  // scattered furniture — shelves, a grand piano, coffins — in the side rooms
  for (const [r, c] of [[3,3],[4,3],[3,4],[10,3],[11,3],[16,3],[16,4],
                        [3,17],[4,17],[10,18],[10,17],[16,17],[16,18],
                        [4,6],[10,6],[16,6],[4,15],[10,15],[16,15]] as [number,number][]) m[r][c] = T.FURN;
  return m;
}

interface Trainer { key: string; name: string; col: number; row: number; color: number; label: string; line: string; pokemon: string; expPool: number; }

export class FogboundManorScene extends Phaser.Scene {
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = 11 * TILE + 16; private py = 3 * TILE + 16;
  private facing = 0; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private spawnGuard = false; private spawnPx = 0; private spawnPy = 0;
  private steps = 0; private nextEnc = 8;
  private readonly SPEED = 120; private readonly RUN = 250;
  private threatG?: Phaser.GameObjects.Container;
  private fogWisps: Phaser.GameObjects.Graphics[] = [];

  private readonly TRAINERS: Trainer[] = [
    { key: 'manor-boryeong', name: 'Hex Maniac Boryeong', col: 5, row: 10, color: 0x5a2a6a, label: 'Hex\nManiac',
      line: "Heeheehee... the manor whispered you'd come. It so wants to keep you. Won't you play with my spirits first?",
      pokemon: JSON.stringify([{ id: 429, level: 69 }, { id: 354, level: 70 }]), expPool: 2100 },
    { key: 'manor-yeong', name: 'Medium Yeong', col: 16, row: 11, color: 0x3a4a6a, label: 'Keeper\n🔑',
      line: "So — you seek the thing that grins in the séance hall? Heh heh... its door is locked, and I keep the only key.\nBest me, if you dare, and the 보석함 key is yours.",
      pokemon: JSON.stringify([{ id: 356, level: 69 }, { id: 426, level: 70 }]), expPool: 2100 },
  ];

  constructor() { super('FogboundManorScene'); }

  private get missionTaken() { return !!this.registry.get('ChongjinCitySceneMissionTaken'); }
  private get gengarDone() { return !!this.registry.get('trainerDefeated_' + THREAT_KEY); }
  private get hasVaultKey() { return !!this.registry.get('trainerDefeated_' + KEY_HOLDER); }   // won from the medium
  private get vaultOpen() { return !!this.registry.get('manorVaultOpen'); }
  private gateLock?: Phaser.GameObjects.Container;

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0; this.fogWisps = [];
    playBgm(this, 'hauntedhouse');
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('FogboundManorSceneReturnX') as number | undefined;
    const ry = this.registry.get('FogboundManorSceneReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; } else { this.px = 11 * TILE + 16; this.py = 3 * TILE + 16; }
    this.registry.remove('FogboundManorSceneReturnX'); this.registry.remove('FogboundManorSceneReturnY');
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true; this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.spawnThreat();
    this.drawTrainers();
    this.drawGate();
    this.drawAtmosphere();
    this.playerG = this.add.graphics().setDepth(20); this.drawChar();
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.setZoom(1.7);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(500);
    SaveManager.save(this.registry, this.px, this.py, 'FogboundManorScene');
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));

    // Just beat the medium and picked up the key? Announce it once on return.
    if (this.missionTaken && this.hasVaultKey && !this.gengarDone && !this.registry.get('manorKeySeen')) {
      this.registry.set('manorKeySeen', true);
      this.time.delayedCall(550, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'As Medium Yeong\'s spirits scatter, a cold iron key slips from her sleeve and rings on the floor.',
          '🔑 You obtained the 보석함 (vault) KEY! The locked séance-hall door down the corridor can be opened now.',
        ], () => { this.cutsceneActive = false; });
      });
    }
  }

  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.FLOOR) { g.fillStyle(0x2c2632, 0.7); g.fillRect(x, y + 15, TILE, 2); g.fillRect(x + 15, y, 2, TILE); }
      if (t === T.WALL) { g.fillStyle(0x161320); g.fillRect(x + 3, y + 4, 9, 9); g.fillRect(x + 17, y + 16, 9, 9); g.fillStyle(0x3a3348, 0.4); g.fillRect(x + 4, y + 5, 4, 3); }
      if (t === T.FURN) { g.fillStyle(0x2e241c); g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4); g.fillStyle(0x6a5238); g.fillRect(x + 5, y + 6, TILE - 10, 4); g.fillRect(x + 5, y + 14, TILE - 10, 4); g.fillStyle(0xcfcfe0, 0.25); g.fillRect(x + 4, y + 4, 6, 6); }   // dusty shelf w/ cobweb
      if (t === T.RUG) { g.fillStyle(0x7a2f44, 1); g.fillRect(x + 4, y, TILE - 8, TILE); g.fillStyle(0xcaa24a, 0.7); g.fillRect(x + 6, y + 2, 2, TILE - 4); g.fillRect(x + TILE - 8, y + 2, 2, TILE - 4); }
      if (t === T.GATE) { g.fillStyle(0x1a1622); g.fillRect(x, y, TILE, TILE); g.fillStyle(0x3a3448); g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4); g.fillStyle(0x554d68); for (let i = 0; i < 3; i++) g.fillRect(x + 4, y + 5 + i * 8, TILE - 8, 3); g.fillStyle(0x8a7f4a); g.fillRect(x + 14, y + 12, 4, 8); }   // ornate iron vault door
    }
    const key = '__fogManor__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
    this.add.text(11 * TILE, 0.6 * TILE, tr('↑ Muyeonhang'), { fontSize: '9px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
  }

  private spawnThreat() {
    // The Fog-Wraith always looms in the séance hall until beaten — reaching it no
    // longer depends on the mission flag, so a player who wandered in early (or got
    // stuck on the key puzzle) can still face it.
    if (this.gengarDone) return;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3); g.fillEllipse(0, 15, 34, 9);
    g.fillStyle(0x5a3a7a, 1); g.fillCircle(0, 0, 15);                    // ghostly purple body
    g.fillStyle(0x452c60, 1); g.fillCircle(0, 5, 13);
    for (let i = -1; i <= 1; i++) g.fillTriangle(i * 9 - 3, -12, i * 9 + 3, -12, i * 9, -22);   // spikes
    g.fillStyle(0xff3a3a, 1); g.fillCircle(-5, -3, 3.6); g.fillCircle(5, -3, 3.6);              // burning eyes
    g.fillStyle(0x000000, 1); g.fillCircle(-5, -2, 1.6); g.fillCircle(5, -2, 1.6);
    g.fillStyle(0xffffff, 0.9); for (let i = -2; i <= 2; i++) g.fillRect(i * 4 - 1, 3, 3, 4);   // toothy grin
    const label = this.add.text(0, -32, tr('⚠ Fog-Wraith Gengar (안개 팬텀)'), { fontSize: '9px', color: '#d89aff', fontStyle: 'bold', backgroundColor: '#00000099', padding: { x: 3, y: 1 } }).setOrigin(0.5);
    const cont = this.add.container(THREAT.col * TILE + 16, THREAT.row * TILE + 16, [g, label]).setDepth(18);
    this.tweens.add({ targets: cont, y: cont.y - 6, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: cont, alpha: { from: 1, to: 0.55 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });  // flickers in and out
    this.threatG = cont;
  }

  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get('trainerDefeated_' + tr.key) && vanishesAfterDefeat(tr.key)) continue;
      const g = this.add.graphics().setDepth(8);
      drawNpcBody(g, tr.color, { hair: 0x2a2230 });
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      this.add.text(tr.col * TILE + 16, tr.row * TILE - 12, speakerName(tr.label), { fontSize: '8px', color: '#d8c8ff', backgroundColor: '#00000099', padding: { x: 2, y: 1 }, align: 'center' }).setOrigin(0.5).setDepth(9);
    }
  }

  /** Candlelight, drifting fog wisps and a smothering darkness — the manor's dread. */
  private drawAtmosphere() {
    // guttering candles on the walls
    for (const [c, r] of [[3, 5], [18, 5], [3, 12], [18, 12], [8, 8], [13, 8]] as [number, number][]) {
      const cg = this.add.graphics().setDepth(6);
      const x = c * TILE + 16, y = r * TILE + 16;
      cg.fillStyle(0xe8e0d0); cg.fillRect(x - 2, y - 2, 4, 10);
      cg.fillStyle(0xffcf5a, 0.95); cg.fillEllipse(x, y - 6, 6, 10);
      cg.fillStyle(0xff8a2a, 0.7); cg.fillEllipse(x, y - 4, 3, 6);
      this.tweens.add({ targets: cg, alpha: { from: 1, to: 0.6 }, duration: 300 + Math.random() * 300, yoyo: true, repeat: -1 });
    }
    // heavy darkness (dimmer near the edges)
    const dark = this.add.graphics().setScrollFactor(0).setDepth(30);
    dark.fillStyle(0x05040a, 0.42); dark.fillRect(0, 0, this.scale.width, this.scale.height);
    // drifting fog wisps that float across the halls
    for (let i = 0; i < 7; i++) {
      const w = this.add.graphics().setDepth(19);
      w.fillStyle(0xcfd6e2, 0.12); w.fillEllipse(0, 0, 90, 44);
      w.setPosition(Math.random() * COLS * TILE, Math.random() * ROWS * TILE);
      this.tweens.add({ targets: w, x: w.x + (Math.random() > 0.5 ? 120 : -120), duration: 4000 + Math.random() * 3000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.fogWisps.push(w);
    }
  }

  private drawChar() {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }
  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 34, '', { fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 8, y: 4 } }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    this.add.rectangle(this.scale.width / 2, 22, 360, 30, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🏚 Fogbound Manor (안개저택)'), { fontSize: '13px', color: '#d8c8ff', fontStyle: 'bold' }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD move  SPACE act  M menu   ·   Find the Fog-Wraith in the séance hall'), { fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 } }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
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
    const speed = running ? this.RUN : this.SPEED;
    if (moving) {
      const len = Math.hypot(dx, dy);
      const nx = this.px + (dx / len) * speed * dt, ny = this.py + (dy / len) * speed * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      // The locked gate blocks entry from above, but you can ALWAYS walk up/out of the
      // vault — so no one ever gets trapped behind it.
      if (!this.collides(this.px, ny) || (dy < 0 && this.gateAt(this.px, ny))) this.py = ny;
      this.walkTimer += delta; if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; this.steps++; this.checkEncounter(); }
    } else this.walkFrame = 0;
    this.drawChar();
    if (this.checkVaultDoor()) return;
    if (this.checkThreat()) return;
    if (this.checkTrainers()) return;
    this.checkExit();
  }

  /** The locked séance-vault door (the 보석함 door). Blocked until you win the key,
   *  then SPACE at the door unlocks it with the key. */
  private drawGate() {
    const cx = (GATE_C1 + GATE_C2) / 2 * TILE, cy = GATE_ROW * TILE + 16;
    const g = this.add.graphics();
    g.fillStyle(0xffd24a, 1); g.fillCircle(0, -2, 6); g.fillStyle(0x1a1622, 1); g.fillCircle(0, -2, 3);   // padlock body
    g.fillRect(-6, 2, 12, 8); g.fillStyle(0xffd24a, 1); g.fillRect(-6, 2, 12, 8); g.fillStyle(0x1a1622, 1); g.fillRect(-1, 4, 2, 4);
    const label = this.add.text(0, -20, tr('🔒 보석함 (locked)'), { fontSize: '8px', color: '#ffd88a', backgroundColor: '#00000099', padding: { x: 3, y: 1 } }).setOrigin(0.5);
    const cont = this.add.container(cx, cy, [g, label]).setDepth(10);
    cont.setVisible(!this.vaultOpen);
    this.tweens.add({ targets: cont, alpha: { from: 1, to: 0.7 }, duration: 700, yoyo: true, repeat: -1 });
    this.gateLock = cont;
  }

  private checkVaultDoor(): boolean {
    if (this.vaultOpen) return false;
    const cx = (GATE_C1 + GATE_C2) / 2 * TILE, cy = GATE_ROW * TILE + 16;
    if (Math.hypot(this.px - cx, this.py - cy) > TILE * 1.6) return false;
    // The door opens with SPACE. Winning the 보석함 key from Medium Yeong is the
    // intended route (and gives the key line), but it is no longer required — so a
    // player who can't find/beat her isn't hard-blocked from the Fog-Wraith.
    this.enterPrompt.setText(this.hasVaultKey
      ? tr('SPACE — Unlock the door with the 보석함 key')
      : tr('SPACE — Force the séance-hall door')).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return true;
    this.enterPrompt.setVisible(false); this.cutsceneActive = true;
    this.registry.set('manorVaultOpen', true);
    this.gateLock?.destroy();
    this.dialog.show(this.hasVaultKey ? [
      'The 보석함 key grinds in the ancient lock. With a groan, the séance-hall door swings inward.',
      'A wave of cold fog rolls out — and deep within, something is grinning.',
    ] : [
      'You throw your shoulder against the ancient door. The rotten lock finally gives with a crack.',
      'A wave of cold fog rolls out — and deep within, something is grinning.',
    ], () => { this.cutsceneActive = false; });
    return true;
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      const t = this.map[row][col];
      if (t === T.GATE) return !this.vaultOpen;   // the vault door blocks until unlocked with the key
      return SOLID.has(t);
    });
  }

  /** Is any of the player's body over the vault-gate tile at (x,y)? */
  private gateAt(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      return this.map[row]?.[col] === T.GATE;
    });
  }

  private checkEncounter() {
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (t === undefined || !ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.20) return;
    this.steps = 0; this.nextEnc = 7 + Math.floor(Math.random() * 8);
    const e = pickEncounter(FM_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'FogboundManorScene');
    this.registry.set('FogboundManorSceneReturnX', this.px); this.registry.set('FogboundManorSceneReturnY', this.py);
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('WildBattleScene'));
  }

  private checkThreat(): boolean {
    if (this.gengarDone) return false;
    const tx = THREAT.col * TILE + 16, ty = THREAT.row * TILE + 16;
    if (Math.hypot(this.px - tx, this.py - ty) > TILE * 1.5) return false;
    this.enterPrompt.setText(tr('SPACE — Face the Fog-Wraith')).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return true;
    this.cutsceneActive = true; this.enterPrompt.setVisible(false);
    this.dialog.show([
      'The manor holds its breath. Then, from the dark, a grin floats up — and the rest of it pours out of the walls.',
      'The Fog-Wraith Gengar\'s laugh echoes from everywhere at once. Steady yourself!',
    ], () => {
      this.registry.set('trainerName', 'Fog-Wraith Gengar (안개 팬텀)');
      this.registry.set('trainerKey', THREAT_KEY);
      this.registry.set('trainerPokemon', JSON.stringify([{ id: 94, level: 73 }]));
      this.registry.set('trainerExpPool', 1900);
      this.registry.set('trainerReturnScene', 'FogboundManorScene');
      this.registry.set('FogboundManorSceneReturnX', tx);
      this.registry.set('FogboundManorSceneReturnY', ty + TILE);
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    });
    return true;
  }

  private checkTrainers(): boolean {
    for (const tr of this.TRAINERS) {
      if (this.registry.get('trainerDefeated_' + tr.key)) continue;
      if (Math.hypot(this.px - (tr.col * TILE + 16), this.py - (tr.row * TILE + 16)) < TILE * 1.5) {
        this.cutsceneActive = true; this.enterPrompt.setVisible(false);
        this.registry.set('trainerName', tr.name);
        this.registry.set('trainerKey', tr.key);
        this.registry.set('trainerPokemon', tr.pokemon);
        this.registry.set('trainerExpPool', tr.expPool);
        this.registry.set('trainerReturnScene', 'FogboundManorScene');
        this.registry.set('FogboundManorSceneReturnX', this.px); this.registry.set('FogboundManorSceneReturnY', this.py);
        this.dialog.show([tr.line, `${tr.name}: Let's battle!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return true;
      }
    }
    return false;
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // Manor door (north edge, centre) → back down the fog road to Muyeonhang.
    if (this.py < 1.5 * TILE && this.px > 8 * TILE && this.px < 14 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('ChongjinCitySceneReturnX', 4 * 32 + 16);
        this.registry.set('ChongjinCitySceneReturnY', 17 * 32 + 16);
        this.scene.start('ChongjinCityScene');
      });
    }
  }
}
