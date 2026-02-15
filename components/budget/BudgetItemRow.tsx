'use client';

import React from 'react';
import { GripVertical, CreditCard } from 'lucide-react';
import { SortableRow } from './SortableRow';
import { BudgetItem } from '@/hooks/useBudgetTable';
import { AvailabilityBubble } from './AvailabilityBubble';
import { useTranslations } from 'next-intl';

interface BudgetItemRowProps {
    item: BudgetItem;
    isSelected: boolean;
    isEditing: boolean;
    editingValue: string;
    assignEditingId: number | null;
    assignEditValue: string;
    onToggleSelection: (id: number) => void;
    onSelect: (id: number, event: React.MouseEvent) => void;
    onStartEditName: (id: number, currentName: string) => void;
    onUpdateName: (id: number, newName: string) => void;
    onCancelEditName: () => void;
    onStartEditAssigned: (id: number, currentValue: string) => void;
    onUpdateAssigned: (id: number, value: string) => void;
    onCancelEditAssigned: () => void;
    onUpdateEditingValue: (value: string) => void;
    onUpdateAssignEditValue: (value: string) => void;
    formatCurrency: (amount: number) => string;
    onMoveMoneyClick?: (categoryId: number) => void;
}

export const BudgetItemRow = React.memo(({
    item,
    isSelected,
    isEditing,
    editingValue,
    assignEditingId,
    assignEditValue,
    onToggleSelection,
    onSelect,
    onStartEditName,
    onUpdateName,
    onCancelEditName,
    onStartEditAssigned,
    onUpdateAssigned,
    onCancelEditAssigned,
    onUpdateEditingValue,
    onUpdateAssignEditValue,
    formatCurrency,
    onMoveMoneyClick,
}: BudgetItemRowProps) => {
    const t = useTranslations('budget');
    const isCreditCardPayment = !!item.linkedAccountId;
    const isCreditCardGroup = item.groupName === 'Credit Card Payments';

    return (
        <SortableRow
            id={`item-${item.categoryId}`}
            type="item"
            data-testid={`category-row-${item.categoryId}`}
            className={`group transition-all duration-200 cursor-pointer ${isSelected
                ? 'bg-primary/5 border-l-2 border-l-primary border-b border-white/5'
                : 'glass-row'
                }`}
        >
            {(listeners, attributes) => (
                <>
                    <td className="py-3 px-4">
                        <div className="flex items-center justify-center">
                            <div className="flex items-center gap-2">
                                {isCreditCardGroup ? (
                                    <div className="w-8" />
                                ) : (
                                    <div {...listeners} {...attributes} className="w-8 flex justify-center cursor-grab active:cursor-grabbing p-1 rounded-lg hover:bg-white/[0.08] transition-colors opacity-0 group-hover:opacity-100" aria-label={t('reorder')}>
                                        <GripVertical className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
                                    </div>
                                )}
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-white/10 accent-primary cursor-pointer transition-all hover:scale-110 bg-white/5"
                                    checked={isSelected}
                                    onChange={() => onToggleSelection(item.categoryId!)}
                                    aria-label={t('selectItem', { name: item.categoryName || '' })}
                                />
                            </div>
                        </div>
                    </td>
                    <td className="py-3 px-2" onClick={(e) => !isEditing && onSelect(item.categoryId!, e)}>
                        <div className="flex items-center pl-4 relative">
                            <div className="absolute left-0 top-0 bottom-0 w-px bg-white/[0.06] ml-2" />
                            <div className="flex items-center w-full group/text pl-4">
                                {isCreditCardPayment && (
                                    <CreditCard className="w-4 h-4 text-primary/60 mr-2 shrink-0" />
                                )}
                                {isEditing ? (
                                    <div className="relative flex-1">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editingValue}
                                            onChange={(e) => onUpdateEditingValue(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') onUpdateName(item.categoryId!, editingValue);
                                                if (e.key === 'Escape') onCancelEditName();
                                            }}
                                            onBlur={() => onUpdateName(item.categoryId!, editingValue)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex-1 rounded-lg px-3 py-1 text-sm font-bold text-gray-200 outline-none w-full glass-input transition-all"
                                        />
                                    </div>
                                ) : (
                                    <span
                                        className={`text-sm font-medium cursor-text transition-colors ${isCreditCardPayment ? 'text-gray-200 font-semibold' : 'text-gray-300 hover:text-white'
                                            }`}
                                        onClick={(e) => {
                                            if (isSelected) {
                                                e.stopPropagation();
                                                onStartEditName(item.categoryId!, item.categoryName || '');
                                            }
                                        }}
                                    >
                                        {item.categoryName}
                                    </span>
                                )}
                            </div>
                        </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                        <div className="flex justify-end">
                            {assignEditingId === item.categoryId ? (
                                <input
                                    autoFocus
                                    type="text"
                                    inputMode="decimal"
                                    value={assignEditValue}
                                    onChange={(e) => onUpdateAssignEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') onUpdateAssigned(item.categoryId!, assignEditValue);
                                        if (e.key === 'Escape') onCancelEditAssigned();
                                        const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'Enter', 'Escape'];
                                        if (
                                            !allowedKeys.includes(e.key) &&
                                            !/^[\d.,-]$/.test(e.key) &&
                                            !e.metaKey && !e.ctrlKey
                                        ) {
                                            e.preventDefault();
                                        }
                                    }}
                                    onBlur={() => onUpdateAssigned(item.categoryId!, assignEditValue)}
                                    onClick={(e) => e.stopPropagation()}
                                    onFocus={(e) => e.target.select()}
                                    className="w-[120px] rounded px-2 py-1 text-sm font-bold text-gray-300 text-right outline-none bg-black/20 border border-primary/50 ring-1 ring-primary/50 box-border transition-all"
                                />
                            ) : (
                                <div
                                    data-testid={`category-assigned-${item.categoryId}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStartEditAssigned(item.categoryId!, item.assigned.toString());
                                    }}
                                    className={`text-sm font-bold px-2 py-1 rounded cursor-text w-[120px] text-right box-border tabular-nums transition-all duration-200 bg-black/20 border border-white/10 text-gray-300 hover:border-white/20 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50`}
                                >
                                    {formatCurrency(item.assigned)}
                                </div>
                            )}
                        </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                        <div className="flex justify-end">
                            <div className="min-w-[100px] px-2 py-1 text-right text-sm font-medium text-gray-400 tabular-nums">
                                {formatCurrency(item.activity)}
                            </div>
                        </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                        <div className="flex justify-end items-center" onClick={(e) => e.stopPropagation()}>
                            <AvailabilityBubble
                                amount={item.available}
                                isCreditCardPayment={isCreditCardPayment}
                                overspendingType={item.overspendingType}
                                formatCurrency={formatCurrency}
                                onClick={onMoveMoneyClick && item.categoryId ? () => onMoveMoneyClick(item.categoryId!) : undefined}
                                data-testid={`category-available-${item.categoryId}`}
                            />
                        </div>
                    </td>
                </>
            )}
        </SortableRow>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.item === nextProps.item &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.isEditing === nextProps.isEditing &&
        prevProps.editingValue === nextProps.editingValue &&
        prevProps.assignEditingId === nextProps.assignEditingId &&
        prevProps.assignEditValue === nextProps.assignEditValue
    );
});

BudgetItemRow.displayName = 'BudgetItemRow';
