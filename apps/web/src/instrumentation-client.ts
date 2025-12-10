// This file configures the initialization of Sentry on the client.
// For Next.js static export (output: 'export'), sentry.client.config.ts is NOT auto-loaded,
// so we must initialize Sentry here.

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: false,

  // Session Replay - single initialization to avoid duplicate warning
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.NODE_ENV || 'development',

  ignoreErrors: [
    'NetworkError',
    'Network request failed',
    'Failed to fetch',
    'Extension context invalidated',
    'Non-Error promise rejection captured',
  ],

  beforeSend(event) {
    // Filter browser extension errors
    if (event.exception?.values?.[0]?.stacktrace?.frames) {
      const frames = event.exception.values[0].stacktrace.frames;
      if (frames.some((frame) => frame.filename?.includes('chrome-extension://'))) {
        return null;
      }
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
