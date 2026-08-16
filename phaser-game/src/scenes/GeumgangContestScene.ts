import Phaser from 'phaser';
import { playerAvatarKey, AVATAR_URL } from '../data/PlayerAvatar';
import { playerTrainerName } from '../data/CharacterSprite';
import { PartySystem, type PartyEntry } from '../systems/PartySystem';
import { DialogBox } from '../ui/DialogBox';
import { playBgm } from '../systems/Music';
import { pokeName, t, typeName } from '../systems/i18n';
import { PROD_UI, roundedPanel } from '../systems/ProductionUi';
import { sfxCancel, sfxConfirm, sfxMove } from '../systems/UiSfx';
import { SaveManager } from '../utils/SaveManager';
import { HWANGEUM_STORY, recordHwangeumBeat } from '../systems/HwangeumStory';

type ContestPhase = 'dialog' | 'partner' | 'round' | 'lobby' | 'exit' | 'transition';
type AppealStyle = 'elegance' | 'impact' | 'bond';

interface AppealOption {
  key: AppealStyle;
  icon: string;
  labelEn: string;
  labelKo: string;
  descEn: string;
  descKo: string;
  accent: number;
}

const APPEALS: AppealOption[] = [
  {
    key: 'elegance', icon: '✦', labelEn: 'ELEGANCE', labelKo: '우아함',
    descEn: 'Shape a precise, luminous entrance', descKo: '정교하고 빛나는 입장 연출', accent: 0x72d9ff,
  },
  {
    key: 'impact', icon: '⚡', labelEn: 'IMPACT', labelKo: '박력',
    descEn: 'Seize the hall with raw spectacle', descKo: '강렬한 연출로 홀을 압도', accent: 0xff697d,
  },
  {
    key: 'bond', icon: '♥', labelEn: 'BOND', labelKo: '유대',
    descEn: 'Let the audience feel your trust', descKo: '서로의 신뢰를 관객에게 전달', accent: 0xffd65e,
  },
];

const ROUND_TITLES = [
  ['Signature Entrance', '시그니처 입장'],
  ['Technique Showcase', '기술 쇼케이스'],
  ['Partner Finale', '파트너 피날레'],
] as const;

const CHAMPION_ROUND_SCORES = [28, 29, 29] as const;
const CHAMPION_TOTAL = CHAMPION_ROUND_SCORES.reduce((sum, value) => sum + value, 0);

/**
 * A complete, replayable story contest rather than the old "coming soon"
 * message.  The player's real party supplies the entrant; three presentation
 * decisions, type synergy and variety determine whether they can edge out the
 * Champion's exhibition score.
 */
export class GeumgangContestScene extends Phaser.Scene {
  public disable3D = true;

  private party: PartyEntry[] = [];
  private partnerTextureKeys: string[] = [];
  private dialog!: DialogBox;
  private phase: ContestPhase = 'transition';
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private confirmKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private cancelKey!: Phaser.Input.Keyboard.Key;
  private uiLayer?: Phaser.GameObjects.Container;
  private partnerImage?: Phaser.GameObjects.Image;
  private partnerLabel?: Phaser.GameObjects.Text;
  private championMon?: Phaser.GameObjects.Image;
  private playerScoreText!: Phaser.GameObjects.Text;
  private championScoreText!: Phaser.GameObjects.Text;
  private selectedPartner = 0;
  private selectedOption = 0;
  private optionCards: Array<{ bg: Phaser.GameObjects.Rectangle; stripe: Phaser.GameObjects.Rectangle; accent: number }> = [];
  private round = 0;
  private playerScore = 0;
  private championScore = 0;
  private usedStyles: AppealStyle[] = [];
  private exiting = false;

  constructor() { super('GeumgangContestScene'); }

  preload() {
    this.party = PartySystem.get(this.registry);
    const avatar = playerAvatarKey(this.registry);
    if (!this.textures.exists(avatar)) this.load.image(avatar, AVATAR_URL[avatar]);
    if (!this.textures.exists('contest-hwangeum')) {
      this.load.image('contest-hwangeum', 'assets/npc/npc_hwangeum.png');
    }
    if (!this.textures.exists('contest-bonejoillion')) {
      this.load.image('contest-bonejoillion', 'assets/dex/bonejoillion.png');
    }
    this.partnerTextureKeys = this.party.map((entry, index) => {
      const safe = entry.spriteKey.replace(/[^a-zA-Z0-9_-]/g, '-');
      const key = `contest-partner-${safe}-${index}`;
      if (entry.spriteUrl && !this.textures.exists(key)) this.load.image(key, entry.spriteUrl);
      return key;
    });
  }

  create() {
    this.party = PartySystem.get(this.registry);
    this.drawBroadcastStage();
    this.setupInput();
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    playBgm(this, 'geumgang');
    this.cameras.main.fadeIn(450);

    if (this.party.length === 0) {
      this.showDialog([
        t('Contest Hall Usher: A coordinator needs a Pokémon partner. Please return after one joins your party.',
          '콘테스트 홀 안내원: 코디네이터에게는 포켓몬 파트너가 필요합니다. 동료와 함께 다시 와 주세요.'),
      ], () => this.exitToCity());
      return;
    }

    if (this.registry.get(HWANGEUM_STORY.contest)) this.showCompletedLobby();
    else this.showStoryIntro();
  }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.confirmKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.cancelKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => {
      if (this.phase !== 'dialog' && this.phase !== 'transition') this.exitToCity();
    });
    // DialogBox is keyboard-first. A screen tap advances it as well, so the
    // Champion event remains fully playable with the mobile A/touch shell.
    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (currentlyOver.length > 0) return;
      if (this.phase === 'dialog' && this.dialog?.isOpen() && !this.dialog.isInChoice()) {
        this.dialog.advance();
      }
    });
  }

  update() {
    if (this.phase === 'dialog') {
      if (Phaser.Input.Keyboard.JustDown(this.confirmKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) this.dialog.advance();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.cancelKey)) {
      if (this.phase !== 'transition') { sfxCancel(this); this.exitToCity(); }
      return;
    }
    if (this.phase === 'partner') {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.moveSelection(-1, this.party.length);
      if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.moveSelection(1, this.party.length);
      if (Phaser.Input.Keyboard.JustDown(this.confirmKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) this.confirmPartner();
      return;
    }
    if (this.phase === 'round') {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.moveSelection(-1, APPEALS.length);
      if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.moveSelection(1, APPEALS.length);
      if (Phaser.Input.Keyboard.JustDown(this.confirmKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) this.chooseAppeal(this.selectedOption);
      return;
    }
    if (this.phase === 'lobby') {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
        this.moveSelection(-1, 2);
      }
      if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
        this.moveSelection(1, 2);
      }
      if (Phaser.Input.Keyboard.JustDown(this.confirmKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) this.confirmLobbyAction();
      return;
    }
    if (this.phase === 'exit'
      && (Phaser.Input.Keyboard.JustDown(this.confirmKey) || Phaser.Input.Keyboard.JustDown(this.enterKey))) {
      sfxConfirm(this); this.exitToCity();
    }
  }

  private drawBroadcastStage() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor('#080b1d');
    this.add.rectangle(W / 2, H / 2, W, H, 0x080b1d);
    this.add.rectangle(W / 2, 205, W, 270, 0x251443, 1);
    this.add.rectangle(W / 2, 420, W, 165, 0x172441, 1);

    const lights = this.add.graphics();
    lights.fillStyle(0x72d9ff, 0.12);
    lights.fillTriangle(90, 70, 330, 500, 500, 500);
    lights.fillStyle(0xffd65e, 0.12);
    lights.fillTriangle(W - 90, 70, W - 500, 500, W - 330, 500);
    lights.lineStyle(3, 0xffd65e, 0.65);
    for (let i = 0; i < 4; i++) lights.strokeEllipse(W / 2, 335, 680 - i * 88, 190 - i * 19);

    // Central runway and LED stage rim.
    const runway = this.add.graphics();
    runway.fillStyle(0x111a32, 1); runway.fillRoundedRect(235, 250, W - 470, 270, 34);
    runway.lineStyle(4, 0x72d9ff, 0.82); runway.strokeRoundedRect(235, 250, W - 470, 270, 34);
    runway.lineStyle(2, 0xffd65e, 0.72); runway.strokeEllipse(W / 2, 405, 590, 165);
    this.add.ellipse(365, 418, 265, 95, 0x5bc8ff, 0.13).setStrokeStyle(2, 0x72d9ff, 0.45);
    this.add.ellipse(885, 418, 265, 95, 0xffd65e, 0.13).setStrokeStyle(2, 0xffd65e, 0.45);

    // Production broadcast masthead and live ticker.
    this.add.rectangle(W / 2, 31, W, 62, 0x07111f, 0.98).setStrokeStyle(2, 0x54779f, 0.65);
    this.add.text(24, 16, t('GEUMGANG GRAND CONTEST', '금강 그랜드 콘테스트'), {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold', letterSpacing: 1,
    });
    this.add.text(W - 22, 18, t('● LIVE · ALL ONNURI NETWORK', '● 생중계 · 온누리 전역'), {
      fontSize: '15px', color: '#ff697d', fontStyle: 'bold',
    }).setOrigin(1, 0);
    this.add.rectangle(W / 2, H - 26, W, 52, 0x07111f, 0.98);
    this.add.text(W / 2, H - 26,
      t('18 broadcasters · regional press pool · sold-out audience',
        '18개 방송사 · 온누리 전역 기자단 · 전석 매진'), {
        fontSize: '13px', color: '#a9bfd5', fontStyle: 'bold',
      }).setOrigin(0.5);

    // Foreground press silhouettes and camera flashes make the media turnout
    // visible rather than merely mentioning it in dialogue.
    const press = this.add.graphics().setDepth(6);
    for (let i = 0; i < 24; i++) {
      const x = 20 + i * (W - 40) / 23;
      const y = 610 + (i % 3) * 12;
      press.fillStyle(i % 4 === 0 ? 0x182a48 : 0x0b1324, 1);
      press.fillCircle(x, y, 12); press.fillRect(x - 12, y + 9, 24, 45);
      if (i % 3 === 0) {
        press.fillStyle(0x344d6b, 1); press.fillRect(x + 8, y - 3, 18, 12);
        press.fillStyle(0xeaf8ff, 0.9); press.fillCircle(x + 24, y + 2, 3);
      }
    }
    for (let i = 0; i < 8; i++) {
      const flash = this.add.circle(80 + i * 155, 586 + (i % 2) * 22, 5, 0xffffff, 0.15).setDepth(7);
      this.tweens.add({ targets: flash, alpha: 0.95, scale: 2.2, duration: 100, yoyo: true,
        delay: 320 + i * 370, repeat: -1, repeatDelay: 2500 });
    }

    // Trainers frame the two partner stages.
    this.addTrainerPortrait(playerAvatarKey(this.registry), 112, 385, 155, 320, false);
    this.addTrainerPortrait('contest-hwangeum', W - 112, 385, 155, 320, true);
    this.championMon = this.add.image(895, 362, 'contest-bonejoillion').setDepth(5);
    this.fitImage(this.championMon, 205, 205);
    this.add.text(895, 484, t('Hwangeum · Bonejoillion', '황금 · 보내조에일리언'), {
      fontSize: '14px', color: '#ffe783', fontStyle: 'bold', backgroundColor: '#07111fcc',
      padding: { x: 9, y: 5 },
    }).setOrigin(0.5).setDepth(7);

    const scorePanel = roundedPanel(this, W / 2 - 205, 76, 410, 100, {
      fill: PROD_UI.ink, alpha: 0.94, stroke: PROD_UI.yellow, radius: 16,
    }).setDepth(8);
    this.add.text(W / 2, 92, t('LIVE SCORE', '실시간 스코어'), {
      fontSize: '13px', color: '#a9bfd5', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(9);
    this.playerScoreText = this.add.text(W / 2 - 100, 132, `${playerTrainerName(this.registry)}  000`, {
      fontSize: '22px', color: '#72d9ff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(9);
    this.championScoreText = this.add.text(W / 2 + 100, 132, `${t('HWANGEUM', '황금')}  000`, {
      fontSize: '22px', color: '#ffe783', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(9);
    scorePanel.setName('__contestScorePanel__');
  }

  private addTrainerPortrait(
    key: string, x: number, y: number, maxW: number, maxH: number, flipX: boolean,
  ) {
    if (!this.textures.exists(key)) return;
    const image = this.add.image(x, y, key).setDepth(4).setFlipX(flipX);
    this.fitImage(image, maxW, maxH);
  }

  private fitImage(image: Phaser.GameObjects.Image, maxW: number, maxH = maxW) {
    const source = image.texture.getSourceImage() as { width?: number; height?: number };
    const width = Math.max(1, Number(source.width) || 1);
    const height = Math.max(1, Number(source.height) || 1);
    image.setScale(Math.min(maxW / width, maxH / height));
  }

  private showStoryIntro() {
    const alreadyMet = !!this.registry.get(HWANGEUM_STORY.met);
    this.registry.set(HWANGEUM_STORY.met, true);
    const introduction = alreadyMet
      ? t('Hwangeum: You came. Good — the press thought I was the only surprise on today\'s program.',
          '황금: 왔구나. 좋아 — 기자들은 오늘 프로그램의 깜짝 손님이 나 하나뿐인 줄 알았겠지.')
      : t('Hwangeum: We have not met. I am Hwangeum — but today, leave the title outside and call me a fellow coordinator.',
          '황금: 우린 초면이군. 나는 황금이야 — 하지만 오늘은 직함을 문밖에 두고, 같은 코디네이터라고 불러 줘.');
    this.showDialog([
      t('The Geumgang Contest Hall is overflowing. Reporters from every corner of Onnuri crowd the press rail as live cameras sweep the stage.',
        '금강 콘테스트 홀은 발 디딜 틈이 없다. 온누리 각지에서 몰려온 기자들이 취재선을 가득 메우고 생중계 카메라가 무대를 훑는다.'),
      t('MC Mirae: Champion Hwangeum has entered the Grand Contest! Every regional network is carrying this live!',
        'MC 미래: 챔피언 황금이 그랜드 콘테스트에 출전합니다! 온누리 전 방송사가 생중계 중입니다!'),
      introduction,
      t('Hwangeum: A Champion should remind people that Pokémon are more than battles. Stand on this stage with me and show them your partnership.',
        '황금: 챔피언이라면 포켓몬이 배틀만을 위한 존재가 아니라는 것도 보여 줘야 해. 나와 같은 무대에 서서 너희의 유대를 보여 줘.'),
      t('Usher: Choose one Pokémon from your party. Three appeal rounds will decide the Grand Ribbon!',
        '안내원: 파티에서 포켓몬 한 마리를 골라 주세요. 세 번의 어필로 그랜드리본의 주인이 결정됩니다!'),
    ], () => this.showPartnerSelection());
  }

  private showPartnerSelection() {
    this.phase = 'partner';
    this.selectedPartner = Phaser.Math.Clamp(this.selectedPartner, 0, this.party.length - 1);
    this.clearUiLayer();
    const layer = this.add.container(0, 0).setDepth(30);
    this.uiLayer = layer;
    layer.add(roundedPanel(this, 145, 185, this.scale.width - 290, 405, {
      fill: PROD_UI.ink, alpha: 0.985, stroke: PROD_UI.cyan, radius: 22,
    }));
    layer.add(this.add.text(this.scale.width / 2, 215,
      t('CHOOSE YOUR CONTEST PARTNER', '함께 출전할 포켓몬을 선택하세요'), {
        fontSize: '23px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5));
    layer.add(this.add.text(this.scale.width / 2, 249,
      t('← → select   ·   SPACE / tap CONFIRM', '← → 선택   ·   SPACE / 확인 버튼'), {
        fontSize: '12px', color: '#a9bfd5',
      }).setOrigin(0.5));

    const count = this.party.length;
    const cardW = Math.min(148, (this.scale.width - 350) / Math.max(1, count) - 10);
    const gap = Math.min(166, (this.scale.width - 350) / Math.max(1, count));
    this.optionCards = [];
    this.party.forEach((entry, index) => {
      const x = this.scale.width / 2 + (index - (count - 1) / 2) * gap;
      const bg = this.add.rectangle(x, 400, cardW, 230, PROD_UI.panelRaised, 0.98)
        .setStrokeStyle(2, PROD_UI.line, 0.8).setInteractive({ useHandCursor: true });
      const stripe = this.add.rectangle(x, 291, cardW - 12, 7, PROD_UI.line, 0.95);
      layer.add([bg, stripe]);
      const texture = this.partnerTextureKeys[index];
      if (this.textures.exists(texture)) {
        const image = this.add.image(x, 365, texture);
        this.fitImage(image, Math.max(72, cardW - 28), 112);
        layer.add(image);
      } else {
        layer.add(this.add.circle(x, 365, 44, 0x324760).setStrokeStyle(2, 0x72d9ff, 0.55));
        layer.add(this.add.text(x, 365, '?', { fontSize: '36px', color: '#ffffff' }).setOrigin(0.5));
      }
      const displayName = pokeName(entry.spriteKey, entry.name);
      layer.add(this.add.text(x, 445, displayName, {
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold', fixedWidth: cardW - 12, align: 'center',
      }).setOrigin(0.5));
      layer.add(this.add.text(x, 473,
        `Lv.${entry.level}  ·  ${typeName(entry.type1)}${entry.type2 ? ` / ${typeName(entry.type2)}` : ''}`, {
          fontSize: '10px', color: '#b9cad9', fixedWidth: cardW - 12, align: 'center',
        }).setOrigin(0.5));
      bg.on('pointerover', () => {
        if (this.selectedPartner !== index) sfxMove(this);
        this.selectedPartner = index; this.refreshSelection();
      });
      bg.on('pointerdown', () => {
        this.selectedPartner = index; this.refreshSelection(); this.confirmPartner();
      });
      this.optionCards.push({ bg, stripe, accent: PROD_UI.line });
    });

    const confirm = this.add.rectangle(this.scale.width / 2, 545, 250, 52, 0x16324e, 0.98)
      .setStrokeStyle(2, PROD_UI.cyan, 0.9).setInteractive({ useHandCursor: true });
    const confirmText = this.add.text(this.scale.width / 2, 545, t('CONFIRM PARTNER', '파트너 결정'), {
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    confirm.on('pointerover', () => { confirm.setFillStyle(PROD_UI.cyan, 0.25); sfxMove(this); });
    confirm.on('pointerout', () => confirm.setFillStyle(0x16324e, 0.98));
    confirm.on('pointerdown', () => this.confirmPartner());
    layer.add([confirm, confirmText]);
    this.refreshSelection();
  }

  private confirmPartner() {
    if (this.phase !== 'partner') return;
    const partner = this.party[this.selectedPartner];
    if (!partner) return;
    sfxConfirm(this);
    this.showPartnerOnStage();
    this.round = 0; this.playerScore = 0; this.championScore = 0; this.usedStyles = [];
    this.updateScoreboard();
    this.showDialog([
      t(`MC Mirae: ${playerTrainerName(this.registry)} and ${pokeName(partner.spriteKey, partner.name)} take the blue stage!`,
        `MC 미래: ${playerTrainerName(this.registry)} 선수와 ${pokeName(partner.spriteKey, partner.name)}이(가) 블루 스테이지에 오릅니다!`),
      t('Hwangeum: Do not perform for the cameras. Perform for the partner standing beside you — the cameras will follow.',
        '황금: 카메라를 위해 연기하지 마. 네 곁의 파트너를 위해 보여 줘 — 그러면 카메라는 저절로 따라올 테니까.'),
    ], () => this.showRoundChoices());
  }

  private showPartnerOnStage() {
    this.partnerImage?.destroy();
    this.partnerLabel?.destroy();
    const texture = this.partnerTextureKeys[this.selectedPartner];
    if (!this.textures.exists(texture)) return;
    this.partnerImage = this.add.image(365, 362, texture).setDepth(5);
    this.fitImage(this.partnerImage, 205, 205);
    const partner = this.party[this.selectedPartner];
    this.partnerLabel = this.add.text(365, 484, `${playerTrainerName(this.registry)} · ${pokeName(partner.spriteKey, partner.name)}`, {
      fontSize: '14px', color: '#8ce6ff', fontStyle: 'bold', backgroundColor: '#07111fcc',
      padding: { x: 9, y: 5 },
    }).setOrigin(0.5).setDepth(7);
  }

  private showRoundChoices() {
    this.phase = 'round';
    this.selectedOption = 0;
    this.clearUiLayer();
    const layer = this.add.container(0, 0).setDepth(30);
    this.uiLayer = layer;
    const [titleEn, titleKo] = ROUND_TITLES[this.round];
    layer.add(roundedPanel(this, 230, 505, this.scale.width - 460, 155, {
      fill: PROD_UI.ink, alpha: 0.985, stroke: PROD_UI.line, radius: 18,
    }));
    layer.add(this.add.text(this.scale.width / 2, 520,
      t(`ROUND ${this.round + 1} / 3 · ${titleEn}`, `${this.round + 1}라운드 / 3 · ${titleKo}`), {
        fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5));

    this.optionCards = [];
    APPEALS.forEach((option, index) => {
      const x = this.scale.width / 2 + (index - 1) * 245;
      const bg = this.add.rectangle(x, 596, 220, 82, PROD_UI.panelRaised, 0.98)
        .setStrokeStyle(2, option.accent, 0.55).setInteractive({ useHandCursor: true });
      const stripe = this.add.rectangle(x - 106, 596, 8, 70, option.accent, 0.92);
      const icon = this.add.text(x - 82, 581, option.icon, { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
      const label = this.add.text(x - 55, 566, t(option.labelEn, option.labelKo), {
        fontSize: '15px', color: '#ffffff', fontStyle: 'bold', fixedWidth: 145,
      });
      const desc = this.add.text(x - 55, 593, t(option.descEn, option.descKo), {
        fontSize: '10px', color: '#a9bfd5', fixedWidth: 150, wordWrap: { width: 150 },
      });
      layer.add([bg, stripe, icon, label, desc]);
      bg.on('pointerover', () => {
        if (this.selectedOption !== index) sfxMove(this);
        this.selectedOption = index; this.refreshSelection();
      });
      bg.on('pointerdown', () => { this.selectedOption = index; this.refreshSelection(); this.chooseAppeal(index); });
      this.optionCards.push({ bg, stripe, accent: option.accent });
    });
    this.refreshSelection();
  }

  private chooseAppeal(index: number) {
    if (this.phase !== 'round') return;
    this.phase = 'transition';
    sfxConfirm(this);
    const option = APPEALS[index];
    const gained = this.scoreRound(option.key);
    this.playerScore += gained;
    this.usedStyles.push(option.key);
    this.clearUiLayer();
    this.playAppeal(this.partnerImage, option.key, 365);
    this.playerScoreText.setText(`${playerTrainerName(this.registry)}  ${String(this.playerScore).padStart(3, '0')}`);

    this.time.delayedCall(620, () => {
      const championGain = CHAMPION_ROUND_SCORES[this.round];
      this.championScore += championGain;
      this.playAppeal(this.championMon, (['elegance', 'impact', 'bond'] as AppealStyle[])[this.round], 895);
      this.championScoreText.setText(`${t('HWANGEUM', '황금')}  ${String(this.championScore).padStart(3, '0')}`);
    });
    this.time.delayedCall(1250, () => this.showRoundReaction(option, gained));
  }

  private scoreRound(style: AppealStyle): number {
    const partner = this.party[this.selectedPartner];
    const preferred: AppealStyle[] = ['elegance', 'impact', 'bond'];
    let score = style === preferred[this.round] ? 27 : 24;
    const synergy: Record<AppealStyle, string[]> = {
      elegance: ['water', 'ice', 'fairy', 'psychic', 'flying'],
      impact: ['fire', 'electric', 'fighting', 'rock', 'steel', 'dragon'],
      bond: ['grass', 'normal', 'bug', 'ghost', 'dark', 'poison', 'ground'],
    };
    if (synergy[style].includes(partner.type1) || (!!partner.type2 && synergy[style].includes(partner.type2))) score += 2;
    score += this.usedStyles.includes(style) ? -3 : 2;
    score += partner.level >= 40 ? 2 : partner.level >= 20 ? 1 : 0;
    return Phaser.Math.Clamp(score, 19, 33);
  }

  private playAppeal(image: Phaser.GameObjects.Image | undefined, style: AppealStyle, centerX: number) {
    const layer = this.add.container(0, 0).setDepth(20);
    const centerY = 370;
    if (image) {
      this.tweens.killTweensOf(image);
      image.setPosition(centerX, 362).setAlpha(1).setScale(image.scaleX);
      if (style === 'elegance') {
        this.tweens.add({ targets: image, angle: 8, y: 330, duration: 280, yoyo: true, ease: 'Sine.inOut' });
      } else if (style === 'impact') {
        this.cameras.main.shake(180, 0.006);
        this.tweens.add({ targets: image, scaleX: image.scaleX * 1.16, scaleY: image.scaleY * 1.16,
          duration: 150, yoyo: true, ease: 'Back.out' });
      } else {
        this.tweens.add({ targets: image, y: 338, duration: 360, yoyo: true, ease: 'Sine.inOut' });
      }
    }
    const option = APPEALS.find(item => item.key === style)!;
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14;
      const radius = 45 + (i % 3) * 18;
      const glyph = style === 'elegance' ? '✦' : style === 'impact' ? '◆' : '♥';
      const item = this.add.text(centerX, centerY, glyph, {
        fontSize: `${16 + (i % 3) * 4}px`, color: `#${option.accent.toString(16).padStart(6, '0')}`,
        stroke: '#ffffff', strokeThickness: 1,
      }).setOrigin(0.5).setAlpha(0);
      layer.add(item);
      this.tweens.add({ targets: item,
        x: centerX + Math.cos(angle) * radius * 1.7,
        y: centerY + Math.sin(angle) * radius,
        alpha: { from: 0, to: 1 }, scale: { from: 0.4, to: 1.25 },
        duration: 520, delay: i * 24, yoyo: true, hold: 120,
      });
    }
    const flash = this.add.circle(centerX, centerY, 25, option.accent, 0.36).setStrokeStyle(3, 0xffffff, 0.8);
    layer.add(flash);
    this.tweens.add({ targets: flash, scale: 5, alpha: 0, duration: 620, ease: 'Cubic.out' });
    this.time.delayedCall(1750, () => { if (layer.active) layer.destroy(true); });
  }

  private showRoundReaction(option: AppealOption, gained: number) {
    const partner = this.party[this.selectedPartner];
    const lines = this.round === 0
      ? [
          t(`MC Mirae: ${pokeName(partner.spriteKey, partner.name)} opens with ${t(option.labelEn, option.labelKo)} — ${gained} points!`,
            `MC 미래: ${pokeName(partner.spriteKey, partner.name)}의 첫 어필은 ${t(option.labelEn, option.labelKo)} — ${gained}점입니다!`),
          t('Hwangeum: Good. You let your partner set the rhythm instead of forcing it.',
            '황금: 좋아. 억지로 이끌지 않고 파트너가 리듬을 정하게 했군.'),
        ]
      : this.round === 1
        ? [
            t(`MC Mirae: A clean second appeal earns ${gained} points! The press rail is on its feet!`,
              `MC 미래: 깔끔한 두 번째 어필로 ${gained}점! 기자석까지 모두 일어섰습니다!`),
            t('Hwangeum: Listen to that hall. A crowd can tell when trust is real.',
              '황금: 이 함성을 들어 봐. 관객은 진짜 신뢰를 알아보는 법이야.'),
          ]
        : [
            t(`MC Mirae: The finale lands for ${gained} points! Scores are locked!`,
              `MC 미래: 피날레 어필은 ${gained}점! 최종 점수가 집계됩니다!`),
            t('Hwangeum: Whatever the board says, remember this feeling. That is why we came.',
              '황금: 전광판에 무엇이 뜨든 이 기분을 기억해. 우리가 여기 온 이유니까.'),
          ];
    this.showDialog(lines, () => {
      this.round++;
      if (this.round >= 3) this.finishContest();
      else this.showRoundChoices();
    });
  }

  private finishContest() {
    this.phase = 'transition';
    const partner = this.party[this.selectedPartner];
    const won = this.playerScore >= CHAMPION_TOTAL;
    const resultFlag = won ? 'hasGeumgangGrandRibbon' : 'hasGeumgangRisingRibbon';
    const previousBest = Number(this.registry.get('geumgangContestScore')) || 0;
    const everWon = won || !!this.registry.get('hasGeumgangGrandRibbon');
    recordHwangeumBeat(this.registry, HWANGEUM_STORY.contest);
    this.registry.set(resultFlag, true);
    this.registry.set('geumgangContestScore', Math.max(previousBest, this.playerScore));
    this.registry.set('geumgangContestChampionScore', CHAMPION_TOTAL);
    this.registry.set('geumgangContestPartner', partner.spriteKey);
    this.registry.set('geumgangContestResult', everWon ? 'grand-ribbon' : 'rising-star');
    SaveManager.save(this.registry, 14 * 32 + 16, 9 * 32 + 16, 'GeumgangCityScene');

    const resultLine = won
      ? t(`MC Mirae: ${this.playerScore} to ${CHAMPION_TOTAL} — the Grand Ribbon goes to ${playerTrainerName(this.registry)} and ${pokeName(partner.spriteKey, partner.name)}!`,
          `MC 미래: ${this.playerScore} 대 ${CHAMPION_TOTAL}! 그랜드리본의 주인은 ${playerTrainerName(this.registry)} 선수와 ${pokeName(partner.spriteKey, partner.name)}입니다!`)
      : t(`MC Mirae: ${CHAMPION_TOTAL} to ${this.playerScore} — Hwangeum takes the Grand Ribbon, and our rookie pair receives the Rising Star Ribbon!`,
          `MC 미래: ${CHAMPION_TOTAL} 대 ${this.playerScore}! 황금이 그랜드리본을, 신예 콤비는 라이징스타리본을 받습니다!`);
    const ribbon = won ? t('🏅 Received the GEUMGANG GRAND RIBBON!', '🏅 금강 그랜드리본을 받았다!')
      : t('🎗 Received the GEUMGANG RISING STAR RIBBON!', '🎗 금강 라이징스타리본을 받았다!');

    this.time.delayedCall(350, () => {
      this.cameras.main.flash(480, 255, 238, 160);
      this.showDialog([
        resultLine,
        ribbon,
        t('The press rail erupts. Reporters from across Onnuri call both competitors toward a wall of cameras.',
          '취재석이 들끓는다. 온누리 전역에서 온 기자들이 두 참가자를 카메라 벽 앞으로 불러 세운다.'),
        t('Reporter: Champion, why enter a city contest in the middle of the League season?',
          '기자: 챔피언님, 리그 시즌 한가운데에 왜 도시 콘테스트에 출전하셨습니까?'),
        t('Hwangeum: Because a Champion does not live in the final room of the League. I keep roads open, towns safe, and stages like this worth gathering around.',
          '황금: 챔피언은 리그의 마지막 방에만 사는 사람이 아니니까요. 길을 열어 두고, 마을을 지키고, 사람들이 이런 무대에 모일 수 있게 하는 것이 제 일입니다.'),
        t(`Hwangeum: And because Onnuri should know this pair's name. ${playerTrainerName(this.registry)} — we will meet again where the region needs us.`,
          `황금: 그리고 온누리가 이 콤비의 이름을 알아야 하니까요. ${playerTrainerName(this.registry)} — 지방이 우리를 필요로 하는 곳에서 다시 만나자.`),
      ], () => this.showExitOnly());
    });
  }

  private showCompletedLobby() {
    const score = Number(this.registry.get('geumgangContestScore')) || 0;
    const result = this.registry.get('geumgangContestResult') === 'grand-ribbon'
      ? t('Grand Ribbon winner', '그랜드리본 우승') : t('Rising Star honoree', '라이징스타리본 수상');
    this.showDialog([
      t(`The hall's main display preserves your ${score}-point performance — ${result}.`,
        `홀의 메인 전광판에는 ${score}점의 공연 기록이 남아 있다 — ${result}.`),
      t('A recorded message from Hwangeum waits beside the ribbon case: “A stage only lives when someone steps onto it again.”',
        '리본 진열장 옆에는 황금의 녹화 메시지가 남아 있다. “무대는 누군가 다시 오를 때 살아나는 법이야.”'),
    ], () => this.showLobbyActions());
  }

  private showLobbyActions() {
    this.phase = 'lobby'; this.selectedOption = 0;
    this.clearUiLayer();
    const layer = this.add.container(0, 0).setDepth(30); this.uiLayer = layer;
    layer.add(roundedPanel(this, 350, 505, 580, 135, {
      fill: PROD_UI.ink, alpha: 0.985, stroke: PROD_UI.yellow, radius: 18,
    }));
    layer.add(this.add.text(this.scale.width / 2, 526, t('CONTEST HALL ARCHIVE', '콘테스트 홀 아카이브'), {
      fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));
    this.optionCards = [];
    const actions = [
      [t('PLAY EXHIBITION AGAIN', '다시 참가하기'), PROD_UI.cyan],
      [t('RETURN TO GEUMGANG', '금강시티로 돌아가기'), PROD_UI.yellow],
    ] as const;
    actions.forEach(([label, accent], index) => {
      const x = this.scale.width / 2 + (index === 0 ? -145 : 145);
      const bg = this.add.rectangle(x, 586, 260, 54, PROD_UI.panelRaised, 0.98)
        .setStrokeStyle(2, accent, 0.75).setInteractive({ useHandCursor: true });
      const stripe = this.add.rectangle(x - 125, 586, 7, 44, accent, 0.95);
      const text = this.add.text(x, 586, label, { fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      layer.add([bg, stripe, text]);
      bg.on('pointerover', () => { this.selectedOption = index; this.refreshSelection(); sfxMove(this); });
      bg.on('pointerdown', () => { this.selectedOption = index; this.confirmLobbyAction(); });
      this.optionCards.push({ bg, stripe, accent });
    });
    this.refreshSelection();
  }

  private confirmLobbyAction() {
    if (this.phase !== 'lobby') return;
    sfxConfirm(this);
    if (this.selectedOption === 0) {
      this.showPartnerSelection();
    } else this.exitToCity();
  }

  private showExitOnly() {
    this.phase = 'exit';
    this.clearUiLayer();
    const layer = this.add.container(0, 0).setDepth(30); this.uiLayer = layer;
    const bg = this.add.rectangle(this.scale.width / 2, 580, 320, 58, PROD_UI.panelRaised, 0.98)
      .setStrokeStyle(2, PROD_UI.yellow, 0.9).setInteractive({ useHandCursor: true });
    const stripe = this.add.rectangle(this.scale.width / 2 - 153, 580, 8, 46, PROD_UI.yellow, 0.95);
    const text = this.add.text(this.scale.width / 2, 580, t('RETURN TO GEUMGANG CITY', '금강시티로 돌아가기'), {
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    bg.on('pointerover', () => sfxMove(this));
    bg.on('pointerdown', () => { sfxConfirm(this); this.exitToCity(); });
    layer.add([bg, stripe, text]);
    this.optionCards = [{ bg, stripe, accent: PROD_UI.yellow }];
  }

  private showDialog(lines: string[], onDone: () => void) {
    this.phase = 'dialog';
    this.clearUiLayer();
    this.dialog.show(lines, () => {
      this.phase = 'transition';
      onDone();
    });
  }

  private moveSelection(delta: number, count: number) {
    if (count <= 0) return;
    if (this.phase === 'partner') this.selectedPartner = (this.selectedPartner + delta + count) % count;
    else this.selectedOption = (this.selectedOption + delta + count) % count;
    sfxMove(this); this.refreshSelection();
  }

  private refreshSelection() {
    const active = this.phase === 'partner' ? this.selectedPartner : this.selectedOption;
    this.optionCards.forEach((card, index) => {
      const selected = index === active;
      card.bg.setFillStyle(selected ? 0x244f70 : PROD_UI.panelRaised, selected ? 1 : 0.98);
      card.bg.setStrokeStyle(selected ? 3 : 2, selected ? 0xffffff : card.accent, selected ? 0.95 : 0.7);
      card.stripe.setAlpha(selected ? 1 : 0.72);
    });
  }

  private updateScoreboard() {
    this.playerScoreText.setText(`${playerTrainerName(this.registry)}  ${String(this.playerScore).padStart(3, '0')}`);
    this.championScoreText.setText(`${t('HWANGEUM', '황금')}  ${String(this.championScore).padStart(3, '0')}`);
  }

  private clearUiLayer() {
    this.uiLayer?.destroy(true);
    this.uiLayer = undefined;
    this.optionCards = [];
  }

  private exitToCity() {
    if (this.exiting) return;
    this.exiting = true;
    this.phase = 'transition';
    this.clearUiLayer();
    const x = 14 * 32 + 16, y = 9 * 32 + 16;
    this.registry.set('geumgangCityReturnX', x);
    this.registry.set('geumgangCityReturnY', y);
    SaveManager.save(this.registry, x, y, 'GeumgangCityScene');
    this.cameras.main.fadeOut(450, 0, 0, 0, () => this.scene.start('GeumgangCityScene'));
  }
}
