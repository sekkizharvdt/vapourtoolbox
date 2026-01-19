'use client';

/**
 * Proposal Preview Client Component
 *
 * Preview the complete proposal before generating PDF and submitting to client.
 */

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Breadcrumbs,
  Link,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PictureAsPdf as PdfIcon,
  Send as SendIcon,
  CheckCircle as CompleteIcon,
  Home as HomeIcon,
  Business as ClientIcon,
  Engineering as ScopeIcon,
  Payments as PaymentIcon,
} from '@mui/icons-material';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getProposalById, updateProposal } from '@/lib/proposals/proposalService';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useToast } from '@/components/common/Toast';
import type { Proposal, ScopeItem, Money } from '@vapour/types';
import { PROJECT_PHASE_LABELS } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'PreviewClient' });

export default function PreviewClient() {
  const router = useRouter();
  const params = useParams();
  const proposalId = params.id as string;
  const db = useFirestore();
  const { user } = useAuth();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  // Load proposal
  useEffect(() => {
    if (!db || !proposalId || proposalId === 'placeholder') return;

    const loadProposal = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getProposalById(db, proposalId);
        if (!data) {
          setError('Proposal not found');
          return;
        }

        setProposal(data);
        logger.info('Proposal loaded for preview', { proposalId });
      } catch (err) {
        logger.error('Error loading proposal', { error: err });
        setError('Failed to load proposal');
      } finally {
        setLoading(false);
      }
    };

    loadProposal();
  }, [db, proposalId]);

  const formatCurrency = (money?: Money | null) => {
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
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const handleSubmitToClient = async () => {
    if (!db || !user || !proposal) return;

    try {
      setSubmitting(true);
      setError(null);

      await updateProposal(
        db,
        proposalId,
        {
          status: 'SUBMITTED',
          submittedAt: Timestamp.now(),
          submittedByUserId: user.uid,
          submittedByUserName: user.displayName || user.email || 'Unknown',
        },
        user.uid
      );

      toast.success('Proposal submitted to client successfully');
      logger.info('Proposal submitted', { proposalId });

      setSubmitDialogOpen(false);
      router.push('/proposals/generation');
    } catch (err) {
      logger.error('Error submitting proposal', { error: err });
      setError('Failed to submit proposal');
      toast.error('Failed to submit proposal');
    } finally {
      setSubmitting(false);
    }
  };

  // Group scope items by phase
  const getScopeItemsByPhase = (items: ScopeItem[]) => {
    const grouped: Record<string, ScopeItem[]> = {};
    items.forEach((item) => {
      const phase = item.phase || 'UNASSIGNED';
      if (!grouped[phase]) grouped[phase] = [];
      grouped[phase].push(item);
    });
    return grouped;
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error && !proposal) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!proposal) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error">Proposal not found</Alert>
      </Container>
    );
  }

  const isReadyForSubmission = proposal.pricingConfig?.isComplete && proposal.status === 'DRAFT';
  const isAlreadySubmitted = proposal.status === 'SUBMITTED';

  return (
    <Container maxWidth="lg">
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
        <Link
          color="inherit"
          href="/proposals/generation"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/proposals/generation');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Generation
        </Link>
        <Typography color="text.primary">{proposal.proposalNumber}</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/proposals/generation')}
          sx={{ mb: 2 }}
        >
          Back to Generation
        </Button>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Proposal Preview
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {proposal.proposalNumber} - Revision {proposal.revision}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isAlreadySubmitted && (
              <Chip icon={<CompleteIcon />} label="Submitted" color="success" />
            )}
            <Button variant="outlined" startIcon={<PdfIcon />} disabled>
              Generate PDF (Coming Soon)
            </Button>
            {isReadyForSubmission && (
              <Button
                variant="contained"
                color="success"
                startIcon={<SendIcon />}
                onClick={() => setSubmitDialogOpen(true)}
              >
                Submit to Client
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Proposal Preview Content */}
      <Paper sx={{ p: 4, mb: 3 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            {proposal.title}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {proposal.proposalNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Prepared: {formatDate(proposal.preparationDate)} | Valid until:{' '}
            {formatDate(proposal.validityDate)}
          </Typography>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {/* Client Information */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ClientIcon color="primary" />
              <Typography variant="h6">Client Information</Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Client
                </Typography>
                <Typography variant="body1">{proposal.clientName}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Contact Person
                </Typography>
                <Typography variant="body1">{proposal.clientContactPerson}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body1">{proposal.clientEmail}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Address
                </Typography>
                <Typography variant="body1">{proposal.clientAddress}</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Scope of Work */}
        {proposal.scopeMatrix && (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ScopeIcon color="primary" />
                <Typography variant="h6">Scope of Work</Typography>
              </Box>

              {/* Services */}
              {proposal.scopeMatrix.services.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Services
                  </Typography>
                  {Object.entries(getScopeItemsByPhase(proposal.scopeMatrix.services)).map(
                    ([phase, items]) => (
                      <Box key={phase} sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                          {phase === 'UNASSIGNED'
                            ? 'General'
                            : PROJECT_PHASE_LABELS[phase as keyof typeof PROJECT_PHASE_LABELS]}
                        </Typography>
                        <List dense>
                          {items.map((item) => (
                            <ListItem key={item.id}>
                              <ListItemText
                                primary={`${item.itemNumber}. ${item.name}`}
                                secondary={item.description}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )
                  )}
                </Box>
              )}

              {/* Supply */}
              {proposal.scopeMatrix.supply.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Supply Items
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell align="right">Qty</TableCell>
                          <TableCell>Unit</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {proposal.scopeMatrix.supply.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              {item.itemNumber}. {item.name}
                            </TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell align="right">{item.quantity || '—'}</TableCell>
                            <TableCell>{item.unit || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Exclusions */}
              {proposal.scopeMatrix.exclusions.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Exclusions
                  </Typography>
                  <List dense>
                    {proposal.scopeMatrix.exclusions.map((item) => (
                      <ListItem key={item.id}>
                        <ListItemText
                          primary={`${item.itemNumber}. ${item.name}`}
                          secondary={item.description}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pricing */}
        {proposal.pricingConfig && (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PaymentIcon color="primary" />
                <Typography variant="h6">Commercial Terms</Typography>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Base Cost (Estimation)</TableCell>
                      <TableCell align="right">
                        {formatCurrency(proposal.pricingConfig.estimationSubtotal)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Overhead ({proposal.pricingConfig.overheadPercent}%)</TableCell>
                      <TableCell align="right">
                        {formatCurrency(proposal.pricingConfig.overheadAmount)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        Contingency ({proposal.pricingConfig.contingencyPercent}%)
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(proposal.pricingConfig.contingencyAmount)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Profit ({proposal.pricingConfig.profitMarginPercent}%)</TableCell>
                      <TableCell align="right">
                        {formatCurrency(proposal.pricingConfig.profitAmount)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Subtotal</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {formatCurrency(proposal.pricingConfig.subtotalBeforeTax)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>GST ({proposal.pricingConfig.taxPercent}%)</TableCell>
                      <TableCell align="right">
                        {formatCurrency(proposal.pricingConfig.taxAmount)}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: 'primary.50' }}>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                        Total Price
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'primary.main' }}
                      >
                        {formatCurrency(proposal.pricingConfig.totalPrice)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Validity:</strong> {proposal.pricingConfig.validityDays} days from date of
                  issue
                </Typography>
                {proposal.pricing?.paymentTerms && (
                  <Typography variant="body2">
                    <strong>Payment Terms:</strong> {proposal.pricing.paymentTerms}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Terms & Conditions */}
        {proposal.terms && Object.values(proposal.terms).some(Boolean) && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Terms & Conditions
              </Typography>
              <List dense>
                {proposal.terms.warranty && (
                  <ListItem>
                    <ListItemText primary="Warranty" secondary={proposal.terms.warranty} />
                  </ListItem>
                )}
                {proposal.terms.liquidatedDamages && (
                  <ListItem>
                    <ListItemText
                      primary="Liquidated Damages"
                      secondary={proposal.terms.liquidatedDamages}
                    />
                  </ListItem>
                )}
                {proposal.terms.forceMajeure && (
                  <ListItem>
                    <ListItemText primary="Force Majeure" secondary={proposal.terms.forceMajeure} />
                  </ListItem>
                )}
                {proposal.terms.disputeResolution && (
                  <ListItem>
                    <ListItemText
                      primary="Dispute Resolution"
                      secondary={proposal.terms.disputeResolution}
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        )}
      </Paper>

      {/* Submit Confirmation Dialog */}
      <Dialog open={submitDialogOpen} onClose={() => setSubmitDialogOpen(false)}>
        <DialogTitle>Submit Proposal to Client</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to mark this proposal as submitted to the client? This will change
            the status to &quot;Submitted&quot; and record the submission date.
          </DialogContentText>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="body2">
              <strong>Proposal:</strong> {proposal.proposalNumber}
            </Typography>
            <Typography variant="body2">
              <strong>Client:</strong> {proposal.clientName}
            </Typography>
            <Typography variant="body2">
              <strong>Total Price:</strong> {formatCurrency(proposal.pricingConfig?.totalPrice)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitDialogOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            color="success"
            onClick={handleSubmitToClient}
            loading={submitting}
            startIcon={<SendIcon />}
          >
            Submit to Client
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
