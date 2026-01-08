'use client';

/**
 * AI Help Widget Wrapper
 *
 * Conditionally renders the AI Help Widget only for authenticated users.
 * This prevents the widget from appearing on login/auth pages.
 */

import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { AIHelpWidget } from './index';

// Pages where the widget should NOT appear
const EXCLUDED_PATHS = ['/login', '/auth', '/unauthorized'];

export function AIHelpWidgetWrapper() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Don't show while auth is loading
  if (loading) return null;

  // Don't show if user is not authenticated
  if (!user) return null;

  // Don't show on excluded paths
  if (EXCLUDED_PATHS.some((path) => pathname.startsWith(path))) {
    return null;
  }

  return <AIHelpWidget />;
}
