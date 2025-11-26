'use client';

/**
 * Transmittals Table Component
 *
 * Displays transmittal records in table format
 * - Transmittal metadata and status
 * - Document count and dates
 * - Action buttons (view, download)
 */

import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Download as DownloadIcon,
  CheckCircle as AcknowledgedIcon,
} from '@mui/icons-material';
import type { DocumentTransmittal, TransmittalStatus } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

interface TransmittalsTableProps {
  transmittals: DocumentTransmittal[];
  onViewTransmittal: (transmittal: DocumentTransmittal) => void;
  onDownloadZip: (transmittal: DocumentTransmittal) => void;
}

export default function TransmittalsTable({
  transmittals,
  onViewTransmittal,
  onDownloadZip,
}: TransmittalsTableProps) {
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


  if (transmittals.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No transmittals created yet. Click &quot;Create Transmittal&quot; to get started.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Transmittal Number</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell width="100px" align="center">
                Documents
              </TableCell>
              <TableCell width="120px">Status</TableCell>
              <TableCell>Created By</TableCell>
              <TableCell width="120px" align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transmittals.map((transmittal) => (
              <TableRow key={transmittal.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {transmittal.transmittalNumber}
                  </Typography>
                  {transmittal.status === 'ACKNOWLEDGED' && transmittal.acknowledgedAt && (
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                      <AcknowledgedIcon fontSize="small" color="success" sx={{ fontSize: 14 }} />
                      <Typography variant="caption" color="text.secondary">
                        Ack: {formatDate(transmittal.acknowledgedAt)}
                      </Typography>
                    </Stack>
                  )}
                </TableCell>

                <TableCell>
                  <Typography variant="body2">{formatDate(transmittal.transmittalDate)}</Typography>
                  {transmittal.sentAt && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Sent: {formatDate(transmittal.sentAt)}
                    </Typography>
                  )}
                </TableCell>

                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                    {transmittal.subject || '(No subject)'}
                  </Typography>
                  {transmittal.purposeOfIssue && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {transmittal.purposeOfIssue}
                    </Typography>
                  )}
                </TableCell>

                <TableCell align="center">
                  <Chip
                    label={transmittal.documentCount}
                    size="small"
                    variant="outlined"
                    sx={{ minWidth: 40 }}
                  />
                </TableCell>

                <TableCell>
                  <Chip
                    label={transmittal.status}
                    size="small"
                    color={getStatusColor(transmittal.status)}
                    sx={{ fontSize: '0.7rem' }}
                  />
                </TableCell>

                <TableCell>
                  <Typography variant="body2">{transmittal.createdByName}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {formatDate(transmittal.createdAt)}
                  </Typography>
                </TableCell>

                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => onViewTransmittal(transmittal)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {transmittal.zipFileUrl && (
                      <Tooltip title="Download ZIP">
                        <IconButton
                          size="small"
                          onClick={() => onDownloadZip(transmittal)}
                          color="primary"
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
