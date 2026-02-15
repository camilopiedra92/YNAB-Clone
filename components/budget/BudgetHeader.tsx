'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { MonthPicker } from '@/components/budget/MonthPicker';
import { useTranslations } from 'next-intl';
import { isCurrentMonth } from '@/lib/engine/clock';

interface BudgetHeaderProps {
    currentMonth: string;
    onNavigateMonth: (direction: number) => void;
    onGoToCurrentMonth: () => void;
    onSetCurrentMonth: (month: string) => void;
    animatedRTA: number;
    formatCurrency: (value: number) => string;
    minMonth?: string;
    maxMonth?: string;
}

export function BudgetHeader({
    currentMonth,
    onNavigateMonth,
    onGoToCurrentMonth,
    onSetCurrentMonth,
    animatedRTA,
    formatCurrency,
    minMonth,
    maxMonth,
}: BudgetHeaderProps) {
    const t = useTranslations('budget');
    const isAtMin = !!minMonth && currentMonth <= minMonth;
    const isAtMax = !!maxMonth && currentMonth >= maxMonth;
    const isOnCurrentMonth = isCurrentMonth(currentMonth);

    // RTA state colors
    const isNegative = animatedRTA < -0.5;
    const isPositive = animatedRTA > 0.5;
    const isZero = !isNegative && !isPositive;

    // State-driven styling
    const widgetBg = isNegative
        ? 'bg-red-500/[0.08] border-red-500/25'
        : isPositive
            ? 'bg-green-500/[0.06] border-green-500/20'
            : 'bg-white/[0.08] border-white/[0.12]';

    const widgetShadow = isNegative
        ? 'shadow-[0_0_20px_-4px_rgba(248,113,113,0.25),inset_0_1px_0_rgba(255,255,255,0.06)]'
        : isPositive
            ? 'shadow-[0_0_20px_-4px_rgba(74,222,128,0.2),inset_0_1px_0_rgba(255,255,255,0.06)]'
            : 'shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]';

    const amountColor = isNegative
        ? 'text-red-400 text-glow-red'
        : isPositive
            ? 'text-green-400 text-glow-green'
            : 'text-gray-100';

    const indicatorStyle = isNegative
        ? 'bg-red-500/20 border border-red-500/30 animate-glow-pulse'
        : isPositive
            ? 'bg-green-500/15 border border-green-500/25'
            : 'bg-white/[0.08] border border-white/[0.12]';

    return (
        <header className="glass-panel rounded-xl px-6 py-5 flex items-center justify-between shrink-0 relative"
        >
            <div className="flex items-center gap-4">
                {/* Month Navigation */}
                <div className="flex items-center gap-3">
                    <button
                        data-testid="month-prev"
                        onClick={() => onNavigateMonth(-1)}
                        className={`w-8 h-8 rounded-full border border-primary/50 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors ${isAtMin ? 'opacity-30 pointer-events-none' : ''}`}
                        title={t('previousMonth')}
                        aria-label={t('previousMonth')}
                        disabled={isAtMin}
                    >
                        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                    </button>

                    <div data-testid="month-display" className="flex flex-col items-center min-w-[140px]">
                        <MonthPicker currentMonth={currentMonth} onChange={onSetCurrentMonth} minMonth={minMonth} maxMonth={maxMonth} />
                    </div>

                    <button
                        data-testid="month-next"
                        onClick={() => onNavigateMonth(1)}
                        className={`w-8 h-8 rounded-full border border-primary/50 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors ${isAtMax ? 'opacity-30 pointer-events-none' : ''}`}
                        title={t('nextMonth')}
                        aria-label={t('nextMonth')}
                        disabled={isAtMax}
                    >
                        <ChevronRight className="w-5 h-5" aria-hidden="true" />
                    </button>

                    {/* Go to current month button */}
                    {!isOnCurrentMonth && (
                        <button
                            data-testid="month-today"
                            onClick={onGoToCurrentMonth}
                            className="ml-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary border border-primary/30 bg-primary/10 hover:bg-primary/20 hover:border-primary/50 transition-all duration-200 flex items-center gap-1.5"
                            title={t('today')}
                            aria-label={t('today')}
                        >
                            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                            {t('today')}
                        </button>
                    )}
                </div>
            </div>

            {/* Ready to Assign Widget — Elevated Glassmorphic Container */}
            <div className="absolute left-1/2 -translate-x-1/2">
                <div
                    role="status"
                    aria-live="polite"
                    aria-label={`${t('readyToAssign')}: ${formatCurrency(Math.round(animatedRTA))}`}
                    className={`${widgetBg} ${widgetShadow} rounded-xl px-6 py-2 flex items-center gap-4 backdrop-blur-xl cursor-pointer hover:brightness-110 transition-all duration-300`}
                >
                    <div className="flex flex-col items-end">
                        <span data-testid="rta-amount" className={`text-3xl font-extrabold tracking-tight leading-none tabular-nums ${amountColor}`}>
                            {formatCurrency(Math.round(animatedRTA))}
                        </span>
                        <span className="text-[11px] text-gray-300 font-semibold mt-1 uppercase tracking-wider">
                            {isNegative ? t('overAssigned') || t('readyToAssign')
                             : isZero ? (t('allMoneyAssigned') || t('readyToAssign'))
                             : t('readyToAssign')}
                        </span>
                    </div>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${indicatorStyle}`}>
                        {isNegative ? (
                            <span className="text-red-400 text-lg font-black">!</span>
                        ) : (
                            <svg className={`w-4.5 h-4.5 ${isPositive ? 'text-green-400' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                </div>
            </div>

            {/* Right side spacer for balance */}
            <div className="w-[100px]" />
        </header>
    );
}
