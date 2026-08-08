import Phaser from 'phaser';
import { tr } from '../systems/i18n';
import { playBgm } from '../systems/Music';
import { drawTrainerBody, playerDesign, drawNpcBody } from '../data/CharacterSprite';
import { DialogBox } from '../ui/DialogBox';
import { Inventory } from '../systems/Items';
import { PartySystem } from '../systems/PartySystem';
import { markTrainerPortrait } from '../data/BattlePortraits';

// ── 고인돌 유적 — the great Dolmen Ruins (a huge site west of Dolmoe City) ──────
// A sprawling granite field of ancient dolmens. Leader Sandol has come out to stop
// 노스단 from prying open a sealed capstone; drive them off and the desecrated dolmen
// releases its guardian, 대장승 Daejangseung (catchable). Enter from the east gate
// (Dolmoe City); the sealed dolmen and the fight lie to the west.

const IT = 36;
const T = { GRASS: 0, TREE: 1, CLIFF: 2, DOLMEN: 3, DIG: 4, GATE: 5 } as const;
type Tile = typeof T[keyof typeof T];
const COLORS: Record<Tile, number> = {
  [T.GRASS]: 0x6a7050, [T.TREE]: 0x1f3a20, [T.CLIFF]: 0x4a453c, [T.DOLMEN]: 0x5a544a, [T.DIG]: 0x3f3a32, [T.GATE]: 0x8a7a5a,
};
const SOLID = new Set<Tile>([T.TREE, T.CLIFF, T.DOLMEN, T.DIG]);

interface Grunt {
  key: string; name: string; line: string; col: number; row: number;
  pokemon: { id: number; level: number; custom?: string }[]; expPool: number; defeated: boolean;
}

export class DolmoeRuinsScene extends Phaser.Scene {
  // The great sealed dig-site dolmen plus every scattered standing dolmen get
  // the generated 고인돌 model on their exact tile.
  public buildingPlots = [
    { x: 6, y: 8, w: 3, h: 3, model: 'dolmen' },
    ...([[3,4],[3,20],[6,16],[8,22],[12,4],[14,18],[16,10],[5,10],[15,23],[11,17],[17,6],[4,14]] as [number,number][])
      .map(([r, c]) => ({ x: c, y: r, w: 1, h: 1, model: 'dolmen' })),
  ];
  public onlyNamedBuildings = true;
  /** Keep the archaeological field completely readable: cliff, tree, rock and
   * dark dig tiles stay painted on the ground instead of rising into tall 3D
   * walls. Authored dolmen models in buildingPlots remain standing. */
  public clearSight3D = true;
  public flatTerrain3D = true;
  public noRocks3D = true;
  public noVehicles = true;
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private cutsceneActive = false;
  private px = 0; private py = 0;
  private facing = 2; private walkFrame = 0; private walkTimer = 0;
  private readonly SPEED = 110; private readonly RUN = 220;
  private readonly W = 28; private readonly H = 20;
  private map!: Tile[][];

  // The sealed dig-site dolmen (the guardian's tomb), west-centre.
  private readonly digCol = 7; private readonly digRow = 9;
  private sandolCol = 11; private sandolRow = 10;
  private guardianImg?: Phaser.GameObjects.Image;

  private grunts: Grunt[] = [
    {
      key: 'ruins-nosdan-1', name: '노스단 Digger',
      line: "노스단 Digger: This slab's been sealed a few thousand years. Whatever's under it, the Director wants it.",
      col: 9, row: 6,
      pokemon: [{ id: 0, level: 41, custom: 'corrpanda' }, { id: 0, level: 42, custom: 'martbadger' }],
      expPool: 1200, defeated: false,
    },
    {
      key: 'ruins-nosdan-2', name: '노스단 Digger',
      line: "노스단 Digger: The old stonecutter won't let us work. Move him — and you — aside.",
      col: 9, row: 14,
      pokemon: [{ id: 229, level: 42 }, { id: 0, level: 42, custom: 'palmcockatoo' }],
      expPool: 1240, defeated: false,
    },
  ];

  constructor() { super('DolmoeRuinsScene'); }

  preload() {
    if (!this.textures.exists('daejangseung')) this.load.image('daejangseung', 'assets/dex/daejangseung.png');
  }

  private buildMap(): Tile[][] {
    const m: Tile[][] = Array.from({ length: this.H }, () => Array(this.W).fill(T.GRASS) as Tile[]);
    // Cliff/forest border
    for (let c = 0; c < this.W; c++) { m[0][c] = T.CLIFF; m[this.H - 1][c] = T.CLIFF; }
    for (let r = 0; r < this.H; r++) { m[r][0] = T.CLIFF; m[r][this.W - 1] = T.CLIFF; }
    // East gate → Dolmoe City (an opening in the east cliff)
    m[9][this.W - 1] = T.GATE; m[10][this.W - 1] = T.GATE; m[11][this.W - 1] = T.GATE;
    // Scattered standing dolmens across the field
    for (const [r, c] of [[3,4],[3,20],[6,16],[8,22],[12,4],[14,18],[16,10],[5,10],[15,23],[11,17],[17,6],[4,14]] as [number,number][]) m[r][c] = T.DOLMEN;
    // Frozen pines dotting the ridge
    for (const [r, c] of [[2,7],[2,17],[17,13],[13,24],[6,3]] as [number,number][]) m[r][c] = T.TREE;
    // The great SEALED dolmen (dig site) — a 2×2 block the guardian rises from.
    for (let r = this.digRow - 1; r <= this.digRow + 1; r++) for (let c = this.digCol - 1; c <= this.digCol + 1; c++) m[r][c] = T.DIG;
    return m;
  }

  create() {
    playBgm(this, 'dolmoe');
    this.cutsceneActive = false;
    this.input.keyboard?.resetKeys();
    this.grunts.forEach(g => { g.defeated = !!this.registry.get(`trainerDefeated_${g.key}`); });

    // Enter from the east gate; a battle restores the exact spot the player left from.
    this.px = (this.W - 2) * IT + IT / 2; this.py = 10 * IT + IT / 2;
    const rpx = this.registry.get('ruinsPosX') as number | undefined;
    const rpy = this.registry.get('ruinsPosY') as number | undefined;
    if (rpx !== undefined) { this.px = rpx; this.py = rpy as number; }
    this.registry.remove('ruinsPosX'); this.registry.remove('ruinsPosY');

    // A guardian counts as calmed only if its wild battle was won or it was caught.
    if (this.registry.get('dolmoeGuardianActive')) {
      const outcome = this.registry.get('wildOutcome');
      if (outcome === 'won' || outcome === 'caught') this.registry.set('dolmoeGuardianBeaten', true);
      this.registry.remove('dolmoeGuardianActive');
    }

    this.map = this.buildMap();
    this.drawField();
    this.drawGrunts();
    this.drawSandol();
    this.createPlayer();
    if (this.registry.get('dolmoeGuardianWoke') && !this.registry.get('dolmoeRuinsDone')) this.drawGuardian();
    this.setupInput();
    this.cameras.main.setBounds(0, 0, this.W * IT, this.H * IT);
    this.cameras.main.setZoom(1.4);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
    this.cameras.main.fadeIn(300);
    this.dialog = new DialogBox(this, 1280, 720);

    if (this.registry.get('dolmoeRuinsDone')) return;
    if (this.registry.get('dolmoeGuardianBeaten')) { this.time.delayedCall(400, () => this.resolveEvent()); return; }
    if (this.registry.get('dolmoeGuardianWoke')) return;
    if (!this.registry.get('dolmoeRuinsSeen')) { this.cutsceneActive = true; this.time.delayedCall(300, () => this.intro()); }
  }

  // ── Field ────────────────────────────────────────────────────────────────
  private drawField() {
    const g = this.add.graphics().setDepth(0);
    for (let r = 0; r < this.H; r++) for (let c = 0; c < this.W; c++) {
      const t = this.map[r][c]; const x = c * IT, y = r * IT;
      g.fillStyle(COLORS[t], 1); g.fillRect(x, y, IT, IT);
      if (t === T.GRASS)  { g.fillStyle(0x5a6044, 0.6); g.fillRect(x+6, y+20, 4, 6); g.fillRect(x+20, y+10, 4, 6); }
      if (t === T.TREE)   { g.fillStyle(0x14301a); g.fillTriangle(x+18, y+2, x+2, y+30, x+34, y+30); }
      if (t === T.CLIFF)  { g.fillStyle(0x3a352e); g.fillRect(x+4, y+4, 12, 10); g.fillRect(x+18, y+16, 12, 12); }
      if (t === T.DOLMEN) { g.fillStyle(0x4a453c); g.fillRect(x+5, y+10, 6, 20); g.fillRect(x+25, y+10, 6, 20); g.fillStyle(0x6a6458); g.fillRect(x-2, y+2, IT+4, 12); }
      if (t === T.GATE)   { g.fillStyle(0x6b5a3a); g.fillRect(x+6, y+2, IT-12, IT-4); }
    }
    // The great sealed dolmen (dig site) — big capstone + 노스단 scaffolding.
    const dx = (this.digCol - 1) * IT, dy = (this.digRow - 1) * IT;
    g.fillStyle(0x3f3a32); g.fillRect(dx, dy + IT, 3 * IT, 2 * IT);
    g.fillStyle(0x5a544a); g.fillRect(dx - 4, dy + IT - 8, 3 * IT + 8, 16);   // capstone
    g.lineStyle(2, 0xcaa860); g.strokeRect(dx - 4, dy + IT - 8, 3 * IT + 8, 16);
    g.fillStyle(0x161616); g.fillRect(dx + 2, dy + IT, 4, 2 * IT); g.fillRect(dx + 3 * IT - 6, dy + IT, 4, 2 * IT);   // struts

    const key = '__dolmoeRuinsMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, this.W * IT, this.H * IT); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text((this.W - 1.4) * IT, 10 * IT, tr('→ Dolmoe City'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(this.W / 2 * IT, 0.6 * IT, tr('🗿 고인돌 유적 — DOLMEN RUINS'), {
      fontSize: '11px', color: '#e8ddc8', fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);
  }

  private drawGrunts() {
    for (const gr of this.grunts) {
      if (gr.defeated) continue;
      const x = gr.col * IT + IT / 2, y = gr.row * IT + IT / 2;
      const g = this.add.graphics().setDepth(10);
      g.setPosition(x, y);
      drawNpcBody(g, 0x161616, { hair: 0x0a0a0a });
      g.setName(gr.key);
      this.add.text(x, y - 26, '노스단', { fontSize: '8px', color: '#c88', backgroundColor: '#00000088', padding: { x: 2, y: 1 } })
        .setOrigin(0.5).setDepth(11).setName(`${gr.key}__label`);
    }
  }

  private drawSandol() {
    if (this.registry.get('dolmoeRuinsDone')) return;
    const x = this.sandolCol * IT + IT / 2, y = this.sandolRow * IT + IT / 2;
    const g = this.add.graphics().setDepth(10);
    g.setPosition(x, y);
    drawNpcBody(g, 0x6a5030, { hair: 0x888888, skin: 0xe8c9a0 });
    markTrainerPortrait(g, 'dolmoe-sandol');
    this.add.text(x, y - 26, tr('LEADER SANDOL'), { fontSize: '8px', color: '#e8ddc8', backgroundColor: '#00000088', padding: { x: 2, y: 1 } })
      .setOrigin(0.5).setDepth(11).setName('__sandolLabel__');
  }

  private drawGuardian() {
    if (!this.textures.exists('daejangseung')) return;
    const img = this.add.image(this.digCol * IT, (this.digRow - 1.2) * IT, 'daejangseung')
      .setDepth(9)
      // A flat relief with a fixed world yaw can show its side/back as the
      // camera moves. Keep the guardian's front turned toward the player.
      .setData('facePlayer3D', true);
    const src = this.textures.get('daejangseung').getSourceImage();
    const dim = Math.max((src.width as number) || 1, (src.height as number) || 1);
    img.setScale((IT * 2.4) / dim);
    this.tweens.add({ targets: img, y: (this.digRow - 1.6) * IT, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.guardianImg = img;
  }

  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.redrawPlayer(); }
  private redrawPlayer() { drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry)); this.playerG.setPosition(this.px, this.py); }

  private setupInput() {
    this.cursors  = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
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
      const spd = this.shiftKey.isDown && this.registry.get('hasRunningShoes') ? this.RUN : this.SPEED;
      const nx = this.px + (dx / len) * spd * dt, ny = this.py + (dy / len) * spd * dt;
      if (!this.blocked(nx, this.py)) this.px = nx;
      if (!this.blocked(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > 170) { this.walkFrame ^= 1; this.walkTimer = 0; }
    } else { this.walkFrame = 0; }
    this.redrawPlayer();

    this.checkGrunts();
    this.checkGuardian();
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.tryTalk();
    this.checkExit();
  }

  private blocked(x: number, y: number): boolean {
    const hw = 7;
    return [[x-hw,y-2],[x+hw,y-2],[x-hw,y+10],[x+hw,y+10]].some(([cx, cy]) => {
      const col = Math.floor(cx / IT), row = Math.floor(cy / IT);
      if (col < 0 || col >= this.W || row < 0 || row >= this.H) return true;
      return SOLID.has(this.map[row][col]);
    });
  }

  // ── 노스단 dig crew ─────────────────────────────────────────────────────────
  private checkGrunts() {
    if (!this.registry.get('dolmoeRuinsSeen')) return;
    if (this.registry.get('dolmoeGuardianWoke')) return;
    for (const gr of this.grunts) {
      if (!gr.defeated && !!this.registry.get(`trainerDefeated_${gr.key}`)) {
        gr.defeated = true;
        this.children.getByName(gr.key)?.destroy();
        this.children.getByName(`${gr.key}__label`)?.destroy();
      }
    }
    if (this.grunts.every(g => g.defeated)) { this.wakeGuardian(); return; }
    for (const gr of this.grunts) {
      if (gr.defeated) continue;
      const tx = gr.col * IT + IT / 2, ty = gr.row * IT + IT / 2;
      if (Math.hypot(this.px - tx, this.py - ty) < IT * 1.4) {
        this.cutsceneActive = true;
        this.dialog.show([gr.line, `${gr.name}: Off the dig — now!`], () => {
          this.registry.set('trainerName',        gr.name);
          this.registry.set('trainerKey',         gr.key);
          this.registry.set('trainerPokemon',     JSON.stringify(gr.pokemon));
          this.registry.set('trainerExpPool',     gr.expPool);
          this.registry.set('trainerReturnScene', 'DolmoeRuinsScene');
          this.registry.set('ruinsPosX', this.px); this.registry.set('ruinsPosY', this.py);
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  private wakeGuardian() {
    if (this.registry.get('dolmoeGuardianWoke')) return;
    this.registry.set('dolmoeGuardianWoke', true);
    this.cutsceneActive = true;
    this.cameras.main.shake(500, 0.008);
    this.drawGuardian();
    this.dialog.show([
      'The 노스단 crew scatter — but their crowbars have already done the harm.',
      'The great sealed capstone splits with a groan like the mountain waking...',
      'From the broken dolmen rises 대장승 Daejangseung — a towering guardian-totem of the ancestors, eyes blazing, furious at the desecration.',
      "Sandol: ...So that's what they woke. The stone-elder that watches the dead. It won't know friend from robber — not while it rages.",
      "Sandol: You've the arm to fight. Settle it — soothe the elder, or take it with you. Either way, calm the ancestors' rest.",
    ], () => { this.cutsceneActive = false; });
  }

  // ── The guardian: a catchable wild battle at the broken dolmen ──────────────
  private checkGuardian() {
    if (!this.registry.get('dolmoeGuardianWoke')) return;
    if (this.registry.get('dolmoeGuardianBeaten')) return;
    const gx = this.digCol * IT + IT / 2, gy = this.digRow * IT + IT / 2;
    if (Math.hypot(this.px - gx, this.py - gy) < IT * 2.2 && !this.cutsceneActive) {
      this.cutsceneActive = true;
      this.dialog.show([
        '대장승 Daejangseung looms over the shattered dolmen, radiating ancient wrath.',
        'Daejangseung: (It fixes its blazing gaze on you — soothe it in battle, or catch it with a Poké Ball!)',
      ], () => {
        this.registry.set('wildId', 'daejangseung');
        this.registry.set('wildLevel', 45);
        this.registry.set('wildCustom', true);
        this.registry.set('wildCatchRate', 50);
        this.registry.set('wildReturnScene', 'DolmoeRuinsScene');
        this.registry.set('dolmoeGuardianActive', true);
        this.registry.set('ruinsPosX', (this.digCol + 3) * IT); this.registry.set('ruinsPosY', this.digRow * IT + IT / 2);
        this.cameras.main.fadeOut(600, 20, 20, 30, () => this.scene.start('WildBattleScene'));
      });
    }
  }

  private resolveEvent() {
    this.cutsceneActive = true;
    this.guardianImg?.destroy();
    const caught = PartySystem.get(this.registry).some(p => p.spriteKey === 'daejangseung')
      || PartySystem.getBox(this.registry).some(p => p.spriteKey === 'daejangseung');
    const lines = caught
      ? [
          'The totem-elder lowers its gaze — and chooses to walk the road at your side. The ruins fall quiet.',
          "Sandol: Hah. The ancestors' own watchman, and it goes with YOU. The stones don't grant that lightly.",
        ]
      : [
          'Spent and settled, 대장승 Daejangseung sinks back into the mended dolmen, its wrath eased. The ruins fall quiet.',
          "Sandol: Didn't crack, didn't run. You stood in front of a woken god and held. That's bedrock.",
        ];
    lines.push('Sandol: The 노스단 will answer for this another day. The ancestors rest — thanks to you.');
    lines.push('Sandol: Come to the Quarry when you\'re ready. A challenger who guards the old stones has earned my full attention.');
    lines.push('You received ₩4,000 and an Elixir ×2!');

    this.registry.set('dolmoeRuinsDone', true);
    this.children.getByName('__sandolLabel__')?.destroy();
    Inventory.addMoney(this.registry, 4000);
    Inventory.add(this.registry, 'elixir', 2);
    this.dialog.show(lines, () => { this.cutsceneActive = false; });
  }

  private intro() {
    this.registry.set('dolmoeRuinsSeen', true);
    this.dialog.show([
      '(You cross into the great dolmen field. 노스단 machinery whines against a sealed capstone deep to the west — and Leader Sandol stands square in its way.)',
      "Sandol: Challenger. Bad time. These crows are trying to crack open a grave the ancestors sealed for a reason.",
      "Sandol: I can hold the slab or I can hold them. Not both. So — you drive the diggers off, I keep the stone from breaking.",
      "Sandol: The Bedrock Badge waits at the Quarry. Earn this first: protect the old stones.",
    ], () => { this.cutsceneActive = false; });
  }

  private tryTalk() {
    const sx = this.sandolCol * IT + IT / 2, sy = this.sandolRow * IT + IT / 2;
    if (Math.hypot(this.px - sx, this.py - sy) > IT * 1.6) return;
    if (this.registry.get('dolmoeRuinsDone')) return;
    this.cutsceneActive = true;
    if (this.registry.get('dolmoeGuardianWoke')) {
      this.dialog.show(["Sandol: Face the elder at the broken slab. Soothe it or catch it — just end its rage."], () => { this.cutsceneActive = false; });
    } else {
      this.dialog.show(["Sandol: Two diggers left on the field. Drive them off — I'll hold the stone."], () => { this.cutsceneActive = false; });
    }
  }

  private checkExit() {
    if (this.px > (this.W - 1) * IT && this.py > 8.5 * IT && this.py < 12.5 * IT && !this.cutsceneActive) {
      this.registry.set('dolmoeReturnX', 2 * 32 + 16);   // back at Dolmoe's west gate
      this.registry.set('dolmoeReturnY', 11 * 32 + 16);
      this.cameras.main.fadeOut(300, 0, 0, 0, () => this.scene.start('DolmoeCityScene'));
    }
  }

  static healParty(scene: Phaser.Scene) { PartySystem.healAll(scene.registry); }
}
