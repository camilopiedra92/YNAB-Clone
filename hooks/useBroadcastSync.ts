'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// ─── BroadcastChannel-based tab synchronization ─────────────────────
// When a mutation succeeds in one tab, it broadcasts the invalidated
// query keys to all other tabs so they can refetch fresh data.
//
// This uses the native BroadcastChannel API (supported in all modern
// browsers) and requires zero external dependencies.

const CHANNEL_NAME = 'ynab-tab-sync';

interface SyncMessage {
    type: 'invalidate';
    queryKeys: string[];
    /** Unique sender ID to avoid processing own messages (safety) */
    senderId: string;
}

// Stable sender ID for this tab instance
const TAB_ID = typeof crypto !== 'undefined'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * Hook that listens for invalidation messages from other tabs.
 * Should be mounted ONCE at the top level (inside Providers).
 *
 * When another tab broadcasts invalidation keys, this hook calls
 * `queryClient.invalidateQueries()` for each key, triggering
 * React Query's automatic refetch for any active queries.
 */
export function useBroadcastSync() {
    const queryClient = useQueryClient();

    useEffect(() => {
        // BroadcastChannel is not available in SSR
        if (typeof BroadcastChannel === 'undefined') return;

        const channel = new BroadcastChannel(CHANNEL_NAME);

        channel.onmessage = (event: MessageEvent<SyncMessage>) => {
            const { type, queryKeys, senderId } = event.data;

            // Ignore our own messages (shouldn't happen, but safety)
            if (senderId === TAB_ID) return;

            if (type === 'invalidate' && Array.isArray(queryKeys)) {
                queryKeys.forEach((key) => {
                    queryClient.invalidateQueries({ queryKey: [key] });
                });
            }
        };

        return () => {
            channel.close();
        };
    }, [queryClient]);
}

/**
 * Broadcast invalidation keys to all other tabs.
 * Called after a successful mutation to keep other tabs in sync.
 *
 * Uses a short-lived channel to avoid keeping connections open.
 *
 * @param queryKeys - Array of top-level query key strings to invalidate
 *                    (e.g., ['budget', 'accounts', 'transactions'])
 */
export function broadcastInvalidation(queryKeys: string[]) {
    if (typeof BroadcastChannel === 'undefined') return;
    if (!queryKeys.length) return;

    const channel = new BroadcastChannel(CHANNEL_NAME);
    const message: SyncMessage = {
        type: 'invalidate',
        queryKeys,
        senderId: TAB_ID,
    };
    channel.postMessage(message);
    channel.close();
}
