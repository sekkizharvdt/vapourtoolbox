'use client';

/**
 * PO Amendment Detail Page
 *
 * View and manage amendment details with approval workflow
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
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Home as HomeIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrderAmendment, AmendmentApprovalHistory } from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import {
  getAmendmentById,
  getAmendmentApprovalHistory,
  submitAmendmentForApproval,
  approveAmendment,
  rejectAmendment,
} from '@/lib/procurement/amendment';
import {
  getAmendmentStatusText,
  getAmendmentStatusColor,
  getAmendmentTypeText,
  getAmendmentAvailableActions,
  formatCurrency,
} from '@/lib/procurement/amendmentHelpers';
import { formatDate } from '@/lib/utils/formatters';

export default function AmendmentDetailClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [amendment, setAmendment] = useState<PurchaseOrderAmendment | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<AmendmentApprovalHistory[]>([]);
  const [amendmentId, setAmendmentId] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/procurement\/amendments\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setAmendmentId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (amendmentId) {
      loadAmendment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amendmentId]);

  const loadAmendment = async () => {
    if (!amendmentId) return;
    setLoading(true);
    setError('');
    try {
      const { db } = getFirebase();

      const [amendmentData, historyData] = await Promise.all([
        getAmendmentById(db, amendmentId),
        getAmendmentApprovalHistory(db, amendmentId),
      ]);

      if (!amendmentData) {
        setError('Amendment not found');
        return;
      }

      setAmendment(amendmentData);
      setApprovalHistory(historyData);
    } catch (err) {
      console.error('[AmendmentDetailClient] Error loading amendment:', err);
      setError('Failed to load amendment');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !amendment || !amendmentId) return;

    setActionLoading(true);
    try {
      const { db } = getFirebase();
      await submitAmendmentForApproval(db, amendmentId, user.uid, user.displayName || '');
      setSubmitDialogOpen(false);
      await loadAmendment();
    } catch (err) {
      console.error('[AmendmentDetailClient] Error submitting amendment:', err);
      setError('Failed to submit amendment for approval');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!user || !amendment || !amendmentId) return;

    setActionLoading(true);
    try {
      const { db } = getFirebase();
      await approveAmendment(db, amendmentId, user.uid, user.displayName || '', approvalComments);
      setApproveDialogOpen(false);
      setApprovalComments('');
      await loadAmendment();
    } catch (err) {
      console.error('[AmendmentDetailClient] Error approving amendment:', err);
      setError('Failed to approve amendment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!user || !amendment || !amendmentId || !rejectionReason.trim()) return;

    setActionLoading(true);
    try {
      const { db } = getFirebase();
      await rejectAmendment(db, amendmentId, user.uid, user.displayName || '', rejectionReason);
      setRejectDialogOpen(false);
      setRejectionReason('');
      await loadAmendment();
    } catch (err) {
      console.error('[AmendmentDetailClient] Error rejecting amendment:', err);
      setError('Failed to reject amendment');
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

  if (error || !amendment) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Amendment not found'}</Alert>
        <Button onClick={() => router.push('/procurement/amendments')} sx={{ mt: 2 }}>
          Back to Amendments
        </Button>
      </Box>
    );
  }

  const actions = getAmendmentAvailableActions(amendment);

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
              href="/procurement/amendments"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                router.push('/procurement/amendments');
              }}
              sx={{ cursor: 'pointer' }}
            >
              Amendments
            </Link>
            <Typography color="text.primary">
              {amendment.purchaseOrderNumber} - #{amendment.amendmentNumber}
            </Typography>
          </Breadcrumbs>

          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography variant="h4">
                  {amendment.purchaseOrderNumber} - Amendment #{amendment.amendmentNumber}
                </Typography>
                <Chip
                  label={getAmendmentStatusText(amendment.status)}
                  color={getAmendmentStatusColor(amendment.status)}
                  size="medium"
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Type: {getAmendmentTypeText(amendment.amendmentType)} • Requested by:{' '}
                {amendment.requestedByName}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              {actions.canSubmit && (
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={() => setSubmitDialogOpen(true)}
                >
                  Submit for Approval
                </Button>
              )}
              {actions.canApprove && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => setApproveDialogOpen(true)}
                >
                  Approve
                </Button>
              )}
              {actions.canReject && (
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

        {/* Amendment Details */}
        <Grid container spacing={3}>
          {/* Left Column - Changes */}
          <Grid size={{ xs: 12, md: 8 }}>
            {/* Reason */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Reason for Amendment
              </Typography>
              <Typography variant="body1">{amendment.reason}</Typography>
            </Paper>

            {/* Changes */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Changes ({amendment.changes.length})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Field</TableCell>
                      <TableCell>Previous Value</TableCell>
                      <TableCell>New Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {amendment.changes.map((change, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {change.fieldLabel || change.field}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ textDecoration: 'line-through', color: 'error.main' }}
                          >
                            {change.oldValueDisplay || String(change.oldValue)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ color: 'success.main' }}>
                            {change.newValueDisplay || String(change.newValue)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* Approval History */}
            {approvalHistory.length > 0 && (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Approval History
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Action</TableCell>
                        <TableCell>By</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Comments</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {approvalHistory.map((history) => (
                        <TableRow key={history.id}>
                          <TableCell>
                            <Chip
                              label={history.action}
                              color={
                                history.action === 'APPROVED'
                                  ? 'success'
                                  : history.action === 'REJECTED'
                                    ? 'error'
                                    : 'default'
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{history.actionByName}</TableCell>
                          <TableCell>{formatDate(history.actionDate)}</TableCell>
                          <TableCell>{history.comments || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}
          </Grid>

          {/* Right Column - Summary */}
          <Grid size={{ xs: 12, md: 4 }}>
            {/* Financial Impact */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Financial Impact
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Previous Total
                  </Typography>
                  <Typography variant="h6">
                    {formatCurrency(amendment.previousGrandTotal)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    New Total
                  </Typography>
                  <Typography variant="h6">{formatCurrency(amendment.newGrandTotal)}</Typography>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Change
                  </Typography>
                  <Typography
                    variant="h5"
                    color={amendment.totalChange >= 0 ? 'success.main' : 'error.main'}
                  >
                    {amendment.totalChange >= 0 ? '+' : ''}
                    {formatCurrency(amendment.totalChange)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Details */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Details
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Purchase Order
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => router.push(`/procurement/pos/${amendment.purchaseOrderId}`)}
                  >
                    {amendment.purchaseOrderNumber}
                  </Button>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Amendment Type
                  </Typography>
                  <Chip label={getAmendmentTypeText(amendment.amendmentType)} size="small" />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Applied to PO
                  </Typography>
                  <Typography variant="body1">{amendment.applied ? 'Yes' : 'No'}</Typography>
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
                    Amendment Date
                  </Typography>
                  <Typography variant="body1">{formatDate(amendment.amendmentDate)}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Requested By
                  </Typography>
                  <Typography variant="body1">{amendment.requestedByName}</Typography>
                </Box>
                {amendment.submittedForApprovalAt && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Submitted At
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(amendment.submittedForApprovalAt)}
                    </Typography>
                  </Box>
                )}
                {amendment.approvedAt && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Approved At
                    </Typography>
                    <Typography variant="body1">{formatDate(amendment.approvedAt)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      by {amendment.approvedByName}
                    </Typography>
                  </Box>
                )}
                {amendment.rejectedAt && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Rejected At
                    </Typography>
                    <Typography variant="body1">{formatDate(amendment.rejectedAt)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      by {amendment.rejectedByName}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>

      {/* Submit Dialog */}
      <Dialog
        open={submitDialogOpen}
        onClose={() => setSubmitDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Submit for Approval</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to submit this amendment for approval?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <SendIcon />}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog
        open={approveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Approve Amendment</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to approve this amendment? This will apply the changes to the
            purchase order.
          </Typography>
          <TextField
            label="Comments (optional)"
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
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
        <DialogTitle>Reject Amendment</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Please provide a reason for rejecting this amendment:
          </Typography>
          <TextField
            label="Rejection Reason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
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
            disabled={actionLoading || !rejectionReason.trim()}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <CancelIcon />}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
