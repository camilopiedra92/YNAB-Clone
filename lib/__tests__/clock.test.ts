/**
 * Unit tests for the System Clock engine module.
 *
 * Uses vi.useFakeTimers() to control Date.now() — no network, no DB.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getCurrentMonth,
    isPastMonth,
    isCurrentMonth,
    isFutureMonth,
} from '../engine';

describe('Clock', () => {
    beforeEach(() => {
        // Fix the clock to 2026-02-10T12:00:00 UTC
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-10T12:00:00'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ─────────────────────────────────────────────────
    // getCurrentMonth
    // ─────────────────────────────────────────────────

    describe('getCurrentMonth', () => {
        it('returns YYYY-MM for standard months', () => {
            expect(getCurrentMonth()).toBe('2026-02');
        });

        it('zero-pads single-digit months', () => {
            vi.setSystemTime(new Date('2026-01-05T00:00:00'));
            expect(getCurrentMonth()).toBe('2026-01');
        });

        it('handles December correctly', () => {
            vi.setSystemTime(new Date('2025-12-31T23:59:59'));
            expect(getCurrentMonth()).toBe('2025-12');
        });

        it('handles January 1st correctly', () => {
            vi.setSystemTime(new Date('2027-01-01T00:00:00'));
            expect(getCurrentMonth()).toBe('2027-01');
        });
    });

    // ─────────────────────────────────────────────────
    // isPastMonth
    // ─────────────────────────────────────────────────

    describe('isPastMonth', () => {
        it('returns true for a month before current', () => {
            expect(isPastMonth('2026-01')).toBe(true);
            expect(isPastMonth('2025-12')).toBe(true);
        });

        it('returns false for the current month', () => {
            expect(isPastMonth('2026-02')).toBe(false);
        });

        it('returns false for a future month', () => {
            expect(isPastMonth('2026-03')).toBe(false);
        });
    });

    // ─────────────────────────────────────────────────
    // isCurrentMonth
    // ─────────────────────────────────────────────────

    describe('isCurrentMonth', () => {
        it('returns true for the current month', () => {
            expect(isCurrentMonth('2026-02')).toBe(true);
        });

        it('returns false for past months', () => {
            expect(isCurrentMonth('2026-01')).toBe(false);
        });

        it('returns false for future months', () => {
            expect(isCurrentMonth('2026-03')).toBe(false);
        });
    });

    // ─────────────────────────────────────────────────
    // isFutureMonth
    // ─────────────────────────────────────────────────

    describe('isFutureMonth', () => {
        it('returns true for a month after current', () => {
            expect(isFutureMonth('2026-03')).toBe(true);
            expect(isFutureMonth('2027-01')).toBe(true);
        });

        it('returns false for the current month', () => {
            expect(isFutureMonth('2026-02')).toBe(false);
        });

        it('returns false for a past month', () => {
            expect(isFutureMonth('2026-01')).toBe(false);
        });
    });
});
