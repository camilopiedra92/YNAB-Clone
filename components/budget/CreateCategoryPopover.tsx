import React, { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useCreateCategory } from '@/hooks/useBudgetMutations';

interface CreateCategoryPopoverProps {
    groupId: number;
    onSuccess: () => void;
}

export function CreateCategoryPopover({ groupId, onSuccess }: CreateCategoryPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const createMutation = useCreateCategory();

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

        createMutation.mutate(
            { name: name.trim(), categoryGroupId: groupId },
            {
                onSuccess: () => {
                    setName('');
                    setIsOpen(false);
                    onSuccess();
                },
            },
        );
    };

    return (
        <div className="relative flex items-center" ref={containerRef} onClick={(e) => e.stopPropagation()}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${isOpen
                    ? 'bg-primary text-white scale-110 shadow-neu-sm opacity-100'
                    : 'text-primary hover:scale-110 active:scale-95 opacity-0 group-hover:opacity-100 shadow-neu-inset-sm hover:shadow-neu-sm'
                    }`}
                title="Add Category"
            >
                <Plus className="w-4 h-4" strokeWidth={3} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-4 w-80 neu-card rounded-2xl p-5 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300"
                    style={{
                        boxShadow: '8px 8px 20px 0 var(--neu-dark), -8px -8px 20px 0 var(--neu-light)',
                    }}
                >
                    <div className="relative space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Category Name</label>
                            <input
                                autoFocus
                                type="text"
                                placeholder="e.g., Groceries"
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
                                {createMutation.isPending ? 'Creating...' : 'Add Category'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
