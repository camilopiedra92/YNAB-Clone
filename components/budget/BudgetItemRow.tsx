'use client';

import React from 'react';
import { GripVertical, CreditCard } from 'lucide-react';
import { SortableRow } from './SortableRow';
import { BudgetItem } from '@/hooks/useBudget';

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
    const isCreditCardPayment = !!item.linked_account_id;
    const isCreditCardGroup = item.group_name === 'Credit Card Payments';

    return (
        <SortableRow
            id={`item-${item.category_id}`}
            type="item"
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
                                    <div {...listeners} {...attributes} className="w-8 flex justify-center cursor-grab active:cursor-grabbing p-1 rounded-lg hover:bg-primary/5 transition-colors opacity-0 group-hover:opacity-100">
                                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30" />
                                    </div>
                                )}
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-border accent-primary cursor-pointer transition-all hover:scale-110"
                                    checked={isSelected}
                                    onChange={() => onToggleSelection(item.category_id!)}
                                />
                            </div>
                        </div>
                    </td>
                    <td className="py-0.5 px-2 border-b border-border/5" onClick={(e) => !isEditing && onSelect(item.category_id!, e)}>
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
                                                if (e.key === 'Enter') onUpdateName(item.category_id!, editingValue);
                                                if (e.key === 'Escape') onCancelEditName();
                                            }}
                                            onBlur={() => onUpdateName(item.category_id!, editingValue)}
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
                                                onStartEditName(item.category_id!, item.category_name || '');
                                            }
                                        }}
                                    >
                                        {item.category_name}
                                    </span>
                                )}
                            </div>
                        </div>
                    </td>
                    <td className="py-0.5 px-4 text-right border-b border-border/5">
                        <div className="flex justify-end">
                            {assignEditingId === item.category_id ? (
                                <input
                                    autoFocus
                                    type="text"
                                    inputMode="decimal"
                                    value={assignEditValue}
                                    onChange={(e) => onUpdateAssignEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') onUpdateAssigned(item.category_id!, assignEditValue);
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
                                    onBlur={() => onUpdateAssigned(item.category_id!, assignEditValue)}
                                    onClick={(e) => e.stopPropagation()}
                                    onFocus={(e) => e.target.select()}
                                    className="w-[120px] bg-background rounded-lg px-3 py-1 text-sm font-black text-foreground text-right outline-none shadow-neu-inset box-border"
                                />
                            ) : (
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onStartEditAssigned(item.category_id!, item.assigned.toString());
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
                        <div className="flex justify-end items-center gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
                            {isCreditCardPayment && item.available > 0 && (
                                <span className="text-[9px] font-black uppercase tracking-widest text-primary/50 whitespace-nowrap">
                                    Payment
                                </span>
                            )}
                            <button className={`min-w-[100px] py-1 px-3 rounded-lg text-sm font-bold text-right tabular-nums transition-[background-color,color,box-shadow,transform] duration-200 ${isCreditCardPayment
                                ? item.available > 0
                                    ? 'bg-primary/10 text-primary shadow-neu-inset-sm hover:bg-primary hover:text-white hover:shadow-neu-sm hover:scale-105 active:scale-95'
                                    : item.available < 0
                                        ? 'bg-amber-500/10 text-amber-600 shadow-neu-inset-sm hover:bg-amber-500 hover:text-white hover:shadow-neu-sm hover:scale-105 active:scale-95'
                                        : 'text-muted-foreground/60 shadow-neu-inset-sm grayscale hover:grayscale-0 transition-all'
                                : item.available > 0
                                    ? 'bg-emerald-500/10 text-emerald-600 shadow-neu-inset-sm hover:bg-emerald-500 hover:text-white hover:shadow-neu-sm hover:scale-105 active:scale-95'
                                    : item.available < 0
                                        ? item.overspending_type === 'credit'
                                            ? 'bg-amber-500/10 text-amber-600 shadow-neu-inset-sm hover:bg-amber-500 hover:text-white hover:shadow-neu-sm hover:scale-105 active:scale-95'
                                            : 'bg-rose-500/10 text-rose-600 shadow-neu-inset-sm hover:bg-rose-500 hover:text-white hover:shadow-neu-sm hover:scale-105 active:scale-95'
                                        : 'text-muted-foreground/60 shadow-neu-inset-sm grayscale hover:grayscale-0 transition-all'
                                }`}>
                                {formatCurrency(item.available)}
                            </button>
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
