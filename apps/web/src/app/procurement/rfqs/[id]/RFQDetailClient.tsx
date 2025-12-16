'use client';

/**
 * RFQ Detail Page
 *
 * View and manage a single RFQ
 */

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Edit as EditIcon,
  Send as SendIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  PictureAsPdf as PdfIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { RFQ, RFQItem } from '@vapour/types';
import { getRFQById, getRFQItems, issueRFQ, cancelRFQ } from '@/lib/procurement/rfq';
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
import { formatDate } from '@/lib/utils/formatters';
import GenerateRFQPDFDialog from '@/components/procurement/GenerateRFQPDFDialog';

export default function RFQDetailPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [items, setItems] = useState<RFQItem[]>([]);
  const [error, setError] = useState<string>('');
  const [rfqId, setRfqId] = useState<string | null>(null);

  // Dialogs
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/procurement\/rfqs\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setRfqId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (rfqId) {
      loadRFQ();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId]);

  const loadRFQ = async (retryCount = 0) => {
    if (!rfqId) return;
    // Only set loading true on first attempt
    if (retryCount === 0) {
      setLoading(true);
      setError('');
    }
    try {
      const [rfqData, itemsData] = await Promise.all([getRFQById(rfqId), getRFQItems(rfqId)]);

      if (!rfqData) {
        // Retry up to 3 times with exponential backoff for newly created RFQs
        // This handles Firestore eventual consistency after creation
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s, 2s
          console.warn(
            `[RFQDetailPage] RFQ not found, retrying in ${delay}ms (attempt ${retryCount + 1}/3)`
          );
          setTimeout(() => loadRFQ(retryCount + 1), delay);
          return; // Don't set loading false - we're still retrying
        }
        setError('RFQ not found');
        setLoading(false);
        return;
      }

      setRfq(rfqData);
      setItems(itemsData);
      setLoading(false);
    } catch (err) {
      console.error('[RFQDetailPage] Error loading RFQ:', err);
      setError('Failed to load RFQ');
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
      await issueRFQ(rfq.id, user.uid, user.displayName || user.email || 'Unknown');
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
      await cancelRFQ(rfq.id, cancelReason, user.uid, user.displayName || user.email || 'Unknown');
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
        <Button onClick={() => router.push('/procurement/rfqs')} sx={{ mt: 2 }}>
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
        {/* Breadcrumbs */}
        <Breadcrumbs>
          <Link
            color="inherit"
            href="/procurement/rfqs"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/procurement/rfqs');
            }}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            RFQs
          </Link>
          <Typography color="text.primary">{rfq.number}</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
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
            <Button
              variant="outlined"
              startIcon={<PdfIcon />}
              onClick={() => setPdfDialogOpen(true)}
              color="success"
            >
              Generate PDF
            </Button>
            {rfq.latestPdfUrl && (
              <Button
                variant="outlined"
                startIcon={<PdfIcon />}
                onClick={() => window.open(rfq.latestPdfUrl, '_blank')}
              >
                Download Latest PDF
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
                <Typography variant="body1">{formatDate(rfq.dueDate)}</Typography>
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
                    <TableCell>{formatDate(item.requiredBy)}</TableCell>
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

      {/* Generate PDF Dialog */}
      <GenerateRFQPDFDialog
        open={pdfDialogOpen}
        onClose={() => setPdfDialogOpen(false)}
        rfq={rfq}
        onSuccess={() => loadRFQ()}
      />
    </Box>
  );
}
