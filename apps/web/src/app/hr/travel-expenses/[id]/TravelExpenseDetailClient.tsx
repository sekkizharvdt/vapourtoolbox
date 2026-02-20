'use client';

import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Flight,
  Hotel,
  Restaurant,
  LocalTaxi,
  Receipt,
  AttachFile as AttachIcon,
  Visibility as ViewIcon,
  Send as SubmitIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  Undo as ReturnIcon,
  PictureAsPdf as PdfIcon,
  CheckCircle as VerifiedIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  useTravelExpenseReport,
  useAddExpenseItem,
  useRemoveExpenseItem,
  useUpdateExpenseItemReceipt,
  useSubmitTravelExpenseReport,
  useApproveTravelExpenseReport,
  useRejectTravelExpenseReport,
  useReturnTravelExpenseForRevision,
  downloadTravelExpenseReportPDF,
  TRAVEL_EXPENSE_STATUS_COLORS,
  TRAVEL_EXPENSE_STATUS_LABELS,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_COLORS,
  formatExpenseDate,
  formatExpenseAmount,
  formatTripDateRange,
} from '@/lib/hr';
import {
  ReceiptUploader,
  AddExpenseDialog,
  type ReceiptAttachment,
  type ParsedExpenseData,
  type ManualExpenseInput,
} from '@/components/hr/travelExpenses';
import type { TravelExpenseCategory } from '@vapour/types';

// Icon map for categories
const CATEGORY_ICONS: Record<TravelExpenseCategory, React.ReactElement> = {
  TRAVEL: <Flight fontSize="small" />,
  ACCOMMODATION: <Hotel fontSize="small" />,
  LOCAL_CONVEYANCE: <LocalTaxi fontSize="small" />,
  FOOD: <Restaurant fontSize="small" />,
  OTHER: <Receipt fontSize="small" />,
};

export default function TravelExpenseDetailClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // Extract reportId from pathname for static export compatibility
  // useParams returns 'placeholder' with static export + Firebase hosting rewrites
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/hr\/travel-expenses\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setReportId(extractedId);
      }
    }
  }, [pathname]);

  const { data: report, isLoading, error, refetch } = useTravelExpenseReport(reportId);
  const addItemMutation = useAddExpenseItem();
  const removeItemMutation = useRemoveExpenseItem();
  const updateReceiptMutation = useUpdateExpenseItemReceipt();
  const submitMutation = useSubmitTravelExpenseReport();
  const approveMutation = useApproveTravelExpenseReport();
  const rejectMutation = useRejectTravelExpenseReport();
  const returnMutation = useReturnTravelExpenseForRevision();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [uploadItemId, setUploadItemId] = useState<string | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [returnComments, setReturnComments] = useState('');
  const [approvalComments, setApprovalComments] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDraft = report?.status === 'DRAFT';
  const isOwner = report?.employeeId === user?.uid;
  const canEdit = isDraft && isOwner;
  const isApprover = report?.approverIds?.includes(user?.uid || '');
  const canSubmit = isDraft && isOwner && (report?.items?.length || 0) > 0;
  const isPendingApproval = report?.status === 'SUBMITTED' || report?.status === 'UNDER_REVIEW';
  // Approvers cannot approve their own reports
  const canApprove = isPendingApproval && isApprover && !isOwner;

  const handleAddManualItem = async (
    input: ManualExpenseInput,
    receipt: ReceiptAttachment | null
  ) => {
    if (!user || !reportId) return;

    await addItemMutation.mutateAsync({
      reportId,
      input: {
        category: input.category,
        description: input.description,
        expenseDate: input.expenseDate,
        amount: input.amount,
        vendorName: input.vendorName,
        fromLocation: input.fromLocation,
        toLocation: input.toLocation,
      },
      userId: user.uid,
      receiptAttachmentId: receipt?.id,
      receiptFileName: receipt?.name,
      receiptUrl: receipt?.url,
    });
    refetch();
  };

  const handleParsedExpense = async (data: ParsedExpenseData) => {
    if (!user || !reportId) return;

    await addItemMutation.mutateAsync({
      reportId,
      input: {
        category: data.category,
        description: data.description,
        expenseDate: data.expenseDate,
        amount: data.amount,
        vendorName: data.vendorName,
        invoiceNumber: data.invoiceNumber,
        gstRate: data.gstRate,
        gstAmount: data.gstAmount,
        cgstAmount: data.cgstAmount,
        sgstAmount: data.sgstAmount,
        igstAmount: data.igstAmount,
        taxableAmount: data.taxableAmount,
        vendorGstin: data.vendorGstin,
        ourGstinUsed: data.ourGstinUsed,
        fromLocation: data.fromLocation,
        toLocation: data.toLocation,
      },
      userId: user.uid,
      receiptAttachmentId: data.receipt.id,
      receiptFileName: data.receipt.name,
      receiptUrl: data.receipt.url,
    });
    refetch();
  };

  const handleReceiptUpload = async (itemId: string, receipt: ReceiptAttachment | null) => {
    if (!user || !receipt || !reportId) {
      setUploadItemId(null);
      return;
    }

    try {
      await updateReceiptMutation.mutateAsync({
        reportId,
        itemId,
        receiptAttachmentId: receipt.id,
        receiptFileName: receipt.name,
        receiptUrl: receipt.url,
        userId: user.uid,
      });
      setUploadItemId(null);
      refetch();
    } catch (err) {
      console.error('Failed to upload receipt:', err);
    }
  };

  const handleDeleteItem = async () => {
    if (!user || !deleteItemId || !reportId) return;

    try {
      await removeItemMutation.mutateAsync({
        reportId,
        itemId: deleteItemId,
        userId: user.uid,
      });
      setDeleteItemId(null);
      refetch();
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const handleSubmit = async () => {
    if (!user || !reportId) return;

    setActionError(null);
    try {
      await submitMutation.mutateAsync({
        reportId,
        userId: user.uid,
        userName: user.displayName || user.email || 'Unknown',
      });
      setSubmitDialogOpen(false);
      refetch();
    } catch (err) {
      console.error('Failed to submit report:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to submit report');
    }
  };

  const handleApprove = async () => {
    if (!user || !reportId) return;

    setActionError(null);
    try {
      await approveMutation.mutateAsync({
        reportId,
        approverId: user.uid,
        approverName: user.displayName || user.email || 'Unknown',
        comments: approvalComments.trim() || undefined,
      });
      setApproveDialogOpen(false);
      setApprovalComments('');
      refetch();
    } catch (err) {
      console.error('Failed to approve report:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to approve report');
      setApproveDialogOpen(false);
    }
  };

  const handleReject = async () => {
    if (!user || !reportId || !rejectionReason.trim()) return;

    setActionError(null);
    try {
      await rejectMutation.mutateAsync({
        reportId,
        approverId: user.uid,
        approverName: user.displayName || user.email || 'Unknown',
        rejectionReason: rejectionReason.trim(),
      });
      setRejectDialogOpen(false);
      setRejectionReason('');
      refetch();
    } catch (err) {
      console.error('Failed to reject report:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to reject report');
      setRejectDialogOpen(false);
    }
  };

  const handleReturn = async () => {
    if (!user || !reportId || !returnComments.trim()) return;

    setActionError(null);
    try {
      await returnMutation.mutateAsync({
        reportId,
        approverId: user.uid,
        approverName: user.displayName || user.email || 'Unknown',
        comments: returnComments.trim(),
      });
      setReturnDialogOpen(false);
      setReturnComments('');
      refetch();
    } catch (err) {
      console.error('Failed to return report:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to return report');
      setReturnDialogOpen(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) return;

    setIsDownloadingPdf(true);
    try {
      await downloadTravelExpenseReportPDF(report);
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 'lg', mx: 'auto' }}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 'lg', mx: 'auto' }}>
        <Alert severity="error">
          Failed to load travel expense report:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}.{' '}
          <Button size="small" onClick={() => router.back()}>
            Go Back
          </Button>
        </Alert>
      </Box>
    );
  }

  if (!report) {
    return (
      <Box sx={{ maxWidth: 'lg', mx: 'auto' }}>
        <Alert severity="warning">
          Travel expense report not found. It may have been deleted.{' '}
          <Button size="small" onClick={() => router.push('/hr/travel-expenses')}>
            View All Reports
          </Button>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 'lg', mx: 'auto' }}>
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
          href="/hr/travel-expenses"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/hr/travel-expenses');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Travel Expenses
        </Link>
        <Typography color="text.primary">{report.reportNumber}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Typography variant="h5" component="h1">
              {report.reportNumber}
            </Typography>
            <Chip
              label={TRAVEL_EXPENSE_STATUS_LABELS[report.status]}
              color={TRAVEL_EXPENSE_STATUS_COLORS[report.status]}
              size="small"
            />
          </Box>
          <Typography variant="body1" color="text.secondary">
            {report.tripPurpose}
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* PDF Download - always available */}
          <Button
            variant="outlined"
            startIcon={<PdfIcon />}
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf || report.items.length === 0}
          >
            {isDownloadingPdf ? 'Generating...' : 'Download PDF'}
          </Button>

          {canSubmit && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<SubmitIcon />}
              onClick={() => setSubmitDialogOpen(true)}
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
                onClick={() => setApproveDialogOpen(true)}
              >
                Approve
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<ReturnIcon />}
                onClick={() => setReturnDialogOpen(true)}
              >
                Return
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<RejectIcon />}
                onClick={() => setRejectDialogOpen(true)}
              >
                Reject
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Action Error Alert */}
      {actionError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {/* Trip Summary Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Trip Dates
              </Typography>
              <Typography variant="body1">
                {formatTripDateRange(report.tripStartDate.toDate(), report.tripEndDate.toDate())}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Destinations
              </Typography>
              <Typography variant="body1">{report.destinations.join(', ')}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                Total Amount
              </Typography>
              <Typography variant="h6" color="primary.main">
                {formatExpenseAmount(report.totalAmount, report.currency)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">
                GST Amount
              </Typography>
              <Typography variant="body1">
                {formatExpenseAmount(report.totalGstAmount, report.currency)}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Expense Items */}
      <Card>
        <CardContent>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
          >
            <Typography variant="h6">Expense Items</Typography>
            {canEdit && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddDialogOpen(true)}
              >
                Add Expense
              </Button>
            )}
          </Box>

          {report.items.length === 0 ? (
            <Alert severity="info">
              No expense items added yet.
              {canEdit && ' Click "Add Expense" to add your first expense item.'}
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell align="center">Receipt</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    {canEdit && <TableCell align="center">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.items.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Chip
                          icon={CATEGORY_ICONS[item.category]}
                          label={EXPENSE_CATEGORY_LABELS[item.category]}
                          size="small"
                          color={EXPENSE_CATEGORY_COLORS[item.category]}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.description}</Typography>
                        {item.fromLocation && item.toLocation && (
                          <Typography variant="caption" color="text.secondary">
                            {item.fromLocation} → {item.toLocation}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{formatExpenseDate(item.expenseDate.toDate())}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.vendorName || '-'}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        {item.hasReceipt && item.receiptUrl ? (
                          <Tooltip title={item.receiptFileName || 'View Receipt'}>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => window.open(item.receiptUrl, '_blank')}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : canEdit ? (
                          <Tooltip title="Upload Receipt">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => setUploadItemId(item.id)}
                            >
                              <AttachIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {formatExpenseAmount(item.amount, item.currency)}
                        </Typography>
                        {item.gstAmount && item.gstAmount > 0 && (
                          <Tooltip
                            title={
                              <Box>
                                {item.cgstAmount ? (
                                  <div>
                                    CGST: {formatExpenseAmount(item.cgstAmount, item.currency)}
                                  </div>
                                ) : null}
                                {item.sgstAmount ? (
                                  <div>
                                    SGST: {formatExpenseAmount(item.sgstAmount, item.currency)}
                                  </div>
                                ) : null}
                                {item.igstAmount ? (
                                  <div>
                                    IGST: {formatExpenseAmount(item.igstAmount, item.currency)}
                                  </div>
                                ) : null}
                                {item.taxableAmount ? (
                                  <div>
                                    Taxable:{' '}
                                    {formatExpenseAmount(item.taxableAmount, item.currency)}
                                  </div>
                                ) : null}
                                {item.vendorGstin && <div>GSTIN: {item.vendorGstin}</div>}
                              </Box>
                            }
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              sx={{ cursor: 'help' }}
                            >
                              GST: {formatExpenseAmount(item.gstAmount, item.currency)}
                              {item.ourGstinUsed && (
                                <VerifiedIcon
                                  fontSize="inherit"
                                  color="success"
                                  sx={{ ml: 0.5, verticalAlign: 'middle' }}
                                />
                              )}
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteItemId(item.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Category Totals */}
          {report.items.length > 0 && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Category Summary
              </Typography>
              <Grid container spacing={2}>
                {(Object.keys(report.categoryTotals) as TravelExpenseCategory[]).map((category) => (
                  <Grid size={{ xs: 6, sm: 4, md: 3 }} key={category}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {CATEGORY_ICONS[category]}
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {EXPENSE_CATEGORY_LABELS[category]}
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {formatExpenseAmount(
                            report.categoryTotals[category] || 0,
                            report.currency
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      {reportId && (
        <AddExpenseDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          reportId={reportId}
          onAddManualItem={handleAddManualItem}
          onAddParsedExpense={handleParsedExpense}
          tripStartDate={report?.tripStartDate?.toDate()}
          tripEndDate={report?.tripEndDate?.toDate()}
          isSubmitting={addItemMutation.isPending}
          storagePath={`hr/travel-expenses/${reportId}/receipts/`}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteItemId} onClose={() => setDeleteItemId(null)}>
        <DialogTitle>Delete Expense Item?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this expense item? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteItemId(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteItem}
            disabled={removeItemMutation.isPending}
          >
            {removeItemMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Receipt Dialog */}
      <Dialog open={!!uploadItemId} onClose={() => setUploadItemId(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Receipt</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <ReceiptUploader
              receipt={null}
              onChange={(receipt) => {
                if (uploadItemId && receipt) {
                  handleReceiptUpload(uploadItemId, receipt);
                }
              }}
              storagePath={`hr/travel-expenses/${reportId}/receipts/`}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadItemId(null)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Submit for Approval Dialog */}
      <Dialog open={submitDialogOpen} onClose={() => setSubmitDialogOpen(false)}>
        <DialogTitle>Submit for Approval?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to submit this travel expense report for approval? You will not be
            able to edit it after submission.
          </Typography>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2">Total Amount</Typography>
            <Typography variant="h6" color="primary.main">
              {formatExpenseAmount(report?.totalAmount || 0, report?.currency || 'INR')}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit'}
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
        <DialogTitle>Approve Travel Expense Report</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            You are about to approve{' '}
            <strong>
              {report?.reportNumber} (
              {formatExpenseAmount(report?.totalAmount || 0, report?.currency || 'INR')})
            </strong>
          </Typography>
          <TextField
            label="Comments (Optional)"
            fullWidth
            multiline
            rows={3}
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
            placeholder="Add any comments about this approval..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleApprove}
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? 'Approving...' : 'Approve'}
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
        <DialogTitle>Reject Travel Expense Report</DialogTitle>
        <DialogContent>
          <Typography color="error" gutterBottom>
            You are about to reject <strong>{report?.reportNumber}</strong>
          </Typography>
          <TextField
            label="Rejection Reason"
            fullWidth
            required
            multiline
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Please provide a reason for rejection..."
            sx={{ mt: 2 }}
            error={!rejectionReason.trim()}
            helperText={!rejectionReason.trim() ? 'Rejection reason is required' : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleReject}
            disabled={rejectMutation.isPending || !rejectionReason.trim()}
          >
            {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Return for Revision Dialog */}
      <Dialog
        open={returnDialogOpen}
        onClose={() => setReturnDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Return for Revision</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Return <strong>{report?.reportNumber}</strong> to the employee for revision. They will
            be able to edit and resubmit the report.
          </Typography>
          <TextField
            label="Comments"
            fullWidth
            required
            multiline
            rows={3}
            value={returnComments}
            onChange={(e) => setReturnComments(e.target.value)}
            placeholder="Explain what needs to be revised..."
            sx={{ mt: 2 }}
            error={!returnComments.trim()}
            helperText={!returnComments.trim() ? 'Comments are required' : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturnDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleReturn}
            disabled={returnMutation.isPending || !returnComments.trim()}
          >
            {returnMutation.isPending ? 'Returning...' : 'Return for Revision'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
