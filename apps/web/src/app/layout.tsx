import type { Metadata } from 'next';
import { ClientProviders } from '@/components/ClientProviders';

/**
 * Root Layout (Server Component)
 *
 * This is a server component that provides the HTML structure.
 * All client-side providers are wrapped in ClientProviders to:
 * 1. Reduce initial bundle compilation time
 * 2. Enable better streaming and SSR
 * 3. Follow Next.js 15 App Router best practices
 */

export const metadata: Metadata = {
  title: 'Vapour Toolbox',
  description: 'Unified VDT Platform - Vapour Desal Technologies',
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/logo.png', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
