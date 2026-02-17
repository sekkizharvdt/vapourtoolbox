'use client';

/**
 * Feedback Detail Page
 *
 * Shows detailed feedback information with actions for:
 * - Closing resolved feedback (marking as satisfied)
 * - Adding follow-up comments if not satisfied
 */

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  BugReport as BugReportIcon,
  Lightbulb as LightbulbIcon,
  ChatBubble as ChatBubbleIcon,
  CheckCircle as CheckCircleIcon,
  Replay as ReplayIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { doc, onSnapshot, getDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { PageHeader } from '@vapour/ui';
import { formatDistanceToNow, format } from 'date-fns';
import { closeFeedbackFromTask, addFollowUpToFeedback } from '@/lib/feedback/feedbackTaskService';
import {
  completeActionableTask,
  findTaskNotificationByEntity,
} from '@/lib/tasks/taskNotificationService';

type FeedbackType = 'bug' | 'feature' | 'general';
type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';

interface FollowUpComment {
  userId: string;
  userName: string;
  comment: string;
  createdAt: Timestamp;
}

interface FeedbackDocument {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  status: FeedbackStatus;
  userName: string;
  userEmail: string;
  userId?: string;
  adminNotes?: string;
  followUpComments?: FollowUpComment[];
  screenshotUrls?: string[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  closedAt?: Timestamp;
  closedBy?: string;
  closedByName?: string;
}

const typeConfig: Record<
  FeedbackType,
  { label: string; icon: React.ReactNode; color: 'error' | 'info' | 'default' }
> = {
  bug: { label: 'Bug Report', icon: <BugReportIcon />, color: 'error' },
  feature: { label: 'Feature Request', icon: <LightbulbIcon />, color: 'info' },
  general: { label: 'General Feedback', icon: <ChatBubbleIcon />, color: 'default' },
};

const statusConfig: Record<
  FeedbackStatus,
  { label: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning' }
> = {
  new: { label: 'New', color: 'primary' },
  in_progress: { label: 'In Progress', color: 'warning' },
  resolved: { label: 'Resolved', color: 'success' },
  closed: { label: 'Closed', color: 'default' },
  wont_fix: { label: "Won't Fix", color: 'error' },
};

export default function FeedbackDetailClient() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Extract feedback ID from pathname for static export compatibility
  const [feedbackId, setFeedbackId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<FeedbackDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/feedback\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setFeedbackId(extractedId);
      } else if (pathname.includes('/feedback/')) {
        // Pathname is ready but no valid ID found
        setError('Invalid feedback ID');
        setLoading(false);
      }
    }
  }, [pathname]);

  // Deploy info state
  const [deployedAt, setDeployedAt] = useState<Date | null>(null);

  // Follow-up dialog state
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [followUpComment, setFollowUpComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Close confirmation dialog state
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  // Subscribe to feedback document - wait for auth and feedbackId to be ready
  useEffect(() => {
    // Wait for auth to complete before attempting data fetch
    if (authLoading) {
      return;
    }

    // Wait for feedbackId to be extracted from pathname
    // Don't set error here - the ID extraction useEffect may still be pending
    if (!feedbackId) {
      return;
    }

    const { db } = getFirebase();
    const feedbackRef = doc(db, 'feedback', feedbackId);

    const unsubscribe = onSnapshot(
      feedbackRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setFeedback({ id: docSnap.id, ...docSnap.data() } as FeedbackDocument);
        } else {
          setError('Feedback not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching feedback:', err);
        setError('Failed to load feedback');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [feedbackId, authLoading]);

  // Fetch deploy info when feedback is resolved (so user knows if fix is live)
  useEffect(() => {
    if (!feedback || feedback.status !== 'resolved') return;
    const { db } = getFirebase();
    getDoc(doc(db, 'systemConfig', 'deployInfo')).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const ts = data.deployedAt?.toDate?.() || null;
        setDeployedAt(ts);
      }
    });
  }, [feedback]);

  // Handle closing feedback
  const handleCloseFeedback = async () => {
    if (!feedback || !user || !feedbackId) return;

    setSubmitting(true);
    try {
      const { db } = getFirebase();
      const userName = user.displayName || user.email || 'User';

      await closeFeedbackFromTask(db, feedbackId, user.uid, userName);

      // Complete the associated task if exists (could be pending or in_progress)
      const task = await findTaskNotificationByEntity(
        'FEEDBACK',
        feedbackId,
        'FEEDBACK_RESOLUTION_CHECK',
        ['pending', 'in_progress']
      );
      if (task) {
        await completeActionableTask(task.id, user.uid, false);
      }

      setCloseDialogOpen(false);
      // Optionally navigate back or show success message
    } catch (err) {
      console.error('Error closing feedback:', err);
      setError('Failed to close feedback');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle follow-up submission
  const handleSubmitFollowUp = async () => {
    if (!feedback || !user || !followUpComment.trim() || !feedbackId) return;

    setSubmitting(true);
    try {
      const { db } = getFirebase();
      const userName = user.displayName || user.email || 'User';

      await addFollowUpToFeedback(db, feedbackId, followUpComment.trim(), user.uid, userName);

      setFollowUpDialogOpen(false);
      setFollowUpComment('');
    } catch (err) {
      console.error('Error adding follow-up:', err);
      setError('Failed to submit follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  // Check if user owns this feedback
  const isOwner = feedback?.userId === user?.uid;
  const canTakeAction = isOwner && feedback?.status === 'resolved';

  // Show loading while auth OR data is loading
  // NOTE: Don't wrap in AuthenticatedLayout here - it has its own loading check
  // that would block rendering when auth is still loading
  if (authLoading || loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error || !feedback) {
    return (
      <AuthenticatedLayout>
        <Box sx={{ maxWidth: 'md', mx: 'auto', py: 4 }}>
          <Alert severity="error">{error || 'Feedback not found'}</Alert>
          <Button onClick={() => router.push('/feedback')} sx={{ mt: 2 }}>
            Back to Feedback
          </Button>
        </Box>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <Box sx={{ maxWidth: 'md', mx: 'auto', py: 2 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            color="inherit"
            href="/feedback"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/feedback');
            }}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Feedback
          </Link>
          <Typography color="text.primary">{feedback.title}</Typography>
        </Breadcrumbs>
        <PageHeader title={feedback.title} />

        {/* Status and Type */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Chip
            label={statusConfig[feedback.status].label}
            color={statusConfig[feedback.status].color}
          />
          <Chip
            label={typeConfig[feedback.type].label}
            icon={typeConfig[feedback.type].icon as React.ReactElement}
            variant="outlined"
          />
        </Stack>

        {/* Action Banner for Resolved Feedback */}
        {canTakeAction && (
          <Alert
            severity="info"
            sx={{ mb: 3 }}
            action={
              <Stack direction="row" spacing={1}>
                <Button
                  color="success"
                  variant="contained"
                  size="small"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => setCloseDialogOpen(true)}
                >
                  Close - Resolved
                </Button>
                <Button
                  color="warning"
                  variant="outlined"
                  size="small"
                  startIcon={<ReplayIcon />}
                  onClick={() => setFollowUpDialogOpen(true)}
                >
                  Follow Up
                </Button>
              </Stack>
            }
          >
            This issue has been marked as resolved. Please verify and close or provide follow-up.
          </Alert>
        )}

        {/* Main Content */}
        <Paper sx={{ p: 3, mb: 3 }}>
          {/* Description */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Description
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {feedback.description}
            </Typography>
          </Box>

          {/* Screenshots */}
          {feedback.screenshotUrls && feedback.screenshotUrls.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Screenshots
              </Typography>
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                {feedback.screenshotUrls.map((url, index) => (
                  <Box
                    key={index}
                    component="a"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: 'block',
                      width: 200,
                      height: 150,
                      borderRadius: 1,
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box
                      component="img"
                      src={url}
                      alt={`Screenshot ${index + 1}`}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Metadata */}
          <Stack direction="row" spacing={4}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Submitted by
              </Typography>
              <Typography variant="body2">{feedback.userName}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Submitted
              </Typography>
              <Typography variant="body2">{format(feedback.createdAt.toDate(), 'PPp')}</Typography>
            </Box>
            {feedback.updatedAt && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Last Updated
                </Typography>
                <Typography variant="body2">
                  {formatDistanceToNow(feedback.updatedAt.toDate(), { addSuffix: true })}
                </Typography>
              </Box>
            )}
          </Stack>
        </Paper>

        {/* Resolution Notes */}
        {feedback.adminNotes && (
          <Card sx={{ mb: 3, bgcolor: 'success.50' }}>
            <CardContent>
              <Typography variant="subtitle2" color="success.dark" gutterBottom>
                Resolution Notes
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {feedback.adminNotes}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Deploy Status — shown for resolved bug reports */}
        {feedback.status === 'resolved' && feedback.type === 'bug' && (
          <Alert
            severity={
              deployedAt && feedback.updatedAt && deployedAt > feedback.updatedAt.toDate()
                ? 'success'
                : 'info'
            }
            sx={{ mb: 3 }}
          >
            {deployedAt && feedback.updatedAt && deployedAt > feedback.updatedAt.toDate() ? (
              <>The fix has been deployed (last deployment: {format(deployedAt, 'PPp')}).</>
            ) : deployedAt ? (
              <>
                The fix has not been deployed yet. Last deployment was{' '}
                {formatDistanceToNow(deployedAt, { addSuffix: true })}. The fix will be available
                after the next deployment.
              </>
            ) : (
              <>The fix will be available after the next deployment.</>
            )}
          </Alert>
        )}

        {/* Follow-up Comments */}
        {feedback.followUpComments && feedback.followUpComments.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Follow-up Comments
            </Typography>
            <Stack spacing={2}>
              {feedback.followUpComments.map((comment, index) => (
                <Card key={index} variant="outlined">
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography variant="subtitle2">{comment.userName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true })}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {comment.comment}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* Closed Info */}
        {feedback.status === 'closed' && feedback.closedAt && (
          <Alert severity="success" sx={{ mb: 3 }}>
            This feedback was closed by {feedback.closedByName || 'the reporter'}{' '}
            {formatDistanceToNow(feedback.closedAt.toDate(), { addSuffix: true })}.
          </Alert>
        )}

        {/* Back Button */}
        <Button onClick={() => router.push('/feedback')}>Back to Feedback</Button>

        {/* Close Confirmation Dialog */}
        <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)}>
          <DialogTitle>Close Feedback</DialogTitle>
          <DialogContent>
            <Typography>
              Are you satisfied with the resolution? Closing this feedback will mark it as resolved
              to your satisfaction.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCloseDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleCloseFeedback}
              variant="contained"
              color="success"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={20} /> : <CheckCircleIcon />}
            >
              {submitting ? 'Closing...' : 'Yes, Close Feedback'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Follow-up Dialog */}
        <Dialog
          open={followUpDialogOpen}
          onClose={() => setFollowUpDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Add Follow-up Comment</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              If the issue is not fully resolved, please provide additional details. The support
              team will be notified and will follow up.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={followUpComment}
              onChange={(e) => setFollowUpComment(e.target.value)}
              placeholder="Describe what is still not working or needs more attention..."
              disabled={submitting}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFollowUpDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFollowUp}
              variant="contained"
              color="warning"
              disabled={submitting || !followUpComment.trim()}
              startIcon={submitting ? <CircularProgress size={20} /> : <ReplayIcon />}
            >
              {submitting ? 'Submitting...' : 'Submit Follow-up'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AuthenticatedLayout>
  );
}
