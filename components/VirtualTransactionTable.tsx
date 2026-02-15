'use client';

import { useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, Circle, Lock, Clock, Search, ArrowRightLeft } from 'lucide-react';
import type { Transaction } from '@/hooks/useTransactions';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useFormatDate } from '@/hooks/useFormatDate';
import { useTranslations } from 'next-intl';

const ROW_HEIGHT = 33; // px per row — matches py-1 + content



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
    const { formatDate } = useFormatDate();
    return (
        <tr
            data-testid={`transaction-row-${t.id}`}
            onClick={() => onEdit(t)}
            className={`group transition-all duration-100 cursor-pointer border-b border-white/5
                ${isSelected
                    ? 'bg-primary/5 border-l-2 border-l-primary'
                    : 'hover:bg-white/[0.06] border-l-2 border-l-transparent'}`}
        >
            <td className="py-0.5 px-4 text-center">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => { }}
                    onClick={(e) => onToggleSelect(t.id, e)}
                    aria-label={tr('selectTransaction', { payee: t.payee })}
                    className="w-4 h-4 rounded border-white/10 accent-primary cursor-pointer bg-white/5"
                />
            </td>
            {showAccount && (
                <td className="py-0.5 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-sm font-medium text-gray-400 bg-white/[0.03] border border-white/5 whitespace-nowrap">
                        {t.accountName}
                    </span>
                </td>
            )}
            <td className="py-0.5 px-3 text-sm text-gray-500 font-bold whitespace-nowrap tabular-nums">
                {formatDate(t.date)}
            </td>
            <td className="py-0.5 px-3">
                <span className="text-sm font-medium text-gray-200 group-hover:text-primary transition-colors">
                    {t.payee}
                </span>
            </td>
            <td className="py-0.5 px-3 text-sm font-medium">
                {t.transferId
                    ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-blue-400 text-sm font-bold bg-blue-500/10 border border-blue-500/20">
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
                        ? <span className="text-gray-400">{t.categoryName}</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-amber-400 text-sm font-bold italic bg-amber-500/10 border border-amber-500/20">{tr('uncategorized')}</span>
                    )
                }
            </td>
            <td className="py-0.5 px-3 text-sm text-gray-600 truncate max-w-[250px]">
                {t.memo || ''}
            </td>
            <td className="py-0.5 px-4 text-right text-sm font-bold tabular-nums">
                {t.outflow > 0 ? (
                    <span className="text-gray-200">{formatCurrency(t.outflow, 2)}</span>
                ) : ''}
            </td>
            <td className="py-0.5 px-4 text-right text-sm font-bold tabular-nums">
                {t.inflow > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-green-400 bg-green-500/10 border border-green-500/20">{formatCurrency(t.inflow, 2)}</span>
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
            <div className="p-1 rounded-lg cursor-default bg-white/[0.03] border border-white/5" title={tr('reconciledStatus')}>
                <Lock className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                <span className="sr-only">{tr('reconciledStatus')}</span>
            </div>
        );
    }
    if (t.cleared === 'Cleared') {
        return (
            <button
                onClick={(e) => { e.stopPropagation(); onToggle(t.id, t.cleared); }}
                className="p-1 rounded-lg transition-all text-green-400 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20"
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
            className="p-1 rounded-lg transition-all text-gray-600 hover:text-green-400 bg-white/[0.03] border border-white/5 hover:bg-green-500/10 hover:border-green-500/20"
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
    const { formatDate } = useFormatDate();
    return (
        <tr
            onClick={() => onEdit(t)}
            className="group hover:bg-amber-500/5 transition-all duration-150 cursor-pointer opacity-50 hover:opacity-75 border-b border-white/5"
        >
            <td className="py-0.5 px-4 text-center">
                <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-white/10 accent-primary cursor-pointer bg-white/5"
                    aria-label={tr('selectScheduled', { payee: t.payee })}
                    onClick={(e) => e.stopPropagation()}
                />
            </td>
            {showAccount && (
                <td className="py-0.5 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-sm font-medium text-gray-400 bg-white/[0.03] border border-white/5">
                        {t.accountName}
                    </span>
                </td>
            )}
            <td className="py-0.5 px-3 text-sm text-amber-400 font-bold whitespace-nowrap tabular-nums">
                {formatDate(t.date)}
            </td>
            <td className="py-0.5 px-3">
                <span className="text-sm font-medium text-gray-200">{t.payee}</span>
            </td>
            <td className="py-0.5 px-3 text-sm text-gray-400 font-medium">
                {t.transferId ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-blue-400 text-sm font-bold bg-blue-500/10 border border-blue-500/20">
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
            <td className="py-0.5 px-3 text-sm text-gray-600 truncate max-w-[200px]">
                {t.memo || ''}
            </td>
            <td className="py-0.5 px-4 text-right text-sm font-bold text-gray-200 tabular-nums">
                {t.outflow > 0 ? formatCurrency(t.outflow, 2) : ''}
            </td>
            <td className="py-0.5 px-4 text-right text-sm font-bold text-gray-200 tabular-nums">
                {t.inflow > 0 ? formatCurrency(t.inflow, 2) : ''}
            </td>
            <td className="py-0.5 px-3 text-center">
                <div className="w-5 h-5 rounded-lg flex items-center justify-center mx-auto bg-amber-500/10 border border-amber-500/20">
                    <Clock className="w-3 h-3 text-amber-400" />
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
                <thead className="sticky top-0 z-10 backdrop-blur-xl bg-white/[0.03] border-b border-white/10">
                    <tr className="uppercase tracking-widest text-gray-500 text-[10px] font-bold">
                        <th className="w-12 py-1 px-4 border-b border-white/10" scope="col">
                            <div className="flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={selectedRows.size === currentTransactions.length && currentTransactions.length > 0}
                                    onChange={onToggleSelectAll}
                                    aria-label={t('selectAll')}
                                    className="w-4 h-4 rounded border-white/10 accent-primary cursor-pointer bg-white/5"
                                />
                            </div>
                        </th>
                        {showAccount && (
                            <th className="py-1 px-3 text-left font-bold border-b border-white/10 w-28" scope="col">{t('account')}</th>
                        )}
                        <th className="py-1 px-3 text-left font-bold border-b border-white/10 w-28" scope="col">{t('columnDate')}</th>
                        <th className="py-1 px-3 text-left font-bold border-b border-white/10 w-44" scope="col">{t('columnPayee')}</th>
                        <th className="py-1 px-3 text-left font-bold border-b border-white/10" scope="col">{t('columnCategory')}</th>
                        <th className="py-1 px-3 text-left font-bold border-b border-white/10" scope="col">{t('columnMemo')}</th>
                        <th className="py-1 px-4 text-right font-bold border-b border-white/10 w-32" scope="col">{t('columnOutflow')}</th>
                        <th className="py-1 px-4 text-right font-bold border-b border-white/10 w-32" scope="col">{t('columnInflow')}</th>
                        <th className="w-12 py-1 px-3 text-center border-b border-white/10" scope="col">
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
                                    <td colSpan={colSpan} className="py-2 px-4 bg-amber-500/5 border-b border-amber-500/10">
                                        <button
                                            onClick={onToggleScheduled}
                                            className="flex items-center gap-2 text-[10px] font-bold text-amber-400 uppercase tracking-[0.15em] hover:text-amber-300 transition-colors"
                                        >
                                            <div className="w-5 h-5 rounded-lg flex items-center justify-center bg-amber-500/10 border border-amber-500/20">
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
                                    <div className="flex flex-col items-center gap-4 text-gray-400">
                                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center glass-card">
                                            <Search className="h-7 w-7 opacity-30" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-300">{t('noTransactions')}</p>
                                            <p className="text-xs text-gray-500 mt-1">{t('noTransactionsHint')}</p>
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
