import Phaser from 'phaser';
import { drawNpcBody, drawTrainerBody, playerDesign, rivalDesign, rivalTrainerName } from '../data/CharacterSprite';
import { markRivalPortrait, markTrainerPortrait } from '../data/BattlePortraits';
import { getLang, t } from '../systems/i18n';
import { playBgm, stopBgm } from '../systems/Music';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { playWaterfallRivalClip } from '../systems/WaterfallRivalVideo';

type FinalePhase = 'party' | 'night' | 'logo';

interface FinaleSceneData {
  phase?: FinalePhase;
}

interface PartyActor {
  label: string;
  key?: string;
  outfit: number;
  hair: number;
}

const SOUTHERN_LEADERS: PartyActor[] = [
  { label: '관장 진', key: 'capitol-jin', outfit: 0x312446, hair: 0x15101d },
  { label: '관장 벽산', key: 'baekdu-byeoksan', outfit: 0x704f42, hair: 0x201810 },
  { label: '관장 남순', key: 'geumgang-namsun', outfit: 0x8a3a6a, hair: 0x6a2a5a },
  { label: '관장 하랑', key: 'haean-harang', outfit: 0x174c73, hair: 0x0a2a3a },
  { label: '관장 녹색', key: 'forest-noksaek', outfit: 0x356b39, hair: 0x253d25 },
  { label: '관장 번개', key: 'sunrise-beonge', outfit: 0x8a6a1a, hair: 0x3a2a10 },
  { label: '관장 산돌', key: 'dolmoe-sandol', outfit: 0x66574b, hair: 0x281d17 },
  { label: '관장 연아', key: 'seorae-yeona', outfit: 0x3a6a8a, hair: 0xbfe6ff },
];

const LEAGUE_CAST: PartyActor[] = [
  { label: '사천왕 겨울', key: 'e4-gyeoul', outfit: 0x506b84, hair: 0xd8e9f7 },
  { label: '사천왕 화금', key: 'e4-hwageum', outfit: 0x9b463d, hair: 0x3a1d19 },
  { label: '사천왕 바람', key: 'e4-baram', outfit: 0x416f77, hair: 0x172d34 },
  { label: '사천왕 살음', key: 'e4-saleum', outfit: 0x65497c, hair: 0x2b1938 },
  { label: '챔피언 황금', key: 'champion-hwangeum', outfit: 0xc08b2f, hair: 0x322416 },
  { label: '어사대장 진옥', key: 'inspector-jinnok', outfit: 0x2f6a44, hair: 0xcfd6dc },
];

/**
 * Final post-credit chapter: Waterfall City celebration, the gender-aware
 * waterfall conversation, and the last Pokémon String logo card.
 */
export class WaterfallFinaleScene extends Phaser.Scene {
  public disable3D = true;

  private requestedPhase?: FinalePhase;
  private phase: FinalePhase = 'party';
  private dialog?: DialogBox;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private inputReadyAt = 0;
  private transitioning = false;
  private logoCanExit = false;
  private rivalVideoAction?: () => void;

  constructor() { super('WaterfallFinaleScene'); }

  init(data?: FinaleSceneData) {
    this.requestedPhase = data?.phase;
  }

  preload() {
    const lang = getLang();
    const key = `finale-title-${lang}`;
    const assetLang = lang === 'ko' ? 'ko' : 'en';
    if (!this.textures.exists(key)) {
      this.load.image(key, `assets/title/pokemon-string-opening-${assetLang}.png`);
    }
    if (!this.textures.exists('finale-ending-background')) {
      this.load.image('finale-ending-background', 'assets/title/pokemon-string-ending-background.png');
    }
    if (!this.textures.exists('waterfall-rival-seated')) {
      this.load.image('waterfall-rival-seated', 'assets/cutscenes/waterfall_rival_seated.png');
    }
  }

  create() {
    this.disable3D = true;
    this.transitioning = false;
    this.logoCanExit = false;
    this.rivalVideoAction = undefined;
    this.input.keyboard?.resetKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.inputReadyAt = this.time.now + 350;
    this.input.on('pointerdown', this.handleAdvance, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handleAdvance, this);
    });

    const savedPhase = this.registry.get('finaleResumePhase') as FinalePhase | undefined;
    this.phase = this.requestedPhase ?? savedPhase ?? 'party';
    this.requestedPhase = undefined;
    this.registry.set('finaleResumePhase', this.phase);

    if (this.phase === 'night') this.showNightWaterfall();
    else if (this.phase === 'logo') this.showFinalLogo();
    else this.showCelebration();
  }

  update() {
    if (this.time.now < this.inputReadyAt) return;
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.handleAdvance();
    }
  }

  private handleAdvance() {
    if (this.time.now < this.inputReadyAt || this.transitioning) return;
    if (this.dialog?.isOpen()) {
      this.dialog.advance();
      return;
    }
    if (this.rivalVideoAction) {
      this.rivalVideoAction();
      return;
    }
    if (this.phase === 'logo' && this.logoCanExit) this.returnToTitle();
  }

  // ── 1. Waterfall City celebration ──────────────────────────────────────

  private showCelebration() {
    // Old saves may still resume this scene with `phase: party`. Route them to
    // the actual 3D Waterfall City map; the former flat party plate is never
    // shown again.
    this.registry.set('waterfallFinalePartyPending', true);
    this.registry.set('returnX', 16.5 * 32);
    this.registry.set('returnY', 16.4 * 32);
    SaveManager.save(this.registry, 16.5 * 32, 16.4 * 32, 'WorldMapScene');
    this.scene.start('WorldMapScene');
    return;

    /* Legacy implementation kept below only as a source reference for actor
       dialogue/colours. It is unreachable by design. */
    playBgm(this, 'waterfall');
    this.drawWaterfallCity(false);
    this.drawPartyCast();
    this.drawLanternsAndConfetti();

    this.add.text(this.scale.width / 2, 34, t(
      'WATERFALL CITY · UNIFIED CHAMPION CELEBRATION',
      '폭포시티 · 온누리 통합 챔피언 축하 파티',
    ), {
      fontSize: '26px', color: '#fff3b0', fontStyle: 'bold',
      stroke: '#40220d', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(80);

    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    SaveManager.save(this.registry, 15 * 32 + 16, 14 * 32 + 16, 'WaterfallFinaleScene');
    this.time.delayedCall(700, () => {
      this.dialog?.show([
        t(
          'When the ending credits finish, you return to Waterfall City. Every lantern in your hometown is already alight.',
          '엔딩크레딧이 끝나고, 너는 폭포시티로 돌아온다. 고향의 모든 등불이 이미 환하게 밝혀져 있다.',
        ),
        t(
          'Professor Song, all eight southern Gym Leaders, the Elite Four, Champion Hwangeum, your family and every friend from the journey have gathered beside the waterfall.',
          '송 박사와 남쪽의 여덟 체육관 관장, 사천왕, 챔피언 황금, 가족과 여행에서 만난 모든 주요 인물이 폭포 앞에 모여 있다.',
        ),
        t(
          'Professor Song: Two Leagues and one reunited Onnuri. No trainer in our history has ever walked as far as you did. Welcome home, Champion.',
          '송 박사: 두 개의 리그, 그리고 다시 하나가 된 온누리. 우리 역사에서 너만큼 멀리 걸어간 트레이너는 없었단다. 돌아온 걸 환영한다, 챔피언.',
        ),
        t(
          'Leader Byeoksan: Every Gym in the south closed its doors tonight. This night belongs to the Champion of Champions!',
          '관장 벽산: 오늘 밤 남쪽의 모든 체육관이 문을 닫았어. 이 밤은 챔피언 중의 챔피언을 위한 밤이다!',
        ),
        t(
          'Champion Hwangeum: No titles, no battles. Eat, laugh and remember everyone who carried you this far. You earned this.',
          '챔피언 황금: 오늘은 직함도, 배틀도 없다. 먹고, 웃고, 여기까지 너와 함께한 모두를 기억해. 넌 그럴 자격이 있어.',
        ),
        t(
          'Music, fireworks and falling petals fill Waterfall City until the last guests finally begin to leave.',
          '음악과 불꽃놀이, 흩날리는 꽃잎이 폭포시티를 가득 채우고, 마침내 마지막 손님들까지 하나둘 돌아가기 시작한다.',
        ),
        t(
          'Much later, your Rival quietly asks you to follow them to the waterfall where the journey first began.',
          '한참 뒤, 라이벌은 여행이 처음 시작된 폭포 앞으로 조용히 따라오라고 손짓한다.',
        ),
      ], () => this.transitionTo('night'));
    });
  }

  private drawPartyCast() {
    const W = this.scale.width;
    const leaderStep = (W - 120) / (SOUTHERN_LEADERS.length - 1);
    SOUTHERN_LEADERS.forEach((actor, i) => {
      this.addNpcActor(60 + leaderStep * i, 270, actor, 1.9, 30);
    });

    const leagueStep = 150;
    LEAGUE_CAST.forEach((actor, i) => {
      this.addNpcActor(265 + leagueStep * i, 392, actor, 2.15, 42);
    });

    this.addNpcActor(235, 480, {
      label: t('Mom', '엄마'), outfit: 0xb64f78, hair: 0x24131d,
    }, 2.45, 55);
    this.addNpcActor(385, 480, {
      label: t('Professor Song', '송 박사'), key: 'prof-song', outfit: 0xdde4ed, hair: 0x4b4e58,
    }, 2.45, 55);
    this.addPlayerActor(560, 480, playerDesign(this.registry), t('Champion', '통합 챔피언'), false);
    this.addPlayerActor(720, 480, rivalDesign(this.registry), rivalTrainerName(this.registry), true);
    this.addNpcActor(885, 480, {
      label: t('Admin Chaeyeon', '간부 채연'), key: 'suri-chaeyeon-2', outfit: 0x376a78, hair: 0x202937,
    }, 2.45, 55);
  }

  private addNpcActor(
    x: number, y: number, actor: PartyActor, scale: number, labelLift: number,
  ): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setPosition(x, y).setScale(scale).setDepth(45 + Math.round(y));
    drawNpcBody(g, actor.outfit, { hair: actor.hair });
    if (actor.key) markTrainerPortrait(g, actor.key);
    this.add.text(x, y - labelLift, actor.label, {
      fontSize: '11px', color: '#ffffff', backgroundColor: '#071027c9',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(g.depth + 1);
    this.tweens.add({
      targets: g, y: y - 3, duration: 950 + Math.random() * 420,
      yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
    return g;
  }

  private addPlayerActor(
    x: number, y: number, design: 'boy' | 'girl', label: string, rival: boolean,
  ): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setPosition(x, y).setScale(2.75).setDepth(600);
    drawTrainerBody(g, 0, 0, design);
    if (rival) markRivalPortrait(g, this.registry);
    this.add.text(x, y - 64, label, {
      fontSize: '12px', color: rival ? '#a9dcff' : '#ffe783',
      backgroundColor: '#071027d9', padding: { x: 5, y: 2 }, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(601);
    this.tweens.add({ targets: g, y: y - 4, duration: 1150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    return g;
  }

  private drawLanternsAndConfetti() {
    const W = this.scale.width, H = this.scale.height;
    for (let i = 0; i < 13; i++) {
      const x = 38 + (i * (W - 76)) / 12;
      const lantern = this.add.container(x, 76 + (i % 2) * 18).setDepth(25);
      const glow = this.add.circle(0, 0, 20, 0xffad42, 0.13).setBlendMode(Phaser.BlendModes.ADD);
      const lamp = this.add.rectangle(0, 0, 15, 23, i % 3 === 0 ? 0xff5b56 : 0xffbd54, 0.96)
        .setStrokeStyle(2, 0x6a260f, 1);
      lantern.add([glow, lamp]);
      this.tweens.add({ targets: lantern, angle: { from: -3, to: 3 }, duration: 1300 + i * 35, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: glow, alpha: { from: 0.1, to: 0.34 }, scale: 1.25, duration: 850, yoyo: true, repeat: -1 });
    }

    const colors = [0xffd45a, 0xff6688, 0x75d8ff, 0xd59bff, 0xffffff];
    for (let i = 0; i < 34; i++) {
      const x = Phaser.Math.Between(30, W - 30);
      const flake = this.add.rectangle(x, Phaser.Math.Between(-H, 120), 5, 10, colors[i % colors.length], 0.9)
        .setDepth(70).setAngle(Phaser.Math.Between(0, 180));
      this.tweens.add({
        targets: flake,
        y: H + 40,
        x: x + Phaser.Math.Between(-80, 80),
        angle: flake.angle + Phaser.Math.Between(220, 560),
        duration: Phaser.Math.Between(4800, 7600),
        delay: Phaser.Math.Between(0, 3600),
        repeat: -1,
        ease: 'Linear',
      });
    }
  }

  // ── 2. Gender-aware night waterfall cutscene ───────────────────────────

  private showNightWaterfall() {
    playBgm(this, 'waterfallnight');
    const W = this.scale.width, H = this.scale.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x020817, 1);
    if (this.textures.exists('waterfall-rival-seated')) {
      const seated = this.add.image(W / 2, H / 2, 'waterfall-rival-seated').setDepth(1);
      const source = this.textures.get('waterfall-rival-seated').getSourceImage();
      const sourceW = Math.max(1, Number(source.width));
      const sourceH = Math.max(1, Number(source.height));
      const scale = Math.max(W / sourceW, H / sourceH);
      seated.setScale(scale);
      this.tweens.add({
        targets: seated,
        scaleX: scale * 1.012,
        scaleY: scale * 1.012,
        duration: 12000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    } else {
      // Asset/codec safety net retained for old cached deployments.
      this.drawWaterfallCity(true);
    }

    this.add.text(W / 2, 38, t('WATERFALL CITY · AFTER MIDNIGHT', '폭포시티 · 깊은 밤'), {
      fontSize: '20px', color: '#bcd9ff', fontStyle: 'bold',
      stroke: '#061126', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(80);

    this.dialog = new DialogBox(this, W, H);
    SaveManager.save(this.registry, 15 * 32 + 16, 8 * 32 + 16, 'WaterfallFinaleScene');
    const rivalName = rivalTrainerName(this.registry);
    const beginDialogue = () => {
      this.rivalVideoAction = undefined;
      this.dialog?.show([
        t(
          'The festival is silent now. Only moonlight, the roar of the waterfall and the friend who began this journey beside you remain.',
          '축제는 이제 고요하다. 달빛과 폭포 소리, 그리고 이 여행을 곁에서 시작한 친구만이 남아 있다.',
        ),
        t(
          `${rivalName}: I still cannot believe you became the unified Champion of Onnuri... Time really flies.`,
          `${rivalName}: 너가 온누리 통합 챔피언이 되다니 정말 믿기지가 않네.. 시간이 참 빠르다`,
        ),
        t(
          `${rivalName}: Even after all this... are you going to keep travelling?`,
          `${rivalName}: 그래도 여행을 계속할 거야?`,
        ),
        t(
          'You look past the waterfall toward roads that do not appear on any map yet — and smile.',
          '너는 폭포 너머, 아직 어떤 지도에도 그려지지 않은 길을 바라보며 미소 짓는다.',
        ),
        t(
          `${rivalName}: ...I knew it. Then next time, I will be the one waiting one step ahead.`,
          `${rivalName}: ...그럴 줄 알았어. 그럼 다음에는 내가 한발 앞에서 기다리고 있을게.`,
        ),
      ], () => this.playStandUpThenCheer());
    };

    // Hold on the AAA seated composition for the entire private conversation.
    this.time.delayedCall(650, beginDialogue);
  }

  private playStandUpThenCheer() {
    const finish = () => {
      this.rivalVideoAction = undefined;
      this.transitionTo('logo');
    };
    const playCheer = () => {
      this.rivalVideoAction = undefined;
      this.time.delayedCall(140, () => {
        this.rivalVideoAction = playWaterfallRivalClip(
          this,
          'girl-cheer',
          finish,
          finish,
        );
      });
    };

    // Beat 1: both trainers rise naturally from the exact seated composition.
    // Beat 2: the girl gives the requested encouraging fighting gesture.
    this.rivalVideoAction = playWaterfallRivalClip(
      this,
      'stand-up',
      playCheer,
      playCheer,
    );
  }

  // ── 3. Final logo card ──────────────────────────────────────────────────

  private showFinalLogo() {
    playBgm(this, 'halloffame');
    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W / 2, H / 2, W, H, 0x070014, 1);

    // Newly generated ending panorama: the title-screen purple cosmos resolves
    // into dawn over a waterfall city, with the trainer and companions looking
    // toward the next journey. Fill without stretching on desktop or phones.
    if (this.textures.exists('finale-ending-background')) {
      const bg = this.add.image(W / 2, H / 2, 'finale-ending-background').setDepth(1);
      const source = this.textures.get('finale-ending-background').getSourceImage();
      const sourceW = Math.max(1, Number(source.width));
      const sourceH = Math.max(1, Number(source.height));
      const scale = Math.max(W / sourceW, H / sourceH);
      bg.setScale(scale);
      this.tweens.add({
        targets: bg, scaleX: scale * 1.025, scaleY: scale * 1.025,
        duration: 14000, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
    }

    // Keep the official localized main-screen logo pixel-perfect by compositing
    // its authored top plate over the new background instead of regenerating
    // letterforms with an image model.
    const key = `finale-title-${getLang()}`;
    if (this.textures.exists(key)) {
      const source = this.textures.get(key).getSourceImage();
      const sourceW = Math.max(1, Number(source.width));
      const sourceH = Math.max(1, Number(source.height));
      const cropH = Math.floor(sourceH * 0.52);
      const art = this.add.image(W / 2, 0, key).setOrigin(0.5, 0).setDepth(1);
      art.setCrop(0, 0, sourceW, cropH);
      art.setDisplaySize(W, H * 0.47);
      this.tweens.add({
        targets: art, scaleX: art.scaleX * 1.012, scaleY: art.scaleY * 1.012,
        duration: 12000, yoyo: true, repeat: -1, ease: 'Sine.inOut',
      });
    }

    const veil = this.add.graphics().setDepth(3);
    veil.fillGradientStyle(0x070014, 0x070014, 0x070014, 0x070014, 0, 0, 0.78, 0.78);
    veil.fillRoundedRect(W * 0.15, H * 0.59, W * 0.7, H * 0.2, 24);
    for (let i = 0; i < 45; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(20, W - 20), Phaser.Math.Between(20, H - 20),
        Math.random() < 0.18 ? 2.2 : 1.2, i % 4 === 0 ? 0xd99cff : 0xffffff, 0.5,
      ).setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: star, alpha: { from: 0.15, to: 0.9 }, duration: Phaser.Math.Between(900, 2200), yoyo: true, repeat: -1 });
    }

    this.add.text(W / 2, H * 0.65, t('THE END', '끝'), {
      fontSize: '55px', color: '#f2ddff', fontStyle: 'bold',
      stroke: '#2d0748', strokeThickness: 9, letterSpacing: 8,
    }).setOrigin(0.5).setDepth(10).setAlpha(0)
      .setData('finaleText', true);
    const endingText = this.children.list.find(child => child.getData?.('finaleText')) as Phaser.GameObjects.Text;
    this.tweens.add({ targets: endingText, alpha: 1, y: endingText.y - 8, duration: 1900, ease: 'Sine.out' });

    this.add.text(W / 2, H * 0.75, t(
      'The unified Champion’s journey continues beyond the horizon.',
      '온누리 통합 챔피언의 여행은 지평선 너머로 계속된다.',
    ), {
      fontSize: '18px', color: '#c9b7de', align: 'center',
    }).setOrigin(0.5).setDepth(10).setAlpha(0)
      .setData('finaleSubtitle', true);
    const subtitle = this.children.list.find(child => child.getData?.('finaleSubtitle')) as Phaser.GameObjects.Text;
    this.tweens.add({ targets: subtitle, alpha: 1, duration: 1500, delay: 1100 });

    const prompt = this.add.text(W / 2, H - 24, t('ENTER — TITLE SCREEN', 'ENTER — 타이틀 화면'), {
      fontSize: '14px', color: '#d8c7ea', backgroundColor: '#08000fc4', padding: { x: 10, y: 5 },
    }).setOrigin(0.5, 1).setDepth(10).setAlpha(0);
    this.time.delayedCall(2600, () => {
      this.logoCanExit = true;
      this.tweens.add({ targets: prompt, alpha: { from: 0.28, to: 1 }, duration: 650, yoyo: true, repeat: -1 });
    });

    this.registry.set('finalEndingSeen', true);
    this.registry.remove('finaleResumePhase');
    // Continue resumes in Waterfall City after the ending instead of replaying
    // the one-shot finale or sending the player back to the old home epilogue.
    SaveManager.save(this.registry, 15 * 32 + 16, 14 * 32 + 16, 'WorldMapScene');
    this.cameras.main.fadeIn(1200);
  }

  private returnToTitle() {
    if (this.transitioning) return;
    this.transitioning = true;
    stopBgm(this);
    this.cameras.main.fadeOut(850, 0, 0, 0, () => this.scene.start('TitleScene'));
  }

  // ── Shared animated Waterfall City plate ────────────────────────────────

  private drawWaterfallCity(night: boolean) {
    const W = this.scale.width, H = this.scale.height;
    const skyTop = night ? 0x020819 : 0x432769;
    const skyBottom = night ? 0x10264a : 0xf2a468;
    const backdrop = this.add.graphics().setDepth(0);
    backdrop.fillGradientStyle(skyTop, skyTop, skyBottom, skyBottom, 1, 1, 1, 1);
    backdrop.fillRect(0, 0, W, H);

    if (night) {
      backdrop.fillStyle(0xeaf4ff, 0.92); backdrop.fillCircle(W * 0.78, 92, 37);
      backdrop.fillStyle(skyTop, 1); backdrop.fillCircle(W * 0.795, 82, 37);
      for (let i = 0; i < 75; i++) {
        backdrop.fillStyle(i % 7 === 0 ? 0xb8d8ff : 0xffffff, 0.35 + Math.random() * 0.55);
        backdrop.fillCircle(Phaser.Math.Between(16, W - 16), Phaser.Math.Between(16, 260), Math.random() < 0.14 ? 2 : 1);
      }
    }

    // Layered mountain silhouettes frame the namesake waterfall.
    backdrop.fillStyle(night ? 0x101b2d : 0x3b3450, 1);
    backdrop.fillTriangle(0, 360, 250, 115, 500, 360);
    backdrop.fillTriangle(360, 360, 635, 90, 900, 360);
    backdrop.fillTriangle(760, 360, 1070, 135, W, 360);
    backdrop.fillStyle(night ? 0x172943 : 0x584a62, 1);
    backdrop.fillTriangle(0, 410, 350, 175, 680, 410);
    backdrop.fillTriangle(610, 410, 990, 170, W, 410);

    // Waterfall basin and moving light ribbons.
    backdrop.fillStyle(night ? 0x163963 : 0x2f83a8, 1); backdrop.fillRect(0, 355, W, H - 355);
    backdrop.fillStyle(night ? 0x8edbff : 0xe8fbff, 0.82); backdrop.fillRoundedRect(W / 2 - 112, 105, 224, 350, 36);
    backdrop.fillStyle(night ? 0xd7f6ff : 0xffffff, 0.68); backdrop.fillEllipse(W / 2, 448, 390, 76);
    for (let i = 0; i < 12; i++) {
      const ribbon = this.add.rectangle(W / 2 - 92 + i * 17, 275, 5 + (i % 3) * 2, 320, 0xeafaff, night ? 0.28 : 0.42)
        .setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: ribbon, y: { from: 245, to: 315 }, alpha: { from: 0.15, to: night ? 0.5 : 0.7 },
        duration: 1100 + i * 55, repeat: -1, ease: 'Sine.inOut',
      });
    }

    // City promenade, bridge and warm windows in the foreground.
    backdrop.fillStyle(night ? 0x111925 : 0x342c35, 1); backdrop.fillRect(0, 430, W, 125);
    backdrop.fillStyle(night ? 0x26364a : 0x66556a, 1); backdrop.fillRect(0, 455, W, 17);
    backdrop.fillStyle(night ? 0x283443 : 0x59454b, 1); backdrop.fillRoundedRect(120, 385, 220, 80, 8); backdrop.fillRoundedRect(W - 340, 385, 220, 80, 8);
    for (const baseX of [140, W - 320]) {
      for (let i = 0; i < 6; i++) {
        backdrop.fillStyle(night ? 0xffcf68 : 0xffe9a0, night ? 0.82 : 0.65);
        backdrop.fillRect(baseX + i * 31, 405 + (i % 2) * 12, 14, 20);
      }
    }
    backdrop.lineStyle(5, night ? 0x7d98b8 : 0xd7b271, 1);
    backdrop.beginPath(); backdrop.moveTo(300, 438); backdrop.lineTo(W / 2, 390); backdrop.lineTo(W - 300, 438); backdrop.strokePath();
    backdrop.lineStyle(2, night ? 0x425d78 : 0x8c7249, 1);
    for (let i = 0; i <= 10; i++) {
      const x = 300 + ((W - 600) * i) / 10;
      backdrop.lineBetween(x, 438 - Math.sin((i / 10) * Math.PI) * 48, x, 470);
    }

    // Water reflections keep the static plate alive without heavy shaders.
    for (let i = 0; i < 18; i++) {
      const y = 475 + i * 12;
      const reflection = this.add.rectangle(W / 2, y, 90 + (i % 5) * 38, 3, night ? 0x7bcfff : 0xffd9a0, 0.22)
        .setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: reflection, scaleX: { from: 0.75, to: 1.25 }, alpha: { from: 0.1, to: 0.38 }, duration: 900 + i * 45, yoyo: true, repeat: -1 });
    }
  }

  private transitionTo(next: FinalePhase) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.registry.set('finaleResumePhase', next);
    SaveManager.save(this.registry, 15 * 32 + 16, next === 'night' ? 8 * 32 + 16 : 14 * 32 + 16, 'WaterfallFinaleScene');
    this.cameras.main.fadeOut(1100, 0, 0, 0, () => this.scene.restart({ phase: next } satisfies FinaleSceneData));
  }
}
