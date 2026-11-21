// SeoulScene is now an alias — it immediately starts CapitolCityScene.
import Phaser from 'phaser';
export class SeoulScene extends Phaser.Scene {
  constructor() { super('SeoulScene'); }
  create() {
    // Old saves can still resume through this alias. Paint a capital-coloured
    // hand-off frame so no black flash is visible before the real scene starts.
    this.cameras.main.setBackgroundColor(0x9a9a8a);
    this.scene.start('CapitolCityScene');
  }
}
