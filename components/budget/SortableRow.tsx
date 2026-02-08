'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRowProps {
    id: string;
    children: (listeners: any, attributes: any) => React.ReactNode;
    className?: string;
    type: 'group' | 'item';
    disabled?: boolean;
}

export function SortableRow({ id, children, className, type, disabled }: SortableRowProps) {
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
        >
            {children(listeners, attributes)}
        </tr>
    );
}
