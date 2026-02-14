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
                className="absolute inset-0 bg-black/50"
                onClick={handleClose}
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
                                    <h2 className="text-lg font-bold text-foreground">{t('reconcileTitle')}</h2>
                                    <p className="text-xs text-muted-foreground">{accountName}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
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
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('clearedBalanceLabel')}</span>
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
                                {t('verifyBalance')}
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
                                    onClick={handleClose}
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
                                onClick={handleClose}
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
    );
}
