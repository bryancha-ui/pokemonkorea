/**
 * Battle display-size multiplier for physically-large Pokémon. All sprites are
 * normally fit to the same on-screen size; these get scaled up so leviathans,
 * towering totems and legendaries actually look big. 1 = normal.
 *
 * Keyed by sprite key (the battle texture key). Add or tune entries freely.
 */
export const SPRITE_SCALE: Record<string, number> = {
  // ── Huge ──
  arctorodon:   1.75,   // Rock/Ice leviathan
  daejangseung: 1.55,   // towering totem-of-totems
  // ── Legendaries / very large ──
  hwanwoong:    1.8,
  nabihalmang:  1.45,
  cheonjisin:   1.45,
  'nosdan-sovereign': 1.4,
  poongbaek:    1.35,
  woosa:        1.35,
  woonsa:       1.35,
  // ── Tuned-down designs ──
  disguijar:    1.4,   // enlarged authored sprite
  vipour:       0.6,   // shrink the starter to 60%
  bosongnun:    0.72,  // small snow spirit; keep both GLB and 2D fallback compact
  // ── Big final-stage designs ──
  snoqueen:     1.0,   // 60% smaller than the standard fit
  thanatoat:    1.3,
  seuphaisin:   1.3,
  honutomb:     1.25,
  banderado:    1.25,
  moransae:     1.25,
  mperodactyl:  1.3,
  noeryong:     1.3,
  komodread:    1.25,
  yeomtaeja:    0.78,  // mid-stage flame prince was oversized at 1.5×
  namsoon:      1.4,
  // ── Rival's evolved starters (ace in the later rival fights) — make him loom ──
  scorpent:     1.35,
  munklift:     1.35,
  onnujang:     1.35,
  pipetiger:     0.675, // 1.35 × 0.5 — halve Pipe Tiger's battle size
  tyranitar:     1.45,
  garchomp:      1.45,
  palmcockatoo: 2.2,   // large crest/body; clears the 3D size-bias floor visibly
  ssangdungori: 1.4,
};

/** PokéAPI species use different texture prefixes depending on whether they are
 * wild, owned, or trainer-controlled. Keep physical size consistent across all
 * of those forms instead of maintaining three aliases for every large species. */
const NUMERIC_SPECIES_SCALE: Record<number, number> = {
  95: 1.50,   // Onix
  130: 1.50,  // Gyarados
  143: 1.35,  // Snorlax
  149: 1.30,  // Dragonite
  208: 1.60,  // Steelix
  248: 1.45,  // Tyranitar
  306: 1.40,  // Aggron
  321: 1.75,  // Wailord
  373: 1.40,  // Salamence
  376: 1.40,  // Metagross
  384: 1.80,  // Rayquaza
  445: 1.45,  // Garchomp
  464: 1.40,  // Rhyperior
  483: 1.60,  // Dialga
  484: 1.55,  // Palkia
  486: 1.60,  // Regigigas
  646: 1.55,  // Kyurem
  699: 1.50,  // Aurorus (아마루르가)
};

/** Display-size multiplier for a battle sprite key (default 1). */
export function spriteScale(key: string | undefined): number {
  if (!key) return 1;
  const authored = SPRITE_SCALE[key];
  if (authored) return authored;
  const numeric = key.match(/(?:^|[-_])(\d+)$/)?.[1];
  return numeric ? (NUMERIC_SPECIES_SCALE[Number(numeric)] ?? 1) : 1;
}

/** Small readability lift for authored 2D Pokémon art in battle and hatch UI. */
export const BATTLE_2D_SPRITE_BOOST = 1.1;

export function battle2DSpriteScale(key: string | undefined): number {
  return spriteScale(key) * BATTLE_2D_SPRITE_BOOST;
}
