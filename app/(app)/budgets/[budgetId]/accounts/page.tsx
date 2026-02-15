'use client';

import { useMemo, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import TransactionModal from '@/components/TransactionModal';
import VirtualTransactionTable from '@/components/VirtualTransactionTable';
import ImportModal from '@/components/ImportModal';
import { Plus, Search, ChevronDown, Link2, Upload, Undo2, Redo2, Wallet } from 'lucide-react';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions, type Transaction } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useToggleCleared } from '@/hooks/useTransactionMutations';

import { useFormatCurrency } from '@/hooks/useFormatCurrency';

export default function AllAccountsPage() {
    const params = useParams();
    const budgetId = params.budgetId ? parseInt(params.budgetId as string) : undefined;
    const queryClient = useQueryClient();
    const { formatCurrency } = useFormatCurrency(budgetId);
    const { data: accounts = [], isLoading: loadingAccounts } = useAccounts(budgetId);
    const { data: transactions = [], isLoading: loadingTransactions, isFetching } = useTransactions(budgetId);
    const { data: categories = [] } = useCategories(budgetId);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [showScheduled, setShowScheduled] = useState(true);
    const [isImportOpen, setIsImportOpen] = useState(false);

    const loading = loadingAccounts || loadingTransactions;

    const toggleClearedMutation = useToggleCleared();

    const invalidateAll = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['transactions', budgetId] });
        queryClient.invalidateQueries({ queryKey: ['accounts', budgetId] });
        queryClient.invalidateQueries({ queryKey: ['budget', budgetId] });
    }, [queryClient, budgetId]);

    const handleToggleCleared = useCallback((transactionId: number, clearedStatus: string) => {
        toggleClearedMutation.mutate({ budgetId: budgetId!, transactionId, clearedStatus });
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

    // Memoized derived data
    const totalBalance = useMemo(() => accounts.reduce((sum, a) => sum + a.balance, 0), [accounts]);
    const totalCleared = useMemo(() => accounts.reduce((sum, a) => sum + a.clearedBalance, 0), [accounts]);
    const totalUncleared = useMemo(() => accounts.reduce((sum, a) => sum + a.unclearedBalance, 0), [accounts]);

    const currentTransactions = useMemo(() => transactions.filter(t => !t.isFuture), [transactions]);
    const futureTransactions = useMemo(() => transactions.filter(t => t.isFuture), [transactions]);

    const filteredCurrent = useMemo(() => {
        if (!searchQuery) return currentTransactions;
        const q = searchQuery.toLowerCase();
        return currentTransactions.filter(t =>
            t.payee?.toLowerCase().includes(q) ||
            t.memo?.toLowerCase().includes(q) ||
            t.categoryName?.toLowerCase().includes(q) ||
            t.accountName?.toLowerCase().includes(q) ||
            formatCurrency(t.inflow).toLowerCase().includes(q) ||
            formatCurrency(t.outflow).toLowerCase().includes(q)
        );
    }, [currentTransactions, searchQuery, formatCurrency]);

    const filteredFuture = useMemo(() => {
        if (!searchQuery) return futureTransactions;
        const q = searchQuery.toLowerCase();
        return futureTransactions.filter(t =>
            t.payee?.toLowerCase().includes(q) ||
            t.memo?.toLowerCase().includes(q) ||
            t.categoryName?.toLowerCase().includes(q) ||
            t.accountName?.toLowerCase().includes(q) ||
            formatCurrency(t.inflow).toLowerCase().includes(q) ||
            formatCurrency(t.outflow).toLowerCase().includes(q)
        );
    }, [futureTransactions, searchQuery, formatCurrency]);

    const toggleSelectAll = useCallback(() => {
        if (selectedRows.size === currentTransactions.length && currentTransactions.length > 0) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(currentTransactions.map(t => t.id)));
        }
    }, [selectedRows.size, currentTransactions]);

    const toggleRowSelection = useCallback((id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);



    if (loading) {
        return (
            <AppLayout>
                <div className="flex-1 flex items-center justify-center h-screen">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="flex flex-col h-screen overflow-hidden">
                {/* ============ HEADER ============ */}
                <header className="px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 backdrop-blur-xl bg-white/[0.02] border-b border-white/5"
                >
                    <div className="flex items-center gap-5">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-xl font-bold text-gray-200 tracking-tight">All Accounts</h1>
                                <Wallet className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">
                                    <span className="inline-block w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/50"></span>
                                    {accounts.length} accounts
                                </span>
                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.1em]">
                                    {transactions.length} transactions
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ============ BALANCE BAR (centered) ============ */}
                    <div className="absolute left-1/2 -translate-x-1/2">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white/[0.03] border border-white/5">
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-bold text-gray-200 tracking-tight">{formatCurrency(totalCleared, 2)}</span>
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.15em]">Cleared</span>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-gray-600">+</span>
                            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white/[0.03] border border-white/5">
                                <div className="flex flex-col items-center">
                                    <span className="text-sm font-bold text-gray-200 tracking-tight">{formatCurrency(totalUncleared, 2)}</span>
                                    <span className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.15em]">Uncleared</span>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-gray-600">=</span>
                            <div className="px-5 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 relative group cursor-default overflow-hidden">
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex flex-col items-center relative z-10">
                                    <span className="text-lg font-bold text-gray-200 tracking-tighter leading-none">{formatCurrency(totalBalance, 2)}</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em]">Total Balance</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {/* Intentionally empty right side */}
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
                                placeholder="Search all accounts..."
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
                    showAccount={true}
                    showScheduled={showScheduled}
                    onToggleScheduled={() => setShowScheduled(!showScheduled)}
                    onToggleSelectAll={toggleSelectAll}
                    onToggleRowSelection={toggleRowSelection}
                    onEditTransaction={handleEditTransaction}
                    onToggleCleared={handleToggleCleared}
                    isFetching={isFetching}
                    totalTransactions={transactions.length}
                />
            </div>

            <TransactionModal
                budgetId={budgetId!}
                isOpen={isModalOpen}
                onClose={handleModalClose}
                onSave={handleTransactionSaved}
                transaction={editingTransaction}
                accounts={accounts}
                categories={categories}
            />

            <ImportModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
            />
        </AppLayout>
    );
}
