import Phaser from 'phaser';
import { BADGES } from '../data/Badges';
import { MAPAE } from '../data/Mapae';
import { playJingle } from './Music';
import { t, tr } from './i18n';

export type RewardKind = 'badge' | 'mapae';

export interface RewardCeremonyOptions {
  kind: RewardKind;
  key: string;
  onComplete?: () => void;
}

const textureKey = (kind: RewardKind, key: string) => `reward-${kind}-${key}`;

export function rewardAssetPath(kind: RewardKind, key: string): string {
  const folder = kind === 'badge' ? 'badges' : 'mapae';
  return `assets/rewards/${folder}/${kind}-${key}.png`;
}

export function preloadRewardAssets(scene: Phaser.Scene): void {
  BADGES.forEach(badge => {
    if (!scene.textures.exists(textureKey('badge', badge.flag))) {
      scene.load.image(textureKey('badge', badge.flag), rewardAssetPath('badge', badge.flag));
    }
  });
  MAPAE.forEach(mapae => {
    if (!scene.textures.exists(textureKey('mapae', mapae.key))) {
      scene.load.image(textureKey('mapae', mapae.key), rewardAssetPath('mapae', mapae.key));
    }
  });
}

export function rewardTextureKey(kind: RewardKind, key: string): string {
  return textureKey(kind, key);
}

/** Full-screen collectible reveal. The icon completes one visual 360° Y-axis
 * rotation by compressing through edge-on and expanding from the opposite side. */
export function showRewardCeremony(scene: Phaser.Scene, options: RewardCeremonyOptions): void {
  const { kind, key, onComplete } = options;
  const tex = textureKey(kind, key);

  // Award scenes normally inherit these textures from the boot/menu cache, but
  // direct test links and restored saves can enter a city without visiting it.
  // Load the single missing collectible on demand before building the reveal.
  if (!scene.textures.exists(tex)) {
    scene.load.image(tex, rewardAssetPath(kind, key));
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (scene.scene.isActive()) showRewardCeremony(scene, options);
    });
    scene.load.start();
    return;
  }

  const W = scene.scale.width, H = scene.scale.height;
  const cx = W / 2, cy = H / 2 - Math.min(28, H * 0.04);
  const badge = kind === 'badge' ? BADGES.find(entry => entry.flag === key) : undefined;
  const mapae = kind === 'mapae' ? MAPAE.find(entry => entry.key === key) : undefined;
  const name = badge ? tr(badge.name) : mapae ? t(`${mapae.city} Mapae`, `${mapae.cityKo} 마패`) : key;
  const title = kind === 'badge' ? t('GYM BADGE OBTAINED!', '체육관 배지 획득!') : t('NORTHERN MAPAE OBTAINED!', '북부 마패 획득!');
  const color = kind === 'badge' ? 0xffe36b : 0xffc05c;

  const overlay = scene.add.container(0, 0).setDepth(10000).setScrollFactor(0);
  const dim = scene.add.rectangle(cx, H / 2, W, H, 0x02040c, 0).setInteractive();
  overlay.add(dim);

  const rays = scene.add.graphics();
  const rayCount = 28;
  for (let index = 0; index < rayCount; index++) {
    const angle = (Math.PI * 2 * index) / rayCount;
    const inner = Math.min(W, H) * 0.14;
    const outer = Math.min(W, H) * (index % 2 ? 0.43 : 0.5);
    const spread = 0.018;
    rays.fillStyle(index % 2 ? 0xffffff : color, index % 2 ? 0.18 : 0.28);
    rays.beginPath();
    rays.moveTo(Math.cos(angle - spread) * inner, Math.sin(angle - spread) * inner);
    rays.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    rays.lineTo(Math.cos(angle + spread) * inner, Math.sin(angle + spread) * inner);
    rays.closePath();
    rays.fillPath();
  }
  rays.setAlpha(0).setScale(0.35).setPosition(cx, cy).setBlendMode(Phaser.BlendModes.ADD);
  overlay.add(rays);

  const aura = scene.add.circle(cx, cy, Math.min(W, H) * 0.17, color, 0)
    .setStrokeStyle(Math.max(3, Math.round(W / 320)), 0xffffff, 0)
    .setBlendMode(Phaser.BlendModes.ADD);
  overlay.add(aura);

  const iconSize = Phaser.Math.Clamp(Math.min(W, H) * 0.35, 170, 310);
  const icon = scene.add.image(cx, cy, tex).setDisplaySize(iconSize, iconSize)
    .setAlpha(0).setAngle(-8);
  const iconScale = icon.scaleX;
  icon.setScale(iconScale * 0.15);
  overlay.add(icon);

  const shine = scene.add.ellipse(cx - iconSize * 0.16, cy - iconSize * 0.18,
    iconSize * 0.12, iconSize * 0.58, 0xffffff, 0).setAngle(28);
  overlay.add(shine);

  const titleText = scene.add.text(cx, cy + iconSize * 0.69, title, {
    fontSize: `${Phaser.Math.Clamp(Math.round(W / 45), 23, 38)}px`, color: '#fff4b5',
    fontStyle: 'bold', stroke: '#4a2300', strokeThickness: 7, align: 'center',
  }).setOrigin(0.5).setAlpha(0);
  const nameText = scene.add.text(cx, titleText.y + Math.max(34, H * 0.05), name, {
    fontSize: `${Phaser.Math.Clamp(Math.round(W / 58), 18, 30)}px`, color: '#ffffff',
    fontStyle: 'bold', stroke: '#15162c', strokeThickness: 5, align: 'center',
  }).setOrigin(0.5).setAlpha(0);
  overlay.add([titleText, nameText]);

  playJingle(scene, 'badge');
  scene.cameras.main.flash(320, 255, 235, 150, false);
  scene.tweens.add({ targets: dim, fillAlpha: 0.84, duration: 260 });
  scene.tweens.add({
    targets: rays, alpha: { from: 0, to: 0.95 }, scale: { from: 0.35, to: 1 },
    duration: 520, ease: 'Back.Out',
  });
  scene.tweens.add({ targets: aura, alpha: { from: 0, to: 1 }, duration: 420, ease: 'Quad.Out' });
  scene.tweens.add({ targets: rays, angle: 18, duration: 2500, ease: 'Sine.InOut' });
  scene.tweens.add({ targets: aura, scale: { from: 0.35, to: 1.25 }, alpha: { from: 0.9, to: 0.1 }, duration: 1350, repeat: 1 });
  scene.tweens.add({
    targets: icon, alpha: 1, scale: iconScale, angle: 0, duration: 520, ease: 'Back.Out',
    onComplete: () => {
      // Edge-on → mirrored front → edge-on → front gives a complete visual
      // 360° Y-axis turn while ending on the original readable face.
      const spinScales = [iconScale * 0.04, -iconScale, -iconScale * 0.04, iconScale];
      const spin = (index: number) => {
        if (index >= spinScales.length) return;
        scene.tweens.add({
          targets: icon,
          scaleX: spinScales[index],
          duration: 180,
          ease: index % 2 === 0 ? 'Sine.In' : 'Sine.Out',
          onComplete: () => spin(index + 1),
        });
      };
      spin(0);
      scene.tweens.add({ targets: shine, fillAlpha: { from: 0, to: 0.8 }, x: cx + iconSize * 0.2, duration: 460, yoyo: true, delay: 130 });
    },
  });
  scene.tweens.add({ targets: [titleText, nameText], alpha: 1, y: '+=4', duration: 420, delay: 700, ease: 'Quad.Out' });

  let closing = false;
  const finish = () => {
    if (closing) return;
    closing = true;
    scene.tweens.add({
      targets: overlay, alpha: 0, duration: 260,
      onComplete: () => { overlay.destroy(true); onComplete?.(); },
    });
  };
  scene.time.delayedCall(2700, finish);
  // Do not allow an accidental mobile tap to skip the collectible turn. A tap
  // near the end merely closes immediately after the full reveal has played.
  scene.time.delayedCall(2100, () => dim.once('pointerdown', finish));
}
