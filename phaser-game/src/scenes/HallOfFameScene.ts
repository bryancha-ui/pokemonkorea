import Phaser from 'phaser';
import { t, tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { PartySystem } from '../systems/PartySystem';
import { drawNpcBody, drawTrainerBody, playerDesign } from '../data/CharacterSprite';
import { sfxBallOpen, sfxConfirm } from '../systems/UiSfx';

// ── The Hall of Fame registration room ───────────────────────────────────────
// Split out of PokemonLeagueScene so the two halves of the ending can each be
// what they are: the throne room keeps the CONVERSATION with Hwangeum, standing
// over his fallen ace, and this room is the CEREMONY he walks you to afterwards.
// Running both in one scene meant his farewell played over a wall of plaques,
// which read as a UI overlay rather than a place you had been taken to.
//
// Purely presentational. Every registry write it makes (`hallOfFame`, the clear
// count, the onward route) is the same bookkeeping the ceremony always did.

export interface HallOfFameData {
  /** A post-game re-clear: shorter script, and the player returns to the plaza. */
  rematch?: boolean;
  /** Which enshrinement this is, for the plate under the title. */
  clears?: number;
  /** Which league's register this is. Both use this room; only the dressing,
   *  the host and the way out differ. */
  theme?: ThemeKey;
}

type ThemeKey = 'onnuri' | 'northern';

/**
 * Both leagues share one ceremony. Duplicating 250 lines of plaque layout for the
 * north would have guaranteed the two halls drifted apart the first time either
 * was touched, so the differences live here as data: palette, crest, the host who
 * walked you in, and the copy.
 */
interface HofTheme {
  skyTop: number; skyBottom: number;
  pillar: number; pillarInner: number; trim: number;
  plaque: number; plaqueRim: number; plaqueInner: number;
  plate: number; chip: number; chipInk: string;
  machine: number; machineScreen: number; readout: string; beam: number;
  title: string; titleKo: string;
  role: string; roleKo: string;
  crest: 'pokeball' | 'star';
  hostCoat: number; host: string; hostKo: string;
  intro: string[]; introRematch: string[];
  closing: string[]; closingRematch: string[];
}

const THEMES: Record<ThemeKey, HofTheme> = {
  // Onnuri: a warm night sky, gold on navy, a Poké Ball crest.
  onnuri: {
    skyTop: 0x0a1030, skyBottom: 0x03050e,
    pillar: 0x121d3c, pillarInner: 0x1b2a52, trim: 0xd8b44a,
    plaque: 0x0d1730, plaqueRim: 0xd8b44a, plaqueInner: 0x3d5893,
    plate: 0x18294c, chip: 0xe8c66a, chipInk: '#0f1830',
    machine: 0x1b2747, machineScreen: 0x0b1226, readout: '#7fd0ff', beam: 0x9fe0ff,
    title: 'HALL OF FAME', titleKo: '명예의 전당',
    role: 'ONNURI LEAGUE CHAMPION', roleKo: '온누리 리그 챔피언',
    crest: 'pokeball',
    hostCoat: 0x14181e, host: 'Champion Hwangeum', hostKo: '챔피언 황금',
    intro: [
      'Hwangeum: This is the recorder. Set your team on it — all six.',
      'Hwangeum: It reads them itself. Names, levels, everything they became with you.',
    ],
    introRematch: ['Hwangeum: You know the drill. Six balls, six sockets.'],
    closing: [
      'The recorder hums, and one by one your Pokémon are entered into the register of the Onnuri League.',
      '🏆 Your team is recorded in the Hall of Fame!',
      '__COUNT__',
      '— The credits roll over a montage of the Onnuri League arc — Capitol City, the Diamond Gorge, the tidal coasts, the ancient forest, the Jeju vents, the Jeju Summit —',
      "— culminating in 나비할망's metallic wings catching the dawn light as she settles beside you, the guardian of the south you have become.",
      '— THE END —',
      'Phase 1: Onnuri League — COMPLETE ✓',
    ],
    closingRematch: [
      'The recorder hums once more, and your team is entered into the register beside its earlier records.',
      '🏆 Your team is enshrined in the Hall of Fame once more!',
      '__COUNT__',
      'Your Pokémon have been fully restored. You will now return to the Pokémon League entrance.',
    ],
  },
  // Northern: colder sky, granite and state crimson, the fortress star as crest.
  northern: {
    skyTop: 0x0b1424, skyBottom: 0x04070f,
    pillar: 0x1a1d24, pillarInner: 0x272b34, trim: 0xffe14a,
    plaque: 0x14171d, plaqueRim: 0xffe14a, plaqueInner: 0x7e1218,
    plate: 0x1f232b, chip: 0xffe14a, chipInk: '#1a1206',
    machine: 0x22262e, machineScreen: 0x0d1016, readout: '#ffd36a', beam: 0xffe6a0,
    title: 'NORTHERN HALL OF FAME', titleKo: '북방 명예의 전당',
    role: 'CONQUEROR OF THE NORTHERN LEAGUE', roleKo: '북방 리그 정복자',
    crest: 'star',
    hostCoat: 0x3a2b1c, host: 'Taewang', hostKo: '태왕',
    intro: [
      'Taewang: The stone register of the north. Thirty years, and no southern name has been cut into it.',
      'Taewang: Set your six upon it. Let the north read them properly.',
    ],
    introRematch: ['Taewang: Again, then. The register knows your hand by now.'],
    closing: [
      'The stone register grinds open, and one by one your Pokémon are cut into the north\'s own roll of honour.',
      '🏆 Your team is recorded in the Northern Hall of Fame — the first southern names ever set in this stone!',
      '__COUNT__',
      'Taewang: A celebration awaits in Sudo City. Go, Champion. The whole region will want to honor your achievement.',
    ],
    closingRematch: [
      'The stone register grinds open once more, and your team is cut in beside its earlier records.',
      '🏆 Your team is recorded in the Northern Hall of Fame once more!',
      '__COUNT__',
      'Your Pokémon have been fully restored. You will now return to the Northern League forecourt.',
    ],
  },
};

const PLAQUE_W = 262, GAP_X = 22, GAP_Y = 14;

export class HallOfFameScene extends Phaser.Scene {
  private rematch = false;
  private clears = 1;
  private themeKey: ThemeKey = 'onnuri';
  private th: HofTheme = THEMES.onnuri;
  private dialog!: DialogBox;
  private spaceKey!: Phaser.Input.Keyboard.Key;

  constructor() { super('HallOfFameScene'); }

  init(data?: HallOfFameData) {
    this.rematch = !!data?.rematch;
    this.clears = Math.max(1, data?.clears ?? 1);
    this.themeKey = data?.theme === 'northern' ? 'northern' : 'onnuri';
    this.th = THEMES[this.themeKey];
  }

  preload() {
    // The party art is normally already resident from the battle that just ended,
    // but a reload straight into this scene (or a species only ever seen in the
    // box) would otherwise enshrine an empty frame.
    for (const e of PartySystem.get(this.registry)) {
      if (e.spriteKey && e.spriteUrl && !this.textures.exists(e.spriteKey)) {
        this.load.image(e.spriteKey, e.spriteUrl);
      }
    }
  }

  create() {
    playBgm(this, 'halloffame');
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.cameras.main.fadeIn(700, 0, 0, 0);
    this.buildRoom();
    this.time.delayedCall(600, () => this.runRegistration());
  }

  // ── Registration: the machine, and putting the balls in it ────────────────
  /**
   * The room earns its name before the wall of plaques appears. The player walks
   * up to the recorder, sets all six Poké Balls into its sockets, and only once
   * the machine has read them does the enshrinement screen come up — which is
   * what makes the ceremony feel performed rather than merely displayed.
   */
  private runRegistration() {
    const W = this.scale.width, H = this.scale.height;
    const party = PartySystem.get(this.registry).slice(0, 6);
    const midY = Math.round(H * 0.52);

    const room: Phaser.GameObjects.GameObject[] = [];

    // ── The recorder ────────────────────────────────────────────────────────
    const mW = 460, mH = 138;
    const mX = Math.round(W / 2 - mW / 2), mY = midY - 30;
    const machine = this.add.graphics().setDepth(5);
    machine.fillStyle(0x000000, 0.35); machine.fillEllipse(W / 2, mY + mH + 10, mW * 0.95, 22);
    machine.fillStyle(this.th.machine, 1); machine.fillRoundedRect(mX, mY, mW, mH, 14);
    machine.lineStyle(2, this.th.trim, 0.9); machine.strokeRoundedRect(mX, mY, mW, mH, 14);
    machine.fillStyle(this.th.machineScreen, 1);
    machine.fillRoundedRect(mX + 26, mY + 16, mW - 52, 46, 8);
    machine.lineStyle(1, this.th.plaqueInner, 0.9); machine.strokeRoundedRect(mX + 26, mY + 16, mW - 52, 46, 8);
    room.push(machine);

    const readout = this.add.text(W / 2, mY + 39, t('READY', '준비'), {
      fontSize: '15px', color: this.th.readout, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6);
    room.push(readout);

    // Six sockets across the deck of the machine.
    const socketY = mY + mH - 34;
    const socketXs = party.map((_, i) =>
      Math.round(mX + 52 + i * ((mW - 104) / Math.max(1, party.length - 1))));
    const sockets = this.add.graphics().setDepth(5);
    for (const sx of socketXs) {
      sockets.fillStyle(this.th.machineScreen, 1); sockets.fillCircle(sx, socketY, 17);
      sockets.lineStyle(2, this.th.plaqueInner, 0.9); sockets.strokeCircle(sx, socketY, 17);
    }
    room.push(sockets);

    // ── The two people at the machine ───────────────────────────────────────
    const host = this.add.graphics().setDepth(6);
    drawNpcBody(host, this.th.hostCoat);
    host.setPosition(mX - 74, midY + 26).setScale(1.5);
    const hostLabel = this.add.text(mX - 74, midY + 62, t(this.th.host, this.th.hostKo), {
      fontSize: '11px', color: '#ffe6a2', fontStyle: 'bold',
      backgroundColor: '#0a1030cc', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 0).setDepth(6);
    const hero = this.add.graphics().setDepth(6);
    drawTrainerBody(hero, 1, 0, playerDesign(this.registry));
    hero.setPosition(mX + mW + 74, midY + 26).setScale(1.5);
    room.push(host, hostLabel, hero);

    const cue = () => {
      // Balls arc out of the player's belt into the sockets, one at a time.
      const startX = mX + mW + 74, startY = midY + 12;
      party.forEach((_, i) => {
        const ball = this.makeBall(startX, startY).setDepth(7).setScale(0.55).setAlpha(0);
        const delay = i * 340;
        this.tweens.add({ targets: ball, alpha: 1, duration: 120, delay });
        this.tweens.add({
          targets: ball, x: socketXs[i], duration: 420, delay, ease: 'Sine.InOut',
        });
        this.tweens.add({
          targets: ball, y: socketY - 46, duration: 210, delay, ease: 'Quad.Out',
          yoyo: false,
          onComplete: () => {
            this.tweens.add({ targets: ball, y: socketY, duration: 210, ease: 'Quad.In' });
          },
        });
        this.time.delayedCall(delay + 420, () => {
          sfxBallOpen(this);
          const lit = this.add.graphics().setDepth(6);
          lit.fillStyle(this.th.beam, 0.55); lit.fillCircle(socketXs[i], socketY, 22);
          this.tweens.add({ targets: lit, alpha: 0, duration: 700, ease: 'Cubic.Out' });
          readout.setText(t(`READING  ${i + 1}/${party.length}`, `판독 중  ${i + 1}/${party.length}`));
          room.push(ball, lit);
        });
      });

      // Machine reads the set, then the room gives way to the register itself.
      const scanAt = party.length * 340 + 520;
      this.time.delayedCall(scanAt, () => {
        sfxConfirm(this);
        readout.setText(t('REGISTERING…', '등록 중…'));
        const beam = this.add.rectangle(W / 2, socketY, mW - 80, 6, this.th.beam, 0.9).setDepth(8);
        this.tweens.add({
          targets: beam, y: mY - 60, alpha: 0, scaleX: 1.3, duration: 900, ease: 'Sine.Out',
          onComplete: () => beam.destroy(),
        });
      });
      this.time.delayedCall(scanAt + 900, () => {
        const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(200);
        this.tweens.add({
          targets: flash, alpha: 1, duration: 260, ease: 'Cubic.In',
          onComplete: () => {
            for (const o of room) o.destroy();
            this.runCeremony();
            this.tweens.add({ targets: flash, alpha: 0, duration: 620, onComplete: () => flash.destroy() });
          },
        });
      });
    };

    this.dialog.show(this.rematch ? this.th.introRematch : this.th.intro, cue);
  }

  /** A small Poké Ball built from primitives, for the insertion sequence. */
  private makeBall(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const R = 21;
    g.fillStyle(0xd8342c, 1);
    g.slice(0, 0, R, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false); g.fillPath();
    g.fillStyle(0xf2f2f0, 1);
    g.slice(0, 0, R, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(180), false); g.fillPath();
    g.fillStyle(0x24262b, 1); g.fillRect(-R, -3, R * 2, 6);
    g.lineStyle(2, 0x24262b, 1); g.strokeCircle(0, 0, R);
    g.fillStyle(0x24262b, 1); g.fillCircle(0, 0, 7);
    g.fillStyle(0xf2f2f0, 1); g.fillCircle(0, 0, 4.4);
    g.fillStyle(0xffffff, 0.5); g.fillEllipse(-7, -9, 9, 6);
    c.add(g);
    return c;
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
  }

  private fitImg(img: Phaser.GameObjects.Image, size: number) {
    const src = this.textures.get(img.texture.key).getSourceImage();
    img.setScale(size / Math.max((src.width as number) || 1, (src.height as number) || 1));
  }

  /** Shrink a label that would otherwise run past its frame. Touch devices
   *  enlarge fonts and a plaque cannot grow to match. */
  private fitText(label: Phaser.GameObjects.Text, maxW: number) {
    if (label.displayWidth > maxW) label.setScale(maxW / label.displayWidth);
    return label;
  }

  // ── The room itself ───────────────────────────────────────────────────────
  private buildRoom() {
    const W = this.scale.width, H = this.scale.height;

    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(this.th.skyTop, this.th.skyTop, this.th.skyBottom, this.th.skyBottom, 1);
    sky.fillRect(0, 0, W, H);

    // A star field read through the chamber's glass ceiling.
    const stars = this.add.graphics().setDepth(1);
    for (let i = 0; i < 150; i++) {
      const sx = Math.random() * W, sy = Math.random() * H * 0.9;
      const big = Math.random() < 0.08;
      stars.fillStyle(big ? 0xfff2c4 : 0xffffff, Math.random() * 0.65 + 0.2);
      stars.fillCircle(sx, sy, big ? 2.2 : Math.random() < 0.25 ? 1.5 : 1);
    }

    // Twin pillars framing the chamber, so the ceremony reads as a ROOM rather
    // than a screen the game switched to.
    const arch = this.add.graphics().setDepth(1);
    for (const x of [W * 0.042, W * 0.958]) {
      arch.fillStyle(this.th.pillar, 1); arch.fillRect(x - 26, 0, 52, H);
      arch.fillStyle(this.th.pillarInner, 1); arch.fillRect(x - 18, 0, 36, H);
      arch.lineStyle(2, this.th.trim, 0.35);
      arch.lineBetween(x - 18, 0, x - 18, H); arch.lineBetween(x + 18, 0, x + 18, H);
      for (let y = 60; y < H; y += 86) {
        arch.fillStyle(this.th.trim, 0.22); arch.fillRect(x - 22, y, 44, 4);
      }
    }
  }

  // ── Ceremony ──────────────────────────────────────────────────────────────
  private runCeremony() {
    const W = this.scale.width, H = this.scale.height;
    // Everything sits above the dialogue box, whose height grows with the touch
    // font multiplier — budget for the tallest case on every device.
    const DIALOG_TOP = H - Math.min(Math.round(H * 0.34), 250) - 16;
    const gridW = PLAQUE_W * 3 + GAP_X * 2;
    const gridLeft = Math.round(W / 2 - gridW / 2);

    // ── Crest and title ─────────────────────────────────────────────────────
    // A drawn Poké Ball crest rather than a 🏆 emoji: emoji coverage varies by
    // device font, and a missing glyph in the headline is not a risk worth taking.
    const crestY = 34, crestR = 15;
    const crest = this.add.graphics().setDepth(10);
    if (this.th.crest === 'pokeball') {
      crest.fillStyle(0xe8534e, 1);
      crest.slice(W / 2, crestY, crestR, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false);
      crest.fillPath();
      crest.fillStyle(0xf2f2f0, 1);
      crest.slice(W / 2, crestY, crestR, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(180), false);
      crest.fillPath();
      crest.fillStyle(0x1a1206, 1); crest.fillRect(W / 2 - crestR, crestY - 2.5, crestR * 2, 5);
      crest.lineStyle(2, this.th.trim, 1); crest.strokeCircle(W / 2, crestY, crestR);
      crest.fillStyle(0x1a1206, 1); crest.fillCircle(W / 2, crestY, 5.5);
      crest.fillStyle(0xffe6a2, 1); crest.fillCircle(W / 2, crestY, 3);
    } else {
      // The fortress star, drawn rather than typed — the '★' glyph is not on
      // every device, and a missing headline crest is not a risk worth taking.
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? crestR + 4 : (crestR + 4) * 0.42;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(W / 2 + Math.cos(a) * r, crestY + Math.sin(a) * r);
      }
      crest.fillStyle(this.th.trim, 1);
      crest.fillPoints(pts.reduce<Phaser.Geom.Point[]>((acc, _v, i, arr) =>
        i % 2 === 0 ? [...acc, new Phaser.Geom.Point(arr[i], arr[i + 1])] : acc, []), true);
      crest.lineStyle(2, 0x7a5a00, 0.9);
      crest.strokePoints(pts.reduce<Phaser.Geom.Point[]>((acc, _v, i, arr) =>
        i % 2 === 0 ? [...acc, new Phaser.Geom.Point(arr[i], arr[i + 1])] : acc, []), true);
    }

    const title = this.fitText(this.add.text(W / 2, crestY + crestR + 8,
      t(this.th.title, this.th.titleKo), {
        fontSize: '30px', color: '#ffe6a2', fontStyle: 'bold', stroke: '#1a1206', strokeThickness: 6,
      }).setOrigin(0.5, 0).setDepth(10), W - 120);

    const ruleY = Math.round(title.y + title.displayHeight + 10);
    const rule = this.add.graphics().setDepth(10);
    rule.fillStyle(this.th.trim, 0.85);
    rule.fillRect(W / 2 - 210, ruleY, 420, 2);
    for (const dx of [-218, 218]) {
      rule.fillStyle(0xffe6a2, 0.95);
      rule.fillTriangle(W / 2 + dx - 7, ruleY + 1, W / 2 + dx, ruleY - 6, W / 2 + dx + 7, ruleY + 1);
      rule.fillTriangle(W / 2 + dx - 7, ruleY + 1, W / 2 + dx, ruleY + 8, W / 2 + dx + 7, ruleY + 1);
    }

    const trainerName = (this.registry.get('playerName') as string) || t('Champion', '챔피언');
    const clearsLabel = t(`CLEAR No.${this.clears}`, `${this.clears}회차 등록`);
    const subtitle = this.fitText(this.add.text(W / 2, ruleY + 12,
      `${t(this.th.role, this.th.roleKo)}   ·   ${trainerName}   ·   ${clearsLabel}`, {
        fontSize: '14px', color: '#a9c4f0', fontStyle: 'bold',
      }).setOrigin(0.5, 0).setDepth(10), W - 140);

    // Header and dialogue box both claim space; the grid takes whatever is left
    // and shrinks its plaques to fit rather than sliding under the title.
    const party = PartySystem.get(this.registry).slice(0, 6);
    const rowsN = Math.max(1, Math.ceil(party.length / 3));
    const gridTop = Math.round(subtitle.y + subtitle.displayHeight + 16);
    const gridBottom = DIALOG_TOP - 8;
    const plaqueH = Math.max(92, Math.min(168,
      Math.floor((gridBottom - gridTop - GAP_Y * (rowsN - 1)) / rowsN)));
    const stackH = plaqueH * rowsN + GAP_Y * (rowsN - 1);
    const gridY = Math.round(gridTop + (gridBottom - gridTop - stackH) / 2);
    const plateH = Math.round(Math.min(34, plaqueH * 0.22));
    const artSize = Math.max(48, plaqueH - plateH - 34);

    const glow = this.add.graphics().setDepth(2);
    glow.fillStyle(0x2b4a96, 0.20);
    glow.fillEllipse(W / 2, gridY + stackH / 2, gridW * 1.05, stackH * 1.35);
    glow.fillStyle(0xffe6a8, 0.05);
    glow.fillEllipse(W / 2, gridY + stackH / 2, gridW * 0.7, stackH * 0.9);

    // Hwangeum stands beside the register, watching the enshrinement he walked
    // the player to — the visual payoff of the farewell line in the throne room.
    const hostX = Math.round(gridLeft / 2 + 14);
    const hostY = Math.round(gridY + stackH * 0.62);
    const hostShadow = this.add.graphics().setDepth(2);
    hostShadow.fillStyle(0x000000, 0.35);
    hostShadow.fillEllipse(hostX, hostY + 34, 54, 14);
    hostShadow.fillStyle(0xffe6a8, 0.07);
    hostShadow.fillCircle(hostX, hostY, 84);
    const host = this.add.graphics().setDepth(3);
    drawNpcBody(host, this.th.hostCoat);
    host.setPosition(hostX, hostY);
    host.setScale(1.7);
    const hostLabel = this.add.text(hostX, hostY + 46, t(this.th.host, this.th.hostKo), {
      fontSize: '11px', color: '#ffe6a2', fontStyle: 'bold',
      backgroundColor: '#0a1030cc', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 0).setDepth(4);
    this.fitText(hostLabel, gridLeft - 40);
    for (const o of [hostShadow, host, hostLabel]) o.setAlpha(0);
    this.tweens.add({ targets: [hostShadow, host, hostLabel], alpha: 1, duration: 700 });

    // ── One plaque per party member, registered in turn ──────────────────────
    const REVEAL_STEP = 260;
    party.forEach((e, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const inRow = Math.min(party.length - row * 3, 3);
      const rowLeft = gridLeft + ((3 - inRow) * (PLAQUE_W + GAP_X)) / 2;
      const px = rowLeft + col * (PLAQUE_W + GAP_X);
      const py = gridY + row * (plaqueH + GAP_Y);
      const cx = px + PLAQUE_W / 2;
      const plateTop = py + plaqueH - plateH - 8;
      const plateMid = plateTop + plateH / 2;

      const frame = this.add.graphics().setDepth(10);
      // Fully opaque: at partial alpha the header text ghosted through the grid.
      frame.fillStyle(this.th.plaque, 1);
      frame.fillRoundedRect(px, py, PLAQUE_W, plaqueH, 12);
      frame.lineStyle(2, this.th.plaqueRim, 0.9);
      frame.strokeRoundedRect(px, py, PLAQUE_W, plaqueH, 12);
      frame.lineStyle(1, this.th.plaqueInner, 0.75);
      frame.strokeRoundedRect(px + 5, py + 5, PLAQUE_W - 10, plaqueH - 10, 8);
      frame.fillStyle(this.th.plate, 1);
      frame.fillRoundedRect(px + 8, plateTop, PLAQUE_W - 16, plateH, 6);
      frame.lineStyle(1, this.th.plaqueRim, 0.55);
      frame.strokeRoundedRect(px + 8, plateTop, PLAQUE_W - 16, plateH, 6);

      const artY = py + 12 + artSize / 2;
      const art = this.textures.exists(e.spriteKey)
        ? this.add.image(cx, artY, e.spriteKey).setDepth(11)
        : this.add.circle(cx, artY, artSize / 2.5, 0x33405a).setDepth(11);
      if (art instanceof Phaser.GameObjects.Image) this.fitImg(art, artSize);

      // The level chip is placed first so the name can be centred in the space
      // that is actually left over — otherwise a long name slid under the chip.
      const lvl = this.add.text(0, 0, `Lv.${e.level}`, {
        fontSize: '12px', color: this.th.chipInk, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(12);
      this.fitText(lvl, 58);
      const chipW = Math.round(lvl.displayWidth + 14);
      const chipH = Math.round(Math.min(lvl.displayHeight + 6, plateH - 6));
      const chipX = px + PLAQUE_W - 16 - chipW / 2;
      lvl.setPosition(chipX, plateMid);
      const chip = this.add.graphics().setDepth(11);
      chip.fillStyle(this.th.chip, 1);
      chip.fillRoundedRect(chipX - chipW / 2, plateMid - chipH / 2, chipW, chipH, chipH / 2);

      const nameLeft = px + 14;
      const nameRight = chipX - chipW / 2 - 8;
      const name = this.fitText(this.add.text((nameLeft + nameRight) / 2, plateMid, e.name, {
        fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(12), Math.max(40, nameRight - nameLeft));

      // Reveal: the plaque settles in as a burst of light fades off it.
      const parts: Phaser.GameObjects.GameObject[] = [frame, art, name, chip, lvl];
      const delay = 700 + i * REVEAL_STEP;
      for (const part of parts) {
        const p = part as Phaser.GameObjects.GameObject & { alpha: number; y: number };
        p.alpha = 0;
        const restY = p.y;
        p.y = restY + 16;
        this.tweens.add({ targets: p, alpha: 1, y: restY, duration: 420, delay, ease: 'Back.Out' });
      }
      const flash = this.add.circle(cx, artY, 18, 0xffffff, 0.85).setDepth(13).setAlpha(0);
      this.tweens.add({ targets: flash, alpha: 0.85, duration: 1, delay });
      this.tweens.add({
        targets: flash, radius: 96, alpha: 0, duration: 520, delay, ease: 'Cubic.Out',
        onComplete: () => flash.destroy(),
      });
    });

    // Speak only once the wall is full, so no line is read over a moving plaque.
    const settled = 700 + party.length * REVEAL_STEP + 500;
    this.time.delayedCall(settled, () => this.speakAndExit());
  }

  private speakAndExit() {
    const countLine = t(
      `🏆 Hall of Fame registration — Clear No. ${this.clears}!`,
      `🏆 명예의 전당 ${this.clears}회차 등록 완료!`,
    );
    const script = (this.rematch ? this.th.closingRematch : this.th.closing)
      .map(line => line === '__COUNT__' ? countLine : line);
    this.dialog.show(script, () => {
      this.cameras.main.fadeOut(900, 0, 0, 0, () => this.leave());
    });
  }

  /** Where the ending goes next — unchanged from when each league owned its own. */
  private leave() {
    if (this.themeKey === 'northern') return this.leaveNorth();
    if (this.rematch) {
      // Fresh gauntlet next time, and drop the player back at the League entrance.
      this.registry.set('hanbandoLeagueFloor', 1);
      this.registry.remove('leagueReturnX');
      this.registry.remove('leagueReturnY');
      const px = 14 * 32, py = 12 * 32 + 16;
      this.registry.set('leaguePlazaReturnX', px);
      this.registry.set('leaguePlazaReturnY', py);
      SaveManager.save(this.registry, px, py, 'LeaguePlazaScene');
      this.scene.start('LeaguePlazaScene');
      return;
    }
    // The Rival delivers the northern news back in Capitol City, not here.
    this.registry.set('capitolRivalNewsPending', true);
    this.registry.set('capitalReturnX', 24 * 32 + 16);
    this.registry.set('capitalReturnY', 31 * 32 + 16);
    this.scene.start('CapitolCityScene');
  }

  private leaveNorth() {
    if (this.rematch) {
      this.registry.set('northLeagueFloor', 1);
      this.registry.remove('northColiseumReturnX');
      this.registry.remove('northColiseumReturnY');
      // The coliseum stashed the forecourt spot it wants us back on before it
      // handed the ending over; fall back to the plaza's own spawn if absent.
      const px = (this.registry.get('northPlazaReturnX') as number | undefined) ?? 13 * 32;
      const py = (this.registry.get('northPlazaReturnY') as number | undefined) ?? 22 * 32 + 16;
      this.registry.set('northPlazaReturnX', px);
      this.registry.set('northPlazaReturnY', py);
      SaveManager.save(this.registry, px, py, 'NorthernPlazaScene');
      this.scene.start('NorthernPlazaScene');
      return;
    }
    this.registry.set('sudoPartyPending', true);
    const capitalX = 24 * 32 + 16, capitalY = 31 * 32 + 16;
    this.registry.set('capitalReturnX', capitalX);
    this.registry.set('capitalReturnY', capitalY);
    // Persist the completion and destination before changing scenes, so a reload
    // can never strand the player back at Taewang's throne.
    SaveManager.save(this.registry, capitalX, capitalY, 'CapitolCityScene');
    this.scene.start('CapitolCityScene');
  }
}

/** Exported for the League's farewell, so both halves name the room the same way. */
export const HALL_OF_FAME_ROOM = () => tr('Hall of Fame');
