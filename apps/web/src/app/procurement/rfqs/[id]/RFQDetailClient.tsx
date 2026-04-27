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
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  Edit as EditIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  PictureAsPdf as PdfIcon,
  Archive as ArchiveIcon,
  AttachFile as AttachFileIcon,
  Home as HomeIcon,
  Upload as UploadIcon,
  Compare as CompareIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { RFQ, RFQItem } from '@vapour/types';
import { getRFQById, getRFQItems, issueRFQ, cancelRFQ } from '@/lib/procurement/rfq';
import { downloadRFQZip } from '@/lib/procurement/rfq/rfqZipService';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
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
import UploadOfferDialog from '@/components/procurement/UploadOfferDialog';

/**
 * Check if RFQ can receive offers (ISSUED or OFFERS_RECEIVED status)
 */
function canReceiveOffers(rfq: RFQ): boolean {
  return rfq.status === 'ISSUED' || rfq.status === 'OFFERS_RECEIVED';
}

export default function RFQDetailPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, claims } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [items, setItems] = useState<RFQItem[]>([]);
  const [error, setError] = useState<string>('');
  const [rfqId, setRfqId] = useState<string | null>(null);

  // PR attachments carried forward from the source PR(s) — listed here so
  // procurement can sanity-check what vendors will receive in the RFQ ZIP.
  const [attachments, setAttachments] = useState<
    Array<{
      id: string;
      fileName: string;
      attachmentType: string;
      description?: string;
      storagePath: string;
    }>
  >([]);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Dialogs
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [uploadOfferDialogOpen, setUploadOfferDialogOpen] = useState(false);

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

      // Load PR attachments across every source PR. Worth surfacing on the
      // detail page so users can see what's bundled into the RFQ ZIP without
      // having to open each PR separately.
      try {
        const { db } = getFirebase();
        const found: typeof attachments = [];
        for (const prId of rfqData.purchaseRequestIds || []) {
          const snap = await getDocs(
            query(
              collection(db, 'purchaseRequestAttachments'),
              where('purchaseRequestId', '==', prId)
            )
          );
          for (const d of snap.docs) {
            const data = d.data();
            if (data.storagePath) {
              found.push({
                id: d.id,
                fileName: data.fileName || 'attachment',
                attachmentType: data.attachmentType || 'OTHER',
                description: data.description,
                storagePath: data.storagePath,
              });
            }
          }
        }
        setAttachments(found);
      } catch (attachErr) {
        console.warn('[RFQDetailPage] Failed to load PR attachments', attachErr);
      }

      setLoading(false);
    } catch (err) {
      console.error('[RFQDetailPage] Error loading RFQ:', err);
      setError('Failed to load RFQ');
      setLoading(false);
    }
  };

  const handleOpenAttachment = async (path: string) => {
    try {
      const { storage } = getFirebase();
      const url = await getDownloadURL(storageRef(storage, path));
      window.open(url, '_blank');
    } catch (err) {
      console.error('[RFQDetailPage] Failed to open attachment', err);
      setError('Failed to open attachment.');
    }
  };

  const handleDownloadZip = async () => {
    if (!rfq?.latestPdfUrl) return;
    setDownloadingZip(true);
    setError('');
    try {
      const { db, storage } = getFirebase();
      await downloadRFQZip(db, storage, {
        rfqNumber: rfq.number,
        pdfUrl: rfq.latestPdfUrl,
        purchaseRequestIds: rfq.purchaseRequestIds || [],
      });
    } catch (err) {
      console.error('[RFQDetailPage] Failed to build ZIP', err);
      setError(err instanceof Error ? err.message : 'Failed to build ZIP bundle.');
    } finally {
      setDownloadingZip(false);
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
      await issueRFQ(
        rfq.id,
        user.uid,
        user.displayName || user.email || 'Unknown',
        claims?.permissions || 0
      );
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
      await cancelRFQ(
        rfq.id,
        cancelReason,
        user.uid,
        user.displayName || user.email || 'Unknown',
        claims?.permissions || 0
      );
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
        <PageBreadcrumbs
          items={[
            { label: 'RFQs', href: '/procurement/rfqs', icon: <HomeIcon fontSize="small" /> },
            { label: rfq.number },
          ]}
        />

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
                startIcon={<CheckCircleIcon />}
                onClick={() => setIssueDialogOpen(true)}
              >
                Mark as Sent
              </Button>
            )}
            {canReceiveOffers(rfq) && (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<UploadIcon />}
                onClick={() => setUploadOfferDialogOpen(true)}
              >
                Upload Offer
              </Button>
            )}
            {rfq.offersReceived > 0 && (
              <Button
                variant="outlined"
                startIcon={<CompareIcon />}
                onClick={() => router.push(`/procurement/rfqs/${rfq.id}/offers`)}
              >
                Compare Offers ({rfq.offersReceived})
              </Button>
            )}
            {/* Once a winning offer is selected, surface Create PO directly on the
                RFQ page so users don't have to re-enter the comparison screen. */}
            {rfq.selectedOfferId && rfq.status !== 'PO_PROCESSED' && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<ShoppingCartIcon />}
                onClick={() => router.push(`/procurement/pos/new?offerId=${rfq.selectedOfferId}`)}
              >
                Create PO
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
            {rfq.latestPdfUrl && (
              <Button
                variant="contained"
                color="primary"
                startIcon={
                  downloadingZip ? <CircularProgress size={16} color="inherit" /> : <ArchiveIcon />
                }
                onClick={handleDownloadZip}
                disabled={downloadingZip}
              >
                {downloadingZip ? 'Building ZIP…' : 'Download as ZIP'}
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
                  {rfq.projectNames.length > 0 ? rfq.projectNames.join(', ') : 'N/A'}
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

        {/* Attachments — files carried forward from the source PR(s).
            These are also bundled into the RFQ ZIP for vendor delivery. */}
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <AttachFileIcon color="primary" />
            <Typography variant="h6">Attachments ({attachments.length})</Typography>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {attachments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No attachments on the source purchase request(s).
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>File</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attachments.map((a) => (
                    <TableRow key={a.id} hover>
                      <TableCell>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => handleOpenAttachment(a.storagePath)}
                          sx={{ textTransform: 'none', p: 0, justifyContent: 'flex-start' }}
                        >
                          {a.fileName}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Chip label={a.attachmentType} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{a.description || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
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
                  {rfq.issueDate.toDate().toLocaleString()} by{' '}
                  {rfq.sentByName || rfq.sentBy || 'Unknown'}
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

      {/* Mark as Sent Dialog */}
      <Dialog open={issueDialogOpen} onClose={() => setIssueDialogOpen(false)}>
        <DialogTitle>Mark RFQ as Sent</DialogTitle>
        <DialogContent>
          <Typography>
            Confirm that you have already sent this RFQ to {rfq.vendorIds.length} vendor(s) outside
            the toolbox (email, WhatsApp, etc.).
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The toolbox does not email vendors directly. Marking it sent locks editing on most
            fields, records the issue date, and lets vendors&apos; offers be uploaded against this
            RFQ.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleIssueRFQ}>
            Mark as Sent
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

      {/* Upload Offer Dialog */}
      <UploadOfferDialog
        open={uploadOfferDialogOpen}
        onClose={() => setUploadOfferDialogOpen(false)}
        rfq={rfq}
        rfqItems={items}
        onSuccess={() => {
          setUploadOfferDialogOpen(false);
          loadRFQ();
        }}
      />
    </Box>
  );
}
