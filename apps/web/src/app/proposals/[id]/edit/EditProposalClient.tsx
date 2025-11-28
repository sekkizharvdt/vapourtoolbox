'use client';

/**
 * Edit Proposal Client Component
 *
 * Loads ProposalWizard in edit mode with the proposal ID
 */

import { useParams } from 'next/navigation';
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
  const params = useParams();
  const proposalId = params.id as string;

  // Handle placeholder ID for static export
  if (proposalId === 'placeholder') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={40} />
      </Box>
    );
  }

  return <ProposalWizard proposalId={proposalId} />;
}
