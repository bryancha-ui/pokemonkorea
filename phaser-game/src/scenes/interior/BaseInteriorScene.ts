import Phaser from 'phaser';
import { tr } from '../../systems/i18n';
import { DialogBox } from '../../ui/DialogBox';
import { drawTrainerBody, markProceduralCharacter3D, playerDesign } from '../../data/CharacterSprite';
import { playBgm } from '../../systems/Music';

const IT = 32; // interior tile size

export interface NPC {
  x: number; y: number;
  /** Optional point the player approaches when the NPC stands behind a desk. */
  interactX?: number; interactY?: number;
  interactRadius?: number;
  graphic: Phaser.GameObjects.Graphics;
  bodyColor: number;
  hairColor: number;
  isFemale: boolean;
  facing: number; // 0=down 1=up 2=left 3=right
}

export abstract class BaseInteriorScene extends Phaser.Scene {
  protected dialog!: DialogBox;
  protected playerG!: Phaser.GameObjects.Graphics;
  protected npcs: NPC[] = [];
  protected px = 0; protected py = 0;
  protected cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  protected spaceKey!: Phaser.Input.Keyboard.Key;
  protected enterKey!: Phaser.Input.Keyboard.Key;
  protected upKey!: Phaser.Input.Keyboard.Key;
  protected downKey!: Phaser.Input.Keyboard.Key;
  protected interactPrompt!: Phaser.GameObjects.Text;
  protected returnSceneKey = 'WorldMapScene';
  protected exiting = false;

  // Room grid: 16 cols × 13 rows drawn at origin (offsetX, offsetY)
  protected COLS = 16;
  protected ROWS = 13;
  protected offsetX = 0;
  protected offsetY = 0;

  // Walls: rows/cols that block movement
  protected solidRects: { x1: number; y1: number; x2: number; y2: number }[] = [];

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Optional interior music key (e.g. 'center', 'mart'); subclasses set it. */
  protected bgmKey?: string;

  create() {
    this.exiting = false;
    // Phaser reuses Scene instances. Rebuild collision/NPC state from scratch
    // on every entry so stale invisible hitboxes cannot survive a prior visit.
    this.solidRects = [];
    this.npcs = [];
    this.offsetX = (this.scale.width  - this.COLS * IT) / 2;
    this.offsetY = (this.scale.height - this.ROWS * IT) / 2;

    if (this.bgmKey) playBgm(this, this.bgmKey);
    this.drawRoom();
    this.setupNPCs();
    this.placePlayer();
    this.createUI();
    this.setupInput();

    this.cameras.main.fadeIn(300);
  }

  update() {
    if (this.exiting) return;
    if (this.scene.isActive('MenuScene')) return;   // frozen while the party/bag menu is open
    if (this.dialog.isOpen()) {
      this.handleDialogInput();
      return;
    }
    this.movePlayer();
    this.checkProximity();
    this.checkExit();
  }

  // ── Abstract hooks ────────────────────────────────────────────────────────

  protected abstract drawRoom(): void;
  protected abstract setupNPCs(): void;
  protected abstract placePlayer(): void;
  protected abstract onInteract(npc: NPC): void;
  protected abstract checkExit(): void;

  // ── Input ─────────────────────────────────────────────────────────────────

  protected setupInput() {
    this.cursors  = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.upKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey  = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    // Open the party/bag menu (to check Pokémon status) from inside any interior —
    // e.g. the Pokémon Center. Mirrors the overworld M/B shortcut (the mobile menu
    // button dispatches M too).
    const openMenu = () => {
      if (!this.exiting && !this.dialog.isOpen() && !this.scene.isActive('MenuScene')) {
        this.scene.launch('MenuScene');
      }
    };
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', openMenu);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', openMenu);
  }

  private handleDialogInput() {
    const advancePressed = Phaser.Input.Keyboard.JustDown(this.spaceKey)
      || Phaser.Input.Keyboard.JustDown(this.enterKey);
    if (this.dialog.isInChoice()) {
      if (Phaser.Input.Keyboard.JustDown(this.upKey))    this.dialog.navigateChoice(-1);
      if (Phaser.Input.Keyboard.JustDown(this.downKey))  this.dialog.navigateChoice(1);
      if (advancePressed) this.dialog.confirmChoice();
    } else {
      if (advancePressed) this.dialog.advance();
    }
  }

  // ── Player movement ───────────────────────────────────────────────────────

  private movePlayer() {
    const SPEED = 90;
    const dt = this.game.loop.delta / 1000;
    let dx = 0, dy = 0;

    if (this.cursors.left.isDown  || this.input.keyboard!.checkDown(this.input.keyboard!.addKey('A'))) dx = -1;
    if (this.cursors.right.isDown || this.input.keyboard!.checkDown(this.input.keyboard!.addKey('D'))) dx =  1;
    if (this.cursors.up.isDown    || this.input.keyboard!.checkDown(this.input.keyboard!.addKey('W'))) dy = -1;
    if (this.cursors.down.isDown  || this.input.keyboard!.checkDown(this.input.keyboard!.addKey('S'))) dy =  1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = this.px + (dx / len) * SPEED * dt;
      const ny = this.py + (dy / len) * SPEED * dt;

      if (!this.collidesAt(nx, this.py)) this.px = nx;
      if (!this.collidesAt(this.px, ny)) this.py = ny;
    }

    this.playerG.setPosition(this.px, this.py);
  }

  protected collidesAt(x: number, y: number): boolean {
    const hw = 7, hh = 6;
    for (const r of this.solidRects) {
      if (x - hw < r.x2 && x + hw > r.x1 && y - hh < r.y2 && y + hh > r.y1) return true;
    }
    return false;
  }

  // ── NPC proximity ─────────────────────────────────────────────────────────

  private checkProximity() {
    let nearest: NPC | null = null;
    let nearestDist = Infinity;

    for (const npc of this.npcs) {
      const tx = npc.interactX ?? npc.x;
      const ty = npc.interactY ?? npc.y;
      const d = Math.hypot(this.px - tx, this.py - ty);
      if (d < (npc.interactRadius ?? 52) && d < nearestDist) {
        nearest = npc;
        nearestDist = d;
      }
    }

    if (nearest) {
      this.interactPrompt.setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)
        || Phaser.Input.Keyboard.JustDown(this.enterKey)) this.onInteract(nearest);
    } else {
      this.interactPrompt.setVisible(false);
    }
  }

  // ── Drawing helpers ───────────────────────────────────────────────────────

  protected tile(col: number, row: number) {
    return { x: this.offsetX + col * IT, y: this.offsetY + row * IT };
  }

  protected addSolid(col1: number, row1: number, col2: number, row2: number) {
    const p1 = this.tile(col1, row1), p2 = this.tile(col2 + 1, row2 + 1);
    this.solidRects.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
  }

  protected drawFloor(g: Phaser.GameObjects.Graphics, col1: number, row1: number, col2: number, row2: number, color: number) {
    const p = this.tile(col1, row1);
    g.fillStyle(color, 1);
    g.fillRect(p.x, p.y, (col2 - col1 + 1) * IT, (row2 - row1 + 1) * IT);
  }

  protected drawRect(g: Phaser.GameObjects.Graphics, col: number, row: number, w: number, h: number, fill: number, stroke?: number) {
    const p = this.tile(col, row);
    g.fillStyle(fill, 1);
    g.fillRect(p.x, p.y, w * IT, h * IT);
    if (stroke !== undefined) {
      g.lineStyle(2, stroke, 1);
      g.strokeRect(p.x, p.y, w * IT, h * IT);
    }
  }

  protected label(text: string, col: number, row: number, size = 10, color = '#ffffff') {
    const p = this.tile(col, row);
    this.add.text(p.x + IT / 2, p.y + IT / 2, text, { fontSize: `${size}px`, color })
      .setOrigin(0.5).setDepth(10);
  }

  // Draw an NPC character sprite
  protected createNPCGraphic(
    col: number, row: number, bodyColor: number, hairColor: number,
    isFemale: boolean, facing = 0, model3DKey?: string,
  ): NPC {
    const p = this.tile(col, row);
    const x = p.x + IT / 2, y = p.y + IT / 2;
    const g = this.add.graphics().setDepth(15);
    const npc: NPC = { x, y, graphic: g, bodyColor, hairColor, isFemale, facing };
    this.drawNPCAt(g, 0, 0, bodyColor, hairColor, isFemale, facing);
    markProceduralCharacter3D(g, {
      outfit: bodyColor,
      hair: hairColor,
      skin: 0xffcc99,
      gender: isFemale ? 'girl' : 'boy',
      footY: 12,
      outfitStyle: isFemale ? 'uniform' : 'trainer',
      hairStyle: isFemale ? 'long' : 'short',
    });
    // A named profile replaces the generated palette while retaining the same
    // 2D Graphics object as the gameplay/F3 fallback and interaction source.
    if (model3DKey) g.setData('characterModel3DKey', model3DKey);
    g.setPosition(x, y);
    return npc;
  }

  private drawNPCAt(g: Phaser.GameObjects.Graphics, x: number, y: number,
    bodyColor: number, hairColor: number, isFemale: boolean, facing: number) {
    // Shadow
    g.fillStyle(0x000000, 0.2); g.fillEllipse(x, y + 12, 16, 5);
    // Skirt/pants
    g.fillStyle(isFemale ? 0xdd88aa : 0x223366, 1);
    g.fillRect(x - 7, y + 2, 14, isFemale ? 9 : 8);
    // Body
    g.fillStyle(bodyColor, 1); g.fillRect(x - 7, y - 8, 14, 11);
    // Arms
    g.fillStyle(bodyColor, 1); g.fillRect(x - 11, y - 7, 4, 8); g.fillRect(x + 7, y - 7, 4, 8);
    // Neck
    g.fillStyle(0xffcc99, 1); g.fillRect(x - 3, y - 11, 6, 4);
    // Head
    g.fillStyle(0xffcc99, 1); g.fillRect(x - 7, y - 23, 14, 13);
    // Hair
    g.fillStyle(hairColor, 1); g.fillRect(x - 7, y - 23, 14, 5);
    if (isFemale) { g.fillRect(x - 7, y - 18, 3, 8); g.fillRect(x + 4, y - 18, 3, 8); } // pigtails
    // Eyes
    if (facing !== 1) {
      g.fillStyle(0x000000, 1);
      if (facing === 0) { g.fillRect(x - 4, y - 16, 2, 2); g.fillRect(x + 2, y - 16, 2, 2); }
      else if (facing === 2) g.fillRect(x - 5, y - 16, 2, 2);
      else                   g.fillRect(x + 3, y - 16, 2, 2);
    }
  }

  protected createPlayerGraphic(col: number, row: number): void {
    const p = this.tile(col, row);
    this.px = p.x + IT / 2;
    this.py = p.y + IT / 2;
    this.playerG = this.add.graphics().setDepth(20);
    this.redrawPlayer();
  }

  protected redrawPlayer() {
    const g = this.playerG;
    g.clear();
    // Gender-aware body so a girl doesn't turn into the default red-shirt sprite indoors.
    drawTrainerBody(g, 0, 0, playerDesign(this.registry));
    g.setPosition(this.px, this.py);
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  private createUI() {
    this.dialog = new DialogBox(this, 1280, 720);

    this.interactPrompt = this.add.text(400, 8, tr('SPACE  to talk'), {
      fontSize: '13px', color: '#ffe44e', backgroundColor: '#00000099',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(210).setVisible(false);
  }

  // ── Scene exit ────────────────────────────────────────────────────────────

  protected exitToWorld() {
    if (this.exiting) return;
    this.exiting = true;
    this.cameras.main.fadeOut(400, 0, 0, 0, () => {
      this.scene.start(this.returnSceneKey);
    });
  }
}
