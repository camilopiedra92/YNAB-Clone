import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle } from 'lucide-react';
import { useCreateCategoryGroup } from '@/hooks/useBudgetMutations';
import { useTranslations } from 'next-intl';

interface CreateCategoryGroupPopoverProps {
    budgetId: number;
    onSuccess?: () => void;
}

export function CreateCategoryGroupPopover({ budgetId, onSuccess }: CreateCategoryGroupPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const t = useTranslations('budget');
    const tc = useTranslations('common');
    const createMutation = useCreateCategoryGroup(budgetId);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleCreate = () => {
        if (!name.trim()) return;

        createMutation.mutate(name.trim(), {
            onSuccess: () => {
                setName('');
                setIsOpen(false);
                onSuccess?.();
            },
        });
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all duration-300 ${isOpen
                    ? 'bg-primary text-white scale-105'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.06] border border-white/5'
                    }`}
            >
                <PlusCircle className="w-4 h-4" />
                {t('categoryGroup')}
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-4 w-80 glass-panel-strong rounded-2xl p-5 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300">
                    <div className="relative space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">{t('groupNameLabel')}</label>
                            <input
                                autoFocus
                                type="text"
                                placeholder={t('groupNamePlaceholder')}
                                className="w-full px-4 py-3 rounded-xl text-sm font-bold text-gray-200 glass-input focus:outline-none transition-all placeholder:text-gray-600"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreate();
                                    if (e.key === 'Escape') setIsOpen(false);
                                }}
                            />
                        </div>
                        <div className="flex items-center justify-end gap-3 pt-1">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-5 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white rounded-lg transition-all hover:bg-white/[0.06]"
                            >
                                {tc('cancel')}
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={createMutation.isPending}
                                className="px-6 py-2.5 text-[10px] font-bold text-white uppercase tracking-widest bg-emerald-500 rounded-lg hover:bg-emerald-400 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {createMutation.isPending ? tc('creating') : t('createGroup')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
