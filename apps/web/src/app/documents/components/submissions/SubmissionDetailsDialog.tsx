'use client';

/**
 * Submission Details Dialog
 *
 * Shows full details of a document submission:
 * - Submission metadata
 * - File information
 * - Client review status and remarks
 * - Comment summary
 * - Download options
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Chip,
  Box,
  Stack,
  Divider,
  Alert,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Comment as CommentIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import type { DocumentSubmission } from '@vapour/types';

interface SubmissionDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  submission: DocumentSubmission | null;
}

export default function SubmissionDetailsDialog({
  open,
  onClose,
  submission,
}: SubmissionDetailsDialogProps) {
  if (!submission) return null;

  const formatDate = (timestamp: { seconds: number } | undefined): string => {
    if (!timestamp) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Submission Details
        <Typography variant="body2" color="text.secondary">
          {submission.documentNumber} - Revision {submission.revision}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Submission Info */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Submission Information
            </Typography>
            <Stack spacing={2}>
              <Stack direction="row" spacing={4}>
                <Stack direction="row" spacing={1} alignItems="center" flex={1}>
                  <PersonIcon fontSize="small" color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Submitted By
                    </Typography>
                    <Typography variant="body2">{submission.submittedByName}</Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" flex={1}>
                  <CalendarIcon fontSize="small" color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Submitted At
                    </Typography>
                    <Typography variant="body2">{formatDate(submission.submittedAt)}</Typography>
                  </Box>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={4}>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">
                    Submission Number
                  </Typography>
                  <Typography variant="body2">#{submission.submissionNumber}</Typography>
                </Box>
                <Box flex={1}>
                  <Typography variant="caption" color="text.secondary">
                    Revision
                  </Typography>
                  <Typography variant="body2">
                    <Chip label={submission.revision} size="small" />
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Box>

          {/* Submission Notes */}
          {submission.submissionNotes && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Submission Notes
              </Typography>
              <Typography
                variant="body2"
                sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}
              >
                {submission.submissionNotes}
              </Typography>
            </Box>
          )}

          <Divider />

          {/* Client Review Status */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Client Review Status
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Chip
                  label={submission.clientStatus.replace(/_/g, ' ')}
                  color={getClientStatusColor(submission.clientStatus)}
                />
              </Box>

              {submission.clientReviewedAt && (
                <Stack direction="row" spacing={4}>
                  <Box flex={1}>
                    <Typography variant="caption" color="text.secondary">
                      Reviewed By
                    </Typography>
                    <Typography variant="body2">
                      {submission.clientReviewedByName || 'Unknown'}
                    </Typography>
                  </Box>
                  <Box flex={1}>
                    <Typography variant="caption" color="text.secondary">
                      Reviewed At
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(submission.clientReviewedAt)}
                    </Typography>
                  </Box>
                </Stack>
              )}

              {submission.clientRemarks && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Client Remarks
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, mt: 0.5 }}
                  >
                    {submission.clientRemarks}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>

          {/* Comments Summary */}
          {submission.commentCount > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Comments Summary
              </Typography>
              <Stack direction="row" spacing={3}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CommentIcon fontSize="small" color="action" />
                  <Box>
                    <Typography variant="h6">{submission.commentCount}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total
                    </Typography>
                  </Box>
                </Stack>
                <Box>
                  <Typography variant="h6" color="warning.main">
                    {submission.openCommentCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Open
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h6" color="info.main">
                    {submission.resolvedCommentCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Resolved
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h6" color="success.main">
                    {submission.closedCommentCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Closed
                  </Typography>
                </Box>
              </Stack>
            </Box>
          )}

          {/* Comment Resolution Table */}
          {submission.crtGenerated && (
            <Alert severity="info" icon={false}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Comment Resolution Table Generated
                  </Typography>
                  <Typography variant="caption">
                    Generated on {formatDate(submission.crtGeneratedAt)}
                  </Typography>
                </Box>
                <Button size="small" startIcon={<DownloadIcon />}>
                  Download CRT
                </Button>
              </Stack>
            </Alert>
          )}

          {/* Resubmission Info */}
          {submission.requiresResubmission && (
            <Alert severity="warning">
              This submission requires resubmission based on client feedback.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button startIcon={<DownloadIcon />}>Download Document</Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
