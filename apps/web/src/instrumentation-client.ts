// This file exports the router transition hook for Next.js 15 instrumentation.
// The main Sentry configuration is in sentry.client.config.ts

import * as Sentry from '@sentry/nextjs';

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
