'use client';

import React, { useState } from 'react';
import { Undo2, Redo2, History, Search } from 'lucide-react';
import { CreateCategoryGroupPopover } from './CreateCategoryGroupPopover';
import { useTranslations } from 'next-intl';

interface BudgetToolbarProps {
    budgetId: number;
    searchTerm?: string;
    onSearchChange?: (value: string) => void;
}

const filters = [
    'all', 'snoozed', 'underfunded', 'overfunded',
    'moneyAvailable', 'guiltFree', 'fixedCosts', 'savings'
] as const;

export function BudgetToolbar({ budgetId, searchTerm: externalSearchTerm, onSearchChange: externalOnSearchChange }: BudgetToolbarProps) {
    const [activeFilter] = useState('all');
    const [internalSearchTerm, setInternalSearchTerm] = useState('');
    const t = useTranslations('toolbar');

    const searchTerm = externalSearchTerm ?? internalSearchTerm;
    const onSearchChange = externalOnSearchChange ?? setInternalSearchTerm;

    return (
        <div className="flex items-center gap-2 overflow-x-auto px-5 py-3 border-b border-white/10 scrollbar-hide shrink-0">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
                {filters.map((filterKey) => (
                    <button
                        key={filterKey}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${filterKey === activeFilter
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        {t(`filters.${filterKey}`)}
                    </button>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
                <button className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors" title={t('undo')}>
                    <Undo2 className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors" title={t('redo')}>
                    <Redo2 className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors" title={t('history')}>
                    <History className="w-4 h-4" />
                </button>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={t('searchCategories')}
                        className="pl-8 pr-3 py-1.5 w-44 rounded-lg text-xs font-medium glass-input text-gray-200 placeholder:text-gray-500 focus:outline-none transition-all"
                    />
                </div>

                {/* Add Category Group */}
                <CreateCategoryGroupPopover budgetId={budgetId} />
            </div>
        </div>
    );
}
