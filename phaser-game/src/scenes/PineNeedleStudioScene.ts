import Phaser from 'phaser';
import { BaseInteriorScene, NPC } from './interior/BaseInteriorScene';
import { tr } from '../systems/i18n';
import { Inventory } from '../systems/Items';

const SMEARGLE_TEXTURE = 'studio-smeargle';
const SMEARGLE_ART = 'assets/pokemon-official/235.png';

type StudioNPC = NPC & {
  isSmeargle?: boolean;
  creatureImage?: Phaser.GameObjects.Image;
  nameLabel?: Phaser.GameObjects.Text;
};

/**
 * Pine Needle Town — Artist's Studio.
 * Hosts the "Missing Smeargle" side quest.
 *   Stage 0: talk to artist → quest given.
 *   Stage 1: find Smeargle (sitting by the garden window) → it follows you.
 *   Stage 2: talk to artist again → reward (TM Calm Mind + Highland Map).
 */
export class PineNeedleStudioScene extends BaseInteriorScene {
  // This is a playable 3D diorama, not a flat cutscene room. The explicit flag
  // makes the 3D engine select it from the first setup frame.
  public interior3D = true;
  protected readonly COLS = 16;
  protected readonly ROWS = 12;

  constructor() { super({ key: 'PineNeedleStudioScene' }); }

  preload() {
    if (!this.textures.exists(SMEARGLE_TEXTURE)) {
      this.load.image(SMEARGLE_TEXTURE, SMEARGLE_ART);
    }
  }

  protected drawRoom() {
    const g = this.add.graphics().setDepth(0);
    this.drawFloor(g, 0, 0, this.COLS - 1, this.ROWS - 1, 0x5a4030);     // wood walls
    this.drawFloor(g, 1, 1, this.COLS - 2, this.ROWS - 2, 0xefe6d2);     // hanji floor

    // Ink paintings on the wall (top)
    for (let c = 2; c < 14; c += 3) {
      this.drawRect(g, c, 1, 2, 1, 0xf8f4e8, 0x333333);
      this.label('🖌️', c, 1, 12);
    }
    // Easel + paint table (left)
    this.drawRect(g, 2, 4, 2, 2, 0x8a6a40, 0x5a4020);
    this.label('🎨', 2, 4, 14);
    this.addSolid(2, 4, 3, 5);
    // Paper drying racks (right)
    this.drawRect(g, 12, 4, 2, 3, 0xd8c8a0, 0xb0a080);
    this.label('📜', 12, 4, 14);
    this.addSolid(12, 4, 13, 6);
    // Garden window (bottom-right) where Smeargle appears
    this.drawRect(g, 11, 8, 3, 2, 0x88cc66, 0x66aa44);
    this.label('🪟', 11, 8, 14);

    // Door (bottom-centre)
    const dp = this.tile(7, this.ROWS - 1);
    g.fillStyle(0x8b5a2b); g.fillRect(dp.x + 4, dp.y, 64, 32);

    // Walls
    this.addSolid(0, 0, this.COLS - 1, 0);
    this.addSolid(0, 0, 0, this.ROWS - 1);
    this.addSolid(this.COLS - 1, 0, this.COLS - 1, this.ROWS - 1);
    this.addSolid(0, this.ROWS - 1, 6, this.ROWS - 1);
    this.addSolid(9, this.ROWS - 1, this.COLS - 1, this.ROWS - 1);
  }

  protected setupNPCs() {
    // The artist (female, ink-stained apron)
    const artist = this.createNPCGraphic(6, 4, 0x556699, 0x222222, true, 0);
    this.add.text(this.tile(6, 4).x + 16, this.tile(6, 4).y - 6, tr('Artist Sora'), {
      fontSize: '9px', color: '#ffe44e', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1).setDepth(16);
    this.npcs.push(artist);

    // Smeargle appears by the garden window once the quest is active and not yet found
    const questActive = !!this.registry.get('smeargleQuest');
    const found       = !!this.registry.get('smeargleFound');
    if (questActive && !found) this.spawnSmeargle();
  }

  /** Add Smeargle to the live room without restarting (and dropping) the 3D scene. */
  private spawnSmeargle() {
    if (this.registry.get('smeargleFound')) return;
    if (this.npcs.some(n => (n as StudioNPC).isSmeargle && n.x > -1000)) return;

    const p = this.tile(12, 9);
    const x = p.x + 16, y = p.y + 16;
    let sme: StudioNPC;
    if (this.textures.exists(SMEARGLE_TEXTURE)) {
      // The real species artwork becomes an upright 3D creature relief in
      // OverworldMirror; the invisible marker keeps the existing quest
      // proximity/interaction system unchanged.
      const marker = this.add.graphics().setPosition(x, y);
      const creatureImage = this.add.image(x, y, SMEARGLE_TEXTURE).setDepth(15);
      const src = this.textures.get(SMEARGLE_TEXTURE).getSourceImage();
      const dim = Math.max((src.width as number) || 1, (src.height as number) || 1);
      creatureImage.setScale(52 / dim);
      sme = {
        x, y, graphic: marker, bodyColor: 0xe8d8b8, hairColor: 0x8a5a2a,
        isFemale: false, facing: 1, isSmeargle: true, creatureImage,
      };
    } else {
      // Network-safe fallback: the quest remains playable if remote art fails.
      sme = this.createNPCGraphic(12, 9, 0xe8d8b8, 0x8a5a2a, false, 1) as StudioNPC;
      sme.isSmeargle = true;
    }
    sme.nameLabel = this.add.text(x, p.y - 6, tr('Smeargle?'), {
      fontSize: '9px', color: '#fff', backgroundColor: '#00000099', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1).setDepth(16);
    this.npcs.push(sme);
  }

  protected placePlayer() { this.createPlayerGraphic(7, 10); }

  protected onInteract(npc: NPC) {
    const studioNpc = npc as StudioNPC;
    const isSmeargle = studioNpc.isSmeargle;
    const questActive = !!this.registry.get('smeargleQuest');
    const found       = !!this.registry.get('smeargleFound');
    const done        = !!this.registry.get('smeargleQuestDone');

    if (isSmeargle) {
      this.registry.set('smeargleFound', true);
      this.dialog.show([
        'A Smeargle is curled by the garden window, clutching an ink brush!',
        'Smeargle: Smear~ ♪',
        "It recognizes the studio's scent and happily follows you inside.",
        'Take it back to Artist Sora!',
      ], () => {
        // Remove the Smeargle sprite so it doesn't linger
        studioNpc.creatureImage?.destroy();
        studioNpc.nameLabel?.destroy();
        npc.graphic.destroy();
        npc.x = -9999; npc.y = -9999;
      });
      return;
    }

    // Artist dialogue
    if (done) {
      this.dialog.show([
        'Artist Sora: Thanks to you, my brush is back. The highland map should help your journey north!',
      ]);
    } else if (found) {
      // Complete the quest
      this.registry.set('smeargleQuestDone', true);
      this.registry.set('hasHighlandMap', true);
      this.registry.set('hasTM_CalmMind', true);
      Inventory.add(this.registry, 'tm_calmmind', 1);   // add the TM to the bag
      this.dialog.show([
        'Artist Sora: My Smeargle! And my brush! Oh, thank you, thank you!',
        'Artist Sora: Please, take these — a TM for Calm Mind, and a hand-painted map of the highland region.',
        '📀 Received TM — Calm Mind!  (Check your Bag to teach it.)',
        '🗺️ Received the Highland Map!',
        'Artist Sora: One more thing... while searching, did you see those black markings near the northern pass?',
        'Artist Sora: They look like an ancient seal — but freshly disturbed. Be careful up there.',
      ]);
    } else if (questActive) {
      this.dialog.show([
        'Artist Sora: Have you found my Smeargle yet? Try looking near the garden window out back.',
      ]);
    } else {
      this.registry.set('smeargleQuest', true);
      this.dialog.show([
        'Artist Sora: Oh! A traveler! Could you help me?',
        'Artist Sora: My Smeargle wandered off carrying my most precious ink brush.',
        'Artist Sora: I last heard it chittering out by the garden window. Please, find it!',
        '(The Smeargle has appeared by the garden window — go talk to it!)',
      ], () => {
        // Keep the same 3D room/mirror alive and add Smeargle to it directly.
        this.spawnSmeargle();
      });
    }
  }

  protected checkExit() {
    const { y } = this.tile(7, this.ROWS - 1);
    if (this.py > y + 20) {
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('PineNeedleTownScene'));
    }
  }
  protected exitToWorld() {
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('PineNeedleTownScene'));
  }
}
