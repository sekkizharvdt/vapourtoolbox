'use client';

/**
 * Message Input Component
 *
 * Text input with @mention detection and user selection
 * Features:
 * - @mention detection and autocomplete
 * - User selection popover
 * - Send on Enter (Shift+Enter for newline)
 * - Character limit
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Popper,
  ClickAwayListener,
  CircularProgress,
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import type { User } from '@vapour/types';

interface MessageInputProps {
  onSend: (message: string) => Promise<void>;
  users: User[];
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export default function MessageInput({
  onSend,
  users,
  disabled = false,
  placeholder = 'Type a message... Use @ to mention someone',
  maxLength = 2000,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState<HTMLElement | null>(null);
  const [selectedUserIndex, setSelectedUserIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter users based on mention query
  const filteredUsers = mentionQuery
    ? users.filter(
        (user) =>
          user.displayName?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
          user.email?.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];

  // Detect @mention in message
  const detectMention = useCallback((text: string, cursorPos: number) => {
    // Find the @ symbol before cursor
    const beforeCursor = text.slice(0, cursorPos);
    const mentionMatch = beforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1] || '');
      setMentionAnchor(inputRef.current);
      setSelectedUserIndex(0);
    } else {
      setMentionQuery(null);
      setMentionAnchor(null);
    }
  }, []);

  // Handle input change
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setMessage(value);
      detectMention(value, e.target.selectionStart || 0);
    }
  };

  // Handle user selection from mention popover
  const handleSelectUser = useCallback(
    (user: User) => {
      if (!inputRef.current || mentionQuery === null) return;

      const cursorPos = inputRef.current.selectionStart || 0;
      const beforeCursor = message.slice(0, cursorPos);
      const afterCursor = message.slice(cursorPos);

      // Find and replace the @query with @[userId]
      const newBeforeCursor = beforeCursor.replace(/@\w*$/, `@[${user.uid}] `);

      const newMessage = newBeforeCursor + afterCursor;
      setMessage(newMessage);
      setMentionQuery(null);
      setMentionAnchor(null);

      // Focus back on input
      setTimeout(() => {
        inputRef.current?.focus();
        const newCursorPos = newBeforeCursor.length;
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [message, mentionQuery]
  );

  // Handle keyboard navigation in mention popover
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (mentionAnchor && filteredUsers.length > 0) {
      // Navigate mention list
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedUserIndex((prev) => (prev + 1) % filteredUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedUserIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selectedUser = filteredUsers[selectedUserIndex];
        if (selectedUser) {
          handleSelectUser(selectedUser);
        }
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
        setMentionAnchor(null);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Send message on Enter (without Shift)
      e.preventDefault();
      handleSend();
    }
  };

  // Handle send
  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sending || disabled) return;

    setSending(true);
    try {
      await onSend(trimmedMessage);
      setMessage('');
    } catch (error) {
      console.error('[MessageInput] Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  // Close mention popover when clicking away
  const handleClickAway = () => {
    setMentionQuery(null);
    setMentionAnchor(null);
  };

  // Reset selected index when filtered users change
  useEffect(() => {
    setSelectedUserIndex(0);
  }, [mentionQuery]);

  const showMentionPopover = mentionAnchor && filteredUsers.length > 0;

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={4}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || sending}
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
          InputProps={{
            endAdornment: (
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                {message.length}/{maxLength}
              </Typography>
            ),
          }}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!message.trim() || sending || disabled}
          sx={{
            backgroundColor: 'primary.main',
            color: 'white',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
            '&.Mui-disabled': {
              backgroundColor: 'action.disabledBackground',
              color: 'action.disabled',
            },
          }}
        >
          {sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
        </IconButton>
      </Box>

      {/* Mention Popover */}
      <Popper
        open={!!showMentionPopover}
        anchorEl={mentionAnchor}
        placement="top-start"
        style={{ zIndex: 1300 }}
      >
        <ClickAwayListener onClickAway={handleClickAway}>
          <Paper
            elevation={8}
            sx={{
              maxHeight: 200,
              overflow: 'auto',
              minWidth: 200,
              maxWidth: 300,
              mb: 1,
            }}
          >
            <Typography
              variant="caption"
              sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}
            >
              Select a user to mention
            </Typography>
            <List dense>
              {filteredUsers.slice(0, 10).map((user, index) => (
                <ListItemButton
                  key={user.uid}
                  selected={index === selectedUserIndex}
                  onClick={() => handleSelectUser(user)}
                  sx={{
                    py: 0.5,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.lighter',
                    },
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 36 }}>
                    <Avatar
                      src={user.photoURL || undefined}
                      sx={{ width: 28, height: 28, fontSize: '0.75rem' }}
                    >
                      {user.displayName?.[0]?.toUpperCase() || '?'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.displayName || user.email}
                    secondary={user.jobTitle || user.department}
                    primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                  />
                </ListItemButton>
              ))}
              {filteredUsers.length > 10 && (
                <Typography
                  variant="caption"
                  sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}
                >
                  +{filteredUsers.length - 10} more...
                </Typography>
              )}
            </List>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  );
}
