import type { User } from 'firebase/auth';
import type { DocumentData, Firestore, QueryDocumentSnapshot } from 'firebase/firestore';
import type { LeaderboardSnapshot } from './LeaderboardProgress';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA880H3Jvl8RI2vIg1m9IbtkVdNAT7whes',
  authDomain: 'pokemonkorea-f01d4.firebaseapp.com',
  projectId: 'pokemonkorea-f01d4',
  storageBucket: 'pokemonkorea-f01d4.firebasestorage.app',
  messagingSenderId: '765861099992',
  appId: '1:765861099992:web:9be080523979251f799aad',
};

const COLLECTION = 'leaderboardRuns';
const UID_CACHE_KEY = 'pk_firebase_leaderboard_uid_v1';
const MIN_SUBMIT_INTERVAL_MS = 30_000;
const NETWORK_TIMEOUT_MS = 12_000;
const FETCH_LIMIT = 200;

export type LeaderboardCategory =
  | 'overall'
  | `badge-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`
  | 'south-league'
  | 'north-league'
  | 'captures';

export interface LeaderboardEntry {
  rank: number;
  playerCode: string;
  displayName: string;
  playMs: number;
  badgeCount: number;
  badgeTimes: Array<number | null>;
  southLeagueCleared: boolean;
  southLeagueMs: number | null;
  northLeagueCleared: boolean;
  northLeagueMs: number | null;
  totalCaught: number;
  uniqueCaught: number;
  updatedAt: number;
  isMine?: boolean;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  category: LeaderboardCategory;
  updatedAt: number;
}

interface FirebaseContext {
  auth: import('firebase/auth').Auth;
  db: Firestore;
  authSdk: typeof import('firebase/auth');
  firestoreSdk: typeof import('firebase/firestore');
}

interface ParsedEntry extends LeaderboardEntry {
  ownerUid: string;
}

let firebasePromise: Promise<FirebaseContext> | undefined;
let authPromise: Promise<User> | undefined;
let pending: LeaderboardSnapshot | null = null;
let submitTimer: number | undefined;
let submitting = false;
let lastSubmitAt = 0;

function readLocal(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}

function writeLocal(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private browsing */ }
}

function playerCodeFromUid(uid: string): string {
  // Expose a short stable label without revealing the beginning of Firebase's UID.
  let hash = 2166136261;
  for (let index = 0; index < uid.length; index++) {
    hash ^= uid.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(-7);
}

async function firebase(): Promise<FirebaseContext> {
  if (!firebasePromise) {
    // Firebase is split into a lazy chunk so the large 3D game still starts quickly
    // on mobile. It is downloaded only when a record is submitted or viewed.
    firebasePromise = Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]).then(async ([appSdk, authSdk, firestoreSdk]) => {
      const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(FIREBASE_CONFIG);
      const auth = authSdk.getAuth(app);
      const db = firestoreSdk.getFirestore(app);
      try {
        await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
      } catch {
        // Safari private browsing can reject IndexedDB/local persistence. Anonymous
        // authentication still works for the current tab in that case.
      }
      return { auth, db, authSdk, firestoreSdk };
    }).catch(error => {
      firebasePromise = undefined;
      throw error;
    });
  }
  return firebasePromise;
}

async function authenticatedUser(): Promise<User> {
  const context = await firebase();
  if (context.auth.currentUser) {
    writeLocal(UID_CACHE_KEY, context.auth.currentUser.uid);
    return context.auth.currentUser;
  }
  if (!authPromise) {
    authPromise = context.authSdk.signInAnonymously(context.auth)
      .then(credential => {
        writeLocal(UID_CACHE_KEY, credential.user.uid);
        return credential.user;
      })
      .catch(error => {
        authPromise = undefined;
        throw error;
      });
  }
  return authPromise;
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), NETWORK_TIMEOUT_MS);
    promise.then(
      value => { window.clearTimeout(timer); resolve(value); },
      error => { window.clearTimeout(timer); reject(error); },
    );
  });
}

function finiteInt(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function nullableInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function timestampMs(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return finiteInt(value.toMillis(), Date.now());
  }
  return finiteInt(value, Date.now());
}

function progressScore(snapshot: Pick<LeaderboardSnapshot, 'badgeCount' | 'southLeagueCleared' | 'northLeagueCleared'>): number {
  return snapshot.badgeCount
    + Number(snapshot.southLeagueCleared) * 100
    + Number(snapshot.northLeagueCleared) * 100;
}

function firestoreRecord(snapshot: LeaderboardSnapshot, user: User, serverTimestamp: () => unknown): DocumentData {
  const badgeTimes = Array.from({ length: 8 }, (_, index) => nullableInt(snapshot.badgeTimes[index]));
  const record: DocumentData = {
    schema: 1,
    ownerUid: user.uid,
    playerCode: playerCodeFromUid(user.uid),
    runId: snapshot.runId,
    displayName: snapshot.displayName,
    startedAt: finiteInt(snapshot.startedAt),
    playMs: finiteInt(snapshot.playMs),
    badgeCount: Math.min(8, finiteInt(snapshot.badgeCount)),
    badgeTimes,
    southLeagueCleared: !!snapshot.southLeagueCleared,
    northLeagueCleared: !!snapshot.northLeagueCleared,
    totalCaught: finiteInt(snapshot.totalCaught),
    uniqueCaught: finiteInt(snapshot.uniqueCaught),
    legacyImported: !!snapshot.legacyImported,
    progressScore: progressScore(snapshot),
    updatedAt: serverTimestamp(),
  };
  badgeTimes.forEach((time, index) => {
    if (time !== null) record[`badge${index + 1}Ms`] = time;
  });
  const southLeagueMs = nullableInt(snapshot.southLeagueMs);
  const northLeagueMs = nullableInt(snapshot.northLeagueMs);
  if (southLeagueMs !== null) record.southLeagueMs = southLeagueMs;
  if (northLeagueMs !== null) record.northLeagueMs = northLeagueMs;
  return record;
}

function bestTime(left: unknown, right: unknown, maxTime: number): number | null {
  const candidates = [nullableInt(left), nullableInt(right)]
    .filter((value): value is number => value !== null && value <= maxTime);
  return candidates.length ? Math.min(...candidates) : null;
}

function aggregateBestRecord(
  old: DocumentData,
  incoming: DocumentData,
  serverTimestamp: () => unknown,
): { changed: boolean; record: DocumentData } {
  const oldScore = finiteInt(old.progressScore);
  const incomingScore = finiteInt(incoming.progressScore);
  const oldPlayMs = finiteInt(old.playMs);
  const incomingPlayMs = finiteInt(incoming.playMs);
  const overallImproved = incomingScore > oldScore
    || (incomingScore === oldScore && incomingPlayMs < oldPlayMs);
  const recordPlayMs = overallImproved ? incomingPlayMs : oldPlayMs;
  const record: DocumentData = {
    schema: 1,
    ownerUid: old.ownerUid,
    playerCode: old.playerCode,
    runId: overallImproved ? incoming.runId : old.runId,
    displayName: incoming.displayName,
    startedAt: overallImproved ? incoming.startedAt : old.startedAt,
    playMs: recordPlayMs,
    badgeCount: Math.max(finiteInt(old.badgeCount), finiteInt(incoming.badgeCount)),
    southLeagueCleared: !!old.southLeagueCleared || !!incoming.southLeagueCleared,
    northLeagueCleared: !!old.northLeagueCleared || !!incoming.northLeagueCleared,
    totalCaught: Math.max(finiteInt(old.totalCaught), finiteInt(incoming.totalCaught)),
    uniqueCaught: Math.max(finiteInt(old.uniqueCaught), finiteInt(incoming.uniqueCaught)),
    legacyImported: overallImproved ? !!incoming.legacyImported : !!old.legacyImported,
    progressScore: Math.max(oldScore, incomingScore),
    updatedAt: serverTimestamp(),
  };

  const oldBadgeTimes = Array.isArray(old.badgeTimes) ? old.badgeTimes : [];
  const incomingBadgeTimes = Array.isArray(incoming.badgeTimes) ? incoming.badgeTimes : [];
  record.badgeTimes = Array.from({ length: 8 }, (_, index) => {
    const time = bestTime(oldBadgeTimes[index], incomingBadgeTimes[index], recordPlayMs);
    if (time !== null) record[`badge${index + 1}Ms`] = time;
    return time;
  });
  const southLeagueMs = bestTime(old.southLeagueMs, incoming.southLeagueMs, recordPlayMs);
  const northLeagueMs = bestTime(old.northLeagueMs, incoming.northLeagueMs, recordPlayMs);
  if (southLeagueMs !== null) record.southLeagueMs = southLeagueMs;
  if (northLeagueMs !== null) record.northLeagueMs = northLeagueMs;

  const oldBadgeFingerprint = oldBadgeTimes.map(nullableInt).join(',');
  const newBadgeFingerprint = (record.badgeTimes as Array<number | null>).join(',');
  const changed = overallImproved
    || old.displayName !== record.displayName
    || finiteInt(old.badgeCount) !== record.badgeCount
    || finiteInt(old.totalCaught) !== record.totalCaught
    || finiteInt(old.uniqueCaught) !== record.uniqueCaught
    || !!old.southLeagueCleared !== record.southLeagueCleared
    || !!old.northLeagueCleared !== record.northLeagueCleared
    || nullableInt(old.southLeagueMs) !== southLeagueMs
    || nullableInt(old.northLeagueMs) !== northLeagueMs
    || oldBadgeFingerprint !== newBadgeFingerprint;
  return { changed, record };
}

async function send(snapshot: LeaderboardSnapshot): Promise<void> {
  if (submitting) {
    schedule();
    return;
  }
  submitting = true;
  let succeeded = false;
  try {
    const [context, user] = await Promise.all([firebase(), authenticatedUser()]);
    // One public record per anonymous Firebase identity prevents a single browser
    // from flooding the ranking with repeated New Game runs.
    const documentId = user.uid;
    const incoming = firestoreRecord(snapshot, user, context.firestoreSdk.serverTimestamp);
    const documentRef = context.firestoreSdk.doc(context.db, COLLECTION, documentId);
    await withTimeout(
      context.firestoreSdk.runTransaction(context.db, async transaction => {
        const existing = await transaction.get(documentRef);
        if (!existing.exists()) {
          transaction.set(documentRef, incoming);
          return;
        }
        const aggregated = aggregateBestRecord(
          existing.data(),
          incoming,
          context.firestoreSdk.serverTimestamp,
        );
        if (aggregated.changed) transaction.set(documentRef, aggregated.record);
      }),
      'Leaderboard update',
    );
    lastSubmitAt = Date.now();
    succeeded = true;
    if (pending?.runId === snapshot.runId && pending.playMs <= snapshot.playMs) pending = null;
  } finally {
    submitting = false;
    if (succeeded && pending) schedule();
  }
}

function schedule(): void {
  if (!pending || submitTimer !== undefined) return;
  const delay = Math.max(0, MIN_SUBMIT_INTERVAL_MS - (Date.now() - lastSubmitAt));
  submitTimer = window.setTimeout(() => {
    submitTimer = undefined;
    if (submitting) {
      window.setTimeout(schedule, 1_000);
      return;
    }
    const snapshot = pending;
    if (!snapshot) return;
    void send(snapshot).catch(error => {
      console.warn('[leaderboard] Firestore upload deferred:', error);
      window.setTimeout(schedule, MIN_SUBMIT_INTERVAL_MS);
    });
  }, delay);
}

function parseEntry(document: QueryDocumentSnapshot<DocumentData>, myUid: string): ParsedEntry | null {
  const value = document.data();
  if (typeof value.ownerUid !== 'string' || typeof value.displayName !== 'string') return null;
  const badgeTimes = Array.from({ length: 8 }, (_, index) => nullableInt(value.badgeTimes?.[index]));
  return {
    rank: 0,
    ownerUid: value.ownerUid,
    playerCode: typeof value.playerCode === 'string' ? value.playerCode.slice(0, 7) : playerCodeFromUid(value.ownerUid),
    displayName: value.displayName.slice(0, 18),
    playMs: finiteInt(value.playMs),
    badgeCount: Math.min(8, finiteInt(value.badgeCount)),
    badgeTimes,
    southLeagueCleared: !!value.southLeagueCleared,
    southLeagueMs: nullableInt(value.southLeagueMs),
    northLeagueCleared: !!value.northLeagueCleared,
    northLeagueMs: nullableInt(value.northLeagueMs),
    totalCaught: finiteInt(value.totalCaught),
    uniqueCaught: finiteInt(value.uniqueCaught),
    updatedAt: timestampMs(value.updatedAt),
    isMine: value.ownerUid === myUid,
  };
}

function compare(category: LeaderboardCategory, left: ParsedEntry, right: ParsedEntry): number {
  if (category === 'overall') {
    const leftProgress = left.badgeCount + Number(left.southLeagueCleared) * 100 + Number(left.northLeagueCleared) * 100;
    const rightProgress = right.badgeCount + Number(right.southLeagueCleared) * 100 + Number(right.northLeagueCleared) * 100;
    return rightProgress - leftProgress || left.playMs - right.playMs || right.totalCaught - left.totalCaught;
  }
  if (category === 'captures') return right.totalCaught - left.totalCaught || left.playMs - right.playMs;
  if (category === 'south-league') return (left.southLeagueMs ?? Infinity) - (right.southLeagueMs ?? Infinity);
  if (category === 'north-league') return (left.northLeagueMs ?? Infinity) - (right.northLeagueMs ?? Infinity);
  const badgeIndex = Number(category.slice(6)) - 1;
  return (left.badgeTimes[badgeIndex] ?? Infinity) - (right.badgeTimes[badgeIndex] ?? Infinity);
}

function queryField(category: LeaderboardCategory): { field: string; direction: 'asc' | 'desc' } {
  if (category === 'overall') return { field: 'progressScore', direction: 'desc' };
  if (category === 'captures') return { field: 'totalCaught', direction: 'desc' };
  if (category === 'south-league') return { field: 'southLeagueMs', direction: 'asc' };
  if (category === 'north-league') return { field: 'northLeagueMs', direction: 'asc' };
  return { field: `badge${Number(category.slice(6))}Ms`, direction: 'asc' };
}

export const LeaderboardApi = {
  configured(): boolean { return true; },

  queue(snapshot: LeaderboardSnapshot | null): void {
    // Saves created before timing existed have no trustworthy milestone clock.
    // Keep showing their local summary, but never mix them into speed rankings.
    if (!snapshot?.runId || !snapshot.displayName || snapshot.legacyImported) return;
    pending = snapshot;
    schedule();
  },

  async submitNow(snapshot: LeaderboardSnapshot | null): Promise<void> {
    if (!snapshot || snapshot.legacyImported) return;
    pending = snapshot;
    if (submitTimer !== undefined) {
      window.clearTimeout(submitTimer);
      submitTimer = undefined;
    }
    await send(snapshot);
  },

  async fetch(category: LeaderboardCategory): Promise<LeaderboardResponse> {
    const [context, user] = await Promise.all([firebase(), authenticatedUser()]);
    const selected = queryField(category);
    const collectionRef = context.firestoreSdk.collection(context.db, COLLECTION);
    const records = category === 'overall' || category === 'captures'
      ? context.firestoreSdk.query(
        collectionRef,
        context.firestoreSdk.orderBy(selected.field, selected.direction),
        context.firestoreSdk.orderBy('playMs', 'asc'),
        context.firestoreSdk.limit(FETCH_LIMIT),
      )
      : context.firestoreSdk.query(
        collectionRef,
        context.firestoreSdk.orderBy(selected.field, selected.direction),
        context.firestoreSdk.limit(FETCH_LIMIT),
      );
    const result = await withTimeout(context.firestoreSdk.getDocs(records), 'Leaderboard fetch');
    const sorted = result.docs
      .map(document => parseEntry(document, user.uid))
      .filter((entry): entry is ParsedEntry => !!entry)
      .sort((left, right) => compare(category, left, right));

    const entries: LeaderboardEntry[] = sorted.map((entry, index) => {
      const { ownerUid: _ownerUid, ...publicEntry } = entry;
      return { ...publicEntry, rank: index + 1 };
    });
    return { entries, category, updatedAt: Date.now() };
  },

  playerCode(): string {
    const uid = readLocal(UID_CACHE_KEY);
    return uid ? playerCodeFromUid(uid) : '';
  },
};
