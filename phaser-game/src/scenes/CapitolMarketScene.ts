import { BaseInteriorScene, NPC } from './interior/BaseInteriorScene';
import { speakerName } from '../systems/i18n';

export class CapitolMarketScene extends BaseInteriorScene {
  protected readonly COLS = 14; protected readonly ROWS = 11;
  protected bgmKey = 'mart';
  constructor() { super({ key: 'CapitolMarketScene' }); }

  protected drawRoom() {
    const g = this.add.graphics().setDepth(0);
    this.drawFloor(g, 0, 0, this.COLS - 1, this.ROWS - 1, 0x5a3a1a);
    this.drawFloor(g, 1, 1, this.COLS - 2, this.ROWS - 2, 0xf5e6cc);

    // Market stalls
    this.drawRect(g, 1, 1, 4, 3, 0xee8833, 0xcc6611);
    this.label('Potions\n💊', 1, 1, 9, '#fff');
    this.drawRect(g, 7, 1, 4, 3, 0x33cc55, 0x229944);
    this.label('Berries\n🫐', 7, 1, 9, '#fff');
    this.drawRect(g, 1, 6, 4, 3, 0x3388ee, 0x2266cc);
    this.label('TMs\n📀', 1, 6, 9, '#fff');
    this.drawRect(g, 7, 6, 4, 3, 0xee4433, 0xcc2211);
    this.label('Pokéballs\n🔴', 7, 6, 9, '#fff');
    this.addSolid(1,1,4,3); this.addSolid(7,1,10,3);
    this.addSolid(1,6,4,8); this.addSolid(7,6,10,8);

    const dp = this.tile(6, this.ROWS - 1);
    g.fillStyle(0x8b6020); g.fillRect(dp.x + 4, dp.y, 32, 32);
    this.addSolid(0, 0, this.COLS - 1, 0);
    this.addSolid(0, 0, 0, this.ROWS - 1);
    this.addSolid(this.COLS - 1, 0, this.COLS - 1, this.ROWS - 1);
    this.addSolid(0, this.ROWS - 1, 5, this.ROWS - 1);
    this.addSolid(7, this.ROWS - 1, this.COLS - 1, this.ROWS - 1);
  }

  protected setupNPCs() {
    const merchant = this.createNPCGraphic(5, 4, 0xee8833, 0x3a2200, false, 0);
    this.add.text(this.tile(5,4).x+16, this.tile(5,4).y-6, speakerName('Merchant'),
      { fontSize: '9px', color: '#ffe44e', backgroundColor: '#00000088', padding: { x:3,y:1 } }
    ).setOrigin(0.5,1).setDepth(16);
    this.npcs.push(merchant);
  }

  protected placePlayer() { this.createPlayerGraphic(6, 9); }
  protected onInteract(_npc: NPC) {
    this.dialog.show([
      'Merchant: Welcome to the Capitol Central Market!',
      'Merchant: Best items in the whole city, right here.',
    ], () => {
      this.scene.launch('ShopScene', { parentKey: this.scene.key });
      this.scene.pause();
    });
  }
  protected checkExit() {
    const { y } = this.tile(6, this.ROWS - 1);
    if (this.py > y + 20) {
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('CapitolCityScene'));
    }
  }
  protected exitToWorld() {
    this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('CapitolCityScene'));
  }
}
