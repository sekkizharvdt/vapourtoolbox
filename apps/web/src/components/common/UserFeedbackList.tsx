'use client';

/**
 * User Feedback List Component
 *
 * Shows users their own submitted feedback with status and stats
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Collapse,
  IconButton,
  Divider,
  Paper,
  Button,
} from '@mui/material';
import {
  BugReport as BugReportIcon,
  Lightbulb as LightbulbIcon,
  ChatBubble as ChatBubbleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassIcon,
  FiberNew as NewIcon,
  Assignment as TotalIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { StatCard } from '@vapour/ui';

type FeedbackType = 'bug' | 'feature' | 'general';
type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';

interface FeedbackItem {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  status: FeedbackStatus;
  adminNotes?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
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

export function UserFeedbackList() {
  const router = useRouter();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Compute stats
  const stats = useMemo(() => {
    const counts = {
      total: feedback.length,
      new: 0,
      inProgress: 0,
      resolved: 0,
    };

    feedback.forEach((item) => {
      switch (item.status) {
        case 'new':
          counts.new++;
          break;
        case 'in_progress':
          counts.inProgress++;
          break;
        case 'resolved':
        case 'closed':
        case 'wont_fix':
          counts.resolved++;
          break;
      }
    });

    return counts;
  }, [feedback]);

  // Subscribe to user's feedback
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const { db } = getFirebase();
    const feedbackRef = collection(db, 'feedback');
    const q = query(feedbackRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: FeedbackItem[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as FeedbackItem);
        });
        setFeedback(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching user feedback:', err);
        setError('Failed to load your feedback submissions.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!user) {
    return <Alert severity="info">Please sign in to view your feedback submissions.</Alert>;
  }

  if (feedback.length === 0) {
    return (
      <Alert severity="info">
        You haven&apos;t submitted any feedback yet. Use the form above to report bugs or request
        features!
      </Alert>
    );
  }

  return (
    <Box>
      {/* Stats Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard label="Total" value={stats.total} icon={<TotalIcon />} color="primary" />
        <StatCard label="New" value={stats.new} icon={<NewIcon />} color="info" />
        <StatCard
          label="In Progress"
          value={stats.inProgress}
          icon={<HourglassIcon />}
          color="warning"
        />
        <StatCard
          label="Resolved"
          value={stats.resolved}
          icon={<CheckCircleIcon />}
          color="success"
        />
      </Box>

      {/* Feedback List */}
      <Stack spacing={2}>
        {feedback.map((item) => (
          <Card key={item.id} variant="outlined">
            <CardContent
              sx={{
                pb: expandedId === item.id ? 1 : 2,
                '&:last-child': { pb: expandedId === item.id ? 1 : 2 },
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ cursor: 'pointer' }}
                onClick={() => toggleExpand(item.id)}
              >
                {/* Type Icon */}
                <Box
                  sx={{
                    color: `${typeConfig[item.type].color}.main`,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {typeConfig[item.type].icon}
                </Box>

                {/* Title and Time */}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography
                    variant="body1"
                    fontWeight={500}
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true })}
                  </Typography>
                </Box>

                {/* Status */}
                <Chip
                  label={statusConfig[item.status].label}
                  size="small"
                  color={statusConfig[item.status].color}
                />

                {/* Expand/Collapse */}
                <IconButton
                  size="small"
                  aria-label={expandedId === item.id ? 'Collapse details' : 'Expand details'}
                >
                  {expandedId === item.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Stack>

              {/* Expanded Details */}
              <Collapse in={expandedId === item.id}>
                <Divider sx={{ my: 2 }} />

                <Stack spacing={2}>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      gutterBottom
                    >
                      Type
                    </Typography>
                    <Chip
                      label={typeConfig[item.type].label}
                      size="small"
                      icon={typeConfig[item.type].icon as React.ReactElement}
                    />
                  </Box>

                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      gutterBottom
                    >
                      Description
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {item.description}
                    </Typography>
                  </Box>

                  {/* Resolution Notes (only shown when resolved/closed/wont_fix) */}
                  {item.adminNotes && ['resolved', 'closed', 'wont_fix'].includes(item.status) && (
                    <Paper
                      variant="outlined"
                      sx={{ p: 2, bgcolor: 'success.light', color: 'success.dark' }}
                    >
                      <Typography variant="caption" display="block" gutterBottom fontWeight={600}>
                        Resolution
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {item.adminNotes}
                      </Typography>
                    </Paper>
                  )}

                  {item.updatedAt && (
                    <Typography variant="caption" color="text.secondary">
                      Last updated:{' '}
                      {formatDistanceToNow(item.updatedAt.toDate(), { addSuffix: true })}
                    </Typography>
                  )}

                  {/* Action button for resolved items */}
                  {item.status === 'resolved' && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<OpenInNewIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/feedback/${item.id}`);
                      }}
                      sx={{ mt: 1 }}
                    >
                      Review & Close or Follow Up
                    </Button>
                  )}
                </Stack>
              </Collapse>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
