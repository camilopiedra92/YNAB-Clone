'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export interface SelectOption {
    value: string | number;
    label: string;
    group?: string;
}

interface SelectProps {
    value: string | number | null;
    onChange: (value: string | number) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    searchable?: boolean;
}

export default function Select({
    value,
    onChange,
    options,
    placeholder = 'Seleccionar...',
    className = '',
    disabled = false,
    searchable = false,
}: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = searchable && searchTerm
        ? options.filter(opt =>
            opt.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : options;

    const groupedOptions = filteredOptions.reduce((acc, option) => {
        const group = option.group || 'default';
        if (!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(option);
        return acc;
    }, {} as Record<string, SelectOption[]>);

    const handleSelect = (optionValue: string | number) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Select Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-5 py-3.5 rounded-2xl
          bg-background text-foreground font-bold text-sm
          focus:outline-none
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-300 flex items-center justify-between
          ${isOpen ? 'shadow-neu-inset' : 'shadow-neu-sm hover:shadow-neu-md'}`}
            >
                <span className={selectedOption ? 'tracking-tight' : 'text-muted-foreground font-medium'}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-[110] w-full mt-3 bg-background rounded-2xl shadow-neu-lg max-h-72 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                    {searchable && (
                        <div className="p-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar..."
                                    className="w-full pl-10 pr-4 py-2 rounded-xl
                    bg-background text-foreground text-xs font-bold shadow-neu-inset-sm
                    focus:outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    )}

                    <div className="py-2 overflow-y-auto custom-scrollbar flex-1">
                        {Object.entries(groupedOptions).map(([group, groupOptions]) => (
                            <div key={group}>
                                {group !== 'default' && (
                                    <div className="px-5 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/50 mb-1">
                                        {group}
                                    </div>
                                )}
                                <div className="px-2 space-y-1">
                                    {groupOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleSelect(option.value)}
                                            className={`w-full text-left px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-bold
                          ${option.value === value
                                                    ? 'shadow-neu-inset bg-primary/10 text-primary'
                                                    : 'text-foreground hover:shadow-neu-sm'}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {filteredOptions.length === 0 && (
                            <div className="px-5 py-8 text-muted-foreground text-center text-xs font-bold uppercase tracking-widest opacity-50">
                                Sin resultados
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
