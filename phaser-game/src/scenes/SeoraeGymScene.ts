import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, playerDesign, drawGymLeader } from '../data/CharacterSprite';
import { vanishesAfterDefeat } from '../data/Villains';
import { DialogBox } from '../ui/DialogBox';

// ── Seorae Town Gym — The Frostbell Gym (서리종 체육관) · Ice ─────────────────────
// Two shrine-attendant gym trainers, then Leader Yeona "The Winter Bell" for the
// Frostbell Badge + TM Aurora Veil.

interface GymTrainer {
  key: string; name: string; line: string; col: number; row: number;
  pokemon: { id: number; level: number; custom?: string }[]; expPool: number; defeated: boolean;
}

const IT = 36;

export class SeoraeGymScene extends Phaser.Scene {
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private dialog!: DialogBox;
  private cutsceneActive = false;
  private px = 0; private py = 0;
  private facing = 0; private walkFrame = 0; private walkTimer = 0;
  private readonly SPEED = 100;
  private readonly W = 16; private readonly H = 14;

  private trainers: GymTrainer[] = [
    {
      key: 'seorae-nunsong', name: 'Gym Trainer Nunsong',
      line: 'Nunsong: Ring the wrong bell, and the winter answers. Let it answer for you!',
      col: 5, row: 9,
      pokemon: [{ id: 460, level: 45 }, { id: 91, level: 46 }],   // Abomasnow, Cloyster
      expPool: 940, defeated: false,
    },
    {
      key: 'seorae-baram', name: 'Attendant Baram',
      line: 'Baram: The frost-bells chose me to slow you. Do not take that lightly.',
      col: 10, row: 5,
      pokemon: [{ id: 615, level: 46 }, { id: 478, level: 48 }],  // Cryogonal, Froslass (Ice/Ghost)
      expPool: 1000, defeated: false,
    },
  ];

  constructor() { super('SeoraeGymScene'); }

  create() {

    playBgm(this, 'gyminterior');
    this.cutsceneActive = false;
    this.input.keyboard?.resetKeys();
    this.trainers.forEach(t => { t.defeated = !!this.registry.get(`trainerDefeated_${t.key}`); });

    this.px = 8 * IT + IT / 2;
    this.py = 11 * IT + IT / 2;

    // Return to where you were standing before the battle (not the entry).
    const gpx = this.registry.get('gymPosX') as number | undefined;
    const gpy = this.registry.get('gymPosY') as number | undefined;
    if (gpx !== undefined) { this.px = gpx; this.py = gpy as number; }
    this.registry.remove('gymPosX'); this.registry.remove('gymPosY');

    this.drawGym();
    this.drawTrainers();
    this.createPlayer();
    drawGymLeader(this, (this.W * IT) / 2, IT * 1.9, { body: 0x3a6a8a, accent: 0xaee6ff, label: 'LEADER YEONA', labelColor: '#cdeeff', skin: 0xf0e6ea, hair: 0xbfe6ff, trainerKey: 'seorae-yeona' });
    this.setupInput();
    this.cameras.main.setBounds(0, 0, this.W * IT, this.H * IT);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.cameras.main.fadeIn(300);
    this.dialog = new DialogBox(this, 1280, 720);

    if (this.registry.get('seoraeGymDefeated') && !this.registry.get('yeonaFarewell')) {
      this.registry.set('yeonaFarewell', true);
      this.cutsceneActive = true;
      this.dialog.show([
        'Yeona: The thaw you carry will melt more than snow, I think. Go gently with it.',
        'Yeona: Above Seorae the road drops to Sunrise City, and the first light of Onnuri. Leave by the south door when you\'re ready.',
        '📟 Your Pokédex buzzes — Professor Song, urgent.',
        "Prof. Song: It's begun. 노스단 has moved on 나비할망 at the Jeju vents — RIGHT NOW. Your Frostbell Badge says you're finally ready for this.",
        "Prof. Song: Sail back to Jeju and climb the vent trail. Old Dosik's ferry will carry you. Go — she needs a guardian who can stand.",
      ], () => { this.cutsceneActive = false; });
      return;
    }

    this.dialog.show([
      'You slide onto the frozen floor of the Frostbell Gym (서리종 체육관)!',
      'A sheet of blue ice, frost-bells hung in rows, hot-spring steam curling at the eaves.',
      'Defeat the two Gym Trainers, then face Leader Yeona — The Winter Bell.',
    ], () => { this.cutsceneActive = false; });
    this.cutsceneActive = true;
  }

  private drawGym() {
    const g = this.add.graphics().setDepth(0);
    const W = this.W * IT, H = this.H * IT;
    g.fillStyle(0xcfe4ef); g.fillRect(0, 0, W, H);
    for (let r = 1; r < this.H - 1; r++) for (let c = 1; c < this.W - 1; c++) {
      const col = (r + c) % 2 === 0 ? 0xd6ecf6 : 0xc4dced;
      g.fillStyle(col); g.fillRect(c * IT, r * IT, IT, IT);
      g.fillStyle(0xffffff, 0.35); g.fillRect(c*IT+6, r*IT+8, 10, 2);   // ice sheen
    }
    g.fillStyle(0x3a5060);
    g.fillRect(0, 0, W, IT); g.fillRect(0, 0, IT, H); g.fillRect(W - IT, 0, IT, H); g.fillRect(0, H - IT, W, IT);
    // Frost-bells along the sides
    for (let r = 2; r < this.H - 1; r += 2) {
      g.fillStyle(0xbfe0ff, 0.95); g.fillCircle(1 * IT + IT/2, r * IT + IT/2, 6);
      g.fillStyle(0xbfe0ff, 0.95); g.fillCircle((this.W - 2) * IT + IT/2, r * IT + IT/2, 6);
    }
    // Leader dais (frozen altar)
    g.fillStyle(0xa8d0e8); g.fillRect(4 * IT, IT, 8 * IT, IT * 1.4);
    g.lineStyle(2, 0xffffff); g.strokeRect(4 * IT, IT, 8 * IT, IT * 1.4);
    g.fillStyle(0x5a4028); g.fillRect(7 * IT, H - IT, 2 * IT, IT);

    const texKey = '__seoraeGymMap__';
    if (this.textures.exists(texKey)) this.textures.remove(texKey);
    g.generateTexture(texKey, W, H); g.destroy();
    this.add.image(0, 0, texKey).setOrigin(0, 0).setDepth(0);

    this.add.text(W / 2, IT * 1.7, tr('🔔 FROSTBELL GYM'), {
      fontSize: '11px', color: '#26506a', fontStyle: 'bold', stroke: '#fff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);
    if (this.trainers.every(t => t.defeated) && !this.registry.get('seoraeGymDefeated'))
      this.add.text(W / 2, IT * 2.4, tr('← LEADER YEONA →'), { fontSize: '9px', color: '#26506a' }).setOrigin(0.5).setDepth(5);
  }

  private drawTrainers() {
    for (const tr of this.trainers) {
      if (tr.defeated && vanishesAfterDefeat(tr.key)) continue;
      const x = tr.col * IT + IT / 2, y = tr.row * IT + IT / 2;
      const g = this.add.graphics().setDepth(10);
      g.setPosition(x, y);
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(0xdfeefb); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x2a3a4a); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
      g.fillStyle(0x3a4650); g.fillRect(-6, -20, 12, 4);
      g.fillStyle(0x000000); g.fillRect(-3, -14, 2, 2); g.fillRect(1, -14, 2, 2);
      this.add.text(x, y - 28, tr.name.split(' ').pop() ?? tr.name, {
        fontSize: '8px', color: '#26506a', backgroundColor: '#ffffffaa', padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(11);
    }
  }

  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.redrawPlayer(); }
  private redrawPlayer() {
    const g = this.playerG;
    // Gender-aware body (was a hardcoded red-shirt boy).
    drawTrainerBody(g, this.facing, this.walkFrame, playerDesign(this.registry));
    g.setPosition(this.px, this.py);
  }

  private setupInput() {
    this.cursors  = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.wasd = {
      up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'),
      left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D'),
    };
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }

  update(_: number, delta: number) {
    if (this.cutsceneActive) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
      return;
    }
    const dt = delta / 1000; let dx = 0, dy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  { dx = -1; this.facing = 2; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { dx =  1; this.facing = 3; }
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    { dy = -1; this.facing = 1; }
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  { dy =  1; this.facing = 0; }
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = this.px + (dx / len) * this.SPEED * dt, ny = this.py + (dy / len) * this.SPEED * dt;
      const wall = (x: number, y: number) => x < IT || x > (this.W - 1) * IT || y < IT || y > (this.H - 1) * IT;
      if (!wall(nx, this.py)) this.px = nx;
      if (!wall(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > 180) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else this.walkFrame = 0;
    this.redrawPlayer();
    this.checkTrainers();
    this.checkLeaderApproach();
    this.checkExit();
  }

  private checkTrainers() {
    for (const tr of this.trainers) if (!tr.defeated && !!this.registry.get(`trainerDefeated_${tr.key}`)) tr.defeated = true;
    for (const tr of this.trainers) {
      if (tr.defeated) continue;
      const tx = tr.col * IT + IT / 2, ty = tr.row * IT + IT / 2;
      if (Math.hypot(this.px - tx, this.py - ty) < IT * 1.4) {
        this.cutsceneActive = true;
        this.dialog.show([tr.line, `${tr.name}: Ring the bell — begin!`], () => {
          this.registry.set('trainerName', tr.name);
          this.registry.set('trainerKey', tr.key);
          this.registry.set('trainerPokemon', JSON.stringify(tr.pokemon));
          this.registry.set('trainerExpPool', tr.expPool);
          this.registry.set('trainerReturnScene', 'SeoraeGymScene');
          this.registry.set('gymPosX', this.px); this.registry.set('gymPosY', this.py);
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkLeaderApproach() {
    if (!this.trainers.every(t => t.defeated)) return;
    if (this.registry.get('seoraeGymDefeated')) return;
    if (this.py < IT * 2.8 && !this.cutsceneActive) {
      this.cutsceneActive = true;
      this.dialog.show([
        '(A poised woman in white-and-frost-blue robes rings a small frost-bell once. Her breath mists.)',
        'Yeona: You\'ve climbed a long way in the cold to reach me. Most turn back at the treeline.',
        'Yeona: Winter doesn\'t ask if you\'re ready. It simply arrives. So — let it arrive.',
      ], () => {
        this.registry.set('trainerName', 'Leader Yeona');
        this.registry.set('trainerKey', 'seorae-yeona');
        this.registry.set('trainerPokemon', JSON.stringify([
          { id: 362, level: 46 },                       // Glalie — Aurora Veil
          { id: 699, level: 48 },                        // Aurorus (Rock/Ice) — wall
          { id: 0,   level: 50, custom: 'snoqueen' },    // Ice/Fairy ace — Blizzard + Moonblast
        ]));
        this.registry.set('trainerExpPool', 1450);
        this.registry.set('trainerReturnScene', 'SeoraeGymScene');
        this.registry.set('gymPosX', this.px); this.registry.set('gymPosY', this.py);
        this.registry.set('trainerBadgeFlag', 'seoraeGymDefeated');
        this.registry.set('trainerBadgeName', 'Frostbell Badge');
        this.registry.set('trainerBadgeTM', 'Aurora Veil');
        this.registry.set('trainerWinLine', 'Yeona: ...The thaw comes even to the deepest winter. You are that thaw. Go warmly.');
        this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
      });
    }
  }

  private checkExit() {
    if (this.py > (this.H - 2) * IT && this.px > 6.5 * IT && this.px < 9.5 * IT && !this.cutsceneActive) {
      this.registry.set('seoraeReturnX', 20 * 32); this.registry.set('seoraeReturnY', 16 * 32);
      this.cameras.main.fadeOut(300, 0, 0, 0, () => this.scene.start('SeoraeTownScene'));
    }
  }
}
