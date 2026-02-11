'use client';

import React from 'react';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRowProps extends Omit<React.HTMLAttributes<HTMLTableRowElement>, 'children' | 'id'> {
    id: string;
    children: (listeners: DraggableSyntheticListeners, attributes: DraggableAttributes) => React.ReactNode;
    type: 'group' | 'item';
    disabled?: boolean;
}

export function SortableRow({ id, children, className, type, disabled, ...rest }: SortableRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id, data: { type }, disabled });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`${className} ${isDragging ? 'opacity-0' : ''}`}
            data-sortable-id={id}
            {...rest}
        >
            {children(listeners, attributes)}
        </tr>
    );
}
