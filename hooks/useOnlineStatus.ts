'use client';

import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);
    return () => {
        window.removeEventListener('online', callback);
        window.removeEventListener('offline', callback);
    };
}

function getSnapshot() {
    return navigator.onLine;
}

function getServerSnapshot() {
    // On the server, assume online
    return true;
}

/**
 * Hook to track browser online/offline status.
 * Uses useSyncExternalStore for tear-free reads.
 */
export function useOnlineStatus() {
    const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    return { isOnline };
}
