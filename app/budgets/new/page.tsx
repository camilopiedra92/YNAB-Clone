'use client';

import { useBudgetMutations } from '@/hooks/useBudgets';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Check, Wallet, Globe, Coins } from 'lucide-react';
import { CreateBudgetSchema } from '@/lib/schemas';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export default function NewBudgetPage() {
  const router = useRouter();
  const { createBudget } = useBudgetMutations();
  const [name, setName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('COP');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const t = useTranslations('budgetList');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = CreateBudgetSchema.safeParse({
      name,
      currencyCode,
      currencySymbol,
      currencyDecimals: 0,
    });

    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }

    try {
      const budget = await createBudget.mutateAsync(result.data);
      toast.success(t('toastSuccess'));
      router.push(`/budgets/${budget.id}/budget`);
    } catch (_error) {
      toast.error(t('toastError'));
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-200 transition-colors mb-8 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-semibold">{t('back')}</span>
        </button>

        <div className="mb-10 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-200">{t('newTitle')}</h1>
          <p className="text-gray-500 mt-2 italic text-lg">
            {t('newSubtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6 p-8 rounded-2xl glass-card">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 px-1">
                <Wallet className="w-4 h-4" /> {t('budgetNameLabel')}
              </label>
              <input
                id="name"
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('budgetNamePlaceholder')}
                className="w-full px-6 py-4 rounded-xl glass-input text-lg font-medium text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-primary/30 transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="currency" className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 px-1">
                  <Globe className="w-4 h-4" /> {t('currencyLabel')}
                </label>
                <input
                  id="currency"
                  type="text"
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                  placeholder={t('currencyIsoPlaceholder')}
                  className="w-full px-6 py-4 rounded-xl glass-input text-lg font-medium text-gray-200 text-center uppercase tracking-widest focus:outline-none focus:border-primary/30 transition-all"
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="symbol" className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 px-1">
                  <Coins className="w-4 h-4" /> {t('symbolLabel')}
                </label>
                <input
                  id="symbol"
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder={t('symbolPlaceholder')}
                  className="w-full px-6 py-4 rounded-xl glass-input text-lg font-medium text-gray-200 text-center focus:outline-none focus:border-primary/30 transition-all"
                  maxLength={5}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={createBudget.isPending}
            className="w-full py-5 rounded-xl bg-primary text-white font-bold text-xl hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {createBudget.isPending ? (
              <div className="w-6 h-6 border-3 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <span>{t('submitCreate')}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
