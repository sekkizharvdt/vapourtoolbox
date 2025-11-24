'use client';

/**
 * Comment Thread Dialog
 *
 * Full comment details and resolution workflow
 * - Complete comment information
 * - Resolution workflow (2-level: Assignee → PM Approval)
 * - Response form
 * - Approval actions
 * - Status timeline
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Box,
  Chip,
  TextField,
  Divider,
  Alert,
  Paper,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
} from '@mui/icons-material';
import type { DocumentComment } from '@vapour/types';

interface CommentThreadDialogProps {
  open: boolean;
  onClose: () => void;
  comment: DocumentComment | null;
  canResolve?: boolean;
  canApprove?: boolean;
  onResolve?: (commentId: string, resolutionText: string) => Promise<void>;
  onApprove?: (commentId: string, remarks?: string) => Promise<void>;
  onReject?: (commentId: string, remarks: string) => Promise<void>;
}

export default function CommentThreadDialog({
  open,
  onClose,
  comment,
  canResolve = false,
  canApprove = false,
  onResolve,
  onApprove,
  onReject,
}: CommentThreadDialogProps) {
  const [resolutionText, setResolutionText] = useState('');
  const [pmRemarks, setPmRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!comment) return null;

  const getSeverityColor = (severity: string): string => {
    const colors: Record<string, string> = {
      CRITICAL: '#d32f2f',
      MAJOR: '#f57c00',
      MINOR: '#fbc02d',
      SUGGESTION: '#388e3c',
    };
    return colors[severity] || '#000';
  };

  const formatDate = (timestamp: { seconds: number } | null | undefined): string => {
    if (!timestamp) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleResolve = async () => {
    if (!resolutionText.trim()) {
      setError('Please enter a resolution response');
      return;
    }

    if (!onResolve) return;

    setSubmitting(true);
    setError(null);

    try {
      await onResolve(comment.id, resolutionText.trim());
      setResolutionText('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!onApprove) return;

    setSubmitting(true);
    setError(null);

    try {
      await onApprove(comment.id, pmRemarks.trim() || undefined);
      setPmRemarks('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve resolution');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!pmRemarks.trim()) {
      setError('Please enter remarks explaining why this resolution is being rejected');
      return;
    }

    if (!onReject) return;

    setSubmitting(true);
    setError(null);

    try {
      await onReject(comment.id, pmRemarks.trim());
      setPmRemarks('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject resolution');
    } finally {
      setSubmitting(false);
    }
  };

  const showResolveForm = canResolve && comment.status === 'OPEN';
  const showApprovalForm =
    canApprove && (comment.status === 'RESOLVED' || comment.status === 'UNDER_REVIEW');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6">Comment {comment.commentNumber}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip
                label={comment.severity}
                size="small"
                sx={{
                  bgcolor: getSeverityColor(comment.severity),
                  color: 'white',
                  fontWeight: 600,
                }}
              />
              <Chip label={comment.category} size="small" variant="outlined" />
              <Chip
                label={comment.status.replace(/_/g, ' ')}
                size="small"
                color={
                  comment.status === 'CLOSED'
                    ? 'success'
                    : comment.status === 'RESOLVED'
                      ? 'info'
                      : 'warning'
                }
              />
            </Stack>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Original Comment */}
          <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Original Comment
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
              {comment.commentText}
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                By: {comment.commentedByName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Date: {formatDate(comment.commentedAt)}
              </Typography>
            </Stack>
          </Paper>

          {/* Location Information */}
          {(comment.pageNumber || comment.section || comment.lineItem) && (
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Location
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                {comment.pageNumber && (
                  <Chip label={`Page ${comment.pageNumber}`} size="small" variant="outlined" />
                )}
                {comment.section && (
                  <Chip label={`Section ${comment.section}`} size="small" variant="outlined" />
                )}
                {comment.lineItem && (
                  <Chip label={comment.lineItem} size="small" variant="outlined" />
                )}
              </Stack>
            </Box>
          )}

          <Divider />

          {/* Resolution (if exists) */}
          {comment.resolutionText && (
            <>
              <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                <Typography variant="caption" gutterBottom>
                  Resolution Response
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                  {comment.resolutionText}
                </Typography>
                {comment.resolvedByName && comment.resolvedAt && (
                  <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                    <Typography variant="caption">By: {comment.resolvedByName}</Typography>
                    <Typography variant="caption">
                      Date: {formatDate(comment.resolvedAt)}
                    </Typography>
                  </Stack>
                )}
              </Paper>
              <Divider />
            </>
          )}

          {/* PM Approval Status */}
          {comment.pmApproved && (
            <Alert severity="success" icon={<ApproveIcon />}>
              <Typography variant="body2" fontWeight="medium">
                PM Approved by {comment.pmApprovedByName}
              </Typography>
              <Typography variant="caption" display="block">
                {formatDate(comment.pmApprovedAt)}
              </Typography>
              {comment.pmRemarks && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Remarks: {comment.pmRemarks}
                </Typography>
              )}
            </Alert>
          )}

          {/* Client Acceptance Status */}
          {comment.clientAccepted && (
            <Alert severity="info">
              <Typography variant="body2" fontWeight="medium">
                Client Accepted
              </Typography>
              <Typography variant="caption" display="block">
                {formatDate(comment.clientAcceptedAt)}
              </Typography>
              {comment.clientAcceptanceRemarks && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Remarks: {comment.clientAcceptanceRemarks}
                </Typography>
              )}
            </Alert>
          )}

          {/* Resolution Form (for assignee) */}
          {showResolveForm && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Provide Resolution
                </Typography>
                <TextField
                  label="Resolution Response"
                  multiline
                  rows={6}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Explain how this comment will be addressed or has been resolved..."
                  disabled={submitting}
                  fullWidth
                  required
                />
              </Box>
            </>
          )}

          {/* Approval Form (for PM) */}
          {showApprovalForm && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Project Manager Review
                </Typography>
                <TextField
                  label="PM Remarks (Optional)"
                  multiline
                  rows={3}
                  value={pmRemarks}
                  onChange={(e) => setPmRemarks(e.target.value)}
                  placeholder="Add any remarks or feedback on the resolution..."
                  disabled={submitting}
                  fullWidth
                />
              </Box>
            </>
          )}

          {/* Error Message */}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Close
        </Button>

        {/* Resolution Actions */}
        {showResolveForm && (
          <Button
            onClick={handleResolve}
            variant="contained"
            color="success"
            disabled={!resolutionText.trim() || submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Resolution'}
          </Button>
        )}

        {/* Approval Actions */}
        {showApprovalForm && (
          <>
            <Button
              onClick={handleReject}
              variant="outlined"
              color="error"
              startIcon={<RejectIcon />}
              disabled={submitting}
            >
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              variant="contained"
              color="success"
              startIcon={<ApproveIcon />}
              disabled={submitting}
            >
              {submitting ? 'Approving...' : 'Approve'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
