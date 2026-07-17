'use client';

/**
 * Recently Viewed — localStorage-backed product history.
 *
 * Design goals ("full proof"):
 *  - Never throws: every localStorage access is wrapped in try/catch (Safari
 *    private mode throws on `setItem`, some browsers block storage entirely,
 *    corrupted/foreign JSON must not crash the app).
 *  - SSR-safe: every function guards on `typeof window === 'undefined'` so it
 *    can be safely imported into code that also renders on the server.
 *  - Self-healing: malformed data in the key is treated as empty rather than
 *    thrown, and the corrupt value is overwritten on the next write.
 *  - Bounded: the list is capped so a long browsing session can't grow the
 *    key without limit (localStorage has a small per-origin quota).
 *  - Deduplicated + most-recent-first: viewing a product again just moves it
 *    to the front instead of creating a second entry.
 *  - Cross-tab + same-tab aware: mutations dispatch a custom window event so
 *    listeners in the same tab update instantly (the native `storage` event
 *    only fires in *other* tabs), while the native event keeps other tabs
 *    in sync too.
 */

const STORAGE_KEY = 'ag_recently_viewed_v1';
const MAX_ITEMS = 24;
const EVENT_NAME = 'recently-viewed:updated';

export interface RecentlyViewedEntry {
  id: string;
  viewedAt: number; // epoch ms
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** Very loose validity check — a Mongo ObjectId is 24 hex chars, but we stay
 * permissive here and just require a non-empty string so this utility isn't
 * coupled to Mongo. The API layer does the real validation. */
function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0 && id.length <= 64;
}

function readRaw(): RecentlyViewedEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out anything that doesn't look like a valid entry — protects
    // against a corrupted key, a manual edit, or a future schema change.
    return parsed.filter(
      (e): e is RecentlyViewedEntry =>
        e && typeof e === 'object' && isValidId(e.id) && typeof e.viewedAt === 'number'
    );
  } catch {
    // Corrupt JSON, storage disabled, or access denied (e.g. sandboxed iframe).
    return [];
  }
}

function writeRaw(entries: RecentlyViewedEntry[]): boolean {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ITEMS)));
    return true;
  } catch {
    // Quota exceeded or storage disabled — fail silently, this is a
    // nice-to-have feature and should never break the page.
    return false;
  }
}

function notify() {
  if (!isBrowser()) return;
  try {
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    // no-op
  }
}

/** Returns entries newest-first. */
export function getRecentlyViewed(): RecentlyViewedEntry[] {
  return readRaw().sort((a, b) => b.viewedAt - a.viewedAt);
}

/** Returns just the ids, newest-first. */
export function getRecentlyViewedIds(): string[] {
  return getRecentlyViewed().map((e) => e.id);
}

/** Records a product view, moving it to the front if already present. */
export function recordRecentlyViewed(productId: string): void {
  if (!isValidId(productId)) return;
  const existing = readRaw().filter((e) => e.id !== productId);
  const next = [{ id: productId, viewedAt: Date.now() }, ...existing].slice(0, MAX_ITEMS);
  if (writeRaw(next)) notify();
}

/** Removes a single product from the history (e.g. "remove" on a card). */
export function removeRecentlyViewed(productId: string): void {
  const next = readRaw().filter((e) => e.id !== productId);
  if (writeRaw(next)) notify();
}

/** Clears the entire history. */
export function clearRecentlyViewed(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
  notify();
}

/** Drops ids that are no longer valid (e.g. product deleted/deactivated),
 * used by the hook to self-heal after fetching fresh product data. */
export function pruneRecentlyViewed(validIds: Set<string>): void {
  const current = readRaw();
  const next = current.filter((e) => validIds.has(e.id));
  if (next.length !== current.length && writeRaw(next)) notify();
}

/** Subscribes to both same-tab and cross-tab updates. Returns an unsubscribe fn. */
export function subscribeRecentlyViewed(callback: () => void): () => void {
  if (!isBrowser()) return () => {};
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener('storage', storageHandler);
  };
}

export const recentlyViewedEvents = { EVENT_NAME };
