'use client';

import { useSearchParams } from 'next/navigation';
import { Box, Typography, Breadcrumbs, Link as MuiLink } from '@mui/material';
import Link from 'next/link';
import { ProposalWizard } from '../components/ProposalWizard/ProposalWizard';

export default function NewProposalPage() {
  const searchParams = useSearchParams();
  const enquiryId = searchParams.get('enquiryId');

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

      <ProposalWizard initialEnquiryId={enquiryId || undefined} />
    </Box>
  );
}
