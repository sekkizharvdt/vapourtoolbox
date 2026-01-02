'use client';

import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Divider,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Breadcrumbs,
  Link,
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
  Home as HomeIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  Cancel as CancelIcon,
  Send as SubmitIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canApproveLeaves } from '@vapour/constants';
import {
  getOnDutyRequestById,
  submitOnDutyRequest,
  approveOnDutyRequest,
  rejectOnDutyRequest,
  cancelOnDutyRequest,
} from '@/lib/hr/onDuty';
import type { OnDutyRequest } from '@vapour/types';
import { format } from 'date-fns';

// Status display helpers
const STATUS_COLORS: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  PARTIALLY_APPROVED: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  PARTIALLY_APPROVED: 'Partially Approved',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export default function OnDutyDetailClient() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, claims } = useAuth();

  const [requestId, setRequestId] = useState<string | null>(null);
  const [request, setRequest] = useState<OnDutyRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Dialog states
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');

  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/hr\/on-duty\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setRequestId(extractedId);
      }
    }
  }, [pathname]);

  const permissions2 = claims?.permissions2 ?? 0;
  const hasApproveAccess = canApproveLeaves(permissions2);
  const isOwner = request?.userId === user?.uid;
  const canSubmit = isOwner && request?.status === 'DRAFT';

  const hasAlreadyApproved = request?.approvalFlow?.approvals?.some(
    (a) => a.approverId === user?.uid
  );

  const canApprove =
    hasApproveAccess &&
    ['PENDING_APPROVAL', 'PARTIALLY_APPROVED'].includes(request?.status || '') &&
    !hasAlreadyApproved;

  const canCancel =
    isOwner && ['DRAFT', 'PENDING_APPROVAL', 'PARTIALLY_APPROVED'].includes(request?.status || '');

  const approvalFlow = request?.approvalFlow;
  const approvalCount = approvalFlow?.approvals?.length || 0;
  const requiredCount = approvalFlow?.requiredApprovalCount || 2;

  const loadData = async () => {
    if (!requestId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getOnDutyRequestById(requestId);
      setRequest(data);
    } catch (err) {
      console.error('Failed to load on-duty request:', err);
      setError('Failed to load on-duty request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requestId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const handleSubmit = async () => {
    if (!user || !request) return;

    setProcessing(true);
    try {
      await submitOnDutyRequest(request.id, user.uid, user.displayName || 'User');
      await loadData();
    } catch (err) {
      console.error('Failed to submit:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit on-duty request');
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!user || !request) return;

    setProcessing(true);
    try {
      await approveOnDutyRequest(request.id, user.uid, user.displayName || 'Approver');
      await loadData();
    } catch (err) {
      console.error('Failed to approve:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve on-duty request');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!user || !request || !rejectionReason.trim()) return;

    setProcessing(true);
    try {
      await rejectOnDutyRequest(
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
      setError(err instanceof Error ? err.message : 'Failed to reject on-duty request');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!user || !request) return;

    setProcessing(true);
    try {
      await cancelOnDutyRequest(
        request.id,
        user.uid,
        user.displayName || 'User',
        cancellationReason || 'Cancelled by user'
      );
      setCancelDialogOpen(false);
      setCancellationReason('');
      await loadData();
    } catch (err) {
      console.error('Failed to cancel:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel on-duty request');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!request) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">On-duty request not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/hr"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/hr');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          HR
        </Link>
        <Link
          color="inherit"
          href="/hr/on-duty/my-requests"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/hr/on-duty/my-requests');
          }}
          sx={{ cursor: 'pointer' }}
        >
          On-Duty Requests
        </Link>
        <Typography color="text.primary">{request.requestNumber}</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          {request.requestNumber}
        </Typography>
        <Chip
          label={STATUS_LABELS[request.status] || request.status}
          color={STATUS_COLORS[request.status] || 'default'}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Request Details
              </Typography>
              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Employee
                  </Typography>
                  <Typography variant="body1">{request.userName}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Department
                  </Typography>
                  <Typography variant="body1">{request.department || 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Holiday Date
                  </Typography>
                  <Typography variant="body1">
                    {format(request.holidayDate.toDate(), 'dd MMM yyyy')}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Holiday Name
                  </Typography>
                  <Typography variant="body1">{request.holidayName}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="text.secondary">
                    Reason
                  </Typography>
                  <Typography variant="body1">{request.reason}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Comp-Off Granted
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {request.compOffGranted ? (
                      <>
                        <CheckCircleIcon color="success" fontSize="small" />
                        <Typography variant="body1">Yes</Typography>
                      </>
                    ) : (
                      <Typography variant="body1">Not yet</Typography>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {approvalFlow && approvalFlow.approvals.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Approval Timeline
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {approvalCount} of {requiredCount} approvals completed
                </Typography>

                <Timeline position="right">
                  {approvalFlow.approvals.map((approval, index) => (
                    <TimelineItem key={index}>
                      <TimelineOppositeContent color="text.secondary">
                        {approval.approvedAt
                          ? format(approval.approvedAt.toDate(), 'dd MMM yyyy HH:mm')
                          : 'Pending'}
                      </TimelineOppositeContent>
                      <TimelineSeparator>
                        <TimelineDot color={approval.approvedAt ? 'success' : 'grey'} />
                        {index < approvalFlow.approvals.length - 1 && <TimelineConnector />}
                      </TimelineSeparator>
                      <TimelineContent>
                        <Typography variant="h6" component="span">
                          {approval.approverName || 'Unknown Approver'}
                        </Typography>
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </Timeline>
              </CardContent>
            </Card>
          )}

          {request.status === 'REJECTED' && request.rejectionReason && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" color="error" gutterBottom>
                  Rejection Reason
                </Typography>
                <Typography>{request.rejectionReason}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Rejected by {request.rejectedByName} on{' '}
                  {request.rejectedAt && format(request.rejectedAt.toDate(), 'dd MMM yyyy HH:mm')}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Actions
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {canSubmit && (
                  <Button
                    variant="contained"
                    startIcon={<SubmitIcon />}
                    onClick={handleSubmit}
                    disabled={processing}
                    fullWidth
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
                      fullWidth
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<RejectIcon />}
                      onClick={() => setRejectDialogOpen(true)}
                      disabled={processing}
                      fullWidth
                    >
                      Reject
                    </Button>
                  </>
                )}

                {canCancel && (
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<CancelIcon />}
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={processing}
                    fullWidth
                  >
                    Cancel Request
                  </Button>
                )}

                <Button
                  variant="outlined"
                  onClick={() => router.push('/hr/on-duty/my-requests')}
                  fullWidth
                >
                  Back to Requests
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)}>
        <DialogTitle>Reject On-Duty Request</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Rejection Reason *"
            fullWidth
            multiline
            rows={4}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Provide a reason for rejecting this request"
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
            {processing ? 'Rejecting...' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Cancel On-Duty Request</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to cancel this on-duty request?
          </Typography>
          <TextField
            margin="dense"
            label="Cancellation Reason (Optional)"
            fullWidth
            multiline
            rows={3}
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            placeholder="Provide a reason for cancelling this request"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Go Back</Button>
          <Button onClick={handleCancel} color="warning" variant="contained" disabled={processing}>
            {processing ? 'Cancelling...' : 'Cancel Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
