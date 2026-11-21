import Phaser from 'phaser';
import { tr, speakerName } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, playerDesign, drawNpcBody } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { Inventory } from '../systems/Items';
import { PartySystem } from '../systems/PartySystem';

// ── Forest Shrine sub-event ──────────────────────────────────────────────────
// The monks of the Living Temple's inner shrine have lost their 목탁 (moktak) — a
// wooden prayer-drum whose century-old rhythm keeps the Ancient Forest's tree-spirits
// asleep. Without it the woods wake in sorrow and the spirits turn hostile.
//
// Arc: head monk's plea → two agitated guardian-spirits bar the way → strike the three
// prayer bells in the old lullaby's rhythm to unseal the inner gate → confront the
// grief-spirit that took the drum: 목탁귀 Moktakgwi (catchable) → the forest calms.

const IT = 36;

interface Guardian {
  key: string; name: string; line: string; col: number; row: number;
  species: string; level: number; catchRate: number; defeated: boolean;
}

interface Bell { col: number; row: number; label: string; }

export class ForestShrineScene extends Phaser.Scene {
  // A shrine ROOM: force interior 3D so its dark floor doesn't sprout a forest,
  // and place the generated shrine model on the altar niche (top centre). Only
  // that named plot rises — the room's own walls stay low.
  public interior3D = true;
  public onlyNamedBuildings = true;
  public buildingPlots = [{ x: 5, y: 1, w: 6, h: 3, model: 'shrine' }];
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private dialog!: DialogBox;
  private cutsceneActive = false;
  private px = 0; private py = 0;
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private readonly SPEED = 100;
  private readonly W = 16; private readonly H = 14;

  private monkCol = 8; private monkRow = 11;

  // The three prayer bells (left→right: Dawn / Heart / Dusk).
  private bells: Bell[] = [
    { col: 4,  row: 5, label: '새벽 Dawn' },
    { col: 8,  row: 5, label: '심장 Heart' },
    { col: 12, row: 5, label: '황혼 Dusk' },
  ];
  // The old lullaby's rhythm: Heart → Dusk → Dawn.
  private readonly bellOrder = [1, 2, 0];
  private bellSeq: number[] = [];
  private bellObjs: Phaser.GameObjects.Text[] = [];
  private gateGfx?: Phaser.GameObjects.Graphics;
  private altarSprite?: Phaser.GameObjects.Image;

  // Wild guardian-spirits — a real wild battle each, so you may soothe them OR
  // catch them with your own Poké Balls and items.
  private guardians: Guardian[] = [
    {
      key: 'shrine-guardian-1', name: 'Unquiet Ghograss',
      line: '(A vine-wreathed spirit lurches awake, hissing without its lullaby.)',
      col: 5, row: 8, species: 'ghograss', level: 40, catchRate: 120, defeated: false,
    },
    {
      key: 'shrine-guardian-2', name: 'Restless Foxgeist',
      line: '(A fox-shadow bares its teeth, grieving and afraid.)',
      col: 11, row: 8, species: 'foxgeist', level: 41, catchRate: 110, defeated: false,
    },
  ];

  constructor() { super('ForestShrineScene'); }

  preload() {
    if (!this.textures.exists('moktakgwi')) this.load.image('moktakgwi', 'assets/dex/moktakgwi.png');
  }

  create() {
    playBgm(this, 'forest');
    this.cutsceneActive = false;
    this.bellSeq = [];
    this.input.keyboard?.resetKeys();
    // A guardian-spirit is calmed only if its wild battle was won or it was caught
    // (fleeing / blacking out leaves it restless).
    const activeGuardian = this.registry.get('shrineGuardianActive') as string | undefined;
    if (activeGuardian) {
      const outcome = this.registry.get('wildOutcome');
      if (outcome === 'won' || outcome === 'caught') this.registry.set(`trainerDefeated_${activeGuardian}`, true);
      this.registry.remove('shrineGuardianActive');
    }
    this.guardians.forEach(g => { g.defeated = !!this.registry.get(`trainerDefeated_${g.key}`); });

    // Spawn at the south door; a battle restores the exact spot the player left from.
    this.px = 8 * IT + IT / 2;
    this.py = 11.5 * IT;
    const spx = this.registry.get('shrinePosX') as number | undefined;
    const spy = this.registry.get('shrinePosY') as number | undefined;
    if (spx !== undefined) { this.px = spx; this.py = spy as number; }
    this.registry.remove('shrinePosX'); this.registry.remove('shrinePosY');

    const solved = !!this.registry.get('shrineBellsSolved');

    this.drawShrine();
    this.drawGuardians();
    this.drawBells();
    if (!solved) this.drawGate();
    this.drawMonk();
    this.createPlayer();
    this.maybeDrawAltarSpirit();
    this.setupInput();
    this.cameras.main.setBounds(0, 0, this.W * IT, this.H * IT);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.cameras.main.fadeIn(300);
    this.dialog = new DialogBox(this, 1280, 720);

    // ── Story state on entry ──────────────────────────────────────────────
    if (this.registry.get('forestShrineDone')) {
      // Event over — a calm, thankful shrine.
      return;
    }
    if (this.registry.get('moktakConfronted')) {
      // Returning from the Moktakgwi encounter — resolve the quest.
      this.time.delayedCall(400, () => this.resolveEvent());
      return;
    }
    if (!this.registry.get('forestShrineIntro')) {
      this.cutsceneActive = true;
      this.time.delayedCall(300, () => this.monkIntro());
    }
  }

  // ── Room ────────────────────────────────────────────────────────────────
  private drawShrine() {
    const g = this.add.graphics().setDepth(0);
    const W = this.W * IT, H = this.H * IT;
    g.fillStyle(0x16281a); g.fillRect(0, 0, W, H);
    for (let r = 1; r < this.H - 1; r++) for (let c = 1; c < this.W - 1; c++) {
      const col = (r + c) % 2 === 0 ? 0x1e3622 : 0x1a301e;
      g.fillStyle(col); g.fillRect(c * IT, r * IT, IT, IT);
    }
    // Walls (dark stone-bark)
    g.fillStyle(0x0c1a0e);
    g.fillRect(0, 0, W, IT); g.fillRect(0, 0, IT, H);
    g.fillRect(W - IT, 0, IT, H); g.fillRect(0, H - IT, W, IT);
    // Altar niche side pillars (rows 1–3, cols 5 & 10)
    g.fillStyle(0x0c1a0e);
    for (const c of [5, 10]) g.fillRect(c * IT, IT, IT, 3 * IT);
    // Altar dais (top centre)
    g.fillStyle(0x2a4426); g.fillRect(6 * IT, IT, 4 * IT, IT * 1.3);
    g.lineStyle(2, 0x9fe06a); g.strokeRect(6 * IT, IT, 4 * IT, IT * 1.3);
    // Candle glows down the aisle
    for (let r = 4; r < this.H - 1; r += 3) {
      g.fillStyle(0xffcf7a, 0.7); g.fillCircle(2 * IT + IT / 2, r * IT + IT / 2, 5);
      g.fillStyle(0xffcf7a, 0.7); g.fillCircle((this.W - 3) * IT + IT / 2, r * IT + IT / 2, 5);
    }
    // South door
    g.fillStyle(0x6b4a28); g.fillRect(7 * IT, H - IT, 2 * IT, IT);

    const key = '__forestShrineMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, W, H); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(W / 2, IT * 0.55, tr('⛩️ FOREST SHRINE (숲 신전)'), {
      fontSize: '11px', color: '#cfffb0', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);
  }

  /** The sealed vine gate below the altar (cols 6–9, row 3). Solid until the bells are solved. */
  private drawGate() {
    const g = this.add.graphics().setDepth(6);
    g.fillStyle(0x2f5a2a, 1);
    g.fillRect(6 * IT, 3 * IT, 4 * IT, IT);
    g.lineStyle(2, 0x86d060);
    for (let i = 0; i < 5; i++) g.lineBetween(6 * IT + i * IT, 3 * IT, 6 * IT + i * IT, 4 * IT);
    // little leaves
    g.fillStyle(0x9fe06a, 0.9);
    for (let i = 0; i < 8; i++) g.fillCircle(6 * IT + 6 + i * 18, 3 * IT + (i % 2 ? 10 : 24), 4);
    this.gateGfx = g;
    this.add.text(8 * IT, 3.5 * IT, '🔒', { fontSize: '14px' }).setOrigin(0.5).setDepth(7)
      .setName('__gateLock__');
  }

  private drawBells() {
    this.bellObjs = [];
    for (const b of this.bells) {
      const x = b.col * IT + IT / 2, y = b.row * IT + IT / 2;
      const t = this.add.text(x, y, '🔔', { fontSize: '24px' }).setOrigin(0.5).setDepth(8);
      this.bellObjs.push(t);
      this.add.text(x, y - 24, tr(b.label), {
        fontSize: '8px', color: '#ffe9a0', backgroundColor: '#00000088', padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(8);
    }
  }

  private drawGuardians() {
    for (const gd of this.guardians) {
      if (gd.defeated) continue;
      const x = gd.col * IT + IT / 2, y = gd.row * IT + IT / 2;
      const g = this.add.graphics().setDepth(10);
      g.setPosition(x, y);
      const col = gd.key.endsWith('1') ? 0x3a6a3a : 0x7a4a6a;
      drawNpcBody(g, col, { hair: 0x203018 });
      g.setName(gd.key);
      this.add.text(x, y - 26, tr(gd.name), {
        fontSize: '8px', color: '#bfffa0', backgroundColor: '#00000088', padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(11).setName(`${gd.key}__label`);
    }
  }

  private drawMonk() {
    const x = this.monkCol * IT + IT / 2, y = this.monkRow * IT + IT / 2;
    const g = this.add.graphics().setDepth(10);
    g.setPosition(x, y);
    drawNpcBody(g, 0x9a7a4a, { hair: 0x2a2a2a, skin: 0xf0c8a0 });   // saffron-grey monk robe
    this.add.text(x, y - 26, speakerName('스님 Monk'), {
      fontSize: '8px', color: '#ffe9a0', backgroundColor: '#00000088', padding: { x: 2, y: 1 },
    }).setOrigin(0.5).setDepth(11);
  }

  /** Show the drifting Moktakgwi on the altar once the gate is open but before the fight. */
  private maybeDrawAltarSpirit() {
    if (this.registry.get('forestShrineDone')) return;
    if (this.registry.get('moktakConfronted')) return;
    if (!this.registry.get('shrineBellsSolved')) return;
    if (!this.textures.exists('moktakgwi')) return;
    const img = this.add.image(8 * IT, 1.9 * IT, 'moktakgwi').setDepth(9);
    const src = this.textures.get('moktakgwi').getSourceImage();
    const dim = Math.max((src.width as number) || 1, (src.height as number) || 1);
    img.setScale((IT * 1.6) / dim);
    this.tweens.add({ targets: img, y: 1.6 * IT, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.altarSprite = img;
  }

  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.redrawPlayer(); }
  private redrawPlayer() {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }

  private setupInput() {
    this.cursors  = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(_: number, delta: number) {
    if (this.cutsceneActive) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
      return;
    }
    const dt = delta / 1000;
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  { dx = -1; this.facing = 2; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { dx =  1; this.facing = 3; }
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    { dy = -1; this.facing = 1; }
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  { dy =  1; this.facing = 0; }
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = this.px + (dx / len) * this.SPEED * dt;
      const ny = this.py + (dy / len) * this.SPEED * dt;
      if (!this.blocked(nx, this.py)) this.px = nx;
      if (!this.blocked(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > 180) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else { this.walkFrame = 0; }
    this.redrawPlayer();

    this.checkGuardians();
    this.checkAltar();
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.tryInteract();
    this.checkExit();
  }

  /** Solid = outer wall, altar side-pillars (cols 5/10 rows 1–3), and the vine gate until solved. */
  private blocked(x: number, y: number): boolean {
    const col = Math.floor(x / IT), row = Math.floor(y / IT);
    if (x < IT || x > (this.W - 1) * IT || y < IT || y > (this.H - 1) * IT) return true;
    if ((col === 5 || col === 10) && row >= 1 && row <= 3) return true;
    if (row === 3 && col >= 6 && col <= 9 && !this.registry.get('shrineBellsSolved')) return true;
    return false;
  }

  // ── Interactions ────────────────────────────────────────────────────────
  private tryInteract() {
    // Talk to the monk?
    const mx = this.monkCol * IT + IT / 2, my = this.monkRow * IT + IT / 2;
    if (Math.hypot(this.px - mx, this.py - my) < IT * 1.5) { this.monkTalk(); return; }
    // Strike a bell?
    if (!this.registry.get('forestShrineIntro')) return;
    if (this.registry.get('shrineBellsSolved')) return;
    if (!this.guardians.every(g => g.defeated)) return;
    for (let i = 0; i < this.bells.length; i++) {
      const b = this.bells[i];
      const bx = b.col * IT + IT / 2, by = b.row * IT + IT / 2;
      if (Math.hypot(this.px - bx, this.py - by) < IT * 1.4) { this.strikeBell(i); return; }
    }
  }

  private strikeBell(i: number) {
    const t = this.bellObjs[i];
    // ring feedback
    this.tweens.add({ targets: t, scaleX: 1.3, scaleY: 1.3, duration: 90, yoyo: true });
    const note = this.add.text(t.x, t.y - 30, '♪', { fontSize: '18px', color: '#ffe9a0' }).setDepth(12);
    this.tweens.add({ targets: note, y: note.y - 24, alpha: 0, duration: 600, onComplete: () => note.destroy() });

    this.bellSeq.push(i);
    // Validate against the rhythm prefix.
    const step = this.bellSeq.length - 1;
    if (this.bellSeq[step] !== this.bellOrder[step]) {
      this.bellSeq = [];
      this.cutsceneActive = true;
      this.dialog.show(['The rhythm falters and fades... the bells fall silent.',
        'A monk calls softly: "Heart first, then Dusk, then Dawn. Let the old lullaby lead you."'],
        () => { this.cutsceneActive = false; });
      return;
    }
    if (this.bellSeq.length === this.bellOrder.length) this.solveBells();
  }

  private solveBells() {
    this.registry.set('shrineBellsSolved', true);
    this.cutsceneActive = true;
    // open the gate
    this.gateGfx?.destroy();
    this.children.getByName('__gateLock__')?.destroy();
    this.cameras.main.flash(400, 180, 255, 180);
    this.maybeDrawAltarSpirit();
    this.dialog.show([
      'The three bells answer as one — a warm, wooden pulse rolls through the shrine.',
      'The vines guarding the inner altar loosen and draw back.',
      'Beyond them, something small and sorrowful drifts in the candlelight... still keeping the rhythm.',
    ], () => { this.cutsceneActive = false; });
  }

  // ── Monk dialog ─────────────────────────────────────────────────────────
  private monkIntro() {
    this.registry.set('forestShrineIntro', true);
    this.dialog.show([
      'Monk: Traveler — you carry the Keeper\'s seal. Then perhaps the forest sent you.',
      'Monk: Our 목탁 is gone. For a hundred years its beat sang the tree-spirits to sleep.',
      'Monk: Without it the Ancient Forest wakes in grief. The spirits you see are not cruel — only frightened.',
      'Monk: The thief fled to the inner altar, but the roused guardians bar the aisle, and the prayer-gate is sealed.',
      'Monk: Calm the two guardians. Then ring the bells in the old lullaby — Heart, Dusk, Dawn — to open the way.',
    ], () => { this.cutsceneActive = false; });
  }

  private monkTalk() {
    this.cutsceneActive = true;
    if (this.registry.get('forestShrineDone')) {
      this.dialog.show(['Monk: The forest breathes easy again. The rhythm is safe — with you, and with the spirit that loved it.',
        'Monk: Rest here whenever the road wearies you. The shrine is open to you always.'],
        () => { this.cutsceneActive = false; });
      return;
    }
    if (!this.guardians.every(g => g.defeated)) {
      this.dialog.show(['Monk: Calm the two guardian-spirits first. They cannot hear reason until the drum returns.'],
        () => { this.cutsceneActive = false; });
    } else if (!this.registry.get('shrineBellsSolved')) {
      this.dialog.show(['Monk: Now the bells. The old lullaby: Heart, then Dusk, then Dawn.'],
        () => { this.cutsceneActive = false; });
    } else {
      this.dialog.show(['Monk: The gate is open. Go gently — grief is a frightened thing.'],
        () => { this.cutsceneActive = false; });
    }
  }

  // ── Guardian battles ──────────────────────────────────────────────────────
  private checkGuardians() {
    if (!this.registry.get('forestShrineIntro')) return;
    for (const gd of this.guardians) {
      if (!gd.defeated && !!this.registry.get(`trainerDefeated_${gd.key}`)) {
        gd.defeated = true;
        this.children.getByName(gd.key)?.destroy();
        this.children.getByName(`${gd.key}__label`)?.destroy();
      }
    }
    for (const gd of this.guardians) {
      if (gd.defeated) continue;
      const tx = gd.col * IT + IT / 2, ty = gd.row * IT + IT / 2;
      if (Math.hypot(this.px - tx, this.py - ty) < IT * 1.3) {
        this.cutsceneActive = true;
        this.dialog.show([gd.line, `${gd.name}: (A wild spirit blocks the aisle — soothe it, or catch it with a Poké Ball!)`], () => {
          // A real wild battle: Poké Balls and all bag items are available here.
          this.registry.set('shrineGuardianActive', gd.key);
          this.registry.set('wildId', gd.species);
          this.registry.set('wildLevel', gd.level);
          this.registry.set('wildCustom', true);
          this.registry.set('wildCatchRate', gd.catchRate);
          this.registry.set('wildReturnScene', 'ForestShrineScene');
          this.registry.set('shrinePosX', this.px); this.registry.set('shrinePosY', this.py);
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('WildBattleScene'));
        });
        return;
      }
    }
  }

  // ── Moktakgwi confrontation ────────────────────────────────────────────────
  private checkAltar() {
    if (!this.registry.get('shrineBellsSolved')) return;
    if (this.registry.get('moktakConfronted')) return;
    if (this.py < IT * 2.6 && !this.cutsceneActive) {
      this.cutsceneActive = true;
      this.dialog.show([
        'A small wooden drum-spirit hovers over the altar, tapping a slow, lonely beat.',
        '목탁귀 Moktakgwi: ...tok... tok... tok...',
        'Monk (from the aisle): It is the old master\'s grief given shape. When he passed, none kept the rhythm — so IT did, alone, all these years.',
        'Monk: It will not surrender the drum willingly. Free it the only way a trainer can — meet it, and let it choose you.',
      ], () => {
        this.registry.set('moktakConfronted', true);
        PartySystem.healAll(this.registry);
        if (Inventory.count(this.registry, 'ultraball') < 5) Inventory.add(this.registry, 'ultraball', 5);
        this.registry.set('wildId', 'moktakgwi');
        this.registry.set('wildLevel', 42);
        this.registry.set('wildCustom', true);
        this.registry.set('wildCatchRate', 40);
        this.registry.set('wildReturnScene', 'ForestShrineScene');
        this.registry.set('shrinePosX', 8 * IT + IT / 2); this.registry.set('shrinePosY', 4 * IT);
        this.cameras.main.fadeOut(600, 20, 40, 20, () => this.scene.start('WildBattleScene'));
      });
    }
  }

  /** Back from the Moktakgwi encounter (caught, beaten or fled): the drum is recovered. */
  private resolveEvent() {
    this.cutsceneActive = true;
    const caught = PartySystem.get(this.registry).some(p => p.spriteKey === 'moktakgwi')
      || PartySystem.getBox(this.registry).some(p => p.spriteKey === 'moktakgwi');
    const lines = caught
      ? [
          'The moktak\'s spirit has chosen to walk with you — its rhythm now beats at your side.',
          'The monks bow deeply. "Then the lullaby is not lost. It simply found new hands."',
        ]
      : [
          'The spirit\'s grief eases. It sets the 목탁 gently upon the altar and fades into the roots, at peace.',
          'A monk lifts the drum and begins the old, slow beat. All through the shrine, the tension unwinds.',
        ];
    lines.push('The Ancient Forest exhales. Far off, the lashing vines go still.');
    lines.push('Head Monk: You have given the forest back its sleep. Take this, with the temple\'s thanks.');
    lines.push('You received ₩3,000, 3 Ultra Balls and an Elixir!');

    this.registry.set('forestShrineDone', true);
    this.registry.set('forestCalmed', true);
    Inventory.addMoney(this.registry, 3000);
    Inventory.add(this.registry, 'ultraball', 3);
    Inventory.add(this.registry, 'elixir', 1);
    this.altarSprite?.destroy();

    this.dialog.show(lines, () => { this.cutsceneActive = false; });
  }

  private checkExit() {
    if (this.py > (this.H - 2) * IT && this.px > 6.5 * IT && this.px < 9.5 * IT && !this.cutsceneActive) {
      // The shrine sits in the Ancient Forest (Route 5) — step back out to its grounds.
      this.registry.set('route5ReturnX', 12 * 32 + 16);
      this.registry.set('route5ReturnY', 25 * 32 + 16);
      this.cameras.main.fadeOut(300, 0, 0, 0, () => this.scene.start('Route5Scene'));
    }
  }

  static healParty(scene: Phaser.Scene) { PartySystem.healAll(scene.registry); }
}
