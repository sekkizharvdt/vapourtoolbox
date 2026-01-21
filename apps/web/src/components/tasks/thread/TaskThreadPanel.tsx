'use client';

/**
 * Task Thread Panel Component
 *
 * Slide-in panel for viewing and replying to a task thread
 * Features:
 * - Task summary header
 * - Message list with real-time updates
 * - Message input with @mention support
 * - Auto-scroll to new messages
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Divider,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  Slide,
} from '@mui/material';
import {
  Close as CloseIcon,
  Forum as ForumIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import type { TaskNotification, TaskThread, TaskMessage, User } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  getOrCreateThread,
  addMessage,
  subscribeToThreadMessages,
} from '@/lib/tasks/threadService';
import { markThreadMentionsAsRead } from '@/lib/tasks/mentionService';
import ThreadMessage from './ThreadMessage';
import MessageInput from './MessageInput';

interface TaskThreadPanelProps {
  task: TaskNotification | null;
  open: boolean;
  onClose: () => void;
  users: User[];
  width?: number;
}

export default function TaskThreadPanel({
  task,
  open,
  onClose,
  users,
  width = 400,
}: TaskThreadPanelProps) {
  const { user } = useAuth();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [thread, setThread] = useState<TaskThread | null>(null);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build user map for mention display
  const userMap: Record<string, string> = {};
  users.forEach((u) => {
    userMap[u.uid] = u.displayName || u.email || u.uid;
  });

  // Load or create thread when task changes
  useEffect(() => {
    if (!task || !open) {
      setThread(null);
      setMessages([]);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const initThread = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get or create thread for this task
        const threadData = await getOrCreateThread(task);
        setThread(threadData);

        // Subscribe to messages
        unsubscribe = subscribeToThreadMessages(
          threadData.id,
          (msgs) => {
            setMessages(msgs);
            // Auto-scroll to bottom on new messages
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          },
          (err) => {
            console.error('[TaskThreadPanel] Message subscription error:', err);
            setError('Failed to load messages');
          }
        );

        // Mark mentions in this thread as read
        if (user?.uid) {
          await markThreadMentionsAsRead(threadData.id, user.uid);
        }
      } catch (err) {
        console.error('[TaskThreadPanel] Error initializing thread:', err);
        setError('Failed to load thread');
      } finally {
        setLoading(false);
      }
    };

    initThread();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [task, open, user?.uid]);

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!thread || !user) {
        throw new Error('Not authenticated');
      }

      await addMessage(
        thread.id,
        user.uid,
        user.displayName || user.email || 'Unknown',
        content,
        user.photoURL || undefined
      );
    },
    [thread, user]
  );

  // Navigate to task detail page
  const handleViewTask = () => {
    if (task?.linkUrl) {
      router.push(task.linkUrl);
    }
  };

  if (!task) return null;

  return (
    <Slide direction="left" in={open} mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1200,
          borderLeft: 1,
          borderColor: 'divider',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ForumIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>
                Thread
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <IconButton
                size="small"
                onClick={handleViewTask}
                title="View task details"
                aria-label="View task details"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={onClose} aria-label="Close thread panel">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>

          {/* Task summary */}
          <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
            {task.title}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={0.5}>
            <Chip label={task.category} size="small" variant="outlined" />
            <Chip
              label={task.status}
              size="small"
              color={
                task.status === 'completed'
                  ? 'success'
                  : task.status === 'in_progress'
                    ? 'primary'
                    : 'default'
              }
            />
            {task.assignedByName && (
              <Chip label={`From: ${task.assignedByName}`} size="small" variant="outlined" />
            )}
          </Stack>
        </Box>

        {/* Messages area */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: 'action.hover',
          }}
        >
          {loading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
              }}
            >
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ m: 2 }}>
              {error}
            </Alert>
          ) : messages.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary',
              }}
            >
              <ForumIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
              <Typography variant="body2">No messages yet</Typography>
              <Typography variant="caption">Start the conversation below</Typography>
            </Box>
          ) : (
            <Box sx={{ py: 1 }}>
              {messages.map((msg) => (
                <ThreadMessage
                  key={msg.id}
                  message={msg}
                  userMap={userMap}
                  currentUserId={user?.uid || ''}
                  isOwn={msg.userId === user?.uid}
                />
              ))}
              <div ref={messagesEndRef} />
            </Box>
          )}
        </Box>

        <Divider />

        {/* Message input */}
        <Box sx={{ p: 2, backgroundColor: 'background.paper' }}>
          <MessageInput
            onSend={handleSendMessage}
            users={users}
            disabled={loading || !thread}
            placeholder="Reply to this thread..."
          />
        </Box>
      </Paper>
    </Slide>
  );
}
