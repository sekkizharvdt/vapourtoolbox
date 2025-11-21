'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Typography, Breadcrumbs, Link as MuiLink, CircularProgress } from '@mui/material';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const ProposalWizard = dynamic(
  () =>
    import('../components/ProposalWizard/ProposalWizard').then((mod) => ({
      default: mod.ProposalWizard,
    })),
  { ssr: false }
);

function NewProposalContent() {
  const searchParams = useSearchParams();
  const enquiryId = searchParams.get('enquiryId');

  return <ProposalWizard initialEnquiryId={enquiryId || undefined} />;
}

export default function NewProposalPage() {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
          <MuiLink component={Link} href="/proposals" color="inherit">
            Proposals
          </MuiLink>
          <Typography color="text.primary">New Proposal</Typography>
        </Breadcrumbs>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Create New Proposal
        </Typography>
      </Box>

      <Suspense
        fallback={
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        }
      >
        <NewProposalContent />
      </Suspense>
    </Box>
  );
}
