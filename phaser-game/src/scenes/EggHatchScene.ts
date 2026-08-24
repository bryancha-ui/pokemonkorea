import Phaser from 'phaser';
import type { PartyEntry } from '../systems/PartySystem';
import { t } from '../systems/i18n';

interface EggHatchSceneData {
  parentKey?: string;
  child: PartyEntry;
  destination: 'party' | 'box';
}

interface HatchEngineBridge {
  isRendering(scene: Phaser.Scene): boolean;
  playHatch(scene: Phaser.Scene, profile: { key: string; type1?: string; type2?: string }): boolean;
  stopHatch(scene: Phaser.Scene): void;
}

/**
 * Modal hatch cutscene. In 3D mode the Egg and newborn are supplied by the
 * existing Three.js overworld renderer; this scene owns the fade, copy and
 * input lock. Its synchronized Phaser version is kept as a safe 2D fallback.
 */
export class EggHatchScene extends Phaser.Scene {
  private parentKey = 'WorldMapScene';
  private child!: PartyEntry;
  private destination: 'party' | 'box' = 'party';
  private hatchTextureKey = '';
  private using3D = false;
  private ready = false;
  private leaving = false;
  private backdrop!: Phaser.GameObjects.Rectangle;
  private fallbackLayer!: Phaser.GameObjects.Container;
  private egg2D!: Phaser.GameObjects.Container;
  private child2D!: Phaser.GameObjects.Image | Phaser.GameObjects.Container;
  private status!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private flash!: Phaser.GameObjects.Rectangle;
  private wobble?: Phaser.Tweens.Tween;

  constructor() { super('EggHatchScene'); }

  init(data: EggHatchSceneData): void {
    this.parentKey = data.parentKey ?? 'WorldMapScene';
    this.child = data.child;
    this.destination = data.destination;
    this.hatchTextureKey = `egg-hatch-${data.child.spriteKey}`;
  }

  preload(): void {
    if (this.child?.spriteUrl && !this.textures.exists(this.hatchTextureKey)) {
      this.load.image(this.hatchTextureKey, this.child.spriteUrl);
    }
  }

  create(): void {
    this.scene.bringToTop();
    this.ready = false;
    this.leaving = false;

    const parent = this.parentScene();
    const engine = this.engine3D();
    this.using3D = !!parent && !!engine?.playHatch(parent, {
      key: this.child.spriteKey, type1: this.child.type1, type2: this.child.type2,
    });

    const w = this.scale.width, h = this.scale.height;
    this.backdrop = this.add.rectangle(w / 2, h / 2, w, h, 0x050713, this.using3D ? 0.57 : 0.96)
      .setDepth(1);

    // Soft framing keeps text readable but leaves the camera-relative 3D model
    // unobstructed in the middle of the screen.
    this.add.rectangle(w / 2, 0, w, 112, 0x071023, 0.86).setOrigin(0.5, 0).setDepth(2);
    this.add.rectangle(w / 2, h, w, 150, 0x071023, 0.9).setOrigin(0.5, 1).setDepth(2);
    this.add.rectangle(w / 2, 112, Math.min(760, w * 0.72), 2, 0x8ccfff, 0.72).setDepth(3);

    this.fallbackLayer = this.add.container(0, 0).setDepth(5).setVisible(!this.using3D);
    this.build2DFallback();

    this.flash = this.add.rectangle(w / 2, h / 2, w, h, 0xfff7d2, 0).setDepth(20);
    this.status = this.add.text(w / 2, 54,
      t('What? The Egg is beginning to move!', '어라? 알이 움직이기 시작했다!'), {
        fontSize: '25px', color: '#ffffff', fontStyle: 'bold', align: 'center',
        stroke: '#17213d', strokeThickness: 5, wordWrap: { width: Math.min(980, w - 70) },
      }).setOrigin(0.5).setDepth(30);
    this.prompt = this.add.text(w / 2, h - 46, '', {
      fontSize: '19px', color: '#dcecff', fontStyle: 'bold', align: 'center',
      stroke: '#10172a', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30);

    this.time.delayedCall(1150, () => {
      this.status.setText(t('Cracks are spreading across the Egg...', '알에 금이 퍼지고 있다...'));
    });
    this.time.delayedCall(2550, () => this.onShellBreak());
    this.time.delayedCall(3380, () => this.onPokemonRevealed());
    this.time.delayedCall(4300, () => {
      this.ready = true;
      this.prompt.setText(t('Tap the screen or press A to continue', '화면을 터치하거나 A 버튼을 눌러 계속'));
      this.tweens.add({ targets: this.prompt, alpha: { from: 0.45, to: 1 }, duration: 650, yoyo: true, repeat: -1 });
    });

    const attemptLeave = () => this.finish();
    this.input.on('pointerdown', attemptLeave);
    this.input.keyboard?.on('keydown-SPACE', attemptLeave);
    this.input.keyboard?.on('keydown-ENTER', attemptLeave);
    this.input.keyboard?.on('keydown-Z', attemptLeave);
    this.input.keyboard?.on('keydown-A', attemptLeave);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      const p = this.parentScene();
      if (p) this.engine3D()?.stopHatch(p);
    });
  }

  update(): void {
    if (!this.using3D) return;
    const parent = this.parentScene();
    if (parent && this.engine3D()?.isRendering(parent)) return;
    // F3 toggles and mobile context recovery can remove the 3D canvas while the
    // modal is open. The synchronized fallback is already at the same phase.
    this.using3D = false;
    this.fallbackLayer.setVisible(true);
    this.backdrop.setFillStyle(0x050713, 0.96);
  }

  private build2DFallback(): void {
    const cx = this.scale.width / 2, cy = this.scale.height / 2 - 14;
    this.egg2D = this.add.container(cx, cy).setScale(0.01);
    const shell = this.add.ellipse(0, 0, 176, 236, 0xfffae8, 1)
      .setStrokeStyle(5, 0xe4d9bd, 1);
    this.egg2D.add(shell);
    this.egg2D.add([
      this.add.ellipse(-35, -52, 54, 42, 0x67b6e8, 1).setAngle(-14),
      this.add.ellipse(42, 2, 46, 36, 0x67b6e8, 1).setAngle(18),
      this.add.ellipse(-22, 67, 40, 31, 0x67b6e8, 1).setAngle(8),
    ]);
    const cracks = this.add.graphics().setVisible(false);
    cracks.lineStyle(6, 0x66546a, 0.95);
    cracks.beginPath(); cracks.moveTo(2, -82); cracks.lineTo(-13, -47); cracks.lineTo(7, -20);
    cracks.lineTo(-14, 8); cracks.lineTo(4, 43); cracks.lineTo(-6, 81); cracks.strokePath();
    cracks.beginPath(); cracks.moveTo(-13, -47); cracks.lineTo(-52, -26); cracks.lineTo(-62, 4); cracks.strokePath();
    cracks.beginPath(); cracks.moveTo(7, -20); cracks.lineTo(48, -2); cracks.lineTo(60, 31); cracks.strokePath();
    this.egg2D.add(cracks);
    this.fallbackLayer.add(this.egg2D);
    this.tweens.add({ targets: this.egg2D, scale: 1, duration: 420, ease: 'Back.Out' });
    this.wobble = this.tweens.add({
      targets: this.egg2D, angle: { from: -5, to: 5 }, y: cy - 8,
      duration: 170, yoyo: true, repeat: -1, ease: 'Sine.InOut',
    });
    this.time.delayedCall(1150, () => cracks.setVisible(true));

    if (this.textures.exists(this.hatchTextureKey)) {
      const sprite = this.add.image(cx, cy + 82, this.hatchTextureKey).setAlpha(0).setScale(0.01);
      const source = this.textures.get(this.hatchTextureKey).getSourceImage() as { width?: number; height?: number };
      const fit = Math.min(330 / Math.max(1, source.width ?? 1), 308 / Math.max(1, source.height ?? 1));
      sprite.setData('hatchTargetScale', fit);
      this.child2D = sprite;
    } else {
      // Never invent a substitute Pokémon when both the GLB and authored sprite
      // are unavailable. Keep the reveal neutral and report the missing art.
      const unavailable = this.add.container(cx, cy + 78);
      unavailable.add(this.add.text(0, 0, t('Image unavailable', '이미지를 불러오지 못했습니다'), {
        fontSize: '18px', color: '#dcecff', fontStyle: 'bold',
        stroke: '#10172a', strokeThickness: 4,
      }).setOrigin(0.5));
      this.child2D = unavailable.setAlpha(0).setScale(0.01);
      this.child2D.setData('hatchTargetScale', 1);
    }
    this.fallbackLayer.add(this.child2D);
  }

  private onShellBreak(): void {
    this.wobble?.stop();
    this.egg2D.setVisible(false);
    this.flash.setAlpha(0);
    this.tweens.add({ targets: this.flash, alpha: 0.95, duration: 120, yoyo: true });

    const targetScale = Number(this.child2D.getData('hatchTargetScale')) || 1;
    this.tweens.add({
      targets: this.child2D, alpha: 1, scale: targetScale,
      duration: 720, ease: 'Back.Out',
    });
    const cx = this.scale.width / 2, cy = this.scale.height / 2 + 10;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const star = this.add.text(cx, cy, i % 3 === 0 ? '✦' : '✧', {
        fontSize: i % 3 === 0 ? '30px' : '23px', color: i % 2 ? '#ffffff' : '#ffe990',
      }).setOrigin(0.5);
      this.fallbackLayer.add(star);
      this.tweens.add({
        targets: star, x: cx + Math.cos(a) * (130 + (i % 4) * 28),
        y: cy + Math.sin(a) * (100 + (i % 3) * 24), alpha: 0,
        angle: i % 2 ? 120 : -120, duration: 1050, onComplete: () => star.destroy(),
      });
    }
  }

  private onPokemonRevealed(): void {
    const name = t(this.child.name, this.child.nameKo || this.child.name, this.child.nameJa || this.child.name);
    const where = this.destination === 'party'
      ? t('It joined your party!', '파티에 합류했다!', 'てもちに 加わった！')
      : t('It was sent to the PC Box.', 'PC 보관함으로 전송되었다.', 'ボックスへ 送られた。');
    this.status.setText(`${t(`${name} hatched from the Egg!`, `알에서 ${name}(이)가 부화했다!`, `タマゴから ${name}が 生まれた！`)}\n${where}`);
  }

  private finish(): void {
    if (!this.ready || this.leaving) return;
    this.leaving = true;
    const parent = this.parentScene();
    if (parent) this.engine3D()?.stopHatch(parent);
    this.cameras.main.fadeOut(260, 0, 0, 0, (_camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress < 1) return;
      if (this.scene.isPaused(this.parentKey)) this.scene.resume(this.parentKey);
      this.scene.stop();
    });
  }

  private parentScene(): Phaser.Scene | null {
    return this.game.scene.getScene(this.parentKey) ?? null;
  }

  private engine3D(): HatchEngineBridge | undefined {
    return (window as unknown as { __pk3d?: HatchEngineBridge }).__pk3d;
  }
}
