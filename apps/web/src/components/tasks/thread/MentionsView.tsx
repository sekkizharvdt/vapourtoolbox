'use client';

/**
 * Mentions View Component
 *
 * Shows all @mentions for the current user
 * Features:
 * - Real-time updates for new mentions
 * - Mark as read functionality
 * - Navigate to thread/task on click
 * - Unread count badge
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Badge,
  IconButton,
  CircularProgress,
  Alert,
  Button,
  Stack,
  Chip,
} from '@mui/material';
import { AlternateEmail as MentionIcon, CheckCircle as MarkReadIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { TaskMention } from '@vapour/types';
import {
  subscribeToUnreadMentions,
  getAllMentions,
  markMentionAsRead,
  markAllMentionsAsRead,
} from '@/lib/tasks/mentionService';

interface MentionsViewProps {
  onSelectMention?: (mention: TaskMention) => void;
  compact?: boolean;
}

export default function MentionsView({ onSelectMention, compact = false }: MentionsViewProps) {
  const { user } = useAuth();

  const [mentions, setMentions] = useState<TaskMention[]>([]);
  const [allMentions, setAllMentions] = useState<TaskMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Subscribe to unread mentions
  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToUnreadMentions(
      user.uid,
      (unreadMentions) => {
        setMentions(unreadMentions);
        setLoading(false);
      },
      (err) => {
        console.error('[MentionsView] Subscription error:', err);
        setError('Failed to load mentions');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Load all mentions when "Show All" is toggled
  useEffect(() => {
    if (!user?.uid || !showAll) return;

    const loadAll = async () => {
      try {
        const all = await getAllMentions(user.uid);
        setAllMentions(all);
      } catch (err) {
        console.error('[MentionsView] Error loading all mentions:', err);
      }
    };

    loadAll();
  }, [user?.uid, showAll]);

  // Handle marking a mention as read
  const handleMarkRead = useCallback(async (mentionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markMentionAsRead(mentionId);
    } catch (err) {
      console.error('[MentionsView] Error marking mention as read:', err);
    }
  }, []);

  // Handle marking all as read
  const handleMarkAllRead = useCallback(async () => {
    if (!user?.uid) return;
    try {
      await markAllMentionsAsRead(user.uid);
    } catch (err) {
      console.error('[MentionsView] Error marking all as read:', err);
    }
  }, [user?.uid]);

  // Handle clicking a mention
  const handleSelectMention = (mention: TaskMention) => {
    onSelectMention?.(mention);
  };

  // Format timestamp
  const formatTime = (timestamp: { toDate?: () => Date }) => {
    const date = timestamp?.toDate?.() || new Date();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const displayMentions = showAll ? allMentions : mentions;
  const unreadCount = mentions.length;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      {!compact && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Badge badgeContent={unreadCount} color="error" max={99}>
                <MentionIcon color="primary" />
              </Badge>
              <Typography variant="h6">Mentions</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5}>
              {unreadCount > 0 && (
                <Button size="small" onClick={handleMarkAllRead} startIcon={<MarkReadIcon />}>
                  Mark All Read
                </Button>
              )}
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip
              label={`Unread (${unreadCount})`}
              size="small"
              color={!showAll ? 'primary' : 'default'}
              onClick={() => setShowAll(false)}
            />
            <Chip
              label="All"
              size="small"
              color={showAll ? 'primary' : 'default'}
              onClick={() => setShowAll(true)}
            />
          </Stack>
        </Box>
      )}

      {/* Mentions list */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {displayMentions.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
              color: 'text.secondary',
            }}
          >
            <MentionIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography variant="body2">
              {showAll ? 'No mentions yet' : 'No unread mentions'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {displayMentions.map((mention) => (
              <ListItem
                key={mention.id}
                disablePadding
                secondaryAction={
                  !mention.read && (
                    <IconButton
                      size="small"
                      onClick={(e) => handleMarkRead(mention.id, e)}
                      title="Mark as read"
                      aria-label="Mark mention as read"
                    >
                      <MarkReadIcon fontSize="small" />
                    </IconButton>
                  )
                }
              >
                <ListItemButton
                  onClick={() => handleSelectMention(mention)}
                  sx={{
                    backgroundColor: mention.read ? 'transparent' : 'action.hover',
                    borderLeft: mention.read ? 0 : 3,
                    borderColor: 'primary.main',
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ width: 36, height: 36, fontSize: '0.875rem' }}>
                      {mention.mentionedByName?.[0]?.toUpperCase() || '@'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: mention.read ? 400 : 600 }}>
                        {mention.mentionedByName} mentioned you
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(mention.createdAt)}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}

/**
 * Compact mention badge for sidebar
 */
export function MentionsBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToUnreadMentions(
      user.uid,
      (mentions) => setCount(mentions.length),
      () => setCount(0)
    );

    return () => unsubscribe();
  }, [user?.uid]);

  if (count === 0) return null;

  return (
    <Badge badgeContent={count} color="error" max={99}>
      <MentionIcon fontSize="small" />
    </Badge>
  );
}
