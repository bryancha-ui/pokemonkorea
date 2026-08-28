/**
 * Items, inventory and money.
 * Inventory is stored in the registry as a JSON map { itemKey: count }.
 * Money is a plain registry number 'money'.
 */
import Phaser from 'phaser';
import { TMS } from '../data/TMs';
import { t, tr } from './i18n';

export type ItemCategory = 'heal' | 'status' | 'revive' | 'ball' | 'hm' | 'ppheal' | 'held' | 'souvenir' | 'key' | 'evolution';

export interface ItemDef {
  key:      string;
  name:     string;
  icon:     string;
  price:    number;
  category: ItemCategory;
  desc:     string;
  heal?:    number;        // HP restored (9999 = full)
  cures?:   string[];      // status keys cured, or ['all']
  revive?:  number;        // fraction of maxHP restored on revive (0.5, 1)
  ballRate?: number;       // catch multiplier
  move?:    string;        // HM/TM: the move it teaches
  learnTypes?: string[];   // HM/TM: types allowed to learn it (empty = any type)
  ppRestore?: number;      // PP restored to each move (9999 = fully restore)
  evolutionStone?: string; // stone key consumed by a matching evolution
}

export const ITEMS: ItemDef[] = [
  { key: 'potion',      name: 'Potion',       icon: '🧪', price: 200,  category: 'heal',   desc: 'Restores 20 HP.',          heal: 20 },
  { key: 'superpotion', name: 'Super Potion', icon: '🧪', price: 700,  category: 'heal',   desc: 'Restores 60 HP.',          heal: 60 },
  { key: 'hyperpotion', name: 'Hyper Potion', icon: '🧪', price: 1500, category: 'heal',   desc: 'Restores 120 HP.',         heal: 120 },
  { key: 'maxpotion',   name: 'Max Potion',   icon: '🧪', price: 2500, category: 'heal',   desc: 'Fully restores HP.',       heal: 9999 },
  { key: 'revive',      name: 'Revive',       icon: '✨', price: 2000, category: 'revive', desc: 'Revives a fainted Pokémon to half HP.', revive: 0.5 },
  { key: 'maxrevive',   name: 'Max Revive',   icon: '🌟', price: 4000, category: 'revive', desc: 'Revives a fainted Pokémon to full HP.', revive: 1 },
  { key: 'antidote',    name: 'Antidote',     icon: '💊', price: 100,  category: 'status', desc: 'Cures poison.',            cures: ['psn', 'tox'] },
  { key: 'paralyzeheal',name: 'Paralyze Heal',icon: '💊', price: 200,  category: 'status', desc: 'Cures paralysis.',         cures: ['par'] },
  { key: 'burnheal',    name: 'Burn Heal',    icon: '💊', price: 250,  category: 'status', desc: 'Cures a burn.',            cures: ['brn'] },
  { key: 'iceheal',     name: 'Ice Heal',     icon: '💊', price: 250,  category: 'status', desc: 'Thaws a frozen Pokémon.',  cures: ['frz'] },
  { key: 'awakening',   name: 'Awakening',    icon: '💊', price: 250,  category: 'status', desc: 'Wakes a sleeping Pokémon.', cures: ['slp'] },
  { key: 'fullheal',    name: 'Full Heal',    icon: '💠', price: 600,  category: 'status', desc: 'Cures any status problem.', cures: ['all'] },
  { key: 'pokeball',    name: 'Poké Ball',    icon: '🔴', price: 200,  category: 'ball',   desc: 'A device for catching Pokémon.', ballRate: 1 },
  { key: 'greatball',   name: 'Great Ball',   icon: '🔵', price: 600,  category: 'ball',   desc: 'A good ball with a higher catch rate.', ballRate: 1.5 },
  { key: 'ultraball',   name: 'Ultra Ball',   icon: '🟡', price: 1200, category: 'ball',   desc: 'An ultra-performance catch ball.', ballRate: 2 },
  { key: 'masterball',  name: 'Master Ball',  icon: '🟣', price: 0,    category: 'ball',   desc: 'The best Ball. Catches any Pokémon without fail.', ballRate: 255 },
  { key: 'ether',       name: 'Ether',        icon: '🧴', price: 1200, category: 'ppheal', desc: 'Restores 20 PP to each of a Pokémon\'s moves.', ppRestore: 20 },
  { key: 'elixir',      name: 'Elixir',       icon: '🍶', price: 2500, category: 'ppheal', desc: 'Fully restores the PP of all of a Pokémon\'s moves.', ppRestore: 9999 },
  // Evolution stones are deliberately rare field rewards. Selecting one in the
  // Bag opens the party picker and only a compatible species will react.
  { key: 'firestone',    name: 'Fire Stone',    icon: '🔥', price: 3000, category: 'evolution', desc: 'A fiery stone that can trigger certain evolutions.', evolutionStone: 'firestone' },
  { key: 'waterstone',   name: 'Water Stone',   icon: '💧', price: 3000, category: 'evolution', desc: 'A clear blue stone that can trigger certain evolutions.', evolutionStone: 'waterstone' },
  { key: 'thunderstone', name: 'Thunder Stone', icon: '⚡', price: 3000, category: 'evolution', desc: 'A charged stone that can trigger certain evolutions.', evolutionStone: 'thunderstone' },
  { key: 'leafstone',    name: 'Leaf Stone',    icon: '🍃', price: 3000, category: 'evolution', desc: 'A leaf-patterned stone that can trigger certain evolutions.', evolutionStone: 'leafstone' },
  { key: 'icestone',     name: 'Ice Stone',     icon: '❄️', price: 3000, category: 'evolution', desc: 'A frozen stone that can trigger certain evolutions.', evolutionStone: 'icestone' },
  { key: 'moonstone',    name: 'Moon Stone',    icon: '🌙', price: 3500, category: 'evolution', desc: 'A moonlit stone that can trigger certain evolutions.', evolutionStone: 'moonstone' },
  { key: 'sunstone',     name: 'Sun Stone',     icon: '☀️', price: 3500, category: 'evolution', desc: 'A radiant stone that can trigger certain evolutions.', evolutionStone: 'sunstone' },
  { key: 'shinystone',   name: 'Shiny Stone',   icon: '💎', price: 4000, category: 'evolution', desc: 'A brilliant stone that can trigger certain evolutions.', evolutionStone: 'shinystone' },
  { key: 'duskstone',    name: 'Dusk Stone',    icon: '🌑', price: 4000, category: 'evolution', desc: 'A shadowy stone that can trigger certain evolutions.', evolutionStone: 'duskstone' },
  { key: 'dawnstone',    name: 'Dawn Stone',    icon: '🌅', price: 4000, category: 'evolution', desc: 'A sparkling stone that can trigger certain evolutions.', evolutionStone: 'dawnstone' },
  // Held items. Berries are consumed in battle; equipment can be swapped freely
  // from the Bag and any replaced item is returned to the inventory.
  { key: 'oranberry',   name: 'Oran Berry',   icon: '🫐', price: 200,  category: 'held', desc: 'Held: restores 10 HP at low HP.' },
  { key: 'sitrusberry', name: 'Sitrus Berry', icon: '🍋', price: 800,  category: 'held', desc: 'Held: restores one quarter of max HP at low HP.' },
  { key: 'lumberry',    name: 'Lum Berry',    icon: '🫒', price: 1200, category: 'held', desc: 'Held: cures any major status condition.' },
  { key: 'leftovers',   name: 'Leftovers',    icon: '🍱', price: 4000, category: 'held', desc: 'Held: gradually restores HP every turn.' },
  { key: 'expertbelt',  name: 'Expert Belt',  icon: '🥋', price: 3500, category: 'held', desc: 'Held: powers up super-effective attacks.' },
  { key: 'charcoal',    name: 'Charcoal',     icon: '🪵', price: 2000, category: 'held', desc: 'Held: powers up Fire-type attacks.' },
  { key: 'mysticwater', name: 'Mystic Water', icon: '💧', price: 2000, category: 'held', desc: 'Held: powers up Water-type attacks.' },
  { key: 'miracleseed', name: 'Miracle Seed', icon: '🌱', price: 2000, category: 'held', desc: 'Held: powers up Grass-type attacks.' },
  { key: 'magnet',      name: 'Magnet',       icon: '🧲', price: 2000, category: 'held', desc: 'Held: powers up Electric-type attacks.' },
  { key: 'hm_fly',      name: 'HM01 · Fly',   icon: '✈️', price: 0,    category: 'hm',     desc: 'Teach Fly to a Flying-type Pokémon. Reusable.', move: 'Fly', learnTypes: ['flying'] },
  // Key item — Prof. Song's gift. While carried, the whole party shares battle EXP.
  { key: 'expshare',    name: 'Exp. Share',   icon: '📡', price: 0,    category: 'key',    desc: 'Shares battle EXP with every Pokémon in your party, even benched ones.' },
  // ── Food-court drinks & snacks (Dept. Store 5F) ──
  { key: 'freshwater',  name: 'Fresh Water',  icon: '💧', price: 200,  category: 'heal',   desc: 'Mountain spring water. Restores 30 HP.',  heal: 30 },
  { key: 'sodapop',     name: 'Soda Pop',     icon: '🥤', price: 300,  category: 'heal',   desc: 'A fizzy soft drink. Restores 60 HP.',     heal: 60 },
  { key: 'lemonade',    name: 'Lemonade',     icon: '🍋', price: 400,  category: 'heal',   desc: 'A sweet-tart cooler. Restores 90 HP.',    heal: 90 },
  { key: 'moomoomilk',  name: 'Moomoo Milk',  icon: '🥛', price: 600,  category: 'heal',   desc: 'Rich, nourishing milk. Restores 120 HP.', heal: 120 },
  { key: 'lavacookie',  name: 'Lava Cookie',  icon: '🍪', price: 250,  category: 'status', desc: 'A regional treat. Cures any status problem.', cures: ['all'] },
  // ── Souvenirs (Dept. Store 4F) — mementos, kept for the memory ──
  { key: 'sv_munkain',  name: 'Munkain Plush',   icon: '🧸', price: 800,  category: 'souvenir', desc: 'A plush of the Grass starter. Impossibly soft.' },
  { key: 'sv_vipour',   name: 'Vipour Plush',    icon: '🧸', price: 800,  category: 'souvenir', desc: 'A plush of the Fire starter. Warm to the touch.' },
  { key: 'sv_onnurian', name: 'Onnurian Plush',  icon: '🧸', price: 800,  category: 'souvenir', desc: 'A plush of the Water starter. Faintly damp.' },
  { key: 'sv_corrpanda',name: 'Corrpanda Doll',  icon: '🐼', price: 1200, category: 'souvenir', desc: 'A doll of Leader Jin\'s shadow-panda ace.' },
  { key: 'sv_nabi',     name: '나비할망 Charm',    icon: '🦋', price: 2500, category: 'souvenir', desc: 'A dancheong-painted charm of the moth grandmother. Said to bring luck.' },
  { key: 'sv_jangseung',name: '대장승 Figurine',   icon: '🗿', price: 1500, category: 'souvenir', desc: 'A carved granite figurine of the guardian totem.' },
  // Gym-leader TMs — reusable, learnable by any Pokémon (see data/TMs.ts).
  ...TMS.map((tm): ItemDef => ({
    key: tm.key, name: `TM · ${tm.move}`, icon: '📀', price: tm.price ?? 0, category: 'hm',
    desc: `Teaches ${tm.move}. Reusable — any Pokémon can learn it.`, move: tm.move, learnTypes: [],
  })),
];

const BY_KEY = new Map(ITEMS.map(i => [i.key, i]));
export function itemDef(key: string): ItemDef | undefined { return BY_KEY.get(key); }

/** Localized item copy. TM strings are generated dynamically, so an exact
 * dictionary lookup cannot translate their move-dependent names/descriptions. */
export function itemName(def: ItemDef): string {
  const stoneNames: Record<string, [string, string]> = {
    firestone: ['불꽃의돌', 'ほのおのいし'], waterstone: ['물의돌', 'みずのいし'],
    thunderstone: ['천둥의돌', 'かみなりのいし'], leafstone: ['리프의돌', 'リーフのいし'],
    icestone: ['얼음의돌', 'こおりのいし'], moonstone: ['달의돌', 'つきのいし'],
    sunstone: ['태양의돌', 'たいようのいし'], shinystone: ['빛의돌', 'ひかりのいし'],
    duskstone: ['어둠의돌', 'やみのいし'], dawnstone: ['각성의돌', 'めざめいし'],
  };
  const stone = stoneNames[def.key];
  if (stone) return t(def.name, stone[0], stone[1]);
  if (def.key.startsWith('tm_') && def.move)
    return t(`TM · ${def.move}`, `기술머신 · ${tr(def.move)}`);
  if (def.key === 'hm_fly' && def.move)
    return t(`HM01 · ${def.move}`, `비전머신01 · ${tr(def.move)}`);
  return tr(def.name);
}

export function itemDescription(def: ItemDef): string {
  if (def.category === 'evolution') return t(
    def.desc,
    '특정 포켓몬의 진화를 일으키는 신비한 돌이다.',
    '特定の ポケモンを 進化させる 不思議な 石。',
  );
  if (def.key.startsWith('tm_') && def.move)
    return t(
      `Teaches ${def.move}. Reusable — any Pokémon can learn it.`,
      `${tr(def.move)} 기술을 가르친다. 재사용 가능 — 모든 포켓몬이 배울 수 있다.`,
    );
  if (def.key === 'hm_fly' && def.move)
    return t(
      'Teach Fly to a Flying-type Pokémon. Reusable.',
      `비행타입 포켓몬에게 ${tr(def.move)} 기술을 가르친다. 재사용 가능.`,
    );
  return tr(def.desc);
}

const INV = 'inventory';

export const Inventory = {
  all(registry: Phaser.Data.DataManager): Record<string, number> {
    const raw = registry.get(INV) as string | undefined;
    if (!raw) return {};
    try { return JSON.parse(raw) as Record<string, number>; } catch { return {}; }
  },
  set(registry: Phaser.Data.DataManager, inv: Record<string, number>): void {
    registry.set(INV, JSON.stringify(inv));
  },
  count(registry: Phaser.Data.DataManager, key: string): number {
    return this.all(registry)[key] ?? 0;
  },
  add(registry: Phaser.Data.DataManager, key: string, n = 1): void {
    const inv = this.all(registry);
    inv[key] = (inv[key] ?? 0) + n;
    this.set(registry, inv);
    // Mirror Poké Ball count to legacy 'pokeballs' for the catch UI
    if (key === 'pokeball') registry.set('pokeballs', inv[key]);
  },
  remove(registry: Phaser.Data.DataManager, key: string, n = 1): boolean {
    const inv = this.all(registry);
    if ((inv[key] ?? 0) < n) return false;
    inv[key] -= n;
    if (inv[key] <= 0) delete inv[key];
    this.set(registry, inv);
    if (key === 'pokeball') registry.set('pokeballs', inv['pokeball'] ?? 0);
    return true;
  },

  // ── Money ───────────────────────────────────────────────────────────────
  money(registry: Phaser.Data.DataManager): number {
    return (registry.get('money') as number) ?? 0;
  },
  addMoney(registry: Phaser.Data.DataManager, n: number): void {
    registry.set('money', Math.max(0, this.money(registry) + n));
  },
  spend(registry: Phaser.Data.DataManager, n: number): boolean {
    if (this.money(registry) < n) return false;
    registry.set('money', this.money(registry) - n);
    return true;
  },

  /** One-time starter kit + sync legacy pokeballs into the inventory. */
  ensureInit(registry: Phaser.Data.DataManager): void {
    // Retroactively hand Prof. Song's Exp. Share to saves created before it
    // existed: any game that already left the lab (has a party) gets it once.
    // New games skip the grant here and receive it from the starter scene.
    if (!registry.get('expshareGranted')) {
      registry.set('expshareGranted', true);
      if (PartySystem.get(registry).some(Boolean)) this.add(registry, 'expshare');
    }
    if (registry.get('inventoryInit')) {
      // keep legacy pokeballs count in sync if it grew elsewhere (e.g. Kisun gift)
      const legacy = (registry.get('pokeballs') as number) ?? 0;
      const inv = this.all(registry);
      if ((inv['pokeball'] ?? 0) < legacy) { inv['pokeball'] = legacy; this.set(registry, inv); }
      return;
    }
    registry.set('inventoryInit', true);
    if (registry.get('money') === undefined) registry.set('money', 3000);
    const inv = this.all(registry);
    inv['potion']   = (inv['potion'] ?? 0) + 5;
    inv['pokeball'] = (inv['pokeball'] ?? 0) + ((registry.get('pokeballs') as number) ?? 0);
    this.set(registry, inv);
    registry.set('pokeballs', inv['pokeball'] ?? 0);
  },
};

export function formatMoney(n: number): string {
  return `₩${n.toLocaleString('ko-KR')}`;
}

/** True once Prof. Song's Exp. Share has been received (it lives in the bag). */
export function expShareOwned(registry: Phaser.Data.DataManager): boolean {
  return Inventory.count(registry, 'expshare') > 0;
}

/** True when the Exp. Share is owned AND switched on — the whole party then
 *  shares battle EXP (see awardBenchExp). Toggled from the BAG. */
export function expShareActive(registry: Phaser.Data.DataManager): boolean {
  return expShareOwned(registry) && !registry.get('expShareOff');
}

import { PartySystem, PartyEntry } from './PartySystem';
import { buildFromEntry } from './PartyBattle';
import { queueStoneEvolution } from './EvolutionSystem';

export interface UseResult {
  ok: boolean;
  message: string;
  /** True only when this exact item use queued a stone evolution. A pending
   * level-up evolution elsewhere in the party must never make a Potion, held
   * item, status cure, etc. open EvolutionScene. */
  evolutionQueued?: boolean;
}

/** Whether a Pokémon is allowed to learn an HM/TM move (by type restriction). */
export function canLearnMove(entry: PartyEntry, def: ItemDef): boolean {
  if (!def.learnTypes || def.learnTypes.length === 0) return true;
  const types = [entry.type1, entry.type2].filter(Boolean).map(t => (t as string).toLowerCase());
  return def.learnTypes.some(lt => types.includes(lt.toLowerCase()));
}

/**
 * Teach an HM's move to a party slot. HMs are reusable, so nothing is consumed.
 */
export function teachHM(
  registry: Phaser.Data.DataManager, itemKey: string, slot: number,
): UseResult {
  const def = itemDef(itemKey);
  const mon = PartySystem.get(registry)[slot];
  if (!def || !def.move || !mon) return { ok: false, message: 'It had no effect.' };
  if (mon.moves.some(m => m.toLowerCase() === def.move!.toLowerCase())) {
    return { ok: false, message: `${mon.name} already knows ${def.move}.` };
  }
  if (!canLearnMove(mon, def)) {
    return { ok: false, message: `${mon.name} can't learn ${def.move}.` };
  }
  PartySystem.teachMove(registry, slot, def.move);
  return { ok: true, message: `${mon.name} learned ${def.move}!` };
}

/**
 * Try to use a (non-ball) item on a party slot. On success, consumes the item.
 * Returns a result message for the UI.
 */
export function useItemOnSlot(
  registry: Phaser.Data.DataManager, itemKey: string, slot: number,
): UseResult {
  const def = itemDef(itemKey);
  const party = PartySystem.get(registry);
  const mon = party[slot];
  if (!def || !mon) return { ok: false, message: 'It had no effect.' };

  if (def.category === 'evolution') {
    const pending = queueStoneEvolution(registry, slot, itemKey);
    if (!pending) return { ok: false, message: `${mon.name} won't react to ${itemName(def)}.` };
    if (!Inventory.remove(registry, itemKey, 1)) {
      registry.remove('pendingStoneEvolution');
      return { ok: false, message: `You don't have that item.` };
    }
    return {
      ok: true,
      message: `${mon.name} is reacting to ${itemName(def)}!`,
      evolutionQueued: true,
    };
  }

  if (def.category === 'held') {
    if (mon.heldItem === itemKey) return { ok: false, message: `${mon.name} is already holding ${itemName(def)}.` };
    if (!Inventory.remove(registry, itemKey, 1)) return { ok: false, message: `You don't have that item.` };
    const previous = mon.heldItem;
    mon.heldItem = itemKey;
    if (previous) Inventory.add(registry, previous, 1);
    PartySystem.set(registry, party);
    return {
      ok: true,
      message: previous
        ? `${mon.name} swapped its held item for ${itemName(def)}.`
        : `${mon.name} is now holding ${itemName(def)}.`,
    };
  }

  if (def.category === 'heal') {
    if (mon.hp <= 0) return { ok: false, message: `${mon.name} has fainted — use a Revive first.` };
    if (mon.hp >= mon.maxHp) return { ok: false, message: `${mon.name}'s HP is already full.` };
    const before = mon.hp;
    mon.hp = Math.min(mon.maxHp, mon.hp + (def.heal ?? 0));
    PartySystem.set(registry, party);
    Inventory.remove(registry, itemKey, 1);
    return { ok: true, message: `${mon.name} recovered ${mon.hp - before} HP!` };
  }

  if (def.category === 'revive') {
    if (mon.hp > 0) return { ok: false, message: `${mon.name} isn't fainted.` };
    mon.hp = Math.max(1, Math.floor(mon.maxHp * (def.revive ?? 0.5)));
    mon.status = 'none';
    PartySystem.set(registry, party);
    Inventory.remove(registry, itemKey, 1);
    return { ok: true, message: `${mon.name} was revived!` };
  }

  if (def.category === 'ppheal') {
    // Rebuild to read each move's current + max PP, then top up the entry's stored PP.
    const built = buildFromEntry(mon);
    if (!built.moves.some(m => m.pp < m.data.pp)) {
      return { ok: false, message: `${mon.name}'s PP is already full.` };
    }
    const pp: Record<string, number> = { ...(mon.movePP ?? {}) };
    const amt = def.ppRestore ?? 0;
    for (const m of built.moves) {
      pp[m.data.name.toLowerCase()] = amt >= 9999 ? m.data.pp : Math.min(m.data.pp, m.pp + amt);
    }
    mon.movePP = pp;
    PartySystem.set(registry, party);
    Inventory.remove(registry, itemKey, 1);
    return { ok: true, message: amt >= 9999 ? `${mon.name}'s PP was fully restored!` : `${mon.name}'s PP was restored!` };
  }

  if (def.category === 'status') {
    const cur = mon.status ?? 'none';
    const curesAll = def.cures?.includes('all');
    if (cur === 'none' || (!curesAll && !def.cures?.includes(cur))) {
      return { ok: false, message: `It won't have any effect on ${mon.name}.` };
    }
    mon.status = 'none';
    PartySystem.set(registry, party);
    Inventory.remove(registry, itemKey, 1);
    return { ok: true, message: `${mon.name} was cured!` };
  }

  return { ok: false, message: 'You can only use that in battle.' };
}

export const STATUS_LABEL: Record<string, string> = {
  none: 'OK', psn: 'PSN', tox: 'TOX', par: 'PAR', brn: 'BRN', frz: 'FRZ', slp: 'SLP',
};
export const STATUS_COLOR: Record<string, number> = {
  none: 0x44aa44, psn: 0xaa44cc, tox: 0x7b2cbf, par: 0xeecc22, brn: 0xff5522, frz: 0x66ccff, slp: 0x8899aa,
};
