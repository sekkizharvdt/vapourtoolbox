'use client';

/**
 * Goods Receipt Detail Page
 *
 * View goods receipt details with completion and payment approval workflow
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
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Home as HomeIcon,
  CheckCircle as CheckCircleIcon,
  Payment as PaymentIcon,
  Warning as WarningIcon,
  Receipt as ReceiptIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { GoodsReceipt, GoodsReceiptItem } from '@vapour/types';
import {
  getGRById,
  getGRItems,
  completeGR,
  approveGRForPayment,
} from '@/lib/procurement/goodsReceiptService';
import {
  createBillFromGoodsReceipt,
  sendGRToAccounting,
} from '@/lib/procurement/accountingIntegration';
import { getFirebase } from '@/lib/firebase';
import { ApproverSelector } from '@/components/common/forms/ApproverSelector';
import {
  getGRStatusText,
  getGRStatusColor,
  getConditionText,
  getConditionColor,
  getOverallConditionText,
  getOverallConditionColor,
  getInspectionTypeText,
  getGRAvailableActions,
} from '@/lib/procurement/goodsReceiptHelpers';
import { formatDate } from '@/lib/utils/formatters';

export default function GRDetailClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, claims } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gr, setGR] = useState<GoodsReceipt | null>(null);
  const [items, setItems] = useState<GoodsReceiptItem[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [grId, setGrId] = useState<string | null>(null);

  // Dialog states
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [sendToAccountingOpen, setSendToAccountingOpen] = useState(false);
  const [selectedAccountingUserId, setSelectedAccountingUserId] = useState<string | null>(null);
  const [selectedAccountingUserName, setSelectedAccountingUserName] = useState('');

  const isAccountingUser = hasPermission(
    claims?.permissions ?? 0,
    PERMISSION_FLAGS.MANAGE_ACCOUNTING
  );

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/procurement\/goods-receipts\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setGrId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (grId) {
      loadGR();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grId]);

  const loadGR = async () => {
    if (!grId) return;
    setLoading(true);
    setError('');
    try {
      const [grData, itemsData] = await Promise.all([getGRById(grId), getGRItems(grId)]);

      if (!grData) {
        setError('Goods Receipt not found');
        return;
      }

      setGR(grData);
      setItems(itemsData);
    } catch (err) {
      console.error('[GRDetailClient] Error loading Goods Receipt:', err);
      setError('Failed to load goods receipt');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!user || !gr || !grId) return;

    setActionLoading(true);
    try {
      await completeGR(grId, user.uid, user.email || '');
      setCompleteDialogOpen(false);
      await loadGR();
    } catch (err) {
      console.error('[GRDetailClient] Error completing GR:', err);
      setError('Failed to complete goods receipt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBill = async () => {
    if (!user || !gr || !grId) return;

    setActionLoading(true);
    setError('');
    try {
      const { db } = getFirebase();
      await createBillFromGoodsReceipt(db, gr, user.uid, user.email || '');
      await loadGR();
    } catch (err) {
      console.error('[GRDetailClient] Error creating bill:', err);
      setError(
        'Failed to create bill. Please try again or create a bill manually from the Accounting module.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendToAccounting = async () => {
    if (!user || !gr || !grId || !selectedAccountingUserId) return;

    setActionLoading(true);
    setError('');
    try {
      const { db } = getFirebase();
      await sendGRToAccounting(
        db,
        gr,
        selectedAccountingUserId,
        selectedAccountingUserName,
        user.uid,
        user.displayName || user.email || ''
      );
      setSendToAccountingOpen(false);
      setSelectedAccountingUserId(null);
      setSelectedAccountingUserName('');
      await loadGR();
    } catch (err) {
      console.error('[GRDetailClient] Error sending to accounting:', err);
      setError('Failed to send to accounting. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprovePayment = async () => {
    if (!user || !gr || !grId) return;

    setActionLoading(true);
    try {
      // Bank account selection can be added in future; using default for now
      await approveGRForPayment(grId, '', user.uid, user.email || '');
      setPaymentDialogOpen(false);
      await loadGR();
    } catch (err) {
      console.error('[GRDetailClient] Error approving payment:', err);
      setError('Failed to approve payment');
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

  if (error || !gr) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Goods Receipt not found'}</Alert>
        <Button onClick={() => router.push('/procurement/goods-receipts')} sx={{ mt: 2 }}>
          Back to Goods Receipts
        </Button>
      </Box>
    );
  }

  const actions = getGRAvailableActions(gr);

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
              href="/procurement/goods-receipts"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                router.push('/procurement/goods-receipts');
              }}
              sx={{ cursor: 'pointer' }}
            >
              Goods Receipts
            </Link>
            <Typography color="text.primary">{gr.number}</Typography>
          </Breadcrumbs>

          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography variant="h4">{gr.number}</Typography>
                <Chip
                  label={getGRStatusText(gr.status)}
                  color={getGRStatusColor(gr.status)}
                  size="medium"
                />
                {gr.hasIssues && (
                  <Chip
                    icon={<WarningIcon />}
                    label="Has Issues"
                    color="error"
                    variant="outlined"
                    size="medium"
                  />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                PO: {gr.poNumber} • Project: {gr.projectName}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              {actions.canComplete && (
                <Button
                  variant="contained"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => setCompleteDialogOpen(true)}
                >
                  Complete GR
                </Button>
              )}
              {actions.canCreateBill && isAccountingUser && (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={actionLoading ? <CircularProgress size={20} /> : <ReceiptIcon />}
                  onClick={handleCreateBill}
                  disabled={actionLoading}
                >
                  Create Bill
                </Button>
              )}
              {actions.canSendToAccounting && !isAccountingUser && (
                <Button
                  variant="contained"
                  color="warning"
                  startIcon={<SendIcon />}
                  onClick={() => setSendToAccountingOpen(true)}
                  disabled={actionLoading}
                >
                  Send to Accounting
                </Button>
              )}
              {gr.sentToAccountingAt && !gr.paymentRequestId && !isAccountingUser && (
                <Chip
                  label={`Sent to Accounting — ${gr.accountingAssigneeName || 'Pending'}`}
                  color="info"
                  variant="outlined"
                />
              )}
              {actions.canApprovePayment && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<PaymentIcon />}
                  onClick={() => setPaymentDialogOpen(true)}
                >
                  Approve Payment
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Goods Receipt Details */}
        <Grid container spacing={3}>
          {/* Left Column - Items */}
          <Grid size={{ xs: 12, md: 8 }}>
            {/* Inspection Information */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Inspection Details
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Inspection Type
                  </Typography>
                  <Typography variant="body1">
                    {getInspectionTypeText(gr.inspectionType)}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Inspection Location
                  </Typography>
                  <Typography variant="body1">{gr.inspectionLocation}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Inspection Date
                  </Typography>
                  <Typography variant="body1">{formatDate(gr.inspectionDate)}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Inspected By
                  </Typography>
                  <Typography variant="body1">{gr.inspectedByName}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Overall Condition
                  </Typography>
                  <Chip
                    label={getOverallConditionText(gr.overallCondition)}
                    color={getOverallConditionColor(gr.overallCondition)}
                    size="small"
                  />
                </Grid>
              </Grid>
              {gr.overallNotes && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Notes
                  </Typography>
                  <Typography variant="body2">{gr.overallNotes}</Typography>
                </Box>
              )}
            </Paper>

            {/* Items Table */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Received Items ({items.length})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Ordered</TableCell>
                      <TableCell align="right">Received</TableCell>
                      <TableCell align="right">Accepted</TableCell>
                      <TableCell align="right">Rejected</TableCell>
                      <TableCell>Condition</TableCell>
                      <TableCell>Issues</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.lineNumber}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{item.description}</Typography>
                          {item.equipmentCode && (
                            <Typography variant="caption" color="text.secondary">
                              {item.equipmentCode}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{item.orderedQuantity}</TableCell>
                        <TableCell align="right">{item.receivedQuantity}</TableCell>
                        <TableCell align="right">
                          <Typography
                            color={
                              item.acceptedQuantity === item.receivedQuantity
                                ? 'success.main'
                                : 'warning.main'
                            }
                          >
                            {item.acceptedQuantity}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            color={item.rejectedQuantity > 0 ? 'error.main' : 'text.primary'}
                          >
                            {item.rejectedQuantity}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getConditionText(item.condition)}
                            color={getConditionColor(item.condition)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {item.hasIssues ? (
                            <Chip label="Yes" color="error" size="small" variant="outlined" />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Right Column - Summary */}
          <Grid size={{ xs: 12, md: 4 }}>
            {/* Status Summary */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Status
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Receipt Status
                  </Typography>
                  <Chip
                    label={getGRStatusText(gr.status)}
                    color={getGRStatusColor(gr.status)}
                    size="small"
                  />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Payment Approval
                  </Typography>
                  {gr.approvedForPayment ? (
                    <Chip label="Approved" color="success" size="small" />
                  ) : (
                    <Chip label="Pending" color="default" size="small" />
                  )}
                </Box>
                {gr.paymentApprovedBy && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Payment Approved At
                    </Typography>
                    <Typography variant="body2">{formatDate(gr.paymentApprovedAt)}</Typography>
                  </Box>
                )}
              </Stack>
            </Paper>

            {/* Issues Summary */}
            {gr.hasIssues && gr.issuesSummary && (
              <Paper
                sx={{
                  p: 3,
                  mb: 3,
                  borderColor: 'error.main',
                  borderWidth: 1,
                  borderStyle: 'solid',
                }}
              >
                <Typography variant="h6" gutterBottom color="error">
                  Issues Found
                </Typography>
                <Typography variant="body2">{gr.issuesSummary}</Typography>
              </Paper>
            )}

            {/* Timeline */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Timeline
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body1">{formatDate(gr.createdAt)}</Typography>
                </Box>
                {gr.packingListNumber && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Packing List
                    </Typography>
                    <Typography variant="body1">{gr.packingListNumber}</Typography>
                  </Box>
                )}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>

      {/* Complete Dialog */}
      <Dialog
        open={completeDialogOpen}
        onClose={() => setCompleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Complete Goods Receipt</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to mark this goods receipt as completed? You can then send it to
            the accounting team for bill creation.
          </Typography>
          {gr.hasIssues && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This goods receipt has reported issues. Make sure all issues are documented before
              completing.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            variant="contained"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            Complete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Approval Dialog */}
      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Approve for Payment</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to approve this goods receipt for payment? This will automatically
            create a vendor payment in the accounting module.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleApprovePayment}
            variant="contained"
            color="success"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <PaymentIcon />}
          >
            Approve Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send to Accounting Dialog */}
      <Dialog
        open={sendToAccountingOpen}
        onClose={() => setSendToAccountingOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Send to Accounting</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Select an accounting team member to create the vendor bill for this goods receipt.
          </Typography>
          <ApproverSelector
            value={selectedAccountingUserId}
            onChange={setSelectedAccountingUserId}
            onChangeWithName={(id, name) => {
              setSelectedAccountingUserId(id);
              setSelectedAccountingUserName(name);
            }}
            label="Accounting User"
            approvalType="transaction"
            required
            placeholder="Select accounting team member..."
            excludeUserIds={user ? [user.uid] : []}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendToAccountingOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSendToAccounting}
            variant="contained"
            disabled={actionLoading || !selectedAccountingUserId}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <SendIcon />}
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
