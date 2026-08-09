import Phaser from 'phaser';
import * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { buildThemedBattleArena, resolveBattleArenaTheme } from './BattleArenaThemes';
import { buildGeographicBattleArena, resolveOutdoorBattleTheme } from './BattleGeography';
import { buildCharacterModel, PlayerModel } from './CharacterModel';
import { CreatureAnimator, MoveCategory } from './CreatureAnimator';
import { measureCommands } from './GraphicsRaster';
import { getModel, hasModel, isRenderableModel, modelLoadStatus, primeManifest } from './GlbModels';
import { MoveFX3D } from './MoveFX3D';
import { makeBlobShadow } from './Props';
import { spriteScale } from '../data/SpriteScale';
import { battleFallbackSprite } from '../data/BattleFallbackSprites';
import { EnvProfile, ThreeStage } from './ThreeStage';

// ── Battle mirror ────────────────────────────────────────────────────────────
// Turns the existing 2D battle scenes into a cinematic 3D arena without
// touching battle logic. A Pokémon remains its authored 2D image until its
// local GLB is fully loaded and validated; there is no sprite extrusion or
// code-built creature substitute. All battle UI stays 2D on top.

type GO = Phaser.GameObjects.GameObject & {
  x?: number; y?: number; alpha?: number; visible?: boolean;
  scaleX?: number; scaleY?: number; angle?: number;
  displayWidth?: number; displayHeight?: number; flipX?: boolean;
  tintTopLeft?: number; isTinted?: boolean; tintFill?: boolean;
};

interface Combatant {
  obj: GO & Phaser.GameObjects.Image;
  holder: THREE.Group;
  shadow: THREE.Mesh;
  side: 'player' | 'enemy';
  slot: number;
  base: { x: number; y: number } | null;
  settleTimer: number;
  lastPos: { x: number; y: number };
  speed: number;
  /** the sprite's scale at adoption — later tweened scales are applied as ratios. */
  baseSX: number | null; baseSY: number | null;
  lastSX: number; scaleStill: number;
  /** Local production GLB support. */
  glbKey: string | null;
  glb: THREE.Group | null;
  glbVerifyFrames: number;
  glbHealthTimer: number;
  rejectedGlbKey: string | null;
  targetH: number;
  /** battle motion driver (clip playback or procedural) */
  anim: CreatureAnimator | null;
  fainted: boolean;
  chargeLift: number;
  chargeTarget: number;
  /** texture signature — rebuilt when the game swaps the sprite's texture
   *  (async PokeAPI art arriving, party switches). */
  texSig: string;
  /** A readable Phaser sprite stays on top until a validated GLB is ready. */
  fallback2D: boolean;
  /** Dedicated screen-space copy. The battle-owned sprite remains untouched so
   *  its tweens, switching and damage logic continue to be the source of truth. */
  fallbackSprite: Phaser.GameObjects.Image | null;
  fallbackTextureKey: string | null;
}

const ANCHORS = {
  // Slot 1 stays beside slot 0: intro portraits hand the spot to the Pokémon,
  // so both must occupy the same stage position.
  player: [new THREE.Vector3(-1.85, 0, 1.15), new THREE.Vector3(-2.1, 0, 1.3)],
  enemy:  [new THREE.Vector3(2.0, 0, -2.4), new THREE.Vector3(2.25, 0, -2.6)],
};

// A few species are intentionally much larger than the normalised battle
// silhouette. The 2D fit already enlarges their sprite, but the 3D mirror
// clamps source-image size so high-resolution art cannot become enormous.
// Restore the authored stage presence after that safety clamp.
const BATTLE_SIZE_OVERRIDES: Record<string, number> = {
  // Nabihalmang's wingspan was crowding the opposing battler in the 3D arena;
  // keep the 2D battle art unchanged and use a slightly smaller 3D stage size.
  nabihalmang: 1.05,
  palmcockatoo: 1.45,
  bosongnun: 0.72,
  yeomtaeja: 0.78,
  thanatoat: 1.13,
  banderado: 1.10,
  pipetiger: 1.12,
};

function battleSizeOverride(textureKey: string): number {
  const explicit = BATTLE_SIZE_OVERRIDES[textureKey];
  if (explicit) return explicit;
  // The GLB pipeline deliberately clamps raw display-height influence
  // to 1.15. Restore the remainder of the authored species multiplier so large
  // Pokémon such as Garchomp and Tyranitar stay imposing in 3D as well as 2D.
  return Math.max(1, spriteScale(textureKey) / 1.15);
}

// Battle trainers share their side's Pokémon anchor, then retire when the
// portrait alpha fades for the send-out. Rival trainers walk in from behind.
const TRAINER_START = {
  player: new THREE.Vector3(-3.35, 0, 3.05),
  enemy: new THREE.Vector3(3.4, 0, -4.7),
};

interface TrainerWalker {
  obj: GO;                 // the 2D intro portrait whose alpha drives the walk
  model: PlayerModel;
  group: THREE.Group;
  t: number;               // walk-in progress 0..1
  phase: number;           // leg-swing phase
  seen: boolean;           // portrait has been visible at least once
  walkIn: boolean;         // rival enters; other major trainers hold the anchor
  side: 'player' | 'enemy';
  start: THREE.Vector3;
  end: THREE.Vector3;
}

interface Pinned2DTrainer {
  side: 'player' | 'enemy';
  originalX: number;
  originalY: number;
}

interface ScreenTargetRequest {
  target: GO;
  x: number;
  y: number;
  /** Fraction of the combatant's height to target (0 = feet, 1 = top). */
  heightRatio?: number;
}

interface ChargeFxRequest {
  target: GO;
  phase: 'charge' | 'release';
  mode: 'air' | 'underground' | 'charge';
}

export class BattleMirror {
  readonly scene: Phaser.Scene;
  private stage: ThreeStage;
  private rig: CameraRig;
  private root: THREE.Group;
  private combatants = new Map<GO, Combatant>();
  private trainers: TrainerWalker[] = [];
  private pinned2DTrainers = new Map<GO & Phaser.GameObjects.Image, Pinned2DTrainer>();
  private hiddenBackdrops = new Set<GO>();
  // Phaser adds factory-created objects to the display list before the caller's
  // fluent setup runs. Defer classification until the next frame so Graphics
  // have their draw commands and Images have final no3d tags/sizing.
  private pendingObjects = new Set<GO>();
  private active3D = true;
  private time = 0;
  private built = false;
  private onAdded: (obj: Phaser.GameObjects.GameObject) => void;
  private fx: MoveFX3D;
  private pendingBursts: {
    at: THREE.Vector3; color: number; eff: number; t: number;
    moveType: string; moveName: string; power: number;
  }[] = [];
  private onMoveFx: (d: {
    attacker: GO; target: GO; color: number; category: string; effectiveness: number;
    moveType?: string; moveName?: string; power?: number;
  }) => void;
  private onScreenTarget: (d: ScreenTargetRequest) => void;
  private onChargeFx: (d: ChargeFxRequest) => void;
  private readonly projectionPoint = new THREE.Vector3();
  private readonly facingVector = new THREE.Vector3();

  constructor(scene: Phaser.Scene, stage: ThreeStage, rig: CameraRig) {
    this.scene = scene;
    this.stage = stage;
    this.rig = rig;
    this.root = stage.resetWorld();
    primeManifest();                 // local production GLB models, if the game ships any
    stage.setEnvironment(this.buildArena());
    rig.setMode('battle');
    this.fx = new MoveFX3D(this.root);
    this.onMoveFx = (d) => this.handleMoveFx(d);
    this.onScreenTarget = (d) => this.projectCombatantToScreen(d);
    this.onChargeFx = (d) => {
      const cb = this.combatants.get(d.target);
      if (!cb) return;
      cb.chargeTarget = d.phase === 'release' ? 0
        : d.mode === 'air' ? 2.8 : d.mode === 'underground' ? -0.65 : 0.75;
      if (d.phase === 'charge') this.rig.focusOn(cb.holder.position, 0.65);
    };
    scene.events.on('pk3d-movefx', this.onMoveFx);
    scene.events.on('pk3d-screen-target', this.onScreenTarget);
    scene.events.on('pk3d-chargefx', this.onChargeFx);
    this.onAdded = (obj) => this.pendingObjects.add(obj as GO);
    scene.events.on('addedtoscene', this.onAdded);
    for (const obj of scene.children.list) this.consider(obj as GO);
    this.built = true;
  }

  destroy(): void {
    this.scene.events.off('addedtoscene', this.onAdded);
    this.scene.events.off('pk3d-movefx', this.onMoveFx);
    this.scene.events.off('pk3d-screen-target', this.onScreenTarget);
    this.scene.events.off('pk3d-chargefx', this.onChargeFx);
    for (const cb of this.combatants.values()) this.destroyFallbackSprite(cb);
    this.combatants.clear();
    for (const w of this.trainers) this.root.remove(w.group);
    this.trainers.length = 0;
    this.pinned2DTrainers.clear();
    this.hiddenBackdrops.clear();
    this.pendingObjects.clear();
  }

  /** Return the live Phaser-screen position of a point on a 3D combatant. */
  private projectCombatantToScreen(d: ScreenTargetRequest): void {
    if (!this.active3D) return;        // F3 2D mode keeps the sprite fallback
    const cb = this.combatants.get(d.target);
    if (!cb) return;                  // 2D mode / unmirrored object keeps fallback

    const p = this.projectionPoint.copy(cb.holder.position);
    const heightRatio = Math.min(1, Math.max(0, d.heightRatio ?? 0.52));
    p.y += cb.targetH * heightRatio;  // aim at the torso, not above the head

    const camera = this.stage.camera;
    camera.updateMatrixWorld();
    p.project(camera);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.z < -1 || p.z > 1) return;

    d.x = (p.x + 1) * 0.5 * this.scene.scale.width;
    d.y = (1 - p.y) * 0.5 * this.scene.scale.height;
  }

  /** Mirror a 2D move as a 3D effect: special = orb projectile with an arc,
   *  physical = impact burst timed to the (already-mirrored) lunge. */
  private handleMoveFx(d: {
    attacker: GO; target: GO; color: number; category: string;
    moveType?: string; moveName?: string; power?: number; effectiveness: number;
  }): void {
    const atk = this.combatants.get(d.attacker);
    const tgt = this.combatants.get(d.target);
    if (!atk || !tgt) return;
    const from = atk.holder.position.clone(); from.y += 1.0;
    const to = tgt.holder.position.clone(); to.y += 0.9;
    const dir = tgt.holder.position.clone().sub(atk.holder.position);
    const category = (d.category === 'special' || d.category === 'status' ? d.category : 'physical') as MoveCategory;
    // Stronger moves swing harder; PokeAPI power tops out around 120.
    const powerScale = 0.7 + Math.min(1.2, (d.power ?? 60) / 100) * 0.6;

    // Damaging moves act out an attack and impact. Utility moves instead hold
    // on the affected Pokémon so a heal/rank aura never looks like self-damage.
    if (category !== 'status') {
      atk.anim?.attack(category, dir, powerScale, () => {
        tgt.anim?.hit(d.effectiveness > 1 ? 1.3 : 1);
        this.rig.focusOn(tgt.holder.position, 0.7);
        this.rig.addShake(d.effectiveness > 1 ? 0.7 : 0.45);
      });
    } else {
      this.rig.focusOn(atk.holder.position, 0.5);
    }

    if (category === 'special') {
      this.fx.playSpecial(from, to, d.moveType ?? 'normal', d.moveName ?? 'Move', d.color, d.power ?? 60, d.effectiveness, () => {
        if (!atk.anim) {                      // relief battlers: FX drives the beat
          tgt.anim?.hit(1);
          this.rig.focusOn(tgt.holder.position, 0.8);
          this.rig.addShake(d.effectiveness > 1 ? 0.7 : 0.45);
        }
      });
    } else if (category === 'physical') {
      this.pendingBursts.push({
        at: to.clone(), color: d.color, eff: d.effectiveness, t: 0.18,
        moveType: d.moveType ?? 'normal', moveName: d.moveName ?? 'Move', power: d.power ?? 60,
      });
      if (!atk.anim) this.rig.focusOn(tgt.holder.position, 0.6);
    } else {
      // Status move: a layered type aura on the user, no fake projectile.
      this.fx.statusAura(atk.holder.position.clone(), d.moveType ?? 'normal', d.moveName ?? 'Status', d.color);
    }
  }

  // ── Arena ──
  /** Build either a story interior or the geography of the return map. */
  private buildArena(): EnvProfile {
    const theme = resolveBattleArenaTheme(this.scene);
    if (theme) {
      buildThemedBattleArena(this.root, theme);
      return 'interior';
    }
    return buildGeographicBattleArena(this.root, resolveOutdoorBattleTheme(this.scene));
  }

  // ── Sprite adoption ──
  private consider(obj: GO): void {
    if (this.combatants.has(obj) || this.hiddenBackdrops.has(obj)) return;

    // The painted 2D backdrop (sky/field/mountains) is one near-fullscreen
    // Graphics — hide it so the 3D arena shows. Small graphics (HP accents,
    // the thrown ball, move FX) stay 2D on top.
    if (obj instanceof Phaser.GameObjects.Graphics) {
      // Custom battle scenes can identify their backdrop explicitly. This is
      // authoritative and avoids relying on command-buffer measurement for
      // complex art such as Jin's gradient-filled night skyline.
      if (obj.getData('pk3dBackdrop')) {
        this.hiddenBackdrops.add(obj);
        this.scene.cameras.main.ignore(obj);
        return;
      }
      const buf = (obj as unknown as { commandBuffer: unknown[] }).commandBuffer;
      if (buf?.length) {
        const m = measureCommands(buf);
        if (m) {
          const W = this.scene.scale.width, H = this.scene.scale.height;
          if ((m.maxX - m.minX) >= W * 0.7 && (m.maxY - m.minY) >= H * 0.55) {
            this.hiddenBackdrops.add(obj);
            this.scene.cameras.main.ignore(obj);
          }
        }
      }
      return;
    }
    // 2D projectile orbs (circles) are replaced by the 3D move effects.
    if (obj instanceof Phaser.GameObjects.Arc) {
      this.hiddenBackdrops.add(obj);
      this.scene.cameras.main.ignore(obj);
      return;
    }
    if (!(obj instanceof Phaser.GameObjects.Image) && !(obj instanceof Phaser.GameObjects.Sprite)) return;
    const im = obj as GO & Phaser.GameObjects.Image;
    // Explicit 2D artwork always wins over trainer/model tags. Major battle
    // portraits use this to stay on Phaser's foreground above the 3D arena.
    if ((im as Phaser.GameObjects.Image).getData?.('no3d')) {
      const side = (im as Phaser.GameObjects.Image).getData?.('battleTrainer2DAnchor') as ('player' | 'enemy' | undefined);
      if ((side === 'player' || side === 'enemy') && !this.pinned2DTrainers.has(im)) {
        this.pinned2DTrainers.set(im, {
          side,
          originalX: im.x ?? 0,
          originalY: im.y ?? 0,
        });
      }
      return;
    }
    // A scene can promote a battle trainer to a walking 3D character (the rival
    // striding in toward the player) by tagging its intro portrait with
    // `battleTrainer: 'boy' | 'girl'`. Spawn the 3D walker and keep the flat 2D
    // portrait off the render layer while it plays.
    const trainerDesign = (im as Phaser.GameObjects.Image).getData?.('battleTrainer') as ('boy' | 'girl' | undefined);
    const trainerAtEnemy = !!(im as Phaser.GameObjects.Image).getData?.('battleTrainerEnemyAnchor');
    const trainerAtPlayer = !!(im as Phaser.GameObjects.Image).getData?.('battleTrainerPlayerAnchor');
    const pokemonSide = (im as Phaser.GameObjects.Image).getData?.('battlePokemonSide') as ('player' | 'enemy' | undefined);
    const modelKey = (im as Phaser.GameObjects.Image).getData?.('characterModel3DKey') as string | undefined;
    if (trainerDesign || trainerAtEnemy || trainerAtPlayer) {
      const taggedGender = (im as Phaser.GameObjects.Image).getData?.('characterGender3D') as ('boy' | 'girl' | undefined);
      this.spawnTrainer(
        im,
        trainerDesign ?? taggedGender ?? (modelKey?.includes('girl') ? 'girl' : 'boy'),
        modelKey ?? im.texture.key,
        !!trainerDesign,
        trainerAtPlayer ? 'player' : 'enemy',
      );
      return;
    }
    const dw = im.displayWidth ?? 0, dh = im.displayHeight ?? 0;
    const W = this.scene.scale.width, H = this.scene.scale.height;

    // Fullscreen art = backdrop → hide (the 3D arena replaces it).
    if (dw >= W * 0.85 && dh >= H * 0.85) {
      this.hiddenBackdrops.add(im);
      this.scene.cameras.main.ignore(im);
      return;
    }
    // Named trainer portraits can become narrower than 70px after fitPortrait()
    // (Baekho's tall artwork is 56px wide). Never mistake an explicitly pinned
    // trainer for a UI icon or it remains in Phaser's upper-left battle layer
    // instead of being handed to the enemy Pokémon's 3D arena anchor.
    if (!pokemonSide && !trainerAtEnemy && (dw < 70 || dh < 70)) return; // icons stay 2D
    // Battle layout puts the ENEMY zone in the upper screen area and the
    // player's in the lower-left — classify by both axes so intro portraits
    // (drawn upper-middle at the enemy spot) never land on the player side.
    const side: 'player' | 'enemy' = pokemonSide ?? (trainerAtEnemy ? 'enemy'
      : ((im.y ?? 0) < H * 0.32 || (im.x ?? 0) > W * 0.6) ? 'enemy' : 'player');
    const slot = pokemonSide || trainerAtEnemy ? 0
      : [...this.combatants.values()].filter(cb => cb.side === side).length % 2;

    const sizeBias = Math.min(1.15, Math.max(0.85, dh / 220));
    const speciesSize = battleSizeOverride(im.texture.key);
    const holder = new THREE.Group();
    const shadow = makeBlobShadow(Math.min(1.5, Math.max(0.42, dw / 190)));
    shadow.visible = false;
    holder.add(shadow);

    const anchor = ANCHORS[side][slot];
    holder.position.copy(anchor);
    // The holder remains at the authoritative battle anchor while a screen-space
    // 2D copy is shown. It becomes visible only after a validated GLB attaches.
    holder.rotation.y = side === 'player' ? Math.PI * 0.88 : Math.PI * 0.06;
    holder.visible = false;

    this.root.add(holder);
    const combatant: Combatant = {
      obj: im, holder, shadow, side, slot,
      base: null, settleTimer: 0,
      lastPos: { x: im.x ?? 0, y: im.y ?? 0 }, speed: 0,
      baseSX: null, baseSY: null,
      lastSX: Math.abs(im.scaleX ?? 1), scaleStill: 0,
      glbKey: !trainerAtEnemy && hasModel(im.texture.key) ? im.texture.key : null,
      glb: null,
      glbVerifyFrames: 0,
      glbHealthTimer: 0,
      rejectedGlbKey: null,
      // Volumetric GLB models read smaller than flat art at equal height (they have
      // real depth), so give them extra presence — SwSh-scale battlers.
      targetH: (side === 'enemy' ? 1.92 : 1.58) * Math.min(1.25, Math.max(0.95, dh / 220)) * speciesSize,
      anim: null,
      fainted: false,
      chargeLift: 0,
      chargeTarget: 0,
      texSig: `${im.texture.key}:${im.frame?.name ?? 0}`,
      fallback2D: true,
      fallbackSprite: null,
      fallbackTextureKey: null,
    };
    this.combatants.set(im, combatant);
    this.use2DFallback(combatant);
  }

  /** Rebind a battler when the battle scene swaps its species/texture. */
  private refreshCombatant(cb: Combatant): boolean {
    const im = cb.obj;
    const dh = im.displayHeight ?? 0;
    const speciesSize = battleSizeOverride(im.texture.key);
    cb.base = null;
    cb.settleTimer = 0;
    cb.baseSX = null; cb.baseSY = null; cb.scaleStill = 0;   // re-settle on the new art
    cb.targetH = (cb.side === 'enemy' ? 1.92 : 1.58) * Math.min(1.25, Math.max(0.95, dh / 220)) * speciesSize;
    // A different creature key means a different production GLB (or no GLB).
    const nk = hasModel(im.texture.key) ? im.texture.key : null;
    if (cb.rejectedGlbKey !== im.texture.key) cb.rejectedGlbKey = null;
    if (cb.glb && nk !== cb.glbKey) {
      cb.holder.remove(cb.glb);
      cb.glb = null;
      cb.anim = null;
      cb.shadow.visible = false;
      cb.glbVerifyFrames = 0;
      cb.glbHealthTimer = 0;
    }
    cb.glbKey = nk;
    cb.fainted = false;
    cb.anim?.standUp();
    if (cb.glb) {
      cb.fallback2D = false;
      this.destroyFallbackSprite(cb);
      cb.shadow.visible = true;
    } else {
      this.destroyFallbackSprite(cb);
      this.use2DFallback(cb);
    }
    return true;
  }

  /** Show a dedicated 2D copy at the projected battle anchor. Keeping the
   * battle-owned sprite hidden and untouched prevents its pre-intro/off-screen
   * coordinates from leaking into the 3D presentation. */
  private use2DFallback(cb: Combatant): void {
    cb.fallback2D = true;
    cb.holder.visible = false;
    cb.shadow.visible = false;
    this.scene.cameras.main.ignore(cb.obj);
    this.ensureFallbackSprite(cb);
    this.syncFallback2DCombatant(cb);
  }

  private ensureFallbackSprite(cb: Combatant): void {
    if (cb.fallbackSprite?.scene) return;

    const speciesKey = cb.rejectedGlbKey ?? cb.obj.texture.key;
    const authored = battleFallbackSprite(speciesKey);
    const initialKey = authored && this.scene.textures.exists(authored.key)
      ? authored.key
      : cb.obj.texture.key;
    const sprite = this.scene.add.image(0, 0, initialKey)
      .setOrigin(cb.obj.originX, cb.obj.originY)
      .setDepth(cb.obj.depth)
      .setData('no3d', true);
    cb.fallbackSprite = sprite;
    cb.fallbackTextureKey = authored?.key ?? initialKey;

    // TitleScene normally has these ready. This on-demand path also makes a
    // directly launched/debug battle recover correctly.
    if (authored && !this.scene.textures.exists(authored.key)) {
      const event = `filecomplete-image-${authored.key}`;
      this.scene.load.once(event, () => {
        if (cb.fallback2D && cb.fallbackSprite?.scene) {
          cb.fallbackSprite.setTexture(authored.key);
          this.syncFallback2DCombatant(cb);
        }
      });
      this.scene.load.image(authored.key, authored.url);
      if (!this.scene.load.isLoading()) this.scene.load.start();
    }
  }

  private destroyFallbackSprite(cb: Combatant): void {
    if (cb.fallbackSprite?.scene) cb.fallbackSprite.destroy();
    cb.fallbackSprite = null;
    cb.fallbackTextureKey = null;
  }

  /** Copy visual state from the real battler but pin the copy's feet to the
   * live 3D ground anchor. This keeps send-out/faint/tint animation intact. */
  private syncFallback2DCombatant(cb: Combatant, dt = 0): void {
    if (!this.active3D || !cb.fallback2D) return;
    this.ensureFallbackSprite(cb);
    const im = cb.fallbackSprite;
    if (!im?.scene) return;

    const source = cb.obj;
    const x = source.x ?? 0;
    const y = source.y ?? 0;
    const dx = x - cb.lastPos.x;
    const dy = y - cb.lastPos.y;
    cb.speed = cb.speed * 0.82 + (Math.abs(dx) + Math.abs(dy)) * 0.18;
    cb.lastPos.x = x;
    cb.lastPos.y = y;
    const visibleAndSettled = source.visible !== false && (source.alpha ?? 1) > 0.85;
    if (visibleAndSettled && Math.abs(dx) + Math.abs(dy) < 0.6) {
      cb.settleTimer += dt;
      if (cb.settleTimer > 0.25 && !cb.base) cb.base = { x, y };
    } else if (!visibleAndSettled) {
      cb.settleTimer = 0;
    }

    const camera = this.stage.camera;
    camera.updateMatrixWorld();
    const feet = this.projectionPoint.copy(ANCHORS[cb.side][cb.slot]).project(camera);
    if (!Number.isFinite(feet.x) || !Number.isFinite(feet.y) || feet.z < -1 || feet.z > 1) {
      im.setVisible(false);
      return;
    }

    // Preserve the battle scene's intended visual extent even when the legacy
    // sprite has a different source resolution or aspect ratio from HQ art.
    const sourceExtent = Math.max(Math.abs(source.displayWidth ?? 0), Math.abs(source.displayHeight ?? 0));
    const frameExtent = Math.max(1, im.frame.realWidth || im.width, im.frame.realHeight || im.height);
    im.setScale(sourceExtent / frameExtent)
      .setFlipX(!!source.flipX)
      .setFlipY(!!source.flipY)
      .setAngle(source.angle ?? 0)
      .setAlpha(source.alpha ?? 1)
      .setVisible(source.visible !== false && (source.alpha ?? 1) > 0.001);

    const tint = source as { tintTopLeft?: number; isTinted?: boolean; tintFill?: boolean };
    if (tint.isTinted && tint.tintTopLeft !== undefined) {
      if (tint.tintFill) im.setTintFill(tint.tintTopLeft);
      else im.setTint(tint.tintTopLeft);
    } else {
      im.clearTint();
    }

    const anchorX = (feet.x + 1) * 0.5 * this.scene.scale.width;
    const anchorY = (1 - feet.y) * 0.5 * this.scene.scale.height;
    const offsetX = cb.base ? (source.x - cb.base.x) : 0;
    const offsetY = cb.base ? (source.y - cb.base.y) : 0;
    im.setPosition(
      anchorX + (im.originX - 0.5) * im.displayWidth + offsetX,
      anchorY - (1 - im.originY) * im.displayHeight + offsetY,
    );
  }

  private syncFallback2DCombatants(dt: number): void {
    for (const cb of this.combatants.values()) {
      if (cb.fallback2D) this.syncFallback2DCombatant(cb, dt);
    }
  }

  private rejectGlbModel(cb: Combatant): void {
    cb.rejectedGlbKey = cb.glbKey ?? cb.obj.texture.key;
    if (cb.glb) cb.holder.remove(cb.glb);
    cb.glb = null;
    cb.glbKey = null;
    cb.glbVerifyFrames = 0;
    cb.glbHealthTimer = 0;
    cb.anim = null;
    cb.shadow.visible = false;
    // A confirmed GLB failure keeps the original authored sprite. No generated,
    // extruded or procedural creature is allowed to replace it.
    this.use2DFallback(cb);
  }

  /** Local yaw that points a battler's +Z/front axis straight at the live
   *  battle camera. Model-specific axis fixes remain baked inside the GLB. */
  private cameraFacingYaw(holder: THREE.Group): number {
    const toCamera = this.facingVector.copy(this.stage.camera.position).sub(holder.position);
    return Math.atan2(toCamera.x, toCamera.z) - holder.rotation.y;
  }

  // ── Battle trainer walk-in (rival striding toward the player) ──
  private spawnTrainer(
    im: GO & Phaser.GameObjects.Image,
    design: 'boy' | 'girl',
    modelKey: string,
    walkIn: boolean,
    side: 'player' | 'enemy',
  ): void {
    if (this.trainers.some(w => w.obj === im)) return;
    const model = buildCharacterModel(modelKey, design);
    model.group.scale.multiplyScalar(1.6);
    const holder = new THREE.Group();
    holder.add(model.group, makeBlobShadow(0.5));
    const start = TRAINER_START[side].clone();
    const end = ANCHORS[side][0].clone();
    holder.position.copy(walkIn ? start : end);
    holder.visible = false;
    this.root.add(holder);
    this.trainers.push({
      obj: im, model, group: holder, t: walkIn ? 0 : 1,
      phase: 0, seen: false, walkIn, side, start, end,
    });
    // The flat 2D portrait stays off the render layer while the 3D walker plays;
    // its alpha tween still drives the walk-in / retirement.
    this.scene.cameras.main.ignore(im);
  }

  private updateTrainers(dt: number): void {
    for (let i = this.trainers.length - 1; i >= 0; i--) {
      const w = this.trainers[i];
      const o = w.obj;
      const alpha = o.alpha ?? 1;
      const visible = !!(o as GO).scene && o.visible !== false && alpha > 0.05;
      w.group.visible = visible;
      if (visible) w.seen = true;
      // Once it has appeared, the portrait fading out (Pokémon send-out) or the
      // scene tearing it down retires the walker.
      if (w.seen && (!(o as GO).scene || alpha < 0.06)) {
        this.root.remove(w.group);
        this.trainers.splice(i, 1);
        continue;
      }
      if (visible && w.walkIn) w.t = Math.min(1, w.t + dt / 1.5);
      const e = 1 - Math.pow(1 - w.t, 3);       // easeOutCubic
      w.group.position.x = THREE.MathUtils.lerp(w.start.x, w.end.x, e);
      w.group.position.z = THREE.MathUtils.lerp(w.start.z, w.end.z, e);
      const moving = visible && w.walkIn && w.t < 1;
      if (moving) w.phase += dt * 9;
      else w.phase += dt * 2.1;
      w.model.setWalk(w.phase, moving, dt);     // sets group.position.y (bob)
      const facing = moving
        ? this.facingVector.copy(w.end).sub(w.start)
        : this.facingVector.copy(ANCHORS[w.side === 'player' ? 'enemy' : 'player'][0]).sub(w.end);
      w.model.face(facing.x, facing.z, dt);
    }
  }

  /** Keep a retained 2D trainer's feet on the same projected ground anchor as
   *  the Pokémon for that side. The portrait remains crisp Phaser artwork while
   *  following camera drift and punch-ins from the 3D battle. */
  private syncPinned2DTrainers(): void {
    if (!this.active3D || !this.pinned2DTrainers.size) return;
    const camera = this.stage.camera;
    camera.updateMatrixWorld();
    for (const [im, pinned] of this.pinned2DTrainers) {
      if (!im.scene) {
        this.pinned2DTrainers.delete(im);
        continue;
      }
      const feet = this.projectionPoint.copy(ANCHORS[pinned.side][0]).project(camera);
      if (!Number.isFinite(feet.x) || !Number.isFinite(feet.y) || feet.z < -1 || feet.z > 1) continue;
      const anchorX = (feet.x + 1) * 0.5 * this.scene.scale.width;
      const anchorY = (1 - feet.y) * 0.5 * this.scene.scale.height;
      const originX = Number.isFinite(im.originX) ? im.originX : 0.5;
      const originY = Number.isFinite(im.originY) ? im.originY : 0.5;
      im.setPosition(
        anchorX + (originX - 0.5) * (im.displayWidth ?? 0),
        anchorY - (1 - originY) * (im.displayHeight ?? 0),
      );
    }
  }

  // ── Frame sync ──
  update(dt: number): void {
    if (!this.built) return;
    // Objects emitted through addedtoscene are only constructors at that point.
    // Jin's async scene exposed this race: its new Graphics had an empty command
    // buffer here, then the fullscreen 2D backdrop was drawn after we had already
    // rejected it. Classify the completed objects one frame later instead.
    if (this.pendingObjects.size) {
      const ready = [...this.pendingObjects];
      this.pendingObjects.clear();
      for (const obj of ready) {
        if (obj.scene) this.consider(obj);
      }
    }
    this.time += dt;
    this.fx.update(dt);
    this.updateTrainers(dt);
    for (let i = this.pendingBursts.length - 1; i >= 0; i--) {
      const p = this.pendingBursts[i];
      p.t -= dt;
      if (p.t <= 0) {
        this.fx.physicalImpact(p.at, p.moveType, p.moveName, p.color, p.power, p.eff);
        this.rig.addShake(p.eff > 1 ? 0.7 : 0.45);
        this.pendingBursts.splice(i, 1);
      }
    }

    const dead: GO[] = [];
    for (const cb of this.combatants.values()) {
      const o = cb.obj;
      if (!o.scene) { dead.push(o); continue; }

      // The game swaps sprite textures at runtime (async PokeAPI art arriving
      // and party switches). Rebind the production model/fallback when it does.
      const sig = `${o.texture.key}:${o.frame?.name ?? 0}`;
      if (sig !== cb.texSig) {
        cb.texSig = sig;
        this.refreshCombatant(cb);
      }

      // The manifest loads asynchronously, so a creature adopted before it
      // arrived still resolves to its local GLB once the list is in. Until that
      // moment, and for species without a local GLB, the 2D image remains live.
      if (!cb.glbKey && !cb.glb && cb.rejectedGlbKey !== cb.obj.texture.key && hasModel(cb.obj.texture.key)) {
        cb.glbKey = cb.obj.texture.key;
      }

      // Swap only after the local GLB has completely loaded and passed geometry
      // validation. No relief/procedural mesh is ever exposed in the meantime.
      if (cb.glbKey && !cb.glb) {
        const loaded = getModel(cb.glbKey);
        if (loaded && isRenderableModel(loaded.group)) {
          const model = loaded.group;
          // Enemy Pokémon present their front to the battle camera. The old
          // fixed zero yaw only followed the world axis, so models such as
          // Cerrapin appeared side-on in the diagonal battle composition.
          // The player's own model faces the opponent across the field.
          if (cb.side === 'player') {
            const dir = this.facingVector.copy(ANCHORS.enemy[0]).sub(ANCHORS.player[cb.slot]);
            model.rotation.y = Math.atan2(dir.x, dir.z) - cb.holder.rotation.y;
          } else {
            model.rotation.y = this.cameraFacingYaw(cb.holder);
          }
          cb.glb = model;
          cb.holder.add(model);
          this.stage.requestMeshPreparation();
          // Any clips inside the GLB drive the model; otherwise the animator
          // moves the whole mesh procedurally.
          cb.anim = new CreatureAnimator(model, loaded.animations);
          cb.anim.setFacing(model.rotation.y);
          cb.fallback2D = false;
          this.destroyFallbackSprite(cb);
          cb.holder.visible = true;
          cb.shadow.visible = true;
          // Recheck the first animated frames because a malformed baked clip can
          // invalidate an otherwise valid static scene.
          cb.glbVerifyFrames = 2;
          cb.glbHealthTimer = 0;
        } else if (loaded) {
          this.rejectGlbModel(cb);
        } else if (modelLoadStatus(cb.glbKey) === 'failed') {
          this.rejectGlbModel(cb);
        }
      }
      if (!cb.glb) {
        if (!cb.fallback2D) this.use2DFallback(cb);
        continue;
      }

      const x = o.x ?? 0, y = o.y ?? 0;
      const dx = x - cb.lastPos.x, dy = y - cb.lastPos.y;
      cb.speed = cb.speed * 0.82 + (Math.abs(dx) + Math.abs(dy)) * 0.18;
      cb.lastPos.x = x;
      cb.lastPos.y = y;

      // Capture the "settled" position once the sprite is visible and still.
      const vis = (o.visible !== false) && ((o.alpha ?? 1) > 0.85);
      if (vis && Math.abs(dx) + Math.abs(dy) < 0.6) {
        cb.settleTimer += dt;
        if (cb.settleTimer > 0.25 && !cb.base) cb.base = { x, y };
      } else if (!vis) {
        cb.settleTimer = 0;
      }

      const anchor = ANCHORS[cb.side][cb.slot];
      cb.holder.position.set(anchor.x, 0, anchor.z);

      // Scale baseline is captured only when the sprite is SETTLED (still +
      // fully visible), so send-out/switch scale tweens read as relative
      // animation instead of poisoning the battler's size (giant/invisible).
      const curSX = Math.abs(o.scaleX ?? 1);
      if (Math.abs(curSX - cb.lastSX) < 1e-4 && (o.alpha ?? 1) > 0.85 && o.visible !== false) {
        cb.scaleStill += dt;
        if (cb.scaleStill > 0.25 && cb.baseSX === null && curSX > 1e-4) {
          cb.baseSX = curSX;
          cb.baseSY = Math.abs(o.scaleY ?? 1) || curSX;
        }
      } else {
        cb.scaleStill = 0;
      }
      cb.lastSX = curSX;
      const relX = cb.baseSX ? Math.min(3, Math.max(0.2, curSX / cb.baseSX)) : 1;
      const relY = cb.baseSY ? Math.min(3, Math.max(0.2, Math.abs(o.scaleY ?? 1) / cb.baseSY)) : 1;
      // Phaser may briefly report different X/Y scales during sprite swaps.
      // A 3D mesh must keep one uniform scale or the original pixel art is
      // visibly stretched into a tall/wide accordion shape.
      const uniformRel = (relX + relY) / 2;
      // Track the subtle camera drift/punch-ins so every opposing 3D model
      // continues to face forward throughout the battle, not only on spawn.
      if (cb.side === 'enemy') cb.anim?.setFacing(this.cameraFacingYaw(cb.holder));
      // Fainting: the battle fades/drops the sprite — play the topple once.
      const down = (o.alpha ?? 1) < 0.5 || o.visible === false;
      if (down && !cb.fainted && cb.base) { cb.fainted = true; cb.anim?.faint(); }
      if (!down && cb.fainted) {
        cb.fainted = false;
        // A send-out/switch also fades the shared Phaser image. That fade is
        // not a knockout: reset the held topple before showing the new mon.
        cb.anim?.standUp();
      }
      cb.anim?.update(dt, cb.targetH * uniformRel);
      cb.glbHealthTimer += dt;
      if (cb.glbVerifyFrames > 0 || cb.glbHealthTimer >= 2) {
        cb.glbHealthTimer = 0;
        if (!isRenderableModel(cb.glb)) {
          this.rejectGlbModel(cb);
          continue;
        }
        if (cb.glbVerifyFrames > 0) --cb.glbVerifyFrames;
      }
      cb.glb.visible = (o.alpha ?? 1) > 0.05;

      cb.chargeLift += (cb.chargeTarget - cb.chargeLift) * Math.min(1, dt * 8);
      cb.holder.position.y += cb.chargeLift;
      cb.holder.visible = (o.visible !== false) && ((o.alpha ?? 1) > 0.02);
      cb.shadow.visible = cb.holder.position.y < 0.5;
    }
    for (const d of dead) {
      const cb = this.combatants.get(d);
      if (cb) {
        this.destroyFallbackSprite(cb);
        this.root.remove(cb.holder);
        this.combatants.delete(d);
      }
    }

    // 2D camera shake → 3D shake (existing battle code shakes on hits).
    const cam = this.scene.cameras.main as unknown as { shakeEffect?: { isRunning?: boolean } };
    if (cam.shakeEffect?.isRunning) this.rig.addShake(0.4);

    this.rig.update(dt, null);
    this.syncFallback2DCombatants(dt);
    this.syncPinned2DTrainers();
  }

  restore2D(): void {
    this.active3D = false;
    const cam = this.scene.cameras.main as Phaser.Cameras.Scene2D.Camera & { id: number };
    const unhide = (o: GO) => { (o as unknown as { cameraFilter: number }).cameraFilter &= ~cam.id; };
    for (const cb of this.combatants.values()) unhide(cb.obj);
    for (const cb of this.combatants.values()) cb.fallbackSprite?.setVisible(false);
    for (const w of this.trainers) unhide(w.obj);
    for (const b of this.hiddenBackdrops) unhide(b);
    for (const [im, pinned] of this.pinned2DTrainers) {
      im.setPosition(pinned.originalX, pinned.originalY);
    }
  }

  apply3D(): void {
    this.active3D = true;
    for (const cb of this.combatants.values()) {
      this.scene.cameras.main.ignore(cb.obj);
      if (cb.fallback2D) this.syncFallback2DCombatant(cb);
    }
    for (const w of this.trainers) this.scene.cameras.main.ignore(w.obj);
    for (const b of this.hiddenBackdrops) this.scene.cameras.main.ignore(b);
  }
}
