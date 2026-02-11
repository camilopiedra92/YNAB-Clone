'use client';

import { useCallback, useEffect, useRef } from 'react';
import { UseMutationResult } from '@tanstack/react-query';

/**
 * Wraps a React Query mutation with debounce behavior.
 *
 * - `debouncedMutate(vars)` — schedules the mutation after `delay` ms.
 *   Repeated calls reset the timer (only the last call fires).
 * - `flush(vars)` — cancels any pending timer and fires immediately.
 *   Use on blur / Enter to commit without waiting.
 *
 * The underlying mutation (optimistic updates, retries, etc.) is unchanged.
 */
export function useDebouncedMutation<TData, TError, TVariables, TContext>(
    mutation: UseMutationResult<TData, TError, TVariables, TContext>,
    delay: number = 400,
) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const debouncedMutate = useCallback(
        (variables: TVariables) => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                mutation.mutate(variables);
                timerRef.current = null;
            }, delay);
        },
        // Intentionally depending on `mutation.mutate` (stable) instead of the full `mutation`
        // object, which changes identity every render and would defeat the debounce.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mutation.mutate, delay],
    );

    const flush = useCallback(
        (variables: TVariables) => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            mutation.mutate(variables);
        },
        // Intentionally depending on `mutation.mutate` (stable) instead of the full `mutation`
        // object, which changes identity every render and would recreate the callback.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mutation.mutate],
    );

    // Cancel pending timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return { debouncedMutate, flush, ...mutation };
}
