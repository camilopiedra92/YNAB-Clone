'use client';

import dynamic from 'next/dynamic';

// Lazy-load Sidebar with ssr: false since it uses client-side features
const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false });

/**
 * App Layout — Authenticated routes with Sidebar.
 * This route group (app) wraps all pages that need the sidebar and auth.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-background text-foreground overflow-hidden font-sans">
            <Sidebar />
            <main className="flex-1 lg:pl-[272px] min-h-screen flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </main>
        </div>
    );
}
