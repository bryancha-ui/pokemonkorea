import Phaser from 'phaser';
import { markRivalPortrait, markTrainerPortrait } from '../data/BattlePortraits';
import {
  drawNpcBody,
  drawTrainerBody,
  rivalDesign,
  rivalTrainerName,
} from '../data/CharacterSprite';

type RegistryLike = { get(key: string): unknown };

export interface StoryActorOptions {
  kind: 'rival' | 'trainer';
  x: number;
  y: number;
  label?: string;
  trainerKey?: string;
  outfit?: number;
  hair?: number;
  skin?: number;
  facing?: number;
  lookAt?: { x: number; y: number };
  depth?: number;
  labelColor?: string;
}

export interface StoryWalkOptions {
  lookAt?: { x: number; y: number };
  duration?: number;
  onComplete?: () => void;
}

/**
 * A lightweight world-space actor for story beats.  The Graphics object owns
 * the position and lifetime in both renderers; OverworldMirror replaces it
 * with the matching animated 3D character whenever one is available.
 */
export class StoryActor {
  readonly graphic: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;

  private facing: number;
  private frame = 0;
  private readonly depth: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly registry: RegistryLike,
    private readonly options: StoryActorOptions,
  ) {
    this.depth = options.depth ?? 24;
    this.facing = options.facing ?? 0;
    this.graphic = scene.add.graphics().setDepth(this.depth).setPosition(options.x, options.y);
    this.draw();

    if (options.kind === 'rival') markRivalPortrait(this.graphic, registry);
    else if (options.trainerKey) markTrainerPortrait(this.graphic, options.trainerKey);

    if (options.lookAt) this.graphic.setData('characterLookAt3D', options.lookAt);
    const name = options.label
      ?? (options.kind === 'rival' ? rivalTrainerName(registry) : 'Trainer');
    this.label = scene.add.text(options.x, options.y - 30, name, {
      fontSize: '9px',
      color: options.labelColor ?? (options.kind === 'rival' ? '#a9dcff' : '#ffffff'),
      backgroundColor: '#00000099',
      padding: { x: 3, y: 1 },
      align: 'center',
    }).setOrigin(0.5).setDepth(this.depth + 1)
      .setData('characterLabel3D', true)
      .setData('characterLabelTarget3D', this.graphic);
  }

  get x(): number { return this.graphic.x; }
  get y(): number { return this.graphic.y; }
  get active(): boolean { return this.graphic.active; }

  face(targetX: number, targetY: number): void {
    const dx = targetX - this.x, dy = targetY - this.y;
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx < 0 ? 2 : 3;
    else this.facing = dy < 0 ? 1 : 0;
    this.graphic.setData('characterLookAt3D', { x: targetX, y: targetY });
    this.frame = 0;
    this.draw();
  }

  walkTo(x: number, y: number, options: StoryWalkOptions = {}): void {
    if (!this.active) return;
    const startX = this.x, startY = this.y;
    const distance = Math.hypot(x - startX, y - startY);
    const duration = options.duration ?? Phaser.Math.Clamp(distance * 7, 380, 1500);
    let elapsed = 0;
    let nextStep = 0;

    this.face(x, y);
    this.graphic.setData('characterLookAt3D', null);
    this.scene.tweens.add({
      targets: this.graphic,
      x, y, duration, ease: 'Sine.easeInOut',
      onUpdate: (_tween, target) => {
        elapsed += this.scene.game.loop.delta;
        if (elapsed >= nextStep) {
          this.frame ^= 1;
          nextStep = elapsed + 130;
          this.draw();
        }
        this.label.setPosition(target.x, target.y - 30);
      },
      onComplete: () => {
        if (!this.active) return;
        this.frame = 0;
        if (options.lookAt) this.face(options.lookAt.x, options.lookAt.y);
        else this.draw();
        this.label.setPosition(x, y - 30);
        options.onComplete?.();
      },
    });
  }

  walkAway(x: number, y: number, onComplete?: () => void): void {
    this.walkTo(x, y, {
      onComplete: () => {
        this.destroy();
        onComplete?.();
      },
    });
  }

  destroy(): void {
    if (this.graphic.active) this.graphic.destroy();
    if (this.label.active) this.label.destroy();
  }

  private draw(): void {
    if (this.options.kind === 'rival') {
      drawTrainerBody(this.graphic, this.facing, this.frame, rivalDesign(this.registry));
    } else {
      drawNpcBody(this.graphic, this.options.outfit ?? 0x445566, {
        hair: this.options.hair,
        skin: this.options.skin,
        frame: this.frame,
      });
    }
  }
}

export function spawnStoryActor(
  scene: Phaser.Scene,
  registry: RegistryLike,
  options: StoryActorOptions,
): StoryActor {
  return new StoryActor(scene, registry, options);
}
