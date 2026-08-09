import { markVisited } from '../data/RegionMap';

const SAVE_KEY = 'pokemon_korea_v2';
const BACKUP_KEY = 'pokemon_korea_v2_backup';
const DURABLE_DB = 'pokemon_korea_saves';
const DURABLE_STORE = 'slots';

function openDurableDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DURABLE_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DURABLE_STORE)) req.result.createObjectStore(DURABLE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function durableGet(key: string): Promise<string | null> {
  const db = await openDurableDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(DURABLE_STORE, 'readonly').objectStore(DURABLE_STORE).get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

async function durableSet(key: string, value: string): Promise<void> {
  const db = await openDurableDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DURABLE_STORE, 'readwrite');
      tx.objectStore(DURABLE_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'));
    });
  } finally { db.close(); }
}

async function durableDelete(key: string): Promise<void> {
  const db = await openDurableDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DURABLE_STORE, 'readwrite');
      tx.objectStore(DURABLE_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB delete aborted'));
    });
  } finally { db.close(); }
}

function saveTimestamp(raw: string | null): number {
  if (!raw) return 0;
  try { return Number((JSON.parse(raw) as { timestamp?: number }).timestamp) || 0; }
  catch { return 0; }
}

function reportDurableError(action: string, error: unknown): void {
  // IndexedDB may be disabled in private browsing. localStorage remains the
  // primary synchronous path, so durable-mirror failure must not stop play.
  console.warn(`SaveManager ${action} failed:`, error);
}

// Preserve save/delete ordering. Without a queue, a slow save mirror could
// finish after New Game deleted the slot and unexpectedly resurrect old data.
let durableQueue: Promise<void> = Promise.resolve();
function queueDurable(action: string, task: () => Promise<void>): void {
  durableQueue = durableQueue.then(task, task).catch(e => reportDurableError(action, e));
}

// Transient navigation keys that must NOT be persisted (they drive one-shot transitions).
const TRANSIENT = new Set<string>([
  'returnX', 'returnY', 'routeReturnX', 'routeReturnY', 'r2ReturnX', 'r2ReturnY',
  'capitalReturnX', 'capitalReturnY', 'pineReturnX', 'pineReturnY',
  'baekduPassReturnX', 'baekduPassReturnY', 'baekduCityReturnX', 'baekduCityReturnY',
  'route3ReturnX', 'route3ReturnY', 'geumgangCityReturnX', 'geumgangCityReturnY',
  'route4ReturnX', 'route4ReturnY', 'haeanCityReturnX', 'haeanCityReturnY',
  'route5ReturnX', 'route5ReturnY', 'forestCityReturnX', 'forestCityReturnY',
  'ferryReturnX', 'ferryReturnY', 'jejuPortReturnX', 'jejuPortReturnY',
  'jejuVentReturnX', 'jejuVentReturnY',
  'route6ReturnX', 'route6ReturnY', 'sunriseCityReturnX', 'sunriseCityReturnY',
  'sunCliff1ReturnX', 'sunCliff1ReturnY', 'sunCliff2ReturnX', 'sunCliff2ReturnY',
  'sunCliff3ReturnX', 'sunCliff3ReturnY',
  'baekduCheckpointReturnX', 'baekduCheckpointReturnY',
  'baekduSummitReturnX', 'baekduSummitReturnY',
  'scholarsRoadReturnX', 'scholarsRoadReturnY',
  'leaguePlazaReturnX', 'leaguePlazaReturnY',
  'leagueReturnX', 'leagueReturnY',
  'northColiseumReturnX', 'northColiseumReturnY',
  'northPlazaReturnX', 'northPlazaReturnY',
  'pyeongyangReturnX', 'pyeongyangReturnY',
  'northReachesReturnX', 'northReachesReturnY',
  'sacredPeakReturnX', 'sacredPeakReturnY',
  'dolmoeReturnX', 'dolmoeReturnY', 'seoraeReturnX', 'seoraeReturnY',
  'gymPosX', 'gymPosY',
  // Live Phaser Sound objects / runtime music state — NOT serializable; must never be saved.
  'bgmSound', 'bgmJingle', 'bgmKey', 'bgmPrevKey', 'bgmMuted',
  'wildId', 'wildLevel', 'wildCustom', 'wildCatchRate', 'wildReturnScene',
  'trainerName', 'trainerKey', 'trainerPokemon', 'trainerExpPool', 'trainerReturnScene',
  'trainerBadgeFlag', 'trainerBadgeName', 'trainerBadgeTM', 'trainerWinLine',
  'bagFocusItem',
  '_teKey',
]);

export interface SaveData {
  version:   number;
  timestamp: number;
  scene:     string;
  px:        number;
  py:        number;
  /** Full snapshot of every persistent registry key (party, box, inventory, dex, flags…). */
  data:      Record<string, unknown>;
  // Convenience fields for the title-screen "Continue" preview:
  starterName?: string;
  starterLevel?: number;
}

export const SaveManager = {

  /** Restore the newest valid save mirror before TitleScene checks Continue. */
  async bootstrapDurableStorage(): Promise<void> {
    try {
      const storage = navigator.storage;
      if (storage?.persist) void storage.persist().catch(() => false);

      for (const key of [SAVE_KEY, BACKUP_KEY]) {
        const local = localStorage.getItem(key);
        const durable = await durableGet(key);
        const newest = saveTimestamp(durable) > saveTimestamp(local) ? durable : local;
        if (newest) {
          if (newest !== local) localStorage.setItem(key, newest);
          if (newest !== durable) await durableSet(key, newest);
        }
      }
    } catch (e) { reportDurableError('bootstrap', e); }
  },

  /** Persist the game. Returns true on success, false if it couldn't be written
   *  (e.g. storage quota) — callers should surface a failure instead of assuming saved. */
  save(registry: Phaser.Data.DataManager, px: number, py: number, scene = 'WorldMapScene'): boolean {
    // The Commander Ryeo popup is an isolated rehearsal. Never let its copied
    // party, battle damage, rewards, or debug flags reach the real save slot.
    if (registry.get('ryeoBattleTest') || registry.get('sceneFlowTest')) return false;
    // Remember the current resumable scene/position so menu/battle saves (which
    // don't know the scene) can record it correctly instead of defaulting to WorldMap.
    registry.set('lastScene', scene);
    registry.set('lastX', px);
    registry.set('lastY', py);
    // Record that this place has been visited (drives Fly destinations on the map).
    markVisited(registry, scene);
    // Snapshot the WHOLE registry except transient keys AND any non-serializable value
    // (a live Phaser object slipping into the registry would otherwise throw and, before,
    // silently wipe the whole save).
    const all = registry.getAll() as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const k of Object.keys(all)) {
      if (TRANSIENT.has(k)) continue;
      const v = all[k];
      try { JSON.stringify(v); } catch { continue; }   // skip non-serializable values
      data[k] = v;
    }
    // Save-screen summary reflects the CURRENT party lead (name + level), not the
    // stale starterName/starterLevel registry values (which don't track evolutions or
    // every level-up). Fall back to the starter fields if the party can't be read.
    let leadName  = (registry.get('starterName')  as string) ?? '';
    let leadLevel = (registry.get('starterLevel') as number) ?? 5;
    try {
      const party = JSON.parse((registry.get('party') as string) ?? '[]') as { name?: string; level?: number }[];
      if (party[0]?.name) leadName = party[0].name;
      if (typeof party[0]?.level === 'number') leadLevel = party[0].level;
    } catch { /* keep the fallbacks */ }
    const payload: SaveData = {
      version: 2,
      timestamp: Date.now(),
      scene, px, py, data,
      starterName:  leadName,
      starterLevel: leadLevel,
    };
    try {
      const raw = JSON.stringify(payload);
      localStorage.setItem(SAVE_KEY, raw);
      queueDurable('mirror save', () => durableSet(SAVE_KEY, raw));
      return true;
    } catch (e) {
      console.error('SaveManager.save failed:', e);
      return false;
    }
  },

  load(): SaveData | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as SaveData;
      if (data.version !== 2 || !data.data) return null;
      return data;
    } catch {
      return null;
    }
  },

  restore(registry: Phaser.Data.DataManager, data: SaveData): void {
    // Write back every saved key — restores party, box, inventory, money, dex, flags…
    for (const k of Object.keys(data.data)) {
      registry.set(k, data.data[k]);
    }
    // Position for the target scene to pick up. WorldMap reads the generic returnX/Y;
    // the 어사대 cities / beaches / mine read '<SceneKey>ReturnX/Y', so set both so the
    // player resumes exactly where they saved rather than at the scene's default spawn.
    registry.set('returnX', data.px);
    registry.set('returnY', data.py);
    if (data.scene) {
      registry.set(data.scene + 'ReturnX', data.px);
      registry.set(data.scene + 'ReturnY', data.py);
    }
  },

  exists(): boolean {
    return !!localStorage.getItem(SAVE_KEY);
  },

  /** Delete the save — but keep a one-slot backup first so a mistaken New Game is recoverable. */
  delete(): void {
    const cur = localStorage.getItem(SAVE_KEY);
    if (cur) {
      try { localStorage.setItem(BACKUP_KEY, cur); } catch { /* quota */ }
    }
    localStorage.removeItem(SAVE_KEY);
    queueDurable('delete mirror', async () => {
      if (cur) await durableSet(BACKUP_KEY, cur);
      await durableDelete(SAVE_KEY);
    });
  },

  hasBackup(): boolean {
    return !!localStorage.getItem(BACKUP_KEY);
  },

  /** Restore the backed-up save into the main slot (e.g. after an accidental New Game). */
  restoreBackup(): boolean {
    const b = localStorage.getItem(BACKUP_KEY);
    if (!b) return false;
    try {
      localStorage.setItem(SAVE_KEY, b);
      queueDurable('restore mirror', () => durableSet(SAVE_KEY, b));
      return true;
    } catch { return false; }
  },

  formatDate(ts: number): string {
    return new Date(ts).toLocaleString('ko-KR', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },
};
