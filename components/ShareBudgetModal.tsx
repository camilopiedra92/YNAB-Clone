'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useShares, useShareMutations, type ShareInfo } from '@/hooks/useBudgets';
import { UserPlus, Trash2, Users, Crown, Loader2, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ShareBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgetId: number;
  budgetName: string;
  isOwner: boolean;
}

export default function ShareBudgetModal({
  isOpen,
  onClose,
  budgetId,
  budgetName,
  isOwner,
}: ShareBudgetModalProps) {
  const { data: shares, isLoading } = useShares(isOpen ? budgetId : undefined);
  const mutations = useShareMutations(budgetId);
  const t = useTranslations('share');

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setErrorMsg(null);

    mutations.addShare.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => {
          setEmail('');
          setRole('editor');
          setErrorMsg(null);
        },
        onError: (err) => {
          setErrorMsg(err.message || t('errorDefault'));
        },
      },
    );
  };

  const handleRoleChange = (share: ShareInfo, newRole: string) => {
    mutations.updateRole.mutate({ shareId: share.id, role: newRole });
  };

  const handleRemove = (share: ShareInfo) => {
    mutations.removeShare.mutate(share.id);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('title')} size="md">
      <div className="space-y-6">
        {/* Budget name */}
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-secondary/30">
          <Users className="w-5 h-5 text-primary flex-shrink-0" />
          <span className="font-bold text-foreground truncate">{budgetName}</span>
        </div>

        {/* Invite form — owner only */}
        {isOwner && (
          <form onSubmit={handleInvite} className="space-y-3">
            <label htmlFor="invite-email" className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {t('inviteLabel')}
            </label>
            <div className="flex gap-2">
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrorMsg(null); }}
                placeholder={t('emailPlaceholder')}
                className={`flex-1 px-4 py-3 rounded-xl bg-background text-foreground placeholder:text-muted-foreground/50 font-medium
                  shadow-[inset_3px_3px_6px_var(--neu-dark),inset_-3px_-3px_6px_var(--neu-light)]
                  focus:outline-none focus:ring-2 transition-all
                  ${errorMsg ? 'focus:ring-destructive/30 ring-2 ring-destructive/30' : 'focus:ring-primary/30'}`}
                required
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                className="px-3 py-3 rounded-xl bg-background text-foreground font-medium text-sm
                  shadow-[inset_3px_3px_6px_var(--neu-dark),inset_-3px_-3px_6px_var(--neu-light)]
                  focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={mutations.addShare.isPending || !email.trim()}
                aria-label={t('inviteButton')}
                className="neu-btn px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm
                  hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed
                  active:scale-95 transition-all flex items-center gap-2"
              >
                {mutations.addShare.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
              </button>
            </div>
            {/* Error message */}
            {errorMsg && (
              <div className="flex items-center gap-2 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </form>
        )}

        {/* Members list */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {t('membersLabel')}{shares ? ` (${shares.length + 1})` : ''}
          </label>

          {/* Owner row (always first) */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-background
            shadow-[4px_4px_8px_var(--neu-dark),-4px_-4px_8px_var(--neu-light)]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground truncate">{t('ownerYou')}</p>
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-600 uppercase tracking-wider flex-shrink-0">
              Owner
            </span>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          )}

          {/* Shared members */}
          {shares?.map((share) => (
            <div
              key={share.id}
              className="flex items-center justify-between p-4 rounded-2xl bg-background
                shadow-[4px_4px_8px_var(--neu-dark),-4px_-4px_8px_var(--neu-light)]
                group transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">
                    {share.userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">{share.userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{share.userEmail}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {isOwner ? (
                  <>
                    <select
                      value={share.role}
                      onChange={(e) => handleRoleChange(share, e.target.value)}
                      className="px-2 py-1.5 rounded-lg bg-secondary/50 text-sm font-semibold text-foreground
                        focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      onClick={() => handleRemove(share)}
                      disabled={mutations.removeShare.isPending}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10
                        transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      title={t('revokeAccess')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider
                    ${share.role === 'editor'
                      ? 'bg-primary/15 text-primary'
                      : 'bg-secondary text-secondary-foreground'
                    }`}>
                    {share.role}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {!isLoading && shares?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t('emptyTitle')}</p>
              <p className="text-sm mt-1">{t('emptySubtitle')}</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
