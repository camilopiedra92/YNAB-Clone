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
    let pillClass = '';

    if (isCreditCardPayment) {
        if (amount > 0) {
            pillClass = 'pill-positive hover:scale-105 active:scale-95';
        } else if (amount < 0) {
            pillClass = 'pill-warning hover:scale-105 active:scale-95';
        } else {
            pillClass = 'pill-neutral';
        }
    } else {
        if (amount > 0) {
            pillClass = 'pill-positive hover:scale-105 active:scale-95';
        } else if (amount < 0) {
            if (overspendingType === 'credit') {
                pillClass = 'pill-warning hover:scale-105 active:scale-95';
            } else {
                pillClass = 'pill-negative hover:scale-105 active:scale-95';
            }
        } else {
            pillClass = 'pill-neutral';
        }
    }

    return (
        <div className="flex items-center gap-2 text-sm">
            {isCreditCardPayment && amount > 0 && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-primary/50 whitespace-nowrap">
                    {t('payment')}
                </span>
            )}
            <button
                data-testid={dataTestId}
                onClick={onClick}
                className={`min-w-[100px] py-1.5 px-4 rounded-full text-sm font-bold text-center tabular-nums transition-all duration-200 backdrop-blur-sm ${pillClass}`}
            >
                {formatCurrency(amount)}
            </button>
        </div>
    );
};

