'use client';

/**
 * Submissions Table Component
 *
 * Displays all document submissions with:
 * - Revision history
 * - Submission status
 * - Client review status
 * - Comment counts
 * - Download links
 * - Action buttons
 */

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Typography,
  Box,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Comment as CommentIcon,
  Description as CRTIcon,
} from '@mui/icons-material';
import type { DocumentSubmission } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

interface SubmissionsTableProps {
  submissions: DocumentSubmission[];
  onViewSubmission: (submission: DocumentSubmission) => void;
  onViewComments: (submission: DocumentSubmission) => void;
  onDownloadCRT: (submission: DocumentSubmission) => void;
}

export default function SubmissionsTable({
  submissions,
  onViewSubmission,
  onViewComments,
  onDownloadCRT,
}: SubmissionsTableProps) {
  const getClientStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const colors: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
      PENDING: 'warning',
      UNDER_REVIEW: 'info',
      APPROVED: 'success',
      APPROVED_WITH_COMMENTS: 'success',
      REJECTED: 'error',
      CONDITIONALLY_APPROVED: 'warning',
    };
    return colors[status] || 'default';
  };

  const getClientStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      PENDING: 'Pending Review',
      UNDER_REVIEW: 'Under Review',
      APPROVED: 'Approved',
      APPROVED_WITH_COMMENTS: 'Approved (w/ Comments)',
      REJECTED: 'Rejected',
      CONDITIONALLY_APPROVED: 'Conditionally Approved',
    };
    return labels[status] || status;
  };


  if (submissions.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No submissions yet. Click &quot;New Submission&quot; to submit the first revision.
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Submission #</TableCell>
            <TableCell>Revision</TableCell>
            <TableCell>Submitted By</TableCell>
            <TableCell>Submitted Date</TableCell>
            <TableCell>Client Status</TableCell>
            <TableCell align="center">Comments</TableCell>
            <TableCell>Reviewed Date</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {submissions
            .sort((a, b) => b.submissionNumber - a.submissionNumber)
            .map((submission) => (
              <TableRow key={submission.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    #{submission.submissionNumber}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Chip label={submission.revision} size="small" />
                </TableCell>

                <TableCell>
                  <Typography variant="body2">{submission.submittedByName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(submission.submittedAt)}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Typography variant="body2">{formatDate(submission.submittedAt)}</Typography>
                </TableCell>

                <TableCell>
                  <Chip
                    label={getClientStatusLabel(submission.clientStatus)}
                    color={getClientStatusColor(submission.clientStatus)}
                    size="small"
                  />
                </TableCell>

                <TableCell align="center">
                  {submission.commentCount > 0 ? (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      justifyContent="center"
                      alignItems="center"
                    >
                      <CommentIcon fontSize="small" color="action" />
                      <Typography variant="body2">{submission.commentCount}</Typography>
                      {submission.openCommentCount > 0 && (
                        <Chip
                          label={submission.openCommentCount}
                          size="small"
                          color="warning"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  )}
                </TableCell>

                <TableCell>
                  {submission.clientReviewedAt ? (
                    <Box>
                      <Typography variant="body2">
                        {formatDate(submission.clientReviewedAt)}
                      </Typography>
                      {submission.clientReviewedByName && (
                        <Typography variant="caption" color="text.secondary">
                          by {submission.clientReviewedByName}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  )}
                </TableCell>

                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => onViewSubmission(submission)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Download Document">
                      <IconButton size="small">
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    {submission.commentCount > 0 && (
                      <Tooltip title="View Comments">
                        <IconButton size="small" onClick={() => onViewComments(submission)}>
                          <CommentIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}

                    {submission.crtGenerated && (
                      <Tooltip title="Download CRT">
                        <IconButton size="small" onClick={() => onDownloadCRT(submission)}>
                          <CRTIcon fontSize="small" />
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
  );
}
