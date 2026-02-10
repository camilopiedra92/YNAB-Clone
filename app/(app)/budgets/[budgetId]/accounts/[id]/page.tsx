'use client';

import { useMemo, useCallback, useState, use } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import TransactionModal from '@/components/TransactionModal';
import VirtualTransactionTable from '@/components/VirtualTransactionTable';
import ImportModal from '@/components/ImportModal';
import {
    Plus, Check, Search, Star, ChevronDown,
    Lock, Shield, AlertTriangle, X, Pencil,
    Link2, Upload, Undo2, Redo2
} from 'lucide-react';
import { useAccount, useAccounts } from '@/hooks/useAccounts';
import { useTransactions, type Transaction } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useToggleCleared, useReconcileAccount } from '@/hooks/useTransactionMutations';
import { useReconciliationInfo } from '@/hooks/useReconciliationInfo';


import { formatCurrency } from '@/lib/format';



const typeLabels: Record<string, string> = {
    checking: 'Checking',
    savings: 'Savings',
    credit: 'Credit Card',
    cash: 'Cash',
};

export default function AccountDetailPage({ params }: { params: Promise<{ id: string; budgetId: string }> }) {
    const resolvedParams = use(params);
    const accountId = parseInt(resolvedParams.id, 10);
    const budgetId = parseInt(resolvedParams.budgetId, 10);
    const queryClient = useQueryClient();
    const { data: account, isLoading: loadingAccount } = useAccount(budgetId, accountId);
    const { data: allAccountsData = [] } = useAccounts(budgetId);
    const { data: transactions = [], isLoading: loadingTransactions, isFetching: isFetchingTransactions } = useTransactions(budgetId, accountId);
    const { data: categories = [] } = useCategories(budgetId);

    const [searchQuery, setSearchQuery] = useState('');
    const [showScheduled, setShowScheduled] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    // Reconciliation state
    const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
    const [reconcileStep, setReconcileStep] = useState<'input' | 'confirm' | 'mismatch' | 'success'>('input');
    const [bankBalanceInput, setBankBalanceInput] = useState('');

    const [reconcileDifference, setReconcileDifference] = useState(0);
    const [reconciledCount, setReconciledCount] = useState(0);

    // Selected rows for batch operations
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [isImportOpen, setIsImportOpen] = useState(false);

    const loading = loadingAccount || loadingTransactions;

    const invalidateAll = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['transactions', budgetId] });
        queryClient.invalidateQueries({ queryKey: ['accounts', budgetId] });
        queryClient.invalidateQueries({ queryKey: ['budget', budgetId] });
    }, [queryClient, budgetId]);

    const toggleClearedMutation = useToggleCleared();
    const [reconcileQueryEnabled, setReconcileQueryEnabled] = useState(false);
    const reconciliationInfoQuery = useReconciliationInfo(budgetId, accountId, reconcileQueryEnabled);
    const reconcileAccountMutation = useReconcileAccount();
    const reconciliationInfo = reconciliationInfoQuery.data ?? null;

    // === Transaction handlers ===
    const handleToggleCleared = useCallback((transactionId: number, clearedStatus: string) => {
        toggleClearedMutation.mutate({ budgetId, transactionId, clearedStatus });
    }, [toggleClearedMutation, budgetId]);

    const handleEditTransaction = useCallback((transaction: Transaction) => {
        setEditingTransaction(transaction);
        setIsModalOpen(true);
    }, []);

    const handleNewTransaction = useCallback(() => {
        setEditingTransaction(null);
        setIsModalOpen(true);
    }, []);

    const handleModalClose = useCallback(() => {
        setIsModalOpen(false);
        setEditingTransaction(null);
    }, []);

    const handleTransactionSaved = useCallback(() => {
        invalidateAll();
    }, [invalidateAll]);

    // === Row selection ===
    const toggleRowSelection = useCallback((id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // Memoized derived data
    const currentTransactions = useMemo(() => transactions.filter(t => !t.isFuture), [transactions]);
    const futureTransactions = useMemo(() => transactions.filter(t => t.isFuture), [transactions]);

    const toggleSelectAll = useCallback(() => {
        if (selectedRows.size === currentTransactions.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(currentTransactions.map(t => t.id)));
        }
    }, [selectedRows.size, currentTransactions]);

    // === Reconciliation handlers ===
    const handleOpenReconcile = useCallback(async () => {
        setReconcileQueryEnabled(true);
        setBankBalanceInput('');
        setReconcileStep('input');
        setIsReconcileModalOpen(true);
    }, []);



    const handleReconcileSubmit = useCallback(async () => {
        if (!reconciliationInfo) return;

        const bankBalance = parseFloat(bankBalanceInput.replace(/[,$\s]/g, ''));
        if (isNaN(bankBalance)) return;

        const clearedBalance = reconciliationInfo.clearedBalance;
        const diff = bankBalance - clearedBalance;

        if (Math.abs(diff) > 0.01) {
            setReconcileDifference(diff);
            setReconcileStep('mismatch');
            return;
        }

        setReconcileStep('confirm');
    }, [reconciliationInfo, bankBalanceInput]);

    const handleConfirmReconcile = useCallback(async () => {
        const bankBalance = parseFloat(bankBalanceInput.replace(/[,$\s]/g, ''));

        reconcileAccountMutation.mutate(
            { budgetId, accountId, bankBalance },
            {
                onSuccess: (data) => {
                    if (data.success) {
                        setReconciledCount(data.reconciledCount);
                        setReconcileStep('success');
                    } else if (data.mismatch) {
                        setReconcileDifference(data.difference);
                        setReconcileStep('mismatch');
                    }
                },
            },
        );
    }, [budgetId, bankBalanceInput, accountId, reconcileAccountMutation]);

    const handleCloseReconcile = useCallback(() => {
        setIsReconcileModalOpen(false);
        setReconcileQueryEnabled(false);
        setReconcileStep('input');
        setBankBalanceInput('');

    }, []);

    // Filter by search query
    const filteredCurrent = useMemo(() => {
        if (!searchQuery.trim()) return currentTransactions;
        const q = searchQuery.toLowerCase();
        return currentTransactions.filter(t =>
            (t.payee || '').toLowerCase().includes(q) ||
            (t.memo || '').toLowerCase().includes(q) ||
            (t.categoryName || '').toLowerCase().includes(q)
        );
    }, [currentTransactions, searchQuery]);

    const filteredFuture = useMemo(() => {
        if (!searchQuery.trim()) return futureTransactions;
        const q = searchQuery.toLowerCase();
        return futureTransactions.filter(t =>
            (t.payee || '').toLowerCase().includes(q) ||
            (t.memo || '').toLowerCase().includes(q) ||
            (t.categoryName || '').toLowerCase().includes(q)
        );
    }, [futureTransactions, searchQuery]);



    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!account) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen">
                <p className="text-muted-foreground">Cuenta no encontrada</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            {/* ============ HEADER ============ */}
            <header className="px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 bg-background"
                style={{
                    boxShadow: '0 4px 12px 0 var(--neu-dark)',
                }}
            >
                <div className="flex items-center gap-5">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 data-testid="account-name" className="text-xl font-black text-foreground tracking-tight">{account.name}</h1>
                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">
                                <span className="inline-block w-2 h-2 rounded-full bg-primary-500 shadow-sm shadow-primary-500/50"></span>
                                {typeLabels[account.type] || account.type}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.1em]">
                                <Lock className="w-3 h-3 text-violet-400" />
                                Reconciled 7 days ago
                            </span>
                        </div>
                    </div>
                </div>

                {/* ============ BALANCE BAR (centered) ============ */}
                <div className="absolute left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-2xl shadow-neu-sm">
                            <div className="flex flex-col items-center">
                                    <span className="text-sm font-black text-foreground tracking-tight">{formatCurrency(account.clearedBalance, 2)}</span>
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.15em]">Cleared</span>
                                </div>
                            </div>
                            <span className="text-xs font-black text-muted-foreground/40">+</span>
                            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-2xl shadow-neu-sm">
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-black text-foreground tracking-tight">{formatCurrency(account.unclearedBalance, 2)}</span>
                                    <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.15em]">Uncleared</span>
                                </div>
                            </div>
                            <span className="text-xs font-black text-muted-foreground/40">=</span>
                            <div className="px-5 py-1.5 rounded-2xl shadow-neu-md relative group cursor-default overflow-hidden">
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex flex-col items-center relative z-10">
                                    <span data-testid="account-working-balance" className="text-lg font-black text-foreground tracking-tighter leading-none">{formatCurrency(account.balance, 2)}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-80">Working Balance</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button className="neu-btn p-2.5 rounded-xl text-muted-foreground transition-all active:scale-95">
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleOpenReconcile}
                        data-testid="reconcile-button"
                        className="neu-btn-primary px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-[0.97]"
                        style={{
                            backgroundColor: 'hsl(142 70% 45%)',
                        }}
                    >
                        Reconcile
                    </button>
                </div>
            </header>

            {/* ============ TOOLBAR ============ */}
            <div className="px-8 py-2.5 flex items-center justify-between bg-background"
                style={{
                    boxShadow: '0 2px 8px 0 var(--neu-dark)',
                }}
            >
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleNewTransaction}
                        data-testid="add-transaction-button"
                        className="neu-btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Transaction
                    </button>
                    <button className="neu-btn flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-muted-foreground transition-all">
                        <Link2 className="w-3.5 h-3.5" />
                        Link Account
                    </button>
                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="neu-btn flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-muted-foreground transition-all"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        File Import
                    </button>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                        <button className="flex items-center gap-2 hover:opacity-70 transition-opacity opacity-40">
                            <Undo2 className="w-4 h-4" />
                            Undo
                        </button>
                        <button className="flex items-center gap-2 hover:opacity-70 transition-opacity opacity-40">
                            <Redo2 className="w-4 h-4" />
                            Redo
                        </button>
                    </div>
                    <div className="w-px h-4 bg-border" />
                    <button className="neu-btn flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-muted-foreground transition-all">
                        View
                        <ChevronDown className="w-3 h-3" />
                    </button>
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`Search ${account.name}...`}
                            data-testid="transaction-search"
                            className="pl-10 pr-4 py-2 bg-background rounded-xl text-sm shadow-neu-inset-sm focus:outline-none focus:shadow-neu-inset transition-all w-56"
                        />
                    </div>
                </div>
            </div>

            {/* ============ TRANSACTION TABLE ============ */}
            <VirtualTransactionTable
                currentTransactions={filteredCurrent}
                futureTransactions={filteredFuture}
                selectedRows={selectedRows}
                showAccount={false}
                showScheduled={showScheduled}
                onToggleScheduled={() => setShowScheduled(!showScheduled)}
                onToggleSelectAll={toggleSelectAll}
                onToggleRowSelection={toggleRowSelection}
                onEditTransaction={handleEditTransaction}
                onToggleCleared={handleToggleCleared}
                isFetching={isFetchingTransactions}
                totalTransactions={transactions.length}
                accountId={accountId}
            />

            {/* ============ TRANSACTION MODAL ============ */}
            <TransactionModal
                budgetId={budgetId}
                isOpen={isModalOpen}
                onClose={handleModalClose}
                onSave={handleTransactionSaved}
                transaction={editingTransaction}
                accounts={allAccountsData}
                categories={categories}
                currentAccountId={accountId}
            />

            {/* ============ RECONCILIATION MODAL ============ */}
            {isReconcileModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={handleCloseReconcile}
                    />

                    <div className="relative w-full max-w-lg mx-4 animate-in fade-in zoom-in-95 duration-300">
                        <div className="neu-card rounded-2xl overflow-hidden"
                            style={{
                                boxShadow: '12px 12px 30px 0 var(--neu-dark-strong), -12px -12px 30px 0 var(--neu-light-strong)',
                            }}
                        >

                            {/* Header */}
                            <div className="p-6 pb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center shadow-neu-sm">
                                            <Shield className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-foreground">Reconcile Account</h2>
                                            <p className="text-xs text-muted-foreground">{account.name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCloseReconcile}
                                        className="neu-btn p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Step: Input bank balance */}
                            {reconcileStep === 'input' && (
                                <div className="p-6 space-y-5">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center p-3 rounded-xl shadow-neu-inset-sm">
                                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cleared Balance</span>
                                            <span className="text-base font-bold text-foreground">
                                                {reconciliationInfo ? formatCurrency(reconciliationInfo.clearedBalance) : '—'}
                                            </span>
                                        </div>

                                        {reconciliationInfo && reconciliationInfo.pendingClearedCount > 0 && (
                                            <div className="flex justify-between items-center p-3 rounded-xl shadow-neu-inset-sm">
                                                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Transactions to reconcile</span>
                                                <span className="text-base font-bold text-emerald-600">
                                                    {reconciliationInfo.pendingClearedCount}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                                            What is your bank&apos;s current balance?
                                        </label>
                                        <input
                                            type="text"
                                            value={bankBalanceInput}
                                            onChange={(e) => setBankBalanceInput(e.target.value)}
                                            placeholder="e.g. 49530948"
                                            className="w-full px-4 py-3 rounded-xl bg-background text-xl font-bold text-foreground
                                                     shadow-neu-inset focus:outline-none focus:shadow-[inset_4px_4px_8px_0_var(--neu-dark),inset_-4px_-4px_8px_0_var(--neu-light)]
                                                     transition-all placeholder:opacity-30 text-center"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && handleReconcileSubmit()}
                                        />
                                    </div>

                                    <button
                                        onClick={handleReconcileSubmit}
                                        disabled={!bankBalanceInput.trim()}
                                        className="w-full py-3 rounded-xl bg-violet-500 text-white font-semibold text-sm
                                                  shadow-neu-sm hover:shadow-neu-md transition-all
                                                  disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
                                    >
                                        Verify Balance
                                    </button>
                                </div>
                            )}

                            {/* Step: Balance mismatch */}
                            {reconcileStep === 'mismatch' && (
                                <div className="p-6 space-y-5">
                                    <div className="p-5 rounded-xl shadow-neu-inset">
                                        <div className="flex items-center gap-2 mb-3">
                                            <AlertTriangle className="w-5 h-5 text-rose-500" />
                                            <h3 className="text-sm font-bold text-rose-600">Balances don&apos;t match</h3>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">App cleared balance</span>
                                                <span className="font-bold text-foreground">
                                                    {reconciliationInfo ? formatCurrency(reconciliationInfo.clearedBalance) : '—'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Bank balance</span>
                                                <span className="font-bold text-foreground">
                                                    {formatCurrency(parseFloat(bankBalanceInput.replace(/[,$\s]/g, '')))}
                                                </span>
                                            </div>
                                            <div className="border-t border-border pt-2">
                                                <div className="flex justify-between">
                                                    <span className="font-bold text-rose-600 text-xs uppercase tracking-wider">Difference</span>
                                                    <span className="font-bold text-rose-600">{formatCurrency(reconcileDifference)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted-foreground text-center leading-relaxed">
                                        Make sure all bank transactions are marked as <span className="text-emerald-500 font-semibold">✓ Cleared</span> in the app.
                                    </p>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setReconcileStep('input')}
                                            className="neu-btn flex-1 py-3 rounded-xl text-muted-foreground font-semibold text-sm transition-all"
                                        >
                                            Retry
                                        </button>
                                        <button
                                            onClick={handleCloseReconcile}
                                            className="neu-btn flex-1 py-3 rounded-xl text-muted-foreground font-semibold text-sm transition-all"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step: Confirm reconciliation */}
                            {reconcileStep === 'confirm' && (
                                <div className="p-6 space-y-5">
                                    <div className="p-4 rounded-xl shadow-neu-inset-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Check className="w-5 h-5 text-emerald-500" />
                                            <h3 className="text-sm font-bold text-emerald-600">Balances match!</h3>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Bank balance ({formatCurrency(parseFloat(bankBalanceInput.replace(/[,$\s]/g, '')))}) matches the app cleared balance.
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-xl shadow-neu-inset-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Lock className="w-4 h-4 text-violet-500" />
                                            <span className="text-sm font-bold text-violet-600">What will happen?</span>
                                        </div>
                                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                                            <li>• All ✓ Cleared transactions → 🔒 Reconciled</li>
                                            <li>• Reconciled transactions cannot be modified</li>
                                            <li>• {reconciliationInfo?.pendingClearedCount || 0} transactions will be locked</li>
                                        </ul>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setReconcileStep('input')}
                                            className="neu-btn flex-1 py-3 rounded-xl text-muted-foreground font-semibold text-sm transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleConfirmReconcile}
                                            disabled={reconcileAccountMutation.isPending}
                                            className="flex-1 py-3 rounded-xl bg-violet-500 text-white font-semibold text-sm
                                                      shadow-neu-sm hover:shadow-neu-md transition-all
                                                      disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
                                        >
                                            {reconcileAccountMutation.isPending ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                            ) : (
                                                <>
                                                    <Lock className="w-4 h-4" />
                                                    Confirm Reconciliation
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step: Success */}
                            {reconcileStep === 'success' && (
                                <div className="p-6 space-y-5 text-center">
                                    <div className="w-16 h-16 mx-auto rounded-full bg-violet-500 flex items-center justify-center shadow-neu-lg">
                                        <Lock className="w-8 h-8 text-white" />
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-bold text-foreground mb-1">Account Reconciled!</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {reconciledCount} transaction{reconciledCount !== 1 ? 's' : ''} marked as reconciled.
                                        </p>
                                    </div>

                                    <div className="p-3 rounded-xl shadow-neu-inset-sm">
                                        <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-0.5">Reconciled Balance</p>
                                        <p className="text-xl font-bold text-foreground">
                                            {formatCurrency(parseFloat(bankBalanceInput.replace(/[,$\s]/g, '')))}
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleCloseReconcile}
                                        className="w-full py-3 rounded-xl bg-violet-500 text-white font-semibold text-sm
                                                  shadow-neu-sm hover:shadow-neu-md transition-all active:scale-[0.98]"
                                    >
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ImportModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
            />
        </div>
    );
}
