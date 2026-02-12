'use client';

import { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, FileText } from 'lucide-react';
import { type Account, useUpdateAccount, useCreateAccount } from '@/hooks/useAccounts';

interface AccountEditModalProps {
    account?: Account;
    budgetId: number;
    onClose: () => void;
}

export default function AccountEditModal({ account, budgetId, onClose }: AccountEditModalProps) {
    const isEditing = !!account;
    const [name, setName] = useState(account?.name || '');
    const [note, setNote] = useState(account?.note || '');
    const [type, setType] = useState<'checking' | 'savings' | 'cash' | 'credit' | 'tracking'>('checking');
    const [balance, setBalance] = useState('');
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    
    const updateAccount = useUpdateAccount(budgetId);
    const createAccount = useCreateAccount(budgetId);
    
    const nameInputRef = useRef<HTMLInputElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        nameInputRef.current?.focus();
        if (isEditing) {
            nameInputRef.current?.select();
        }
    }, [isEditing]);

    // Close on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSave = () => {
        if (!name.trim()) return;

        if (isEditing && account) {
            updateAccount.mutate(
                { id: account.id, name: name.trim(), note: note.trim() },
                { onSuccess: () => onClose() }
            );
        } else {
            createAccount.mutate(
                { 
                    name: name.trim(), 
                    type, 
                    balance: parseFloat(balance) || 0 
                },
                { onSuccess: () => onClose() }
            );
        }
    };

    const handleCloseAccount = () => {
        if (!account) return;
        updateAccount.mutate(
            { id: account.id, closed: true },
            { onSuccess: () => onClose() }
        );
    };

    const handleReopenAccount = () => {
        if (!account) return;
        updateAccount.mutate(
            { id: account.id, closed: false },
            { onSuccess: () => onClose() }
        );
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) {
            onClose();
        }
    };

    const isClosed = account ? !!account.closed : false;
    const isPending = updateAccount.isPending || createAccount.isPending;

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            onClick={handleOverlayClick}
            style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }}
        >
            <div
                className="relative w-[420px] max-w-[90vw] rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                style={{
                    background: 'hsl(222 35% 18%)',
                    boxShadow: '10px 10px 30px 0 rgba(0,0,0,0.5), -10px -10px 30px 0 rgba(255,255,255,0.03)',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4"
                    style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                >
                    <h2 className="text-[15px] font-semibold text-white/90 tracking-tight">
                        {isEditing ? 'Edit Account' : 'Add Account'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-white/30 hover:text-white/60 transition-all duration-200"
                        style={{
                            boxShadow: '2px 2px 5px 0 rgba(0,0,0,0.3), -2px -2px 5px 0 rgba(255,255,255,0.02)',
                        }}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                    {/* Account Name */}
                    <div className="space-y-2">
                        <label htmlFor="account-name" className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em]">
                            Account Name
                        </label>
                        <input
                            id="account-name"
                            ref={nameInputRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                            className="w-full px-3.5 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-white/20 outline-none transition-all duration-200"
                            style={{
                                background: 'hsl(222 35% 18%)',
                                boxShadow: 'inset 3px 3px 6px 0 rgba(0,0,0,0.35), inset -3px -3px 6px 0 rgba(255,255,255,0.03)',
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.boxShadow = 'inset 4px 4px 8px 0 rgba(0,0,0,0.4), inset -4px -4px 8px 0 rgba(255,255,255,0.04)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.boxShadow = 'inset 3px 3px 6px 0 rgba(0,0,0,0.35), inset -3px -3px 6px 0 rgba(255,255,255,0.03)';
                            }}
                            placeholder="Account name..."
                        />
                    </div>

                    {!isEditing && (
                        <>
                            {/* Account Type */}
                            <div className="space-y-2">
                                <label htmlFor="account-type" className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em]">
                                    Account Type
                                </label>
                                <select
                                    id="account-type"
                                    value={type}
                                    onChange={(e) => setType(e.target.value as 'checking' | 'savings' | 'cash' | 'credit' | 'tracking')}
                                    className="w-full px-3.5 py-2.5 rounded-xl text-[13px] text-white/90 bg-[#1e2330] outline-none transition-all duration-200 appearance-none cursor-pointer"
                                    style={{
                                        boxShadow: 'inset 3px 3px 6px 0 rgba(0,0,0,0.35), inset -3px -3px 6px 0 rgba(255,255,255,0.03)',
                                    }}
                                >
                                    <option value="checking">Checking</option>
                                    <option value="savings">Savings</option>
                                    <option value="credit">Credit Card</option>
                                    <option value="cash">Cash</option>
                                </select>
                            </div>

                            {/* Starting Balance */}
                            <div className="space-y-2">
                                <label htmlFor="account-balance" className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em]">
                                    Starting Balance
                                </label>
                                <input
                                    id="account-balance"
                                    type="number"
                                    step="0.01"
                                    value={balance}
                                    onChange={(e) => setBalance(e.target.value)}
                                    // Make sure hitting enter on balance also saves
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                                    className="w-full px-3.5 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-white/20 outline-none transition-all duration-200"
                                    style={{
                                        background: 'hsl(222 35% 18%)',
                                        boxShadow: 'inset 3px 3px 6px 0 rgba(0,0,0,0.35), inset -3px -3px 6px 0 rgba(255,255,255,0.03)',
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.boxShadow = 'inset 4px 4px 8px 0 rgba(0,0,0,0.4), inset -4px -4px 8px 0 rgba(255,255,255,0.04)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.boxShadow = 'inset 3px 3px 6px 0 rgba(0,0,0,0.35), inset -3px -3px 6px 0 rgba(255,255,255,0.03)';
                                    }}
                                    placeholder="0.00"
                                />
                            </div>
                        </>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em]">
                            <FileText className="w-3 h-3" />
                            Notes
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            className="w-full px-3.5 py-2.5 rounded-xl text-[13px] text-white/90 placeholder-white/20 outline-none resize-none transition-all duration-200"
                            style={{
                                background: 'hsl(222 35% 18%)',
                                boxShadow: 'inset 3px 3px 6px 0 rgba(0,0,0,0.35), inset -3px -3px 6px 0 rgba(255,255,255,0.03)',
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.boxShadow = 'inset 4px 4px 8px 0 rgba(0,0,0,0.4), inset -4px -4px 8px 0 rgba(255,255,255,0.04)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.boxShadow = 'inset 3px 3px 6px 0 rgba(0,0,0,0.35), inset -3px -3px 6px 0 rgba(255,255,255,0.03)';
                            }}
                            placeholder="Add notes about this account..."
                        />
                    </div>

                    {/* Close / Reopen Account Section - Only for Editing */}
                    {isEditing && (
                        <div className="pt-2"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                        >
                            {!showCloseConfirm ? (
                                <button
                                    onClick={() => isClosed ? handleReopenAccount() : setShowCloseConfirm(true)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-200"
                                    style={{
                                        color: isClosed ? 'hsla(142, 70%, 60%, 0.9)' : 'hsla(350, 89%, 60%, 0.7)',
                                        boxShadow: '2px 2px 5px 0 rgba(0,0,0,0.2), -2px -2px 5px 0 rgba(255,255,255,0.02)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.boxShadow = 'inset 2px 2px 4px 0 rgba(0,0,0,0.3), inset -2px -2px 4px 0 rgba(255,255,255,0.02)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.boxShadow = '2px 2px 5px 0 rgba(0,0,0,0.2), -2px -2px 5px 0 rgba(255,255,255,0.02)';
                                    }}
                                >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {isClosed ? 'Reopen Account' : 'Close Account'}
                                </button>
                            ) : (
                                <div className="space-y-3 p-3 rounded-xl"
                                    style={{
                                        boxShadow: 'inset 3px 3px 6px 0 rgba(0,0,0,0.3), inset -3px -3px 6px 0 rgba(255,255,255,0.02)',
                                    }}
                                >
                                    <p className="text-[12px] text-white/60 leading-relaxed">
                                        Closing this account will move it to the <strong className="text-white/80">Closed</strong> section.
                                        You can reopen it at any time.
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleCloseAccount}
                                            className="px-3.5 py-2 rounded-lg text-[12px] font-semibold text-white transition-all duration-200 bg-rose-500"
                                            style={{
                                                boxShadow: '3px 3px 8px 0 rgba(0,0,0,0.3), -3px -3px 8px 0 rgba(255,255,255,0.02)',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.boxShadow = 'inset 2px 2px 5px 0 rgba(0,0,0,0.3), inset -2px -2px 5px 0 rgba(255,255,255,0.02)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.boxShadow = '3px 3px 8px 0 rgba(0,0,0,0.3), -3px -3px 8px 0 rgba(255,255,255,0.02)';
                                            }}
                                        >
                                            Close Account
                                        </button>
                                        <button
                                            onClick={() => setShowCloseConfirm(false)}
                                            className="px-3.5 py-2 rounded-lg text-[12px] font-medium text-white/50 hover:text-white/80 transition-all duration-200"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-6 py-4"
                    style={{
                        borderTop: '1px solid rgba(255,255,255,0.04)',
                    }}
                >
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-[13px] font-medium text-white/50 hover:text-white/80 transition-all duration-200"
                        style={{
                            boxShadow: '2px 2px 5px 0 rgba(0,0,0,0.2), -2px -2px 5px 0 rgba(255,255,255,0.02)',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim() || isPending}
                        className="px-5 py-2 rounded-xl text-[13px] font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-primary-500"
                        style={{
                            boxShadow: '3px 3px 8px 0 rgba(0,0,0,0.3), -3px -3px 8px 0 rgba(255,255,255,0.03)',
                        }}
                        onMouseEnter={(e) => {
                            if (!isPending && name.trim()) {
                                e.currentTarget.style.boxShadow = '4px 4px 12px 0 rgba(0,0,0,0.35), -4px -4px 12px 0 rgba(255,255,255,0.04)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '3px 3px 8px 0 rgba(0,0,0,0.3), -3px -3px 8px 0 rgba(255,255,255,0.03)';
                        }}
                    >
                        {isPending ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Account')}
                    </button>
                </div>
            </div>
        </div>
    );
}
