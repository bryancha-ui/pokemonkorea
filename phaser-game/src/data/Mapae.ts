import Phaser from 'phaser';

// ── 마패 (mapae) — the northern 어사대 tokens ─────────────────────────────────────
// The Northern League doesn't use gym badges. Each of the eight 어사대장 (Inspectorate
// Chiefs) runs a regional test; clearing it awards one 마패 (the royal-inspector's horse
// tablet). All eight 마패 + the eight southern badges make a trainer eligible for the
// Northern League. Each entry keys a registry flag `mapae_<key>` set true on victory.

export interface MapaeDef {
  key: string;
  city: string;
  cityKo: string;
  chief: string;
  chiefKo: string;
  icon: string;
}

export const MAPAE: MapaeDef[] = [
  { key: 'kaesong', city: 'Songhyeon', cityKo: '송현', chief: 'Inspector Chief Hyeon', chiefKo: '어사대장 현', icon: '📜' },
  { key: 'nampo', city: 'Parangpo', cityKo: '파랑포', chief: 'Inspector Chief Haemin', chiefKo: '어사대장 해민', icon: '🌊' },
  { key: 'wonsan', city: 'Haesol', cityKo: '해솔', chief: 'Inspector Chief Haegang', chiefKo: '어사대장 해강', icon: '🥋' },
  { key: 'hamhung', city: 'Gangcheoldo', cityKo: '강철도', chief: 'Inspector Chief Cheolju', chiefKo: '어사대장 철주', icon: '⚙️' },
  { key: 'chongjin', city: 'Muyeonhang', cityKo: '무연항', chief: 'Inspector Chief Mukyeong', chiefKo: '어사대장 무경', icon: '🌫️' },
  { key: 'sinuiju', city: 'Binghagwan', cityKo: '빙하관', chief: 'Inspector Chief Amrok', chiefKo: '어사대장 압록', icon: '🧊' },
  { key: 'samjiyon', city: 'Samho', cityKo: '삼호', chief: 'Inspector Chief Seolwon', chiefKo: '어사대장 설원', icon: '🏔️' },
  { key: 'pyeongseong', city: 'Gwanmunseong', cityKo: '관문성', chief: 'Supreme Commander Gwang', chiefKo: '어사대 총수 광', icon: '👑' },
];

/** The capital is the eighth/final trial, so its gate is unlocked by the seven
 * regional tablets only. Keep this rule central so checkpoints, Fly and direct
 * scene restores cannot disagree. */
export const PYEONGSEONG_REQUIRED_MAPAE = 7;
const REGIONAL_MAPAE_KEYS = MAPAE.filter(m => m.key !== 'pyeongseong').map(m => m.key);

const flag = (key: string) => `mapae_${key}`;

export function hasMapae(reg: Phaser.Data.DataManager, key: string): boolean {
  return !!reg.get(flag(key));
}
export function awardMapae(reg: Phaser.Data.DataManager, key: string): void {
  reg.set(flag(key), true);
  // Update the count in registry
  const currentCount = MAPAE.reduce((n, m) => n + (reg.get(flag(m.key)) ? 1 : 0), 0);
  reg.set('mapaeCount', currentCount);
}
/** How many of the eight 마패 the player currently holds. */
export function mapaeCount(reg: Phaser.Data.DataManager): number {
  // Reaching the end of the Northern League proves the full circuit was
  // completed. Repair very old saves that did not persist every tablet flag.
  if (reg.get('northLeagueDone')) {
    MAPAE.forEach(mapae => {
      if (!reg.get(flag(mapae.key))) reg.set(flag(mapae.key), true);
    });
  }
  // Individual award flags are authoritative. Recalculate every time so an old
  // or partially restored save can never keep a stale cached pouch total.
  const calculated = MAPAE.reduce((n, m) => n + (reg.get(flag(m.key)) ? 1 : 0), 0);
  if (reg.get('mapaeCount') !== calculated) reg.set('mapaeCount', calculated);
  return calculated;
}

/** Count only the seven tablets earned before entering Gwanmunseong. */
export function regionalMapaeCount(reg: Phaser.Data.DataManager): number {
  return REGIONAL_MAPAE_KEYS.reduce((n, key) => n + (hasMapae(reg, key) ? 1 : 0), 0);
}

/** Authoritative entry condition for Pyeongseong/Gwanmunseong. */
export function canEnterPyeongseong(reg: Phaser.Data.DataManager): boolean {
  return regionalMapaeCount(reg) >= PYEONGSEONG_REQUIRED_MAPAE;
}
/** Eligible for the Northern League: all 8 마패 AND all 8 southern badges. */
export function northernLeagueEligible(reg: Phaser.Data.DataManager): boolean {
  return mapaeCount(reg) >= 8 && !!reg.get('sunriseGymDefeated');
}
