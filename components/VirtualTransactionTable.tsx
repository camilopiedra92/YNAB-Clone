'use client';

import { useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, Circle, Lock, Clock, Search, ArrowRightLeft } from 'lucide-react';
import type { Transaction } from '@/hooks/useTransactions';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';

const ROW_HEIGHT = 33; // px per row — matches py-1 + content



const formatDate = (dateStr: string, locale: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

// ──────────────────────────────────────────
// Single Transaction Row (memoized)
// ──────────────────────────────────────────
const TransactionRow = memo(function TransactionRow({
    t,
    isSelected,
    showAccount,
    onEdit,
    onToggleCleared,
    onToggleSelect,

}: {
    t: Transaction;
    isSelected: boolean;
    showAccount: boolean;
    onEdit: (t: Transaction) => void;
    onToggleCleared: (id: number, cleared: string) => void;
    onToggleSelect: (id: number, e: React.MouseEvent) => void;
    accountId?: number;
}) {
    const tr = useTranslations('transactions');
    const { formatCurrency } = useFormatCurrency();
    const locale = useLocale();
    return (
        <tr
            data-testid={`transaction-row-${t.id}`}
            onClick={() => onEdit(t)}
            className={`group transition-all duration-100 cursor-pointer border-b border-border/10
                ${isSelected
                    ? 'bg-primary/5 dark:bg-primary/10 border-l-2 border-l-primary'
                    : 'hover:bg-muted/30 border-l-2 border-l-transparent'}`}
        >
            <td className="py-0.5 px-4 text-center">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => { }}
                    onClick={(e) => onToggleSelect(t.id, e)}
                    aria-label={tr('selectTransaction', { payee: t.payee })}
                    className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
                />
            </td>
            {showAccount && (
                <td className="py-0.5 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-sm font-medium text-muted-foreground shadow-neu-inset-sm whitespace-nowrap">
                        {t.accountName}
                    </span>
                </td>
            )}
            <td className="py-0.5 px-3 text-sm text-muted-foreground font-bold whitespace-nowrap tabular-nums">
                {formatDate(t.date, locale)}
            </td>
            <td className="py-0.5 px-3">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {t.payee}
                </span>
            </td>
            <td className="py-0.5 px-3 text-sm font-medium">
                {t.transferId
                    ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-blue-600 dark:text-blue-400 text-sm font-bold shadow-neu-inset-sm">
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        {showAccount
                            ? t.outflow > 0
                                ? `${t.accountName} → ${t.transferAccountName || ''}`
                                : `${t.transferAccountName || ''} → ${t.accountName}`
                            : t.outflow > 0
                                ? tr('transferTo', { account: t.transferAccountName || '' })
                                : tr('transferFrom', { account: t.transferAccountName || '' })
                        }
                    </span>
                    : (t.categoryName
                        ? <span className="text-muted-foreground">{t.categoryName}</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-amber-600 dark:text-amber-400 text-sm font-bold italic shadow-neu-inset-sm">{tr('uncategorized')}</span>
                    )
                }
            </td>
            <td className="py-0.5 px-3 text-sm text-muted-foreground/60 truncate max-w-[250px]">
                {t.memo || ''}
            </td>
            <td className="py-0.5 px-4 text-right text-sm font-bold tabular-nums">
                {t.outflow > 0 ? (
                    <span className="text-foreground">{formatCurrency(t.outflow, 2)}</span>
                ) : ''}
            </td>
            <td className="py-0.5 px-4 text-right text-sm font-bold tabular-nums">
                {t.inflow > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-emerald-600 dark:text-emerald-400 shadow-neu-inset-sm">{formatCurrency(t.inflow, 2)}</span>
                ) : ''}
            </td>
            <td className="py-0.5 px-3 text-center">
                <ClearedIcon t={t} onToggle={onToggleCleared} />
            </td>
        </tr>
    );
});

// ──────────────────────────────────────────
// Cleared Icon (memoized)
// ──────────────────────────────────────────
const ClearedIcon = memo(function ClearedIcon({
    t,
    onToggle,
}: {
    t: Transaction;
    onToggle: (id: number, cleared: string) => void;
}) {
    const tr = useTranslations('transactions');
    if (t.cleared === 'Reconciled') {
        return (
            <div className="p-1 rounded-lg cursor-default shadow-neu-inset-sm" title={tr('reconciledStatus')}>
                <Lock className="h-3.5 w-3.5 text-violet-500" aria-hidden="true" />
                <span className="sr-only">{tr('reconciledStatus')}</span>
            </div>
        );
    }
    if (t.cleared === 'Cleared') {
        return (
            <button
                onClick={(e) => { e.stopPropagation(); onToggle(t.id, t.cleared); }}
                className="p-1 rounded-lg transition-all text-emerald-500 shadow-neu-inset-sm hover:shadow-neu-sm"
                title={tr('clearedStatus')}
                aria-label={tr('markUncleared')}
                data-testid="transaction-cleared-toggle"
            >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
        );
    }
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onToggle(t.id, t.cleared); }}
            className="p-1 rounded-lg transition-all text-muted-foreground/30 hover:text-emerald-400 shadow-neu-inset-sm hover:shadow-neu-sm"
            title={tr('unclearedStatus')}
            aria-label={tr('markVerified')}
            data-testid="transaction-cleared-toggle"
        >
            <Circle className="h-3.5 w-3.5 fill-current opacity-20" aria-hidden="true" />
        </button>
    );
});

// ──────────────────────────────────────────
// Future Transaction Row (memoized)
// ──────────────────────────────────────────
const FutureTransactionRow = memo(function FutureTransactionRow({
    t,
    showAccount,
    onEdit,

}: {
    t: Transaction;
    showAccount: boolean;
    onEdit: (t: Transaction) => void;
    accountId?: number;
}) {
    const tr = useTranslations('transactions');
    const { formatCurrency } = useFormatCurrency();
    const locale = useLocale();
    return (
        <tr
            onClick={() => onEdit(t)}
            className="group hover:bg-amber-50/30 dark:hover:bg-amber-500/5 transition-all duration-150 cursor-pointer opacity-50 hover:opacity-75 border-b border-border/10"
        >
            <td className="py-0.5 px-4 text-center">
                <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
                    aria-label={tr('selectScheduled', { payee: t.payee })}
                    onClick={(e) => e.stopPropagation()}
                />
            </td>
            {showAccount && (
                <td className="py-0.5 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-sm font-medium text-muted-foreground shadow-neu-inset-sm">
                        {t.accountName}
                    </span>
                </td>
            )}
            <td className="py-0.5 px-3 text-sm text-amber-600 dark:text-amber-400 font-bold whitespace-nowrap tabular-nums">
                {formatDate(t.date, locale)}
            </td>
            <td className="py-0.5 px-3">
                <span className="text-sm font-medium text-foreground">{t.payee}</span>
            </td>
            <td className="py-0.5 px-3 text-sm text-muted-foreground font-medium">
                {t.transferId ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-blue-600 dark:text-blue-400 text-sm font-bold shadow-neu-inset-sm">
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        {showAccount
                            ? t.outflow > 0
                                ? `${t.accountName} → ${t.transferAccountName || ''}`
                                : `${t.transferAccountName || ''} → ${t.accountName}`
                            : t.outflow > 0
                                ? tr('transferTo', { account: t.transferAccountName || '' })
                                : tr('transferFrom', { account: t.transferAccountName || '' })
                        }
                    </span>
                ) : (t.categoryName || '')}
            </td>
            <td className="py-0.5 px-3 text-sm text-muted-foreground/60 truncate max-w-[200px]">
                {t.memo || ''}
            </td>
            <td className="py-0.5 px-4 text-right text-sm font-bold text-foreground tabular-nums">
                {t.outflow > 0 ? formatCurrency(t.outflow, 2) : ''}
            </td>
            <td className="py-0.5 px-4 text-right text-sm font-bold text-foreground tabular-nums">
                {t.inflow > 0 ? formatCurrency(t.inflow, 2) : ''}
            </td>
            <td className="py-0.5 px-3 text-center">
                <div className="w-5 h-5 rounded-lg flex items-center justify-center mx-auto shadow-neu-inset-sm">
                    <Clock className="w-3 h-3 text-amber-500" />
                </div>
            </td>
        </tr>
    );
});

// ──────────────────────────────────────────
// Main Virtualized Table
// ──────────────────────────────────────────
interface VirtualTransactionTableProps {
    currentTransactions: Transaction[];
    futureTransactions: Transaction[];
    selectedRows: Set<number>;
    showAccount: boolean;
    showScheduled: boolean;
    onToggleScheduled: () => void;
    onToggleSelectAll: () => void;
    onToggleRowSelection: (id: number, e: React.MouseEvent) => void;
    onEditTransaction: (t: Transaction) => void;
    onToggleCleared: (id: number, cleared: string) => void;
    isFetching?: boolean;
    totalTransactions: number;
    accountId?: number;
}

export default function VirtualTransactionTable({
    currentTransactions,
    futureTransactions,
    selectedRows,
    showAccount,
    showScheduled,
    onToggleScheduled,
    onToggleSelectAll,
    onToggleRowSelection,
    onEditTransaction,
    onToggleCleared,
    isFetching = false,
    totalTransactions,
    accountId,
}: VirtualTransactionTableProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const t = useTranslations('transactions');

    // Build a flat list for virtualization: [scheduled header? + scheduled rows?] + current rows
    type RowItem =
        | { type: 'scheduled-header' }
        | { type: 'future'; transaction: Transaction }
        | { type: 'current'; transaction: Transaction }
        | { type: 'empty' };

    const allRows: RowItem[] = [];

    if (futureTransactions.length > 0) {
        allRows.push({ type: 'scheduled-header' });
        if (showScheduled) {
            for (const ft of futureTransactions) {
                allRows.push({ type: 'future', transaction: ft });
            }
        }
    }

    for (const ct of currentTransactions) {
        allRows.push({ type: 'current', transaction: ct });
    }

    if (totalTransactions === 0) {
        allRows.push({ type: 'empty' });
    }

    // @tanstack/react-virtual's useVirtualizer is a valid custom hook;
    // the react-hooks linter flags it as incompatible because the library
    // isn't in the linter's known-hooks allowlist — safe to suppress.
    // eslint-disable-next-line react-hooks/incompatible-library
    const virtualizer = useVirtualizer({
        count: allRows.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: (index) => {
            const row = allRows[index];
            if (row.type === 'scheduled-header') return 36;
            if (row.type === 'empty') return 200;
            return ROW_HEIGHT;
        },
        overscan: 20,
    });

    const colSpan = showAccount ? 9 : 8;

    return (
        <div
            ref={scrollContainerRef}
            className={`flex-1 overflow-auto custom-scrollbar transition-opacity duration-200 ${isFetching ? 'opacity-50' : 'opacity-100'}`}
        >
            <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-background z-10"
                    style={{
                        boxShadow: '0 3px 8px 0 var(--neu-dark)',
                    }}
                >
                    <tr className="uppercase tracking-widest text-muted-foreground text-[10px] font-bold">
                        <th className="w-12 py-1 px-4 border-b border-border" scope="col">
                            <div className="flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={selectedRows.size === currentTransactions.length && currentTransactions.length > 0}
                                    onChange={onToggleSelectAll}
                                    aria-label={t('selectAll')}
                                    className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
                                />
                            </div>
                        </th>
                        {showAccount && (
                            <th className="py-1 px-3 text-left font-black border-b border-border w-28" scope="col">{t('account')}</th>
                        )}
                        <th className="py-1 px-3 text-left font-black border-b border-border w-28" scope="col">{t('columnDate')}</th>
                        <th className="py-1 px-3 text-left font-black border-b border-border w-44" scope="col">{t('columnPayee')}</th>
                        <th className="py-1 px-3 text-left font-black border-b border-border" scope="col">{t('columnCategory')}</th>
                        <th className="py-1 px-3 text-left font-black border-b border-border" scope="col">{t('columnMemo')}</th>
                        <th className="py-1 px-4 text-right font-black border-b border-border w-32" scope="col">{t('columnOutflow')}</th>
                        <th className="py-1 px-4 text-right font-black border-b border-border w-32" scope="col">{t('columnInflow')}</th>
                        <th className="w-12 py-1 px-3 text-center border-b border-border" scope="col">
                            <span className="sr-only">{t('status')}</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {/* Virtual spacer for rows above viewport */}
                    {virtualizer.getVirtualItems().length > 0 && (
                        <tr>
                            <td
                                colSpan={colSpan}
                                style={{ height: virtualizer.getVirtualItems()[0]?.start ?? 0, padding: 0, border: 'none' }}
                            />
                        </tr>
                    )}

                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const row = allRows[virtualRow.index];

                        if (row.type === 'scheduled-header') {
                            return (
                                <tr key="scheduled-header" data-index={virtualRow.index}>
                                    <td colSpan={colSpan} className="py-2 px-4 bg-amber-50/50 dark:bg-amber-500/5 border-b border-amber-200/30 dark:border-amber-500/10">
                                        <button
                                            onClick={onToggleScheduled}
                                            className="flex items-center gap-2 text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.15em] hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                                        >
                                            <div className="w-5 h-5 rounded-lg flex items-center justify-center shadow-neu-inset-sm">
                                                <Clock className="w-3 h-3" />
                                            </div>
                                            {t('scheduledTransactions', { count: futureTransactions.length })}
                                            <svg className={`w-3 h-3 transition-transform duration-200 ${showScheduled ? '' : '-rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            );
                        }

                        if (row.type === 'future') {
                            return (
                                <FutureTransactionRow
                                    key={`future-${row.transaction.id}`}
                                    t={row.transaction}
                                    showAccount={showAccount}
                                    onEdit={onEditTransaction}
                                    accountId={accountId}
                                />
                            );
                        }

                        if (row.type === 'current') {
                            return (
                                <TransactionRow
                                    key={`current-${row.transaction.id}`}
                                    t={row.transaction}
                                    isSelected={selectedRows.has(row.transaction.id)}
                                    showAccount={showAccount}
                                    onEdit={onEditTransaction}
                                    onToggleCleared={onToggleCleared}
                                    onToggleSelect={onToggleRowSelection}
                                    accountId={accountId}
                                />
                            );
                        }

                        // empty state
                        return (
                            <tr key="empty">
                                <td colSpan={colSpan} className="py-24 text-center">
                                    <div className="flex flex-col items-center gap-4 text-muted-foreground">
                                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-neu-inset">
                                            <Search className="h-7 w-7 opacity-30" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-foreground/60">{t('noTransactions')}</p>
                                            <p className="text-xs text-muted-foreground/50 mt-1">{t('noTransactionsHint')}</p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}

                    {/* Virtual spacer for rows below viewport */}
                    {virtualizer.getVirtualItems().length > 0 && (
                        <tr>
                            <td
                                colSpan={colSpan}
                                style={{
                                    height: virtualizer.getTotalSize() - (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1]?.end ?? 0),
                                    padding: 0,
                                    border: 'none',
                                }}
                            />
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
