'use client';

import { useBudgetMutations } from '@/hooks/useBudgets';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Check, Wallet, Globe, Coins } from 'lucide-react';
import { CreateBudgetSchema } from '@/lib/schemas';
import { toast } from 'sonner';

export default function NewBudgetPage() {
  const router = useRouter();
  const { createBudget } = useBudgetMutations();
  const [name, setName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('COP');
  const [currencySymbol, setCurrencySymbol] = useState('$');

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
      toast.success('Presupuesto creado con éxito');
      router.push(`/budgets/${budget.id}/budget`);
    } catch (_error) {
      toast.error('Error al crear el presupuesto');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-semibold">Volver</span>
        </button>

        <div className="mb-10 text-center">
          <div className="w-20 h-20 rounded-[2rem] bg-primary/10 flex items-center justify-center mx-auto mb-6 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.1)]">
            <Wallet className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Nuevo Presupuesto</h1>
          <p className="text-muted-foreground mt-2 italic text-lg opacity-80">
            Define la base de tu libertad financiera.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6 p-8 rounded-[2.5rem] bg-background shadow-[12px_12px_24px_var(--neu-dark),-12px_-12px_24px_var(--neu-light)] border border-white/5">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 px-1">
                <Wallet className="w-4 h-4" /> Nombre del Presupuesto
              </label>
              <input
                id="name"
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Gastos Casa, Ahorros 2026..."
                className="w-full px-6 py-4 rounded-2xl bg-background shadow-[inset_4px_4px_8px_var(--neu-dark),inset_-4px_-4px_8px_var(--neu-light)] border-none focus:ring-4 focus:ring-primary/20 transition-all text-lg font-medium placeholder:text-muted-foreground/30"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="currency" className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 px-1">
                  <Globe className="w-4 h-4" /> Moneda (ISO)
                </label>
                <input
                  id="currency"
                  type="text"
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                  placeholder="COP, USD, EUR..."
                  className="w-full px-6 py-4 rounded-2xl bg-background shadow-[inset_4px_4px_8px_var(--neu-dark),inset_-4px_-4px_8px_var(--neu-light)] border-none focus:ring-4 focus:ring-primary/20 transition-all text-lg font-medium text-center uppercase tracking-widest"
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="symbol" className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 px-1">
                  <Coins className="w-4 h-4" /> Símbolo
                </label>
                <input
                  id="symbol"
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="$"
                  className="w-full px-6 py-4 rounded-2xl bg-background shadow-[inset_4px_4px_8px_var(--neu-dark),inset_-4px_-4px_8px_var(--neu-light)] border-none focus:ring-4 focus:ring-primary/20 transition-all text-lg font-medium text-center"
                  maxLength={5}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={createBudget.isPending}
            className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-bold text-xl shadow-[4px_4px_12px_rgba(var(--primary),0.3)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {createBudget.isPending ? (
              <div className="w-6 h-6 border-3 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <span>Crear Presupuesto</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
