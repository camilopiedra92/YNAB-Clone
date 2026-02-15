'use client';

import { useMemo, useCallback, useState, use } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import TransactionModal from '@/components/TransactionModal';
import VirtualTransactionTable from '@/components/VirtualTransactionTable';
import ImportModal from '@/components/ImportModal';
import ReconciliationModal from '@/components/ReconciliationModal';
import {
    Plus, Search, Star, ChevronDown,
    Lock, Pencil,
    Link2, Upload, Undo2, Redo2
} from 'lucide-react';
import { useAccount, useAccounts } from '@/hooks/useAccounts';
import { useTransactions, type Transaction } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useToggleCleared } from '@/hooks/useTransactionMutations';
import { useTranslations } from 'next-intl';


import { useFormatCurrency } from '@/hooks/useFormatCurrency';



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
    const { formatCurrency } = useFormatCurrency(budgetId);
    const t = useTranslations('accounts');
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
    const handleOpenReconcile = useCallback(() => {
        setIsReconcileModalOpen(true);
    }, []);

    const handleCloseReconcile = useCallback(() => {
        setIsReconcileModalOpen(false);
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
            <header className="px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 backdrop-blur-xl bg-white/[0.02] border-b border-white/5"
            >
                <div className="flex items-center gap-5">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 data-testid="account-name" className="text-xl font-bold text-gray-200 tracking-tight">{account.name}</h1>
                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">
                                <span className="inline-block w-2 h-2 rounded-full bg-primary-500 shadow-sm shadow-primary-500/50"></span>
                                {typeLabels[account.type] || account.type}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-600 uppercase tracking-[0.1em]">
                                <Lock className="w-3 h-3 text-violet-400" />
                                Reconciled 7 days ago
                            </span>
                        </div>
                    </div>
                </div>

                {/* ============ BALANCE BAR (centered) ============ */}
                <div className="absolute left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white/[0.03] border border-white/5">
                            <div className="flex flex-col items-center">
                                    <span className="text-sm font-bold text-gray-200 tracking-tight">{formatCurrency(account.clearedBalance, 2)}</span>
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.15em]">{t('clearedBalance')}</span>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-gray-600">+</span>
                            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white/[0.03] border border-white/5">
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-bold text-gray-200 tracking-tight">{formatCurrency(account.unclearedBalance, 2)}</span>
                                    <span className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.15em]">{t('unclearedBalance')}</span>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-gray-600">=</span>
                            <div className="px-5 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 relative group cursor-default overflow-hidden">
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex flex-col items-center relative z-10">
                                    <span data-testid="account-working-balance" className="text-lg font-bold text-gray-200 tracking-tighter leading-none">{formatCurrency(account.balance, 2)}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em]">{t('workingBalance')}</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button className="p-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all active:scale-95" aria-label="Editar cuenta">
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                        onClick={handleOpenReconcile}
                        data-testid="reconcile-button"
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-white uppercase tracking-wider transition-all active:scale-[0.97] bg-green-600 hover:bg-green-500"
                    >
                        {t('reconcileTitle')}
                    </button>
                </div>
            </header>

            {/* ============ TOOLBAR ============ */}
            <div className="px-8 py-2.5 flex items-center justify-between bg-white/[0.01] border-b border-white/5"
            >
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleNewTransaction}
                        data-testid="add-transaction-button"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 hover:bg-primary/90"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Transaction
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:bg-white/[0.06] transition-all">
                        <Link2 className="w-3.5 h-3.5" />
                        Link Account
                    </button>
                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:bg-white/[0.06] transition-all"
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
                    <div className="w-px h-4 bg-white/10" />
                    <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest text-gray-400 hover:bg-white/[0.06] transition-all">
                        View
                        <ChevronDown className="w-3 h-3" />
                    </button>
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`Search ${account.name}...`}
                            data-testid="transaction-search"
                            className="pl-10 pr-4 py-2 rounded-xl text-sm text-gray-200 glass-input focus:outline-none focus:border-primary/30 transition-all w-56"
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
            <ReconciliationModal
                isOpen={isReconcileModalOpen}
                onClose={handleCloseReconcile}
                budgetId={budgetId}
                accountId={accountId}
                accountName={account.name}
            />

            <ImportModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
            />
        </div>
    );
}
