import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, playerDesign, rivalDesign } from '../data/CharacterSprite';
import { markRivalPortrait } from '../data/BattlePortraits';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { PartySystem } from '../systems/PartySystem';
import { MAPAE, hasMapae, mapaeCount, northernLeagueEligible } from '../data/Mapae';

// ── POST-GAME I — Northern League plaza (exterior) ───────────────────────────────
// The forecourt of the Northern League: an austere North-Korean-style communist
// palace — a colossal, symmetrical grey-granite monument with a colonnade, red
// state banners, a single gold star, and a stark signboard. The plaza holds a
// Pokémon Center, storage PC and Poké Mart. When you approach the doors, the Rival
// runs in for a send-off battle; only after beating them may you enter the hall.
// Entry requires all 8 마패s — the 7 regional ones plus the final one from Supreme Gwang.

const T = { GROUND: 0, WALL: 1, CARPET: 2, PAVE: 3 } as const;
type Tile = typeof T[keyof typeof T];
// A full parade ground rather than the old cramped yard: the hall needs room to
// be looked UP at, and the Center/Mart are real buildings now, not kiosks.
const TILE = 32, COLS = 26, ROWS = 26;

const COLORS: Record<Tile, number> = {
  // The old ground/pave were within a few values of black, which under the 3D
  // lighting left the whole forecourt an unreadable murk. Still austere, but
  // now you can see the granite you are standing on.
  [T.GROUND]: 0x3b3f49, [T.WALL]: 0x15161b, [T.CARPET]: 0x7e1218, [T.PAVE]: 0x4b505b,
};
const SOLID = new Set<Tile>([T.WALL]);

// The hall spans cols 3–22, so its centre — and the door, the avenue, the stair
// and the great star above them — all sit on col 13.
const HALL = { col: 3, row: 0, w: 20, h: 9 };
const CENTRE_COL = HALL.col + HALL.w / 2;          // 13
const DOOR = { col: 12, row: 8 };                  // threshold, two tiles wide

// ── Forecourt service buildings ─────────────────────────────────────────────
// The Onnuri courtyard's Center and Mart are enterable; the northern ones were a
// pair of 3×3 prop blocks with an attendant stood outside and menu overlays.
// These are the same buildings, in granite and state red.
interface Service { col: number; row: number; w: number; h: number; door: number; }
const PC_BLD:   Service = { col: 4,  row: 16, w: 6, h: 5, door: 6 };
const MART_BLD: Service = { col: 16, row: 16, w: 6, h: 5, door: 18 };
const doorTile = (b: Service) => ({ col: b.door, row: b.row + b.h - 1 });

/** The 마패 inspector's post, at the foot of the great stair. */
const INSPECTOR = { col: 17, row: 11 };

const RIVAL_CLOSER = '__rivalFinal__';
const RIVAL_TEAM = [
  { id: 0, level: 72, custom: 'corrpanda' },
  { id: 0, level: 73, custom: 'squirrel2' },
  { id: 0, level: 74, custom: 'martbadger' },
  { id: 0, level: 74, custom: 'chattyscream' },
  { id: 0, level: 74, custom: 'tokkigongju' },
  { id: 0, level: 75, custom: RIVAL_CLOSER },
];

export class NorthernPlazaScene extends Phaser.Scene {
  private map!: Tile[][];
  // Give the forecourt real 3D buildings: the grand hall gets the League model,
  // the Center/Mart kiosks reuse the Pokémon Center & mart models. Only these
  // named plots rise (their flat facades are hidden).
  public buildingPlots = [
    // Each plot covers its wall footprint EXACTLY. A plot one tile short leaves
    // the leftover column extruded on its own, which reads as a separate block
    // bolted to the side of the building.
    { x: HALL.col, y: HALL.row, w: HALL.w, h: HALL.h, model: 'league' },
    { x: PC_BLD.col, y: PC_BLD.row, w: PC_BLD.w, h: PC_BLD.h, model: 'pokecenter' },
    { x: MART_BLD.col, y: MART_BLD.row, w: MART_BLD.w, h: MART_BLD.h, model: 'mart' },
  ];
  public onlyNamedBuildings = true;
  /** Obelisks and banner masts down the parade route — the northern equivalent of
   *  the Onnuri courtyard's stone lanterns. */
  public propPlots = [
    ...([13, 17, 21] as number[]).flatMap(r => [
      { x: 10, y: r, kind: 'obelisk' as const, scale: 0.9 },
      { x: 16, y: r, kind: 'obelisk' as const, scale: 0.9 },
    ]),
    { x: 5,  y: 13, kind: 'banner' as const, scale: 1.05 },
    { x: 21, y: 13, kind: 'banner' as const, scale: 1.05 },
    { x: 5,  y: 22, kind: 'banner' as const, scale: 1.05 },
    { x: 21, y: 22, kind: 'banner' as const, scale: 1.05 },
  ];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = CENTRE_COL * TILE;
  private py = 22 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private spawnGuard = false;
  private rivalRunInStarted = false;
  private readonly SPEED = 130; private readonly RUN = 250;
  private shiftKey?: Phaser.Input.Keyboard.Key;

  constructor() { super('NorthernPlazaScene'); }

  private defeated(key: string) { return !!this.registry.get(`trainerDefeated_${key}`); }

  create() {

    playBgm(this, 'seolhwa');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.rivalRunInStarted = false;
    this.input.keyboard?.resetKeys();
    this.spawnGuard = true;
    this.time.delayedCall(600, () => { this.spawnGuard = false; });

    this.px = CENTRE_COL * TILE; this.py = 22 * TILE + 16;
    const rx = this.registry.get('northPlazaReturnX') as number | undefined;
    const ry = this.registry.get('northPlazaReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('northPlazaReturnX'); this.registry.remove('northPlazaReturnY');

    this.map = buildMap();
    this.drawMap();
    this.drawPalace();
    this.drawKiosks();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'NorthernPlazaScene');

    if (!this.registry.get('northPlazaSeen')) {
      this.registry.set('northPlazaSeen', true);
      this.time.delayedCall(500, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'The Northern League rises before you — a colossal grey-granite palace, severe and symmetrical, banked with red banners under a single gold star. Trainers from a dozen regions cross the forecourt.',
          'Heal at the Center, stock up at the Mart, then approach the great doors when you are ready.',
        ], () => { this.cutsceneActive = false; });
      });
    }
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.PAVE)   { g.fillStyle(0x30333b, 0.6); g.fillRect(c*TILE+1, r*TILE+1, TILE-2, TILE-2); }
      if (t === T.GROUND) { g.fillStyle(0x262830, 0.5); g.fillRect(c*TILE+2, r*TILE+2, TILE-4, TILE-4); }
      if (t === T.CARPET) { g.fillStyle(0x8a1218, 0.85); g.fillRect(c*TILE+5, r*TILE, TILE-10, TILE); }
    }
    const key = '__northPlazaMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
  }

  /** The austere communist-palace facade drawn over the building mass (rows 0-7). */
  private drawPalace() {
    const g = this.add.graphics().setDepth(2);
    const x0 = HALL.col * TILE, y0 = 0, w = HALL.w * TILE, h = HALL.h * TILE;
    // Monolithic grey facade.
    g.fillStyle(0x2a2c33, 1); g.fillRect(x0, y0, w, h);
    g.fillStyle(0x33363e, 1); g.fillRect(x0 + 6, y0 + 6, w - 12, h - 12);
    // Colonnade — tall square pillars, evenly spaced, austere.
    g.fillStyle(0x20222a, 1);
    for (let i = 0; i < 7; i++) { const px = x0 + 22 + i * ((w - 44) / 6); g.fillRect(px - 6, y0 + 20, 12, h - 44); }
    // Entablature band.
    g.fillStyle(0x1a1c22, 1); g.fillRect(x0, y0 + 12, w, 8);
    // Red state banners hanging between pillars, each with a gold star.
    for (let i = 0; i < 6; i++) {
      const bx = x0 + 40 + i * ((w - 80) / 5);
      g.fillStyle(0x7c1414, 1); g.fillRect(bx - 7, y0 + 22, 14, h - 60);
    }
    // Doorway (dark opening + red carpet threshold).
    const dx = DOOR.col * TILE, dy = (DOOR.row - 1) * TILE;
    g.fillStyle(0x0a0b0f, 1); g.fillRect(dx - 4, dy - 10, TILE * 2 + 8, TILE + 10);
    g.fillStyle(0x8a1218, 1); g.fillRect(dx + 4, dy + TILE - 4, TILE * 2 - 8, 10);

    // Gold stars on the banners.
    for (let i = 0; i < 6; i++) {
      const bx = x0 + 40 + i * ((w - 80) / 5);
      this.add.text(bx, 3.6 * TILE, '★', { fontSize: '13px', color: '#ffe14a' }).setOrigin(0.5).setDepth(3);
    }
    // The great central gold star.
    this.add.text(CENTRE_COL * TILE, 1.6 * TILE, '★', { fontSize: '46px', color: '#ffe14a', stroke: '#7a5a00', strokeThickness: 4 }).setOrigin(0.5).setDepth(3);
    // Austere signboard above the door.
    this.add.text(CENTRE_COL * TILE, (HALL.h - 0.9) * TILE, tr('북방 리그 · NORTHERN LEAGUE'), {
      fontSize: '11px', color: '#ffe88a', backgroundColor: '#000000aa', padding: { x: 6, y: 2 },
    }).setOrigin(0.5).setDepth(3);
    // A broad granite stair up to the threshold, flanked by plinths — the hall is
    // meant to be climbed, not merely walked into.
    const stairW = 6 * TILE, stairTop = HALL.h * TILE;
    for (let s = 0; s < 3; s++) {
      g.fillStyle(s % 2 ? 0x3a3d45 : 0x474b55, 1);
      g.fillRect(CENTRE_COL * TILE - stairW / 2 - s * 8, stairTop + s * 9, stairW + s * 16, 10);
    }
    for (const side of [-1, 1]) {
      g.fillStyle(0x22242b, 1);
      g.fillRect(CENTRE_COL * TILE + side * (stairW / 2 + 26) - 11, stairTop - 6, 22, 34);
      g.fillStyle(0x9a1418, 1);
      g.fillRect(CENTRE_COL * TILE + side * (stairW / 2 + 26) - 7, stairTop - 2, 14, 22);
    }
  }

  /** The Center and the Mart as buildings, plus the 마패 inspector at the stair. */
  private drawKiosks() {
    this.drawServiceBuilding(PC_BLD, {
      roof: 0xb02030, wall: 0xd8dae2, sign: tr('✚ Pokémon Center'), cross: true,
    });
    this.drawServiceBuilding(MART_BLD, {
      roof: 0x2f5f96, wall: 0xd2d6de, sign: tr('🛒 Poké Mart'), cross: false,
    });

    // 마패 검사관 — the northern counterpart of the Onnuri badge judge. The Warden
    // at the doors still has the final word; this officer is the one you can ask.
    const ix = INSPECTOR.col * TILE + 16, iy = INSPECTOR.row * TILE + 16;
    this.drawAttendant(ix, iy, 0x4a4438);
    this.add.text(ix, iy - 26, tr('마패 검사관'), {
      fontSize: '8px', color: '#ffe88a', backgroundColor: '#000000aa', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(9);
  }

  /** One granite service building with a lit sign and a marked doorway. */
  private drawServiceBuilding(
    b: Service,
    style: { roof: number; wall: number; sign: string; cross: boolean },
  ) {
    const g = this.add.graphics().setDepth(4);
    const left = b.col * TILE, top = b.row * TILE;
    const w = b.w * TILE, h = b.h * TILE;
    const eaveY = top + h * 0.34;

    g.fillStyle(0x000000, 0.28); g.fillEllipse(left + w / 2, top + h + 5, w * 0.92, 14);
    // Severe granite block, flat parapet — no pitched roof up here.
    g.fillStyle(style.wall, 1); g.fillRect(left, eaveY, w, top + h - eaveY);
    g.fillStyle(0x22242b, 1); g.fillRect(left - 8, top + h * 0.2, w + 16, h * 0.14);
    g.fillStyle(style.roof, 1); g.fillRect(left - 8, top + h * 0.2, w + 16, 7);
    if (style.cross) {
      g.fillStyle(0xffffff, 1);
      g.fillRect(left + w / 2 - 12, top + h * 0.24, 24, 7);
      g.fillRect(left + w / 2 - 3.5, top + h * 0.24 - 8, 7, 23);
    } else {
      g.fillStyle(0xffe14a, 1);
      g.fillRect(left + w / 2 - 20, top + h * 0.245, 40, 8);
    }
    // Narrow state windows.
    g.fillStyle(0x8fbede, 0.8);
    for (const wx of [left + w * 0.16, left + w * 0.72]) g.fillRect(wx, eaveY + 16, w * 0.12, 24);
    g.lineStyle(2, 0x22242b, 0.6);
    for (const wx of [left + w * 0.16, left + w * 0.72]) g.strokeRect(wx, eaveY + 16, w * 0.12, 24);

    const d = doorTile(b);
    const dx = d.col * TILE, dy = (d.row + 1) * TILE;
    g.fillStyle(0x14151a, 1); g.fillRect(dx + 2, dy - 34, TILE - 4, 34);
    g.fillStyle(0x3a2c1c, 1); g.fillRect(dx + 5, dy - 31, TILE - 10, 31);
    g.fillStyle(0xffe8b0, 0.45); g.fillRect(dx + 5, dy - 8, TILE - 10, 8);

    this.add.text(left + w / 2, top + h * 0.18, style.sign, {
      fontSize: '9px', color: '#fff', backgroundColor: '#000000aa', padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 1).setDepth(6);
    this.add.text(dx + TILE / 2, dy + 8, tr('SPACE'), {
      fontSize: '7px', color: '#ffe14a', backgroundColor: '#00000099', padding: { x: 2, y: 1 },
    }).setOrigin(0.5, 0).setDepth(6);
  }

  private drawAttendant(x: number, y: number, coat: number) {
    const g = this.add.graphics().setDepth(7);
    g.setPosition(x, y);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 12, 14, 5);
    g.fillStyle(coat); g.fillRect(-7, -8, 14, 12);
    g.fillStyle(0xffcc99); g.fillRect(-6, -19, 12, 10);
    g.fillStyle(0x2a1c10); g.fillRect(-6, -20, 12, 5);
    g.fillStyle(0x000000); g.fillRect(-3, -14, 2, 2); g.fillRect(1, -14, 2, 2);
  }

  // ── Player / camera / input ──────────────────────────────────────────────
  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }
  private drawRivalSprite(g: Phaser.GameObjects.Graphics, x: number, y: number, frame: number) {
    drawTrainerBody(g, 2, frame, rivalDesign(this.registry));   // rival = opposite gender, running in facing left
    g.setPosition(x, y);
    markRivalPortrait(g, this.registry);
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
    this.add.rectangle(this.scale.width / 2, 22, 440, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🏯 Northern League — 북방 리그'), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 40, '', {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SPACE: enter / use  M: menu'), {
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
    if (moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const spd = this.shiftKey?.isDown ? this.RUN : this.SPEED;   // hold Shift to run
      const nx = this.px + (dx / len) * spd * dt, ny = this.py + (dy / len) * spd * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > 170) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkRivalGate();
    this.checkInteractions();
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

  private doorDist() {
    const dx = (DOOR.col + 1) * TILE, dy = DOOR.row * TILE + 16;
    return Math.hypot(this.px - dx, this.py - dy);
  }

  // The rival runs in at the doors for the send-off battle (before rival-5 is beaten).
  private checkRivalGate() {
    if (this.cutsceneActive || this.spawnGuard || this.rivalRunInStarted) return;
    if (this.defeated('rival-5')) return;
    if (this.doorDist() < TILE * 3) this.triggerRivalRunIn();
  }

  private triggerRivalRunIn() {
    this.cutsceneActive = true;
    this.rivalRunInStarted = true;
    this.facing = 1; this.drawChar();

    const rg = this.add.graphics().setDepth(25);
    const tag = this.add.text((COLS - 4) * TILE, DOOR.row * TILE + 6, speakerName('Rival'), {
      fontSize: '10px', color: '#bfe4ff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(26);
    const startX = (COLS - 4) * TILE, stopX = (DOOR.col + 1) * TILE, yy = (DOOR.row + 2) * TILE + 4;
    this.drawRivalSprite(rg, startX, yy, 0);

    let frame = 0;
    const step = this.time.addEvent({ delay: 110, loop: true, callback: () => { frame ^= 1; } });
    const proxy = { x: startX };
    this.tweens.add({
      targets: proxy, x: stopX, duration: 950, ease: 'Sine.easeOut',
      onUpdate: () => { this.drawRivalSprite(rg, proxy.x, yy, frame); tag.setPosition(proxy.x, yy - 36); },
      onComplete: () => {
        step.remove();
        this.drawRivalSprite(rg, stopX, yy, 0);
        this.dialog.show([
          "Rival: You didn't think I'd let you cross an international border without a send-off, did you?",
          "Rival: Everyone back home keeps calling you 'Champion' this, 'Champion' that. So before you walk through those doors —",
          'Rival: Now I will challenge the strongest trainer in Onnuri region! One more, for old times\' sake!',
        ], () => {
          PartySystem.healAll(this.registry);
          const team = RIVAL_TEAM.map(p => p.custom === RIVAL_CLOSER ? { ...p, custom: this.rivalFinal() } : p);
          this.registry.set('trainerName', 'Rival');
          this.registry.set('trainerKey', 'rival-5');
          this.registry.set('trainerPokemon', JSON.stringify(team));
          this.registry.set('trainerExpPool', 6000);
          this.registry.set('trainerReturnScene', 'NorthernPlazaScene');
          this.registry.set('northPlazaReturnX', (DOOR.col + 1) * TILE);
          this.registry.set('northPlazaReturnY', (DOOR.row + 2) * TILE + 16);
          this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
      },
    });
  }

  private rivalFinal(): string {
    const rivalKey = (this.registry.get('rivalKey') as string) ?? 'vipour';
    return rivalKey === 'munkain' ? 'banderado' : rivalKey === 'vipour' ? 'feldaconda' : 'thanatoat';
  }

  // ── Door + facilities (single prompt handler) ───────────────────────────────
  private checkInteractions() {
    if (this.cutsceneActive) { this.enterPrompt.setVisible(false); return; }
    const pcDoor = doorTile(PC_BLD), martDoor = doorTile(MART_BLD);
    const targets: { x: number; y: number; r: number; prompt: string; act: () => void }[] = [
      { x: pcDoor.col * TILE + 16, y: pcDoor.row * TILE + 16, r: TILE * 1.3, prompt: 'SPACE — Enter the Pokémon Center', act: () => this.enterCenter() },
      { x: martDoor.col * TILE + 16, y: martDoor.row * TILE + 16, r: TILE * 1.3, prompt: 'SPACE — Enter the Poké Mart', act: () => this.enterMart() },
      { x: INSPECTOR.col * TILE + 16, y: INSPECTOR.row * TILE + 16, r: TILE * 1.4, prompt: 'SPACE — Talk to the 마패 Inspector', act: () => {
        this.cutsceneActive = true;
        this.dialog.show(this.inspectorLines(), () => { this.cutsceneActive = false; });
      } },
    ];
    // The doors only work once the rival has been beaten.
    if (this.defeated('rival-5')) {
      targets.unshift({
        x: (DOOR.col + 1) * TILE, y: DOOR.row * TILE + 16, r: TILE * 1.8,
        prompt: 'SPACE — Enter the Northern League', act: () => this.enterHall(),
      });
    }
    let near: typeof targets[number] | null = null;
    for (const t of targets) { if (Math.hypot(this.px - t.x, this.py - t.y) < t.r) { near = t; break; } }
    if (!near) { this.enterPrompt.setVisible(false); return; }
    this.enterPrompt.setText(near.prompt).setVisible(true);
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) { this.enterPrompt.setVisible(false); near.act(); }
  }

  private enterHall() {
    this.cutsceneActive = true;
    // All eight 마패 (+ eight southern badges) → the League opens.
    if (northernLeagueEligible(this.registry)) {
      // Re-seal the northern gauntlet each entry → one-run challenge, and free
      // rematches after winning (northLeagueDone stays set — a rematch, not a reset).
      for (const k of ['north-seorak', 'north-hanseol', 'north-cheolgang', 'north-baekho', 'north-taewang']) {
        this.registry.remove(`trainerDefeated_${k}`);
      }
      this.registry.set('northLeagueFloor', 1);
      this.registry.remove('northColiseumReturnX');
      this.registry.remove('northColiseumReturnY');
      this.cameras.main.fadeOut(500, 0, 0, 0, () => {
        this.scene.start('NorthernColiseumScene');
      });
      return;
    }
    if (!this.registry.get('sunriseGymDefeated')) {
      this.dialog.show(['League Warden: Eight southern badges first, southerner. Come back a Champion.'], () => { this.cutsceneActive = false; });
      return;
    }
    // Check for all 8 마패s including Gwanmunseong
    const currentMapaeCount = mapaeCount(this.registry);
    if (currentMapaeCount < 8) {
      this.dialog.show([
        'League Warden: Halt. The eight 어사대장 must vouch for you — in 마패.',
        `League Warden: You hold ${currentMapaeCount} of 8 마패. Complete the inspectorate circuit, defeat Supreme Gwang in Gwanmunseong, and return.`,
      ], () => { this.cutsceneActive = false; });
      return;
    }
    this.dialog.show([
      'League Warden: Excellent. All eight 마패 are in your possession, including the final tablet from Supreme Gwang himself.',
      'League Warden: The Northern League awaits you, Champion. Prove yourself worthy of the title.',
    ], () => {
      // Re-seal the northern gauntlet each entry → one-run challenge
      for (const k of ['north-seorak', 'north-hanseol', 'north-cheolgang', 'north-baekho', 'north-taewang']) {
        this.registry.remove(`trainerDefeated_${k}`);
      }
      this.registry.set('northLeagueFloor', 1);
      this.registry.remove('northColiseumReturnX');
      this.registry.remove('northColiseumReturnY');
      this.cameras.main.fadeOut(500, 0, 0, 0, () => {
        this.scene.start('NorthernColiseumScene');
      });
    });
  }
  /** Step back outside the doorway on the way home from either interior. */
  private rememberDoorReturn(door: { col: number; row: number }) {
    this.registry.set('northPlazaReturnX', door.col * TILE + TILE / 2);
    this.registry.set('northPlazaReturnY', (door.row + 1) * TILE + TILE / 2);
  }

  private enterCenter() {
    this.cutsceneActive = true;
    this.rememberDoorReturn(doorTile(PC_BLD));
    this.registry.set('pcReturnScene', 'NorthernPlazaScene');
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('NorthernPCScene'));
  }

  private enterMart() {
    this.cutsceneActive = true;
    this.rememberDoorReturn(doorTile(MART_BLD));
    this.registry.set('martReturnScene', 'NorthernPlazaScene');
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('MartScene'));
  }

  /**
   * The 마패 inspector counts your tablets and names the next chief to beat. The
   * Warden at the doors turns you away with a number; this officer tells you
   * WHERE to go, which is the part a player standing in the forecourt needs.
   */
  private inspectorLines(): string[] {
    const held = mapaeCount(this.registry);
    const missing = MAPAE.filter(m => !hasMapae(this.registry, m.key));
    const badges = !!this.registry.get('sunriseGymDefeated');
    if (held >= MAPAE.length && badges) {
      return [
        `마패 Inspector: Tablets, please... ${held} of ${MAPAE.length}. Every seal of the 어사대.`,
        '마패 Inspector: Songhyeon, Parangpo, Haesol, Gangcheoldo, Muyeonhang, Binghagwan, Samho — and the Supreme Commander\'s own.',
        '마패 Inspector: Verified. The Warden will open the doors for you. Climb well, southerner.',
      ];
    }
    if (!badges) {
      return [
        '마패 Inspector: Tablets, please... and your southern case as well.',
        '마패 Inspector: The north admits no one who has not first taken all eight badges of Onnuri. Come back a Champion.',
      ];
    }
    const next = missing[0];
    return [
      `마패 Inspector: Tablets, please... ${held} of ${MAPAE.length}.`,
      `마패 Inspector: You are ${MAPAE.length - held} short. The nearest seal you lack is ${next.cityKo} — ${next.chiefKo} holds it.`,
      '마패 Inspector: Eight tablets, no exceptions. The 어사대 vouches for a trainer, or the doors stay shut.',
    ];
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('pyeongyangReturnX', 11.5 * 32);
        this.registry.set('pyeongyangReturnY', 3 * 32 + 16);   // back through the capital
        this.scene.start('PyeongyangCityScene');
      });
    }
  }
}

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.WALL) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  fill(HALL.row + HALL.h, ROWS, 2, COLS - 2, T.GROUND);        // forecourt
  fill(HALL.row + HALL.h, ROWS, CENTRE_COL - 2, CENTRE_COL + 2, T.PAVE);   // parade avenue
  fill(HALL.row + HALL.h, ROWS, CENTRE_COL - 1, CENTRE_COL + 1, T.CARPET); // ceremonial runner
  fill(DOOR.row, DOOR.row + 1, DOOR.col, DOOR.col + 2, T.CARPET);          // walkable threshold

  // The Centre and the Mart, each a solid block with one walkable doorway and a
  // paved spur joining it to the avenue.
  for (const b of [PC_BLD, MART_BLD]) {
    fill(b.row, b.row + b.h, b.col, b.col + b.w, T.WALL);
    const d = doorTile(b);
    m[d.row][d.col] = T.PAVE;
    for (let r = d.row + 1; r < d.row + 3 && r < ROWS; r++) m[r][d.col] = T.PAVE;
    const lo = Math.min(d.col, CENTRE_COL - 2), hi = Math.max(d.col, CENTRE_COL + 1);
    for (let c = lo; c <= hi; c++) if (m[d.row + 2]) m[d.row + 2][c] = T.PAVE;
  }
  return m;                                 // rows 0-8 stay WALL = the palace mass
}
