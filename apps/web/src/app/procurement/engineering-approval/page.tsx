'use client';

/**
 * Engineering Approval Dashboard
 *
 * Shows all submitted PRs awaiting Engineering Head approval
 * Quick approve/reject actions
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseRequest } from '@vapour/types';
import {
  listPurchaseRequests,
  approvePurchaseRequest,
  rejectPurchaseRequest,
} from '@/lib/procurement/purchaseRequest';
import { formatDate } from '@/lib/utils/formatters';

export default function EngineeringApprovalPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [selectedPR, setSelectedPR] = useState<PurchaseRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialogs
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadPendingRequests();
  }, []);

  const loadPendingRequests = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get all submitted PRs awaiting approval
      const result = await listPurchaseRequests({
        status: 'SUBMITTED',
      });
      setRequests(result.items);
    } catch (err) {
      console.error('[EngineeringApproval] Error loading requests:', err);
      setError(err instanceof Error ? err.message : 'Failed to load purchase requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = (pr: PurchaseRequest) => {
    setSelectedPR(pr);
    setApprovalComments('');
    setApproveDialogOpen(true);
  };

  const handleRejectClick = (pr: PurchaseRequest) => {
    setSelectedPR(pr);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedPR || !user) return;

    setActionLoading(true);
    setError(null);

    try {
      await approvePurchaseRequest(
        selectedPR.id,
        user.uid,
        user.displayName || user.email || 'Unknown',
        approvalComments.trim() || undefined
      );

      setApproveDialogOpen(false);
      setSelectedPR(null);
      setApprovalComments('');
      await loadPendingRequests();
    } catch (err) {
      console.error('[EngineeringApproval] Error approving:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve purchase request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPR || !user || !rejectionReason.trim()) return;

    setActionLoading(true);
    setError(null);

    try {
      await rejectPurchaseRequest(
        selectedPR.id,
        user.uid,
        user.displayName || user.email || 'Unknown',
        rejectionReason
      );

      setRejectDialogOpen(false);
      setSelectedPR(null);
      setRejectionReason('');
      await loadPendingRequests();
    } catch (err) {
      console.error('[EngineeringApproval] Error rejecting:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject purchase request');
    } finally {
      setActionLoading(false);
    }
  };

  const getPriorityColor = (
    priority: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Typography variant="h4" gutterBottom>
            Engineering Approval Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review and approve purchase requests submitted by the team
          </Typography>
        </Box>

        {/* Stats */}
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" spacing={4}>
            <Box>
              <Typography variant="h3" color="primary">
                {requests.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending Approvals
              </Typography>
            </Box>
            <Box>
              <Typography variant="h3" color="warning.main">
                {requests.filter((r) => r.priority === 'URGENT').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Urgent
              </Typography>
            </Box>
            <Box>
              <Typography variant="h3" color="info.main">
                {requests.filter((r) => r.type === 'PROJECT').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Project PRs
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Requests Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>PR Number</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Submitted By</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                    <Typography variant="body1" fontWeight={600}>
                      All Caught Up!
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      No purchase requests awaiting approval
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow
                    key={request.id}
                    hover
                    sx={{
                      bgcolor: request.priority === 'URGENT' ? 'error.lighter' : undefined,
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {request.number}
                      </Typography>
                    </TableCell>
                    <TableCell>{request.projectName || '-'}</TableCell>
                    <TableCell>{request.description || '-'}</TableCell>
                    <TableCell>{request.submittedByName}</TableCell>
                    <TableCell>
                      <Chip
                        label={request.priority}
                        size="small"
                        color={getPriorityColor(request.priority)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={request.type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{request.itemCount || 0}</TableCell>
                    <TableCell>{formatDate(request.submittedAt)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <IconButton
                          size="small"
                          onClick={() =>
                            router.push(`/procurement/purchase-requests/${request.id}`)
                          }
                          title="View Details"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleApproveClick(request)}
                          title="Approve"
                        >
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRejectClick(request)}
                          title="Reject"
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

      {/* Approve Dialog */}
      <Dialog
        open={approveDialogOpen}
        onClose={() => setApproveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Approve Purchase Request</DialogTitle>
        <DialogContent>
          {selectedPR && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="success">
                <Typography variant="body2">
                  You are about to approve <strong>{selectedPR.number}</strong>
                </Typography>
                <Typography variant="body2">Submitted by: {selectedPR.submittedByName}</Typography>
                <Typography variant="body2">Description: {selectedPR.description}</Typography>
              </Alert>

              <TextField
                label="Comments (Optional)"
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                multiline
                rows={3}
                fullWidth
                placeholder="Add any comments about this approval"
              />

              <Alert severity="info">
                After approval, this PR will proceed to RFQ creation by the Procurement team.
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={handleApprove}
            disabled={actionLoading}
          >
            {actionLoading ? 'Approving...' : 'Approve'}
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
        <DialogTitle>Reject Purchase Request</DialogTitle>
        <DialogContent>
          {selectedPR && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="error">
                <Typography variant="body2">
                  You are about to reject <strong>{selectedPR.number}</strong>
                </Typography>
                <Typography variant="body2">Submitted by: {selectedPR.submittedByName}</Typography>
                <Typography variant="body2">Description: {selectedPR.description}</Typography>
              </Alert>

              <TextField
                label="Rejection Reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                multiline
                rows={4}
                fullWidth
                required
                placeholder="Please provide a detailed reason for rejection"
                error={rejectionReason.trim() === ''}
                helperText={rejectionReason.trim() === '' ? 'Rejection reason is required' : ''}
              />

              <Alert severity="warning">
                The submitter will be notified of this rejection and can revise the PR.
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<CancelIcon />}
            onClick={handleReject}
            disabled={!rejectionReason.trim() || actionLoading}
          >
            {actionLoading ? 'Rejecting...' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
