'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';

export default function LegacyPricingRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;
    const match = pathname.match(/\/proposals\/([^/]+)\/pricing/);
    const id = match?.[1];
    if (!id || id === 'placeholder') return;
    router.replace(`/proposals/${id}?tab=pricing`);
  }, [pathname, router]);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  );
}
