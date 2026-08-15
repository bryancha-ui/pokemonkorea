import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { PartySystem } from '../systems/PartySystem';
import { hasMapae, awardMapae } from '../data/Mapae';
import { markTrainerPortrait } from '../data/BattlePortraits';
import { showRewardCeremony } from '../systems/RewardCeremony';

// ── POST-LEAGUE NORTH — Songhyeon (송현), an 어사대 circuit city ──────────────────────
// Apolitical: real Songhyeon geography only — Songak Mountain, the Sungkyunkwan Confucian
// academy (here the 어사대 Hall), ginseng fields, and the Seonjukgyo stone bridge over a
// mountain stream. The 어사대장 (Inspectorate Chief) tests the visiting southern Champion;
// clearing the exam earns the Songhyeon 마패. Template for the other seven circuit cities.

const T = { GROUND: 0, PATH: 1, BUILDING: 2, GRASS: 3, WATER: 4, BRIDGE: 5, TREE: 6, GINSENG: 7, FLOWER: 8, ROCK: 9, MOUNTAIN_PATH: 10 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 34, ROWS = 24;
const COLORS: Record<Tile, number> = {
  [T.GROUND]: 0x8a7a5a, [T.PATH]: 0xcabb9a, [T.BUILDING]: 0xe6dcc6, [T.GRASS]: 0x4c7a3c,
  [T.WATER]: 0x2f78b4, [T.BRIDGE]: 0x9a6e3a, [T.TREE]: 0x2c5a2c, [T.GINSENG]: 0x5a8a3a,
  [T.FLOWER]: 0x4c7a3c, [T.ROCK]: 0x6a625a,
  [T.MOUNTAIN_PATH]: 0x789965,
};
const SOLID = new Set<Tile>([T.BUILDING, T.WATER, T.TREE, T.ROCK]);

interface Building { label: string; scene: string; x: number; y: number; w: number; h: number; doorCol: number; doorRow: number; roof: number; hall?: boolean; }
const BUILDINGS: Building[] = [
  { label: 'Poké Mart',      scene: '__SHOP__',       x: 2,  y: 6, w: 5,  h: 4, doorCol: 4,  doorRow: 10, roof: 0x2a6a9a },
  { label: '어사대 Hall',     scene: '__HALL__',       x: 14, y: 5, w: 8,  h: 6, doorCol: 18, doorRow: 11, roof: 0x9a3a2a, hall: true },
  { label: 'Pokémon Center', scene: 'PokemonCenterScene', x: 26, y: 6, w: 5, h: 4, doorCol: 28, doorRow: 10, roof: 0xcc2244 },
];

const CHIEF = { col: 18, row: 11 };   // 어사대장 stands in the 어사대 Hall doorway (door at col 18, row 11)
// Songhyeon's challenge isn't a battle — the old Confucian academy tests the MIND first.
// Chief Hyeon poses a short oral examination; answer well to earn the right to duel him.
const QUIZ: { q: string; a: boolean }[] = [
  { q: 'True or false: a Water-type move is super-effective against a Ground-type Pokémon.', a: true },
  { q: 'True or false: an Electric-type move deals normal damage to a Ground-type Pokémon.', a: false },
  { q: 'True or false: the 마패 you seek is the token of the royal Inspectorate — the 어사대.', a: true },
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GROUND) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };
  const set = (r: number, c: number, t: Tile) => { if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t; };

  // Mountain stream running down the west side, crossed by the Seonjukgyo bridge
  fill(4, ROWS, 9, 11, T.WATER);
  fill(12, 14, 9, 11, T.BRIDGE);   // Seonjukgyo — the walkable stone bridge

  // Streets
  fill(12, 14, 1, COLS - 1, T.PATH);   // main east-west road (over the bridge)
  fill(11, ROWS, 17, 19, T.PATH);      // south road to the plaza / exit
  // The Songak north passage is a mossy mountain lane.  Give it an explicit
  // green ground tile so it cannot inherit the old blue-tinted road artwork.
  fill(0, 13, 12, 14, T.MOUNTAIN_PATH);

  // Retire the obsolete direct Songhyeon → Pyeongseong warp. The capital is
  // reached only through the guarded Gwanmunseong checkpoint after the seven
  // regional 마패 have been earned.
  fill(23, 24, 17, 19, T.ROCK);

  // Buildings
  for (const b of BUILDINGS) { fill(b.y, b.y + b.h, b.x, b.x + b.w, T.BUILDING); set(b.doorRow, b.doorCol, T.PATH); }

  // Ginseng fields (Songhyeon's famous crop) — south quarters
  fill(16, 20, 2, 8, T.GINSENG);
  fill(16, 20, 24, 31, T.GINSENG);

  // Pines & rocks around the Songak foothills, wildflowers by the road
  for (const [r,c] of [[5,2],[6,31],[9,24],[9,6],[20,12],[20,22],[15,15],[15,21]] as [number,number][]) set(r, c, T.TREE);
  for (const [r,c] of [[7,13],[7,23],[21,5],[21,28]] as [number,number][]) set(r, c, T.ROCK);
  for (const [r,c] of [[14,14],[14,22],[15,12],[15,24]] as [number,number][]) set(r, c, T.FLOWER);

  return m;
}

export class KaesongCityScene extends Phaser.Scene {
  private map!: Tile[][];
  // Songhyeon's real buildings get named 3D models — Poké Mart + Pokémon Center
  // reuse the custom Higgsfield models, the 어사대 Hall uses the palace model.
  // onlyNamedBuildings erases every OTHER detected block (the Songak Mountain
  // backdrop shapes) instead of extruding stray free-asset buildings.
  public buildingPlots = BUILDINGS.map((b, i) => ({
    x: b.x, y: b.y, w: b.w, h: b.h, model: ['mart', 'palace', 'pokecenter'][i],
  }));
  public onlyNamedBuildings = true;
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = 17 * TILE + 16; private py = 21 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;
  private readonly SPEED = 120; private readonly RUN = 250;

  constructor() { super('KaesongCityScene'); }

  create() {
    playBgm(this, 'kaesong');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('kaesongReturnX') as number | undefined;
    const ry = this.registry.get('kaesongReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('kaesongReturnX'); this.registry.remove('kaesongReturnY');

    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawChief();
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
    SaveManager.save(this.registry, this.px, this.py, 'KaesongCityScene');

    // Returned from the exam victorious → award the Songhyeon 마패 (once).
    if (this.registry.get('trainerDefeated_eosa-kaesong') && !hasMapae(this.registry, 'kaesong')) {
      awardMapae(this.registry, 'kaesong');
      this.cutsceneActive = true;
      showRewardCeremony(this, { kind: 'mapae', key: 'kaesong', onComplete: () => {
        this.cutsceneActive = true;
        this.dialog.show([
          '어사대장 Hyeon: ...Composed. Adaptable. You read the exam, not just the battle. The southern Champion is no rumour.',
          '어사대장 Hyeon presents a small bronze horse-tablet — a 마패.',
          '🐎 You received the Songhyeon 마패! (1 of 8 the Northern League requires.)',
          '어사대장 Hyeon: Seven Chiefs remain, across the northern provinces. Earn all eight and the League gate at the far north will know you by them.',
        ], () => { this.cutsceneActive = false; });
      } });
    } else if (!this.registry.get('kaesongVisited')) {
      this.registry.set('kaesongVisited', true);
      this.time.delayedCall(600, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'You arrive in Songhyeon (송현) — old Koryo capital, terraced under Songak Mountain, its ginseng fields green to the ridgelines.',
          'The Seonjukgyo bridge arches over the stream toward the 어사대 Hall, once a Confucian academy.',
          'A robed inspector waits on its steps, hands folded. This is the first of the north\'s eight tests.',
        ], () => { this.cutsceneActive = false; });
      });
    } else {
      this.time.delayedCall(300, () => maybeLaunchEvolution(this));
    }
  }

  // ── Map ──────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.GROUND) { g.fillStyle(0x9a8a6a, 0.4); g.fillRect(x+5, y+7, 5, 4); g.fillRect(x+20, y+18, 5, 4); }
      if (t === T.PATH) { g.fillStyle(0xb6a686, 0.5); g.fillRect(x+3, y+6, TILE-6, 3); }
      if (t === T.MOUNTAIN_PATH) { g.fillStyle(0x9bb083, 0.45); g.fillRect(x+3, y+6, TILE-6, 3); g.fillStyle(0x526f43, 0.35); g.fillRect(x+7, y+20, 8, 3); }
      if (t === T.GRASS) { g.fillStyle(0x5f9a4a, 0.5); g.fillRect(x+5, y+8, 4, 6); }
      if (t === T.WATER) { g.fillStyle(0x66bbe6, 0.4); g.fillRect(x+4, y+9, 12, 3); g.fillRect(x+14, y+22, 10, 3); }
      if (t === T.BRIDGE) { g.fillStyle(0x7a5628); for (let i=0;i<TILE;i+=7) g.fillRect(x, y+i, TILE, 2); g.fillStyle(0x5a3e1c); g.fillRect(x+1, y, 3, TILE); g.fillRect(x+TILE-4, y, 3, TILE); }
      if (t === T.TREE) { g.fillStyle(0x1e421e); g.fillCircle(x+16, y+15, 12); g.fillStyle(0x347a34); g.fillCircle(x+12, y+12, 6); g.fillCircle(x+21, y+15, 5); g.fillStyle(0x5a3a20); g.fillRect(x+14, y+24, 4, 6); }
      if (t === T.GINSENG) { g.fillStyle(0x3f6a2a, 0.5); g.fillRect(x, y+TILE-4, TILE, 4); for (const [dx,dy] of [[8,10],[18,8],[24,16],[12,20]] as [number,number][]){ g.fillStyle(0x6aa84a,1); g.fillCircle(x+dx, y+dy, 3); g.fillStyle(0xd83a2a,1); g.fillCircle(x+dx, y+dy-2, 1.2);} }
      if (t === T.FLOWER) { const cs=[0xff6a9a,0xffffff,0xffdd55]; for(let i=0;i<3;i++){ g.fillStyle(cs[i],1); g.fillCircle(x+9+i*7, y+12+(i%2)*8, 2.4);} }
      if (t === T.ROCK) { g.fillStyle(0x2a2620); g.fillEllipse(x+16, y+18, 22, 14); g.fillStyle(0x555049); g.fillEllipse(x+13, y+15, 13, 9); }
    }
    // Songak Mountain backdrop glow at the top
    g.fillStyle(0x6a8a5a, 0.18); g.fillRect(0, 0, COLS * TILE, 4 * TILE);
    const key = '__kaesongMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    const bg = this.add.graphics().setDepth(2);
    for (const b of BUILDINGS) {
      const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
      bg.fillStyle(b.hall ? 0xf0e6d0 : 0xefe4d0); bg.fillRect(x, y, w, h); bg.lineStyle(2, 0x3a2a1a); bg.strokeRect(x, y, w, h);
      // Upturned tiled roof (hanok-style for the Hall)
      bg.fillStyle(b.roof); bg.fillTriangle(x - 6, y + 2, x + w / 2, y - TILE, x + w + 6, y + 2);
      if (b.hall) { bg.fillStyle(0x2a7a4a, 0.9); bg.fillRect(x - 4, y - 2, w + 8, 4); bg.fillStyle(0x2a5aba, 0.9); bg.fillRect(x - 4, y + 1, w + 8, 3); }  // dancheong trim
      bg.fillStyle(0x88ccff, 0.7);
      for (let wx = 8; wx < w - 8; wx += 22) bg.fillRect(x + wx, y + 16, 14, 16);
      const dx = b.doorCol * TILE, dy = (b.y + b.h - 1) * TILE;
      bg.fillStyle(0x5a3a1a); bg.fillRect(dx + 4, dy, TILE - 8, TILE);
      this.add.text((b.x + b.w / 2) * TILE, (b.y - 1.2) * TILE, b.hall ? tr('🏛️ 어사대 Hall — Chief Hyeon') : tr(b.label), {
        fontSize: b.hall ? '10px' : '9px', color: b.hall ? '#ffe44e' : '#fff', fontStyle: b.hall ? 'bold' : 'normal',
        backgroundColor: '#00000099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(3);
    }

    this.add.text(16 * TILE, 1.4 * TILE, tr('⛰ Songak Mountain'), {
      fontSize: '10px', color: '#dfffd0', backgroundColor: '#1a3a1a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(10 * TILE, 11.4 * TILE, tr('🌉 Seonjukgyo'), {
      fontSize: '8px', color: '#cfe8ff', backgroundColor: '#1a3a5a99', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(18 * TILE, 22.7 * TILE, tr('🚧 Capital road closed'), {
      fontSize: '9px', color: '#ffd98a', backgroundColor: '#321b1499', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawChief() {
    const g = this.add.graphics().setDepth(8);
    g.setPosition(CHIEF.col * TILE + 16, CHIEF.row * TILE + 16);
    drawNpcBody(g, 0x3a4a8a, { hair: 0x2a2622 });      // deep-blue scholar's robe
    g.fillStyle(0xd8c060, 1); g.fillRect(-8, -9, 16, 1); g.fillRect(-1, -8, 2, 9);   // gold trim
    markTrainerPortrait(g, 'eosa-kaesong');
    this.add.text(CHIEF.col * TILE + 16, CHIEF.row * TILE - 12, speakerName('어사대장 Hyeon'), {
      fontSize: '8px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
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
    this.cameras.main.setZoom(1.5);
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
    this.add.rectangle(this.scale.width / 2, 22, 340, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🏯 Songhyeon (송현)'), {
      fontSize: '14px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 34, '', {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SPACE: enter/talk  M: menu'), {
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
      if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkChief();
    this.checkBuildings();
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

  /** The 어사대장's regional exam → the Songhyeon battle → 마패. */
  private checkChief() {
    const near = Math.hypot(this.px - (CHIEF.col * TILE + 16), this.py - (CHIEF.row * TILE + 16)) < TILE * 1.5;
    if (!near) { if (!this.nearBuilding()) this.enterPrompt.setVisible(false); return; }
    if (hasMapae(this.registry, 'kaesong')) {
      this.enterPrompt.setText(`${tr('SPACE:')} ${speakerName('어사대장 Hyeon')}`).setVisible(true);
      if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
      this.cutsceneActive = true; this.enterPrompt.setVisible(false);
      this.dialog.show(['어사대장 Hyeon: Songhyeon has taken your measure. The next province waits — carry the 마패 with honour.'],
        () => { this.cutsceneActive = false; });
      return;
    }
    // A scholar's oral examination gates the duel — no battle, just wisdom.
    if (!this.registry.get('KaesongMissionDone')) {
      this.enterPrompt.setText(`${tr('SPACE:')} ${speakerName('어사대장 Hyeon')}`).setVisible(true);
      if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
      this.cutsceneActive = true; this.enterPrompt.setVisible(false);
      const intro = this.registry.get('KaesongQuizSeen') ? [] : [
        '어사대장 Hyeon: Before any duel — the 어사대 of Songhyeon tests the mind. This hall was a Confucian academy long before it examined trainers.',
        'Hyeon: Answer three questions truly. A Champion should understand the world they battle in. Consider each one.'];
      this.registry.set('KaesongQuizSeen', true);
      this.dialog.show(intro, () => this.runQuiz(0, 0));
      return;
    }
    this.enterPrompt.setText(tr('SPACE: take the Songhyeon exam')).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    this.cutsceneActive = true; this.enterPrompt.setVisible(false);
    this.dialog.show([
      '어사대장 Hyeon: Your reasoning is sound. Now let us see whether your team matches your mind.',
      'Hyeon: Titles mean nothing to the 어사대 — only what you show us. Read your opponent, adapt, and do not flinch. Begin.',
    ], () => {
      this.registry.set('trainerName', '어사대장 Hyeon');
      this.registry.set('trainerKey', 'eosa-kaesong');
      this.registry.set('trainerPokemon', JSON.stringify([
        { id: 80,  level: 67 },   // Slowbro (Water/Psychic)
        { id: 437, level: 67 },   // Bronzong (Steel/Psychic)
        { id: 196, level: 68 },   // Espeon (Psychic)
        { id: 475, level: 69 },   // Gallade (Psychic/Fighting)
        { id: 376, level: 70 },   // Metagross (Steel/Psychic) — ace
      ]));
      this.registry.set('trainerExpPool', 3900);
      this.registry.set('trainerReturnScene', 'KaesongCityScene');
      this.registry.set('kaesongReturnX', CHIEF.col * TILE + 16);
      this.registry.set('kaesongReturnY', (CHIEF.row + 1) * TILE + 16);
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    });
  }

  private nearBuilding(): boolean {
    for (const b of BUILDINGS) {
      const dx = this.px - (b.doorCol * TILE + TILE / 2), dy = this.py - ((b.y + b.h - 1) * TILE + TILE / 2);
      if (Math.hypot(dx, dy) < TILE * 1.3) return true;
    }
    return false;
  }

  // ── Challenge: Chief Hyeon's oral examination (a quiz, not a battle) ──
  private runQuiz(i: number, correct: number) {
    if (i >= QUIZ.length) {
      if (correct >= QUIZ.length) {
        this.registry.set('KaesongMissionDone', true);
        this.dialog.show([
          `어사대장 Hyeon: ${correct} of ${QUIZ.length}. A clear and ordered mind. The academy is satisfied.`,
          'Hyeon: Wisdom before force — that is Songhyeon\'s way. When you are ready, present yourself for the duel and the 마패.',
        ], () => { this.cutsceneActive = false; });
      } else {
        this.dialog.show([
          `어사대장 Hyeon: ${correct} of ${QUIZ.length}. Not yet — a scholar who guesses is no scholar.`,
          'Hyeon: Reflect on the type-lore of this world, and present yourself to me again.',
        ], () => { this.cutsceneActive = false; });
      }
      return;
    }
    const item = QUIZ[i];
    this.dialog.show([`Question ${i + 1} of ${QUIZ.length}.`, `${tr(item.q)}${tr('     ( ▶YES = true  /  NO = false )')}`], () => {
      this.dialog.showChoice(
        () => this.answerQuiz(i, correct, item.a === true),
        () => this.answerQuiz(i, correct, item.a === false),
      );
    });
  }

  private answerQuiz(i: number, correct: number, right: boolean) {
    this.dialog.show([right ? 'Hyeon: ...Correct.' : 'Hyeon: ...No. Mark that error, and reason more carefully.'],
      () => this.runQuiz(i + 1, correct + (right ? 1 : 0)));
  }

  private checkBuildings() {
    let near: Building | null = null;
    for (const b of BUILDINGS) {
      const dx = this.px - (b.doorCol * TILE + TILE / 2), dy = this.py - ((b.y + b.h - 1) * TILE + TILE / 2);
      if (Math.hypot(dx, dy) < TILE * 1.3) { near = b; break; }
    }
    if (!near) return;
    // The Hall's "door" is the Chief's exam — handled by checkChief; don't double-prompt.
    if (near.hall) return;
    this.enterPrompt.setText(`${tr('SPACE — Enter')} ${tr(near.label)}`).setVisible(true);
    if (!Phaser.Input.Keyboard.JustDown(this.spaceKey)) return;
    const b = near;
    this.registry.set('kaesongReturnX', b.doorCol * TILE + TILE / 2);
    this.registry.set('kaesongReturnY', (b.y + b.h) * TILE + TILE / 2);
    this.cutsceneActive = true;
    if (b.scene === '__SHOP__') { this.registry.set('martReturnScene', this.scene.key); this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('MartScene')); return; }
    this.registry.set('pcReturnScene', 'KaesongCityScene');
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(b.scene));
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    // The former south-edge capital shortcut is now a solid closure. Explain
    // the canonical route when the player examines it; never warp from here.
    if (this.py > 22 * TILE && this.px > 16 * TILE && this.px < 20 * TILE) {
      this.enterPrompt.setText(tr('SPACE — Inspect closed road')).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.cutsceneActive = true;
        this.enterPrompt.setVisible(false);
        this.dialog.show([
          'The old direct road to Pyeongseong is closed.',
          'Entry to the capital is permitted only through the Gwanmunseong checkpoint after earning all seven regional 마패.',
        ], () => { this.cutsceneActive = false; });
      }
      return;
    }
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // North → out onto Yeoul Valley, the river road up to Parangpo.
    if (this.py < 1.2 * TILE && this.px > 11.5 * TILE && this.px < 14 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('ryesongReturnX', 12 * 32 + 16); this.registry.set('ryesongReturnY', 52 * 32 + 16);
        this.scene.start('RyesongValleyScene');
      });
    }
  }

  static healParty(scene: Phaser.Scene) { PartySystem.healAll(scene.registry); }
}
