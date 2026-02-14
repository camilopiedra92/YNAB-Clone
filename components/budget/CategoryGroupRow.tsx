'use client';

import React from 'react';
import { ChevronDown, GripVertical, CreditCard } from 'lucide-react';
import { SortableRow } from './SortableRow';
import { CreateCategoryPopover } from './CreateCategoryPopover';
import { BudgetItem } from '@/hooks/useBudgetTable';
import { useTranslations } from 'next-intl';

interface CategoryGroupRowProps {
    group: {
        id: number;
        name: string;
        items: BudgetItem[];
    };
    budgetId: number;
    isExpanded: boolean;
    allSelected: boolean;
    onToggleGroup: (name: string) => void;
    onToggleSelection: (items: BudgetItem[]) => void;
    onFetchBudget: () => void;
    formatCurrency: (amount: number) => string;
}

export const CategoryGroupRow = React.memo(({
    group,
    budgetId,
    isExpanded,
    allSelected,
    onToggleGroup,
    onToggleSelection,
    onFetchBudget,
    formatCurrency,
}: CategoryGroupRowProps) => {
    const t = useTranslations('budget');
    const isCreditCardGroup = group.name === 'Credit Card Payments';
    const groupTotals = group.items.reduce((acc, item) => ({
        assigned: acc.assigned + item.assigned,
        activity: acc.activity + item.activity,
        available: acc.available + item.available,
    }), { assigned: 0, activity: 0, available: 0 });

    return (
        <SortableRow
            id={`group-${group.id}`}
            type="group"
            className="group cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors duration-200 border-b border-border/20"
        >
            {(listeners, attributes) => (
                <>
                    <td className="py-1 px-4 font-bold border-b border-border/20" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                            <div className="flex items-center gap-2">
                                {isCreditCardGroup ? (
                                    <div className="w-8" />
                                ) : (
                                    <div {...listeners} {...attributes} className="w-8 flex justify-center cursor-grab active:cursor-grabbing p-1.5 rounded-lg hover:bg-muted/60 transition-colors opacity-0 group-hover:opacity-100" aria-label={t('reorderGroup')}>
                                        <GripVertical className="w-4 h-4 text-muted-foreground/40" aria-hidden="true" />
                                    </div>
                                )}
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded-md border-border accent-primary cursor-pointer transition-all hover:scale-110"
                                    checked={allSelected}
                                    onChange={() => onToggleSelection(group.items)}
                                    aria-label={t('selectAll', { name: group.name })}
                                />
                            </div>
                        </div>
                    </td>
                    <td className="py-0.5 px-2 cursor-pointer" onClick={() => onToggleGroup(group.name)} aria-expanded={isExpanded} aria-label={isExpanded ? t('collapse', { name: group.name }) : t('expand', { name: group.name })}>
                            <div className="flex items-center gap-3">
                            <div className={`p-1 rounded-lg transition-all duration-300 ${isExpanded ? 'bg-primary/5 text-primary' : 'text-muted-foreground'}`}>
                                <ChevronDown className={`w-4 h-4 transition-transform duration-500 ${!isExpanded ? '-rotate-90' : ''}`} aria-hidden="true" />
                            </div>
                            <span className="text-sm font-black text-foreground uppercase tracking-wider">{group.name}</span>
                            {isCreditCardGroup && (
                                <CreditCard className="w-4 h-4 text-primary/50" />
                            )}
                            {!isCreditCardGroup && (
                                <div onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <CreateCategoryPopover budgetId={budgetId} groupId={group.id} onSuccess={onFetchBudget} />
                                </div>
                            )}
                        </div>
                    </td>
                    <td className="py-1 px-4 text-right border-b border-border/20" onClick={() => onToggleGroup(group.name)}>
                        <div className="flex justify-end">
                            <div className="min-w-[110px] px-3 text-right text-sm font-bold text-muted-foreground/60 tabular-nums">
                                {formatCurrency(groupTotals.assigned)}
                            </div>
                        </div>
                    </td>
                    <td className="py-1 px-4 text-right border-b border-border/20" onClick={() => onToggleGroup(group.name)}>
                        <div className="flex justify-end">
                            <div className="min-w-[110px] px-3 text-right text-sm font-bold text-muted-foreground/40 tabular-nums">
                                {formatCurrency(groupTotals.activity)}
                            </div>
                        </div>
                    </td>
                    <td className="py-1 px-4 text-right border-b border-border/20" onClick={() => onToggleGroup(group.name)}>
                        <div className="flex justify-end">
                            <div className="min-w-[110px] px-3 text-right text-sm font-bold text-foreground tabular-nums">
                                {formatCurrency(groupTotals.available)}
                            </div>
                        </div>
                    </td>
                </>
            )}
        </SortableRow>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.group === nextProps.group &&
        prevProps.isExpanded === nextProps.isExpanded &&
        prevProps.allSelected === nextProps.allSelected
    );
});

CategoryGroupRow.displayName = 'CategoryGroupRow';
