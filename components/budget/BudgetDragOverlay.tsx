'use client';

import React from 'react';
import { ChevronDown, GripVertical } from 'lucide-react';
import type { BudgetItem } from '@/hooks/useBudgetTable';

interface SortedGroup {
    id: number;
    name: string;
    hidden: boolean;
    items: BudgetItem[];
}

interface BudgetDragOverlayContentProps {
    activeId: string;
    activeType: 'group' | 'item' | null;
    activeTableWidth: number | undefined;
    dragScrollCorrection: number;
    sortedGroups: SortedGroup[];
    budgetData: BudgetItem[];
    formatCurrency: (value: number) => string;
}

export function BudgetDragOverlayContent({
    activeId,
    activeType,
    activeTableWidth,
    dragScrollCorrection,
    sortedGroups,
    budgetData,
    formatCurrency,
}: BudgetDragOverlayContentProps) {
    if (!activeId) return null;

    return (
        <div style={{
            width: activeTableWidth || 'auto',
            cursor: 'grabbing',
            transform: `translateY(${dragScrollCorrection}px)`,
        }}>
            <table className="w-full border-collapse">
                <colgroup>
                    <col style={{ width: '80px' }} />
                    <col />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '150px' }} />
                </colgroup>
                <tbody className="rounded-2xl overflow-hidden"
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(16px)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)',
                    }}
                >
                    {(() => {
                        if (activeType === 'group') {
                            const groupId = Number(activeId.replace('group-', ''));
                            const group = sortedGroups.find(g => g.id === groupId);
                            if (!group) return null;

                            const groupTotals = group.items.reduce((acc, item) => ({
                                assigned: acc.assigned + item.assigned,
                                activity: acc.activity + item.activity,
                                available: acc.available + item.available,
                            }), { assigned: 0, activity: 0, available: 0 });

                            return (
                                <tr className="bg-primary/5">
                                    <td className="py-2 px-6 font-bold w-10">
                                        <div className="flex items-center gap-4">
                                            <div className="p-1 rounded-lg bg-white/[0.08] border border-white/10">
                                                <GripVertical className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="flex justify-center">
                                                <input type="checkbox" readOnly className="w-3.5 h-3.5 rounded border-white/20" checked={false} />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2 px-2">
                                        <div className="flex items-center gap-3">
                                            <div className="p-1 rounded-lg bg-primary/20 text-primary">
                                                <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                                            </div>
                                            <span className="text-sm font-bold text-gray-200 uppercase tracking-wider">{group.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-2 px-4 text-right">
                                        <div className="flex justify-end">
                                            <div className="min-w-[110px] px-3 text-right text-xs font-bold text-gray-500 uppercase tracking-tighter">
                                                {formatCurrency(groupTotals.assigned)}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2 px-4 text-right">
                                        <div className="flex justify-end">
                                            <div className="min-w-[110px] px-3 text-right text-xs font-bold text-gray-600 uppercase tracking-tighter">
                                                {formatCurrency(groupTotals.activity)}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2 px-4 text-right">
                                        <div className="flex justify-end">
                                            <div className="min-w-[110px] px-3 text-right text-sm font-bold text-gray-200 tracking-tight">
                                                {formatCurrency(groupTotals.available)}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        } else if (activeType === 'item') {
                            const categoryId = Number(activeId.replace('item-', ''));
                            const item = budgetData.find(i => i.categoryId === categoryId);
                            if (!item) return null;

                            return (
                                <tr>
                                    <td className="py-1.5 px-6 w-10">
                                        <div className="flex items-center gap-4">
                                            <div className="p-1 rounded-lg bg-white/[0.08] border border-white/10">
                                                <GripVertical className="w-3.5 h-3.5 text-primary" />
                                            </div>
                                            <div className="flex justify-center">
                                                <input type="checkbox" readOnly className="w-3.5 h-3.5 rounded border-white/20" checked={false} />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-1.5 px-2">
                                        <div className="flex items-center pl-4 relative">
                                            <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10 ml-2" />
                                            <div className="flex items-center w-full group/text pl-4">
                                                <span className="text-sm font-medium text-gray-200">
                                                    {item.categoryName}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-1.5 px-4 text-right">
                                        <div className="flex justify-end">
                                            <div className="text-sm font-bold text-gray-200 px-2 py-1 min-w-[100px] text-right rounded-lg bg-white/[0.03] border border-white/5">
                                                {formatCurrency(item.assigned)}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-1.5 px-4 text-right">
                                        <div className="flex justify-end">
                                            <div className="min-w-[100px] px-2 py-1 text-right text-xs font-medium text-gray-500 tabular-nums">
                                                {formatCurrency(item.activity)}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-1.5 px-4 text-right">
                                        <div className="flex justify-end text-sm">
                                            <button className={`min-w-[100px] py-1 px-3 rounded-lg text-[11px] font-bold text-right border ${item.available > 0
                                                ? 'bg-green-500 text-white border-green-500'
                                                : item.available < 0
                                                    ? item.overspendingType === 'credit'
                                                        ? 'bg-amber-500 text-white border-amber-500'
                                                        : 'bg-red-500 text-white border-red-500'
                                                    : 'bg-white/5 text-gray-500 border-white/10'
                                                }`}>
                                                {formatCurrency(item.available)}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }
                        return null;
                    })()}
                </tbody>
            </table>
        </div>
    );
}
