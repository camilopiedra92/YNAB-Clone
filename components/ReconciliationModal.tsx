'use client';

import { useState, useCallback } from 'react';
import { Check, Lock, Shield, AlertTriangle, X } from 'lucide-react';
import { useReconciliationInfo } from '@/hooks/useReconciliationInfo';
import { useReconcileAccount } from '@/hooks/useTransactionMutations';
import { formatCurrency } from '@/lib/format';
import { useTranslations } from 'next-intl';

type ReconcileStep = 'input' | 'confirm' | 'mismatch' | 'success';

interface ReconciliationModalProps {
    isOpen: boolean;
    onClose: () => void;
    budgetId: number;
    accountId: number;
    accountName: string;
}

export default function ReconciliationModal({
    isOpen,
    onClose,
    budgetId,
    accountId,
    accountName,
}: ReconciliationModalProps) {
    const t = useTranslations('accounts');
    const [reconcileStep, setReconcileStep] = useState<ReconcileStep>('input');
    const [bankBalanceInput, setBankBalanceInput] = useState('');
    const [reconcileDifference, setReconcileDifference] = useState(0);
    const [reconciledCount, setReconciledCount] = useState(0);

    const reconciliationInfoQuery = useReconciliationInfo(budgetId, accountId, isOpen);
    const reconcileAccountMutation = useReconcileAccount();
    const reconciliationInfo = reconciliationInfoQuery.data ?? null;

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

    const handleClose = useCallback(() => {
        onClose();
        setReconcileStep('input');
        setBankBalanceInput('');
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            <div className="relative w-full max-w-lg mx-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="glass-panel-strong rounded-2xl overflow-hidden">

                    {/* Header */}
                    <div className="p-6 pb-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-200">{t('reconcileTitle')}</h2>
                                    <p className="text-xs text-gray-500">{accountName}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Step: Input bank balance */}
                    {reconcileStep === 'input' && (
                        <div className="p-6 space-y-5">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('clearedBalanceLabel')}</span>
                                    <span className="text-base font-bold text-gray-200">
                                        {reconciliationInfo ? formatCurrency(reconciliationInfo.clearedBalance) : '—'}
                                    </span>
                                </div>

                                {reconciliationInfo && reconciliationInfo.pendingClearedCount > 0 && (
                                    <div className="flex justify-between items-center p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                                        <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Transactions to reconcile</span>
                                        <span className="text-base font-bold text-green-400">
                                            {reconciliationInfo.pendingClearedCount}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                    What is your bank&apos;s current balance?
                                </label>
                                <input
                                    type="text"
                                    value={bankBalanceInput}
                                    onChange={(e) => setBankBalanceInput(e.target.value)}
                                    placeholder="e.g. 49530948"
                                    className="w-full px-4 py-3 rounded-xl text-xl font-bold text-gray-200
                                             glass-input focus:outline-none
                                             transition-all placeholder:text-gray-600 text-center"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleReconcileSubmit()}
                                />
                            </div>

                            <button
                                onClick={handleReconcileSubmit}
                                disabled={!bankBalanceInput.trim()}
                                className="w-full py-3 rounded-xl bg-violet-500 text-white font-semibold text-sm
                                          hover:bg-violet-400 transition-all
                                          disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
                            >
                                {t('verifyBalance')}
                            </button>
                        </div>
                    )}

                    {/* Step: Balance mismatch */}
                    {reconcileStep === 'mismatch' && (
                        <div className="p-6 space-y-5">
                            <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/20">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                    <h3 className="text-sm font-bold text-red-400">Balances don&apos;t match</h3>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">App cleared balance</span>
                                        <span className="font-bold text-gray-200">
                                            {reconciliationInfo ? formatCurrency(reconciliationInfo.clearedBalance) : '—'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Bank balance</span>
                                        <span className="font-bold text-gray-200">
                                            {formatCurrency(parseFloat(bankBalanceInput.replace(/[,$\s]/g, '')))}
                                        </span>
                                    </div>
                                    <div className="border-t border-white/10 pt-2">
                                        <div className="flex justify-between">
                                            <span className="font-bold text-red-400 text-xs uppercase tracking-wider">Difference</span>
                                            <span className="font-bold text-red-400">{formatCurrency(reconcileDifference)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-gray-500 text-center leading-relaxed">
                                Make sure all bank transactions are marked as <span className="text-green-400 font-semibold">✓ Cleared</span> in the app.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setReconcileStep('input')}
                                    className="flex-1 py-3 rounded-xl text-gray-400 font-semibold text-sm transition-all hover:bg-white/[0.06] border border-white/5"
                                >
                                    Retry
                                </button>
                                <button
                                    onClick={handleClose}
                                    className="flex-1 py-3 rounded-xl text-gray-400 font-semibold text-sm transition-all hover:bg-white/[0.06] border border-white/5"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: Confirm reconciliation */}
                    {reconcileStep === 'confirm' && (
                        <div className="p-6 space-y-5">
                            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <Check className="w-5 h-5 text-green-400" />
                                    <h3 className="text-sm font-bold text-green-400">Balances match!</h3>
                                </div>
                                <p className="text-xs text-gray-400">
                                    Bank balance ({formatCurrency(parseFloat(bankBalanceInput.replace(/[,$\s]/g, '')))}) matches the app cleared balance.
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                                <div className="flex items-center gap-2 mb-2">
                                    <Lock className="w-4 h-4 text-violet-400" />
                                    <span className="text-sm font-bold text-violet-400">What will happen?</span>
                                </div>
                                <ul className="space-y-1.5 text-xs text-gray-400">
                                    <li>• All ✓ Cleared transactions → 🔒 Reconciled</li>
                                    <li>• Reconciled transactions cannot be modified</li>
                                    <li>• {reconciliationInfo?.pendingClearedCount || 0} transactions will be locked</li>
                                </ul>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setReconcileStep('input')}
                                    className="flex-1 py-3 rounded-xl text-gray-400 font-semibold text-sm transition-all hover:bg-white/[0.06] border border-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmReconcile}
                                    disabled={reconcileAccountMutation.isPending}
                                    className="flex-1 py-3 rounded-xl bg-violet-500 text-white font-semibold text-sm
                                              hover:bg-violet-400 transition-all
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
                            <div className="w-16 h-16 mx-auto rounded-full bg-violet-500 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.4)]">
                                <Lock className="w-8 h-8 text-white" />
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-gray-200 mb-1">Account Reconciled!</h3>
                                <p className="text-sm text-gray-400">
                                    {reconciledCount} transaction{reconciledCount !== 1 ? 's' : ''} marked as reconciled.
                                </p>
                            </div>

                            <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                                <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-0.5">Reconciled Balance</p>
                                <p className="text-xl font-bold text-gray-200">
                                    {formatCurrency(parseFloat(bankBalanceInput.replace(/[,$\s]/g, '')))}
                                </p>
                            </div>

                            <button
                                onClick={handleClose}
                                className="w-full py-3 rounded-xl bg-violet-500 text-white font-semibold text-sm
                                          hover:bg-violet-400 transition-all active:scale-[0.98]"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
