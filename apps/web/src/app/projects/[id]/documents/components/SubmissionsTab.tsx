'use client';

/**
 * Submissions Tab
 *
 * Project-level view of ALL document submissions across the project.
 * Shows aggregated submissions with filters and navigation to detail pages.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Box,
  Stack,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { FilterBar, LoadingState, EmptyState, TableActionCell } from '@vapour/ui';
import type { Project, DocumentSubmission, ClientReviewStatus } from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { formatDate } from '@/lib/utils/formatters';

const SubmissionDetailsDialog = dynamic(
  () => import('@/app/documents/components/submissions/SubmissionDetailsDialog'),
  { ssr: false }
);

const CLIENT_STATUS_COLORS: Record<
  ClientReviewStatus,
  'default' | 'info' | 'warning' | 'success' | 'error'
> = {
  PENDING: 'default',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  APPROVED_WITH_COMMENTS: 'warning',
  REJECTED: 'error',
  CONDITIONALLY_APPROVED: 'warning',
};

const STATUS_OPTIONS: { value: ClientReviewStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'APPROVED_WITH_COMMENTS', label: 'Approved with Comments' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CONDITIONALLY_APPROVED', label: 'Conditionally Approved' },
];

interface SubmissionsTabProps {
  project: Project;
}

export default function SubmissionsTab({ project }: SubmissionsTabProps) {
  const router = useRouter();
  const { db } = getFirebase();

  const [submissions, setSubmissions] = useState<DocumentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientReviewStatus | ''>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Detail dialog
  const [selectedSubmission, setSelectedSubmission] = useState<DocumentSubmission | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadSubmissions = useCallback(async () => {
    if (!db) return;

    setLoading(true);
    setError(null);

    try {
      const submissionsRef = collection(db, 'projects', project.id, 'documentSubmissions');
      const q = query(submissionsRef, orderBy('submittedAt', 'desc'));
      const snapshot = await getDocs(q);

      const data: DocumentSubmission[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as DocumentSubmission);
      });

      setSubmissions(data);
    } catch (err) {
      console.error('[SubmissionsTab] Error loading submissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [db, project.id]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    let result = submissions;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.documentNumber.toLowerCase().includes(q) ||
          s.documentTitle.toLowerCase().includes(q) ||
          s.submittedByName.toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      result = result.filter((s) => s.clientStatus === statusFilter);
    }

    return result;
  }, [submissions, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = submissions.length;
    const pending = submissions.filter((s) => s.clientStatus === 'PENDING').length;
    const approved = submissions.filter(
      (s) =>
        s.clientStatus === 'APPROVED' ||
        s.clientStatus === 'APPROVED_WITH_COMMENTS' ||
        s.clientStatus === 'CONDITIONALLY_APPROVED'
    ).length;
    const rejected = submissions.filter((s) => s.clientStatus === 'REJECTED').length;
    const underReview = submissions.filter((s) => s.clientStatus === 'UNDER_REVIEW').length;
    return { total, pending, approved, rejected, underReview };
  }, [submissions]);

  const paginatedSubmissions = useMemo(
    () => filteredSubmissions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredSubmissions, page, rowsPerPage]
  );

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPage(0);
  };

  const handleRowClick = (submission: DocumentSubmission) => {
    router.push(`/documents/${submission.masterDocumentId}?projectId=${project.id}&tab=submit`);
  };

  if (loading) {
    return <LoadingState message="Loading submissions..." variant="page" />;
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stat Cards */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total', value: stats.total, color: 'text.primary' },
          { label: 'Pending', value: stats.pending, color: 'text.secondary' },
          { label: 'Under Review', value: stats.underReview, color: 'info.main' },
          { label: 'Approved', value: stats.approved, color: 'success.main' },
          { label: 'Rejected', value: stats.rejected, color: 'error.main' },
        ].map((stat) => (
          <Paper key={stat.label} sx={{ p: 2, flex: 1, textAlign: 'center' }}>
            <Typography variant="h5" color={stat.color} fontWeight={600}>
              {stat.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stat.label}
            </Typography>
          </Paper>
        ))}
      </Stack>

      {/* Filter Bar */}
      <FilterBar onClear={searchQuery || statusFilter ? handleClearFilters : undefined}>
        <TextField
          size="small"
          placeholder="Search by document number, title, or submitter..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ minWidth: 300 }}
        />

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Client Status</InputLabel>
          <Select
            value={statusFilter}
            label="Client Status"
            onChange={(e) => {
              setStatusFilter(e.target.value as ClientReviewStatus | '');
              setPage(0);
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </FilterBar>

      {/* Table */}
      {filteredSubmissions.length === 0 ? (
        <EmptyState
          message={
            submissions.length === 0
              ? 'No submissions yet. Submit documents from the Master Document List.'
              : 'No submissions match your filters.'
          }
          variant="paper"
        />
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Document Number</TableCell>
                  <TableCell>Document Title</TableCell>
                  <TableCell align="center">Sub #</TableCell>
                  <TableCell>Revision</TableCell>
                  <TableCell>Client Status</TableCell>
                  <TableCell align="center">Comments</TableCell>
                  <TableCell>Submitted By</TableCell>
                  <TableCell>Submitted Date</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedSubmissions.map((sub) => (
                  <TableRow
                    key={sub.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(sub)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium" noWrap>
                        {sub.documentNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {sub.documentTitle}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={`#${sub.submissionNumber}`} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip label={sub.revision} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={sub.clientStatus.replace(/_/g, ' ')}
                        size="small"
                        color={CLIENT_STATUS_COLORS[sub.clientStatus] || 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Chip label={sub.commentCount || 0} size="small" variant="outlined" />
                        {(sub.openCommentCount || 0) > 0 && (
                          <Tooltip title={`${sub.openCommentCount} open`}>
                            <Chip label={sub.openCommentCount} size="small" color="warning" />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>
                        {sub.submittedByName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(sub.submittedAt)}</Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <TableActionCell
                        actions={[
                          {
                            icon: <ViewIcon fontSize="small" />,
                            label: 'View Details',
                            onClick: () => {
                              setSelectedSubmission(sub);
                              setDetailOpen(true);
                            },
                          },
                          {
                            icon: <OpenIcon fontSize="small" />,
                            label: 'Open Document',
                            onClick: () => handleRowClick(sub),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredSubmissions.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100]}
          />
        </Paper>
      )}

      {/* Detail Dialog */}
      <SubmissionDetailsDialog
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedSubmission(null);
        }}
        submission={selectedSubmission}
      />
    </Box>
  );
}
