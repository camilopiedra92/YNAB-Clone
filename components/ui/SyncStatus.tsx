'use client';

import { useIsMutating, useMutationState, useQueryClient, useIsRestoring } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

type SyncState = 'idle' | 'syncing' | 'saved' | 'offline' | 'queued' | 'error' | 'restoring';

export default function SyncStatus() {
    const queryClient = useQueryClient();
    const isMutating = useIsMutating();
    const isRestoring = useIsRestoring();
    const { isOnline } = useOnlineStatus();
    const [visible, setVisible] = useState(false);

    // Track failed mutations
    const failedMutations = useMutationState({
        filters: { status: 'error' },
        select: (mutation) => mutation.state.status,
    });

    // Track paused (queued) mutations
    const pausedMutations = useMutationState({
        filters: { status: 'pending' },
        select: (mutation) => mutation.state.isPaused,
    });

    const pausedCount = pausedMutations.filter(Boolean).length;
    const errorCount = failedMutations.length;

    // Determine current sync state
    const syncState: SyncState = (() => {
        if (isRestoring) return 'restoring';
        if (!isOnline && pausedCount > 0) return 'queued';
        if (!isOnline) return 'offline';
        if (errorCount > 0) return 'error';
        if (isMutating > 0) return 'syncing';
        return 'idle';
    })();

    useEffect(() => {
        if (syncState !== 'idle') {
            setTimeout(() => setVisible(true), 0);
        } else {
            // Show "Saved" briefly after mutations finish, then hide
            setTimeout(() => setVisible(true), 0);
            const timer = setTimeout(() => setVisible(false), 1200);
            return () => clearTimeout(timer);
        }
    }, [syncState, isMutating]);

    // Don't show anything if idle and timer expired
    if (!visible && syncState === 'idle') return null;

    const handleRetry = () => {
        // Invalidate all queries to trigger refetch after errors
        queryClient.invalidateQueries();
    };

    const config = {
        syncing: {
            bg: 'bg-primary/10 text-primary shadow-neu-sm',
            icon: (
                <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            ),
            label: isMutating > 1 ? `Syncing ${isMutating} changes…` : 'Syncing…',
        },
        saved: {
            bg: 'bg-emerald-500/10 text-emerald-600 shadow-neu-sm',
            icon: (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
            ),
            label: 'Saved',
        },
        idle: {
            bg: 'bg-emerald-500/10 text-emerald-600 shadow-neu-sm',
            icon: (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
            ),
            label: 'Saved',
        },
        offline: {
            bg: 'bg-amber-500/10 text-amber-600 shadow-neu-sm',
            icon: (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364L18.364 5.636" />
                </svg>
            ),
            label: 'Offline',
        },
        queued: {
            bg: 'bg-amber-500/10 text-amber-600 shadow-neu-sm',
            icon: (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            label: `${pausedCount} pending`,
        },
        restoring: {
            bg: 'bg-sky-500/10 text-sky-600 shadow-neu-sm',
            icon: (
                <div className="w-3 h-3 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
            ),
            label: 'Restoring…',
        },
        error: {
            bg: 'bg-rose-500/10 text-rose-600 shadow-neu-sm',
            icon: (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
            ),
            label: 'Sync error',
        },
    };

    const current = config[syncState];

    return (
        <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-500 ${current.bg}`}
            style={{
                backdropFilter: 'blur(12px)',
            }}
        >
            {current.icon}
            <span>{current.label}</span>
            {syncState === 'error' && (
                <button
                    onClick={handleRetry}
                    className="ml-1 px-2 py-0.5 rounded-full bg-rose-500/20 hover:bg-rose-500/40 text-rose-600 text-[9px] font-black uppercase tracking-wider transition-colors"
                >
                    Retry
                </button>
            )}
        </div>
    );
}
