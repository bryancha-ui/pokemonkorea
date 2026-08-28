import Phaser from 'phaser';

/** Authoritative species/model identity carried by every battle sprite.
 *
 * Phaser may temporarily need a transparent texture while a large mobile asset
 * finishes loading. The 3D mirror must still know which Pokémon owns that slot
 * instead of mistaking an arbitrary fallback texture for the combatant. */
export const BATTLE_POKEMON_MODEL_KEY = 'battlePokemonModelKey';

const TRANSPARENT_BATTLE_TEXTURE = '__pk-battle-transparent';

function transparentBattleTexture(scene: Phaser.Scene): string {
  if (!scene.textures.exists(TRANSPARENT_BATTLE_TEXTURE)) {
    const texture = scene.textures.createCanvas(TRANSPARENT_BATTLE_TEXTURE, 2, 2);
    if (!texture) throw new Error('Unable to create the neutral battle texture');
    texture.context.clearRect(0, 0, 2, 2);
    texture.refresh();
  }
  return TRANSPARENT_BATTLE_TEXTURE;
}

/** Return the requested texture or a species-neutral transparent placeholder.
 * Never substitute a different Pokémon: that corrupts both the visible sprite
 * and the 3D mirror's species selection on slow mobile loads. */
export function battlePokemonTextureKey(scene: Phaser.Scene, requestedKey: string): string {
  return requestedKey && scene.textures.exists(requestedKey)
    ? requestedKey
    : transparentBattleTexture(scene);
}

/** Atomically update a battle slot's logical Pokémon and its best 2D texture.
 * Returns true when the real 2D texture is available. A registered GLB can
 * still render from the logical key while the placeholder is transparent. */
export function setBattlePokemonSprite(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image,
  requestedKey: string,
): boolean {
  sprite.setData(BATTLE_POKEMON_MODEL_KEY, requestedKey);
  const actualKey = battlePokemonTextureKey(scene, requestedKey);
  if (sprite.texture.key !== actualKey) sprite.setTexture(actualKey);
  return actualKey === requestedKey;
}

export function battlePokemonModelKey(sprite: Phaser.GameObjects.Image): string {
  const tagged = sprite.getData(BATTLE_POKEMON_MODEL_KEY);
  return typeof tagged === 'string' && tagged ? tagged : sprite.texture.key;
}
