'use client';

/**
 * Proposal Generation Hub Page
 *
 * Lists proposals that have pricing complete and are ready for document generation.
 */

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PictureAsPdf as PdfIcon,
  Send as SendIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { listProposals } from '@/lib/proposals/proposalService';
import type { Proposal } from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'GenerationHubPage' });

export default function GenerationHubPage() {
  const router = useRouter();
  const db = useFirestore();
  const { claims } = useAuth();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const entityId = claims?.entityId || 'default-entity';

  useEffect(() => {
    if (!db) return;

    const loadProposals = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get all proposals (both DRAFT with pricing complete and SUBMITTED)
        const allProposals = await listProposals(db, {
          entityId,
          isLatestRevision: true,
        });

        // Filter to those with pricing complete or already submitted
        const proposalsForGeneration = allProposals.filter(
          (p) =>
            p.pricingConfig?.isComplete === true ||
            p.status === 'SUBMITTED' ||
            p.status === 'APPROVED'
        );

        setProposals(proposalsForGeneration);
        logger.info('Loaded proposals for generation', { count: proposalsForGeneration.length });
      } catch (err) {
        logger.error('Error loading proposals', { error: err });
        setError('Failed to load proposals. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadProposals();
  }, [db, entityId]);

  const formatCurrency = (money?: { amount: number; currency: string }) => {
    if (!money) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: money.currency,
      maximumFractionDigits: 0,
    }).format(money.amount);
  };

  const formatDate = (timestamp: { toDate?: () => Date } | Date | null | undefined) => {
    if (!timestamp) return '—';
    const date =
      timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp as Date);
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const getProposalStatus = (proposal: Proposal) => {
    if (proposal.status === 'SUBMITTED') {
      return { label: 'Submitted', color: 'success' as const, icon: <SendIcon /> };
    }
    if (proposal.generatedPdfUrl) {
      return { label: 'PDF Ready', color: 'info' as const, icon: <PdfIcon /> };
    }
    if (proposal.pricingConfig?.isComplete) {
      return { label: 'Ready to Generate', color: 'warning' as const, icon: <PreviewIcon /> };
    }
    return { label: 'Draft', color: 'default' as const, icon: null };
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/proposals')}
          sx={{ mb: 2 }}
        >
          Back to Proposals Hub
        </Button>

        <Typography variant="h4" component="h1" gutterBottom>
          Proposal Generation
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Preview and generate proposal documents for client submission
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Grid container spacing={3}>
          {[1, 2, 3].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} />
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="40%" />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : proposals.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <PdfIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Proposals Ready for Generation
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Proposals need to have their pricing configuration completed before documents can be generated.
            </Typography>
            <Button variant="contained" onClick={() => router.push('/proposals/pricing')}>
              Go to Pricing
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {proposals.map((proposal) => {
            const status = getProposalStatus(proposal);

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={proposal.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 4 },
                  }}
                  onClick={() => router.push(`/proposals/${proposal.id}/preview`)}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2" color="primary">
                        {proposal.proposalNumber}
                      </Typography>
                      <Chip
                        label={status.label}
                        color={status.color}
                        size="small"
                        icon={status.icon ?? undefined}
                      />
                    </Box>

                    <Typography variant="h6" gutterBottom noWrap>
                      {proposal.title}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {proposal.clientName}
                    </Typography>

                    {proposal.pricingConfig?.totalPrice && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Total Price
                        </Typography>
                        <Typography variant="h6" color="primary.main">
                          {formatCurrency(proposal.pricingConfig.totalPrice)}
                        </Typography>
                      </Box>
                    )}

                    {proposal.submittedAt && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Submitted: {formatDate(proposal.submittedAt)}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>

                  <CardActions>
                    <Button
                      size="small"
                      fullWidth
                      startIcon={proposal.generatedPdfUrl ? <PdfIcon /> : <PreviewIcon />}
                    >
                      {proposal.generatedPdfUrl ? 'View / Regenerate' : 'Preview & Generate'}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Container>
  );
}
