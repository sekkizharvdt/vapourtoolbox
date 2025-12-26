'use client';

import { useState } from 'react';
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
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Flight,
  Train,
  DirectionsCar,
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
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
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
  getExpenseCategoryOptions,
  formatExpenseDate,
  formatExpenseAmount,
  formatTripDateRange,
} from '@/lib/hr';
import { ReceiptUploader, type ReceiptAttachment } from '@/components/hr/travelExpenses';
import type { TravelExpenseCategory } from '@vapour/types';

// Icon map for categories
const CATEGORY_ICONS: Record<TravelExpenseCategory, React.ReactElement> = {
  AIR_TRAVEL: <Flight fontSize="small" />,
  TRAIN_TRAVEL: <Train fontSize="small" />,
  ROAD_TRAVEL: <DirectionsCar fontSize="small" />,
  HOTEL: <Hotel fontSize="small" />,
  FOOD: <Restaurant fontSize="small" />,
  LOCAL_CONVEYANCE: <LocalTaxi fontSize="small" />,
  OTHER: <Receipt fontSize="small" />,
};

interface TravelExpenseDetailClientProps {
  reportId: string;
}

export default function TravelExpenseDetailClient({ reportId }: TravelExpenseDetailClientProps) {
  const router = useRouter();
  const { user } = useAuth();

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

  // Add item form state
  const [newItem, setNewItem] = useState({
    category: 'OTHER' as TravelExpenseCategory,
    description: '',
    expenseDate: new Date(),
    amount: '',
    vendorName: '',
    fromLocation: '',
    toLocation: '',
  });

  // Receipt upload for new item
  const [newItemReceipt, setNewItemReceipt] = useState<ReceiptAttachment | null>(null);

  const isDraft = report?.status === 'DRAFT';
  const isOwner = report?.employeeId === user?.uid;
  const canEdit = isDraft && isOwner;
  const isApprover = report?.approverIds?.includes(user?.uid || '');
  const canSubmit = isDraft && isOwner && (report?.items?.length || 0) > 0;
  const isPendingApproval = report?.status === 'SUBMITTED' || report?.status === 'UNDER_REVIEW';
  const canApprove = isPendingApproval && isApprover;

  const categoryOptions = getExpenseCategoryOptions();

  const handleAddItem = async () => {
    if (!user || !report) return;

    const amount = parseFloat(newItem.amount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }

    try {
      await addItemMutation.mutateAsync({
        reportId,
        input: {
          category: newItem.category,
          description: newItem.description.trim(),
          expenseDate: newItem.expenseDate,
          amount,
          vendorName: newItem.vendorName.trim() || undefined,
          fromLocation: newItem.fromLocation.trim() || undefined,
          toLocation: newItem.toLocation.trim() || undefined,
        },
        userId: user.uid,
        receiptAttachmentId: newItemReceipt?.id,
        receiptFileName: newItemReceipt?.name,
        receiptUrl: newItemReceipt?.url,
      });

      setAddDialogOpen(false);
      setNewItem({
        category: 'OTHER',
        description: '',
        expenseDate: new Date(),
        amount: '',
        vendorName: '',
        fromLocation: '',
        toLocation: '',
      });
      setNewItemReceipt(null);
      refetch();
    } catch (err) {
      console.error('Failed to add item:', err);
    }
  };

  const handleReceiptUpload = async (itemId: string, receipt: ReceiptAttachment | null) => {
    if (!user || !receipt) {
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
    if (!user || !deleteItemId) return;

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
    if (!user) return;

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
    }
  };

  const handleApprove = async () => {
    if (!user) return;

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
    }
  };

  const handleReject = async () => {
    if (!user || !rejectionReason.trim()) return;

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
    }
  };

  const handleReturn = async () => {
    if (!user || !returnComments.trim()) return;

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

  const showLocationFields =
    newItem.category === 'AIR_TRAVEL' ||
    newItem.category === 'TRAIN_TRAVEL' ||
    newItem.category === 'ROAD_TRAVEL';

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
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ maxWidth: 'lg', mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => router.push('/hr/travel-expenses')}>
            Back
          </Button>
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
                            <Typography variant="caption" color="text.secondary" display="block">
                              GST: {formatExpenseAmount(item.gstAmount, item.currency)}
                            </Typography>
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
                  {(Object.keys(report.categoryTotals) as TravelExpenseCategory[]).map(
                    (category) => (
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
                    )
                  )}
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Add Item Dialog */}
        <Dialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Add Expense Item</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  select
                  label="Category"
                  fullWidth
                  value={newItem.category}
                  onChange={(e) =>
                    setNewItem({ ...newItem, category: e.target.value as TravelExpenseCategory })
                  }
                >
                  {categoryOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {CATEGORY_ICONS[option.value]}
                        {option.label}
                      </Box>
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Description"
                  fullWidth
                  required
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="e.g., Flight ticket to Mumbai"
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="Expense Date"
                  value={newItem.expenseDate}
                  onChange={(date) => {
                    const newDate = date as Date | null;
                    setNewItem({ ...newItem, expenseDate: newDate || new Date() });
                  }}
                  slotProps={{
                    textField: { fullWidth: true, required: true },
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Amount (INR)"
                  fullWidth
                  required
                  type="number"
                  value={newItem.amount}
                  onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Vendor Name"
                  fullWidth
                  value={newItem.vendorName}
                  onChange={(e) => setNewItem({ ...newItem, vendorName: e.target.value })}
                  placeholder="e.g., Indigo Airlines, IRCTC, Uber"
                />
              </Grid>

              {showLocationFields && (
                <>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="From Location"
                      fullWidth
                      value={newItem.fromLocation}
                      onChange={(e) => setNewItem({ ...newItem, fromLocation: e.target.value })}
                      placeholder="e.g., Chennai"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="To Location"
                      fullWidth
                      value={newItem.toLocation}
                      onChange={(e) => setNewItem({ ...newItem, toLocation: e.target.value })}
                      placeholder="e.g., Mumbai"
                    />
                  </Grid>
                </>
              )}

              {/* Receipt Upload */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Receipt (Optional)
                </Typography>
                <ReceiptUploader
                  receipt={newItemReceipt}
                  onChange={setNewItemReceipt}
                  storagePath={`hr/travel-expenses/${reportId}/receipts/`}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleAddItem}
              disabled={
                !newItem.description.trim() ||
                !newItem.amount ||
                parseFloat(newItem.amount) <= 0 ||
                addItemMutation.isPending
              }
            >
              {addItemMutation.isPending ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogActions>
        </Dialog>

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
              Are you sure you want to submit this travel expense report for approval? You will not
              be able to edit it after submission.
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
    </LocalizationProvider>
  );
}
