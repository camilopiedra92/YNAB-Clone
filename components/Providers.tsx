'use client';

import { QueryClient, MutationCache } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { SessionProvider, useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useBroadcastSync, broadcastInvalidation } from '@/hooks/useBroadcastSync';
import { persister, APP_CACHE_VERSION } from '@/lib/persistence/persister';
import { STALE_TIME } from '@/lib/constants';
import * as Sentry from '@sentry/nextjs';
import { identifyUser, clearUser } from '@/lib/sentry-utils';
import SentryNavigationTracker from './SentryNavigationTracker';

/**
 * Global MutationCache handles toast feedback and cross-tab sync.
 * Mutations opt-in via `meta`:
 *
 *   useMutation({
 *     meta: {
 *       successMessage: 'Saved!',
 *       errorMessage: 'Could not save',
 *       broadcastKeys: ['budget', 'accounts'],  // ← cross-tab sync
 *     },
 *     ...
 *   })
 *
 * - `meta.successMessage`  → shows a success toast on success
 * - `meta.errorMessage`    → overrides the default error message
 * - `meta.skipGlobalError` → set to true if the mutation handles its own error toast
 * - `meta.broadcastKeys`   → array of query keys to invalidate in other tabs
 */
export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                mutationCache: new MutationCache({
                    onSuccess: (_data, _variables, _context, mutation) => {
                        const meta = mutation.options.meta as
                            | { successMessage?: string; broadcastKeys?: string[] }
                            | undefined;

                        // Toast feedback
                        if (meta?.successMessage) {
                            toast.success(meta.successMessage);
                        }

                        // Cross-tab sync: broadcast invalidation to other tabs
                        if (meta?.broadcastKeys?.length) {
                            broadcastInvalidation(meta.broadcastKeys);
                        }
                    },
                    onError: (error, _variables, _context, mutation) => {
                        // Add breadcrumb for Sentry context
                        Sentry.addBreadcrumb({
                            category: 'mutation',
                            message: `Mutation failed: ${mutation.options.mutationKey}`,
                            level: 'error',
                            data: {
                                mutationKey: mutation.options.mutationKey,
                                error: error instanceof Error ? error.message : String(error),
                            },
                        });

                        const meta = mutation.options.meta as
                            | { errorMessage?: string; skipGlobalError?: boolean }
                            | undefined;
                        if (meta?.skipGlobalError) return;

                        const message = meta?.errorMessage || 'Error de sincronización';
                        toast.error(message, {
                            description:
                                error instanceof Error
                                    ? error.message
                                    : 'Intenta de nuevo',
                        });
                    },
                }),
                defaultOptions: {
                    queries: {
                        // With SSR, we usually want to set some default staleTime
                        // above 0 to avoid refetching immediately on the client
                        staleTime: STALE_TIME.DEFAULT,
                        // Keep cache entries alive for 24h so the persister can save them.
                        // Without this, the default 5-min gcTime garbage-collects queries
                        // before the persister has a chance to serialize them to IndexedDB.
                        gcTime: 24 * 60 * 60 * 1000, // 24 hours
                    },
                    mutations: {
                        // Global retry with exponential backoff for all mutations
                        retry: 2,
                        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
                        // Queue mutations when offline, auto-execute on reconnect
                        networkMode: 'offlineFirst',
                    },
                },
            })
    );

    return (
        <SessionProvider>
            <PersistQueryClientProvider
                client={queryClient}
                persistOptions={{
                    persister,
                    buster: APP_CACHE_VERSION,
                    maxAge: 1000 * 60 * 60 * 24, // 24 hours
                }}
                onSuccess={() => {
                    // After restoring from IndexedDB, resume any paused mutations
                    // (e.g., mutations queued while offline) then invalidate all
                    // queries so they refetch fresh data from the server.
                    queryClient.resumePausedMutations().then(() => {
                        queryClient.invalidateQueries();
                    });
                }}
            >
                <SentryUserIdentifier />
                <SentryNavigationTracker />
                <BroadcastSyncListener />
                {children}
                <ReactQueryDevtools initialIsOpen={false} />
            </PersistQueryClientProvider>
        </SessionProvider>
    );
}

/**
 * Syncs the next-auth session user to the Sentry scope.
 * When authenticated → Sentry.setUser({ id, email }).
 * When logged out → Sentry.setUser(null).
 * Must be inside SessionProvider.
 */
function SentryUserIdentifier() {
    const { data: session, status } = useSession();

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.id) {
            identifyUser({
                id: session.user.id,
                email: session.user.email,
                name: session.user.name,
            });
        } else if (status === 'unauthenticated') {
            clearUser();
        }
    }, [session, status]);

    return null;
}

/**
 * Internal component that activates the BroadcastChannel listener.
 * Must be inside QueryClientProvider to access the queryClient.
 */
function BroadcastSyncListener() {
    useBroadcastSync();
    return null;
}
