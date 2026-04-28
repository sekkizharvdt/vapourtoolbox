'use client';

/**
 * Procurement → Quotes (list)
 *
 * The canonical vendor-quote list lives under `/materials/vendor-offers`,
 * which handles all quote source types (RFQ-linked + offline + unsolicited)
 * and is what the "Log Vendor Quote" form already redirects to after save.
 * This page just forwards there so the breadcrumb "Quotes" link from the
 * new-quote form lands somewhere useful instead of hanging on a 404.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@mui/material';

export default function ProcurementQuotesIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/materials/vendor-offers');
  }, [router]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
      <CircularProgress />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Redirecting to Vendor Offers…
      </Typography>
    </Box>
  );
}
