'use client';

/**
 * Client-side Providers
 *
 * This component wraps all client-side context providers.
 * It's separated from the root layout to allow the root layout
 * to be a server component, which improves compilation performance
 * and enables better streaming/SSR.
 *
 * The providers are nested in this order (outermost to innermost):
 * 1. ErrorBoundary - Catches React errors
 * 2. CSRFProvider - Initializes CSRF token
 * 3. AuthProvider - Firebase authentication
 * 4. QueryProvider - React Query for data fetching
 * 5. VapourThemeProvider - MUI theme
 */

import { VapourThemeProvider } from '@vapour/ui';
import { validateFirebaseEnvironment } from '@vapour/firebase';
import { CSRFProvider } from '@/components/CSRFProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryProvider } from '@/lib/providers/QueryProvider';

// Validate Firebase configuration on module load
// This will throw clear errors if env variables are missing
validateFirebaseEnvironment();

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <CSRFProvider>
        <AuthProvider>
          <QueryProvider>
            <VapourThemeProvider defaultMode="light">{children}</VapourThemeProvider>
          </QueryProvider>
        </AuthProvider>
      </CSRFProvider>
    </ErrorBoundary>
  );
}
