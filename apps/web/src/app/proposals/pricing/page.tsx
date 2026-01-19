'use client';

/**
 * Pricing Hub Page
 *
 * Lists proposals that have estimation complete and need pricing configuration.
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
  PriceChange as PriceIcon,
  CheckCircle as CompleteIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { listProposals } from '@/lib/proposals/proposalService';
import type { Proposal } from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'PricingHubPage' });

export default function PricingHubPage() {
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

        // Get proposals with scope complete
        const allProposals = await listProposals(db, {
          entityId,
          status: 'DRAFT',
          isLatestRevision: true,
        });

        // Filter to those with scope complete (ready for pricing)
        const proposalsForPricing = allProposals.filter(
          (p) => p.scopeMatrix?.isComplete === true
        );

        setProposals(proposalsForPricing);
        logger.info('Loaded proposals for pricing', { count: proposalsForPricing.length });
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

  // Calculate estimation total from scope matrix linked BOMs
  const getEstimationTotal = (proposal: Proposal) => {
    if (!proposal.scopeMatrix) return null;

    const allItems = [
      ...(proposal.scopeMatrix.services || []),
      ...(proposal.scopeMatrix.supply || []),
    ];

    let total = 0;
    let currency = 'INR';

    allItems.forEach((item) => {
      if (item.estimationSummary?.totalCost) {
        total += item.estimationSummary.totalCost.amount;
        currency = item.estimationSummary.totalCost.currency;
      }
    });

    return total > 0 ? { amount: total, currency } : null;
  };

  const getPricingStatus = (proposal: Proposal) => {
    if (proposal.pricingConfig?.isComplete) {
      return { label: 'Complete', color: 'success' as const, icon: <CompleteIcon /> };
    }
    if (proposal.pricingConfig) {
      return { label: 'In Progress', color: 'warning' as const, icon: <WarningIcon /> };
    }
    return { label: 'Not Started', color: 'default' as const, icon: null };
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
          Pricing
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure pricing margins for proposals with completed scope and estimation
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
            <PriceIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Proposals Ready for Pricing
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Proposals need to have their scope matrix completed and estimation linked
              before pricing can be configured.
            </Typography>
            <Button variant="contained" onClick={() => router.push('/proposals/scope-matrix')}>
              Go to Scope Matrix
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {proposals.map((proposal) => {
            const estimationTotal = getEstimationTotal(proposal);
            const status = getPricingStatus(proposal);

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
                  onClick={() => router.push(`/proposals/${proposal.id}/pricing`)}
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

                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Estimation Total
                      </Typography>
                      <Typography variant="h6" color="primary.main">
                        {formatCurrency(estimationTotal ?? undefined)}
                      </Typography>
                    </Box>

                    {proposal.pricingConfig?.totalPrice && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Final Price
                        </Typography>
                        <Typography variant="h6" color="success.main">
                          {formatCurrency(proposal.pricingConfig.totalPrice)}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>

                  <CardActions>
                    <Button size="small" fullWidth>
                      {proposal.pricingConfig ? 'Edit Pricing' : 'Configure Pricing'}
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
