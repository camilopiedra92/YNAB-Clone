
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    PieChart,
    Wallet,
    CreditCard,
    ChevronDown,
    PlusCircle,
    Settings,
    LogOut,
    Landmark,
    Lock,
    Pencil,
    Upload
} from 'lucide-react';
import { useAccounts, type Account } from '@/hooks/useAccounts';
import { useBudgets, useBudget } from '@/hooks/useBudgets';
import AccountEditModal from './AccountEditModal';
import ImportModal from './ImportModal';
import ProfileModal from './ProfileModal';
import FeedbackButton from './FeedbackButton';
import { formatCurrency } from '@/lib/format';
import { setBudgetContext } from '@/lib/sentry-utils';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';



const groupIcons: Record<string, typeof Landmark> = {
    'Cash': Landmark,
    'Credit': CreditCard,
    'Closed': Lock,
};




export default function Sidebar() {
    const pathname = usePathname();
    const params = useParams();
    const router = useRouter();
    const budgetId = params.budgetId ? parseInt(params.budgetId as string) : undefined;

    const { data: session } = useSession();
    const { data: accounts = [] } = useAccounts(budgetId);
    const { data: budgets = [] } = useBudgets();
    const { data: activeBudget } = useBudget(budgetId);

    const [isBudgetSelectorOpen, setIsBudgetSelectorOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const t = useTranslations('sidebar');
    const tc = useTranslations('common');

    const userName = session?.user?.name ?? 'Usuario';
    const userInitial = userName.charAt(0).toUpperCase();

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'Cash': true,
        'Credit': true,
        'Closed': false
    });

    // ── Sentry Budget Context ────────────────────────────
    // Tag all Sentry events with the active budget ID for filtering
    useEffect(() => {
        if (budgetId && activeBudget) {
            setBudgetContext({
                budgetId,
                budgetName: activeBudget.name,
            });
        }
    }, [budgetId, activeBudget]);

    const groupedAccounts = useMemo(() => accounts.reduce((acc, account) => {
        if (account.closed) {
            if (!acc['Closed']) acc['Closed'] = [];
            acc['Closed'].push(account);
            return acc;
        }

        let group = 'Cash';

        if (account.type === 'credit') {
            group = 'Credit';
        } else if (['checking', 'savings', 'cash'].includes(account.type)) {
            group = 'Cash';
        }

        if (!acc[group]) acc[group] = [];
        acc[group].push(account);
        return acc;
    }, {} as Record<string, Account[]>), [accounts]);

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const groups = ['Cash', 'Credit', 'Closed'];

    const handleEditClick = (e: React.MouseEvent, account: Account) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingAccount(account);
    };

    return (
        <>
            <aside aria-label={t('mainNav')} className="w-[240px] min-w-[240px] xl:w-[280px] xl:min-w-[280px] flex flex-col z-50 hidden lg:flex glass-panel rounded-xl overflow-hidden"
            >
                {/* Budget Selection Header */}
                <div className="relative p-4 pb-3">
                    <div 
                        className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer group transition-all duration-200 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08]"
                        onClick={() => setIsBudgetSelectorOpen(!isBudgetSelectorOpen)}
                    >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-primary to-purple-600 shadow-lg shadow-primary/20">
                            <Wallet className="w-5 h-5 text-white" />
                        </div>
                        <div className="overflow-hidden flex-1 min-w-0">
                            <h1 className="text-[13px] font-semibold text-white/95 truncate tracking-tight leading-tight">
                                {activeBudget?.name || tc('loading')}
                            </h1>
                            <p className="text-[11px] text-white/40 truncate mt-0.5 group-hover:text-white/50 transition-colors">
                                {activeBudget?.currencyCode} ({activeBudget?.currencySymbol})
                            </p>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-white/30 group-hover:text-white/50 transition-all duration-300 ${isBudgetSelectorOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {/* Budget Dropdown */}
                    {isBudgetSelectorOpen && (
                        <div className="absolute left-4 right-4 top-[calc(100%-8px)] z-[60] py-2 rounded-xl glass-panel-strong animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-2 pb-2 mb-1 border-b border-white/5">
                                <p className="px-3 py-1 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">{t('selectBudget')}</p>
                                {budgets.filter(b => b.id !== budgetId).map(budget => (
                                    <button
                                        key={budget.id}
                                        onClick={() => {
                                            setIsBudgetSelectorOpen(false);
                                            router.push(`/budgets/${budget.id}/budget`);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.08] text-[13px] text-white/70 hover:text-white transition-all text-left group"
                                    >
                                        <Wallet className="w-4 h-4 text-white/20 group-hover:text-primary-300" />
                                        <span className="truncate">{budget.name}</span>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => {
                                    setIsBudgetSelectorOpen(false);
                                    router.push('/budgets/new');
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.08] text-[13px] text-primary-300 font-semibold transition-all text-left"
                            >
                                <PlusCircle className="w-4 h-4" />
                                <span>{t('newBudget')}</span>
                            </button>
                            <button
                                onClick={() => {
                                    setIsBudgetSelectorOpen(false);
                                    setIsImportOpen(true);
                                }}
                                data-testid="sidebar-import-data"
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.08] text-[13px] text-emerald-300/80 font-semibold transition-all text-left"
                            >
                                <Upload className="w-4 h-4" />
                                <span>{t('importData')}</span>
                            </button>
                            <button
                                onClick={() => {
                                    setIsBudgetSelectorOpen(false);
                                    router.push('/budgets');
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.08] text-[13px] text-white/40 hover:text-white transition-all text-left"
                            >
                                <Settings className="w-4 h-4" />
                                <span>{t('manageAll')}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Language Switcher */}
                <div className="px-4 pb-3">
                    <LanguageSwitcher />
                </div>

                {/* Divider */}
                <div className="mx-5 h-px bg-white/[0.06]" />

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3 space-y-1 relative">
                    {/* Main Navigation */}
                    <nav className="space-y-1 mb-6">
                        {[
                            { id: 'dashboard', name: t('dashboard'), href: `/budgets/${budgetId}/dashboard`, icon: LayoutDashboard },
                            { id: 'plan', name: t('plan'), href: `/budgets/${budgetId}/budget`, icon: LayoutDashboard },
                            { id: 'reflect', name: t('reflect'), href: `/budgets/${budgetId}/reports`, icon: PieChart },
                            { id: 'all-accounts', name: t('allAccounts'), href: `/budgets/${budgetId}/accounts`, icon: Wallet },
                        ].map((item) => {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.id}
                                    href={item.href}
                                    data-testid={`sidebar-nav-${item.id}`}
                                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                                        isActive
                                            ? 'bg-primary/10 border border-primary/20 text-white'
                                            : 'text-white/40 hover:bg-white/5 hover:text-white border border-transparent'
                                    }`}
                                >
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary"
                                            style={{ boxShadow: '0 0 8px rgba(19, 127, 236, 0.5)' }}
                                        />
                                    )}
                                    <Icon className={`w-[18px] h-[18px] transition-colors ${isActive
                                        ? 'text-primary text-glow-primary'
                                        : 'group-hover:text-primary'
                                    }`}
                                    />
                                    <span className={isActive ? 'font-semibold' : ''}>{item.name}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Accounts Sections */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-3 mb-4">
                            {tc('accounts') || 'Accounts'}
                        </h3>
                        {groups.map((group) => {
                            const accs = groupedAccounts[group] || [];
                            const isExpanded = expandedSections[group];
                            const groupTotal = accs.reduce((sum, a) => sum + a.balance, 0);
                            const GroupIcon = groupIcons[group];

                            return (
                                <div key={group}>
                                    {/* Section Header */}
                                    <button
                                        className="w-full flex items-center justify-between px-3 py-2 group/btn rounded-lg transition-all duration-200 hover:bg-white/[0.04]"
                                        onClick={() => toggleSection(group)}
                                        aria-expanded={isExpanded}
                                        aria-label={t('accountCount', { group, count: accs.length })}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                                                <ChevronDown className="w-3 h-3 text-white/30" />
                                            </div>
                                            <GroupIcon className="w-3.5 h-3.5 text-white/30" />
                                            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.1em] group-hover/btn:text-white/55 transition-colors">
                                                {t(`accountGroups.${group.toLowerCase() as 'cash' | 'credit' | 'closed'}`)}
                                            </span>
                                        </div>
                                        {accs.length > 0 && (
                                            <span className={`text-[11px] font-medium tabular-nums transition-colors ${groupTotal < 0
                                                ? 'text-red-400/80'
                                                : 'text-white/30 group-hover/btn:text-white/45'
                                                }`}>
                                                {formatCurrency(groupTotal)}
                                            </span>
                                        )}
                                    </button>

                                    {/* Account Items */}
                                    <div className={`overflow-hidden transition-all duration-300 ease-out ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                                        }`}>
                                        <div className="space-y-px pt-0.5 pb-1">
                                            {accs.length === 0 ? (
                                                <div className="px-9 py-2 text-[11px] text-white/25 italic">
                                                    {t('noAccounts')}
                                                </div>
                                            ) : (
                                                accs.map((account) => {
                                                    const isAccountActive = pathname === `/budgets/${budgetId}/accounts/${account.id}`;
                                                    return (
                                                        <Link
                                                            key={account.id}
                                                            href={`/budgets/${budgetId}/accounts/${account.id}`}
                                                            data-testid={`sidebar-account-${account.id}`}
                                                            className={`relative flex items-center justify-between pl-8 pr-3 py-[7px] rounded-lg text-[13px] group/item transition-all duration-200 ${isAccountActive
                                                                ? 'text-white bg-white/[0.06]'
                                                                : 'text-white/55 hover:text-white/80 hover:bg-white/[0.04]'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                                                                {/* Dot indicator / Edit pencil on hover */}
                                                                <div className="relative w-[14px] h-[14px] shrink-0 flex items-center justify-center">
                                                                    <div className={`w-[6px] h-[6px] rounded-full transition-all duration-150 group-hover/item:opacity-0 ${isAccountActive ? 'scale-110' : ''
                                                                        } ${account.balance < 0
                                                                            ? 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.4)]'
                                                                            : 'bg-green-400/70'
                                                                        }`}
                                                                    />
                                                                    <button
                                                                        onClick={(e) => handleEditClick(e, account)}
                                                                        className="absolute inset-0 flex items-center justify-center rounded-md opacity-0 group-hover/item:opacity-100 text-white/40 hover:text-white/80 transition-all duration-150"
                                                                        title={t('editAccount', { name: account.name })}
                                                                        aria-label={t('editAccount', { name: account.name })}
                                                                    >
                                                                        <Pencil className="w-3 h-3" aria-hidden="true" />
                                                                    </button>
                                                                </div>
                                                                <span className={`truncate ${isAccountActive ? 'font-medium' : ''}`}>
                                                                    {account.name}
                                                                </span>
                                                            </div>
                                                            <span className={`text-[11px] font-bold tabular-nums shrink-0 ml-2 transition-colors ${account.balance < 0
                                                                ? 'text-red-400 text-glow-red'
                                                                : isAccountActive
                                                                    ? 'text-green-400 text-glow-green'
                                                                    : 'text-green-400/70'
                                                                }`}>
                                                                {formatCurrency(account.balance)}
                                                            </span>
                                                        </Link>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom Section */}
                <div className="relative p-3 pt-2">
                    {/* Top divider */}
                    <div className="mx-2 h-px bg-white/[0.06] mb-2" />

                    <button className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 group mb-2 text-primary/80 hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20"
                        onClick={() => budgetId && setIsCreatingAccount(true)}
                        disabled={!budgetId}
                    >
                        <PlusCircle className="w-4 h-4" />
                        <span>{t('addAccount')}</span>
                    </button>

                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-1">
                            <div className="p-2 rounded-lg">
                                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-[11px] font-bold text-white shadow-glass-glow-primary"
                                    title={userName}
                                >
                                    {userInitial}
                                </span>
                            </div>
                            <span className="text-[12px] font-medium text-white/50 truncate max-w-[100px]">{userName}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                            <FeedbackButton />
                            <button
                                className="p-2 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-all duration-200"
                                title="Settings"
                                aria-label={t('settings')}
                                onClick={() => setIsProfileOpen(true)}
                                data-testid="sidebar-settings"
                            >
                                <Settings className="w-[15px] h-[15px]" aria-hidden="true" />
                            </button>
                            <button
                                className="p-2 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-all duration-200"
                                title={t('signOut')}
                                aria-label={t('signOut')}
                                onClick={() => signOut({ callbackUrl: '/auth/login' })}
                            >
                                <LogOut className="w-[15px] h-[15px]" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Account Edit Modal */}
            {editingAccount && (
                <AccountEditModal
                    account={editingAccount}
                    budgetId={editingAccount.budgetId}
                    onClose={() => setEditingAccount(null)}
                />
            )}

            {/* Account Create Modal */}
            {isCreatingAccount && budgetId && (
                <AccountEditModal
                    budgetId={budgetId}
                    onClose={() => setIsCreatingAccount(false)}
                />
            )}

            {/* Import Modal */}
            <ImportModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
            />

            {/* Profile Modal */}
            {isProfileOpen && (
                <ProfileModal onClose={() => setIsProfileOpen(false)} />
            )}
        </>
    );
}
