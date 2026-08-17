import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { fontScaleForScene } from '../systems/UiScale';
import { deckSetDialogueMode } from '../systems/TouchControls';

export class DialogBox {
  private bg!: Phaser.GameObjects.Graphics;
  private msgText!: Phaser.GameObjects.Text;
  private arrow!: Phaser.GameObjects.Text;
  private choiceBg!: Phaser.GameObjects.Graphics;
  private choiceItems!: Phaser.GameObjects.Text[];

  private queue: string[] = [];
  private onDone?: () => void;
  private typing = false;
  private fullLine = '';
  private charIdx = 0;
  private typeTimer?: Phaser.Time.TimerEvent;
  private arrowTween?: Phaser.Tweens.Tween;
  private maxTextLines = 4;

  private inChoice = false;
  private choiceIdx = 0;
  private onYes?: () => void;
  private onNo?: () => void;

  private root!: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene, private W: number, private H: number) {
    // All objects are placed at absolute screen-design coordinates, then parented
    // into a container that counteracts the camera zoom so the dialog is always
    // fully visible at the bottom of the screen (see applyZoomCompensation()).
    // Box + font are sized large so dialogue stays legible when the 16:9 canvas is
    // scaled down to fit a phone's narrow top pane.
    // The global screen-ratio font multiplier grows the text below. Keep the
    // panels compact instead of multiplying their dimensions by the same amount:
    // long enlarged lines are paginated in show() rather than widening the UI.
    const S = fontScaleForScene(scene);
    const boxX = Math.max(16, Math.round(W * 0.055));
    const boxW = W - boxX * 2;
    const boxH = Math.min(Math.round(176 + 72 * (S - 1)), Math.round(H * 0.34));
    const boxTop = H - boxH - 12;
    const textInset = Math.round(16 + 4 * (S - 1));
    this.maxTextLines = Math.max(2, Math.floor((boxH - 24) / (30 * S)));
    this.bg = this.makePanel(boxX, boxTop, boxW, boxH, 18).setVisible(false);

    this.msgText = scene.add.text(boxX + textInset, boxTop + Math.round(8 + 3 * (S - 1)), '', {
      fontSize: '22px', color: '#ffffff',
      wordWrap: { width: boxW - textInset * 2, useAdvancedWrap: true }, lineSpacing: 8,
    }).setVisible(false);

    this.arrow = scene.add.text(boxX + boxW - Math.round(18 + 4 * (S - 1)), H - 38, '▼  ENTER', {
      fontSize: '15px', color: '#ffe44e', fontStyle: 'bold',
    }).setOrigin(1, 0).setVisible(false);

    const chW = Math.min(Math.round(150 * S), 210);
    const chH = Math.min(Math.round(84 * S), 124);
    const chX = boxX + boxW - chW, chY = boxTop - chH - 8;
    this.choiceBg = this.makePanel(chX, chY, chW, chH, 14).setVisible(false);

    this.choiceItems = [
      scene.add.text(chX + chW / 2, chY + chH * 0.27, `▶ ${tr('YES')}`, { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5).setVisible(false),
      scene.add.text(chX + chW / 2, chY + chH * 0.73, `  ${tr('NO')}`,  { fontSize: '22px', color: '#aaaaaa' }).setOrigin(0.5).setVisible(false),
    ];

    this.root = scene.add.container(0, 0, [
      this.bg, this.msgText, this.arrow, this.choiceBg, ...this.choiceItems,
    ]).setScrollFactor(0).setDepth(300);

    this.applyZoomCompensation();
  }

  /** Layered navy/white/red panel used by every overworld conversation. */
  private makePanel(x: number, y: number, w: number, h: number, radius: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.fillStyle(0x071027, 0.36);
    g.fillRoundedRect(x + 5, y + 7, w, h, radius);
    g.fillStyle(0xf7fbff, 0.98);
    g.fillRoundedRect(x, y, w, h, radius);
    g.fillStyle(0x15264d, 0.98);
    g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, Math.max(4, radius - 4));
    g.lineStyle(3, 0xe9443f, 0.95);
    g.beginPath();
    g.moveTo(x + radius, y + 5);
    g.lineTo(x + w * 0.34, y + 5);
    g.strokePath();
    g.lineStyle(2, 0x67b9e8, 0.9);
    g.beginPath();
    g.moveTo(x + w * 0.66, y + h - 5);
    g.lineTo(x + w - radius, y + h - 5);
    g.strokePath();
    return g;
  }

  /** Make the container render at exact screen coords regardless of camera zoom. */
  private applyZoomCompensation() {
    const zoom = this.scene.cameras.main?.zoom ?? 1;
    const cx = this.W / 2, cy = this.H / 2;
    const s = 1 / zoom;
    this.root.setScale(s);
    this.root.setPosition(cx * (1 - s), cy * (1 - s));
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  show(lines: string[], onDone?: () => void) {
    // Auto-translate first, then split only at the renderer's real wrap points.
    // This keeps a larger font inside the same compact panel without clipping.
    this.queue = lines.map(tr).flatMap(line => this.paginate(line));
    this.onDone = onDone;
    this.inChoice = false;
    // On mobile, clear the movement stick and fade A/B so this box reads clearly.
    deckSetDialogueMode(true);
    this.bg.setVisible(true);
    this.msgText.setVisible(true);
    this.typeNext();
  }

  showChoice(onYes: () => void, onNo: () => void) {
    this.onYes = onYes;
    this.onNo  = onNo;
    this.inChoice = true;
    this.choiceIdx = 0;
    // A Yes/No choice is navigated with the stick (up/down) and A (confirm), so
    // bring the controls back for it — the choice UI sits above the dialog box.
    deckSetDialogueMode(false);
    // Keep the main dialog bg visible so isOpen() stays true
    this.bg.setVisible(true);
    this.choiceBg.setVisible(true);
    this.choiceItems.forEach(t => t.setVisible(true));
    this.refreshChoice();
  }

  // Call this on SPACE / ENTER keydown
  advance() {
    if (!this.isOpen()) return;
    if (this.inChoice) return;

    if (this.typing) {
      this.typeTimer?.destroy();
      this.msgText.setText(this.fullLine);
      this.typing = false;
      this.showArrow();
      return;
    }
    this.typeNext();
  }

  // Call this on UP / DOWN keydown when choice is open
  navigateChoice(dir: 1 | -1) {
    if (!this.inChoice) return;
    this.choiceIdx = (this.choiceIdx + dir + 2) % 2;
    this.refreshChoice();
  }

  // Call this on SPACE / ENTER when choice is open
  confirmChoice() {
    if (!this.inChoice) return;
    const yes = this.choiceIdx === 0;
    this.choiceBg.setVisible(false);
    this.choiceItems.forEach(t => t.setVisible(false));
    this.inChoice = false;
    this.hide();
    if (yes) this.onYes?.();
    else     this.onNo?.();
  }

  isOpen()     { return this.bg.visible || this.inChoice; }
  isInChoice() { return this.inChoice; }

  // ── Private ────────────────────────────────────────────────────────────────

  private paginate(line: string): string[] {
    const wrapped = this.msgText.getWrappedText(line);
    if (wrapped.length <= this.maxTextLines) return [line];
    const pages: string[] = [];
    for (let i = 0; i < wrapped.length; i += this.maxTextLines) {
      pages.push(wrapped.slice(i, i + this.maxTextLines).join('\n'));
    }
    return pages;
  }

  private typeNext() {
    this.hideArrow();
    if (this.queue.length === 0) {
      this.hide();
      this.onDone?.();
      return;
    }
    this.fullLine = this.queue.shift()!;
    this.charIdx  = 0;
    this.typing   = true;
    this.msgText.setText('');

    this.typeTimer?.destroy();
    this.typeTimer = this.scene.time.addEvent({
      delay: 28,
      repeat: this.fullLine.length - 1,
      callback: () => {
        this.msgText.setText(this.fullLine.slice(0, ++this.charIdx));
        if (this.charIdx >= this.fullLine.length) {
          this.typing = false;
          this.showArrow();
        }
      },
    });
  }

  private showArrow() {
    this.arrow.setVisible(true).setAlpha(1);
    this.arrowTween?.destroy();
    this.arrowTween = this.scene.tweens.add({
      targets: this.arrow, alpha: 0, duration: 420, yoyo: true, repeat: -1,
    });
  }

  private hideArrow() {
    this.arrowTween?.destroy();
    this.arrow.setVisible(false);
  }

  private refreshChoice() {
    this.choiceItems[0].setText(`${this.choiceIdx === 0 ? '▶' : '  '} ${tr('YES')}`)
      .setColor(this.choiceIdx === 0 ? '#ffffff' : '#888888');
    this.choiceItems[1].setText(`${this.choiceIdx === 1 ? '▶' : '  '} ${tr('NO')}`)
      .setColor(this.choiceIdx === 1 ? '#ffffff' : '#888888');
  }

  hide() {
    this.typeTimer?.destroy();
    this.hideArrow();
    [this.bg, this.msgText, this.choiceBg].forEach(o => o.setVisible(false));
    this.choiceItems.forEach(t => t.setVisible(false));
    this.typing = false;
    this.inChoice = false;
    // Restore the movement stick + solid A/B now the box is gone.
    deckSetDialogueMode(false);
  }
}
