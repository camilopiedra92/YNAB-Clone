/**
 * Unit tests for currency formatting utilities.
 *
 * Pure tests — no database or external dependencies.
 * Tests explicitly pass locale and currency to avoid depending on defaults.
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCurrencyOrEmpty } from '../format';

// Explicit locale + currency for deterministic assertions
const LOCALE = 'es-CO';
const CURRENCY = 'COP';

describe('formatCurrency', () => {
    it('formats positive milliunits as currency', () => {
        const result = formatCurrency(1500000, LOCALE, CURRENCY);
        // 1500000 milliunits = 1500.00 COP → "$ 1.500,00" in es-CO
        expect(result).toContain('1.500');
        expect(result).toContain('$');
    });

    it('formats zero', () => {
        const result = formatCurrency(0, LOCALE, CURRENCY);
        expect(result).toContain('0');
    });

    it('formats negative values', () => {
        const result = formatCurrency(-5000000, LOCALE, CURRENCY);
        // -5000000 milliunits = -5000.00 COP
        expect(result).toContain('5.000');
    });

    it('respects custom minimumFractionDigits', () => {
        const result = formatCurrency(1500000, LOCALE, CURRENCY, 0);
        // With 0 fraction digits, should not show decimals
        expect(result).toContain('1.500');
    });

    it('works with en-US / USD locale', () => {
        const result = formatCurrency(1500000, 'en-US', 'USD');
        // 1500000 milliunits = 1500.00 USD → "$1,500.00" in en-US
        expect(result).toContain('1,500');
        expect(result).toContain('$');
    });
});

describe('formatCurrencyOrEmpty', () => {
    it('returns empty string for zero', () => {
        expect(formatCurrencyOrEmpty(0, LOCALE, CURRENCY)).toBe('');
    });

    it('returns formatted string for non-zero positive', () => {
        const result = formatCurrencyOrEmpty(1000000, LOCALE, CURRENCY);
        expect(result).toContain('$');
        expect(result.length).toBeGreaterThan(0);
    });

    it('returns formatted string for non-zero negative', () => {
        const result = formatCurrencyOrEmpty(-500000, LOCALE, CURRENCY);
        expect(result.length).toBeGreaterThan(0);
    });
});
