import Phaser from 'phaser';
import { BADGES } from '../data/Badges';
import { MAPAE, hasMapae, mapaeCount } from '../data/Mapae';
import { DexTracker } from './DexTracker';

const REGISTRY_KEY = 'leaderboardProgressV1';
const SCHEMA_VERSION = 1;
const UNKNOWN_TIME = null;
const MAX_FRAME_DELTA_MS = 1_000;

export interface LeaderboardProgressData {
  schema: 1;
  runId: string;
  startedAt: number;
  playMs: number;
  badgeCount: number;
  badgeTimes: Array<number | null>;
  mapaeCount: number;
  mapaeTimes: Array<number | null>;
  /** Local-only observation state. It prevents existing 마패 from receiving a
   * fabricated current timestamp when a schema-one leaderboard run is loaded. */
  mapaeObserved: boolean[];
  southLeagueCleared: boolean;
  southLeagueMs: number | null;
  northLeagueCleared: boolean;
  northLeagueMs: number | null;
  totalCaught: number;
  legacyImported: boolean;
}

export interface LeaderboardSnapshot extends LeaderboardProgressData {
  displayName: string;
  uniqueCaught: number;
}

function uuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function parse(registry: Phaser.Data.DataManager): LeaderboardProgressData | null {
  const raw = registry.get(REGISTRY_KEY);
  if (typeof raw !== 'string') return null;
  try {
    const value = JSON.parse(raw) as Partial<LeaderboardProgressData>;
    if (value.schema !== SCHEMA_VERSION || typeof value.runId !== 'string') return null;
    const badgeTimes = Array.from({ length: BADGES.length }, (_, index) => {
      const time = value.badgeTimes?.[index];
      return typeof time === 'number' && Number.isFinite(time) && time >= 0 ? Math.floor(time) : UNKNOWN_TIME;
    });
    const mapaeTimes = Array.from({ length: MAPAE.length }, (_, index) => {
      const time = value.mapaeTimes?.[index];
      return typeof time === 'number' && Number.isFinite(time) && time >= 0 ? Math.floor(time) : UNKNOWN_TIME;
    });
    mapaeCount(registry); // reconcile legacy Northern League saves before migration
    const earnedMapae = MAPAE.map(mapae => hasMapae(registry, mapae.key));
    const mapaeObserved = Array.from({ length: MAPAE.length }, (_, index) => {
      const observed = value.mapaeObserved?.[index];
      // Runs saved before 마패 tracking already know which tablets exist, but not
      // when they were earned. Mark those as observed and leave their time null.
      return typeof observed === 'boolean' ? observed : (earnedMapae[index] || mapaeTimes[index] !== null);
    });
    return {
      schema: SCHEMA_VERSION,
      runId: value.runId,
      startedAt: Math.max(0, Math.floor(value.startedAt ?? Date.now())),
      playMs: Math.max(0, Math.floor(value.playMs ?? 0)),
      badgeCount: Phaser.Math.Clamp(Math.floor(value.badgeCount ?? 0), 0, BADGES.length),
      badgeTimes,
      mapaeCount: Phaser.Math.Clamp(
        Math.floor(value.mapaeCount ?? earnedMapae.filter(Boolean).length),
        0,
        MAPAE.length,
      ),
      mapaeTimes,
      mapaeObserved,
      southLeagueCleared: !!value.southLeagueCleared,
      southLeagueMs: typeof value.southLeagueMs === 'number' ? Math.max(0, Math.floor(value.southLeagueMs)) : null,
      northLeagueCleared: !!value.northLeagueCleared,
      northLeagueMs: typeof value.northLeagueMs === 'number' ? Math.max(0, Math.floor(value.northLeagueMs)) : null,
      totalCaught: Math.max(0, Math.floor(value.totalCaught ?? 0)),
      legacyImported: !!value.legacyImported,
    };
  } catch {
    return null;
  }
}

function write(registry: Phaser.Data.DataManager, progress: LeaderboardProgressData): void {
  registry.set(REGISTRY_KEY, JSON.stringify(progress));
}

function completedBadgeCount(registry: Phaser.Data.DataManager): number {
  let furthest = -1;
  BADGES.forEach((badge, index) => {
    if (registry.get(badge.flag)) furthest = index;
  });
  return furthest + 1;
}

function completedMapae(registry: Phaser.Data.DataManager): boolean[] {
  mapaeCount(registry); // also reconciles legacy Northern League saves
  return MAPAE.map(mapae => hasMapae(registry, mapae.key));
}

function newProgress(registry: Phaser.Data.DataManager, legacyImported: boolean): LeaderboardProgressData {
  const badgeCount = completedBadgeCount(registry);
  const southLeagueCleared = !!registry.get('championDefeated');
  const northLeagueCleared = !!registry.get('northLeagueDone');
  const earnedMapae = completedMapae(registry);
  return {
    schema: SCHEMA_VERSION,
    runId: uuid(),
    startedAt: Date.now(),
    playMs: 0,
    badgeCount,
    // A pre-leaderboard save proves that a milestone was reached, but not when.
    // Keep its time unknown so it can never become a fabricated speed record.
    badgeTimes: Array.from({ length: BADGES.length }, () => UNKNOWN_TIME),
    mapaeCount: earnedMapae.filter(Boolean).length,
    mapaeTimes: Array.from({ length: MAPAE.length }, () => UNKNOWN_TIME),
    mapaeObserved: [...earnedMapae],
    southLeagueCleared,
    southLeagueMs: null,
    northLeagueCleared,
    northLeagueMs: null,
    // Unique owned species are a safe lower bound for old saves. New successful
    // wild catches increment this exact total from here onward.
    totalCaught: legacyImported ? DexTracker.caughtCount(registry) : 0,
    legacyImported,
  };
}

function ensure(registry: Phaser.Data.DataManager): LeaderboardProgressData | null {
  const current = parse(registry);
  if (current) return current;
  if (!registry.get('starterChosen')) return null;
  // A run that reaches here came from a save created before leaderboard timing
  // existed. New games always call startNewRun before starter selection.
  const created = newProgress(registry, true);
  write(registry, created);
  return created;
}

function observe(registry: Phaser.Data.DataManager, progress: LeaderboardProgressData): boolean {
  let changed = false;
  const badgeCount = completedBadgeCount(registry);
  if (badgeCount > progress.badgeCount) {
    for (let index = progress.badgeCount; index < badgeCount; index++) {
      if (progress.badgeTimes[index] === null) progress.badgeTimes[index] = Math.floor(progress.playMs);
    }
    progress.badgeCount = badgeCount;
    changed = true;
  }

  const earnedMapae = completedMapae(registry);
  earnedMapae.forEach((earned, index) => {
    if (!earned || progress.mapaeObserved[index]) return;
    progress.mapaeObserved[index] = true;
    if (progress.mapaeTimes[index] === null) progress.mapaeTimes[index] = Math.floor(progress.playMs);
    changed = true;
  });
  const mapaeCount = earnedMapae.filter(Boolean).length;
  if (mapaeCount > progress.mapaeCount) {
    progress.mapaeCount = mapaeCount;
    changed = true;
  }

  if (!progress.southLeagueCleared && registry.get('championDefeated')) {
    progress.southLeagueCleared = true;
    progress.southLeagueMs = Math.floor(progress.playMs);
    changed = true;
  }
  if (!progress.northLeagueCleared && registry.get('northLeagueDone')) {
    progress.northLeagueCleared = true;
    progress.northLeagueMs = Math.floor(progress.playMs);
    changed = true;
  }
  return changed;
}

function cleanDisplayName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  return (name || 'Trainer').replace(/[\u0000-\u001f<>]/g, '').slice(0, 18) || 'Trainer';
}

function shouldCountTime(game: Phaser.Game): boolean {
  if (document.visibilityState !== 'visible') return false;
  if (game.registry.get('sceneFlowTest') || game.registry.get('ryeoBattleTest')) return false;
  const scenes = game.scene.getScenes(true);
  if (scenes.some(scene => scene.scene.key === 'LeaderboardScene')) return false;
  return scenes.some(scene => scene.scene.key !== 'TitleScene');
}

let installedGame: Phaser.Game | undefined;
let lastRunId = '';
let progress: LeaderboardProgressData | null = null;
let persistAccumulator = 0;
let submitCallback: ((snapshot: LeaderboardSnapshot) => void) | undefined;

function current(game: Phaser.Game): LeaderboardProgressData | null {
  const stored = parse(game.registry);
  if (stored?.runId !== lastRunId) {
    progress = stored ?? ensure(game.registry);
    lastRunId = progress?.runId ?? '';
  } else if (!progress) {
    progress = ensure(game.registry);
    lastRunId = progress?.runId ?? '';
  }
  return progress;
}

export const LeaderboardProgress = {
  registryKey: REGISTRY_KEY,

  /** Starts a clean timed run immediately after the New Game registry reset. */
  startNewRun(registry: Phaser.Data.DataManager): LeaderboardProgressData {
    const created = newProgress(registry, false);
    write(registry, created);
    progress = created;
    lastRunId = created.runId;
    return created;
  },

  install(game: Phaser.Game, onSubmitDue: (snapshot: LeaderboardSnapshot) => void): void {
    if (installedGame === game) return;
    installedGame = game;
    submitCallback = onSubmitDue;
    game.events.on(Phaser.Core.Events.POST_STEP, (_time: number, delta: number) => {
      const active = current(game);
      if (!active) return;
      let changed = observe(game.registry, active);
      if (shouldCountTime(game)) {
        const safeDelta = Phaser.Math.Clamp(Number.isFinite(delta) ? delta : 0, 0, MAX_FRAME_DELTA_MS);
        active.playMs += safeDelta;
        persistAccumulator += safeDelta;
      }
      if (changed || persistAccumulator >= 1_000) {
        active.playMs = Math.floor(active.playMs);
        write(game.registry, active);
        persistAccumulator = 0;
      }
      if (changed) submitCallback?.(this.snapshot(game.registry) as LeaderboardSnapshot);
    });
  },

  /** Called only after a successful wild-ball capture, never for gifts or eggs. */
  recordWildCatch(registry: Phaser.Data.DataManager): void {
    const active = parse(registry) ?? ensure(registry);
    if (!active) return;
    active.totalCaught += 1;
    observe(registry, active);
    write(registry, active);
    if (installedGame?.registry === registry) {
      progress = active;
      lastRunId = active.runId;
    }
    const snapshot = this.snapshot(registry);
    if (snapshot) submitCallback?.(snapshot);
  },

  /** Flushes the in-memory timer before SaveManager snapshots the registry. */
  sync(registry: Phaser.Data.DataManager): LeaderboardSnapshot | null {
    const active = installedGame?.registry === registry ? current(installedGame) : (parse(registry) ?? ensure(registry));
    if (!active) return null;
    observe(registry, active);
    active.playMs = Math.floor(active.playMs);
    write(registry, active);
    return this.snapshot(registry);
  },

  snapshot(registry: Phaser.Data.DataManager): LeaderboardSnapshot | null {
    const active = parse(registry);
    if (!active) return null;
    return {
      ...active,
      badgeTimes: [...active.badgeTimes],
      mapaeTimes: [...active.mapaeTimes],
      mapaeObserved: [...active.mapaeObserved],
      displayName: cleanDisplayName(registry.get('playerName')),
      uniqueCaught: DexTracker.caughtCount(registry),
    };
  },
};
