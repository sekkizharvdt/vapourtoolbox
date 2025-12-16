'use client';

/**
 * Thread Message Component
 *
 * Individual message in a task thread
 * Displays user avatar, name, timestamp, and message content
 * Supports @mention highlighting using safe React rendering (no dangerouslySetInnerHTML)
 */

import { memo, useMemo } from 'react';
import { Box, Stack, Typography, Avatar, Chip } from '@mui/material';
import type { TaskMessage } from '@vapour/types';
import { formatMentions } from '@/lib/tasks/threadService';

/**
 * Represents a parsed segment of message content
 * Can be either plain text or a mention
 */
interface MessageSegment {
  type: 'text' | 'mention';
  content: string;
}

/**
 * Parse message content into segments of text and mentions
 * This is safe because we render each segment as React elements, not HTML
 */
function parseMessageContent(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const mentionRegex = /@(\w+)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }

    // Add the mention (match[1] is the captured group)
    const username = match[1] ?? match[0].slice(1); // Fallback to removing @ manually
    segments.push({
      type: 'mention',
      content: username,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last mention
  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }

  return segments;
}

interface ThreadMessageProps {
  message: TaskMessage;
  userMap: Record<string, string>;
  currentUserId: string;
  isOwn: boolean;
}

function ThreadMessageComponent({ message, userMap, currentUserId, isOwn }: ThreadMessageProps) {
  // Format content with @mentions replaced by display names
  const formattedContent = formatMentions(message.content, userMap);

  // Parse content into segments for safe rendering (no dangerouslySetInnerHTML)
  const messageSegments = useMemo(() => parseMessageContent(formattedContent), [formattedContent]);

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

          {/* Message body with mention highlighting - using safe React rendering */}
          <Typography
            variant="body2"
            component="div"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {messageSegments.map((segment, index) =>
              segment.type === 'mention' ? (
                <Box
                  key={index}
                  component="span"
                  sx={{
                    backgroundColor: 'primary.lighter',
                    color: 'primary.main',
                    fontWeight: 500,
                    borderRadius: 0.5,
                    px: 0.5,
                  }}
                >
                  @{segment.content}
                </Box>
              ) : (
                <span key={index}>{segment.content}</span>
              )
            )}
          </Typography>

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

const ThreadMessage = memo(ThreadMessageComponent);
export default ThreadMessage;
