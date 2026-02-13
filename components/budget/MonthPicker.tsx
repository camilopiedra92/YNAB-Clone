'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { format, addYears, subYears, setMonth, getYear, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

interface MonthPickerProps {
    currentMonth: string; // YYYY-MM
    onChange: (month: string) => void;
    minMonth?: string; // YYYY-MM
    maxMonth?: string; // YYYY-MM
}

export function MonthPicker({ currentMonth, onChange, minMonth, maxMonth }: MonthPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(() => {
        const parsed = parseISO(`${currentMonth}-01`);
        return isValid(parsed) ? parsed : new Date();
    });
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Reset view date when currentMonth changes if it's closed
    useEffect(() => {
        if (!isOpen) {
            const parsed = parseISO(`${currentMonth}-01`);
            if (isValid(parsed)) {
                setTimeout(() => setViewDate(parsed), 0);
            }
        }
    }, [currentMonth, isOpen]);

    const months = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const currentViewYear = getYear(viewDate);

    // Derive min/max years from props
    const minYear = minMonth ? parseInt(minMonth.split('-')[0], 10) : null;
    const maxYear = maxMonth ? parseInt(maxMonth.split('-')[0], 10) : null;

    const canGoPrevYear = minYear === null || currentViewYear > minYear;
    const canGoNextYear = maxYear === null || currentViewYear < maxYear;

    const handleMonthSelect = (monthIndex: number) => {
        const newDate = setMonth(viewDate, monthIndex);
        const monthStr = format(newDate, 'yyyy-MM');
        onChange(monthStr);
        setIsOpen(false);
    };

    const isMonthDisabled = (monthIndex: number): boolean => {
        const date = setMonth(viewDate, monthIndex);
        const monthKey = format(date, 'yyyy-MM');
        if (minMonth && monthKey < minMonth) return true;
        if (maxMonth && monthKey > maxMonth) return true;
        return false;
    };

    const parsedCurrent = parseISO(`${currentMonth}-01`);
    const displayMonth = isValid(parsedCurrent)
        ? format(parsedCurrent, 'MMM', { locale: es }).toUpperCase().replace('.', '')
        : '---';
    const displayYear = isValid(parsedCurrent)
        ? format(parsedCurrent, 'yyyy')
        : '----';

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-label={`Seleccionar mes: ${displayMonth} ${displayYear}`}
                className="flex items-center gap-2 text-lg font-black text-foreground group tracking-tight hover:opacity-80 transition-opacity"
            >
                {displayMonth}
                <span className="text-primary opacity-50 font-medium ml-1">{displayYear}</span>
                <ChevronDown className="w-4 h-4 text-primary group-hover:translate-y-0.5 transition-transform" aria-hidden="true" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-72 neu-card rounded-3xl p-6 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300 shadow-neu-lg bg-background"
                    style={{
                        boxShadow: '10px 10px 24px 0 var(--neu-dark-strong), -10px -10px 24px 0 var(--neu-light-strong)',
                    }}
                >
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => canGoPrevYear && setViewDate(subYears(viewDate, 1))}
                            aria-label="Año anterior"
                            disabled={!canGoPrevYear}
                            className={`p-2 rounded-xl hover:bg-primary/10 text-primary transition-all active:scale-95 shadow-neu-sm ${!canGoPrevYear ? 'opacity-30 pointer-events-none' : ''}`}
                        >
                            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <span className="text-sm font-black text-foreground uppercase tracking-widest">{currentViewYear}</span>
                        <button
                            onClick={() => canGoNextYear && setViewDate(addYears(viewDate, 1))}
                            aria-label="Año siguiente"
                            disabled={!canGoNextYear}
                            className={`p-2 rounded-xl hover:bg-primary/10 text-primary transition-all active:scale-95 shadow-neu-sm ${!canGoNextYear ? 'opacity-30 pointer-events-none' : ''}`}
                        >
                            <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {months.map((mIdx) => {
                            const date = setMonth(viewDate, mIdx);
                            const monthKey = format(date, 'yyyy-MM');
                            const isSelected = monthKey === currentMonth;
                            const isCurrent = monthKey === format(new Date(), 'yyyy-MM');
                            const disabled = isMonthDisabled(mIdx);

                            return (
                                <button
                                    key={mIdx}
                                    onClick={() => !disabled && handleMonthSelect(mIdx)}
                                    disabled={disabled}
                                    className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all
                                        ${disabled
                                            ? 'opacity-30 cursor-not-allowed text-muted-foreground'
                                            : isSelected
                                                ? 'neu-btn-primary shadow-neu-sm scale-105'
                                                : isCurrent
                                                    ? 'neu-btn text-primary border-primary/20 bg-primary/5'
                                                    : 'neu-btn text-muted-foreground hover:text-foreground hover:bg-primary/5'
                                        }`}
                                >
                                    {format(date, 'MMM', { locale: es }).replace('.', '')}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

