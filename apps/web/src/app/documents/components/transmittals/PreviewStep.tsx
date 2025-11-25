'use client';

/**
 * Preview Step
 *
 * Step 3 of transmittal generation - preview and generate
 * - Shows summary of selected documents
 * - Displays transmittal details
 * - Preview button (future)
 * - Generate & Download button
 */

import {
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
  Alert,
  Chip,
} from '@mui/material';
import type { MasterDocumentEntry } from '@vapour/types';

interface PreviewStepProps {
  selectedDocuments: MasterDocumentEntry[];
  subject: string;
  coverNotes: string;
  purposeOfIssue: string;
  projectName: string;
}

export default function PreviewStep({
  selectedDocuments,
  subject,
  coverNotes,
  purposeOfIssue,
  projectName,
}: PreviewStepProps) {
  return (
    <Stack spacing={3}>
      <Alert severity="success">
        Review the transmittal details below. Click &quot;Generate & Download&quot; to create the
        transmittal PDF and download all files in a ZIP archive.
      </Alert>

      {/* Transmittal Summary */}
      <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
        <Typography variant="h6" gutterBottom>
          Transmittal Summary
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Stack spacing={1.5}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Project
            </Typography>
            <Typography variant="body2">{projectName}</Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Subject
            </Typography>
            <Typography variant="body2">{subject || '(No subject provided)'}</Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Purpose of Issue
            </Typography>
            <Typography variant="body2">{purposeOfIssue || '(Not specified)'}</Typography>
          </Box>

          {coverNotes && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Cover Notes
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {coverNotes}
              </Typography>
            </Box>
          )}

          <Box>
            <Typography variant="caption" color="text.secondary">
              Documents Included
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Document List */}
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Documents to be Transmitted
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
              {selectedDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {doc.documentNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{doc.documentTitle}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={doc.currentRevision} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={doc.status.replace(/_/g, ' ')}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Alert severity="warning">
        <Typography variant="body2">
          <strong>Note:</strong> Generating the transmittal will:
          <br />
          • Create a PDF transmittal sheet with the above details
          <br />
          • Include the latest submission file for each document
          <br />
          • Include CRT (Comment Resolution Table) files if available
          <br />• Download all files in a single ZIP archive
        </Typography>
      </Alert>
    </Stack>
  );
}
