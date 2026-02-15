'use client';

import { Toaster } from 'sonner';
import SyncStatus from './ui/SyncStatus';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <main id="main-content" className="h-full overflow-hidden">
                {children}
            </main>
            <Toaster
                position="bottom-left"
                toastOptions={{
                    style: {
                        borderRadius: '1rem',
                        fontSize: '13px',
                        fontWeight: 700,
                    },
                }}
                richColors
                closeButton
            />
            <SyncStatus />
        </>
    );
}
