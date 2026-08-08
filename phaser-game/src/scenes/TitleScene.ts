import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { SaveManager } from '../utils/SaveManager';
import { STARTERS } from '../data/StarterData';
import { playBgm, stopBgm } from '../systems/Music';
import { t, getLang, setLang } from '../systems/i18n';
import { fontScaleForScene } from '../systems/UiScale';
import { preloadBattleFallbackSprites } from '../data/BattleFallbackSprites';

const TITLE_BG_KEY = 'pokemon-string-opening';
const TITLE_BG_URL = 'assets/title/pokemon-string-opening.png';

export class TitleScene extends Phaser.Scene {
  private selected = 0;
  private menuItems: Phaser.GameObjects.Text[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private confirmKey!: Phaser.Input.Keyboard.Key;
  private hasSave = false;
  private stars: Phaser.GameObjects.Arc[] = [];
  private floatObjs: Phaser.GameObjects.GameObject[] = [];
  private confirming = false;
  private confirmChoice = 0;   // 0 = No (keep save), 1 = Yes (start over)
  private confirmOverlay?: Phaser.GameObjects.Container;
  private confirmBtns: Phaser.GameObjects.Text[] = [];

  // Use actual canvas dimensions so it adapts to any resolution
  private get W() { return this.scale.width; }
  private get H() { return this.scale.height; }

  constructor() { super('TitleScene'); }

  preload() {
    if (!this.textures.exists(TITLE_BG_KEY)) this.load.image(TITLE_BG_KEY, TITLE_BG_URL);
    STARTERS.forEach(s => {
      if (!this.textures.exists(s.spriteKey))
        this.load.image(s.spriteKey, s.data.spriteUrl);
    });
    preloadBattleFallbackSprites(this);
  }

  create() {
    this.hasSave = SaveManager.exists();
    this.cameras.main.fadeIn(900);
    playBgm(this, 'title');   // starts once the browser unlocks audio on first input
    this.events.once('shutdown', () => stopBgm(this));   // never let the title theme bleed into the next scene

    this.drawBackground();
    this.drawStars();
    this.drawStarters();
    this.drawLogoArea();
    this.drawMenu();
    this.drawSaveInfo();
    this.drawRestoreOption();
    this.drawLangToggle();
    this.setupInput();
    this.refreshSelection();
  }

  /** Language selector at game start — flip between English and Korean.
   *  Laid out right-to-left from the screen edge with scale-aware gaps so the
   *  enlarged mobile font can't make the buttons overlap each other, run off the
   *  edge, or crowd the centred title. Font sizes are unchanged. */
  private drawLangToggle() {
    const lang = getLang();
    const S = fontScaleForScene(this);
    const y = 24;                                   // pinned to the very top, above the logo
    const gap = Math.round(9 * S);
    let rightX = this.W - Math.round(14 * S);

    // Place `txt` with its RIGHT edge at the running cursor, then advance the cursor left.
    const placeRight = (txt: Phaser.GameObjects.Text) => {
      txt.setOrigin(1, 0.5).setPosition(rightX, y).setDepth(20);
      rightX = Math.round(rightX - txt.displayWidth - gap);
    };

    const mk = (label: string, l: 'en' | 'ko') => {
      const on = lang === l;
      const b = this.add.text(0, 0, label, {
        fontSize: '15px', fontStyle: on ? 'bold' : 'normal',
        color: on ? '#ffe44e' : '#8a8ab0',
        backgroundColor: on ? '#3a2a5a' : '#181828',
        padding: { x: 10, y: 5 },
      }).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => { if (getLang() !== l) { setLang(l); this.scene.restart(); } });
      placeRight(b);
    };

    mk('한국어', 'ko');                              // rightmost
    mk('EN', 'en');
    placeRight(this.add.text(0, 0, t('Language', '언어'), { fontSize: '14px', color: '#9aa8cc' }));
  }

  update() {
    // Twinkle stars
    this.stars.forEach((s, i) => {
      s.alpha = 0.4 + Math.sin(Date.now() / 700 + i) * 0.35;
    });
    // Gentle float on starter silhouettes without accumulating positional drift.
    this.floatObjs.forEach((o, i) => {
      const img = o as Phaser.GameObjects.Image;
      const baseY = (img.getData('titleBaseY') as number | undefined) ?? img.y;
      img.y = baseY + Math.sin(Date.now() / 1200 + i * 2.1) * 5;
    });
  }

  // ── Background ────────────────────────────────────────────────────────────

  private drawBackground() {
    if (this.textures.exists(TITLE_BG_KEY)) {
      const backdrop = this.add.image(this.W / 2, this.H / 2, TITLE_BG_KEY)
        .setDisplaySize(this.W, this.H)
        .setDepth(-20);
      this.tweens.add({
        targets: backdrop, scaleX: backdrop.scaleX * 1.035, scaleY: backdrop.scaleY * 1.035,
        duration: 14000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else {
      // A safe dark plate if the generated background cannot be read.
      this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x08000f).setDepth(-20);
    }

    // Darken only the UI zones; the luminous mountain and string-energy focal
    // point stay visible between the logo and the menu.
    const shade = this.add.graphics().setDepth(-19);
    shade.fillGradientStyle(0x040008, 0x040008, 0x040008, 0x040008, 0.48, 0.48, 0, 0);
    shade.fillRect(0, 0, this.W, this.H * 0.42);
    shade.fillGradientStyle(0x05000b, 0x05000b, 0x05000b, 0x05000b, 0, 0, 0.82, 0.82);
    shade.fillRect(0, this.H * 0.48, this.W, this.H * 0.52);

    // Thin cinematic letterbox edges give the splash a finished console-game frame.
    shade.fillStyle(0x030006, 0.72);
    shade.fillRect(0, 0, this.W, 8);
    shade.fillRect(0, this.H - 8, this.W, 8);
  }

  // ── Stars ─────────────────────────────────────────────────────────────────

  private drawStars() {
    for (let i = 0; i < 34; i++) {
      const x = Phaser.Math.Between(0, this.W);
      const y = Phaser.Math.Between(18, this.H * 0.55);
      const r = Math.random() < 0.14 ? 2.2 : 1;
      const col = Math.random() < 0.28 ? 0xdca8ff : 0xeaf2ff;
      const s = this.add.arc(x, y, r, 0, 360, false, col, 0.62).setDepth(-10);
      s.setBlendMode(Phaser.BlendModes.ADD);
      this.stars.push(s);
    }
  }

  // ── Starter silhouettes ───────────────────────────────────────────────────

  private drawStarters() {
    const keys = ['munkain', 'vipour', 'onnurian'];
    const xs   = [this.W * 0.12, this.W * 0.5, this.W * 0.88];
    const ys   = [this.H * 0.82, this.H * 0.86, this.H * 0.82];
    const size = 142;

    keys.forEach((key, i) => {
      if (!this.textures.exists(key)) return;
      const glow = this.add.ellipse(xs[i], ys[i] + 26, size * 1.2, size * 0.54, 0x9a3ee8, 0.10)
        .setDepth(0)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, alpha: { from: 0.05, to: 0.16 }, scaleX: 1.08, duration: 1700 + i * 230, yoyo: true, repeat: -1 });

      const img = this.add.image(xs[i], ys[i], key).setDepth(1).setData('titleBaseY', ys[i]);
      const tex = this.textures.get(key).getSourceImage();
      const dim = Math.max((tex.width as number) || 1, (tex.height as number) || 1);
      img.setScale(size / dim)
         .setAlpha(0.20)
         .setTint(0x7b36ad);

      // Subtle hover reveal
      img.setInteractive()
         .on('pointerover',  () => this.tweens.add({ targets: img, alpha: 0.68, duration: 220 }))
         .on('pointerout',   () => this.tweens.add({ targets: img, alpha: 0.20, duration: 260 }));

      this.floatObjs.push(img);
    });
  }

  // ── Logo area ─────────────────────────────────────────────────────────────

  private drawLogoArea() {
    const cx = this.W / 2;

    // Angular black-violet crest: an original silhouette inspired by the
    // reference's sharp energy rhythm, but built for the STRING identity.
    const crest = this.add.graphics().setDepth(3);
    const cy = this.H * 0.235;
    const points = [
      new Phaser.Geom.Point(cx - 352, cy - 42), new Phaser.Geom.Point(cx - 278, cy - 68),
      new Phaser.Geom.Point(cx - 186, cy - 55), new Phaser.Geom.Point(cx - 122, cy - 78),
      new Phaser.Geom.Point(cx - 38, cy - 62), new Phaser.Geom.Point(cx + 35, cy - 82),
      new Phaser.Geom.Point(cx + 126, cy - 57), new Phaser.Geom.Point(cx + 224, cy - 70),
      new Phaser.Geom.Point(cx + 354, cy - 32), new Phaser.Geom.Point(cx + 315, cy + 48),
      new Phaser.Geom.Point(cx + 218, cy + 54), new Phaser.Geom.Point(cx + 160, cy + 78),
      new Phaser.Geom.Point(cx + 62, cy + 58), new Phaser.Geom.Point(cx - 22, cy + 83),
      new Phaser.Geom.Point(cx - 112, cy + 58), new Phaser.Geom.Point(cx - 205, cy + 72),
      new Phaser.Geom.Point(cx - 300, cy + 48),
    ];
    crest.fillStyle(0x09000f, 0.91); crest.fillPoints(points, true);
    crest.lineStyle(7, 0x1a0727, 1); crest.strokePoints(points, true);
    crest.lineStyle(2, 0xa54cf0, 0.78); crest.strokePoints(points, true);

    const logoGlow = this.add.ellipse(cx, cy, 720, 184, 0x8f28df, 0.12)
      .setDepth(2)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: logoGlow, alpha: { from: 0.08, to: 0.22 }, scaleX: 1.045, scaleY: 1.08, duration: 1850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // ── "P O K É M O N" header — small caps, letter-spaced ───────────────
    this.add.text(cx, this.H * 0.105, 'P  O  K  É  M  O  N', {
      fontSize:   '19px',
      color:      '#f4e8ff',
      fontFamily: 'Arial, sans-serif',
      letterSpacing: 4,
      stroke: '#16051f', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(6);

    // ── Main Korean title ─────────────────────────────────────────────────
    // Layer 4 — darkest shadow
    this.addLogoLayer(cx + 8, this.H * 0.235 + 8, '포켓몬스터', '82px', '#07000d',
      { stroke: '#07000d', strokeThickness: 15 });
    this.addLogoLayer(cx + 3, this.H * 0.235 + 2, '포켓몬스터', '82px', '#4c087d',
      { stroke: '#1a002b', strokeThickness: 10 });
    this.addLogoLayer(cx, this.H * 0.235 - 3, '포켓몬스터', '82px', '#a83cf2',
      { stroke: '#e7c6ff', strokeThickness: 3 });

    // ── English subtitle ──────────────────────────────────────────────────
    // Shadow layers
    const ribbon = this.add.graphics().setDepth(4);
    const sy = this.H * 0.39;
    ribbon.fillStyle(0x100018, 0.94);
    ribbon.fillPoints([
      new Phaser.Geom.Point(cx - 202, sy - 29), new Phaser.Geom.Point(cx + 236, sy - 29),
      new Phaser.Geom.Point(cx + 268, sy), new Phaser.Geom.Point(cx + 220, sy + 30),
      new Phaser.Geom.Point(cx - 232, sy + 30), new Phaser.Geom.Point(cx - 266, sy + 2),
    ], true);
    ribbon.lineStyle(3, 0x9b42df, 0.95); ribbon.strokePoints([
      new Phaser.Geom.Point(cx - 202, sy - 29), new Phaser.Geom.Point(cx + 236, sy - 29),
      new Phaser.Geom.Point(cx + 268, sy), new Phaser.Geom.Point(cx + 220, sy + 30),
      new Phaser.Geom.Point(cx - 232, sy + 30), new Phaser.Geom.Point(cx - 266, sy + 2),
    ], true);
    this.addLogoLayer(cx + 4, sy + 5, 'S T R I N G', '51px', '#250039',
      { stroke: '#08000d', strokeThickness: 8 });
    this.addLogoLayer(cx, sy, 'S T R I N G', '51px', '#d685ff',
      { stroke: '#f6eaff', strokeThickness: 2 });

    // ── Decorative line under title ───────────────────────────────────────
    const lineG = this.add.graphics().setDepth(5);
    lineG.fillStyle(0xb95cff, 0.72);
    lineG.fillRect(cx - 244, this.H * 0.455, 488, 2);
    lineG.fillStyle(0xffffff, 0.42);
    lineG.fillRect(cx - 190, this.H * 0.455 + 4, 380, 1);

    // ── Pokéball icon (top-left of title, like the reference) ─────────────
    const pbG = this.add.graphics().setDepth(5);
    const pbx = cx - 326, pby = this.H * 0.205;
    const pbr = 18;
    pbG.fillStyle(0xee2222, 1); pbG.fillCircle(pbx, pby, pbr);
    pbG.fillStyle(0xffffff, 1); pbG.fillRect(pbx - pbr, pby, pbr * 2, pbr);
    pbG.lineStyle(3, 0x222222, 1); pbG.strokeCircle(pbx, pby, pbr);
    pbG.lineStyle(2, 0x222222, 1); pbG.lineBetween(pbx - pbr, pby, pbx + pbr, pby);
    pbG.fillStyle(0xffffff, 1); pbG.fillCircle(pbx, pby, 6);
    pbG.lineStyle(2, 0x222222, 1); pbG.strokeCircle(pbx, pby, 6);

    // Original STRING emblem: a glowing four-point stitch/star inside a ring.
    const mx = cx + 314, my = this.H * 0.385;
    const mark = this.add.graphics().setPosition(mx, my).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    mark.lineStyle(3, 0xdba3ff, 0.95); mark.strokeCircle(0, 0, 27);
    mark.fillStyle(0xf4ddff, 0.95);
    mark.fillPoints([
      new Phaser.Geom.Point(0, -32), new Phaser.Geom.Point(7, -7),
      new Phaser.Geom.Point(32, 0), new Phaser.Geom.Point(7, 7),
      new Phaser.Geom.Point(0, 32), new Phaser.Geom.Point(-7, 7),
      new Phaser.Geom.Point(-32, 0), new Phaser.Geom.Point(-7, -7),
    ], true);
    this.tweens.add({ targets: mark, angle: 360, duration: 18000, repeat: -1 });
  }

  private addLogoLayer(
    x: number, y: number, text: string, fontSize: string, color: string,
    extra?: { stroke?: string; strokeThickness?: number },
  ) {
    this.add.text(x, y, text, {
      fontSize,
      color,
      fontStyle:  'bold',
      fontFamily: '"Arial Black", Impact, Arial, sans-serif',
      stroke:          extra?.stroke,
      strokeThickness: extra?.strokeThickness ?? 0,
    }).setOrigin(0.5).setDepth(6);
  }

  // ── Menu ──────────────────────────────────────────────────────────────────

  private drawMenu() {
    const cx = this.W / 2;
    const options = [t('▶  NEW GAME', '▶  새 게임'), t('▶  CONTINUE', '▶  이어하기')];

    const panel = this.add.graphics().setDepth(5);
    const panelY = this.H * 0.65;
    panel.fillStyle(0x09000f, 0.78); panel.fillRoundedRect(cx - 205, panelY - 60, 410, 134, 18);
    panel.lineStyle(2, 0x9b52cf, 0.72); panel.strokeRoundedRect(cx - 205, panelY - 60, 410, 134, 18);
    panel.lineStyle(1, 0xf0d8ff, 0.26); panel.strokeRoundedRect(cx - 197, panelY - 52, 394, 118, 13);

    this.menuItems = options.map((label, i) => {
      const disabled = i === 1 && !this.hasSave;
      const t = this.add.text(cx, panelY - 29 + i * 50, label, {
        fontSize:   '23px',
        color:      disabled ? '#624875' : '#ffffff',
        fontStyle:  'bold',
        fontFamily: '"Arial Black", Arial, sans-serif',
        stroke:     disabled ? undefined : '#330055',
        strokeThickness: disabled ? 0 : 3,
      }).setOrigin(0.5).setDepth(6);

      if (!disabled) {
        t.setInteractive({ useHandCursor: true })
         .on('pointerdown', () => { this.selected = i; this.confirm(); })
         .on('pointerover', () => { this.selected = i; this.refreshSelection(); });
      }
      return t;
    });
  }

  // ── Save info ─────────────────────────────────────────────────────────────

  private drawSaveInfo() {
    if (!this.hasSave) return;
    const save = SaveManager.load();
    if (!save) return;

    // Read the live party lead straight from the snapshot so the summary always matches
    // the actual team — even for saves written before this was tracked correctly.
    let name = save.starterName; let level = save.starterLevel;
    try {
      const party = JSON.parse((save.data?.party as string) ?? '[]') as { name?: string; level?: number }[];
      if (party[0]?.name) name = party[0].name;
      if (typeof party[0]?.level === 'number') level = party[0].level;
    } catch { /* keep the stored values */ }

    const info = name
      ? `${name}  Lv.${level}  ·  ${SaveManager.formatDate(save.timestamp)}`
      : SaveManager.formatDate(save.timestamp);

    this.add.text(this.W / 2, this.H * 0.785, t(`Save data: ${info}`, `저장 데이터: ${info}`), {
      fontSize: '13px', color: '#d6b4eb', backgroundColor: '#08000baa', padding: { x: 10, y: 4 },
    }).setOrigin(0.5).setDepth(6);
  }

  /** If a backup exists (from a previous delete / New Game), offer to restore it. */
  private drawRestoreOption() {
    if (!SaveManager.hasBackup()) return;
    const t = this.add.text(this.W / 2, this.H * 0.84, tr('↩  Restore previous save'), {
      fontSize: '13px', color: '#88ccff', backgroundColor: '#00000055', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(6).setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setColor('#ffffff'));
    t.on('pointerout',  () => t.setColor('#88ccff'));
    t.on('pointerdown', () => { if (SaveManager.restoreBackup()) this.scene.restart(); });
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private setupInput() {
    this.cursors    = this.input.keyboard!.createCursorKeys();
    this.confirmKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
      .on('down', () => this.confirm());

    this.cursors.up.on('down',    () => { if (this.confirming) { this.confirmChoice = 0; this.refreshConfirm(); return; } this.selected = Math.max(0, this.selected - 1); this.refreshSelection(); });
    this.cursors.down.on('down',  () => { if (this.confirming) { this.confirmChoice = 1; this.refreshConfirm(); return; } this.selected = Math.min(1, this.selected + 1); this.refreshSelection(); });
    this.cursors.left.on('down',  () => { if (this.confirming) { this.confirmChoice = 0; this.refreshConfirm(); } });
    this.cursors.right.on('down', () => { if (this.confirming) { this.confirmChoice = 1; this.refreshConfirm(); } });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => { if (this.confirming) this.resolveConfirm(false); });
    this.confirmKey.on('down', () => this.confirm());
  }

  private refreshSelection() {
    this.menuItems.forEach((t, i) => {
      const disabled = i === 1 && !this.hasSave;
      if (disabled) return;
      const active = i === this.selected;
      t.setColor(active ? '#ffddff' : '#ffffff')
       .setScale(active ? 1.08 : 1);
      // Glow effect for selected
      t.setStroke(active ? '#aa44ff' : '#330055', active ? 5 : 3);
    });
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  /** Pick the furthest-progressed resumable city from save flags (recovery for old saves). */
  private sceneFromProgress(d: Record<string, unknown>): string {
    if (d['chapter11Done'] || d['championDefeated']) return 'CapitolCityScene';
    if (d['sunriseGymDefeated'] || d['seventhTablet']) return 'SunriseCityScene';
    if (d['forestGymDefeated'])   return 'ForestCityScene';
    if (d['haeanGymDefeated'])    return 'HaeanCityScene';
    if (d['geumgangGymDefeated']) return 'GeumgangCityScene';
    if (d['baekduGymDefeated'])   return 'BaekduCityScene';
    if (d['gymLeaderDefeated'])   return 'CapitolCityScene';
    if (d['pineVisited'])         return 'PineNeedleTownScene';
    if (d['capitolVisited'] || d['starterChosen']) return 'CapitolCityScene';
    return 'WorldMapScene';
  }

  private confirm() {
    // If the "start over?" prompt is open, this resolves it.
    if (this.confirming) { this.resolveConfirm(this.confirmChoice === 1); return; }
    if (this.selected === 1 && !this.hasSave) return;
    // New Game with existing save → ask first, so a mis-click can't wipe progress.
    if (this.selected === 0 && this.hasSave) { this.openNewGameConfirm(); return; }
    this.doSelection();
  }

  private openNewGameConfirm() {
    this.confirming = true;
    this.confirmChoice = 0;   // default to the safe option
    const cx = this.W / 2, cy = this.H / 2;
    const c = this.add.container(0, 0).setDepth(60);
    c.add(this.add.rectangle(cx, cy, this.W, this.H, 0x000000, 0.72));
    c.add(this.add.rectangle(cx, cy, 580, 230, 0x1a0d2e, 0.99).setStrokeStyle(2, 0x8855bb));
    c.add(this.add.text(cx, cy - 66, tr('Start a new game?'), { fontSize: '24px', color: '#ffe44e', fontStyle: 'bold' }).setOrigin(0.5));
    c.add(this.add.text(cx, cy - 18, tr('Your current saved game will be erased.\nAre you sure you want to start over?'), {
      fontSize: '15px', color: '#ddd', align: 'center', lineSpacing: 5,
    }).setOrigin(0.5));
    const no = this.add.text(cx - 120, cy + 58, tr('  No, keep my save  '), { fontSize: '16px', color: '#fff', backgroundColor: '#33445a', padding: { x: 12, y: 8 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', () => { this.confirmChoice = 0; this.refreshConfirm(); })
      .on('pointerdown', () => this.resolveConfirm(false));
    const yes = this.add.text(cx + 120, cy + 58, tr('  Yes, start over  '), { fontSize: '16px', color: '#fff', backgroundColor: '#7a2233', padding: { x: 12, y: 8 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', () => { this.confirmChoice = 1; this.refreshConfirm(); })
      .on('pointerdown', () => this.resolveConfirm(true));
    c.add([no, yes]);
    this.confirmBtns = [no, yes];
    this.confirmOverlay = c;
    this.refreshConfirm();
  }

  private refreshConfirm() {
    this.confirmBtns.forEach((b, i) => {
      const sel = i === this.confirmChoice;
      b.setStyle({ backgroundColor: sel ? (i === 1 ? '#cc3355' : '#4a6a8a') : (i === 1 ? '#7a2233' : '#33445a') });
      b.setColor(sel ? '#ffe44e' : '#ffffff');
    });
  }

  private resolveConfirm(yes: boolean) {
    this.confirming = false;
    this.confirmOverlay?.destroy(true);
    this.confirmOverlay = undefined;
    this.confirmBtns = [];
    if (yes) { this.selected = 0; this.doSelection(); }
  }

  private doSelection() {
    this.cameras.main.fadeOut(500, 0, 0, 0, () => {
      if (this.selected === 0) {
        SaveManager.delete();
        this.registry.reset();
        this.scene.start('IntroScene');   // Prof. Song's welcome → boy/girl select → adventure
      } else {
        const save = SaveManager.load();
        let target = 'WorldMapScene';
        if (save) {
          SaveManager.restore(this.registry, save);
          // Resume in a safe overworld scene matching where the player saved
          const safe = ['WorldMapScene', 'RouteScene', 'Route2Scene',
            'CapitolCityScene', 'PineNeedleTownScene', 'HanRiverParkScene',
            'BaekduPassScene', 'BaekduCityScene',
            'Route3Scene', 'GeumgangCityScene',
            'Route4Scene', 'HaeanCityScene',
            'Route5Scene', 'ForestCityScene',
            'FerryScene', 'JejuPortScene', 'JejuVentScene', 'JejuCityScene',
            'Route6Scene', 'SunriseCityScene',
            'SunriseCliff1Scene', 'SunriseCliff2Scene', 'SunriseCliff3Scene',
            'BaekduCheckpointScene', 'BaekduSummitScene',
            'ScholarsRoadScene', 'LeaguePlazaScene', 'PokemonLeagueScene',
            'NorthernColiseumScene', 'NorthernPlazaScene', 'PyeongseongCheckpointScene', 'PyeongyangCityScene',
            'NorthernReachesScene', 'SacredPeakScene',
            'DolmoeCityScene', 'DolmoeMineScene', 'SeoraeTownScene', 'SeoraePassScene',
            // Northern 어사대 circuit — cities, routes, beaches & the mine
            'KaesongCityScene', 'NampoCityScene', 'WonsanCityScene', 'HamhungCityScene',
            'ChongjinCityScene', 'SinuijuCityScene', 'SamjiyonCityScene',
            'RyesongValleyScene', 'AhobiryongPassScene', 'SijungCoastScene', 'ChilboHighlandsScene', 'KaemaPlateauScene',
            'RangrimFoothillsScene', 'RangrimCavernScene', 'RangrimAltarScene', 'RangrimSnowfieldScene', 'RangrimSummitScene',
            'NampoBeachScene', 'WonsanBeachScene', 'HamhungMineScene', 'FogboundManorScene', 'SamjiyonAjitRoadScene', 'SinuijuIceCaveScene',
            'NorthernBuildingScene', 'HamhungNaengmyeonScene'];
          const d = save.data ?? {};
          const lastScene = d['lastScene'] as string | undefined;
          // A WorldMap save is only trusted if the player has NO mid/late progress —
          // otherwise it's a corrupted stamp, so recover from progress flags instead.
          const lateProgress = !!(d['gymLeaderDefeated'] || d['baekduGymDefeated']
            || d['geumgangGymDefeated'] || d['haeanGymDefeated'] || d['forestGymDefeated']);
          const cand = (lastScene && safe.includes(lastScene)) ? lastScene
            : (safe.includes(save.scene) ? save.scene : '');
          if (cand && !(cand === 'WorldMapScene' && lateProgress)) {
            target = cand;
          } else {
            target = this.sceneFromProgress(d);
          }
        }
        this.scene.start(target);
      }
    });
  }
}
