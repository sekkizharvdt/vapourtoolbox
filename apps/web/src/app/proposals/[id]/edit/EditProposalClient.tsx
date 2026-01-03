'use client';

/**
 * Edit Proposal Client Component
 *
 * Loads ProposalWizard in edit mode with the proposal ID
 */

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Box, Breadcrumbs, CircularProgress, Link, Typography } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';

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
  const router = useRouter();

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

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/proposals"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/proposals');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Proposals
        </Link>
        <Typography color="text.primary">Edit</Typography>
      </Breadcrumbs>
      <ProposalWizard proposalId={proposalId} />
    </Box>
  );
}
