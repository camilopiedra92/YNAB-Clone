'use client';

import dynamic from 'next/dynamic';

// Lazy-load Providers with ssr: false to prevent idb-keyval (IndexedDB)
// from being imported during SSR prerendering of built-in pages
// (/_not-found, /_global-error), which crashes the production build.
const Providers = dynamic(() => import('@/components/Providers'), { ssr: false });
const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false });

export default function ClientShell({ children }: { children: React.ReactNode }) {
    return (
        <Providers>
            <div className="flex min-h-screen bg-background text-foreground overflow-hidden font-sans">
                <Sidebar />
                <main className="flex-1 lg:pl-[272px] min-h-screen flex flex-col">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {children}
                    </div>
                </main>
            </div>
        </Providers>
    );
}
