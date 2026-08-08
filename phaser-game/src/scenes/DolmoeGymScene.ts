import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, playerDesign, drawGymLeader } from '../data/CharacterSprite';
import { vanishesAfterDefeat } from '../data/Villains';
import { DialogBox } from '../ui/DialogBox';

// ── Dolmoe City Gym — The Stonemason's Quarry (석공 채석장) · Rock ─────────────────
// Two quarry-worker gym trainers, then Leader Sandol "The Bedrock" for the Bedrock
// Badge + TM Stone Edge. Cloned from the Geumgang gym pattern.

interface GymTrainer {
  key: string; name: string; line: string; col: number; row: number;
  pokemon: { id: number; level: number; custom?: string }[]; expPool: number; defeated: boolean;
}

const IT = 36;

export class DolmoeGymScene extends Phaser.Scene {
  // The quarry is an indoor battle puzzle. Its dark granite floor used to be
  // classified as rows of tall outdoor cliff tiles, hiding the player.
  public interior3D = true;
  public clearSight3D = true;
  public flatTerrain3D = true;
  public noRocks3D = true;
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private dialog!: DialogBox;
  private cutsceneActive = false;
  private sandolAbsentShown = false;   // guards the "Sandol's at the ruins" dais message
  private px = 0; private py = 0;
  private facing = 0; private walkFrame = 0; private walkTimer = 0;
  private readonly SPEED = 100;
  private readonly W = 16; private readonly H = 14;

  private trainers: GymTrainer[] = [
    {
      key: 'dolmoe-bawoo', name: 'Gym Trainer Bawoo',
      line: 'Bawoo: Mind the rockslides — one wrong push and the quarry pushes back!',
      col: 5, row: 9,
      pokemon: [{ id: 75, level: 39 }, { id: 76, level: 40 }],   // Graveler, Golem
      expPool: 900, defeated: false,
    },
    {
      key: 'dolmoe-doran', name: 'Gym Trainer Doran',
      line: 'Doran: Stone and steel, stone and fist. Break one, the next still stands.',
      col: 10, row: 5,
      pokemon: [{ id: 306, level: 40 }, { id: 0, level: 41, custom: 'prowlrock' }],  // Aggron (Rock/Steel), Prowlrock (Rock/Flying)
      expPool: 960, defeated: false,
    },
  ];

  constructor() { super('DolmoeGymScene'); }

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
    // Sandol is away guarding the dolmen ruins until that side-event is resolved.
    if (this.registry.get('dolmoeRuinsDone') || this.registry.get('dolmoeGymDefeated'))
      drawGymLeader(this, (this.W * IT) / 2, IT * 1.9, { body: 0x6a5030, accent: 0xc8a860, label: 'LEADER SANDOL', labelColor: '#e8ddc8', hair: 0x888888, trainerKey: 'dolmoe-sandol' });
    this.setupInput();
    this.cameras.main.setBounds(0, 0, this.W * IT, this.H * IT);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.cameras.main.fadeIn(300);
    this.dialog = new DialogBox(this, 1280, 720);

    if (this.registry.get('dolmoeGymDefeated') && !this.registry.get('sandolFarewell')) {
      this.registry.set('sandolFarewell', true);
      this.cutsceneActive = true;
      this.dialog.show([
        'Sandol: The mountain remembers those who don\'t crack. It remembers you now.',
        'Sandol: The road climbs on to Seorae, and the snow. Carry your load steady. Leave through the south door when you\'re ready.',
      ], () => { this.cutsceneActive = false; });
      return;
    }

    this.dialog.show([
      'You descend onto the quarry floor of the Stonemason\'s Quarry (석공 채석장)!',
      'Hewn granite tiers, dolmen slabs, and rock-cut carvings loom overhead.',
      'Defeat the two Gym Trainers, then face Leader Sandol — The Bedrock.',
    ], () => { this.cutsceneActive = false; });
    this.cutsceneActive = true;
  }

  private drawGym() {
    const g = this.add.graphics().setDepth(0);
    const W = this.W * IT, H = this.H * IT;
    g.fillStyle(0x4a453e); g.fillRect(0, 0, W, H);
    for (let r = 1; r < this.H - 1; r++) for (let c = 1; c < this.W - 1; c++) {
      const col = (r + c) % 2 === 0 ? 0x55504a : 0x4c473f;
      g.fillStyle(col); g.fillRect(c * IT, r * IT, IT, IT);
    }
    g.fillStyle(0x2a2620);
    g.fillRect(0, 0, W, IT); g.fillRect(0, 0, IT, H); g.fillRect(W - IT, 0, IT, H); g.fillRect(0, H - IT, W, IT);
    // Scattered boulders (decor)
    for (const [c, r] of [[3, 4], [12, 8], [7, 3], [11, 10], [4, 11]]) { g.fillStyle(0x6a655c); g.fillCircle(c * IT + IT/2, r * IT + IT/2, 12); g.fillStyle(0x807a70); g.fillCircle(c*IT+IT/2-3, r*IT+IT/2-3, 5); }
    // Leader dais (granite slab)
    g.fillStyle(0x6a655c); g.fillRect(4 * IT, IT, 8 * IT, IT * 1.4);
    g.lineStyle(2, 0xb0a898); g.strokeRect(4 * IT, IT, 8 * IT, IT * 1.4);
    g.fillStyle(0x5a3418); g.fillRect(7 * IT, H - IT, 2 * IT, IT);

    const texKey = '__dolmoeGymMap__';
    if (this.textures.exists(texKey)) this.textures.remove(texKey);
    g.generateTexture(texKey, W, H); g.destroy();
    this.add.image(0, 0, texKey).setOrigin(0, 0).setDepth(0);

    this.add.text(W / 2, IT * 1.7, tr('⛏ STONEMASON\'S QUARRY'), {
      fontSize: '11px', color: '#e8ddc8', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);
    if (this.trainers.every(t => t.defeated) && !this.registry.get('dolmoeGymDefeated'))
      this.add.text(W / 2, IT * 2.4, tr('← LEADER SANDOL →'), { fontSize: '9px', color: '#e8ddc8' }).setOrigin(0.5).setDepth(5);
  }

  private drawTrainers() {
    for (const tr of this.trainers) {
      if (tr.defeated && vanishesAfterDefeat(tr.key)) continue;
      const x = tr.col * IT + IT / 2, y = tr.row * IT + IT / 2;
      const g = this.add.graphics().setDepth(10);
      g.setPosition(x, y);
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(0x9a8a6a); g.fillRect(-7, -8, 14, 11); g.fillRect(-11, -7, 5, 8); g.fillRect(6, -7, 5, 8);
      g.fillStyle(0x3a3228); g.fillRect(-6, 3, 5, 9); g.fillRect(1, 3, 5, 9);
      g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
      g.fillStyle(0x2a1a10); g.fillRect(-6, -20, 12, 4);
      g.fillStyle(0x000000); g.fillRect(-3, -14, 2, 2); g.fillRect(1, -14, 2, 2);
      this.add.text(x, y - 28, tr.name.split(' ').pop() ?? tr.name, {
        fontSize: '8px', color: '#e8ddc8', backgroundColor: '#00000088', padding: { x: 2, y: 1 },
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
        this.dialog.show([tr.line, `${tr.name}: Let\'s see you dig in!`], () => {
          this.registry.set('trainerName', tr.name);
          this.registry.set('trainerKey', tr.key);
          this.registry.set('trainerPokemon', JSON.stringify(tr.pokemon));
          this.registry.set('trainerExpPool', tr.expPool);
          this.registry.set('trainerReturnScene', 'DolmoeGymScene');
          this.registry.set('gymPosX', this.px); this.registry.set('gymPosY', this.py);
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private checkLeaderApproach() {
    if (this.registry.get('dolmoeGymDefeated')) return;
    // Sandol is at the dolmen ruins until the side-event is done — the dais is empty.
    if (!this.registry.get('dolmoeRuinsDone')) {
      if (this.py < IT * 2.8) {
        if (!this.sandolAbsentShown && !this.cutsceneActive) {
          this.sandolAbsentShown = true;   // show once per approach, not every frame
          this.cutsceneActive = true;
          this.dialog.show([
            "(The leader's dais stands empty. A quarry-worker leans on a chisel nearby.)",
            "Quarry Worker: Leader Sandol? Gone up to the 고인돌 유적 — the dolmen ruins west of town. Black-coated diggers were sniffing around the old graves.",
            "Quarry Worker: No badge today unless you fetch him. Follow the western trail out of the city.",
          ], () => { this.cutsceneActive = false; });
        }
      } else {
        this.sandolAbsentShown = false;   // re-arm once you step off the dais
      }
      return;
    }
    if (!this.trainers.every(t => t.defeated)) return;
    if (this.py < IT * 2.8 && !this.cutsceneActive) {
      this.cutsceneActive = true;
      this.dialog.show([
        '(A broad, quiet man with granite-dust in his hair hefts a chisel-hammer over one shoulder.)',
        'Sandol: The mountain doesn\'t rush. Doesn\'t boast. It just endures, and outlasts everything that tries to break it.',
        'Sandol: Let\'s see if you\'ve got that in you. Or if you crack.',
      ], () => {
        this.registry.set('trainerName', 'Leader Sandol');
        this.registry.set('trainerKey', 'dolmoe-sandol');
        this.registry.set('trainerPokemon', JSON.stringify([
          { id: 464, level: 42 },                         // Rhyperior (Rock/Ground) — Stealth Rock
          { id: 76,  level: 42 },                          // Golem (Rock/Ground) — Earthquake
          { id: 0,   level: 43, custom: 'halubang' },       // Halubang (Rock/Dark) — sturdy custom defender
          { id: 0,   level: 44, custom: 'mperodactyl' },   // Rock/Dragon ace — Head Smash
        ]));
        this.registry.set('trainerExpPool', 1400);
        this.registry.set('trainerReturnScene', 'DolmoeGymScene');
        this.registry.set('gymPosX', this.px); this.registry.set('gymPosY', this.py);
        this.registry.set('trainerBadgeFlag', 'dolmoeGymDefeated');
        this.registry.set('trainerBadgeName', 'Bedrock Badge');
        this.registry.set('trainerBadgeTM', 'Stone Edge');
        this.registry.set('trainerWinLine', 'Sandol: ...Didn\'t crack. Good. The mountain respects that. Carry it steady.');
        this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
      });
    }
  }

  private checkExit() {
    if (this.py > (this.H - 2) * IT && this.px > 6.5 * IT && this.px < 9.5 * IT && !this.cutsceneActive) {
      this.registry.set('dolmoeReturnX', 20 * 32); this.registry.set('dolmoeReturnY', 16 * 32);
      this.cameras.main.fadeOut(300, 0, 0, 0, () => this.scene.start('DolmoeCityScene'));
    }
  }
}
