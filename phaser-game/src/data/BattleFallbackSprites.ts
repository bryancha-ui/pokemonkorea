import Phaser from 'phaser';

/**
 * Battle-only copies of the original authored starter sprites. The remastered
 * artwork remains available to menus and the Pokédex, while a failed GLB uses
 * the original production sprite instead of a generated relief or blank card.
 */
const ORIGINAL_BATTLE_SPRITES: Readonly<Record<string, string>> = {
  thanatoat: 'assets/dex/thanatoat.png',
  banderado: 'assets/remaster/banderado-hq.png',
  pipetiger: 'assets/dex/pipetiger.png',
};

const PREFIX = 'pk-battle-fallback-';

export interface BattleFallbackSprite {
  key: string;
  url: string;
}

export function battleFallbackSprite(speciesKey: string): BattleFallbackSprite | undefined {
  const canonical = speciesKey.toLowerCase().replace(/^(wild|enemy|foe|ally|player|te)-/, '');
  const url = ORIGINAL_BATTLE_SPRITES[canonical];
  return url ? { key: `${PREFIX}${canonical}`, url } : undefined;
}

/** Queue the tiny fallback set early, without replacing the remastered texture
 * keys that the rest of the game already uses. */
export function preloadBattleFallbackSprites(scene: Phaser.Scene): void {
  for (const [speciesKey, url] of Object.entries(ORIGINAL_BATTLE_SPRITES)) {
    const key = `${PREFIX}${speciesKey}`;
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  }
}
