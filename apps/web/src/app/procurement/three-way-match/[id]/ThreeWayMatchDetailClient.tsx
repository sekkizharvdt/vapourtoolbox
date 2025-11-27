'use client';

/**
 * Three-Way Match Detail Page
 *
 * View and manage three-way match details with discrepancy resolution
 */

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Box,
  Stack,
  CircularProgress,
  Alert,
  Button,
  Paper,
  Typography,
  Chip,
  Grid,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { ThreeWayMatch, MatchLineItem, MatchDiscrepancy } from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import {
  getMatchLineItems,
  getMatchDiscrepancies,
  resolveDiscrepancy,
  approveMatch,
  rejectMatch,
} from '@/lib/procurement/threeWayMatch';
import {
  getMatchStatusText,
  getMatchStatusColor,
  formatCurrency,
  formatPercentage,
} from '@/lib/procurement/threeWayMatchHelpers';
import { formatDate } from '@/lib/utils/formatters';
import { doc, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';

export default function ThreeWayMatchDetailClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [match, setMatch] = useState<ThreeWayMatch | null>(null);
  const [lineItems, setLineItems] = useState<MatchLineItem[]>([]);
  const [discrepancies, setDiscrepancies] = useState<MatchDiscrepancy[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<MatchDiscrepancy | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionType, setResolutionType] =
    useState<NonNullable<MatchDiscrepancy['resolution']>>('ACCEPTED');

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const pathMatch = pathname.match(/\/procurement\/three-way-match\/([^/]+)(?:\/|$)/);
      const extractedId = pathMatch?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setMatchId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (matchId) {
      loadMatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const loadMatch = async () => {
    if (!matchId) return;
    setLoading(true);
    setError('');
    try {
      const { db } = getFirebase();

      // Load match document
      const matchDoc = await getDoc(doc(db, COLLECTIONS.THREE_WAY_MATCHES, matchId));
      if (!matchDoc.exists()) {
        setError('Three-Way Match not found');
        return;
      }

      const docData = matchDoc.data();
      const matchData: ThreeWayMatch = {
        id: matchDoc.id,
        matchNumber: docData.matchNumber,
        purchaseOrderId: docData.purchaseOrderId,
        poNumber: docData.poNumber,
        goodsReceiptId: docData.goodsReceiptId,
        grNumber: docData.grNumber,
        vendorBillId: docData.vendorBillId,
        vendorBillNumber: docData.vendorBillNumber,
        vendorInvoiceNumber: docData.vendorInvoiceNumber,
        vendorId: docData.vendorId,
        vendorName: docData.vendorName,
        projectId: docData.projectId,
        projectName: docData.projectName,
        status: docData.status,
        overallMatchPercentage: docData.overallMatchPercentage,
        poAmount: docData.poAmount,
        grAmount: docData.grAmount,
        invoiceAmount: docData.invoiceAmount,
        variance: docData.variance,
        variancePercentage: docData.variancePercentage,
        poTaxAmount: docData.poTaxAmount,
        invoiceTaxAmount: docData.invoiceTaxAmount,
        taxVariance: docData.taxVariance,
        totalLines: docData.totalLines,
        matchedLines: docData.matchedLines,
        unmatchedLines: docData.unmatchedLines,
        hasDiscrepancies: docData.hasDiscrepancies,
        discrepancyCount: docData.discrepancyCount,
        criticalDiscrepancyCount: docData.criticalDiscrepancyCount,
        withinTolerance: docData.withinTolerance,
        toleranceConfigId: docData.toleranceConfigId,
        requiresApproval: docData.requiresApproval,
        approvalStatus: docData.approvalStatus,
        approvedBy: docData.approvedBy,
        approvedByName: docData.approvedByName,
        approvedAt: docData.approvedAt,
        approvalComments: docData.approvalComments,
        resolved: docData.resolved,
        resolvedBy: docData.resolvedBy,
        resolvedAt: docData.resolvedAt,
        resolutionNotes: docData.resolutionNotes,
        matchType: docData.matchType,
        matchedBy: docData.matchedBy,
        matchedByName: docData.matchedByName,
        matchedAt: docData.matchedAt,
        createdAt: docData.createdAt,
        updatedAt: docData.updatedAt,
        createdBy: docData.createdBy,
        updatedBy: docData.updatedBy,
      };
      setMatch(matchData);

      // Load line items and discrepancies
      const [lineItemsData, discrepanciesData] = await Promise.all([
        getMatchLineItems(db, matchId),
        getMatchDiscrepancies(db, matchId),
      ]);

      setLineItems(lineItemsData);
      setDiscrepancies(discrepanciesData);
    } catch (err) {
      console.error('[ThreeWayMatchDetailClient] Error loading match:', err);
      setError('Failed to load three-way match');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!user || !match || !matchId) return;

    setActionLoading(true);
    try {
      const { db } = getFirebase();
      await approveMatch(db, matchId, user.uid, user.displayName || '');
      setApproveDialogOpen(false);
      await loadMatch();
    } catch (err) {
      console.error('[ThreeWayMatchDetailClient] Error approving match:', err);
      setError('Failed to approve match');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!user || !match || !matchId) return;

    setActionLoading(true);
    try {
      const { db } = getFirebase();
      await rejectMatch(db, matchId, resolutionNotes, user.uid, user.displayName || '');
      setRejectDialogOpen(false);
      setResolutionNotes('');
      await loadMatch();
    } catch (err) {
      console.error('[ThreeWayMatchDetailClient] Error rejecting match:', err);
      setError('Failed to reject match');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveDiscrepancy = async () => {
    if (!user || !selectedDiscrepancy) return;

    setActionLoading(true);
    try {
      const { db } = getFirebase();
      await resolveDiscrepancy(
        db,
        selectedDiscrepancy.id,
        resolutionType,
        user.uid,
        user.displayName || '',
        resolutionNotes
      );
      setResolveDialogOpen(false);
      setSelectedDiscrepancy(null);
      setResolutionNotes('');
      await loadMatch();
    } catch (err) {
      console.error('[ThreeWayMatchDetailClient] Error resolving discrepancy:', err);
      setError('Failed to resolve discrepancy');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !match) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Three-Way Match not found'}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/procurement/three-way-match')}
          sx={{ mt: 2 }}
        >
          Back to Three-Way Match
        </Button>
      </Box>
    );
  }

  const canApprove = match.status === 'PENDING_REVIEW' || match.status === 'PARTIALLY_MATCHED';
  const canReject = match.status === 'PENDING_REVIEW' || match.status === 'NOT_MATCHED';
  const unresolvedDiscrepancies = discrepancies.filter((d) => !d.resolved);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => router.push('/procurement/three-way-match')}
            >
              Back
            </Button>
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography variant="h4">{match.matchNumber}</Typography>
                <Chip
                  label={getMatchStatusText(match.status)}
                  color={getMatchStatusColor(match.status)}
                  size="medium"
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                PO: {match.poNumber} • GR: {match.grNumber} • Bill: {match.vendorBillNumber}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              {canApprove && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => setApproveDialogOpen(true)}
                >
                  Approve Match
                </Button>
              )}
              {canReject && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={() => setRejectDialogOpen(true)}
                >
                  Reject
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Match Details */}
        <Grid container spacing={3}>
          {/* Left Column - Line Items */}
          <Grid size={{ xs: 12, md: 8 }}>
            {/* Financial Summary */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Financial Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    PO Amount
                  </Typography>
                  <Typography variant="h6">{formatCurrency(match.poAmount)}</Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    GR Amount
                  </Typography>
                  <Typography variant="h6">{formatCurrency(match.grAmount)}</Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Invoice Amount
                  </Typography>
                  <Typography variant="h6">{formatCurrency(match.invoiceAmount)}</Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    Variance
                  </Typography>
                  <Typography
                    variant="h6"
                    color={Math.abs(match.variance) < 0.01 ? 'success.main' : 'error.main'}
                  >
                    {formatCurrency(match.variance)}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* Line Items Table */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Line Items ({lineItems.length})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">PO Qty</TableCell>
                      <TableCell align="right">GR Qty</TableCell>
                      <TableCell align="right">Bill Qty</TableCell>
                      <TableCell align="right">Variance</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.lineNumber}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell align="right">{item.orderedQuantity}</TableCell>
                        <TableCell align="right">{item.receivedQuantity}</TableCell>
                        <TableCell align="right">{item.invoicedQuantity}</TableCell>
                        <TableCell align="right">
                          <Typography
                            color={
                              Math.abs(item.quantityVariance) < 0.01 ? 'success.main' : 'error.main'
                            }
                          >
                            {item.quantityVariance}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {item.quantityMatched ? (
                            <Chip label="Matched" color="success" size="small" />
                          ) : (
                            <Chip label="Variance" color="warning" size="small" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* Discrepancies */}
            {discrepancies.length > 0 && (
              <Paper sx={{ p: 3 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 2 }}
                >
                  <Typography variant="h6">Discrepancies ({discrepancies.length})</Typography>
                  {unresolvedDiscrepancies.length > 0 && (
                    <Chip
                      icon={<WarningIcon />}
                      label={`${unresolvedDiscrepancies.length} Unresolved`}
                      color="warning"
                      size="small"
                    />
                  )}
                </Stack>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Expected</TableCell>
                        <TableCell align="right">Actual</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {discrepancies.map((discrepancy) => (
                        <TableRow key={discrepancy.id}>
                          <TableCell>
                            <Chip label={discrepancy.discrepancyType} size="small" />
                          </TableCell>
                          <TableCell>{discrepancy.description}</TableCell>
                          <TableCell align="right">{String(discrepancy.expectedValue)}</TableCell>
                          <TableCell align="right">{String(discrepancy.actualValue)}</TableCell>
                          <TableCell>
                            {discrepancy.resolved ? (
                              <Chip label="Resolved" color="success" size="small" />
                            ) : (
                              <Chip label="Pending" color="warning" size="small" />
                            )}
                          </TableCell>
                          <TableCell>
                            {!discrepancy.resolved && (
                              <Button
                                size="small"
                                onClick={() => {
                                  setSelectedDiscrepancy(discrepancy);
                                  setResolveDialogOpen(true);
                                }}
                              >
                                Resolve
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}
          </Grid>

          {/* Right Column - Details */}
          <Grid size={{ xs: 12, md: 4 }}>
            {/* Match Status */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Match Status
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Overall Match %
                  </Typography>
                  <Chip
                    label={formatPercentage(match.overallMatchPercentage)}
                    color={
                      match.overallMatchPercentage >= 95
                        ? 'success'
                        : match.overallMatchPercentage >= 80
                          ? 'warning'
                          : 'error'
                    }
                  />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Matched Lines
                  </Typography>
                  <Typography variant="body1">
                    {match.matchedLines} / {match.totalLines}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Variance %
                  </Typography>
                  <Typography
                    variant="body1"
                    color={Math.abs(match.variancePercentage) < 1 ? 'success.main' : 'error.main'}
                  >
                    {formatPercentage(match.variancePercentage)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Reference Documents */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Reference Documents
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Purchase Order
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => router.push(`/procurement/pos/${match.purchaseOrderId}`)}
                  >
                    {match.poNumber}
                  </Button>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Goods Receipt
                  </Typography>
                  <Button
                    size="small"
                    onClick={() =>
                      router.push(`/procurement/goods-receipts/${match.goodsReceiptId}`)
                    }
                  >
                    {match.grNumber}
                  </Button>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Vendor Bill
                  </Typography>
                  <Typography variant="body1">{match.vendorBillNumber}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Invoice: {match.vendorInvoiceNumber}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Timeline */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Timeline
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Matched At
                  </Typography>
                  <Typography variant="body1">{formatDate(match.matchedAt)}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Vendor
                  </Typography>
                  <Typography variant="body1">{match.vendorName}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Project
                  </Typography>
                  <Typography variant="body1">{match.projectName}</Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>

      {/* Approve Dialog */}
      <Dialog
        open={approveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Approve Three-Way Match</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to approve this three-way match?</Typography>
          {match.variance !== 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This match has a variance of {formatCurrency(match.variance)}. Approving will mark it
              as &quot;Approved with Variance&quot;.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            variant="contained"
            color="success"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Three-Way Match</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>Please provide a reason for rejecting this match:</Typography>
          <TextField
            label="Rejection Reason"
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            fullWidth
            multiline
            rows={3}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            variant="contained"
            color="error"
            disabled={actionLoading || !resolutionNotes.trim()}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <CancelIcon />}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Resolve Discrepancy Dialog */}
      <Dialog
        open={resolveDialogOpen}
        onClose={() => setResolveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Resolve Discrepancy</DialogTitle>
        <DialogContent>
          {selectedDiscrepancy && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info">
                <strong>{selectedDiscrepancy.discrepancyType}</strong>:{' '}
                {selectedDiscrepancy.description}
              </Alert>
              <FormControl fullWidth>
                <InputLabel>Resolution Type</InputLabel>
                <Select
                  value={resolutionType}
                  label="Resolution Type"
                  onChange={(e) => setResolutionType(e.target.value as typeof resolutionType)}
                >
                  <MenuItem value="ACCEPTED">Accept Variance</MenuItem>
                  <MenuItem value="CORRECTED_BY_VENDOR">Corrected by Vendor</MenuItem>
                  <MenuItem value="PRICE_ADJUSTMENT">Price Adjustment</MenuItem>
                  <MenuItem value="QUANTITY_ADJUSTMENT">Quantity Adjustment</MenuItem>
                  <MenuItem value="WAIVED">Waived</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Resolution Notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                fullWidth
                multiline
                rows={3}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setResolveDialogOpen(false);
              setSelectedDiscrepancy(null);
              setResolutionNotes('');
            }}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleResolveDiscrepancy}
            variant="contained"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            Resolve
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
