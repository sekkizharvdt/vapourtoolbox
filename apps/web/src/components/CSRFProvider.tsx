'use client';

import { useEffect } from 'react';
import { initializeCSRFToken } from '@/lib/csrf';

/**
 * CSRF Provider
 * Initializes CSRF token on client mount
 */
export function CSRFProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize CSRF token on mount
    initializeCSRFToken();
  }, []);

  return <>{children}</>;
}
