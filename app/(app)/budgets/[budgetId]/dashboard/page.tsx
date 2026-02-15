'use client';

import { useParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { Wallet, ChevronRight, History, Minus, Equal, Landmark, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useFormatDate } from '@/hooks/useFormatDate';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useTranslations } from 'next-intl';

export default function Home() {
  const params = useParams();
  const budgetId = params.budgetId ? parseInt(params.budgetId as string) : undefined;
  const t = useTranslations('dashboard');

  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(budgetId);
  const { data: allTransactions = [], isLoading: transactionsLoading } = useTransactions(budgetId);
  const { formatCurrency } = useFormatCurrency(budgetId);

  const loading = accountsLoading || transactionsLoading;
  const recentTransactions = allTransactions.slice(0, 8);

  const totalCash = accounts.reduce((sum, acc) =>
    ['checking', 'savings', 'cash'].includes(acc.type) ? sum + acc.balance : sum, 0);
  const totalCredit = accounts.reduce((sum, acc) =>
    acc.type === 'credit' ? sum + acc.balance : sum, 0);
  const netWorth = totalCash + totalCredit;

  const { formatDate } = useFormatDate();

  const fmtDate = (dateStr: string) => formatDate(dateStr, 'compact');
  if (loading) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center min-h-[80vh]">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-primary/10"></div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const stats = [
    { label: t('netWorth'), value: netWorth, icon: Wallet, color: 'bg-primary-500', trend: t('realBalance'), isNetWorth: true },
    { operator: 'equal' as const },
    { label: t('totalCash'), value: totalCash, icon: Landmark, color: 'bg-emerald-500', trend: t('yourAssets'), isNetWorth: false },
    { operator: 'minus' as const },
    { label: t('totalDebt'), value: Math.abs(totalCredit), icon: CreditCard, color: 'bg-rose-500', trend: t('yourLiabilities'), isNetWorth: false },
  ];

  return (
    <AppLayout>
      <div className="page-container">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-meta mb-2">{t('financialSummary')}</p>
            <h1 className="text-4xl font-bold text-gray-200 tracking-tight">
              {t('title')}<span className="text-primary">.</span>
            </h1>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-300 bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all">
              {t('filterByMonth')}
            </button>
            <button className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-all">
              {t('export')}
            </button>
          </div>
        </header>

        {/* Summary Stats with Formula Logic */}
        <div className="flex flex-col md:flex-row items-center gap-4 mb-12">
          {stats.map((stat, i) => (
            'operator' in stat ? (
              <div key={i} className="hidden md:flex items-center justify-center p-4 rounded-full bg-white/[0.03] border border-white/5 text-gray-600">
                {stat.operator === 'minus' ? <Minus className="w-6 h-6" /> : <Equal className="w-6 h-6" />}
              </div>
            ) : (
              <div key={i} className="glass-card group relative overflow-hidden flex-1 w-full md:w-auto">
                <div className="flex items-center justify-between mb-5">
                  <div className={`p-3 rounded-xl ${stat.color} text-white`}>
                    {stat.icon && <stat.icon className="h-5 w-5" />}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-lg text-gray-500 uppercase tracking-tighter bg-white/[0.03] border border-white/5">
                    {stat.trend}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    {stat.label}
                  </p>
                  <p className={`text-2xl font-bold ${stat.isNetWorth ? ((stat.value ?? 0) >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-200'}`}>
                    {formatCurrency(stat.value || 0)}
                  </p>
                </div>
              </div>
            )
          ))}
        </div>

        <div className="grid-responsive">
          {/* Main Content Area: Recent Activity */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            <div className="glass-card !p-0 overflow-hidden flex flex-col">
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5">
                    <History className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="text-lg font-bold tracking-tight text-gray-200">{t('recentActivity')}</h2>
                </div>
                <Link href="/transactions" className="text-xs font-bold text-primary hover:underline uppercase tracking-widest flex items-center gap-1">
                  {t('viewHistory')} <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full">
                  <thead className="sticky top-0 bg-black/20 backdrop-blur-sm z-10">
                    <tr className="border-b border-white/10 uppercase tracking-widest text-gray-500 text-[10px] font-bold">
                      <th className="text-left py-1 px-3 font-bold border-b border-white/5">{t('date')}</th>
                      <th className="text-left py-1 px-3 font-bold border-b border-white/5">{t('detail')}</th>
                      <th className="text-left py-1 px-3 font-bold border-b border-white/5">{t('category')}</th>
                      <th className="text-right py-1 px-3 font-bold border-b border-white/5">{t('amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {recentTransactions.map((txn) => (
                      <tr key={txn.id} className="group hover:bg-white/[0.03] transition-colors border-b border-white/[0.02]">
                        <td className="py-1 px-3 text-xs font-bold text-gray-500 whitespace-nowrap tabular-nums">
                          {fmtDate(txn.date)}
                        </td>
                        <td className="py-1 px-3">
                          <p className="text-xs font-semibold text-gray-200 leading-tight">{txn.payee}</p>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{txn.accountName}</p>
                        </td>
                        <td className="py-1 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-gray-500 bg-white/[0.03] border border-white/5">
                            {txn.categoryName || t('uncategorized')}
                          </span>
                        </td>
                        <td className={`py-1 px-3 text-right font-bold text-xs tabular-nums ${txn.inflow > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {txn.inflow > 0 ? `+${formatCurrency(txn.inflow)}` : `-${formatCurrency(txn.outflow)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar Area: Accounts Summary */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="glass-card">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold tracking-tight text-gray-200">{t('mainAccounts')}</h2>
                <Link href="/accounts" className="p-2 rounded-lg text-gray-500 hover:text-primary hover:bg-white/[0.06] transition-all">
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="space-y-4">
                {accounts.filter(a => !a.closed).slice(0, 5).map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all duration-300 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/5 transition-transform group-hover:scale-110">
                        <Wallet className="w-5 h-5 text-gray-500 group-hover:text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-200 text-sm tracking-tight">{account.name}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{account.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${account.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(account.balance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-6 py-3 rounded-xl text-gray-500 text-xs font-bold uppercase tracking-[0.2em] bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:text-primary transition-all">
                {t('addAccount')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
