import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { PartySystem } from '../systems/PartySystem';
import { drawTrainerBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';
import { markTrainerPortrait } from '../data/BattlePortraits';

// ── POST-GAME II — The Northern Reaches (a huge snow-woods trial) ─────────────────
// Not a corridor-maze: a vast, silent boreal forest. The only trail winds a long way
// north through snow-laden pines and wild thickets before you even glimpse the 어사대.
// Deep in the woods 어사대장 Jito finally steps out to test you; her inspectors, a
// 노스단 admin and two lore quiz-wards guard the trail beyond, up to the Sacred Peak.

const T = { SNOW: 0, TREE: 1, DAIS: 2, BARRIER: 3, PATH: 4, LANTERN: 5, SNOWGRASS: 6 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 20, ROWS = 52;

const COLORS: Record<Tile, number> = {
  [T.SNOW]: 0xdfe7ec, [T.TREE]: 0x223528, [T.DAIS]: 0xb0c0cc, [T.BARRIER]: 0x6a8296,
  [T.PATH]: 0xc6d0d8, [T.LANTERN]: 0x8a2018, [T.SNOWGRASS]: 0x7fa87a,
};
const SOLID = new Set<Tile>([T.TREE, T.LANTERN]);
const ENCOUNTER = new Set<Tile>([T.SNOWGRASS]);

// Trail gates (barrier row → the trainer to beat or quiz to answer to pass).
const GATES: Record<number, string> = {
  28: 'inspector-jito', 24: 'nosdan-admin', 20: 'quiz1', 16: 'inspector-salmu', 12: 'quiz2', 8: 'inspector-gapcheol',
};

// Northern wild field — the Maewoyong line lives here, among hardy ice/dragon wilds.
const NORTH_ENCOUNTERS: EncounterEntry[] = [
  { id: 'maewoyong', weight: 9,  minLevel: 44, maxLevel: 48, isCustom: true,  catchRate: 110 },
  { id: 215, weight: 12, minLevel: 44, maxLevel: 48, isCustom: false, catchRate: 180 }, // Sneasel
  { id: 361, weight: 12, minLevel: 44, maxLevel: 48, isCustom: false, catchRate: 190 }, // Snorunt
  { id: 333, weight: 11, minLevel: 44, maxLevel: 48, isCustom: false, catchRate: 190 }, // Swablu
  { id: 329, weight: 10, minLevel: 44, maxLevel: 48, isCustom: false, catchRate: 180 }, // Vibrava
  { id: 613, weight: 10, minLevel: 44, maxLevel: 48, isCustom: false, catchRate: 190 }, // Cubchoo
  // ── Onnuri-region Pokémon ──
  { id: 'ssaktrin',        weight: 11, minLevel: 44, maxLevel: 47, isCustom: true, catchRate: 190 }, // Grass fawn → Longroffe
  { id: 'onnurigrowlithe', weight: 10, minLevel: 44, maxLevel: 47, isCustom: true, catchRate: 180 }, // Onnurian Growlithe (Ice)
  { id: 'zoltile',         weight: 8,  minLevel: 45, maxLevel: 48, isCustom: true, catchRate: 130 }, // Electric/Rock
  { id: 'longroffe',       weight: 8,  minLevel: 46, maxLevel: 48, isCustom: true, catchRate: 150 }, // Grass/Rock
  { id: 'onnurismoochum',  weight: 9,  minLevel: 44, maxLevel: 47, isCustom: true, catchRate: 180 }, // Fairy → Idolena
  { id: 'idolena',         weight: 6,  minLevel: 46, maxLevel: 48, isCustom: true, catchRate: 150 }, // Fire/Fairy (rarer)
];

interface Member {
  key: string; name: string; type: string; col: number; row: number; color: number;
  intro: string[]; pokemon: { id: number; level: number; custom?: string }[]; expPool: number;
}

// Teams are all FINAL-EVOLUTION Pokémon (custom stage-3/4 + PokéAPI final evos).
const MEMBERS: Member[] = [
  {
    key: 'inspector-jito', name: '어사대장 Jito', type: '어사대 · Ice', col: 10, row: 30, color: 0xbfe8ff,
    intro: [
      'Deep in the frozen woods, after a long climb through the pines, a figure finally steps onto the trail — dark inspector\'s robes, a brass 마패 tablet at her belt.',
      '어사대장 Jito: Far enough, southerner. You crossed our woods without a guide — few outsiders manage even that.',
      '어사대장 Jito: But the shrines lie beyond me, and I do not move for reputation. Prove your intent — or turn back the way you came.',
    ],
    pokemon: [ { id: 473, level: 78 }, { id: 0, level: 79, custom: 'snoqueen' }, { id: 461, level: 81 } ],
    expPool: 6800,
  },
  {
    key: 'nosdan-admin', name: '노스단 Admin', type: '노스단', col: 15, row: 26, color: 0x2a2c34,
    intro: [
      '노스단 Admin: The 어사대 let a southerner this deep into the woods? How far they\'ve fallen.',
      '노스단 Admin: We charted the shrines from the stars already. You\'re too late — but I\'ll enjoy slowing you down among the trees.',
    ],
    pokemon: [ { id: 0, level: 79, custom: 'halubang' }, { id: 0, level: 80, custom: 'kkaakdang' }, { id: 452, level: 81 } ],
    expPool: 7000,
  },
  {
    key: 'inspector-salmu', name: '어사대장 Salmu', type: '어사대 · Poison', col: 14, row: 18, color: 0xb08ad0,
    intro: [
      '어사대장 Salmu: Word runs ahead of you through the woods now — the southern champion who chased the shadows off our mountain.',
      '어사대장 Salmu: Charming. But the 어사대 do not run on rumor. Show me the trainer beneath the legend.',
    ],
    pokemon: [ { id: 0, level: 80, custom: 'komodread' }, { id: 435, level: 80 }, { id: 454, level: 82 } ],
    expPool: 7300,
  },
  {
    key: 'inspector-gapcheol', name: '어사대장 Gapcheol', type: '어사대 · Steel', col: 13, row: 10, color: 0xced4de,
    intro: [
      '어사대장 Gapcheol: You bled for a forest that was never yours. The last of the inspectors will not go easy for it.',
      '어사대장 Gapcheol: Iron does not bend for sentiment. Come.',
    ],
    pokemon: [ { id: 0, level: 80, custom: 'hallowknight' }, { id: 0, level: 81, custom: 'bonejoillion' }, { id: 208, level: 81 }, { id: 306, level: 83 } ],
    expPool: 7600,
  },
];

const JINNOK: Member = {
  key: 'inspector-jinnok', name: '어사대장 Jinnok', type: '어사대 · Head', col: 10, row: 6, color: 0x8fd08a,
  intro: [
    'At the tree-line, where the woods give way to the bare peak, the head of the order waits with the full 어사대 gathered behind her.',
    '어사대장 Jinnok: Four hundred years the 어사대 judged outsiders. Today we judge in your favour. You came to save Onnuri — north and south both.',
    '어사대장 Jinnok: One last measure. Then the wards open, and we climb to the shrines together.',
  ],
  pokemon: [ { id: 0, level: 82, custom: 'mugungmama' }, { id: 389, level: 83 }, { id: 407, level: 83 }, { id: 0, level: 85, custom: 'nabiguni' } ],
  expPool: 9000,
};

interface Quiz { key: string; col: number; row: number; q: string[]; correctYes: boolean; }
const QUIZZES: Quiz[] = [
  {
    key: 'quiz1', col: 7, row: 22,
    q: [
      '어사대 Inspector (barring the trail): A test, not a fight. Answer plainly.',
      '어사대 Inspector: 나비할망 — the moth grandmother who protects Jeju — is a Fire-type Pokémon. True or false?',
    ],
    correctYes: false,   // she is Steel/Fairy → the statement is FALSE, so the correct choice is "No"
  },
  {
    key: 'quiz2', col: 6, row: 14,
    q: [
      '어사대 Inspector: One more, before the woods end.',
      '어사대 Inspector: 풍백, 우사 and 운사 are the three attendants of Hwanung — the Wind, the Rain and the Clouds. True or false?',
    ],
    correctYes: true,
  },
];

export class NorthernReachesScene extends Phaser.Scene {
  // Painted tree tiles grow real 3D trees and their flat 2D art is wiped.
  public treeTileIds3D = [T.TREE];
  public grassTileIds3D = [T.SNOWGRASS];
  private map!: Tile[][];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 10 * TILE + 16;
  private py = 49 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private spawnGuard = false;
  private steps = 0; private nextEnc = 6;
  private readonly SPEED = 120;

  constructor() { super('NorthernReachesScene'); }

  private defeated(key: string) { return !!this.registry.get(`trainerDefeated_${key}`); }
  private keyMet(key: string) { return key.startsWith('quiz') ? !!this.registry.get(`northReaches_${key}`) : this.defeated(key); }
  private get trialDone() { return this.defeated('inspector-jinnok'); }

  create() {

    playBgm(this, 'northreaches');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();
    this.spawnGuard = true;
    this.time.delayedCall(600, () => { this.spawnGuard = false; });

    this.px = 10 * TILE + 16; this.py = 49 * TILE + 16;
    const rx = this.registry.get('northReachesReturnX') as number | undefined;
    const ry = this.registry.get('northReachesReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('northReachesReturnX'); this.registry.remove('northReachesReturnY');

    this.map = buildMap();
    this.drawMap();
    this.drawMembers();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'NorthernReachesScene');

    if (this.trialDone && !this.registry.get('northReachesDone')) {
      this.registry.set('northReachesDone', true);
      this.time.delayedCall(400, () => this.runTrustEarned());
    } else if (!this.registry.get('northReachesSeen')) {
      this.registry.set('northReachesSeen', true);
      this.time.delayedCall(500, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'Beyond the border tunnels, the Northern Reaches open into a vast, silent snow-forest — pines heavy with frost as far as the eye can see, the trail a thin white thread winding north through the trees.',
          'The 어사대 are out there somewhere, watching from the branches. Follow the trail deep enough, and they will show themselves. Mind the thickets — wild things den in these woods.',
        ], () => { this.cutsceneActive = false; });
      });
    }
  }

  private barrierOpen(row: number): boolean {
    const key = GATES[row];
    return !!key && this.keyMet(key);
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      const open = t === T.BARRIER && this.barrierOpen(r);
      const draw = open ? T.PATH : t;
      const base = draw === T.TREE ? T.SNOW : draw;   // trees sit on snow
      g.fillStyle(COLORS[base], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (base === T.SNOW || draw === T.PATH) { g.fillStyle(0xffffff, 0.45); g.fillRect(c*TILE+4, r*TILE+5, 3, 3); g.fillRect(c*TILE+22, r*TILE+19, 3, 3); }
      if (draw === T.PATH)  { g.fillStyle(0xaab6c0, 0.55); g.fillRect(c*TILE+1, r*TILE+1, TILE-2, TILE-2); }
      if (draw === T.SNOWGRASS) { g.fillStyle(0x3f6a3a, 0.85); for (let i=0;i<3;i++){ g.fillRect(c*TILE+6+i*8, r*TILE+16, 2, 12); g.fillRect(c*TILE+8+i*8, r*TILE+12, 2, 15);} }
      if (draw === T.DAIS)  { g.fillStyle(0x8aa0b0, 0.65); g.fillRect(c*TILE+3, r*TILE+3, TILE-6, TILE-6); }
      if (draw === T.TREE) {  // snow-laden pine
        g.fillStyle(0x4a3524); g.fillRect(c*TILE+14, r*TILE+22, 4, 8);
        g.fillStyle(0x1e3324); g.fillTriangle(c*TILE+16, r*TILE+2, c*TILE+4, r*TILE+24, c*TILE+28, r*TILE+24);
        g.fillStyle(0x2c4a34); g.fillTriangle(c*TILE+16, r*TILE+8, c*TILE+7, r*TILE+24, c*TILE+25, r*TILE+24);
        g.fillStyle(0xffffff, 0.8); g.fillTriangle(c*TILE+16, r*TILE+2, c*TILE+11, r*TILE+11, c*TILE+21, r*TILE+11);
      }
      if (t === T.BARRIER && !open) {
        const quiz = (GATES[r] ?? '').startsWith('quiz');
        g.fillStyle(quiz ? 0xc8a8ff : 0xffffff, 0.7); for (let i=0;i<4;i++) g.fillRect(c*TILE+3+i*8, r*TILE+2, 3, TILE-4);
      }
      if (draw === T.LANTERN) { g.fillStyle(0xcc3322); g.fillRoundedRect(c*TILE+10, r*TILE+6, 12, 18, 4); g.fillStyle(0xffcc55); g.fillRect(c*TILE+14, r*TILE+11, 4, 8); }
    }
    const key = '__northReachesMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(10 * TILE, 1.4 * TILE, tr('⛰ Out of the woods → Sacred Peak'), { fontSize: '8px', color: '#123', backgroundColor: '#ffffffaa', padding: { x: 3, y: 2 } }).setOrigin(0.5).setDepth(5);
    this.add.text(10 * TILE, 50.6 * TILE, tr('↓ Border tunnels'), { fontSize: '9px', color: '#123', backgroundColor: '#ffffffaa', padding: { x: 3, y: 2 } }).setOrigin(0.5).setDepth(5);
  }

  private drawMembers() {
    for (const m of [...MEMBERS, JINNOK]) {
      if (this.defeated(m.key)) continue;
      const g = this.add.graphics().setDepth(8);
      drawNpcBody(g, m.color);
      g.setPosition(m.col * TILE + 16, m.row * TILE + 16);
      markTrainerPortrait(g, m.key);
      this.add.text(m.col * TILE + 16, m.row * TILE - 15, `${m.name}\n${m.type}`, {
        fontSize: '8px', color: '#123', backgroundColor: '#ffffffcc', padding: { x: 2, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(9);
    }
    for (const q of QUIZZES) {
      if (this.registry.get(`northReaches_${q.key}`)) continue;
      const g = this.add.graphics().setDepth(8);
      drawNpcBody(g, 0x9a7ac0);
      g.setPosition(q.col * TILE + 16, q.row * TILE + 16);
      this.add.text(q.col * TILE + 16, q.row * TILE - 15, tr('어사대 Inspector\n❓ Quiz Ward'), {
        fontSize: '8px', color: '#213', backgroundColor: '#e8d8ffcc', padding: { x: 2, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(9);
    }
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
    this.add.rectangle(this.scale.width / 2, 22, 470, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🌲 The Northern Reaches — Snow-Woods'), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SPACE: challenge / answer  M: menu'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(_: number, delta: number) {
    if (this.cutsceneActive) {
      if (this.dialog.isInChoice()) {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up))   this.dialog.navigateChoice(-1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.dialog.navigateChoice(1);
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey))     this.dialog.confirmChoice();
      } else if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
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
      if (this.walkTimer > 180) { this.walkFrame ^= 1; this.walkTimer = 0; this.steps++; this.checkEncounter(); }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkMembers();
    this.checkQuizzes();
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

  private checkMembers() {
    for (const m of [...MEMBERS, JINNOK]) {
      if (this.defeated(m.key)) continue;
      if (Math.hypot(this.px - (m.col * TILE + 16), this.py - (m.row * TILE + 16)) < TILE * 1.5) {
        this.cutsceneActive = true;
        PartySystem.healAll(this.registry);
        this.dialog.show(['(An 어사대 healer restores your team before the trial.)', ...m.intro], () => {
          this.registry.set('trainerName', m.name);
          this.registry.set('trainerKey', m.key);
          this.registry.set('trainerPokemon', JSON.stringify(m.pokemon));
          this.registry.set('trainerExpPool', m.expPool);
          this.registry.set('trainerReturnScene', 'NorthernReachesScene');
          this.registry.set('northReachesReturnX', m.col * TILE + 16);
          this.registry.set('northReachesReturnY', (m.row + 1) * TILE + 16);
          this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkQuizzes() {
    for (const q of QUIZZES) {
      if (this.registry.get(`northReaches_${q.key}`)) continue;
      if (Math.hypot(this.px - (q.col * TILE + 16), this.py - (q.row * TILE + 16)) < TILE * 1.4) {
        this.cutsceneActive = true;
        this.dialog.show(q.q, () => {
          this.dialog.showChoice(
            () => this.answerQuiz(q, true),
            () => this.answerQuiz(q, false),
          );
        });
        return;
      }
    }
  }

  private answerQuiz(q: Quiz, choseYes: boolean) {
    if (choseYes === q.correctYes) {
      this.registry.set(`northReaches_${q.key}`, true);
      this.dialog.show(['어사대 Inspector: ...Correct. A trainer who knows the land is a trainer who respects it. The trail is yours.'], () => { this.cutsceneActive = false; });
    } else {
      this.dialog.show(['어사대 Inspector: Wrong. The woods do not open for the careless. Study the north, and return when you are certain.'], () => { this.cutsceneActive = false; });
    }
  }

  private checkEncounter() {
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (!t || !ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.25) return;
    this.steps = 0; this.nextEnc = 6 + Math.floor(Math.random() * 6);
    const e = pickEncounter(NORTH_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'NorthernReachesScene');
    this.registry.set('northReachesReturnX', this.px);
    this.registry.set('northReachesReturnY', this.py);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (this.trialDone && this.py < 3 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('SacredPeakScene'));
      return;
    }
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('capitalReturnX', 24 * 32 + 16);
        this.registry.set('capitalReturnY', 31 * 32 + 16);
        this.scene.start('CapitolCityScene');
      });
    }
  }

  private runTrustEarned() {
    this.cutsceneActive = true;
    PartySystem.healAll(this.registry);
    this.dialog.show([
      '어사대장 Jinnok bows — the deep, formal bow of the order. The gathered inspectors follow.',
      '어사대장 Jinnok: The 어사대 stand with the south\'s Champion — for the first time in four hundred years.',
      '어사대장 Jinnok: The wards on the three shrines are lifted. 풍백 the Wind, 우사 the Rain, 운사 the Clouds — gather them before 노스단 does, and Hwanung himself will answer.',
      '어사대장 Jinnok: I ride with you from here. The woods are behind you. Climb, Champion.',
    ], () => { this.cutsceneActive = false; });
  }
}

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.TREE) as Tile[]);
  const inb = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
  const openV = (rA: number, rB: number, c: number) => {
    for (let r = Math.min(rA, rB); r <= Math.max(rA, rB); r++) for (let cc = c - 1; cc <= c + 1; cc++) if (inb(r, cc)) m[r][cc] = T.SNOW;
  };
  const openH = (cA: number, cB: number, r: number) => {
    for (let rr = r - 1; rr <= r + 1; rr++) for (let c = Math.min(cA, cB); c <= Math.max(cA, cB); c++) if (inb(rr, c)) m[rr][c] = T.SNOW;
  };
  // Entry lane down to the bottom edge.
  openV(51, 49, 10);
  // The winding trail: a long meander through the woods, then the 어사대 up to the tree-line.
  const WP: [number, number][] = [
    [50, 10], [46, 6], [42, 14], [38, 7], [34, 13],   // the huge woods (no 어사대)
    [30, 10], [26, 15], [22, 7], [18, 14], [14, 6], [10, 13], [6, 10], [2, 10],
  ];
  for (let i = 1; i < WP.length; i++) {
    const [r1, c1] = WP[i - 1], [r2, c2] = WP[i];
    openV(r1, r2, c1);
    openH(c1, c2, r2);
  }
  // Sealed gates on the trail just above each 어사대 / quiz ward.
  for (const [r, c] of [[28, 10], [24, 15], [20, 7], [16, 14], [12, 6], [8, 13]] as const)
    for (let cc = c - 1; cc <= c + 1; cc++) if (inb(r, cc) && m[r][cc] === T.SNOW) m[r][cc] = T.BARRIER;
  // Wild-grass thickets scattered through the lower woods.
  for (const [r, c] of [[48, 10], [45, 6], [43, 13], [40, 8], [37, 8], [35, 13], [33, 11], [47, 11]] as const)
    if (inb(r, c) && m[r][c] === T.SNOW) m[r][c] = T.SNOWGRASS;
  // Dais under the inspectors + a few trail lanterns.
  for (const [r, c] of [[30, 10], [26, 15], [18, 14], [10, 13], [6, 10]] as const) if (m[r][c] === T.SNOW) m[r][c] = T.DAIS;
  for (const [r, c] of [[32, 12], [24, 6], [16, 12]] as const) if (inb(r, c) && m[r][c] === T.TREE) m[r][c] = T.LANTERN;
  return m;
}
