import Phaser from 'phaser';
import { t, tr, speakerName } from '../systems/i18n';
import { vanishesAfterDefeat } from '../data/Villains';
import { drawTrainerBody, drawNpcBody, playerDesign, rivalDesign, rivalTrainerName } from '../data/CharacterSprite';
import { markRivalPortrait, markTrainerPortrait } from '../data/BattlePortraits';
import { DialogBox } from '../ui/DialogBox';
import { SaveManager } from '../utils/SaveManager';
import { playBgm } from '../systems/Music';
import { DexTracker } from '../systems/DexTracker';
import { PartySystem } from '../systems/PartySystem';
import { Inventory } from '../systems/Items';
import { maybeLaunchEvolution } from '../systems/EvolutionSystem';
import { EncounterEntry, pickEncounter, randomLevel } from '../data/CustomPokemon';
import { customForm } from '../data/CustomBattle';
import { playNabihalmangEntranceVideo } from '../systems/NabihalmangEntranceVideo';
import { HWANGEUM_STORY, recordHwangeumBeat, spawnHwangeum } from '../systems/HwangeumStory';

// ── Tiles ───────────────────────────────────────────────────────────────────
const T = { ROCK: 0, ASH: 1, TALLGRASS: 2, LAVA: 3, VENT: 4, SUMMIT: 5 } as const;
type Tile = typeof T[keyof typeof T];
const TILE = 32, COLS = 24, ROWS = 70;
// The summit event is staged at a fixed world position. It must not be
// anchored to the player's current position, otherwise the cast pops into
// existence only after the player reaches the trigger row.
const SUMMIT_STAGE_X = 12 * TILE + 16;
const SUMMIT_STAGE_Y = 6 * TILE + 16;
const COLORS: Record<Tile, number> = {
  [T.ROCK]: 0x2a2228, [T.ASH]: 0x6a5a52, [T.TALLGRASS]: 0x5a6a3a, [T.LAVA]: 0xd84a1a,
  [T.VENT]: 0x9a4a2a, [T.SUMMIT]: 0x7a6a60,
};
const SOLID = new Set<Tile>([T.ROCK, T.LAVA]);
const ENCOUNTER = new Set<Tile>([T.TALLGRASS]);

type NabihalmangEventVisual = {
  stageX: number;
  stageY: number;
  restraint: Phaser.GameObjects.Graphics;
  restrainedNabi: Phaser.GameObjects.Image;
  ryeo: Phaser.GameObjects.Graphics;
  suri: Phaser.GameObjects.Graphics;
  operativeL: Phaser.GameObjects.Graphics;
  operativeR: Phaser.GameObjects.Graphics;
  rival: Phaser.GameObjects.Graphics;
  rLabel: Phaser.GameObjects.Text;
  sLabel: Phaser.GameObjects.Text;
  vLabel: Phaser.GameObjects.Text;
  freedNabi?: Phaser.GameObjects.Image;
  destroy: () => void;
};

// Volcanic wild Pokémon (fire / rock / poison / ghost), mostly new customs
const VENT_ENCOUNTERS: EncounterEntry[] = [
  { id: 'blazekunk',     weight: 14, minLevel: 44, maxLevel: 48, isCustom: true,  catchRate: 150 }, // Fire/Poison
  { id: 'mushvenom',     weight: 14, minLevel: 44, maxLevel: 48, isCustom: true,  catchRate: 150 }, // Rock/Poison
  { id: 'liondance',     weight: 12, minLevel: 44, maxLevel: 48, isCustom: true,  catchRate: 160 }, // Fire/Normal
  { id: 'crystbeetle',   weight: 12, minLevel: 44, maxLevel: 48, isCustom: true,  catchRate: 160 }, // Bug/Rock
  { id: 'foxgeist',      weight: 10, minLevel: 44, maxLevel: 48, isCustom: true,  catchRate: 150 }, // Poison/Ghost
  { id: 'redheadagama',  weight: 10, minLevel: 44, maxLevel: 48, isCustom: true,  catchRate: 150 }, // Fire/Dragon
  { id: 'dynabeetle',    weight: 12, minLevel: 44, maxLevel: 48, isCustom: true,  catchRate: 150 }, // Bug/Fire (volcanic)
  { id: 126, weight: 8, minLevel: 44, maxLevel: 48, isCustom: false, catchRate: 120 }, // Magmar
  { id: 74,  weight: 10, minLevel: 44, maxLevel: 48, isCustom: false, catchRate: 200 }, // Geodude
  { id: 218, weight: 8, minLevel: 44, maxLevel: 48, isCustom: false, catchRate: 190 }, // Slugma
];

function buildMap(): Tile[][] {
  const m: Tile[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(T.ROCK) as Tile[]);
  const fill = (r1: number, r2: number, c1: number, c2: number, t: Tile) => {
    for (let r = r1; r < r2; r++) for (let c = c1; c < c2; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) m[r][c] = t;
  };
  // ── Switchback climb (carved as walkable ASH through the rock) ──────────────
  fill(60, ROWS, 10, 14, T.ASH);   // entry, bottom
  fill(58, 62, 3, 14, T.ASH);      // ledge 1 → left
  fill(48, 62, 3, 7, T.ASH);       // climb left
  fill(46, 50, 3, 21, T.ASH);      // ledge 2 → right
  fill(36, 50, 17, 21, T.ASH);     // climb right
  fill(34, 38, 3, 21, T.ASH);      // ledge 3 → left
  fill(24, 38, 3, 7, T.ASH);       // climb left
  fill(22, 26, 3, 21, T.ASH);      // ledge 4 → right
  fill(12, 26, 17, 21, T.ASH);     // climb right
  fill(10, 14, 3, 21, T.ASH);      // ledge 5 → center
  fill(2, 14, 9, 15, T.ASH);       // final climb to summit
  // Summit plateau
  fill(1, 9, 4, 20, T.SUMMIT);
  fill(2, 9, 9, 15, T.ASH);        // keep approach onto the plateau

  // Tall-grass patches along the ledges
  fill(58, 61, 6, 10, T.TALLGRASS);
  fill(46, 49, 9, 14, T.TALLGRASS);
  fill(34, 37, 8, 13, T.TALLGRASS);
  fill(22, 25, 9, 14, T.TALLGRASS);
  fill(48, 61, 4, 6, T.TALLGRASS);
  fill(24, 37, 4, 6, T.TALLGRASS);

  // Lava pools + vents (hazards / decoration set into the rock walls)
  for (const [r, c] of [[55,16],[44,8],[40,14],[30,16],[20,8],[16,14],[52,2],[28,21]] as [number,number][]) m[r][c] = T.LAVA;
  for (const [r, c] of [[57,12],[45,18],[35,5],[23,18],[12,5],[6,7],[6,16]] as [number,number][]) {
    if (m[r]?.[c] === T.ROCK || m[r]?.[c] === T.SUMMIT) m[r][c] = T.VENT;
  }
  return m;
}

export class JejuVentScene extends Phaser.Scene {
  public grassTileIds3D = [T.TALLGRASS];
  private map!: Tile[][];
  /** Volcanic vent terrain, not a town — drop any building the heuristics
   *  hallucinate from the dark basalt/steam shading. */
  public onlyNamedBuildings = true;
  private playerG!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private dialog!: DialogBox;
  private px = 12 * TILE + 16;
  private py = 66 * TILE + 16;   // enter at the bottom (ferry landing)
  private facing = 1; private walkFrame = 0; private walkTimer = 0;
  private cutsceneActive = false;
  private steps = 0; private nextEnc = 10;
  private readonly SPEED = 120; private readonly RUN = 250;
  private nabiEntranceVideoAction?: () => void;
  private nabiSummitVisual?: NabihalmangEventVisual;
  private postCaptureRyeoVisual?: { destroy: () => void };
  private ryeoBattleTestAction?: () => void;

  private readonly TRAINERS = [
    {
      key: 'jeju-suri-1', name: 'Team Suri Grunt', col: 18, row: 42, color: 0x161616, label: 'Team\nSuri',
      line: "Grunt: Turn back! The Director's orders — no one reaches the summit before our transport secures the moth!",
      pokemon: JSON.stringify([{ id: 229, level: 46 }, { id: 319, level: 47 }]),  // Houndoom, Sharpedo
      expPool: 1100,
    },
    {
      key: 'jeju-suri-2', name: 'Team Suri Grunt', col: 5, row: 28, color: 0x161616, label: 'Team\nSuri',
      line: "Grunt: You climb fast for a tourist. It ends here!",
      pokemon: JSON.stringify([{ id: 461, level: 47 }, { id: 0, level: 48, custom: 'martbadger' }]),  // Weavile, Martbadger
      expPool: 1200,
    },
  ] as const;

  constructor() { super('JejuVentScene'); }

  preload() {
    if (this.textures.exists('nabihalmang')) return;
    const url = customForm('nabihalmang')?.data.spriteUrl ?? 'assets/dex/nabihalmang.png';
    this.load.image('nabihalmang', url);
  }

  private get caught() {
    return !!this.registry.get('ryeoBattleTest')
      || DexTracker.isCaught(this.registry, 'nabihalmang')
      || PartySystem.get(this.registry).some(e => e.spriteKey === 'nabihalmang')
      || (this.registry.get('box') as string ?? '').includes('nabihalmang');
  }

  create() {
    this.cutsceneActive = false; this.walkFrame = 0; this.walkTimer = 0; this.steps = 0;
    this.nabiEntranceVideoAction = undefined;
    this.nabiSummitVisual = undefined;
    this.postCaptureRyeoVisual = undefined;
    this.ryeoBattleTestAction = undefined;
    this.input.keyboard?.resetKeys();
    const rx = this.registry.get('jejuVentReturnX') as number | undefined;
    const ry = this.registry.get('jejuVentReturnY') as number | undefined;
    if (rx !== undefined) { this.px = rx; this.py = ry as number; }
    this.registry.remove('jejuVentReturnX'); this.registry.remove('jejuVentReturnY');

    this.map = buildMap();
    this.drawMap();
    this.drawTrainers();
    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createUI();

    // Stage the summit confrontation before the player arrives. The actors
    // are world-space objects, so the approaching camera can reveal the real
    // 3D models while the player is still climbing below the trigger row.
    if (!this.caught && this.registry.get('seoraeGymDefeated')) {
      this.nabiSummitVisual = this.buildNabihalmangEventVisuals();
    }

    // Create the post-capture Commander Ryeo before the 3D mirror's first
    // frame for this scene. The dialog is delayed for pacing, but the actor is
    // already a normal world-space 3D character when the map is rendered.
    const hasPostCaptureRyeo = !!this.registry.get('ryeoBattleTest') || (this.caught && (
      !this.registry.get('nabiCaughtBeat')
      || (
        !!this.registry.get('trainerDefeated_jeju-ryeo-final')
        && !this.registry.get('ryeoDefeatScene')
        && !this.registry.get('commanderRyeoDefeated')
      )
    ));
    if (hasPostCaptureRyeo) this.postCaptureRyeoVisual = this.buildRyeoConfrontation();

    this.cameras.main.fadeIn(400);
    SaveManager.save(this.registry, this.px, this.py, 'JejuVentScene');

    // Eerie volcanic ambience for the vent climb — except during the capture finale,
    // which swaps to 나비할망's dancheong theme just below.
    if (!(this.caught && !this.registry.get('nabiCaughtBeat'))) playBgm(this, 'vents');

    // Returned from the legendary battle having CAUGHT 나비할망 → Commander Ryeo confrontation.
    if (this.registry.get('ryeoBattleTest')) {
      this.setupRyeoBattleTestPreview();
    } else if (this.caught && !this.registry.get('nabiCaughtBeat')) {
      this.registry.set('nabiCaughtBeat', true);
      this.registry.set('chapter9Done', true);   // Phase 1 legendary acquired
      this.registry.set('phase1Legendary', 'nabihalmang');
      SaveManager.save(this.registry, this.px, this.py, 'JejuVentScene');   // persist NOW so it can't be lost on quit
      playBgm(this, 'dancheong');   // The Dancheong Shield — 나비할망's theme for this closing beat
      this.time.delayedCall(300, () => {
        this.cutsceneActive = true;
        const visual = this.postCaptureRyeoVisual ?? (this.postCaptureRyeoVisual = this.buildRyeoConfrontation());
        this.dialog.show([
          "나비할망 folds her glowing, dancheong-patterned wings and settles beside you at last.",
          "Prof. Song: She's chosen you as her guardian — and the south's. You truly earned her.",
          "A sound like metal grinding. Commander Ryeo emerges from the shadows of the rig — bloodied, furious, movements sharp with desperation.",
          "Commander Ryeo: That moth was supposed to be OUR key to reshaping this peninsula! And you—",
          `${rivalTrainerName(this.registry)}: You lose. We took it. 나비할망 chose our friend. Maybe she knows something about what you'd actually do with her.`,
          "Commander Ryeo: ...Then I'll take it from your corpse. One final test. You and me. No team. Just will.",
        ], () => {
          // Battle with Commander Ryeo
          visual.destroy();
          this.postCaptureRyeoVisual = undefined;
          PartySystem.healAll(this.registry);
          this.registry.set('trainerName', 'Commander Ryeo');
          this.registry.set('trainerKey', 'jeju-ryeo-final');
          this.registry.set('trainerPokemon', JSON.stringify([
            { id: 248, level: 51 },                      // Tyranitar (Rock/Dark) — lead, Sand Stream
            { id: 0, level: 51, custom: 'corrpanda' },   // Dark — swift striker
            { id: 0, level: 52, custom: 'martbadger' },  // Steel/Dark — bulky support
            { id: 462, level: 52 },                      // Magnezone (Electric/Steel) — coverage
            { id: 373, level: 53 },                      // Salamence (Dragon/Flying) — sweeper
            { id: 381, level: 54 },                      // Kyogre (Water) — ace
          ]));
          this.registry.set('trainerExpPool', 3600);
          this.registry.set('trainerReturnScene', 'JejuVentScene');
          this.registry.set('jejuVentReturnX', 12 * TILE + 16);
          this.registry.set('jejuVentReturnY', 8 * TILE + 16);
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
      });
    } else if (this.caught && this.registry.get('nabiCaughtBeat') && !this.registry.get('commanderRyeoDefeated')) {
      // After Ryeo is defeated, show the final scene
      if (this.registry.get('trainerDefeated_jeju-ryeo-final') && !this.registry.get('ryeoDefeatScene')) {
        this.registry.set('ryeoDefeatScene', true);
        this.time.delayedCall(300, () => {
          this.cutsceneActive = true;
          const visual = this.postCaptureRyeoVisual ?? (this.postCaptureRyeoVisual = this.buildRyeoConfrontation());
          this.dialog.show([
            "Commander Ryeo staggers backward, her Pokémon recalled. She looks at the towering moth beside you — at the glow of her wings — and something breaks in her expression.",
            "Commander Ryeo: ...She looks at you like you're not a tool to be used. Like you matter. That's what I never understood about this region. That's what we tried to control.",
            `${rivalTrainerName(this.registry)}: The 노스단 southern operations are done. Your rig is scrap. Your orders don't reach here anymore.`,
            "Commander Ryeo: No. They don't. (She turns and walks down the mountain, alone.)",
            "Prof. Song: She's leaving. Let her. 노스단's reach here is broken.",
            "나비할망's wings catch the dawn light. You've earned something rare — the choice of a legendary.",
            "Prof. Song: Reach the Onnuri League, prove yourself champion. Then the world opens up. The north has lessons too.",
            `${rivalTrainerName(this.registry)}: To the League, then. 나비할망 will make sure we get there in one piece.`,
          ], () => {
            visual.destroy();
            this.postCaptureRyeoVisual = undefined;
            this.runHwangeumJejuRescue();
          });
        });
      } else if (this.registry.get('ryeoDefeatScene')
        && !this.registry.get(HWANGEUM_STORY.jejuRescue)
        && !this.registry.get('championDefeated')) {
        // Backward-compatible path for saves made after Ryeo's departure but
        // before this recurring-Champion chapter was added.
        this.time.delayedCall(350, () => this.runHwangeumJejuRescue());
      }
    } else if (this.caught
      && this.registry.get('trainerDefeated_jeju-ryeo-final')
      && this.registry.get('ryeoDefeatScene')
      && !this.registry.get(HWANGEUM_STORY.jejuRescue)
      && !this.registry.get('championDefeated')) {
      this.time.delayedCall(350, () => this.runHwangeumJejuRescue());
    } else if (!this.registry.get('jejuClimbStarted')) {
      this.registry.set('jejuClimbStarted', true);
      this.time.delayedCall(500, () => {
        this.cutsceneActive = true;
        this.dialog.show([
          'The vent trail rises sharply from the port — a long, switchbacked climb through lava and ash.',
          `${rivalTrainerName(this.registry)}: Eerie up here. Watch the lava and keep your footing — no telling what roosts at the top.`,
        ], () => { this.cutsceneActive = false; });
      });
    } else {
      this.time.delayedCall(300, () => maybeLaunchEvolution(this));
    }
  }

  /** The summit battle is the player's victory; Hwangeum arrives for the equally
   *  important aftermath — grounding the rig and coordinating the evacuation. */
  private runHwangeumJejuRescue() {
    if (this.registry.get(HWANGEUM_STORY.jejuRescue) || this.registry.get('championDefeated')) {
      this.cutsceneActive = false;
      return;
    }
    this.cutsceneActive = true;
    const hx = Phaser.Math.Clamp(this.px + TILE, 10 * TILE, 15 * TILE);
    // Normally this is the summit. An older save can resume lower on the vent
    // trail, so keep the actor beside the player rather than off camera.
    const hy = Phaser.Math.Clamp(this.py - 2 * TILE, 3 * TILE, 66 * TILE);
    const actor = spawnHwangeum(this, hx, hy, {
      lookAt: { x: this.px, y: this.py },
    });
    this.playerG.setData('characterLookAt3D', { x: hx, y: hy });
    this.dialog.show([
      t('League rescue sirens rise through the ash. Hwangeum reaches the summit with rangers, engineers and Gym Leader Harang\'s coastal crews moving below.',
        '화산재 사이로 리그 구조대의 사이렌이 울린다. 황금이 레인저와 기술진을 이끌고 정상에 도착하고, 아래에서는 하랑 관장의 해안 구조대가 움직인다.'),
      t('Hwangeum: Bonejoillion has grounded the ruptured restraint grid. Harang\'s boats are clearing the shore, and Namsun turned the Contest Hall into an evacuation shelter.',
        '황금: 보내조에일리언이 파열된 구속 장치를 접지시켰어. 하랑의 배들이 해안을 비우고 있고, 남순은 콘테스트 홀을 대피소로 바꿨다.'),
      t('Hwangeum: You faced the choice none of us could make for you — and 나비할망 chose your answer. The battle was yours; now let us carry the aftermath together.',
        '황금: 누구도 대신할 수 없는 선택을 네가 마주했고 — 나비할망은 네 대답을 선택했어. 싸움은 네 것이었지만, 이제 그 뒤의 무게는 우리가 함께 나르자.'),
      t('Hwangeum: This is what protecting Onnuri means. Not arriving for the applause — staying until the last frightened person is home.',
        '황금: 이게 온누리를 지킨다는 뜻이야. 박수를 받을 때 나타나는 게 아니라 — 두려움에 떠는 마지막 한 사람이 집에 돌아갈 때까지 남는 것.'),
      t('Hwangeum: Earn the final badge and come to the League. When we battle, I want the full answer from the trainer I have watched become a guardian.',
        '황금: 마지막 배지를 얻고 리그로 와. 우리가 싸울 때, 내가 지켜본 그 수호자가 어떤 트레이너인지 온전한 대답을 보여 줘.'),
    ], () => {
      recordHwangeumBeat(this.registry, HWANGEUM_STORY.jejuRescue);
      this.registry.set('commanderRyeoDefeated', true);
      SaveManager.save(this.registry, this.px, this.py, 'JejuVentScene');
      this.playerG.setData('characterLookAt3D', null);
      this.tweens.add({ targets: [actor.graphic, actor.label], alpha: 0, duration: 340,
        onComplete: () => actor.destroy() });
      this.cutsceneActive = false;
      this.time.delayedCall(250, () => maybeLaunchEvolution(this));
    });
  }

  // ── Map ─────────────────────────────────────────────────────────────────
  private drawMap() {
    const g = this.make.graphics({ x: 0, y: 0 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = this.map[r][c];
      g.fillStyle(COLORS[t], 1); g.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (t === T.ROCK) { g.fillStyle(0x3a3038); g.fillRect(c*TILE+4, r*TILE+5, 8, 7); g.fillRect(c*TILE+18, r*TILE+18, 9, 8); }
      if (t === T.TALLGRASS) { g.fillStyle(0x3f5a22, 0.8); for (let i=0;i<3;i++){ g.fillRect(c*TILE+5+i*8, r*TILE+16, 2, 12); g.fillRect(c*TILE+7+i*8, r*TILE+12, 2, 16);} }
      if (t === T.LAVA) { g.fillStyle(0xff8a3a, 0.8); g.fillRect(c*TILE+4, r*TILE+6, TILE-8, 5); g.fillStyle(0xffd060, 0.7); g.fillRect(c*TILE+10, r*TILE+16, TILE-20, 4); }
      if (t === T.VENT) { g.fillStyle(0xff6a2a, 0.5); g.fillCircle(c*TILE+16, r*TILE+18, 8); g.fillStyle(0x553028, 0.6); g.fillCircle(c*TILE+16, r*TILE+18, 4); }
      if (t === T.SUMMIT) { g.fillStyle(0x8a7a70, 0.5); g.fillRect(c*TILE+6, r*TILE+8, 6, 6); }
    }
    const key = '__jejuVentMap__';
    if (this.textures.exists(key)) this.textures.remove(key);
    g.generateTexture(key, COLS * TILE, ROWS * TILE); g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    this.add.text(12 * TILE, 67.5 * TILE, tr('↓ Jeju Port'), {
      fontSize: '10px', color: '#fff', backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
    this.add.text(12 * TILE, 0.6 * TILE, tr('⛰ Summit — the Vents'), {
      fontSize: '10px', color: '#ffd0a0', backgroundColor: '#00000088', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(5);
  }

  private drawTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`) && vanishesAfterDefeat(tr.key)) continue;
      const g = this.add.graphics().setDepth(8);
      g.setPosition(tr.col * TILE + 16, tr.row * TILE + 16);
      g.fillStyle(0x000000, 0.2); g.fillEllipse(0, 13, 16, 5);
      g.fillStyle(tr.color); g.fillRect(-7, -8, 14, 12);
      g.fillStyle(0xcc2233); g.fillRect(-7, -8, 14, 2);
      g.fillStyle(0x222222); g.fillRect(-6, 4, 5, 8); g.fillRect(1, 4, 5, 8);
      g.fillStyle(0xffcc99); g.fillRect(-6, -20, 12, 11);
      g.fillStyle(0x101010); g.fillRect(-6, -21, 12, 5);
      g.fillStyle(0xcc2233); g.fillRect(-3, -15, 2, 2); g.fillRect(1, -15, 2, 2);
      this.add.text(tr.col * TILE + 16, tr.row * TILE - 12, speakerName(tr.label), {
        fontSize: '8px', color: '#ff8899', backgroundColor: '#00000088', padding: { x: 2, y: 1 }, align: 'center',
      }).setOrigin(0.5).setDepth(9);
    }
  }

  // ── Player / camera / input ──────────────────────────────────────────────
  private createPlayer() { this.playerG = this.add.graphics().setDepth(20); this.drawChar(); }
  private drawChar() {
    drawTrainerBody(this.playerG, this.facing, this.walkFrame, playerDesign(this.registry));
    this.playerG.setPosition(this.px, this.py);
  }
  private setupCamera() {
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.setZoom(1.6);
    this.cameras.main.startFollow(this.playerG, true, 0.1, 0.1);
  }
  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = { up: this.input.keyboard!.addKey('W'), down: this.input.keyboard!.addKey('S'), left: this.input.keyboard!.addKey('A'), right: this.input.keyboard!.addKey('D') };
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B).on('down', () => { if (!this.cutsceneActive) this.scene.launch('MenuScene'); });
    // DEBUG: press 0 to (re)stage the Commander Ryeo confrontation as if 나비할망 was just caught.
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO).on('down', () => this.debugStageRyeoBattle());
    // Open a separate browser window for the non-destructive post-capture battle test.
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F9).on('down', () => this.openRyeoBattleTestWindow());
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => this.ryeoBattleTestAction?.());
  }

  private openRyeoBattleTestWindow() {
    const url = new URL(window.location.href);
    url.searchParams.set('test', 'ryeo-battle');
    const popup = window.open(
      url.toString(), 'pokemon-korea-ryeo-battle-test',
      'popup=yes,width=1280,height=720,resizable=yes,scrollbars=no',
    );
    if (!popup) console.warn('[JejuVent] Browser blocked the Ryeo battle test popup.');
  }

  /** Freeze the post-capture map so the 3D Commander Ryeo model can be checked
   *  before the battle is entered. SPACE/R then continues into the real battle. */
  private setupRyeoBattleTestPreview() {
    this.cutsceneActive = true;
    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W / 2, 56, 610, 58, 0x080b18, 0.82)
      .setScrollFactor(0).setDepth(100);
    this.add.text(W / 2, 42, '사령관 려 3D 배틀 직전 확인', {
      fontSize: '18px', color: '#ffd0e1', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    this.add.text(W / 2, 68, '사령관 려와 나비할망의 모델이 보이는지 확인한 뒤 SPACE/R로 배틀 시작', {
      fontSize: '11px', color: '#e2e8ff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    this.add.rectangle(W / 2, H - 42, 570, 42, 0x080b18, 0.86)
      .setScrollFactor(0).setDepth(100);
    this.add.text(W / 2, H - 42, '현재 화면은 배틀 직전 고정 상태입니다  ·  SPACE/R: 배틀 시작  ·  창 닫기: 테스트 종료', {
      fontSize: '11px', color: '#c4cbea',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    this.ryeoBattleTestAction = () => {
      this.ryeoBattleTestAction = undefined;
      this.cutsceneActive = false;
      this.postCaptureRyeoVisual?.destroy();
      this.postCaptureRyeoVisual = undefined;
      PartySystem.healAll(this.registry);
      this.registry.set('trainerName', 'Commander Ryeo');
      this.registry.set('trainerKey', 'jeju-ryeo-final');
      this.registry.set('trainerReturnScene', 'JejuVentScene');
      this.registry.set('jejuVentReturnX', 12 * TILE + 16);
      this.registry.set('jejuVentReturnY', 8 * TILE + 16);
      this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
    };
  }

  /** Test hook — jump straight to the post-capture Commander Ryeo battle.
   *  Marks 나비할망 as caught and clears the "beat" flags so create() re-runs the
   *  confrontation cutscene → TrainerBattleScene against Commander Ryeo. */
  private debugStageRyeoBattle() {
    if (this.cutsceneActive) return;
    DexTracker.markCaught(this.registry, 'nabihalmang');   // makes `this.caught` true
    this.registry.set('nabiCaughtBeat', false);            // re-arm the confrontation
    this.registry.set('ryeoDefeatScene', false);
    this.registry.set('commanderRyeoDefeated', false);
    this.registry.set('trainerDefeated_jeju-ryeo-final', false);
    this.registry.set('jejuVentReturnX', 12 * TILE + 16);
    this.registry.set('jejuVentReturnY', 8 * TILE + 16);   // on the summit plateau
    this.scene.restart();
  }
  private createUI() {
    this.dialog = new DialogBox(this, this.scale.width, this.scale.height);
    this.add.rectangle(this.scale.width / 2, 22, 400, 32, 0x000000, 0.6).setScrollFactor(0).setDepth(50);
    this.add.text(this.scale.width / 2, 22, tr('🌋 Jeju Vents — The Ascent (제주 분화구)'), {
      fontSize: '13px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    this.add.text(this.scale.width / 2, this.scale.height - 8, tr('WASD: move  SHIFT: run  SPACE: talk  M: menu  F9: Ryeo test'), {
      fontSize: '10px', color: '#ccc', backgroundColor: '#00000088', padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(51);
  }

  // ── Update ───────────────────────────────────────────────────────────────
  update(_: number, delta: number) {
    if (this.cutsceneActive) {
      if (this.nabiEntranceVideoAction) {
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.nabiEntranceVideoAction();
      } else if (this.ryeoBattleTestAction) {
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.ryeoBattleTestAction();
      } else if (this.dialog.isInChoice()) {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.dialog.navigateChoice(-1);
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.dialog.navigateChoice(1);
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.confirmChoice();
      } else if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.dialog.advance();
      return;
    }
    const dt = delta / 1000; let dx = 0, dy = 0;
    if (this.cursors.left.isDown  || this.wasd.left.isDown)  { dx = -1; this.facing = 2; }
    if (this.cursors.right.isDown || this.wasd.right.isDown) { dx =  1; this.facing = 3; }
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    { dy = -1; this.facing = 1; }
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  { dy =  1; this.facing = 0; }
    const moving = dx !== 0 || dy !== 0;
    const running = moving && !!this.registry.get('hasRunningShoes') && this.shiftKey.isDown;
    const speed = running ? this.RUN : this.SPEED;
    if (moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = this.px + (dx / len) * speed * dt, ny = this.py + (dy / len) * speed * dt;
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      this.walkTimer += delta;
      if (this.walkTimer > (running ? 100 : 180)) { this.walkFrame ^= 1; this.walkTimer = 0; this.steps++; this.checkEncounter(); }
    } else this.walkFrame = 0;
    this.drawChar();
    this.checkTrainers();
    this.checkSummit();
    this.checkExits();
  }
  private collides(x: number, y: number): boolean {
    const hw = 6;
    return [[x-hw,y-4],[x+hw,y-4],[x-hw,y+8],[x+hw,y+8]].some(([cx, cy]) => {
      const col = Math.floor(cx / TILE), row = Math.floor(cy / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      return SOLID.has(this.map[row][col]);
    });
  }

  private checkEncounter() {
    const col = Math.floor(this.px / TILE), row = Math.floor(this.py / TILE);
    const t = this.map[row]?.[col];
    if (!t || !ENCOUNTER.has(t)) { this.steps = 0; return; }
    if (this.steps < this.nextEnc) return;
    if (Math.random() > 0.22) return;
    this.steps = 0; this.nextEnc = 8 + Math.floor(Math.random() * 8);
    const e = pickEncounter(VENT_ENCOUNTERS);
    this.registry.set('wildId', e.id);
    this.registry.set('wildLevel', randomLevel(e));
    this.registry.set('wildCustom', e.isCustom);
    this.registry.set('wildCatchRate', e.catchRate);
    this.registry.set('wildReturnScene', 'JejuVentScene');
    this.registry.set('jejuVentReturnX', this.px); this.registry.set('jejuVentReturnY', this.py);
    this.cameras.main.fadeOut(400, 255, 255, 255, () => this.scene.start('WildBattleScene'));
  }

  private checkTrainers() {
    for (const tr of this.TRAINERS) {
      if (this.registry.get(`trainerDefeated_${tr.key}`)) continue;
      const wx = tr.col * TILE + 16, wy = tr.row * TILE + 16;
      if (Math.hypot(this.px - wx, this.py - wy) < TILE * 1.5) {
        this.cutsceneActive = true;
        this.registry.set('trainerName', tr.name);
        this.registry.set('trainerKey', tr.key);
        this.registry.set('trainerPokemon', tr.pokemon);
        this.registry.set('trainerExpPool', tr.expPool);
        this.registry.set('trainerReturnScene', 'JejuVentScene');
        this.registry.set('jejuVentReturnX', this.px); this.registry.set('jejuVentReturnY', this.py);
        this.dialog.show([tr.line, "Team Suri Grunt: For the Director!"], () => {
          this.cameras.main.fadeOut(400, 0, 0, 0, () => this.scene.start('TrainerBattleScene'));
        });
        return;
      }
    }
  }

  /** The summit. The whole 노스단 vs. 나비할망 event is gated behind the 7th badge
   *  (Frostbell) — before that the vents are quiet and you simply cross Jeju to reach
   *  Dolmoe/Seorae. Prof. Song calls you back here once you hold the Frostbell Badge. */
  private checkSummit() {
    if (this.caught) return;
    if (this.py > 9 * TILE) return;   // only on the summit plateau
    this.cutsceneActive = true;

    // ── Before the 7th badge: nothing is here yet. ─────────────────────────
    if (!this.registry.get('seoraeGymDefeated')) {
      this.dialog.show([
        'The vent summit is quiet — only wind, steam and black rock. Nothing stirs here yet.',
        "Prof. Song (comms): 노스단 hasn't moved on this place. Keep earning badges — I'll call you the moment it matters.",
      ], () => { this.cutsceneActive = false; });
      return;
    }

    // The cast was staged in create() at the fixed summit location, before
    // the player reached this trigger. Reuse those same 3D objects instead of
    // spawning a second set at the player's current coordinates.
    const summitVisual = this.nabiSummitVisual ?? (this.nabiSummitVisual = this.buildNabihalmangEventVisuals());
    this.playerG.setData('characterLookAt3D', {
      x: summitVisual.stageX, y: summitVisual.stageY - TILE,
    });

    // ── After the 7th badge: the 노스단 confrontation + the capture. ─────────
    const launchBattle = () => {
      PartySystem.healAll(this.registry);
      if (Inventory.count(this.registry, 'masterball') <= 0) Inventory.add(this.registry, 'masterball', 1);
      this.registry.set('wildId', 'nabihalmang');
      this.registry.set('wildLevel', 52);
      this.registry.set('wildCustom', true);
      this.registry.set('wildCatchRate', 3);
      this.registry.set('wildReturnScene', 'JejuVentScene');
      this.registry.set('jejuVentReturnX', 12 * TILE + 16);
      this.registry.set('jejuVentReturnY', 10 * TILE + 16);
      this.cameras.main.fadeOut(500, 0, 0, 0, () => this.scene.start('WildBattleScene'));
    };
    const playAppearance = (visual: NabihalmangEventVisual, afterAppearance: () => void) => {
      const playInEngine = () => this.playNabihalmangScene(visual, afterAppearance);
      if (this.registry.get('nabiEntranceMovieSeen')) {
        playInEngine();
        return;
      }
      this.registry.set('nabiEntranceMovieSeen', true);
      this.nabiEntranceVideoAction = playNabihalmangEntranceVideo(
        this,
        playInEngine,
        () => { this.nabiEntranceVideoAction = undefined; },
      );
    };
    if (!this.registry.get('jejuSummitSeen')) {
      this.registry.set('jejuSummitSeen', true);
      DexTracker.markSeen(this.registry, 'nabihalmang');
      // Put the entire confrontation into the world before the release
      // animation starts. These objects stay alive through both dialog blocks
      // and are destroyed only when the capture battle is launched.
      this.dialog.show([
        'You crest the black-rock summit. 나비할망 — wings of hammered, dancheong-patterned metal, dusted in luminous fairy scales — thrashes inside a straining 노스단 rig.',
        "Commander Ryeo: Tighten the restraint field! Her wings can regulate the Jeju crater energy — secure her and the weapon completes itself even without the lake!",
        "노스단 Operative: Commander, her output is climbing—",
        "Commander Ryeo: Hold it. HOLD IT.",
      ], () => playAppearance(summitVisual, () => {
        this.dialog.show([
          "나비할망's metallic wings flare — and the restraint field SHATTERS. The 노스단 equipment overloads in a cascade of sparks; operatives are thrown back.",
          "Commander Ryeo: ...Impossible. She was never going to be a battery. She's not a tool. We were wrong about what she was. (She orders a retreat.)",
          "Prof. Song (comms): She's frightened, and testing you. The old texts say she binds only to a guardian she deems worthy of protecting the south.",
          "Prof. Song: Your Master Ball — this is the moment Dosik meant. Weaken her first, then throw it.",
          `${rivalTrainerName(this.registry)}: Go on. She's been waiting longer than either of us has been alive.`,
        ], () => { summitVisual.destroy(); launchBattle(); });
      }));
    } else {
      this.dialog.show(["나비할망 still thrashes at the summit, testing you. Steady your team and try again."], () => {
        playAppearance(summitVisual, () => { summitVisual.destroy(); launchBattle(); });
      });
    }
  }

  private checkExits() {
    if (this.cutsceneActive) return;
    // South → back down to Jeju Vents Portal
    if (this.py > (ROWS - 1) * TILE) {
      this.cutsceneActive = true;
      this.cameras.main.fadeOut(400, 0, 0, 0, () => {
        this.registry.set('jejuVentsPortReturnX', 10 * TILE + 16); this.registry.set('jejuVentsPortReturnY', 3 * TILE + 16);
        this.scene.start('JejuVentsPortScene');
      });
    }
  }

  // ── Cinematic helpers ─────────────────────────────────────────────────────
  /** Wrap a set of game objects into a screen-space container that ignores the
   *  camera zoom, so cutscene art always fills the viewport cleanly. */
  private cutsceneRoot(kids: Phaser.GameObjects.GameObject[], depth = 117): Phaser.GameObjects.Container {
    const W = this.scale.width, H = this.scale.height;
    const root = this.add.container(0, 0, kids).setScrollFactor(0).setDepth(depth);
    const zoom = this.cameras.main?.zoom ?? 1, s = 1 / zoom;
    root.setScale(s); root.setPosition((W / 2) * (1 - s), (H / 2) * (1 - s));
    return root;
  }

  /** A drifting field of volcanic embers, returned so it can be faded/destroyed. */
  private buildEmbers(): Phaser.GameObjects.Graphics {
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.graphics();
    const seeds = Array.from({ length: 26 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2, p: Math.random() * Math.PI * 2 }));
    const ev = this.time.addEvent({ delay: 50, loop: true, callback: () => {
      if (!g.active) { ev.remove(false); return; }   // stop once the graphics is destroyed
      g.clear();
      for (const s of seeds) {
        s.y -= 0.6 + s.r * 0.3; s.p += 0.08; s.x += Math.sin(s.p) * 0.5;
        if (s.y < -4) { s.y = H + 4; s.x = Math.random() * W; }
        g.fillStyle(0xff7a2a, 0.5); g.fillCircle(s.x, s.y, s.r);
        g.fillStyle(0xffd060, 0.6); g.fillCircle(s.x, s.y, s.r * 0.5);
      }
    }});
    g.once('destroy', () => ev.remove(false));
    return g;
  }

  /** Hand-drawn 나비할망 — a guardian moth with metallic, dancheong-patterned wings.
   *  Returns a container (wings animate via a flap tween). */
  private buildNabihalmang(): Phaser.GameObjects.Container {
    const glow = this.add.graphics();
    glow.fillStyle(0xaee9ff, 0.12); glow.fillCircle(0, 0, 150);
    glow.fillStyle(0x8fd0ff, 0.10); glow.fillCircle(0, 0, 105);
    glow.fillStyle(0xffffff, 0.06); glow.fillCircle(0, 0, 60);

    const wings = this.add.graphics();
    const drawWing = (d: number) => {
      // metallic wing plates (upper + lower)
      wings.fillStyle(0x3b414c, 1);
      wings.beginPath(); wings.moveTo(0, -8); wings.lineTo(d*100, -78); wings.lineTo(d*132, -14); wings.lineTo(d*74, 22); wings.closePath(); wings.fillPath();
      wings.fillStyle(0x2f333d, 1);
      wings.beginPath(); wings.moveTo(0, 8); wings.lineTo(d*76, 34); wings.lineTo(d*102, 86); wings.lineTo(d*36, 60); wings.closePath(); wings.fillPath();
      // dancheong roundels on the upper wing
      wings.fillStyle(0xd6392a, 0.95); wings.fillEllipse(d*74, -34, 48, 30);
      wings.fillStyle(0xf5c542, 0.95); wings.fillEllipse(d*74, -34, 30, 18);
      wings.fillStyle(0x2a8a4a, 0.9);  wings.fillEllipse(d*74, -34, 16, 10);
      wings.fillStyle(0x2a5aba, 1);    wings.fillCircle(d*74, -34, 4);
      wings.fillStyle(0x2a8a4a, 0.85); wings.fillEllipse(d*104, -16, 20, 13);
      // eyespot on the lower wing
      wings.fillStyle(0x14141c, 1);    wings.fillCircle(d*70, 56, 12);
      wings.fillStyle(0xaee9ff, 0.95); wings.fillCircle(d*70, 56, 6);
      wings.fillStyle(0xffffff, 0.9);  wings.fillCircle(d*68, 54, 2);
      // hammered-metal edge highlight
      wings.lineStyle(2, 0xcfd6dd, 0.7);
      wings.beginPath(); wings.moveTo(d*100, -78); wings.lineTo(d*132, -14); wings.strokePath();
      wings.beginPath(); wings.moveTo(d*36, 60); wings.lineTo(d*102, 86); wings.strokePath();
      // luminous fairy scales
      wings.fillStyle(0xaee9ff, 0.7);
      for (const [sx, sy] of [[44,-46],[86,-22],[58,22],[80,50],[112,-18]] as [number,number][]) wings.fillCircle(d*sx, sy, 2.2);
    };
    drawWing(1); drawWing(-1);

    const body = this.add.graphics();
    body.fillStyle(0x4a4038, 1); body.fillEllipse(0, -8, 22, 30);         // fuzzy thorax
    body.fillStyle(0x5a4e44, 0.6); body.fillEllipse(-3, -10, 12, 20);     // fur sheen
    body.fillStyle(0x2a2420, 1);
    for (let i = 0; i < 4; i++) body.fillEllipse(0, 8 + i * 10, 15 - i * 2, 9);  // segmented abdomen
    body.fillStyle(0x3a322c, 1); body.fillCircle(0, -28, 11);             // head
    body.fillStyle(0xaee9ff, 1); body.fillCircle(-4, -29, 3.4); body.fillCircle(4, -29, 3.4);  // glowing eyes
    body.fillStyle(0xffffff, 0.9); body.fillCircle(-5, -30, 1.3); body.fillCircle(3, -30, 1.3);
    body.lineStyle(2, 0x2a2420, 1);                                       // feathery antennae
    body.beginPath(); body.moveTo(-3, -37); body.lineTo(-18, -58); body.strokePath();
    body.beginPath(); body.moveTo(3, -37); body.lineTo(18, -58); body.strokePath();
    body.fillStyle(0x2a2420, 1);
    for (let i = 0; i < 6; i++) { body.fillCircle(-6 - i * 2.4, -40 - i * 3.4, 1.7); body.fillCircle(6 + i * 2.4, -40 - i * 3.4, 1.7); }

    const c = this.add.container(0, 0, [glow, wings, body]);
    this.tweens.add({ targets: wings, scaleX: 0.72, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: glow, alpha: 0.55, scale: 1.12, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    return c;
  }

  /** Commander Ryeo — drawn in the player's own clean pixel style (drawNpcBody),
   *  in her plum 노스단 coat with magenta trim, a hair streak and a blood mark. */
  private buildCommanderRyeo(bloodied = true): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    drawNpcBody(g, 0x2a1a2c, { hair: 0x141018, skin: 0xf0c8a0 });   // base body, player style
    // Commander accents layered on top
    g.fillStyle(0xaa3366, 1); g.fillRect(-8, -9, 16, 1);            // magenta shoulder trim
    g.fillStyle(0xaa3366, 1); g.fillRect(-1, -7, 2, 8);            // coat placket
    g.fillStyle(0xaa3366, 1); g.fillCircle(-4, -3, 1.4);          // 노스단 emblem
    g.fillStyle(0xaa3366, 1); g.fillRect(3, -23, 3, 6);           // magenta hair streak
    if (bloodied) { g.fillStyle(0x9a1a1a, 0.9); g.fillRect(-5, -15, 1.5, 5); }  // blood streak on cheek
    markTrainerPortrait(g, 'jeju-ryeo-final');
    g.setData('characterGender3D', 'girl');
    return g;
  }

  /** Director Suri — the same player-style body, olive coat with gold trim. */
  private buildDirectorSuri(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    drawNpcBody(g, 0x33341f, { hair: 0x4a3a1a, skin: 0xf0c8a0 });
    g.fillStyle(0xccaa44, 1); g.fillRect(-8, -9, 16, 1);           // gold shoulder trim
    g.fillStyle(0xccaa44, 1); g.fillRect(-1, -7, 2, 8);           // coat placket
    markTrainerPortrait(g, 'suri-director');
    g.setData('characterGender3D', 'girl');
    return g;
  }

  /** The visible restraint field around 나비할망 before the release cue.
   *  It is authored as a world-space Graphics object, so OverworldMirror
   *  presents the field as an extruded 3D prop while the creature itself uses
   *  the real generated GLB below. */
  private buildNabihalmangRestraint(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(18);
    g.fillStyle(0x160f2c, 0.34);
    g.fillRect(-98, -120, 196, 150);
    g.lineStyle(3, 0x7f55ff, 0.9);
    g.strokeRect(-98, -120, 196, 150);
    g.lineStyle(2, 0xd8b4ff, 0.7);
    g.strokeCircle(0, -52, 76);
    g.lineStyle(1.5, 0x62d9ff, 0.9);
    g.lineBetween(-76, -52, 76, -52);
    g.lineBetween(0, -128, 0, 24);
    g.lineBetween(-66, -112, 66, 8);
    g.lineBetween(66, -112, -66, 8);
    for (const [x, y] of [[-98, -120], [98, -120], [-98, 30], [98, 30]] as [number, number][]) {
      g.fillStyle(0xcfa8ff, 1);
      g.fillCircle(x, y, 5);
      g.fillStyle(0x6f45d8, 1);
      g.fillCircle(x, y, 2);
    }
    return g;
  }

  /** Build every required actor for the complete summit confrontation up
   *  front. The returned objects are deliberately not tied to the short
   *  release animation: they remain in the world during the preceding
   *  restraint dialog, the release dialog and the capture hand-off. */
  private buildNabihalmangEventVisuals(): NabihalmangEventVisual {
    const stageX = SUMMIT_STAGE_X;
    const stageY = SUMMIT_STAGE_Y;

    const restraint = this.buildNabihalmangRestraint()
      .setPosition(stageX, stageY - 50);
    // No generated appearance animation yet: this is the restrained, static
    // 3D map presentation that must be visible before the release cue.
    const restrainedNabi = this.buildNabihalmangModel(
      stageX, stageY - TILE * 0.65, 3.2, false,
    ).setDepth(19);

    const ryeo = this.buildCommanderRyeo(false)
      .setPosition(stageX - TILE * 2.8, stageY).setDepth(19);
    const suri = this.buildDirectorSuri()
      .setPosition(stageX + TILE * 2.8, stageY).setDepth(19);
    const operativeL = this.buildSuriOperative(stageX - TILE * 4.0, stageY + TILE * 0.9);
    const operativeR = this.buildSuriOperative(stageX + TILE * 4.0, stageY + TILE * 0.9);
    const rival = this.add.graphics()
      .setPosition(stageX - TILE * 1.15, stageY + TILE * 1.1).setDepth(19);
    drawTrainerBody(rival, 1, 0, rivalDesign(this.registry));
    markRivalPortrait(rival, this.registry);

    for (const human of [ryeo, suri, operativeL, operativeR, rival]) {
      human.setData('characterLookAt3D', { x: stageX, y: stageY - TILE });
    }

    const rLabel = this.add.text(stageX - TILE * 2.8, stageY - 28, speakerName('Cmdr Ryeo'), {
      fontSize: '9px', color: '#ff99bb', backgroundColor: '#00000099', padding: { x: 2, y: 1 }, align: 'center',
    }).setOrigin(0.5).setDepth(20);
    const sLabel = this.add.text(stageX + TILE * 2.8, stageY - 28, speakerName('Dir. Suri'), {
      fontSize: '9px', color: '#ffdd88', backgroundColor: '#00000099', padding: { x: 2, y: 1 }, align: 'center',
    }).setOrigin(0.5).setDepth(20);
    const vLabel = this.add.text(stageX - TILE * 1.15, stageY + TILE * 1.1 - 24, rivalTrainerName(this.registry), {
      fontSize: '8px', color: '#9ad0ff', backgroundColor: '#00000099', padding: { x: 2, y: 1 }, align: 'center',
    }).setOrigin(0.5).setDepth(20);

    const objects: Phaser.GameObjects.GameObject[] = [
      restraint, restrainedNabi, ryeo, suri, operativeL, operativeR, rival,
      rLabel, sLabel, vLabel,
    ];
    let destroyed = false;
    const visual: NabihalmangEventVisual = {
      stageX, stageY, restraint, restrainedNabi, ryeo, suri, operativeL, operativeR, rival,
      rLabel, sLabel, vLabel,
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        this.playerG.setData('characterLookAt3D', null);
        if (visual.freedNabi?.scene) visual.freedNabi.destroy();
        for (const object of objects) object.destroy();
        this.tweens.killTweensOf([...objects, visual.freedNabi].filter(Boolean));
      },
    };
    return visual;
  }

  /** Phaser image fallback backed by the generated true-3D 나비할망 GLB. */
  private buildNabihalmangModel(
    x: number, footY: number, height3D: number, animateAppearance = true,
  ): Phaser.GameObjects.Image {
    const src = this.textures.get('nabihalmang').getSourceImage() as { width?: number; height?: number };
    const displayH = height3D * TILE;
    const img = this.add.image(x, footY - displayH / 2, 'nabihalmang').setDepth(19);
    img.setScale(displayH / Math.max(1, src.height ?? 1));
    img.setData('creatureModel3DKey', 'nabihalmang');
    img.setData('creatureHeight3D', height3D);
    if (animateAppearance) img.setData('creatureAnimation3D', 'nabihalmang-appearance');
    img.setData('facePlayer3D', true);
    return img;
  }

  /** One 노스단 operative, guaranteed to become an opaque 3D humanoid. */
  private buildSuriOperative(x: number, y: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setPosition(x, y).setDepth(19);
    drawNpcBody(g, 0x16161c, { hair: 0x101014, skin: 0xe9bd92 });
    g.setData('characterModel3DKey', 'generated_boy');
    g.setData('characterGender3D', 'boy');
    g.setData('characterProfile3D', {
      hair: 0x101014, outfit: 0x16161c, secondary: 0x2d3038,
      accent: 0x9e2731, outfitStyle: 'uniform', hairStyle: 'short',
    });
    return g;
  }

  /** Commander Ryeo stands next to the player on the map as an ordinary,
   *  player-sized 2D overworld sprite for the confrontation dialogue — no
   *  enlargement, no floating. Returns the objects so they can be destroyed. */
  private buildRyeoConfrontation(): { destroy: () => void } {
    // Turn the player to face Ryeo (she stands just above, to the north).
    this.facing = 1; this.drawChar();

    const rx = this.px, ry = this.py - 2 * TILE;            // Ryeo stands a couple tiles north
    const ryeo = this.buildCommanderRyeo(true).setPosition(rx, ry).setDepth(19);
    ryeo.setData('characterLookAt3D', { x: this.px, y: this.py });
    this.playerG.setData('characterLookAt3D', { x: rx, y: ry });

    const rLabel = this.add.text(rx, ry - 24, speakerName('Commander Ryeo'), {
      fontSize: '8px', color: '#ff99bb', backgroundColor: '#000000aa', padding: { x: 2, y: 1 }, align: 'center',
    }).setOrigin(0.5).setDepth(20);

    // The rival stands beside you (to the west), also facing Ryeo — a normal 2D sprite.
    const rivalG = this.add.graphics().setPosition(this.px - TILE, this.py);
    drawTrainerBody(rivalG, 1, 0, rivalDesign(this.registry));   // facing up (back), like the player
    markRivalPortrait(rivalG, this.registry);
    rivalG.setData('characterLookAt3D', { x: rx, y: ry });
    rivalG.setDepth(19);
    // The rival's name is gender-based: 'Minhyuk' (male) / 'Soohyun' (female).
    const rivalName = rivalTrainerName(this.registry);
    const vLabel = this.add.text(this.px - TILE, this.py - 24, rivalName, {
      fontSize: '8px', color: '#9ad0ff', backgroundColor: '#000000aa', padding: { x: 2, y: 1 }, align: 'center',
    }).setOrigin(0.5).setDepth(20);

    // Prof. Song stands to your east — a 2D overworld sprite in his lab coat.
    const songG = this.add.graphics().setPosition(this.px + TILE, this.py);
    drawNpcBody(songG, 0xe6e6ea, { hair: 0x4a4038 });                // white lab coat, greying hair
    songG.fillStyle(0x222222, 1); songG.fillRect(-6, -16, 12, 1);    // glasses bar
    songG.fillStyle(0x8a1a1a, 1); songG.fillRect(-1, -7, 2, 4);      // tie
    markTrainerPortrait(songG, 'prof-song');
    songG.setData('characterGender3D', 'boy');
    songG.setData('characterLookAt3D', { x: rx, y: ry });
    songG.setDepth(19);
    const gLabel = this.add.text(this.px + TILE, this.py - 24, speakerName('Prof. Song'), {
      fontSize: '8px', color: '#aef0c0', backgroundColor: '#000000aa', padding: { x: 2, y: 1 }, align: 'center',
    }).setOrigin(0.5).setDepth(20);

    // 나비할망 settles beside the player as her generated GLB, not a flat
    // hand-drawn container.
    const nabi = this.buildNabihalmangModel(this.px + TILE * 0.55, this.py - TILE * 0.2, 1.8);

    const objects: Phaser.GameObjects.GameObject[] = [ryeo, rLabel, rivalG, vLabel, songG, gLabel, nabi];
    return { destroy: () => {
      this.playerG.setData('characterLookAt3D', null);
      for (const object of objects) object.destroy();
    } };
  }

  /** The capture intro — 나비할망 breaks the restraint field as 노스단 recoils. */
  private playNabihalmangScene(visual: NabihalmangEventVisual, onComplete: () => void) {
    const W = this.scale.width, H = this.scale.height;
    const { stageX, stageY } = visual;

    // Atmosphere stays a 2D overlay; every actual person/creature below lives
    // in world space so OverworldMirror can replace it with a true 3D model.
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x1a0014, 0)
      .setOrigin(0.5).setScrollFactor(0).setDepth(116);
    const embers = this.buildEmbers().setAlpha(0).setScrollFactor(0).setDepth(117);
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0)
      .setOrigin(0.5).setScrollFactor(0).setDepth(121);

    // The restrained model was already visible during the opening dialog. At
    // the release cue, swap it for a second tagged image so OverworldMirror
    // can start the generated 3D entrance animation exactly here, rather than
    // consuming that animation while the creature is still in the rig.
    const freedNabi = this.buildNabihalmangModel(
      stageX, stageY - TILE * 0.65, 3.2, true,
    ).setDepth(19).setAlpha(0);
    visual.freedNabi = freedNabi;

    const label = this.add.text(W / 2, H * 0.22, '🦋 나비할망', {
      fontSize: '18px', color: '#aee9ff', fontStyle: 'bold', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setAlpha(0).setScrollFactor(0).setDepth(120);

    const transientVisuals: Phaser.GameObjects.GameObject[] = [dim, embers, flash, label];

    // The actors and the restraint are already visible. Only the atmosphere,
    // restraint fade, and liberated 3D model animate at this point.
    this.tweens.add({ targets: dim, alpha: 0.6, duration: 800 });
    this.tweens.add({ targets: embers, alpha: 1, duration: 800, delay: 200 });
    this.tweens.add({ targets: [visual.restrainedNabi, visual.restraint], alpha: 0, duration: 500, delay: 350 });
    this.tweens.add({ targets: freedNabi, alpha: 1, y: `-=${TILE * 1.4}`, duration: 1500, delay: 500, ease: 'Cubic.Out' });
    this.tweens.add({ targets: label, alpha: 1, duration: 900, delay: 900 });

    // The restraint field SHATTERS — a bright flash + shockwave
    this.time.delayedCall(1900, () => {
      this.cameras.main.shake(320, 0.006);
      this.tweens.add({ targets: flash, alpha: 0.85, duration: 90, yoyo: true });
      this.tweens.add({ targets: [visual.ryeo, visual.operativeL], x: `-=${TILE * 0.8}`, duration: 420, ease: 'Cubic.Out' });
      this.tweens.add({ targets: [visual.suri, visual.operativeR], x: `+=${TILE * 0.8}`, duration: 420, ease: 'Cubic.Out' });
    });

    this.time.delayedCall(3000, () => {
      // Do not fade the essential actors or the freed moth. They must remain
      // on the map while the post-release dialog is being advanced.
      this.tweens.add({ targets: transientVisuals, alpha: 0, duration: 600 });
      this.time.delayedCall(700, () => {
        for (const transient of transientVisuals) transient.destroy();
        onComplete();
      });
    });
  }
}
