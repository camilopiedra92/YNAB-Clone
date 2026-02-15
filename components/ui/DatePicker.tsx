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
            className={`w-full px-5 py-3.5 rounded-xl
        text-gray-200 font-bold text-sm
        glass-input
        focus:outline-none focus:border-primary/30
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-300 ${className}`}
        />
    );
}
