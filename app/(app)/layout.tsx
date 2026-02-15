'use client';

import dynamic from 'next/dynamic';
import GlassBackground from '@/components/GlassBackground';

// Lazy-load Sidebar with ssr: false since it uses client-side features
const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false });

/**
 * App Layout — Authenticated routes with Sidebar.
 * Uses the Stitch glassmorphic design: separated floating panels
 * with gaps, rounded corners, and glass effects.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen text-white overflow-hidden font-sans">
            <GlassBackground />
            <div className="relative z-10 flex w-full p-2 gap-2 h-screen">
                <Sidebar />
                <div className="flex-1 min-h-0 flex flex-col min-w-0">
                    {children}
                </div>
            </div>
        </div>
    );
}
