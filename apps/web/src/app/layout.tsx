'use client';

import { VapourThemeProvider } from '@vapour/ui';
import { validateFirebaseEnvironment } from '@vapour/firebase';
import { CSRFProvider } from '@/components/CSRFProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryProvider } from '@/lib/providers/QueryProvider';

// Validate Firebase configuration on module load
// This will throw clear errors if env variables are missing
validateFirebaseEnvironment();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>Vapour Toolbox</title>
        <meta name="description" content="Unified VDT Platform - Vapour Desal Technologies" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/logo.png" type="image/png" />
      </head>
      <body style={{ margin: 0 }}>
        <ErrorBoundary>
          <CSRFProvider>
            <AuthProvider>
              <QueryProvider>
                <VapourThemeProvider defaultMode="light">{children}</VapourThemeProvider>
              </QueryProvider>
            </AuthProvider>
          </CSRFProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
