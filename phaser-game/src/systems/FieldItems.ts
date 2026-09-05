import Phaser from 'phaser';
import { sfxItemGet } from './UiSfx';
import { t } from './i18n';
import { SaveManager } from '../utils/SaveManager';
import { FIELD_ITEM_PLACEMENTS, type FieldItemPlacement } from '../data/FieldItemData';
import { EVOLUTION_STONE_KEYS } from '../data/EvolutionStones';

const COLLECTED_KEY = 'fieldItemsCollectedV1';
const TILE = 32;
const byScene = new Map<string, FieldItemPlacement[]>();
for (const placement of FIELD_ITEM_PLACEMENTS) {
  const list = byScene.get(placement.scene) ?? [];
  list.push(placement);
  byScene.set(placement.scene, list);
}

function readCollected(registry: Phaser.Data.DataManager): Set<string> {
  const raw = registry.get(COLLECTED_KEY) as string | undefined;
  if (!raw) return new Set();
  try {
    const values = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(values) ? values.filter(value => typeof value === 'string') : []);
  } catch { return new Set(); }
}

function itemColor(itemKey: string): number {
  if (isEvolutionStone(itemKey)) return 0xa96bff;
  if (itemKey.endsWith('ball')) return 0x62b8ff;
  if (['oranberry', 'sitrusberry', 'lumberry', 'leftovers', 'expertbelt', 'charcoal', 'mysticwater', 'miracleseed', 'magnet'].includes(itemKey)) return 0x75e68c;
  if (itemKey === 'revive' || itemKey === 'maxrevive') return 0xffd55c;
  return 0xff6f6f;
}

const evolutionStoneKeys = new Set<string>(EVOLUTION_STONE_KEYS);
function isEvolutionStone(itemKey: string): boolean { return evolutionStoneKeys.has(itemKey); }

type WorldScene = Phaser.Scene & {
  collides?: (x: number, y: number) => boolean;
  cutsceneActive?: boolean;
};

interface SpawnedItem {
  placement: FieldItemPlacement;
  object: Phaser.GameObjects.Graphics;
}

class FieldItemController {
  alive = true;
  private readonly spawned: SpawnedItem[] = [];
  private readonly collected: Set<string>;
  private readonly player: Phaser.GameObjects.GameObject & { x: number; y: number; visible?: boolean };
  private busy = false;

  constructor(private readonly scene: WorldScene, placements: readonly FieldItemPlacement[]) {
    this.collected = readCollected(scene.registry);
    const follow = (scene.cameras.main as Phaser.Cameras.Scene2D.Camera & { _follow?: unknown })._follow;
    const fallback = (scene as unknown as { playerG?: unknown }).playerG;
    this.player = (follow ?? fallback) as typeof this.player;
    for (const placement of placements) {
      if (!this.collected.has(placement.id)) this.spawn(placement);
    }
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private clearAt(x: number, y: number): boolean {
    const bounds = this.scene.cameras.main.getBounds();
    if (x < bounds.left + TILE || x > bounds.right - TILE || y < bounds.top + TILE || y > bounds.bottom - TILE) return false;
    try { return !this.scene.collides?.(x, y); } catch { return true; }
  }

  private resolvePosition(placement: FieldItemPlacement): Phaser.Math.Vector2 | null {
    const bounds = this.scene.cameras.main.getBounds();
    if (bounds.width < TILE * 4 || bounds.height < TILE * 4) return null;
    const baseCol = Math.round((bounds.x + bounds.width * placement.ratio[0]) / TILE);
    const baseRow = Math.round((bounds.y + bounds.height * placement.ratio[1]) / TILE);
    for (let radius = 0; radius <= 9; radius++) {
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        if (radius > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const x = (baseCol + dx) * TILE + TILE / 2;
        const y = (baseRow + dy) * TILE + TILE / 2;
        if (this.clearAt(x, y)) return new Phaser.Math.Vector2(x, y);
      }
    }
    return null;
  }

  private spawn(placement: FieldItemPlacement): void {
    const pos = this.resolvePosition(placement);
    if (!pos) return;
    const color = itemColor(placement.itemKey);
    const rare = isEvolutionStone(placement.itemKey);
    const g = this.scene.add.graphics().setPosition(pos.x, pos.y).setDepth(14);
    g.fillStyle(0x000000, .25); g.fillEllipse(0, 10, 22, 7);
    g.fillStyle(color, .22); g.fillCircle(0, 0, rare ? 16 : 13);
    g.fillStyle(rare ? color : 0xe83f4d, 1); g.fillCircle(0, -1, 8);
    g.fillStyle(0xffffff, 1); g.fillRect(-8, -1, 16, 7);
    g.fillStyle(0x252a35, 1); g.fillRect(-8, -2, 16, 3);
    g.fillStyle(0xffffff, 1); g.fillCircle(0, -1, 3);
    g.lineStyle(1, 0x252a35, 1); g.strokeCircle(0, -1, 3);
    if (rare) {
      g.lineStyle(2, 0xffffff, .8); g.strokeCircle(0, 0, 13);
      g.fillStyle(0xffffff, .9); g.fillCircle(-11, -11, 2); g.fillCircle(12, -7, 1.5);
    }
    g.setData('fieldItem3D', { color, rare: rare ? 1 : 0 });
    this.scene.tweens.add({
      targets: g, scaleX: rare ? 1.12 : 1.06, scaleY: rare ? 1.12 : 1.06,
      duration: rare ? 720 : 980, yoyo: true, repeat: -1, ease: 'Sine.InOut',
    });
    this.spawned.push({ placement, object: g });
  }

  private update(): void {
    if (!this.alive || this.busy || this.scene.cutsceneActive || this.player?.visible === false) return;
    for (const item of this.spawned) {
      if (!item.object.active || Math.hypot(this.player.x - item.object.x, this.player.y - item.object.y) > 23) continue;
      void this.collect(item).catch((error) => {
        console.warn('[field-items] pickup failed:', error);
        this.busy = false;
      });
      break;
    }
  }

  private async collect(item: SpawnedItem): Promise<void> {
    this.busy = true;
    const { placement, object } = item;
    const quantity = placement.quantity ?? 1;
    // Items pulls battle/evolution data, so keep it out of the title bundle and
    // load it only on the first actual field pickup.
    const { Inventory, itemDef, itemName } = await import('./Items');
    const def = itemDef(placement.itemKey);
    if (!def) { object.destroy(); this.busy = false; return; }

    Inventory.add(this.scene.registry, placement.itemKey, quantity);
    this.collected.add(placement.id);
    this.scene.registry.set(COLLECTED_KEY, JSON.stringify([...this.collected].sort()));
    sfxItemGet(this.scene);
    if (!this.scene.registry.get('sceneFlowTest')) {
      SaveManager.save(this.scene.registry, this.player.x, this.player.y, this.scene.scene.key);
    }

    this.scene.tweens.killTweensOf(object);
    this.scene.tweens.add({
      targets: object, y: object.y - 30, scaleX: 1.55, scaleY: 1.55, alpha: 0,
      duration: 420, ease: 'Cubic.Out', onComplete: () => object.destroy(),
    });
    this.sparkle(object.x, object.y, itemColor(placement.itemKey));
    this.toast(def.icon, itemName(def), quantity, isEvolutionStone(placement.itemKey));
    this.scene.time.delayedCall(480, () => { this.busy = false; });
  }

  private sparkle(x: number, y: number, color: number): void {
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI * 2 * i / 10;
      const dot = this.scene.add.circle(x, y, i % 3 === 0 ? 4 : 2.5, i % 2 ? 0xffffff : color, 1).setDepth(24);
      this.scene.tweens.add({
        targets: dot, x: x + Math.cos(angle) * 34, y: y + Math.sin(angle) * 28 - 12,
        alpha: 0, scale: .2, duration: 520, ease: 'Quad.Out', onComplete: () => dot.destroy(),
      });
    }
  }

  private toast(icon: string, name: string, quantity: number, rare: boolean): void {
    const cx = this.scene.scale.width / 2;
    const y = Math.max(78, this.scene.scale.height * .18);
    const panel = this.scene.add.container(cx, y).setScrollFactor(0).setDepth(500).setAlpha(0);
    const width = Math.min(500, this.scene.scale.width - 36);
    // Every element is created via scene.add before being re-parented into the
    // container, so each fires `addedtoscene` while still loose in the scene. In a
    // 3D overworld the mirror would then ADOPT these rects/texts into the 3D world
    // (scattering the toast off-screen) unless they are already flagged as screen-
    // fixed UI. setScrollFactor(0) on each child trips the mirror's UI guard so the
    // notice stays pinned on top and is actually visible when picking items up.
    panel.add(this.scene.add.rectangle(0, 0, width, rare ? 82 : 70, 0x07182b, .96)
      .setScrollFactor(0).setStrokeStyle(rare ? 3 : 2, rare ? 0xc58aff : 0x6ad5ff, 1));
    panel.add(this.scene.add.text(-width / 2 + 25, 0, icon, { fontSize: rare ? '34px' : '29px' }).setScrollFactor(0).setOrigin(0, .5));
    panel.add(this.scene.add.text(-width / 2 + 76, rare ? -12 : 0, `${name}${quantity > 1 ? ` ×${quantity}` : ''}`, {
      fontSize: rare ? '20px' : '18px', color: '#ffffff', fontStyle: 'bold',
    }).setScrollFactor(0).setOrigin(0, .5));
    if (rare) panel.add(this.scene.add.text(-width / 2 + 76, 17, t('A rare Evolution Stone!', '희귀한 진화의 돌을 발견했다!', '珍しい 進化の石を 見つけた！'), {
      fontSize: '11px', color: '#e0bdff',
    }).setScrollFactor(0).setOrigin(0, .5));
    panel.add(this.scene.add.text(width / 2 - 24, 0, t('Put in the Bag', '가방에 넣었다', 'バッグに しまった'), {
      fontSize: '10px', color: '#8fdcf2', align: 'right',
    }).setScrollFactor(0).setOrigin(1, .5));
    this.scene.tweens.add({
      targets: panel, alpha: 1, y: y + 10, duration: 180, ease: 'Back.Out',
      onComplete: () => this.scene.time.delayedCall(1450, () => this.scene.tweens.add({
        targets: panel, alpha: 0, y: y - 8, duration: 230, onComplete: () => panel.destroy(true),
      })),
    });
  }

  private destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.update, this);
    for (const item of this.spawned) if (item.object.active) item.object.destroy();
    this.spawned.length = 0;
  }
}

/** Install once at boot. Lazy scenes are detected after materialisation, so no
 * individual map needs an import or lifecycle patch. */
export function installFieldItems(game: Phaser.Game): void {
  const controllers = new WeakMap<Phaser.Scene, FieldItemController>();
  const attach = () => {
    for (const rawScene of game.scene.getScenes(true)) {
      const scene = rawScene as WorldScene;
      const placements = byScene.get(scene.scene.key);
      if (!placements?.length) continue;
      const current = controllers.get(scene);
      if (current?.alive) continue;
      const camera = scene.cameras?.main;
      const follow = (camera as (Phaser.Cameras.Scene2D.Camera & { _follow?: unknown }) | undefined)?._follow;
      const player = follow ?? (scene as unknown as { playerG?: unknown }).playerG;
      if (!camera || !player) continue;
      controllers.set(scene, new FieldItemController(scene, placements));
    }
  };
  game.events.on(Phaser.Core.Events.POST_STEP, attach);
}
