import Phaser from 'phaser';
import { installSurfing } from '../systems/SurfSystem';
import { t, tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawRiderBody, playerDesign, rivalDesign } from '../data/CharacterSprite';
import { markRivalPortrait, markTrainerPortrait } from '../data/BattlePortraits';
import { hasBike, BIKE_SPEED, isBikeRiding, setBikeRiding } from '../data/Bike';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { PartySystem } from '../systems/PartySystem';
import { HWANGEUM_STORY } from '../systems/HwangeumStory';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = { GRASS: 0, PATH: 1, BUILDING: 2, TREE: 3, LANTERN: 4, RIVER: 5, BRIDGE: 6, FLOWER: 7 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 30, ROWS = 26;
const COLORS: Record<Tile, number> = {
  [T.GRASS]: 0x6abf4b, [T.PATH]: 0xd8c89a, [T.BUILDING]: 0xeadfc8, [T.TREE]: 0x2a6a2a,
  [T.LANTERN]: 0x9a7a4a, [T.RIVER]: 0x2f8fcf, [T.BRIDGE]: 0xb08850, [T.FLOWER]: 0xd070b0,
};
const SOLID = new Set<Tile>([T.BUILDING, T.TREE, T.LANTERN, T.RIVER]);

interface Building { label: string; scene: string; x: number; y: number; w: number; h: number; doorCol: number; doorRow: number; roof: number; }
const BUILDINGS: Building[] = [
  { label: 'Pokémon Center',  scene: 'GeumgangPCScene',   x: 3,  y: 7, w: 6, h: 5, doorCol: 5,  doorRow: 11, roof: 0xcc2244 },
  { label: 'Lantern Stage Gym', scene: 'GeumgangGymScene', x: 21, y: 6, w: 6, h: 6, doorCol: 23, doorRow: 11, roof: 0xcc66aa },
  { label: 'Contest Hall',    scene: '__CONTEST__',       x: 12, y: 5, w: 6, h: 4, doorCol: 14, doorRow: 8,  roof: 0xddaa33 },
  { label: 'Poké Mart',       scene: '__SHOP__',          x: 12, y: 18, w: 5, h: 4, doorCol: 14, doorRow: 21, roof: 0x2a6a9a },
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.GRASS) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++) if (r>=0&&r<ROWS&&c>=0&&c<COLS) m[r][c] = t;
  };
  fill(0, ROWS, 13, 17, T.PATH);
  fill(11, 15, 2, COLS - 2, T.PATH);
  for (const b of BUILDINGS) { fill(b.y, b.y + b.h, b.x, b.x + b.w, T.BUILDING); m[b.doorRow][b.doorCol] = T.PATH; }
  // River sweeping along the bottom-left with a bridge
  fill(22, 24, 2, 13, T.RIVER);
  fill(22, 24, 6, 8, T.BRIDGE);
  // Flowerbeds + trees + lanterns
  for (const [r,c] of [[9,11],[9,19],[17,5],[17,24],[20,20]] as [number,number][]) m[r][c] = T.TREE;
  for (const [r,c] of [[16,12],[16,17],[18,14]] as [number,number][]) m[r][c] = T.FLOWER;
  m[10][11] = T.LANTERN; m[10][18] = T.LANTERN;
  return m;
}

export class GeumgangCityScene extends Phaser.Scene {
  private map!: Tile[][];
  public buildingPlots = BUILDINGS.map((b, i) => ({ x: b.x, y: b.y, w: b.w, h: b.h, model: ['pokecenter', 'lanterngym', 'contesthall', 'mart'][i] }));
  public onlyNamedBuildings = true;
  // The lantern-festival city's boulevard lanterns as 3D lamps (coords mirror the
  // T.LANTERN tiles).
  public propPlots = ([[11, 10], [18, 10]] as [number, number][])
    .map(([x, y]) => ({ x, y, kind: 'lantern' as const }));
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = 15 * TILE; private py = 24 * TILE;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private get cycling(): boolean { return isBikeRiding(this.registry); }
  private set cycling(value: boolean) { setBikeRiding(this.registry, value); }
  private spawnGuard = false;
  private spawnPx = 0; private spawnPy = 0;   // exits lock until the player moves inward
  private readonly SPEED = 120; private readonly RUN = 250;

  private chaeCol = 20; private chaeRow = 17;

  constructor() { super('GeumgangCityScene'); }

  create() {

    playBgm(this, 'geumgang');
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('geumgangCityReturnX') as number | undefined;
    const ry = this.registry.get('geumgangCityReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('geumgangCityReturnX'); this.registry.remove('geumgangCityReturnY');

    // Lock edge exits until the player steps inward (prevents entry bounce).
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true;
    this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.map = buildMap();
    this.drawMap();
    this.drawContestBroadcast();
    if (!this.registry.get('trainerDefeated_suri-chaeyeon-1')) this.drawChaeyeon();
    this.createPlayer();
    installSurfing(this, {
      map: () => this.map, player: () => this.playerG,
      position: () => ({ x: this.px, y: this.py }), tileSize: TILE,
      waterTiles: [T.RIVER], solidTiles: SOLID,
    });
    this.setupCamera();
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'GeumgangCityScene');

    if (!this.registry.get('geumgangVisited')) {
      this.registry.set('geumgangVisited', true);
      this.time.delayedCall(700, () => {
        this.cutsceneActive = true;
        const cityIntro = [
          'You arrive in Geumgang City (금강 시티).',
          'An elegant river city famous for its Contest Hall and thousand-lantern stage.',
          "Rival: 노스단 — that's what the locals call them. \"Group North.\" Ryeo's people.",
          'Rival: A Fairy-type gym runs the Lantern Stage here. Win the badge — then we keep moving south.',
        ];
        if (!this.registry.get(HWANGEUM_STORY.contest)) cityIntro.splice(2, 0,
          t('Broadcast vans and reporters from all across Onnuri surround the Contest Hall. Champion Hwangeum is entering today.',
            '온누리 전역에서 온 중계차와 기자들이 콘테스트 홀을 에워싸고 있다. 오늘 챔피언 황금이 출전한다.'));
        this.dialog.show(cityIntro, () => { this.cutsceneActive = false; });
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
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.TREE) { g.fillStyle(0x1a5c1a); g.fillTriangle(c*TILE+16, r*TILE+2, c*TILE+3, r*TILE+24, c*TILE+29, r*TILE+24); g.fillStyle(0x4a3020); g.fillRect(c*TILE+13, r*TILE+24, 6, 6); }
      if (t === T.LANTERN) { g.fillStyle(0x777066); g.fillRect(c*TILE+12, r*TILE+6, 8, 20); g.fillStyle(0xffaadd); g.fillRect(c*TILE+11, r*TILE+4, 10, 8); }
      if (t === T.RIVER) { g.fillStyle(0x66bbe6, 0.5); g.fillRect(c*TILE+4, r*TILE+8, 12, 3); g.fillRect(c*TILE+14, r*TILE+18, 10, 3); }
      if (t === T.FLOWER) { g.fillStyle(0xee88cc); g.fillCircle(c*TILE+10, r*TILE+12, 4); g.fillCircle(c*TILE+22, r*TILE+20, 4); g.fillCircle(c*TILE+16, r*TILE+24, 4); }
    }
    const key = '__geumgangMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    const bg = this.add.graphics().setDepth(2);
    for (const b of BUILDINGS) {
      const x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
      bg.fillStyle(0xf2e8d4); bg.fillRect(x, y, w, h); bg.lineStyle(2, 0x333); bg.strokeRect(x, y, w, h);
      bg.fillStyle(b.roof); bg.fillTriangle(x - 4, y, x + w / 2, y - TILE, x + w + 4, y);
      bg.fillStyle(0x88ccff, 0.7);
      for (let wx = 8; wx < w - 8; wx += 22) bg.fillRect(x + wx, y + 14, 14, 16);
      const dx = b.doorCol * TILE, dy = (b.y + b.h - 1) * TILE;
      bg.fillStyle(0x8b4513); bg.fillRect(dx + 4, dy, TILE - 8, TILE);
      this.add.text((b.x + b.w / 2) * TILE, (b.y - 1.2) * TILE, tr(b.label), {
        fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setDepth(3);
    }
    this.add.text(15 * TILE, 25.4 * TILE, tr('↓ Diamond Gorge'), {
      fontSize: '9px', color: '#444', backgroundColor: '#ffffffaa', padding: { x: 3, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(15 * TILE, 0.6 * TILE, tr('↑ Coastal Road (Route 4)'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#2a6a8a99', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawChaeyeon() {
    const g = this.add.graphics().setDepth(8);
    g.setPosition(this.chaeCol * TILE + 16, this.chaeRow * TILE + 16);
    g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
    g.fillStyle(0x202028); g.fillRect(-7, -8, 14, 12);
    g.fillStyle(0xcc2233); g.fillRect(-7, -8, 14, 2);
    g.fillStyle(0xffccaa); g.fillRect(-6, -20, 12, 11);
    g.fillStyle(0x33221a); g.fillRect(-6, -21, 12, 5);
    g.fillStyle(0x000000); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2);
    markTrainerPortrait(g, 'suri-chaeyeon-1');
    this.add.text(this.chaeCol * TILE + 16, this.chaeRow * TILE - 12, tr('Team Suri Admin'), {
      fontSize: '8px', color: '#ff8899', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(9);
  }

  /** The requested region-wide press turnout is visible from the street before
   *  the player enters the playable contest event. */
  private drawContestBroadcast() {
    if (this.registry.get(HWANGEUM_STORY.contest)) return;
    const hall = BUILDINGS.find(building => building.scene === '__CONTEST__');
    if (!hall) return;
    const x = (hall.x + hall.w / 2) * TILE;
    const y = (hall.y + hall.h + 0.7) * TILE;
    const press = this.add.graphics().setDepth(7);
    for (let i = -2; i <= 2; i++) {
      const px = x + i * 25, py = y + Math.abs(i % 2) * 9;
      press.fillStyle(i % 2 === 0 ? 0x24476a : 0x3d315f, 1);
      press.fillCircle(px, py - 13, 6); press.fillRect(px - 6, py - 7, 12, 14);
      press.fillStyle(0xb9e7ff, 0.9); press.fillRect(px + 5, py - 13, 8, 5);
    }
    this.add.text(x, y + 17, t('● LIVE · Champion Hwangeum enters today', '● 생중계 · 오늘 챔피언 황금 출전'), {
      fontSize: '9px', color: '#fff3a5', backgroundColor: '#651b32dd', padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setDepth(8);
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
    this.add.rectangle(this.scale.width / 2, 22, 340, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🏙️ Geumgang City (금강 시티)'), {
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
    this.checkChaeyeon();
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

  private checkChaeyeon() {
    if (this.registry.get('trainerDefeated_suri-chaeyeon-1')) return;
    const wx = this.chaeCol * TILE + 16, wy = this.chaeRow * TILE + 16;
    if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.6 && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.cutsceneActive = true;
      this.registry.set('trainerName', 'Admin Chaeyeon');
      this.registry.set('trainerKey', 'suri-chaeyeon-1');
      this.registry.set('trainerPokemon', JSON.stringify([
        { id: 461, level: 25 },  // Weavile
        { id: 319, level: 26 },  // Sharpedo (Water/Dark)
        { id: 625, level: 28 },  // Bisharp (Steel/Dark ace, Iron Head)
      ]));
      this.registry.set('trainerExpPool', 900);
      this.registry.set('trainerReturnScene', 'GeumgangCityScene');
      this.registry.set('geumgangCityReturnX', this.px); this.registry.set('geumgangCityReturnY', this.py);
      this.dialog.show([
        "Team Suri Admin Chaeyeon: A trainer who keeps turning up at our digs. You've earned a proper test.",
        "Admin Chaeyeon: Show me whether you're worth worrying about.",
      ], () => this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene')));
    }
  }

  private checkBuildings() {
    let near: Building | null = null;
    for (const b of BUILDINGS) {
      const dx = this.px - (b.doorCol * TILE + TILE / 2), dy = this.py - ((b.y + b.h - 1) * TILE + TILE / 2);
      if (Math.hypot(dx, dy) < TILE * 1.3) { near = b; break; }
    }
    if (near) {
      this.enterPrompt.setText(`${tr('SPACE — Enter')} ${tr(near.label)}`).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        const b = near;
        if (b.scene === '__SHOP__') { this.registry.set('martReturnScene', this.scene.key); this.registry.set('geumgangCityReturnX', b.doorCol * TILE + TILE / 2); this.registry.set('geumgangCityReturnY', (b.y + b.h) * TILE + TILE / 2); this.cutsceneActive = true; this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('MartScene')); return; }
        if (b.scene === '__CONTEST__') {
          this.cutsceneActive = true;
          this.registry.set('geumgangCityReturnX', b.doorCol * TILE + TILE / 2);
          this.registry.set('geumgangCityReturnY', (b.y + b.h) * TILE + TILE / 2);
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('GeumgangContestScene'));
          return;
        }
        this.registry.set('geumgangCityReturnX', b.doorCol * TILE + TILE / 2);
        this.registry.set('geumgangCityReturnY', (b.y + b.h) * TILE + TILE / 2);
        this.cutsceneActive = true;
        this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start(b.scene));
      }
    } else this.enterPrompt.setVisible(false);
  }

  private checkExit() {
    if (this.cutsceneActive || this.spawnGuard) return;
    if (Math.hypot(this.px - this.spawnPx, this.py - this.spawnPy) < 1.4 * TILE) return;
    // South → Route 3
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('route3ReturnX', 12 * 32 + 16); this.registry.set('route3ReturnY', 2 * 32);
        this.scene.start('Route3Scene');
      });
    }
    // North → Rival Battle #2, then onward to Route 4 (coast)
    if (this.py < 1 * TILE) {
      // The Champion contest is a real main-story meeting, not an optional
      // "coming soon" side door. Keep the coastal chapter closed until the
      // player has actually shared the Geumgang stage with Hwangeum. Existing
      // Hall-of-Fame saves are exempt so post-game traversal never regresses.
      if (!this.registry.get(HWANGEUM_STORY.contest) && !this.registry.get('championDefeated')) {
        this.px = 15 * TILE; this.py = 3 * TILE; this.facing = 0; this.drawChar();
        this.cutsceneActive = true;
        this.dialog.show([
          t('A Contest Hall broadcast drone sweeps across the north gate, projecting today\'s program over the road.',
            '콘테스트 홀 중계 드론이 북쪽 관문을 가로지르며 오늘의 프로그램을 도로 위에 투사한다.'),
          t('Rival: Hold on — Champion Hwangeum put your name on the open coordinator slot. The whole region is watching that hall.',
            '라이벌: 잠깐 — 챔피언 황금이 공개 코디네이터 자리에 네 이름을 올려 뒀어. 온 지방이 그 홀을 보고 있다고.'),
          t('Rival: We are not leaving Geumgang before you step onto that stage. The Contest Hall is in the center plaza.',
            '라이벌: 네가 그 무대에 오르기 전에는 금강시티를 떠나지 않을 거야. 콘테스트 홀은 중앙 광장에 있어.'),
        ], () => { this.cutsceneActive = false; });
        return;
      }
      if (!this.registry.get('trainerDefeated_rival-2')) {
        // Snap the player just inside the north path so there's room above for the
        // rival to actually walk down into view before the challenge.
        this.px = 15 * TILE; this.py = 4 * TILE; this.facing = 1; this.drawChar();
        this.cutsceneActive = true;
        this.registry.set('trainerName', 'Rival');
        this.registry.set('trainerKey', 'rival-2');
        this.startRivalApproach();
        return;
      }
      // North → Route 4 (Coastal Cliffside Road) toward Haean City
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('route4ReturnX', 12 * 32 + 16); this.registry.set('route4ReturnY', 57 * 32 + 16);
        this.scene.start('Route4Scene');
      });
    }
  }

  /** Walk the rival's overworld sprite down the north path to the player, then battle. */
  private startRivalApproach() {
    const rivalG = this.add.graphics().setDepth(21);
    const startY = -TILE, stopY = 3 * TILE;   // stop one tile above the player (py = 4*TILE)
    const rx = 15 * TILE;
    let frame = 0;
    rivalG.setPosition(rx, startY);
    const draw = () => { drawTrainerBody(rivalG, 0 /* face down toward player */, frame, rivalDesign(this.registry)); rivalG.setPosition(rx, rivalG.y); };
    draw();
    markRivalPortrait(rivalG, this.registry);

    // Step animation while walking.
    const stepper = this.time.addEvent({ delay: 160, loop: true, callback: () => { frame ^= 1; draw(); } });

    this.tweens.add({
      targets: rivalG, y: stopY, duration: 1300, ease: 'Linear',
      onUpdate: () => rivalG.setPosition(rx, rivalG.y),
      onComplete: () => {
        stepper.remove();
        frame = 0; draw();   // settle on standing frame
        this.time.delayedCall(200, () => this.launchRivalBattle(rivalG));
      },
    });
  }

  private launchRivalBattle(rivalG: Phaser.GameObjects.Graphics) {
    // Rival uses his OWN evolved starter (the opposite type he chose at the lab).
    // Use rivalKey — starterKey can be changed by setLead, so it's unreliable here.
    //   rival Grass (munkain)  → munklift
    //   rival Fire  (vipour)   → scorpent
    //   rival Water (onnurian) → onnujang
    const rivalKey = (this.registry.get('rivalKey') as string) ?? 'vipour';
    const rivalEvoKey = rivalKey === 'munkain' ? 'munklift'
      : rivalKey === 'vipour' ? 'scorpent'
      : 'onnujang';
    this.registry.set('trainerPokemon', JSON.stringify([
      { id: 0, level: 26, custom: 'chattyscream' },   // Normal/Dark
      { id: 0, level: 27, custom: 'squirrel2' },       // Soarrel (Normal/Flying)
      { id: 0, level: 29, custom: 'palmcockatoo' },    // Dark/Flying
      { id: 0, level: 29, custom: rivalEvoKey },        // Rival's evolved starter (opposite type)
    ]));
    this.registry.set('trainerExpPool', 1000);
    this.registry.set('trainerReturnScene', 'GeumgangCityScene');
    this.registry.set('geumgangCityReturnX', 15 * TILE); this.registry.set('geumgangCityReturnY', 2 * TILE);
    this.dialog.show([
      "Rival: Heading out already? Not before this.",
      "Rival: I've watched how you fight. Let's see if you've actually improved — or just gotten lucky.",
    ], () => this.cameras.main.fadeOut(400, 0, 0, 0, () => { rivalG.destroy(); this.scene.start('TrainerBattleScene'); }));
  }

  static healParty(scene: Phaser.Scene) { PartySystem.healAll(scene.registry); }
}
