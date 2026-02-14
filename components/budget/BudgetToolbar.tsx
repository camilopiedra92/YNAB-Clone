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
        <div className="px-8 py-3 flex items-center gap-4 border-b border-border/30">
            {/* Filters */}
            <div className="flex items-center gap-1 flex-1 overflow-x-auto custom-scrollbar">
                {filters.map((filterKey) => (
                    <button
                        key={filterKey}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${filterKey === activeFilter
                            ? 'shadow-neu-sm text-foreground'
                            : 'text-muted-foreground/50 hover:text-muted-foreground hover:shadow-neu-sm'
                            }`}
                    >
                        {t(`filters.${filterKey}`)}
                    </button>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <button className="p-2 rounded-xl shadow-neu-sm text-muted-foreground hover:text-foreground transition-colors" title={t('undo')}>
                    <Undo2 className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-xl shadow-neu-sm text-muted-foreground hover:text-foreground transition-colors" title={t('redo')}>
                    <Redo2 className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-xl shadow-neu-sm text-muted-foreground hover:text-foreground transition-colors" title={t('history')}>
                    <History className="w-4 h-4" />
                </button>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={t('searchCategories')}
                        className="pl-8 pr-3 py-1.5 w-44 rounded-xl text-xs font-bold shadow-neu-inset-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background transition-all"
                    />
                </div>

                {/* Add Category Group */}
                <CreateCategoryGroupPopover budgetId={budgetId} />
            </div>
        </div>
    );
}
