/**
 * React Query async persister backed by IndexedDB.
 *
 * Persists the entire query cache to IndexedDB so the app works offline
 * and data survives page refreshes / browser restarts.
 *
 * - `key`: unique storage key for this app's cache
 * - `throttleTime`: avoids excessive writes (1s debounce)
 * - `buster`: bump this on breaking cache changes to force a fresh load
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { idbStorage } from './idb-storage';

/** Bump this when the cache shape changes to invalidate old persisted data */
export const APP_CACHE_VERSION = '1';

export const persister = createAsyncStoragePersister({
    storage: idbStorage,
    key: 'YNAB_OFFLINE_CACHE',
    throttleTime: 1000, // 1s — avoids IndexedDB write storms
});
