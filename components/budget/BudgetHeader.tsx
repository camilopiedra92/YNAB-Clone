'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { MonthPicker } from '@/components/budget/MonthPicker';

interface BudgetHeaderProps {
    currentMonth: string;
    onNavigateMonth: (direction: number) => void;
    onGoToCurrentMonth: () => void;
    onSetCurrentMonth: (month: string) => void;
    animatedRTA: number;
    formatCurrency: (value: number) => string;
}

export function BudgetHeader({
    currentMonth,
    onNavigateMonth,
    onGoToCurrentMonth,
    onSetCurrentMonth,
    animatedRTA,
    formatCurrency,
}: BudgetHeaderProps) {
    return (
        <header className="px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 bg-background"
            style={{
                boxShadow: '0 4px 12px 0 var(--neu-dark)',
            }}
        >
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 p-1.5 rounded-2xl shadow-neu-sm bg-background/50 backdrop-blur-sm">
                    <button
                        data-testid="month-prev"
                        onClick={() => onNavigateMonth(-1)}
                        className="p-2 rounded-xl hover:bg-primary/10 text-primary transition-all active:scale-95"
                        title="Mes Anterior"
                        aria-label="Mes anterior"
                    >
                        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <button
                        onClick={onGoToCurrentMonth}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all active:scale-95 shadow-neu-sm border border-primary/10 ml-1"
                    >
                        Hoy
                    </button>
                    <div data-testid="month-display" className="px-4 flex flex-col items-center min-w-[140px]">
                        <MonthPicker currentMonth={currentMonth} onChange={onSetCurrentMonth} />
                    </div>
                    <button
                        data-testid="month-next"
                        onClick={() => onNavigateMonth(1)}
                        className="p-2 rounded-xl hover:bg-primary/10 text-primary transition-all active:scale-95"
                        title="Mes Siguiente"
                        aria-label="Mes siguiente"
                    >
                        <ChevronRight className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Prominent Ready to Assign Widget */}
            <div className="absolute left-1/2 -translate-x-1/2">
                <div
                    role="status"
                    aria-live="polite"
                    aria-label={`Ready to Assign: ${formatCurrency(Math.round(animatedRTA))}`}
                    className={`bg-background px-8 py-2 rounded-[2rem] flex flex-col items-center shadow-neu-md relative group cursor-pointer hover:shadow-neu-lg transition-all duration-500 overflow-hidden min-w-[220px] ${animatedRTA < -0.5 ? 'ring-2 ring-red-400/50' : animatedRTA > 0.5 ? 'ring-2 ring-emerald-400/30' : ''
                    }`}>
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span data-testid="rta-amount" className={`text-2xl font-black tracking-tighter leading-none relative z-10 tabular-nums ${animatedRTA < -0.5 ? 'text-red-500' : animatedRTA > 0.5 ? 'text-emerald-600' : 'text-foreground'
                        }`}>{formatCurrency(Math.round(animatedRTA))}</span>
                    <div className="flex items-center gap-2 mt-0.5 relative z-10">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-80">Ready to Assign</span>
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${animatedRTA < -0.5 ? 'bg-red-500' : animatedRTA > 0.5 ? 'bg-emerald-500' : 'bg-emerald-500'
                            }`} />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 p-1 rounded-xl shadow-neu-inset-sm">
                    <button className="p-2 rounded-lg shadow-neu-sm" aria-label="Vista de cuadrícula" aria-pressed="true">
                        <LayoutGrid className="w-4 h-4 text-primary" aria-hidden="true" />
                    </button>
                    <button className="p-2 rounded-lg text-muted-foreground/60 hover:text-foreground transition-colors" aria-label="Vista de lista" aria-pressed="false">
                        <List className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </header>
    );
}
