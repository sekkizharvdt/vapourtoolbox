'use client';

/**
 * Inbox Page
 *
 * System notifications from procurement, documents, HR, accounting, etc.
 * Uses horizontal filter chips instead of the old workspace sidebar.
 * Reuses the existing TaskCard component.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Breadcrumbs,
  Link,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Home as HomeIcon,
  Inbox as InboxIcon,
  Search as SearchIcon,
  ShoppingCart as ProcurementIcon,
  Description as DocumentsIcon,
  AccountBalance as AccountingIcon,
  CheckCircle as ApprovalsIcon,
  HelpOutline as EnquiriesIcon,
  Assignment as ProposalsIcon,
  BugReport as FeedbackIcon,
  People as HrIcon,
  Flag as GeneralIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToUserTasks } from '@/lib/tasks/channelService';
import { completeActionableTask } from '@/lib/tasks/taskNotificationService';
import { TaskCard } from '../components/TaskCard';
import { useToast } from '@/components/common/Toast';
import type { TaskNotification, DefaultTaskChannelId } from '@vapour/types';
import {
  TASK_CHANNEL_DEFINITIONS,
  isApprovalCategory,
  getChannelIdFromCategory,
} from '@vapour/types';

type FilterCategory = 'all' | DefaultTaskChannelId;

const FILTER_CHIPS: { id: FilterCategory; label: string; icon: React.ReactElement }[] = [
  { id: 'all', label: 'All', icon: <InboxIcon fontSize="small" /> },
  { id: 'procurement', label: 'Procurement', icon: <ProcurementIcon fontSize="small" /> },
  { id: 'documents', label: 'Documents', icon: <DocumentsIcon fontSize="small" /> },
  { id: 'accounting', label: 'Accounting', icon: <AccountingIcon fontSize="small" /> },
  { id: 'approvals', label: 'Approvals', icon: <ApprovalsIcon fontSize="small" /> },
  { id: 'hr', label: 'HR', icon: <HrIcon fontSize="small" /> },
  { id: 'enquiries', label: 'Enquiries', icon: <EnquiriesIcon fontSize="small" /> },
  { id: 'proposals', label: 'Proposals', icon: <ProposalsIcon fontSize="small" /> },
  { id: 'feedback', label: 'Feedback', icon: <FeedbackIcon fontSize="small" /> },
  { id: 'general', label: 'General', icon: <GeneralIcon fontSize="small" /> },
];

export default function InboxPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [completing, setCompleting] = useState<string | null>(null);

  const userId = user?.uid;

  // Subscribe to all notifications for this user
  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    const unsubscribe = subscribeToUserTasks(userId, (tasks) => {
      setNotifications(tasks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Filter notifications by category and search
  const filteredNotifications = useMemo(() => {
    let result = notifications;

    // Category filter
    if (filter !== 'all') {
      result = result.filter((n) => {
        if (filter === 'approvals') {
          return isApprovalCategory(n.category);
        }
        const channel = TASK_CHANNEL_DEFINITIONS[filter];
        return channel?.categories.includes(n.category);
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.message?.toLowerCase().includes(q) ||
          n.assignedByName?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [notifications, filter, searchQuery]);

  // Count per category for badge display
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: notifications.length };

    notifications.forEach((n) => {
      const channelId = getChannelIdFromCategory(n.category);
      counts[channelId] = (counts[channelId] || 0) + 1;

      if (isApprovalCategory(n.category)) {
        counts['approvals'] = (counts['approvals'] || 0) + 1;
      }
    });

    return counts;
  }, [notifications]);

  const handleComplete = useCallback(
    async (taskId: string) => {
      if (!userId || completing) return;

      setCompleting(taskId);
      try {
        await completeActionableTask(taskId, userId, false);
        toast.success('Task completed');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to complete task');
      } finally {
        setCompleting(null);
      }
    },
    [userId, completing, toast]
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/flow"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/flow');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Flow
        </Link>
        <Typography color="text.primary">Inbox</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Inbox
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Search */}
      <TextField
        size="small"
        placeholder="Search notifications..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 2, maxWidth: 400 }}
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      {/* Filter chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', gap: 0.5 }}>
        {FILTER_CHIPS.map((chip) => {
          const count = categoryCounts[chip.id] || 0;
          const isActive = filter === chip.id;

          // Hide categories with 0 items (except "all")
          if (chip.id !== 'all' && count === 0) return null;

          return (
            <Chip
              key={chip.id}
              icon={chip.icon}
              label={`${chip.label}${count > 0 ? ` (${count})` : ''}`}
              variant={isActive ? 'filled' : 'outlined'}
              color={isActive ? 'primary' : 'default'}
              onClick={() => setFilter(chip.id)}
              sx={{ cursor: 'pointer' }}
            />
          );
        })}
      </Stack>

      {/* Notification list */}
      {filteredNotifications.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <InboxIcon />
            <Typography variant="body2">
              {filter === 'all'
                ? 'No pending notifications. All caught up!'
                : `No ${FILTER_CHIPS.find((c) => c.id === filter)?.label || ''} notifications.`}
            </Typography>
          </Stack>
        </Alert>
      ) : (
        <Box>
          {filteredNotifications.map((notification) => (
            <TaskCard key={notification.id} task={notification} onComplete={handleComplete} />
          ))}
        </Box>
      )}
    </Box>
  );
}
