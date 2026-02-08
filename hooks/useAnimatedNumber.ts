'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Hook that smoothly animates a number from its previous value to its new value.
 * Uses requestAnimationFrame for buttery-smooth 60fps transitions.
 */
export function useAnimatedNumber(targetValue: number, duration: number = 350): number {
    const [displayValue, setDisplayValue] = useState(targetValue);
    const animationRef = useRef<number | null>(null);
    const startValueRef = useRef(targetValue);
    const startTimeRef = useRef<number | null>(null);
    const isFirstRender = useRef(true);

    useEffect(() => {
        // Skip animation on first render — show the value immediately
        if (isFirstRender.current) {
            isFirstRender.current = false;
            setDisplayValue(targetValue);
            startValueRef.current = targetValue;
            return;
        }

        // If value hasn't changed, do nothing
        if (startValueRef.current === targetValue) return;

        // Cancel any running animation
        if (animationRef.current !== null) {
            cancelAnimationFrame(animationRef.current);
        }

        const startValue = displayValue;
        startTimeRef.current = null;

        const animate = (timestamp: number) => {
            if (startTimeRef.current === null) {
                startTimeRef.current = timestamp;
            }

            const elapsed = timestamp - startTimeRef.current;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out cubic for natural deceleration
            const eased = 1 - Math.pow(1 - progress, 3);

            const currentValue = startValue + (targetValue - startValue) * eased;
            setDisplayValue(currentValue);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            } else {
                // Ensure we land exactly on the target
                setDisplayValue(targetValue);
                startValueRef.current = targetValue;
                animationRef.current = null;
            }
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current !== null) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [targetValue, duration]);

    return displayValue;
}
