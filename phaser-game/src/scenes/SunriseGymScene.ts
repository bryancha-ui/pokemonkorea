import Phaser from 'phaser';
import { drawGymLeader, drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { vanishesAfterDefeat } from '../data/Villains';
import { playBgm } from '../systems/Music';
import {
  STORM_INSULATED_PADS,
  STORM_RODS,
  activeStormRod,
  isStandingOnInsulatedPad,
  normalizeStormDirection,
  reconcileStormCliffProgress,
  resolveStormStrike,
  stormChargedFlag,
  stormCliffChargedCount,
  stormCliffComplete,
  stormDirectionKey,
  stormHeightKey,
  stormPadForRod,
  stormRodCharged,
  stormRodConfigured,
  stormRodDirection,
  stormRodHeight,
  stormRodUnlocked,
  type StormDirection,
  type StormRodDef,
  type StormRodId,
} from '../systems/StormCliffGymPuzzle';
import { MOBILE_ACTION_EVENT } from '../systems/TouchControls';
import { sfxCancel, sfxConfirm, sfxMove } from '../systems/UiSfx';
import { t } from '../systems/i18n';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';

interface GymTrainer {
  key: 'sunrise-seongwoo' | 'sunrise-daehwi';
  name: [string, string, string];
  line: [string, string, string];
  col: number;
  row: number;
  elevation: number;
  pokemon: { id: number; level: number; custom?: string }[];
  expPool: number;
  defeated: boolean;
}

interface StormGate {
  id: 'dawn-bridge' | 'gale-bridge' | 'summit-gate';
  row: number;
  elevation: number;
  graphic: Phaser.GameObjects.Graphics;
}

interface LiftRun {
  elapsedMs: number;
  fromX: number;
  fromY: number;
}

const IT = 36;
const STORM_CYCLE_MS = 7800;
const STORM_STRIKE_AT_MS = 6500;
const STORM_STRIKE_END_MS = 6880;

export class SunriseGymScene extends Phaser.Scene {
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
  private facing = 1;
  private walkFrame = 0;
  private walkTimer = 0;
  private readonly SPEED = 118;
  private readonly W = 20;
  private readonly H = 28;
  private rodGraphics = new Map<StormRodId, Phaser.GameObjects.Graphics>();
  private receiverGraphics = new Map<StormRodId, Phaser.GameObjects.Graphics>();
  private lightningGraphics = new Map<StormRodId, Phaser.GameObjects.Graphics>();
  private padGraphics = new Map<StormRodId, Phaser.GameObjects.Graphics>();
  private platforms: Phaser.GameObjects.Graphics[] = [];
  private gates: StormGate[] = [];
  private elevatorG!: Phaser.GameObjects.Graphics;
  private calibrating: StormRodDef | null = null;
  private liftRun: LiftRun | null = null;
  private stormElapsedMs = 0;
  private warningCuePlayed = false;
  private lightningActiveRod: StormRodId | null = null;
  private statusText!: Phaser.GameObjects.Text;
  private stormPanel!: Phaser.GameObjects.Container;
  private stormTitle!: Phaser.GameObjects.Text;
  private stormGauge!: Phaser.GameObjects.Graphics;
  private stormDetail!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private mobileActionAt = -Infinity;
  private interactionReadyAt = 0;
  private readonly onMobileAction = () => { this.mobileActionAt = performance.now(); };

  private trainers: GymTrainer[] = [
    {
      key: 'sunrise-seongwoo',
      name: ['Storm Engineer Seongwoo', '폭풍 기술자 성우', 'ストーム技師・ソンウ'],
      line: [
        'Seongwoo: Dawn Rod carried the first strike. Let us test whether you can carry its current!',
        '성우: 새벽 피뢰침이 첫 낙뢰를 전달했군. 네가 그 전류를 감당할 수 있는지 시험하겠다!',
        'ソンウ：暁の避雷針が最初の雷を運んだ。その電流に耐えられるか試そう！',
      ],
      col: 15,
      row: 21.3,
      elevation: 0,
      pokemon: [{ id: 0, level: 51, custom: 'ureunggul' }, { id: 0, level: 52, custom: 'thunderon' }],
      expPool: 1300,
      defeated: false,
    },
    {
      key: 'sunrise-daehwi',
      name: ['Grid Engineer Daehwi', '전력망 기술자 대휘', '送電技師・デフィ'],
      line: [
        'Daehwi: Gale Rod found the upper circuit. Can your team keep pace with the surge?',
        '대휘: 질풍 피뢰침이 상층 회로를 찾았군. 네 팀도 이 급류를 따라올 수 있을까?',
        'デフィ：疾風の避雷針が上層回路を捉えた。お前のチームはこの奔流について来られるか？',
      ],
      col: 5,
      row: 13.2,
      elevation: 0.65,
      pokemon: [{ id: 0, level: 52, custom: 'wildcat' }, { id: 0, level: 53, custom: 'kingfisher' }],
      expPool: 1340,
      defeated: false,
    },
  ];

  constructor() { super('SunriseGymScene'); }

  create(): void {
    playBgm(this, 'gyminterior');
    this.cutsceneActive = false;
    this.exiting = false;
    this.calibrating = null;
    this.liftRun = null;
    this.hideLeadCompanion3D = false;
    this.stormElapsedMs = 0;
    this.warningCuePlayed = false;
    this.lightningActiveRod = null;
    this.rodGraphics.clear();
    this.receiverGraphics.clear();
    this.lightningGraphics.clear();
    this.padGraphics.clear();
    this.platforms = [];
    this.gates = [];
    this.input.keyboard?.resetKeys();
    reconcileStormCliffProgress(
      key => this.registry.get(key),
      (key, value) => this.registry.set(key, value),
    );
    this.trainers.forEach(trainer => {
      trainer.defeated = !!this.registry.get(`trainerDefeated_${trainer.key}`)
        || !!this.registry.get('sunriseGymDefeated');
    });

    this.px = 10 * IT;
    this.py = 26.5 * IT;
    const modernSave = !!this.registry.get('sunriseStormCliffVersion');
    const battleX = Number(this.registry.get('gymPosX'));
    const battleY = Number(this.registry.get('gymPosY'));
    const savedX = Number(this.registry.get('SunriseGymSceneReturnX'));
    const savedY = Number(this.registry.get('SunriseGymSceneReturnY'));
    if (modernSave && Number.isFinite(battleX) && Number.isFinite(battleY)) {
      this.px = battleX;
      this.py = battleY;
    } else if (Number.isFinite(savedX) && Number.isFinite(savedY)) {
      this.px = savedX;
      this.py = savedY;
    } else if (!modernSave && (Number.isFinite(battleX) || Number.isFinite(battleY))) {
      this.moveToSafeCheckpoint();
    }
    this.registry.remove('gymPosX');
    this.registry.remove('gymPosY');
    this.registry.remove('SunriseGymSceneReturnX');
    this.registry.remove('SunriseGymSceneReturnY');
    this.registry.set('sunriseStormCliffVersion', 1);
    this.sanitizeRestoredPosition();

    this.drawCliffShell();
    this.drawCliffPlatforms();
    this.drawLightningRods();
    this.drawReceiverBeacons();
    this.drawInsulatedPads();
    this.drawStormGates();
    this.drawElevator();
    this.drawTrainers();
    this.createPlayer();
    const leader = drawGymLeader(this, 10 * IT, 1.7 * IT, {
      body: 0x8a6a1a,
      accent: 0xffe044,
      label: t('LEADER BEONGE', '관장 번개', 'ジムリーダー・ポンゲ'),
      labelColor: '#fff0a0',
      hair: 0x3a2a10,
      trainerKey: 'sunrise-beonge',
    });
    leader.setData('characterElevation3D', 1.9);
    this.setupInput();
    this.createHud();
    this.cameras.main.setBounds(0, 0, this.W * IT, this.H * IT);
    this.cameras.main.startFollow(this.playerG, true, 0.12, 0.12);
    this.cameras.main.fadeIn(300);
    this.dialog = new DialogBox(this, 1280, 720);
    this.interactionReadyAt = this.time.now + 450;
    this.syncStormVisuals();

    if (this.registry.get('sunriseGymDefeated') && !this.registry.get('beongeFarewell')) {
      this.registry.set('beongeFarewell', true);
      this.showDialogue([
        t('Beonge: You turned the storm into a path. Take the Stormwatcher Badge.', '번개: 폭풍을 길로 바꾸었군. 폭풍관측배지를 받아라.', 'ポンゲ：嵐を道へ変えたな。嵐見バッジを受け取れ。'),
        t('Beonge: The sky over Baekdu has been charged for days. Whatever awaits there, meet it before the storm breaks.', '번개: 백두의 하늘이 며칠째 전하를 품고 있다. 폭풍이 터지기 전에 그곳에서 기다리는 것과 마주해라.', 'ポンゲ：白頭の空は何日も帯電している。嵐が裂ける前に、そこで待つものと向き合え。'),
      ]);
      return;
    }

    if (!this.registry.get('sunriseStormCliffIntroSeen')) {
      this.registry.set('sunriseStormCliffIntroSeen', true);
      this.showDialogue([
        t('You step onto the Stormwatcher Cliffs!', '폭풍관측 절벽에 들어섰다!', '嵐見の断崖へ足を踏み入れた！'),
        t('Calibrate each lightning rod, then reach its insulated pad before the strike lands.', '각 피뢰침을 조정한 뒤 낙뢰가 떨어지기 전에 절연 발판으로 대피하자.', '各避雷針を調整し、落雷前に絶縁パッドへ避難しよう。'),
        t('At a rod, press SPACE / A to calibrate. Use LEFT / RIGHT for direction and UP / DOWN for height.', '피뢰침 근처에서 SPACE / A로 조정 모드에 들어간다. 좌우로 방향을, 상하로 높이를 바꾼다.', '避雷針の近くでSPACE / Aを押して調整。左右で方向、上下で高さを変える。'),
        t('A correct, safely received strike extends the bridge to the next cliff. Two engineers guard the upper circuits.', '올바른 설정의 낙뢰를 안전하게 받아내면 다음 절벽으로 이어지는 다리가 펼쳐진다. 상층 회로는 두 기술자가 지키고 있다.', '正しく安全に受雷すると次の断崖への橋が伸びる。上層回路は二人の技師が守っている。'),
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

  private drawCliffShell(): void {
    const width = this.W * IT;
    const height = this.H * IT;
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x050914); g.fillRect(0, 0, width, height);
    g.fillStyle(0x101b31);
    g.fillRect(IT, 20 * IT, 18 * IT, 7 * IT);
    g.fillStyle(0x15243d);
    g.fillRect(IT, 12 * IT, 18 * IT, 7 * IT);
    g.fillStyle(0x1a2c49);
    g.fillRect(IT, 4 * IT, 18 * IT, 7 * IT);
    g.fillStyle(0x263e60);
    g.fillRoundedRect(5 * IT, IT, 10 * IT, 2 * IT, 10);
    for (const section of [{ min: 20, max: 27 }, { min: 12, max: 19 }, { min: 4, max: 11 }]) {
      for (let row = section.min; row < section.max; row++) {
        for (let col = 1; col < this.W - 1; col++) {
          g.fillStyle((row + col) % 2 ? 0x26364d : 0x2c3e57);
          g.fillRect(col * IT + 2, row * IT + 2, IT - 4, IT - 4);
          g.fillStyle(0x58738a, 0.35); g.fillRect(col * IT + 7, row * IT + 7, 14, 2);
        }
      }
    }
    g.fillStyle(0x0b1120);
    g.fillRect(0, 0, width, IT);
    g.fillRect(0, 0, IT, height);
    g.fillRect(width - IT, 0, IT, height);
    g.fillRect(0, 27 * IT, width, IT);
    g.fillStyle(0x765038); g.fillRect(9 * IT, 27 * IT, 2 * IT, IT);
    g.lineStyle(3, 0xffd34d); g.strokeRoundedRect(5 * IT, IT, 10 * IT, 2 * IT, 10);
    const textureKey = '__sunriseStormCliffMap__';
    if (this.textures.exists(textureKey)) this.textures.remove(textureKey);
    g.generateTexture(textureKey, width, height);
    g.destroy();
    this.add.image(0, 0, textureKey).setOrigin(0).setDepth(0);
    this.add.text(width / 2, 1.45 * IT, t('STORMWATCHER SUMMIT', '폭풍관측 정상', '嵐見の頂'), {
      fontSize: '13px', color: '#fff2a0', fontStyle: 'bold', stroke: '#09111f', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(6);
  }

  private drawCliffPlatforms(): void {
    const specs = [
      { y: 23.5, depth: 7, elevation: 0, accent: 0xffd34d, label: t('DAWN DECK', '새벽 데크', '暁デッキ') },
      { y: 15.5, depth: 7, elevation: 0.65, accent: 0x68dcff, label: t('GALE DECK', '질풍 데크', '疾風デッキ') },
      { y: 7.5, depth: 7, elevation: 1.3, accent: 0xd29aff, label: t('ZENITH DECK', '천정 데크', '天頂デッキ') },
      { y: 2, depth: 2, elevation: 1.9, accent: 0xffe044, label: '' },
    ];
    for (const spec of specs) {
      const platform = this.add.graphics().setDepth(2).setPosition(10 * IT, spec.y * IT);
      platform.fillStyle(0x33475f, 0.88);
      platform.fillRoundedRect(-9 * IT, -spec.depth * IT / 2, 18 * IT, spec.depth * IT, 12);
      platform.lineStyle(3, spec.accent, 0.72);
      platform.strokeRoundedRect(-8.8 * IT, -spec.depth * IT / 2 + 5, 17.6 * IT, spec.depth * IT - 10, 10);
      platform.setData('stormCliffProp3D', { kind: 'platform', width: 20.25, depth: spec.depth * IT / 32, accent: spec.accent });
      platform.setData('stormBaseElevation3D', spec.elevation);
      platform.setData('stormCue3D', 0);
      this.platforms.push(platform);
      if (spec.label) {
        this.add.text(10 * IT, (spec.y - spec.depth / 2 + 0.55) * IT, spec.label, {
          fontSize: '10px', color: '#eaf8ff', fontStyle: 'bold', backgroundColor: '#07101dcc', padding: { x: 6, y: 2 },
        }).setOrigin(0.5).setDepth(6);
      }
    }
  }

  private drawLightningRods(): void {
    for (const rod of STORM_RODS) {
      const elevation = this.rodBaseElevation(rod);
      const graphic = this.add.graphics().setDepth(10).setPosition(rod.col * IT, rod.row * IT);
      graphic.setData('stormCliffProp3D', { kind: 'rod', width: 1.5, depth: 1.5, accent: rod.accent });
      graphic.setData('stormBaseElevation3D', elevation);
      this.rodGraphics.set(rod.id, graphic);
      const lightning = this.add.graphics().setDepth(13).setPosition(rod.col * IT, rod.row * IT);
      lightning.setData('stormCliffProp3D', { kind: 'lightning', width: 3.2, depth: 2.2, accent: rod.accent });
      lightning.setData('stormBaseElevation3D', elevation);
      this.lightningGraphics.set(rod.id, lightning);
      this.add.text(rod.col * IT, rod.row * IT - 39, this.rodName(rod), {
        fontSize: '9px', color: '#fff5b4', backgroundColor: '#07101dcc', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(14).setData('characterLabelTarget3D', graphic);
    }
  }

  private drawInsulatedPads(): void {
    for (const pad of STORM_INSULATED_PADS) {
      const rod = STORM_RODS.find(entry => entry.id === pad.rodId)!;
      const graphic = this.add.graphics().setDepth(8).setPosition(pad.col * IT, pad.row * IT);
      graphic.fillStyle(0x1c222a); graphic.fillCircle(0, 0, 25);
      graphic.lineStyle(6, 0xf2c94c); graphic.strokeCircle(0, 0, 22);
      graphic.fillStyle(0x83ebff, 0.35); graphic.fillCircle(0, 0, 15);
      graphic.setData('stormCliffProp3D', { kind: 'insulated-pad', width: 1.7, depth: 1.7, accent: rod.accent });
      graphic.setData('stormBaseElevation3D', this.rodBaseElevation(rod));
      this.padGraphics.set(rod.id, graphic);
    }
  }

  private drawReceiverBeacons(): void {
    const vectors: Record<StormDirection, [number, number]> = {
      0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0],
    };
    for (const rod of STORM_RODS) {
      const [dx, dy] = vectors[rod.targetDirection];
      const col = rod.col + dx * 3;
      const row = rod.row + dy * 2.5;
      const graphic = this.add.graphics().setDepth(9).setPosition(col * IT, row * IT);
      graphic.fillStyle(0x33485b); graphic.fillRoundedRect(-15, -11, 30, 24, 5);
      graphic.lineStyle(3, rod.accent); graphic.strokeRoundedRect(-15, -11, 30, 24, 5);
      graphic.lineStyle(4, 0xc9dce5); graphic.lineBetween(0, 8, 0, rod.targetHeight ? -31 : -20);
      graphic.fillStyle(rod.accent); graphic.fillCircle(0, rod.targetHeight ? -33 : -22, 6);
      graphic.setData('stormCliffProp3D', { kind: 'receiver', width: 1.2, depth: 1.2, accent: rod.accent });
      graphic.setData('stormBaseElevation3D', this.rodBaseElevation(rod));
      graphic.setData('stormDirection3D', rod.targetDirection);
      graphic.setData('stormHeight3D', rod.targetHeight);
      this.receiverGraphics.set(rod.id, graphic);
      this.add.text(col * IT, row * IT + 23, t(
        `RECEIVER · ${rod.targetHeight ? 'HIGH' : 'LOW'}`,
        `수신기 · ${rod.targetHeight ? '높게' : '낮게'}`,
        `受電器・${rod.targetHeight ? '高' : '低'}`,
      ), {
        fontSize: '8px', color: '#eaf9ff', backgroundColor: '#07101dcc', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(10).setData('characterLabelTarget3D', graphic);
    }
  }

  private drawStormGates(): void {
    const specs: Omit<StormGate, 'graphic'>[] = [
      { id: 'dawn-bridge', row: 19.5, elevation: 0.325 },
      { id: 'gale-bridge', row: 11.5, elevation: 0.975 },
      { id: 'summit-gate', row: 3.5, elevation: 1.6 },
    ];
    for (const spec of specs) {
      const graphic = this.add.graphics().setDepth(9).setPosition(10 * IT, spec.row * IT);
      graphic.setData('stormCliffProp3D', { kind: 'gate', width: 3.2, depth: 2, accent: spec.id === 'summit-gate' ? 0xffe044 : 0x63d9ff });
      graphic.setData('stormBaseElevation3D', spec.elevation);
      this.gates.push({ ...spec, graphic });
    }
  }

  private drawElevator(): void {
    this.elevatorG = this.add.graphics().setDepth(10).setPosition(10 * IT, 4.5 * IT);
    this.elevatorG.fillStyle(0x435b72); this.elevatorG.fillCircle(0, 0, 31);
    this.elevatorG.lineStyle(5, 0xffdc58); this.elevatorG.strokeCircle(0, 0, 27);
    this.elevatorG.fillStyle(0x9eefff, 0.5); this.elevatorG.fillCircle(0, 0, 16);
    this.elevatorG.setData('stormCliffProp3D', { kind: 'elevator', width: 2.7, depth: 2.7, accent: 0xffdc58 });
    this.elevatorG.setData('stormBaseElevation3D', 1.3);
  }

  private drawTrainers(): void {
    for (const trainer of this.trainers) {
      if (trainer.defeated && vanishesAfterDefeat(trainer.key)) continue;
      const x = trainer.col * IT;
      const y = trainer.row * IT;
      const g = this.add.graphics().setDepth(11).setPosition(x, y);
      g.fillStyle(0x000000, 0.25); g.fillEllipse(0, 13, 18, 5);
      g.fillStyle(0xe0b82f); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x303742); g.fillRect(-7, -6, 14, 4); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcda4); g.fillRect(-6, -20, 12, 11);
      g.fillStyle(0x34260f); g.fillRect(-7, -21, 14, 5);
      g.fillStyle(0x080b0e); g.fillRect(-3, -14, 2, 2); g.fillRect(1, -14, 2, 2);
      g.setData('characterElevation3D', trainer.elevation);
      this.add.text(x, y - 29, trainer.key === 'sunrise-seongwoo' ? t('Seongwoo', '성우', 'ソンウ') : t('Daehwi', '대휘', 'デフィ'), {
        fontSize: '8px', color: '#fff1a1', backgroundColor: '#080d18cc', padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(12).setData('characterLabelTarget3D', g);
    }
  }

  private createPlayer(): void {
    this.playerG = this.add.graphics().setDepth(20);
    this.redrawPlayer();
  }

  private redrawPlayer(): void {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
    if (!this.liftRun) this.playerG.setData('characterElevation3D', this.elevationForRow(this.py / IT));
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
      if (!this.cutsceneActive && !this.calibrating && !this.liftRun) this.scene.launch('MenuScene');
    });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => {
      if (!this.cutsceneActive && !this.calibrating && !this.liftRun) this.scene.launch('MenuScene');
    });
    window.addEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
      this.hideLeadCompanion3D = false;
    });
  }

  private createHud(): void {
    const statusPanel = this.add.rectangle(640, 42, 520, 48, 0x080e1d, 0.92)
      .setStrokeStyle(2, 0xffdf5b).setScrollFactor(0);
    this.statusText = this.add.text(640, 42, '', {
      fontSize: '14px', color: '#fff5b5', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0);
    this.add.container(0, 0, [statusPanel, this.statusText]).setDepth(1000).setScrollFactor(0);

    const panel = this.add.rectangle(640, 109, 570, 112, 0x07101f, 0.95)
      .setStrokeStyle(2, 0x71ddff).setScrollFactor(0);
    this.stormTitle = this.add.text(640, 72, '', {
      fontSize: '17px', color: '#ffffff', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0);
    this.stormGauge = this.add.graphics().setScrollFactor(0);
    this.stormDetail = this.add.text(640, 142, '', {
      fontSize: '12px', color: '#c8efff', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0);
    this.stormPanel = this.add.container(0, 0, [panel, this.stormTitle, this.stormGauge, this.stormDetail])
      .setDepth(1001).setScrollFactor(0).setVisible(false);

    this.promptText = this.add.text(640, 650, '', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#07101fe8',
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
    if (this.liftRun) {
      this.updateElevator(delta);
      return;
    }
    if (this.calibrating) {
      this.updateCalibration(actionPressed, leftPressed, rightPressed, upPressed, downPressed);
      if (!this.cutsceneActive) this.updateStorm(delta);
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
      if (this.walkTimer > 155) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else {
      this.walkFrame = 0;
    }
    this.redrawPlayer();
    this.checkTrainerProgress();
    if (this.cutsceneActive) return;
    this.updateInteractionPrompt(actionPressed);
    if (this.cutsceneActive || this.liftRun) return;
    this.checkLeaderApproach();
    this.checkExit();
    if (!this.cutsceneActive && !this.exiting) this.updateStorm(delta);
  }

  private updateCalibration(
    actionPressed: boolean,
    leftPressed: boolean,
    rightPressed: boolean,
    upPressed: boolean,
    downPressed: boolean,
  ): void {
    const rod = this.calibrating;
    if (!rod) return;
    if (actionPressed && this.time.now >= this.interactionReadyAt) {
      this.calibrating = null;
      this.interactionReadyAt = this.time.now + 220;
      this.promptText.setText(t('Calibration locked. Reach the insulated pad before the strike!', '조정을 고정했다. 낙뢰 전에 절연 발판으로 이동하자!', '調整を固定した。落雷前に絶縁パッドへ移動しよう！')).setVisible(true);
      sfxConfirm(this);
      this.syncStormVisuals();
      return;
    }
    let changed = false;
    let direction = stormRodDirection(rod, key => this.registry.get(key));
    let height = stormRodHeight(rod, key => this.registry.get(key));
    if (leftPressed !== rightPressed) {
      direction = normalizeStormDirection(direction + (leftPressed ? -1 : 1));
      this.registry.set(stormDirectionKey(rod), direction);
      changed = true;
    }
    if (upPressed !== downPressed) {
      height = upPressed ? 1 : 0;
      this.registry.set(stormHeightKey(rod), height);
      changed = true;
    }
    if (changed) {
      sfxMove(this);
      this.cameras.main.shake(55, 0.0015);
      this.syncStormVisuals();
    }
    this.promptText.setText(t(
      `CALIBRATE · ${this.directionName(direction)} · ${height ? 'HIGH' : 'LOW'} · A: Lock`,
      `조정 중 · ${this.directionName(direction)} · ${height ? '높게' : '낮게'} · A: 고정`,
      `調整中・${this.directionName(direction)}・${height ? '高' : '低'}・A：固定`,
    )).setVisible(true);
  }

  private updateInteractionPrompt(actionPressed: boolean): void {
    const rod = activeStormRod(key => this.registry.get(key));
    if (rod && this.near(rod.col, rod.row, 1.45)) {
      this.promptText.setText(t(
        `[SPACE / A] Calibrate ${this.rodName(rod)}`,
        `[SPACE / A] ${this.rodName(rod)} 조정`,
        `[SPACE / A] ${this.rodName(rod)}を調整`,
      )).setVisible(true);
      if (actionPressed && this.time.now >= this.interactionReadyAt) {
        this.calibrating = rod;
        this.interactionReadyAt = this.time.now + 220;
        sfxConfirm(this);
        this.syncStormVisuals();
      }
      return;
    }
    if (this.elevatorReady() && this.near(10, 4.5, 1.45)) {
      this.promptText.setText(t('[SPACE / A] Ride the lightning elevator', '[SPACE / A] 번개 승강기 타기', '[SPACE / A] 雷エレベーターに乗る')).setVisible(true);
      if (actionPressed && this.time.now >= this.interactionReadyAt) this.beginElevator();
      return;
    }
    this.promptText.setVisible(false);
  }

  private updateStorm(delta: number): void {
    const rod = activeStormRod(key => this.registry.get(key));
    if (!rod) {
      this.stormPanel.setVisible(false);
      this.setWarningCues(undefined, 0);
      return;
    }
    const playerRow = this.py / IT;
    if (playerRow < rod.deckMinRow || playerRow > rod.deckMaxRow) {
      // Each upper deck starts with a full warning window. Battle returns and
      // bridge traversal can never drop the player into an unavoidable strike.
      this.stormElapsedMs = 0;
      this.warningCuePlayed = false;
      this.stormPanel.setVisible(false);
      this.setWarningCues(rod, 0);
      return;
    }
    const previous = this.stormElapsedMs;
    this.stormElapsedMs += Math.min(delta, 48);
    if (this.stormElapsedMs >= STORM_CYCLE_MS) {
      this.stormElapsedMs %= STORM_CYCLE_MS;
      this.warningCuePlayed = false;
    }
    const warning = Phaser.Math.Clamp((this.stormElapsedMs - 4100) / (STORM_STRIKE_AT_MS - 4100), 0, 1);
    this.setWarningCues(rod, warning);
    if (!this.warningCuePlayed && this.stormElapsedMs >= 5100) {
      this.warningCuePlayed = true;
      sfxMove(this);
    }
    if (previous < STORM_STRIKE_AT_MS && this.stormElapsedMs >= STORM_STRIKE_AT_MS) this.performStormStrike(rod);
    this.updateStormHud(rod);
  }

  private performStormStrike(rod: StormRodDef): void {
    this.lightningActiveRod = rod.id;
    this.calibrating = null;
    this.syncStormVisuals();
    this.drawLightningFallback(rod, true);
    this.cameras.main.flash(170, 220, 240, 255, false);
    this.cameras.main.shake(360, 0.014);
    const row = this.py / IT;
    const onActiveDeck = row >= rod.deckMinRow && row <= rod.deckMaxRow;
    if (!onActiveDeck) {
      this.time.delayedCall(360, () => { this.lightningActiveRod = null; this.syncStormVisuals(); });
      return;
    }
    const safe = isStandingOnInsulatedPad(rod, this.px / IT, this.py / IT);
    const result = resolveStormStrike(rod, safe, key => this.registry.get(key));
    if (result === 'charged') {
      this.registry.set(stormDirectionKey(rod), rod.targetDirection);
      this.registry.set(stormHeightKey(rod), rod.targetHeight);
      this.registry.set(stormChargedFlag(rod), true);
      this.registry.set('sunriseStormCheckpoint', rod.index + 1);
      this.registry.set('SunriseGymSceneReturnX', this.px);
      this.registry.set('SunriseGymSceneReturnY', this.py);
      SaveManager.autoSave(this.registry, this.px, this.py, 'SunriseGymScene');
      sfxConfirm(this);
      this.showDialogue([
        t(
          `${this.rodName(rod)} captured the strike and chained it into the upper circuit!`,
          `${this.rodName(rod)}이 낙뢰를 받아 상층 회로로 연쇄 전달했다!`,
          `${this.rodName(rod)}が落雷を捉え、上層回路へ連鎖送電した！`,
        ),
        rod.index < 2
          ? t('The deck engineer is ready, and the next bridge can now be powered.', '데크 기술자가 승부를 준비했고 다음 다리에 전력을 공급할 수 있게 되었다.', 'デッキ技師が勝負を待ち、次の橋へ送電できるようになった。')
          : t('All three rods resonate. The lightning elevator is online!', '세 피뢰침이 공명한다. 번개 승강기가 가동되었다!', '三本の避雷針が共鳴した。雷エレベーターが起動した！'),
      ]);
    } else if (result === 'misaligned') {
      sfxCancel(this);
      this.showDialogue([
        t('The rod grounded the bolt, but its direction or height missed the receiver.', '피뢰침이 낙뢰를 접지했지만 방향이나 높이가 수신기와 맞지 않았다.', '避雷針は雷を接地したが、方向か高さが受電器と合っていない。'),
        t('Recalibrate it before the next strike.', '다음 낙뢰 전에 다시 조정하자.', '次の落雷前に再調整しよう。'),
      ]);
    } else {
      sfxCancel(this);
      const pad = stormPadForRod(rod);
      this.px = 10 * IT;
      this.py = (rod.deckMaxRow - 0.65) * IT;
      this.redrawPlayer();
      this.showDialogue([
        t('The deck discharged through you! The safety relay returned you to the checkpoint.', '데크의 전류가 몸을 통과했다! 안전 계전기가 체크포인트로 되돌렸다.', 'デッキの電流が体を走った！安全リレーでチェックポイントへ戻された。'),
        t(
          `Stand on the insulated pad at (${pad.col}, ${pad.row}) when the countdown reaches zero.`,
          `카운트다운이 0이 될 때 (${pad.col}, ${pad.row})의 절연 발판 위에 서 있어야 한다.`,
          `カウントが0になる時、(${pad.col}, ${pad.row})の絶縁パッドに立とう。`,
        ),
      ]);
    }
    this.syncStormVisuals();
    this.time.delayedCall(360, () => {
      this.lightningActiveRod = null;
      this.syncStormVisuals();
    });
  }

  private beginElevator(): void {
    this.liftRun = { elapsedMs: 0, fromX: this.px, fromY: this.py };
    this.hideLeadCompanion3D = true;
    this.promptText.setVisible(false);
    this.elevatorG.setData('stormActive3D', 1);
    sfxConfirm(this);
  }

  private updateElevator(delta: number): void {
    const lift = this.liftRun;
    if (!lift) return;
    lift.elapsedMs += Math.min(delta, 48);
    const progress = Phaser.Math.Clamp(lift.elapsedMs / 1800, 0, 1);
    const eased = Phaser.Math.Easing.Sine.InOut(progress);
    this.px = Phaser.Math.Linear(lift.fromX, 10 * IT, eased);
    this.py = Phaser.Math.Linear(lift.fromY, 2.85 * IT, eased);
    this.playerG.setData('characterElevation3D', Phaser.Math.Linear(1.3, 1.9, eased));
    this.elevatorG.setData('stormHeight3D', eased);
    this.elevatorG.setData('stormCue3D', 1);
    this.walkFrame = Math.floor(lift.elapsedMs / 120) % 2;
    this.redrawPlayer();
    if (progress < 1) return;
    this.liftRun = null;
    this.hideLeadCompanion3D = false;
    this.registry.set('sunriseStormElevatorRaised', true);
    this.registry.set('SunriseGymSceneReturnX', this.px);
    this.registry.set('SunriseGymSceneReturnY', this.py);
    this.elevatorG.setData('stormActive3D', 0).setData('stormHeight3D', 1).setData('stormCharged3D', 1);
    SaveManager.autoSave(this.registry, this.px, this.py, 'SunriseGymScene');
    this.syncStormVisuals();
    this.redrawPlayer();
    this.showDialogue([
      t('The lightning elevator rises through the charged cloud layer!', '번개 승강기가 전하를 머금은 구름층을 뚫고 상승했다!', '雷エレベーターが帯電した雲層を突き抜けて上昇した！'),
      t('Leader Beonge waits on the storm summit.', '폭풍 정상에서 관장 번개가 기다리고 있다.', '嵐の頂でジムリーダー・ポンゲが待っている。'),
    ]);
  }

  private updateStormHud(rod: StormRodDef): void {
    this.stormPanel.setVisible(true);
    const striking = this.stormElapsedMs >= STORM_STRIKE_AT_MS && this.stormElapsedMs < STORM_STRIKE_END_MS;
    const remaining = Math.max(0, STORM_STRIKE_AT_MS - this.stormElapsedMs);
    const progress = Phaser.Math.Clamp(this.stormElapsedMs / STORM_STRIKE_AT_MS, 0, 1);
    this.stormTitle.setText(striking
      ? t('⚡ LIGHTNING STRIKE', '⚡ 낙뢰 발생', '⚡ 落雷')
      : t(`NEXT STRIKE · ${(remaining / 1000).toFixed(1)}s`, `다음 낙뢰 · ${(remaining / 1000).toFixed(1)}초`, `次の落雷・${(remaining / 1000).toFixed(1)}秒`));
    this.stormGauge.clear();
    this.stormGauge.fillStyle(0x17263c); this.stormGauge.fillRoundedRect(490, 99, 300, 18, 7);
    this.stormGauge.fillStyle(progress < 0.6 ? 0x4aa3d8 : progress < 0.88 ? 0xf0c34e : 0xff5968);
    this.stormGauge.fillRoundedRect(490, 99, 300 * progress, 18, 7);
    this.stormGauge.lineStyle(2, 0xffffff); this.stormGauge.strokeRoundedRect(490, 99, 300, 18, 7);
    const configured = stormRodConfigured(rod, key => this.registry.get(key));
    const onPad = isStandingOnInsulatedPad(rod, this.px / IT, this.py / IT);
    this.stormDetail.setText(t(
      `${this.rodName(rod)} · ${configured ? 'RECEIVER ALIGNED' : 'CALIBRATION REQUIRED'} · ${onPad ? 'INSULATED' : 'EXPOSED'}`,
      `${this.rodName(rod)} · ${configured ? '수신기 정렬 완료' : '조정 필요'} · ${onPad ? '절연 상태' : '노출 상태'}`,
      `${this.rodName(rod)}・${configured ? '受電器整列済み' : '調整が必要'}・${onPad ? '絶縁中' : '露出中'}`,
    ));
  }

  private setWarningCues(activeRod?: StormRodDef, cue = 0): void {
    for (const rod of STORM_RODS) {
      this.rodGraphics.get(rod.id)?.setData('stormCue3D', activeRod?.id === rod.id ? cue : 0);
      this.padGraphics.get(rod.id)?.setData('stormCue3D', activeRod?.id === rod.id ? cue : 0);
    }
    for (const platform of this.platforms) platform.setData('stormCue3D', cue);
  }

  private syncStormVisuals(): void {
    const active = activeStormRod(key => this.registry.get(key));
    for (const rod of STORM_RODS) {
      const direction = stormRodDirection(rod, key => this.registry.get(key));
      const height = stormRodHeight(rod, key => this.registry.get(key));
      const charged = stormRodCharged(rod, key => this.registry.get(key));
      const graphic = this.rodGraphics.get(rod.id);
      if (graphic) {
        graphic.setData('stormDirection3D', direction);
        graphic.setData('stormHeight3D', height);
        graphic.setData('stormCharged3D', charged ? 1 : 0);
        graphic.setData('stormActive3D', active?.id === rod.id || this.calibrating?.id === rod.id ? 1 : 0);
        this.drawRodFallback(graphic, rod, direction, height, charged);
      }
      const lightning = this.lightningGraphics.get(rod.id);
      if (lightning) {
        lightning.setData('stormDirection3D', direction);
        lightning.setData('stormHeight3D', height);
        lightning.setData('stormCharged3D', charged ? 1 : 0);
        lightning.setData('stormActive3D', this.lightningActiveRod === rod.id ? 1 : 0);
        if (this.lightningActiveRod !== rod.id) this.drawLightningFallback(rod, false);
      }
      const receiver = this.receiverGraphics.get(rod.id);
      receiver?.setData('stormCharged3D', charged ? 1 : 0);
      receiver?.setData('stormActive3D', active?.id === rod.id ? 1 : 0);
    }
    for (const gate of this.gates) {
      const open = this.gateOpen(gate.id);
      gate.graphic.setData('stormCharged3D', open ? 1 : 0);
      this.drawGateFallback(gate, open);
    }
    const raised = !!this.registry.get('sunriseStormElevatorRaised');
    this.elevatorG?.setData('stormCharged3D', this.elevatorReady() || raised ? 1 : 0);
    if (!this.liftRun) this.elevatorG?.setData('stormHeight3D', raised ? 1 : 0);
    this.updateStatusHud();
  }

  private drawRodFallback(
    graphic: Phaser.GameObjects.Graphics,
    rod: StormRodDef,
    direction: StormDirection,
    height: number,
    charged: boolean,
  ): void {
    graphic.clear();
    graphic.fillStyle(0x283544); graphic.fillCircle(0, 8, 22);
    graphic.lineStyle(5, charged ? 0x76ffb2 : rod.accent); graphic.strokeCircle(0, 8, 19);
    graphic.lineStyle(5, 0xc0d4df); graphic.lineBetween(0, 8, 0, height ? -38 : -25);
    const vectors: Record<StormDirection, [number, number]> = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };
    const [dx, dy] = vectors[direction];
    const topY = height ? -38 : -25;
    graphic.lineStyle(5, charged ? 0x76ffb2 : 0xffef91);
    graphic.lineBetween(0, topY, dx * 25, topY + dy * 25);
    graphic.fillStyle(charged ? 0x76ffb2 : 0xffffff); graphic.fillCircle(dx * 25, topY + dy * 25, 5);
  }

  private drawLightningFallback(rod: StormRodDef, active: boolean): void {
    const graphic = this.lightningGraphics.get(rod.id);
    if (!graphic) return;
    graphic.clear();
    if (!active) return;
    graphic.lineStyle(6, 0xffffff, 1);
    graphic.beginPath();
    graphic.moveTo(8, -250); graphic.lineTo(-12, -205); graphic.lineTo(10, -165);
    graphic.lineTo(-8, -118); graphic.lineTo(6, -78); graphic.lineTo(0, -30);
    graphic.strokePath();
    graphic.lineStyle(2, rod.accent, 0.9);
    graphic.lineBetween(-8, -118, -42, -88);
    graphic.lineBetween(10, -165, 45, -140);
  }

  private drawGateFallback(gate: StormGate, open: boolean): void {
    const graphic = gate.graphic;
    graphic.clear();
    graphic.fillStyle(0x405b72); graphic.fillRect(-1.55 * IT, -18, 9, 36); graphic.fillRect(1.55 * IT - 9, -18, 9, 36);
    if (open) {
      graphic.fillStyle(0x4e7188); graphic.fillRoundedRect(-1.45 * IT, -0.5 * IT, 2.9 * IT, IT, 7);
      graphic.lineStyle(3, 0x72ffbc); graphic.lineBetween(-1.35 * IT, 0, 1.35 * IT, 0);
    } else {
      graphic.fillStyle(0x62d8ff, 0.72); graphic.fillRect(-1.45 * IT, -6, 2.9 * IT, 12);
    }
  }

  private checkTrainerProgress(): void {
    for (const trainer of this.trainers) {
      if (!trainer.defeated && this.registry.get(`trainerDefeated_${trainer.key}`)) trainer.defeated = true;
    }
    for (const trainer of this.trainers) {
      if (trainer.defeated) continue;
      const requiredRod = trainer.key === 'sunrise-seongwoo' ? STORM_RODS[0] : STORM_RODS[1];
      if (!stormRodCharged(requiredRod, key => this.registry.get(key))) continue;
      if (!this.near(trainer.col, trainer.row, 1.3)) continue;
      this.showDialogue([t(...trainer.line), t(
        `${trainer.name[0]}: Full current — battle!`,
        `${trainer.name[1]}: 전류 최대 출력, 배틀 시작!`,
        `${trainer.name[2]}：最大出力、バトル開始！`,
      )], () => this.startTrainerBattle(trainer));
      return;
    }
  }

  private startTrainerBattle(trainer: GymTrainer): void {
    this.registry.set('trainerName', t(...trainer.name));
    this.registry.set('trainerKey', trainer.key);
    this.registry.set('trainerPokemon', JSON.stringify(trainer.pokemon));
    this.registry.set('trainerExpPool', trainer.expPool);
    this.registry.set('trainerReturnScene', 'SunriseGymScene');
    this.registry.set('gymPosX', this.px);
    this.registry.set('gymPosY', this.py);
    this.exiting = true;
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
  }

  private checkLeaderApproach(): void {
    if (this.registry.get('sunriseGymDefeated') || this.cutsceneActive) return;
    const ready = stormCliffComplete(key => this.registry.get(key))
      && this.trainers.every(trainer => trainer.defeated || this.registry.get(`trainerDefeated_${trainer.key}`))
      && !!this.registry.get('sunriseStormElevatorRaised');
    if (!ready || this.py >= 2.7 * IT) return;
    this.showDialogue([
      t('(Beonge stands between the summit lightning rods as charged clouds turn gold with sunrise.)', '(관장 번개가 정상의 피뢰침 사이에 서자 전하를 품은 구름이 일출빛으로 금색으로 물든다.)', '（頂の避雷針の間にポンゲが立つと、帯電した雲が朝日に金色へ染まる。）'),
      t('Beonge: Direction, height, timing and nerve. You mastered every law of this storm.', '번개: 방향, 높이, 타이밍, 그리고 담력. 이 폭풍의 모든 법칙을 익혔군.', 'ポンゲ：方向、高さ、タイミング、そして度胸。この嵐の法則をすべて極めたな。'),
      t('Beonge: Electricity is the instant the sky decides to strike. Show me that instant in battle!', '번개: 전기란 하늘이 내리치기로 결심하는 바로 그 순간이다. 배틀에서 그 순간을 보여라!', 'ポンゲ：電気とは、空が撃つと決めるその瞬間だ。バトルでその瞬間を見せろ！'),
    ], () => this.startLeaderBattle());
  }

  private startLeaderBattle(): void {
    this.registry.set('trainerName', t('Leader Beonge', '관장 번개', 'ジムリーダー・ポンゲ'));
    this.registry.set('trainerKey', 'sunrise-beonge');
    this.registry.set('trainerPokemon', JSON.stringify([
      { id: 0, level: 53, custom: 'metdoyaroe' },
      { id: 0, level: 53, custom: 'ampere' },
      { id: 0, level: 54, custom: 'waterdeer' },
      { id: 0, level: 54, custom: 'bonejoillion' },
      { id: 479, level: 56 },
    ]));
    this.registry.set('trainerExpPool', 2400);
    this.registry.set('trainerReturnScene', 'SunriseGymScene');
    this.registry.set('gymPosX', this.px);
    this.registry.set('gymPosY', this.py);
    this.registry.set('trainerBadgeFlag', 'sunriseGymDefeated');
    this.registry.set('trainerBadgeName', t('Stormwatcher Badge', '폭풍관측배지', '嵐見バッジ'));
    this.registry.set('trainerBadgeTM', 'Thunderbolt');
    this.registry.set('trainerWinLine', t(
      'Beonge: Perfect timing. The sky is yours.',
      '번개: 완벽한 타이밍이다. 이제 하늘은 네 것이다.',
      'ポンゲ：完璧なタイミングだ。空はお前のものだ。',
    ));
    this.exiting = true;
    this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
  }

  private collides(x: number, y: number): boolean {
    if (x < IT * 1.05 || x > (this.W - 1.05) * IT || y < IT * 1.02 || y > (this.H - 1.02) * IT) return true;
    const col = x / IT;
    const row = y / IT;
    if (row >= 19 && row <= 20) return !this.gateOpen('dawn-bridge') || col < 8.55 || col > 11.45;
    if (row >= 11 && row <= 12) return !this.gateOpen('gale-bridge') || col < 8.55 || col > 11.45;
    if (row >= 3 && row <= 4) return !this.gateOpen('summit-gate') || col < 8.55 || col > 11.45;
    return false;
  }

  private gateOpen(id: StormGate['id']): boolean {
    if (this.registry.get('sunriseGymDefeated')) return true;
    if (id === 'dawn-bridge') return stormRodCharged(STORM_RODS[0], key => this.registry.get(key))
      && !!this.registry.get('trainerDefeated_sunrise-seongwoo');
    if (id === 'gale-bridge') return stormRodCharged(STORM_RODS[1], key => this.registry.get(key))
      && !!this.registry.get('trainerDefeated_sunrise-daehwi');
    return !!this.registry.get('sunriseStormElevatorRaised');
  }

  private elevatorReady(): boolean {
    return stormCliffComplete(key => this.registry.get(key))
      && this.trainers.every(trainer => trainer.defeated || this.registry.get(`trainerDefeated_${trainer.key}`))
      && !this.registry.get('sunriseStormElevatorRaised');
  }

  private updateStatusHud(): void {
    if (!this.statusText) return;
    const rods = stormCliffChargedCount(key => this.registry.get(key));
    const engineers = this.trainers.filter(trainer => trainer.defeated
      || this.registry.get(`trainerDefeated_${trainer.key}`)).length;
    this.statusText.setText(t(
      `STORMWATCHER CLIFFS · RODS ${rods}/3 · ENGINEERS ${engineers}/2`,
      `폭풍관측 절벽 · 피뢰침 ${rods}/3 · 기술자 ${engineers}/2`,
      `嵐見の断崖・避雷針 ${rods}/3・技師 ${engineers}/2`,
    ));
  }

  private sanitizeRestoredPosition(): void {
    const col = this.px / IT;
    const row = this.py / IT;
    const invalid = col < 1.1 || col > this.W - 1.1 || row < 1.05 || row > this.H - 1.05
      || (row >= 19 && row <= 20) || (row >= 11 && row <= 12) || (row >= 3 && row <= 4);
    const bypassedDawn = row < 20 && !this.gateOpen('dawn-bridge');
    const bypassedGale = row < 12 && !this.gateOpen('gale-bridge');
    const bypassedSummit = row < 4 && !this.gateOpen('summit-gate');
    if (invalid || bypassedDawn || bypassedGale || bypassedSummit) this.moveToSafeCheckpoint();
  }

  private moveToSafeCheckpoint(): void {
    if (this.registry.get('sunriseStormElevatorRaised')) {
      this.px = 10 * IT; this.py = 2.85 * IT;
    } else if (this.registry.get('trainerDefeated_sunrise-daehwi')) {
      this.px = 10 * IT; this.py = 10.4 * IT;
    } else if (this.registry.get('trainerDefeated_sunrise-seongwoo')) {
      this.px = 10 * IT; this.py = 18.4 * IT;
    } else {
      this.px = 10 * IT; this.py = 26.5 * IT;
    }
  }

  private checkExit(): void {
    if (this.py <= 26.85 * IT || this.px <= 8.5 * IT || this.px >= 11.5 * IT) return;
    this.exiting = true;
    this.promptText.setVisible(false);
    this.registry.set('sunriseCityReturnX', 20 * 32 + 16);
    this.registry.set('sunriseCityReturnY', 13 * 32 + 16);
    this.cameras.main.fadeOut(300, 0, 0, 0, () => this.scene.start('SunriseCityScene'));
  }

  private near(col: number, row: number, radius: number): boolean {
    return Math.hypot(this.px / IT - col, this.py / IT - row) <= radius;
  }

  private rodBaseElevation(rod: StormRodDef): number {
    return rod.index * 0.65;
  }

  private elevationForRow(row: number): number {
    if (row < 3) return 1.9;
    if (row < 4) return Phaser.Math.Linear(1.9, 1.3, row - 3);
    if (row < 11) return 1.3;
    if (row < 12) return Phaser.Math.Linear(1.3, 0.65, row - 11);
    if (row < 19) return 0.65;
    if (row < 20) return Phaser.Math.Linear(0.65, 0, row - 19);
    return 0;
  }

  private rodName(rod: StormRodDef): string {
    if (rod.id === 'dawn') return t('Dawn Rod', '새벽 피뢰침', '暁の避雷針');
    if (rod.id === 'gale') return t('Gale Rod', '질풍 피뢰침', '疾風の避雷針');
    return t('Zenith Rod', '천정 피뢰침', '天頂の避雷針');
  }

  private directionName(direction: StormDirection): string {
    if (direction === 0) return t('NORTH ▲', '북쪽 ▲', '北 ▲');
    if (direction === 1) return t('EAST ▶', '동쪽 ▶', '東 ▶');
    if (direction === 2) return t('SOUTH ▼', '남쪽 ▼', '南 ▼');
    return t('WEST ◀', '서쪽 ◀', '西 ◀');
  }
}
