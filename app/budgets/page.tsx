'use client';

import { useBudgets } from '@/hooks/useBudgets';
import { useRouter } from 'next/navigation';
import { Plus, Wallet, ChevronRight, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

export default function BudgetsPage() {
  const { data: budgets, isLoading } = useBudgets();
  const router = useRouter();

  const handleSelectBudget = (id: number) => {
    router.push(`/budgets/${id}/budget`);
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/login' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-medium">Cargando presupuestos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-2">Mis Presupuestos</h1>
            <p className="text-muted-foreground text-lg">Selecciona un presupuesto para empezar a organizar.</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-3 rounded-2xl bg-background shadow-[6px_6px_12px_var(--neu-dark),-6px_-6px_12px_var(--neu-light)] hover:shadow-[inset_4px_4px_8px_var(--neu-dark),inset_-4px_-4px_8px_var(--neu-light)] transition-all duration-300 group"
            title="Cerrar sesión"
          >
            <LogOut className="w-6 h-6 text-muted-foreground group-hover:text-ynab-red transition-colors" />
          </button>
        </div>

        <div className="grid gap-6">
          {budgets?.map((budget) => (
            <button
              key={budget.id}
              onClick={() => handleSelectBudget(budget.id)}
              className="w-full text-left p-6 rounded-[2rem] bg-background shadow-[8px_8px_16px_var(--neu-dark),-8px_-8px_16px_var(--neu-light)] hover:shadow-[inset_4px_4px_8px_var(--neu-dark),inset_-4px_-4px_8px_var(--neu-light)] transition-all duration-300 group flex items-center justify-between"
            >
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1)]">
                  <Wallet className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                    {budget.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground uppercase tracking-wider">
                      {budget.role === 'owner' ? 'Propietario' : 'Editor'}
                    </span>
                    <span className="text-sm text-muted-foreground italic">
                      {budget.currencySymbol} {budget.currencyCode}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </button>
          ))}

          <button
            onClick={() => router.push('/budgets/new')}
            className="w-full p-6 rounded-[2rem] border-2 border-dashed border-muted bg-transparent hover:bg-secondary/50 transition-all duration-300 flex items-center justify-center gap-3 group"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-lg font-semibold text-muted-foreground group-hover:text-primary transition-colors">
              Crear Nuevo Presupuesto
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
