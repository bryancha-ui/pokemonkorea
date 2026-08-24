import { customPokemonStage } from './CustomBattle';
import offlineBundleJson from './pokemon-offline.json';

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
  pipetiger:     1.2,   // flame-king tiger: its 3D GLB frequently falls back to 2D,
                        //                   and the old 0.675 made that fallback tiny
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

/** Real-species height (decimetres), seeded offline and extended when PokéAPI
 *  species are fetched. This keeps official Pokémon at a recognisable relative
 *  scale even on the first frame of an offline/mobile session. */
// Seed physical sizes from the offline roster so an already-caught Pokémon is
// sized correctly before any asynchronous PokéAPI request runs. Online data can
// still extend/refresh this registry through registerSpeciesHeight().
const OFFLINE_HEIGHTS = (offlineBundleJson as unknown as {
  pokemon: Record<string, { id: number; heightDm?: number }>;
}).pokemon;
const SPECIES_HEIGHT_DM = new Map<number, number>(
  Object.values(OFFLINE_HEIGHTS)
    .filter(entry => Number.isFinite(entry.heightDm) && (entry.heightDm ?? 0) > 0)
    .map(entry => [entry.id, entry.heightDm!] as [number, number]),
);
export function registerSpeciesHeight(id: number, heightDm: number): void {
  if (id > 0 && heightDm > 0) SPECIES_HEIGHT_DM.set(id, heightDm);
}

/** Compress a real height (metres) into a battle-size multiplier. A ~1 m Pokémon
 *  sits near 1.15 (a small readability lift so API mons aren't dwarfed by the
 *  authored roster); giants and tiny bugs fan out around it on a gentle curve,
 *  clamped so a stray leviathan can't overflow the stage. Species with an explicit
 *  NUMERIC_SPECIES_SCALE entry keep that authored value instead. */
function heightScale(heightM: number): number {
  return Math.min(1.7, Math.max(0.9, 1.15 * Math.pow(heightM, 0.4)));
}

/** Display-size multiplier for a battle sprite key (default 1). */
export function spriteScale(key: string | undefined): number {
  if (!key) return 1;
  const authored = SPRITE_SCALE[key];
  if (authored) return authored;
  const numeric = key.match(/(?:^|[-_])(\d+)$/)?.[1];
  if (!numeric) return 1;
  const id = Number(numeric);
  if (NUMERIC_SPECIES_SCALE[id]) return NUMERIC_SPECIES_SCALE[id];
  const dm = SPECIES_HEIGHT_DM.get(id);
  return dm ? heightScale(dm / 10) : 1;
}

/** Small readability lift for authored 2D Pokémon art in battle and hatch UI. */
export const BATTLE_2D_SPRITE_BOOST = 1.1;

// 2D-only sizing keeps small first forms compact and lets final/legendary
// silhouettes carry the same visual authority as real-species artwork. These
// values do not alter a shipped GLB's normalized 3D height.
const CUSTOM_STAGE_2D_SCALE: Readonly<Record<number, number>> = {
  1: 0.90,
  2: 1.08,
  3: 1.24,
  4: 1.38,
};

const BATTLE_2D_OVERRIDES: Readonly<Record<string, number>> = {
  // The high-resolution fallback has a tall, narrow silhouette and read too
  // small beside the final-stage starter models.
  banderado: 1.44,
  // Orchard matriarch: preserve her broad crown/robe at final-stage scale.
  secommamma: 1.30,
  // The broad turtle-ship art was being fitted as a normal stage-two creature,
  // leaving the emergency 2D presentation much smaller than its armoured body.
  turtleship: 1.46,
  // On mobile these two frequently fall back to 2D — nabihalmang is gated off the
  // mobile GLB allowlist entirely, and yeomtaeja's GLB often fails to decode — so
  // their flat art must read at roughly the same on-screen size as the 3D model
  // it stands in for, not the small stage-fit the raw sprite scale produced.
  yeomtaeja:  1.55,   // 염태자 — 3D scale is 0.78, but the 2D fit reads far smaller
  nabihalmang: 2.0,   // 나비할망 — legendary moth; the 1.45 fit looked tiny on phones
  // Final-stage designs whose 2D art was reading undersized in battle.
  pipetiger:  1.6,    // 염흥왕 — flame king; its GLB often falls back to 2D, which was small
  palossandx: 1.4,    // 사다이스 — stage-two fit (~1.19) was too small for its bulk
  dracoelido: 1.6,    // 방패공룡 — Rock/Dragon shield saurian; stage-three fit was too small
};

function canonicalSpriteKey(key: string): string {
  return key.toLowerCase().replace(/^(wild|enemy|foe|ally|player|te)-/, '');
}

export function battle2DSpriteScale(key: string | undefined): number {
  if (!key) return BATTLE_2D_SPRITE_BOOST;
  const canonical = canonicalSpriteKey(key);
  const override = BATTLE_2D_OVERRIDES[canonical];
  if (override) return override * BATTLE_2D_SPRITE_BOOST;
  // Existing hand-tuned exceptions (tiny spirits, leviathans, bosses, etc.)
  // take priority over the general evolution-stage curve.
  if (SPRITE_SCALE[canonical]) return SPRITE_SCALE[canonical] * BATTLE_2D_SPRITE_BOOST;
  const stage = customPokemonStage(canonical);
  const stageScale = stage ? CUSTOM_STAGE_2D_SCALE[stage] : undefined;
  return (stageScale ?? spriteScale(key)) * BATTLE_2D_SPRITE_BOOST;
}
