import Phaser from 'phaser';
import { drawGymLeader, drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { vanishesAfterDefeat } from '../data/Villains';
import { playBgm } from '../systems/Music';
import { MOBILE_ACTION_EVENT } from '../systems/TouchControls';
import { sfxCancel, sfxConfirm, sfxMove } from '../systems/UiSfx';
import { t } from '../systems/i18n';
import {
  reconcileWaveGymProgress,
  WAVE_POOL_COURSES,
  type WavePoolCourse,
  waveCourseCleared,
  waveCourseClearedFlag,
  waveCourseUnlocked,
  waveGymComplete,
} from '../systems/WavePoolGymPuzzle';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';

interface GymTrainer {
  key: 'haean-haedo' | 'haean-byungchan';
  name: [string, string, string];
  line: [string, string, string];
  col: number;
  row: number;
  pokemon: { id: number; level: number; custom?: string }[];
  expPool: number;
  defeated: boolean;
}

interface WaveRideState {
  course: WavePoolCourse;
  elapsedMs: number;
  balance: number;
  velocity: number;
  phase: number;
  currentForce: number;
}

const IT = 36;

export class HaeanGymScene extends Phaser.Scene {
  public interior3D = true;
  public flatTerrain3D = true;
  public clearSight3D = true;
  public noRocks3D = true;
  public onlyNamedBuildings = true;
  public hideLeadCompanion3D = false;

  private playerG!: Phaser.GameObjects.Graphics;
  private boardG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private dialog!: DialogBox;
  private cutsceneActive = false;
  private exiting = false;
  private px = 0;
  private py = 0;
  private facing = 1;
  private walkFrame = 0;
  private walkTimer = 0;
  private readonly SPEED = 100;
  private readonly W = 16;
  private readonly H = 18;
  private ride: WaveRideState | null = null;
  private wavePools = new Map<string, Phaser.GameObjects.Graphics>();
  private balancePanel!: Phaser.GameObjects.Container;
  private balanceGauge!: Phaser.GameObjects.Graphics;
  private balanceText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private mobileActionAt = -Infinity;
  private interactionReadyAt = 0;
  private readonly onMobileAction = () => { this.mobileActionAt = performance.now(); };

  private trainers: GymTrainer[] = [
    {
      key: 'haean-haedo',
      name: ['Gym Trainer Haedo', '체육관 트레이너 해도', 'ジムトレーナー・ヘド'],
      line: [
        'Haedo: You rode the shore break. Now show me your battle rhythm!',
        '해도: 쇄도파를 타고 왔군. 이제 배틀의 리듬을 보여 줘!',
        'ヘド：ショアブレイクを越えたか。次はバトルのリズムを見せろ！',
      ],
      col: 5,
      row: 10.72,
      pokemon: [
        { id: 0, level: 27, custom: 'ottershaman' },
        { id: 0, level: 28, custom: 'roundtailor' },
      ],
      expPool: 800,
      defeated: false,
    },
    {
      key: 'haean-byungchan',
      name: ['Gym Trainer Byungchan', '체육관 트레이너 병찬', 'ジムトレーナー・ビョンチャン'],
      line: [
        'Byungchan: You held the cross-current. Can you keep that poise in battle?',
        '병찬: 교차 조류에서도 버텼군. 배틀에서도 그 균형을 지킬 수 있을까?',
        'ビョンチャン：交差する潮流に耐えたな。バトルでもその均衡を保てるか？',
      ],
      col: 11,
      row: 6.42,
      pokemon: [
        { id: 0, level: 28, custom: 'paratoxin' },
        { id: 91, level: 29 },
      ],
      expPool: 840,
      defeated: false,
    },
  ];

  constructor() { super('HaeanGymScene'); }

  create(): void {
    playBgm(this, 'gyminterior');
    this.cutsceneActive = false;
    this.exiting = false;
    this.ride = null;
    this.wavePools.clear();
    this.hideLeadCompanion3D = false;
    this.input.keyboard?.resetKeys();

    reconcileWaveGymProgress(
      key => this.registry.get(key),
      (key, value) => this.registry.set(key, value),
    );
    this.trainers.forEach(trainer => {
      trainer.defeated = !!this.registry.get(`trainerDefeated_${trainer.key}`)
        || !!this.registry.get('haeanGymDefeated');
    });

    this.px = 8 * IT;
    this.py = 15.55 * IT;
    const gpx = this.registry.get('gymPosX') as number | undefined;
    const gpy = this.registry.get('gymPosY') as number | undefined;
    const savedX = this.registry.get('HaeanGymSceneReturnX') as number | undefined;
    const savedY = this.registry.get('HaeanGymSceneReturnY') as number | undefined;
    if (Number.isFinite(gpx) && Number.isFinite(gpy)) {
      this.px = gpx!;
      this.py = gpy!;
    } else if (Number.isFinite(savedX) && Number.isFinite(savedY)) {
      this.px = savedX!;
      this.py = savedY!;
    }
    this.registry.remove('gymPosX');
    this.registry.remove('gymPosY');
    this.registry.remove('HaeanGymSceneReturnX');
    this.registry.remove('HaeanGymSceneReturnY');

    this.drawGym();
    this.drawWavePools();
    this.drawTrainers();
    this.createSurfboard();
    this.createPlayer();
    drawGymLeader(this, this.W * IT / 2, IT * 1.72, {
      body: 0x0d2a4a,
      accent: 0x66c8f0,
      label: t('LEADER HARANG', '관장 하랑', 'ジムリーダー・ハラン'),
      labelColor: '#bff0ff',
      hair: 0x0a2a3a,
      trainerKey: 'haean-harang',
    });
    this.setupInput();
    this.createHud();
    this.cameras.main.setBounds(0, 0, this.W * IT, this.H * IT);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.cameras.main.fadeIn(300);
    this.dialog = new DialogBox(this, 1280, 720);
    this.interactionReadyAt = this.time.now + 450;

    const fallenCourse = String(this.registry.get('haeanWaveFallPending') ?? '');
    if (fallenCourse) {
      this.registry.remove('haeanWaveFallPending');
      this.showDialogue([
        t(
          'The rescue crew returns you and the rental board to the last checkpoint.',
          '안전 요원이 당신과 대여 서핑보드를 마지막 체크포인트로 데려왔다.',
          '救助スタッフがあなたとレンタルボードを最後のチェックポイントへ戻した。',
        ),
        t(
          'Watch the current indicator and lean against the wave before trying again.',
          '다시 도전할 때는 조류 표시를 보고 파도의 반대쪽으로 몸을 기울이자.',
          '再挑戦では潮流表示を見て、波と反対側へ体を傾けよう。',
        ),
      ]);
      return;
    }

    if (this.registry.get('haeanGymDefeated') && !this.registry.get('harangFarewell')) {
      this.registry.set('harangFarewell', true);
      this.showDialogue([
        t('Harang: The tide turned in your favour. Well earned.', '하랑: 파도가 네 편으로 돌아섰구나. 훌륭했다.', 'ハラン：潮がお前の味方をした。見事だった。'),
        t(
          'Harang: Those dark-coated ones loaded sealed crates at Midnight Port and sailed south.',
          '하랑: 검은 옷을 입은 자들이 자정항에서 봉인된 상자를 싣고 남쪽으로 향했다.',
          'ハラン：黒服の連中は真夜中港で封印された箱を積み、南へ向かった。',
        ),
        t('You may leave through the south door.', '남쪽 문으로 나갈 수 있다.', '南の扉から外へ出られる。'),
      ]);
      return;
    }

    if (!this.registry.get('haeanSurfboardReceived')) {
      this.registry.set('haeanSurfboardReceived', true);
      SaveManager.autoSave(this.registry, this.px, this.py, 'HaeanGymScene');
      this.showDialogue([
        t('Wave Attendant: Welcome to Harang\'s Wave Gym!', '파도 안내원: 하랑의 파도 체육관에 온 걸 환영해!', 'ウェーブ係：ハランの波ジムへようこそ！'),
        t('You received a rental Surfboard!', '대여용 서핑보드를 받았다!', 'レンタルサーフボードを受け取った！'),
        t(
          'Ride north through three wave pools. Use LEFT and RIGHT to keep the balance marker near the centre.',
          '세 개의 파도풀을 타고 북쪽으로 가자. 좌우 입력으로 균형 표시를 중앙에 유지해야 한다.',
          '3つのウェーブプールを北へ進もう。左右入力でバランスマーカーを中央に保つんだ。',
        ),
        t(
          'Reach a checkpoint safely and no wild Pokémon will interrupt you. Fall in, and a wild Water Pokémon will appear!',
          '무사히 체크포인트에 닿으면 야생 배틀 없이 트레이너에게 갈 수 있다. 물에 빠지면 야생 물 포켓몬이 나타난다!',
          '無事にチェックポイントへ着けば野生バトルなしでトレーナーへ進める。落水すると野生のみずポケモンが現れるぞ！',
        ),
      ]);
    } else if (!this.registry.get('haeanWaveGymIntroSeen')) {
      this.registry.set('haeanWaveGymIntroSeen', true);
      this.showDialogue([
        t('Three currents stand between you and Leader Harang.', '세 개의 파도가 관장 하랑에게 가는 길을 막고 있다.', '3つの潮流がジムリーダー・ハランへの道を阻んでいる。'),
        t('Clear a wave pool, defeat its checkpoint Trainer, then challenge the stronger current.', '파도풀을 통과하고 체크포인트 트레이너를 이긴 뒤 더 강한 파도에 도전하자.', 'プールを突破してチェックポイントのトレーナーに勝ち、さらに強い波へ挑もう。'),
      ]);
    }
  }

  private showDialogue(lines: string[], done?: () => void): void {
    this.cutsceneActive = true;
    this.promptText?.setVisible(false);
    this.dialog.show(lines, () => {
      this.cutsceneActive = false;
      this.interactionReadyAt = this.time.now + 300;
      done?.();
    });
  }

  private drawGym(): void {
    const g = this.add.graphics().setDepth(0);
    const width = this.W * IT;
    const height = this.H * IT;
    g.fillStyle(0x102f47);
    g.fillRect(0, 0, width, height);
    for (let row = 1; row < this.H - 1; row++) {
      for (let col = 1; col < this.W - 1; col++) {
        g.fillStyle((row + col) % 2 ? 0x245069 : 0x2a5970);
        g.fillRect(col * IT, row * IT, IT, IT);
      }
    }

    g.fillStyle(0x0a2132);
    g.fillRect(0, 0, width, IT);
    g.fillRect(0, 0, IT, height);
    g.fillRect(width - IT, 0, IT, height);
    g.fillRect(0, height - IT, width, IT);
    g.fillStyle(0x317089);
    g.fillRect(4 * IT, IT, 8 * IT, IT * 1.35);
    g.lineStyle(3, 0x8ee8ff);
    g.strokeRect(4 * IT, IT, 8 * IT, IT * 1.35);
    g.fillStyle(0xcb8a43);
    g.fillRect(7 * IT, height - IT, 2 * IT, IT);

    for (const course of WAVE_POOL_COURSES) {
      const top = course.minRow * IT;
      const bandHeight = (course.maxRow - course.minRow) * IT;
      g.fillStyle(course.index === 0 ? 0x177eaa : course.index === 1 ? 0x116d9e : 0x0b5a91);
      g.fillRect(IT, top, (this.W - 2) * IT, bandHeight);
      g.fillStyle(0xb8f3ff, 0.42);
      for (let stripe = 0; stripe < 5; stripe++) {
        const y = top + (stripe + 0.5) * bandHeight / 5;
        g.fillRect(IT * (1.4 + (stripe % 2) * 0.4), y, (this.W - 3.2) * IT, 3);
      }
    }

    const textureKey = '__haeanWaveGymMap__';
    if (this.textures.exists(textureKey)) this.textures.remove(textureKey);
    g.generateTexture(textureKey, width, height);
    g.destroy();
    this.add.image(0, 0, textureKey).setOrigin(0).setDepth(0);

    this.add.text(width / 2, IT * 1.3, t('HARANG WAVE GYM', '하랑의 파도 체육관', 'ハランの波ジム'), {
      fontSize: '12px', color: '#d8f8ff', fontStyle: 'bold', stroke: '#062034', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(5);
    this.add.text(width / 2, IT * 16.2, t('SURFBOARD RENTAL', '서핑보드 대여소', 'サーフボード貸出所'), {
      fontSize: '9px', color: '#ffe2a0', backgroundColor: '#102638bb', padding: { x: 8, y: 3 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawWavePools(): void {
    for (const course of WAVE_POOL_COURSES) {
      const width = (this.W - 2) * IT;
      const depth = (course.maxRow - course.minRow) * IT;
      const accent = course.index === 0 ? 0x6de7ff : course.index === 1 ? 0x51bfff : 0x8b9dff;
      const pool = this.add.graphics().setDepth(3);
      pool.setPosition(this.W * IT / 2, (course.minRow + course.maxRow) * IT / 2);
      pool.lineStyle(2, 0xd8fbff, 0.72);
      for (let index = 0; index < 6; index++) {
        const y = -depth / 2 + (index + 0.5) * depth / 6;
        pool.beginPath();
        pool.moveTo(-width * 0.43, y);
        pool.lineTo(width * 0.43, y);
        pool.strokePath();
      }
      pool.setData('waveGymProp3D', {
        kind: 'pool', width: width / 32, depth: depth / 32, accent,
      });
      this.wavePools.set(course.id, pool);
      this.syncWavePool(course);

      this.add.text(IT * 1.25, (course.minRow + course.maxRow) * IT / 2, this.courseName(course), {
        fontSize: '9px', color: '#e2fbff', backgroundColor: '#06243ccc', padding: { x: 5, y: 3 },
      }).setOrigin(0, 0.5).setDepth(6);
    }
  }

  private syncWavePool(course: WavePoolCourse): void {
    const pool = this.wavePools.get(course.id);
    if (!pool) return;
    const cleared = waveCourseCleared(course, key => this.registry.get(key));
    pool.setData('waveGymActive3D', cleared ? 0 : 1);
    pool.setData('waveGymCleared3D', cleared ? 1 : 0);
    pool.setData('waveGymIntensity3D', course.waveForce);
    pool.setData('waveGymCue3D', this.ride?.course.id === course.id ? 1 : 0);
    pool.setAlpha(cleared ? 0.32 : 0.86);
    if (cleared) {
      const markerKey = `bridge-${course.id}`;
      if (!this.children.getByName(markerKey)) {
        const bridge = this.add.graphics().setDepth(4).setName(markerKey).setData('no3d', true);
        bridge.fillStyle(0xd7a454);
        const top = course.minRow * IT;
        const height = (course.maxRow - course.minRow) * IT;
        for (let y = top; y < top + height; y += 12) bridge.fillRect(course.startCol * IT - 20, y, 40, 9);
        bridge.lineStyle(2, 0x31566a);
        bridge.strokeRect(course.startCol * IT - 22, top, 44, height);
      }
    }
  }

  private courseName(course: WavePoolCourse): string {
    if (course.id === 'shore-break') return t('1 · SHORE BREAK', '1 · 쇄도파', '1・ショアブレイク');
    if (course.id === 'cross-current') return t('2 · CROSS CURRENT', '2 · 교차 조류', '2・クロスカレント');
    return t('3 · STORM SWELL', '3 · 폭풍 너울', '3・ストームスウェル');
  }

  private drawTrainers(): void {
    for (const trainer of this.trainers) {
      if (trainer.defeated && vanishesAfterDefeat(trainer.key)) continue;
      const x = trainer.col * IT;
      const y = trainer.row * IT;
      const g = this.add.graphics().setDepth(10).setPosition(x, y);
      const accent = trainer.key === 'haean-haedo' ? 0x31a9d6 : 0x566ed0;
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(accent); g.fillRect(-7, -8, 14, 11);
      g.fillStyle(accent); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x172536); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
      g.fillStyle(0x102838); g.fillRect(-6, -20, 12, 4);
      g.fillStyle(0x000000); g.fillRect(-3, -14, 2, 2); g.fillRect(1, -14, 2, 2);
      this.add.text(x, y - 29, t(...trainer.name).replace(/^.*?\s/, ''), {
        fontSize: '8px', color: '#bdefff', backgroundColor: '#001c2cbb', padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(11);
    }
  }

  private createSurfboard(): void {
    this.boardG = this.add.graphics().setDepth(18).setVisible(false);
    this.boardG.fillStyle(0xf4f0df);
    this.boardG.fillEllipse(0, 5, 22, 43);
    this.boardG.fillStyle(0x1dc5df);
    this.boardG.fillEllipse(0, 4, 16, 35);
    this.boardG.fillStyle(0x173347);
    this.boardG.fillRect(-2, -10, 4, 22);
    this.boardG.setData('waveGymProp3D', { kind: 'surfboard', width: 0.9, depth: 1.7, accent: 0x1dc5df });
    this.boardG.setData('waveGymActive3D', 0);
  }

  private createPlayer(): void {
    this.playerG = this.add.graphics().setDepth(20);
    this.redrawPlayer();
  }

  private redrawPlayer(): void {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
    if (this.ride) {
      this.boardG.setPosition(this.px, this.py + 11);
      this.boardG.setAngle(-this.ride.balance * 15);
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
      if (!this.cutsceneActive && !this.ride) this.scene.launch('MenuScene');
    });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => {
      if (!this.cutsceneActive && !this.ride) this.scene.launch('MenuScene');
    });
    window.addEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
      this.hideLeadCompanion3D = false;
    });
  }

  private createHud(): void {
    const panel = this.add.rectangle(640, 84, 424, 94, 0x041929, 0.9)
      .setStrokeStyle(2, 0x71dbf5).setScrollFactor(0);
    const title = this.add.text(640, 50, t('SURF BALANCE', '서핑 균형', 'サーフバランス'), {
      fontSize: '16px', color: '#e5fbff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0);
    this.balanceGauge = this.add.graphics().setScrollFactor(0);
    this.balanceText = this.add.text(640, 108, '', {
      fontSize: '12px', color: '#bdefff', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0);
    this.balancePanel = this.add.container(0, 0, [panel, title, this.balanceGauge, this.balanceText])
      .setDepth(1000).setScrollFactor(0).setVisible(false);
    this.promptText = this.add.text(640, 650, '', {
      fontSize: '15px', color: '#ffffff', backgroundColor: '#061826dd',
      padding: { x: 14, y: 8 }, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(999).setVisible(false);
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
    if (this.exiting) return;

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) { dx = -1; this.facing = 2; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { dx = 1; this.facing = 3; }
    if (this.cursors.up.isDown || this.wasd.up.isDown) { dy = -1; this.facing = 1; }
    if (this.cursors.down.isDown || this.wasd.down.isDown) { dy = 1; this.facing = 0; }

    if (this.ride) {
      this.updateWaveRide(delta, dx);
      return;
    }

    const dt = Math.min(delta, 60) / 1000;
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
    this.checkTrainerProgress();
    if (this.cutsceneActive) return;
    this.updateCoursePrompt(actionPressed);
    if (this.cutsceneActive) return;
    this.checkLeaderApproach();
    this.checkExit();
  }

  private collides(x: number, y: number): boolean {
    if (x < IT * 1.08 || x > (this.W - 1.08) * IT || y < IT * 1.04 || y > (this.H - 1.02) * IT) return true;
    for (const course of WAVE_POOL_COURSES) {
      if (y < course.minRow * IT || y > course.maxRow * IT) continue;
      if (!waveCourseCleared(course, key => this.registry.get(key))) return true;
      if (Math.abs(x - course.startCol * IT) > IT * 0.68) return true;
    }
    return false;
  }

  private updateCoursePrompt(actionPressed: boolean): void {
    let nearest: WavePoolCourse | undefined;
    let nearestDistance = Infinity;
    for (const course of WAVE_POOL_COURSES) {
      if (waveCourseCleared(course, key => this.registry.get(key))) continue;
      const distance = Math.hypot(this.px - course.startCol * IT, this.py - course.startRow * IT);
      if (distance < nearestDistance) { nearest = course; nearestDistance = distance; }
    }
    if (!nearest || nearestDistance > IT * 1.32) {
      this.promptText.setVisible(false);
      return;
    }

    const unlocked = waveCourseUnlocked(nearest, key => this.registry.get(key));
    if (!unlocked) {
      this.promptText.setText(t(
        'Defeat the checkpoint Trainer to unlock the next wave.',
        '체크포인트 트레이너를 이기면 다음 파도가 열린다.',
        'チェックポイントのトレーナーに勝つと次の波が開く。',
      )).setVisible(true);
      return;
    }
    this.promptText.setText(t(
      `[SPACE / A] Ride ${this.courseName(nearest)}`,
      `[SPACE / A] ${this.courseName(nearest)} 타기`,
      `[SPACE / A] ${this.courseName(nearest)}に乗る`,
    )).setVisible(true);
    if (actionPressed && this.time.now >= this.interactionReadyAt) {
      this.promptText.setVisible(false);
      sfxConfirm(this);
      this.showDialogue([
        t(
          `Wave ${nearest.index + 1}: ${this.courseName(nearest)}. Keep the marker centred!`,
          `${nearest.index + 1}단계 ${this.courseName(nearest)}. 균형 표시를 중앙에 유지하자!`,
          `ウェーブ${nearest.index + 1}：${this.courseName(nearest)}。マーカーを中央に保とう！`,
        ),
      ], () => this.beginWaveRide(nearest!));
    }
  }

  private beginWaveRide(course: WavePoolCourse): void {
    this.ride = {
      course,
      elapsedMs: 0,
      balance: 0,
      velocity: 0,
      phase: Phaser.Math.FloatBetween(0.25, Math.PI * 2),
      currentForce: 0,
    };
    this.px = course.startCol * IT;
    this.py = course.startRow * IT;
    this.facing = 1;
    this.walkFrame = 0;
    this.boardG.setVisible(true).setData('waveGymActive3D', 1);
    this.playerG.setData('characterSurfboard3D', true);
    this.hideLeadCompanion3D = true;
    this.balancePanel.setVisible(true);
    this.syncWavePool(course);
    this.updateBalanceHud();
    this.redrawPlayer();
  }

  private updateWaveRide(delta: number, inputX: number): void {
    const ride = this.ride;
    if (!ride) return;
    const dt = Math.min(delta, 48) / 1000;
    ride.elapsedMs += Math.min(delta, 48);
    const time = ride.elapsedMs / 1000;
    const course = ride.course;
    const current = Math.sin(time * course.frequency + ride.phase) * course.waveForce
      + Math.sin(time * course.frequency * 0.47 + ride.phase * 1.7) * course.waveForce * 0.48;
    ride.currentForce = current;
    ride.velocity += (current + inputX * course.controlForce) * dt;
    ride.velocity *= Math.exp(-1.65 * dt);
    ride.balance += ride.velocity * dt;

    const progress = Phaser.Math.Clamp(ride.elapsedMs / course.durationMs, 0, 1);
    this.px = course.startCol * IT + ride.balance * IT * 1.34;
    this.py = Phaser.Math.Linear(course.startRow * IT, course.endRow * IT, progress);
    this.playerG.setData('characterLookAt3D', { x: this.px, y: this.py - IT });
    this.boardG.setData('waveGymLean3D', ride.balance);
    this.boardG.setData('waveGymIntensity3D', course.waveForce);
    this.boardG.setData('waveGymCue3D', Math.min(1, Math.abs(current) / course.waveForce));
    this.updateBalanceHud();
    this.redrawPlayer();

    if (Math.abs(ride.balance) >= 1) {
      this.failWaveRide(course);
    } else if (progress >= 1) {
      this.completeWaveRide(course);
    }
  }

  private updateBalanceHud(): void {
    const ride = this.ride;
    if (!ride) return;
    const x = Phaser.Math.Clamp(ride.balance, -1, 1);
    const gaugeLeft = 500;
    const gaugeWidth = 280;
    this.balanceGauge.clear();
    this.balanceGauge.fillStyle(0xc73547); this.balanceGauge.fillRoundedRect(gaugeLeft, 71, gaugeWidth, 18, 7);
    this.balanceGauge.fillStyle(0xf0b343); this.balanceGauge.fillRoundedRect(gaugeLeft + gaugeWidth * 0.16, 71, gaugeWidth * 0.68, 18, 7);
    this.balanceGauge.fillStyle(0x3fcf91); this.balanceGauge.fillRoundedRect(gaugeLeft + gaugeWidth * 0.35, 71, gaugeWidth * 0.3, 18, 7);
    this.balanceGauge.lineStyle(2, 0xffffff); this.balanceGauge.strokeRoundedRect(gaugeLeft, 71, gaugeWidth, 18, 7);
    const markerX = gaugeLeft + (x + 1) * 0.5 * gaugeWidth;
    this.balanceGauge.fillStyle(0xffffff); this.balanceGauge.fillTriangle(markerX, 64, markerX - 8, 52, markerX + 8, 52);
    this.balanceGauge.fillStyle(0x092235); this.balanceGauge.fillCircle(markerX, 80, 5);
    const arrow = ride.currentForce < -0.12 ? '◀' : ride.currentForce > 0.12 ? '▶' : '◆';
    this.balanceText.setText(t(
      `Current ${arrow}  ·  Lean against it with LEFT / RIGHT`,
      `조류 ${arrow}  ·  좌우로 반대 방향에 무게를 실으세요`,
      `潮流 ${arrow}  ·  左右で反対方向へ体重をかけよう`,
    ));
  }

  private stopWaveRide(): void {
    const course = this.ride?.course;
    this.ride = null;
    this.balancePanel.setVisible(false);
    this.boardG.setVisible(false).setAngle(0).setData('waveGymActive3D', 0).setData('waveGymLean3D', 0);
    this.playerG.setData('characterSurfboard3D', false);
    this.playerG.setData('characterLookAt3D', null);
    this.hideLeadCompanion3D = false;
    if (course) this.syncWavePool(course);
  }

  private completeWaveRide(course: WavePoolCourse): void {
    this.px = course.endCol * IT;
    this.py = course.endRow * IT;
    this.stopWaveRide();
    this.registry.set(waveCourseClearedFlag(course), true);
    this.registry.set('haeanWaveCheckpoint', course.index + 1);
    this.registry.set('HaeanGymSceneReturnX', this.px);
    this.registry.set('HaeanGymSceneReturnY', this.py);
    this.syncWavePool(course);
    SaveManager.autoSave(this.registry, this.px, this.py, 'HaeanGymScene');
    sfxMove(this);
    this.cameras.main.shake(180, 0.004);
    this.redrawPlayer();
    this.showDialogue([
      t(
        `Checkpoint ${course.index + 1} reached! You crossed without a wild battle.`,
        `체크포인트 ${course.index + 1} 도착! 물에 빠지지 않아 야생 배틀 없이 통과했다.`,
        `チェックポイント${course.index + 1}到着！落水せず、野生バトルなしで突破した。`,
      ),
      course.index < WAVE_POOL_COURSES.length - 1
        ? t('The floating bridge is now secured for backtracking.', '되돌아갈 수 있도록 부교가 고정되었다.', '戻れるように浮き橋が固定された。')
        : t('Leader Harang awaits beyond the final swell.', '마지막 너울 너머에서 관장 하랑이 기다리고 있다.', '最後のうねりの先でジムリーダー・ハランが待っている。'),
    ]);
  }

  private failWaveRide(course: WavePoolCourse): void {
    this.stopWaveRide();
    sfxCancel(this);
    this.cameras.main.shake(360, 0.014);
    this.registry.set('haeanWaveFallPending', course.id);
    this.registry.set('gymPosX', course.startCol * IT);
    this.registry.set('gymPosY', course.startRow * IT);
    this.registry.set('HaeanGymSceneReturnX', course.startCol * IT);
    this.registry.set('HaeanGymSceneReturnY', course.startRow * IT);
    this.registry.set('wildId', course.encounter.custom);
    this.registry.set('wildLevel', course.encounter.level);
    this.registry.set('wildCustom', true);
    this.registry.set('wildCatchRate', course.encounter.catchRate);
    this.registry.set('wildReturnScene', 'HaeanGymScene');
    this.showDialogue([
      t('You lost your balance and fell into the wave pool!', '균형을 잃고 파도풀에 빠졌다!', 'バランスを崩してウェーブプールに落ちた！'),
      t('A wild Water Pokémon surges out of the foam!', '거품 속에서 야생 물 포켓몬이 튀어나왔다!', '泡の中から野生のみずポケモンが飛び出した！'),
    ], () => {
      this.exiting = true;
      this.cameras.main.fadeOut(350, 0, 22, 38, () => this.scene.start('WildBattleScene'));
    });
  }

  private checkTrainerProgress(): void {
    for (const trainer of this.trainers) {
      if (!trainer.defeated && this.registry.get(`trainerDefeated_${trainer.key}`)) trainer.defeated = true;
    }
    for (const trainer of this.trainers) {
      if (trainer.defeated) continue;
      const tx = trainer.col * IT;
      const ty = trainer.row * IT;
      if (Math.hypot(this.px - tx, this.py - ty) >= IT * 1.25) continue;
      this.showDialogue([t(...trainer.line), t(
        `${trainer.name[0]}: Into the deep!`,
        `${trainer.name[1]}: 깊은 물속으로!`,
        `${trainer.name[2]}：深みへ行くぞ！`,
      )], () => {
        this.registry.set('trainerName', t(...trainer.name));
        this.registry.set('trainerKey', trainer.key);
        this.registry.set('trainerPokemon', JSON.stringify(trainer.pokemon));
        this.registry.set('trainerExpPool', trainer.expPool);
        this.registry.set('trainerReturnScene', 'HaeanGymScene');
        this.registry.set('gymPosX', this.px);
        this.registry.set('gymPosY', this.py);
        this.exiting = true;
        this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
      });
      return;
    }
  }

  private checkLeaderApproach(): void {
    if (this.registry.get('haeanGymDefeated') || this.cutsceneActive) return;
    const ready = this.trainers.every(trainer => trainer.defeated)
      && waveGymComplete(key => this.registry.get(key));
    if (!ready || this.py >= IT * 2.75) return;
    this.showDialogue([
      t('(A weathered figure stands above the roaring final swell.)', '(거친 파도 위 단상에 풍파를 견딘 인물이 서 있다.)', '（荒波の上の壇上に、風格ある人物が立っている。）'),
      t('Harang: I am Harang, the Tidekeeper. You read all three currents well.', '하랑: 나는 조율지기 하랑. 세 파도의 흐름을 훌륭하게 읽었구나.', 'ハラン：俺は潮守のハラン。3つの潮流をよく読み切ったな。'),
      t('Harang: Now hold that balance against my Pokémon!', '하랑: 이제 내 포켓몬을 상대로 그 균형을 지켜 봐라!', 'ハラン：今度は俺のポケモンを相手に、その均衡を保ってみろ！'),
    ], () => this.startLeaderBattle());
  }

  private startLeaderBattle(): void {
    this.registry.set('trainerName', t('Leader Harang', '관장 하랑', 'ジムリーダー・ハラン'));
    this.registry.set('trainerKey', 'haean-harang');
    this.registry.set('trainerPokemon', JSON.stringify([
      { id: 0, level: 29, custom: 'ottermudang' },
      { id: 0, level: 29, custom: 'roundtailor' },
      { id: 0, level: 29, custom: 'paratoxin' },
      { id: 0, level: 30, custom: 'frysm' },
      { id: 0, level: 31, custom: 'dracopaia' },
    ]));
    this.registry.set('trainerExpPool', 1400);
    this.registry.set('trainerReturnScene', 'HaeanGymScene');
    this.registry.set('gymPosX', this.px);
    this.registry.set('gymPosY', this.py);
    this.registry.set('trainerBadgeFlag', 'haeanGymDefeated');
    this.registry.set('trainerBadgeName', t('Tidekeeper Badge', '조율배지', '潮守バッジ'));
    this.registry.set('trainerBadgeTM', 'Surf');
    this.registry.set('trainerWinLine', t(
      'Harang: The tide chose you. Few can say that.',
      '하랑: 파도가 너를 선택했구나. 누구나 받을 수 있는 인정은 아니다.',
      'ハラン：潮がお前を選んだ。その栄誉を得られる者は少ない。',
    ));
    this.exiting = true;
    this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
  }

  private checkExit(): void {
    if (this.py <= (this.H - 1.55) * IT || this.px <= 6.5 * IT || this.px >= 9.5 * IT) return;
    this.exiting = true;
    this.promptText.setVisible(false);
    this.registry.set('haeanCityReturnX', 23 * 32 + 16);
    this.registry.set('haeanCityReturnY', 12 * 32 + 16);
    this.cameras.main.fadeOut(300, 0, 0, 0, () => this.scene.start('HaeanCityScene'));
  }
}
