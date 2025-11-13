'use client';

/**
 * React Query Provider
 *
 * Provides QueryClient for data fetching, caching, and state management
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create QueryClient instance per component tree (avoids sharing between requests in SSR)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Consider data fresh for 5 minutes
            staleTime: 5 * 60 * 1000,
            // Keep unused data in cache for 10 minutes
            gcTime: 10 * 60 * 1000,
            // Retry failed requests 3 times with exponential backoff
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Refetch on window focus (good for data consistency)
            refetchOnWindowFocus: true,
            // Don't refetch on mount if data is fresh
            refetchOnMount: false,
            // Refetch on reconnect if data is stale
            refetchOnReconnect: true,
          },
          mutations: {
            // Retry mutations once on failure
            retry: 1,
            // Global error handler for mutations
            onError: (error) => {
              // Log to Sentry
              Sentry.withScope((scope) => {
                scope.setTag('queryType', 'mutation');
                scope.setLevel('error');
                Sentry.captureException(error);
              });
            },
          },
        },
        // Global query error handler
        queryCache: undefined,
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* React Query Devtools - only shown in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" position="bottom" />
      )}
    </QueryClientProvider>
  );
}
