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
            <div className="rounded-xl p-4 bg-white/[0.03] border border-white/5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                            {direction === 'from' ? t('moveFrom') : t('moveTo')}
                        </p>
                        <p className="text-lg font-bold text-gray-200">{sourceCategory.name}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t('available')}</p>
                        <p className={`text-lg font-bold tabular-nums ${sourceCategory.available > 0 ? 'text-green-400 text-glow-green' : sourceCategory.available < 0 ? 'text-red-400 text-glow-red' : 'text-gray-500'}`}>
                            {formatCurrency(sourceCategory.available)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Direction Toggle + Amount */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => setDirection(d => d === 'from' ? 'to' : 'from')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] ${
                        direction === 'from'
                            ? 'text-red-400'
                            : 'text-green-400'
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
                        className="w-full rounded-xl px-4 py-3 text-lg font-bold text-gray-200 text-right outline-none glass-input tabular-nums transition-all"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-600">
                        $
                    </span>
                </div>
            </div>

            {/* Arrow + Target */}
            <div className="flex items-center gap-3 text-gray-600">
                <ArrowRight className="w-5 h-5 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-widest">
                    {direction === 'from' ? t('moveTo') : t('moveFrom')}
                </p>
            </div>

            {/* Target Category Selector */}
            <div className="space-y-2">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder={t('searchCategories')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium text-gray-200 outline-none glass-input
                                   placeholder:text-gray-600 transition-all"
                    />
                </div>

                {/* Category List */}
                <div className="max-h-[240px] overflow-y-auto custom-scrollbar rounded-xl bg-black/20 border border-white/5 p-1">
                    {Array.from(availableCategories.entries()).map(([groupName, cats]) => (
                        <div key={groupName}>
                            <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-600 sticky top-0 bg-black/40 backdrop-blur-sm rounded">
                                {groupName}
                            </div>
                            {cats.map(cat => (
                                <button
                                    key={cat.categoryId}
                                    onClick={() => setTargetCategoryId(cat.categoryId)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                                        targetCategoryId === cat.categoryId
                                            ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                                            : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                                    }`}
                                >
                                    <span className="font-medium truncate">{cat.categoryName}</span>
                                    <span className={`text-xs font-bold tabular-nums ml-2 shrink-0 ${
                                        cat.available > 0 ? 'text-green-400/70'
                                        : cat.available < 0 ? 'text-red-400/70'
                                        : 'text-gray-600'
                                    }`}>
                                        {formatCurrency(cat.available)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ))}
                    {availableCategories.size === 0 && (
                        <div className="flex items-center justify-center py-8 text-gray-600 text-sm">
                            {t('noCategories')}
                        </div>
                    )}
                </div>
            </div>

            {/* Summary + Submit */}
            <div className="space-y-3">
                {isValid && selectedTarget && (
                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-500 py-2">
                        <span className="font-bold text-gray-200">
                            {formatCurrency(milliAmount)}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="font-bold text-gray-200 truncate max-w-[140px]">
                            {direction === 'from' ? selectedTarget.categoryName : sourceCategory.name}
                        </span>
                    </div>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={!isValid}
                    className={`w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-200 ${
                        isValid
                            ? 'bg-primary text-white hover:bg-primary/90 active:scale-[0.98]'
                            : 'bg-white/5 text-gray-600 cursor-not-allowed'
                    }`}
                >
                    {t('submit')}
                </button>
            </div>
        </div>
    );
}
