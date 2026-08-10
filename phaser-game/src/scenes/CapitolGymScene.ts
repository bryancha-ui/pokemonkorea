import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, markProceduralCharacter3D, playerDesign } from '../data/CharacterSprite';
import { vanishesAfterDefeat } from '../data/Villains';
import { DialogBox } from '../ui/DialogBox';
import { fetchPokemon, fetchMove } from '../data/PokeAPI';
import { SaveManager } from '../utils/SaveManager';
import { markTrainerPortrait } from '../data/BattlePortraits';

interface GymTrainer {
  key: string; name: string; line: string;
  col: number; row: number;
  pokemon: { id: number; level: number }[];
  expPool: number;
  defeated: boolean;
}

const IT = 36;

export class CapitolGymScene extends Phaser.Scene {
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
      key: 'shadow-miso', name: 'Shadow Trainer Miso',
      line: 'Miso: In darkness, only the strong survive!',
      col: 8, row: 11,
      pokemon: [{ id: 198, level: 7 }],   // Murkrow (reduced from 9)
      expPool: 130, defeated: false,
    },
    {
      key: 'shadow-jaemin', name: 'Shadow Trainer Jaemin',
      line: "Jaemin: Leader Jin's shadows protect this hall!",
      col: 8, row: 7,
      pokemon: [{ id: 261, level: 8 }, { id: 228, level: 9 }],  // reduced from 10/11
      expPool: 240, defeated: false,
    },
    {
      key: 'shade-yuna', name: 'Shade Trainer Yuna',
      line: "Yuna: You'll face the true dark here!",
      col: 8, row: 3,
      pokemon: [{ id: 215, level: 9 }, { id: 198, level: 10 }],  // reduced from 11/12
      expPool: 300, defeated: false,
    },
  ];

  constructor() { super('CapitolGymScene'); }

  create() {

    playBgm(this, 'gyminterior');
    this.cutsceneActive = false;
    this.input.keyboard?.resetKeys();

    // Load defeated state — use the same key that TrainerBattleScene writes
    this.trainers.forEach(t => {
      t.defeated = !!this.registry.get(`trainerDefeated_${t.key}`);
    });

    this.px = 8 * IT + IT / 2;
    this.py = 10 * IT + IT / 2;   // start well above the exit threshold

    // Return to where you were standing before the battle (not the entry).
    const gpx = this.registry.get('gymPosX') as number | undefined;
    const gpy = this.registry.get('gymPosY') as number | undefined;
    if (gpx !== undefined) { this.px = gpx; this.py = gpy as number; }
    this.registry.remove('gymPosX'); this.registry.remove('gymPosY');

    this.drawGym();
    this.drawLeader();
    this.drawTrainers();
    this.createPlayer();
    this.setupInput();
    // No zoom — keeps DialogBox (scrollFactor:0) on screen correctly.
    // The 36px tiles at 1:1 scale fill the 1280×720 canvas well.
    this.cameras.main.setBounds(0, 0, this.W * IT, this.H * IT);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.cameras.main.fadeIn(300);

    this.dialog = new DialogBox(this, 1280, 720);
    // The gym scene is recreated after every trainer battle. Play the entrance
    // card only on the first visit so returning from battle never looks like a
    // warp back to the beginning of the gym.
    const firstEntry = !this.registry.get('capitolGymEntered');
    this.registry.set('capitolGymEntered', true);
    if (firstEntry) {
      this.dialog.show([
        'You entered the Capitol Gym!',
        'The air feels cold and heavy with shadow...',
        'Defeat the three Shadow Trainers to reach Leader Jin.',
      ], () => { this.cutsceneActive = false; });
      this.cutsceneActive = true;
    } else {
      this.cutsceneActive = false;
    }
  }

  private drawGym() {
    const g = this.add.graphics().setDepth(0);
    const W = this.W * IT, H = this.H * IT;

    // Dark gym floor
    g.fillStyle(0x1a1a2e); g.fillRect(0, 0, W, H);

    // Purple energy floor tiles
    for (let r = 1; r < this.H - 1; r++) {
      for (let c = 1; c < this.W - 1; c++) {
        const col = (r + c) % 2 === 0 ? 0x1e1e3a : 0x16162e;
        g.fillStyle(col); g.fillRect(c * IT, r * IT, IT, IT);
      }
    }

    // Dark energy lines
    g.lineStyle(1, 0x440088, 0.4);
    for (let r = 0; r <= this.H; r++) g.lineBetween(0, r * IT, W, r * IT);
    for (let c = 0; c <= this.W; c++) g.lineBetween(c * IT, 0, c * IT, H);

    // Walls
    g.fillStyle(0x0a0a1e);
    g.fillRect(0, 0, W, IT); g.fillRect(0, 0, IT, H);
    g.fillRect(W - IT, 0, IT, H); g.fillRect(0, H - IT, W, IT);

    // Shadow pillars (decorative)
    const pillars = [[3,2],[12,2],[3,6],[12,6],[3,10],[12,10]];
    for (const [c, r] of pillars) {
      g.fillStyle(0x330055); g.fillRect(c * IT, r * IT, IT, IT * 2);
      g.lineStyle(2, 0x9933cc, 0.8); g.strokeRect(c * IT, r * IT, IT, IT * 2);
      // Purple glow
      g.fillStyle(0x6600aa, 0.2); g.fillCircle(c * IT + IT / 2, r * IT, IT);
    }

    // Leader's platform (top)
    g.fillStyle(0x330066); g.fillRect(4 * IT, 0, 8 * IT, 2 * IT);
    g.lineStyle(2, 0x9933cc); g.strokeRect(4 * IT, 0, 8 * IT, 2 * IT);
    g.fillStyle(0xaa44ff, 0.15); g.fillRect(4 * IT, 0, 8 * IT, 2 * IT);

    // Shadow emblem
    g.fillStyle(0x6600aa, 0.4); g.fillCircle(W / 2, IT, IT * 1.5);
    g.lineStyle(3, 0xaa44ff, 0.6); g.strokeCircle(W / 2, IT, IT * 1.5);

    // Entry door
    g.fillStyle(0x6633aa); g.fillRect(7 * IT, H - IT, 2 * IT, IT);

    // "GYM" title — pinned to the very top edge so it clears LEADER JIN's
    // nameplate (both are centred on the leader's column; at y=IT they overlapped).
    this.add.text(W / 2, 12, tr('CAPITOL GYM'), {
      fontSize: '11px', color: '#cc88ff', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(11);

    const texKey = '__gymMap__';
    if (this.textures.exists(texKey)) this.textures.remove(texKey);
    g.generateTexture(texKey, W, H);
    g.destroy();
    this.add.image(0, 0, texKey).setOrigin(0, 0).setDepth(0);
  }

  // Leader Jin stands at his dais at the top of the hall, guarding the way.
  private drawLeader() {
    const x = (this.W * IT) / 2, y = IT * 1.9;
    const g = this.add.graphics().setDepth(9);
    g.setPosition(x, y);
    // Shadow pool
    g.fillStyle(0x000000, 0.25); g.fillEllipse(0, 15, 22, 7);
    // Long dark robe
    g.fillStyle(0x2a1440); g.fillRect(-10, -6, 20, 22);
    g.fillStyle(0x3a1c5a); g.fillRect(-10, -6, 20, 6);       // shoulders
    g.fillStyle(0xaa44ff, 0.9); g.fillRect(-2, -4, 4, 16);   // glowing sash
    // Arms
    g.fillStyle(0x2a1440); g.fillRect(-13, -4, 4, 12); g.fillRect(9, -4, 4, 12);
    // Head + hair
    g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 12);
    g.fillStyle(0x140820); g.fillRect(-7, -21, 14, 6);
    g.fillStyle(0x000000); g.fillRect(-4, -14, 2, 2); g.fillRect(2, -14, 2, 2);
    // Purple aura
    g.lineStyle(2, 0xaa44ff, 0.5); g.strokeCircle(0, 0, 20);
    markTrainerPortrait(g, 'capitol-jin');

    this.add.text(x, y - 30, tr('LEADER JIN'), {
      fontSize: '9px', color: '#cc88ff', fontStyle: 'bold',
      backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(10);
  }

  private drawTrainers() {
    for (const t of this.trainers) {
      if (t.defeated && vanishesAfterDefeat(t.key)) continue;
      const x = t.col * IT + IT / 2, y = t.row * IT + IT / 2;
      const g = this.add.graphics().setDepth(10);
      g.setPosition(x, y);
      // Shadow-styled trainer
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(0x330066); g.fillRect(-8, -8, 16, 11);
      g.fillStyle(0x330066); g.fillRect(-12, -7, 5, 9); g.fillRect(7, -7, 5, 9);
      g.fillStyle(0x1a1a1a); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xddbbff); g.fillRect(-7, -22, 14, 12);
      g.fillStyle(0x220044); g.fillRect(-7, -22, 14, 5);
      g.fillStyle(0xff6600); g.fillRect(-3, -16, 2, 2); g.fillRect(1, -16, 2, 2);
      markProceduralCharacter3D(g, {
        outfit: 0x330066, hair: 0x220044, skin: 0xddbbff,
        footY: 13, outfitStyle: 'uniform',
      });

      // Translate the short name (e.g. Jaemin → 재민) via the i18n table.
      this.add.text(x, y - 28, tr(t.name.split(' ').pop() ?? t.name), {
        fontSize: '8px', color: '#cc88ff', backgroundColor: '#00000088', padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(11);
    }
  }

  private createPlayer() {
    this.playerG = this.add.graphics().setDepth(20);
    this.redrawPlayer();
  }

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
    // Open the party/bag menu anytime in the gym
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
  }

  update(_: number, delta: number) {
    if (this.cutsceneActive) {
      // Allow SPACE to advance dialogs even while frozen
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
      const hw = 6;
      const checkX = (x: number, y: number) =>
        x < IT || x > (this.W - 1) * IT || y < IT || y > (this.H - 1) * IT;
      if (!checkX(nx, this.py)) this.px = nx;
      if (!checkX(this.px, ny)) this.py = ny;

      this.walkTimer += delta;
      if (this.walkTimer > 180) { this.walkFrame ^= 1; this.walkTimer = 0; }
      void hw;
    } else { this.walkFrame = 0; }

    this.redrawPlayer();
    this.checkTrainers();
    this.checkLeaderApproach();
    this.checkExit();
  }

  private checkTrainers() {
    // ── Sync defeated flags FIRST so the distance check sees up-to-date state ──
    for (const t of this.trainers) {
      if (!t.defeated && !!this.registry.get(`trainerDefeated_${t.key}`)) {
        t.defeated = true;
      }
    }

    // ── Then check proximity ──
    for (const t of this.trainers) {
      if (t.defeated) continue;
      const tx = t.col * IT + IT / 2, ty = t.row * IT + IT / 2;
      if (Math.hypot(this.px - tx, this.py - ty) < IT * 1.4) {
        this.cutsceneActive = true;
        this.dialog.show([t.line, `${tr(t.name)}: Prepare yourself!`], () => {
          this.registry.set('trainerName',        tr(t.name));
          this.registry.set('trainerKey',         t.key);
          this.registry.set('trainerPokemon',     JSON.stringify(t.pokemon));
          this.registry.set('trainerExpPool',     t.expPool);
          this.registry.set('trainerReturnScene', 'CapitolGymScene');
          this.registry.set('gymPosX', this.px); this.registry.set('gymPosY', this.py);
          this.registry.set('capitalReturnX',     this.px);
          this.registry.set('capitalReturnY',     this.py);
          this.cameras.main.fadeOut(400, 0, 0, 0, () => {
            this.scene.start('TrainerBattleScene');
          });
        });
        return;
      }
    }
  }

  private checkLeaderApproach() {
    const allDefeated = this.trainers.every(t => t.defeated);
    if (!allDefeated) return;
    if (this.py < IT * 2.5 && !this.cutsceneActive && !this.registry.get('gymLeaderDefeated')) {
      this.cutsceneActive = true;
      this.dialog.show([
        'A figure steps out from the shadows...',
        'Leader Jin: You defeated all my Shadow Trainers. Impressive.',
        'Leader Jin: I am Jin, Guardian of Capitol City\'s shadows.',
        'Leader Jin: My Corrpanda and I will test your resolve.',
        'Leader Jin: Darkness is not evil — it is the truth behind light.',
        'Leader Jin: Come. Show me what you are made of.',
      ], () => {
        // Keep the retry point at Jin's platform. This is also a safety net for
        // any future transition that legitimately recreates the gym scene.
        this.registry.set('gymPosX', this.px);
        this.registry.set('gymPosY', this.py);
        this.registry.set('capitalReturnX', this.px);
        this.registry.set('capitalReturnY', this.py);
        this.cameras.main.fadeOut(500, 0, 0, 0, () => {
          this.scene.start('GymLeaderBattleScene');
        });
      });
    }
  }

  private checkExit() {
    // Exit when player walks fully past the bottom wall (below row H-1)
    if (this.py > (this.H - 2) * IT && this.px > 6.5 * IT && this.px < 9.5 * IT && !this.cutsceneActive) {
      this.cameras.main.fadeOut(300, 0, 0, 0, () => {
        this.scene.start('CapitolCityScene');
      });
    }
  }
}
