'use client';

import React, { useEffect, useState, useMemo, useLayoutEffect, useCallback, useRef } from 'react';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import AppLayout from '@/components/AppLayout';
import { CreateCategoryGroupPopover } from '@/components/budget/CreateCategoryGroupPopover';
import { useBudget, BudgetItem } from '@/hooks/useBudget';
import { BudgetItemRow } from '@/components/budget/BudgetItemRow';
import { BudgetInspector } from '@/components/budget/BudgetInspector';
import { CategoryGroupRow } from '@/components/budget/CategoryGroupRow';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateAssigned, useUpdateCategoryName, useReorderCategories } from '@/hooks/useBudgetMutations';

import {
    ChevronLeft,
    ChevronRight,
    Search,
    Undo2,
    Redo2,
    History,
    LayoutGrid,
    List,
    ChevronDown,
    GripVertical
} from 'lucide-react';
import { MonthPicker } from '@/components/budget/MonthPicker';
import { formatCurrency } from '@/lib/format';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverEvent,
    DragOverlay,
    MeasuringStrategy,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';


const filters = [
    { label: 'All', active: true },
    { label: 'Snoozed', active: false },
    { label: 'Underfunded', active: false },
    { label: 'Overfunded', active: false },
    { label: 'Money Available', active: false },
    { label: 'Guilt Free', active: false },
    { label: 'Fixed Costs', active: false },
    { label: 'Savings', active: false },
];


export default function BudgetPage() {
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const { data: budgetData = [], isLoading: loading, isFetching: isNavigating, readyToAssign, inspectorData } = useBudget(currentMonth);
    const animatedRTA = useAnimatedNumber(readyToAssign, 400);
    const queryClient = useQueryClient();

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const [assignEditingId, setAssignEditingId] = useState<number | null>(null);
    const [assignEditValue, setAssignEditValue] = useState('');
    const assignEditingIdRef = useRef<number | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<'group' | 'item' | null>(null);
    const [activeTableWidth, setActiveTableWidth] = useState<number | undefined>(undefined);
    const tableContainerRef = React.useRef<HTMLDivElement>(null);
    const initialScrollTop = React.useRef(0);
    const [dragScrollCorrection, setDragScrollCorrection] = useState(0);

    const onDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        const type = active.data.current?.type;
        setActiveType(type);
        setActiveTableWidth(tableContainerRef.current?.querySelector('table')?.offsetWidth);

        if (tableContainerRef.current) {
            initialScrollTop.current = tableContainerRef.current.scrollTop;
        }
    };

    useLayoutEffect(() => {
        if (activeType === 'group' && tableContainerRef.current) {
            const currentScrollTop = tableContainerRef.current.scrollTop;
            const diff = initialScrollTop.current - currentScrollTop;
            setDragScrollCorrection(diff);
        } else {
            setDragScrollCorrection(0);
        }
    }, [activeId, activeType, budgetData]);


    // Derived state for rendering

    const sortedGroups = useMemo(() => {
        const groups = new Map<number, { id: number, name: string, hidden: boolean, items: BudgetItem[] }>();

        budgetData.forEach(item => {
            // Filter out the Inflow group — it's shown in the Ready to Assign widget
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

        // Sort: Credit Card Payments first, then regular groups, then Hidden Categories at the end
        const allGroups = Array.from(groups.values());
        const ccGroup = allGroups.filter(g => g.name === 'Credit Card Payments');
        const hiddenGroup = allGroups.filter(g => g.hidden);
        const otherGroups = allGroups.filter(g => g.name !== 'Credit Card Payments' && !g.hidden);
        return [...ccGroup, ...otherGroups, ...hiddenGroup];
    }, [budgetData]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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

    // Initialize group expansion states — hidden groups default to collapsed
    useEffect(() => {
        if (budgetData.length > 0) {
            const groups = budgetData.reduce((acc, item) => {
                // Hidden groups default to collapsed; others default to expanded
                if (!(item.groupName in acc)) {
                    acc[item.groupName] = !item.groupHidden;
                }
                return acc;
            }, {} as Record<string, boolean>);
            setTimeout(() => setExpandedGroups(prev => ({ ...groups, ...prev })), 0);
        }
    }, [budgetData]);

    const fetchBudget = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['budget', currentMonth] });
    }, [queryClient, currentMonth]);

    // --- Mutation hooks ---
    const updateAssignedMutation = useUpdateAssigned(currentMonth);
    const updateCategoryNameMutation = useUpdateCategoryName();
    const reorderMutation = useReorderCategories();

    const handleUpdateCategoryName = (categoryId: number, newName: string) => {
        const currentName = budgetData.find(i => i.categoryId === categoryId)?.categoryName ?? null;
        updateCategoryNameMutation.mutate(
            { categoryId, newName, currentName },
        );
        setEditingId(null);
    };

    const handleUpdateAssigned = (categoryId: number, value: string) => {
        // Clear editing state immediately for fluid UX
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

    // formatCurrency is imported from @/lib/format


    const navigateMonth = (direction: number) => {
        const [year, month] = currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + direction);
        setCurrentMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    const goToCurrentMonth = () => {
        const now = new Date();
        setCurrentMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    };




    const onDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        const isActiveItem = active.data.current?.type === 'item';
        const isOverItem = over.data.current?.type === 'item';
        const isOverGroup = over.data.current?.type === 'group';

        if (isActiveItem) {
            const activeItem = budgetData.find(i => `item-${i.categoryId}` === activeId);
            if (!activeItem) return;

            // Prevent moving categories from/to the Credit Card Payments group
            const activeGroup = sortedGroups.find(g => g.id === activeItem.categoryGroupId);
            if (activeGroup?.name === 'Credit Card Payments') return;

            if (isOverItem) {
                const overItem = budgetData.find(i => `item-${i.categoryId}` === overId);
                if (overItem && activeItem.categoryGroupId !== overItem.categoryGroupId) {
                    // Prevent dropping into Credit Card Payments group
                    const overGroup = sortedGroups.find(g => g.id === overItem.categoryGroupId);
                    if (overGroup?.name === 'Credit Card Payments') return;

                    // Ensure the target group is expanded so the item doesn't disappear
                    if (!expandedGroups[overItem.groupName]) {
                        setExpandedGroups(prev => ({
                            ...prev,
                            [overItem.groupName]: true
                        }));
                    }

                    // setBudgetData(...) locally removed for now to favor React Query consistency
                    // but we keep the optimistic feel via keepPreviousData
                }
            } else if (isOverGroup) {
                const groupId = Number(overId.replace('group-', ''));
                const group = sortedGroups.find(g => g.id === groupId);

                // Prevent dropping into Credit Card Payments group
                if (group?.name === 'Credit Card Payments') return;

                if (group && activeItem.categoryGroupId !== groupId) {
                    // Ensure the target group is expanded so the item doesn't disappear
                    if (!expandedGroups[group.name]) {
                        setExpandedGroups(prev => ({
                            ...prev,
                            [group.name]: true
                        }));
                    }

                    // setBudgetData(...) removed
                }
            }
        }
    };

    const onDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveType(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        if (active.data.current?.type === 'group') {
            const oldIndex = sortedGroups.findIndex(g => `group-${g.id}` === activeId);
            const newIndex = sortedGroups.findIndex(g => `group-${g.id}` === overId);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newGroups = arrayMove(sortedGroups, oldIndex, newIndex);
                const newGroupIds = newGroups.map(g => g.id);

                // Reorder budgetData based on new group order
                const newBudgetData = [...budgetData].sort((a, b) => {
                    const aIndex = newGroupIds.indexOf(a.categoryGroupId);
                    const bIndex = newGroupIds.indexOf(b.categoryGroupId);
                    if (aIndex !== bIndex) return aIndex - bIndex;
                    return 0; // Keep relative order within group
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                queryClient.setQueryData(['budget', currentMonth], (old: any) => ({ ...old, budget: newBudgetData }));

                // Sync with backend
                const groupsToUpdate = newGroups.map((g, index) => ({
                    id: g.id,
                    sortOrder: index
                }));

                reorderMutation.mutate({ type: 'group', items: groupsToUpdate });
            }
        } else if (active.data.current?.type === 'item') {
            const activeItem = budgetData.find(i => `item-${i.categoryId}` === activeId);

            // Find overItem (subcategory) or overGroup (group)
            const overItem = budgetData.find(i => `item-${i.categoryId}` === overId);
            const overGroup = sortedGroups.find(g => `group-${g.id}` === overId);

            if (activeItem) {
                // Prevent moving categories from/to the Credit Card Payments group
                const activeItemGroup = sortedGroups.find(g => g.id === activeItem.categoryGroupId);
                if (activeItemGroup?.name === 'Credit Card Payments') return;
                if (overItem) {
                    const overItemGroup = sortedGroups.find(g => g.id === overItem!.categoryGroupId);
                    if (overItemGroup?.name === 'Credit Card Payments') return;
                }
                if (overGroup?.name === 'Credit Card Payments') return;
                const oldIndex = budgetData.findIndex(i => `item-${i.categoryId}` === activeId);
                let newIndex = -1;

                if (overItem) {
                    newIndex = budgetData.findIndex(i => `item-${i.categoryId}` === overId);
                } else if (overGroup) {
                    // If dropped on a group, place it at the end of that group's items
                    // Find the last item of that group in budgetData
                    const groupItems = budgetData.filter(i => i.categoryGroupId === overGroup?.id && i.categoryId !== null);
                    if (groupItems.length > 0) {
                        const lastItem = groupItems[groupItems.length - 1];
                        const lastItemIndex = budgetData.findIndex(i => i === lastItem);
                        // Be careful: arrayMove moves to index. 
                        // If we are moving downwards, we might want index+1?
                        // Simple heuristic: just put it after the last item of the group
                        newIndex = lastItemIndex;
                        // If the item is already in the group (due to onDragOver), 
                        // we need to be careful not to just swap with last item but place it.
                    } else {
                        // Empty group. Move to... where?
                        // budgetData is flat. We need to regroup. 
                        // Actually, if we just updated props in onDragOver, visually it's in the group.
                        // But now we need to finalize the sort order. 
                        // If the group is empty, order doesn't matter much relative to other items in group.
                        // But we need a valid index in the flat budgetData to use arrayMove?
                        // Actually if we move across groups, arrayMove on the WHOLE list is tricky 
                        // because we want it to be *inside* the new group chunk.

                        // Strategy: Reconstruct the whole list based on sorted groups and their items
                    }
                }

                // Better Strategy for Item DragEnd:
                // 1. We know the start group and end group (from onDragOver updates).
                // 2. Ideally we use the `sortedGroups` structure to determine the new order.
                // But `sortedGroups` is derived from `budgetData`.
                // We need to construct a NEW `budgetData`.

                // If moving within same group:
                if (overItem && activeItem.categoryGroupId === overItem.categoryGroupId) {
                    newIndex = budgetData.findIndex(i => `item-${i.categoryId}` === overId);
                    if (newIndex !== -1) {
                        const newBudgetData = arrayMove(budgetData, oldIndex, newIndex);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                queryClient.setQueryData(['budget', currentMonth], (old: any) => ({ ...old, budget: newBudgetData }));

                        // Sync backend
                        const groupItems = newBudgetData.filter(i => i.categoryGroupId === activeItem.categoryGroupId);
                        const categoriesToUpdate = groupItems.map((item, index) => ({
                            id: item.categoryId,
                            sortOrder: index,
                            categoryGroupId: item.categoryGroupId
                        }));

                        reorderMutation.mutate({ type: 'category', items: categoriesToUpdate });
                    }
                } else {
                    // Moved to different group (handled by onDragOver mostly)
                    // or dropped on group header.
                    // The visual state in sortedGroups is already updated because we updated group_name/id in onDragOver.
                    // We just need to persist the order of the NEW group.

                    // Issue: `oldIndex` in `budgetData` is where it WAS. 
                    // But because we updated `budgetData` in `onDragOver`, `activeItem` in `budgetData` 
                    // ALREADY has the new group ID.
                    // So `sortedGroups` ALREADY shows it in the new group.

                    // We just need to finalize the sort within that new group.
                    // If we dropped on "overItem", we want it at that position relative to overItem.
                    // But `budgetData` array order might be messy if we only updated properties.
                    // We should re-sort `budgetData` to match the visual order implied by `dnd-kit`?
                    // Actually `dnd-kit` doesn't reorder the DOM for us permanently, we must do it.

                    // If we are here, `activeItem` has new group ID. 
                    // `overItem` is the target.

                    const newBudgetData = [...budgetData];

                    // If dropped on an item in the new group
                    if (overItem) {
                        const oldItemIdx = newBudgetData.findIndex(i => i.categoryId === activeItem.categoryId);
                        const targetItemIdx = newBudgetData.findIndex(i => i.categoryId === overItem!.categoryId);

                        // Move in the flat array
                        const [movedItem] = newBudgetData.splice(oldItemIdx, 1);
                        newBudgetData.splice(targetItemIdx, 0, movedItem);
                    } else if (overGroup) {
                        // Dropped on group header -> move to top or bottom of group?
                        // Make it first item in group?

                        const oldItemIdx = newBudgetData.findIndex(i => i.categoryId === activeItem.categoryId);
                        const [movedItem] = newBudgetData.splice(oldItemIdx, 1);

                        // Insert after the group's "last" item? OR if group empty, doesn't matter where in flat list, 
                        // as long as grouped correctly. But for `arrayMove` stability we might want to keep groups contiguous.
                        // Let's find index of first item of this group.
                        const firstGroupItemIdx = newBudgetData.findIndex(i => i.categoryGroupId === overGroup!.id);
                        if (firstGroupItemIdx !== -1) {
                            newBudgetData.splice(firstGroupItemIdx, 0, movedItem);
                        } else {
                            // Group was empty, no items. Just append to end of list? 
                            // Or stick it anywhere, sorting by group ID later fixes it?
                            // Yes, `sortedGroups` renders by Group ID. 
                            // Backend sort_order relies on us sending correct order.
                            newBudgetData.push(movedItem);
                        }
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    queryClient.setQueryData(['budget', currentMonth], (old: any) => ({ ...old, budget: newBudgetData }));

                    // Sync BOTH groups (source and dest)
                    // Actually we don't know the source group anymore because we updated state in DragOver.
                    // We can just update ALL groups? Or just the one we landed in?
                    // We need to update the Destination Group. 
                    // And the Source Group needs to have its order compacted? Backend doesn't care about gaps usually.
                    // But if we want to be safe, we update both.
                    // Since we lost track of source, we can just update the destination group's order.

                    const targetGroupId = activeItem.categoryGroupId;
                    const targetGroupItems = newBudgetData.filter(i => i.categoryGroupId === targetGroupId && i.categoryId !== null);

                    const categoriesToUpdate = targetGroupItems.map((item, index) => ({
                        id: item.categoryId,
                        sortOrder: index,
                        categoryGroupId: targetGroupId
                    }));

                    reorderMutation.mutate({ type: 'category', items: categoriesToUpdate });
                }
            }
        }
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
                {/* Modern Floating Header Section */}
                <header className="px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 bg-background"
                    style={{
                        boxShadow: '0 4px 12px 0 var(--neu-dark)',
                    }}
                >
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 p-1.5 rounded-2xl shadow-neu-sm bg-background/50 backdrop-blur-sm">
                            <button
                                data-testid="month-prev"
                                onClick={() => navigateMonth(-1)}
                                className="p-2 rounded-xl hover:bg-primary/10 text-primary transition-all active:scale-95"
                                title="Mes Anterior"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={goToCurrentMonth}
                                className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all active:scale-95 shadow-neu-sm border border-primary/10 ml-1"
                            >
                                Hoy
                            </button>
                            <div data-testid="month-display" className="px-4 flex flex-col items-center min-w-[140px]">
                                <MonthPicker currentMonth={currentMonth} onChange={setCurrentMonth} />
                            </div>
                            <button
                                data-testid="month-next"
                                onClick={() => navigateMonth(1)}
                                className="p-2 rounded-xl hover:bg-primary/10 text-primary transition-all active:scale-95"
                                title="Mes Siguiente"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Prominent Ready to Assign Widget */}
                    <div className="absolute left-1/2 -translate-x-1/2">
                        <div className={`bg-background px-8 py-2 rounded-[2rem] flex flex-col items-center shadow-neu-md relative group cursor-pointer hover:shadow-neu-lg transition-all duration-500 overflow-hidden min-w-[220px] ${animatedRTA < -0.5 ? 'ring-2 ring-red-400/50' : animatedRTA > 0.5 ? 'ring-2 ring-emerald-400/30' : ''
                            }`}>
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span data-testid="rta-amount" className={`text-2xl font-black tracking-tighter leading-none relative z-10 tabular-nums ${animatedRTA < -0.5 ? 'text-red-500' : animatedRTA > 0.5 ? 'text-emerald-600' : 'text-foreground'
                                }`}>{formatCurrency(Math.round(animatedRTA))}</span>
                            <div className="flex items-center gap-2 mt-0.5 relative z-10">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-80">Ready to Assign</span>
                                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${animatedRTA < -0.5 ? 'bg-red-500' : animatedRTA > 0.5 ? 'bg-emerald-500' : 'bg-emerald-500'
                                    }`} />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 p-1 rounded-xl shadow-neu-inset-sm">
                            <button className="p-2 rounded-lg shadow-neu-sm">
                                <LayoutGrid className="w-4 h-4 text-primary" />
                            </button>
                            <button className="p-2 rounded-lg text-muted-foreground/60 hover:text-foreground transition-colors">
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Sub-header Filter Section - More like a tab system */}
                <div className="px-8 py-2.5 flex items-center justify-between bg-background overflow-x-auto no-scrollbar gap-4"
                    style={{
                        boxShadow: '0 2px 6px 0 var(--neu-dark)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        {filters.map((filter) => (
                            <button
                                key={filter.label}
                                className={`px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter.active
                                    ? 'neu-btn-primary'
                                    : 'neu-btn text-muted-foreground'
                                    }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 ml-auto">
                        <div className="flex items-center gap-3 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                            <button className="flex items-center gap-2 hover:opacity-70 transition-opacity opacity-40">
                                <Undo2 className="w-4 h-4" />
                                Undo
                            </button>
                            <button className="flex items-center gap-2 hover:opacity-70 transition-opacity opacity-40">
                                <Redo2 className="w-4 h-4" />
                                Redo
                            </button>
                            <div className="w-px h-4 bg-border mx-1" />
                            <button className="flex items-center gap-2 hover:text-primary-600 transition-colors">
                                <History className="w-4 h-4" />
                                History
                            </button>
                        </div>
                    </div>
                </div>

                {/* Toolbar Section - Actions */}
                <div className="px-8 py-2.5 flex items-center justify-between bg-background">
                    <div className="flex items-center gap-4">
                        <CreateCategoryGroupPopover onSuccess={() => fetchBudget()} />
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search categories..."
                                className="pl-10 pr-4 py-2 bg-background rounded-xl text-sm shadow-neu-inset-sm focus:outline-none focus:shadow-neu-inset transition-all w-64"
                            />
                        </div>
                    </div>
                </div>

                {/* Main Table Content + Inspector */}
                <div className="flex-1 flex gap-0 min-h-0">
                    <div
                        ref={tableContainerRef}
                        className="flex-1 min-w-0 h-full overflow-auto custom-scrollbar"
                    >
                        {/* Subtle top loading bar for month navigation */}
                        {isNavigating && (
                            <div className="sticky top-0 z-30 w-full h-0.5 bg-primary/10 overflow-hidden">
                                <div className="h-full bg-primary/40 animate-[loading-bar_1s_ease-in-out_infinite]" style={{ width: '40%' }} />
                            </div>
                        )}
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            onDragEnd={onDragEnd}
                            modifiers={[restrictToVerticalAxis]}
                            measuring={{
                                droppable: {
                                    strategy: MeasuringStrategy.Always,
                                },
                            }}

                        >
                            <div style={{
                                transition: 'padding-top 0s' // Instant padding change to prevent animation lag
                            }}>
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
                                                        {/* Standardized Handle Spacer */}
                                                        <div className="w-8"></div>
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
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
                                                    <div className="min-w-[110px] px-3 text-right">
                                                        ASSIGNED
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="text-right py-1 px-4 font-black border-b border-border w-[15%]">
                                                <div className="flex justify-end">
                                                    <div className="min-w-[110px] px-3 text-right">
                                                        ACTIVITY
                                                    </div>
                                                </div>
                                            </th>
                                            <th className="text-right py-0.5 px-4 font-black border-b border-border w-[15%]">
                                                <div className="flex justify-end">
                                                    <div className="min-w-[110px] px-3 text-right">
                                                        AVAILABLE
                                                    </div>
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        <SortableContext items={sortedGroups.map(g => `group-${g.id}`)} strategy={verticalListSortingStrategy}>
                                            {sortedGroups.map((group) => {
                                                // Hidden groups default to collapsed; regular groups default to expanded
                                                const defaultExpanded = !group.hidden;
                                                const isExpanded = activeType === 'group' ? false : (expandedGroups[group.name] ?? defaultExpanded);
                                                const allSelected = group.items.length > 0 && group.items.every(i => selectedIds.has(i.categoryId!));

                                                return (
                                                    <React.Fragment key={group.id}>
                                                        <CategoryGroupRow
                                                            group={group}
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
                                                                                // Convert milliunits → display value (÷1000)
                                                                                // so user edits "1000" not "1000000" for $1,000
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
                            </div>
                            <DragOverlay dropAnimation={{
                                duration: 200,
                                easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                            }}>
                                {activeId ? (() => {
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
                                                <tbody className="bg-background shadow-2xl rounded-2xl overflow-hidden"
                                                    style={{
                                                        boxShadow: '8px 8px 20px 0 var(--neu-dark), -8px -8px 20px 0 var(--neu-light)',
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
                                                                            <div className="p-1 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-border/50">
                                                                                <GripVertical className="w-4 h-4 text-primary" />
                                                                            </div>
                                                                            <div className="flex justify-center">
                                                                                <input type="checkbox" readOnly className="w-3.5 h-3.5 rounded border-slate-300" checked={false} />
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-2 px-2">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="p-1 rounded-lg bg-primary/20 text-primary">
                                                                                <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                                                                            </div>
                                                                            <span className="text-sm font-black text-foreground uppercase tracking-wider">{group.name}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-2 px-4 text-right">
                                                                        <div className="flex justify-end">
                                                                            <div className="min-w-[110px] px-3 text-right text-xs font-black text-muted-foreground/60 uppercase tracking-tighter">
                                                                                {formatCurrency(groupTotals.assigned)}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-2 px-4 text-right">
                                                                        <div className="flex justify-end">
                                                                            <div className="min-w-[110px] px-3 text-right text-xs font-black text-muted-foreground/40 uppercase tracking-tighter">
                                                                                {formatCurrency(groupTotals.activity)}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-2 px-4 text-right">
                                                                        <div className="flex justify-end">
                                                                            <div className="min-w-[110px] px-3 text-right text-sm font-black text-foreground tracking-tight">
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
                                                                <tr className="bg-background shadow-xl">
                                                                    <td className="py-1.5 px-6 w-10">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="p-1 rounded-lg shadow-neu-sm">
                                                                                <GripVertical className="w-3.5 h-3.5 text-primary" />
                                                                            </div>
                                                                            <div className="flex justify-center">
                                                                                <input type="checkbox" readOnly className="w-3.5 h-3.5 rounded border-slate-200" checked={false} />
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-1.5 px-2">
                                                                        <div className="flex items-center pl-4 relative">
                                                                            <div className="absolute left-0 top-0 bottom-0 w-px bg-border/40 ml-2" />
                                                                            <div className="flex items-center w-full group/text pl-4">
                                                                                <span className="text-sm font-medium text-foreground">
                                                                                    {item.categoryName}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-1.5 px-4 text-right">
                                                                        <div className="flex justify-end">
                                                                            <div className="text-sm font-black text-foreground px-2 py-1 min-w-[100px] text-right rounded-lg shadow-neu-inset-sm">
                                                                                {formatCurrency(item.assigned)}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-1.5 px-4 text-right">
                                                                        <div className="flex justify-end">
                                                                            <div className="min-w-[100px] px-2 py-1 text-right text-xs font-medium text-muted-foreground/60 tabular-nums">
                                                                                {formatCurrency(item.activity)}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-1.5 px-4 text-right">
                                                                        <div className="flex justify-end text-sm">
                                                                            <button className={`min-w-[100px] py-1 px-3 rounded-lg text-[11px] font-black text-right shadow-sm border ${item.available > 0
                                                                                ? 'bg-emerald-500 text-white border-emerald-500'
                                                                                : item.available < 0
                                                                                    ? item.overspendingType === 'credit'
                                                                                        ? 'bg-amber-500 text-white border-amber-500'
                                                                                        : 'bg-rose-500 text-white border-rose-500'
                                                                                    : 'bg-muted text-muted-foreground border-transparent'
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
                                })() : null}
                            </DragOverlay>
                        </DndContext>
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
