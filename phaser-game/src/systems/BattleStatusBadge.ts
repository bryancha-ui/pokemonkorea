import Phaser from 'phaser';
import { t } from './i18n';

interface StatusBadgeStyle {
  label: string;
  background: string;
  foreground: string;
}

function badgeStyle(status?: string): StatusBadgeStyle | undefined {
  switch ((status ?? 'none').toLowerCase()) {
    case 'psn': case 'tox': return { label: t('PSN', '독'), background: '#9847c7', foreground: '#ffffff' };
    case 'par': return { label: t('PAR', '마비'), background: '#f2c94c', foreground: '#251f08' };
    case 'frz': return { label: t('FRZ', '얼음'), background: '#75d7ee', foreground: '#082633' };
    case 'brn': return { label: t('BRN', '화상'), background: '#e85b38', foreground: '#ffffff' };
    case 'slp': return { label: t('SLP', '잠듦'), background: '#777f9c', foreground: '#ffffff' };
    default: return undefined;
  }
}

/** A compact, localized major-status pill that stays beside a battle HUD name. */
export class BattleStatusBadge {
  readonly text: Phaser.GameObjects.Text;

  constructor(
    private nameText: Phaser.GameObjects.Text,
    private rightEdge: () => number,
    depth?: number,
  ) {
    this.text = nameText.scene.add.text(nameText.x, nameText.y, '', {
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffffff',
      padding: { x: 4, y: 2 },
    }).setOrigin(0, 0).setVisible(false).setDepth(depth ?? nameText.depth + 1);
  }

  sync(status?: string): void {
    const style = badgeStyle(status);
    if (!style) {
      this.text.setVisible(false);
      return;
    }
    this.text
      .setText(style.label)
      .setColor(style.foreground)
      .setBackgroundColor(style.background)
      .setVisible(this.nameText.visible)
      .setAlpha(this.nameText.alpha);

    const desiredX = this.nameText.x + this.nameText.displayWidth + 6;
    const maxX = this.rightEdge() - this.text.displayWidth;
    this.text.setPosition(Math.max(this.nameText.x, Math.min(desiredX, maxX)), this.nameText.y - 1);
  }
}
