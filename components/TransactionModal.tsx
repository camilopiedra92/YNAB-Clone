'use client';

import { useTransactionForm, type UseTransactionFormProps } from '@/hooks/useTransactionForm';
import Modal from './ui/Modal';
import DatePicker from './ui/DatePicker';
import CurrencyInput from './ui/CurrencyInput';
import Select from './ui/Select';
import { ArrowRightLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function TransactionModal(props: UseTransactionFormProps) {
    const {
        formData,
        setFormData,
        transactionType,
        amount,
        setAmount,
        transferAccountId,
        setTransferAccountId,
        loading,
        isEditingTransfer,
        payees,
        accountOptions,
        transferAccountOptions,
        categoryOptions,
        handleSubmit,
        handleDelete,
        setOutflowType,
        setInflowType,
        setTransferType,
    } = useTransactionForm(props);

    const { isOpen, onClose, transaction } = props;
    const t = useTranslations('transactions');
    const tc = useTranslations('common');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                isEditingTransfer
                    ? t('editTransfer')
                    : transaction?.id
                        ? t('editTransaction')
                        : t('newTransaction')
            }
            size="lg"
        >
            <form onSubmit={handleSubmit} data-testid="transaction-form" className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    {/* Account */}
                    <div className="md:col-span-2">
                        <label className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 block">
                            {transactionType === 'transfer' ? t('transferSourceAccount') : t('sourceAccount')}
                        </label>
                        <Select
                            value={formData.accountId}
                            onChange={(value) => setFormData({ ...formData, accountId: value as number })}
                            options={accountOptions}
                            disabled={!!transaction?.id}
                        />
                    </div>

                    {/* Date */}
                    <div>
                        <label className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 block">{t('date')}</label>
                        <DatePicker
                            value={formData.date}
                            onChange={(value) => setFormData({ ...formData, date: value })}
                        />
                    </div>

                    {/* Payee — hidden for transfers */}
                    {transactionType !== 'transfer' && (
                        <div>
                            <label className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 block">{t('payee')}</label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    data-testid="transaction-payee"
                                    value={formData.payee}
                                    onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                                    list="payees-list"
                                    className="w-full px-5 py-3.5 rounded-xl
                                             text-gray-200 font-bold text-sm
                                             glass-input
                                             focus:outline-none
                                             transition-all duration-300 placeholder:text-gray-600"
                                    placeholder={t('payeePlaceholder')}
                                />
                                <datalist id="payees-list">
                                    {payees.map((p) => (
                                        <option key={p} value={p} />
                                    ))}
                                </datalist>
                            </div>
                        </div>
                    )}

                    {/* Transfer destination account */}
                    {transactionType === 'transfer' && (
                        <div>
                            <label className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 block">
                                {t('destAccount')}
                            </label>
                            <Select
                                value={transferAccountId}
                                onChange={(value) => setTransferAccountId(value as number)}
                                options={transferAccountOptions}
                                placeholder={t('destAccountPlaceholder')}
                                disabled={isEditingTransfer}
                            />
                        </div>
                    )}

                    {/* Category — hidden for transfers */}
                    {transactionType !== 'transfer' && (
                        <div className="md:col-span-2">
                            <label className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 block">{t('budgetCategory')}</label>
                            <Select
                                value={formData.categoryId || ''}
                                onChange={(value) => setFormData({ ...formData, categoryId: value ? value as number : null })}
                                options={categoryOptions}
                                searchable
                                placeholder={t('categoryPlaceholder')}
                            />
                        </div>
                    )}

                    {/* Transaction Type */}
                    <div>
                        <label className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 block">{t('transactionType')}</label>
                        <div className="flex gap-2 p-1.5 rounded-xl bg-black/30 border border-white/5">
                            <button
                                type="button"
                                onClick={setOutflowType}
                                disabled={isEditingTransfer}
                                className={`flex-1 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${transactionType === 'outflow'
                                    ? 'bg-red-500 text-white'
                                    : 'text-gray-400 hover:text-white'
                                    } ${isEditingTransfer ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                {t('outflow')}
                            </button>
                            <button
                                type="button"
                                onClick={setInflowType}
                                disabled={isEditingTransfer}
                                className={`flex-1 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${transactionType === 'inflow'
                                    ? 'bg-green-500 text-white'
                                    : 'text-gray-400 hover:text-white'
                                    } ${isEditingTransfer ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                {t('inflow')}
                            </button>
                            <button
                                type="button"
                                onClick={setTransferType}
                                disabled={isEditingTransfer}
                                className={`flex-1 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 ${transactionType === 'transfer'
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-400 hover:text-white'
                                    } ${isEditingTransfer ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                                <ArrowRightLeft className="w-3 h-3" />
                                {t('transfer')}
                            </button>
                        </div>
                    </div>

                    {/* Amount */}
                    <div>
                        <label htmlFor="amount-input" className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 block">{t('totalAmount')}</label>
                        <CurrencyInput
                            id="amount-input"
                            value={amount}
                            onChange={setAmount}
                        />
                    </div>

                    {/* Memo */}
                    <div className="md:col-span-2">
                        <label htmlFor="memo-input" className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 block opacity-60">{t('memo')}</label>
                        <textarea
                            id="memo-input"
                            data-testid="transaction-memo"
                            value={formData.memo}
                            onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                            className="w-full px-5 py-4 rounded-xl
                                     text-gray-200 font-medium text-sm min-h-[100px]
                                     glass-input
                                     focus:outline-none
                                     transition-all duration-300 placeholder:text-gray-600 resize-none"
                            placeholder={t('memoPlaceholder')}
                        />
                    </div>
                </div>

                {/* Transfer info badge when editing a transfer */}
                {isEditingTransfer && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                            <ArrowRightLeft className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-200">{t('linkedTransfer')}</p>
                            <p className="text-[11px] font-bold text-blue-400">
                                {t('linkedTransferHint')}
                            </p>
                        </div>
                    </div>
                )}

                {/* Cleared / Reconciled Status */}
                {!isEditingTransfer && (
                    formData.cleared === 'Reconciled' ? (
                        <div className="group flex items-center justify-between p-5 rounded-xl transition-all duration-500 bg-violet-500/10 border border-violet-500/20">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-violet-500 text-white">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-200">{t('reconciled')}</p>
                                    <p className="text-[11px] font-bold text-violet-400">{t('reconciledHint')}</p>
                                </div>
                            </div>
                            <div className="w-14 h-8 rounded-full relative p-1 bg-violet-500 opacity-60 cursor-not-allowed">
                                <div className="w-6 h-6 bg-white rounded-full shadow-md transform translate-x-6" />
                            </div>
                        </div>
                    ) : (
                        <div className={`group flex items-center justify-between p-5 rounded-xl transition-all duration-500 ${formData.cleared === 'Cleared'
                            ? 'bg-green-500/10 border border-green-500/20'
                            : 'bg-white/[0.03] border border-white/5'
                            }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${formData.cleared === 'Cleared'
                                    ? 'bg-green-500 text-white'
                                    : 'text-gray-500 bg-white/[0.03] border border-white/5'
                                    }`}>
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-200">{t('markCleared')}</p>
                                    <p className="text-[11px] font-bold text-gray-500">{t('markClearedHint')}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, cleared: formData.cleared === 'Cleared' ? 'Uncleared' : 'Cleared' })}
                                className={`w-14 h-8 rounded-full relative transition-all duration-500 p-1 ${formData.cleared === 'Cleared' ? 'bg-green-500' : 'bg-white/20'
                                    }`}
                            >
                                <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-500 ${formData.cleared === 'Cleared' ? 'translate-x-6' : 'translate-x-0'
                                    }`} />
                            </button>
                        </div>
                    )
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                    {transaction?.id && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={loading}
                            data-testid="transaction-delete-button"
                            className="w-full sm:w-auto px-8 py-4 rounded-xl text-red-400 font-bold text-[10px] uppercase tracking-widest
                                     hover:bg-red-500/10 transition-all duration-300 disabled:opacity-50"
                        >
                            {isEditingTransfer ? t('deleteTransfer') : t('deletePermanently')}
                        </button>
                    )}
                    <div className="flex-1" />
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        data-testid="transaction-cancel-button"
                        className="w-full sm:w-auto px-8 py-4 rounded-xl text-gray-400
                                 font-bold text-[10px] uppercase tracking-widest hover:text-white hover:bg-white/[0.06]
                                 transition-all duration-300 disabled:opacity-50"
                    >
                        {tc('cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={loading || (transactionType === 'transfer' && !transferAccountId)}
                        data-testid="transaction-submit-button"
                        className="w-full sm:w-auto px-10 py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest
                                 bg-primary text-white hover:bg-primary/90
                                 transition-all duration-300
                                 disabled:opacity-50 active:scale-95"
                    >
                        {loading ? tc('syncing') : t('saveChanges')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
