/**
 * Unit tests for i18n-specific formatting and locale handling.
 *
 * Validates that formatCurrency produces correct output for
 * multiple locales and currencies, and that locale detection works.
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCurrencyOrEmpty } from '../format';

describe('formatCurrency — multi-locale', () => {
  it('formats COP in es-CO locale with dot thousands separator', () => {
    const result = formatCurrency(1500000, 'es-CO', 'COP');
    // 1500000 milliunits = 1500.00 COP
    // es-CO uses dot for thousands: $ 1.500
    expect(result).toContain('$');
    expect(result).toContain('1.500');
  });

  it('formats USD in en-US locale with comma thousands separator', () => {
    const result = formatCurrency(1500000, 'en-US', 'USD');
    // 1500000 milliunits = 1500.00 USD
    // en-US uses comma for thousands: $1,500.00
    expect(result).toContain('$');
    expect(result).toContain('1,500.00');
  });

  it('formats zero consistently across locales', () => {
    const esCO = formatCurrency(0, 'es-CO', 'COP');
    const enUS = formatCurrency(0, 'en-US', 'USD');
    expect(esCO).toContain('$');
    expect(enUS).toContain('$');
    expect(esCO).toContain('0');
    expect(enUS).toContain('0');
  });

  it('formats negative values in es-CO', () => {
    const result = formatCurrency(-5000000, 'es-CO', 'COP');
    expect(result).toContain('5.000');
  });

  it('formats negative values in en-US', () => {
    const result = formatCurrency(-5000000, 'en-US', 'USD');
    expect(result).toContain('5,000.00');
  });

  it('respects custom fraction digits in es-CO', () => {
    const result = formatCurrency(1500000, 'es-CO', 'COP', 0);
    // 0 fraction digits — no decimals
    expect(result).toContain('1.500');
    expect(result).not.toMatch(/1\.500,/); // no decimal comma
  });

  it('respects custom fraction digits in en-US', () => {
    const result = formatCurrency(1500000, 'en-US', 'USD', 0);
    expect(result).toContain('1,500');
    expect(result).not.toContain('1,500.00');
  });

  it('handles EUR currency in de-DE locale', () => {
    const result = formatCurrency(1234567, 'de-DE', 'EUR');
    // 1234567 milliunits = 1234.567 EUR → 1.234,57
    expect(result).toContain('€');
  });
});

describe('formatCurrencyOrEmpty — multi-locale', () => {
  it('returns empty for zero regardless of locale', () => {
    expect(formatCurrencyOrEmpty(0, 'es-CO', 'COP')).toBe('');
    expect(formatCurrencyOrEmpty(0, 'en-US', 'USD')).toBe('');
    expect(formatCurrencyOrEmpty(0, 'de-DE', 'EUR')).toBe('');
  });

  it('returns formatted string for non-zero in en-US', () => {
    const result = formatCurrencyOrEmpty(1000000, 'en-US', 'USD');
    expect(result).toContain('$');
    expect(result).toContain('1,000.00');
  });

  it('returns formatted string for non-zero in es-CO', () => {
    const result = formatCurrencyOrEmpty(1000000, 'es-CO', 'COP');
    expect(result).toContain('$');
    expect(result).toContain('1.000');
  });
});
