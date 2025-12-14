'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Divider,
  Alert,
  Skeleton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  ArrowBack as BackIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  Cancel as CancelIcon,
  Send as SubmitIcon,
} from '@mui/icons-material';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canApproveLeaves } from '@vapour/constants';
import {
  getLeaveRequestById,
  submitLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
} from '@/lib/hr';
import type { LeaveRequest, LeaveRequestStatus } from '@vapour/types';

const STATUS_COLORS: Record<
  LeaveRequestStatus,
  'default' | 'warning' | 'success' | 'error' | 'info'
> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'info',
};

const STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LeaveDetailClient() {
  const params = useParams();
  const router = useRouter();
  const { user, claims } = useAuth();
  const requestId = params.id as string;

  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Dialog states
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');

  const permissions2 = claims?.permissions2 ?? 0;
  const hasApproveAccess = canApproveLeaves(permissions2);
  const isOwner = request?.userId === user?.uid;
  const canSubmit = isOwner && request?.status === 'DRAFT';
  const canApprove = hasApproveAccess && request?.status === 'PENDING_APPROVAL';
  const canCancel =
    isOwner && (request?.status === 'DRAFT' || request?.status === 'PENDING_APPROVAL');

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getLeaveRequestById(requestId);
      setRequest(data);
    } catch (err) {
      console.error('Failed to load leave request:', err);
      setError('Failed to load leave request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const handleSubmit = async () => {
    if (!user || !request) return;

    setProcessing(true);
    try {
      await submitLeaveRequest(request.id, user.uid, user.displayName || 'User');
      await loadData();
    } catch (err) {
      console.error('Failed to submit:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit leave request');
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!user || !request) return;

    setProcessing(true);
    try {
      await approveLeaveRequest(request.id, user.uid, user.displayName || 'Approver');
      await loadData();
    } catch (err) {
      console.error('Failed to approve:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve leave request');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!user || !request || !rejectionReason.trim()) return;

    setProcessing(true);
    try {
      await rejectLeaveRequest(
        request.id,
        user.uid,
        user.displayName || 'Approver',
        rejectionReason
      );
      setRejectDialogOpen(false);
      setRejectionReason('');
      await loadData();
    } catch (err) {
      console.error('Failed to reject:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject leave request');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!user || !request) return;

    setProcessing(true);
    try {
      await cancelLeaveRequest(
        request.id,
        user.uid,
        user.displayName || 'User',
        cancellationReason
      );
      setCancelDialogOpen(false);
      setCancellationReason('');
      await loadData();
    } catch (err) {
      console.error('Failed to cancel:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel leave request');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mb: 4 }}>
          <Skeleton variant="text" width={200} height={40} />
        </Box>
        <Skeleton variant="rectangular" height={400} />
      </Container>
    );
  }

  if (!request) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error">Leave request not found.</Alert>
        <Button startIcon={<BackIcon />} onClick={() => router.back()} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => router.back()}>
            Back
          </Button>
          <Typography variant="h5" component="h1">
            {request.requestNumber}
          </Typography>
          <Chip label={STATUS_LABELS[request.status]} color={STATUS_COLORS[request.status]} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canSubmit && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<SubmitIcon />}
              onClick={handleSubmit}
              disabled={processing}
            >
              Submit for Approval
            </Button>
          )}
          {canApprove && (
            <>
              <Button
                variant="contained"
                color="success"
                startIcon={<ApproveIcon />}
                onClick={handleApprove}
                disabled={processing}
              >
                Approve
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<RejectIcon />}
                onClick={() => setRejectDialogOpen(true)}
                disabled={processing}
              >
                Reject
              </Button>
            </>
          )}
          {canCancel && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => setCancelDialogOpen(true)}
              disabled={processing}
            >
              Cancel Request
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Request Details */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Leave Details
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Employee
                  </Typography>
                  <Typography variant="body1">{request.userName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {request.userEmail}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Leave Type
                  </Typography>
                  <Typography variant="body1">{request.leaveTypeName}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    From
                  </Typography>
                  <Typography variant="body1">{formatDate(request.startDate.toDate())}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    To
                  </Typography>
                  <Typography variant="body1">{formatDate(request.endDate.toDate())}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Number of Days
                  </Typography>
                  <Typography variant="body1">
                    {request.numberOfDays}{' '}
                    {request.isHalfDay &&
                      `(${request.halfDayType === 'FIRST_HALF' ? 'First Half' : 'Second Half'})`}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Fiscal Year
                  </Typography>
                  <Typography variant="body1">{request.fiscalYear}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" color="text.secondary">
                Reason
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                {request.reason || 'No reason provided'}
              </Typography>

              {request.rejectionReason && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Alert severity="error">
                    <Typography variant="body2" fontWeight="bold">
                      Rejection Reason:
                    </Typography>
                    <Typography variant="body2">{request.rejectionReason}</Typography>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Approval History */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                History
              </Typography>
              {request.approvalHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No history yet
                </Typography>
              ) : (
                <Timeline sx={{ p: 0, m: 0 }}>
                  {request.approvalHistory.map((record, index) => (
                    <TimelineItem key={index} sx={{ minHeight: 'auto' }}>
                      <TimelineOppositeContent sx={{ flex: 0.3, py: 1, px: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(record.timestamp.toDate())}
                        </Typography>
                      </TimelineOppositeContent>
                      <TimelineSeparator>
                        <TimelineDot
                          color={
                            record.action === 'APPROVED'
                              ? 'success'
                              : record.action === 'REJECTED'
                                ? 'error'
                                : record.action === 'CANCELLED'
                                  ? 'grey'
                                  : 'primary'
                          }
                        />
                        {index < request.approvalHistory.length - 1 && <TimelineConnector />}
                      </TimelineSeparator>
                      <TimelineContent sx={{ py: 1, px: 1 }}>
                        <Typography variant="body2" fontWeight="bold">
                          {record.action}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          by {record.actorName}
                        </Typography>
                        {record.remarks && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {record.remarks}
                          </Typography>
                        )}
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </Timeline>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Leave Request</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Reason for Rejection"
            fullWidth
            multiline
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleReject}
            color="error"
            variant="contained"
            disabled={!rejectionReason.trim() || processing}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Cancel Leave Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Are you sure you want to cancel this leave request?
          </Typography>
          <TextField
            margin="dense"
            label="Reason for Cancellation (optional)"
            fullWidth
            multiline
            rows={2}
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>No, Keep It</Button>
          <Button onClick={handleCancel} color="error" variant="contained" disabled={processing}>
            Yes, Cancel Request
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
