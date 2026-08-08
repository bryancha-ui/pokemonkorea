import { BaseInteriorScene, NPC } from './BaseInteriorScene';
import { tr } from '../../systems/i18n';
import { PartySystem } from '../../systems/PartySystem';
import { playJingle } from '../../systems/Music';
import { recordLastCenter } from '../../systems/Blackout';

export class PokemonCenterScene extends BaseInteriorScene {
  public interior3D = true;
  public clearSight3D = true;
  // The GLB already contains its complete floor, walls and entrance. Do not
  // raise the legacy tile-map perimeter into a second doorway around it; the
  // 2D map remains authoritative for collision and pure-2D rendering.
  public flatTerrain3D = true;
  public interiorModel3D = {
    id: 'pokemon-center-interior',
    url: 'assets/map3d/interiors/pokemon_center_scene.glb',
    // BaseInteriorScene gets one terrain tile of padding around its 16×13 room.
    // Row 12 begins at local z=13; pin the GLB's open south edge there so no
    // empty strip remains between the model and the gameplay doorway.
    x: 1, z: 1, width: 16, maxDepth: 11, entranceZ: 13,
    // This GLB is the complete room, not a decorative overlay. Once it has
    // loaded, remove the old generated 3D interior beneath it in one step.
    replaceLegacyTerrain: true,
    // A textureless light slab fills the camera area outside the open doorway;
    // the old room image remains gone, but no black void can show behind it.
    replacementGroundColor: 0xe8edf2,
  };
  protected bgmKey = 'center';
  constructor() { super({ key: 'PokemonCenterScene' }); }

  create() {
    // This Pokémon Center is shared by several overworld scenes (Waterfall, Songhyeon…);
    // honour whoever sent us here so the south exit returns to the right city.
    const ret = this.registry.get('pcReturnScene');
    this.returnSceneKey = (typeof ret === 'string' && ret) ? ret : 'WorldMapScene';
    // Remember this center as the whiteout respawn point.
    recordLastCenter(this, this.returnSceneKey);
    super.create();
  }

  protected drawRoom() {
    const g = this.add.graphics().setDepth(0);

    // Walls
    this.drawFloor(g, 0, 0, this.COLS - 1, this.ROWS - 1, 0xcc2244);
    // Floor (white/light)
    this.drawFloor(g, 1, 1, this.COLS - 2, this.ROWS - 2, 0xf0f0f0);

    // Tile pattern
    g.lineStyle(1, 0xdddddd, 1);
    for (let r = 1; r < this.ROWS - 1; r++) {
      for (let c = 1; c < this.COLS - 1; c++) {
        if ((r + c) % 2 === 0) {
          const p = this.tile(c, r);
          g.fillStyle(0xe8e8f0, 1);
          g.fillRect(p.x, p.y, 32, 32);
        }
      }
    }

    // ── PC Sign ──
    this.drawRect(g, 1, 1, this.COLS - 2, 1, 0xcc2244, 0xaa0022);
    this.add.text(400, this.tile(0, 1).y + 16, tr('🏥  POKÉMON CENTER  🏥'), {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    // ── Reception desk ──
    // Keep the counter one tile deep. The previous two-row collision extended
    // beyond the GLB counter and felt like an invisible wall in front of Nurse Joy.
    this.drawRect(g, 4, 3, 8, 1, 0xcc2244, 0x990022);
    this.label('RECEPTION', 7, 3, 10, '#fff');
    this.addSolid(4, 3, 11, 3);

    // ── Healing machines (left + right) ──
    this.drawRect(g, 2, 6, 2, 2, 0x3355cc, 0x1133aa);
    this.label('⚡\nHEAL', 2, 6, 9, '#ffe44e');
    this.drawRect(g, 12, 6, 2, 2, 0x3355cc, 0x1133aa);
    this.label('⚡\nHEAL', 12, 6, 9, '#ffe44e');
    this.addSolid(2, 6, 3, 7);
    this.addSolid(12, 6, 13, 7);

    // ── Waiting chairs ──
    this.drawRect(g, 3, 9, 2, 1, 0x4444cc, 0x2222aa);
    // Leave columns 7-8 as a continuous aisle from the entrance to reception.
    this.drawRect(g, 5, 9, 2, 1, 0x4444cc, 0x2222aa);
    this.drawRect(g, 9, 9, 2, 1, 0x4444cc, 0x2222aa);
    this.drawRect(g, 12, 9, 2, 1, 0x4444cc, 0x2222aa);
    this.addSolid(3, 9, 4, 9);
    this.addSolid(5, 9, 6, 9);
    this.addSolid(9, 9, 10, 9);
    this.addSolid(12, 9, 13, 9);

    // ── Info board ──
    this.drawRect(g, 1, 10, 1, 2, 0x88aacc, 0x6688aa);
    this.label('ℹ️', 1, 10, 14);

    // ── Door ──
    // Keep the legacy tile marker for pure 2D mode, but exclude it from the 3D
    // mirror. Baking it into the room map produced a second raised doorway on
    // top of pokemon_center_scene.glb's authored entrance.
    const legacyDoor = this.add.graphics().setDepth(1).setData('no3d', true);
    this.drawRect(legacyDoor, 7, 12, 2, 1, 0x886622, 0x664400);

    // Walls
    this.addSolid(0, 0, this.COLS - 1, 0);
    this.addSolid(0, 0, 0, this.ROWS - 1);
    this.addSolid(this.COLS - 1, 0, this.COLS - 1, this.ROWS - 1);
    this.addSolid(0, this.ROWS - 1, 6, this.ROWS - 1);
    this.addSolid(9, this.ROWS - 1, this.COLS - 1, this.ROWS - 1);
  }

  protected setupNPCs() {
    // Nurse Joy (heals)
    // Row 1 sits inside the authored GLB's rear wall after its entrance is
    // aligned to the gameplay doorway. Row 2 is the actual staff side of the
    // reception counter, keeping Joy fully visible without moving interaction.
    const nurse = this.createNPCGraphic(7, 2, 0xffffff, 0xff88aa, true, 0, 'center_nurse');
    (nurse as NPC & { role?: string }).role = 'nurse';
    // Nurse Joy stands behind the two-tile-deep reception desk. Interact from
    // its customer side so the player never has to find a path behind it.
    const nurseCounter = this.tile(7, 4);
    nurse.interactX = nurseCounter.x + 16;
    nurse.interactY = nurseCounter.y + 16;
    nurse.interactRadius = 44;
    this.add.text(this.tile(7, 2).x + 16, this.tile(7, 2).y - 6, tr('Nurse Joy'),
      { fontSize: '10px', color: '#fff', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }
    ).setOrigin(0.5, 1).setDepth(16)
      .setData('characterLabel3D', true)
      .setData('characterLabelTarget3D', nurse.graphic);
    this.npcs.push(nurse);

    // Mart Clerk (shop)
    const clerk = this.createNPCGraphic(3, 6, 0x33aa66, 0x223322, false, 0, 'center_clerk');
    (clerk as NPC & { role?: string }).role = 'clerk';
    this.add.text(this.tile(3, 6).x + 16, this.tile(3, 6).y - 6, tr('Mart Clerk'),
      { fontSize: '10px', color: '#aaffcc', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }
    ).setOrigin(0.5, 1).setDepth(16);
    this.npcs.push(clerk);

    // PC (storage box) — placed immediately to Nurse Joy's right. The old PC
    // occupied the right healing machine's solid tiles and could not be reached.
    const pcTile = this.tile(10, 2);
    const pcX = pcTile.x + 16, pcY = pcTile.y + 16;
    const pcGraphic = this.add.graphics().setDepth(15).setPosition(pcX, pcY).setData('no3d', true);
    pcGraphic.fillStyle(0x18284c, 1); pcGraphic.fillRoundedRect(-12, -20, 24, 24, 3);
    pcGraphic.fillStyle(0x77ccff, 1); pcGraphic.fillRect(-9, -17, 18, 13);
    pcGraphic.fillStyle(0xbbeeff, 0.75); pcGraphic.fillRect(-6, -14, 8, 3);
    pcGraphic.fillStyle(0x2b3150, 1); pcGraphic.fillRect(-4, 4, 8, 6);
    pcGraphic.fillStyle(0x111827, 1); pcGraphic.fillRect(-9, 10, 18, 4);
    const pc: NPC & { role?: string } = {
      x: pcX, y: pcY,
      interactX: this.tile(10, 4).x + 16,
      interactY: this.tile(10, 4).y + 16,
      interactRadius: 44,
      graphic: pcGraphic,
      bodyColor: 0x4466cc,
      hairColor: 0x112244,
      isFemale: false,
      facing: 0,
      role: 'pc',
    };
    this.add.text(pcX, pcTile.y - 6, tr('💻 PC'),
      { fontSize: '10px', color: '#aaccff', backgroundColor: '#00000088', padding: { x: 3, y: 1 } }
    ).setOrigin(0.5, 1).setDepth(16);
    this.npcs.push(pc);
  }

  protected placePlayer() {
    // Spawn half a tile inside the GLB entrance, with no empty approach segment.
    this.createPlayerGraphic(7, 11);
  }

  protected onInteract(npc: NPC) {
    const role = (npc as NPC & { role?: string }).role ?? 'nurse';

    if (role === 'clerk') {
      this.dialog.show(['Mart Clerk: Welcome! Take a look at our wares.'], () => {
        this.scene.launch('ShopScene', { parentKey: this.scene.key });
        this.scene.pause();
      });
      return;
    }

    if (role === 'pc') {
      this.dialog.show(["Trainer's PC: Accessing Pokémon storage system..."], () => {
        this.scene.launch('BoxScene', { parentKey: this.scene.key });
        this.scene.pause();
      });
      return;
    }

    // Nurse — heal the party
    this.dialog.show(
      ['Nurse Joy: Welcome to the Pokémon Center! 🌸',
       'Nurse Joy: We restore your tired Pokémon.\nShall I heal your Pokémon?'],
      () => {
        this.dialog.showChoice(
          () => {
            PartySystem.healAll(this.registry);
            this.registry.set('playerHealed', true);
            playJingle(this, 'heal');   // healing chime
            this.dialog.show([
              'Nurse Joy: We\'ll take your Pokémon for just a moment!',
              '...  ✨  ...  ✨  ...  ✨',
              'Nurse Joy: Your Pokémon have been fully restored!\nPlease come again! 🌸',
            ]);
          },
          () => {
            this.dialog.show(['Nurse Joy: Okay! Please come again anytime. 🌸']);
          }
        );
      }
    );
  }

  protected checkExit() {
    const { y } = this.tile(7, 12);
    // Transition immediately after crossing the GLB threshold. The old +20px
    // delay made the player walk across a visible empty strip outside the model.
    if (this.py > y + 4) this.exitToWorld();
  }
}
