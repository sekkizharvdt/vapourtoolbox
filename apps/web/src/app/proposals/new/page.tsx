'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link as MuiLink,
  CircularProgress,
  Alert,
  Button,
  Paper,
} from '@mui/material';
import { ArrowForward as ArrowIcon, Assignment as EnquiryIcon } from '@mui/icons-material';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const enquiryId = searchParams.get('enquiryId');

  // If no enquiryId, show redirect message
  if (!enquiryId) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 600, mx: 'auto' }}>
        <EnquiryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Start from an Enquiry
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Proposals should be created from an enquiry after making a bid decision. This ensures
          proper tracking and workflow management.
        </Typography>
        <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
          <Typography variant="body2">
            <strong>New Workflow:</strong>
          </Typography>
          <Typography variant="body2" component="ol" sx={{ pl: 2, mb: 0 }}>
            <li>Review the enquiry</li>
            <li>Make a Bid/No-Bid decision</li>
            <li>If BID, create a proposal from the enquiry page</li>
          </Typography>
        </Alert>
        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowIcon />}
          onClick={() => router.push('/proposals/enquiries')}
        >
          Go to Enquiries
        </Button>
      </Paper>
    );
  }

  // If enquiryId is provided, show the wizard (for backward compatibility)
  // This handles cases where someone directly navigates with ?enquiryId=xxx
  return <ProposalWizard initialEnquiryId={enquiryId} />;
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
