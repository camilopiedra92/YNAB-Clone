'use client';

interface DatePickerProps {
    value: string; // YYYY-MM-DD format
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    min?: string;
    max?: string;
}

export default function DatePicker({
    value,
    onChange,
    placeholder = 'Seleccionar fecha',
    className = '',
    disabled = false,
    min,
    max,
}: DatePickerProps) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    return (
        <input
            type="date"
            data-testid="date-picker"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            min={min}
            max={max}
            className={`w-full px-5 py-3.5 rounded-2xl
        bg-background text-foreground font-bold text-sm
        shadow-neu-inset
        focus:outline-none focus:shadow-[inset_4px_4px_8px_0_var(--neu-dark),inset_-4px_-4px_8px_0_var(--neu-light)]
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-300 ${className}`}
        />
    );
}
