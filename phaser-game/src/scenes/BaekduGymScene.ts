import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, playerDesign, drawGymLeader } from '../data/CharacterSprite';
import { vanishesAfterDefeat } from '../data/Villains';
import { DialogBox } from '../ui/DialogBox';

interface GymTrainer {
  key: string; name: string; line: string;
  col: number; row: number;
  pokemon: { id: number; level: number }[];
  expPool: number;
  defeated: boolean;
}

const IT = 36;

export class BaekduGymScene extends Phaser.Scene {
  // Summit Dojo interior: keep the whole room flat in 3D. Interior-style terrain
  // still raised the stone-wall border and the grey rock stepping-stones into tall
  // blocks/"mountains" that hid the player and the leader ahead; flatTerrain3D skips
  // ALL wall/foliage extrusion so nothing rises off the painted dojo floor.
  public flatTerrain3D = true;
  public onlyNamedBuildings = true;

  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private dialog!: DialogBox;
  private cutsceneActive = false;
  private px = 0; private py = 0;
  private facing = 0; private walkFrame = 0; private walkTimer = 0;
  private readonly SPEED = 100;
  private readonly W = 16; private readonly H = 14;  // room grid

  private trainers: GymTrainer[] = [
    {
      key: 'baekdu-taeguk', name: 'Gym Trainer Taeguk',
      line: 'Taeguk: The mountain does not move for anyone. Neither do I!',
      col: 5, row: 9,
      pokemon: [{ id: 56, level: 15 }, { id: 57, level: 16 }],   // Mankey, Primeape
      expPool: 440, defeated: false,
    },
    {
      key: 'baekdu-nari', name: 'Gym Trainer Nari',
      line: 'Nari: Speed is more important than strength. Let me prove it!',
      col: 10, row: 5,
      pokemon: [{ id: 106, level: 16 }],   // Hitmonlee
      expPool: 320, defeated: false,
    },
  ];

  constructor() { super('BaekduGymScene'); }

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
    drawGymLeader(this, (this.W * IT) / 2, IT * 1.9, { body: 0x6a2a2a, accent: 0xff8844, label: 'LEADER BYEOKSAN', labelColor: '#ffcf70', hair: 0x2a1810, trainerKey: 'baekdu-byeoksan' });
    this.setupInput();
    this.cameras.main.setBounds(0, 0, this.W * IT, this.H * IT);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.cameras.main.fadeIn(300);

    this.dialog = new DialogBox(this, 1280, 720);

    // After beating Byeoksan, play his farewell once, then let the player leave.
    if (this.registry.get('baekduGymDefeated') && !this.registry.get('baekduByeoksanFarewell')) {
      this.registry.set('baekduByeoksanFarewell', true);
      this.cutsceneActive = true;
      this.dialog.show([
        'Byeoksan: The mountain tested you and you stood.',
        '(He turns his weathered gaze to the far south.)',
        "Byeoksan: Those black-coated people circling my city — the wild Pokémon near the Jeju vent have been agitated for weeks.",
        'Byeoksan: Something is disturbing the deep. Be watchful.',
        'You may leave the dojo through the south door whenever you are ready.',
      ], () => { this.cutsceneActive = false; });
      return;
    }

    this.dialog.show([
      'You entered the Summit Dojo (정상 도장)!',
      'Open-walled training hall built into the mountainside, overlooking the highland lake.',
      'Cross the weighted stepping stones and defeat the two Gym Trainers to reach Leader Byeoksan.',
    ], () => { this.cutsceneActive = false; });
    this.cutsceneActive = true;
  }

  private drawGym() {
    const g = this.add.graphics().setDepth(0);
    const W = this.W * IT, H = this.H * IT;

    // Wooden dojo floor
    g.fillStyle(0x8a6a44); g.fillRect(0, 0, W, H);
    for (let r = 1; r < this.H - 1; r++) for (let c = 1; c < this.W - 1; c++) {
      const col = (r + c) % 2 === 0 ? 0x946f47 : 0x82603c;
      g.fillStyle(col); g.fillRect(c * IT, r * IT, IT, IT);
    }
    // Plank lines
    g.lineStyle(1, 0x5a4228, 0.5);
    for (let r = 0; r <= this.H; r++) g.lineBetween(0, r * IT, W, r * IT);

    // Open-wall view of the highland lake along the top
    g.fillStyle(0x2f6fbf); g.fillRect(IT, IT, W - 2 * IT, IT * 1.2);
    g.fillStyle(0xbfe0f5); g.fillRect(IT, IT, W - 2 * IT, IT * 0.4);   // mist over the lake

    // Stone walls
    g.fillStyle(0x4a4239);
    g.fillRect(0, 0, W, IT); g.fillRect(0, 0, IT, H);
    g.fillRect(W - IT, 0, IT, H); g.fillRect(0, H - IT, W, IT);

    // Weighted stepping stones up the center (flavor path)
    g.fillStyle(0x6f6558);
    for (const [c, r] of [[8,9],[8,8],[7,7],[9,7],[8,6],[8,4],[8,3]] as [number,number][]) {
      g.fillCircle(c * IT + IT / 2, r * IT + IT / 2, IT * 0.42);
      g.lineStyle(2, 0x3a342c); g.strokeCircle(c * IT + IT / 2, r * IT + IT / 2, IT * 0.42);
    }

    // Leader's dais (top)
    g.fillStyle(0x5a3a1a); g.fillRect(4 * IT, IT, 8 * IT, IT * 1.4);
    g.lineStyle(2, 0xc89a4a); g.strokeRect(4 * IT, IT, 8 * IT, IT * 1.4);

    // Entry door
    g.fillStyle(0x6b4a28); g.fillRect(7 * IT, H - IT, 2 * IT, IT);

    const texKey = '__baekduGymMap__';
    if (this.textures.exists(texKey)) this.textures.remove(texKey);
    g.generateTexture(texKey, W, H);
    g.destroy();
    this.add.image(0, 0, texKey).setOrigin(0, 0).setDepth(0);

    this.add.text(W / 2, IT * 1.7, tr('⛰ SUMMIT DOJO'), {
      fontSize: '11px', color: '#ffe0a0', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);
    if (this.trainers.every(t => t.defeated) && !this.registry.get('baekduGymDefeated')) {
      this.add.text(W / 2, IT * 2.4, tr('← LEADER BYEOKSAN →'), { fontSize: '9px', color: '#ffcf70' })
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
      g.fillStyle(0xffffff); g.fillRect(-8, -8, 16, 11);            // white dobok
      g.fillStyle(0xeeeeee); g.fillRect(-12, -7, 5, 9); g.fillRect(7, -7, 5, 9);
      g.fillStyle(0x222222); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0x111111); g.fillRect(-8, -3, 16, 2);             // black belt
      g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
      g.fillStyle(0x1a1008); g.fillRect(-6, -20, 12, 4);
      g.fillStyle(0x000000); g.fillRect(-3, -14, 2, 2); g.fillRect(1, -14, 2, 2);
      this.add.text(x, y - 28, tr.name.split(' ').pop() ?? tr.name, {
        fontSize: '8px', color: '#ffe0a0', backgroundColor: '#00000088', padding: { x: 2, y: 1 },
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
        this.dialog.show([tr.line, `${tr.name}: Show me your footing!`], () => {
          this.registry.set('trainerName',        tr.name);
          this.registry.set('trainerKey',         tr.key);
          this.registry.set('trainerPokemon',     JSON.stringify(tr.pokemon));
          this.registry.set('trainerExpPool',     tr.expPool);
          this.registry.set('trainerReturnScene', 'BaekduGymScene');
          this.registry.set('gymPosX', this.px); this.registry.set('gymPosY', this.py);
          // NB: don't touch baekduCityReturnX/Y here — those are the city door position
          // set on entry. Overwriting them with gym coords warps the player into the
          // Cheonji lake (a solid tile) on exit, trapping them.
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkLeaderApproach() {
    if (!this.trainers.every(t => t.defeated)) return;
    if (this.registry.get('baekduGymDefeated')) return;
    if (this.py < IT * 2.8 && !this.cutsceneActive) {
      this.cutsceneActive = true;
      this.dialog.show([
        '(A broad-shouldered man sits cross-legged on a flat boulder, eyes closed. He rises as you approach.)',
        "Byeoksan: I felt you coming up the mountain. Your steps are uneven — you're used to flat city roads.",
        "Byeoksan: But there's something steady in the rhythm.",
        'Byeoksan: Come. Show me what that potential looks like.',
      ], () => {
        // Configure Byeoksan as a gym-leader battle (custom Pokémon + badge reward).
        this.registry.set('trainerName',        'Leader Byeoksan');
        this.registry.set('trainerKey',         'baekdu-byeoksan');
        this.registry.set('trainerPokemon', JSON.stringify([
          { id: 297, level: 17 },                          // Hariyama
          { id: 0,   level: 18, custom: 'kidstrel' },       // Flying/Fighting
          { id: 0,   level: 18, custom: 'gorcobat' },       // Grass/Fighting
          { id: 0,   level: 18, custom: 'balchataek' },     // Balchataek (Dark/Fighting) — replaces Lucario
          { id: 701, level: 19 },                          // Hawlucha (ace)
        ]));
        this.registry.set('trainerExpPool',     900);
        this.registry.set('trainerReturnScene', 'BaekduGymScene');
        this.registry.set('gymPosX', this.px); this.registry.set('gymPosY', this.py);
        this.registry.set('trainerBadgeFlag',   'baekduGymDefeated');
        this.registry.set('trainerBadgeName',   'Summit Seal Badge');
        this.registry.set('trainerBadgeTM',     'Close Combat');
        this.registry.set('trainerWinLine',     'Byeoksan: The mountain tested you and you stood.');
        // (see checkTrainers) leave baekduCityReturnX/Y as the city door, not gym coords.
        this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
      });
    }
  }

  private checkExit() {
    if (this.py > (this.H - 2) * IT && this.px > 6.5 * IT && this.px < 9.5 * IT && !this.cutsceneActive) {
      this.cameras.main.fadeOut(300, 0, 0, 0, () => this.scene.start('BaekduCityScene'));
    }
  }
}
