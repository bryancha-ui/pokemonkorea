import Phaser from 'phaser';
import { showRewardCeremony } from '../systems/RewardCeremony';
import {
  clearPostBattleReward,
  pendingPostBattleReward,
} from '../systems/PostBattleRewards';
import { sfxItemGet } from '../systems/UiSfx';
import { t, tr } from '../systems/i18n';

/** Transparent overlay shown over the returned gym/map after battle shutdown.
 * The map is paused so farewell dialogue, movement and pending evolution checks
 * cannot race the badge/TM presentation. */
export class PostBattleRewardScene extends Phaser.Scene {
  private parentKey = '';
  private parentPaused = false;

  constructor() { super('PostBattleRewardScene'); }

  init(data?: { parentKey?: string }): void {
    this.parentKey = data?.parentKey ?? '';
  }

  create(): void {
    const pending = pendingPostBattleReward(this.registry);
    if (!pending) { this.scene.stop(); return; }
    this.parentKey = this.parentKey || pending.returnScene;
    if (this.parentKey && this.scene.isActive(this.parentKey)) {
      this.scene.pause(this.parentKey);
      this.parentPaused = true;
    }
    this.scene.bringToTop();
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.resumeParent());

    showRewardCeremony(this, {
      kind: 'badge', key: pending.badgeFlag,
      onComplete: () => this.showReceipt(pending.badgeName, pending.tmName),
    });
  }

  private showReceipt(badgeName: string, tmName?: string): void {
    const W = this.scale.width, H = this.scale.height;
    const panelW = Phaser.Math.Clamp(W * 0.72, 520, 920);
    const panelH = Phaser.Math.Clamp(H * 0.22, 132, 180);
    const panel = this.add.container(W / 2, H * 0.72).setDepth(10020).setAlpha(0).setScale(0.94);
    panel.add(this.add.rectangle(0, 0, panelW, panelH, 0x081729, 0.97)
      .setStrokeStyle(3, 0xffdf68, 0.94));
    panel.add(this.add.circle(-panelW / 2 + 78, 0, 42, 0x21466c, 1)
      .setStrokeStyle(3, 0xffdf68, 0.9));
    panel.add(this.add.text(-panelW / 2 + 78, 0, tmName ? '💿' : '🏅', {
      fontSize: '46px', align: 'center',
    }).setOrigin(0.5));

    const badgeDisplay = tr(badgeName);
    const tmDisplay = tmName ? tr(tmName) : '';
    const title = tmName
      ? t(`Received TM — ${tmDisplay}!`, `기술머신 — ${tmDisplay}을(를) 받았다!`, `わざマシン「${tmDisplay}」を てにいれた！`)
      : t(`${badgeDisplay} was added to the Badge Case!`, `${badgeDisplay}가 배지 케이스에 등록되었다!`, `${badgeDisplay}を バッジケースに おさめた！`);
    const subtitle = tmName
      ? t('It is now available in your Bag.', '가방에서 바로 확인할 수 있다.', 'バッグから かくにんできます。')
      : t('Your Gym victory is now official.', '체육관 승리가 공식적으로 기록되었다.', 'ジムしょうりが きろくされました。');
    panel.add(this.add.text(-panelW / 2 + 145, -21, title, {
      fontSize: `${Phaser.Math.Clamp(Math.round(W / 48), 22, 32)}px`,
      color: '#fff4ba', fontStyle: 'bold', wordWrap: { width: panelW - 180 },
    }).setOrigin(0, 0.5));
    panel.add(this.add.text(-panelW / 2 + 145, 29, subtitle, {
      fontSize: `${Phaser.Math.Clamp(Math.round(W / 68), 16, 23)}px`,
      color: '#c8daed', wordWrap: { width: panelW - 180 },
    }).setOrigin(0, 0.5));
    if (tmName) sfxItemGet(this);

    this.tweens.add({
      targets: panel, alpha: 1, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.Out',
      onComplete: () => this.time.delayedCall(1650, () => this.tweens.add({
        targets: panel, alpha: 0, y: panel.y - 18, duration: 260,
        onComplete: () => this.finishReward(),
      })),
    });
  }

  private finishReward(): void {
    clearPostBattleReward(this.registry);
    this.resumeParent();
    this.scene.stop();
  }

  private resumeParent(): void {
    if (!this.parentPaused || !this.parentKey) return;
    this.parentPaused = false;
    if (this.scene.isPaused(this.parentKey)) this.scene.resume(this.parentKey);
  }
}
