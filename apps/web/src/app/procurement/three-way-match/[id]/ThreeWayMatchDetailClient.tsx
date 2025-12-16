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
  Typography,
  Chip,
  Grid,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Home as HomeIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
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
import { getMatchStatusText, getMatchStatusColor } from '@/lib/procurement/threeWayMatchHelpers';
import { doc, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import {
  ApproveDialog,
  RejectDialog,
  ResolveDiscrepancyDialog,
  MatchSidebar,
  LineItemsTable,
  DiscrepanciesTable,
  FinancialSummary,
} from './components';

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
        <Button onClick={() => router.push('/procurement/three-way-match')} sx={{ mt: 2 }}>
          Back to Three-Way Match
        </Button>
      </Box>
    );
  }

  const canApprove = match.status === 'PENDING_REVIEW' || match.status === 'PARTIALLY_MATCHED';
  const canReject = match.status === 'PENDING_REVIEW' || match.status === 'NOT_MATCHED';

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Breadcrumbs sx={{ mb: 2 }}>
            <Link
              color="inherit"
              href="/procurement"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                router.push('/procurement');
              }}
              sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
              Procurement
            </Link>
            <Link
              color="inherit"
              href="/procurement/three-way-match"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                router.push('/procurement/three-way-match');
              }}
              sx={{ cursor: 'pointer' }}
            >
              Three-Way Match
            </Link>
            <Typography color="text.primary">{match.matchNumber}</Typography>
          </Breadcrumbs>

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
            <FinancialSummary match={match} />
            <LineItemsTable lineItems={lineItems} />
            <DiscrepanciesTable
              discrepancies={discrepancies}
              onResolve={(discrepancy) => {
                setSelectedDiscrepancy(discrepancy);
                setResolveDialogOpen(true);
              }}
            />
          </Grid>

          {/* Right Column - Details */}
          <Grid size={{ xs: 12, md: 4 }}>
            <MatchSidebar match={match} />
          </Grid>
        </Grid>
      </Stack>

      {/* Dialogs */}
      <ApproveDialog
        open={approveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        onApprove={handleApprove}
        loading={actionLoading}
        variance={match.variance}
      />

      <RejectDialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        onReject={handleReject}
        loading={actionLoading}
        notes={resolutionNotes}
        onNotesChange={setResolutionNotes}
      />

      <ResolveDiscrepancyDialog
        open={resolveDialogOpen}
        onClose={() => {
          setResolveDialogOpen(false);
          setSelectedDiscrepancy(null);
          setResolutionNotes('');
        }}
        onResolve={handleResolveDiscrepancy}
        loading={actionLoading}
        discrepancy={selectedDiscrepancy}
        resolutionType={resolutionType}
        onResolutionTypeChange={setResolutionType}
        notes={resolutionNotes}
        onNotesChange={setResolutionNotes}
      />
    </Box>
  );
}
