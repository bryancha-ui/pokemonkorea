import Phaser from 'phaser';
import { installSurfing, isSurfing } from '../systems/SurfSystem';
import { tr, speakerName } from '../systems/i18n';
import { vanishesAfterDefeat } from '../data/Villains';
import { drawTrainerBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';

// ── Tiles (shared cliff theme) ──────────────────────────────────────────────
const T = { ROCK: 0, PATH: 1, TALLGRASS: 2, CLIFF: 3, SEA: 4, LOOKOUT: 5 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 44;
const COLORS: Record<Tile, number> = {
  [T.ROCK]: 0x5a4f48, [T.PATH]: 0xc2b39a, [T.TALLGRASS]: 0x4a7a3a, [T.CLIFF]: 0x3a322c,
  [T.SEA]: 0x2a72b8, [T.LOOKOUT]: 0xd8a85a,
};
const SOLID = new Set<Tile>([T.CLIFF, T.SEA]);
const ENCOUNTER = new Set<Tile>([T.TALLGRASS]);

export interface CliffTrainer {
  key: string; name: string; col: number; row: number; color: number; label: string;
  line: string; pokemon: string; expPool: number;
}

// Shared cliff wild list (rock / flying / electric coastal), Lv 48-50
export const CLIFF_ENCOUNTERS: EncounterEntry[] = [
  { id: 'gawlhawk',     weight: 14, minLevel: 49, maxLevel: 53, isCustom: true,  catchRate: 180 },
  { id: 'prowlrock',    weight: 12, minLevel: 49, maxLevel: 53, isCustom: true,  catchRate: 170 },
  { id: 'disguijar',    weight: 12, minLevel: 49, maxLevel: 53, isCustom: true,  catchRate: 180 },
  { id: 'crystbeetle',  weight: 10, minLevel: 49, maxLevel: 53, isCustom: true,  catchRate: 160 },
  { id: 'mushvenom',    weight: 10, minLevel: 49, maxLevel: 53, isCustom: true,  catchRate: 160 },
  { id: 'ssangdungori', weight: 10, minLevel: 49, maxLevel: 53, isCustom: true,  catchRate: 170 },
  { id: 'kingfisher',   weight: 10, minLevel: 49, maxLevel: 53, isCustom: true,  catchRate: 180 },
  { id: 278, weight: 12, minLevel: 49, maxLevel: 53, isCustom: false, catchRate: 200 }, // Wingull
  { id: 74,  weight: 10, minLevel: 49, maxLevel: 53, isCustom: false, catchRate: 200 }, // Geodude
];

/**
 * Shared base for the Sunrise Cliffs climb — a winding cliffside field with
 * sea on one flank, rock on the other, wild encounters and visible trainers.
 * Subclasses supply the title, encounters, trainers, return key and the two
 * exits, and may override hooks for special events (e.g. Commander Ryeo).
 */
export abstract class CliffClimbScene extends Phaser.Scene {
  // The cliff climbs are open rock faces — no buildings. Only named-model plots
  // (there are none) rise in 3D, so every auto-detected building is erased to
  // clean ground instead of extruding stray facades on the cliffs.
  public onlyNamedBuildings = true;
  // The dark rock FLOOR must stay flat walkable ground (not extrude into low
  // walls the player appears to phase through); the solid CLIFF barriers stay
  // raised. Collision (SOLID: CLIFF/SEA) is unchanged.
  public caveFloorHint = true;

  protected abstract sceneKey: string;
  protected abstract title: string;
  protected abstract encounters: EncounterEntry[];
  protected abstract trainers: CliffTrainer[];
  protected abstract returnKey: string;
  /** Walk off the bottom → previous area. */
  protected abstract exitSouth(): void;
  /** Walk off the top → next area (return false to block, e.g. summit). */
  protected abstract exitNorth(): boolean;

  public grassTileIds3D = [T.TALLGRASS];
  protected map!: Tile[][];
  protected playerG!: Phaser.GameObjects.Graphics;
  protected cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  protected wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  protected shiftKey!: Phaser.Input.Keyboard.Key;
  protected spaceKey!: Phaser.Input.Keyboard.Key;
  protected dialog!: DialogBox;
  protected px = 12 * TILE + 16;
  protected py = 41 * TILE + 16;
  protected facing = 1; protected walkFrame = 0; protected walkTimer = 0;
  protected cutsceneActive = false;
  protected steps = 0; protected nextEnc = 8;
  protected readonly SPEED = 120; protected readonly RUN = 250;

  protected get C() { return COLS; }
  protected get R() { return ROWS; }
  protected get TS() { return TILE; }

  /** Hook: extra drawing after the map (e.g. a visible NPC). */
  protected drawExtras() {}
  /** Hook: per-frame special checks (e.g. approaching Ryeo). Return true to halt normal updates. */
  protected checkSpecial(): boolean { return false; }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get(this.returnKey + 'X') as number | undefined;
    const ry = this.registry.get(this.returnKey + 'Y') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove(this.returnKey + 'X'); this.registry.remove(this.returnKey + 'Y');

    this.map = this.buildMap();
    this.drawMap();
    this.drawTrainers();
    this.drawExtras();
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
    SaveManager.save(this.registry, this.px, this.py, this.sceneKey);
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  // ── Map: a serpentine cliff path ──────────────────────────────────────────
  protected buildMap(): Tile[][] {
    const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.ROCK) as Tile[]);
    const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
      for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
    };
    // The sea drops away to the east; a sheer cliff to the west
    fill(0, ROWS, 0, 3, T.CLIFF);
    fill(0, ROWS, 21, COLS, T.SEA);
    // Switchback path up the cliff
    fill(38, ROWS, 9, 13, T.PATH);
    fill(36, 40, 4, 13, T.PATH);
    fill(26, 40, 4, 8, T.PATH);
    fill(24, 28, 4, 19, T.PATH);
    fill(14, 28, 15, 19, T.PATH);
    fill(12, 16, 4, 19, T.PATH);
    fill(2, 16, 4, 8, T.PATH);
    fill(0, 4, 4, 19, T.LOOKOUT);   // top lookout
    fill(2, 5, 9, 13, T.PATH);
    // Tall-grass patches along the ledges
    fill(36, 39, 8, 12, T.TALLGRASS);
    fill(24, 27, 9, 14, T.TALLGRASS);
    fill(13, 16, 9, 14, T.TALLGRASS);
    fill(26, 39, 5, 7, T.TALLGRASS);
    return m;
  }

  protected drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.CLIFF) { g.fillStyle(0x2a2420); g.fillRect(c*TILE+4, r*TILE+5, 9, 8); g.fillRect(c*TILE+16, r*TILE+18, 9, 8); }
      if (t === T.SEA) { g.fillStyle(0x66bbe6, 0.4); g.fillRect(c*TILE+4, r*TILE+10, 12, 3); g.fillRect(c*TILE+14, r*TILE+22, 10, 3); }
      if (t === T.TALLGRASS) { g.fillStyle(0x2c6a22, 0.8); for (let i=0;i<3;i++){ g.fillRect(c*TILE+5+i*8, r*TILE+16, 2, 12); g.fillRect(c*TILE+7+i*8, r*TILE+12, 2, 16);} }
      if (t === T.LOOKOUT) { g.fillStyle(0xffc060, 0.3); g.fillRect(c*TILE, r*TILE, TILE, 4); }
    }
    const key = `__${this.sceneKey}Map__`;
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(12 * TILE, 42.4 * TILE, tr('↓ back down'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(11 * TILE, 0.6 * TILE, tr('↑ higher'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#aa6a2a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  protected drawTrainers() {
    for (const tr of this.trainers) {
      if (this.registry.get(`trainerDefeated_${tr.key}`) && vanishesAfterDefeat(tr.key)) continue;
      const g = this.add.graphics().setDepth(8);
      drawNpcBody(g, tr.color);
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      this.add.text(tr.col * TILE + 16, tr.row * TILE - 12, speakerName(tr.label), {
        fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(9);
    }
  }

  // ── Player / camera / input ──────────────────────────────────────────────
  protected createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  protected drawChar() {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }
  protected setupCamera() {
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.setZoom(1.6);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
  }
  protected setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  protected createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 400, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, this.title, {
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
    if (this.checkSpecial()) return;
    this.checkTrainers();
    this.checkExits();
  }
  protected collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      return SOLID.has(this.map[row][col]);
    });
  }

  protected checkEncounter() {
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (!t || !ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.22) return;
    this.steps = 0; this.nextEnc = 8 + Math.floor(Math.random() * 8);
    const e = pickEncounter(this.encounters);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', this.sceneKey);
    this.registry.set(this.returnKey + 'X', this.px); this.registry.set(this.returnKey + 'Y', this.py);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  protected checkTrainers() {
    for (const tr of this.trainers) {
      if (this.registry.get(`trainerDefeated_${tr.key}`)) continue;
      const wx = tr.col * TILE + 16, wy = tr.row * TILE + 16;
      if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.5) {
        this.cutsceneActive = true;
        this.registry.set('trainerName', tr.name);
        this.registry.set('trainerKey', tr.key);
        this.registry.set('trainerPokemon', tr.pokemon);
        this.registry.set('trainerExpPool', tr.expPool);
        this.registry.set('trainerReturnScene', this.sceneKey);
        this.registry.set(this.returnKey + 'X', this.px); this.registry.set(this.returnKey + 'Y', this.py);
        this.dialog.show([tr.line, `${tr.name}: Let's battle!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  protected checkExits() {
    if (isSurfing(this.playerG)) return;
    if (this.cutsceneActive) return;
    if (this.py > (ROWS - 1) * TILE) { this.cutsceneActive = true; this.exitSouth(); }
    else if (this.py < 1 * TILE) { if (this.exitNorth()) this.cutsceneActive = true; else this.py = 1.2 * TILE; }
  }

  protected fade(to: () => void) {
    this.cameras.main.fadeOut(400, 0, 0, 0, () => to());
  }
}
