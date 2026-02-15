'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
                setHighlightedIndex(-1);
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

    const handleSelect = useCallback((optionValue: string | number) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
    }, [onChange]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(true);
                setHighlightedIndex(0);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < filteredOptions.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev > 0 ? prev - 1 : filteredOptions.length - 1
                );
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                    handleSelect(filteredOptions[highlightedIndex].value);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setHighlightedIndex(-1);
                break;
            case 'Home':
                e.preventDefault();
                setHighlightedIndex(0);
                break;
            case 'End':
                e.preventDefault();
                setHighlightedIndex(filteredOptions.length - 1);
                break;
        }
    }, [isOpen, highlightedIndex, filteredOptions, handleSelect]);

    // Scroll highlighted option into view
    useEffect(() => {
        if (highlightedIndex >= 0 && listRef.current) {
            const highlighted = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
            highlighted?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex]);

    const listboxId = 'select-listbox';

    return (
        <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
            {/* Select Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-controls={isOpen ? listboxId : undefined}
                aria-activedescendant={highlightedIndex >= 0 ? `select-option-${highlightedIndex}` : undefined}
                className={`w-full px-5 py-3.5 rounded-xl
          text-gray-200 font-bold text-sm
          focus:outline-none
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-300 flex items-center justify-between
          ${isOpen
                    ? 'glass-input border-primary/30'
                    : 'glass-input hover:border-white/15'}`}
            >
                <span className={selectedOption ? 'tracking-tight' : 'text-gray-500 font-medium'}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : ''}`} aria-hidden="true" />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-[110] w-full mt-3 glass-panel-strong rounded-xl max-h-72 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                    {searchable && (
                        <div className="p-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" aria-hidden="true" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setHighlightedIndex(0);
                                    }}
                                    placeholder="Buscar..."
                                    aria-label="Buscar opciones"
                                    className="w-full pl-10 pr-4 py-2 rounded-lg
                    text-gray-200 text-xs font-bold glass-input
                    focus:outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    )}

                    <div ref={listRef} id={listboxId} role="listbox" className="py-2 overflow-y-auto custom-scrollbar flex-1">
                        {(() => {
                            let flatIndex = 0;
                            return Object.entries(groupedOptions).map(([group, groupOptions]) => (
                                <div key={group} role="group" aria-label={group !== 'default' ? group : undefined}>
                                    {group !== 'default' && (
                                        <div className="px-5 py-2 text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1" role="presentation">
                                            {group}
                                        </div>
                                    )}
                                    <div className="px-2 space-y-1">
                                        {groupOptions.map((option) => {
                                            const currentIndex = flatIndex++;
                                            const isHighlighted = currentIndex === highlightedIndex;
                                            return (
                                                <button
                                                    key={option.value}
                                                    id={`select-option-${currentIndex}`}
                                                    data-index={currentIndex}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={option.value === value}
                                                    onClick={() => handleSelect(option.value)}
                                                    className={`w-full text-left px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-bold
                          ${option.value === value
                                                            ? 'bg-primary/10 text-primary border border-primary/20'
                                                            : isHighlighted
                                                                ? 'bg-white/[0.06] text-white'
                                                                : 'text-gray-300 hover:bg-white/[0.06]'}`}
                                                >
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ));
                        })()}
                        {filteredOptions.length === 0 && (
                            <div className="px-5 py-8 text-gray-600 text-center text-xs font-bold uppercase tracking-widest opacity-50">
                                Sin resultados
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
