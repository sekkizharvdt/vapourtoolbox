'use client';

/**
 * Legacy Thermal Desalination landing page — merged into Thermal Calculators.
 * Redirects old /thermal bookmarks/links to the unified hub.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@vapour/ui';

export default function ThermalLandingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/thermal/calculators');
  }, [router]);

  return <LoadingState variant="page" message="Redirecting..." />;
}
