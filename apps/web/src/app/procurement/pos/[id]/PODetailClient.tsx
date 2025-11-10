'use client';

/**
 * Purchase Order Detail Page
 *
 * View PO details with approval workflow
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Send as SendIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import {
  getPOById,
  getPOItems,
  submitPOForApproval,
  approvePO,
  rejectPO,
  issuePO,
  updatePOStatus,
} from '@/lib/procurement/purchaseOrderService';
import {
  getPOStatusText,
  getPOStatusColor,
  formatCurrency,
  canSubmitForApproval,
  canApprovePO,
  canRejectPO,
  canIssuePO,
  canCancelPO,
  getDeliveryStatus,
  getPaymentStatus,
  getAdvancePaymentStatus,
  formatExpectedDelivery,
} from '@/lib/procurement/purchaseOrderHelpers';

export default function PODetailPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const { user } = useAuth();

  // Extract PO ID from URL pathname
  // For static export with dynamic routes, params.id might initially be 'placeholder'
  const poId = useMemo(() => {
    const paramsId = params.id as string;
    if (paramsId && paramsId !== 'placeholder') {
      return paramsId;
    }
    const match = pathname?.match(/\/procurement\/pos\/([^/]+)(?:\/|$)/);
    return match?.[1] || paramsId;
  }, [params.id, pathname]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);

  // Dialogs
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadPO();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId]);

  const loadPO = async () => {
    setLoading(true);
    setError('');
    try {
      const [poData, itemsData] = await Promise.all([getPOById(poId), getPOItems(poId)]);

      if (!poData) {
        setError('Purchase Order not found');
        return;
      }

      setPO(poData);
      setItems(itemsData);
    } catch (err) {
      console.error('[PODetailPage] Error loading PO:', err);
      setError('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!user || !po) return;

    setActionLoading(true);
    try {
      await submitPOForApproval(poId, user.uid);
      setSubmitDialogOpen(false);
      await loadPO();
    } catch (err) {
      console.error('[PODetailPage] Error submitting PO:', err);
      setError('Failed to submit PO for approval');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!user || !po) return;

    setActionLoading(true);
    try {
      await approvePO(poId, user.uid, user.displayName || 'Unknown', approvalComments);
      setApproveDialogOpen(false);
      setApprovalComments('');
      await loadPO();
    } catch (err) {
      console.error('[PODetailPage] Error approving PO:', err);
      setError('Failed to approve PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!user || !po || !rejectionReason.trim()) return;

    setActionLoading(true);
    try {
      await rejectPO(poId, user.uid, user.displayName || 'Unknown', rejectionReason);
      setRejectDialogOpen(false);
      setRejectionReason('');
      await loadPO();
    } catch (err) {
      console.error('[PODetailPage] Error rejecting PO:', err);
      setError('Failed to reject PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssue = async () => {
    if (!user || !po) return;

    setActionLoading(true);
    try {
      await issuePO(poId, user.uid);
      setIssueDialogOpen(false);
      await loadPO();
    } catch (err) {
      console.error('[PODetailPage] Error issuing PO:', err);
      setError('Failed to issue PO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!user || !po || !cancellationReason.trim()) return;

    setActionLoading(true);
    try {
      await updatePOStatus(poId, 'CANCELLED', user.uid);
      setCancelDialogOpen(false);
      setCancellationReason('');
      await loadPO();
    } catch (err) {
      console.error('[PODetailPage] Error cancelling PO:', err);
      setError('Failed to cancel PO');
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

  if (error || !po) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Purchase Order not found'}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/procurement/pos')}
          sx={{ mt: 2 }}
        >
          Back to Purchase Orders
        </Button>
      </Box>
    );
  }

  const deliveryStatus = getDeliveryStatus(po);
  const paymentStatus = getPaymentStatus(po);
  const advancePaymentStatus = getAdvancePaymentStatus(po);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/procurement/pos')}
            sx={{ mb: 1 }}
          >
            Back to Purchase Orders
          </Button>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
          >
            <Box>
              <Typography variant="h4" gutterBottom>
                {po.number}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={getPOStatusText(po.status)} color={getPOStatusColor(po.status)} />
                {advancePaymentStatus && (
                  <Chip
                    label={advancePaymentStatus.text}
                    color={advancePaymentStatus.color}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Stack>
            </Box>
            <Stack direction="row" spacing={1}>
              {canSubmitForApproval(po) && (
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={() => setSubmitDialogOpen(true)}
                >
                  Submit for Approval
                </Button>
              )}
              {canApprovePO(po) && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckIcon />}
                  onClick={() => setApproveDialogOpen(true)}
                >
                  Approve
                </Button>
              )}
              {canRejectPO(po) && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CloseIcon />}
                  onClick={() => setRejectDialogOpen(true)}
                >
                  Reject
                </Button>
              )}
              {canIssuePO(po) && (
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={() => setIssueDialogOpen(true)}
                >
                  Issue to Vendor
                </Button>
              )}
              {canCancelPO(po) && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={() => setCancelDialogOpen(true)}
                >
                  Cancel
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Progress Indicators */}
        <Paper sx={{ p: 3 }}>
          <Stack spacing={3}>
            <Box>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography variant="body2" color="text.secondary">
                  Delivery Progress
                </Typography>
                <Chip label={deliveryStatus.text} color={deliveryStatus.color} size="small" />
              </Stack>
              <LinearProgress
                variant="determinate"
                value={po.deliveryProgress || 0}
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
            <Box>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography variant="body2" color="text.secondary">
                  Payment Progress
                </Typography>
                <Chip label={paymentStatus.text} color={paymentStatus.color} size="small" />
              </Stack>
              <LinearProgress
                variant="determinate"
                value={po.paymentProgress || 0}
                color="warning"
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
          </Stack>
        </Paper>

        {/* PO Details */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Purchase Order Details
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Vendor
                </Typography>
                <Typography variant="body1">{po.vendorName}</Typography>
              </Box>
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Offer Reference
                </Typography>
                <Typography variant="body1">{po.selectedOfferNumber || 'N/A'}</Typography>
              </Box>
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Expected Delivery
                </Typography>
                <Typography variant="body1">{formatExpectedDelivery(po)}</Typography>
              </Box>
            </Stack>

            {po.title && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Title
                </Typography>
                <Typography variant="body1">{po.title}</Typography>
              </Box>
            )}

            {po.description && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body1">{po.description}</Typography>
              </Box>
            )}

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Delivery Address
              </Typography>
              <Typography variant="body1">{po.deliveryAddress}</Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Financial Summary */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Financial Summary
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between">
              <Typography>Subtotal</Typography>
              <Typography fontWeight="medium">
                {formatCurrency(po.subtotal, po.currency)}
              </Typography>
            </Stack>
            {po.cgst > 0 && (
              <Stack direction="row" justifyContent="space-between">
                <Typography>CGST</Typography>
                <Typography>{formatCurrency(po.cgst, po.currency)}</Typography>
              </Stack>
            )}
            {po.sgst > 0 && (
              <Stack direction="row" justifyContent="space-between">
                <Typography>SGST</Typography>
                <Typography>{formatCurrency(po.sgst, po.currency)}</Typography>
              </Stack>
            )}
            {po.igst > 0 && (
              <Stack direction="row" justifyContent="space-between">
                <Typography>IGST</Typography>
                <Typography>{formatCurrency(po.igst, po.currency)}</Typography>
              </Stack>
            )}
            <Divider />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="h6">Grand Total</Typography>
              <Typography variant="h6" color="primary">
                {formatCurrency(po.grandTotal, po.currency)}
              </Typography>
            </Stack>
            {po.advancePaymentRequired && (
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                <Typography color="text.secondary">
                  Advance Payment ({po.advancePercentage}%)
                </Typography>
                <Typography color="text.secondary" fontWeight="medium">
                  {formatCurrency(po.advanceAmount || 0, po.currency)}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Paper>

        {/* Line Items */}
        <Paper>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Line Items
            </Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Line</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Delivery Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.lineNumber}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.description}</Typography>
                      {item.makeModel && (
                        <Typography variant="caption" color="text.secondary">
                          {item.makeModel}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(item.unitPrice, po.currency)}
                    </TableCell>
                    <TableCell align="right">{formatCurrency(item.amount, po.currency)}</TableCell>
                    <TableCell>
                      <Chip label={item.deliveryStatus} size="small" variant="outlined" />
                      <Typography variant="caption" display="block" color="text.secondary">
                        Delivered: {item.quantityDelivered}/{item.quantity}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Terms and Conditions */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Terms and Conditions
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Payment Terms
              </Typography>
              <Typography variant="body2">{po.paymentTerms || 'Not specified'}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Delivery Terms
              </Typography>
              <Typography variant="body2">{po.deliveryTerms || 'Not specified'}</Typography>
            </Box>
            {po.warrantyTerms && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Warranty Terms
                </Typography>
                <Typography variant="body2">{po.warrantyTerms}</Typography>
              </Box>
            )}
            {po.penaltyClause && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Penalty Clause
                </Typography>
                <Typography variant="body2">{po.penaltyClause}</Typography>
              </Box>
            )}
          </Stack>
        </Paper>

        {/* Approval Information */}
        {(po.approvedBy || po.rejectedBy) && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Approval Information
            </Typography>
            <Divider sx={{ my: 2 }} />
            {po.approvedBy && (
              <Stack spacing={1}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Approved By
                  </Typography>
                  <Typography variant="body2">{po.approvedByName}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Approved At
                  </Typography>
                  <Typography variant="body2">
                    {po.approvedAt?.toDate().toLocaleString()}
                  </Typography>
                </Box>
                {po.approvalComments && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Comments
                    </Typography>
                    <Typography variant="body2">{po.approvalComments}</Typography>
                  </Box>
                )}
              </Stack>
            )}
            {po.rejectedBy && (
              <Stack spacing={1}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Rejected By
                  </Typography>
                  <Typography variant="body2">{po.rejectedByName}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Rejected At
                  </Typography>
                  <Typography variant="body2">
                    {po.rejectedAt?.toDate().toLocaleString()}
                  </Typography>
                </Box>
                {po.rejectionReason && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      Reason
                    </Typography>
                    <Typography variant="body2">{po.rejectionReason}</Typography>
                  </Box>
                )}
              </Stack>
            )}
          </Paper>
        )}
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
          <Typography>
            Are you sure you want to submit this Purchase Order for approval? Once submitted, you
            will not be able to edit it.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmitForApproval} variant="contained" disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={20} /> : 'Submit'}
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
        <DialogTitle>Approve Purchase Order</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to approve this Purchase Order?
          </Typography>
          <TextField
            label="Comments (Optional)"
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
            multiline
            rows={3}
            fullWidth
            sx={{ mt: 2 }}
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
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Approve'}
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
        <DialogTitle>Reject Purchase Order</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>Please provide a reason for rejection:</Typography>
          <TextField
            label="Rejection Reason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            multiline
            rows={3}
            fullWidth
            required
            sx={{ mt: 2 }}
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
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Issue Dialog */}
      <Dialog
        open={issueDialogOpen}
        onClose={() => setIssueDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Issue Purchase Order</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to issue this Purchase Order to the vendor? This will send the PO
            to the vendor and mark it as issued.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={handleIssue} variant="contained" disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={20} /> : 'Issue'}
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
        <DialogTitle>Cancel Purchase Order</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>Please provide a reason for cancellation:</Typography>
          <TextField
            label="Cancellation Reason"
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            multiline
            rows={3}
            fullWidth
            required
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleCancel}
            variant="contained"
            color="error"
            disabled={actionLoading || !cancellationReason.trim()}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Cancel PO'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
