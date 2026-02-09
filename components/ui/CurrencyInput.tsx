'use client';

import { useState, useEffect } from 'react';
import { formatCurrencyOrEmpty } from '@/lib/format';
import { fromMilliunits, toMilliunits } from '@/lib/engine/primitives';

interface CurrencyInputProps {
    value: number;
    onChange: (value: number) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    allowNegative?: boolean;
}

export default function CurrencyInput({
    value,
    onChange,
    placeholder = '$ 0',
    className = '',
    disabled = false,
    allowNegative = false,
}: CurrencyInputProps) {
    const [displayValue, setDisplayValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setTimeout(() => setDisplayValue(formatCurrencyOrEmpty(value)), 0);
        }
    }, [value, isFocused]);

    const parseInput = (input: string): number => {
        const cleaned = input.replace(/[^\d-]/g, '');
        const num = parseInt(cleaned || '0', 10);

        if (!allowNegative && num < 0) return 0;
        // Convert the user's display-number to milliunits
        return toMilliunits(num);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        setDisplayValue(input);

        const numericValue = parseInput(input);
        onChange(numericValue);
    };

    const handleFocus = () => {
        setIsFocused(true);
        if (value !== 0) {
            // Show the human-readable number (not milliunits) for editing
            setDisplayValue(fromMilliunits(value as import('@/lib/engine/primitives').Milliunit).toString());
        } else {
            setDisplayValue('');
        }
    };

    const handleBlur = () => {
        setIsFocused(false);
        setDisplayValue(formatCurrencyOrEmpty(value));
    };

    return (
        <input
            type="text"
            data-testid="currency-input"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full px-5 py-3.5 rounded-2xl
        bg-background text-foreground font-black text-lg tracking-tight
        shadow-neu-inset
        focus:outline-none focus:shadow-[inset_4px_4px_8px_0_var(--neu-dark),inset_-4px_-4px_8px_0_var(--neu-light)]
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-300 placeholder:opacity-30 ${className}`}
        />
    );
}
