import Phaser from 'phaser';
import { TYPE_COLORS } from '../data/StarterData';
import {
  BreedingSystem, type BreedingCandidate, type BreedingGender, type NurseryParent,
} from '../systems/BreedingSystem';
import { t } from '../systems/i18n';
import { PartySystem } from '../systems/PartySystem';

const PAGE_SIZE = 8;

/** Mouse/touch-friendly daycare storage, compatibility and Egg status screen. */
export class NurseryManageScene extends Phaser.Scene {
  private parentKey = 'NurseryScene';
  private page = 0;
  private content!: Phaser.GameObjects.Container;
  private info!: Phaser.GameObjects.Text;
  private escKey!: Phaser.Input.Keyboard.Key;
  private message = '';

  constructor() { super('NurseryManageScene'); }
  init(data: { parentKey?: string }) { this.parentKey = data.parentKey ?? 'NurseryScene'; }

  create() {
    this.scene.bringToTop();
    this.cameras.main.fadeIn(150);
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x0b1520, 0.985);
    this.add.text(this.scale.width / 2, 30, t('🥚  PINE NEEDLE POKÉMON NURSERY', '🥚  솔잎마을 포켓몬 키우미집'), {
      fontSize: '23px', color: '#ffe49a', fontStyle: 'bold', stroke: '#38210f', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(this.scale.width - 28, 30, t('✕ CLOSE', '✕ 닫기'), { fontSize: '14px', color: '#bbb' })
      .setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());
    this.add.text(42, 68, t('POKÉMON IN CARE', '맡긴 포켓몬'), { fontSize: '14px', color: '#8fd89b', fontStyle: 'bold' });
    this.add.text(650, 68, t('EGG STATUS', '알 상태'), { fontSize: '14px', color: '#8fc8ef', fontStyle: 'bold' });
    this.add.text(42, 288, t('CHOOSE FROM PARTY / BOX', '동료 / 보관함에서 선택'), { fontSize: '14px', color: '#ffe49a', fontStyle: 'bold' });

    this.info = this.add.text(this.scale.width / 2, this.scale.height - 22, '', {
      fontSize: '14px', color: '#c9dcff', align: 'center',
    }).setOrigin(0.5);
    this.content = this.add.container(0, 0);
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT).on('down', () => this.changePage(-1));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT).on('down', () => this.changePage(1));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.changePage(dy > 0 ? 1 : -1));
    this.render();
  }

  update() { if (Phaser.Input.Keyboard.JustDown(this.escKey)) this.close(); }

  private render() {
    this.content.removeAll(true);
    const state = BreedingSystem.getState(this.registry);
    const candidates = BreedingSystem.candidates(this.registry);
    const pageCount = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));
    this.page = Phaser.Math.Clamp(this.page, 0, pageCount - 1);

    for (let i = 0; i < 2; i++) this.parentSlot(state.parents[i], i, 42 + i * 295, 95);

    const match = BreedingSystem.compatibility(state.parents[0]?.mon, state.parents[1]?.mon);
    this.content.add(this.add.text(42, 232, match.reason, {
      fontSize: '13px', color: match.compatible ? (match.rating === 'excellent' ? '#ffe26f' : '#9ee6a6') : '#9aa4b4',
      wordWrap: { width: 565 },
    }));
    if (match.compatible && !state.eggReady) {
      const pct = Math.min(100, Math.floor(state.eggProgress / match.requiredSteps * 100));
      this.content.add(this.add.rectangle(324, 266, 560, 12, 0x26364a));
      this.content.add(this.add.rectangle(44 + 2.8 * pct, 266, 5.6 * pct, 12, 0x62bb75));
      this.content.add(this.add.text(324, 266, `${pct}%`, { fontSize: '10px', color: '#fff' }).setOrigin(0.5));
    }

    this.eggPanel(state.eggReady, state.carriedEgg);

    const shown = candidates.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    shown.forEach((candidate, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      this.candidateSlot(candidate, 42 + col * 590, 325 + row * 72, state.parents.length < 2);
    });
    if (!shown.length) {
      this.content.add(this.add.text(320, 430, t('No Pokémon are available.', '맡길 수 있는 포켓몬이 없습니다.'), { fontSize: '15px', color: '#657083' }).setOrigin(0.5));
    }

    if (pageCount > 1) {
      this.smallButton(t('◀ PREV', '◀ 이전'), 930, 620, () => this.changePage(-1), this.page > 0);
      this.content.add(this.add.text(1060, 620, `${this.page + 1} / ${pageCount}`, { fontSize: '13px', color: '#ffe49a' }).setOrigin(0.5));
      this.smallButton(t('NEXT ▶', '다음 ▶'), 1180, 620, () => this.changePage(1), this.page < pageCount - 1);
    }
    this.info.setText(this.message || t('Two compatible Pokémon can produce an Egg as you walk.', '서로 잘 맞는 두 포켓몬을 맡기고 걸으면 알이 생깁니다.'));
  }

  private parentSlot(parent: NurseryParent | undefined, index: number, x: number, y: number) {
    const bg = this.add.rectangle(x + 135, y + 55, 270, 110, parent ? 0x183c2a : 0x111d28)
      .setStrokeStyle(2, parent ? 0x5ba66c : 0x304050);
    this.content.add(bg);
    if (!parent) {
      this.content.add(this.add.text(x + 135, y + 55, t(`SLOT ${index + 1}\n— empty —`, `자리 ${index + 1}\n— 비어 있음 —`), {
        fontSize: '14px', color: '#617080', align: 'center',
      }).setOrigin(0.5));
      return;
    }
    const mon = parent.mon;
    const gender = BreedingSystem.genderOf(mon);
    const typeColor = TYPE_COLORS[mon.type1] ?? 0x888888;
    this.content.add(this.add.circle(x + 34, y + 40, 22, typeColor, 0.85));
    this.content.add(this.add.text(x + 34, y + 40, mon.type1[0].toUpperCase(), { fontSize: '16px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
    this.content.add(this.add.text(x + 66, y + 18, `${mon.name}  ${this.genderIcon(gender)}`, { fontSize: '16px', color: '#fff', fontStyle: 'bold' }));
    this.content.add(this.add.text(x + 66, y + 44, `Lv.${mon.level}  ${mon.type1}${mon.type2 ? ` / ${mon.type2}` : ''}`, { fontSize: '12px', color: '#a9c7b0' }));
    this.smallButton(t('TAKE BACK', '데려오기'), x + 198, y + 86, () => {
      const r = BreedingSystem.withdraw(this.registry, index); this.message = r.message; this.render();
    });
  }

  private eggPanel(ready: ReturnType<typeof BreedingSystem.getState>['eggReady'], carried: ReturnType<typeof BreedingSystem.getState>['carriedEgg']) {
    const x = 650, y = 95;
    this.content.add(this.add.rectangle(x + 285, y + 86, 570, 172, 0x12273a).setStrokeStyle(2, 0x386b8c));
    if (ready) {
      const partyFull = PartySystem.isFull(this.registry);
      this.content.add(this.add.text(x + 80, y + 72, '🥚', { fontSize: '52px' }).setOrigin(0.5));
      this.content.add(this.add.text(x + 145, y + 35, t('An Egg was found!', '포켓몬의 알을 발견했습니다!'), { fontSize: '18px', color: '#ffe49a', fontStyle: 'bold' }));
      const guidance = carried
        ? t('You are already carrying another Egg.', '이미 다른 알을 부화시키는 중입니다.')
        : partyFull
          ? t('Your party is full. Make at least one empty slot first.', '동료가 가득 찼습니다. 먼저 빈자리 한 칸을 만들어 주세요.')
          : t('The Egg will occupy one party slot until it hatches.', '알은 부화할 때까지 동료 한 자리를 차지합니다.');
      this.content.add(this.add.text(x + 145, y + 66, guidance,
        { fontSize: '13px', color: carried || partyFull ? '#ff9c9c' : '#b8cce0' }));
      this.smallButton(t('RECEIVE EGG', '알 받기'), x + 385, y + 124, () => {
        const r = BreedingSystem.claimEgg(this.registry); this.message = r.message; this.render();
      }, !carried && !partyFull);
    } else if (carried) {
      const total = Math.max(1, carried.totalSteps);
      const pct = Phaser.Math.Clamp(Math.floor((total - carried.stepsRemaining) / total * 100), 0, 100);
      this.content.add(this.add.text(x + 75, y + 70, '🥚', { fontSize: '48px' }).setOrigin(0.5));
      this.content.add(this.add.text(x + 135, y + 30, t('Egg in incubation', '알을 부화시키는 중'), { fontSize: '18px', color: '#d8efff', fontStyle: 'bold' }));
      this.content.add(this.add.text(x + 135, y + 62, t(`${carried.stepsRemaining} steps remaining`, `부화까지 ${carried.stepsRemaining}걸음`), { fontSize: '14px', color: '#9ec4df' }));
      this.content.add(this.add.rectangle(x + 285, y + 118, 430, 15, 0x26364a));
      this.content.add(this.add.rectangle(x + 70 + 2.15 * pct, y + 118, 4.3 * pct, 15, 0x7fc9ef));
      this.content.add(this.add.text(x + 285, y + 118, `${pct}%`, { fontSize: '11px', color: '#fff' }).setOrigin(0.5));
    } else {
      this.content.add(this.add.text(x + 285, y + 72, t('No Egg has been found yet.', '아직 발견된 알이 없습니다.'), { fontSize: '17px', color: '#71869a' }).setOrigin(0.5));
      this.content.add(this.add.text(x + 285, y + 105, t('Leave a compatible pair and explore the world.', '서로 잘 맞는 두 마리를 맡기고 모험을 계속하세요.'), { fontSize: '13px', color: '#52687b' }).setOrigin(0.5));
    }
  }

  private candidateSlot(candidate: BreedingCandidate, x: number, y: number, enabled: boolean) {
    const mon = candidate.mon;
    const bg = this.add.rectangle(x + 275, y + 28, 550, 58, enabled ? 0x172333 : 0x111820)
      .setStrokeStyle(1, enabled ? 0x354b62 : 0x232c36);
    this.content.add(bg);
    const typeColor = TYPE_COLORS[mon.type1] ?? 0x888888;
    this.content.add(this.add.circle(x + 25, y + 28, 17, typeColor, enabled ? 0.85 : 0.35));
    this.content.add(this.add.text(x + 50, y + 9, `${mon.name}  ${this.genderIcon(candidate.gender)}`, { fontSize: '14px', color: enabled ? '#fff' : '#59616b', fontStyle: 'bold' }));
    this.content.add(this.add.text(x + 50, y + 31, `${candidate.source === 'party' ? t('PARTY', '동료') : t('BOX', '보관함')} · Lv.${mon.level} · ${mon.type1}${mon.type2 ? `/${mon.type2}` : ''}`, { fontSize: '11px', color: enabled ? '#93aabd' : '#49515a' }));
    this.smallButton(t('LEAVE', '맡기기'), x + 490, y + 28, () => {
      const r = BreedingSystem.deposit(this.registry, candidate.source, candidate.index); this.message = r.message; this.render();
    }, enabled);
  }

  private genderIcon(gender: BreedingGender): string {
    return gender === 'male' ? '♂' : gender === 'female' ? '♀' : '–';
  }

  private smallButton(label: string, x: number, y: number, cb: () => void, enabled = true) {
    const bg = this.add.rectangle(x, y, 132, 30, enabled ? 0x2d6842 : 0x27313b)
      .setStrokeStyle(1, enabled ? 0x65b477 : 0x3b4650);
    const tx = this.add.text(x, y, label, { fontSize: '12px', color: enabled ? '#fff' : '#69737d', fontStyle: 'bold' }).setOrigin(0.5);
    this.content.add([bg, tx]);
    if (enabled) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => bg.setFillStyle(0x3a8052));
      bg.on('pointerout', () => bg.setFillStyle(0x2d6842));
      bg.on('pointerdown', cb);
    }
  }

  private changePage(delta: number) {
    const count = Math.max(1, Math.ceil(BreedingSystem.candidates(this.registry).length / PAGE_SIZE));
    const next = Phaser.Math.Clamp(this.page + delta, 0, count - 1);
    if (next !== this.page) { this.page = next; this.render(); }
  }

  private close() {
    this.cameras.main.fadeOut(150, 0, 0, 0, () => { this.scene.stop(); this.scene.resume(this.parentKey); });
  }
}
