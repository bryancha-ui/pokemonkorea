import { BaseInteriorScene, NPC } from './interior/BaseInteriorScene';
import { tr, speakerName } from '../systems/i18n';

export class CapitolTowerScene extends BaseInteriorScene {
  protected readonly COLS = 16;
  protected readonly ROWS = 14;

  constructor() { super({ key: 'CapitolTowerScene' }); }

  protected drawRoom() {
    const g = this.add.graphics().setDepth(0);

    // Dark modern interior — observatory style
    this.drawFloor(g, 0, 0, this.COLS - 1, this.ROWS - 1, 0x1a2a3a);  // steel walls
    this.drawFloor(g, 1, 1, this.COLS - 2, this.ROWS - 2, 0x2a3a4a);  // dark floor

    // Floor pattern — polished tiles
    for (let r = 1; r < this.ROWS - 1; r += 2) {
      this.drawFloor(g, 1, r, this.COLS - 2, r, 0x253545);
    }

    // Panoramic windows (top wall)
    this.drawRect(g, 1, 0, this.COLS - 2, 1, 0x88ccff, 0x44aaee);
    const p = this.tile(1, 0);
    for (let c = 1; c < this.COLS - 1; c++) {
      const tp = this.tile(c, 0);
      g.lineStyle(2, 0x4488aa, 1);
      g.lineBetween(tp.x + 16, tp.y, tp.x + 16, tp.y + 32);
    }

    // Side windows
    this.drawRect(g, 0, 2, 1, 4, 0x88ccff, 0x44aaee);
    this.drawRect(g, 0, 7, 1, 4, 0x88ccff, 0x44aaee);
    this.drawRect(g, this.COLS - 1, 2, 1, 4, 0x88ccff, 0x44aaee);
    this.drawRect(g, this.COLS - 1, 7, 1, 4, 0x88ccff, 0x44aaee);

    // Telescope (top-center)
    this.drawRect(g, 7, 1, 2, 3, 0x446688, 0x335577);
    this.label('🔭', 7, 2, 20);
    this.addSolid(7, 1, 8, 3);

    // Observation railing
    this.drawRect(g, 1, 1, this.COLS - 2, 1, 0x445566, 0x334455);
    this.addSolid(1, 1, this.COLS - 2, 1);

    // Info displays (left and right)
    this.drawRect(g, 1, 3, 2, 3, 0x223344, 0x334455);
    this.label('CITY\nMAP', 1, 3, 8, '#88ccff');
    this.drawRect(g, this.COLS - 3, 3, 2, 3, 0x223344, 0x334455);
    this.label('STATS', this.COLS - 3, 3, 8, '#88ccff');
    this.addSolid(1, 3, 2, 5); this.addSolid(this.COLS - 3, 3, this.COLS - 2, 5);

    // Elevator (bottom-right)
    this.drawRect(g, this.COLS - 3, 9, 2, 3, 0x334455, 0x445566);
    this.label('🔼', this.COLS - 3, 9, 16);

    // Sofa area (center)
    this.drawRect(g, 5, 9, 2, 2, 0x334466, 0x445577);
    this.drawRect(g, 9, 9, 2, 2, 0x334466, 0x445577);

    // City view text (top)
    const tp = this.tile(8, 0);
    this.add.text(tp.x, tp.y - 20, tr('▶  City View — 563m above ground'), {
      fontSize: '8px', color: '#88ccff', backgroundColor: '#001122aa', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);

    // Door
    const dp = this.tile(7, this.ROWS - 1);
    g.fillStyle(0x336688); g.fillRect(dp.x + 4, dp.y, 64, 32);

    // Walls
    this.addSolid(0, 0, this.COLS - 1, 0);
    this.addSolid(0, 0, 0, this.ROWS - 1);
    this.addSolid(this.COLS - 1, 0, this.COLS - 1, this.ROWS - 1);
    this.addSolid(0, this.ROWS - 1, 6, this.ROWS - 1);
    this.addSolid(9, this.ROWS - 1, this.COLS - 1, this.ROWS - 1);
  }

  protected setupNPCs() {
    // Telescope NPC — looking at the city
    const observer = this.createNPCGraphic(8, 3, 0x336699, 0x112244, false, 1);
    this.add.text(
      this.tile(8, 3).x + 16,
      this.tile(8, 3).y - 6,
      speakerName('Observer Park'), {
        fontSize: '9px', color: '#88ccff', backgroundColor: '#00000088', padding: { x: 3, y: 1 },
      }
    ).setOrigin(0.5, 1).setDepth(16);
    this.npcs.push(observer);

    // Second NPC — historian
    const historian = this.createNPCGraphic(3, 10, 0x885522, 0x331100, true, 3);
    this.add.text(
      this.tile(3, 10).x + 16,
      this.tile(3, 10).y - 6,
      speakerName('Historian'), {
        fontSize: '9px', color: '#ffe44e', backgroundColor: '#00000088', padding: { x: 3, y: 1 },
      }
    ).setOrigin(0.5, 1).setDepth(16);
    this.npcs.push(historian);
  }

  protected placePlayer() { this.createPlayerGraphic(7, 12); }

  protected onInteract(npc: NPC) {
    if (npc.bodyColor === 0x336699) {
      // Observer NPC
      this.dialog.show([
        'Observer Park: Welcome to the top of Capitol Tower!',
        'Observer: From here you can see the entire city... look at all those lights.',
        'Observer: See that green patch to the north? That\'s the palace grounds.',
        'Observer: And to the south — Route 1 cutting through the mountains.',
        'Observer: Somewhere out there, the next great trainer is on their journey.',
        'Observer: Maybe that\'s you! 🌟',
      ]);
    } else {
      // Historian NPC
      this.dialog.show([
        'Historian: This tower stands 563 metres tall.',
        'Historian: It was built to celebrate the 600th year of the capital.',
        'Historian: The shadow beneath it? Some say it never quite disappears...',
        'Historian: ...perhaps because of the Gym Leader\'s dark-type Pokémon nearby. Ha!',
      ]);
    }
  }

  protected checkExit() {
    const { y } = this.tile(7, this.ROWS - 1);
    if (this.py > y + 20) this.exitToWorld();
  }

  protected exitToWorld() {
    this.cameras.main.fadeOut(400, 0, 0, 0, () => {
      this.scene.start('CapitolCityScene');
    });
  }
}
