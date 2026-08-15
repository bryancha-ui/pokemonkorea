import Phaser from 'phaser';
import { setBikeRiding } from '../data/Bike';
import { PartySystem } from './PartySystem';

const SURFING_3D_KEY = 'characterSurfing3D';
const surfAccessCache = new WeakMap<Phaser.Data.DataManager, { party: unknown; allowed: boolean }>();

export interface SurfMapOptions<T extends number> {
  /** The scene's authored tile map. */
  map: () => readonly (readonly T[])[];
  /** The procedural player graphic mirrored by the 3D overworld. */
  player: () => Phaser.GameObjects.Graphics;
  /** Current world-space player centre. */
  position: () => { x: number; y: number };
  tileSize: number;
  waterTiles: readonly T[];
  /** The collision set used by the scene's own corner checks. */
  solidTiles: Set<T>;
}

/** Field Surf is available only while a current party member knows the move. */
export function canUseSurf(registry: Phaser.Data.DataManager): boolean {
  const party = registry.get('party');
  const cached = surfAccessCache.get(registry);
  if (cached && cached.party === party) return cached.allowed;
  const allowed = PartySystem.anyKnows(registry, 'Surf');
  // PartySystem may migrate an old save while reading it, so cache the final
  // serialized value rather than the pre-migration snapshot.
  surfAccessCache.set(registry, { party: registry.get('party'), allowed });
  return allowed;
}

/** True when the universal Surf controller currently has the player mounted. */
export function isSurfing(player: Phaser.GameObjects.GameObject): boolean {
  return player.getData(SURFING_3D_KEY) === true;
}

/**
 * Makes every authored water tile in a conventional tile scene Surf-aware.
 * The scene keeps ownership of movement and collision; this controller only
 * toggles its water tile IDs, detects boarding/dismounting, and supplies a 2D
 * wake plus the `characterSurfing3D` signal consumed by OverworldMirror.
 */
export function installSurfing<T extends number>(scene: Phaser.Scene, options: SurfMapOptions<T>): void {
  const water = new Set(options.waterTiles);
  const originalCollision = new Map<T, boolean>();
  options.waterTiles.forEach(tile => originalCollision.set(tile, options.solidTiles.has(tile)));

  // This fallback mount is hidden by the 3D mirror (`no3d`) but keeps the game
  // readable when WebGL 3D is unavailable.
  const mount = scene.add.graphics().setVisible(false).setDepth(19);
  mount.setData('no3d', true);
  mount.fillStyle(0xcdeeff, 0.8);
  mount.fillEllipse(-13, 14, 11, 4);
  mount.fillEllipse(13, 14, 11, 4);
  mount.fillStyle(0x1f6fae, 1);
  mount.fillEllipse(0, 10, 36, 15);
  mount.fillStyle(0x53a6d8, 1);
  mount.fillEllipse(0, 7, 27, 10);
  mount.fillStyle(0x3a8fc0, 1);
  mount.fillEllipse(0, -4, 13, 12);
  mount.fillStyle(0x79cbe5, 1);
  mount.fillEllipse(0, -1, 9, 5);
  mount.fillStyle(0x101923, 1);
  mount.fillRect(-4, -6, 2, 2);
  mount.fillRect(2, -6, 2, 2);

  let wasSurfing = false;
  const sync = () => {
    const allowed = canUseSurf(scene.registry);
    for (const tile of options.waterTiles) {
      if (allowed) options.solidTiles.delete(tile);
      else options.solidTiles.add(tile);
    }

    const { x, y } = options.position();
    const row = Math.floor(y / options.tileSize);
    const col = Math.floor(x / options.tileSize);
    const tile = options.map()[row]?.[col];
    const surfing = allowed && tile !== undefined && water.has(tile);
    const player = options.player();

    if (surfing) setBikeRiding(scene.registry, false);
    if (surfing !== wasSurfing) player.setData(SURFING_3D_KEY, surfing);
    wasSurfing = surfing;
    mount.setPosition(x, y).setDepth(player.depth - 0.1).setVisible(surfing);
  };

  const cleanup = () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
    const player = options.player();
    player.setData(SURFING_3D_KEY, false);
    for (const [tile, wasSolid] of originalCollision) {
      if (wasSolid) options.solidTiles.add(tile);
      else options.solidTiles.delete(tile);
    }
    mount.destroy();
  };

  sync();
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
}
