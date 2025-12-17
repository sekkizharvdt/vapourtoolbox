'use client';

/**
 * FileList Component
 *
 * Displays documents in the selected folder as a list/grid
 */

import { memo, useCallback } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  IconButton,
  Chip,
  Typography,
  Tooltip,
  Skeleton,
  Paper,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Visibility as ViewIcon,
  MoreVert as MoreIcon,
  InsertDriveFile as FileIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Description as DocIcon,
  TableChart as SpreadsheetIcon,
} from '@mui/icons-material';
import type { DocumentRecord } from '@vapour/types';

interface FileListProps {
  documents: DocumentRecord[];
  loading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  isSelected: (id: string) => boolean;
  onViewDocument?: (document: DocumentRecord) => void;
  onDownloadDocument?: (document: DocumentRecord) => void;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.includes('pdf')) return <PdfIcon color="error" />;
  if (mimeType.includes('image')) return <ImageIcon color="primary" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return <SpreadsheetIcon color="success" />;
  if (mimeType.includes('document') || mimeType.includes('word')) return <DocIcon color="info" />;
  return <FileIcon color="action" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (date: unknown): string => {
  if (!date) return '-';
  // Handle Firestore Timestamp
  if (
    date &&
    typeof date === 'object' &&
    'toDate' in date &&
    typeof (date as { toDate: () => Date }).toDate === 'function'
  ) {
    const d = (date as { toDate: () => Date }).toDate();
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  // Handle Date object or string
  const d = typeof date === 'string' ? new Date(date) : (date as Date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

function FileListComponent({
  documents,
  loading,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  isSelected,
  onViewDocument,
  onDownloadDocument,
}: FileListProps) {
  const handleSelectAllClick = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.checked) {
        onSelectAll();
      } else {
        onClearSelection();
      }
    },
    [onSelectAll, onClearSelection]
  );

  const handleRowClick = useCallback(
    (id: string) => () => {
      onToggleSelect(id);
    },
    [onToggleSelect]
  );

  const handleView = useCallback(
    (doc: DocumentRecord) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onViewDocument?.(doc);
    },
    [onViewDocument]
  );

  const handleDownload = useCallback(
    (doc: DocumentRecord) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onDownloadDocument?.(doc);
    },
    [onDownloadDocument]
  );

  // Loading skeleton
  if (loading) {
    return (
      <TableContainer component={Paper} elevation={0}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Skeleton variant="rectangular" width={24} height={24} />
              </TableCell>
              <TableCell>
                <Skeleton width={200} />
              </TableCell>
              <TableCell>
                <Skeleton width={100} />
              </TableCell>
              <TableCell>
                <Skeleton width={80} />
              </TableCell>
              <TableCell>
                <Skeleton width={100} />
              </TableCell>
              <TableCell>
                <Skeleton width={80} />
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                <TableCell padding="checkbox">
                  <Skeleton variant="rectangular" width={24} height={24} />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Skeleton variant="circular" width={24} height={24} />
                    <Skeleton width={180} />
                  </Box>
                </TableCell>
                <TableCell>
                  <Skeleton width={100} />
                </TableCell>
                <TableCell>
                  <Skeleton width={60} />
                </TableCell>
                <TableCell>
                  <Skeleton width={80} />
                </TableCell>
                <TableCell>
                  <Skeleton width={80} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  // Empty state
  if (documents.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          color: 'text.secondary',
        }}
      >
        <FileIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
        <Typography variant="h6" gutterBottom>
          No documents found
        </Typography>
        <Typography variant="body2">Select a folder or upload documents to get started</Typography>
      </Box>
    );
  }

  const numSelected = selectedIds.size;
  const rowCount = documents.length;

  return (
    <TableContainer component={Paper} elevation={0}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={numSelected > 0 && numSelected < rowCount}
                checked={rowCount > 0 && numSelected === rowCount}
                onChange={handleSelectAllClick}
                inputProps={{ 'aria-label': 'select all documents' }}
              />
            </TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Size</TableCell>
            <TableCell>Uploaded</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {documents.map((doc) => {
            const isItemSelected = isSelected(doc.id);

            return (
              <TableRow
                key={doc.id}
                hover
                onClick={handleRowClick(doc.id)}
                selected={isItemSelected}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={isItemSelected}
                    inputProps={{ 'aria-labelledby': `file-${doc.id}` }}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getFileIcon(doc.mimeType)}
                    <Box>
                      <Typography
                        variant="body2"
                        id={`file-${doc.id}`}
                        sx={{
                          fontWeight: 500,
                          maxWidth: 300,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {doc.title || doc.fileName}
                      </Typography>
                      {doc.title && doc.title !== doc.fileName && (
                        <Typography variant="caption" color="text.secondary">
                          {doc.fileName}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={doc.documentType || 'General'}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem' }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatFileSize(doc.fileSize)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(doc.uploadedAt)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Tooltip title="View">
                      <IconButton size="small" onClick={handleView(doc)} aria-label="View document">
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        onClick={handleDownload(doc)}
                        aria-label="Download document"
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="More options">
                      <IconButton size="small" aria-label="More options">
                        <MoreIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export const FileList = memo(FileListComponent);
