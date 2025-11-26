'use client';

/**
 * Transmittal Detail Dialog
 *
 * Shows complete details of a transmittal record
 * - Transmittal metadata and status
 * - Document list with details
 * - Cover notes and acknowledgment info
 * - Download actions
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Box,
  Paper,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
} from '@mui/material';
import {
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  CheckCircle as AcknowledgedIcon,
} from '@mui/icons-material';
import type { DocumentTransmittal, TransmittalStatus } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

interface TransmittalDetailDialogProps {
  open: boolean;
  onClose: () => void;
  transmittal: DocumentTransmittal | null;
  onDownloadPdf: (transmittal: DocumentTransmittal) => void;
  onDownloadZip: (transmittal: DocumentTransmittal) => void;
}

export default function TransmittalDetailDialog({
  open,
  onClose,
  transmittal,
  onDownloadPdf,
  onDownloadZip,
}: TransmittalDetailDialogProps) {
  if (!transmittal) return null;

  const getStatusColor = (
    status: TransmittalStatus
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const colors: Record<TransmittalStatus, 'default' | 'info' | 'warning' | 'success'> = {
      DRAFT: 'default',
      GENERATED: 'info',
      SENT: 'warning',
      ACKNOWLEDGED: 'success',
    };
    return colors[status] || 'default';
  };


  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '-';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6">Transmittal Details</Typography>
            <Typography variant="body2" color="text.secondary">
              {transmittal.transmittalNumber}
            </Typography>
          </Box>
          <Chip
            label={transmittal.status}
            color={getStatusColor(transmittal.status)}
            size="small"
          />
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Transmittal Information */}
          <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
            <Typography variant="subtitle2" gutterBottom>
              Transmittal Information
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Stack spacing={1.5}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Project
                </Typography>
                <Typography variant="body2">{transmittal.projectName}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Client
                </Typography>
                <Typography variant="body2">{transmittal.clientName}</Typography>
                {transmittal.clientContact && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Contact: {transmittal.clientContact}
                  </Typography>
                )}
              </Box>

              <Stack direction="row" spacing={4}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Transmittal Date
                  </Typography>
                  <Typography variant="body2">{formatDate(transmittal.transmittalDate)}</Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Documents
                  </Typography>
                  <Typography variant="body2">{transmittal.documentCount}</Typography>
                </Box>
              </Stack>

              {transmittal.subject && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Subject
                  </Typography>
                  <Typography variant="body2">{transmittal.subject}</Typography>
                </Box>
              )}

              {transmittal.purposeOfIssue && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Purpose of Issue
                  </Typography>
                  <Typography variant="body2">{transmittal.purposeOfIssue}</Typography>
                </Box>
              )}

              {transmittal.coverNotes && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Cover Notes
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {transmittal.coverNotes}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Paper>

          {/* Acknowledgment Information */}
          {transmittal.status === 'ACKNOWLEDGED' && transmittal.acknowledgedAt && (
            <Alert severity="success" icon={<AcknowledgedIcon />}>
              <Typography variant="body2" fontWeight="medium">
                Acknowledged by {transmittal.acknowledgedByName || 'Client'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(transmittal.acknowledgedAt)}
              </Typography>
              {transmittal.acknowledgmentNotes && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {transmittal.acknowledgmentNotes}
                </Typography>
              )}
            </Alert>
          )}

          {/* Files */}
          {(transmittal.transmittalPdfUrl || transmittal.zipFileUrl) && (
            <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" gutterBottom>
                Files
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={1}>
                {transmittal.transmittalPdfUrl && (
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ p: 1, bgcolor: 'background.paper', borderRadius: 1 }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PdfIcon color="error" />
                      <Box>
                        <Typography variant="body2">Transmittal PDF</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {transmittal.transmittalNumber}.pdf
                        </Typography>
                      </Box>
                    </Stack>
                    <Button
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => onDownloadPdf(transmittal)}
                    >
                      Download
                    </Button>
                  </Stack>
                )}

                {transmittal.zipFileUrl && (
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ p: 1, bgcolor: 'background.paper', borderRadius: 1 }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <DownloadIcon color="primary" />
                      <Box>
                        <Typography variant="body2">Complete Package (ZIP)</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(transmittal.zipFileSize)} • Includes all documents and
                          transmittal PDF
                        </Typography>
                      </Box>
                    </Stack>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<DownloadIcon />}
                      onClick={() => onDownloadZip(transmittal)}
                    >
                      Download
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Paper>
          )}

          {/* Document List - Placeholder for now */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Documents Included ({transmittal.documentIds.length})
            </Typography>
            <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Document Number</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Revision</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transmittal.documentIds.map((docId) => (
                    <TableRow key={docId}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {docId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          (Document details will be loaded)
                        </Typography>
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Audit Information */}
          <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
            <Typography variant="caption" color="text.secondary">
              Created by {transmittal.createdByName} on {formatDate(transmittal.createdAt)}
            </Typography>
            {transmittal.sentAt && (
              <>
                <br />
                <Typography variant="caption" color="text.secondary">
                  Sent on {formatDate(transmittal.sentAt)}
                </Typography>
              </>
            )}
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {transmittal.zipFileUrl && (
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => onDownloadZip(transmittal)}
          >
            Download ZIP
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
