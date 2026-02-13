'use client';

import { useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { MessageSquareWarning } from 'lucide-react';

/**
 * Floating button that opens the Sentry User Feedback dialog.
 * 
 * Only functional in production (where Sentry is enabled).
 * Uses the `feedbackIntegration` configured in `sentry.client.config.ts`.
 * 
 * Placed in the sidebar footer for unobtrusive access.
 */
export default function FeedbackButton() {
    const handleClick = useCallback(async () => {
        const feedback = Sentry.getFeedback();
        if (feedback) {
            const form = await feedback.createForm();
            form.appendToDom();
            form.open();
        }
    }, []);

    // Only render in production where Sentry is active
    if (process.env.NODE_ENV !== 'production') return null;

    return (
        <button
            onClick={handleClick}
            className="p-2 rounded-lg text-white/25 hover:text-white/45 transition-all duration-200"
            title="Reportar un problema"
            aria-label="Reportar un problema"
        >
            <MessageSquareWarning className="w-[15px] h-[15px]" aria-hidden="true" />
        </button>
    );
}
