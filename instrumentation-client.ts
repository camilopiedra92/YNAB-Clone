import * as Sentry from "@sentry/nextjs";
import "./sentry.client.config";

// Required by @sentry/nextjs to instrument App Router navigations.
// Without this export, client-side route transitions won't be captured as spans.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
