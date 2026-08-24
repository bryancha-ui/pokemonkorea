import Phaser from 'phaser';
import { drawGymLeader, drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { vanishesAfterDefeat } from '../data/Villains';
import { playBgm } from '../systems/Music';
import { MOBILE_ACTION_EVENT } from '../systems/TouchControls';
import { sfxConfirm, sfxMove } from '../systems/UiSfx';
import {
  reconcileWorldTreeProgress,
  WORLD_TREE_NODES,
  WORLD_TREE_REQUIRED_BRANCHES,
  type WorldTreeNode,
  worldTreeComplete,
  worldTreeNode,
  worldTreeVisited,
  worldTreeVisitedCount,
  worldTreeVisitedFlag,
} from '../systems/WorldTreeGymPuzzle';
import { t } from '../systems/i18n';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';

interface GymTrainer {
  key: 'forest-chungha' | 'forest-minho';
  name: [string, string, string];
  line: [string, string, string];
  pokemon: { id: number; level: number; custom?: string }[];
  expPool: number;
  defeated: boolean;
}

interface BranchJump {
  from: WorldTreeNode;
  to: WorldTreeNode;
  elapsedMs: number;
  durationMs: number;
}

const IT = 36;
const TREE_CENTER = { col: 8.5, row: 10.4 };

export class ForestGymScene extends Phaser.Scene {
  public interior3D = true;
  public flatTerrain3D = true;
  public clearSight3D = true;
  public noRocks3D = true;
  public onlyNamedBuildings = true;
  public hideLeadCompanion3D = true;

  private playerG!: Phaser.GameObjects.Graphics;
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
  private currentNode!: WorldTreeNode;
  private targetIndex = 0;
  private jump: BranchJump | null = null;
  private branchObjects = new Map<string, Phaser.GameObjects.Graphics>();
  private leaderG!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private mobileActionAt = -Infinity;
  private interactionReadyAt = 0;
  private readonly W = 17;
  private readonly H = 21;
  private readonly onMobileAction = () => { this.mobileActionAt = performance.now(); };

  private trainers: GymTrainer[] = [
    {
      key: 'forest-chungha',
      name: ['Gym Trainer Chungha', '체육관 트레이너 청하', 'ジムトレーナー・チョンハ'],
      line: [
        'Chungha: Every leaf you touch becomes part of the trial. Let us see how firmly you land!',
        '청하: 네가 밟는 잎 하나까지 모두 시련의 일부야. 얼마나 단단히 착지하는지 볼까!',
        'チョンハ：触れた葉の一枚まで試練の一部。どれほど確かに着地できるか見せて！',
      ],
      pokemon: [
        { id: 0, level: 33, custom: 'kudzu' },
        { id: 0, level: 34, custom: 'strawtle' },
      ],
      expPool: 1100,
      defeated: false,
    },
    {
      key: 'forest-minho',
      name: ['Gym Trainer Minho', '체육관 트레이너 민호', 'ジムトレーナー・ミノ'],
      line: [
        'Minho: The highest bough bends in the strongest wind. Mind your footing!',
        '민호: 가장 높은 가지가 가장 거센 바람에 흔들리지. 발밑을 조심해!',
        'ミノ：最も高い枝ほど強い風に揺れる。足元に気をつけろ！',
      ],
      pokemon: [
        { id: 0, level: 34, custom: 'ivelon' },
        { id: 0, level: 35, custom: 'moransae' },
      ],
      expPool: 1140,
      defeated: false,
    },
  ];

  constructor() { super('ForestGymScene'); }

  create(): void {
    playBgm(this, 'gyminterior');
    this.cutsceneActive = false;
    this.exiting = false;
    this.jump = null;
    this.targetIndex = 0;
    this.branchObjects.clear();
    this.hideLeadCompanion3D = true;
    this.input.keyboard?.resetKeys();
    reconcileWorldTreeProgress(
      key => this.registry.get(key),
      (key, value) => this.registry.set(key, value),
    );
    this.trainers.forEach(trainer => {
      trainer.defeated = !!this.registry.get(`trainerDefeated_${trainer.key}`)
        || !!this.registry.get('forestGymDefeated');
    });

    const restoredNode = worldTreeNode(this.registry.get('forestTreeCurrentNode'));
    this.currentNode = restoredNode ?? WORLD_TREE_NODES[0]!;
    this.registry.set('forestTreeCurrentNode', this.currentNode.id);
    this.registry.remove('gymPosX');
    this.registry.remove('gymPosY');
    this.px = this.currentNode.col * IT;
    this.py = this.currentNode.row * IT;

    this.drawGym();
    this.drawWorldTreeProps();
    this.drawTrainers();
    this.createPlayer();
    const summit = worldTreeNode('summit')!;
    this.leaderG = drawGymLeader(this, summit.col * IT, summit.row * IT, {
      body: 0x2a5a2a,
      accent: 0x88cc55,
      label: t('LEADER NOKSAEK', '관장 녹색', 'ジムリーダー・ノクセク'),
      labelColor: '#d5ffbd',
      skin: 0xa88a55,
      hair: 0x3a5a2a,
      trainerKey: 'forest-noksaek',
    });
    this.leaderG.setData('characterElevation3D', summit.elevation);
    this.setupInput();
    this.createHud();
    this.cameras.main.setBounds(0, 0, this.W * IT, this.H * IT);
    this.cameras.main.startFollow(this.playerG, true, 0.13, 0.13);
    this.cameras.main.fadeIn(300);
    this.dialog = new DialogBox(this, 1280, 720);
    this.interactionReadyAt = this.time.now + 450;
    this.refreshTargets();
    this.redrawPlayer();

    if (this.registry.get('forestGymDefeated') && !this.registry.get('noksaekFarewell')) {
      this.registry.set('noksaekFarewell', true);
      this.showDialogue([
        t('Noksaek: The roots accept you. Well fought.', '녹색: 뿌리가 너를 받아들였구나. 훌륭한 승부였다.', 'ノクセク：根がお前を受け入れた。見事な勝負だった。'),
        t('Noksaek: The seventh seal lies near the eastern coast — the Sunrise Cliffs.', '녹색: 일곱 번째 봉인은 동쪽 해안, 일출 절벽 가까이에 있다.', 'ノクセク：七つ目の封印は東の海岸、日の出の崖の近くにある。'),
        t('Return to the root branch and press DOWN to leave.', '뿌리 가지로 돌아가 아래 방향을 누르면 나갈 수 있다.', '根元の枝へ戻り、下方向を押すと外へ出られる。'),
      ]);
      return;
    }

    if (!this.registry.get('forestTreeIntroSeen')) {
      this.registry.set('forestTreeIntroSeen', true);
      this.showDialogue([
        t('You enter the World Tree Canopy!', '세계수의 수관에 들어섰다!', '世界樹の樹冠へ足を踏み入れた！'),
        t(
          'Choose a connected branch with LEFT or RIGHT, then press SPACE / A to jump.',
          '좌우로 연결된 가지를 고른 뒤 SPACE / A를 눌러 점프하자.',
          '左右でつながった枝を選び、SPACE / Aでジャンプしよう。',
        ),
        t(
          'Some branches hold Gym Trainers and others are empty. Land on all nine branches to open the summit.',
          '어떤 가지에는 체육관 트레이너가 있고 어떤 가지는 비어 있다. 아홉 가지를 모두 밟으면 정상이 열린다.',
          'ジムトレーナーがいる枝も、空の枝もある。9本すべてに着地すると頂上が開く。',
        ),
        t('Your lead Pokémon will wait safely at the roots during the climb.', '선두 포켓몬은 오르는 동안 뿌리 아래에서 안전하게 기다린다.', '先頭のポケモンは登っている間、根元で安全に待っている。'),
      ], () => this.checkArrivalState());
    } else {
      this.time.delayedCall(320, () => this.checkArrivalState());
    }
  }

  private showDialogue(lines: string[], done?: () => void): void {
    this.cutsceneActive = true;
    this.promptText?.setVisible(false);
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
    g.fillGradientStyle(0x071d12, 0x071d12, 0x1c4a27, 0x1c4a27, 1);
    g.fillRect(0, 0, width, height);

    // Distant canopy rings make the room read as the inside of one colossal tree.
    for (let radius = 330; radius >= 80; radius -= 42) {
      const green = radius % 84 === 0 ? 0x245f31 : 0x194c28;
      g.lineStyle(20, green, 0.42);
      g.strokeCircle(TREE_CENTER.col * IT, TREE_CENTER.row * IT, radius);
    }
    g.fillStyle(0x5b351d);
    g.fillEllipse(TREE_CENTER.col * IT, TREE_CENTER.row * IT, IT * 3.4, IT * 8.8);
    g.fillStyle(0x80512c, 0.8);
    g.fillEllipse(TREE_CENTER.col * IT, TREE_CENTER.row * IT, IT * 2.4, IT * 7.5);

    // Draw every legal jump as a vine behind the authored branches.
    const drawn = new Set<string>();
    for (const node of WORLD_TREE_NODES) {
      for (const targetId of node.connections) {
        const key = [node.id, targetId].sort().join(':');
        if (drawn.has(key)) continue;
        drawn.add(key);
        const target = worldTreeNode(targetId)!;
        g.lineStyle(8, 0x704526, 0.88);
        g.lineBetween(node.col * IT, node.row * IT, target.col * IT, target.row * IT);
        g.lineStyle(2, 0x9ac768, 0.68);
        g.lineBetween(node.col * IT, node.row * IT, target.col * IT, target.row * IT);
      }
    }

    g.fillStyle(0x0b2614);
    g.fillRect(0, 0, width, IT * 0.75);
    g.fillRect(0, 0, IT * 0.7, height);
    g.fillRect(width - IT * 0.7, 0, IT * 0.7, height);
    g.fillRect(0, height - IT * 0.75, width, IT * 0.75);
    g.fillStyle(0x754628);
    g.fillRect(7.5 * IT, height - IT * 0.75, 2 * IT, IT * 0.75);

    const textureKey = '__forestWorldTreeGymMap__';
    if (this.textures.exists(textureKey)) this.textures.remove(textureKey);
    g.generateTexture(textureKey, width, height);
    g.destroy();
    this.add.image(0, 0, textureKey).setOrigin(0).setDepth(0);

    this.add.text(width / 2, 23, t('WORLD TREE CANOPY', '세계수 수관', '世界樹の樹冠'), {
      fontSize: '12px', color: '#dbffc9', fontStyle: 'bold', stroke: '#06170c', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(6);
  }

  private drawWorldTreeProps(): void {
    const trunk = this.add.graphics().setDepth(2).setPosition(TREE_CENTER.col * IT, TREE_CENTER.row * IT);
    trunk.fillStyle(0x5b351d); trunk.fillEllipse(0, 0, 76, 190);
    trunk.lineStyle(5, 0x80512c); trunk.strokeEllipse(0, 0, 62, 174);
    trunk.setData('worldTreeProp3D', { kind: 'trunk', length: 7.7, width: 2.2, yaw: 0, accent: 0xa8ffc1 });

    for (const node of WORLD_TREE_NODES) {
      const prop = this.add.graphics().setDepth(node.id === 'summit' ? 5 : 4);
      prop.setPosition(node.col * IT, node.row * IT);
      const dx = node.col - TREE_CENTER.col;
      const dz = node.row - TREE_CENTER.row;
      const yaw = Math.atan2(dx, dz);
      const angle = Phaser.Math.RadToDeg(Math.atan2(dz, dx));
      prop.setAngle(angle);
      prop.setData('worldTreeProp3D', {
        kind: node.id === 'summit' ? 'summit' : 'branch',
        length: node.id === 'root' ? 3.1 : 2.3 + node.elevation * 0.08,
        width: node.id === 'summit' ? 2.7 : node.id === 'root' ? 1.6 : 1.28,
        yaw,
        accent: node.id === 'summit' ? 0xdfff8a : 0x77e887,
      });
      this.branchObjects.set(node.id, prop);
      this.drawBranchFallback(node, prop);

      if (node.required) {
        this.add.text(node.col * IT, node.row * IT + 23, String(node.index), {
          fontSize: '8px', color: '#efffe8', backgroundColor: '#102b17cc', padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(7).setData('no3d', true);
      }
    }
  }

  private drawBranchFallback(node: WorldTreeNode, prop: Phaser.GameObjects.Graphics): void {
    const visited = node.required
      ? worldTreeVisited(node, key => this.registry.get(key))
      : node.id === 'root' || node.id === this.currentNode.id || !!this.registry.get('forestGymDefeated');
    const selected = this.selectedTarget()?.id === node.id;
    const trainerActive = !!node.trainerKey && !this.registry.get(`trainerDefeated_${node.trainerKey}`);
    prop.clear();
    if (node.id === 'summit') {
      prop.fillStyle(0x6b472b); prop.fillEllipse(0, 0, 96, 62);
      prop.fillStyle(worldTreeComplete(key => this.registry.get(key)) ? 0x78b85a : 0x506640);
      prop.fillEllipse(0, -4, 82, 49);
    } else {
      prop.fillStyle(0x704526); prop.fillRoundedRect(-52, -13, 104, 26, 12);
      prop.fillStyle(visited ? 0x72ad54 : 0x426f3a); prop.fillEllipse(0, -3, 52, 30);
    }
    if (trainerActive) {
      prop.lineStyle(4, 0xffc95f, 0.95); prop.strokeCircle(0, -2, 23);
    }
    if (selected) {
      prop.lineStyle(5, 0xfff37b, 1); prop.strokeEllipse(0, -2, node.id === 'summit' ? 108 : 66, node.id === 'summit' ? 72 : 48);
    }
    prop.setData('worldTreeVisited3D', visited ? 1 : 0);
    prop.setData('worldTreeSelected3D', selected ? 1 : 0);
    prop.setData('worldTreeElevation3D', node.elevation - 0.36);
    prop.setData('worldTreeTrainer3D', trainerActive ? 1 : 0);
    prop.setData('worldTreeCue3D', selected ? 1 : 0);
  }

  private drawTrainers(): void {
    for (const trainer of this.trainers) {
      if (trainer.defeated && vanishesAfterDefeat(trainer.key)) continue;
      const node = WORLD_TREE_NODES.find(candidate => candidate.trainerKey === trainer.key)!;
      const x = node.col * IT;
      const y = node.row * IT;
      const g = this.add.graphics().setDepth(11).setPosition(x, y - 4);
      g.setData('characterElevation3D', node.elevation);
      const accent = trainer.key === 'forest-chungha' ? 0x5cae50 : 0x2f7d4e;
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(accent); g.fillRect(-7, -8, 14, 11);
      g.fillStyle(accent); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x222222); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
      g.fillStyle(0x1a2a10); g.fillRect(-6, -20, 12, 4);
      g.fillStyle(0x000000); g.fillRect(-3, -14, 2, 2); g.fillRect(1, -14, 2, 2);
      this.add.text(x, y - 34, this.trainerShortName(trainer), {
        fontSize: '8px', color: '#d7ffc0', backgroundColor: '#07190dbb', padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(12)
        .setData('characterLabelTarget3D', g);
    }
  }

  private trainerShortName(trainer: GymTrainer): string {
    if (trainer.key === 'forest-chungha') return t('Chungha', '청하', 'チョンハ');
    return t('Minho', '민호', 'ミノ');
  }

  private createPlayer(): void {
    this.playerG = this.add.graphics().setDepth(20);
    this.playerG.setData('characterElevation3D', this.currentNode.elevation);
    this.redrawPlayer();
  }

  private redrawPlayer(scale = 1, tilt = 0): void {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py).setScale(scale).setAngle(tilt);
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
      if (!this.cutsceneActive && !this.jump) this.scene.launch('MenuScene');
    });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => {
      if (!this.cutsceneActive && !this.jump) this.scene.launch('MenuScene');
    });
    window.addEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(MOBILE_ACTION_EVENT, this.onMobileAction);
      this.hideLeadCompanion3D = false;
    });
  }

  private createHud(): void {
    const panel = this.add.rectangle(640, 62, 570, 86, 0x071c10, 0.9)
      .setStrokeStyle(2, 0x8ad36c).setScrollFactor(0);
    this.progressText = this.add.text(640, 38, '', {
      fontSize: '15px', color: '#e1ffd3', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0);
    this.targetText = this.add.text(640, 67, '', {
      fontSize: '12px', color: '#fff08c', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0);
    this.promptText = this.add.text(640, 111, '', {
      fontSize: '13px', color: '#ffffff', backgroundColor: '#06150cdd', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0);
    this.add.container(0, 0, [panel, this.progressText, this.targetText, this.promptText])
      .setDepth(1000).setScrollFactor(0);
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
    if (this.jump) {
      this.updateJump(delta);
      return;
    }

    const leftPressed = Phaser.Input.Keyboard.JustDown(this.cursors.left)
      || Phaser.Input.Keyboard.JustDown(this.wasd.left);
    const rightPressed = Phaser.Input.Keyboard.JustDown(this.cursors.right)
      || Phaser.Input.Keyboard.JustDown(this.wasd.right);
    const downPressed = Phaser.Input.Keyboard.JustDown(this.cursors.down)
      || Phaser.Input.Keyboard.JustDown(this.wasd.down);
    if (leftPressed) this.cycleTarget(-1);
    else if (rightPressed) this.cycleTarget(1);

    if (downPressed && this.currentNode.id === 'root') {
      this.exitGym();
      return;
    }
    if (actionPressed && this.time.now >= this.interactionReadyAt) this.tryJumpToSelected();
  }

  private connectedTargets(): WorldTreeNode[] {
    return this.currentNode.connections.map(id => worldTreeNode(id)!).filter(Boolean);
  }

  private selectedTarget(): WorldTreeNode | undefined {
    const targets = this.connectedTargets();
    return targets.length ? targets[Phaser.Math.Wrap(this.targetIndex, 0, targets.length)] : undefined;
  }

  private cycleTarget(direction: number): void {
    const targets = this.connectedTargets();
    if (!targets.length) return;
    this.targetIndex = Phaser.Math.Wrap(this.targetIndex + direction, 0, targets.length);
    const target = this.selectedTarget();
    if (target) this.facing = target.col < this.currentNode.col ? 2 : 3;
    sfxMove(this);
    this.refreshTargets();
    this.redrawPlayer();
  }

  private refreshTargets(): void {
    const targets = this.connectedTargets();
    this.targetIndex = targets.length ? Phaser.Math.Wrap(this.targetIndex, 0, targets.length) : 0;
    for (const node of WORLD_TREE_NODES) {
      const prop = this.branchObjects.get(node.id);
      if (prop) this.drawBranchFallback(node, prop);
    }
    this.updateHud();
  }

  private updateHud(): void {
    if (!this.progressText) return;
    const visited = worldTreeVisitedCount(key => this.registry.get(key));
    const target = this.selectedTarget();
    const trainerCount = this.trainers.filter(trainer => trainer.defeated
      || this.registry.get(`trainerDefeated_${trainer.key}`)).length;
    this.progressText.setText(t(
      `WORLD TREE · BRANCHES ${visited}/${WORLD_TREE_REQUIRED_BRANCHES.length} · TRAINERS ${trainerCount}/2`,
      `세계수 · 가지 ${visited}/${WORLD_TREE_REQUIRED_BRANCHES.length} · 트레이너 ${trainerCount}/2`,
      `世界樹・枝 ${visited}/${WORLD_TREE_REQUIRED_BRANCHES.length}・トレーナー ${trainerCount}/2`,
    ));
    if (this.jump) {
      this.targetText.setText(t('Jumping through the canopy…', '수관 사이를 점프하는 중…', '樹冠をジャンプ中…'));
      this.promptText.setVisible(false);
      return;
    }
    const targetName = target ? this.nodeName(target) : '—';
    const targetVisited = target
      ? (target.required
          ? worldTreeVisited(target, key => this.registry.get(key))
          : target.id === 'root' || target.id === this.currentNode.id || !!this.registry.get('forestGymDefeated'))
      : false;
    const lockedSummit = target?.id === 'summit' && !this.canEnterSummit();
    this.targetText.setText(lockedSummit
      ? t(`Target: ${targetName} · SEALED`, `목표: ${targetName} · 봉인됨`, `目標：${targetName}・封印中`)
      : t(`Target: ${targetName}${targetVisited ? ' · VISITED' : ''}`, `목표: ${targetName}${targetVisited ? ' · 방문함' : ''}`, `目標：${targetName}${targetVisited ? '・訪問済み' : ''}`));
    this.promptText.setText(this.currentNode.id === 'root'
      ? t('← / → Select · SPACE / A Jump · ↓ Exit', '← / → 선택 · SPACE / A 점프 · ↓ 나가기', '← / → 選択・SPACE / A ジャンプ・↓ 出る')
      : t('← / → Select branch · SPACE / A Jump', '← / → 가지 선택 · SPACE / A 점프', '← / → 枝を選択・SPACE / A ジャンプ')).setVisible(true);
  }

  private nodeName(node: WorldTreeNode): string {
    const labels: Record<string, [string, string, string]> = {
      root: ['Root Bough', '뿌리 가지', '根元の枝'],
      'lower-left': ['Lower West Bough', '아래 서쪽 가지', '下層西の枝'],
      'lower-right': ['Lower East Bough', '아래 동쪽 가지', '下層東の枝'],
      'middle-left': ['Middle West Bough', '중간 서쪽 가지', '中層西の枝'],
      'middle-center': ['Heartwood Bough', '심재 가지', '心材の枝'],
      'middle-right': ['Middle East Bough', '중간 동쪽 가지', '中層東の枝'],
      'upper-left': ['Upper West Bough', '위 서쪽 가지', '上層西の枝'],
      'upper-right': ['Upper East Bough', '위 동쪽 가지', '上層東の枝'],
      'crown-left': ['Crown West Bough', '수관 서쪽 가지', '樹冠西の枝'],
      'crown-right': ['Crown East Bough', '수관 동쪽 가지', '樹冠東の枝'],
      summit: ['World Tree Summit', '세계수 정상', '世界樹の頂'],
    };
    return t(...labels[node.id]!);
  }

  private canEnterSummit(): boolean {
    return worldTreeComplete(key => this.registry.get(key))
      && this.trainers.every(trainer => trainer.defeated
        || !!this.registry.get(`trainerDefeated_${trainer.key}`));
  }

  private tryJumpToSelected(): void {
    const target = this.selectedTarget();
    if (!target) return;
    if (target.id === 'summit' && !this.canEnterSummit()) {
      const remaining = WORLD_TREE_REQUIRED_BRANCHES.length
        - worldTreeVisitedCount(key => this.registry.get(key));
      const trainerRemaining = this.trainers.filter(trainer => !trainer.defeated
        && !this.registry.get(`trainerDefeated_${trainer.key}`)).length;
      this.showDialogue([
        t('The summit vines are still tightly woven.', '정상으로 향하는 덩굴이 아직 단단히 얽혀 있다.', '頂上へ続くツタはまだ固く絡み合っている。'),
        t(
          `${remaining} branches and ${trainerRemaining} Trainers remain. Explore every fork of the World Tree.`,
          `남은 가지 ${remaining}개, 트레이너 ${trainerRemaining}명. 세계수의 모든 갈림길을 탐색하자.`,
          `残りの枝${remaining}本、トレーナー${trainerRemaining}人。世界樹の分かれ道をすべて探索しよう。`,
        ),
      ]);
      return;
    }
    this.startJump(target);
  }

  private startJump(target: WorldTreeNode): void {
    const distance = Math.hypot(target.col - this.currentNode.col, target.row - this.currentNode.row);
    this.jump = {
      from: this.currentNode,
      to: target,
      elapsedMs: 0,
      durationMs: Phaser.Math.Clamp(470 + distance * 72, 640, 930),
    };
    this.facing = target.col < this.currentNode.col ? 2 : target.col > this.currentNode.col ? 3 : target.row < this.currentNode.row ? 1 : 0;
    this.playerG.setData('characterJumping3D', true);
    this.promptText.setVisible(false);
    sfxConfirm(this);
    this.updateHud();
  }

  private updateJump(delta: number): void {
    const jump = this.jump;
    if (!jump) return;
    jump.elapsedMs += Math.min(delta, 48);
    const progress = Phaser.Math.Clamp(jump.elapsedMs / jump.durationMs, 0, 1);
    const eased = Phaser.Math.Easing.Sine.InOut(progress);
    const arc = Math.sin(progress * Math.PI);
    this.px = Phaser.Math.Linear(jump.from.col * IT, jump.to.col * IT, eased);
    this.py = Phaser.Math.Linear(jump.from.row * IT, jump.to.row * IT, eased);
    const elevation = Phaser.Math.Linear(jump.from.elevation, jump.to.elevation, eased) + arc * 1.05;
    this.playerG.setData('characterElevation3D', elevation);
    this.redrawPlayer(1 + arc * 0.12, (jump.to.col - jump.from.col) * arc * 1.35);
    if (progress >= 1) this.completeJump(jump.to);
  }

  private completeJump(target: WorldTreeNode): void {
    this.jump = null;
    this.currentNode = target;
    this.targetIndex = 0;
    this.px = target.col * IT;
    this.py = target.row * IT;
    this.playerG.setData('characterJumping3D', false);
    this.playerG.setData('characterElevation3D', target.elevation);
    this.playerG.setScale(1).setAngle(0);
    this.registry.set('forestTreeCurrentNode', target.id);
    const firstVisit = target.required && !worldTreeVisited(target, key => this.registry.get(key));
    if (firstVisit) {
      this.registry.set(worldTreeVisitedFlag(target), true);
      SaveManager.autoSave(this.registry, this.px, this.py, 'ForestGymScene');
    }
    this.cameras.main.shake(120, 0.003);
    sfxMove(this);
    this.refreshTargets();
    this.redrawPlayer();

    if (target.id === 'summit') {
      this.checkLeaderApproach();
      return;
    }
    this.checkArrivalState();
  }

  private checkArrivalState(): void {
    if (this.checkTrainerAtCurrentNode()) return;
    if (!this.canEnterSummit() || this.registry.get('forestTreeCrownOpened')) return;
    this.registry.set('forestTreeCrownOpened', true);
    SaveManager.autoSave(this.registry, this.px, this.py, 'ForestGymScene');
    this.showDialogue([
      t('Every branch answers with a deep wooden chime.', '모든 가지에서 깊은 나무 울림이 퍼진다.', 'すべての枝から深い木の音が響く。'),
      t('The vines around the World Tree Summit unfurl!', '세계수 정상을 감싼 덩굴이 풀렸다!', '世界樹の頂を包むツタがほどけた！'),
    ]);
  }

  private checkTrainerAtCurrentNode(): boolean {
    const trainerKey = this.currentNode.trainerKey;
    if (!trainerKey) return false;
    const trainer = this.trainers.find(candidate => candidate.key === trainerKey)!;
    if (trainer.defeated || this.registry.get(`trainerDefeated_${trainer.key}`)) {
      trainer.defeated = true;
      this.refreshTargets();
      return false;
    }
    this.showDialogue([
      t(...trainer.line),
      t(
        `${trainer.name[0]}: Take root and fight!`,
        `${trainer.name[1]}: 뿌리를 내리고 승부하자!`,
        `${trainer.name[2]}：根を張って勝負だ！`,
      ),
    ], () => this.startTrainerBattle(trainer));
    return true;
  }

  private startTrainerBattle(trainer: GymTrainer): void {
    this.registry.set('trainerName', t(...trainer.name));
    this.registry.set('trainerKey', trainer.key);
    this.registry.set('trainerPokemon', JSON.stringify(trainer.pokemon));
    this.registry.set('trainerExpPool', trainer.expPool);
    this.registry.set('trainerReturnScene', 'ForestGymScene');
    this.registry.set('gymPosX', this.px);
    this.registry.set('gymPosY', this.py);
    this.registry.set('forestTreeCurrentNode', this.currentNode.id);
    this.exiting = true;
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
  }

  private checkLeaderApproach(): void {
    if (this.currentNode.id !== 'summit' || this.registry.get('forestGymDefeated')) return;
    if (!this.canEnterSummit()) return;
    this.showDialogue([
      t('(At the highest crown, an ancient keeper rises from a throne of living bark.)', '(가장 높은 수관에서 오래된 수피의 왕좌에 앉은 수호자가 일어선다.)', '（最も高い樹冠で、生きた樹皮の玉座から古き守人が立ち上がる。）'),
      t('Noksaek: I am Noksaek, Keeper of the Living Temple. Every branch remembers your step.', '녹색: 나는 생명 신전의 수호자 녹색. 모든 가지가 네 발걸음을 기억하고 있다.', 'ノクセク：私は生命神殿の守人ノクセク。すべての枝がお前の足跡を覚えている。'),
      t('Noksaek: Grass is patience that splits stone. Show me the strength of your roots.', '녹색: 풀은 바위를 가르는 인내다. 네 뿌리의 강함을 보여 다오.', 'ノクセク：草は岩を割る忍耐。その根の強さを見せてみよ。'),
    ], () => this.startLeaderBattle());
  }

  private startLeaderBattle(): void {
    this.registry.set('trainerName', t('Leader Noksaek', '관장 녹색', 'ジムリーダー・ノクセク'));
    this.registry.set('trainerKey', 'forest-noksaek');
    this.registry.set('trainerPokemon', JSON.stringify([
      { id: 0, level: 35, custom: 'gorcobat' },
      { id: 0, level: 35, custom: 'kudzu' },
      { id: 0, level: 36, custom: 'strawtle' },
      { id: 0, level: 37, custom: 'ghograss' },
      { id: 407, level: 38 },
    ]));
    this.registry.set('trainerExpPool', 2000);
    this.registry.set('trainerReturnScene', 'ForestGymScene');
    this.registry.set('gymPosX', this.px);
    this.registry.set('gymPosY', this.py);
    this.registry.set('forestTreeCurrentNode', 'summit');
    this.registry.set('trainerBadgeFlag', 'forestGymDefeated');
    this.registry.set('trainerBadgeName', t('Ancient Keeper Badge', '고대수호배지', '古代守護バッジ'));
    this.registry.set('trainerBadgeTM', 'Wood Hammer');
    this.registry.set('trainerWinLine', t(
      'Noksaek: The forest has spoken. You are worthy to pass.',
      '녹색: 숲이 답했구나. 너라면 지나갈 자격이 있다.',
      'ノクセク：森が答えた。お前には先へ進む資格がある。',
    ));
    this.exiting = true;
    this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
  }

  private exitGym(): void {
    this.exiting = true;
    this.registry.set('forestCityReturnX', 23 * 32 + 16);
    this.registry.set('forestCityReturnY', 11 * 32 + 16);
    this.cameras.main.fadeOut(300, 0, 0, 0, () => this.scene.start('ForestCityScene'));
  }
}
