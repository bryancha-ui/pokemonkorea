import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { vanishesAfterDefeat } from '../data/Villains';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, drawNpcBody, playerDesign } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { canUseSurf } from '../systems/SurfSystem';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { isTouchDevice, MOBILE_ACTION_EVENT } from '../systems/TouchControls';

// ── Parangpo Beach (파랑포 해변) ─────────────────────────────────────────────────────
// The West-Sea shore reached from Parangpo city. Surf out across the bay — dodging
// whirlpools that its 부하 (underlings) churn up as they wander around the ocean —
// to confront the rampaging Gyarados battering the barrage. Drift into a whirlpool
// and a weak underling drags you into a battle, and you're swept back to the sand.

const T = { SAND: 0, WATER: 1, WALL: 2, ROCK: 3 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 20, ROWS = 22;
const COLORS: Record<Tile, number> = { [T.SAND]: 0xe4d6a8, [T.WATER]: 0x2f78b4, [T.WALL]: 0x6a6f7a, [T.ROCK]: 0x6f6658 };
const SOLID = new Set<Tile>([T.WALL, T.ROCK]);

const THREAT_KEY = 'eosa-nampo-threat';
const THREAT_TEXTURE = 'nampo-threat-gyarados';
const THREAT_TEXTURE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/130.png';
const THREAT_DISPLAY_H = 96;
// Gyarados is the unmoving center of the challenge; only the whirlpools orbit.
const THREAT = { col: 10, row: 10 };
const OCEAN_CX = THREAT.col * TILE + 16, OCEAN_CY = THREAT.row * TILE + 16;
const THREAT_RADIUS = 2 * TILE;
// Contact starts the encounter in both renderers. Keeping this independent of
// touch-device detection prevents desktop/PWA 3D sessions from missing it.
const THREAT_CONTACT_RADIUS = 1.25 * TILE;
const SHORE = { x: 10 * TILE + 16, y: 18 * TILE + 16 };       // swept back here on a whirlpool hit

// Whirlpools orbiting the bay: two rings turning opposite ways.
const WHIRLS = [
  { r: 4.3, w:  0.55, phase: 0 }, { r: 4.3, w: 0.55, phase: Math.PI / 2 },
  { r: 4.3, w:  0.55, phase: Math.PI }, { r: 4.3, w: 0.55, phase: 3 * Math.PI / 2 },
  { r: 2.1, w: -0.85, phase: 0 }, { r: 2.1, w: -0.85, phase: Math.PI },
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.SAND) as Tile[]);
  for (let r = 2; r < 17; r++) for (let c = 0; c < COLS; c++) m[r][c] = T.WATER;   // the bay
  for (let r = 0; r < 2; r++)  for (let c = 0; c < COLS; c++) m[r][c] = T.WALL;    // the barrage
  for (const [r, c] of [[16, 2], [16, 17], [17, 5], [17, 14]] as [number, number][]) m[r][c] = T.ROCK;
  return m;
}

interface Trainer { key: string; name: string; col: number; row: number; color: number; label: string; line: string; pokemon: string; expPool: number; }

export class NampoBeachScene extends Phaser.Scene {
  private map!: Tile[][];
  // Disable random building generation in the wild beach area
  public onlyNamedBuildings = true;
  public buildingPlots: { x: number; y: number; w: number; h: number; model?: string }[] = [];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private enterPrompt!: Phaser.GameObjects.Text;
  private px = 10 * TILE + 16; private py = 19 * TILE + 16;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private spawnGuard = false; private spawnPx = 0; private spawnPy = 0;
  private readonly SPEED = 120; private readonly RUN = 250;
  private whirlG: Phaser.GameObjects.Container[] = [];
  private threatG?: Phaser.GameObjects.Image;
  private threatLabel?: Phaser.GameObjects.Text;
  private mobileActionAt = -Infinity;
  private readonly onMobileAction = () => { this.mobileActionAt = performance.now(); };

  private readonly TRAINERS: Trainer[] = [
    { key: 'nampo-manho', name: 'Sailor Manho', col: 4, row: 18, color: 0x2f6f9a, label: 'Sailor',
      line: 'Ahoy! Headed out to that Gyarados? Not before you get past me, landlubber!',
      pokemon: JSON.stringify([{ id: 279, level: 64 }, { id: 593, level: 65 }]), expPool: 1800 },
    { key: 'nampo-dohun', name: 'Fisher Dohun', col: 15, row: 19, color: 0x4a7a5a, label: 'Fisher',
      line: 'That beast scared off every fish on the coast. Show me you\'re tough enough to face it!',
      pokemon: JSON.stringify([{ id: 119, level: 64 }, { id: 211, level: 64 }, { id: 340, level: 65 }]), expPool: 2000 },
    { key: 'nampo-yura', name: 'Swimmer Yura', col: 10, row: 13, color: 0x2a8ab0, label: 'Swimmer',
      line: 'You surfed all the way out here past the whirlpools? Impressive — now battle me!',
      pokemon: JSON.stringify([{ id: 73, level: 65 }, { id: 195, level: 65 }]), expPool: 1900 },
  ];

  constructor() { super('NampoBeachScene'); }

  preload() {
    if (!this.textures.exists(THREAT_TEXTURE)) this.load.image(THREAT_TEXTURE, THREAT_TEXTURE_URL);
  }

  private get missionTaken() { return !!this.registry.get('NampoCitySceneMissionTaken'); }
  private get gyaradosDone() { return !!this.registry.get('trainerDefeated_' + THREAT_KEY); }
  // Owning the Haean badge/TM only unlocks Surf teaching; a current party
  // member must actually know the move before the player can enter the bay.
  private canSurf() { return canUseSurf(this.registry); }
  private tileAt(x: number, y: number): Tile | undefined { return this.map[Math.floor(y / TILE)]?.[Math.floor(x / TILE)]; }
  private get onWater() { return this.tileAt(this.px, this.py) === T.WATER; }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.whirlG = [];
    this.mobileActionAt = -Infinity;
    playBgm(this, 'nampobeach');
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('NampoBeachSceneReturnX') as number | undefined;
    const ry = this.registry.get('NampoBeachSceneReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; } else { this.px = 10 * TILE + 16; this.py = 19 * TILE + 16; }
    this.registry.remove('NampoBeachSceneReturnX'); this.registry.remove('NampoBeachSceneReturnY');
    this.map = buildMap();
    // Old saves or battle return data may place the player directly on water.
    // Never preserve that bypass after the Surf-knowing party member is gone.
    if (!this.canSurf() && this.onWater) { this.px = SHORE.x; this.py = SHORE.y; }
    this.spawnPx = this.px; this.spawnPy = this.py;
    this.spawnGuard = true; this.time.delayedCall(500, () => { this.spawnGuard = false; });

    this.drawMap();
    this.drawWhirlpools();
    this.drawTrainers();
    this.spawnThreat();
    this.playerG = this.add.graphics().setDepth(20); this.drawChar();
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.setZoom(1.6);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.setupInput();
    this.createUI();
    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'NampoBeachScene');
    this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c]; const x = c * TILE, y = r * TILE;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, TILE, TILE);
      if (t === T.SAND) { g.fillStyle(0xd6c48c, 0.7); g.fillRect(x + 6, y + 10, 4, 3); g.fillRect(x + 18, y + 20, 4, 3); }
      if (t === T.WATER) { g.fillStyle(0x66b0e0, 0.5); g.fillRect(x + 4, y + 8, 13, 3); g.fillRect(x + 13, y + 20, 11, 3); }
      if (t === T.WALL) { g.fillStyle(0x565b66, 1); g.fillRect(x, y + 6, TILE, 5); g.fillStyle(0x7a808c, 1); g.fillRect(x + 3, y + 18, TILE - 6, 4); }
      if (t === T.ROCK) { g.fillStyle(0x5a5044); g.fillTriangle(x + 16, y + 5, x + 3, y + 28, x + 29, y + 28); }
    }
    const key = '__nampoBeach__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
    this.add.text(COLS * TILE / 2, 0.6 * TILE, tr('⛴ West-Sea Barrage'), { fontSize: '9px', color: '#fff', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(5);
    this.add.text(10 * TILE, 20.6 * TILE, tr('↓ Parangpo'), { fontSize: '10px', color: '#fff', backgroundColor: '#3a5a8a99', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(5);
  }

  private drawWhirlpools() {
    if (this.gyaradosDone) return;   // the sea calms once the Gyarados is beaten
    for (let i = 0; i < WHIRLS.length; i++) {
      const g = this.add.graphics();
      g.lineStyle(2.5, 0xffffff, 0.85);
      for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(0, 0, 6 + k * 4, k * 1.6, k * 1.6 + Math.PI * 1.4); g.strokePath(); }
      g.fillStyle(0x0d3a5c, 0.6); g.fillCircle(0, 0, 4);
      const c = this.add.container(OCEAN_CX, OCEAN_CY, [g]).setDepth(7);
      this.tweens.add({ targets: c, angle: 360, duration: 1300, repeat: -1, ease: 'Linear' });
      this.whirlG.push(c);
    }
  }

  private updateThreatPosition() {
    if (!this.threatG || this.gyaradosDone) return;
    const baseX = THREAT.col * TILE + 16;
    const baseY = THREAT.row * TILE + 16;
    // The boss is an interaction target, not a roaming hazard. Re-assert the
    // exact center every frame so no tween, scene resume or renderer sync can
    // ever carry it away. Only the whirlpool containers receive moving coords.
    this.threatG.setPosition(baseX, baseY - THREAT_DISPLAY_H / 2);
    this.threatLabel?.setPosition(baseX, baseY - THREAT_DISPLAY_H - 4);
  }

  private ensureThreatTexture() {
    if (this.textures.exists(THREAT_TEXTURE)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x2f5aa0, 1); g.fillEllipse(48, 54, 58, 50);
    g.fillStyle(0x244a86, 1); g.fillEllipse(48, 62, 50, 36);
    for (const x of [28, 48, 68]) g.fillTriangle(x - 7, 35, x + 7, 35, x, 14);
    g.fillStyle(0xffe000, 1); g.fillCircle(38, 50, 5); g.fillCircle(58, 50, 5);
    g.fillStyle(0x101018, 1); g.fillCircle(38, 50, 2.5); g.fillCircle(58, 50, 2.5);
    g.generateTexture(THREAT_TEXTURE, 96, 96);
    g.destroy();
  }

  private spawnThreat() {
    if (!this.missionTaken || this.gyaradosDone) return;
    this.ensureThreatTexture();
    const baseX = THREAT.col * TILE + 16, baseY = THREAT.row * TILE + 16;
    const src = this.textures.get(THREAT_TEXTURE).getSourceImage() as { height?: number };
    const img = this.add.image(baseX, baseY - THREAT_DISPLAY_H / 2, THREAT_TEXTURE)
      .setDepth(9).setScale(THREAT_DISPLAY_H / Math.max(1, src.height ?? THREAT_DISPLAY_H))
      .setData('creatureModel3DKey', 'api-130')
      .setData('creatureHeight3D', 2.7)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.onMobileAction);
    this.threatG = img;
    this.threatLabel = this.add.text(baseX, baseY - THREAT_DISPLAY_H - 4,
      tr('⚠ Rampaging Gyarados (난동 갸라도스)'), {
        fontSize: '9px', color: '#ff7a7a', fontStyle: 'bold',
        backgroundColor: '#00000099', padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(10).setData('no3d', true);
  }

  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get('trainerDefeated_' + tr.key) && vanishesAfterDefeat(tr.key)) continue;   // beaten trainers stay put
      const g = this.add.graphics().setDepth(8);
      drawNpcBody(g, tr.color, { hair: 0x2a2622 });
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      this.add.text(tr.col * TILE + 16, tr.row * TILE - 12, speakerName(tr.label), { fontSize: '8px', color: '#fff', backgroundColor: '#00000088', padding: { x: 2, y: 1 } }).setOrigin(0.5).setDepth(9);
    }
  }

  private drawChar() {
    const g = this.playerG, design = playerDesign(this.registry);
    if (this.onWater) {
      drawTrainerBody(g, this.facing, 0, design);
      // 2D fallback: a seated rider on a visible water Pokémon, not a
      // standing trainer sprite over a featureless blue oval.
      g.fillStyle(0x1f6fae, 1); g.fillEllipse(0, 11, 36, 15);
      g.fillStyle(0x53a6d8, 1); g.fillEllipse(0, 8, 28, 11);
      g.fillStyle(0x3a8fc0, 1); g.fillEllipse(0, -4, 13, 12);
      g.fillStyle(0x79cbe5, 1); g.fillEllipse(0, -1, 9, 5);
      g.fillStyle(0x101923, 1); g.fillRect(-4, -6, 2, 2); g.fillRect(2, -6, 2, 2);
      g.fillStyle(0xcdeeff, 0.8); g.fillEllipse(-12, 13, 9, 3); g.fillEllipse(12, 14, 8, 3);
      g.setData('characterSurfing3D', true);
    } else {
      drawTrainerBody(g, this.facing, this.walkFrame, design);
      g.setData('characterSurfing3D', false);
    }
    g.setPosition(this.px, this.py);
  }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    window.addEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
    });
  }

  private consumeActionPressed(): boolean {
    const keyboard = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    // Keep the direct A-button action alive across several frames on iOS, where
    // the synthetic keydown/keyup pair can otherwise be missed by Phaser.
    const mobile = performance.now() - this.mobileActionAt <= 500;
    if (mobile) this.mobileActionAt = -Infinity;
    return keyboard || mobile;
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.enterPrompt = this.add.text(this.scale.width / 2, this.scale.height - 34, '', { fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 8, y: 4 } }).setOrigin(0.5).setScrollFactor(0).setDepth(51).setVisible(false);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD move  SHIFT run  SPACE act  M menu   ·   Surf out to the Gyarados, dodge the whirlpools!'), { fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 } }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  update(_: number, delta: number) {
    // whirlpools always orbit (even during a dialog) so the sea feels alive
    const t = this.time.now / 1000;
    for (let i = 0; i < WHIRLS.length; i++) {
      const wp = WHIRLS[i];
      this.whirlG[i]?.setPosition(OCEAN_CX + wp.r * TILE * Math.cos(wp.w * t + wp.phase), OCEAN_CY + wp.r * TILE * Math.sin(wp.w * t + wp.phase));
    }
    this.updateThreatPosition();
    const actionPressed = this.consumeActionPressed();

    if (this.cutsceneActive) {
      if (this.dialog.isInChoice()) {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.dialog.navigateChoice(-1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.dialog.navigateChoice(1);
        if (actionPressed) this.dialog.confirmChoice();
      } else if (actionPressed) this.dialog.advance();
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
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta; if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.drawChar();
    // The stationary boss owns its central interaction zone. Check it before
    // the moving whirlpools so a hazard cannot steal the encounter input.
    if (this.checkThreat(actionPressed)) return;
    if (this.checkWhirlpools()) return;
    if (this.checkTrainers()) return;
    this.checkExit();
  }

  private collides(x: number, y: number): boolean {
    const hw = 6, canSurf = this.canSurf();
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      const tt = this.map[row][col];
      if (tt === T.WATER) return !canSurf;
      return SOLID.has(tt);
    });
  }

  private checkWhirlpools(): boolean {
    if (this.gyaradosDone || !this.onWater) return false;   // calmed once the boss is beaten
    const t = this.time.now / 1000;
    for (const wp of WHIRLS) {
      const wx = OCEAN_CX + wp.r * TILE * Math.cos(wp.w * t + wp.phase);
      const wy = OCEAN_CY + wp.r * TILE * Math.sin(wp.w * t + wp.phase);
      if (Math.hypot(this.px - wx, this.py - wy) < 18) {
        this.cutsceneActive = true; this.enterPrompt.setVisible(false);
        this.registry.set('wildId', 129);            // Magikarp — a weak 부하 of Gyarados
        this.registry.set('wildLevel', 40);
        this.registry.set('wildCustom', false);
        this.registry.set('wildCatchRate', 255);
        this.registry.set('wildReturnScene', 'NampoBeachScene');
        this.registry.set('NampoBeachSceneReturnX', SHORE.x);
        this.registry.set('NampoBeachSceneReturnY', SHORE.y);
        this.dialog.show([
          'The current yanks you sideways — a whirlpool!',
          'Churned up from the depths, one of Gyarados\'s 부하 lunges at you!',
        ], () => this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene')));
        return true;
      }
    }
    return false;
  }

  private checkThreat(actionPressed: boolean): boolean {
    if (!this.missionTaken || this.gyaradosDone) return false;
    const tx = THREAT.col * TILE + 16, ty = THREAT.row * TILE + 16;
    const distance = Math.hypot(this.px - tx, this.py - ty);
    if (distance > THREAT_RADIUS) return false;
    this.enterPrompt.setText(tr(isTouchDevice()
      ? 'A / TAP — Confront the Gyarados'
      : 'SPACE — Confront the Gyarados')).setVisible(true);
    const contact = distance <= THREAT_CONTACT_RADIUS;
    if (!actionPressed && !contact) return true;
    this.cutsceneActive = true; this.enterPrompt.setVisible(false);
    this.dialog.show([
      'The Gyarados rears from the swell, sluice-water sheeting off its coils, and fixes its glare on you.',
      'It lunges, jaws wide. No turning back now!',
    ], () => {
      this.registry.set('trainerName', 'Rampaging Gyarados (난동 갸라도스)');
      this.registry.set('trainerKey', THREAT_KEY);
      this.registry.set('trainerPokemon', JSON.stringify([{ id: 130, level: 71 }]));
      this.registry.set('trainerExpPool', 1900);
      this.registry.set('trainerReturnScene', 'NampoBeachScene');
      this.registry.set('NampoBeachSceneReturnX', tx);
      this.registry.set('NampoBeachSceneReturnY', ty + TILE);
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    });
    return true;
  }

  private checkTrainers(): boolean {
    for (const tr of this.TRAINERS) {
      if (this.registry.get('trainerDefeated_' + tr.key)) continue;
      if (Math.hypot(this.px - (tr.col * TILE + 16), this.py - (tr.row * TILE + 16)) < TILE * 1.4) {
        this.cutsceneActive = true; this.enterPrompt.setVisible(false);
        this.registry.set('trainerName', tr.name);
        this.registry.set('trainerKey', tr.key);
        this.registry.set('trainerPokemon', tr.pokemon);
        this.registry.set('trainerExpPool', tr.expPool);
        this.registry.set('trainerReturnScene', 'NampoBeachScene');
        this.registry.set('NampoBeachSceneReturnX', this.px);
        this.registry.set('NampoBeachSceneReturnY', this.py);
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
    if (this.py > (ROWS - 1) * TILE && this.px > 7 * TILE && this.px < 13 * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('NampoCitySceneReturnX', 4 * 32 + 16);       // back onto the paved beach path
        this.registry.set('NampoCitySceneReturnY', 17 * 32 + 16);
        this.scene.start('NampoCityScene');
      });
    }
  }
}
