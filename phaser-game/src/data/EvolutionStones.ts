export interface StoneEvolutionRule {
  stoneKey: string;
  fromKey: string;
  toKey: string;
}

export const EVOLUTION_STONE_KEYS = [
  'firestone', 'waterstone', 'thunderstone', 'leafstone', 'icestone',
  'moonstone', 'sunstone', 'shinystone', 'duskstone', 'dawnstone',
] as const;

/** Optional stone shortcuts for regional species. Normal level-up evolution
 * remains available, so finding a stone creates a choice rather than a lock. */
export const STONE_EVOLUTIONS: readonly StoneEvolutionRule[] = [
  { stoneKey: 'firestone',    fromKey: 'tigerbabe',       toKey: 'yeomtaeja' },
  { stoneKey: 'waterstone',   fromKey: 'ottershaman',     toKey: 'ottermudang' },
  { stoneKey: 'thunderstone', fromKey: 'ssangdungori',    toKey: 'ampere' },
  { stoneKey: 'thunderstone', fromKey: 'saekomassi',      toKey: 'secommamma' },
  { stoneKey: 'leafstone',    fromKey: 'ssaktrin',        toKey: 'longroffe' },
  { stoneKey: 'leafstone',    fromKey: 'moranlovebird',   toKey: 'moransae' },
  { stoneKey: 'icestone',     fromKey: 'onnurigrowlithe', toKey: 'onnuriarcanine' },
  { stoneKey: 'moonstone',    fromKey: 'luninari',        toKey: 'snoqueen' },
  { stoneKey: 'sunstone',     fromKey: 'norigung',        toKey: 'mugungmama' },
  { stoneKey: 'shinystone',   fromKey: 'danachungi',      toKey: 'nabiguni' },
  { stoneKey: 'shinystone',   fromKey: 'onnurismoochum',  toKey: 'idolena' },
  { stoneKey: 'duskstone',    fromKey: 'honupup',         toKey: 'honutomb' },
  { stoneKey: 'duskstone',    fromKey: 'groundzoome',     toKey: 'groundzomber' },
  { stoneKey: 'dawnstone',    fromKey: 'bosongnun',       toKey: 'luninari' },
] as const;
