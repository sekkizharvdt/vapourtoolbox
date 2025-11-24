'use client';

/**
 * Comments Table Component
 *
 * Displays all comments with filtering capabilities
 * - Filter by status (Open/Under Review/Resolved/Closed)
 * - Color-coded severity indicators
 * - Status badges
 * - Action buttons (view thread, respond)
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
  Reply as ReplyIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import type { DocumentComment } from '@vapour/types';

interface CommentsTableProps {
  comments: DocumentComment[];
  onViewComment: (comment: DocumentComment) => void;
  onRespondToComment?: (comment: DocumentComment) => void;
}

export default function CommentsTable({
  comments,
  onViewComment,
  onRespondToComment,
}: CommentsTableProps) {
  const getSeverityColor = (severity: string): string => {
    const colors: Record<string, string> = {
      CRITICAL: '#d32f2f',
      MAJOR: '#f57c00',
      MINOR: '#fbc02d',
      SUGGESTION: '#388e3c',
    };
    return colors[severity] || '#000';
  };

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const colors: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
      OPEN: 'error' as 'default',
      UNDER_REVIEW: 'warning',
      RESOLVED: 'info',
      CLOSED: 'success',
    };
    return colors[status] || 'default';
  };

  const formatDate = (timestamp: { seconds: number } | null | undefined): string => {
    if (!timestamp) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getLocationString = (comment: DocumentComment): string => {
    const parts: string[] = [];
    if (comment.pageNumber) parts.push(`Page ${comment.pageNumber}`);
    if (comment.section) parts.push(`§${comment.section}`);
    if (comment.lineItem) parts.push(comment.lineItem);
    return parts.length > 0 ? parts.join(' · ') : '-';
  };

  if (comments.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No comments found
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width="100px">Comment #</TableCell>
              <TableCell width="100px">Severity</TableCell>
              <TableCell>Comment Text</TableCell>
              <TableCell width="120px">Category</TableCell>
              <TableCell width="150px">Location</TableCell>
              <TableCell width="120px">Status</TableCell>
              <TableCell width="100px">Date</TableCell>
              <TableCell width="120px" align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {comments.map((comment) => (
              <TableRow key={comment.id} hover>
                {/* Comment Number */}
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {comment.commentNumber}
                  </Typography>
                </TableCell>

                {/* Severity */}
                <TableCell>
                  <Chip
                    label={comment.severity}
                    size="small"
                    sx={{
                      bgcolor: getSeverityColor(comment.severity),
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                    }}
                  />
                </TableCell>

                {/* Comment Text (truncated) */}
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      maxWidth: 400,
                    }}
                  >
                    {comment.commentText}
                  </Typography>
                  {comment.commentedByName && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      by {comment.commentedByName}
                    </Typography>
                  )}
                </TableCell>

                {/* Category */}
                <TableCell>
                  <Typography variant="body2">{comment.category.replace(/_/g, ' ')}</Typography>
                </TableCell>

                {/* Location */}
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {getLocationString(comment)}
                  </Typography>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Stack spacing={0.5}>
                    <Chip
                      label={comment.status.replace(/_/g, ' ')}
                      color={getStatusColor(comment.status)}
                      size="small"
                      sx={{ fontSize: '0.7rem' }}
                    />
                    {comment.pmApproved && (
                      <Chip
                        icon={<CheckIcon fontSize="small" />}
                        label="PM Approved"
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ fontSize: '0.65rem' }}
                      />
                    )}
                    {comment.clientAccepted && (
                      <Chip
                        icon={<CheckIcon fontSize="small" />}
                        label="Client Accepted"
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: '0.65rem' }}
                      />
                    )}
                  </Stack>
                </TableCell>

                {/* Date */}
                <TableCell>
                  <Typography variant="body2">{formatDate(comment.commentedAt)}</Typography>
                </TableCell>

                {/* Actions */}
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title="View Thread">
                      <IconButton size="small" onClick={() => onViewComment(comment)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {comment.status !== 'CLOSED' && onRespondToComment && (
                      <Tooltip title="Respond">
                        <IconButton size="small" onClick={() => onRespondToComment(comment)}>
                          <ReplyIcon fontSize="small" />
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
