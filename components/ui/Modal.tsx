'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-background/70 transition-opacity duration-500 animate-in fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className={`relative w-full ${sizeClasses[size]} neu-card rounded-[2rem] transform transition-all animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 flex flex-col max-h-[90vh]`}
                style={{
                    boxShadow: '12px 12px 30px 0 var(--neu-dark-strong), -12px -12px 30px 0 var(--neu-light-strong)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-foreground tracking-tighter">
                            {title}<span className="text-primary">.</span>
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="neu-btn p-3 rounded-xl text-muted-foreground hover:text-destructive transition-colors active:scale-90"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content — scrollable */}
                <div className="pt-2 overflow-y-auto flex-1 min-h-0">
                    {children}
                </div>
            </div>
        </div>
    );
}
