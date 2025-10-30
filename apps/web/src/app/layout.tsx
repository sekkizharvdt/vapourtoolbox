'use client';

import { VapourThemeProvider } from '@vapour/ui';
import { CssBaseline } from '@mui/material';
import { validateFirebaseEnvironment } from '@vapour/firebase';
import { CSRFProvider } from '@/components/CSRFProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';

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
      </head>
      <body style={{ margin: 0 }}>
        <ErrorBoundary>
          <CSRFProvider>
            <AuthProvider>
              <VapourThemeProvider defaultMode="light">
                <CssBaseline />
                {children}
              </VapourThemeProvider>
            </AuthProvider>
          </CSRFProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
