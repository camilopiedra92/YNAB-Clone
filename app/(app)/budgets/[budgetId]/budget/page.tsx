'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef, useTransition } from 'react';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import AppLayout from '@/components/AppLayout';
import { useParams } from 'next/navigation';
import { useBudgetTable, BudgetItem } from '@/hooks/useBudgetTable';
import { BudgetItemRow } from '@/components/budget/BudgetItemRow';
import { BudgetInspector } from '@/components/budget/BudgetInspector';
import { CategoryGroupRow } from '@/components/budget/CategoryGroupRow';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateAssigned, useUpdateCategoryName, useReorderCategories } from '@/hooks/useBudgetMutations';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { BudgetHeader } from '@/components/budget/BudgetHeader';
import { BudgetToolbar } from '@/components/budget/BudgetToolbar';
import { BudgetDndProvider } from '@/components/budget/BudgetDndProvider';


export default function BudgetPage() {
    const params = useParams();
    const budgetId = params.budgetId ? parseInt(params.budgetId as string) : undefined;

    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const { data: budgetData = [], isLoading: loading, isFetching, readyToAssign, monthRange, inspectorData } = useBudgetTable(budgetId, currentMonth);
    const [isMonthTransitioning, startMonthTransition] = useTransition();
    const animatedRTA = useAnimatedNumber(readyToAssign, 400);
    const queryClient = useQueryClient();

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const [assignEditingId, setAssignEditingId] = useState<number | null>(null);
    const [assignEditValue, setAssignEditValue] = useState('');
    const assignEditingIdRef = useRef<number | null>(null);
    const tableContainerRef = React.useRef<HTMLDivElement>(null);

    // Derived state for rendering
    const sortedGroups = useMemo(() => {
        const groups = new Map<number, { id: number, name: string, hidden: boolean, items: BudgetItem[] }>();

        budgetData.forEach(item => {
            if (item.groupName === 'Inflow') return;

            if (!groups.has(item.categoryGroupId)) {
                groups.set(item.categoryGroupId, {
                    id: item.categoryGroupId,
                    name: item.groupName,
                    hidden: item.groupHidden,
                    items: []
                });
            }
            if (item.categoryId !== null) {
                groups.get(item.categoryGroupId)!.items.push(item);
            }
        });

        const allGroups = Array.from(groups.values());
        const ccGroup = allGroups.filter(g => g.name === 'Credit Card Payments');
        const hiddenGroup = allGroups.filter(g => g.hidden);
        const otherGroups = allGroups.filter(g => g.name !== 'Credit Card Payments' && !g.hidden);
        return [...ccGroup, ...otherGroups, ...hiddenGroup];
    }, [budgetData]);

    // --- Selection handlers ---
    const toggleAll = () => {
        const allIds = budgetData
            .map(item => item.categoryId)
            .filter((id): id is number => id !== null);

        if (selectedIds.size === allIds.length && allIds.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(allIds));
        }
    };

    const toggleGroupSelection = (items: BudgetItem[]) => {
        const categoryIds = items
            .map(i => i.categoryId)
            .filter((id): id is number => id !== null);
        if (categoryIds.length === 0) return;
        const allSelected = categoryIds.every(id => selectedIds.has(id));
        const newSelected = new Set(selectedIds);
        if (allSelected) {
            categoryIds.forEach(id => newSelected.delete(id));
        } else {
            categoryIds.forEach(id => newSelected.add(id));
        }
        setSelectedIds(newSelected);
    };

    const toggleItemSelection = (categoryId: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(categoryId)) {
            newSelected.delete(categoryId);
        } else {
            newSelected.add(categoryId);
        }
        setSelectedIds(newSelected);
    };

    const handleCategorySelect = (categoryId: number, event: React.MouseEvent) => {
        if (event.metaKey || event.ctrlKey) {
            toggleItemSelection(categoryId);
        } else {
            setSelectedIds(new Set([categoryId]));
        }
    };

    // --- Group expansion ---
    const toggleGroup = (groupName: string) => {
        setExpandedGroups(prev => {
            const group = sortedGroups.find(g => g.name === groupName);
            const defaultExpanded = group ? !group.hidden : true;
            const current = prev[groupName] ?? defaultExpanded;
            return { ...prev, [groupName]: !current };
        });
    };

    const areAllExpanded = sortedGroups.every(g => expandedGroups[g.name] ?? !g.hidden);

    const toggleAllGroups = () => {
        const newExpandedState = !areAllExpanded;
        const newGroupsState = sortedGroups.reduce((acc, group) => {
            acc[group.name] = newExpandedState;
            return acc;
        }, {} as Record<string, boolean>);
        setExpandedGroups(newGroupsState);
    };

    useEffect(() => {
        if (budgetData.length > 0) {
            const groups = budgetData.reduce((acc, item) => {
                if (!(item.groupName in acc)) {
                    acc[item.groupName] = !item.groupHidden;
                }
                return acc;
            }, {} as Record<string, boolean>);
            setTimeout(() => setExpandedGroups(prev => ({ ...groups, ...prev })), 0);
        }
    }, [budgetData]);

    // --- Data fetching & mutations ---
    const fetchBudget = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['budget', budgetId, currentMonth] });
    }, [queryClient, budgetId, currentMonth]);

    const updateAssignedMutation = useUpdateAssigned(budgetId!, currentMonth);
    const updateCategoryNameMutation = useUpdateCategoryName(budgetId!);
    const reorderMutation = useReorderCategories(budgetId!);

    const handleUpdateCategoryName = (categoryId: number, newName: string) => {
        const currentName = budgetData.find(i => i.categoryId === categoryId)?.categoryName ?? null;
        updateCategoryNameMutation.mutate({ categoryId, newName, currentName });
        setEditingId(null);
    };

    const handleUpdateAssigned = (categoryId: number, value: string) => {
        if (assignEditingIdRef.current === categoryId) {
            setAssignEditingId(null);
            assignEditingIdRef.current = null;
        }
        updateAssignedMutation.mutate({
            categoryId,
            month: currentMonth,
            value,
            currentBudgetData: budgetData,
        });
    };

    const navigateMonth = (direction: number) => {
        const [year, month] = currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + direction);
        const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        // Guard: don't navigate beyond data range
        if (monthRange) {
            if (newMonth < monthRange.minMonth || newMonth > monthRange.maxMonth) return;
        }
        startMonthTransition(() => setCurrentMonth(newMonth));
    };

    const goToCurrentMonth = () => {
        const now = new Date();
        startMonthTransition(() => setCurrentMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`));
    };

    if (loading) {
        return (
            <AppLayout>
                <div className="flex-1 flex items-center justify-center min-h-[80vh]">
                    <div className="relative">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-8 w-8 rounded-full bg-primary-500/10"></div>
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="flex flex-col h-full">
                <BudgetHeader
                    currentMonth={currentMonth}
                    onNavigateMonth={navigateMonth}
                    onGoToCurrentMonth={goToCurrentMonth}
                    onSetCurrentMonth={(m) => startMonthTransition(() => setCurrentMonth(m))}
                    animatedRTA={animatedRTA}
                    formatCurrency={formatCurrency}
                    minMonth={monthRange?.minMonth}
                    maxMonth={monthRange?.maxMonth}
                />

                <BudgetToolbar
                    budgetId={budgetId!}
                    onFetchBudget={fetchBudget}
                />

                {/* Main Table Content + Inspector */}
                <div className="flex-1 flex gap-0 min-h-0">
                    <div
                        ref={tableContainerRef}
                        className={`flex-1 min-w-0 h-full overflow-auto custom-scrollbar transition-opacity duration-200 ${(isMonthTransitioning || isFetching) ? 'opacity-60' : 'opacity-100'}`}
                    >
                        <BudgetDndProvider
                            budgetData={budgetData}
                            sortedGroups={sortedGroups}
                            expandedGroups={expandedGroups}
                            setExpandedGroups={setExpandedGroups}
                            budgetId={budgetId!}
                            currentMonth={currentMonth}
                            queryClient={queryClient}
                            reorderMutation={reorderMutation}
                            tableContainerRef={tableContainerRef}
                            formatCurrency={formatCurrency}
                        >
                            <table data-testid="budget-table" className="w-full border-collapse">
                                <thead className="sticky top-0 bg-background z-10"
                                    style={{
                                        boxShadow: '0 3px 8px 0 var(--neu-dark)',
                                    }}
                                >
                                    <tr className="border-b border-border uppercase tracking-widest text-muted-foreground text-[10px] font-bold">
                                        <th className="py-1 px-4 border-b border-border w-12">
                                            <div className="flex items-center justify-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8"></div>
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
                                                        aria-label="Seleccionar todas las categorías"
                                                        checked={(() => {
                                                            const validCount = budgetData.filter(i => i.categoryId !== null).length;
                                                            return validCount > 0 && selectedIds.size === validCount;
                                                        })()}
                                                        onChange={toggleAll}
                                                    />
                                                </div>
                                            </div>
                                        </th>
                                        <th className="text-left py-0.5 px-2 font-black border-b border-border">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={toggleAllGroups}
                                                    className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                                                    title={areAllExpanded ? "Collapse All" : "Expand All"}
                                                    aria-label={areAllExpanded ? "Collapse All" : "Expand All"}
                                                >
                                                    {areAllExpanded ? (
                                                        <ChevronDown className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4" />
                                                    )}
                                                </button>
                                                <span>CATEGORY</span>
                                            </div>
                                        </th>
                                        <th className="text-right py-0.5 px-4 font-black border-b border-border w-[15%]">
                                            <div className="flex justify-end">
                                                <div className="min-w-[110px] px-3 text-right">ASSIGNED</div>
                                            </div>
                                        </th>
                                        <th className="text-right py-1 px-4 font-black border-b border-border w-[15%]">
                                            <div className="flex justify-end">
                                                <div className="min-w-[110px] px-3 text-right">ACTIVITY</div>
                                            </div>
                                        </th>
                                        <th className="text-right py-0.5 px-4 font-black border-b border-border w-[15%]">
                                            <div className="flex justify-end">
                                                <div className="min-w-[110px] px-3 text-right">AVAILABLE</div>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    <SortableContext items={sortedGroups.map(g => `group-${g.id}`)} strategy={verticalListSortingStrategy}>
                                        {sortedGroups.map((group) => {
                                            const defaultExpanded = !group.hidden;
                                            const isExpanded = expandedGroups[group.name] ?? defaultExpanded;
                                            const allSelected = group.items.length > 0 && group.items.every(i => selectedIds.has(i.categoryId!));

                                            return (
                                                <React.Fragment key={group.id}>
                                                    <CategoryGroupRow
                                                        group={group}
                                                        budgetId={budgetId!}
                                                        isExpanded={isExpanded}
                                                        allSelected={allSelected}
                                                        onToggleGroup={toggleGroup}
                                                        onToggleSelection={toggleGroupSelection}
                                                        onFetchBudget={fetchBudget}
                                                        formatCurrency={formatCurrency}
                                                    />

                                                    {isExpanded && (
                                                        <SortableContext items={group.items.map(i => `item-${i.categoryId}`)} strategy={verticalListSortingStrategy}>
                                                            {group.items.map((item) => {
                                                                if (!item.categoryId) return null;

                                                                return (
                                                                    <BudgetItemRow
                                                                        key={item.categoryId}
                                                                        item={item}
                                                                        isSelected={selectedIds.has(item.categoryId)}
                                                                        isEditing={editingId === item.categoryId}
                                                                        editingValue={editValue}
                                                                        assignEditingId={assignEditingId}
                                                                        assignEditValue={assignEditValue}
                                                                        onToggleSelection={toggleItemSelection}
                                                                        onSelect={handleCategorySelect}
                                                                        onStartEditName={(id, name) => {
                                                                            setEditingId(id);
                                                                            setEditValue(name);
                                                                        }}
                                                                        onUpdateName={handleUpdateCategoryName}
                                                                        onCancelEditName={() => setEditingId(null)}
                                                                        onStartEditAssigned={(id, val) => {
                                                                            setAssignEditingId(id);
                                                                            const num = parseFloat(val) || 0;
                                                                            const display = num / 1000;
                                                                            setAssignEditValue(display === 0 ? '' : display.toString());
                                                                            assignEditingIdRef.current = id;
                                                                        }}
                                                                        onUpdateAssigned={handleUpdateAssigned}
                                                                        onCancelEditAssigned={() => setAssignEditingId(null)}
                                                                        onUpdateEditingValue={setEditValue}
                                                                        onUpdateAssignEditValue={setAssignEditValue}
                                                                        formatCurrency={formatCurrency}
                                                                    />
                                                                );
                                                            })}
                                                        </SortableContext>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </SortableContext>
                                </tbody>
                            </table>
                        </BudgetDndProvider>
                    </div>
                    {/* Inspector Panel */}
                    <div className="h-full overflow-y-auto custom-scrollbar border-l border-border/30">
                        <BudgetInspector
                            data={inspectorData}
                            currentMonth={currentMonth}
                            formatCurrency={formatCurrency}
                        />
                    </div>
                </div>
            </div >
        </AppLayout >
    );
}
