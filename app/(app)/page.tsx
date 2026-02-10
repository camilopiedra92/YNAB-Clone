'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBudgets } from '@/hooks/useBudgets';

/**
 * Root App Page — Redirects to /budgets to select a budget.
 * In the future, this could redirect to the last used budget via localStorage.
 */
export default function RootAppPage() {
  const router = useRouter();
  const { data: budgets, isLoading } = useBudgets();

  useEffect(() => {
    if (isLoading) return;

    if (!budgets || budgets.length === 0) {
      router.replace('/budgets/new');
    } else {
      // For now, always go to budget list for selection
      // Or we could pick the first one: router.replace(`/budgets/${budgets[0].id}/dashboard`);
      router.replace('/budgets');
    }
  }, [budgets, isLoading, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse">Iniciando...</p>
      </div>
    </div>
  );
}
