import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { PartySystem } from '../systems/PartySystem';
import { DexTracker } from '../systems/DexTracker';
import { Inventory } from '../systems/Items';
import { drawTrainerBody, drawNpcBody, playerDesign, rivalDesign, rivalTrainerName } from '../data/CharacterSprite';
import { markRivalPortrait, markTrainerPortrait } from '../data/BattlePortraits';
import { playHwanungEntranceVideo, preloadHwanungEntranceVideo } from '../systems/HwanungEntranceVideo';
import { migrateLegacyCheonjiCapture } from '../systems/StoryMigrations';

// ── POST-GAME II — The Sacred Northern Peak (finale) ─────────────────────────────
// The climb to Hwanung's descent-point. Three sealed shrines each hold one of the
// Sovereign's attendants — 풍백 (Wind), 우사 (Rain), 운사 (Clouds) — caught in order as
// you ascend. At the altar, 노스단's new leader makes a last stand; beat them and the
// three attendants call 환웅 (Hwanung) down from the heavens for the final catch.

const T = { ROCK: 0, WALL: 1, DAIS: 2, BARRIER: 3, PATH: 4, ALTAR: 5, SKY: 6 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 18, ROWS = 40;
const SACRED_PEAK_ALTAR_KEY = 'sacred-peak-altar-higgsfield';
const SACRED_PEAK_ALTAR_URL = 'assets/scenes/sacred_peak_altar_higgsfield.webp';

const COLORS: Record<Tile, number> = {
  [T.ROCK]: 0xb8aa92, [T.WALL]: 0x655b65, [T.DAIS]: 0xd1bf9d, [T.BARRIER]: 0x8d78a6,
  [T.PATH]: 0xc7b48b, [T.ALTAR]: 0xe1bb62, [T.SKY]: 0x42516f,
};
const SOLID = new Set<Tile>([T.WALL]);

// Each barrier opens once the attendant below it is caught.
const GATES: Record<number, string> = { 28: 'poongbaek', 20: 'woosa', 12: 'woonsa' };

interface Shrine { key: string; name: string; kr: string; level: number; col: number; row: number; color: number; }
const SHRINES: Shrine[] = [
  { key: 'poongbaek', name: 'Poongbaek — The Wind',  kr: '풍백 · 갈바람 능선', level: 80, col: 9, row: 30, color: 0x8fd8ff },
  { key: 'woosa',     name: 'Woosa — The Rain',      kr: '우사 · 눈물 골짜기', level: 80, col: 9, row: 22, color: 0x4a9ad8 },
  { key: 'woonsa',    name: 'Woonsa — The Clouds',   kr: '운사 · 운해 정상',   level: 80, col: 9, row: 14, color: 0xd0d8f0 },
];

const SOVEREIGN = {
  key: 'nosdan-sovereign', name: 'Sovereign Clemont', expPool: 11000,
  pokemon: [
    { id: 0, level: 82, custom: 'halubang' }, { id: 0, level: 83, custom: 'snoqueen' },
    { id: 0, level: 83, custom: 'kkaakdang' }, { id: 0, level: 84, custom: 'komodread' },
    { id: 0, level: 85, custom: 'mperodactyl' }, { id: 0, level: 86, custom: 'noeryong' },
  ],
};

export class SacredPeakScene extends Phaser.Scene {
  /** Keep the summit flush and building-free so the altar cast remains visible. */
  public flatTerrain3D = true;
  public clearSight3D = true;
  public noRocks3D = true;
  public onlyNamedBuildings = true;
  public preservePaintedGround3D = true;
  /** Add low, animated cloud banks beyond the walkable ridge. */
  public sacredPeakNature3D = true;
  /** Brighter high-altitude sky, fog and horizon clouds for the summit. */
  public environmentProfile3D = 'snow' as const;
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 9 * TILE + 16;
  private py = 37 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  /** While the full-screen entrance movie is open, SPACE controls the movie instead of the dialog. */
  private entranceVideoAction?: () => void;
  private spawnGuard = false;
  private readonly SPEED = 120;
  private readonly ALTAR = { col: 9, row: 6 };

  /** One world-space anchor shared by the altar art, cast and summon. */
  private altarCenter(): { x: number; y: number } {
    return {
      x: this.ALTAR.col * TILE + TILE / 2,
      y: this.ALTAR.row * TILE + TILE / 2,
    };
  }

  constructor() { super('SacredPeakScene'); }

  preload() {
    if (!this.textures.exists(SACRED_PEAK_ALTAR_KEY)) {
      this.load.image(SACRED_PEAK_ALTAR_KEY, SACRED_PEAK_ALTAR_URL);
    }
    if (!this.textures.exists('hwanwoong'))   this.load.image('hwanwoong', 'assets/dex/hwanwoong.png');
    if (!this.textures.exists('nabihalmang')) this.load.image('nabihalmang', 'assets/dex/nabihalmang.png');
    for (const key of ['poongbaek', 'woosa', 'woonsa']) {
      if (!this.textures.exists(key)) this.load.image(key, `assets/dex/${key}.png`);
    }
    preloadHwanungEntranceVideo(this);
  }

  /** Scale an image so its largest side is maxPx. */
  private fitSprite(img: Phaser.GameObjects.Image, maxPx: number) {
    const src = this.textures.get(img.texture.key).getSourceImage();
    const dim = Math.max((src.width as number) || 1, (src.height as number) || 1);
    img.setScale(maxPx / dim);
  }

  private defeated(key: string) { return !!this.registry.get(`trainerDefeated_${key}`); }
  private got(key: string): boolean {
    return DexTracker.isCaught(this.registry, key)
      || PartySystem.get(this.registry).some(e => e.spriteKey === key)
      || ((this.registry.get('box') as string) ?? '').includes(key);
  }
  private get allThree() { return this.got('poongbaek') && this.got('woosa') && this.got('woonsa'); }
  private get hwanungCaught() { return this.got('hwanwoong'); }

  create() {
    migrateLegacyCheonjiCapture(this.registry);
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.entranceVideoAction = undefined;
    playBgm(this, 'sacredpeak');
    this.input.keyboard?.resetKeys();
    this.spawnGuard = true;
    this.time.delayedCall(600, () => { this.spawnGuard = false; });

    this.px = 9 * TILE + 16; this.py = 37 * TILE + 16;
    const rx = this.registry.get('sacredPeakReturnX') as number | undefined;
    const ry = this.registry.get('sacredPeakReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('sacredPeakReturnX'); this.registry.remove('sacredPeakReturnY');

    this.map = buildMap();
    this.drawMap();
    this.drawShrines();
    this.drawEscort();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'SacredPeakScene');

    if (this.hwanungCaught && !this.registry.get('trueEndDone')) {
      this.time.delayedCall(400, () => this.runEnding());
    } else if (!this.registry.get('sacredPeakSeen')) {
      this.registry.set('sacredPeakSeen', true);
      this.time.delayedCall(500, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'The Ancient Altar\'s hidden stair delivers you to a realm above the clouds. Three sealed shrines rise along the ridge to the Sacred Peak, where the oldest myth says the heavens once touched the earth.',
          '어사대장 Jinnok: 노스단 is already climbing. Reach the Wind, the Rain and the Clouds before they do. I\'ll hold the lower wards and heal you as you pass. Go, Champion.',
        ], () => { this.cutsceneActive = false; });
      });
    }
  }

  private barrierOpen(row: number): boolean {
    const key = GATES[row];
    return !!key && this.got(key);
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      const open = t === T.BARRIER && this.barrierOpen(r);
      const draw = open ? T.PATH : t;
      g.fillStyle(COLORS[draw], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (draw === T.ROCK) { g.fillStyle(0x8d806c, 0.34); g.fillRect(c*TILE+3, r*TILE+4, 8, 4); g.fillRect(c*TILE+18, r*TILE+18, 8, 4); }
      if (draw === T.SKY)  { g.fillStyle(0xffffff, 0.5); g.fillEllipse(c*TILE+16, r*TILE+16, 22, 10); }
      if (draw === T.PATH) { g.fillStyle(0xb0b0c8, 0.6); g.fillRect(c*TILE+1, r*TILE+1, TILE-2, TILE-2); }
      if (draw === T.DAIS) { g.fillStyle(0x8888a4, 0.8); g.fillRect(c*TILE+3, r*TILE+3, TILE-6, TILE-6); }
      if (t === T.BARRIER && !open) { g.fillStyle(0xc8b8ff, 0.6); for (let i=0;i<4;i++) g.fillRect(c*TILE+3+i*8, r*TILE+2, 3, TILE-4); }
      if (draw === T.ALTAR) { g.fillStyle(0xffe8a0, 0.8); g.fillRect(c*TILE+5, r*TILE+5, TILE-10, TILE-10); }
    }
    const key = '__sacredPeakMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    // The Higgsfield-authored courtyard replaces the former procedural temple.
    // Tagging it as a terrain decal lets OverworldMirror bake the same art into
    // the horizontal 3D ground instead of raising it as a duplicate billboard.
    const altar = this.altarCenter();
    this.add.image(altar.x, altar.y, SACRED_PEAK_ALTAR_KEY)
      .setDisplaySize(TILE * 7, TILE * 7)
      .setDepth(1)
      .setData('terrainDecal3D', true);

    this.add.text(9 * TILE, 2.4 * TILE, tr('☀ Altar of the Descent'), { fontSize: '10px', color: '#ffe88a', backgroundColor: '#00000088', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
    this.add.text(9 * TILE, 38.4 * TILE, tr('↓ Ancient Altar (Onseong)'), { fontSize: '9px', color: '#fff', backgroundColor: '#00000088', padding: { x: 3, y: 2 } }).setOrigin(0.5).setDepth(5);
  }

  private drawShrines() {
    for (const s of SHRINES) {
      const caught = this.got(s.key);
      const g = this.add.graphics().setDepth(6);
      g.setPosition(s.col * TILE + 16, s.row * TILE + 16);
      // A stone shrine gate; glows if its spirit is still inside.
      g.fillStyle(0x2a2a34); g.fillRect(-14, -6, 6, 20); g.fillRect(8, -6, 6, 20); g.fillRect(-16, -10, 32, 6);
      if (!caught) { g.fillStyle(s.color, 0.5); g.fillEllipse(0, 2, 20, 22); }
      this.add.text(s.col * TILE + 16, s.row * TILE - 18, caught ? `✓ ${s.name}` : s.kr, {
        fontSize: '8px', color: caught ? '#9fe' : '#fff', backgroundColor: '#00000099', padding: { x: 2, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(7);
    }
  }

  /**
   * Keep the entire summit cast as world-space actors. These objects are created
   * once when the scene is built and are intentionally not tied to the sovereign
   * battle's defeated flag or to the short Hwanung reveal tweens. That way the
   * 3D mirror keeps the same people visible before the battle, after returning
   * from it, and throughout the final capture dialogue.
   */
  private drawEscort() {
    const { x: altarX, y: altarY } = this.altarCenter();
    const npc = (
      col: number, row: number, body: number, hair: number,
      label: string, color: string, trainerKey: string,
    ) => {
      const g = this.add.graphics().setDepth(8);
      drawNpcBody(g, body, { hair });
      g.setPosition(col * TILE + 16, row * TILE + 16);
      markTrainerPortrait(g, trainerKey);
      g.setData('characterLookAt3D', { x: altarX, y: altarY });
      const tag = this.add.text(col * TILE + 16, row * TILE - 16, label, {
        fontSize: '8px', color, backgroundColor: '#00000099', padding: { x: 2, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(9)
        .setData('characterLabel3D', true)
        .setData('characterLabelTarget3D', g);
      return { g, tag };
    };

    // The fixed summit positions keep the escort in the same camera region as
    // the altar instead of leaving them behind at the lower entrance.
    npc(6, 8.5, 0x2f6a44, 0xcfd6dc, '어사대장 Jinnok', '#bfe8c8', 'inspector-jinnok');
    // Keep Professor Song inside the summit camera's temple framing. At col 5
    // her model existed but was clipped by the left edge in the 3D view.
    npc(8, 9, 0xf0f0f0, 0x553311, 'Prof. Song', '#cfe3ff', 'prof-song');

    const rivalX = 12.5 * TILE + 16;
    const rivalY = 8.5 * TILE + 16;
    const rival = this.add.graphics().setPosition(rivalX, rivalY).setDepth(8);
    drawTrainerBody(rival, 1, 0, rivalDesign(this.registry));
    markRivalPortrait(rival, this.registry);
    rival.setData('characterLookAt3D', { x: altarX, y: altarY });
    this.add.text(rivalX, rivalY - TILE, rivalTrainerName(this.registry), {
      fontSize: '8px', color: '#9ad0ff', backgroundColor: '#00000099', padding: { x: 2, y: 1 }, align: 'center',
    }).setOrigin(0.5).setDepth(9)
      .setData('characterLabel3D', true)
      .setData('characterLabelTarget3D', rival);

    // Once the three attendants have been gathered, keep their world-space
    // forms around the altar as the living chorus that calls Hwanung down.
    // Their authored sprites remain a clean 2D fallback and become raised
    // reliefs in the 3D mirror even on devices without companion GLBs.
    if (this.allThree) {
      // Equilateral triangle centred on Hwanung's exact landing point.
      const radius = TILE * 2.25;
      const halfWidth = radius * Math.sqrt(3) / 2;
      const attendants = [
        { key: 'woonsa', x: altarX, y: altarY - radius, label: '운사', color: '#dfeaff' },
        { key: 'poongbaek', x: altarX - halfWidth, y: altarY + radius / 2, label: '풍백', color: '#cfe9ff' },
        { key: 'woosa', x: altarX + halfWidth, y: altarY + radius / 2, label: '우사', color: '#bfe6ff' },
      ];
      for (const attendant of attendants) {
        // These three currently have no local production GLB. Leave them as
        // ordinary Images so OverworldMirror turns the authored art into an
        // upright world-space relief at the triangle vertex. Tagging them as
        // unavailable GLB creatures kept the 2D fallback camera-aligned and
        // made it overlap Hwanung instead of occupying the altar position.
        const spirit = this.add.image(attendant.x, attendant.y, attendant.key).setDepth(24);
        this.fitSprite(spirit, 52);
        this.add.text(attendant.x, attendant.y - 34, attendant.label, {
          fontSize: '8px', color: attendant.color, backgroundColor: '#00000099', padding: { x: 2, y: 1 },
        }).setOrigin(0.5).setDepth(9)
          .setData('characterLabel3D', true)
          .setData('characterLabelTarget3D', spirit);
      }
    }

    // Clemont remains on the map after his battle as a defeated but visible
    // story actor. The previous condition removed him as soon as the battle
    // flag was set, leaving only his post-battle dialogue.
    const sovereignX = altarX - TILE * 3;
    const sovereignY = altarY - TILE;
    const sovereign = this.add.graphics().setPosition(sovereignX, sovereignY).setDepth(8);
    drawNpcBody(sovereign, 0x141018, { hair: 0x552266 });
    markTrainerPortrait(sovereign, SOVEREIGN.key);
    sovereign.setData('characterLookAt3D', { x: altarX, y: altarY + TILE });
    this.add.text(sovereignX, sovereignY - TILE, tr('Sovereign\nClemont'), {
      fontSize: '8px', color: '#e0a0ff', backgroundColor: '#00000099', padding: { x: 2, y: 1 }, align: 'center',
    }).setOrigin(0.5).setDepth(9)
      .setData('characterLabel3D', true)
      .setData('characterLabelTarget3D', sovereign);
  }

  // ── Player / camera / input ──────────────────────────────────────────────
  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
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
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 440, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('☀ The Sacred Peak — 환웅의 강림'), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SPACE: interact  M: menu'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(_: number, delta: number) {
    if (this.cutsceneActive) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        if (this.entranceVideoAction) this.entranceVideoAction();
        else this.dialog.advance();
      }
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
      const nx = this.px + (dx / len) * this.SPEED * dt, ny = this.py + (dy / len) * this.SPEED * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > 180) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkShrines();
    this.checkPeak();
    this.checkExit();
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      const t = this.map[row][col];
      if (t === T.BARRIER) return !this.barrierOpen(row);
      return SOLID.has(t);
    });
  }

  private checkShrines() {
    for (const s of SHRINES) {
      if (this.got(s.key)) continue;
      if (Math.hypot(this.px - (s.col * TILE + 16), this.py - (s.row * TILE + 16)) < TILE * 1.5) {
        this.cutsceneActive = true;
        this.dialog.show([
          `A 노스단 squad has forced the ward, nets and cables trained on the thrashing spirit of ${s.name.split(' — ')[0]}.`,
          '어사대장 Jinnok: They\'re here. I\'ll scatter them — you reach the spirit! Prove yourself its worthy keeper!',
          `The 어사대 sweep the 노스단 aside. ${s.kr} stills, turns, and regards you. It will let you try.`,
        ], () => this.launchCatch(s.key, s.level, 3));
        return;
      }
    }
  }

  private checkPeak() {
    if (!this.allThree) return;
    const altar = this.altarCenter();
    if (Math.hypot(this.px - altar.x, this.py - altar.y) > TILE * 1.7) return;

    if (!this.defeated('nosdan-sovereign')) {
      this.cutsceneActive = true;
      PartySystem.healAll(this.registry);
      this.dialog.show([
        'Sovereign Clemont: You gathered the three so we wouldn\'t have to. How thoughtful. Hand them over, and Hwanung descends for US — and this broken peninsula finally answers to one throne.',
        'Rival (arriving at your side, breathless): Yeah, that\'s a no. They chased you all the way up here, and I chased THEM. Go — I\'ve got your back like always.',
        '어사대장 Jinnok: The 어사대 hold the peak. Summon the Sovereign, Champion.',
      ], () => {
        this.registry.set('trainerName', SOVEREIGN.name);
        this.registry.set('trainerKey', SOVEREIGN.key);
        this.registry.set('trainerPokemon', JSON.stringify(SOVEREIGN.pokemon));
        this.registry.set('trainerExpPool', SOVEREIGN.expPool);
        this.registry.set('trainerReturnScene', 'SacredPeakScene');
        this.registry.set('sacredPeakReturnX', altar.x);
        this.registry.set('sacredPeakReturnY', (this.ALTAR.row + 2) * TILE + 16);
        this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
      });
      return;
    }

    if (!this.hwanungCaught) {
      this.cutsceneActive = true;
      this.playDescent();
    }
  }

  /** The three attendants call 환웅 down from the heavens for the final catch. */
  private playDescent() {
    this.dialog.show([
      '노스단\'s leader is dragged from the altar. For a moment, the peak is silent.',
      'Then 풍백, 우사 and 운사 rise from your side of their own accord and take their places around the altar — Wind, Rain and Clouds, wheeling in harmony. The sky splits with light.',
    ], () => {
      const action = playHwanungEntranceVideo(
        this,
        () => this.finishDescent(),
        () => { this.entranceVideoAction = undefined; },
      );
      if (action) {
        this.entranceVideoAction = action;
      } else {
        console.error('Failed to set up Hwanung entrance video action');
      }
    });
  }

  /** Continue the original in-engine reveal and catch sequence after the movie. */
  private finishDescent() {
    const W = this.scale.width, H = this.scale.height;
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setScrollFactor(0).setDepth(140);
    this.tweens.add({ targets: flash, alpha: 0.7, duration: 1400, yoyo: true });

    // 🌟 환웅 descends onto the altar. The Phaser image is a fallback and the
    // OverworldMirror promotes it to the shipped hwanwoong.glb in 3D mode.
    const altar = this.altarCenter();
    const hwan = this.build3DCreature('hwanwoong', 'hwanwoong',
      altar.x, altar.y, 2.8, 96)
      .setDepth(25).setAlpha(0)
      // The mobile 2D fallback has a wide golden aura on its right, leaving
      // Hwanung's body visibly left of the object's midpoint. Moving only the
      // image origin centres the body while the 3D holder stays at altar.x.
      .setOrigin(0.24, 0.5);
    // OverworldMirror places a creature GLB at the image's visual feet
    // (y + displayHeight / 2), not at the image centre. Compensate here so the
    // model's feet — and therefore its true 3D pivot — land on the exact centre
    // of the altar instead of south of it (which projected visually to the left).
    const landingY = altar.y - hwan.displayHeight / 2;
    hwan.setY(landingY - TILE * 2.5);
    this.tweens.add({ targets: hwan, alpha: 1, y: landingY, duration: 1600, ease: 'Sine.out' });
    this.tweens.add({ targets: hwan, y: '+=6', duration: 1600, yoyo: true, repeat: -1, delay: 1600 });   // gentle hover

    this.dialog.show([
      '🌟 환웅 (Hwanung), the Sovereign Who Descended, alights upon the altar — but the raw energy of his descent screams off the peak, and the god\'s eyes blaze with a fury older than the mountains.',
      'Prof. Song (at your side, urgent): That awakening energy will tear the peak apart! You need something that can absorb it — 나비할망! Her wings, Champion, NOW!',
    ], () => {
      // 나비할망 is released beside you and spreads her wings to soothe the god.
      const nabi = this.build3DCreature('nabihalmang', 'nabihalmang', this.px - 30, this.py - 6, 1.8, 64)
        .setDepth(24).setAlpha(0).setFlipX(true);
      this.tweens.add({ targets: nabi, alpha: 1, duration: 700 });
      this.tweens.add({ targets: hwan, tint: 0xbfe0ff, duration: 1200, delay: 500 });   // rage cools to calm
      this.dialog.show([
        'You send out 나비할망. The Grandmother Moth spreads her vast metallic wings and drinks in the storm of light, and the god\'s rage drains away into a deep, ancient calm.',
        '환웅 lowers his head and regards you at last — not as prey, but as the one worthy to summon him. It steadies itself to test your strength.',
      ], () => {
        nabi.destroy();
        this.launchCatch('hwanwoong', 80, 2);
      });
    });
  }

  /**
   * Create a world-space creature proxy. The fallback image remains useful in
   * pure 2D mode, while OverworldMirror can replace it with a real GLB without
   * changing the scene's tweening, alpha, or lifetime logic.
   */
  private build3DCreature(
    textureKey: string, modelKey: string, x: number, y: number,
    height3D: number, fallbackSize: number,
  ): Phaser.GameObjects.Image {
    const img = this.add.image(x, y, textureKey);
    this.fitSprite(img, fallbackSize);
    img.setData('creatureModel3DKey', modelKey);
    img.setData('creatureHeight3D', height3D);
    img.setData('facePlayer3D', true);
    return img;
  }

  private launchCatch(key: string, level: number, catchRate: number) {
    PartySystem.healAll(this.registry);
    // Grant the finale safety Master Ball at most once. Re-entering/reloading
    // the altar after it has been thrown must never silently restore the item.
    const grantFlag = 'hwanungMasterBallGranted';
    if (!this.registry.get(grantFlag)) {
      if (Inventory.count(this.registry, 'masterball') <= 0) {
        Inventory.add(this.registry, 'masterball', 1);
      }
      this.registry.set(grantFlag, true);
    }
    this.registry.set('wildId', key);
    this.registry.set('wildLevel', level);
    this.registry.set('wildCustom', true);
    this.registry.set('wildCatchRate', catchRate);
    this.registry.set('wildReturnScene', 'SacredPeakScene');
    this.registry.set('sacredPeakReturnX', this.px);
    this.registry.set('sacredPeakReturnY', this.py);
    this.cameras.main.fadeOut(600, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('rgAltarReturnX', 11 * 32 + 16);
        this.registry.set('rgAltarReturnY', 17 * 32 + 16);
        this.scene.start('RangrimAltarScene');
      });
    }
  }

  // ── TRUE END ────────────────────────────────────────────────────────────
  private runEnding() {
    this.registry.set('trueEndDone', true);
    this.registry.set('partIIDone', true);
    this.cutsceneActive = true;
    PartySystem.healAll(this.registry);

    const W = this.scale.width, H = this.scale.height;
    const kids: Phaser.GameObjects.GameObject[] = [];
    kids.push(this.add.rectangle(W / 2, H / 2, W, H, 0x0a1230, 1).setScrollFactor(0).setDepth(150));
    const stars = this.add.graphics().setScrollFactor(0).setDepth(151);
    for (let i = 0; i < 80; i++) { stars.fillStyle(0xffffff, Math.random() * 0.7 + 0.2); stars.fillCircle(Math.random() * W, Math.random() * H, Math.random() < 0.2 ? 2 : 1); }
    kids.push(stars);
    kids.push(this.add.text(W / 2, 60, tr('🌟  THE COMPLETE PANTHEON'), { fontSize: '24px', color: '#ffe88a', fontStyle: 'bold', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setScrollFactor(0).setDepth(152));
    kids.push(this.add.text(W / 2, H - 40, '환웅 · 풍백 · 우사 · 운사 · 나비할망', { fontSize: '15px', color: '#bcd4ff' }).setOrigin(0.5).setScrollFactor(0).setDepth(152));

    this.dialog.show([
      '노스단 is dismantled for good, Sovereign Clemont imprisoned alongside Ryeo. The founding myth\'s ancient retinue is united under a single trainer for the first time in millennia.',
      'Rival (looking up at the clearing sky): You caught a GOD, you know that? An actual god. ...I\'m never going to catch up to you, am I? Good. Wouldn\'t want it any other way.',
      '어사대장 Jinnok (bowing, the deepest honour of her order): Four hundred years the 어사대 guarded these peaks against outsiders. Today an outsider guarded them for US. You are no outsider anymore, southerner.',
      '어사대장 Jinnok: Carry this 마패. Any 어사대 in any northern city will aid you on sight. The north will remember your name as long as the mountains stand.',
      'Professor Song: The region is whole. North and south, spirit and sovereign — all at peace, all in your care. Whatever comes next for Onnuri... it\'s in good hands.',
      '🏆 You hold 환웅, 풍백, 우사, 운사, 나비할망 — the complete mythological pantheon of Onnuri.',
      'Prof. Song: Your journey belongs to history now, Champion. Let its story be told from the beginning.',
    ], () => {
      this.cameras.main.fadeOut(1200, 0, 0, 0, () => {
        kids.forEach(k => k.destroy());
        // Final order: credits first, then the Waterfall City celebration,
        // the gender-aware midnight rival scene, and the last title logo.
        this.registry.set('finalePartyPending', true);
        this.scene.start('SudoLabScene');
      });
    });
  }
}

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.SKY) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  fill(2, ROWS, 5, 13, T.ROCK);            // the ridge climb (sky on either flank)
  fill(ROWS - 2, ROWS, 7, 11, T.ROCK);     // entry from the Reaches
  fill(2, 10, 5, 13, T.ROCK);
  fill(4, 9, 6, 12, T.ALTAR);              // the descent altar
  for (const r of [30, 22, 14]) fill(r - 1, r + 2, 7, 11, T.DAIS);   // shrine platforms
  for (const r of [28, 20, 12]) fill(r, r + 1, 5, 13, T.BARRIER);    // sealed wards
  return m;
}
