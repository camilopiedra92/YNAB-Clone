'use client';

import React from 'react';
import { Search, Undo2, Redo2, History } from 'lucide-react';
import { CreateCategoryGroupPopover } from '@/components/budget/CreateCategoryGroupPopover';

const filters = [
    { label: 'All', active: true },
    { label: 'Snoozed', active: false },
    { label: 'Underfunded', active: false },
    { label: 'Overfunded', active: false },
    { label: 'Money Available', active: false },
    { label: 'Guilt Free', active: false },
    { label: 'Fixed Costs', active: false },
    { label: 'Savings', active: false },
];

interface BudgetToolbarProps {
    budgetId: number;
    onFetchBudget: () => void;
}

export function BudgetToolbar({ budgetId, onFetchBudget }: BudgetToolbarProps) {
    return (
        <>
            {/* Sub-header Filter Section - More like a tab system */}
            <div className="px-8 py-2.5 flex items-center justify-between bg-background overflow-x-auto no-scrollbar gap-4"
                style={{
                    boxShadow: '0 2px 6px 0 var(--neu-dark)',
                }}
            >
                <div className="flex items-center gap-3">
                    {filters.map((filter) => (
                        <button
                            key={filter.label}
                            className={`px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter.active
                                ? 'neu-btn-primary'
                                : 'neu-btn text-muted-foreground'
                                }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4 ml-auto">
                    <div className="flex items-center gap-3 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                        <button className="flex items-center gap-2 hover:opacity-70 transition-opacity opacity-40">
                            <Undo2 className="w-4 h-4" />
                            Undo
                        </button>
                        <button className="flex items-center gap-2 hover:opacity-70 transition-opacity opacity-40">
                            <Redo2 className="w-4 h-4" />
                            Redo
                        </button>
                        <div className="w-px h-4 bg-border mx-1" />
                        <button className="flex items-center gap-2 hover:text-primary-600 transition-colors">
                            <History className="w-4 h-4" />
                            History
                        </button>
                    </div>
                </div>
            </div>

            {/* Toolbar Section - Actions */}
            <div className="px-8 py-2.5 flex items-center justify-between bg-background">
                <div className="flex items-center gap-4">
                    <CreateCategoryGroupPopover budgetId={budgetId} onSuccess={() => onFetchBudget()} />
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search categories..."
                            className="pl-10 pr-4 py-2 bg-background rounded-xl text-sm shadow-neu-inset-sm focus:outline-none focus:shadow-neu-inset transition-all w-64"
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
