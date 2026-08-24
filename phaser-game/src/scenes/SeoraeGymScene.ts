import Phaser from 'phaser';
import { drawGymLeader, drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { vanishesAfterDefeat } from '../data/Villains';
import {
  FIGURE_SKATING_SEQUENCE,
  ICE_SPORT_TRIALS,
  advanceShortTrackBalance,
  iceArenaClearedCount,
  iceArenaComplete,
  iceSportCleared,
  iceSportClearedFlag,
  iceSportUnlocked,
  nextSpeedStride,
  reconcileIceArenaProgress,
  shortTrackRequiredLean,
  type FigureMove,
  type IceSportId,
  type IceSportTrial,
} from '../systems/IceArenaGymPuzzle';
import { playBgm } from '../systems/Music';
import { MOBILE_ACTION_EVENT } from '../systems/TouchControls';
import { sfxCancel, sfxConfirm, sfxMove } from '../systems/UiSfx';
import { t } from '../systems/i18n';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';

interface GymTrainer {
  key: 'seorae-nunsong' | 'seorae-baram';
  name: [string, string, string];
  line: [string, string, string];
  col: number;
  row: number;
  pokemon: { id: number; level: number; custom?: string }[];
  expPool: number;
  defeated: boolean;
}

interface ShortTrackRun {
  trial: IceSportTrial;
  elapsedMs: number;
  balance: number;
  laps: number;
  requiredLean: -1 | 0 | 1;
}

interface SpeedSkatingRun {
  trial: IceSportTrial;
  elapsedMs: number;
  progress: number;
  momentum: number;
  expected: 'left' | 'right';
  strides: number;
  lastStrideAt: number;
  laneOffset: number;
}

interface FigureSkatingRun {
  trial: IceSportTrial;
  phase: 'demo' | 'input';
  elapsedMs: number;
  demoIndex: number;
  inputIndex: number;
  inputWindowMs: number;
  poseMs: number;
  lastMove?: FigureMove;
}

interface ArenaGate {
  id: 'short-gate' | 'speed-gate' | 'figure-gate';
  y: number;
  graphic: Phaser.GameObjects.Graphics;
}

const IT = 36;

export class SeoraeGymScene extends Phaser.Scene {
  public interior3D = true;
  public clearSight3D = true;
  public flatTerrain3D = true;
  public noRocks3D = true;
  public onlyNamedBuildings = true;
  public hideLeadCompanion3D = false;

  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private dialog!: DialogBox;
  private cutsceneActive = false;
  private exiting = false;
  private px = 0;
  private py = 0;
  private facing = 0;
  private walkFrame = 0;
  private walkTimer = 0;
  private readonly SPEED = 118;
  private readonly W = 20;
  private readonly H = 30;
  private shortRun: ShortTrackRun | null = null;
  private speedRun: SpeedSkatingRun | null = null;
  private figureRun: FigureSkatingRun | null = null;
  private rinkProps = new Map<IceSportId, Phaser.GameObjects.Graphics>();
  private beacons = new Map<IceSportId, Phaser.GameObjects.Graphics>();
  private gates: ArenaGate[] = [];
  private trailG!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private trialPanel!: Phaser.GameObjects.Container;
  private trialTitle!: Phaser.GameObjects.Text;
  private trialDetail!: Phaser.GameObjects.Text;
  private trialGauge!: Phaser.GameObjects.Graphics;
  private promptText!: Phaser.GameObjects.Text;
  private mobileActionAt = -Infinity;
  private interactionReadyAt = 0;
  private readonly onMobileAction = () => { this.mobileActionAt = performance.now(); };

  private trainers: GymTrainer[] = [
    {
      key: 'seorae-nunsong',
      name: ['Skating Coach Nunsong', '스케이팅 코치 눈송', 'スケートコーチ・ヌンソン'],
      line: [
        'Nunsong: You held the inside line. Now hold your ground against me!',
        '눈송: 인코스를 지켜냈군. 이번에는 나를 상대로 중심을 지켜 봐!',
        'ヌンソン：インコースを守り切ったな。今度は私を相手に軸を守れ！',
      ],
      col: 15,
      row: 21,
      pokemon: [{ id: 460, level: 45 }, { id: 91, level: 46 }],
      expPool: 940,
      defeated: false,
    },
    {
      key: 'seorae-baram',
      name: ['Speed Coach Baram', '스피드 코치 바람', 'スピードコーチ・バラム'],
      line: [
        'Baram: Fast feet mean nothing without rhythm. Keep pace with my team!',
        '바람: 리듬 없는 빠른 발은 의미가 없다. 내 팀의 속도를 따라와 봐!',
        'バラム：リズムのない速さに意味はない。私のチームについて来い！',
      ],
      col: 15,
      row: 12,
      pokemon: [{ id: 615, level: 46 }, { id: 478, level: 48 }],
      expPool: 1000,
      defeated: false,
    },
  ];

  constructor() { super('SeoraeGymScene'); }

  create(): void {
    playBgm(this, 'gyminterior');
    this.cutsceneActive = false;
    this.exiting = false;
    this.shortRun = null;
    this.speedRun = null;
    this.figureRun = null;
    this.rinkProps.clear();
    this.beacons.clear();
    this.gates = [];
    this.hideLeadCompanion3D = false;
    this.input.keyboard?.resetKeys();
    reconcileIceArenaProgress(
      key => this.registry.get(key),
      (key, value) => this.registry.set(key, value),
    );
    this.trainers.forEach(trainer => {
      trainer.defeated = !!this.registry.get(`trainerDefeated_${trainer.key}`)
        || !!this.registry.get('seoraeGymDefeated');
    });

    this.px = 10 * IT;
    this.py = 28 * IT;
    const battleX = Number(this.registry.get('gymPosX'));
    const battleY = Number(this.registry.get('gymPosY'));
    const savedX = Number(this.registry.get('SeoraeGymSceneReturnX'));
    const savedY = Number(this.registry.get('SeoraeGymSceneReturnY'));
    if (Number.isFinite(battleX) && Number.isFinite(battleY)) {
      this.px = battleX;
      this.py = battleY;
    } else if (Number.isFinite(savedX) && Number.isFinite(savedY)) {
      this.px = savedX;
      this.py = savedY;
    }
    this.registry.remove('gymPosX');
    this.registry.remove('gymPosY');
    this.registry.remove('SeoraeGymSceneReturnX');
    this.registry.remove('SeoraeGymSceneReturnY');
    this.sanitizeRestoredPosition();

    this.drawGymShell();
    this.drawSportRinks();
    this.drawEventGates();
    this.drawTrainers();
    this.createSkateTrail();
    this.createPlayer();
    drawGymLeader(this, 10 * IT, 1.75 * IT, {
      body: 0x3a6a8a,
      accent: 0xaee6ff,
      label: t('LEADER YEONA', '관장 연아', 'ジムリーダー・ヨナ'),
      labelColor: '#cdeeff',
      skin: 0xf0e6ea,
      hair: 0xbfe6ff,
      trainerKey: 'seorae-yeona',
    });
    this.setupInput();
    this.createHud();
    this.cameras.main.setBounds(0, 0, this.W * IT, this.H * IT);
    this.cameras.main.startFollow(this.playerG, true, 0.12, 0.12);
    this.cameras.main.fadeIn(300);
    this.dialog = new DialogBox(this, 1280, 720);
    this.interactionReadyAt = this.time.now + 450;
    this.syncArenaVisuals();

    if (this.registry.get('seoraeGymDefeated') && !this.registry.get('yeonaFarewell')) {
      this.registry.set('yeonaFarewell', true);
      this.showDialogue([
        t('Yeona: You joined control, speed and expression into one performance. The Frostbell Badge belongs with you.', '연아: 제어와 속도, 표현을 하나의 연기로 엮어냈군요. 서리종배지는 당신에게 어울려요.', 'ヨナ：制御と速さ、表現を一つの演技へ結んだ。霜鈴バッジはあなたにふさわしい。'),
        t('Yeona: Beyond Seorae, the road descends toward Sunrise City and Onnuri’s first light.', '연아: 서래 너머 길은 일출시티와 온누리의 첫 빛을 향해 내려가요.', 'ヨナ：ソレの先の道は、日の出シティとオンヌリ最初の光へ下っていく。'),
        t('Professor Song calls urgently: Team Nos is moving against Nabihalmang at the Jeju vents.', '송 박사에게서 긴급 연락이 왔다. 노스단이 제주 분화구의 나비할망을 노리고 있다.', 'ソン博士から緊急連絡だ。ノス団が済州火口のナビハルマンを狙っている。'),
      ]);
      return;
    }

    if (!this.registry.get('seoraeIceArenaIntroSeen')) {
      this.registry.set('seoraeIceArenaIntroSeen', true);
      this.showDialogue([
        t('Welcome to Seorae Ice Arena Gym!', '서래 빙상 경기장 체육관에 입장했다!', 'ソレ氷上競技場ジムへようこそ！'),
        t('Three events await: two short-track laps, an alternating speed-skating sprint, and a figure-skating routine.', '두 바퀴 쇼트트랙, 좌우 교대 스퍼트의 스피드스케이팅, 안무를 재현하는 피겨스케이팅까지 세 종목이 기다린다.', 'ショートトラック2周、左右交互のスピードスケート、振付を再現するフィギュアスケートの3種目が待つ。'),
        t('Complete each event and defeat its rink coach to open the next gate.', '각 종목을 완주하고 링크 코치에게 승리하면 다음 관문이 열린다.', '各種目を完走し、リンクコーチに勝つと次のゲートが開く。'),
      ]);
    }
  }

  private showDialogue(lines: string[], done?: () => void): void {
    this.cutsceneActive = true;
    this.promptText?.setVisible(false);
    this.dialog.show(lines, () => {
      this.cutsceneActive = false;
      this.interactionReadyAt = this.time.now + 280;
      this.updateStatusHud();
      done?.();
    });
  }

  private drawGymShell(): void {
    const width = this.W * IT;
    const height = this.H * IT;
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x193248); g.fillRect(0, 0, width, height);
    for (let row = 1; row < this.H - 1; row++) {
      for (let col = 1; col < this.W - 1; col++) {
        g.fillStyle((row + col) % 2 ? 0xc9e3ec : 0xd8edf3);
        g.fillRect(col * IT, row * IT, IT, IT);
        g.fillStyle(0xffffff, 0.24); g.fillRect(col * IT + 5, row * IT + 7, 13, 2);
      }
    }
    g.fillStyle(0x243d52);
    g.fillRect(0, 0, width, IT);
    g.fillRect(0, 0, IT, height);
    g.fillRect(width - IT, 0, IT, height);
    g.fillRect(0, height - IT, width, IT);
    for (const row of [3.2, 11, 20]) {
      g.fillStyle(0x4e718b, 0.82);
      g.fillRect(IT, row * IT - 5, 7 * IT, 10);
      g.fillRect(12 * IT, row * IT - 5, 7 * IT, 10);
    }
    for (let row = 2; row < this.H - 1; row += 2) {
      g.fillStyle(0xa7ddf4); g.fillCircle(1.5 * IT, row * IT, 6);
      g.fillCircle((this.W - 1.5) * IT, row * IT, 6);
    }
    g.fillStyle(0x86bfd8); g.fillRoundedRect(5 * IT, IT, 10 * IT, 1.65 * IT, 10);
    g.lineStyle(3, 0xf3fdff); g.strokeRoundedRect(5 * IT, IT, 10 * IT, 1.65 * IT, 10);
    g.fillStyle(0x765038); g.fillRect(9 * IT, height - IT, 2 * IT, IT);
    const textureKey = '__seoraeIceArenaMap__';
    if (this.textures.exists(textureKey)) this.textures.remove(textureKey);
    g.generateTexture(textureKey, width, height);
    g.destroy();
    this.add.image(0, 0, textureKey).setOrigin(0).setDepth(0);
    this.add.text(width / 2, 1.45 * IT, t('SEORAE ICE ARENA', '서래 빙상 경기장', 'ソレ氷上競技場'), {
      fontSize: '13px', color: '#163d58', fontStyle: 'bold', stroke: '#f4fdff', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(5);
  }

  private drawSportRinks(): void {
    const short = this.add.graphics().setDepth(3).setPosition(10 * IT, 24 * IT);
    short.fillStyle(0xb8eef7, 0.78); short.fillEllipse(0, 0, 16 * IT, 6.2 * IT);
    short.lineStyle(4, 0x2c74bd); short.strokeEllipse(0, 0, 14.6 * IT, 5.2 * IT);
    short.lineStyle(3, 0xf16b55); short.strokeEllipse(0, 0, 12.3 * IT, 3.6 * IT);
    short.setData('iceSportProp3D', { kind: 'short-track', width: 18, depth: 7.2, accent: 0x2c74bd });
    this.rinkProps.set('short-track', short);

    const speed = this.add.graphics().setDepth(3).setPosition(10 * IT, 15.5 * IT);
    speed.fillStyle(0xbcecf5, 0.8); speed.fillRoundedRect(-4 * IT, -3.5 * IT, 8 * IT, 7 * IT, 18);
    speed.lineStyle(3, 0x297cbd);
    for (const col of [-2, 0, 2]) speed.lineBetween(col * IT, -3.3 * IT, col * IT, 3.3 * IT);
    speed.lineStyle(4, 0xffffff); speed.lineBetween(-3.8 * IT, -3.15 * IT, 3.8 * IT, -3.15 * IT);
    speed.setData('iceSportProp3D', { kind: 'speed-lane', width: 9, depth: 7.9, accent: 0x297cbd });
    this.rinkProps.set('speed-skating', speed);

    const figure = this.add.graphics().setDepth(3).setPosition(10 * IT, 7 * IT);
    figure.fillStyle(0xc8f3f8, 0.84); figure.fillEllipse(0, 0, 16 * IT, 6.4 * IT);
    figure.lineStyle(3, 0x9c70db); figure.strokeCircle(0, 0, 2.2 * IT);
    for (let arm = 0; arm < 6; arm++) {
      const angle = arm * Math.PI / 3;
      figure.lineBetween(0, 0, Math.cos(angle) * 3.2 * IT, Math.sin(angle) * 2.4 * IT);
    }
    figure.setData('iceSportProp3D', { kind: 'figure-rink', width: 18, depth: 7.3, accent: 0x9c70db });
    this.rinkProps.set('figure-skating', figure);

    const labels: [IceSportId, string, string, string, number, number][] = [
      ['short-track', '1 · SHORT TRACK', '1 · 쇼트트랙', '1・ショートトラック', 10 * IT, 20.75 * IT],
      ['speed-skating', '2 · SPEED SKATING', '2 · 스피드스케이팅', '2・スピードスケート', 10 * IT, 12.2 * IT],
      ['figure-skating', '3 · FIGURE SKATING', '3 · 피겨스케이팅', '3・フィギュアスケート', 10 * IT, 4.1 * IT],
    ];
    for (const [, en, ko, ja, x, y] of labels) {
      this.add.text(x, y, t(en, ko, ja), {
        fontSize: '11px', color: '#194b69', fontStyle: 'bold', backgroundColor: '#ecfbffcc', padding: { x: 7, y: 3 },
      }).setOrigin(0.5).setDepth(6);
    }

    for (const trial of ICE_SPORT_TRIALS) {
      const beacon = this.add.graphics().setDepth(8).setPosition(trial.startCol * IT, trial.startRow * IT);
      beacon.lineStyle(4, 0x72e8ff); beacon.strokeCircle(0, 0, 18);
      beacon.fillStyle(0xffffff, 0.85); beacon.fillTriangle(0, -11, -9, 7, 9, 7);
      beacon.setData('iceSportProp3D', { kind: 'start-beacon', width: 1.2, depth: 1.2, accent: this.trialAccent(trial.id) });
      this.beacons.set(trial.id, beacon);
    }
  }

  private drawEventGates(): void {
    const specs: ArenaGate['id'][] = ['short-gate', 'speed-gate', 'figure-gate'];
    const rows = [20, 11, 3.2];
    specs.forEach((id, index) => {
      const graphic = this.add.graphics().setDepth(7).setPosition(10 * IT, rows[index] * IT);
      graphic.setData('iceSportProp3D', { kind: 'gate', width: 4.5, depth: 0.7, accent: index === 2 ? 0x9c70db : 0x4da9d8 });
      this.gates.push({ id, y: rows[index] * IT, graphic });
    });
  }

  private drawTrainers(): void {
    for (const trainer of this.trainers) {
      if (trainer.defeated && vanishesAfterDefeat(trainer.key)) continue;
      const x = trainer.col * IT;
      const y = trainer.row * IT;
      const g = this.add.graphics().setDepth(11).setPosition(x, y);
      const accent = trainer.key === 'seorae-nunsong' ? 0x4e9bd0 : 0x764fb7;
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 17, 5);
      g.fillStyle(0xeefaff); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(accent); g.fillRect(-7, -7, 14, 4);
      g.fillStyle(0x24374b); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffccaa); g.fillRect(-6, -20, 12, 11);
      g.fillStyle(0x334b62); g.fillRect(-7, -21, 14, 5);
      g.fillStyle(0x07131c); g.fillRect(-3, -14, 2, 2); g.fillRect(1, -14, 2, 2);
      this.add.text(x, y - 29, trainer.key === 'seorae-nunsong' ? t('Nunsong', '눈송', 'ヌンソン') : t('Baram', '바람', 'バラム'), {
        fontSize: '8px', color: '#e9fbff', backgroundColor: '#0b2940cc', padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(12).setData('characterLabelTarget3D', g);
    }
  }

  private createSkateTrail(): void {
    this.trailG = this.add.graphics().setDepth(17).setVisible(false);
    this.trailG.setData('iceSportProp3D', { kind: 'skate-trail', width: 1, depth: 1.5, accent: 0xbef7ff });
    this.trailG.setData('iceSportActive3D', 0);
  }

  private createPlayer(): void {
    this.playerG = this.add.graphics().setDepth(20);
    this.redrawPlayer();
  }

  private redrawPlayer(): void {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
    this.trailG?.setPosition(this.px, this.py + 10);
    if (this.trialActive()) {
      this.trailG?.clear();
      this.trailG?.lineStyle(2, 0xeaffff, 0.72);
      this.trailG?.lineBetween(-5, 2, -5, 28);
      this.trailG?.lineBetween(5, 2, 5, 28);
    }
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
      if (!this.cutsceneActive && !this.trialActive()) this.scene.launch('MenuScene');
    });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => {
      if (!this.cutsceneActive && !this.trialActive()) this.scene.launch('MenuScene');
    });
    window.addEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
      this.hideLeadCompanion3D = false;
    });
  }

  private createHud(): void {
    const statusPanel = this.add.rectangle(640, 42, 510, 48, 0x0a2639, 0.9)
      .setStrokeStyle(2, 0x8cecff).setScrollFactor(0);
    this.statusText = this.add.text(640, 42, '', {
      fontSize: '14px', color: '#eaffff', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0);
    this.add.container(0, 0, [statusPanel, this.statusText]).setDepth(1000).setScrollFactor(0);

    const panel = this.add.rectangle(640, 105, 560, 104, 0x071d2d, 0.94)
      .setStrokeStyle(2, 0x8cecff).setScrollFactor(0);
    this.trialTitle = this.add.text(640, 72, '', {
      fontSize: '17px', color: '#ffffff', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0);
    this.trialGauge = this.add.graphics().setScrollFactor(0);
    this.trialDetail = this.add.text(640, 134, '', {
      fontSize: '12px', color: '#bdefff', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0);
    this.trialPanel = this.add.container(0, 0, [panel, this.trialTitle, this.trialGauge, this.trialDetail])
      .setDepth(1001).setScrollFactor(0).setVisible(false);

    this.promptText = this.add.text(640, 652, '', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#071d2ddd',
      padding: { x: 14, y: 8 }, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(999).setVisible(false);
    this.updateStatusHud();
  }

  private consumeActionPressed(): boolean {
    const keyboard = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    const mobile = performance.now() - this.mobileActionAt <= 500;
    if (mobile) this.mobileActionAt = -Infinity;
    return keyboard || mobile;
  }

  update(_: number, delta: number): void {
    const actionPressed = this.consumeActionPressed();
    const leftPressed = Phaser.Input.Keyboard.JustDown(this.cursors.left)
      || Phaser.Input.Keyboard.JustDown(this.wasd.left);
    const rightPressed = Phaser.Input.Keyboard.JustDown(this.cursors.right)
      || Phaser.Input.Keyboard.JustDown(this.wasd.right);
    const upPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up)
      || Phaser.Input.Keyboard.JustDown(this.wasd.up);
    const downPressed = Phaser.Input.Keyboard.JustDown(this.cursors.down)
      || Phaser.Input.Keyboard.JustDown(this.wasd.down);
    if (this.cutsceneActive) {
      if (actionPressed) this.dialog.advance();
      return;
    }
    if (this.exiting) return;

    if (this.shortRun) {
      const lean = (this.cursors.left.isDown || this.wasd.left.isDown) ? -1
        : (this.cursors.right.isDown || this.wasd.right.isDown) ? 1 : 0;
      this.updateShortTrack(delta, lean);
      return;
    }
    if (this.speedRun) {
      this.updateSpeedSkating(delta, leftPressed, rightPressed);
      return;
    }
    if (this.figureRun) {
      const move: FigureMove | undefined = leftPressed ? 'left' : rightPressed ? 'right'
        : upPressed ? 'up' : downPressed ? 'down' : actionPressed ? 'spin' : undefined;
      this.updateFigureSkating(delta, move);
      return;
    }

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) { dx = -1; this.facing = 2; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { dx = 1; this.facing = 3; }
    if (this.cursors.up.isDown || this.wasd.up.isDown) { dy = -1; this.facing = 1; }
    if (this.cursors.down.isDown || this.wasd.down.isDown) { dy = 1; this.facing = 0; }
    const dt = Math.min(delta, 60) / 1000;
    if (dx || dy) {
      const length = Math.hypot(dx, dy);
      const nx = this.px + dx / length * this.SPEED * dt;
      const ny = this.py + dy / length * this.SPEED * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > 160) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else {
      this.walkFrame = 0;
    }
    this.redrawPlayer();
    this.checkTrainerProgress();
    if (this.cutsceneActive) return;
    this.updateTrialPrompt(actionPressed);
    if (this.cutsceneActive) return;
    this.checkLeaderApproach();
    this.checkExit();
  }

  private trialActive(): boolean {
    return !!this.shortRun || !!this.speedRun || !!this.figureRun;
  }

  private collides(x: number, y: number): boolean {
    if (x < IT * 1.05 || x > (this.W - 1.05) * IT || y < IT * 1.02 || y > (this.H - 1.02) * IT) return true;
    for (const gate of this.gates) {
      if (!this.gateOpen(gate.id) && Math.abs(y - gate.y) < 11) return true;
    }
    return false;
  }

  private updateTrialPrompt(actionPressed: boolean): void {
    for (const beacon of this.beacons.values()) beacon.setData('iceSportCue3D', 0);
    let nearest: IceSportTrial | undefined;
    let distance = Infinity;
    for (const trial of ICE_SPORT_TRIALS) {
      if (iceSportCleared(trial, key => this.registry.get(key))) continue;
      const nextDistance = Math.hypot(this.px - trial.startCol * IT, this.py - trial.startRow * IT);
      if (nextDistance < distance) { nearest = trial; distance = nextDistance; }
    }
    if (!nearest || distance > IT * 1.4) {
      this.promptText.setVisible(false);
      return;
    }
    if (!iceSportUnlocked(nearest, key => this.registry.get(key))) {
      this.promptText.setText(t('Defeat the rink coach to open this event.', '링크 코치에게 승리해야 이 종목이 열린다.', 'リンクコーチに勝つとこの種目が開く。')).setVisible(true);
      return;
    }
    this.promptText.setText(t(
      `[SPACE / A] Start ${this.trialName(nearest.id)}`,
      `[SPACE / A] ${this.trialName(nearest.id)} 시작`,
      `[SPACE / A] ${this.trialName(nearest.id)}開始`,
    )).setVisible(true);
    this.beacons.get(nearest.id)?.setData('iceSportCue3D', 1);
    if (actionPressed && this.time.now >= this.interactionReadyAt) {
      this.promptText.setVisible(false);
      sfxConfirm(this);
      this.beginTrial(nearest);
    }
  }

  private beginTrial(trial: IceSportTrial): void {
    if (trial.id === 'short-track') {
      this.showDialogue([
        t('SHORT TRACK · Complete two clockwise laps. Hold toward the infield on each tight bend.', '쇼트트랙 · 시계 방향으로 두 바퀴를 완주하자. 급커브에서는 링크 안쪽 방향을 길게 눌러 중심을 잡는다.', 'ショートトラック・時計回りに2周しよう。急カーブではリンク内側を長押ししてバランスを取る。'),
        t('Right bend: hold LEFT. Left bend: hold RIGHT.', '오른쪽 커브에서는 왼쪽, 왼쪽 커브에서는 오른쪽을 누른다.', '右カーブでは左、左カーブでは右を押そう。'),
      ], () => this.beginShortTrack(trial));
      return;
    }
    if (trial.id === 'speed-skating') {
      this.showDialogue([
        t('SPEED SKATING · Alternate LEFT and RIGHT strides to build speed and reach the finish before time expires.', '스피드스케이팅 · 왼쪽과 오른쪽 스트로크를 번갈아 입력해 가속하고 제한 시간 안에 결승선을 통과하자.', 'スピードスケート・左右のストロークを交互に入力し、制限時間内にゴールしよう。'),
      ], () => this.beginSpeedSkating(trial));
      return;
    }
    this.showDialogue([
      t('FIGURE SKATING · Watch the six-step routine, then repeat it. Use directions for edges and SPACE / A for a spin.', '피겨스케이팅 · 여섯 동작의 시범을 본 뒤 그대로 재현하자. 엣지는 방향키, 스핀은 SPACE / A를 사용한다.', 'フィギュアスケート・6つの演技を見て再現しよう。エッジは方向、スピンはSPACE / Aを使う。'),
    ], () => this.beginFigureSkating(trial));
  }

  private beginShortTrack(trial: IceSportTrial): void {
    this.shortRun = { trial, elapsedMs: 0, balance: 0.72, laps: 0, requiredLean: 0 };
    this.hideLeadCompanion3D = true;
    this.trailG.setVisible(true).setData('iceSportActive3D', 1);
    this.rinkProps.get(trial.id)?.setData('iceSportActive3D', 1);
    this.trialPanel.setVisible(true);
    this.facing = 3;
    this.updateShortTrack(0, 0);
  }

  private updateShortTrack(delta: number, inputLean: number): void {
    const run = this.shortRun;
    if (!run) return;
    const dt = Math.min(delta, 48) / 1000;
    run.elapsedMs += Math.min(delta, 48);
    const angularSpeed = 1.43;
    const travelled = run.elapsedMs / 1000 * angularSpeed;
    const angle = Math.PI / 2 - travelled;
    run.laps = Math.floor(travelled / (Math.PI * 2));
    run.requiredLean = shortTrackRequiredLean(angle);
    run.balance = advanceShortTrackBalance(run.balance, angle, inputLean, dt);
    this.px = 10 * IT + Math.cos(angle) * 7.1 * IT;
    this.py = 24 * IT + Math.sin(angle) * 2.45 * IT;
    this.facing = Math.sin(angle) > 0 ? (Math.cos(angle) > 0 ? 3 : 2) : 1;
    this.walkFrame = Math.floor(run.elapsedMs / 110) % 2;
    this.rinkProps.get(run.trial.id)?.setData('iceSportCue3D', Math.abs(run.requiredLean));
    this.updateTrialHud();
    this.redrawPlayer();
    if (run.balance <= 0.001) this.failTrial(run.trial, t('You lost the racing line and spun out!', '레이싱 라인을 놓쳐 스핀아웃했다!', 'レーシングラインを外し、スピンアウトした！'));
    else if (run.laps >= 2) this.completeTrial(run.trial);
  }

  private beginSpeedSkating(trial: IceSportTrial): void {
    this.speedRun = {
      trial, elapsedMs: 0, progress: 0, momentum: 0.28,
      expected: 'left', strides: 0, lastStrideAt: -1000, laneOffset: 0,
    };
    this.hideLeadCompanion3D = true;
    this.trailG.setVisible(true).setData('iceSportActive3D', 1);
    this.rinkProps.get(trial.id)?.setData('iceSportActive3D', 1);
    this.trialPanel.setVisible(true);
    this.px = 10 * IT;
    this.py = 19 * IT;
    this.facing = 1;
    this.updateTrialHud();
  }

  private updateSpeedSkating(delta: number, leftPressed: boolean, rightPressed: boolean): void {
    const run = this.speedRun;
    if (!run) return;
    const dt = Math.min(delta, 48) / 1000;
    run.elapsedMs += Math.min(delta, 48);
    const pressed = leftPressed !== rightPressed ? (leftPressed ? 'left' : 'right') : undefined;
    if (pressed && run.elapsedMs - run.lastStrideAt >= 130) {
      const stride = nextSpeedStride(run.expected, pressed);
      if (stride.correct) {
        run.momentum = Math.min(1, run.momentum + 0.17);
        run.strides++;
        run.expected = stride.next;
        run.laneOffset = pressed === 'left' ? -1 : 1;
        sfxMove(this);
      } else {
        run.momentum = Math.max(0, run.momentum - 0.2);
        run.laneOffset *= -0.4;
        sfxCancel(this);
      }
      run.lastStrideAt = run.elapsedMs;
    }
    if (run.elapsedMs - run.lastStrideAt > 850) run.momentum -= 0.14 * dt;
    run.momentum = Phaser.Math.Clamp(run.momentum - 0.055 * dt, 0, 1);
    run.progress = Math.min(1, run.progress + (0.035 + run.momentum * 0.215) * dt);
    run.laneOffset *= Math.exp(-2.4 * dt);
    this.px = 10 * IT + run.laneOffset * IT * 0.75;
    this.py = Phaser.Math.Linear(19 * IT, 12 * IT, run.progress);
    this.walkFrame = Math.floor(run.elapsedMs / Math.max(75, 160 - run.momentum * 70)) % 2;
    this.rinkProps.get(run.trial.id)?.setData('iceSportCue3D', run.expected === 'left' ? -1 : 1);
    this.updateTrialHud();
    this.redrawPlayer();
    if (run.progress >= 1 && run.strides >= 10) this.completeTrial(run.trial);
    else if (run.elapsedMs >= 11000) this.failTrial(run.trial, t('The finish horn sounded before you crossed the line!', '결승선을 통과하기 전에 종료 신호가 울렸다!', 'ゴール前に終了のホーンが鳴った！'));
  }

  private beginFigureSkating(trial: IceSportTrial): void {
    this.figureRun = {
      trial, phase: 'demo', elapsedMs: 0, demoIndex: 0,
      inputIndex: 0, inputWindowMs: 0, poseMs: 0,
    };
    this.hideLeadCompanion3D = true;
    this.trailG.setVisible(true).setData('iceSportActive3D', 1);
    this.rinkProps.get(trial.id)?.setData('iceSportActive3D', 1);
    this.trialPanel.setVisible(true);
    this.px = 10 * IT;
    this.py = 7 * IT;
    this.facing = 1;
    this.updateTrialHud();
  }

  private updateFigureSkating(delta: number, pressed?: FigureMove): void {
    const run = this.figureRun;
    if (!run) return;
    const stepMs = 650;
    run.elapsedMs += Math.min(delta, 48);
    run.poseMs += Math.min(delta, 48);
    if (run.phase === 'demo') {
      const nextDemoIndex = Math.min(FIGURE_SKATING_SEQUENCE.length - 1, Math.floor(run.elapsedMs / stepMs));
      if (nextDemoIndex !== run.demoIndex) {
        run.demoIndex = nextDemoIndex;
        run.poseMs = 0;
      }
      const move = FIGURE_SKATING_SEQUENCE[run.demoIndex];
      this.applyFigurePose(move, run.poseMs);
      if (run.elapsedMs >= FIGURE_SKATING_SEQUENCE.length * stepMs + 350) {
        run.phase = 'input';
        run.elapsedMs = 0;
        run.inputWindowMs = 0;
        run.poseMs = 0;
        this.px = 10 * IT;
        this.py = 7 * IT;
        this.playerG.setAngle(0).setData('characterElevation3D', 0);
      }
    } else {
      run.inputWindowMs += Math.min(delta, 48);
      if (pressed) {
        const expected = FIGURE_SKATING_SEQUENCE[run.inputIndex];
        if (pressed !== expected) {
          this.failTrial(run.trial, t('The edge broke the routine. Return to the opening pose!', '엣지가 안무에서 벗어났다. 처음 자세부터 다시 시작하자!', 'エッジが振付から外れた。最初のポーズからやり直そう！'));
          return;
        }
        run.lastMove = pressed;
        run.inputIndex++;
        run.inputWindowMs = 0;
        run.poseMs = 0;
        sfxConfirm(this);
        this.cameras.main.flash(90, 190, 240, 255, false);
        if (run.inputIndex >= FIGURE_SKATING_SEQUENCE.length) {
          this.applyFigurePose('spin', 280);
          this.completeTrial(run.trial);
          return;
        }
      }
      if (run.lastMove) this.applyFigurePose(run.lastMove, run.poseMs);
      if (run.inputWindowMs >= 2800) {
        this.failTrial(run.trial, t('The music moved on before the next element!', '다음 동작을 하기 전에 음악이 지나가 버렸다!', '次の技を出す前に音楽が進んでしまった！'));
        return;
      }
    }
    this.rinkProps.get(run.trial.id)?.setData('iceSportCue3D', run.phase === 'demo' ? run.demoIndex / FIGURE_SKATING_SEQUENCE.length : run.inputIndex / FIGURE_SKATING_SEQUENCE.length);
    this.updateTrialHud();
    this.redrawPlayer();
  }

  private applyFigurePose(move: FigureMove, poseMs: number): void {
    const centerX = 10 * IT;
    const centerY = 7 * IT;
    const amount = Math.min(1, poseMs / 400);
    if (move === 'left') { this.px = centerX - 2.3 * IT * amount; this.py = centerY; this.facing = 2; }
    else if (move === 'right') { this.px = centerX + 2.3 * IT * amount; this.py = centerY; this.facing = 3; }
    else if (move === 'up') { this.px = centerX; this.py = centerY - 1.5 * IT * amount; this.facing = 1; }
    else if (move === 'down') { this.px = centerX; this.py = centerY + 1.5 * IT * amount; this.facing = 0; }
    else {
      const spin = poseMs / 1000 * Math.PI * 4;
      this.px = centerX + Math.cos(spin) * IT * 0.42;
      this.py = centerY + Math.sin(spin) * IT * 0.24;
      this.playerG.setAngle((poseMs * 0.72) % 360);
    }
    const jump = move === 'up' || move === 'spin' ? Math.sin(Math.min(1, poseMs / 650) * Math.PI) * 0.62 : 0;
    this.playerG.setData('characterElevation3D', Math.max(0, jump));
    this.walkFrame = Math.floor(poseMs / 120) % 2;
  }

  private completeTrial(trial: IceSportTrial): void {
    this.registry.set(iceSportClearedFlag(trial), true);
    this.registry.set('seoraeIceArenaCheckpoint', trial.index + 1);
    this.stopTrial(trial);
    if (trial.id === 'short-track') { this.px = 10 * IT; this.py = 26.7 * IT; }
    else if (trial.id === 'speed-skating') { this.px = 10 * IT; this.py = 12.15 * IT; }
    else { this.px = 10 * IT; this.py = 3.75 * IT; }
    this.registry.set('SeoraeGymSceneReturnX', this.px);
    this.registry.set('SeoraeGymSceneReturnY', this.py);
    this.syncArenaVisuals();
    SaveManager.autoSave(this.registry, this.px, this.py, 'SeoraeGymScene');
    sfxConfirm(this);
    this.cameras.main.shake(160, 0.004);
    this.redrawPlayer();
    this.showDialogue([
      t(
        `${this.trialName(trial.id)} clear! The result board lights up.`,
        `${this.trialName(trial.id)} 클리어! 기록판에 불이 들어왔다.`,
        `${this.trialName(trial.id)}クリア！リザルトボードが点灯した。`,
      ),
      trial.index < 2
        ? t('The rink coach is ready to judge your battle form.', '링크 코치가 이번에는 배틀 자세를 심사하려 한다.', 'リンクコーチが今度はバトルフォームを審査する。')
        : t('All three events are complete. Leader Yeona awaits beyond the final gate.', '세 종목을 모두 완주했다. 마지막 관문 너머에서 관장 연아가 기다린다.', '3種目すべてを完走した。最後のゲートの先でジムリーダー・ヨナが待つ。'),
    ]);
  }

  private failTrial(trial: IceSportTrial, message: string): void {
    this.stopTrial(trial);
    this.px = trial.startCol * IT;
    this.py = trial.startRow * IT;
    this.redrawPlayer();
    sfxCancel(this);
    this.cameras.main.shake(280, 0.011);
    this.showDialogue([
      message,
      t('No penalty — return to the start beacon and try the event again.', '패널티는 없다. 출발 비콘에서 종목에 다시 도전하자.', 'ペナルティはない。スタートビーコンから再挑戦しよう。'),
    ]);
  }

  private stopTrial(trial: IceSportTrial): void {
    this.shortRun = null;
    this.speedRun = null;
    this.figureRun = null;
    this.hideLeadCompanion3D = false;
    this.trialPanel.setVisible(false);
    this.trailG.setVisible(false).setData('iceSportActive3D', 0);
    this.rinkProps.get(trial.id)?.setData('iceSportActive3D', 0);
    this.playerG.setAngle(0).setData('characterElevation3D', 0);
    this.walkFrame = 0;
  }

  private updateTrialHud(): void {
    this.trialGauge.clear();
    const left = 490;
    const width = 300;
    this.trialGauge.fillStyle(0x15384e); this.trialGauge.fillRoundedRect(left, 94, width, 17, 7);
    if (this.shortRun) {
      const run = this.shortRun;
      this.trialTitle.setText(t('SHORT TRACK · TWO LAPS', '쇼트트랙 · 두 바퀴', 'ショートトラック・2周'));
      this.trialGauge.fillStyle(run.balance > 0.55 ? 0x4bdb9e : run.balance > 0.28 ? 0xf0c453 : 0xed5c6a);
      this.trialGauge.fillRoundedRect(left, 94, width * run.balance, 17, 7);
      const lean = run.requiredLean < 0 ? '◀' : run.requiredLean > 0 ? '▶' : '◆';
      this.trialDetail.setText(t(
        `Lap ${Math.min(2, run.laps + 1)} / 2 · Infield lean ${lean} · Balance ${Math.round(run.balance * 100)}%`,
        `${Math.min(2, run.laps + 1)} / 2바퀴 · 인코스 기울기 ${lean} · 균형 ${Math.round(run.balance * 100)}%`,
        `${Math.min(2, run.laps + 1)} / 2周・内側リーン ${lean}・バランス ${Math.round(run.balance * 100)}%`,
      ));
    } else if (this.speedRun) {
      const run = this.speedRun;
      this.trialTitle.setText(t('SPEED SKATING · ALTERNATE STRIDES', '스피드스케이팅 · 교대 스트로크', 'スピードスケート・交互ストローク'));
      this.trialGauge.fillStyle(0x43c7ed); this.trialGauge.fillRoundedRect(left, 94, width * run.progress, 17, 7);
      this.trialDetail.setText(t(
        `Next ${run.expected === 'left' ? '◀ LEFT' : 'RIGHT ▶'} · Strides ${run.strides} · ${Math.max(0, 11 - run.elapsedMs / 1000).toFixed(1)}s`,
        `다음 ${run.expected === 'left' ? '◀ 왼쪽' : '오른쪽 ▶'} · 스트로크 ${run.strides} · ${Math.max(0, 11 - run.elapsedMs / 1000).toFixed(1)}초`,
        `次 ${run.expected === 'left' ? '◀ 左' : '右 ▶'}・ストローク ${run.strides}・${Math.max(0, 11 - run.elapsedMs / 1000).toFixed(1)}秒`,
      ));
    } else if (this.figureRun) {
      const run = this.figureRun;
      const index = run.phase === 'demo' ? run.demoIndex : run.inputIndex;
      this.trialTitle.setText(run.phase === 'demo'
        ? t('FIGURE SKATING · WATCH', '피겨스케이팅 · 시범 보기', 'フィギュアスケート・お手本')
        : t('FIGURE SKATING · PERFORM', '피겨스케이팅 · 연기하기', 'フィギュアスケート・演技'));
      this.trialGauge.fillStyle(0xb583ed);
      this.trialGauge.fillRoundedRect(left, 94, width * ((index + (run.phase === 'demo' ? 1 : 0)) / FIGURE_SKATING_SEQUENCE.length), 17, 7);
      const sequence = FIGURE_SKATING_SEQUENCE.map((move, moveIndex) => {
        const glyph = this.figureMoveGlyph(move);
        return moveIndex === index ? `[${glyph}]` : glyph;
      }).join('  ');
      this.trialDetail.setText(run.phase === 'demo'
        ? t(`Watch · ${sequence}`, `시범 · ${sequence}`, `お手本・${sequence}`)
        : t(`Repeat · ${sequence}`, `재현 · ${sequence}`, `再現・${sequence}`));
    }
    this.trialGauge.lineStyle(2, 0xffffff); this.trialGauge.strokeRoundedRect(left, 94, width, 17, 7);
  }

  private updateStatusHud(): void {
    if (!this.statusText) return;
    const sports = iceArenaClearedCount(key => this.registry.get(key));
    const coaches = this.trainers.filter(trainer => trainer.defeated
      || this.registry.get(`trainerDefeated_${trainer.key}`)).length;
    this.statusText.setText(t(
      `SEORAE ICE ARENA · EVENTS ${sports}/3 · COACHES ${coaches}/2`,
      `서래 빙상 경기장 · 종목 ${sports}/3 · 코치 ${coaches}/2`,
      `ソレ氷上競技場・種目 ${sports}/3・コーチ ${coaches}/2`,
    ));
  }

  private syncArenaVisuals(): void {
    for (const trial of ICE_SPORT_TRIALS) {
      const cleared = iceSportCleared(trial, key => this.registry.get(key));
      const unlocked = iceSportUnlocked(trial, key => this.registry.get(key));
      this.rinkProps.get(trial.id)?.setData('iceSportCleared3D', cleared ? 1 : 0);
      const beacon = this.beacons.get(trial.id);
      beacon?.setVisible(!cleared);
      beacon?.setData('iceSportCleared3D', cleared ? 1 : 0);
      beacon?.setData('iceSportActive3D', unlocked ? 1 : 0);
      beacon?.setData('iceSportCue3D', 0);
    }
    for (const gate of this.gates) {
      const open = this.gateOpen(gate.id);
      gate.graphic.clear();
      gate.graphic.fillStyle(0x385d76); gate.graphic.fillRect(-2.15 * IT, -17, 9, 34); gate.graphic.fillRect(2.15 * IT - 9, -17, 9, 34);
      gate.graphic.fillStyle(open ? 0x66dcb1 : 0x5baad2);
      if (open) {
        gate.graphic.fillRect(-2.15 * IT, -13, 1.7 * IT, 7);
        gate.graphic.fillRect(0.45 * IT, -13, 1.7 * IT, 7);
      } else gate.graphic.fillRect(-2.15 * IT, -5, 4.3 * IT, 10);
      gate.graphic.setData('iceSportCleared3D', open ? 1 : 0);
    }
    this.updateStatusHud();
  }

  private gateOpen(id: ArenaGate['id']): boolean {
    if (this.registry.get('seoraeGymDefeated')) return true;
    if (id === 'short-gate') return iceSportCleared(ICE_SPORT_TRIALS[0], key => this.registry.get(key))
      && !!this.registry.get('trainerDefeated_seorae-nunsong');
    if (id === 'speed-gate') return iceSportCleared(ICE_SPORT_TRIALS[1], key => this.registry.get(key))
      && !!this.registry.get('trainerDefeated_seorae-baram');
    return iceArenaComplete(key => this.registry.get(key));
  }

  private checkTrainerProgress(): void {
    for (const trainer of this.trainers) {
      if (!trainer.defeated && this.registry.get(`trainerDefeated_${trainer.key}`)) trainer.defeated = true;
    }
    for (const trainer of this.trainers) {
      if (trainer.defeated) continue;
      const requiredTrial = trainer.key === 'seorae-nunsong' ? ICE_SPORT_TRIALS[0] : ICE_SPORT_TRIALS[1];
      if (!iceSportCleared(requiredTrial, key => this.registry.get(key))) continue;
      if (Math.hypot(this.px - trainer.col * IT, this.py - trainer.row * IT) >= IT * 1.3) continue;
      this.showDialogue([t(...trainer.line), t(
        `${trainer.name[0]}: The rink is ready — battle!`,
        `${trainer.name[1]}: 링크 준비 완료, 배틀 시작!`,
        `${trainer.name[2]}：リンク準備完了、バトル開始！`,
      )], () => this.startTrainerBattle(trainer));
      return;
    }
  }

  private startTrainerBattle(trainer: GymTrainer): void {
    this.registry.set('trainerName', t(...trainer.name));
    this.registry.set('trainerKey', trainer.key);
    this.registry.set('trainerPokemon', JSON.stringify(trainer.pokemon));
    this.registry.set('trainerExpPool', trainer.expPool);
    this.registry.set('trainerReturnScene', 'SeoraeGymScene');
    this.registry.set('gymPosX', this.px);
    this.registry.set('gymPosY', this.py);
    this.exiting = true;
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
  }

  private checkLeaderApproach(): void {
    if (this.registry.get('seoraeGymDefeated') || this.cutsceneActive) return;
    const ready = iceArenaComplete(key => this.registry.get(key))
      && this.trainers.every(trainer => trainer.defeated || this.registry.get(`trainerDefeated_${trainer.key}`));
    if (!ready || this.py >= 2.85 * IT) return;
    this.showDialogue([
      t('(Yeona traces a perfect circle on the ice and stops without a sound.)', '(연아가 빙판 위에 완벽한 원을 그린 뒤 소리 없이 멈춰 선다.)', '（ヨナは氷上に完璧な円を描き、音もなく止まった。）'),
      t('Yeona: Short track taught control, speed skating taught rhythm, and figure skating revealed your expression.', '연아: 쇼트트랙에서는 제어를, 스피드스케이팅에서는 리듬을, 피겨스케이팅에서는 당신의 표현을 보았어요.', 'ヨナ：ショートトラックでは制御、スピードスケートではリズム、フィギュアではあなたの表現を見た。'),
      t('Yeona: Now weave all three into one battle on my winter stage.', '연아: 이제 세 가지를 하나로 엮어 제 겨울 무대에서 승부해요.', 'ヨナ：今度は三つを一つに結び、私の冬の舞台で勝負しよう。'),
    ], () => this.startLeaderBattle());
  }

  private startLeaderBattle(): void {
    this.registry.set('trainerName', t('Leader Yeona', '관장 연아', 'ジムリーダー・ヨナ'));
    this.registry.set('trainerKey', 'seorae-yeona');
    this.registry.set('trainerPokemon', JSON.stringify([
      { id: 362, level: 46 },
      { id: 699, level: 48 },
      { id: 0, level: 50, custom: 'snoqueen' },
    ]));
    this.registry.set('trainerExpPool', 1450);
    this.registry.set('trainerReturnScene', 'SeoraeGymScene');
    this.registry.set('gymPosX', this.px);
    this.registry.set('gymPosY', this.py);
    this.registry.set('trainerBadgeFlag', 'seoraeGymDefeated');
    this.registry.set('trainerBadgeName', t('Frostbell Badge', '서리종배지', '霜鈴バッジ'));
    this.registry.set('trainerBadgeTM', 'Aurora Veil');
    this.registry.set('trainerWinLine', t(
      'Yeona: Even the deepest winter yields to your performance. Go warmly.',
      '연아: 가장 깊은 겨울도 당신의 연기에는 길을 내주는군요. 따뜻하게 나아가세요.',
      'ヨナ：最も深い冬も、あなたの演技には道を譲る。温かく進みなさい。',
    ));
    this.exiting = true;
    this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
  }

  private checkExit(): void {
    if (this.py <= (this.H - 1.55) * IT || this.px <= 8.5 * IT || this.px >= 11.5 * IT) return;
    this.exiting = true;
    this.promptText.setVisible(false);
    this.registry.set('seoraeReturnX', 20 * 32);
    this.registry.set('seoraeReturnY', 16 * 32);
    this.cameras.main.fadeOut(300, 0, 0, 0, () => this.scene.start('SeoraeTownScene'));
  }

  private sanitizeRestoredPosition(): void {
    const outOfBounds = this.px < IT * 1.1 || this.px > (this.W - 1.1) * IT
      || this.py < IT * 1.05 || this.py > (this.H - 1.05) * IT;
    const sealedGate = [20, 11, 3.2].some(row => Math.abs(this.py - row * IT) < 15);
    if (!outOfBounds && !sealedGate) return;
    if (iceArenaComplete(key => this.registry.get(key))) {
      this.px = 10 * IT; this.py = 3.75 * IT;
    } else if (iceSportCleared(ICE_SPORT_TRIALS[1], key => this.registry.get(key))
      && this.registry.get('trainerDefeated_seorae-baram')) {
      this.px = 10 * IT; this.py = 10 * IT;
    } else if (iceSportCleared(ICE_SPORT_TRIALS[0], key => this.registry.get(key))
      && this.registry.get('trainerDefeated_seorae-nunsong')) {
      this.px = 10 * IT; this.py = 19 * IT;
    } else {
      this.px = 10 * IT; this.py = 28 * IT;
    }
  }

  private trialName(id: IceSportId): string {
    if (id === 'short-track') return t('Short Track', '쇼트트랙', 'ショートトラック');
    if (id === 'speed-skating') return t('Speed Skating', '스피드스케이팅', 'スピードスケート');
    return t('Figure Skating', '피겨스케이팅', 'フィギュアスケート');
  }

  private trialAccent(id: IceSportId): number {
    if (id === 'short-track') return 0x2c74bd;
    if (id === 'speed-skating') return 0x36c3df;
    return 0x9c70db;
  }

  private figureMoveGlyph(move: FigureMove): string {
    if (move === 'left') return '◀';
    if (move === 'right') return '▶';
    if (move === 'up') return '▲';
    if (move === 'down') return '▼';
    return '⟳A';
  }
}
