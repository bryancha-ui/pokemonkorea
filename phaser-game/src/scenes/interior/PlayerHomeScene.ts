import Phaser from 'phaser';
import { BaseInteriorScene, NPC } from './BaseInteriorScene';
import { SaveManager } from '../../utils/SaveManager';

export class PlayerHomeScene extends BaseInteriorScene {
  private momTalked = false;

  constructor() { super({ key: 'PlayerHomeScene' }); }

  create() {
    super.create();
    if (!this.registry.get('trueEndingHomecomingPending')) return;

    // Consume and immediately persist the one-shot marker. This keeps reloads
    // at home without replaying the homecoming conversation forever.
    this.registry.remove('trueEndingHomecomingPending');
    SaveManager.save(this.registry, this.px, this.py, 'PlayerHomeScene');
    this.time.delayedCall(450, () => {
      this.dialog.show([
        'Mom: Welcome home, Champion. I watched the whole celebration — and I still cannot believe how far you went.',
        'Mom: 환웅 and all the others are safe, the region is at peace, and now you are finally back where your journey began.',
        'Mom: You have earned a long rest. Welcome home.',
      ]);
    });
  }

  protected drawRoom() {
    const g = this.add.graphics().setDepth(0);

    // Outer walls
    this.drawFloor(g, 0, 0, this.COLS - 1, this.ROWS - 1, 0x6b4f3a); // dark wood walls

    // Floor
    this.drawFloor(g, 1, 1, this.COLS - 2, this.ROWS - 2, 0xe8d5aa); // warm wooden floor

    // Floor planks pattern
    g.lineStyle(1, 0xd4bf96, 0.5);
    for (let r = 1; r < this.ROWS - 1; r++) {
      const p = this.tile(1, r);
      g.lineBetween(p.x, p.y, p.x + (this.COLS - 2) * 32, p.y);
    }

    // ── Door (bottom center, rows 12, cols 7-8) ──
    this.drawRect(g, 7, 12, 2, 1, 0x8b6914, 0x4a3a0a); // door mat

    // ── Windows (top wall) ──
    this.drawRect(g, 3, 0, 2, 1, 0x88ccff, 0xffffff);
    this.drawRect(g, 11, 0, 2, 1, 0x88ccff, 0xffffff);

    // ── TV + stand (left side) ──
    this.drawRect(g, 1, 2, 3, 2, 0x333333, 0x111111);
    this.label('TV', 2, 2, 12, '#44aaff');
    this.drawRect(g, 1, 4, 3, 1, 0x5a4030, 0x3a2a20);
    this.addSolid(1, 2, 3, 4);

    // ── Bookshelf (right side) ──
    this.drawRect(g, 12, 2, 3, 3, 0x7a5030, 0x5a3a1a);
    // Books
    const bookColors = [0xcc2222, 0x2255cc, 0x22aa44, 0xddaa22, 0xaa22cc];
    for (let i = 0; i < 5; i++) {
      const bp = this.tile(12, 2);
      g.fillStyle(bookColors[i], 1);
      g.fillRect(bp.x + 4 + i * 18, bp.y + 4, 14, 28);
    }
    this.addSolid(12, 2, 14, 4);

    // ── Dining table (center) ──
    this.drawRect(g, 5, 5, 4, 2, 0xc8a870, 0x9a7a50);
    this.label('🍚', 6, 5, 14);
    this.label('🍵', 7, 5, 14);
    // Chairs
    this.drawRect(g, 4, 5, 1, 2, 0x9a7040, 0x7a5020);
    this.drawRect(g, 9, 5, 1, 2, 0x9a7040, 0x7a5020);
    this.drawRect(g, 5, 4, 4, 1, 0x9a7040, 0x7a5020);
    this.addSolid(4, 4, 9, 6);

    // ── Plant (corner) ──
    this.drawRect(g, 14, 10, 1, 1, 0x4a8040, 0x2a5a20);
    this.add.text(this.tile(14, 10).x + 16, this.tile(14, 10).y + 16, '🌿', { fontSize: '16px' }).setOrigin(0.5).setDepth(5);

    // ── Stairs to upper floor (right side) ──
    this.drawRect(g, 13, 6, 2, 4, 0xb09070, 0x8a6a50);
    for (let i = 0; i < 4; i++) {
      g.lineStyle(2, 0x8a6a50, 1);
      const sp = this.tile(13, 6 + i);
      g.lineBetween(sp.x, sp.y + 32, sp.x + 64, sp.y + 32);
    }
    this.label('Upstairs', 13, 7, 8, '#6a4a2a');
    this.addSolid(13, 6, 14, 9);

    // ── Sofa (bottom area) ──
    this.drawRect(g, 2, 9, 3, 2, 0x5566cc, 0x3344aa);
    this.addSolid(2, 9, 4, 10);

    // ── Wall solids ──
    this.addSolid(0, 0, this.COLS - 1, 0);           // top wall
    this.addSolid(0, 0, 0, this.ROWS - 1);           // left wall
    this.addSolid(this.COLS - 1, 0, this.COLS - 1, this.ROWS - 1); // right wall
    this.addSolid(0, this.ROWS - 1, 6, this.ROWS - 1);             // bottom wall left of door
    this.addSolid(9, this.ROWS - 1, this.COLS - 1, this.ROWS - 1); // bottom wall right of door
  }

  protected setupNPCs() {
    const mom = this.createNPCGraphic(6, 7, 0xdd7799, 0x220011, true, 0);
    this.add.text(
      this.tile(6, 7).x + 16,
      this.tile(6, 7).y - 6,
      'Mom', { fontSize: '10px', color: '#fff', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }
    ).setOrigin(0.5, 1).setDepth(16);
    this.npcs.push(mom);
  }

  protected placePlayer() {
    this.createPlayerGraphic(7, 11); // just inside the door
  }

  protected onInteract(_npc: NPC) {
    const starterChosen = this.registry.get('starterChosen') as boolean | undefined;

    if (!starterChosen && !this.momTalked) {
      // First time — send player to Prof. Song
      this.momTalked = true;
      this.dialog.show([
        'Mom: Oh, you\'re finally awake!',
        'Mom: Professor Song called earlier. She\'s at the lab on the north side of town.',
        'Mom: She said she has something special for new trainers.',
        'Mom: You should go see her! But first...\nWould you like to rest before heading out?',
      ], () => {
        this.dialog.showChoice(
          () => {
            this.registry.set('playerHealed', true);
            this.dialog.show([
              '...Your body feels refreshed!\nAll your Pokémon have been healed! ✨',
              'Mom: Now go see Professor Song. North part of town — you can\'t miss it! 💕',
            ]);
          },
          () => {
            this.dialog.show(['Mom: Okay! Don\'t forget to visit Professor Song. She\'s waiting! 💕']);
          }
        );
      });
    } else if (!starterChosen) {
      this.dialog.show([
        'Mom: Professor Song is waiting at the lab, honey!',
        'Mom: North side of town — go choose your Pokémon! 💕',
      ]);
    } else {
      const hasShoes = this.registry.get('hasRunningShoes') as boolean | undefined;

      if (!hasShoes) {
        // First return after getting starter — give running shoes
        this.registry.set('hasRunningShoes', true);
        this.dialog.show([
          `Mom: So you chose ${this.registry.get('starterName') as string}! I'm so proud of you.`,
          'Mom: Oh, before you go — I almost forgot!',
          'Mom: I found these in the closet. They were your father\'s Running Shoes.',
          'Mom: Hold SHIFT while walking and you\'ll move much faster. 👟',
          'Mom: Now, would you like to rest before heading out?',
        ], () => {
          this.dialog.showChoice(
            () => {
              this.registry.set('playerHealed', true);
              this.dialog.show([
                '...Your body feels refreshed!\nAll your Pokémon have been healed! ✨',
              ]);
            },
            () => {
              this.dialog.show(['Mom: Stay safe out there! I love you! 💕']);
            }
          );
        });
      } else {
        // Normal visit — rest offer
        this.dialog.show(
          ['Mom: Welcome home! Would you like to rest?'],
          () => {
            this.dialog.showChoice(
              () => {
                this.registry.set('playerHealed', true);
                this.dialog.show([
                  'Mom: Good. Rest well, honey.',
                  '...Your body feels refreshed!\nAll your Pokémon have been healed! ✨',
                ]);
              },
              () => {
                this.dialog.show([
                  'Mom: Alright, no worries!',
                  'Mom: Come rest here whenever you want. 💕',
                ]);
              }
            );
          }
        );
      }
    }
  }

  protected checkExit() {
    const { x, y } = this.tile(7, 12);
    if (this.py > y + 20) this.exitToWorld();
  }
}
