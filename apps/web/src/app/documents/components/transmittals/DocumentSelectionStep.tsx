'use client';

/**
 * Document Selection Step
 *
 * Step 1 of transmittal generation - select documents to include
 * - Shows only documents with submissions
 * - Checkbox selection
 * - Filter by status/discipline
 * - Shows document metadata (revision, submission count, status)
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Stack,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import type { MasterDocumentEntry } from '@vapour/types';

interface DocumentSelectionStepProps {
  documents: MasterDocumentEntry[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export default function DocumentSelectionStep({
  documents,
  selectedIds,
  onSelectionChange,
}: DocumentSelectionStepProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [filteredDocuments, setFilteredDocuments] = useState<MasterDocumentEntry[]>(documents);

  // Filter documents that have submissions
  const documentsWithSubmissions = documents.filter((doc) => doc.submissionCount > 0);

  useEffect(() => {
    let filtered = documentsWithSubmissions;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.documentNumber.toLowerCase().includes(query) ||
          doc.documentTitle.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((doc) => doc.status === statusFilter);
    }

    setFilteredDocuments(filtered);
  }, [searchQuery, statusFilter, documentsWithSubmissions]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(filteredDocuments.map((doc) => doc.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleToggle = (docId: string) => {
    if (selectedIds.includes(docId)) {
      onSelectionChange(selectedIds.filter((id) => id !== docId));
    } else {
      onSelectionChange([...selectedIds, docId]);
    }
  };

  const isAllSelected =
    filteredDocuments.length > 0 && selectedIds.length === filteredDocuments.length;
  const isSomeSelected = selectedIds.length > 0 && !isAllSelected;

  const getStatusColor = (status: string): 'default' | 'info' | 'warning' | 'success' | 'error' => {
    const colors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
      DRAFT: 'default',
      NOT_STARTED: 'info',
      IN_PROGRESS: 'warning',
      SUBMITTED: 'info',
      CLIENT_REVIEW: 'warning',
      COMMENTED: 'warning',
      INTERNAL_REVIEW: 'info',
      ACCEPTED: 'success',
      REJECTED: 'error',
    };
    return colors[status] || 'default';
  };

  return (
    <Box>
      <Stack spacing={2}>
        <Alert severity="info">
          Select documents to include in the transmittal. Only documents with at least one
          submission are shown.
        </Alert>

        {/* Filters */}
        <Stack direction="row" spacing={2}>
          <TextField
            label="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Document number or title..."
            size="small"
            fullWidth
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.disabled' }} />,
            }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="ALL">All Statuses</MenuItem>
              <MenuItem value="SUBMITTED">Submitted</MenuItem>
              <MenuItem value="CLIENT_REVIEW">Client Review</MenuItem>
              <MenuItem value="ACCEPTED">Accepted</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {/* Selection Summary */}
        <Typography variant="body2" color="text.secondary">
          {selectedIds.length} of {filteredDocuments.length} documents selected
        </Typography>

        {/* Documents Table */}
        <TableContainer sx={{ maxHeight: 500, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={isSomeSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell>Document Number</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Revision</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Submissions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No documents available for transmittal
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => (
                  <TableRow
                    key={doc.id}
                    hover
                    onClick={() => handleToggle(doc.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox checked={selectedIds.includes(doc.id)} />
                    </TableCell>
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
                        color={getStatusColor(doc.status)}
                        sx={{ fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">{doc.submissionCount}</Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Box>
  );
}
