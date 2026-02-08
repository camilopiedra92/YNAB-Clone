import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle } from 'lucide-react';
import { useCreateCategoryGroup } from '@/hooks/useBudgetMutations';

interface CreateCategoryGroupPopoverProps {
    onSuccess: () => void;
}

export function CreateCategoryGroupPopover({ onSuccess }: CreateCategoryGroupPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const createMutation = useCreateCategoryGroup();

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
                onSuccess();
            },
        });
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${isOpen
                    ? 'neu-btn-primary scale-105'
                    : 'neu-btn text-muted-foreground'
                    }`}
            >
                <PlusCircle className="w-4 h-4" />
                Category Group
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-4 w-80 neu-card rounded-2xl p-5 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300"
                    style={{
                        boxShadow: '8px 8px 20px 0 var(--neu-dark), -8px -8px 20px 0 var(--neu-light)',
                    }}
                >
                    <div className="relative space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Group Name</label>
                            <input
                                autoFocus
                                type="text"
                                placeholder="e.g., Monthly Bills"
                                className="w-full px-4 py-3 bg-background rounded-xl text-sm font-bold text-foreground shadow-neu-inset focus:outline-none focus:shadow-[inset_4px_4px_8px_0_var(--neu-dark),inset_-4px_-4px_8px_0_var(--neu-light)] transition-all placeholder:text-muted-foreground/30"
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
                                className="neu-btn px-5 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-foreground rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={createMutation.isPending}
                                className="px-6 py-2.5 text-[10px] font-black text-white uppercase tracking-widest bg-emerald-500 rounded-xl shadow-neu-sm hover:shadow-neu-md active:scale-95 transition-all disabled:opacity-50"
                            >
                                {createMutation.isPending ? 'Creating...' : 'Create Group'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
