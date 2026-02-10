'use client';

import dynamic from 'next/dynamic';

// Lazy-load Providers with ssr: false to prevent idb-keyval (IndexedDB)
// from being imported during SSR prerendering of built-in pages
// (/_not-found, /_global-error), which crashes the production build.
const Providers = dynamic(() => import('@/components/Providers'), { ssr: false });

/**
 * ClientShell — Wraps the entire app with Providers (auth + react-query).
 * Sidebar is no longer rendered here; it's in app/(app)/layout.tsx.
 */
export default function ClientShell({ children }: { children: React.ReactNode }) {
    return (
        <Providers>
            {children}
        </Providers>
    );
}
