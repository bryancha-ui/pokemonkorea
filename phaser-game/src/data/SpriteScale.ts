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
  // Stone swift: a small first-form bird. 0.18 over-corrected the old 0.72 and
  // left a 35px speck in battle; this keeps it clearly small but readable.
  disguijar:    0.6,
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

/** Battle-only enlargement requested for Garchomp. Companion sizing continues
 * to use its Pokédex height and is intentionally unaffected. */
export const GARCHOMP_BATTLE_MULTIPLIER = 1.5;

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
  // Preserve the requested 1.5× enlargement in the non-3D battle fallback.
  '445': NUMERIC_SPECIES_SCALE[445] * GARCHOMP_BATTLE_MULTIPLIER,
  // These official-model species were also reported as undersized. Keep the
  // emergency 2D path in step with their authored 3D stage presence.
  '306': 2.80, // 보스로라 — at least twice the former 1.40 fit
  '635': 1.80, // 삼삼드래
  '730': 1.65, // 누리레느
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
  dracopaia: 1.55,    // 창해미르 — broad final-stage sea dragon
};

function canonicalSpriteKey(key: string): string {
  return key.toLowerCase().replace(/^(wild|enemy|foe|ally|player|te|api|gym|owned)-/, '');
}

/**
 * Final 3D size policy shared by battle and overworld followers.
 *
 * 2D art used to be the only size reference, so a handful of deliberately
 * enlarged sprites could turn their newer volumetric models into screen-sized
 * creatures. Keep ordinary authored differences, trim only known exceptions,
 * and cap the remaining extremes without changing their 2D UI presentation.
 */
const BATTLE_3D_SIZE_OVERRIDES: Readonly<Record<string, number>> = {
  // Its GLB is 2.3× longer than it is tall, so at the old 0.72 it measured three
  // world units nose-to-tail; the later 0.18 shrank it to a 35px speck. 0.45
  // gives the body mass of an ordinary small first-form bird.
  disguijar: 0.45,
  // The long beak and swept-back wings occupy far more screen width than the
  // model's normalized height suggests. Keep this small first form compact.
  kingfisher: 0.68,
  // Borrowed official models normally receive a global 0.6 reduction in the
  // battle mirror. Exact final heights here deliberately bypass that reduction
  // for the three reported large final evolutions.
  '306': 1.50, // 보스로라 — just over 2× its former ~0.73 stage height
  '635': 1.25, // 삼삼드래
  '730': 1.18, // 누리레느
  dracopaia: 1.30,
};
const COMPANION_3D_HEIGHT_OVERRIDES: Readonly<Record<string, number>> = {
  // 돌제비: the former 0.10 follower was hard to see beside the trainer.
  // Keep this first-form bird compact, but give it a small readability lift.
  // Shape correction is bypassed for explicit overrides, so the final model
  // really is 0.13 world units tall regardless of its long body proportions.
  disguijar: 0.13,
  kingfisher: 0.52,
  // 수달무당's robes and tail made the generic middle-stage height read like
  // a small first form beside the trainer.
  ottermudang: 0.70,
  // Starter families live in StarterData rather than CustomBattle's stage
  // table, so state their follower ladder here explicitly.
  munkain: 0.44,
  munklift: 0.58,
  banderado: 0.74,
  vipour: 0.44,
  scorpent: 0.58,
  onnurian: 0.44,
  onnujang: 0.58,
  // Exceptional custom silhouettes. These remain imposing while respecting
  // the street/camera-safe companion ceiling.
  arctorodon: 1.02,
  daejangseung: 0.98,
  hwanwoong: 1.08,
  nabihalmang: 1.00,
  cheonjisin: 1.00,
  poongbaek: 0.92,
  woosa: 0.92,
  woonsa: 0.92,
};

/** Complete baseline for original Pokémon, whose Pokédex entries do not have
 * canonical real-world heights. Every custom species has one of these stages. */
const COMPANION_CUSTOM_STAGE_HEIGHT: Readonly<Record<number, number>> = {
  1: 0.44,
  2: 0.58,
  3: 0.74,
  4: 0.92,
};
const COMPANION_3D_YAW_OVERRIDES_DEG: Readonly<Record<string, number>> = {
  // Readable three-quarter presentation instead of a flat side silhouette.
  kingfisher: 24,
  // This local GLB's authored head points down -Z. Match the +Z convention in
  // follower mode as well as the manifest-corrected battle presentation.
  doribi: 180,
};
export const MAX_BATTLE_3D_SIZE_SCALE = 1.25;
export const MAX_COMPANION_3D_HEIGHT = 1.08;

/** Official species have Pokédex heights. Compress those measurements so
 * Caterpie and Wailord remain recognisably different without either vanishing
 * or blocking a city street. */
function officialCompanionHeight(heightDm: number): number {
  const heightM = Math.max(0.1, heightDm / 10);
  const target = 0.38 + 0.26 * Math.sqrt(heightM);
  return Math.max(0.38, Math.min(MAX_COMPANION_3D_HEIGHT, target));
}

/** Posed bounding size of a height-normalized GLB (y ≈ 1). */
export interface ModelExtent { x: number; y: number; z: number }

// Every GLB is normalized to the same HEIGHT, which is only a fair size
// reference for upright, compact bodies. A long quadruped, a serpent or a bird
// with a trailing tail is 2–4× longer than it is tall, so at equal height it
// filled several times the screen area of its neighbours (a stage-one puppy
// measured 3.8 world units nose-to-tail beside a 1.8-unit legendary), while
// pencil-thin upright designs looked undersized. Compare silhouette area
// instead and pull each model toward the roster's typical footprint.
const TYPICAL_SILHOUETTE = 0.95;
const MIN_SHAPE_SCALE = 0.55;
const MAX_SHAPE_SCALE = 1.12;

/** Size correction for a normalized model's proportions (1 = typical body). */
export function silhouetteScale(extent: ModelExtent | undefined): number {
  if (!extent) return 1;
  const { x, y, z } = extent;
  if (![x, y, z].every(v => Number.isFinite(v) && v > 0)) return 1;
  const long = Math.max(x, z);
  const short = Math.min(x, z);
  const silhouette = Math.sqrt(y * (0.7 * long + 0.3 * short));
  if (!(silhouette > 0)) return 1;
  const scale = TYPICAL_SILHOUETTE / silhouette;
  return Math.max(MIN_SHAPE_SCALE, Math.min(MAX_SHAPE_SCALE, scale));
}

// Evolution stage → 3D battle size. Height normalization made a first-form
// hatchling exactly as tall as a final evolution; these restore the ladder
// (1 = base, 2 = middle, 3 = final, 4 = legendary).
const CUSTOM_STAGE_3D_SCALE: Readonly<Record<number, number>> = {
  1: 0.8,
  2: 0.93,
  3: 1.06,
  4: 1.18,
};

/** Stage-based 3D size for an original species with no hand-tuned size, or
 *  undefined when the species is unknown or already individually authored. */
export function customStage3DScale(key: string | undefined): number | undefined {
  const canonical = canonicalSpriteKey(key ?? '');
  if (!canonical || SPRITE_SCALE[canonical] || BATTLE_3D_SIZE_OVERRIDES[canonical] !== undefined) return undefined;
  const stage = customPokemonStage(canonical);
  return stage ? CUSTOM_STAGE_3D_SCALE[stage] : undefined;
}

/** Hand-tuned species keep their authored size; everything else is corrected
 *  for its proportions once the model's real extent is known. */
export function battle3DShapeScale(key: string | undefined, extent: ModelExtent | undefined): number {
  const canonical = canonicalSpriteKey(key ?? '');
  if (BATTLE_3D_SIZE_OVERRIDES[canonical] !== undefined) return 1;
  const scale = silhouetteScale(extent);
  // Species with an authored size multiplier are already as large as intended;
  // slim ones among them must not be enlarged a second time.
  return SPRITE_SCALE[canonical] ? Math.min(1, scale) : scale;
}

export function battle3DSizeScale(key: string | undefined, proposed: number): number {
  const canonical = canonicalSpriteKey(key ?? '');
  const override = BATTLE_3D_SIZE_OVERRIDES[canonical];
  if (override !== undefined) return override;
  const safe = Number.isFinite(proposed) ? proposed : 1;
  return Math.max(0.5, Math.min(MAX_BATTLE_3D_SIZE_SCALE, safe));
}

export function companion3DTargetHeight(key: string | undefined, proposed: number): number {
  const canonical = canonicalSpriteKey(key ?? '');
  const override = COMPANION_3D_HEIGHT_OVERRIDES[canonical];
  if (override !== undefined) return override;

  // All official species bundled for offline play carry a Pokédex height.
  // Numeric party keys therefore resolve to an explicit species-specific size.
  if (/^\d+$/.test(canonical)) {
    const heightDm = SPECIES_HEIGHT_DM.get(Number(canonical));
    if (heightDm !== undefined) return officialCompanionHeight(heightDm);
  }

  // Every original species carries an authored body/evolution tier. Unusual
  // legendary or elongated bodies are handled by the override/shape policies.
  const stage = customPokemonStage(canonical);
  if (stage !== undefined) return COMPANION_CUSTOM_STAGE_HEIGHT[stage] ?? 0.58;

  const safe = Number.isFinite(proposed) ? proposed : 0.68;
  return Math.max(0.4, Math.min(MAX_COMPANION_3D_HEIGHT, safe));
}

/** Production audit hook: registered Pokémon must never silently inherit the
 * generic fallback height. */
export function hasCompanionSizePolicy(key: string | undefined): boolean {
  const canonical = canonicalSpriteKey(key ?? '');
  if (COMPANION_3D_HEIGHT_OVERRIDES[canonical] !== undefined) return true;
  if (/^\d+$/.test(canonical) && SPECIES_HEIGHT_DM.has(Number(canonical))) return true;
  return customPokemonStage(canonical) !== undefined;
}

/** Follower counterpart of battle3DShapeScale: a long-bodied partner walking
 *  at "knee height" was otherwise longer than the trainer is tall. */
export function companion3DShapeScale(key: string | undefined, extent: ModelExtent | undefined): number {
  const canonical = canonicalSpriteKey(key ?? '');
  if (COMPANION_3D_HEIGHT_OVERRIDES[canonical] !== undefined) return 1;
  return silhouetteScale(extent);
}

export function companion3DYawOffset(key: string | undefined): number {
  const canonical = canonicalSpriteKey(key ?? '');
  return (COMPANION_3D_YAW_OVERRIDES_DEG[canonical] ?? 0) * Math.PI / 180;
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
