/**
 * The region's eight Gym Badges, in story order. Each badge is "earned" when its
 * gym-victory flag is set in the registry (the same flags that grant the gym TMs
 * in TMs.ts). Drives the Bag → Gym Badges showcase.
 */
export interface BadgeDef {
  flag:   string;   // registry flag set when the gym is beaten
  name:   string;   // badge name
  leader: string;   // gym leader
  city:   string;   // where the gym is
  type:   string;   // theming type (drives the emblem colour)
  icon:   string;   // emblem glyph
}

export const BADGES: BadgeDef[] = [
  { flag: 'gymLeaderDefeated',  name: 'Shadow Badge',         leader: 'Leader Jin', city: 'Capitol City', type: 'dark',     icon: '🌑' },
  { flag: 'baekduGymDefeated',  name: 'Summit Seal Badge',    leader: 'Byeoksan',   city: 'Baekdu',        type: 'fighting', icon: '🏔' },
  { flag: 'geumgangGymDefeated', name: 'Lantern Stage Badge', leader: 'Namsun',     city: 'Geumgang',      type: 'fairy',    icon: '🏮' },
  { flag: 'haeanGymDefeated',   name: 'Tidekeeper Badge',     leader: 'Harang',     city: 'Haean',         type: 'water',    icon: '🌊' },
  { flag: 'forestGymDefeated',  name: 'Ancient Keeper Badge', leader: 'Noksaek',    city: 'Forest',        type: 'grass',    icon: '🌿' },
  { flag: 'dolmoeGymDefeated',  name: 'Bedrock Badge',        leader: 'Sandol',     city: 'Dolmoe',        type: 'rock',     icon: '🪨' },
  { flag: 'seoraeGymDefeated',  name: 'Frostbell Badge',      leader: 'Yeona',      city: 'Seorae',        type: 'ice',      icon: '❄' },
  { flag: 'sunriseGymDefeated', name: 'Stormwatcher Badge',   leader: 'Beonge',     city: 'Sunrise',       type: 'electric', icon: '⚡' },
];

/**
 * Older saves could miss one intermediate victory flag even though a later,
 * story-gated Gym had already been cleared. The furthest earned badge is the
 * authoritative checkpoint, so fill only the preceding story badges and
 * return the corrected total for the bag and badge case.
 */
export function reconcileBadgeProgress(registry: {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
}): number {
  let furthestEarned = -1;
  BADGES.forEach((badge, index) => {
    if (registry.get(badge.flag)) furthestEarned = index;
  });

  for (let index = 0; index <= furthestEarned; index++) {
    const flag = BADGES[index].flag;
    if (!registry.get(flag)) registry.set(flag, true);
  }

  return BADGES.filter(badge => !!registry.get(badge.flag)).length;
}
