'use client';

import React from 'react';
import { GripVertical, CreditCard } from 'lucide-react';
import { SortableRow } from './SortableRow';
import { BudgetItem } from '@/hooks/useBudgetTable';
import { AvailabilityBubble } from './AvailabilityBubble';

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
}: BudgetItemRowProps) => {
    const isCreditCardPayment = !!item.linkedAccountId;
    const isCreditCardGroup = item.groupName === 'Credit Card Payments';

    return (
        <SortableRow
            id={`item-${item.categoryId}`}
            type="item"
            data-testid={`category-row-${item.categoryId}`}
            className={`group transition-colors duration-200 cursor-pointer border-b border-border/5 ${isSelected
                ? 'bg-primary/[0.04] active:scale-[0.995]'
                : 'bg-background hover:bg-muted/5'
                }`}
        >
            {(listeners, attributes) => (
                <>
                    <td className="py-0.5 px-4 border-b border-border/5">
                        <div className="flex items-center justify-center">
                            <div className="flex items-center gap-2">
                                {isCreditCardGroup ? (
                                    <div className="w-8" />
                                ) : (
                                    <div {...listeners} {...attributes} className="w-8 flex justify-center cursor-grab active:cursor-grabbing p-1 rounded-lg hover:bg-primary/5 transition-colors opacity-0 group-hover:opacity-100" aria-label="Reordenar">
                                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30" aria-hidden="true" />
                                    </div>
                                )}
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-border accent-primary cursor-pointer transition-all hover:scale-110"
                                    checked={isSelected}
                                    onChange={() => onToggleSelection(item.categoryId!)}
                                    aria-label={`Seleccionar ${item.categoryName}`}
                                />
                            </div>
                        </div>
                    </td>
                    <td className="py-0.5 px-2 border-b border-border/5" onClick={(e) => !isEditing && onSelect(item.categoryId!, e)}>
                        <div className="flex items-center pl-4 relative">
                            <div className="absolute left-0 top-0 bottom-0 w-px bg-border/40 ml-2" />
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
                                            className="flex-1 bg-background rounded-lg px-3 py-1 text-sm font-bold text-foreground outline-none w-full shadow-neu-inset focus:shadow-[inset_3px_3px_6px_0_var(--neu-dark),inset_-3px_-3px_6px_0_var(--neu-light)] transition-all"
                                        />
                                    </div>
                                ) : (
                                    <span
                                        className={`text-sm font-medium cursor-text group-hover:text-foreground transition-colors ${isCreditCardPayment ? 'text-foreground/80 font-semibold' : 'text-foreground/70'
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
                    <td className="py-0.5 px-4 text-right border-b border-border/5">
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
                                        // Allow: digits, decimal separators, minus, navigation, control keys
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
                                    className="w-[120px] bg-background rounded-lg px-3 py-1 text-sm font-black text-foreground text-right outline-none shadow-neu-inset box-border"
                                />
                            ) : (
                                <div
                                    data-testid={`category-assigned-${item.categoryId}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStartEditAssigned(item.categoryId!, item.assigned.toString());
                                    }}
                                    className={`text-sm font-bold px-3 py-1 rounded-lg cursor-text w-[120px] text-right box-border tabular-nums transition-shadow duration-200 ${isSelected ? 'shadow-neu-inset-sm' : 'text-foreground/60 group-hover:shadow-neu-inset-sm'}`}
                                >
                                    {formatCurrency(item.assigned)}
                                </div>
                            )}
                        </div>
                    </td>
                    <td className="py-0.5 px-4 text-right border-b border-border/5">
                        <div className="flex justify-end">
                            <div className="min-w-[100px] px-2 py-1 text-right text-sm font-medium text-muted-foreground/50 tabular-nums">
                                {formatCurrency(item.activity)}
                            </div>
                        </div>
                    </td>
                    <td className="py-0.5 px-4 text-right border-b border-border/5">
                        <div className="flex justify-end items-center" onClick={(e) => e.stopPropagation()}>
                            <AvailabilityBubble
                                amount={item.available}
                                isCreditCardPayment={isCreditCardPayment}
                                overspendingType={item.overspendingType}
                                formatCurrency={formatCurrency}
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
