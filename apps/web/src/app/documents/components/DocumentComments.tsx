'use client';

/**
 * Document Comments Component
 *
 * Main component for managing document comments and resolutions
 * Features:
 * - Comment list with filtering (Open/Under Review/Resolved/Closed/All)
 * - Add new comment dialog
 * - View comment thread with resolution workflow
 * - Two-level approval (Assignee → PM)
 * - Real-time comment counts
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Alert,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import type { MasterDocumentEntry, DocumentComment, CommentStatus } from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import AddCommentDialog, { type CommentData } from './comments/AddCommentDialog';
import CommentsTable from './comments/CommentsTable';
import CommentThreadDialog from './comments/CommentThreadDialog';

interface DocumentCommentsProps {
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

type CommentFilter = 'ALL' | CommentStatus;

export default function DocumentComments({ document, onUpdate }: DocumentCommentsProps) {
  const { db } = getFirebase();

  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [filteredComments, setFilteredComments] = useState<DocumentComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CommentFilter>('ALL');

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [threadDialogOpen, setThreadDialogOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<DocumentComment | null>(null);

  // Get latest submission ID (for adding comments)
  const [latestSubmissionId, setLatestSubmissionId] = useState<string | undefined>();

  useEffect(() => {
    loadComments();
    loadLatestSubmission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  useEffect(() => {
    // Apply filter
    if (filter === 'ALL') {
      setFilteredComments(comments);
    } else {
      setFilteredComments(comments.filter((c) => c.status === filter));
    }
  }, [comments, filter]);

  const loadComments = async () => {
    if (!db) {
      console.error('[DocumentComments] Firebase db not initialized');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const commentsRef = collection(db, 'projects', document.projectId, 'documentComments');
      const q = query(
        commentsRef,
        where('masterDocumentId', '==', document.id),
        orderBy('commentNumber', 'asc')
      );

      const snapshot = await getDocs(q);
      const data: DocumentComment[] = [];

      snapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data(),
        } as DocumentComment);
      });

      setComments(data);
    } catch (err) {
      console.error('[DocumentComments] Error loading comments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const loadLatestSubmission = async () => {
    if (!db) return;

    try {
      const submissionsRef = collection(db, 'projects', document.projectId, 'documentSubmissions');
      const q = query(
        submissionsRef,
        where('masterDocumentId', '==', document.id),
        orderBy('submissionNumber', 'desc')
      );

      const snapshot = await getDocs(q);
      if (!snapshot.empty && snapshot.docs[0]) {
        setLatestSubmissionId(snapshot.docs[0].id);
      }
    } catch (err) {
      console.error('[DocumentComments] Error loading latest submission:', err);
    }
  };

  const handleAddComment = async (data: CommentData) => {
    try {
      // TODO: Implement actual comment creation
      // This will involve:
      // 1. Generate next comment number (C-001, C-002, etc.)
      // 2. Create DocumentComment in Firestore
      // 3. Update MasterDocumentEntry comment counts if needed

      console.warn('Adding comment:', data);

      // For now, show a placeholder alert
      alert('Comment creation will be implemented with Firestore integration');

      // Reload comments and update parent
      await loadComments();
      onUpdate();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add comment');
    }
  };

  const handleViewComment = (comment: DocumentComment) => {
    setSelectedComment(comment);
    setThreadDialogOpen(true);
  };

  const handleResolveComment = async (commentId: string, resolutionText: string) => {
    try {
      // TODO: Implement comment resolution
      // This will involve:
      // 1. Update DocumentComment with resolutionText, resolvedBy, resolvedAt
      // 2. Change status from OPEN to UNDER_REVIEW or RESOLVED
      // 3. Update comment counts

      console.warn('Resolving comment:', commentId, resolutionText);
      alert('Comment resolution will be implemented');

      await loadComments();
      onUpdate();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to resolve comment');
    }
  };

  const handleApproveResolution = async (commentId: string, remarks?: string) => {
    try {
      // TODO: Implement PM approval
      // This will involve:
      // 1. Update DocumentComment with pmApproved=true, pmApprovedBy, pmApprovedAt, pmRemarks
      // 2. Change status to CLOSED
      // 3. Update comment counts

      console.warn('Approving resolution:', commentId, remarks);
      alert('PM approval will be implemented');

      await loadComments();
      onUpdate();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to approve resolution');
    }
  };

  const handleRejectResolution = async (commentId: string, remarks: string) => {
    try {
      // TODO: Implement PM rejection
      // This will involve:
      // 1. Update DocumentComment with rejection remarks
      // 2. Change status back to OPEN or UNDER_REVIEW
      // 3. Notify assignee of rejection

      console.warn('Rejecting resolution:', commentId, remarks);
      alert('PM rejection will be implemented');

      await loadComments();
      onUpdate();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to reject resolution');
    }
  };

  // Calculate comment counts by status
  const commentCounts = {
    all: comments.length,
    open: comments.filter((c) => c.status === 'OPEN').length,
    underReview: comments.filter((c) => c.status === 'UNDER_REVIEW').length,
    resolved: comments.filter((c) => c.status === 'RESOLVED').length,
    closed: comments.filter((c) => c.status === 'CLOSED').length,
  };

  if (loading) {
    return (
      <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Loading comments...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">Comments & Resolution</Typography>
            <Typography variant="body2" color="text.secondary">
              {commentCounts.all} total comment{commentCounts.all !== 1 ? 's' : ''} •{' '}
              {commentCounts.open} open • {commentCounts.underReview} under review •{' '}
              {commentCounts.resolved} resolved • {commentCounts.closed} closed
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<RefreshIcon />}
              onClick={loadComments}
              disabled={loading}
              size="small"
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
            >
              Add Comment
            </Button>
          </Stack>
        </Stack>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Filter Bar */}
        <Stack direction="row" spacing={2} alignItems="center">
          <FilterIcon color="action" />
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={(_e, newFilter) => {
              if (newFilter !== null) setFilter(newFilter);
            }}
            size="small"
          >
            <ToggleButton value="ALL">
              All <Chip label={commentCounts.all} size="small" sx={{ ml: 0.5 }} />
            </ToggleButton>
            <ToggleButton value="OPEN">
              Open <Chip label={commentCounts.open} size="small" sx={{ ml: 0.5 }} />
            </ToggleButton>
            <ToggleButton value="UNDER_REVIEW">
              Under Review <Chip label={commentCounts.underReview} size="small" sx={{ ml: 0.5 }} />
            </ToggleButton>
            <ToggleButton value="RESOLVED">
              Resolved <Chip label={commentCounts.resolved} size="small" sx={{ ml: 0.5 }} />
            </ToggleButton>
            <ToggleButton value="CLOSED">
              Closed <Chip label={commentCounts.closed} size="small" sx={{ ml: 0.5 }} />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {/* Comments Table */}
        <CommentsTable
          comments={filteredComments}
          onViewComment={handleViewComment}
          onRespondToComment={handleViewComment}
        />

        {/* Empty State */}
        {comments.length === 0 && (
          <Alert severity="info">
            <Typography variant="body2">
              No comments have been added yet. Click &quot;Add Comment&quot; to create the first
              comment.
            </Typography>
          </Alert>
        )}
      </Stack>

      {/* Dialogs */}
      <AddCommentDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        document={document}
        submissionId={latestSubmissionId}
        onSubmit={handleAddComment}
      />

      <CommentThreadDialog
        open={threadDialogOpen}
        onClose={() => {
          setThreadDialogOpen(false);
          setSelectedComment(null);
        }}
        comment={selectedComment}
        canResolve={true} // TODO: Check user permissions
        canApprove={true} // TODO: Check if user is PM
        onResolve={handleResolveComment}
        onApprove={handleApproveResolution}
        onReject={handleRejectResolution}
      />
    </Box>
  );
}
