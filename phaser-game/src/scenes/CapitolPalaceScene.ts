import { BaseInteriorScene, NPC } from './interior/BaseInteriorScene';
import { tr, speakerName } from '../systems/i18n';

export class CapitolPalaceScene extends BaseInteriorScene {
  protected readonly COLS = 18; protected readonly ROWS = 14;
  constructor() { super({ key: 'CapitolPalaceScene' }); }

  protected drawRoom() {
    const g = this.add.graphics().setDepth(0);
    // Pale marble hall with a dark stone skirting; extrudes into a grand 3D throne room.
    this.drawFloor(g, 0, 0, this.COLS - 1, this.ROWS - 1, 0x6b4a1c);   // wall skirting band
    this.drawFloor(g, 1, 1, this.COLS - 2, this.ROWS - 2, 0xe6c98a);   // pale marble floor
    // Royal red carpet runner from the door up to the throne dais.
    this.drawFloor(g, 8, 4, 9, this.ROWS - 2, 0x9a2b2b);
    this.drawFloor(g, 7, 4, 10, 4, 0x7a2020);   // carpet head under the dais

    // ── Grand throne dais (three stacked tiers → a stepped pyramid in 3D) ──
    this.drawRect(g, 5, 1, 8, 3, 0xb98a3a, 0x8a6420);   // wide base tier
    this.drawRect(g, 6, 1, 6, 2, 0xcfa24a, 0xa07c2c);   // middle tier
    this.drawRect(g, 8, 1, 2, 2, 0xd4af37, 0x9a7b1a);   // the golden throne
    this.label('👑 Ancient\nThrone', 8, 1, 9, '#fff0b0');
    this.addSolid(5, 1, 12, 3);

    // ── Colonnade — matched pillars marching down both sides of the aisle ──
    for (const r of [3, 5, 7, 9, 11]) {
      this.drawRect(g, 3, r, 1, 1, 0xd8cba0, 0x9a8a66);
      this.drawRect(g, 14, r, 1, 1, 0xd8cba0, 0x9a8a66);
      this.addSolid(3, r, 3, r); this.addSolid(14, r, 14, r);
    }

    // ── Wall banners flanking the tall arched windows ──
    this.drawRect(g, 2, 0, 1, 1, 0x8a2b2b, 0x5a1a1a);
    this.drawRect(g, 15, 0, 1, 1, 0x8a2b2b, 0x5a1a1a);
    this.drawRect(g, 4, 0, 2, 1, 0x9fd8ff, 0xffffff);
    this.drawRect(g, 12, 0, 2, 1, 0x9fd8ff, 0xffffff);

    // Relic plinths.
    this.drawRect(g, 5, 7, 2, 2, 0xcc9933, 0xaa7722);
    this.label('Ancient\nArtifact', 5, 7, 8, '#ffe44e');
    this.drawRect(g, 11, 7, 2, 2, 0xcc9933, 0xaa7722);
    this.label('Royal\nSword', 11, 7, 8, '#ffe44e');
    this.addSolid(5, 7, 6, 8); this.addSolid(11, 7, 12, 8);

    // Door
    const dp = this.tile(8, this.ROWS - 1);
    g.fillStyle(0x6b4a1c); g.fillRect(dp.x + 4, dp.y, 64, 32);

    // Walls
    this.addSolid(0, 0, this.COLS - 1, 0);
    this.addSolid(0, 0, 0, this.ROWS - 1);
    this.addSolid(this.COLS - 1, 0, this.COLS - 1, this.ROWS - 1);
    this.addSolid(0, this.ROWS - 1, 7, this.ROWS - 1);
    this.addSolid(10, this.ROWS - 1, this.COLS - 1, this.ROWS - 1);
  }

  protected setupNPCs() {
    const guard = this.createNPCGraphic(8, 4, 0x336622, 0x111100, false, 0);
    this.add.text(this.tile(8, 4).x + 16, this.tile(8, 4).y - 6, tr('Palace Guard'),
      { fontSize: '9px', color: '#ffe44e', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }
    ).setOrigin(0.5, 1).setDepth(16);
    this.npcs.push(guard);

    const curator = this.createNPCGraphic(4, 9, 0x886622, 0x332200, true, 3);
    this.add.text(this.tile(4, 9).x + 16, this.tile(4, 9).y - 6, speakerName('Curator'),
      { fontSize: '9px', color: '#ffe44e', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }
    ).setOrigin(0.5, 1).setDepth(16);
    this.npcs.push(curator);
  }

  protected placePlayer() { this.createPlayerGraphic(8, 12); }

  protected onInteract(npc: NPC) {
    if (npc.facing === 0) {
      this.dialog.show([
        'Guard: This is the Ancient Palace, 600 years of history.',
        'Guard: The original rulers once walked these halls.',
        'Guard: They say their spirits still watch over the city.',
      ]);
    } else {
      this.dialog.show([
        'Curator: Welcome to the Capitol Palace Museum!',
        'Curator: That artifact was used by the first city founder.',
        'Curator: And that sword? It slayed a shadow beast long ago...',
        'Curator: Perhaps that is why dark-type Pokémon are so common here.',
      ]);
    }
  }

  protected checkExit() {
    const { y } = this.tile(8, this.ROWS - 1);
    if (this.py > y + 20) {
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('CapitolCityScene'));
    }
  }
  protected exitToWorld() {
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('CapitolCityScene'));
  }
}
