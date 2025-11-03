'use client';

/**
 * View/Edit Purchase Request Page
 *
 * Displays PR details with status-based actions
 * Allows editing for DRAFT status, read-only for others
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseRequest } from '@vapour/types';
import {
  getPurchaseRequestById,
  submitPurchaseRequestForApproval,
  approvePurchaseRequest,
  rejectPurchaseRequest,
  addPurchaseRequestComment,
} from '@/lib/procurement/purchaseRequestService';

export default function ViewPurchaseRequestPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const prId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [pr, setPr] = useState<PurchaseRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialogs
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (prId) {
      loadPR();
    }
  }, [prId]);

  const loadPR = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getPurchaseRequestById(prId);
      if (!data) {
        setError('Purchase request not found');
      } else {
        setPr(data);
      }
    } catch (err) {
      console.error('[ViewPurchaseRequest] Error loading PR:', err);
      setError(err instanceof Error ? err.message : 'Failed to load purchase request');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!pr || !user) return;

    setActionLoading(true);
    setError(null);

    try {
      await submitPurchaseRequestForApproval(
        prId,
        user.uid,
        user.displayName || user.email || 'Unknown'
      );
      await loadPR();
    } catch (err) {
      console.error('[ViewPurchaseRequest] Error submitting:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit purchase request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!pr || !user) return;

    setActionLoading(true);
    setError(null);

    try {
      await approvePurchaseRequest(prId, user.uid, user.displayName || user.email || 'Unknown');
      await loadPR();
    } catch (err) {
      console.error('[ViewPurchaseRequest] Error approving:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve purchase request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!pr || !user || !rejectReason.trim()) return;

    setActionLoading(true);
    setError(null);

    try {
      await rejectPurchaseRequest(
        prId,
        user.uid,
        user.displayName || user.email || 'Unknown',
        rejectReason
      );
      setRejectDialogOpen(false);
      setRejectReason('');
      await loadPR();
    } catch (err) {
      console.error('[ViewPurchaseRequest] Error rejecting:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject purchase request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!pr || !user || !comment.trim()) return;

    setActionLoading(true);
    setError(null);

    try {
      await addPurchaseRequestComment(
        prId,
        user.uid,
        user.displayName || user.email || 'Unknown',
        comment
      );
      setCommentDialogOpen(false);
      setComment('');
      await loadPR();
    } catch (err) {
      console.error('[ViewPurchaseRequest] Error adding comment:', err);
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'default';
      case 'SUBMITTED':
        return 'info';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'error';
      case 'RFQ_CREATED':
        return 'primary';
      case 'COMPLETED':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      case 'LOW':
        return 'default';
      default:
        return 'default';
    }
  };

  const canEdit = pr?.status === 'DRAFT' && pr?.submittedBy === user?.uid;
  const canSubmit = pr?.status === 'DRAFT' && pr?.submittedBy === user?.uid;
  const canApprove = pr?.status === 'SUBMITTED'; // TODO: Add role check for Engineering Head
  const canReject = pr?.status === 'SUBMITTED'; // TODO: Add role check for Engineering Head

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !pr) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Purchase request not found'}</Alert>
        <Button onClick={() => router.back()} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconButton onClick={() => router.back()}>
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography variant="h4">{pr.number}</Typography>
              <Typography variant="body2" color="text.secondary">
                Purchase Request Details
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip label={pr.status.replace('_', ' ')} color={getStatusColor(pr.status) as any} />
            <Chip label={pr.priority} color={getPriorityColor(pr.priority) as any} />
          </Stack>
        </Stack>

        {/* Action Buttons */}
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            {canEdit && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => router.push(`/procurement/purchase-requests/${prId}/edit`)}
              >
                Edit
              </Button>
            )}
            {canSubmit && (
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={handleSubmit}
                disabled={actionLoading}
              >
                Submit for Approval
              </Button>
            )}
            {canApprove && (
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={handleApprove}
                disabled={actionLoading}
              >
                Approve
              </Button>
            )}
            {canReject && (
              <Button
                variant="contained"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => setRejectDialogOpen(true)}
                disabled={actionLoading}
              >
                Reject
              </Button>
            )}
            {pr.status === 'SUBMITTED' && (
              <Button
                variant="outlined"
                startIcon={<DescriptionIcon />}
                onClick={() => setCommentDialogOpen(true)}
              >
                Add Review Comment
              </Button>
            )}
          </Stack>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Basic Information */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  PR Number
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {pr.number}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Type
                </Typography>
                <Typography variant="body1">{pr.type}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Category
                </Typography>
                <Typography variant="body1">{pr.category}</Typography>
              </Box>
            </Stack>

            {pr.projectName && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Project
                </Typography>
                <Typography variant="body1">{pr.projectName}</Typography>
              </Box>
            )}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Submitted By
                </Typography>
                <Typography variant="body1">{pr.submittedByName}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Submitted On
                </Typography>
                <Typography variant="body1">
                  {pr.createdAt?.toDate?.()?.toLocaleDateString() || '-'}
                </Typography>
              </Box>
            </Stack>

            {pr.requiredBy && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Required By
                </Typography>
                <Typography variant="body1">
                  {pr.requiredBy.toDate?.()?.toLocaleDateString() || '-'}
                </Typography>
              </Box>
            )}

            <Box>
              <Typography variant="caption" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">{pr.description}</Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Line Items */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Line Items ({pr.itemCount || 0})
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Line #</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Equipment Code</TableCell>
                  <TableCell>Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* TODO: Load items from purchaseRequestItems collection */}
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Line items will be loaded from the items sub-collection
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Approval History */}
        {pr.status !== 'DRAFT' && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Approval History
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Stack spacing={2}>
              {pr.submittedAt && (
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label="SUBMITTED" size="small" color="info" />
                    <Typography variant="body2">
                      by {pr.submittedByName} on {pr.submittedAt.toDate?.()?.toLocaleString()}
                    </Typography>
                  </Stack>
                </Box>
              )}

              {pr.approvedAt && (
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label="APPROVED" size="small" color="success" />
                    <Typography variant="body2">
                      by {pr.approvedByName} on {pr.approvedAt.toDate?.()?.toLocaleString()}
                    </Typography>
                  </Stack>
                  {pr.approvalComments && (
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                      Comments: {pr.approvalComments}
                    </Typography>
                  )}
                </Box>
              )}

              {pr.rejectionReason && pr.status === 'REJECTED' && (
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label="REJECTED" size="small" color="error" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                    Reason: {pr.rejectionReason}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        )}

        {/* Review Comments */}
        {pr.reviewComments && pr.status === 'UNDER_REVIEW' && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Review Comments
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2">{pr.reviewComments}</Typography>
          </Paper>
        )}
      </Stack>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Purchase Request</DialogTitle>
        <DialogContent>
          <TextField
            label="Rejection Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            multiline
            rows={4}
            fullWidth
            required
            placeholder="Please provide a reason for rejection"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleReject}
            disabled={!rejectReason.trim() || actionLoading}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Review Comment Dialog */}
      <Dialog
        open={commentDialogOpen}
        onClose={() => setCommentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Review Comment</DialogTitle>
        <DialogContent>
          <TextField
            label="Review Comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            multiline
            rows={4}
            fullWidth
            required
            placeholder="Add your review comment here"
            helperText="This will move the PR to UNDER_REVIEW status"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddComment}
            disabled={!comment.trim() || actionLoading}
          >
            Add Review Comment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
