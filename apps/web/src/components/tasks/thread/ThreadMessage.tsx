'use client';

/**
 * Thread Message Component
 *
 * Individual message in a task thread
 * Displays user avatar, name, timestamp, and message content
 * Supports @mention highlighting
 */

import { memo } from 'react';
import { Box, Stack, Typography, Avatar, Chip } from '@mui/material';
import type { TaskMessage } from '@vapour/types';
import { formatMentions } from '@/lib/tasks/threadService';

interface ThreadMessageProps {
  message: TaskMessage;
  userMap: Record<string, string>;
  currentUserId: string;
  isOwn: boolean;
}

function ThreadMessageComponent({ message, userMap, currentUserId, isOwn }: ThreadMessageProps) {
  // Format content with @mentions replaced by display names
  const formattedContent = formatMentions(message.content, userMap);

  // Check if current user is mentioned
  const isMentioned = message.mentions?.includes(currentUserId);

  // Parse timestamp
  const timestamp = message.createdAt?.toDate?.() ? message.createdAt.toDate() : new Date();

  const timeStr = timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const dateStr = timestamp.toLocaleDateString();
  const isToday = dateStr === new Date().toLocaleDateString();
  const displayTime = isToday ? timeStr : `${dateStr} ${timeStr}`;

  return (
    <Box
      sx={{
        py: 1,
        px: 2,
        backgroundColor: isMentioned ? 'warning.lighter' : 'transparent',
        borderLeft: isMentioned ? 3 : 0,
        borderColor: 'warning.main',
        '&:hover': {
          backgroundColor: isMentioned ? 'warning.lighter' : 'action.hover',
        },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        {/* Avatar */}
        <Avatar
          src={message.userAvatar}
          sx={{
            width: 36,
            height: 36,
            backgroundColor: isOwn ? 'primary.main' : 'grey.400',
            fontSize: '0.875rem',
          }}
        >
          {message.userName?.[0]?.toUpperCase() || '?'}
        </Avatar>

        {/* Message content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Header: name and time */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                color: isOwn ? 'primary.main' : 'text.primary',
              }}
            >
              {message.userName}
              {isOwn && (
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ ml: 0.5, color: 'text.secondary' }}
                >
                  (you)
                </Typography>
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {displayTime}
            </Typography>
            {message.editedAt && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                (edited)
              </Typography>
            )}
          </Stack>

          {/* Message body with mention highlighting */}
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              '& .mention': {
                backgroundColor: 'primary.lighter',
                color: 'primary.main',
                fontWeight: 500,
                borderRadius: 0.5,
                px: 0.5,
              },
            }}
            dangerouslySetInnerHTML={{
              __html: highlightMentions(formattedContent),
            }}
          />

          {/* Mention chips for quick reference */}
          {message.mentions && message.mentions.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" gap={0.5}>
              {message.mentions.map((userId) => (
                <Chip
                  key={userId}
                  label={`@${userMap[userId] || userId}`}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    backgroundColor: userId === currentUserId ? 'warning.lighter' : undefined,
                  }}
                />
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

/**
 * Highlight @mentions in the message content with styled spans
 */
function highlightMentions(content: string): string {
  // Match @username patterns and wrap in styled span
  return content.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
}

const ThreadMessage = memo(ThreadMessageComponent);
export default ThreadMessage;
