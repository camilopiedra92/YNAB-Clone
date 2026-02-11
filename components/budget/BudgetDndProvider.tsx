'use client';

import React, { useState, useLayoutEffect, useRef, useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import type { BudgetItem } from '@/hooks/useBudgetTable';
import type { BudgetResponseDTO } from '@/lib/dtos';
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
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { BudgetDragOverlayContent } from './BudgetDragOverlay';

export interface SortedGroup {
    id: number;
    name: string;
    hidden: boolean;
    items: BudgetItem[];
}

interface ReorderParams {
    type: 'group' | 'category';
    items: { id: number | null; sortOrder: number; categoryGroupId?: number }[];
}

interface BudgetDndProviderProps {
    budgetData: BudgetItem[];
    sortedGroups: SortedGroup[];
    expandedGroups: Record<string, boolean>;
    setExpandedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    budgetId: number;
    currentMonth: string;
    queryClient: QueryClient;
    reorderMutation: UseMutationResult<unknown, Error, ReorderParams>;
    tableContainerRef: React.RefObject<HTMLDivElement | null>;
    formatCurrency: (value: number) => string;
    children: React.ReactNode;
}

export function BudgetDndProvider({
    budgetData,
    sortedGroups,
    expandedGroups,
    setExpandedGroups,
    budgetId,
    currentMonth,
    queryClient,
    reorderMutation,
    tableContainerRef,
    formatCurrency,
    children,
}: BudgetDndProviderProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeType, setActiveType] = useState<'group' | 'item' | null>(null);
    const [activeTableWidth, setActiveTableWidth] = useState<number | undefined>(undefined);
    const initialScrollTop = useRef(0);
    const [dragScrollCorrection, setDragScrollCorrection] = useState(0);

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

    const onDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        const type = active.data.current?.type;
        setActiveType(type);
        setActiveTableWidth(tableContainerRef.current?.querySelector('table')?.offsetWidth);

        if (tableContainerRef.current) {
            initialScrollTop.current = tableContainerRef.current.scrollTop;
        }
    }, [tableContainerRef]);

    useLayoutEffect(() => {
        if (activeType === 'group' && tableContainerRef.current) {
            const currentScrollTop = tableContainerRef.current.scrollTop;
            const diff = initialScrollTop.current - currentScrollTop;
            setDragScrollCorrection(diff);
        } else {
            setDragScrollCorrection(0);
        }
    }, [activeId, activeType, budgetData, tableContainerRef]);

    const onDragOver = useCallback((event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeIdStr = active.id as string;
        const overId = over.id as string;

        if (activeIdStr === overId) return;

        const isActiveItem = active.data.current?.type === 'item';
        const isOverItem = over.data.current?.type === 'item';
        const isOverGroup = over.data.current?.type === 'group';

        if (isActiveItem) {
            const activeItem = budgetData.find(i => `item-${i.categoryId}` === activeIdStr);
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
                }
            }
        }
    }, [budgetData, sortedGroups, expandedGroups, setExpandedGroups]);

    const onDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveType(null);

        if (!over) return;

        const activeIdStr = active.id as string;
        const overId = over.id as string;

        if (activeIdStr === overId) return;

        if (active.data.current?.type === 'group') {
            const oldIndex = sortedGroups.findIndex(g => `group-${g.id}` === activeIdStr);
            const newIndex = sortedGroups.findIndex(g => `group-${g.id}` === overId);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newGroups = arrayMove(sortedGroups, oldIndex, newIndex);
                const newGroupIds = newGroups.map(g => g.id);

                // Reorder budgetData based on new group order
                const newBudgetData = [...budgetData].sort((a, b) => {
                    const aIndex = newGroupIds.indexOf(a.categoryGroupId);
                    const bIndex = newGroupIds.indexOf(b.categoryGroupId);
                    if (aIndex !== bIndex) return aIndex - bIndex;
                    return 0;
                });

                queryClient.setQueryData<BudgetResponseDTO>(
                    ['budget', budgetId, currentMonth],
                    (old) => old ? { ...old, budget: newBudgetData } : old
                );

                const groupsToUpdate = newGroups.map((g, index) => ({
                    id: g.id,
                    sortOrder: index
                }));

                reorderMutation.mutate({ type: 'group', items: groupsToUpdate });
            }
        } else if (active.data.current?.type === 'item') {
            const activeItem = budgetData.find(i => `item-${i.categoryId}` === activeIdStr);

            const overItem = budgetData.find(i => `item-${i.categoryId}` === overId);
            const overGroup = sortedGroups.find(g => `group-${g.id}` === overId);

            if (activeItem) {
                // Prevent moving categories from/to the Credit Card Payments group
                const activeItemGroup = sortedGroups.find(g => g.id === activeItem.categoryGroupId);
                if (activeItemGroup?.name === 'Credit Card Payments') return;
                if (overItem) {
                    const overItemGroup = sortedGroups.find(g => g.id === overItem.categoryGroupId);
                    if (overItemGroup?.name === 'Credit Card Payments') return;
                }
                if (overGroup?.name === 'Credit Card Payments') return;
                const oldIndex = budgetData.findIndex(i => `item-${i.categoryId}` === activeIdStr);

                // Moving within same group
                if (overItem && activeItem.categoryGroupId === overItem.categoryGroupId) {
                    const newIndex = budgetData.findIndex(i => `item-${i.categoryId}` === overId);
                    if (newIndex !== -1) {
                        const newBudgetData = arrayMove(budgetData, oldIndex, newIndex);
                        queryClient.setQueryData<BudgetResponseDTO>(
                            ['budget', budgetId, currentMonth],
                            (old) => old ? { ...old, budget: newBudgetData } : old
                        );

                        const groupItems = newBudgetData.filter(i => i.categoryGroupId === activeItem.categoryGroupId);
                        const categoriesToUpdate = groupItems.map((item, index) => ({
                            id: item.categoryId,
                            sortOrder: index,
                            categoryGroupId: item.categoryGroupId
                        }));

                        reorderMutation.mutate({ type: 'category', items: categoriesToUpdate });
                    }
                } else {
                    // Moved to different group
                    const newBudgetData = [...budgetData];

                    if (overItem) {
                        const oldItemIdx = newBudgetData.findIndex(i => i.categoryId === activeItem.categoryId);
                        const targetItemIdx = newBudgetData.findIndex(i => i.categoryId === overItem.categoryId);

                        const [movedItem] = newBudgetData.splice(oldItemIdx, 1);
                        newBudgetData.splice(targetItemIdx, 0, movedItem);
                    } else if (overGroup) {
                        const oldItemIdx = newBudgetData.findIndex(i => i.categoryId === activeItem.categoryId);
                        const [movedItem] = newBudgetData.splice(oldItemIdx, 1);

                        const firstGroupItemIdx = newBudgetData.findIndex(i => i.categoryGroupId === overGroup.id);
                        if (firstGroupItemIdx !== -1) {
                            newBudgetData.splice(firstGroupItemIdx, 0, movedItem);
                        } else {
                            newBudgetData.push(movedItem);
                        }
                    }

                    queryClient.setQueryData<BudgetResponseDTO>(
                        ['budget', budgetId, currentMonth],
                        (old) => old ? { ...old, budget: newBudgetData } : old
                    );

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
    }, [budgetData, sortedGroups, budgetId, currentMonth, queryClient, reorderMutation]);

    return (
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
                transition: 'padding-top 0s'
            }}>
                {children}
            </div>
            <DragOverlay dropAnimation={{
                duration: 200,
                easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}>
                {activeId ? (
                    <BudgetDragOverlayContent
                        activeId={activeId}
                        activeType={activeType}
                        activeTableWidth={activeTableWidth}
                        dragScrollCorrection={dragScrollCorrection}
                        sortedGroups={sortedGroups}
                        budgetData={budgetData}
                        formatCurrency={formatCurrency}
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

/** Whether groups should be collapsed during a group drag */
export function useCollapseOnGroupDrag(activeType: 'group' | 'item' | null): boolean {
    return activeType === 'group';
}
