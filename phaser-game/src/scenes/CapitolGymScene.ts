import Phaser from 'phaser';
import { drawTrainerBody, markProceduralCharacter3D, playerDesign } from '../data/CharacterSprite';
import { playBgm } from '../systems/Music';
import { t, tr } from '../systems/i18n';
import {
  SHADOW_GYM_ROOMS,
  shadowCandidateKind,
  shadowCloneFlag,
  shadowRoomClearFlag,
  type ShadowGymRoom,
  type ShadowGymPokemon,
} from '../systems/ShadowGymPuzzle';
import { SaveManager } from '../utils/SaveManager';
import { DialogBox } from '../ui/DialogBox';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';

const IT = 36;
const W = 16;
const H = 14;
const CANDIDATE_POSITIONS = [
  { col: 4, row: 6.5 },
  { col: 8, row: 5.5 },
  { col: 12, row: 6.5 },
] as const;

type EntrySide = 'north' | 'south';

function localized(en: string, ko: string, ja: string): string {
  return t(en, ko, ja);
}

function roomTitle(stage: number): string {
  const titles = [
    localized('Hall of Fading Shadows', '흐린 그림자의 방', '薄影の間'),
    localized('Hall of Mirrors', '거울 그림자의 방', '鏡影の間'),
    localized('Hall of the Black Veil', '검은 장막의 방', '黒い帳の間'),
    localized('Sanctum of the True Shadow', '진짜 그림자의 성소', '真影の聖域'),
  ];
  return titles[stage - 1] ?? titles[0];
}

/**
 * One reusable room implementation powers four independently registered Phaser
 * scenes. Each room owns one real trainer and two visually identical clones;
 * touching a clone tears the illusion open into a genuine wild encounter.
 */
abstract class ShadowGymRoomScene extends Phaser.Scene {
  public interior3D = true;

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
  private walkTimer = 0;
  private entrySide: EntrySide = 'south';
  private encounterReadyAt = 0;
  private gateHintShown = false;
  private readonly speed = 100;

  protected constructor(private readonly room: ShadowGymRoom) {
    super(room.sceneKey);
  }

  init(data?: { entry?: EntrySide }): void {
    this.entrySide = data?.entry ?? 'south';
  }

  create(): void {
    playBgm(this, 'gyminterior');
    this.cutsceneActive = false;
    this.exiting = false;
    this.gateHintShown = false;
    this.input.keyboard?.resetKeys();

    // Battle scenes leave these coordinates only when returning to this exact
    // room. Use that signal before restorePosition consumes it so a level-up
    // evolution happens after the battle that earned it, not after an unrelated
    // Potion is later selected from the menu.
    const returnedFromBattle = Number.isFinite(this.registry.get('gymPosX'))
      && Number.isFinite(this.registry.get('gymPosY'));
    this.restorePosition();
    this.drawRoom();
    this.drawCandidates();
    this.createPlayer();
    this.setupInput();

    this.cameras.main.setBounds(0, 0, W * IT, H * IT);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.cameras.main.fadeIn(260);
    this.dialog = new DialogBox(this, 1280, 720);
    this.encounterReadyAt = this.time.now + 650;

    this.registry.set('shadowGymCurrentRoom', this.room.stage);
    this.rememberPosition();
    this.showRoomIntroduction();
    if (returnedFromBattle) this.time.delayedCall(300, () => maybeLaunchEvolution(this));
  }

  private restorePosition(): void {
    this.px = 8 * IT + IT / 2;
    this.py = this.entrySide === 'north' ? 2.7 * IT : (H - 2.7) * IT;
    this.facing = this.entrySide === 'north' ? 0 : 1;

    const battleX = this.registry.get('gymPosX');
    const battleY = this.registry.get('gymPosY');
    const resumeXKey = `${this.room.sceneKey}ReturnX`;
    const resumeYKey = `${this.room.sceneKey}ReturnY`;
    const resumeX = this.registry.get(resumeXKey);
    const resumeY = this.registry.get(resumeYKey);
    if (Number.isFinite(battleX) && Number.isFinite(battleY)) {
      this.px = Number(battleX);
      this.py = Number(battleY);
    } else if (Number.isFinite(resumeX) && Number.isFinite(resumeY)) {
      this.px = Number(resumeX);
      this.py = Number(resumeY);
    }
    this.registry.remove('gymPosX');
    this.registry.remove('gymPosY');
    this.registry.remove(resumeXKey);
    this.registry.remove(resumeYKey);
  }

  private rememberPosition(): void {
    // Keep menu/manual saves and battle victory saves anchored to this exact room,
    // even when the player's automatic-save preference is disabled.
    this.registry.set('lastScene', this.room.sceneKey);
    this.registry.set('lastX', this.px);
    this.registry.set('lastY', this.py);
    SaveManager.autoSave(this.registry, this.px, this.py, this.room.sceneKey);
  }

  private showRoomIntroduction(): void {
    const seenKey = `shadowGymRoomSeen_${this.room.sceneKey}`;
    if (this.registry.get(seenKey) || this.registry.get('gymLeaderDefeated')) return;
    this.registry.set(seenKey, true);
    this.cutsceneActive = true;

    const intros: string[][] = [
      [
        localized('You enter the Shadow Clone Trial.', '그림자분신술의 시련에 들어섰다.', '影分身の試練へ足を踏み入れた。'),
        localized('Three identical silhouettes wait in separate chambers. Only one in each room is real.', '각 방마다 똑같은 그림자 셋이 기다린다. 그중 진짜는 단 하나뿐이다.', '各部屋には同じ姿の影が三つ。だが本物は一人だけだ。'),
        localized('Touch a false shadow and the Pokémon hidden inside it will attack.', '가짜 분신에 닿으면 그 안에 숨은 야생 포켓몬이 덤벼든다.', '偽の影に触れると、その中に潜む野生のポケモンが襲いかかる。'),
      ],
      [localized('The second room reflects every movement. Find Jaemin among the copies.', '두 번째 방은 모든 움직임을 비춘다. 분신 속에서 재민을 찾아라.', '第二の部屋はあらゆる動きを映す。分身の中からジェミンを探せ。')],
      [localized('A black veil swallows every clue. Yuna is somewhere in the darkness.', '검은 장막이 모든 단서를 삼킨다. 유나는 이 어둠 속 어딘가에 있다.', '黒い帳がすべての手掛かりを奪う。ユナはこの闇のどこかにいる。')],
      [localized('Only one of these shadows is Leader Jin. The others are his final decoys.', '이 그림자 중 하나만이 관장 진이다. 나머지는 마지막 분신이다.', 'この影の一つだけがジン館長。残りは最後の分身だ。')],
    ];
    this.dialog.show(intros[this.room.stage - 1] ?? intros[0], () => {
      this.cutsceneActive = false;
      this.encounterReadyAt = this.time.now + 450;
    });
  }

  private drawRoom(): void {
    const width = W * IT;
    const height = H * IT;
    const g = this.add.graphics().setDepth(0);
    const floorA = [0x17142c, 0x18132f, 0x111225, 0x0d0b1d][this.room.stage - 1];
    const floorB = [0x21183b, 0x241742, 0x19132f, 0x17102b][this.room.stage - 1];
    const accent = [0x8d52d9, 0xab65f0, 0x7040bb, 0xc07aff][this.room.stage - 1];

    g.fillStyle(floorA); g.fillRect(0, 0, width, height);
    for (let row = 1; row < H - 1; row++) {
      for (let col = 1; col < W - 1; col++) {
        g.fillStyle((row + col + this.room.stage) % 2 === 0 ? floorA : floorB);
        g.fillRect(col * IT, row * IT, IT, IT);
      }
    }

    // The three converging paths make every silhouette equally plausible.
    g.lineStyle(3, accent, 0.34);
    for (const pos of CANDIDATE_POSITIONS) {
      g.beginPath();
      g.moveTo(width / 2, (H - 1) * IT);
      g.lineTo(pos.col * IT + IT / 2, pos.row * IT + IT / 2);
      g.lineTo(width / 2, IT);
      g.strokePath();
    }

    g.fillStyle(0x070713);
    g.fillRect(0, 0, width, IT);
    g.fillRect(0, 0, IT, height);
    g.fillRect(width - IT, 0, IT, height);
    g.fillRect(0, height - IT, width, IT);

    // North seal and south threshold.
    g.fillStyle(this.roomCleared() ? 0x9a62e8 : 0x30134f);
    g.fillRect(7 * IT, 0, 2 * IT, IT);
    g.lineStyle(2, this.roomCleared() ? 0xe5c8ff : 0x6c388e, 0.9);
    g.strokeRect(7 * IT, 0, 2 * IT, IT);
    g.fillStyle(0x5b3492); g.fillRect(7 * IT, height - IT, 2 * IT, IT);

    // Shadow columns and mirrored pools give every room its own enclosed stage.
    for (const col of [2, 13]) {
      for (const row of [2, 8]) {
        g.fillStyle(0x26103f); g.fillRect(col * IT, row * IT, IT, IT * 2);
        g.lineStyle(2, accent, 0.7); g.strokeRect(col * IT, row * IT, IT, IT * 2);
        g.fillStyle(accent, 0.12); g.fillCircle(col * IT + IT / 2, row * IT, IT * 0.9);
      }
    }

    const textureKey = `__shadowGymRoom_${this.room.stage}__`;
    if (this.textures.exists(textureKey)) this.textures.remove(textureKey);
    g.generateTexture(textureKey, width, height);
    g.destroy();
    this.add.image(0, 0, textureKey).setOrigin(0, 0).setDepth(0);

    this.add.text(width / 2, 12, roomTitle(this.room.stage), {
      fontSize: '12px', color: '#ead8ff', fontStyle: 'bold',
      stroke: '#080410', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(8);
    this.add.text(width / 2, 31,
      localized(`SHADOW TRIAL ${this.room.stage} / 4`, `그림자 시련 ${this.room.stage} / 4`, `影の試練 ${this.room.stage} / 4`), {
        fontSize: '8px', color: '#a987d2', backgroundColor: '#08041099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(8);

    if (this.roomCleared()) {
      this.add.text(width / 2, IT * 1.55,
        this.room.nextScene
          ? localized('▲ PASSAGE OPEN ▲', '▲ 다음 방 개방 ▲', '▲ 次の間へ ▲')
          : localized('THE TRUE SHADOW HAS YIELDED', '진짜 그림자가 패배했다', '真影は敗れた'), {
          fontSize: '9px', color: '#e8cfff', fontStyle: 'bold',
          backgroundColor: '#180b2acc', padding: { x: 5, y: 3 },
        }).setOrigin(0.5).setDepth(9);
    }

    this.drawShadowMist(accent);
  }

  private drawShadowMist(accent: number): void {
    for (let i = 0; i < 12; i++) {
      const mist = this.add.ellipse(
        IT * (1.5 + (i * 1.17) % 13),
        IT * (2.2 + (i * 2.31) % 9),
        20 + (i % 3) * 12,
        7 + (i % 2) * 4,
        accent,
        0.08,
      ).setDepth(2);
      this.tweens.add({
        targets: mist,
        x: mist.x + (i % 2 === 0 ? 28 : -28),
        alpha: { from: 0.035, to: 0.13 },
        duration: 2100 + i * 90,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }

  private drawCandidates(): void {
    if (this.roomCleared()) return;
    this.room.candidates.forEach((_, index) => {
      if (shadowCandidateKind(this.room, index) === 'clone'
        && this.registry.get(shadowCloneFlag(this.room, index))) return;
      const pos = CANDIDATE_POSITIONS[index];
      const x = pos.col * IT + IT / 2;
      const y = pos.row * IT + IT / 2;
      const figure = this.add.graphics().setPosition(x, y).setDepth(10);

      // Every candidate intentionally shares the exact same silhouette and 3D
      // metadata. The true answer cannot be read from costume, tint or body shape.
      figure.fillStyle(0x000000, 0.48); figure.fillEllipse(0, 15, 27, 9);
      figure.fillStyle(0x1a0d2d); figure.fillTriangle(-12, 15, 12, 15, 8, -7);
      figure.fillStyle(0x32154e); figure.fillRect(-10, -8, 20, 13);
      figure.fillStyle(0x20102f); figure.fillRect(-14, -6, 5, 13); figure.fillRect(9, -6, 5, 13);
      figure.fillStyle(0xbda4d4); figure.fillCircle(0, -17, 7);
      figure.fillStyle(0x10081b); figure.fillRect(-8, -23, 16, 8);
      figure.fillStyle(0xc67cff); figure.fillCircle(-3, -17, 1.5); figure.fillCircle(3, -17, 1.5);
      figure.lineStyle(2, 0xa05ee8, 0.72); figure.strokeCircle(0, -2, 22);
      markProceduralCharacter3D(figure, {
        outfit: 0x32154e, hair: 0x10081b, skin: 0xbda4d4,
        footY: 15, outfitStyle: 'robe',
      });
      this.tweens.add({
        targets: figure,
        alpha: { from: 0.68, to: 1 },
        y: y - 3,
        duration: 980,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      this.add.text(x, y - 38, '???', {
        fontSize: '9px', color: '#d7b5ff', backgroundColor: '#080410bb', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(11);
    });
  }

  private createPlayer(): void {
    this.playerG = this.add.graphics().setDepth(20);
    this.redrawPlayer();
  }

  private redrawPlayer(): void {
    this.playerG.clear();
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
      if (!this.cutsceneActive && !this.exiting) this.scene.launch('MenuScene');
    });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => {
      if (!this.cutsceneActive && !this.exiting) this.scene.launch('MenuScene');
    });
  }

  update(_: number, delta: number): void {
    if (this.exiting) return;
    if (this.cutsceneActive) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
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
      const nx = this.px + dx / length * this.speed * dt;
      const ny = this.py + dy / length * this.speed * dt;
      const outside = (x: number, y: number) =>
        x < IT || x > (W - 1) * IT || y < IT || y > (H - 1) * IT;
      if (!outside(nx, this.py)) this.px = nx;
      if (!outside(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > 180) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else {
      this.walkFrame = 0;
    }

    this.redrawPlayer();
    this.checkCandidates();
    this.checkDoors();
  }

  private checkCandidates(): void {
    if (this.time.now < this.encounterReadyAt || this.roomCleared()) return;
    for (let index = 0; index < this.room.candidates.length; index++) {
      const kind = shadowCandidateKind(this.room, index);
      if (kind === 'clone' && this.registry.get(shadowCloneFlag(this.room, index))) continue;
      const pos = CANDIDATE_POSITIONS[index];
      const x = pos.col * IT + IT / 2;
      const y = pos.row * IT + IT / 2;
      if (Math.hypot(this.px - x, this.py - y) >= IT * 1.25) continue;

      this.cutsceneActive = true;
      this.encounterReadyAt = Number.POSITIVE_INFINITY;
      if (kind === 'clone') {
        const encounter = this.room.candidates[index] as ShadowGymPokemon;
        // Reveal once, before the battle. Returning from a win, capture, escape or
        // blackout can never chain-trigger the same illusion beneath the player.
        this.registry.set(shadowCloneFlag(this.room, index), true);
        this.dialog.show([
          localized('The silhouette ripples — it was a shadow clone!', '형체가 일렁인다 — 그림자분신이었다!', '人影が揺らぐ――影分身だった！'),
          localized('A wild Pokémon bursts from the broken illusion!', '깨진 환영 속에서 야생 포켓몬이 튀어나왔다!', '砕けた幻から野生のポケモンが飛び出した！'),
        ], () => this.startCloneBattle(encounter));
      } else if (this.room.trainer.leader) {
        this.dialog.show([
          localized('The other shadows collapse. The true Gym Leader steps forward.', '다른 그림자들이 무너지고, 진짜 체육관 관장이 앞으로 나선다.', 'ほかの影が崩れ、本物のジムリーダーが前へ出る。'),
          'Leader Jin: You defeated all my Shadow Trainers. Impressive.',
          "Leader Jin: I am Jin, Guardian of Capitol City's shadows.",
          'Leader Jin: My Corrpanda and I will test your resolve.',
          this.room.trainer.line,
          localized('Leader Jin: Come. Show me what you are made of.', '관장 진: 와라. 네 각오를 보여다오.', 'ジン館長：来い。お前の覚悟を見せてみろ。'),
        ], () => this.startLeaderBattle());
      } else {
        this.dialog.show([
          localized('The false shadows vanish. You found the real trainer!', '가짜 그림자들이 사라진다. 진짜 트레이너를 찾아냈다!', '偽の影が消える。本物のトレーナーを見つけた！'),
          this.room.trainer.line,
          localized(`${this.room.trainer.name}: Break through my shadow!`, `${tr(this.room.trainer.name)}: 내 그림자를 뚫고 지나가 봐!`, `${tr(this.room.trainer.name)}：私の影を打ち破れ！`),
        ], () => this.startTrainerBattle());
      }
      return;
    }
  }

  private startCloneBattle(encounter: ShadowGymPokemon): void {
    this.registry.set('gymPosX', this.px);
    this.registry.set('gymPosY', this.py);
    this.registry.set('routeReturnX', this.px);
    this.registry.set('routeReturnY', this.py);
    this.rememberPosition();
    this.registry.set('wildId', encounter.id);
    this.registry.set('wildLevel', encounter.level);
    this.registry.set('wildCustom', false);
    this.registry.set('wildCatchRate', 75);
    this.registry.set('wildReturnScene', this.room.sceneKey);
    this.transitionTo('WildBattleScene');
  }

  private startTrainerBattle(): void {
    const trainer = this.room.trainer;
    this.registry.set('trainerName', tr(trainer.name));
    this.registry.set('trainerKey', trainer.key);
    this.registry.set('trainerPokemon', JSON.stringify(trainer.pokemon));
    this.registry.set('trainerExpPool', trainer.expPool);
    this.registry.set('trainerReturnScene', this.room.sceneKey);
    this.registry.set('gymPosX', this.px);
    this.registry.set('gymPosY', this.py);
    this.rememberPosition();
    this.transitionTo('TrainerBattleScene');
  }

  private startLeaderBattle(): void {
    this.registry.set('gymPosX', this.px);
    this.registry.set('gymPosY', this.py);
    this.rememberPosition();
    this.transitionTo('GymLeaderBattleScene', 500);
  }

  private checkDoors(): void {
    const inDoorColumn = this.px > 6.4 * IT && this.px < 9.6 * IT;
    if (!inDoorColumn) return;

    if (this.py < 2 * IT) {
      if (this.roomCleared() && this.room.nextScene) {
        this.rememberPosition();
        this.transitionTo(this.room.nextScene, 320, { entry: 'south' });
      } else if (!this.roomCleared() && !this.gateHintShown) {
        this.gateHintShown = true;
        this.py = 2.35 * IT;
        this.cutsceneActive = true;
        this.dialog.show([
          localized('The northern seal rejects you. Find the real shadow in this room.', '북쪽 봉인이 길을 막는다. 이 방에 숨은 진짜 그림자를 찾아라.', '北の封印に拒まれた。この部屋にいる本物の影を探せ。'),
        ], () => {
          this.cutsceneActive = false;
          this.encounterReadyAt = this.time.now + 350;
        });
      }
      return;
    }

    if (this.py > (H - 2) * IT) {
      this.rememberPosition();
      const data = this.room.previousScene === 'CapitolCityScene' ? undefined : { entry: 'north' as const };
      this.transitionTo(this.room.previousScene, 320, data);
    }
  }

  private transitionTo(sceneKey: string, duration = 360, data?: { entry: EntrySide }): void {
    if (this.exiting) return;
    this.exiting = true;
    this.cutsceneActive = true;
    this.cameras.main.fadeOut(duration, 0, 0, 0, () => this.scene.start(sceneKey, data));
  }

  private roomCleared(): boolean {
    // A completed badge save is authoritative, including legacy/imported saves
    // that may not retain every individual trainer flag.
    return !!this.registry.get('gymLeaderDefeated')
      || !!this.registry.get(shadowRoomClearFlag(this.room));
  }
}

export class CapitolGymScene extends ShadowGymRoomScene {
  constructor() { super(SHADOW_GYM_ROOMS[0]); }
}

export class CapitolGymMirrorRoomScene extends ShadowGymRoomScene {
  constructor() { super(SHADOW_GYM_ROOMS[1]); }
}

export class CapitolGymVeilRoomScene extends ShadowGymRoomScene {
  constructor() { super(SHADOW_GYM_ROOMS[2]); }
}

export class CapitolGymSanctumScene extends ShadowGymRoomScene {
  constructor() { super(SHADOW_GYM_ROOMS[3]); }
}
