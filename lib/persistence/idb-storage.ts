/**
 * IndexedDB storage adapter for React Query persistence.
 *
 * Wraps `idb-keyval` to match the `AsyncStorage` interface required by
 * `@tanstack/query-async-storage-persister`. This provides persistent
 * cache storage that survives page refreshes and browser restarts.
 */
import { get, set, del } from 'idb-keyval';

export const idbStorage = {
    getItem: (key: string): Promise<string | undefined | null> => get<string>(key),
    setItem: (key: string, value: string): Promise<void> => set(key, value),
    removeItem: (key: string): Promise<void> => del(key),
};
