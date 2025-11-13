import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Replay settings for session replay
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Environment configuration
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.NODE_ENV || 'development',

  // Ignore common errors that aren't actionable
  ignoreErrors: [
    // Network errors
    'NetworkError',
    'Network request failed',
    'Failed to fetch',
    // Browser extensions
    'Extension context invalidated',
    // Non-errors
    'Non-Error promise rejection captured',
  ],

  // Filter out breadcrumbs and transactions from third-party scripts
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'ui.click') {
      // Filter out clicks on certain elements if needed
      return breadcrumb;
    }
    return breadcrumb;
  },

  beforeSend(event) {
    // Filter out errors from browser extensions
    if (event.exception?.values?.[0]?.stacktrace?.frames) {
      const frames = event.exception.values[0].stacktrace.frames;
      if (frames.some((frame) => frame.filename?.includes('chrome-extension://'))) {
        return null;
      }
    }
    return event;
  },
});
