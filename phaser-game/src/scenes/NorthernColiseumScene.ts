import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawNpcBody, playerDesign, rivalTrainerName } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { PartySystem } from '../systems/PartySystem';
import { markTrainerPortrait } from '../data/BattlePortraits';

// ── POST-GAME I — The Northern League (interior gauntlet) ────────────────────────
// Inside the austere North-Korean-style palace: five separate floors, each with
// its own chamber. Defeating a Northern Elite member opens the stairway to the
// next storey; Champion Taewang waits alone in the throne room at the summit.

const T = { FLOOR: 0, WALL: 1, DAIS: 2, BARRIER: 3, CARPET: 4, THRONE: 5, BANNER: 6, STAIRS: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 18, ROWS = 18;

const COLORS: Record<Tile, number> = {
  [T.FLOOR]: 0x35373d, [T.WALL]: 0x14151a, [T.DAIS]: 0x4a4d55, [T.BARRIER]: 0x5f1a1a,
  [T.CARPET]: 0x6e1216, [T.THRONE]: 0x5f4a10, [T.BANNER]: 0x361212, [T.STAIRS]: 0x777b86,
};
const SOLID = new Set<Tile>([T.WALL, T.BANNER]);
const MEMBER_COL = 9, MEMBER_ROW = 6;
const STAIR_COL = 9, STAIR_ROW = 2;
const NORTH_CENTER_X = 4 * TILE + 16;
const NORTH_CENTER_Y = 17 * TILE + 16;

const ROOMS = [
  { title: 'Stone Foundation Chamber', ko: '암반의 방', floor: 0x403c38, dais: 0x6d604f, accent: 0xc9a86a },
  { title: 'Frozen Sky Chamber', ko: '빙설의 방', floor: 0x34444e, dais: 0x638493, accent: 0xbfe8ff },
  { title: 'Iron Fortress Chamber', ko: '철벽의 방', floor: 0x363a40, dais: 0x69717c, accent: 0xced4de },
  { title: 'White Tiger Chamber', ko: '백호의 방', floor: 0x40364c, dais: 0x6b537d, accent: 0xd8b0ff },
  { title: 'Taewang Throne Room', ko: '태왕의 옥좌', floor: 0x343238, dais: 0x756324, accent: 0xffd54a },
] as const;

interface Member {
  key: string; name: string; type: string; col: number; row: number;
  color: number; barrierRow: number;
  intro: string[]; pokemon: { id: number; level: number; custom?: string }[]; expPool: number;
}

const MEMBERS: Member[] = [
  {
    key: 'north-seorak', name: 'Seorak', type: 'Rock/Ground', col: 9, row: 29, color: 0xc9a86a, barrierRow: 27,
    intro: [
      'Seorak: First of the Northern Elite. My mountains have stood since before your peninsula had a name.',
      'Seorak: Let us see if a southerner can move stone. Begin.',
    ],
    pokemon: [
      { id: 0, level: 76, custom: 'halubang' }, { id: 0, level: 76, custom: 'palossandx' },
      { id: 306, level: 77 }, { id: 445, level: 77 }, { id: 0, level: 79, custom: 'dracoelido' },
    ],
    expPool: 6200,
  },
  {
    key: 'north-hanseol', name: 'Hanseol', type: 'Ice', col: 9, row: 24, color: 0xbfe8ff, barrierRow: 22,
    intro: [
      'Hanseol: The northern winter never ends. Neither does my patience.',
      'Hanseol: Freeze, southerner — or prove you can weather the cold.',
    ],
    pokemon: [
      { id: 0, level: 77, custom: 'snoqueen' }, { id: 478, level: 77 },
      { id: 91, level: 78 }, { id: 0, level: 78, custom: 'luninari' }, { id: 0, level: 80, custom: 'snoqueen' },
    ],
    expPool: 6500,
  },
  {
    key: 'north-cheolgang', name: 'Cheolgang', type: 'Steel', col: 9, row: 19, color: 0xced4de, barrierRow: 17,
    intro: [
      'Cheolgang: Fortress-forged discipline. My steel does not bend, and it does not tire.',
      'Cheolgang: Strike it. See what breaks first.',
    ],
    pokemon: [
      { id: 0, level: 78, custom: 'silicutis' }, { id: 0, level: 78, custom: 'turtleship' },
      { id: 208, level: 79 }, { id: 0, level: 79, custom: 'hallowknight' }, { id: 0, level: 81, custom: 'martbadger' },
    ],
    expPool: 6800,
  },
  {
    key: 'north-baekho', name: 'Baekho', type: 'Dragon', col: 9, row: 14, color: 0xd8b0ff, barrierRow: 12,
    intro: [
      'Baekho: The white tiger of the north. Last gate before the throne.',
      'Baekho: My storm-dragons have thrown down every challenger before you. Rise — or fall.',
    ],
    pokemon: [
      { id: 0, level: 79, custom: 'beardiedragon' }, { id: 612, level: 79 },
      { id: 330, level: 80 }, { id: 706, level: 80 }, { id: 0, level: 82, custom: 'dracopaia' },
    ],
    expPool: 7200,
  },
];

const TAEWANG: Member = {
  key: 'north-taewang', name: 'Champion Taewang', type: 'Champion', col: 9, row: 6, color: 0xffd54a, barrierRow: -1,
  intro: [
    'Taewang: So. The little southern peninsula finally sends someone who climbed all the way to my throne. Hwangeum never did.',
    'Taewang: You\'ve come a long way from your waterfalls and lantern festivals, southerner.',
    'Taewang: Let us see if the journey made you strong — or merely lucky.',
  ],
  pokemon: [
    { id: 0, level: 83, custom: 'mperodactyl' }, { id: 0, level: 84, custom: 'turtleship' },
    { id: 149, level: 84 }, { id: 445, level: 85 }, { id: 0, level: 85, custom: 'komodread' },
    { id: 0, level: 87, custom: 'noeryong' },
  ],
  expPool: 10000,
};

export class NorthernColiseumScene extends Phaser.Scene {
  // This is an authored interior: retain the painted floor but never raise its
  // near-black perimeter into camera-blocking terrain.
  public interior3D = true;
  public caveFloorHint = true;
  public onlyNamedBuildings = true;
  public clearSight3D = true;

  private map!: Tile[][];
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
  private spawnGuard = false;
  private readonly SPEED = 120;

  constructor() { super('NorthernColiseumScene'); }

  preload() {
    // Party sprites for the Northern Hall of Fame line-up.
    for (const e of PartySystem.get(this.registry)) {
      if (e.spriteKey && e.spriteUrl && !this.textures.exists(e.spriteKey)) this.load.image(e.spriteKey, e.spriteUrl);
    }
  }

  private fitImg(img: Phaser.GameObjects.Image, size: number) {
    const src = this.textures.get(img.texture.key).getSourceImage();
    img.setScale(size / Math.max((src.width as number) || 1, (src.height as number) || 1));
  }

  private defeated(key: string) { return !!this.registry.get(`trainerDefeated_${key}`); }
  private get taewangBeaten() { return this.defeated('north-taewang'); }
  private get northernEndingPending() {
    // Recovery path for a save/hot reload made after the old ceremony set
    // northLeagueDone but before it could hand control to the Sudo celebration.
    const unfinishedCeremony = !!this.registry.get('northHallOfFame')
      && !!this.registry.get('northReunionPending')
      && !this.registry.get('sudoPartyPending')
      && !this.registry.get('sudoPartyDone');
    return !!this.registry.get('northHallOfFamePending')
      // Also recover saves already stranded in the empty throne room, including
      // rematch saves created before rematches raised the pending flag.
      || this.taewangBeaten
      || unfinishedCeremony;
  }
  private get currentMember(): Member { return this.floor <= MEMBERS.length ? MEMBERS[this.floor - 1] : TAEWANG; }

  create() {

    // Coliseum hall theme — but not when we're about to run the Hall of Fame ceremony.
    if (!this.northernEndingPending) playBgm(this, 'leagueinterior');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();
    this.spawnGuard = true;
    this.time.delayedCall(600, () => { this.spawnGuard = false; });

    // Failed the northern gauntlet (lost to any master or Taewang)? Re-seal all four
    // and restart from the first, back at the entrance.
    if (this.registry.get('northLeagueRunFailed')) {
      this.registry.remove('northLeagueRunFailed');
      for (const k of ['north-seorak', 'north-hanseol', 'north-cheolgang', 'north-baekho']) {
        this.registry.remove(`trainerDefeated_${k}`);
      }
      this.registry.set('northLeagueFloor', 1);
      this.registry.remove('northColiseumReturnX'); this.registry.remove('northColiseumReturnY');
    }

    const savedFloor = this.registry.get('northLeagueFloor') as number | undefined;
    if (savedFloor === undefined) {
      const firstUnbeaten = MEMBERS.findIndex(m => !this.defeated(m.key));
      this.floor = firstUnbeaten >= 0 ? firstUnbeaten + 1 : 5;
    } else {
      this.floor = Phaser.Math.Clamp(Math.floor(savedFloor), 1, 5);
    }
    this.registry.set('northLeagueFloor', this.floor);

    this.px = MEMBER_COL * TILE + 16; this.py = 15 * TILE + 16;
    const rx = this.registry.get('northColiseumReturnX') as number | undefined;
    const ry = this.registry.get('northColiseumReturnY') as number | undefined;
    if (rx !== undefined && ry !== undefined && ry < ROWS * TILE) { this.px = rx; this.py = ry; }
    this.registry.remove('northColiseumReturnX'); this.registry.remove('northColiseumReturnY');

    this.map = buildMap(this.floor);
    this.drawMap();
    this.drawMembers();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'NorthernColiseumScene');

    if (this.northernEndingPending) {
      this.time.delayedCall(400, () => this.runNorthernEnding());
    } else if (!this.registry.get('northColiseumSeen')) {
      this.registry.set('northColiseumSeen', true);
      this.time.delayedCall(500, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'Inside, the palace is severe and almost bare — grey granite the height of a canyon, red state banners hanging in the still, cold air, a single gold star burning above the distant throne.',
          'The Northern League rises through five separate storeys. Defeat each master, take the stairs to the chamber above, and climb until you reach Taewang at the summit.',
          'Every floor restores your team before the match.',
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
      if (t === T.FLOOR) { g.fillStyle(room.accent, 0.08); g.fillRect(c*TILE+2, r*TILE+2, TILE-4, TILE-4); }
      if (t === T.CARPET) { g.fillStyle(room.accent, 0.18); g.fillRect(c*TILE+7, r*TILE, TILE-14, TILE); }
      if (t === T.WALL) { g.fillStyle(0x0b0c10); g.fillRect(c*TILE+2, r*TILE+2, TILE-4, TILE-4); g.fillStyle(0x1c1d24); g.fillRect(c*TILE+5, r*TILE+3, TILE-10, TILE-6); }
      if (t === T.BANNER) { g.fillStyle(room.accent, 0.75); g.fillRect(c*TILE+8, r*TILE, TILE-16, TILE); }
      if (t === T.DAIS) { g.fillStyle(room.accent, 0.15); g.fillRect(c*TILE+3, r*TILE+3, TILE-6, TILE-6); }
      if (t === T.THRONE) { g.fillStyle(0xffd76a, 0.75); g.fillRect(c*TILE+6, r*TILE+4, TILE-12, TILE-8); }
      if (t === T.STAIRS) {
        g.fillStyle(this.defeated(this.currentMember.key) ? 0xe4e7ef : 0x5a3034, 0.9);
        for (let i = 0; i < 4; i++) g.fillRect(c*TILE+3, r*TILE+4+i*7, TILE-6, 4);
      }
    }
    const key = '__northMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    // Each storey has its own identity and material language.
    if (this.floor === 1) {
      for (const x of [5, 13]) this.add.rectangle(x*TILE+16, 7*TILE+16, 28, 22, room.accent, 0.65).setDepth(3);
    } else if (this.floor === 2) {
      for (const x of [5, 13]) this.add.triangle(x*TILE+16, 7*TILE+16, 0, 25, 14, 0, 28, 25, room.accent, 0.7).setDepth(3);
    } else if (this.floor === 3) {
      for (const x of [5, 13]) this.add.rectangle(x*TILE+16, 7*TILE+16, 26, 34, room.accent, 0.55).setStrokeStyle(3, 0x363a40).setDepth(3);
    } else if (this.floor === 4) {
      for (const x of [5, 13]) this.add.text(x*TILE+16, 7*TILE+16, '虎', { fontSize: '25px', color: '#e8d5ff', stroke: '#2a1838', strokeThickness: 4 }).setOrigin(0.5).setDepth(4);
    } else {
      this.add.text(MEMBER_COL*TILE+16, 1.5*TILE, '★', { fontSize: '48px', color: '#ffe14a', stroke: '#7a5a00', strokeThickness: 4 }).setOrigin(0.5).setDepth(5);
    }
    this.add.text(MEMBER_COL*TILE+16, 3.15*TILE, `${this.floor}F · ${room.ko}\n${room.title}`, {
      fontSize: '10px', color: '#ffe88a', backgroundColor: '#00000099', padding: { x: 5, y: 3 }, align: 'center',
    }).setOrigin(0.5).setDepth(5);
    if (this.floor < 5) {
      const state = this.defeated(this.currentMember.key) ? `↑ ${this.floor + 1}F` : '🔒 승리 후 계단 개방';
      this.add.text(STAIR_COL*TILE+16, STAIR_ROW*TILE-3, tr(state), {
        fontSize: '9px', color: this.defeated(this.currentMember.key) ? '#fff' : '#ff9a9a',
        backgroundColor: '#00000099', padding: { x: 3, y: 2 },
      }).setOrigin(0.5, 1).setDepth(5);
    }
    if (this.floor === 1) this.add.text(MEMBER_COL*TILE+16, (ROWS-0.6)*TILE, tr('↓ Back to the plaza'), {
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
    const label = m.type === 'Champion' ? '👑 Taewang' : `${m.name} — ${m.type}`;
    this.add.text(MEMBER_COL * TILE + 16, MEMBER_ROW * TILE - 16, label, {
      fontSize: '8px', color: '#ffe88a', backgroundColor: '#00000099', padding: { x: 2, y: 1 }, align: 'center',
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
    this.add.text(this.scale.width / 2, 22, tr(`🏯 Northern League — ${this.floor}F · ${ROOMS[this.floor - 1].ko}`), {
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
    this.dialog.show(['(The floor\'s healing machine restores your team to full health.)', ...m.intro], () => {
      this.registry.set('trainerName', m.name);
      this.registry.set('trainerKey', m.key);
      this.registry.set('trainerPokemon', JSON.stringify(m.pokemon));
      this.registry.set('trainerExpPool', m.expPool);
      this.registry.set('trainerReturnScene', 'NorthernColiseumScene');
      this.registry.set('northLeagueFloor', this.floor);
      this.registry.set('northColiseumReturnX', MEMBER_COL * TILE + 16);
      this.registry.set('northColiseumReturnY', (MEMBER_ROW + 2) * TILE + 16);
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    });
  }

  private checkStairs() {
    if (this.floor >= 5 || !this.defeated(this.currentMember.key)) return;
    const sx = STAIR_COL * TILE + 16, sy = STAIR_ROW * TILE + 16;
    if (Math.hypot(this.px - sx, this.py - sy) >= TILE * 0.95) return;
    this.cutsceneActive = true;
    this.floor++;
    this.registry.set('northLeagueFloor', this.floor);
    this.registry.remove('northColiseumReturnX');
    this.registry.remove('northColiseumReturnY');
    this.cameras.main.fadeOut(350, 0, 0, 0, () => this.scene.restart());
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (this.floor === 1 && this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('northPlazaReturnX', 10 * TILE + 16);
        this.registry.set('northPlazaReturnY', 11 * TILE + 16);
        this.scene.start('NorthernPlazaScene');
      });
    }
  }

  // ── Taewang's farewell ─────────────────────────────────────────────────────
  /**
   * The half of the ending that belongs to the THRONE ROOM. Taewang rises, says
   * what thirty years on that throne earned him the right to say, and then walks
   * the player to the stone register — HallOfFameScene takes it from there.
   *
   * This used to run the enshrinement inline, so his farewell scrolled underneath
   * a wall of artwork that had already appeared. Splitting it lets each beat land,
   * and both leagues now share one polished registration room.
   */
  private runNorthernEnding() {
    const rematch = !!this.registry.get('northHallOfFameRematchPending')
      || (!!this.registry.get('northLeagueDone') && !this.registry.get('northReunionPending'));
    this.registry.remove('northHallOfFamePending');
    this.registry.remove('northHallOfFameRematchPending');
    this.registry.set('northLeagueDone', true);
    this.registry.set('northHallOfFame', true);
    if (!rematch) this.registry.set('northReunionPending', true);
    // Count every enshrinement so the register can announce which clear this is.
    const clears = ((this.registry.get('northLeagueClears') as number) ?? 0) + 1;
    this.registry.set('northLeagueClears', clears);
    // The quiet register theme starts the moment he speaks, not when the room
    // opens — otherwise the battle's restored track plays under the farewell.
    playBgm(this, 'halloffame');
    this.cutsceneActive = true;
    PartySystem.healAll(this.registry);

    // Where the forecourt should put the player back down after a re-clear.
    this.registry.set('northPlazaReturnX', NORTH_CENTER_X);
    this.registry.set('northPlazaReturnY', NORTH_CENTER_Y);

    const farewell = rematch ? [
      'Taewang: You have climbed the Northern League and defeated me once again. Your strength is beyond dispute.',
      'Taewang: Come. The stone is waiting, as it always is.',
    ] : [
      'Taewang rises from his throne for the first time — slowly, deliberately.',
      'Taewang: ...In thirty years on this throne, I have beaten every Onnuri Champion sent to me. Every one.',
      'Taewang: Until now.',
      "Taewang (inclining his head — a king's respect): The peninsula bred a real trainer at last.",
      'Taewang: Walk with me to the register. The north cuts its honoured names into stone, and today it cuts yours.',
    ];

    this.dialog.show(farewell, () => {
      this.cameras.main.fadeOut(900, 0, 0, 0, () => {
        this.scene.start('HallOfFameScene', { rematch, clears, theme: 'northern' });
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
  // A complete, self-contained chamber on every storey.
  fill(1, ROWS - 1, 3, COLS - 3, T.FLOOR);
  fill(2, ROWS - 1, 8, 10, T.CARPET);
  fill(4, 8, 6, 12, floor === 5 ? T.THRONE : T.DAIS);
  for (const r of [4, 7, 11]) { m[r][3] = T.BANNER; m[r][COLS - 4] = T.BANNER; }
  // The stairs are visible from the room but only trigger after its master falls.
  fill(1, 3, 8, 10, T.STAIRS);
  // Only the first floor connects back to the exterior plaza; all upper floors
  // are sealed chambers reached solely by ascending the previous staircase.
  if (floor === 1) fill(ROWS - 1, ROWS, 8, 10, T.FLOOR);
  return m;
}
