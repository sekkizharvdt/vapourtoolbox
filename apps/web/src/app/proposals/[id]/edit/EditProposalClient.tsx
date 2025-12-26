'use client';

/**
 * Edit Proposal Client Component
 *
 * Loads ProposalWizard in edit mode with the proposal ID
 */

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Box, CircularProgress, Typography } from '@mui/material';

// Dynamic import to avoid SSR issues
const ProposalWizard = dynamic(
  () => import('../../components/ProposalWizard/ProposalWizard').then((mod) => mod.ProposalWizard),
  {
    loading: () => (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={40} />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Loading editor...
        </Typography>
      </Box>
    ),
    ssr: false,
  }
);

export default function EditProposalClient() {
  const pathname = usePathname();

  // Extract proposalId from pathname for static export compatibility
  // useParams returns 'placeholder' with static export + Firebase hosting rewrites
  const [proposalId, setProposalId] = useState<string | null>(null);

  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/proposals\/([^/]+)\/edit/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setProposalId(extractedId);
      }
    }
  }, [pathname]);

  // Show loading while extracting ID
  if (!proposalId) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={40} />
      </Box>
    );
  }

  return <ProposalWizard proposalId={proposalId} />;
}
