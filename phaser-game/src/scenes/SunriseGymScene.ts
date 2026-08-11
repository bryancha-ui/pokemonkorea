import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, playerDesign, drawGymLeader } from '../data/CharacterSprite';
import { vanishesAfterDefeat } from '../data/Villains';
import { DialogBox } from '../ui/DialogBox';

interface GymTrainer {
  key: string; name: string; line: string;
  col: number; row: number;
  pokemon: { id: number; level: number; custom?: string }[];
  expPool: number;
  defeated: boolean;
}

const IT = 36;

export class SunriseGymScene extends Phaser.Scene {
  // This is an indoor observatory. Its dark blue dais used to be classified as
  // a raised outdoor cliff, visually blocking the path to Leader Beonge.
  public interior3D = true;
  public clearSight3D = true;
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
      key: 'sunrise-seongwoo', name: 'Gym Trainer Seongwoo',
      line: 'Seongwoo: Read the current, or it reads you. Light it up!',
      col: 5, row: 9,
      pokemon: [{ id: 0, level: 51, custom: 'ureunggul' }, { id: 0, level: 52, custom: 'thunderon' }],
      expPool: 1300, defeated: false,
    },
    {
      key: 'sunrise-daehwi', name: 'Gym Trainer Daehwi',
      line: "Daehwi: The panels only turn for the quick. Keep up!",
      col: 10, row: 5,
      pokemon: [{ id: 0, level: 52, custom: 'wildcat' }, { id: 0, level: 53, custom: 'kingfisher' }],
      expPool: 1340, defeated: false,
    },
  ];

  constructor() { super('SunriseGymScene'); }

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
    drawGymLeader(this, (this.W * IT) / 2, IT * 1.9, { body: 0x8a6a1a, accent: 0xffe044, label: 'LEADER BEONGE', labelColor: '#fff0a0', hair: 0x3a2a10, trainerKey: 'sunrise-beonge' });
    this.setupInput();
    this.cameras.main.setBounds(0, 0, this.W * IT, this.H * IT);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.cameras.main.fadeIn(300);

    this.dialog = new DialogBox(this, 1280, 720);

    if (this.registry.get('sunriseGymDefeated') && !this.registry.get('beongeFarewell')) {
      this.registry.set('beongeFarewell', true);
      this.cutsceneActive = true;
      this.dialog.show([
        'Beonge: The storm answered to you. Take the Stormwatcher Badge.',
        'Beonge: The sky over Baekdu has been wrong for days — charged, waiting. Whatever you mean to do up there, do it soon.',
        'You may leave through the south door whenever you are ready.',
      ], () => { this.cutsceneActive = false; });
      return;
    }

    this.dialog.show([
      'You climb into the Cliff Observatory (절벽 천문대)!',
      'Half gym, half observatory, bolted into the sea-cliffs. Current crackles through rotating panels.',
      'Defeat the two Gym Trainers, then face Leader Beonge, the Stormwatcher.',
    ], () => { this.cutsceneActive = false; });
    this.cutsceneActive = true;
  }

  private drawGym() {
    const g = this.add.graphics().setDepth(0);
    const W = this.W * IT, H = this.H * IT;
    g.fillStyle(0x14203a); g.fillRect(0, 0, W, H);
    for (let r = 1; r < this.H - 1; r++) for (let c = 1; c < this.W - 1; c++) {
      const col = (r + c) % 2 === 0 ? 0x1c2e4e : 0x182742;
      g.fillStyle(col); g.fillRect(c * IT, r * IT, IT, IT);
    }
    g.fillStyle(0x0a1226);
    g.fillRect(0, 0, W, IT); g.fillRect(0, 0, IT, H);
    g.fillRect(W - IT, 0, IT, H); g.fillRect(0, H - IT, W, IT);
    // Crackling current nodes along the sides
    for (let r = 2; r < this.H - 1; r += 2) {
      g.fillStyle(0xffe44e, 0.9); g.fillCircle(1 * IT + IT / 2, r * IT + IT / 2, 6);
      g.fillStyle(0x88ddff, 0.9); g.fillCircle((this.W - 2) * IT + IT / 2, r * IT + IT / 2, 6);
    }
    // Leader's storm podium. The 3D mirror bakes the whole map into one flat
    // ground texture, so a dark-navy fill here read as a black blocking tile in
    // front of Beonge under the gym's dim lighting. Paint it as a bright, clearly
    // deliberate steel stage (lighter top face + thin front lip + glow trim) so it
    // reads as a podium, not a void.
    g.fillStyle(0x40608f); g.fillRect(4 * IT, IT, 8 * IT, IT * 1.4);            // stage top
    g.fillStyle(0x4f74ac); g.fillRect(4 * IT, IT, 8 * IT, IT * 0.9);           // brighter upper face
    g.fillStyle(0x2f466e); g.fillRect(4 * IT, IT + IT * 1.4 - 5, 8 * IT, 5);  // shadowed front lip
    g.lineStyle(2, 0xffe44e); g.strokeRect(4 * IT, IT, 8 * IT, IT * 1.4);
    g.fillStyle(0x6b4a28); g.fillRect(7 * IT, H - IT, 2 * IT, IT);

    const texKey = '__sunriseGymMap__';
    if (this.textures.exists(texKey)) this.textures.remove(texKey);
    g.generateTexture(texKey, W, H); g.destroy();
    this.add.image(0, 0, texKey).setOrigin(0, 0).setDepth(0);

    this.add.text(W / 2, IT * 1.7, tr('⚡ CLIFF OBSERVATORY'), {
      fontSize: '11px', color: '#ffe88a', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);
    if (this.trainers.every(t => t.defeated) && !this.registry.get('sunriseGymDefeated')) {
      this.add.text(W / 2, IT * 2.4, tr('← LEADER BEONGE →'), { fontSize: '9px', color: '#fff0a0' })
        .setOrigin(0.5).setDepth(5);
    }
  }

  private drawTrainers() {
    for (const tr of this.trainers) {
      if (tr.defeated && vanishesAfterDefeat(tr.key)) continue;
      const x = tr.col * IT + IT / 2, y = tr.row * IT + IT / 2;
      const g = this.add.graphics().setDepth(10);
      g.setPosition(x, y);
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(0xddbb33); g.fillRect(-7, -8, 14, 11);
      g.fillStyle(0xddbb33); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x222222); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
      g.fillStyle(0x2a2410); g.fillRect(-6, -20, 12, 4);
      g.fillStyle(0x000000); g.fillRect(-3, -14, 2, 2); g.fillRect(1, -14, 2, 2);
      this.add.text(x, y - 28, tr.name.split(' ').pop() ?? tr.name, {
        fontSize: '8px', color: '#ffe88a', backgroundColor: '#00000088', padding: { x: 2, y: 1 },
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
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }

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
      const wall = (x: number, y: number) => x < IT || x > (this.W - 1) * IT || y < IT || y > (this.H - 1) * IT;
      if (!wall(nx, this.py)) this.px = nx;
      if (!wall(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > 180) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else { this.walkFrame = 0; }
    this.redrawPlayer();
    this.checkTrainers();
    this.checkLeaderApproach();
    this.checkExit();
  }

  private checkTrainers() {
    for (const tr of this.trainers) {
      if (!tr.defeated && !!this.registry.get(`trainerDefeated_${tr.key}`)) tr.defeated = true;
    }
    for (const tr of this.trainers) {
      if (tr.defeated) continue;
      const tx = tr.col * IT + IT / 2, ty = tr.row * IT + IT / 2;
      if (Math.hypot(this.px - tx, this.py - ty) < IT * 1.4) {
        this.cutsceneActive = true;
        this.dialog.show([tr.line, `${tr.name}: Full current!`], () => {
          this.registry.set('trainerName',        tr.name);
          this.registry.set('trainerKey',         tr.key);
          this.registry.set('trainerPokemon',     JSON.stringify(tr.pokemon));
          this.registry.set('trainerExpPool',     tr.expPool);
          this.registry.set('trainerReturnScene', 'SunriseGymScene');
          this.registry.set('gymPosX', this.px); this.registry.set('gymPosY', this.py);
          this.registry.set('sunriseCityReturnX', this.px);
          this.registry.set('sunriseCityReturnY', this.py);
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkLeaderApproach() {
    if (!this.trainers.every(t => t.defeated)) return;
    if (this.registry.get('sunriseGymDefeated')) return;
    if (this.py < IT * 2.8 && !this.cutsceneActive) {
      this.cutsceneActive = true;
      this.dialog.show([
        '(A wind-burned woman stands at the rail, watching the storm clouds gather over the sea.)',
        "Beonge: I am Beonge, the Stormwatcher. I have read these skies my whole life.",
        'Beonge: Electricity is not power. It is TIMING — the instant the sky decides to strike.',
        "Beonge: Five partners ride my current. Show me your timing. Begin!",
      ], () => {
        this.registry.set('trainerName',        'Leader Beonge');
        this.registry.set('trainerKey',         'sunrise-beonge');
        this.registry.set('trainerPokemon', JSON.stringify([
          { id: 0,   level: 53, custom: 'metdoyaroe' },  // Electric (Explosion)
          { id: 0,   level: 53, custom: 'ampere' },       // Electric/Flying
          { id: 0,   level: 54, custom: 'waterdeer' },    // Electric/Normal
          { id: 0,   level: 54, custom: 'bonejoillion' }, // Electric/Steel (Flash Cannon)
          { id: 479, level: 56 },                          // Rotom (Electric/Ghost ace, Overheat)
        ]));
        this.registry.set('trainerExpPool',     2400);
        this.registry.set('trainerReturnScene', 'SunriseGymScene');
        this.registry.set('gymPosX', this.px); this.registry.set('gymPosY', this.py);
        this.registry.set('trainerBadgeFlag',   'sunriseGymDefeated');
        this.registry.set('trainerBadgeName',   'Stormwatcher Badge');
        this.registry.set('trainerBadgeTM',     'Thunderbolt');
        this.registry.set('trainerWinLine',     'Beonge: Perfect timing. The sky is yours.');
        this.registry.set('sunriseCityReturnX', this.px);
        this.registry.set('sunriseCityReturnY', this.py);
        this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
      });
    }
  }

  private checkExit() {
    if (this.py > (this.H - 2) * IT && this.px > 6.5 * IT && this.px < 9.5 * IT && !this.cutsceneActive) {
      // Spawn explicitly on the boulevard in front of the Gym's own door, so a stale
      // return coord (e.g. from a Pokémon Center visit) can't trap the player.
      this.registry.set('sunriseCityReturnX', 20 * 32 + 16);
      this.registry.set('sunriseCityReturnY', 13 * 32 + 16);
      this.cameras.main.fadeOut(300, 0, 0, 0, () => this.scene.start('SunriseCityScene'));
    }
  }
}
