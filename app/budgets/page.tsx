'use client';

import { useState } from 'react';
import { useBudgets } from '@/hooks/useBudgets';
import { useRouter } from 'next/navigation';
import { Plus, Wallet, ChevronRight, LogOut, Share2 } from 'lucide-react';
import { signOut } from 'next-auth/react';
import ShareBudgetModal from '@/components/ShareBudgetModal';
import { useTranslations } from 'next-intl';

export default function BudgetsPage() {
  const { data: budgets, isLoading } = useBudgets();
  const router = useRouter();
  const [shareModal, setShareModal] = useState<{ budgetId: number; budgetName: string } | null>(null);
  const t = useTranslations('budgetList');

  const handleSelectBudget = (id: number) => {
    router.push(`/budgets/${id}/budget`);
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/login' });
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return t('roleOwner');
      case 'editor': return t('roleEditor');
      default: return t('roleViewer');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground font-medium">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground mb-2">{t('title')}</h1>
            <p className="text-muted-foreground text-lg">{t('subtitle')}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-3 rounded-2xl bg-background shadow-[6px_6px_12px_var(--neu-dark),-6px_-6px_12px_var(--neu-light)] hover:shadow-[inset_4px_4px_8px_var(--neu-dark),inset_-4px_-4px_8px_var(--neu-light)] transition-all duration-300 group"
            title={t('logout')}
          >
            <LogOut className="w-6 h-6 text-muted-foreground group-hover:text-ynab-red transition-colors" />
          </button>
        </div>

        <div className="grid gap-6">
          {budgets?.map((budget) => (
            <div key={budget.id} className="relative group/card">
              <button
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
                        {getRoleLabel(budget.role)}
                      </span>
                      <span className="text-sm text-muted-foreground italic">
                        {budget.currencySymbol} {budget.currencyCode}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </button>

              {/* Share button — visible on hover for owners */}
              {budget.role === 'owner' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShareModal({ budgetId: budget.id, budgetName: budget.name });
                  }}
                  className="absolute top-4 right-16 p-2.5 rounded-xl bg-background
                    shadow-[3px_3px_6px_var(--neu-dark),-3px_-3px_6px_var(--neu-light)]
                    hover:shadow-[inset_2px_2px_4px_var(--neu-dark),inset_-2px_-2px_4px_var(--neu-light)]
                    opacity-0 group-hover/card:opacity-100 transition-all duration-200
                    text-muted-foreground hover:text-primary z-10"
                  title={t('shareBudget')}
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          <button
            onClick={() => router.push('/budgets/new')}
            className="w-full p-6 rounded-[2rem] border-2 border-dashed border-muted bg-transparent hover:bg-secondary/50 transition-all duration-300 flex items-center justify-center gap-3 group"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-lg font-semibold text-muted-foreground group-hover:text-primary transition-colors">
              {t('createBudget')}
            </span>
          </button>
        </div>
      </div>

      {/* Share Modal */}
      {shareModal && (
        <ShareBudgetModal
          isOpen={true}
          onClose={() => setShareModal(null)}
          budgetId={shareModal.budgetId}
          budgetName={shareModal.budgetName}
          isOwner={true}
        />
      )}
    </div>
  );
}
