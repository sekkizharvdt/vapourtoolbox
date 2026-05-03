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
  TableRow,
  Chip,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
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
import { downloadProposalPDF, saveProposalPDF } from '@/lib/proposals/proposalPDF';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useToast } from '@/components/common/Toast';
import type { Proposal, Money } from '@vapour/types';
import { SCOPE_ITEM_CLASSIFICATION_LABELS } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';
import { createLogger } from '@vapour/logger';
import { formatDate, formatCurrency as sharedFormatCurrency } from '@/lib/utils/formatters';

const logger = createLogger({ context: 'PreviewClient' });

function formatBillingAddress(addr: unknown): string | undefined {
  if (!addr || typeof addr !== 'object') return undefined;
  const a = addr as {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
  const clean = (v: string | null | undefined): string => (v ?? '').trim();
  const lines: string[] = [];
  if (clean(a.line1)) lines.push(clean(a.line1));
  if (clean(a.line2)) lines.push(clean(a.line2));
  const cityLine = [clean(a.city), clean(a.state), clean(a.postalCode)]
    .filter((p) => p.length > 0)
    .join(', ');
  if (cityLine) lines.push(cityLine);
  if (clean(a.country)) lines.push(clean(a.country));
  const out = lines.join('\n');
  return out || undefined;
}

interface PreviewClientProps {
  proposalId?: string;
  embedded?: boolean;
}

export default function PreviewClient({ proposalId: propId, embedded }: PreviewClientProps = {}) {
  const router = useRouter();
  const params = useParams();
  const proposalId = propId || (params.id as string);
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [liveClientAddress, setLiveClientAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);

  // Load proposal + refresh client address from the live entity record so
  // old proposals with a corrupted "null, null" denormalised string render
  // the current address (per CLAUDE.md rule #13). The PDF generator does
  // the same lookup; this keeps the on-screen preview consistent.
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

        if (data.clientId) {
          try {
            const { doc: fsDoc, getDoc } = await import('firebase/firestore');
            const snap = await getDoc(fsDoc(db, 'entities', data.clientId));
            if (snap.exists()) {
              const ent = snap.data() as { billingAddress?: unknown };
              const fresh = formatBillingAddress(ent.billingAddress);
              if (fresh) setLiveClientAddress(fresh);
            }
          } catch (entErr) {
            logger.warn('Failed to refresh client address for preview', {
              error: entErr instanceof Error ? entErr.message : String(entErr),
            });
          }
        }
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
    return sharedFormatCurrency(money.amount, money.currency, {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
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
        user.uid,
        claims?.permissions ?? 0
      );

      toast.success('Proposal submitted to client successfully');
      logger.info('Proposal submitted', { proposalId });

      setSubmitDialogOpen(false);
      router.push(`/proposals/${proposalId}`);
    } catch (err) {
      logger.error('Error submitting proposal', { error: err });
      setError('Failed to submit proposal');
      toast.error('Failed to submit proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!proposal) return;

    setGeneratingPdf(true);
    setError(null);

    // Step 1 — generate + download. If this fails, the user got nothing.
    try {
      await downloadProposalPDF(proposal, {
        includeTerms: true,
        includeDeliverySchedule: true,
      });
      toast.success('PDF downloaded.');
      logger.info('PDF downloaded', { proposalId: proposal.id });
    } catch (err) {
      logger.error('Error generating PDF', { error: err });
      setError('Failed to generate PDF.');
      toast.error('Failed to generate PDF.');
      setGeneratingPdf(false);
      return;
    }

    // Step 2 — best-effort save to storage so the proposal record links to
    // the latest generated PDF. A failure here (storage 403, network blip)
    // doesn't undo the user's download — show a softer warning instead of
    // claiming the whole operation failed.
    if (db) {
      try {
        await saveProposalPDF(db, proposal, {
          includeTerms: true,
          includeDeliverySchedule: true,
        });
        const updated = await getProposalById(db, proposal.id);
        if (updated) setProposal(updated);
      } catch (err) {
        logger.warn('PDF downloaded but storage save failed', {
          proposalId: proposal.id,
          error: err instanceof Error ? err.message : String(err),
        });
        toast.info('Downloaded — but couldn’t archive the PDF to the proposal record.');
      }
    }

    setGeneratingPdf(false);
  };

  const Wrapper: React.ElementType = embedded ? Box : Container;
  const wrapperProps = embedded ? {} : { maxWidth: 'lg' as const };

  if (loading) {
    return (
      <Wrapper {...wrapperProps}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Wrapper>
    );
  }

  if (error && !proposal) {
    return (
      <Wrapper {...wrapperProps}>
        <Alert severity="error">{error}</Alert>
      </Wrapper>
    );
  }

  if (!proposal) {
    return (
      <Wrapper {...wrapperProps}>
        <Alert severity="error">Proposal not found</Alert>
      </Wrapper>
    );
  }

  const isReadyForSubmission = proposal.pricingConfig?.isComplete && proposal.status === 'DRAFT';
  const isAlreadySubmitted = proposal.status === 'SUBMITTED';

  return (
    <Wrapper {...wrapperProps}>
      {!embedded && (
        <>
          <PageBreadcrumbs
            items={[
              { label: 'Proposals', href: '/proposals', icon: <HomeIcon fontSize="small" /> },
              { label: proposal.proposalNumber, href: `/proposals/${proposalId}` },
              { label: 'Preview' },
            ]}
          />

          <Box sx={{ mb: 4 }}>
            <Button
              startIcon={<BackIcon />}
              onClick={() => router.push(`/proposals/${proposalId}`)}
              sx={{ mb: 2 }}
            >
              Back to Proposal
            </Button>

            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
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
                {proposal.generatedPdfUrl && (
                  <Button
                    variant="outlined"
                    startIcon={<PdfIcon />}
                    href={proposal.generatedPdfUrl}
                    target="_blank"
                  >
                    View PDF
                  </Button>
                )}
                <LoadingButton
                  variant="outlined"
                  startIcon={<PdfIcon />}
                  onClick={handleGeneratePDF}
                  loading={generatingPdf}
                >
                  {proposal.generatedPdfUrl ? 'Regenerate PDF' : 'Generate PDF'}
                </LoadingButton>
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
        </>
      )}

      {embedded && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {isAlreadySubmitted && <Chip icon={<CompleteIcon />} label="Submitted" color="success" />}
          {proposal.generatedPdfUrl && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<PdfIcon />}
              href={proposal.generatedPdfUrl}
              target="_blank"
            >
              View PDF
            </Button>
          )}
          <LoadingButton
            variant="outlined"
            size="small"
            startIcon={<PdfIcon />}
            onClick={handleGeneratePDF}
            loading={generatingPdf}
          >
            {proposal.generatedPdfUrl ? 'Regenerate PDF' : 'Generate PDF'}
          </LoadingButton>
          {isReadyForSubmission && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<SendIcon />}
              onClick={() => setSubmitDialogOpen(true)}
            >
              Submit to Client
            </Button>
          )}
        </Box>
      )}

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
            Prepared: {formatDate(proposal.preparationDate, 'long')} | Valid until:{' '}
            {formatDate(proposal.validityDate, 'long')}
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
                <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                  {liveClientAddress || proposal.clientAddress}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Scope of Work — Unified Scope Matrix */}
        {proposal.unifiedScopeMatrix &&
        proposal.unifiedScopeMatrix.categories.some((c) => c.items.length > 0) ? (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ScopeIcon color="primary" />
                <Typography variant="h6">Scope of Work</Typography>
              </Box>

              {/* Included items grouped by category */}
              {proposal.unifiedScopeMatrix.categories
                .filter((cat) => cat.items.some((i) => i.included))
                .map((cat) => {
                  const included = cat.items.filter((i) => i.included);
                  return (
                    <Box key={cat.id} sx={{ mb: 3 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                        {cat.label}
                      </Typography>
                      <List dense>
                        {included.map((item) => (
                          <ListItem key={item.id}>
                            <ListItemText
                              primary={`${item.itemNumber}. ${item.name}`}
                              secondary={
                                <>
                                  {item.description && (
                                    <>
                                      {item.description}
                                      <br />
                                    </>
                                  )}
                                  <Chip
                                    label={SCOPE_ITEM_CLASSIFICATION_LABELS[item.classification]}
                                    size="small"
                                    variant="outlined"
                                    color={
                                      item.classification === 'SERVICE' ? 'primary' : 'secondary'
                                    }
                                    sx={{ mt: 0.5 }}
                                  />
                                  {item.classification === 'SUPPLY' && item.quantity && (
                                    <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                                      Qty: {item.quantity} {item.unit}
                                    </Typography>
                                  )}
                                </>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  );
                })}

              {/* Exclusions & Clarifications — items the buyer asked for that aren't in this offer */}
              {(() => {
                const excluded = proposal.unifiedScopeMatrix!.categories.flatMap((cat) =>
                  cat.items.filter((i) => !i.included)
                );
                if (excluded.length === 0) return null;
                return (
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                      Exclusions and Clarifications
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      The following items from the enquiry / SOW are not included in this offer:
                    </Typography>
                    <List dense>
                      {excluded.map((item, idx) => (
                        <ListItem key={item.id} alignItems="flex-start">
                          <ListItemText
                            primary={`${idx + 1}. ${item.name}`}
                            secondary={
                              item.exclusionReason ? (
                                <Typography
                                  variant="body2"
                                  sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                                >
                                  {item.exclusionReason}
                                </Typography>
                              ) : (
                                item.description
                              )
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                );
              })()}
            </CardContent>
          </Card>
        ) : null}

        {/* Commercial Summary — mirrors the customer-facing PDF.
            Internal markup percentages (overhead / contingency / profit) are
            rolled into a single priced "scope of work" line so what the user
            sees here matches what the buyer will see. The markup breakdown
            stays on the Costing tab for internal review only. */}
        {(() => {
          const cp = proposal.clientPricing;
          if (!cp) return null;
          const costBasis = (proposal.pricingBlocks ?? []).reduce(
            (s, b) => s + (b.subtotal || 0),
            0
          );
          const overheadAmount = (costBasis * (cp.overheadPercent || 0)) / 100;
          const contingencyAmount = (costBasis * (cp.contingencyPercent || 0)) / 100;
          const profitAmount = (costBasis * (cp.profitPercent || 0)) / 100;
          const scopeLinePrice = costBasis + overheadAmount + contingencyAmount + profitAmount;
          const lumpSumTotal = cp.lumpSumLines.reduce((s, r) => s + (r.amount ?? 0), 0);
          const subtotal = scopeLinePrice + lumpSumTotal;
          const taxAmount = (subtotal * (cp.taxRate || 0)) / 100;
          const totalInr = subtotal + taxAmount;
          const fxRate = cp.fxRate ?? 1;
          const isForeignQuote = cp.currency !== 'INR' && fxRate > 0;
          const totalQuote = isForeignQuote ? totalInr / fxRate : totalInr;
          const fmt = (n: number) => formatCurrency({ amount: n, currency: 'INR' });
          const fmtQuote = (n: number) => formatCurrency({ amount: n, currency: cp.currency });
          return (
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <PaymentIcon color="primary" />
                  <Typography variant="h6">Commercial Summary</Typography>
                </Box>

                <TableContainer>
                  <Table size="small">
                    <TableBody>
                      {scopeLinePrice > 0 && (
                        <TableRow>
                          <TableCell>{proposal.title || 'Scope of Work'}</TableCell>
                          <TableCell align="right">{fmt(scopeLinePrice)}</TableCell>
                        </TableRow>
                      )}
                      {cp.lumpSumLines.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.description || '—'}</TableCell>
                          <TableCell align="right">{fmt(row.amount ?? 0)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Subtotal</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {fmt(subtotal)}
                        </TableCell>
                      </TableRow>
                      {cp.taxRate > 0 && (
                        <TableRow>
                          <TableCell>{cp.taxLabel || `Tax (${cp.taxRate}%)`}</TableCell>
                          <TableCell align="right">{fmt(taxAmount)}</TableCell>
                        </TableRow>
                      )}
                      <TableRow sx={{ bgcolor: 'primary.50' }}>
                        <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                          Total Price (INR)
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'primary.main' }}
                        >
                          {fmt(totalInr)}
                        </TableCell>
                      </TableRow>
                      {isForeignQuote && (
                        <TableRow sx={{ bgcolor: 'primary.50' }}>
                          <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                            Total quoted as {cp.currency} (1 {cp.currency} = ₹{fxRate})
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'primary.main' }}
                          >
                            {fmtQuote(totalQuote)}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {proposal.pricing?.paymentTerms && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Payment Terms:</strong> {proposal.pricing.paymentTerms}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Terms & Conditions — mirrors what the PDF will show. Renders the
            structured termsBlocks if present, falling back to the legacy
            named-slot shape for old proposals. */}
        {(() => {
          const blocks = (proposal.termsBlocks ?? [])
            .filter((b) => b.included && b.body.trim().length > 0)
            .sort((a, b) => a.order - b.order);
          if (blocks.length > 0) {
            return (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Terms &amp; Conditions
                  </Typography>
                  {blocks.map((b, idx) => (
                    <Box key={b.id} sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {idx + 1}. {b.title}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                        {b.body}
                      </Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            );
          }
          if (!proposal.terms || !Object.values(proposal.terms).some(Boolean)) return null;
          return (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Terms &amp; Conditions
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
                      <ListItemText
                        primary="Force Majeure"
                        secondary={proposal.terms.forceMajeure}
                      />
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
          );
        })()}
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
    </Wrapper>
  );
}
