'use client';

import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const titleId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;

    // Focus trap — keep focus within modal
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
            return;
        }

        if (e.key !== 'Tab' || !modalRef.current) return;

        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            // Save previously focused element
            previousFocusRef.current = document.activeElement as HTMLElement;
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';

            // Focus first focusable element inside modal
            requestAnimationFrame(() => {
                if (modalRef.current) {
                    const firstFocusable = modalRef.current.querySelector<HTMLElement>(
                        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
                    );
                    firstFocusable?.focus();
                }
            });
        } else {
            document.body.style.overflow = 'unset';
            // Restore focus on close
            previousFocusRef.current?.focus();
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Overlay — frosted glass */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-500 animate-in fade-in"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal — glass panel */}
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={`relative w-full ${sizeClasses[size]} glass-panel-strong rounded-2xl p-6 transform transition-all animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 flex flex-col max-h-[90vh]`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 flex-shrink-0">
                    <div>
                        <h2 id={titleId} className="text-2xl font-bold text-white tracking-tight">
                            {title}<span className="text-primary">.</span>
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="p-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all active:scale-90"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Content — scrollable */}
                <div className="pt-2 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>
    );
}
