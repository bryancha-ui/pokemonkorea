import Phaser from 'phaser';
import { t } from './i18n';
import { BreedingSystem, type BreedingAdvanceResult } from './BreedingSystem';
import { PedometerSystem } from './PedometerSystem';
import { fontScaleForScene } from './UiScale';

/**
 * Scene plugin that turns actual overworld movement into nursery steps. Every
 * map already exposes its player coordinates as `px`/`py`; tracking those here
 * keeps breeding and hatching consistent across routes, towns and interiors.
 */
export class BreedingTrackerPlugin extends Phaser.Plugins.ScenePlugin {
  private lastX?: number;
  private lastY?: number;
  private distance = 0;
  private widgetBg?: Phaser.GameObjects.Rectangle;
  private widgetText?: Phaser.GameObjects.Text;
  private widgetSignature = '';

  constructor(scene: Phaser.Scene, pluginManager: Phaser.Plugins.PluginManager, pluginKey: string) {
    super(scene, pluginManager, pluginKey);
  }

  boot(): void {
    this.systems!.events.on('update', this.track, this);
    this.systems!.events.once('shutdown', this.cleanup, this);
    this.systems!.events.once('destroy', this.cleanup, this);
  }

  private track(): void {
    const scene = this.scene as (Phaser.Scene & {
      px?: number; py?: number;
      playerG?: Phaser.GameObjects.GameObject & { x?: number; y?: number };
    }) | null;
    if (!scene) return;
    // Exactly one HUD should be visible even when an overlay scene (Menu, Box,
    // battle UI, etc.) is launched above a still-active map. The top scene owns
    // the widget; when it closes, the underlying scene's widget becomes visible.
    const activeScenes = scene.game.scene.getScenes(true);
    const isTopScene = activeScenes[activeScenes.length - 1] === scene;
    // The shop's balance occupies this same top-right HUD region. Keep that
    // screen clear while purchasing; the field widget returns on shop close.
    const shopCheckoutOpen = scene.scene.key === 'ShopScene';
    const battleOpen = /BattleScene$/i.test(scene.scene.key);
    const hatchCutsceneOpen = scene.scene.key === 'EggHatchScene';
    if (!isTopScene || !scene.registry.get('starterChosen') || shopCheckoutOpen || battleOpen || hatchCutsceneOpen) {
      this.setWidgetVisible(false);
      this.lastX = this.lastY = undefined;
      return;
    }
    this.ensureWidget();
    this.setWidgetVisible(true);
    this.refreshWidget();

    const position = this.explorationPosition(scene);
    if (!position) {
      this.lastX = this.lastY = undefined;
      return;
    }
    const { x, y } = position;
    if (this.lastX === undefined || this.lastY === undefined) {
      this.lastX = x; this.lastY = y;
      return;
    }
    const moved = Math.hypot(x! - this.lastX, y! - this.lastY);
    this.lastX = x; this.lastY = y;
    // Ignore scene spawns, warps and scripted teleports; ordinary running and
    // cycling stay far below this per-frame threshold.
    if (moved < 0.05 || moved > 64) return;
    this.distance += moved;
    if (this.distance < 32) return;
    const steps = Math.floor(this.distance / 32);
    this.distance -= steps * 32;
    PedometerSystem.add(scene.registry, steps);
    const result: BreedingAdvanceResult = BreedingSystem.hasStepWork(scene.registry)
      ? BreedingSystem.advanceSteps(scene.registry, steps)
      : { eggBecameReady: false };
    this.refreshWidget(true);
    if (result.eggBecameReady) this.toast(t('The nursery found an Egg!', '키우미집에서 알이 발견되었습니다!'), '🥚');
    if (result.hatched) {
      // Freeze the exact map frame and hand presentation to a modal scene. The
      // Pokémon is already committed to party/Box by BreedingSystem, so closing
      // or refreshing during the animation cannot duplicate or lose it.
      this.setWidgetVisible(false);
      scene.scene.launch('EggHatchScene', {
        parentKey: scene.scene.key,
        child: result.hatched.child,
        destination: result.hatched.destination,
      });
      scene.scene.pause();
    }
  }

  /** Battle scenes expose return coordinates named px/py, but those are not a
   * moving player. They still display the global HUD; this method only decides
   * whether the current scene may increment its counter. */
  private explorationPosition(scene: Phaser.Scene & {
    px?: number; py?: number;
    playerG?: Phaser.GameObjects.GameObject & { x?: number; y?: number };
  }): { x: number; y: number } | null {
    if (/BattleScene$/i.test(scene.scene.key)) return null;
    if (Number.isFinite(scene.px) && Number.isFinite(scene.py)) {
      return { x: scene.px!, y: scene.py! };
    }
    const player = scene.playerG;
    if (Number.isFinite(player?.x) && Number.isFinite(player?.y)) {
      return { x: player!.x!, y: player!.y! };
    }
    const camera = scene.cameras?.main as (Phaser.Cameras.Scene2D.Camera & {
      _follow?: Phaser.GameObjects.GameObject & { x?: number; y?: number };
    }) | undefined;
    const follow = camera?._follow;
    return Number.isFinite(follow?.x) && Number.isFinite(follow?.y)
      ? { x: follow!.x!, y: follow!.y! }
      : null;
  }

  private setWidgetVisible(visible: boolean): void {
    this.widgetBg?.setVisible(visible);
    this.widgetText?.setVisible(visible);
  }

  /** Compact top-right HUD shared by every scene that exposes player position. */
  private ensureWidget(): void {
    if (this.widgetBg?.active && this.widgetText?.active) return;
    const scene = this.scene;
    if (!scene) return;
    const uiScale = fontScaleForScene(scene);
    const right = scene.scale.width - 14;
    this.widgetBg = scene.add.rectangle(right, 14, 258 * uiScale, 58 * uiScale, 0x10192b, 0.9)
      .setOrigin(1, 0).setStrokeStyle(2, 0x6e8fc2, 0.9)
      .setScrollFactor(0).setDepth(999900).setData('pedometerHud', true);
    this.widgetText = scene.add.text(right - 12 * uiScale, 14 + 6 * uiScale, '', {
      fontSize: '13px', color: '#e8f1ff', fontStyle: 'bold', align: 'right', lineSpacing: 4,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(999901).setData('pedometerHud', true);
  }

  private refreshWidget(force = false): void {
    const scene = this.scene;
    if (!scene || !this.widgetText?.active) return;
    const total = PedometerSystem.get(scene.registry);
    const egg = BreedingSystem.getState(scene.registry).carriedEgg;
    const signature = `${total}:${egg?.stepsRemaining ?? ''}`;
    if (!force && signature === this.widgetSignature) return;
    this.widgetSignature = signature;
    const totalText = total.toLocaleString('ko-KR');
    this.widgetText.setText(egg
      ? t(`👟 PEDOMETER · ${totalText} steps\n🥚 ${egg.stepsRemaining} steps to hatch`, `👟 만보기 · ${totalText}걸음\n🥚 부화까지 ${egg.stepsRemaining}걸음`)
      : t(`👟 PEDOMETER\nTotal ${totalText} steps`, `👟 만보기\n누적 ${totalText}걸음`));
  }

  private toast(message: string, icon: string): void {
    const scene = this.scene;
    if (!scene?.add || !scene.cameras?.main) return;
    const w = scene.scale.width;
    const bg = scene.add.rectangle(w / 2, 78, 620, 64, 0x182338, 0.96)
      .setStrokeStyle(2, 0xffe28a).setScrollFactor(0).setDepth(999998);
    const text = scene.add.text(w / 2, 78, `${icon}  ${message}`, {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(999999);
    scene.tweens.add({ targets: [bg, text], alpha: 0, y: 58, delay: 3200, duration: 500,
      onComplete: () => { bg.destroy(); text.destroy(); } });
  }

  private cleanup(): void {
    this.systems!.events.off('update', this.track, this);
    this.lastX = this.lastY = undefined;
    this.distance = 0;
    this.widgetBg = undefined;
    this.widgetText = undefined;
    this.widgetSignature = '';
  }
}
