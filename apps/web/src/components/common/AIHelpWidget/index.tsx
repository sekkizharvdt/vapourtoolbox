'use client';

/**
 * AI Help Widget
 *
 * A floating chat widget that provides AI-powered assistance to beta users.
 * Features:
 * - Contextual help based on current page
 * - Bug report assistance
 * - Feature discovery
 * - Quick actions for common tasks
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Chip,
  Stack,
  Tooltip,
  Zoom,
  Alert,
  Button,
  Divider,
} from '@mui/material';
import {
  SmartToy as AIIcon,
  Close as CloseIcon,
  Send as SendIcon,
  BugReport as BugIcon,
  Lightbulb as FeatureIcon,
  Help as HelpIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { usePathname } from 'next/navigation';
import NextLink from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface QuickAction {
  label: string;
  prompt: string;
  icon: React.ReactNode;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Report a Bug',
    prompt:
      'I found a bug and need help reporting it. Can you guide me through describing the issue properly?',
    icon: <BugIcon fontSize="small" />,
  },
  {
    label: 'How do I...',
    prompt: 'I need help understanding how to use a feature. Can you help me?',
    icon: <HelpIcon fontSize="small" />,
  },
  {
    label: 'Suggest a Feature',
    prompt:
      'I have an idea for a new feature that would help my workflow. Can you help me describe it?',
    icon: <FeatureIcon fontSize="small" />,
  },
];

export function AIHelpWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pathname = usePathname();
  const { user } = useAuth();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
      setError(null);

      try {
        // Prepare messages for API (exclude IDs and timestamps)
        const apiMessages = [...messages, userMessage].map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const response = await fetch('/api/ai-help', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            currentPage: pathname,
            userEmail: user?.email,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to get response');
        }

        const data = await response.json();

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        console.error('[AIHelpWidget] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to get response');
      } finally {
        setIsLoading(false);
      }
    },
    [messages, pathname, user?.email, isLoading]
  );

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.prompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  const getPageContext = () => {
    // Extract readable page name from pathname
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'Home';
    return parts
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' '))
      .join(' > ');
  };

  return (
    <>
      {/* Floating Action Button */}
      <Tooltip title="AI Help (Beta)" placement="left" TransitionComponent={Zoom}>
        <Fab
          color="primary"
          onClick={() => setIsOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            boxShadow: 3,
            '&:hover': {
              transform: 'scale(1.05)',
            },
            transition: 'transform 0.2s',
          }}
          aria-label="Open AI Help"
        >
          <AIIcon />
        </Fab>
      </Tooltip>

      {/* Chat Dialog */}
      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            height: '80vh',
            maxHeight: 700,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Header */}
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AIIcon color="primary" />
            <Box>
              <Typography variant="h6" component="span">
                AI Help
              </Typography>
              <Chip label="Beta" size="small" color="warning" sx={{ ml: 1 }} />
            </Box>
          </Box>
          <Box>
            <Tooltip title="Clear chat">
              <IconButton onClick={handleClearChat} size="small" sx={{ mr: 1 }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={() => setIsOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <Divider />

        {/* Context indicator */}
        <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">
            Current page: {getPageContext()}
          </Typography>
        </Box>

        {/* Messages */}
        <DialogContent
          sx={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            p: 2,
          }}
        >
          {/* Welcome message if no messages */}
          {messages.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <AIIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Hi! I&apos;m your AI assistant.
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                I can help you navigate Vapour Toolbox, answer questions, and collect feedback
                during this beta phase.
              </Typography>

              {/* Quick Actions */}
              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
                {QUICK_ACTIONS.map((action) => (
                  <Chip
                    key={action.label}
                    icon={action.icon as React.ReactElement}
                    label={action.label}
                    onClick={() => handleQuickAction(action)}
                    variant="outlined"
                    clickable
                    sx={{ mb: 1 }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* Message history */}
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <Paper
                elevation={1}
                sx={{
                  p: 1.5,
                  maxWidth: '85%',
                  bgcolor: message.role === 'user' ? 'primary.main' : 'grey.100',
                  color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  borderRadius: 2,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {message.content}
                </Typography>
              </Paper>
            </Box>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Paper elevation={1} sx={{ p: 1.5, bgcolor: 'grey.100', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">
                    Thinking...
                  </Typography>
                </Box>
              </Paper>
            </Box>
          )}

          {/* Error message */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <div ref={messagesEndRef} />
        </DialogContent>

        <Divider />

        {/* Input area */}
        <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
          {/* Quick action chips when chatting */}
          {messages.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
              {QUICK_ACTIONS.map((action) => (
                <Chip
                  key={action.label}
                  icon={action.icon as React.ReactElement}
                  label={action.label}
                  onClick={() => handleQuickAction(action)}
                  size="small"
                  variant="outlined"
                  disabled={isLoading}
                  sx={{ mb: 0.5 }}
                />
              ))}
            </Stack>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              inputRef={inputRef}
              fullWidth
              size="small"
              placeholder="Ask me anything about Vapour Toolbox..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              multiline
              maxRows={3}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
            <Button
              variant="contained"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              <SendIcon />
            </Button>
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            AI responses may not always be accurate. For urgent issues, please use the{' '}
            <NextLink href="/feedback" style={{ color: 'inherit' }}>
              Feedback form
            </NextLink>
            .
          </Typography>
        </Box>
      </Dialog>
    </>
  );
}
