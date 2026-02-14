'use client';

import React from 'react';
import { OverspendingType } from '@/lib/engine';
import { useTranslations } from 'next-intl';

interface AvailabilityBubbleProps {
    amount: number;
    isCreditCardPayment: boolean;
    overspendingType?: OverspendingType;
    formatCurrency: (amount: number) => string;
    onClick?: () => void;
    'data-testid'?: string;
}

export const AvailabilityBubble = ({
    amount,
    isCreditCardPayment,
    overspendingType,
    formatCurrency,
    onClick,
    'data-testid': dataTestId,
}: AvailabilityBubbleProps) => {
    const t = useTranslations('budget');
    let colorClasses = '';

    if (isCreditCardPayment) {
        if (amount > 0) {
            colorClasses = 'bg-primary/10 text-primary shadow-neu-inset-sm hover:bg-primary hover:text-white hover:shadow-neu-sm hover:scale-105 active:scale-95';
        } else if (amount < 0) {
            colorClasses = 'bg-amber-500/10 text-amber-600 shadow-neu-inset-sm hover:bg-amber-500 hover:text-white hover:shadow-neu-sm hover:scale-105 active:scale-95';
        } else {
            colorClasses = 'text-muted-foreground/60 shadow-neu-inset-sm grayscale hover:grayscale-0 transition-all';
        }
    } else {
        if (amount > 0) {
            colorClasses = 'bg-emerald-500/10 text-emerald-600 shadow-neu-inset-sm hover:bg-emerald-500 hover:text-white hover:shadow-neu-sm hover:scale-105 active:scale-95';
        } else if (amount < 0) {
            if (overspendingType === 'credit') {
                colorClasses = 'bg-amber-500/10 text-amber-600 shadow-neu-inset-sm hover:bg-amber-500 hover:text-white hover:shadow-neu-sm hover:scale-105 active:scale-95';
            } else {
                colorClasses = 'bg-rose-500/10 text-rose-600 shadow-neu-inset-sm hover:bg-rose-500 hover:text-white hover:shadow-neu-sm hover:scale-105 active:scale-95';
            }
        } else {
            colorClasses = 'text-muted-foreground/60 shadow-neu-inset-sm grayscale hover:grayscale-0 transition-all';
        }
    }

    return (
        <div className="flex items-center gap-2 text-sm">
            {isCreditCardPayment && amount > 0 && (
                <span className="text-[9px] font-black uppercase tracking-widest text-primary/50 whitespace-nowrap">
                    {t('payment')}
                </span>
            )}
            <button
                data-testid={dataTestId}
                onClick={onClick}
                className={`min-w-[100px] py-1 px-3 rounded-lg text-sm font-bold text-right tabular-nums transition-[background-color,color,box-shadow,transform] duration-200 ${colorClasses}`}
            >
                {formatCurrency(amount)}
            </button>
        </div>
    );
};

