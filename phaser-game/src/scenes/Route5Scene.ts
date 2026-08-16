import Phaser from 'phaser';
import { t, tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { vanishesAfterDefeat } from '../data/Villains';
import { drawTrainerBody, drawRiderBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';
import {
  HWANGEUM_STORY, recordHwangeumBeat, spawnHwangeum, type HwangeumActor,
} from '../systems/HwangeumStory';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = { MOSS: 0, PATH: 1, TALLGRASS: 2, TREE: 3, ROOT: 4, SHRINE: 5, FLOWER: 6, GLOW: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 60;
const COLORS: Record<Tile, number> = {
  [T.MOSS]: 0x3f6b3a, [T.PATH]: 0xb6a878, [T.TALLGRASS]: 0x2f7a2a, [T.TREE]: 0x143a18,
  [T.ROOT]: 0x5a4630, [T.SHRINE]: 0x7a6a4a, [T.FLOWER]: 0xcf5fae, [T.GLOW]: 0x66e6c0,
};
const SOLID = new Set<Tile>([T.TREE, T.ROOT, T.SHRINE]);
const ENCOUNTER = new Set<Tile>([T.TALLGRASS]);

const BARRIER_ROWS = [24, 25];
const BARRIER_COLS = [9, 10, 11, 12, 13, 14];

// Ancient-forest encounters — bug & grass (mostly new customs)
const R5_ENCOUNTERS: EncounterEntry[] = [
  { id: 'crystbeetle',    weight: 14, minLevel: 31, maxLevel: 32, isCustom: true,  catchRate: 170 },
  { id: 'bookbug',        weight: 14, minLevel: 31, maxLevel: 32, isCustom: true,  catchRate: 200 },
  { id: 'kudzu',          weight: 14, minLevel: 31, maxLevel: 32, isCustom: true,  catchRate: 200 },
  { id: 'trumpetcreeper', weight: 12, minLevel: 31, maxLevel: 32, isCustom: true,  catchRate: 200 },
  { id: 'ghograss',       weight: 10, minLevel: 31, maxLevel: 32, isCustom: true,  catchRate: 180 },
  { id: 'peacockrose',    weight: 10, minLevel: 31, maxLevel: 32, isCustom: true,  catchRate: 180 },
  { id: 'moranlovebird',  weight: 10, minLevel: 31, maxLevel: 32, isCustom: true,  catchRate: 200 },
  { id: 43, weight: 8, minLevel: 31, maxLevel: 32, isCustom: false, catchRate: 200 }, // Oddish
  { id: 69, weight: 8, minLevel: 31, maxLevel: 32, isCustom: false, catchRate: 200 }, // Bellsprout
  { id: 'yeomtaeja', weight: 10, minLevel: 31, maxLevel: 32, isCustom: true, catchRate: 120 }, // Fire/Steel flame prince
  { id: 'groundzoome', weight: 10, minLevel: 31, maxLevel: 32, isCustom: true, catchRate: 180 }, // Ground/Ghost
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.MOSS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  fill(0, ROWS, 9, 15, T.PATH);
  // Giant trees walling both sides
  fill(0, ROWS, 0, 4, T.TREE);
  fill(0, ROWS, 20, COLS, T.TREE);
  // Gnarled roots & scattered ancient trees (removed from grass areas)
  for (const [r, c] of [[8,6],[16,17],[34,6],[46,17],[52,6],[20,17],[40,6]] as [number,number][]) m[r][c] = T.ROOT;
  // Trees removed from grass areas - keeping only border trees and roots
  // for (const [r, c] of [[6,16],[12,6],[28,17],[50,16],[55,6],[10,17]] as [number,number][]) m[r][c] = T.TREE;
  // The Forest Shrine just behind the choke (rows 20-23)
  fill(20, 23, 9, 15, T.SHRINE);
  m[23][11] = T.PATH; m[23][12] = T.PATH;   // shrine steps
  // Bioluminescent glow patches + flowers
  for (const [r, c] of [[14,16],[30,6],[44,17]] as [number,number][]) m[r][c] = T.GLOW;
  for (const [r, c] of [[10,5],[36,18],[48,5]] as [number,number][]) m[r][c] = T.FLOWER;
  // Tall-grass clearings
  fill(8, 14, 15, 19, T.TALLGRASS);
  fill(34, 42, 5, 9, T.TALLGRASS);
  fill(50, 56, 15, 19, T.TALLGRASS);
  fill(30, 36, 15, 19, T.TALLGRASS);
  return m;
}

export class Route5Scene extends Phaser.Scene {
  private map!: Tile[][];
  /** The Ancient Forest is a route, not a town — drop buildings the terrain
   *  heuristics hallucinate from dense foliage shading, but DO raise the one
   *  real landmark: the Forest Shrine's exterior on its stone steps. */
  public onlyNamedBuildings = true;
  public buildingPlots = [{ x: 9, y: 20, w: 6, h: 3, model: 'shrine' }];
  // The authored tall-grass id overrides colour sampling so its dark painted
  // blades can never be mistaken for trees.  Dense crossed tufts make each
  // clearing read as real 3D grass and retain the existing walk-through rustle.
  public grass3D = true;
  public grassTileIds3D = [T.TALLGRASS];
  public grassDensity3D = 1.5;
  public grassTone3D = 0x3f9f37;
  /** Moss, paths and authored roots are floor artwork. In particular ROOT's
   *  dark brown must never be interpreted as a raised wall anywhere in the
   *  Ancient Forest; collision remains governed by the original tile grid. */
  public flatTileIds3D = [T.MOSS, T.PATH, T.ROOT, T.FLOWER, T.GLOW];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private shrinePrompt?: Phaser.GameObjects.Text;
  private dialog!: DialogBox;
  private px = 12 * TILE + 16;
  private py = 57 * TILE + 16;   // enter from south (Haean side)
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private steps = 0; private nextEnc = 10;
  private hwangeumActor?: HwangeumActor;
  private readonly SPEED = 120; private readonly RUN = 250;

  private readonly TRAINERS = [
    {
      key: 'r5-beomseok', name: 'Bug Catcher Beomseok', col: 6, row: 44, color: 0x6a8a2a, label: 'Bug\nCatcher',
      line: "These old trees are crawling with my favourites! Wanna see my best ones? They bite!",
      pokemon: JSON.stringify([{ id: 0, level: 33, custom: 'crystbeetle' }, { id: 0, level: 35, custom: 'bookbug' }]),
      expPool: 920,
    },
    {
      key: 'r5-jiyeon', name: 'Aroma Lady Jiyeon', col: 17, row: 12, color: 0xcf6fae, label: 'Aroma\nLady',
      line: "Breathe in. The forest's scent calms the heart — and sharpens my Pokémon. Shall we?",
      pokemon: JSON.stringify([{ id: 0, level: 34, custom: 'trumpetcreeper' }, { id: 0, level: 35, custom: 'kudzu' }]),
      expPool: 960,
    },
  ] as const;

  constructor() { super('Route5Scene'); }

  private get chaeDone() { return !!this.registry.get('trainerDefeated_suri-chaeyeon-2'); }

  create() {

    playBgm(this, 'route5');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('route5ReturnX') as number | undefined;
    const ry = this.registry.get('route5ReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('route5ReturnX'); this.registry.remove('route5ReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawTrainers();
    if (!this.chaeDone) this.drawShrineScene();
    this.createPlayer();
    const championGuardPending = this.chaeDone
      && !this.registry.get(HWANGEUM_STORY.forestGuard)
      && !this.registry.get('championDefeated');
    if (championGuardPending) {
      const hx = Phaser.Math.Clamp(this.px + TILE, 10 * TILE, 14 * TILE);
      const hy = Phaser.Math.Clamp(this.py - 2 * TILE, 3 * TILE, 56 * TILE);
      this.hwangeumActor = spawnHwangeum(this, hx, hy, {
        lookAt: { x: this.px, y: this.py },
      });
    }
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'Route5Scene');
    if (championGuardPending) this.time.delayedCall(450, () => this.runForestGuardMeeting());
    else this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  /** Hwangeum contains the wider disaster while the player remains the one who
   *  earns access to the shrine — visible competence without stealing agency. */
  private runForestGuardMeeting() {
    if (!this.hwangeumActor || this.registry.get(HWANGEUM_STORY.forestGuard)) return;
    this.cutsceneActive = true;
    this.facing = this.hwangeumActor.graphic.y < this.py ? 1 : 0;
    this.drawChar();
    this.playerG.setData('characterLookAt3D', {
      x: this.hwangeumActor.graphic.x, y: this.hwangeumActor.graphic.y,
    });
    const contestMemory = this.registry.get(HWANGEUM_STORY.contest)
      ? t('Hwangeum: You read a battlefield the same way you read that contest stage — by watching your partner first.',
          '황금: 너는 콘테스트 무대를 읽을 때처럼 전장도 읽는군 — 언제나 파트너를 먼저 보고 있어.')
      : t('Hwangeum: We keep arriving at the same storms. That usually means the region is trying to tell us something.',
          '황금: 자꾸 같은 폭풍 속에서 만나게 되는군. 보통 이런 건 지방이 우리에게 무언가를 말하고 있다는 뜻이야.');
    this.dialog.show([
      t('League rangers carry injured excavation workers down the eastern ridge. Above them, Hwangeum directs a glowing barrier around the wounded shrine grove.',
        '리그 레인저들이 다친 발굴 인부들을 동쪽 능선 아래로 옮긴다. 그 위에서 황금이 상처 입은 사당 숲 둘레에 빛나는 방벽을 지휘하고 있다.'),
      t('Hwangeum: Team Suri opened the ground; 노스단 tried to seize what woke beneath it. The villagers are clear, and the firebreak is holding.',
        '황금: 수리단이 땅을 열었고, 노스단은 그 아래에서 깨어난 것을 빼앗으려 했어. 주민들은 대피했고 방화선도 버티고 있다.'),
      contestMemory,
      t('Hwangeum: The monks say the inner spirit will answer only the trainer who stood at the gate. That is you. I will hold the perimeter — you protect what is inside.',
        '황금: 스님들 말로는 안쪽 정령이 문 앞에 섰던 트레이너에게만 응답한대. 그건 너야. 바깥은 내가 지킬 테니 — 안쪽의 존재는 네가 지켜 줘.'),
      t('Hwangeum: This is how a region survives: not one Champion solving everything, but each person refusing to abandon their part.',
        '황금: 지방은 이렇게 살아남는 거야. 챔피언 한 사람이 모든 걸 해결해서가 아니라, 각자가 자기 몫을 포기하지 않아서.'),
    ], () => {
      recordHwangeumBeat(this.registry, HWANGEUM_STORY.forestGuard);
      SaveManager.save(this.registry, this.px, this.py, 'Route5Scene');
      this.playerG.setData('characterLookAt3D', null);
      const actor = this.hwangeumActor!;
      this.hwangeumActor = undefined;
      this.tweens.add({ targets: [actor.graphic, actor.label], alpha: 0, duration: 320,
        onComplete: () => actor.destroy() });
      this.cutsceneActive = false;
      this.time.delayedCall(250, () => maybeLaunchEvolution(this));
    });
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.TREE) { g.fillStyle(0x0c2a10); g.fillTriangle(c*TILE+16, r*TILE-2, c*TILE+0, r*TILE+26, c*TILE+32, r*TILE+26); g.fillStyle(0x4a3420); g.fillRect(c*TILE+13, r*TILE+24, 6, 8); }
      if (t === T.TALLGRASS) { g.fillStyle(0x1f5a1c, 0.8); for (let i=0;i<3;i++){ g.fillRect(c*TILE+5+i*8, r*TILE+16, 2, 12); g.fillRect(c*TILE+7+i*8, r*TILE+12, 2, 16);} }
      if (t === T.ROOT) { g.fillStyle(0x4a3826); g.fillRect(c*TILE+2, r*TILE+12, TILE-4, 8); g.fillRect(c*TILE+10, r*TILE+4, 8, TILE-8); }
      if (t === T.SHRINE) { g.fillStyle(0x6a5a3a); g.fillRect(c*TILE+4, r*TILE+4, TILE-8, TILE-8); g.fillStyle(0x8a7a5a); g.fillRect(c*TILE+8, r*TILE+2, TILE-16, 5); }
      if (t === T.GLOW) { g.fillStyle(0x88ffe0, 0.5); g.fillCircle(c*TILE+10, r*TILE+12, 5); g.fillCircle(c*TILE+22, r*TILE+22, 4); }
      if (t === T.FLOWER) { g.fillStyle(0xee88cc); g.fillCircle(c*TILE+10, r*TILE+12, 4); g.fillCircle(c*TILE+20, r*TILE+20, 4); }
    }
    const key = '__route5Map__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(12 * TILE, 58.4 * TILE, tr('↓ Haean City'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#2a5a2a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(12 * TILE, 0.7 * TILE, tr('↑ Forest City'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#2a5a2a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(12 * TILE, 19 * TILE, tr('⛩ Forest Shrine'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#00000088', padding: { x: 3, y: 1 },
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

  private drawShrineScene() {
    const rope = this.add.graphics().setDepth(6);
    rope.lineStyle(3, 0x884422, 1);
    rope.lineBetween(9 * TILE, 24 * TILE + 16, 15 * TILE, 24 * TILE + 16);
    // Admin Chaeyeon at the shrine
    const g = this.add.graphics().setDepth(8);
    g.setPosition(12 * TILE + 16, 25 * TILE + 16);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(0x202028); g.fillRect(-7, -8, 14, 12);
    g.fillStyle(0xcc2233); g.fillRect(-7, -8, 14, 2);
    g.fillStyle(0xffccaa); g.fillRect(-6, -20, 12, 11);
    g.fillStyle(0x33221a); g.fillRect(-6, -21, 12, 5);
    g.fillStyle(0x000000); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2);
    this.add.text(12 * TILE + 16, 25 * TILE - 12, tr('Admin Chaeyeon'), {
      fontSize: '8px', color: '#ff8899', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(9);
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
    this.add.rectangle(this.scale.width / 2, 22, 400, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🌳 Route 5 — The Ancient Forest (고목 숲길)'), {
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
    this.checkTrainers();
    this.checkShrine();
    this.checkShrineEntrance();
    this.checkExits();
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      if (!this.chaeDone && BARRIER_ROWS.includes(row) && BARRIER_COLS.includes(col)) return true;
      return SOLID.has(this.map[row][col]);
    });
  }

  private checkEncounter() {
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (!t || !ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.22) return;
    this.steps = 0; this.nextEnc = 8 + Math.floor(Math.random() * 8);
    const e = pickEncounter(R5_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'Route5Scene');
    this.registry.set('route5ReturnX', this.px); this.registry.set('route5ReturnY', this.py);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  private checkTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`)) continue;
      const wx = tr.col * TILE + 16, wy = tr.row * TILE + 16;
      if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.5) {
        this.cutsceneActive = true;
        this.registry.set('trainerName', tr.name);
        this.registry.set('trainerKey', tr.key);
        this.registry.set('trainerPokemon', tr.pokemon);
        this.registry.set('trainerExpPool', tr.expPool);
        this.registry.set('trainerReturnScene', 'Route5Scene');
        this.registry.set('route5ReturnX', this.px); this.registry.set('route5ReturnY', this.py);
        this.dialog.show([tr.line, `${tr.name}: Let's battle!`], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkShrine() {
    if (this.chaeDone) return;
    if (this.py > 29 * TILE) return;
    this.cutsceneActive = true;
    const launch = () => {
      this.registry.set('trainerName', 'Admin Chaeyeon');
      this.registry.set('trainerKey', 'suri-chaeyeon-2');
      this.registry.set('trainerPokemon', JSON.stringify([
        { id: 461, level: 33 },                       // Weavile
        { id: 0,   level: 34, custom: 'martbadger' },  // Steel/Dark
        { id: 635, level: 36 },                        // Hydreigon (Dragon/Dark ace)
      ]));
      this.registry.set('trainerExpPool', 1700);
      this.registry.set('trainerReturnScene', 'Route5Scene');
      this.registry.set('route5ReturnX', 12 * TILE + 16);
      this.registry.set('route5ReturnY', 29 * TILE + 16);
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    };
    if (!this.registry.get('chaeyeon2Seen')) {
      this.registry.set('chaeyeon2Seen', true);
      this.dialog.show([
        'At the Forest Shrine, Team Suri is mid-excavation. On the ridge, 노스단 watches — then moves on the shrine.',
        "In the chaos, Admin Chaeyeon's grunts accidentally fight alongside you to drive 노스단 back.",
        "Admin Chaeyeon: ...Don't misread this. We are NOT allies. The Director's orders stand.",
        "Admin Chaeyeon: But before you interfere again — show me you've grown.",
      ], launch);
    } else {
      this.dialog.show(["Admin Chaeyeon: Still in our way. Fine — again, then."], launch);
    }
  }

  /** Once Team Suri is driven off (chaeDone), the shrine steps open the monks'
   *  Forest Shrine sub-event. SPACE to enter when standing at the steps. */
  private checkShrineEntrance() {
    if (!this.chaeDone || this.cutsceneActive) { this.shrinePrompt?.setVisible(false); return; }
    const sx = 12 * TILE, sy = 23 * TILE + 16;   // shrine steps (row 23, cols 11–12)
    const near = Math.hypot(this.px - sx, this.py - sy) < TILE * 1.4;
    if (!this.shrinePrompt) {
      this.shrinePrompt = this.add.text(this.scale.width / 2, 46, tr('SPACE — Enter the Forest Shrine'), {
        fontSize: '12px', color: '#fff', backgroundColor: '#000000cc', padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(60).setVisible(false);
    }
    this.shrinePrompt.setVisible(near);
    if (near && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.cutsceneActive = true;
      this.shrinePrompt.setVisible(false);
      this.registry.set('route5ReturnX', 12 * TILE + 16);
      this.registry.set('route5ReturnY', 24 * TILE + 16);
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('ForestShrineScene'));
    }
  }

  private checkExits() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // South → Haean City
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('haeanCityReturnX', 3 * 32); this.registry.set('haeanCityReturnY', 12 * 32);
        this.scene.start('HaeanCityScene');
      });
    }
    // North → Forest City (after the shrine confrontation)
    if (this.py < 1 * TILE && this.chaeDone) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('forestCityReturnX', 15 * 32 + 16);
        this.registry.set('forestCityReturnY', 24 * 32);
        this.scene.start('ForestCityScene');
      });
    }
  }
}
