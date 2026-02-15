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
    id?: string;
}

export default function CurrencyInput({
    value,
    onChange,
    placeholder = '$ 0',
    className = '',
    disabled = false,
    allowNegative = false,
    id,
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
            id={id}
            type="text"
            data-testid="currency-input"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full px-5 py-3.5 rounded-xl
        text-gray-200 font-bold text-lg tracking-tight
        glass-input
        focus:outline-none focus:border-primary/30
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-300 placeholder:text-gray-600 ${className}`}
        />
    );
}
