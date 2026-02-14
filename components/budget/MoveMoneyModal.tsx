'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import { ArrowRight, Search, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { toMilliunits } from '@/lib/engine/primitives';
import { parseLocaleNumber } from '@/lib/engine';
import type { BudgetItemDTO } from '@/lib/dtos';
import { useTranslations } from 'next-intl';

// ─── Types ───────────────────────────────────────────────────────────

interface MoveMoneyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (params: {
        sourceCategoryId: number;
        targetCategoryId: number;
        month: string;
        amount: number; // milliunits
    }) => void;
    /** The category that triggered the modal (pre-selected) */
    sourceCategory: { id: number; name: string; available: number } | null;
    /** All budget items to pick from */
    budgetData: BudgetItemDTO[];
    currentMonth: string;
    formatCurrency: (amount: number) => string;
}

// ─── Component ───────────────────────────────────────────────────────

export function MoveMoneyModal({
    isOpen,
    onClose,
    onSubmit,
    sourceCategory,
    budgetData,
    currentMonth,
    formatCurrency,
}: MoveMoneyModalProps) {
    const t = useTranslations('moveMoney');

    if (!sourceCategory) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('title')} size="md">
            {/* Key changes when source changes, remounting the form and resetting all state */}
            <MoveMoneyForm
                key={sourceCategory.id}
                onClose={onClose}
                onSubmit={onSubmit}
                sourceCategory={sourceCategory}
                budgetData={budgetData}
                currentMonth={currentMonth}
                formatCurrency={formatCurrency}
            />
        </Modal>
    );
}

// ─── Inner Form (remounted via key to reset state) ───────────────────

interface MoveMoneyFormProps {
    onClose: () => void;
    onSubmit: MoveMoneyModalProps['onSubmit'];
    sourceCategory: { id: number; name: string; available: number };
    budgetData: BudgetItemDTO[];
    currentMonth: string;
    formatCurrency: (amount: number) => string;
}

function MoveMoneyForm({
    onClose,
    onSubmit,
    sourceCategory,
    budgetData,
    currentMonth,
    formatCurrency,
}: MoveMoneyFormProps) {
    const [amount, setAmount] = useState('');
    const [targetCategoryId, setTargetCategoryId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [direction, setDirection] = useState<'from' | 'to'>('from');
    const searchRef = useRef<HTMLInputElement>(null);
    const t = useTranslations('moveMoney');

    // Focus search on mount
    useEffect(() => {
        requestAnimationFrame(() => searchRef.current?.focus());
    }, []);

    // Available categories — exclude source, income, and groups
    const availableCategories = useMemo(() => {
        const categories = budgetData.filter(item =>
            item.categoryId !== null &&
            item.categoryId !== sourceCategory.id &&
            item.groupName !== 'Inflow'
        );

        // Group by category group
        const groups = new Map<string, typeof categories>();
        for (const cat of categories) {
            const group = groups.get(cat.groupName) ?? [];
            group.push(cat);
            groups.set(cat.groupName, group);
        }

        // Filter by search
        if (search.trim()) {
            const q = search.toLowerCase();
            const filtered = new Map<string, typeof categories>();
            for (const [groupName, cats] of groups) {
                const matching = cats.filter(c =>
                    c.categoryName?.toLowerCase().includes(q) ||
                    groupName.toLowerCase().includes(q)
                );
                if (matching.length > 0) filtered.set(groupName, matching);
            }
            return filtered;
        }

        return groups;
    }, [budgetData, sourceCategory.id, search]);

    const parsedAmount = parseLocaleNumber(amount);
    const milliAmount = parsedAmount > 0 ? toMilliunits(parsedAmount) : 0;
    const isValid = milliAmount > 0 && targetCategoryId !== null;

    const selectedTarget = budgetData.find(i => i.categoryId === targetCategoryId);

    const handleSubmit = useCallback(() => {
        if (!isValid || !targetCategoryId) return;

        // Direction: 'from' means source → target, 'to' means target → source
        const actualSource = direction === 'from' ? sourceCategory.id : targetCategoryId;
        const actualTarget = direction === 'from' ? targetCategoryId : sourceCategory.id;

        onSubmit({
            sourceCategoryId: actualSource,
            targetCategoryId: actualTarget,
            month: currentMonth,
            amount: milliAmount,
        });
        onClose();
    }, [isValid, sourceCategory.id, targetCategoryId, direction, milliAmount, currentMonth, onSubmit, onClose]);

    return (
        <div className="space-y-6">
            {/* Source Category Display */}
            <div className="neu-card-inset rounded-2xl p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">
                            {direction === 'from' ? t('moveFrom') : t('moveTo')}
                        </p>
                        <p className="text-lg font-bold text-foreground">{sourceCategory.name}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">{t('available')}</p>
                        <p className={`text-lg font-black tabular-nums ${sourceCategory.available > 0 ? 'text-emerald-500' : sourceCategory.available < 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                            {formatCurrency(sourceCategory.available)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Direction Toggle + Amount */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => setDirection(d => d === 'from' ? 'to' : 'from')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 neu-btn ${
                        direction === 'from'
                            ? 'text-rose-500'
                            : 'text-emerald-500'
                    }`}
                    title={direction === 'from' ? t('takingFrom') : t('addingTo')}
                >
                    {direction === 'from' ? (
                        <><ArrowUpRight className="w-4 h-4" /> {t('from')}</>
                    ) : (
                        <><ArrowDownRight className="w-4 h-4" /> {t('to')}</>
                    )}
                </button>

                <div className="flex-1 relative">
                    <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmit();
                            const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'Enter', 'Escape'];
                            if (
                                !allowedKeys.includes(e.key) &&
                                !/^[\d.,-]$/.test(e.key) &&
                                !e.metaKey && !e.ctrlKey
                            ) {
                                e.preventDefault();
                            }
                        }}
                        className="w-full bg-background rounded-xl px-4 py-3 text-lg font-black text-foreground text-right outline-none shadow-neu-inset tabular-nums
                                   focus:shadow-[inset_3px_3px_6px_0_var(--neu-dark),inset_-3px_-3px_6px_0_var(--neu-light)] transition-shadow"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground/40">
                        $
                    </span>
                </div>
            </div>

            {/* Arrow + Target */}
            <div className="flex items-center gap-3 text-muted-foreground/50">
                <ArrowRight className="w-5 h-5 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-widest">
                    {direction === 'from' ? t('moveTo') : t('moveFrom')}
                </p>
            </div>

            {/* Target Category Selector */}
            <div className="space-y-2">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder={t('searchCategories')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-background rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium text-foreground outline-none shadow-neu-inset
                                   placeholder:text-muted-foreground/30
                                   focus:shadow-[inset_3px_3px_6px_0_var(--neu-dark),inset_-3px_-3px_6px_0_var(--neu-light)] transition-shadow"
                    />
                </div>

                {/* Category List */}
                <div className="max-h-[240px] overflow-y-auto custom-scrollbar rounded-xl neu-card-inset p-1">
                    {Array.from(availableCategories.entries()).map(([groupName, cats]) => (
                        <div key={groupName}>
                            <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 sticky top-0 bg-background/80 backdrop-blur-sm">
                                {groupName}
                            </div>
                            {cats.map(cat => (
                                <button
                                    key={cat.categoryId}
                                    onClick={() => setTargetCategoryId(cat.categoryId)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                                        targetCategoryId === cat.categoryId
                                            ? 'bg-primary/10 text-primary font-bold shadow-neu-inset-sm'
                                            : 'text-foreground/70 hover:bg-muted/10 hover:text-foreground'
                                    }`}
                                >
                                    <span className="font-medium truncate">{cat.categoryName}</span>
                                    <span className={`text-xs font-bold tabular-nums ml-2 shrink-0 ${
                                        cat.available > 0 ? 'text-emerald-500/70'
                                        : cat.available < 0 ? 'text-rose-500/70'
                                        : 'text-muted-foreground/40'
                                    }`}>
                                        {formatCurrency(cat.available)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ))}
                    {availableCategories.size === 0 && (
                        <div className="flex items-center justify-center py-8 text-muted-foreground/40 text-sm">
                            {t('noCategories')}
                        </div>
                    )}
                </div>
            </div>

            {/* Summary + Submit */}
            <div className="space-y-3">
                {isValid && selectedTarget && (
                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground/60 py-2">
                        <span className="font-bold text-foreground/80">
                            {formatCurrency(milliAmount)}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="font-bold text-foreground/80 truncate max-w-[140px]">
                            {direction === 'from' ? selectedTarget.categoryName : sourceCategory.name}
                        </span>
                    </div>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={!isValid}
                    className={`w-full py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-200 ${
                        isValid
                            ? 'bg-primary text-primary-foreground shadow-neu-sm hover:shadow-neu-md active:shadow-neu-inset-sm active:scale-[0.98]'
                            : 'bg-muted/20 text-muted-foreground/30 cursor-not-allowed'
                    }`}
                >
                    {t('submit')}
                </button>
            </div>
        </div>
    );
}
