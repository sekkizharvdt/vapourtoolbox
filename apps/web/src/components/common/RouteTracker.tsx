'use client';

/**
 * Records the current route so the feedback form can tell which screen the user
 * came from. Renders nothing.
 *
 * See lib/feedback/lastAppRoute.ts for why `document.referrer` cannot be used.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { recordAppRoute } from '@/lib/feedback/lastAppRoute';

export function RouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) recordAppRoute(pathname);
  }, [pathname]);

  return null;
}
