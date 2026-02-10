'use client';

import { useParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { Wallet, ChevronRight, History, Minus, Equal, Landmark, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/format';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';

export default function Home() {
  const params = useParams();
  const budgetId = params.budgetId ? parseInt(params.budgetId as string) : undefined;

  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(budgetId);
  const { data: allTransactions = [], isLoading: transactionsLoading } = useTransactions(budgetId);

  const loading = accountsLoading || transactionsLoading;
  const recentTransactions = allTransactions.slice(0, 8);

  const totalCash = accounts.reduce((sum, acc) =>
    ['checking', 'savings', 'cash'].includes(acc.type) ? sum + acc.balance : sum, 0);
  const totalCredit = accounts.reduce((sum, acc) =>
    acc.type === 'credit' ? sum + acc.balance : sum, 0);
  const netWorth = totalCash + totalCredit;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      month: 'short',
      day: 'numeric',
    });
  };
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

  return (
    <AppLayout>
      <div className="page-container">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-meta mb-2">Resumen Financiero</p>
            <h1 className="text-4xl font-black text-foreground tracking-tight">
              Dashboard<span className="text-primary">.</span>
            </h1>
          </div>
          <div className="flex gap-3">
            <button className="neu-btn px-5 py-2.5 rounded-xl text-sm font-bold text-foreground">
              Filtrar por Mes
            </button>
            <button className="neu-btn-primary px-5 py-2.5 rounded-xl text-sm font-bold">
              Exportar
            </button>
          </div>
        </header>

        {/* Summary Stats with Formula Logic */}
        <div className="flex flex-col md:flex-row items-center gap-4 mb-12">
          {[
            { label: 'Patrimonio Neto', value: netWorth, icon: Wallet, color: 'bg-primary-500', trend: 'Balance Real' },
            { operator: 'equal' },
            { label: 'Efectivo Total', value: totalCash, icon: Landmark, color: 'bg-emerald-500', trend: 'Tus Activos' },
            { operator: 'minus' },
            { label: 'Deuda Total', value: Math.abs(totalCredit), icon: CreditCard, color: 'bg-rose-500', trend: 'Tus Pasivos' },
          ].map((stat, i) => (
            stat.operator ? (
              <div key={i} className="hidden md:flex items-center justify-center p-4 rounded-full shadow-neu-inset-sm text-muted-foreground/40">
                {stat.operator === 'minus' ? <Minus className="w-6 h-6" /> : <Equal className="w-6 h-6" />}
              </div>
            ) : (
              <div key={i} className="neu-card group relative overflow-hidden flex-1 w-full md:w-auto">
                <div className="flex items-center justify-between mb-5">
                  <div className={`p-3 rounded-2xl ${stat.color} text-white`}
                    style={{
                      boxShadow: '3px 3px 8px 0 var(--neu-dark), -3px -3px 8px 0 var(--neu-light)',
                    }}
                  >
                    {stat.icon && <stat.icon className="h-5 w-5" />}
                  </div>
                  <span className="text-[10px] font-black px-2 py-1 rounded-lg text-muted-foreground uppercase tracking-tighter shadow-neu-inset-sm">
                    {stat.trend}
                  </span>
                </div>
                <div>
                  <p className="text-meta mb-1 opacity-70">
                    {stat.label}
                  </p>
                  <p className={`text-2xl font-black ${stat.label === 'Patrimonio Neto' ? (stat.value >= 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-foreground'}`}>
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
            <div className="neu-card !p-0 overflow-hidden flex flex-col">
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg shadow-neu-inset-sm">
                    <History className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="text-lg font-black tracking-tight text-foreground">Actividad Reciente</h2>
                </div>
                <Link href="/transactions" className="text-xs font-black text-primary hover:underline uppercase tracking-widest flex items-center gap-1">
                  Ver Historial <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full">
                  <thead className="sticky top-0 bg-muted/30 z-10" style={{ boxShadow: '0 3px 8px 0 var(--neu-dark)' }}>
                    <tr className="border-b border-border uppercase tracking-widest text-muted-foreground text-[10px] font-bold">
                      <th className="text-left py-1 px-3 font-black border-b border-border">Fecha</th>
                      <th className="text-left py-1 px-3 font-black border-b border-border">Detalle</th>
                      <th className="text-left py-1 px-3 font-black border-b border-border">Categoría</th>
                      <th className="text-right py-1 px-3 font-black border-b border-border">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {recentTransactions.map((t) => (
                      <tr key={t.id} className="group hover:bg-muted/20 transition-colors border-b border-border/5">
                        <td className="py-1 px-3 text-xs font-bold text-muted-foreground whitespace-nowrap tabular-nums">
                          {formatDate(t.date)}
                        </td>
                        <td className="py-1 px-3">
                          <p className="text-xs font-semibold text-foreground leading-tight">{t.payee}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">{t.accountName}</p>
                        </td>
                        <td className="py-1 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black text-muted-foreground shadow-neu-inset-sm">
                            {t.categoryName || 'SIN CATEGORÍA'}
                          </span>
                        </td>
                        <td className={`py-1 px-3 text-right font-bold text-xs tabular-nums ${t.inflow > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {t.inflow > 0 ? `+${formatCurrency(t.inflow)}` : `-${formatCurrency(t.outflow)}`}
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
            <div className="neu-card">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-black tracking-tight text-foreground">Cuentas Principales</h2>
                <Link href="/accounts" className="neu-btn p-2 rounded-lg text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="space-y-4">
                {accounts.filter(a => !a.closed).slice(0, 5).map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 rounded-2xl shadow-neu-sm hover:shadow-neu-md transition-all duration-300 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-neu-inset-sm transition-transform group-hover:scale-110">
                        <Wallet className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm tracking-tight">{account.name}</p>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{account.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-sm ${account.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {formatCurrency(account.balance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-6 py-3 rounded-xl text-muted-foreground text-xs font-black uppercase tracking-[0.2em] shadow-neu-inset hover:text-primary transition-all">
                + Añadir Cuenta
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
