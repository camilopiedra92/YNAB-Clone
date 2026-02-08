'use client';

import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Global MutationCache handles toast feedback so individual mutations
 * don't need to call toast() directly. Mutations opt-in via `meta`:
 *
 *   useMutation({
 *     meta: { successMessage: 'Saved!', errorMessage: 'Could not save' },
 *     ...
 *   })
 *
 * - `meta.successMessage` → shows a success toast on success
 * - `meta.errorMessage`   → overrides the default error message
 * - `meta.skipGlobalError` → set to true if the mutation handles its own error toast
 */
export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                mutationCache: new MutationCache({
                    onSuccess: (_data, _variables, _context, mutation) => {
                        const meta = mutation.options.meta as
                            | { successMessage?: string }
                            | undefined;
                        if (meta?.successMessage) {
                            toast.success(meta.successMessage);
                        }
                    },
                    onError: (error, _variables, _context, mutation) => {
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
                        staleTime: 60 * 1000,
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
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
