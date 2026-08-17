import Phaser from 'phaser';
import { STARTERS, StarterDef, TYPE_COLORS } from '../data/StarterData';
import { PartySystem } from '../systems/PartySystem';
import { DexTracker } from '../systems/DexTracker';
import { Inventory } from '../systems/Items';
import { rivalTrainerName } from '../data/CharacterSprite';
import { t, tr, pokeNameEn, abilityName, typeName } from '../systems/i18n';
import { sfxBallOpen, sfxCancel, sfxConfirm, sfxMove } from '../systems/UiSfx';
import { isTouchDevice } from '../systems/TouchControls';

// ── Desk + reveal geometry (the lab's authored 800×500 space) ─────────────────
// The three balls sit in a row on the desk, and the reveal stage is anchored
// DIRECTLY ABOVE whichever one is selected — the starter has to look like it came
// out of the ball the player is pointing at, not out of a fixed spot on the wall.
const BALL_XS = [230, 400, 570];
const BALL_REST_Y = 330;
const BALL_LIFT_Y = 322;          // the selected ball rises slightly
const BALL_RADIUS = 21;
/** The artwork's footprint, stacked up from just above the lifted ball. */
const ARTWORK_MAX = 176;
const STAGE_BOTTOM = BALL_LIFT_Y - BALL_RADIUS - 5;   // 5px of air over the ball
const ARTWORK_Y = STAGE_BOTTOM - ARTWORK_MAX / 2;
const STAGE_TOP = STAGE_BOTTOM - ARTWORK_MAX;
const NAME_BASELINE = STAGE_TOP - 22;
const BADGE_Y = STAGE_TOP - 12;
/** The caption band: ability, flavour and the control hint, laid out upward from
 *  the bottom edge of the view by MEASURED height (see layoutInfoBand). */
const BAND_BOTTOM = 497;

export class StarterSelectScene extends Phaser.Scene {
  private selectedIdx = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  /** One Poké Ball per starter, resting on the lab desk. */
  private balls: Phaser.GameObjects.Container[] = [];
  /** The reveal stage above the desk: name plate + 3D model when available. */
  private revealSprite?: Phaser.GameObjects.Image;
  /** Spotlight pool behind the reveal; slides along the desk with the selection. */
  private revealGlow!: Phaser.GameObjects.Container;
  private nameText!: Phaser.GameObjects.Text;
  private typeBadges: Phaser.GameObjects.GameObject[] = [];
  private abilityText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  /** Backing plate behind the caption band; redrawn to fit its measured text. */
  private infoPanel!: Phaser.GameObjects.Graphics;
  private openedIdx = -1;
  private flavText!: Phaser.GameObjects.Text;
  private profText!: Phaser.GameObjects.Text;
  private bubbleGfx!: Phaser.GameObjects.Graphics;
  private profAdvance!: Phaser.GameObjects.Text;
  private confirmPanel!: Phaser.GameObjects.Container;
  private confirmIdx = 0;
  private confirming = false;
  private transitioning = false;  // guard against double-confirm

  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private upKey!: Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;

  private professorPages: string[] = [];
  private professorPageIdx = -1;
  private professorDialogueActive = false;
  private professorTyping = false;
  private professorFullPage = '';
  private professorTimer?: Phaser.Time.TimerEvent;
  private professorArrowTween?: Phaser.Tweens.Tween;
  private professorOnDone?: () => void;

  constructor() { super('StarterSelectScene'); }

  preload() {
    STARTERS.forEach(s => {
      if (!this.textures.exists(s.spriteKey))
        this.load.image(s.spriteKey, s.data.spriteUrl);
    });
  }

  create() {
    this.cameras.main.fadeIn(500);
    // The lab is authored in an 800×500 space; scale it up to fill the game view's
    // height and centre it, so the selection screen fills the screen instead of
    // sitting in the top-left with black borders. The background is extended to
    // cover the wider sides that the zoom then reveals.
    this.cameras.main.setZoom(this.scale.height / 500);
    this.cameras.main.centerOn(400, 250);
    this.drawBackground();
    this.drawProfessor();
    this.createDesk();
    this.createRevealStage();
    this.createBalls();
    this.createInfoArea();
    this.createConfirmPanel();
    this.setupInput();
    this.setDialogueMode(false);
    this.refreshSelection(false);

    // Prof speech bubble — animated
    this.time.delayedCall(300, () => {
      this.showProfessorDialogue([
        'Prof. Song: Welcome! Three Pokémon from this region are waiting for a trainer.\nChoose the one who calls to you.',
      ]);
    });
  }

  // ── Background / professor ────────────────────────────────────────────────

  private drawBackground() {
    const g = this.add.graphics();
    // Floor / wall / wainscot — extended well past the authored 800px width so the
    // zoomed-to-fill camera (see create) shows lab surfaces, not black, on the sides.
    // Floor
    g.fillStyle(0xd4c9a8, 1); g.fillRect(-120, 0, 1040, 500);
    // Wall
    g.fillStyle(0xe8e0cc, 1); g.fillRect(-120, 0, 1040, 160);
    // Wainscot
    g.fillStyle(0xc4b898, 1); g.fillRect(-120, 155, 1040, 8);
    // Bookshelves left
    this.drawShelf(g, 10, 20);
    // Lab bench right
    g.fillStyle(0x8b7355, 1); g.fillRect(640, 20, 150, 130);
    g.fillStyle(0x6b5a44, 1); g.fillRect(640, 140, 150, 10);
    for (let i = 0; i < 3; i++) {
      g.fillStyle([0xaaddff, 0xffeebb, 0xddffaa][i], 0.9);
      g.fillEllipse(660 + i * 40, 100, 22, 34);
      g.fillStyle(0x888888, 1); g.fillRect(668 + i * 40, 116, 6, 20);
    }
    this.add.text(720, 50, '🔬', { fontSize: '28px' });
    // Window
    g.fillStyle(0x99ddff, 0.5); g.fillRect(330, 10, 140, 100);
    g.lineStyle(3, 0xffffff, 1); g.strokeRect(330, 10, 140, 100);
    g.lineBetween(400, 10, 400, 110); g.lineBetween(330, 60, 470, 60);
    // Title banner
    g.fillStyle(0x1a3a5c, 0.88); g.fillRect(50, 8, 270, 38);
    this.add.text(185, 27, tr("Prof. Song's Pokémon Lab"), {
      fontSize: '14px', color: '#ffe44e', fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  private drawShelf(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x7a5c38, 1); g.fillRect(x, y, 120, 130);
    const bookColors = [0xcc3333, 0x3355cc, 0x33aa44, 0xddaa22, 0xaa33bb, 0x33aacc, 0xdd6622];
    bookColors.forEach((c, i) => {
      g.fillStyle(c, 1); g.fillRect(x + 4 + i * 16, y + 8, 13, 50);
    });
    g.fillStyle(0x9a7a58, 1); g.fillRect(x, y + 58, 120, 6);
    bookColors.slice(0, 5).forEach((c, i) => {
      g.fillStyle(c, 1); g.fillRect(x + 4 + i * 22, y + 68, 18, 55);
    });
  }

  private drawProfessor() {
    // Prof. Song — drawn character (female scientist)
    const g = this.add.graphics().setDepth(5);
    const x = 100, y = 135;
    g.fillStyle(0x000000, 0.15); g.fillEllipse(x, y + 12, 36, 8);
    // Lab coat
    g.fillStyle(0xffffff, 1); g.fillRect(x - 18, y - 22, 36, 35);
    g.fillStyle(0xdddddd, 1); g.fillRect(x - 2, y - 20, 4, 14);
    g.fillStyle(0xffffff, 1); g.fillRect(x - 24, y - 20, 8, 22); g.fillRect(x + 16, y - 20, 8, 22);
    g.fillStyle(0x3355aa, 1); g.fillRect(x - 14, y + 13, 12, 18); g.fillRect(x + 2, y + 13, 12, 18);
    g.fillStyle(0x222222, 1); g.fillRect(x - 14, y + 31, 10, 5); g.fillRect(x + 4, y + 31, 10, 5);
    g.fillStyle(0xffcc99, 1); g.fillRect(x - 14, y - 3, 6, 10); g.fillRect(x + 8, y - 3, 6, 10);
    g.fillStyle(0xffcc99, 1); g.fillRect(x - 10, y - 34, 20, 16);
    g.fillStyle(0x222222, 1); g.fillRect(x - 10, y - 34, 20, 6);
    // Glasses
    g.lineStyle(2, 0x333333, 1);
    g.strokeRect(x - 8, y - 26, 6, 5); g.strokeRect(x + 2, y - 26, 6, 5);
    g.lineBetween(x - 2, y - 24, x + 2, y - 24);
    // Speech bubble — anchored along the BOTTOM of the screen. It used to sit
    // across the upper third, which is exactly where the chosen starter now
    // appears, so the professor was talking over the Pokémon. It lives on its
    // own graphics layer so it can be hidden while the player is browsing.
    const bx = 24, by = 380, bw = 752, bh = 96;
    const bub = this.add.graphics().setDepth(5);
    this.bubbleGfx = bub;
    bub.fillStyle(0xffffff, 0.97); bub.fillRoundedRect(bx, by, bw, bh, 12);
    bub.lineStyle(3, 0x334466, 1); bub.strokeRoundedRect(bx, by, bw, bh, 12);
    bub.fillStyle(0xffffff, 0.95);
    bub.fillTriangle(bx + 40, by + 6, bx + 96, by + 6, bx + 52, by - 26);
    this.profText = this.add.text(bx + 18, by + 14, '', {
      fontSize: '14px', color: '#1a2a4a',
      wordWrap: { width: bw - 36, useAdvancedWrap: true }, lineSpacing: 6,
    }).setDepth(6);
    this.profAdvance = this.add.text(bx + bw - 18, by + bh - 14, '▼  ENTER', {
      fontSize: '11px', color: '#315886', fontStyle: 'bold',
    }).setOrigin(1, 1).setDepth(7).setVisible(false).setData('baseY', by + bh - 14);
  }

  // ── Cards ─────────────────────────────────────────────────────────────────

  /** The lab desk the three Poké Balls rest on. */
  private createDesk() {
    const g = this.add.graphics().setDepth(3);
    const top = 330, h = 26;
    // Table top with a lit front edge, and legs receding into shadow.
    g.fillStyle(0x000000, 0.16); g.fillEllipse(400, top + h + 26, 560, 26);
    g.fillStyle(0x9c7a52, 1); g.fillRect(120, top, 560, h);
    g.fillStyle(0xb8935f, 1); g.fillRect(120, top, 560, 7);           // polished highlight
    g.fillStyle(0x6f5436, 1); g.fillRect(120, top + h, 560, 8);       // shadowed lip
    g.fillStyle(0x7d603d, 1);
    g.fillRect(150, top + h + 8, 16, 42); g.fillRect(634, top + h + 8, 16, 42);
    // A felt runner so the balls read as "presented", not just placed.
    g.fillStyle(0x2c4a6e, 0.9); g.fillRect(150, top + 6, 500, 14);
    g.fillStyle(0x3f6796, 0.9); g.fillRect(150, top + 6, 500, 3);
  }

  /** Where the chosen starter appears once its ball opens. */
  private createRevealStage() {
    // Soft spotlight pool behind the reveal. It lives in a container rather than
    // baked graphics so it can slide along the desk with the selection.
    this.revealGlow = this.add.container(0, 0).setDepth(2);
    this.revealGlow.add([
      this.add.ellipse(0, STAGE_BOTTOM - 66, 300, 196, 0xffffff, 0.13),
      this.add.ellipse(0, STAGE_BOTTOM - 44, 210, 132, 0xffe9b8, 0.10),
    ]);

    // The starter is shown as its own 2D artwork. A turntabling 3D model was tried
    // here and read as busy next to the flat, hand-drawn lab: the artwork is the
    // same drawing used everywhere else in the game, so the picker now matches the
    // Pokédex and the battle HUD instead of introducing a third look.
    this.revealSprite = this.add.image(BALL_XS[0], ARTWORK_Y, '__none__')
      .setDepth(6).setVisible(false);

    this.nameText = this.add.text(BALL_XS[0], NAME_BASELINE, '', {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#1a2a4a', strokeThickness: 5,
    }).setOrigin(0.5, 1).setDepth(12);
  }

  /** Slide the whole reveal stage over the ball at `idx`. */
  private positionRevealStage(idx: number, animated: boolean) {
    const anchorX = BALL_XS[idx] ?? 400;
    const followers: Phaser.GameObjects.GameObject[] = [this.revealGlow, this.nameText];
    if (this.revealSprite) followers.push(this.revealSprite);
    if (animated) {
      // Glide rather than cut, so the eye tracks the reveal from ball to ball.
      this.tweens.add({ targets: followers, x: anchorX, duration: 180, ease: 'Cubic.Out' });
    } else {
      for (const f of followers) (f as unknown as { x: number }).x = anchorX;
    }
  }

  /** Three Poké Balls in a row on the desk — the actual selectors. */
  private createBalls() {
    STARTERS.forEach((s, i) => {
      const ball = this.buildBall(BALL_XS[i], BALL_REST_Y);
      ball.setInteractive(
        new Phaser.Geom.Rectangle(-30, -34, 60, 60),
        Phaser.Geom.Rectangle.Contains,
      );
      ball.on('pointerdown', () => {
        if (this.professorDialogueActive || this.transitioning) return;
        if (this.selectedIdx === i && this.openedIdx === i) return;
        this.selectedIdx = i;
        this.refreshSelection(true);
      });
      ball.on('pointerover', () => {
        if (this.professorDialogueActive || this.transitioning) return;
        this.input.setDefaultCursor('pointer');
      });
      ball.on('pointerout', () => this.input.setDefaultCursor('default'));
      this.balls.push(ball);
      void s;
    });
  }

  /** A Poké Ball drawn from primitives, with its own shadow and shine. */
  private buildBall(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(11);
    const shadow = this.add.ellipse(0, 20, 44, 12, 0x000000, 0.28);
    const g = this.add.graphics();
    const R = 21;
    g.fillStyle(0xd8342c, 1);
    g.slice(0, 0, R, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false);
    g.fillPath();
    g.fillStyle(0xf2f2f0, 1);
    g.slice(0, 0, R, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(180), false);
    g.fillPath();
    g.fillStyle(0x24262b, 1); g.fillRect(-R, -3, R * 2, 6);
    g.lineStyle(2, 0x24262b, 1); g.strokeCircle(0, 0, R);
    g.fillStyle(0x24262b, 1); g.fillCircle(0, 0, 7);
    g.fillStyle(0xf2f2f0, 1); g.fillCircle(0, 0, 4.4);
    // specular highlight
    g.fillStyle(0xffffff, 0.5); g.fillEllipse(-7, -9, 9, 6);
    c.add([shadow, g]);
    c.setData('shadow', shadow);
    return c;
  }

  private buildCard(s: StarterDef, x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(10);

    // Card bg
    const bg = this.add.rectangle(0, 0, 178, 238, 0xf5f0e8).setStrokeStyle(3, 0x334466);
    c.add(bg);

    // Sprite — fit full image inside card without cropping
    if (this.textures.exists(s.spriteKey)) {
      const img = this.add.image(0, -38, s.spriteKey).setOrigin(0.5);
      const tex  = this.textures.get(s.spriteKey).getSourceImage();
      const dim  = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
      img.setScale(140 / dim);
      c.add(img);
    }

    // Name
    const name = this.add.text(0, 32, pokeNameEn(s.data.name), {
      fontSize: '16px', color: '#1a2a4a', fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(name);

    // Type badges
    const types = [s.data.type1, s.data.type2].filter(Boolean) as string[];
    types.forEach((t, ti) => {
      const tx = (types.length === 1 ? 0 : ti === 0 ? -32 : 32);
      const badge = this.add.rectangle(tx, 56, 56, 18, TYPE_COLORS[t] ?? 0x888888, 1)
        .setStrokeStyle(1, 0x000000, 0.3);
      const label = this.add.text(tx, 56, typeName(t), {
        fontSize: '9px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      c.add([badge, label]);
    });

    // Ability
    const abil = this.add.text(0, 80, `${t('Ability', '특성')}: ${abilityName(s.ability)}`, {
      fontSize: '10px', color: '#555555',
    }).setOrigin(0.5);
    c.add(abil);

    return c;
  }

  // ── Info area (bottom) ────────────────────────────────────────────────────

  /**
   * The caption band under the desk: ability, flavour text, control hint.
   *
   * These used to sit at fixed y offsets (402 / 428 / 490) with a rule ruled
   * across 420. That only ever fitted at 1×. Touch devices enlarge on-canvas
   * fonts by up to 2× (see UiScale), which grew the ability line and turned the
   * flavour into a taller paragraph — so the three overlapped each other and the
   * rule was drawn straight through the words. Everything here is therefore
   * positioned by MEASURED height in layoutInfoBand(), never by a fixed offset.
   */
  private createInfoArea() {
    this.infoPanel = this.add.graphics().setDepth(8);

    this.abilityText = this.add.text(400, BAND_BOTTOM, '', {
      fontSize: '11px', color: '#ffe9a8', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5, 0).setDepth(9);

    this.flavText = this.add.text(400, BAND_BOTTOM, '', {
      fontSize: '12px', color: '#f2ede2', wordWrap: { width: 700 }, align: 'center',
      lineSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(9);

    // A phone has no SPACE key and no arrow keys, so it gets the gesture it can
    // actually perform — and one line instead of two things to read.
    this.hintText = this.add.text(400, BAND_BOTTOM, isTouchDevice()
      ? t('Tap a Poké Ball, then tap again to choose', '몬스터볼을 탭하고 다시 탭하면 결정')
      : t('◀ ▶ to browse     SPACE / ENTER to choose', '◀ ▶ 둘러보기     SPACE / ENTER 선택'), {
      fontSize: '11px', color: '#ffe44e', align: 'center',
    }).setOrigin(0.5, 0).setDepth(9);
  }

  /**
   * Stack the caption band upward from the bottom of the view, then draw its
   * backing plate to whatever height the text actually needed. Called after every
   * text change, because the flavour paragraph's line count varies by starter and
   * by font scale.
   */
  private layoutInfoBand() {
    if (!this.infoPanel) return;
    const GAP = 3;
    let y = BAND_BOTTOM;
    let shown = 0;
    const stack = (label: Phaser.GameObjects.Text | undefined) => {
      if (!label?.visible) return;
      shown++;
      y -= label.displayHeight;
      label.setY(Math.round(y));
      y -= GAP;
    };
    stack(this.hintText);
    stack(this.flavText);
    stack(this.abilityText);

    this.infoPanel.clear();
    if (!shown) return;
    // The plate is opaque behind the text: the flavour used to be light type on
    // the pale lab floor, held together only by a stroke.
    const top = Math.round(y - 3);
    this.infoPanel.fillStyle(0x16233c, 0.92);
    this.infoPanel.fillRect(-120, top, 1040, 500 - top);
    this.infoPanel.lineStyle(2, 0x5577aa, 1);
    this.infoPanel.lineBetween(-120, top, 920, top);
  }

  // ── Confirm panel ─────────────────────────────────────────────────────────

  private createConfirmPanel() {
    this.confirmPanel = this.add.container(400, 380).setDepth(50).setVisible(false);
    const bg = this.add.rectangle(0, 0, 300, 100, 0x0d0d2e, 0.97)
      .setStrokeStyle(2, 0xffffff);
    const q = this.add.text(0, -25, '', {
      fontSize: '14px', color: '#ffffff', align: 'center',
    }).setOrigin(0.5);
    const yes = this.add.text(-60, 12, tr('▶ YES'), { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5);
    const no  = this.add.text(60,  12, tr('  NO'),  { fontSize: '16px', color: '#888888' }).setOrigin(0.5);
    this.confirmPanel.add([bg, q, yes, no]);
    this.confirmPanel.setData('q', q);
    this.confirmPanel.setData('yes', yes);
    this.confirmPanel.setData('no', no);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private setupInput() {
    const kb = this.input.keyboard!;
    this.leftKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.enterKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.upKey    = kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey  = kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
  }

  update() {
    const advancePressed = Phaser.Input.Keyboard.JustDown(this.spaceKey)
      || Phaser.Input.Keyboard.JustDown(this.enterKey);
    if (this.professorDialogueActive) {
      if (advancePressed) this.advanceProfessorDialogue();
      return;
    }
    if (this.confirming) {
      if (Phaser.Input.Keyboard.JustDown(this.leftKey) || Phaser.Input.Keyboard.JustDown(this.rightKey)) {
        this.confirmIdx = this.confirmIdx === 0 ? 1 : 0;
        this.refreshConfirm();
      }
      if (advancePressed) this.handleConfirm();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.leftKey)) {
      const next = Math.max(0, this.selectedIdx - 1);
      if (next !== this.selectedIdx) { this.selectedIdx = next; this.refreshSelection(true); }
    }
    if (Phaser.Input.Keyboard.JustDown(this.rightKey)) {
      const next = Math.min(STARTERS.length - 1, this.selectedIdx + 1);
      if (next !== this.selectedIdx) { this.selectedIdx = next; this.refreshSelection(true); }
    }
    if (advancePressed) this.openConfirm();
  }

  // ── Selection refresh ─────────────────────────────────────────────────────

  /** The bubble and the starter's own text share the lower band, so exactly one
   *  of them is on screen at a time and nothing ever overlaps. */
  private setDialogueMode(active: boolean) {
    this.bubbleGfx?.setVisible(active);
    this.profText?.setVisible(active);
    if (!active) this.profAdvance?.setVisible(false);
    this.flavText?.setVisible(!active);
    this.abilityText?.setVisible(!active);
    // The hint goes too: the professor's bubble reaches down to y=476, and a
    // caption plate tall enough to hold the hint would clip its lower edge.
    this.hintText?.setVisible(!active);
    this.layoutInfoBand();
  }

  private refreshSelection(animated: boolean) {
    const s = STARTERS[this.selectedIdx];
    const changed = this.openedIdx !== this.selectedIdx;
    if (changed && animated) sfxMove(this);

    this.balls.forEach((ball, i) => {
      const selected = i === this.selectedIdx;
      if (animated) {
        this.tweens.add({
          targets: ball,
          scaleX: selected ? 1.18 : 1,
          scaleY: selected ? 1.18 : 1,
          y: selected ? BALL_LIFT_Y : BALL_REST_Y,
          duration: 160, ease: 'Back.Out',
        });
      } else {
        ball.setScale(selected ? 1.18 : 1);
        ball.setY(selected ? BALL_LIFT_Y : BALL_REST_Y);
      }
      // The chosen ball keeps a slow idle wobble so the row never looks static.
      ball.setAngle(selected ? 0 : 0);
    });

    // Move the stage before the ball opens, so the starter rises out of the ball
    // the player just picked instead of appearing over the previous one.
    this.positionRevealStage(this.selectedIdx, animated);
    if (changed) this.openBall(this.selectedIdx, animated);
    this.flavText.setText(tr(s.flavorA));
    // Both captions have their final text by now, so reflow the band around the
    // heights they actually occupy.
    this.layoutInfoBand();
  }

  /**
   * Open the selected Poké Ball and present its occupant: a flash at the ball,
   * then the starter rises on the reveal stage — as a real 3D model when one has
   * been generated for that species, otherwise as its artwork.
   */
  private openBall(idx: number, animated: boolean) {
    this.openedIdx = idx;
    const s = STARTERS[idx];
    const ball = this.balls[idx];

    if (animated && ball) {
      sfxBallOpen(this);
      // A burst of light at the ball, expanding and fading.
      const flash = this.add.circle(ball.x, ball.y, 10, 0xffffff, 0.9).setDepth(20);
      this.tweens.add({
        targets: flash, radius: 64, alpha: 0,
        duration: 340, ease: 'Cubic.Out',
        onComplete: () => flash.destroy(),
      });
      this.tweens.add({
        targets: ball, scaleX: 1.42, scaleY: 0.82,
        duration: 90, yoyo: true, ease: 'Quad.Out',
      });
    }

    // Name + ability plate.
    this.nameText.setText(pokeNameEn(s.data.name));
    this.abilityText.setText(`${t('Ability', '특성')}: ${abilityName(s.ability)}`);
    this.buildTypeBadges(s);

    this.showArtwork(s, animated);
  }

  /** Present the starter's 2D artwork on the reveal stage. */
  private showArtwork(s: StarterDef, animated: boolean) {
    {
      if (this.revealSprite && this.textures.exists(s.spriteKey)) {
        this.revealSprite
          .setTexture(s.spriteKey).setVisible(true).setAlpha(1)
          .setPosition(BALL_XS[this.selectedIdx] ?? 400, ARTWORK_Y);
        const tex = this.textures.get(s.spriteKey).getSourceImage();
        const dim = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
        this.revealSprite.setScale(ARTWORK_MAX / dim);
        if (animated) {
          // Rise out of the ball rather than fading in over it.
          this.revealSprite.setAlpha(0).setY(ARTWORK_Y + 16);
          this.tweens.add({
            targets: this.revealSprite, alpha: 1, y: ARTWORK_Y,
            duration: 260, ease: 'Back.Out',
          });
        }
      }
    }
  }

  /** Type chips under the reveal, rebuilt whenever the starter changes. */
  private buildTypeBadges(s: StarterDef) {
    this.typeBadges.forEach(b => b.destroy());
    this.typeBadges = [];
    const types = [s.data.type1, s.data.type2].filter(Boolean) as string[];
    const anchorX = BALL_XS[this.selectedIdx] ?? 400;
    types.forEach((ty, ti) => {
      // Chips ride just under the name plate. They used to sit at y=302, which is
      // now where the ball itself is — they would have covered it.
      const bx = anchorX + (types.length === 1 ? 0 : ti === 0 ? -38 : 38);
      // Build the label first and fit the chip to it. A fixed 66×18 chip could not
      // hold the label once touch font scaling grew it.
      const label = this.add.text(bx, BADGE_Y, typeName(ty), {
        fontSize: '9px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(13);
      const badge = this.add.rectangle(
        bx, BADGE_Y,
        Math.max(60, Math.round(label.displayWidth + 14)),
        Math.max(16, Math.round(label.displayHeight + 5)),
        TYPE_COLORS[ty] ?? 0x888888, 1,
      ).setStrokeStyle(1, 0x000000, 0.35).setDepth(12);
      this.typeBadges.push(badge, label);
    });
  }

  private openConfirm() {
    if (this.professorDialogueActive || this.transitioning) return;
    sfxConfirm(this);
    const s = STARTERS[this.selectedIdx];
    this.confirming = true;
    this.confirmIdx = 0;
    const q = this.confirmPanel.getData('q') as Phaser.GameObjects.Text;
    const nm = pokeNameEn(s.data.name);
    q.setText(t(`Choose ${nm}?`, `${nm}(으)로 정할까요?`));
    this.confirmPanel.setVisible(true);
    this.refreshConfirm();
  }

  private refreshConfirm() {
    const yes = this.confirmPanel.getData('yes') as Phaser.GameObjects.Text;
    const no  = this.confirmPanel.getData('no')  as Phaser.GameObjects.Text;
    yes.setText(this.confirmIdx === 0 ? '▶ YES' : '  YES').setColor(this.confirmIdx === 0 ? '#ffffff' : '#888888');
    no.setText(this.confirmIdx === 1  ? '▶ NO'  : '  NO').setColor(this.confirmIdx === 1 ? '#ffffff' : '#888888');
  }

  private handleConfirm() {
    // Prevent firing twice (e.g. user pressing SPACE again during the delay)
    if (this.transitioning) return;

    if (this.confirmIdx === 1) {
      this.confirming = false;
      this.confirmPanel.setVisible(false);
      return;
    }

    this.transitioning = true;
    this.confirming     = false;
    this.confirmPanel.setVisible(false);

    // Save chosen starter
    const chosen = STARTERS[this.selectedIdx];
    this.registry.set('starterChosen', true);
    this.registry.set('starterKey',   chosen.spriteKey);
    this.registry.set('starterName',  chosen.data.name);
    this.registry.set('starterLevel', 5);
    this.registry.set('starterExp',   0);

    // Initialise party with starter
    PartySystem.initFromStarter(this.registry);

    // Prof. Song also gives the Pokédex — mark the starter caught
    DexTracker.grantPokedex(this.registry);
    DexTracker.markCaught(this.registry, chosen.spriteKey);

    // …and her Exp. Share (학습장치): from now on the whole party shares battle EXP.
    Inventory.add(this.registry, 'expshare');

    // Rival picks the type that beats the player's type
    // Water → Grass, Fire → Water, Grass → Fire
    const RIVAL_IDX: Record<string, number> = {
      munkain:  1,  // Player Grass → Rival Fire (Vipour)
      vipour:   2,  // Player Fire  → Rival Water (Onnurian)
      onnurian: 0,  // Player Water → Rival Grass (Munkain)
    };
    const rivalIdx = RIVAL_IDX[chosen.spriteKey] ?? 2;
    const rival    = STARTERS[rivalIdx];
    this.registry.set('rivalKey',  rival.spriteKey);
    this.registry.set('rivalName', rivalTrainerName(this.registry));   // 'Minhyuk' (male) / 'Soohyun' (female)

    this.showProfessorDialogue(
      [`Prof. Song: Excellent choice! ${chosen.data.name} is happy to travel with you.\nAnd take this — your very own Pokédex! Press M, open your BAG,\nand select the Pokémon Encyclopedia to study every Pokémon you meet.`,
       `Prof. Song: One more thing — take this Exp. Share.\nWhile it's ON, every Pokémon in your party gains EXP from battle,\neven benched ones. Open your BAG anytime to switch it on or off.`],
      () => {
        this.cameras.main.fadeOut(400, 0, 0, 0, () => {
          this.scene.start('PokemonLabScene');   // back into the lab — Song is right there
        });
      },
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private showProfessorDialogue(lines: string[], onDone?: () => void): void {
    this.professorTimer?.destroy();
    this.hideProfessorAdvance();
    this.professorPages = lines.map(tr).flatMap(line => this.paginateProfessorLine(line));
    this.professorPageIdx = -1;
    this.professorDialogueActive = true;
    this.setDialogueMode(true);
    this.professorTyping = false;
    this.professorOnDone = onDone;
    this.showNextProfessorPage();
  }

  private paginateProfessorLine(line: string): string[] {
    const wrapped = this.profText.getWrappedText(line);
    const maxLines = 4;
    const pages: string[] = [];
    for (let i = 0; i < wrapped.length; i += maxLines) {
      pages.push(wrapped.slice(i, i + maxLines).join('\n'));
    }
    return pages.length ? pages : [''];
  }

  private showNextProfessorPage(): void {
    this.hideProfessorAdvance();
    this.professorPageIdx++;
    if (this.professorPageIdx >= this.professorPages.length) {
      this.professorDialogueActive = false;
      this.setDialogueMode(false);
      this.professorTyping = false;
      const done = this.professorOnDone;
      this.professorOnDone = undefined;
      done?.();
      return;
    }

    this.professorFullPage = this.professorPages[this.professorPageIdx];
    this.professorTyping = true;
    this.profText.setText('');
    let charIdx = 0;
    this.professorTimer?.destroy();
    this.professorTimer = this.time.addEvent({
      delay: 22,
      repeat: Math.max(0, this.professorFullPage.length - 1),
      callback: () => {
        this.profText.setText(this.professorFullPage.slice(0, ++charIdx));
        if (charIdx >= this.professorFullPage.length) {
          this.professorTimer?.destroy();
          this.professorTyping = false;
          this.showProfessorAdvance();
        }
      },
    });
  }

  private advanceProfessorDialogue(): void {
    if (this.professorTyping) {
      this.professorTimer?.destroy();
      this.profText.setText(this.professorFullPage);
      this.professorTyping = false;
      this.showProfessorAdvance();
      return;
    }
    this.showNextProfessorPage();
  }

  private showProfessorAdvance(): void {
    const baseY = this.profAdvance.getData('baseY') as number;
    this.profAdvance.setY(baseY).setVisible(true).setAlpha(1);
    this.professorArrowTween?.destroy();
    this.professorArrowTween = this.tweens.add({
      targets: this.profAdvance,
      y: this.profAdvance.y + 3,
      alpha: 0.55,
      duration: 420,
      yoyo: true,
      repeat: -1,
    });
  }

  private hideProfessorAdvance(): void {
    this.professorArrowTween?.destroy();
    this.professorArrowTween = undefined;
    if (this.profAdvance) {
      const baseY = this.profAdvance.getData('baseY') as number;
      this.profAdvance.setY(baseY).setVisible(false).setAlpha(1);
    }
  }
}
