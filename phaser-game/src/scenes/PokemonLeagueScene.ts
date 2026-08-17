import Phaser from 'phaser';
import { t, tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { PartySystem } from '../systems/PartySystem';
import { customForm } from '../data/CustomBattle';
import { markTrainerPortrait } from '../data/BattlePortraits';
import { HWANGEUM_STORY, hwangeumMeetingCount } from '../systems/HwangeumStory';

// On a Hall-of-Fame rematch (unlocked after catching 환웅) the Elite Four and the
// Champion return far stronger: every team level is raised by this amount, putting
// Hwangeum's aces in the high-70s/low-80s.
const REMATCH_LEVEL_BONUS = 12;

// ── Five-storey League tower ──────────────────────────────────────────────────
const T = { FLOOR: 0, WALL: 1, DAIS: 2, CARPET: 3, THRONE: 4, STAIRS: 5, STAGE: 6 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 18, ROWS = 18;
const COLORS: Record<Tile, number> = {
  [T.FLOOR]: 0x1c2336, [T.WALL]: 0x10141f, [T.DAIS]: 0x2e3a55,
  [T.CARPET]: 0x5a2030, [T.THRONE]: 0x4a3a10, [T.STAIRS]: 0x7586a8, [T.STAGE]: 0x242038,
};
const SOLID = new Set<Tile>([T.WALL]);
const MEMBER_COL = 9, MEMBER_ROW = 6;
const STAIR_COL = 9, STAIR_ROW = 2;

const ROOMS = [
  { title: 'Glacial Crane Hall', ko: '빙학의 전당', floor: 0x243746, dais: 0x56768a, accent: 0x9fe0ff },
  { title: 'Ten-Thousand Fold Forge', ko: '만철의 전당', floor: 0x30343b, dais: 0x66707b, accent: 0xcfd6e0 },
  { title: 'Hall of the High Wind', ko: '고풍의 전당', floor: 0x263b3c, dais: 0x52756d, accent: 0xa8e6c8 },
  { title: 'Mudang Vision Hall', ko: '신시의 전당', floor: 0x382d48, dais: 0x6b537d, accent: 0xe0b0ff },
  { title: 'HWANGEUM LIVE · MAIN STAGE', ko: '황금 메인 스테이지', floor: 0x141426, dais: 0x5a294f, accent: 0xffd54a },
] as const;

interface Member {
  key: string; name: string; type: string; color: number;
  intro: string[]; pokemon: { id: number; level: number; custom?: string }[]; expPool: number;
  /** Lines used when the player rematches as reigning Champion — now the masters
   *  are the ones challenging the protagonist. */
  rematchIntro?: string[];
}

const MEMBERS: Member[] = [
  {
    key: 'e4-gyeoul', name: 'Gyeoul', type: 'Ice', color: 0x9fe0ff,
    intro: [
      'Gyeoul: I am Gyeoul, first of the Elite Four. My cranes nest on the glacier.',
      'Gyeoul: The cold does not rush. Neither will I. Begin.',
    ],
    rematchIntro: [
      'Gyeoul: Champion. Since you took the throne, I have trained on the glacier for nothing but this rematch.',
      'Gyeoul: This time it is I who challenge YOU. Show me the winter has not been wasted.',
    ],
    pokemon: [
      { id: 0, level: 58, custom: 'bosongnun' },  // Ice/Fairy
      { id: 478, level: 58 },                      // Froslass (Ice/Ghost)
      { id: 0, level: 59, custom: 'luninari' },    // Ice/Fairy
      { id: 699, level: 59 },                      // Aurorus (Rock/Ice)
      { id: 473, level: 62 },                      // Mamoswine (Ice/Ground) ace
    ],
    expPool: 4600,
  },
  {
    key: 'e4-hwageum', name: 'Hwageum', type: 'Steel', color: 0xcfd6e0,
    intro: [
      'Hwageum: Goryeo smiths folded steel ten thousand times. So have I folded my team.',
      'Hwageum: Let us see what your edge is made of.',
    ],
    rematchIntro: [
      'Hwageum: Champion, my steel has been folded ten thousand times over since you last passed.',
      'Hwageum: I challenge you now — let us see whose edge has truly sharpened.',
    ],
    pokemon: [
      { id: 0, level: 59, custom: 'camerghoost' },  // Ghost/Steel
      { id: 0, level: 59, custom: 'hallowknight' }, // Bug/Steel — the insect-knight
      { id: 0, level: 60, custom: 'silicutis' },    // Steel/Bug
      { id: 395, level: 60 },                      // Empoleon (Water/Steel)
      { id: 0, level: 63, custom: 'hambillet' },   // Steel/Flying ace
    ],
    expPool: 4900,
  },
  {
    key: 'e4-baram', name: 'Baram', type: 'Flying', color: 0xa8e6c8,
    intro: [
      'Baram: I am Baram. The eagles and cranes of the cliffs answer to the wind.',
      'Baram: Rise to meet me — or be swept aside.',
    ],
    rematchIntro: [
      'Baram: Champion! The high winds have missed you — and I have raced them harder every day.',
      'Baram: This time the challenge is mine. Rise to meet me once more!',
    ],
    pokemon: [
      { id: 279, level: 60 },                      // Pelipper (Water/Flying)
      { id: 0, level: 60, custom: 'samdumae' },    // Flying/Fairy
      { id: 227, level: 62 },                      // Skarmory (Steel/Flying)
      { id: 334, level: 62 },                      // Altaria (Dragon/Flying)
      { id: 149, level: 64 },                      // Dragonite (Dragon/Flying) ace
    ],
    expPool: 5200,
  },
  {
    key: 'e4-saleum', name: 'Saleum', type: 'Psychic', color: 0xe0b0ff,
    intro: [
      'Saleum: The mudang sees what is, and what is coming. I have seen this battle.',
      'Saleum: Whether the vision holds is up to you. Come.',
    ],
    rematchIntro: [
      'Saleum: I foresaw your return to these halls, Champion — the vision was clear this time.',
      'Saleum: And this time it is I who challenge you. Let us see if my sight has sharpened.',
    ],
    pokemon: [
      { id: 282, level: 62 },                      // Gardevoir (Psychic/Fairy)
      { id: 0, level: 62, custom: 'unsilgami' },   // Psychic/Bug
      { id: 376, level: 63 },                      // Metagross (Steel/Psychic)
      { id: 0, level: 63, custom: 'frysm' },       // Water/Psychic
      { id: 0, level: 65, custom: 'supiryeong' },  // Ghost/Psychic ace
    ],
    expPool: 5500,
  },
];

const CHAMPION: Member = {
  key: 'champion-hwangeum', name: 'Champion Hwangeum', type: 'Champion', color: 0xffd54a,
  intro: [
    'Hwangeum: You made it. I watched your entire journey. The Jeju Summit — 나비할망 choosing you as her guardian. The tests, the battles, the growth.',
    'Hwangeum: Eight gyms, one legendary moth, and you still climbed back up here. I became Champion three years ago and called it a fluke for a year. I don\'t take many battles seriously anymore.',
    'Hwangeum: This one — I will. Show me everything you\'ve become.',
  ],
  rematchIntro: [
    'Hwangeum: So the Champion who dethroned me climbs back to my stage. I have waited for this rematch.',
    'Hwangeum: My team has grown far beyond the day you beat me — the region\'s apex, sharpened for you alone.',
    'Hwangeum: This time I challenge YOU. No fluke, no holding back. Everything I have, against everything you\'ve become!',
  ],
  // The Golden One fields the region's own apex Pokémon — almost all new species.
  pokemon: [
    { id: 0,   level: 65, custom: 'thanatoat' },    // Water/Ghost — grim-reaper crane
    { id: 0,   level: 66, custom: 'snoqueen' },     // Ice/Fairy — the frost sovereign
    { id: 0,   level: 66, custom: 'turtleship' },   // Steel/Dragon — armoured turtle-ship dragon
    { id: 0,   level: 68, custom: 'daejangseung' }, // Ghost/Fighting — risen totem (Sotori's evolution)
    { id: 0,   level: 69, custom: 'kkaakdang' },    // Flying/Dark — the sharp-suited crow boss
    { id: 0,   level: 70, custom: 'bonejoillion' }, // Electric/Steel — the golden ace
  ],
  expPool: 8200,
};

export class PokemonLeagueScene extends Phaser.Scene {
  private map!: Tile[][];
  // Each League floor is an authored interior. Keep dark wall art flat so it
  // never grows into a camera-blocking cliff around the room.
  public interior3D = true;
  public onlyNamedBuildings = true;
  public caveFloorHint = true;
  public clearSight3D = true;
  private floor = 1;
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = MEMBER_COL * TILE + 16;
  private py = 15 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private readonly SPEED = 120;

  constructor() { super('PokemonLeagueScene'); }

  preload() {
    for (const key of ['nabihalmang', 'cheonjisin']) {
      if (!this.textures.exists(key)) this.load.image(key, customForm(key)?.data.spriteUrl ?? `assets/dex/${key}.png`);
    }
    // Party sprites for the Hall of Fame line-up.
    for (const e of PartySystem.get(this.registry)) {
      if (e.spriteKey && e.spriteUrl && !this.textures.exists(e.spriteKey)) this.load.image(e.spriteKey, e.spriteUrl);
    }
  }

  private fitImg(img: Phaser.GameObjects.Image, size: number) {
    const src = this.textures.get(img.texture.key).getSourceImage();
    img.setScale(size / Math.max((src.width as number) || 1, (src.height as number) || 1));
  }

  private defeated(key: string) { return !!this.registry.get(`trainerDefeated_${key}`); }
  private get champBeaten() { return this.defeated('champion-hwangeum'); }
  /** True on a post-game rematch run: the Hall of Fame was already earned once, so
   *  the masters return stronger and initiate the challenge themselves. */
  private get isRematch() { return !!this.registry.get('hallOfFame'); }
  private get currentMember(): Member { return this.floor <= MEMBERS.length ? MEMBERS[this.floor - 1] : CHAMPION; }

  create() {

    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();

    // Losing anywhere restarts the climb from Gyeoul's first-floor chamber.
    let failedRun = false;
    if (this.registry.get('leagueRunFailed')) {
      this.registry.remove('leagueRunFailed');
      for (const m of MEMBERS) this.registry.remove(`trainerDefeated_${m.key}`);
      this.registry.set('hanbandoLeagueFloor', 1);
      this.registry.remove('leagueReturnX'); this.registry.remove('leagueReturnY');
      failedRun = true;
    }

    const savedFloor = this.registry.get('hanbandoLeagueFloor') as number | undefined;
    if (savedFloor === undefined) {
      const firstUnbeaten = MEMBERS.findIndex(m => !this.defeated(m.key));
      this.floor = firstUnbeaten >= 0 ? firstUnbeaten + 1 : 5;
    } else {
      this.floor = Phaser.Math.Clamp(Math.floor(savedFloor), 1, 5);
    }
    this.registry.set('hanbandoLeagueFloor', this.floor);

    // Ambient hall theme — but on the Champion's stage play Hwangeum's approach
    // prelude instead, so the tension builds before the fight (TrainerBattleScene
    // then switches to the dedicated 'champion' battle BGM). Skipped while the Hall
    // of Fame ceremony is about to run (it plays its own track).
    if (!this.registry.get('leagueHallOfFamePending')) {
      playBgm(this, this.floor === 5 ? 'championapproach' : 'leagueinterior');
    }

    this.px = MEMBER_COL * TILE + 16; this.py = 15 * TILE + 16;
    const rx = this.registry.get('leagueReturnX') as number | undefined;
    const ry = this.registry.get('leagueReturnY') as number | undefined;
    if (rx !== undefined && ry !== undefined && ry < ROWS * TILE) { this.px = rx; this.py = ry; }
    this.registry.remove('leagueReturnX'); this.registry.remove('leagueReturnY');

    this.map = buildMap(this.floor);
    this.drawMap();
    if (this.floor === 5) this.drawIdolMainStage();
    else this.drawEliteFloorDecor();
    this.drawMembers();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'PokemonLeagueScene');

    // Returned from beating the Champion → the Hall of Fame. Driven by the pending
    // flag TrainerBattleScene sets, so it also fires on rematches (when hallOfFame
    // is already set) instead of leaving the player stuck in the champion's room.
    if (this.registry.get('leagueHallOfFamePending')) {
      this.time.delayedCall(400, () => this.runHallOfFame());
    } else if (failedRun) {
      this.time.delayedCall(450, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'You were defeated. The League tower returns to its first floor and the stairways seal once more.',
          'The League is a single ascent — best all four masters again, in one unbroken run, to reach the Champion.',
        ], () => { this.cutsceneActive = false; });
      });
    } else if (!this.registry.get('leagueSeen')) {
      this.registry.set('leagueSeen', true);
      this.time.delayedCall(500, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'The Onnuri Pokémon League. Four masters guard the road to the Champion, each in their own hall.',
          'Each master occupies a separate floor. Defeat one, climb the newly opened stairs, and continue upward.',
          'The Champion awaits on the fifth-floor main stage. Each floor restores your team before its match.',
        ], () => { this.cutsceneActive = false; });
      });
    }
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const room = ROOMS[this.floor - 1];
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      const base = t === T.FLOOR ? room.floor : t === T.DAIS ? room.dais : COLORS[t];
      g.fillStyle(base, 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.FLOOR) { g.fillStyle(room.accent, 0.08); g.fillRect(c*TILE+3, r*TILE+3, TILE-6, TILE-6); }
      if (t === T.CARPET) { g.fillStyle(this.floor === 5 ? 0xff4fb8 : room.accent, 0.28); g.fillRect(c*TILE+5, r*TILE, TILE-10, TILE); }
      if (t === T.WALL) { g.fillStyle(0x070a12); g.fillRect(c*TILE+3, r*TILE+4, 7, 9); g.fillRect(c*TILE+17, r*TILE+16, 8, 9); }
      if (t === T.DAIS || t === T.STAGE) { g.fillStyle(room.accent, t === T.STAGE ? 0.22 : 0.14); g.fillRect(c*TILE+3, r*TILE+3, TILE-6, TILE-6); }
      if (t === T.THRONE) { g.fillStyle(0xffd76a, 0.72); g.fillRect(c*TILE+6, r*TILE+4, TILE-12, TILE-8); }
      if (t === T.STAIRS) {
        g.fillStyle(this.defeated(this.currentMember.key) ? 0xdfe8ff : 0x4a3048, 0.95);
        for (let i = 0; i < 4; i++) g.fillRect(c*TILE+3, r*TILE+4+i*7, TILE-6, 4);
      }
    }
    if (this.floor === 5) {
      // Colored light pools and a magenta runway are baked into the floor so
      // they remain part of the 3D stage instead of becoming flat UI overlays.
      g.fillStyle(0xff4fb8, 0.12); g.fillTriangle(2*TILE, 2*TILE, 8*TILE, 7*TILE, 5*TILE, 15*TILE);
      g.fillStyle(0x55ddff, 0.12); g.fillTriangle(16*TILE, 2*TILE, 10*TILE, 7*TILE, 13*TILE, 15*TILE);
      g.fillStyle(0xffd54a, 0.12); g.fillCircle(MEMBER_COL*TILE+16, MEMBER_ROW*TILE+16, 3.2*TILE);
    }
    const key = '__leagueMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(MEMBER_COL*TILE+16, 3.1*TILE, `${this.floor}F · ${room.ko}\n${room.title}`, {
      fontSize: '10px', color: this.floor === 5 ? '#fff2a8' : '#e8efff',
      backgroundColor: '#000000aa', padding: { x: 5, y: 3 }, align: 'center',
    }).setOrigin(0.5).setDepth(5);
    if (this.floor < 5) {
      const state = this.defeated(this.currentMember.key) ? `↑ ${this.floor + 1}F` : '🔒 승리 후 계단 개방';
      this.add.text(STAIR_COL*TILE+16, STAIR_ROW*TILE-3, tr(state), {
        fontSize: '9px', color: this.defeated(this.currentMember.key) ? '#fff' : '#ff9abb',
        backgroundColor: '#00000099', padding: { x: 3, y: 2 },
      }).setOrigin(0.5, 1).setDepth(5);
    }
    if (this.floor === 1) this.add.text(MEMBER_COL*TILE+16, (ROWS-0.6)*TILE, tr('↓ League Plaza'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#00000088', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawMembers() {
    const m = this.currentMember;
    if (this.defeated(m.key)) return;
    const g = this.add.graphics().setDepth(8);
    drawNpcBody(g, m.color);
    g.setPosition(MEMBER_COL * TILE + 16, MEMBER_ROW * TILE + 16);
    markTrainerPortrait(g, m.key);
    this.add.text(MEMBER_COL * TILE + 16, MEMBER_ROW * TILE - 16,
      m.type === 'Champion' ? '★ CHAMPION HWANGEUM ★' : `${m.name} — ${m.type}`, {
      fontSize: m.type === 'Champion' ? '10px' : '8px', color: '#ffe88a',
      backgroundColor: '#000000bb', padding: { x: 4, y: 2 }, align: 'center',
    }).setOrigin(0.5).setDepth(9);
  }

  private drawEliteFloorDecor() {
    if (this.floor === 1) {
      // Gyeoul: translucent ice-crystal sentinels.
      for (const x of [4.8, 13.2]) {
        const ice = this.add.triangle(x*TILE, 7*TILE, 0, 34, 15, 0, 30, 34, 0x9fe0ff, 0.72).setDepth(4);
        this.add.triangle(x*TILE, 7.3*TILE, 0, 24, 10, 0, 20, 24, 0xffffff, 0.38).setDepth(5);
        this.tweens.add({ targets: ice, alpha: { from: 0.45, to: 0.85 }, duration: 1100, yoyo: true, repeat: -1 });
      }
    } else if (this.floor === 2) {
      // Hwageum: steel presses with a furnace glow.
      for (const x of [4.8, 13.2]) {
        this.add.rectangle(x*TILE, 7*TILE, 34, 54, 0x343a44, 1).setStrokeStyle(4, 0xcfd6e0).setDepth(4);
        const forge = this.add.circle(x*TILE, 7*TILE+8, 10, 0xff7a30, 0.82).setDepth(5);
        this.tweens.add({ targets: forge, alpha: { from: 0.35, to: 1 }, scale: { from: 0.85, to: 1.12 }, duration: 620, yoyo: true, repeat: -1 });
      }
    } else if (this.floor === 3) {
      // Baram: wind rings orbiting the open-air dais.
      for (const x of [4.8, 13.2]) {
        const ring = this.add.circle(x*TILE, 7*TILE, 22, 0xa8e6c8, 0.08).setStrokeStyle(4, 0xa8e6c8, 0.8).setDepth(4);
        this.tweens.add({ targets: ring, angle: 360, scale: { from: 0.8, to: 1.25 }, alpha: { from: 0.8, to: 0.15 }, duration: 1300, repeat: -1 });
      }
    } else {
      // Saleum: twin mudang talismans and pulsing vision orbs.
      for (const x of [4.8, 13.2]) {
        this.add.rectangle(x*TILE, 7*TILE, 28, 58, 0xf1dfb8, 0.92).setStrokeStyle(3, 0xe0b0ff).setDepth(4);
        this.add.text(x*TILE, 7*TILE, '神\n視', { fontSize: '14px', color: '#7a285e', align: 'center', fontStyle: 'bold' }).setOrigin(0.5).setDepth(5);
        const orb = this.add.circle(x*TILE, 5.65*TILE, 9, 0xe0b0ff, 0.65).setDepth(5);
        this.tweens.add({ targets: orb, alpha: { from: 0.25, to: 0.95 }, scale: { from: 0.75, to: 1.25 }, duration: 900, yoyo: true, repeat: -1 });
      }
    }
  }

  /** Fifth floor: a concert-scale idol main stage instead of another throne room. */
  private drawIdolMainStage() {
    const cx = MEMBER_COL * TILE + 16;
    const screen = this.add.graphics().setDepth(3);
    screen.fillStyle(0x070712, 1); screen.fillRect(4*TILE, 1.25*TILE, 10*TILE, 2.25*TILE);
    screen.lineStyle(5, 0xffd54a, 0.95); screen.strokeRect(4*TILE, 1.25*TILE, 10*TILE, 2.25*TILE);
    for (let i = 0; i < 18; i++) {
      const color = [0xff4fb8, 0x55ddff, 0xffd54a][i % 3];
      screen.fillStyle(color, 0.55);
      screen.fillRect((4.2 + (i % 9) * 1.06) * TILE, (1.5 + Math.floor(i / 9) * 1.15) * TILE, 12, 8);
    }
    this.add.text(cx, 2.25*TILE, 'HWANGEUM\nLIVE', {
      fontSize: '24px', color: '#fff6b0', fontStyle: 'bold', align: 'center',
      stroke: '#b52a78', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(6);

    // Speaker towers and stage-edge bulbs.
    for (const x of [4.4, 13.6]) {
      const speaker = this.add.rectangle(x*TILE, 6*TILE, 38, 90, 0x090912, 1).setStrokeStyle(3, 0x8b8ba8).setDepth(4);
      for (const dy of [-25, 24]) this.add.circle(x*TILE, 6*TILE+dy, 12, 0x28283d).setStrokeStyle(3, 0xff4fb8).setDepth(5);
      speaker.setAlpha(0.95);
    }
    const bulbs: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 12; i++) {
      const bulb = this.add.circle((4.2 + i*0.88)*TILE, 8.2*TILE, 5, [0xff4fb8, 0x55ddff, 0xffd54a][i % 3], 0.85).setDepth(5);
      bulbs.push(bulb);
    }
    this.tweens.add({ targets: bulbs, alpha: { from: 0.3, to: 1 }, duration: 420, yoyo: true, repeat: -1, stagger: 70 });

    // Audience glow sticks line both sides of the runway.
    for (const row of [10, 12, 14, 16]) for (const col of [4.5, 5.5, 12.5, 13.5]) {
      const stick = this.add.rectangle(col*TILE, row*TILE, 4, 20, (row + col) % 2 ? 0xff4fb8 : 0x55ddff, 0.9)
        .setAngle(col < 9 ? -18 : 18).setDepth(4);
      this.tweens.add({ targets: stick, angle: stick.angle + (col < 9 ? 24 : -24), duration: 520 + row*15, yoyo: true, repeat: -1 });
    }

    // Moving spotlights cross over the Champion.
    const leftBeam = this.add.triangle(3*TILE, 4*TILE, 0, 0, 32, 0, 6*TILE, 9*TILE, 0xff4fb8, 0.13).setOrigin(0.5, 0).setDepth(2);
    const rightBeam = this.add.triangle(15*TILE, 4*TILE, 0, 0, 32, 0, -6*TILE, 9*TILE, 0x55ddff, 0.13).setOrigin(0.5, 0).setDepth(2);
    this.tweens.add({ targets: leftBeam, angle: { from: -8, to: 12 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: rightBeam, angle: { from: 8, to: -12 }, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
    this.add.rectangle(this.scale.width / 2, 22, 400, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, t(
      `🏛 Onnuri Pokémon League — ${this.floor}F · ${ROOMS[this.floor - 1].title}`,
      `🏛 온누리 포켓몬 리그 — ${this.floor}층 · ${ROOMS[this.floor - 1].ko}`,
    ), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SPACE: challenge  M: menu'), {
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
      const nx = this.px + (dx / len) * this.SPEED * dt, ny = this.py + (dy / len) * this.SPEED * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > 180) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkMembers();
    this.checkStairs();
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

  private checkMembers() {
    const m = this.currentMember;
    if (this.defeated(m.key)) return;
    const wx = MEMBER_COL * TILE + 16, wy = MEMBER_ROW * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) >= TILE * 1.6) return;
    this.cutsceneActive = true;
    PartySystem.healAll(this.registry);
    const healLine = this.floor === 5
      ? '(Backstage support restores your team to full health before the headline match.)'
      : '(The floor\'s healing machine restores your team to full health.)';
    // On a rematch the masters return far stronger and challenge the Champion first.
    let intro = this.isRematch && m.rematchIntro ? m.rematchIntro : m.intro;
    if (!this.isRematch && m.key === 'champion-hwangeum') {
      const meetings = hwangeumMeetingCount(this.registry);
      if (meetings > 0) {
        const rememberedPlaces = [
          this.registry.get(HWANGEUM_STORY.gorgeRescue) ? t('Diamond Gorge', '금강 협곡') : '',
          this.registry.get(HWANGEUM_STORY.contest) ? t('the Contest stage', '콘테스트 무대') : '',
          this.registry.get(HWANGEUM_STORY.forestGuard) ? t('the Forest Shrine', '고대 숲 사당') : '',
          this.registry.get(HWANGEUM_STORY.jejuRescue) ? t('the Jeju summit', '제주 정상') : '',
          this.registry.get(HWANGEUM_STORY.leagueInvitation) ? t('the Sunrise lighthouse', '일출시티 등대') : '',
        ].filter(Boolean).join(t(', ', ', '));
        intro = [
          this.registry.get(HWANGEUM_STORY.leagueInvitation)
            ? t('Hwangeum: You accepted my invitation. Welcome to the one stage neither of us can leave unfinished.',
                '황금: 내 초대를 받아들였군. 우리 둘 다 끝내지 않고는 떠날 수 없는 무대에 온 걸 환영해.')
            : t('Hwangeum: You made it. This time there is no emergency between us — only the battle we both chose.',
                '황금: 왔구나. 이번에는 우리 사이에 위급한 일은 없어 — 우리 둘이 선택한 배틀만 있을 뿐이지.'),
          t(`Hwangeum: We met through ${meetings} turning points — ${rememberedPlaces}. I watched what you protected when winning was not the whole objective.`,
            `황금: 우리는 ${meetings}번의 전환점에서 만났지 — ${rememberedPlaces}. 승리가 전부가 아닐 때 네가 무엇을 지켰는지 나는 보았다.`),
          this.registry.get(HWANGEUM_STORY.contest)
            ? t('Hwangeum: No judges, cameras or appeal scores today. Our Pokémon will give the only verdict that matters here.',
                '황금: 오늘은 심사위원도, 카메라도, 어필 점수도 없어. 여기서는 우리 포켓몬이 유일한 답을 내릴 거야.')
            : t('Hwangeum: Eight badges and a region that trusts you brought you here. Now show me the trainer behind those deeds.',
                '황금: 여덟 배지와 너를 믿는 지방이 널 여기까지 데려왔어. 이제 그 행동 뒤의 트레이너를 보여 줘.'),
          t('Hwangeum: I will answer as Champion — with every partner, every lesson, and nothing held back. Begin!',
            '황금: 나도 챔피언으로서 답하겠다 — 모든 파트너와, 모든 배움과, 한 점의 여유도 남기지 않고. 시작하자!'),
        ];
      }
    }
    const team = this.isRematch
      ? m.pokemon.map(p => ({ ...p, level: p.level + REMATCH_LEVEL_BONUS }))
      : m.pokemon;
    this.dialog.show([healLine, ...intro], () => {
      this.registry.set('trainerName', m.name);
      this.registry.set('trainerKey', m.key);
      this.registry.set('trainerPokemon', JSON.stringify(team));
      this.registry.set('trainerExpPool', m.expPool);
      this.registry.set('trainerReturnScene', 'PokemonLeagueScene');
      this.registry.set('hanbandoLeagueFloor', this.floor);
      this.registry.set('leagueReturnX', MEMBER_COL * TILE + 16);
      this.registry.set('leagueReturnY', (MEMBER_ROW + 2) * TILE + 16);
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    });
  }

  private checkStairs() {
    if (this.floor >= 5 || !this.defeated(this.currentMember.key)) return;
    const sx = STAIR_COL * TILE + 16, sy = STAIR_ROW * TILE + 16;
    if (Math.hypot(this.px - sx, this.py - sy) >= TILE * 0.95) return;
    this.cutsceneActive = true;
    this.floor++;
    this.registry.set('hanbandoLeagueFloor', this.floor);
    this.registry.remove('leagueReturnX');
    this.registry.remove('leagueReturnY');
    this.cameras.main.fadeOut(350, 0, 0, 0, () => this.scene.restart());
  }

  private checkExit() {
    if (this.cutsceneActive) return;
    if (this.floor === 1 && this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('leaguePlazaReturnX', 14 * 32); this.registry.set('leaguePlazaReturnY', 12 * 32 + 16);
        this.scene.start('LeaguePlazaScene');
      });
    }
  }

  // ── Hall of Fame ──────────────────────────────────────────────────────────
  private runHallOfFame() {
    // A rematch is any Hall of Fame run after the first (hallOfFame already set).
    const rematch = !!this.registry.get('leagueHallOfFameRematchPending');
    this.registry.remove('leagueHallOfFamePending');
    this.registry.remove('leagueHallOfFameRematchPending');
    // Count every enshrinement so the ceremony can announce which clear this is.
    const clears = ((this.registry.get('leagueClears') as number) ?? 0) + 1;
    this.registry.set('leagueClears', clears);
    this.registry.set('hallOfFame', true);
    this.registry.set('championDefeated', true);
    playBgm(this, 'halloffame');
    this.cutsceneActive = true;
    const W = this.scale.width, H = this.scale.height;

    // Starry overlay (zoom-compensated like DialogBox).
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x05060f, 1);
    const stars = this.add.graphics();
    for (let i = 0; i < 90; i++) {
      stars.fillStyle(0xffffff, Math.random() * 0.7 + 0.2);
      stars.fillCircle(Math.random() * W, Math.random() * H, Math.random() < 0.2 ? 2 : 1);
    }
    const kids: Phaser.GameObjects.GameObject[] = [bg, stars];

    // The dawn moth she now protects, small at the top. Kept high and compact so
    // it never overlaps the centre Pokémon of the first party row (which shares the
    // same x = W/2) — the player may also carry their own 나비할망.
    if (this.textures.exists('nabihalmang')) {
      const moth = this.add.image(W / 2, H * 0.115, 'nabihalmang').setAlpha(0);
      this.fitImg(moth, 84);
      this.tweens.add({ targets: moth, alpha: 1, duration: 1500 });
      kids.push(moth);
    }
    const title = this.add.text(W / 2, H * 0.04, tr('🏆 HALL OF FAME'), {
      fontSize: '26px', color: '#ffe88a', fontStyle: 'bold', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);
    kids.push(title);

    // The champion's party, displayed graphically.
    const party = PartySystem.get(this.registry);
    const cols = 3, cellW = 230, cellH = 170;
    const rowsN = Math.ceil(Math.max(party.length, 1) / cols);
    // Clamp the grid's top so the first row always clears the moth above it.
    const startY = Math.max(H * 0.36, H * 0.32 - (rowsN - 1) * cellH / 2);
    party.forEach((e, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const inRow = Math.min(party.length - row * cols, cols);
      const x = W / 2 + (col - (inRow - 1) / 2) * cellW;
      const y = startY + row * cellH;
      const items: Phaser.GameObjects.GameObject[] = [];
      if (this.textures.exists(e.spriteKey)) {
        const img = this.add.image(x, y, e.spriteKey).setAlpha(0);
        this.fitImg(img, 116);
        items.push(img);
      } else {
        items.push(this.add.circle(x, y, 40, 0x33405a).setAlpha(0));
      }
      const cap = this.add.text(x, y + 74, `${e.name}  Lv.${e.level}`, {
        fontSize: '13px', color: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 4,
      }).setOrigin(0.5).setAlpha(0);
      items.push(cap);
      kids.push(...items);
      this.tweens.add({ targets: items, alpha: 1, duration: 600, delay: 400 + i * 220 });
    });

    // This overlay is created after the 3D interior mirror is active. Keep each
    // child screen-fixed so the mirror never adopts and hides the ceremony art.
    kids.forEach(kid => {
      const screenObject = kid as Phaser.GameObjects.GameObject & {
        setScrollFactor?: (x: number, y?: number) => unknown;
      };
      screenObject.setScrollFactor?.(0);
    });
    const root = this.add.container(0, 0, kids).setScrollFactor(0).setDepth(140);
    const zoom = this.cameras.main?.zoom ?? 1, s = 1 / zoom;
    root.setScale(s); root.setPosition((W / 2) * (1 - s), (H / 2) * (1 - s));

    PartySystem.healAll(this.registry);
    const countLine = t(
      `🏆 Hall of Fame registration — Clear No. ${clears}!`,
      `🏆 명예의 전당 ${clears}회차 등록 완료!`,
    );

    // The Hall of Fame is now a self-contained ceremony: enshrinement, credits and
    // "THE END" only. The Rival's northern-news story plays SEPARATELY back in
    // Capitol City (see CapitolCityScene.playCapitolRivalNews), triggered by the
    // capitolRivalNewsPending flag set below.
    const firstVictoryLines = [
      'Hwangeum kneels to his fallen ace first — always his Pokémon first — then stands.',
      'Hwangeum: ...Good. Three years I\'ve wondered when someone would come who could do this. I think I\'ve been waiting for you specifically.',
      'Hwangeum (extending his hand): Welcome to the Hall of Fame. You earned every step of it.',
      '🏆 Your team is recorded in the Hall of Fame!',
      countLine,
      '— The credits roll over a montage of the Onnuri League arc — Capitol City, the Diamond Gorge, the tidal coasts, the ancient forest, the Jeju vents, the Jeju Summit —',
      "— culminating in 나비할망's metallic wings catching the dawn light as she settles beside you, the guardian of the south you have become.",
      '— THE END —',
      'Phase 1: Onnuri League — COMPLETE ✓',
    ];
    const rematchLines = [
      'Hwangeum: ...Beaten again — and by a wider margin than before. Of course. You truly are the Champion of the south.',
      'Hwangeum: Every one of us climbed back stronger to challenge you, and still you stand above us all.',
      '🏆 Your team is enshrined in the Hall of Fame once more!',
      countLine,
      'Your Pokémon have been fully restored. You will now return to the Pokémon League entrance.',
    ];

    if (!rematch) this.registry.set('phase1Complete', true);
    this.dialog.show(rematch ? rematchLines : firstVictoryLines, () => {
      this.cameras.main.fadeOut(900, 0, 0, 0, () => {
        if (rematch) {
          // Fresh gauntlet next time, and drop the player back at the League entrance.
          this.registry.set('hanbandoLeagueFloor', 1);
          this.registry.remove('leagueReturnX');
          this.registry.remove('leagueReturnY');
          const px = 14 * 32, py = 12 * 32 + 16;
          this.registry.set('leaguePlazaReturnX', px);
          this.registry.set('leaguePlazaReturnY', py);
          SaveManager.save(this.registry, px, py, 'LeaguePlazaScene');
          this.scene.start('LeaguePlazaScene');
          return;
        }
        // The Rival delivers the northern news back in Capitol City, not here.
        this.registry.set('capitolRivalNewsPending', true);
        this.registry.set('capitalReturnX', 24 * 32 + 16);
        this.registry.set('capitalReturnY', 31 * 32 + 16);
        this.scene.start('CapitolCityScene');
      });
    });
  }
}

function buildMap(floor: number): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.WALL) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  fill(1, ROWS - 1, 3, COLS - 3, T.FLOOR);
  if (floor < 5) {
    fill(2, ROWS - 1, 8, 10, T.CARPET);
    fill(4, 8, 6, 12, T.DAIS);
    fill(1, 3, 8, 10, T.STAIRS);
  } else {
    // Headline stage across the north wall, with a long idol runway stretching
    // through the audience toward the challenger entrance.
    fill(2, 9, 4, 14, T.STAGE);
    fill(4, 8, 7, 11, T.THRONE);
    fill(8, ROWS - 1, 8, 10, T.CARPET);
  }
  if (floor === 1) fill(ROWS - 1, ROWS, 8, 10, T.FLOOR);
  return m;
}
