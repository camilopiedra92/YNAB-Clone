/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    PieChart,
    Wallet,
    CreditCard,
    ChevronDown,
    PlusCircle,
    Settings,
    LogOut,
    ChevronRight,
    Landmark,
    Lock,
    TrendingUp,
    Building2,
    Pencil
} from 'lucide-react';
import { useAccounts, type Account } from '@/hooks/useAccounts';
import AccountEditModal from './AccountEditModal';
import { formatCurrency } from '@/lib/format';

const mainNavigation = [
    { name: 'Plan', href: '/budget', icon: LayoutDashboard },
    { name: 'Reflect', href: '/reports', icon: PieChart },
    { name: 'All Accounts', href: '/accounts', icon: Wallet },
];

const groupIcons: Record<string, typeof Landmark> = {
    'Cash': Landmark,
    'Credit': CreditCard,
    'Closed': Lock,
};



const accountTypeIcons: Record<string, typeof Building2> = {
    'checking': Building2,
    'savings': TrendingUp,
    'cash': Wallet,
    'credit': CreditCard,
};

export default function Sidebar() {
    const pathname = usePathname();
    const { data: accounts = [] } = useAccounts();
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'Cash': true,
        'Credit': true,
        'Closed': false
    });

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
            <aside className="fixed left-0 top-0 bottom-0 w-[272px] flex flex-col z-50 hidden lg:flex"
                style={{
                    background: 'hsl(222 35% 18%)',
                }}
            >
                {/* Profile Header */}
                <div className="relative p-4 pb-3">
                    <div className="flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer group transition-all duration-300"
                        style={{
                            boxShadow: '3px 3px 8px 0 rgba(0,0,0,0.3), -3px -3px 8px 0 rgba(255,255,255,0.04)',
                        }}
                    >
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                            style={{
                                background: 'hsl(216 45% 58%)',
                                boxShadow: '3px 3px 8px 0 rgba(0,0,0,0.25), -3px -3px 8px 0 rgba(255,255,255,0.04)',
                            }}
                        >
                            <Wallet className="w-5 h-5 text-white" />
                        </div>
                        <div className="overflow-hidden flex-1 min-w-0">
                            <h1 className="text-[13px] font-semibold text-white/95 truncate tracking-tight leading-tight">
                                Compartido - COP
                            </h1>
                            <p className="text-[11px] text-white/40 truncate mt-0.5 group-hover:text-white/50 transition-colors">
                                camilopiedra92@gmail.com
                            </p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-white/30 group-hover:text-white/50 transition-colors shrink-0" />
                    </div>
                </div>

                {/* Divider */}
                <div className="mx-5 h-px bg-white/[0.06]" />

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3 space-y-1 relative">
                    {/* Main Navigation */}
                    <nav className="space-y-1.5 mb-6">
                        {mainNavigation.map((item) => {
                            const isActive = pathname === item.href || (item.href === '/accounts' && pathname.startsWith('/accounts'));
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    data-testid={`sidebar-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group`}
                                    style={isActive ? {
                                        boxShadow: 'inset 3px 3px 6px 0 rgba(0,0,0,0.35), inset -3px -3px 6px 0 rgba(255,255,255,0.04)',
                                        color: 'white',
                                    } : undefined}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.boxShadow = '3px 3px 8px 0 rgba(0,0,0,0.25), -3px -3px 8px 0 rgba(255,255,255,0.03)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.boxShadow = 'none';
                                        }
                                    }}
                                >
                                    {/* Active left indicator */}
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary-400"
                                            style={{
                                                boxShadow: '0 0 8px hsla(216, 33%, 60%, 0.4)',
                                            }}
                                        />
                                    )}
                                    <Icon className={`w-[18px] h-[18px] relative z-10 transition-colors ${isActive
                                        ? 'text-primary-300'
                                        : 'text-white/40 group-hover:text-white/60'
                                        }`}
                                    />
                                    <span className={`relative z-10 ${isActive ? 'font-semibold text-white' : 'text-white/50 group-hover:text-white/80'}`}>
                                        {item.name}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Accounts Sections */}
                    <div className="space-y-3">
                        {groups.map((group) => {
                            const accs = groupedAccounts[group] || [];
                            const isExpanded = expandedSections[group];
                            const groupTotal = accs.reduce((sum, a) => sum + a.balance, 0);
                            const GroupIcon = groupIcons[group];

                            return (
                                <div key={group}>
                                    {/* Section Header */}
                                    <button
                                        className="w-full flex items-center justify-between px-3 py-2 group/btn rounded-lg transition-all duration-200"
                                        onClick={() => toggleSection(group)}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.boxShadow = '2px 2px 6px 0 rgba(0,0,0,0.2), -2px -2px 6px 0 rgba(255,255,255,0.02)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                                                <ChevronDown className="w-3 h-3 text-white/30" />
                                            </div>
                                            <GroupIcon className="w-3.5 h-3.5 text-white/30" />
                                            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.1em] group-hover/btn:text-white/55 transition-colors">
                                                {group}
                                            </span>
                                        </div>
                                        {accs.length > 0 && (
                                            <span className={`text-[11px] font-medium tabular-nums transition-colors ${groupTotal < 0
                                                ? 'text-rose-400/80'
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
                                                    No accounts
                                                </div>
                                            ) : (
                                                accs.map((account) => {
                                                    const isAccountActive = pathname === `/accounts/${account.id}`;
                                                    const AccIcon = accountTypeIcons[account.type] || Building2;
                                                    return (
                                                        <Link
                                                            key={account.id}
                                                            href={`/accounts/${account.id}`}
                                                            data-testid={`sidebar-account-${account.id}`}
                                                            className={`relative flex items-center justify-between pl-8 pr-3 py-[7px] rounded-lg text-[13px] group/item transition-all duration-200 ${isAccountActive
                                                                ? 'text-white'
                                                                : 'text-white/55 hover:text-white/80'
                                                                }`}
                                                            style={isAccountActive ? {
                                                                boxShadow: 'inset 2px 2px 5px 0 rgba(0,0,0,0.3), inset -2px -2px 5px 0 rgba(255,255,255,0.03)',
                                                            } : undefined}
                                                            onMouseEnter={(e) => {
                                                                if (!isAccountActive) {
                                                                    e.currentTarget.style.boxShadow = '2px 2px 5px 0 rgba(0,0,0,0.2), -2px -2px 5px 0 rgba(255,255,255,0.02)';
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (!isAccountActive) {
                                                                    e.currentTarget.style.boxShadow = 'none';
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                                                                {/* Dot indicator / Edit pencil on hover */}
                                                                <div className="relative w-[14px] h-[14px] shrink-0 flex items-center justify-center">
                                                                    <div className={`w-[6px] h-[6px] rounded-full transition-all duration-150 group-hover/item:opacity-0 ${isAccountActive ? 'scale-110' : ''
                                                                        } ${account.balance < 0
                                                                            ? 'bg-rose-400 shadow-[0_0_6px_hsla(350,89%,60%,0.4)]'
                                                                            : 'bg-emerald-400/70'
                                                                        }`}
                                                                    />
                                                                    <button
                                                                        onClick={(e) => handleEditClick(e, account)}
                                                                        className="absolute inset-0 flex items-center justify-center rounded-md opacity-0 group-hover/item:opacity-100 text-white/40 hover:text-white/80 transition-all duration-150"
                                                                        title="Edit account"
                                                                    >
                                                                        <Pencil className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                                <span className={`truncate ${isAccountActive ? 'font-medium' : ''}`}>
                                                                    {account.name}
                                                                </span>
                                                            </div>
                                                            <span className={`text-[11px] font-medium tabular-nums shrink-0 ml-2 transition-colors ${account.balance < 0
                                                                ? 'text-rose-400/90'
                                                                : isAccountActive
                                                                    ? 'text-white/60'
                                                                    : 'text-white/30 group-hover/item:text-white/50'
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

                    <button className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 group mb-2 text-primary-300/80"
                        style={{
                            boxShadow: '3px 3px 8px 0 rgba(0,0,0,0.25), -3px -3px 8px 0 rgba(255,255,255,0.03)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '4px 4px 10px 0 rgba(0,0,0,0.3), -4px -4px 10px 0 rgba(255,255,255,0.04)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '3px 3px 8px 0 rgba(0,0,0,0.25), -3px -3px 8px 0 rgba(255,255,255,0.03)';
                        }}
                        onMouseDown={(e) => {
                            e.currentTarget.style.boxShadow = 'inset 2px 2px 5px 0 rgba(0,0,0,0.3), inset -2px -2px 5px 0 rgba(255,255,255,0.02)';
                        }}
                        onMouseUp={(e) => {
                            e.currentTarget.style.boxShadow = '4px 4px 10px 0 rgba(0,0,0,0.3), -4px -4px 10px 0 rgba(255,255,255,0.04)';
                        }}
                    >
                        <PlusCircle className="w-4 h-4 text-primary-300/80" />
                        <span>Add Account</span>
                    </button>

                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-1">
                            <button className="p-2 rounded-lg text-white/25 hover:text-white/50 transition-all duration-200">
                                <span className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-[11px] font-bold text-white"
                                    style={{
                                        boxShadow: '2px 2px 5px 0 rgba(0,0,0,0.3), -2px -2px 5px 0 rgba(255,255,255,0.03)',
                                    }}
                                >
                                    N
                                </span>
                            </button>
                        </div>
                        <div className="flex items-center gap-0.5">
                            <button className="p-2 rounded-lg text-white/25 hover:text-white/45 transition-all duration-200" title="Settings">
                                <Settings className="w-[15px] h-[15px]" />
                            </button>
                            <button className="p-2 rounded-lg text-white/25 hover:text-white/45 transition-all duration-200" title="Log out">
                                <LogOut className="w-[15px] h-[15px]" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Account Edit Modal */}
            {editingAccount && (
                <AccountEditModal
                    account={editingAccount}
                    onClose={() => setEditingAccount(null)}
                />
            )}
        </>
    );
}
