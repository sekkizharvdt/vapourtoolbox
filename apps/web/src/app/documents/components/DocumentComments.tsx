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
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import type {
  MasterDocumentEntry,
  DocumentComment,
  CommentStatus,
  DocumentSubmission,
  CommentResolutionSheet,
} from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import {
  createComment,
  resolveComment,
  approveCommentResolution,
  rejectCommentResolution,
} from '@/lib/documents/commentService';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import AddCommentDialog, { type CommentData } from './comments/AddCommentDialog';
import CommentsTable from './comments/CommentsTable';
import CommentThreadDialog from './comments/CommentThreadDialog';
import UploadCRSDialog from './comments/UploadCRSDialog';
import CRSList from './comments/CRSList';
import { getCRSByMasterDocument } from '@/lib/documents/crsService';

interface DocumentCommentsProps {
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

type CommentFilter = 'ALL' | CommentStatus;

export default function DocumentComments({ document, onUpdate }: DocumentCommentsProps) {
  const { db } = getFirebase();
  const { user, claims } = useAuth();

  // Permission checks - any authenticated user can resolve, managers can approve
  const canResolve = !!user;
  const canApprove = hasPermission(claims?.permissions || 0, PERMISSION_FLAGS.MANAGE_PROJECTS);

  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [filteredComments, setFilteredComments] = useState<DocumentComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CommentFilter>('ALL');

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [threadDialogOpen, setThreadDialogOpen] = useState(false);
  const [uploadCRSDialogOpen, setUploadCRSDialogOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<DocumentComment | null>(null);

  // Submissions and CRS
  const [submissions, setSubmissions] = useState<DocumentSubmission[]>([]);
  const [crsList, setCRSList] = useState<CommentResolutionSheet[]>([]);
  const [latestSubmissionId, setLatestSubmissionId] = useState<string | undefined>();

  useEffect(() => {
    loadComments();
    loadSubmissions();
    loadCRSList();
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

  const loadSubmissions = async () => {
    if (!db) return;

    try {
      const submissionsRef = collection(db, 'projects', document.projectId, 'documentSubmissions');
      const q = query(
        submissionsRef,
        where('masterDocumentId', '==', document.id),
        orderBy('submissionNumber', 'desc')
      );

      const snapshot = await getDocs(q);
      const data: DocumentSubmission[] = [];

      snapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data(),
        } as DocumentSubmission);
      });

      setSubmissions(data);
      if (data.length > 0 && data[0]) {
        setLatestSubmissionId(data[0].id);
      }
    } catch (err) {
      console.error('[DocumentComments] Error loading submissions:', err);
    }
  };

  const loadCRSList = async () => {
    if (!db) return;

    try {
      const data = await getCRSByMasterDocument(db, document.projectId, document.id);
      setCRSList(data);
    } catch (err) {
      console.error('[DocumentComments] Error loading CRS list:', err);
    }
  };

  const handleAddComment = async (data: CommentData) => {
    if (!db || !user || !latestSubmissionId) {
      throw new Error('Missing required data for creating comment');
    }

    try {
      await createComment(db, {
        projectId: document.projectId,
        masterDocumentId: document.id,
        submissionId: latestSubmissionId,
        commentText: data.commentText,
        severity: data.severity,
        category: data.category,
        pageNumber: data.pageNumber,
        section: data.section,
        lineItem: data.lineItem,
        commentedBy: user.uid,
        commentedByName: user.displayName || user.email || 'Unknown',
      });

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
    if (!db || !user || !latestSubmissionId) {
      throw new Error('Missing required data for resolving comment');
    }

    try {
      await resolveComment(db, {
        projectId: document.projectId,
        submissionId: latestSubmissionId,
        commentId,
        resolutionText,
        resolvedBy: user.uid,
        resolvedByName: user.displayName || user.email || 'Unknown',
      });

      await loadComments();
      onUpdate();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to resolve comment');
    }
  };

  const handleApproveResolution = async (commentId: string, remarks?: string) => {
    if (!db || !user || !latestSubmissionId) {
      throw new Error('Missing required data for approving resolution');
    }

    try {
      await approveCommentResolution(db, {
        projectId: document.projectId,
        submissionId: latestSubmissionId,
        commentId,
        pmApprovedBy: user.uid,
        pmApprovedByName: user.displayName || user.email || 'Unknown',
        pmRemarks: remarks,
      });

      await loadComments();
      onUpdate();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to approve resolution');
    }
  };

  const handleRejectResolution = async (commentId: string, remarks: string) => {
    if (!db || !latestSubmissionId) {
      throw new Error('Missing required data for rejecting resolution');
    }

    try {
      await rejectCommentResolution(db, {
        projectId: document.projectId,
        submissionId: latestSubmissionId,
        commentId,
        pmRemarks: remarks,
      });

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
              onClick={() => {
                loadComments();
                loadCRSList();
              }}
              disabled={loading}
              size="small"
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setUploadCRSDialogOpen(true)}
            >
              Upload CRS
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

        {/* Uploaded CRS Files */}
        {crsList.length > 0 && <CRSList crsList={crsList} />}

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
        canResolve={canResolve}
        canApprove={canApprove}
        onResolve={handleResolveComment}
        onApprove={handleApproveResolution}
        onReject={handleRejectResolution}
      />

      <UploadCRSDialog
        open={uploadCRSDialogOpen}
        onClose={() => setUploadCRSDialogOpen(false)}
        document={document}
        submissions={submissions}
        onSuccess={() => {
          loadCRSList();
          onUpdate();
        }}
      />
    </Box>
  );
}
