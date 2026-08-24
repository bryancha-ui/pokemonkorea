import Phaser from 'phaser';
import { t, tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, playerDesign, drawGymLeader } from '../data/CharacterSprite';
import { vanishesAfterDefeat } from '../data/Villains';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { MOBILE_ACTION_EVENT } from '../systems/TouchControls';
import { sfxCancel, sfxConfirm, sfxMove } from '../systems/UiSfx';
import {
  LANTERN_DANCE_PADS,
  LANTERN_DANCE_SEQUENCE,
  LANTERN_STAGE_LANTERNS,
  allLanternTrainersDefeated,
  allLanternsAligned,
  lanternAligned,
  lanternDanceComplete,
  lanternLitFlag,
  lanternRotation,
  lanternRotationFlag,
  lanternTrainerDefeated,
  lanternVisuallyLit,
  type DancePadId,
  type LanternDancePad,
  type LanternStageLantern,
} from '../systems/LanternStagePuzzle';

interface GymTrainer {
  key: string;
  name: string;
  line: string;
  lineKo: string;
  lineJa: string;
  col: number;
  row: number;
  pokemon: { id: number; level: number; custom?: string }[];
  expPool: number;
  defeated: boolean;
}

const IT = 36;
const LOTUS_COL = 8.5;
const LOTUS_ROW = 7;
const GATE_ROW = 3.55;

export class GeumgangGymScene extends Phaser.Scene {
  public interior3D = true;
  public flatTerrain3D = true;
  public clearSight3D = true;
  public noRocks3D = true;
  public onlyNamedBuildings = true;

  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private dialog!: DialogBox;
  private cutsceneActive = false;
  private exiting = false;
  private px = 0;
  private py = 0;
  private facing = 0;
  private walkFrame = 0;
  private walkTimer = 0;
  private mobileActionAt = -Infinity;
  private interactionReadyAt = 0;
  private readonly SPEED = 100;
  private readonly W = 16;
  private readonly H = 14;

  private lanterns = new Map<string, Phaser.GameObjects.Graphics>();
  private dancePads = new Map<DancePadId, Phaser.GameObjects.Graphics>();
  private lotusG!: Phaser.GameObjects.Graphics;
  private gateG!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private danceReady = false;
  private danceStep = 0;
  private lastDancePad?: DancePadId;

  private readonly onMobileAction = () => { this.mobileActionAt = performance.now(); };

  private trainers: GymTrainer[] = [
    {
      key: 'geum-boram', name: 'Gym Trainer Boram',
      line: 'Boram: The blossom lantern chooses who advances. Tonight, it chose me!',
      lineKo: '보람: 꽃빛 등불이 앞으로 나아갈 사람을 고르지. 오늘 밤에는 나를 골랐어!',
      lineJa: 'ボラム：花の灯籠が先へ進む者を選ぶ。今夜は私を選んだ！',
      col: 4, row: 9,
      pokemon: [{ id: 0, level: 21, custom: 'bookkuddoong' }, { id: 0, level: 22, custom: 'samdumae' }],
      expPool: 560, defeated: false,
    },
    {
      key: 'geum-junho', name: 'Gym Trainer Junho',
      line: "Junho: A Fairy's charm hides an iron will. Mind the steel under the sparkle.",
      lineKo: '준호: 페어리의 매력 속에는 강철 같은 의지가 숨어 있지. 반짝임 속의 힘을 조심해.',
      lineJa: 'ジュノ：フェアリーの魅力には鋼の意志が隠れている。輝きの奥の強さに気をつけろ。',
      col: 11, row: 8,
      pokemon: [{ id: 0, level: 21, custom: 'bookkuddoong' }, { id: 282, level: 22 }],
      expPool: 580, defeated: false,
    },
    {
      key: 'geum-areum', name: 'Gym Trainer Areum',
      line: 'Areum: Every perfect finale begins with one fearless step. Show me yours!',
      lineKo: '아름: 완벽한 피날레는 두려움 없는 한 걸음에서 시작돼. 네 걸음을 보여 줘!',
      lineJa: 'アルム：完璧なフィナーレは、恐れない一歩から始まる。君の一歩を見せて！',
      col: 5, row: 5.3,
      pokemon: [{ id: 35, level: 22 }, { id: 0, level: 22, custom: 'idolena' }],
      expPool: 600, defeated: false,
    },
  ];

  constructor() { super('GeumgangGymScene'); }

  create(): void {
    playBgm(this, 'gyminterior');
    this.cutsceneActive = false;
    this.exiting = false;
    this.danceReady = false;
    this.danceStep = 0;
    this.registry.set('geumgangDanceStep', 0);
    this.lastDancePad = undefined;
    this.lanterns.clear();
    this.dancePads.clear();
    this.input.keyboard?.resetKeys();

    const gymDefeated = !!this.registry.get('geumgangGymDefeated');
    this.trainers.forEach(trainer => {
      trainer.defeated = gymDefeated || !!this.registry.get(`trainerDefeated_${trainer.key}`);
    });

    this.px = 8 * IT + IT / 2;
    this.py = 11 * IT + IT / 2;
    const gpx = this.registry.get('gymPosX');
    const gpy = this.registry.get('gymPosY');
    const resumeX = this.registry.get('GeumgangGymSceneReturnX');
    const resumeY = this.registry.get('GeumgangGymSceneReturnY');
    if (Number.isFinite(gpx) && Number.isFinite(gpy)) {
      this.px = Number(gpx); this.py = Number(gpy);
    } else if (Number.isFinite(resumeX) && Number.isFinite(resumeY)) {
      this.px = Number(resumeX); this.py = Number(resumeY);
    }
    this.registry.remove('gymPosX');
    this.registry.remove('gymPosY');
    this.registry.remove('GeumgangGymSceneReturnX');
    this.registry.remove('GeumgangGymSceneReturnY');

    this.drawGym();
    this.drawLanterns();
    this.drawDanceStage();
    this.drawTrainers();
    this.createPlayer();
    drawGymLeader(this, LOTUS_COL * IT, IT * 1.9, {
      body: 0x8a3a6a, accent: 0xff9ad6, label: 'LEADER NAMSUN',
      labelColor: '#ffd0ef', hair: 0x6a2a5a, trainerKey: 'geumgang-namsun',
    });
    this.setupInput();
    this.cameras.main.setBounds(0, 0, this.W * IT, this.H * IT);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.cameras.main.fadeIn(300);

    this.dialog = new DialogBox(this, 1280, 720);
    this.createPuzzleUI();
    this.refreshPuzzleVisuals();

    if (gymDefeated) {
      if (!this.registry.get('namsunFarewell')) {
        this.registry.set('namsunFarewell', true);
        this.cutsceneActive = true;
        this.dialog.show([
          t('Namsun: A fine performance. The lanterns will remember you.', '남순: 훌륭한 공연이었어. 등불들이 널 기억할 거야.', 'ナムスン：見事な舞台だった。灯籠も君を覚えているだろう。'),
          t('(He lowers his voice.)', '(남순이 목소리를 낮춘다.)', '（ナムスンが声を潜める。）'),
          t('Namsun: A group in dark uniforms passed through carrying large sealed containers, moving south.', '남순: 검은 제복을 입은 무리가 커다란 밀폐 용기를 싣고 남쪽으로 지나갔어.', 'ナムスン：黒い制服の一団が、大きな密閉容器を運んで南へ向かった。'),
          t('Namsun: Whatever they carry, it does not sit right with the living world.', '남순: 그 안에 든 것이 무엇이든 생명의 흐름을 거스르고 있어.', 'ナムスン：あの中身が何であれ、命の流れに反している。'),
          t('You may leave through the south door whenever you are ready.', '준비가 되면 남쪽 문으로 나갈 수 있다.', '準備ができたら南の扉から出られる。'),
        ], () => { this.cutsceneActive = false; });
      }
      return;
    }

    const pending = LANTERN_STAGE_LANTERNS.filter(lantern =>
      lanternTrainerDefeated(lantern, key => this.registry.get(key))
      && !lanternVisuallyLit(lantern, key => this.registry.get(key)),
    );
    if (pending.length > 0) {
      this.playLanternActivationQueue([...pending]);
      return;
    }

    if (allLanternsAligned(key => this.registry.get(key)) && !this.registry.get('geumgangLanternsAligned')) {
      this.playLightConvergence();
      return;
    }
    if (this.registry.get('geumgangLanternsAligned') && !lanternDanceComplete(key => this.registry.get(key))) {
      this.beginDanceTrial();
      return;
    }

    if (!this.registry.get('geumgangGymEntered')) {
      this.registry.set('geumgangGymEntered', true);
      this.cutsceneActive = true;
      this.dialog.show([
        t('You step onto the Lantern Stage!', '금강 체육관의 등불 무대에 들어섰다!', 'クムガンジムの灯籠舞台へ足を踏み入れた！'),
        t('Three performers guard the blossom, moon and starlight lanterns.', '세 명의 공연자가 꽃빛·달빛·별빛 등불을 지키고 있다.', '三人の演者が、花・月・星の灯籠を守っている。'),
        t('Defeat each Trainer, then rotate the awakened lanterns until all three beams overlap on the central lotus.', '각 트레이너에게 승리한 뒤 깨어난 등불을 돌려 세 빛을 중앙 연꽃에 겹치자.', '各トレーナーに勝ち、目覚めた灯籠を回して三つの光を中央の蓮へ重ねよう。'),
        t('Complete Namsun’s short dance sequence to raise the final curtain.', '마지막으로 남순의 짧은 춤 순서를 완성하면 막이 열린다.', '最後にナムスンの短い舞の手順を完成させれば、幕が開く。'),
      ], () => {
        this.cutsceneActive = false;
        this.interactionReadyAt = this.time.now + 350;
      });
    }
  }

  private drawGym(): void {
    const g = this.add.graphics().setDepth(0);
    const width = this.W * IT;
    const height = this.H * IT;
    g.fillStyle(0x241a38); g.fillRect(0, 0, width, height);
    for (let row = 1; row < this.H - 1; row++) for (let col = 1; col < this.W - 1; col++) {
      g.fillStyle((row + col) % 2 === 0 ? 0x2e2248 : 0x281e40);
      g.fillRect(col * IT, row * IT, IT, IT);
    }

    g.fillStyle(0x140e22);
    g.fillRect(0, 0, width, IT); g.fillRect(0, 0, IT, height);
    g.fillRect(width - IT, 0, IT, height); g.fillRect(0, height - IT, width, IT);

    // Painted guide inlays stay flat in 3D; the interactive lanterns and beams
    // are separate true-volumetric objects.
    g.lineStyle(2, 0xb886c7, 0.26);
    for (const lantern of LANTERN_STAGE_LANTERNS) {
      g.lineBetween(lantern.col * IT, lantern.row * IT, LOTUS_COL * IT, LOTUS_ROW * IT);
    }
    g.fillStyle(0x3a294e, 0.9); g.fillCircle(LOTUS_COL * IT, LOTUS_ROW * IT, IT * 0.78);

    // Permanent stage wings leave a single curtained centre opening.
    const gateY = GATE_ROW * IT;
    g.fillStyle(0x4a2357);
    g.fillRect(IT, gateY - IT * 0.38, IT * 5.55, IT * 0.76);
    g.fillRect(IT * 10.45, gateY - IT * 0.38, width - IT * 11.45, IT * 0.76);
    g.lineStyle(2, 0xd3a759, 0.8);
    g.lineBetween(IT, gateY + IT * 0.38, IT * 6.55, gateY + IT * 0.38);
    g.lineBetween(IT * 10.45, gateY + IT * 0.38, width - IT, gateY + IT * 0.38);

    g.fillStyle(0x4a2a5a); g.fillRect(4 * IT, IT, 8 * IT, IT * 1.4);
    g.lineStyle(2, 0xffaadd); g.strokeRect(4 * IT, IT, 8 * IT, IT * 1.4);
    g.fillStyle(0x6b4a28); g.fillRect(7 * IT, height - IT, 2 * IT, IT);

    for (let row = 2; row < this.H - 1; row += 2) {
      g.fillStyle(0xffb0e0, 0.75); g.fillCircle(IT * 1.5, row * IT + IT / 2, 5);
      g.fillStyle(0xffd0a0, 0.75); g.fillCircle((this.W - 1.5) * IT, row * IT + IT / 2, 5);
    }

    const textureKey = '__geumgangGymMap__';
    if (this.textures.exists(textureKey)) this.textures.remove(textureKey);
    g.generateTexture(textureKey, width, height);
    g.destroy();
    this.add.image(0, 0, textureKey).setOrigin(0, 0).setDepth(0);

    this.add.text(width / 2, IT * 1.7, tr('🏮 LANTERN STAGE'), {
      fontSize: '11px', color: '#ffc0e8', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);
  }

  private drawLanterns(): void {
    for (const lantern of LANTERN_STAGE_LANTERNS) {
      const g = this.add.graphics().setPosition(lantern.col * IT, lantern.row * IT).setDepth(8);
      g.setData('lanternStageProp3D', {
        kind: 'lantern',
        color: lantern.color,
        beamLength: Math.hypot(LOTUS_COL - lantern.col, LOTUS_ROW - lantern.row) * IT / 32,
      });
      this.lanterns.set(lantern.id, g);
      this.syncLanternVisual(lantern);
    }
  }

  private drawDanceStage(): void {
    this.lotusG = this.add.graphics().setPosition(LOTUS_COL * IT, LOTUS_ROW * IT).setDepth(6);
    this.lotusG.setData('lanternStageProp3D', { kind: 'lotus', color: 0xffe5fb });
    this.redrawFloorEmblem(this.lotusG, 0xffe5fb, true);

    for (const pad of LANTERN_DANCE_PADS) {
      const g = this.add.graphics().setPosition(pad.col * IT, pad.row * IT).setDepth(7);
      g.setData('lanternStageProp3D', { kind: 'dance-pad', color: pad.color });
      this.redrawFloorEmblem(g, pad.color, false, pad.symbol);
      this.dancePads.set(pad.id, g);
    }

    this.gateG = this.add.graphics().setPosition(LOTUS_COL * IT, GATE_ROW * IT).setDepth(9);
    this.gateG.setData('lanternStageProp3D', { kind: 'gate', color: 0xff86da });
    this.redrawGateFallback(lanternDanceComplete(key => this.registry.get(key)) ? 0 : 1);
  }

  private redrawLanternFallback(
    g: Phaser.GameObjects.Graphics,
    lantern: LanternStageLantern,
    rotation: number,
    active: number,
    aligned: boolean,
  ): void {
    g.clear();
    const directions: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const [dx, dy] = directions[rotation] ?? directions[0];
    if (active > 0.01) {
      const beamLength = Math.hypot(LOTUS_COL - lantern.col, LOTUS_ROW - lantern.row) * IT;
      g.lineStyle(18, lantern.color, (0.08 + active * 0.12) * (aligned ? 1.4 : 1));
      g.lineBetween(0, 0, dx * beamLength, dy * beamLength);
    }
    g.fillStyle(0x130d1c, 0.25); g.fillEllipse(0, 11, 34, 10);
    g.fillStyle(0x6d4930); g.fillRect(-4, -36, 8, 47);
    g.fillStyle(0xd1a34f); g.fillRect(-16, -39, 32, 4);
    g.fillStyle(active > 0.01 ? lantern.color : 0x443849, 0.92);
    g.fillRoundedRect(-12, -30, 24, 26, 6);
    g.lineStyle(2, aligned ? 0xffefac : 0xc6984c); g.strokeRoundedRect(-12, -30, 24, 26, 6);
    g.fillStyle(active > 0.01 ? 0xffffff : 0x67586b, active > 0.01 ? 0.76 : 0.42);
    g.fillCircle(0, -17, active > 0.01 ? 5 : 3);
  }

  private redrawFloorEmblem(
    g: Phaser.GameObjects.Graphics,
    color: number,
    lotus: boolean,
    symbol?: LanternDancePad['symbol'],
  ): void {
    g.clear();
    const radius = lotus ? 27 : 19;
    g.fillStyle(0x2c203b, 0.92); g.fillCircle(0, 0, radius);
    g.lineStyle(3, 0xd0a451, 0.9); g.strokeCircle(0, 0, radius - 2);
    const petals = lotus ? 8 : 5;
    for (let index = 0; index < petals; index++) {
      const angle = index / petals * Math.PI * 2;
      g.fillStyle(color, lotus ? 0.44 : 0.34);
      g.fillEllipse(Math.sin(angle) * radius * 0.43, Math.cos(angle) * radius * 0.43, 8, 14);
    }
    const glyph = symbol === 'moon' ? '☾' : symbol === 'star' ? '✦' : symbol === 'blossom' ? '✿' : '✾';
    this.add.text(g.x, g.y, glyph, { fontSize: lotus ? '18px' : '14px', color: `#${color.toString(16).padStart(6, '0')}` })
      .setOrigin(0.5).setDepth(g.depth + 1).setData('no3d', true);
  }

  private redrawGateFallback(closed: number): void {
    const g = this.gateG;
    g.clear();
    g.fillStyle(0x512455); g.fillRect(-68, -45, 8, 54); g.fillRect(60, -45, 8, 54);
    g.fillStyle(0xd1a654); g.fillCircle(-64, -48, 6); g.fillCircle(64, -48, 6);
    g.fillStyle(0x512455); g.fillRect(-68, -48, 136, 8);
    if (closed > 0.02) {
      g.fillStyle(0xff86da, 0.18 * closed); g.fillRect(-58, -38, 116, 47);
      g.lineStyle(2, 0xffd3f0, 0.66 * closed);
      for (let x = -48; x <= 48; x += 16) g.lineBetween(x, -36, x, 8);
    }
  }

  private drawTrainers(): void {
    for (const trainer of this.trainers) {
      if (trainer.defeated && vanishesAfterDefeat(trainer.key)) continue;
      const x = trainer.col * IT + IT / 2;
      const y = trainer.row * IT + IT / 2;
      const g = this.add.graphics().setDepth(10).setPosition(x, y);
      const accent = trainer.key === 'geum-boram' ? 0xcc77bb : trainer.key === 'geum-junho' ? 0x639bc4 : 0xd3aa51;
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(accent); g.fillRect(-7, -8, 14, 11);
      g.fillStyle(accent); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x222222); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
      g.fillStyle(0x2a1020); g.fillRect(-6, -20, 12, 4);
      g.fillStyle(0x000000); g.fillRect(-3, -14, 2, 2); g.fillRect(1, -14, 2, 2);
      this.add.text(x, y - 28, this.localizedTrainerShortName(trainer), {
        fontSize: '8px', color: '#ffc0e8', backgroundColor: '#00000088', padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(11);
    }
  }

  private createPlayer(): void {
    this.playerG = this.add.graphics().setDepth(20);
    this.redrawPlayer();
  }

  private redrawPlayer(): void {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => {
      if (!this.cutsceneActive) this.scene.launch('MenuScene');
    });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => {
      if (!this.cutsceneActive) this.scene.launch('MenuScene');
    });
    window.addEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
    });
  }

  private consumeActionPressed(): boolean {
    const keyboard = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    const mobile = performance.now() - this.mobileActionAt <= 500;
    if (mobile) this.mobileActionAt = -Infinity;
    return keyboard || mobile;
  }

  update(_: number, delta: number): void {
    const actionPressed = this.consumeActionPressed();
    if (this.cutsceneActive) {
      if (actionPressed) this.dialog.advance();
      return;
    }

    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) { dx = -1; this.facing = 2; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { dx = 1; this.facing = 3; }
    if (this.cursors.up.isDown || this.wasd.up.isDown) { dy = -1; this.facing = 1; }
    if (this.cursors.down.isDown || this.wasd.down.isDown) { dy = 1; this.facing = 0; }

    if (dx || dy) {
      const length = Math.hypot(dx, dy);
      const nx = this.px + dx / length * this.SPEED * dt;
      const ny = this.py + dy / length * this.SPEED * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > 180) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else {
      this.walkFrame = 0;
    }

    this.redrawPlayer();
    this.checkTrainers();
    if (this.cutsceneActive) return;
    if (actionPressed && this.time.now >= this.interactionReadyAt) this.tryRotateLantern();
    this.checkDanceStep();
    this.checkLeaderApproach();
    this.checkExit();
    this.refreshInteractionPrompt();
  }

  private collides(x: number, y: number): boolean {
    if (x < IT || x > (this.W - 1) * IT || y < IT || y > (this.H - 1) * IT) return true;
    const inGateBand = Math.abs(y - GATE_ROW * IT) < IT * 0.43;
    if (inGateBand) {
      if (x < IT * 6.55 || x > IT * 10.45) return true;
      if (!lanternDanceComplete(key => this.registry.get(key))) return true;
    }
    for (const lantern of LANTERN_STAGE_LANTERNS) {
      if (Math.hypot(x - lantern.col * IT, y - lantern.row * IT) < IT * 0.43) return true;
    }
    return false;
  }

  private checkTrainers(): void {
    for (const trainer of this.trainers) {
      if (!trainer.defeated && this.registry.get(`trainerDefeated_${trainer.key}`)) trainer.defeated = true;
    }
    for (const trainer of this.trainers) {
      if (trainer.defeated) continue;
      const x = trainer.col * IT + IT / 2;
      const y = trainer.row * IT + IT / 2;
      if (Math.hypot(this.px - x, this.py - y) >= IT * 1.3) continue;
      this.cutsceneActive = true;
      this.promptText.setVisible(false);
      const displayName = this.localizedTrainerName(trainer);
      this.dialog.show([t(trainer.line, trainer.lineKo, trainer.lineJa), t(`${trainer.name}: Light the stage!`, `${displayName}: 무대에 빛을 밝혀 봐!`, `${displayName}：舞台に光を灯してみろ！`)], () => {
        this.registry.set('trainerName', displayName);
        this.registry.set('trainerKey', trainer.key);
        this.registry.set('trainerPokemon', JSON.stringify(trainer.pokemon));
        this.registry.set('trainerExpPool', trainer.expPool);
        this.registry.set('trainerReturnScene', 'GeumgangGymScene');
        this.registry.set('gymPosX', this.px);
        this.registry.set('gymPosY', this.py);
        // Keep the city-door return coordinates written on Gym entry. Gym-space
        // coordinates here would place the player inside a city wall after exit.
        this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
      });
      return;
    }
  }

  private playLanternActivationQueue(queue: LanternStageLantern[]): void {
    const lantern = queue.shift();
    if (!lantern) {
      if (allLanternsAligned(key => this.registry.get(key))) this.playLightConvergence();
      else {
        this.cutsceneActive = false;
        this.interactionReadyAt = this.time.now + 350;
      }
      return;
    }

    this.cutsceneActive = true;
    const names = this.lanternNames(lantern);
    this.dialog.show([
      t(
        `${names.en} lantern answers its performer's victory.`,
        `${names.ko} 등불이 공연자의 승리에 응답한다.`,
        `${names.ja}の灯籠が演者の勝利に応える。`,
      ),
      t('Its sealed flame blooms into a beam of Fairy light.', '봉인되어 있던 불꽃이 페어리의 빛줄기로 피어난다.', '封じられていた炎が、フェアリーの光線となって咲く。'),
    ], () => this.animateLanternActivation(lantern, () => this.playLanternActivationQueue(queue)));
  }

  private animateLanternActivation(lantern: LanternStageLantern, done: () => void): void {
    const g = this.lanterns.get(lantern.id);
    if (!g) { done(); return; }
    const state = { light: 0 };
    const rotation = lanternRotation(lantern, key => this.registry.get(key));
    this.cameras.main.shake(130, 0.003);
    this.tweens.add({
      targets: state,
      light: 1,
      duration: 850,
      ease: 'Sine.Out',
      onUpdate: () => {
        g.setData('lanternStageActive3D', state.light);
        g.setData('lanternStageCue3D', state.light);
        this.redrawLanternFallback(g, lantern, rotation, state.light, rotation === lantern.targetRotation);
      },
      onComplete: () => {
        this.registry.set(lanternLitFlag(lantern), true);
        g.setData('lanternStageCue3D', 0);
        this.syncLanternVisual(lantern);
        this.refreshPuzzleVisuals();
        this.savePuzzleState();
        sfxConfirm(this);
        this.cameras.main.flash(220, 255, 190, 235, false);
        this.time.delayedCall(250, done);
      },
    });
  }

  private tryRotateLantern(): void {
    if (this.registry.get('geumgangLanternsAligned') || this.registry.get('geumgangGymDefeated')) return;
    const nearest = [...LANTERN_STAGE_LANTERNS]
      .map(lantern => ({ lantern, distance: Math.hypot(this.px - lantern.col * IT, this.py - lantern.row * IT) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (!nearest || nearest.distance > IT * 1.35) return;
    if (!lanternVisuallyLit(nearest.lantern, key => this.registry.get(key))) {
      this.cutsceneActive = true;
      this.dialog.show([
        t('The lantern is dark. Its performer still holds the flame.', '등불이 꺼져 있다. 담당 공연자가 아직 불꽃을 지키고 있다.', '灯籠は暗い。担当の演者がまだ炎を守っている。'),
      ], () => { this.cutsceneActive = false; this.interactionReadyAt = this.time.now + 300; });
      return;
    }

    const current = lanternRotation(nearest.lantern, key => this.registry.get(key));
    this.registry.set(lanternRotationFlag(nearest.lantern), (current + 1) % 4);
    const g = this.lanterns.get(nearest.lantern.id);
    if (g) {
      g.setData('lanternStageCue3D', 1);
      this.time.delayedCall(260, () => g.scene && g.setData('lanternStageCue3D', 0));
    }
    this.syncLanternVisual(nearest.lantern);
    this.refreshPuzzleVisuals();
    this.savePuzzleState();
    sfxMove(this);
    this.cameras.main.shake(90, 0.002);

    if (allLanternsAligned(key => this.registry.get(key))) this.playLightConvergence();
  }

  private playLightConvergence(): void {
    if (this.registry.get('geumgangLanternsAligned')) {
      this.beginDanceTrial();
      return;
    }
    this.registry.set('geumgangLanternsAligned', true);
    this.cutsceneActive = true;
    this.promptText?.setVisible(false);
    for (const lantern of LANTERN_STAGE_LANTERNS) {
      const g = this.lanterns.get(lantern.id);
      g?.setData('lanternStageAligned3D', 1);
      g?.setData('lanternStageCue3D', 1);
    }
    this.lotusG.setData('lanternStageActive3D', 1);
    this.lotusG.setData('lanternStageAligned3D', 1);
    this.lotusG.setData('lanternStageCue3D', 1);
    this.refreshPuzzleVisuals();
    this.savePuzzleState();
    this.cameras.main.flash(450, 255, 210, 245, false);
    this.cameras.main.shake(380, 0.007);
    this.time.delayedCall(650, () => {
      for (const lantern of LANTERN_STAGE_LANTERNS) this.lanterns.get(lantern.id)?.setData('lanternStageCue3D', 0);
      this.lotusG.setData('lanternStageCue3D', 0);
      this.dialog.show([
        t('The blossom, moon and starlight beams overlap on the central lotus!', '꽃빛·달빛·별빛이 중앙 연꽃 위에서 하나로 겹쳐졌다!', '花・月・星の光が、中央の蓮の上で一つに重なった！'),
        t('A four-step rhythm appears on the performance floor: Moon → Blossom → Star → Blossom.', '공연 바닥에 네 걸음의 순서가 떠오른다. 달 → 꽃 → 별 → 꽃.', '舞台の床に四歩の順番が浮かぶ。月 → 花 → 星 → 花。'),
      ], () => this.beginDanceTrial());
    });
  }

  private beginDanceTrial(): void {
    if (lanternDanceComplete(key => this.registry.get(key))) {
      this.cutsceneActive = false;
      return;
    }
    this.cutsceneActive = true;
    this.danceReady = false;
    this.danceStep = 0;
    this.registry.set('geumgangDanceStep', 0);
    this.lastDancePad = undefined;
    this.refreshPuzzleVisuals();
    this.dialog.show([
      t('Watch the floor, then repeat Namsun’s steps.', '바닥의 빛을 본 뒤 남순의 발걸음을 그대로 따라 하자.', '床の光を見て、ナムスンの足取りをそのまま繰り返そう。'),
      t('Moon → Blossom → Star → Blossom', '달 → 꽃 → 별 → 꽃', '月 → 花 → 星 → 花'),
    ], () => this.flashDanceSequence(0, () => {
      this.danceReady = true;
      this.cutsceneActive = false;
      this.interactionReadyAt = this.time.now + 300;
      this.refreshPuzzleVisuals();
    }));
  }

  private flashDanceSequence(index: number, done: () => void): void {
    if (index >= LANTERN_DANCE_SEQUENCE.length) { done(); return; }
    const id = LANTERN_DANCE_SEQUENCE[index];
    const g = this.dancePads.get(id);
    g?.setData('lanternStageActive3D', 1);
    g?.setData('lanternStageCue3D', 1);
    this.time.delayedCall(360, () => {
      g?.setData('lanternStageCue3D', 0);
      g?.setData('lanternStageActive3D', 0.32);
      this.time.delayedCall(150, () => this.flashDanceSequence(index + 1, done));
    });
  }

  private checkDanceStep(): void {
    if (!this.danceReady || lanternDanceComplete(key => this.registry.get(key))) return;
    const touched = LANTERN_DANCE_PADS.find(pad =>
      Math.hypot(this.px - pad.col * IT, this.py - pad.row * IT) < IT * 0.48,
    );
    if (!touched) { this.lastDancePad = undefined; return; }
    if (this.lastDancePad === touched.id) return;
    this.lastDancePad = touched.id;

    const expected = LANTERN_DANCE_SEQUENCE[this.danceStep];
    this.pulseDancePad(touched.id);
    if (touched.id !== expected) {
      sfxCancel(this);
      this.danceReady = false;
      this.danceStep = 0;
      this.registry.set('geumgangDanceStep', 0);
      this.cutsceneActive = true;
      this.cameras.main.shake(180, 0.006);
      this.dialog.show([
        t('The rhythm breaks and the floor lights fade. Try the four steps again.', '리듬이 흐트러지며 바닥의 빛이 사라졌다. 네 걸음을 다시 맞춰 보자.', 'リズムが崩れ、床の光が消えた。四歩をもう一度合わせよう。'),
      ], () => this.flashDanceSequence(0, () => {
        this.danceReady = true;
        this.cutsceneActive = false;
        this.lastDancePad = undefined;
        this.refreshPuzzleVisuals();
      }));
      return;
    }

    this.danceStep++;
    sfxMove(this);
    this.registry.set('geumgangDanceStep', this.danceStep);
    this.refreshPuzzleVisuals();
    if (this.danceStep >= LANTERN_DANCE_SEQUENCE.length) this.completeDanceTrial();
  }

  private pulseDancePad(id: DancePadId): void {
    const g = this.dancePads.get(id);
    if (!g) return;
    g.setData('lanternStageActive3D', 1);
    g.setData('lanternStageCue3D', 1);
    this.time.delayedCall(280, () => {
      if (!g.scene) return;
      g.setData('lanternStageCue3D', 0);
      g.setData('lanternStageActive3D', 0.32);
    });
  }

  private completeDanceTrial(): void {
    this.danceReady = false;
    this.registry.set('geumgangDanceStep', LANTERN_DANCE_SEQUENCE.length);
    this.registry.set('geumgangLanternDanceComplete', true);
    this.savePuzzleState();
    sfxConfirm(this);
    this.cutsceneActive = true;
    const state = { closed: 1 };
    this.tweens.add({
      targets: state,
      closed: 0,
      duration: 950,
      ease: 'Cubic.InOut',
      onUpdate: () => {
        this.gateG.setData('lanternStageActive3D', state.closed);
        this.redrawGateFallback(state.closed);
      },
      onComplete: () => {
        this.gateG.setData('lanternStageActive3D', 0);
        this.cameras.main.flash(300, 255, 220, 248, false);
        this.cameras.main.shake(300, 0.006);
        this.refreshPuzzleVisuals();
        this.dialog.show([
          t('Your final blossom step lands exactly on the beat!', '마지막 꽃 발걸음이 정확히 박자에 맞았다!', '最後の花の一歩が、正確に拍子へ重なった！'),
          t('The light curtain rises. Leader Namsun waits beyond the stage.', '빛의 장막이 올라가고 무대 너머에서 관장 남순이 기다린다.', '光の幕が上がり、その先でナムスン館長が待っている。'),
        ], () => { this.cutsceneActive = false; });
      },
    });
  }

  private syncLanternVisual(lantern: LanternStageLantern): void {
    const g = this.lanterns.get(lantern.id);
    if (!g) return;
    const read = (key: string) => this.registry.get(key);
    const rotation = lanternRotation(lantern, read);
    const lit = lanternVisuallyLit(lantern, read);
    const aligned = lanternAligned(lantern, read);
    g.setData('lanternStageActive3D', lit ? 1 : 0);
    g.setData('lanternStageRotation3D', rotation);
    g.setData('lanternStageAligned3D', aligned ? 1 : 0);
    if (g.getData('lanternStageCue3D') === undefined) g.setData('lanternStageCue3D', 0);
    this.redrawLanternFallback(g, lantern, rotation, lit ? 1 : 0, aligned);
  }

  private refreshPuzzleVisuals(): void {
    const read = (key: string) => this.registry.get(key);
    for (const lantern of LANTERN_STAGE_LANTERNS) this.syncLanternVisual(lantern);
    const aligned = allLanternsAligned(read) || !!this.registry.get('geumgangLanternsAligned');
    const complete = lanternDanceComplete(read);
    if (this.lotusG) {
      this.lotusG.setData('lanternStageActive3D', aligned ? 1 : 0.16);
      this.lotusG.setData('lanternStageAligned3D', aligned ? 1 : 0);
    }
    for (const pad of this.dancePads.values()) {
      if (!pad.getData('lanternStageCue3D')) pad.setData('lanternStageActive3D', aligned && !complete ? 0.32 : complete ? 1 : 0.08);
    }
    if (this.gateG) {
      this.gateG.setData('lanternStageActive3D', complete ? 0 : 1);
      this.redrawGateFallback(complete ? 0 : 1);
    }
    this.refreshPuzzleStatus();
  }

  private createPuzzleUI(): void {
    this.statusText = this.add.text(18, 18, '', {
      fontSize: '12px', color: '#ffe8fa', backgroundColor: '#1d1029dd',
      padding: { x: 9, y: 6 }, stroke: '#000', strokeThickness: 2,
    }).setScrollFactor(0).setDepth(210);
    this.promptText = this.add.text((this.W * IT) / 2, this.H * IT - 50, '', {
      fontSize: '11px', color: '#fff1ad', backgroundColor: '#140d20dd',
      padding: { x: 8, y: 5 }, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(210).setVisible(false);
  }

  private refreshPuzzleStatus(): void {
    if (!this.statusText) return;
    const read = (key: string) => this.registry.get(key);
    const trainers = LANTERN_STAGE_LANTERNS.filter(lantern => lanternTrainerDefeated(lantern, read)).length;
    const aligned = LANTERN_STAGE_LANTERNS.filter(lantern => lanternAligned(lantern, read)).length;
    if (lanternDanceComplete(read)) {
      this.statusText.setText(t('CURTAIN RAISED · NAMSUN AWAITS', '막이 열림 · 남순에게 도전', '開幕 · ナムスンに挑戦'));
    } else if (this.registry.get('geumgangLanternsAligned')) {
      this.statusText.setText(t(
        `DANCE  ${this.danceStep} / ${LANTERN_DANCE_SEQUENCE.length}  ☾ → ✿ → ✦ → ✿`,
        `춤 순서  ${this.danceStep} / ${LANTERN_DANCE_SEQUENCE.length}  달 → 꽃 → 별 → 꽃`,
        `舞の手順  ${this.danceStep} / ${LANTERN_DANCE_SEQUENCE.length}  月 → 花 → 星 → 花`,
      ));
    } else if (allLanternTrainersDefeated(read)) {
      this.statusText.setText(t(`ALIGN LIGHTS  ${aligned} / 3`, `등불 정렬  ${aligned} / 3`, `灯籠整列  ${aligned} / 3`));
    } else {
      this.statusText.setText(t(`AWAKEN LANTERNS  ${trainers} / 3`, `등불 깨우기  ${trainers} / 3`, `灯籠を灯す  ${trainers} / 3`));
    }
  }

  private refreshInteractionPrompt(): void {
    if (!this.promptText || this.cutsceneActive) { this.promptText?.setVisible(false); return; }
    if (this.danceReady) {
      this.promptText.setText(t('Step in order: Moon → Blossom → Star → Blossom', '순서대로 밟기: 달 → 꽃 → 별 → 꽃', '順番に踏む：月 → 花 → 星 → 花')).setVisible(true);
      return;
    }
    if (this.registry.get('geumgangLanternsAligned')) { this.promptText.setVisible(false); return; }
    const nearest = [...LANTERN_STAGE_LANTERNS]
      .map(lantern => ({ lantern, distance: Math.hypot(this.px - lantern.col * IT, this.py - lantern.row * IT) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (!nearest || nearest.distance > IT * 1.5) { this.promptText.setVisible(false); return; }
    const lit = lanternVisuallyLit(nearest.lantern, key => this.registry.get(key));
    this.promptText.setText(lit
      ? t('A / SPACE · Rotate lantern', 'A / SPACE · 등불 돌리기', 'A / SPACE · 灯籠を回す')
      : t('Defeat this lantern’s performer first', '먼저 이 등불의 공연자에게 승리하자', '先にこの灯籠の演者を倒そう'))
      .setVisible(true);
  }

  private lanternNames(lantern: LanternStageLantern): { en: string; ko: string; ja: string } {
    if (lantern.id === 'blossom') return { en: 'Blossom', ko: '꽃빛', ja: '花光' };
    if (lantern.id === 'moon') return { en: 'Moon', ko: '달빛', ja: '月光' };
    return { en: 'Starlight', ko: '별빛', ja: '星光' };
  }

  private localizedTrainerName(trainer: GymTrainer): string {
    if (trainer.key === 'geum-boram') return t(trainer.name, '체육관 트레이너 보람', 'ジムトレーナー ボラム');
    if (trainer.key === 'geum-junho') return t(trainer.name, '체육관 트레이너 준호', 'ジムトレーナー ジュノ');
    return t(trainer.name, '체육관 트레이너 아름', 'ジムトレーナー アルム');
  }

  private localizedTrainerShortName(trainer: GymTrainer): string {
    if (trainer.key === 'geum-boram') return t('Boram', '보람', 'ボラム');
    if (trainer.key === 'geum-junho') return t('Junho', '준호', 'ジュノ');
    return t('Areum', '아름', 'アルム');
  }

  private savePuzzleState(): void {
    this.registry.set('lastScene', 'GeumgangGymScene');
    this.registry.set('lastX', this.px);
    this.registry.set('lastY', this.py);
    SaveManager.autoSave(this.registry, this.px, this.py, 'GeumgangGymScene');
  }

  private checkLeaderApproach(): void {
    if (!lanternDanceComplete(key => this.registry.get(key))) return;
    if (this.registry.get('geumgangGymDefeated')) return;
    if (this.py >= IT * 2.8 || this.cutsceneActive) return;
    this.cutsceneActive = true;
    this.dialog.show([
      t('(A performer in flowing, lantern-lit robes glides to center stage.)', '(등불빛이 흐르는 옷을 입은 공연자가 무대 중앙으로 미끄러지듯 나온다.)', '（灯籠の光をまとった衣装の演者が、舞台中央へ滑るように現れる。）'),
      t('Namsun: I am Namsun, the Eternal Performer. You did not merely follow the light—you gave it rhythm.', '남순: 나는 영원의 공연자 남순. 넌 빛을 따라온 데 그치지 않고 빛에 리듬을 주었구나.', 'ナムスン：私は永遠の演者、ナムスン。君は光を追うだけでなく、光にリズムを与えた。'),
      t('Namsun: Fairy magic is the spell that holds a crowd breathless. Let us begin the final act!', '남순: 페어리의 마법은 관객의 숨을 멎게 하는 주문이지. 마지막 막을 시작하자!', 'ナムスン：フェアリーの魔法は、観客の息を止める呪文。最終幕を始めよう！'),
    ], () => {
      this.registry.set('trainerName', 'Leader Namsun');
      this.registry.set('trainerKey', 'geumgang-namsun');
      this.registry.set('trainerPokemon', JSON.stringify([
        { id: 0, level: 22, custom: 'bookkuddoong' },
        { id: 0, level: 23, custom: 'luninari' },
        { id: 0, level: 23, custom: 'samdumae' },
        { id: 0, level: 23, custom: 'capaludar' },
        { id: 730, level: 25 },
      ]));
      this.registry.set('trainerExpPool', 1100);
      this.registry.set('trainerReturnScene', 'GeumgangGymScene');
      this.registry.set('gymPosX', this.px);
      this.registry.set('gymPosY', this.py);
      this.registry.set('trainerBadgeFlag', 'geumgangGymDefeated');
      this.registry.set('trainerBadgeName', 'Lantern Stage Badge');
      this.registry.set('trainerBadgeTM', 'Dazzling Gleam');
      this.registry.set('trainerWinLine', 'Namsun: Beautiful. The lanterns have never shone for a finer challenger.');
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    });
  }

  private checkExit(): void {
    if (this.exiting) return;
    if (this.py > (this.H - 2) * IT && this.px > 6.5 * IT && this.px < 9.5 * IT && !this.cutsceneActive) {
      this.exiting = true;
      this.cameras.main.fadeOut(300, 0, 0, 0, () => this.scene.start('GeumgangCityScene'));
    }
  }
}
