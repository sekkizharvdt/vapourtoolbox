'use client';

/**
 * RFQ Detail Page
 *
 * View and manage a single RFQ
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
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
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Edit as EditIcon,
  Send as SendIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  PictureAsPdf as PdfIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { RFQ, RFQItem } from '@vapour/types';
import { getRFQById, getRFQItems, issueRFQ, cancelRFQ } from '@/lib/procurement/rfqService';
import {
  getRFQStatusText,
  getRFQStatusColor,
  canEditRFQ,
  canIssueRFQ,
  canCancelRFQ,
  canCompleteRFQ,
  formatDueDate,
  getOfferCompletionPercentage,
  getEvaluationCompletionPercentage,
  validateRFQForIssuance,
} from '@/lib/procurement/rfqHelpers';

export default function RFQDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // Extract RFQ ID from URL pathname
  // For static export with dynamic routes, params.id might initially be 'placeholder'
  const rfqId = useMemo(() => {
    const paramsId = params.id as string;
    if (paramsId && paramsId !== 'placeholder') {
      return paramsId;
    }
    const match = pathname?.match(/\/procurement\/rfqs\/([^/]+)(?:\/|$)/);
    return match?.[1] || paramsId;
  }, [params.id, pathname]);

  const [loading, setLoading] = useState(true);
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [items, setItems] = useState<RFQItem[]>([]);
  const [error, setError] = useState<string>('');

  // Dialogs
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    loadRFQ();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId]);

  const loadRFQ = async () => {
    setLoading(true);
    setError('');
    try {
      const [rfqData, itemsData] = await Promise.all([getRFQById(rfqId), getRFQItems(rfqId)]);

      if (!rfqData) {
        setError('RFQ not found');
        return;
      }

      setRfq(rfqData);
      setItems(itemsData);
    } catch (err) {
      console.error('[RFQDetailPage] Error loading RFQ:', err);
      setError('Failed to load RFQ');
    } finally {
      setLoading(false);
    }
  };

  const handleIssueRFQ = async () => {
    if (!rfq || !user) return;

    // Validate before issuing
    const validation = validateRFQForIssuance(rfq);
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    try {
      await issueRFQ(rfq.id, user.uid);
      setIssueDialogOpen(false);
      await loadRFQ();
    } catch (err) {
      console.error('[RFQDetailPage] Error issuing RFQ:', err);
      setError('Failed to issue RFQ');
    }
  };

  const handleCancelRFQ = async () => {
    if (!rfq || !user || !cancelReason.trim()) return;

    try {
      await cancelRFQ(rfq.id, cancelReason, user.uid);
      setCancelDialogOpen(false);
      await loadRFQ();
    } catch (err) {
      console.error('[RFQDetailPage] Error cancelling RFQ:', err);
      setError('Failed to cancel RFQ');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !rfq) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'RFQ not found'}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/procurement/rfqs')}
          sx={{ mt: 2 }}
        >
          Back to RFQs
        </Button>
      </Box>
    );
  }

  const dueDateInfo = formatDueDate(rfq);
  const offerCompletion = getOfferCompletionPercentage(rfq);
  const evaluationCompletion = getEvaluationCompletionPercentage(rfq);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => router.push('/procurement/rfqs')}
              sx={{ mb: 1 }}
            >
              Back to RFQs
            </Button>
            <Typography variant="h4" gutterBottom>
              {rfq.number}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={getRFQStatusText(rfq.status)} color={getRFQStatusColor(rfq.status)} />
              <Typography variant="body2" color={dueDateInfo.color}>
                {dueDateInfo.text}
              </Typography>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1}>
            {canEditRFQ(rfq) && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => router.push(`/procurement/rfqs/${rfq.id}/edit`)}
              >
                Edit
              </Button>
            )}
            {canIssueRFQ(rfq) && (
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={() => setIssueDialogOpen(true)}
              >
                Issue RFQ
              </Button>
            )}
            {canCompleteRFQ(rfq) && (
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={() => router.push(`/procurement/rfqs/${rfq.id}/offers`)}
              >
                Select Winning Offer
              </Button>
            )}
            {canCancelRFQ(rfq) && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelIcon />}
                onClick={() => setCancelDialogOpen(true)}
              >
                Cancel
              </Button>
            )}
            {rfq.latestPdfUrl && (
              <Button
                variant="outlined"
                startIcon={<PdfIcon />}
                onClick={() => window.open(rfq.latestPdfUrl, '_blank')}
              >
                Download PDF
              </Button>
            )}
          </Stack>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        {/* RFQ Details */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            RFQ Details
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Title
              </Typography>
              <Typography variant="body1">{rfq.title}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">{rfq.description}</Typography>
            </Box>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Vendors Invited
                </Typography>
                <Typography variant="body1">{rfq.vendorNames.join(', ')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {rfq.vendorIds.length} vendor(s)
                </Typography>
              </Box>

              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Projects
                </Typography>
                <Typography variant="body1">
                  {rfq.projectNames.length > 0 ? rfq.projectNames.join(', ') : 'Multiple projects'}
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Due Date
                </Typography>
                <Typography variant="body1">
                  {rfq.dueDate?.toDate().toLocaleDateString()}
                </Typography>
              </Box>

              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Validity Period
                </Typography>
                <Typography variant="body1">
                  {rfq.validityPeriod ? `${rfq.validityPeriod} days` : 'N/A'}
                </Typography>
              </Box>
            </Stack>

            {rfq.paymentTerms && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Payment Terms
                </Typography>
                <Typography variant="body1">{rfq.paymentTerms}</Typography>
              </Box>
            )}

            {rfq.deliveryTerms && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Delivery Terms
                </Typography>
                <Typography variant="body1">{rfq.deliveryTerms}</Typography>
              </Box>
            )}

            {rfq.warrantyTerms && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Warranty Terms
                </Typography>
                <Typography variant="body1">{rfq.warrantyTerms}</Typography>
              </Box>
            )}
          </Stack>
        </Paper>

        {/* Progress */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Progress
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Box flex={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Offers Received
              </Typography>
              <Typography variant="h5">
                {rfq.offersReceived} / {rfq.vendorIds.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {offerCompletion}% complete
              </Typography>
            </Box>

            <Box flex={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Offers Evaluated
              </Typography>
              <Typography variant="h5">
                {rfq.offersEvaluated} / {rfq.offersReceived}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {evaluationCompletion}% complete
              </Typography>
            </Box>

            <Box flex={1}>
              <Typography variant="subtitle2" color="text.secondary">
                PDF Version
              </Typography>
              <Typography variant="h5">{rfq.pdfVersion}</Typography>
            </Box>
          </Stack>
        </Paper>

        {/* RFQ Items */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Line Items ({items.length})
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Line #</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Specification</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Equipment</TableCell>
                  <TableCell>Required By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.lineNumber}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.description}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.specification || '-'}</Typography>
                    </TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{item.equipmentCode || '-'}</TableCell>
                    <TableCell>
                      {item.requiredBy ? item.requiredBy.toDate().toLocaleDateString() : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Audit Trail */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Audit Trail
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Stack spacing={1}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Created
              </Typography>
              <Typography variant="body2">
                {rfq.createdAt.toDate().toLocaleString()} by {rfq.createdByName}
              </Typography>
            </Box>

            {rfq.issueDate && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Issued
                </Typography>
                <Typography variant="body2">
                  {rfq.issueDate.toDate().toLocaleString()} by {rfq.sentBy}
                </Typography>
              </Box>
            )}

            {rfq.completedAt && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Completed
                </Typography>
                <Typography variant="body2">{rfq.completedAt.toDate().toLocaleString()}</Typography>
                {rfq.completionNotes && (
                  <Typography variant="body2">Notes: {rfq.completionNotes}</Typography>
                )}
              </Box>
            )}
          </Stack>
        </Paper>
      </Stack>

      {/* Issue Dialog */}
      <Dialog open={issueDialogOpen} onClose={() => setIssueDialogOpen(false)}>
        <DialogTitle>Issue RFQ</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to issue this RFQ to {rfq.vendorIds.length} vendor(s)?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will generate a PDF and mark the RFQ as issued. You will need to manually send the
            PDF to vendors.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleIssueRFQ}>
            Issue RFQ
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
        <DialogTitle>Cancel RFQ</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>Please provide a reason for cancelling this RFQ:</Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Enter cancellation reason..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancelRFQ}
            disabled={!cancelReason.trim()}
          >
            Cancel RFQ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
