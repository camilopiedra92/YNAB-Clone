'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { addNavigationBreadcrumb } from '@/lib/sentry-utils';

/**
 * Tracks page navigation and records Sentry breadcrumbs.
 * 
 * Listens to Next.js route changes via `usePathname()` and calls
 * `addNavigationBreadcrumb(from, to)` on each transition.
 * Renders nothing — pure side-effect component.
 * 
 * Must be mounted inside the provider tree (e.g., Providers.tsx).
 */
export default function SentryNavigationTracker() {
    const pathname = usePathname();
    const prevPathRef = useRef(pathname);

    useEffect(() => {
        const prev = prevPathRef.current;
        if (prev !== pathname) {
            addNavigationBreadcrumb(prev, pathname);
            prevPathRef.current = pathname;
        }
    }, [pathname]);

    return null;
}
