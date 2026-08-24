import Phaser from 'phaser';
import { drawGymLeader, drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { vanishesAfterDefeat } from '../data/Villains';
import { playBgm } from '../systems/Music';
import {
  isStrengthQuarryBlock,
  reconcileStrengthQuarryProgress,
  resolveStrengthPush,
  STRENGTH_BOULDERS,
  STRENGTH_CHASM_ROWS,
  STRENGTH_QUARRY_BLOCKS,
  type StrengthBoulderDef,
  type StrengthRune,
  strengthBoulderColKey,
  strengthBoulderFilled,
  strengthBoulderFilledFlag,
  strengthBoulderPosition,
  strengthBoulderRowKey,
  strengthQuarryFilledCount,
  strengthQuarrySolved,
} from '../systems/StrengthQuarryPuzzle';
import { MOBILE_ACTION_EVENT } from '../systems/TouchControls';
import { sfxCancel, sfxConfirm, sfxMove } from '../systems/UiSfx';
import { t } from '../systems/i18n';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';

interface GymTrainer {
  key: 'dolmoe-bawoo' | 'dolmoe-doran';
  name: [string, string, string];
  line: [string, string, string];
  col: number;
  row: number;
  pokemon: { id: number; level: number; custom?: string }[];
  expPool: number;
  defeated: boolean;
}

interface RuntimeBoulder {
  def: StrengthBoulderDef;
  col: number;
  row: number;
  graphic: Phaser.GameObjects.Graphics;
}

interface GridMotion {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  elapsedMs: number;
  durationMs: number;
  boulder?: RuntimeBoulder;
  boulderFromX?: number;
  boulderFromY?: number;
  boulderToCol?: number;
  boulderToRow?: number;
  fill?: boolean;
}

const IT = 36;

export class DolmoeGymScene extends Phaser.Scene {
  public interior3D = true;
  public clearSight3D = true;
  public flatTerrain3D = true;
  public noRocks3D = true;
  public onlyNamedBuildings = true;

  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private dialog!: DialogBox;
  private cutsceneActive = false;
  private exiting = false;
  private sandolAbsentShown = false;
  private px = 0;
  private py = 0;
  private facing = 1;
  private walkFrame = 0;
  private motion: GridMotion | null = null;
  private readonly W = 18;
  private readonly H = 18;
  private boulders: RuntimeBoulder[] = [];
  private holes = new Map<string, Phaser.GameObjects.Graphics>();
  private chasmG!: Phaser.GameObjects.Graphics;
  private resetG!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private mobileActionAt = -Infinity;
  private interactionReadyAt = 0;
  private readonly onMobileAction = () => { this.mobileActionAt = performance.now(); };

  private trainers: GymTrainer[] = [
    {
      key: 'dolmoe-bawoo',
      name: ['Gym Trainer Bawoo', '체육관 트레이너 바우', 'ジムトレーナー・バウ'],
      line: [
        'Bawoo: One wrong push and the quarry pushes back. Show me your strength!',
        '바우: 한 번 잘못 밀면 채석장이 되받아친다. 네 괴력을 보여 줘!',
        'バウ：一手間違えば採石場が牙をむく。お前の怪力を見せてみろ！',
      ],
      col: 3,
      row: 10,
      pokemon: [{ id: 75, level: 39 }, { id: 76, level: 40 }],
      expPool: 900,
      defeated: false,
    },
    {
      key: 'dolmoe-doran',
      name: ['Gym Trainer Doran', '체육관 트레이너 도란', 'ジムトレーナー・ドラン'],
      line: [
        'Doran: Stone and steel, stone and fist. Break one, the next still stands.',
        '도란: 바위와 강철, 바위와 주먹. 하나를 깨도 다음 것이 버티고 있지.',
        'ドラン：岩と鋼、岩と拳。一つ砕いても次が立ちはだかる。',
      ],
      col: 14,
      row: 10,
      pokemon: [{ id: 306, level: 40 }, { id: 0, level: 41, custom: 'prowlrock' }],
      expPool: 960,
      defeated: false,
    },
  ];

  constructor() { super('DolmoeGymScene'); }

  private cellX(col: number): number { return col * IT + IT / 2; }
  private cellY(row: number): number { return row * IT + IT / 2; }
  private playerCol(): number { return Math.round(this.px / IT - 0.5); }
  private playerRow(): number { return Math.round(this.py / IT - 0.5); }

  create(): void {
    playBgm(this, 'gyminterior');
    this.cutsceneActive = false;
    this.exiting = false;
    this.motion = null;
    this.sandolAbsentShown = false;
    this.boulders = [];
    this.holes.clear();
    this.input.keyboard?.resetKeys();
    reconcileStrengthQuarryProgress(
      key => this.registry.get(key),
      (key, value) => this.registry.set(key, value),
    );
    this.trainers.forEach(trainer => {
      trainer.defeated = !!this.registry.get(`trainerDefeated_${trainer.key}`)
        || !!this.registry.get('dolmoeGymDefeated');
    });

    this.px = this.cellX(8);
    this.py = this.cellY(16);
    const gpx = this.registry.get('gymPosX') as number | undefined;
    const gpy = this.registry.get('gymPosY') as number | undefined;
    const savedX = this.registry.get('DolmoeGymSceneReturnX') as number | undefined;
    const savedY = this.registry.get('DolmoeGymSceneReturnY') as number | undefined;
    if (Number.isFinite(gpx) && Number.isFinite(gpy)) {
      this.px = this.cellX(Math.round(gpx! / IT - 0.5));
      this.py = this.cellY(Math.round(gpy! / IT - 0.5));
    } else if (Number.isFinite(savedX) && Number.isFinite(savedY)) {
      this.px = this.cellX(Math.round(savedX! / IT - 0.5));
      this.py = this.cellY(Math.round(savedY! / IT - 0.5));
    }
    this.registry.remove('gymPosX');
    this.registry.remove('gymPosY');
    this.registry.remove('DolmoeGymSceneReturnX');
    this.registry.remove('DolmoeGymSceneReturnY');
    this.sanitizeRestoredPlayerCell();

    this.drawGym();
    this.drawChasmAndHoles();
    this.drawBoulders();
    this.drawResetPedestal();
    this.drawTrainers();
    this.createPlayer();
    if (this.registry.get('dolmoeRuinsDone') || this.registry.get('dolmoeGymDefeated')) {
      drawGymLeader(this, this.cellX(8), this.cellY(2), {
        body: 0x6a5030,
        accent: 0xc8a860,
        label: t('LEADER SANDOL', '관장 산돌', 'ジムリーダー・サンドル'),
        labelColor: '#f1e4cd',
        hair: 0x888888,
        trainerKey: 'dolmoe-sandol',
      });
    }
    this.setupInput();
    this.createHud();
    this.cameras.main.setBounds(0, 0, this.W * IT, this.H * IT);
    this.cameras.main.startFollow(this.playerG, true, 0.12, 0.12);
    this.cameras.main.fadeIn(300);
    this.dialog = new DialogBox(this, 1280, 720);
    this.interactionReadyAt = this.time.now + 450;
    this.syncPuzzleVisuals();

    if (this.registry.get('dolmoeGymDefeated') && !this.registry.get('sandolFarewell')) {
      this.registry.set('sandolFarewell', true);
      this.showDialogue([
        t('Sandol: The mountain remembers those who do not crack. It remembers you now.', '산돌: 산은 부서지지 않는 자를 기억한다. 이제 너도 기억하겠지.', 'サンドル：山は砕けぬ者を覚えている。今、お前も刻まれた。'),
        t('Sandol: Carry your load steadily on the road to Seorae.', '산돌: 서래로 향하는 길에서도 짐을 굳건히 짊어져라.', 'サンドル：ソレへ続く道でも、その重みをしっかり背負え。'),
      ]);
      return;
    }

    if (!this.registry.get('dolmoeStrengthIntroSeen')) {
      this.registry.set('dolmoeStrengthIntroSeen', true);
      this.showDialogue([
        t('You enter the Strength Quarry!', '괴력 채석장에 들어섰다!', '怪力の採石場へ入った！'),
        t(
          'Walk into a rune boulder to push it one tile. A boulder cannot be pulled or pushed through another rock.',
          '문양 바위와 부딪치면 한 칸 밀 수 있다. 바위는 당길 수 없고 다른 바위를 통과할 수도 없다.',
          '紋章岩へ歩くと1マス押せる。岩を引いたり、別の岩を通り抜けさせたりはできない。',
        ),
        t(
          'Match the circle, triangle and square boulders to their rune holes. All three become a bridge across the fissure.',
          '원형·삼각형·사각형 바위를 같은 문양의 홈에 맞추자. 세 바위가 모두 균열을 건너는 다리가 된다.',
          '円・三角・四角の岩を同じ紋章の穴へ合わせよう。3つそろうと裂け目を渡る橋になる。',
        ),
        t('If a boulder gets stuck, use the reset pedestal near the entrance.', '바위가 막다른 곳에 갇히면 입구 옆 초기화 장치를 사용하자.', '岩が動かせなくなったら、入口近くのリセット台を使おう。'),
      ]);
    }
  }

  private showDialogue(lines: string[], done?: () => void): void {
    this.cutsceneActive = true;
    this.dialog.show(lines, () => {
      this.cutsceneActive = false;
      this.interactionReadyAt = this.time.now + 280;
      this.updateHud();
      done?.();
    });
  }

  private drawGym(): void {
    const g = this.add.graphics().setDepth(0);
    const width = this.W * IT;
    const height = this.H * IT;
    g.fillStyle(0x4a453e); g.fillRect(0, 0, width, height);
    for (let row = 1; row < this.H - 1; row++) {
      for (let col = 1; col < this.W - 1; col++) {
        g.fillStyle((row + col) % 2 === 0 ? 0x575149 : 0x4d4841);
        g.fillRect(col * IT, row * IT, IT, IT);
      }
    }
    g.fillStyle(0x070609);
    g.fillRect(IT, STRENGTH_CHASM_ROWS.min * IT, (this.W - 2) * IT, 2 * IT);
    g.fillStyle(0x2b2724);
    g.fillRect(IT, STRENGTH_CHASM_ROWS.min * IT - 5, (this.W - 2) * IT, 7);
    g.fillRect(IT, (STRENGTH_CHASM_ROWS.max + 1) * IT - 2, (this.W - 2) * IT, 7);

    for (const block of STRENGTH_QUARRY_BLOCKS) {
      g.fillStyle(0x34302b); g.fillRoundedRect(block.col * IT + 3, block.row * IT + 3, IT - 6, IT - 6, 5);
      g.fillStyle(0x716a60); g.fillCircle(this.cellX(block.col) - 4, this.cellY(block.row) - 5, 8);
    }

    g.fillStyle(0x6a655c); g.fillRect(4 * IT, IT, 10 * IT, IT * 2);
    g.lineStyle(3, 0xc0ad8e); g.strokeRect(4 * IT, IT, 10 * IT, IT * 2);
    g.fillStyle(0x2a2620);
    g.fillRect(0, 0, width, IT);
    g.fillRect(0, 0, IT, height);
    g.fillRect(width - IT, 0, IT, height);
    g.fillRect(0, height - IT, width, IT);
    g.fillStyle(0x5a3418); g.fillRect(8 * IT, height - IT, 2 * IT, IT);

    const textureKey = '__dolmoeStrengthGymMap__';
    if (this.textures.exists(textureKey)) this.textures.remove(textureKey);
    g.generateTexture(textureKey, width, height);
    g.destroy();
    this.add.image(0, 0, textureKey).setOrigin(0).setDepth(0);
    this.add.text(width / 2, IT * 1.5, t('STONEMASON\'S STRENGTH QUARRY', '석공의 괴력 채석장', '石工の怪力採石場'), {
      fontSize: '12px', color: '#f3e4ca', fontStyle: 'bold', stroke: '#17120d', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(6);
  }

  private drawChasmAndHoles(): void {
    this.chasmG = this.add.graphics().setDepth(3).setPosition(this.W * IT / 2, 8 * IT);
    this.chasmG.fillStyle(0x050407, 0.94);
    this.chasmG.fillRect(-(this.W - 2) * IT / 2, -IT, (this.W - 2) * IT, 2 * IT);
    this.chasmG.setData('strengthQuarryProp3D', {
      kind: 'chasm', width: (this.W - 2) * IT / 32, depth: 2 * IT / 32, rune: 'circle', accent: 0xc9a762,
    });

    for (const boulder of STRENGTH_BOULDERS) {
      const hole = this.add.graphics().setDepth(5).setPosition(this.cellX(boulder.targetCol), this.cellY(boulder.targetRow));
      this.drawHoleFallback(hole, boulder);
      hole.setData('strengthQuarryProp3D', {
        kind: 'hole', width: 1.2, depth: 1.2, rune: boulder.rune, accent: boulder.accent,
      });
      this.holes.set(boulder.id, hole);
    }
  }

  private drawBoulders(): void {
    for (const def of STRENGTH_BOULDERS) {
      const position = strengthBoulderPosition(def, key => this.registry.get(key));
      const graphic = this.add.graphics().setDepth(9).setPosition(this.cellX(position.col), this.cellY(position.row));
      graphic.setData('strengthQuarryProp3D', {
        kind: 'boulder', width: 1.25, depth: 1.25, rune: def.rune, accent: def.accent,
      });
      const runtime = { def, col: position.col, row: position.row, graphic };
      this.boulders.push(runtime);
      this.drawBoulderFallback(runtime);
    }
  }

  private drawResetPedestal(): void {
    this.resetG = this.add.graphics().setDepth(8).setPosition(this.cellX(15), this.cellY(16));
    this.resetG.fillStyle(0x514943); this.resetG.fillRoundedRect(-15, -14, 30, 28, 5);
    this.resetG.fillStyle(0xc39545); this.resetG.fillRect(-3, -22, 6, 24);
    this.resetG.fillStyle(0xffd36b); this.resetG.fillCircle(7, -22, 5);
    this.resetG.setData('strengthQuarryProp3D', {
      kind: 'reset', width: 1.1, depth: 1.1, rune: 'circle', accent: 0xffd36b,
    });
  }

  private drawRune(
    graphic: Phaser.GameObjects.Graphics,
    rune: StrengthRune,
    x: number,
    y: number,
    size: number,
    color: number,
  ): void {
    graphic.lineStyle(3, color, 1);
    if (rune === 'circle') graphic.strokeCircle(x, y, size);
    else if (rune === 'triangle') graphic.strokeTriangle(x, y - size, x - size, y + size, x + size, y + size);
    else graphic.strokeRect(x - size, y - size, size * 2, size * 2);
  }

  private drawBoulderFallback(boulder: RuntimeBoulder): void {
    const graphic = boulder.graphic;
    graphic.clear();
    graphic.fillStyle(boulder.def.rune === 'triangle' ? 0x444249 : boulder.def.rune === 'square' ? 0x8c846f : 0x69645e);
    graphic.fillCircle(0, 0, 17);
    graphic.fillStyle(0xa69d8b, 0.7); graphic.fillCircle(-5, -6, 7);
    this.drawRune(graphic, boulder.def.rune, 0, -1, 8, boulder.def.accent);
    const filled = strengthBoulderFilled(boulder.def, key => this.registry.get(key));
    graphic.setData('strengthMoving3D', 0);
    graphic.setData('strengthFilled3D', filled ? 1 : 0);
    graphic.setData('strengthSolved3D', strengthQuarrySolved(key => this.registry.get(key)) ? 1 : 0);
    graphic.setData('strengthCue3D', filled ? 1 : 0);
    graphic.setAlpha(filled ? 0.96 : 1);
  }

  private drawHoleFallback(hole: Phaser.GameObjects.Graphics, boulder: StrengthBoulderDef): void {
    const filled = strengthBoulderFilled(boulder, key => this.registry.get(key));
    hole.clear();
    hole.fillStyle(0x08070a); hole.fillCircle(0, 0, 18);
    hole.lineStyle(4, 0x8d8274); hole.strokeCircle(0, 0, 18);
    if (!filled) this.drawRune(hole, boulder.rune, 0, 0, 8, boulder.accent);
    hole.setData('strengthFilled3D', filled ? 1 : 0);
    hole.setData('strengthSolved3D', strengthQuarrySolved(key => this.registry.get(key)) ? 1 : 0);
  }

  private drawTrainers(): void {
    for (const trainer of this.trainers) {
      if (trainer.defeated && vanishesAfterDefeat(trainer.key)) continue;
      const x = this.cellX(trainer.col);
      const y = this.cellY(trainer.row);
      const g = this.add.graphics().setDepth(11).setPosition(x, y);
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(0x9a8a6a); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x3a3228); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
      g.fillStyle(0x2a1a10); g.fillRect(-6, -20, 12, 4);
      g.fillStyle(0x000000); g.fillRect(-3, -14, 2, 2); g.fillRect(1, -14, 2, 2);
      this.add.text(x, y - 29, trainer.key === 'dolmoe-bawoo' ? t('Bawoo', '바우', 'バウ') : t('Doran', '도란', 'ドラン'), {
        fontSize: '8px', color: '#f0dfc4', backgroundColor: '#160f0abb', padding: { x: 3, y: 1 },
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
      if (!this.cutsceneActive && !this.motion) this.scene.launch('MenuScene');
    });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => {
      if (!this.cutsceneActive && !this.motion) this.scene.launch('MenuScene');
    });
    window.addEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
    });
  }

  private createHud(): void {
    const panel = this.add.rectangle(640, 58, 540, 76, 0x17120e, 0.9)
      .setStrokeStyle(2, 0xc5a66a).setScrollFactor(0);
    this.progressText = this.add.text(640, 41, '', {
      fontSize: '15px', color: '#f6e5c8', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0);
    this.promptText = this.add.text(640, 76, '', {
      fontSize: '12px', color: '#ffd977', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0);
    this.add.container(0, 0, [panel, this.progressText, this.promptText]).setDepth(1000).setScrollFactor(0);
    this.updateHud();
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
    if (this.motion) {
      this.updateMotion(delta);
      return;
    }
    if (actionPressed && this.time.now >= this.interactionReadyAt && this.nearResetPedestal()) {
      this.resetPuzzle();
      return;
    }

    let deltaCol = 0;
    let deltaRow = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) { deltaCol = -1; this.facing = 2; }
    else if (this.cursors.right.isDown || this.wasd.right.isDown) { deltaCol = 1; this.facing = 3; }
    else if (this.cursors.up.isDown || this.wasd.up.isDown) { deltaRow = -1; this.facing = 1; }
    else if (this.cursors.down.isDown || this.wasd.down.isDown) { deltaRow = 1; this.facing = 0; }
    if (deltaCol || deltaRow) this.attemptGridStep(deltaCol, deltaRow);
    else { this.walkFrame = 0; this.redrawPlayer(); }
    this.updateHud();
  }

  private attemptGridStep(deltaCol: number, deltaRow: number): void {
    const fromCol = this.playerCol();
    const fromRow = this.playerRow();
    const col = fromCol + deltaCol;
    const row = fromRow + deltaRow;
    if (row === this.H - 1 && (col === 8 || col === 9)) {
      this.exitGym();
      return;
    }

    const trainer = this.activeTrainerAt(col, row);
    if (trainer) {
      this.startTrainerEncounter(trainer);
      return;
    }
    const boulder = this.boulderAt(col, row);
    if (boulder) {
      const result = resolveStrengthPush(boulder.def, deltaCol, deltaRow, key => this.registry.get(key));
      if (result.kind === 'blocked') {
        this.blockedFeedback(result.reason === 'wrong-rune'
          ? t('The rune does not match this hole.', '바위의 문양이 이 홈과 맞지 않는다.', '岩の紋章がこの穴と合わない。')
          : undefined);
        return;
      }
      this.beginMotion(col, row, boulder, result.col, result.row, result.kind === 'fill');
      return;
    }
    if (this.isPlayerCellBlocked(col, row)) {
      this.blockedFeedback();
      return;
    }
    this.beginMotion(col, row);
  }

  private beginMotion(
    toCol: number,
    toRow: number,
    boulder?: RuntimeBoulder,
    boulderToCol?: number,
    boulderToRow?: number,
    fill = false,
  ): void {
    this.motion = {
      fromX: this.px,
      fromY: this.py,
      toX: this.cellX(toCol),
      toY: this.cellY(toRow),
      elapsedMs: 0,
      durationMs: boulder ? 190 : 145,
      boulder,
      boulderFromX: boulder?.graphic.x,
      boulderFromY: boulder?.graphic.y,
      boulderToCol,
      boulderToRow,
      fill,
    };
    this.walkFrame = 1;
    if (boulder) {
      boulder.graphic.setData('strengthMoving3D', 1);
      boulder.graphic.setData('strengthCue3D', 1);
    }
  }

  private updateMotion(delta: number): void {
    const motion = this.motion;
    if (!motion) return;
    motion.elapsedMs += Math.min(delta, 48);
    const progress = Phaser.Math.Clamp(motion.elapsedMs / motion.durationMs, 0, 1);
    const eased = Phaser.Math.Easing.Sine.InOut(progress);
    this.px = Phaser.Math.Linear(motion.fromX, motion.toX, eased);
    this.py = Phaser.Math.Linear(motion.fromY, motion.toY, eased);
    if (motion.boulder && motion.boulderToCol !== undefined && motion.boulderToRow !== undefined) {
      motion.boulder.graphic.setPosition(
        Phaser.Math.Linear(motion.boulderFromX!, this.cellX(motion.boulderToCol), eased),
        Phaser.Math.Linear(motion.boulderFromY!, this.cellY(motion.boulderToRow), eased),
      );
      motion.boulder.graphic.setAngle((motion.boulder.graphic.angle + delta * 0.16) % 360);
    }
    this.redrawPlayer();
    if (progress >= 1) this.completeMotion(motion);
  }

  private completeMotion(motion: GridMotion): void {
    this.motion = null;
    this.px = motion.toX;
    this.py = motion.toY;
    this.walkFrame = 0;
    if (motion.boulder && motion.boulderToCol !== undefined && motion.boulderToRow !== undefined) {
      const boulder = motion.boulder;
      boulder.col = motion.boulderToCol;
      boulder.row = motion.boulderToRow;
      boulder.graphic.setPosition(this.cellX(boulder.col), this.cellY(boulder.row)).setAngle(0);
      this.registry.set(strengthBoulderColKey(boulder.def), boulder.col);
      this.registry.set(strengthBoulderRowKey(boulder.def), boulder.row);
      if (motion.fill) this.registry.set(strengthBoulderFilledFlag(boulder.def), true);
      this.drawBoulderFallback(boulder);
      sfxMove(this);
      this.cameras.main.shake(motion.fill ? 280 : 90, motion.fill ? 0.011 : 0.0025);
      if (motion.fill) {
        this.syncPuzzleVisuals();
        SaveManager.autoSave(this.registry, this.px, this.py, 'DolmoeGymScene');
        const solved = strengthQuarrySolved(key => this.registry.get(key));
        this.showDialogue(solved ? [
          t('The three rune boulders lock into a dolmen pattern!', '세 문양 바위가 고인돌 문양으로 맞물렸다!', '3つの紋章岩が支石墓の形に組み合わさった！'),
          t('The filled holes rise into a stable bridge across the fissure.', '홈을 메운 바위들이 솟아올라 균열을 건너는 단단한 다리가 되었다.', '穴を埋めた岩がせり上がり、裂け目を渡る頑丈な橋になった。'),
        ] : [
          t(
            `${this.runeName(boulder.def.rune)} boulder fitted its matching hole!`,
            `${this.runeName(boulder.def.rune)} 바위가 같은 문양의 홈에 들어갔다!`,
            `${this.runeName(boulder.def.rune)}の岩が同じ紋章の穴にはまった！`,
          ),
        ]);
      }
    }
    this.redrawPlayer();
    this.updateHud();
    this.checkLeaderApproach();
  }

  private boulderAt(col: number, row: number): RuntimeBoulder | undefined {
    return this.boulders.find(boulder => boulder.col === col && boulder.row === row
      && !strengthBoulderFilled(boulder.def, key => this.registry.get(key)));
  }

  private activeTrainerAt(col: number, row: number): GymTrainer | undefined {
    return this.trainers.find(trainer => trainer.col === col && trainer.row === row
      && !trainer.defeated && !this.registry.get(`trainerDefeated_${trainer.key}`));
  }

  /** Legacy and mid-puzzle saves must never resume inside a wall, pit or movable boulder. */
  private sanitizeRestoredPlayerCell(): void {
    const col = this.playerCol();
    const row = this.playerRow();
    const solved = strengthQuarrySolved(key => this.registry.get(key));
    const inSealedChasm = row >= STRENGTH_CHASM_ROWS.min && row <= STRENGTH_CHASM_ROWS.max
      && (!solved || col < 6 || col > 10);
    const onBoulder = STRENGTH_BOULDERS.some(def => {
      if (strengthBoulderFilled(def, key => this.registry.get(key))) return false;
      const position = strengthBoulderPosition(def, key => this.registry.get(key));
      return position.col === col && position.row === row;
    });
    if (col <= 0 || col >= this.W - 1 || row <= 0 || row >= this.H - 1
      || isStrengthQuarryBlock(col, row) || (col === 15 && row === 16)
      || inSealedChasm || onBoulder) {
      this.px = this.cellX(8);
      this.py = this.cellY(16);
    }
  }

  private isPlayerCellBlocked(col: number, row: number): boolean {
    if (col <= 0 || col >= this.W - 1 || row <= 0 || row >= this.H - 1) return true;
    if (isStrengthQuarryBlock(col, row)) return true;
    if (col === 15 && row === 16) return true;
    if (row >= STRENGTH_CHASM_ROWS.min && row <= STRENGTH_CHASM_ROWS.max) {
      return !strengthQuarrySolved(key => this.registry.get(key)) || col < 6 || col > 10;
    }
    return false;
  }

  private blockedFeedback(message?: string): void {
    sfxCancel(this);
    this.cameras.main.shake(70, 0.002);
    if (message && !this.cutsceneActive) this.showDialogue([message]);
  }

  private nearResetPedestal(): boolean {
    return Math.abs(this.playerCol() - 15) + Math.abs(this.playerRow() - 16) <= 1;
  }

  private resetPuzzle(): void {
    sfxConfirm(this);
    for (const boulder of this.boulders) {
      this.registry.remove(strengthBoulderColKey(boulder.def));
      this.registry.remove(strengthBoulderRowKey(boulder.def));
      this.registry.remove(strengthBoulderFilledFlag(boulder.def));
      boulder.col = boulder.def.startCol;
      boulder.row = boulder.def.startRow;
      boulder.graphic.setPosition(this.cellX(boulder.col), this.cellY(boulder.row)).setAngle(0);
      this.drawBoulderFallback(boulder);
    }
    this.registry.remove('dolmoeStrengthBridgeOpened');
    this.syncPuzzleVisuals();
    SaveManager.autoSave(this.registry, this.px, this.py, 'DolmoeGymScene');
    this.cameras.main.shake(220, 0.006);
    this.showDialogue([
      t('The quarry mechanism rumbles. All rune boulders return to their starting marks.', '채석장 장치가 울리며 모든 문양 바위가 시작 위치로 돌아갔다.', '採石場の仕掛けが鳴り、すべての紋章岩が開始位置へ戻った。'),
    ]);
  }

  private syncPuzzleVisuals(): void {
    const solved = strengthQuarrySolved(key => this.registry.get(key));
    for (const boulder of this.boulders) this.drawBoulderFallback(boulder);
    for (const def of STRENGTH_BOULDERS) {
      const hole = this.holes.get(def.id);
      if (hole) this.drawHoleFallback(hole, def);
    }
    this.chasmG.setData('strengthSolved3D', solved ? 1 : 0);
    this.chasmG.setData('strengthCue3D', solved ? 1 : 0);
    this.chasmG.clear();
    this.chasmG.fillStyle(0x050407, 0.94);
    this.chasmG.fillRect(-(this.W - 2) * IT / 2, -IT, (this.W - 2) * IT, 2 * IT);
    if (solved) {
      this.chasmG.fillStyle(0x746d62);
      for (let col = 6; col <= 10; col++) {
        this.chasmG.fillRoundedRect((col + 0.5) * IT - this.W * IT / 2 - 16, -IT + 3, 32, 2 * IT - 6, 8);
      }
    }
    this.updateHud();
  }

  private updateHud(): void {
    if (!this.progressText) return;
    const filled = strengthQuarryFilledCount(key => this.registry.get(key));
    const trainers = this.trainers.filter(trainer => trainer.defeated
      || this.registry.get(`trainerDefeated_${trainer.key}`)).length;
    this.progressText.setText(t(
      `STRENGTH QUARRY · RUNES ${filled}/3 · TRAINERS ${trainers}/2`,
      `괴력 채석장 · 문양 바위 ${filled}/3 · 트레이너 ${trainers}/2`,
      `怪力採石場・紋章岩 ${filled}/3・トレーナー ${trainers}/2`,
    ));
    this.promptText.setText(this.nearResetPedestal()
      ? t('SPACE / A · Reset all boulders', 'SPACE / A · 모든 바위 초기화', 'SPACE / A・すべての岩をリセット')
      : strengthQuarrySolved(key => this.registry.get(key))
        ? t('The boulder bridge is open. Cross to the north dais.', '바위 다리가 열렸다. 북쪽 단상으로 건너가자.', '岩の橋が開いた。北の壇上へ渡ろう。')
        : t('Push each rune boulder into its matching hole.', '문양 바위를 같은 문양의 홈으로 밀어 넣자.', '紋章岩を同じ紋章の穴へ押し込もう。'));
    this.resetG?.setData('strengthCue3D', this.nearResetPedestal() ? 1 : 0);
  }

  private runeName(rune: StrengthRune): string {
    if (rune === 'circle') return t('Circle', '원형', '円');
    if (rune === 'triangle') return t('Triangle', '삼각형', '三角');
    return t('Square', '사각형', '四角');
  }

  private startTrainerEncounter(trainer: GymTrainer): void {
    this.showDialogue([
      t(...trainer.line),
      t(
        `${trainer.name[0]}: Let us see you dig in!`,
        `${trainer.name[1]}: 어디 한번 버텨 봐!`,
        `${trainer.name[2]}：どこまで踏ん張れるか見せろ！`,
      ),
    ], () => {
      this.registry.set('trainerName', t(...trainer.name));
      this.registry.set('trainerKey', trainer.key);
      this.registry.set('trainerPokemon', JSON.stringify(trainer.pokemon));
      this.registry.set('trainerExpPool', trainer.expPool);
      this.registry.set('trainerReturnScene', 'DolmoeGymScene');
      this.registry.set('gymPosX', this.px);
      this.registry.set('gymPosY', this.py);
      this.exiting = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    });
  }

  private checkLeaderApproach(): void {
    if (this.registry.get('dolmoeGymDefeated') || this.playerRow() > 4) return;
    if (!strengthQuarrySolved(key => this.registry.get(key))) return;
    if (!this.registry.get('dolmoeRuinsDone')) {
      if (this.sandolAbsentShown || this.cutsceneActive) return;
      this.sandolAbsentShown = true;
      this.showDialogue([
        t('(The leader\'s dais stands empty. A quarry worker leans on a chisel.)', '(관장의 단상은 비어 있고 채석장 인부가 정에 기대어 있다.)', '（ジムリーダーの壇上は空で、採石場の作業員がタガネにもたれている。）'),
        t('Quarry Worker: Sandol went to the dolmen ruins west of town. Black-coated diggers were prowling there.', '채석장 인부: 산돌 관장님은 마을 서쪽 고인돌 유적으로 갔어. 검은 옷의 발굴꾼들이 돌아다닌다더군.', '採石場の作業員：サンドル館長は町の西にある支石墓遺跡へ行った。黒服の採掘者がうろついているらしい。'),
      ]);
      return;
    }
    const missingTrainer = this.trainers.some(trainer => !trainer.defeated
      && !this.registry.get(`trainerDefeated_${trainer.key}`));
    if (missingTrainer) {
      if (this.sandolAbsentShown || this.cutsceneActive) return;
      this.sandolAbsentShown = true;
      this.showDialogue([
        t('Sandol: The bridge is sound, but your quarry trial is not complete. Face both stoneworkers first.', '산돌: 다리는 단단하지만 채석장 시련은 아직 끝나지 않았다. 두 석공과 먼저 겨뤄라.', 'サンドル：橋は堅いが、採石場の試練はまだ終わっていない。先に二人の石工と戦え。'),
      ]);
      return;
    }
    if (this.cutsceneActive) return;
    this.showDialogue([
      t('(Sandol rests a chisel hammer across one shoulder as the stone bridge settles.)', '(바위 다리가 자리를 잡자 산돌이 정망치를 어깨에 걸친다.)', '（岩の橋が落ち着くと、サンドルはタガネ槌を肩に担ぐ。）'),
      t('Sandol: The mountain does not rush or boast. It simply endures.', '산돌: 산은 서두르지도 뽐내지도 않는다. 그저 견딜 뿐이지.', 'サンドル：山は急がず、誇らず。ただ耐え続ける。'),
      t('Sandol: You shaped the path with your own strength. Now show me whether you crack.', '산돌: 네 힘으로 길을 만들었군. 이제 네가 부서지는지 지켜보겠다.', 'サンドル：自分の力で道を築いたな。次はお前が砕けるか見届けよう。'),
    ], () => this.startLeaderBattle());
  }

  private startLeaderBattle(): void {
    this.registry.set('trainerName', t('Leader Sandol', '관장 산돌', 'ジムリーダー・サンドル'));
    this.registry.set('trainerKey', 'dolmoe-sandol');
    this.registry.set('trainerPokemon', JSON.stringify([
      { id: 464, level: 42 },
      { id: 76, level: 42 },
      { id: 0, level: 43, custom: 'halubang' },
      { id: 0, level: 44, custom: 'mperodactyl' },
    ]));
    this.registry.set('trainerExpPool', 1400);
    this.registry.set('trainerReturnScene', 'DolmoeGymScene');
    this.registry.set('gymPosX', this.px);
    this.registry.set('gymPosY', this.py);
    this.registry.set('trainerBadgeFlag', 'dolmoeGymDefeated');
    this.registry.set('trainerBadgeName', t('Bedrock Badge', '기반암배지', '岩盤バッジ'));
    this.registry.set('trainerBadgeTM', 'Stone Edge');
    this.registry.set('trainerWinLine', t(
      'Sandol: You did not crack. The mountain respects that.',
      '산돌: 부서지지 않았군. 산도 너를 인정할 거다.',
      'サンドル：砕けなかったな。山もお前を認めるだろう。',
    ));
    this.exiting = true;
    this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
  }

  private exitGym(): void {
    this.exiting = true;
    this.registry.set('dolmoeReturnX', 20 * 32);
    this.registry.set('dolmoeReturnY', 16 * 32);
    this.cameras.main.fadeOut(300, 0, 0, 0, () => this.scene.start('DolmoeCityScene'));
  }
}
