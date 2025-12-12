'use client';

import {
  Box,
  Typography,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Stack,
  Divider,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ImageList,
  ImageListItem,
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import type { FeedbackItem, FeedbackStatus } from './types';
import { typeConfig, statusConfig } from './config';

interface FeedbackDetailDialogProps {
  open: boolean;
  onClose: () => void;
  feedback: FeedbackItem | null;
  onFeedbackChange: (feedback: FeedbackItem | null) => void;
  onStatusChange: (feedbackId: string, status: FeedbackStatus) => void;
  onAdminNotesChange: (feedbackId: string, notes: string) => void;
  onResolutionNotesChange: (feedbackId: string, notes: string) => void;
  updating: boolean;
}

export function FeedbackDetailDialog({
  open,
  onClose,
  feedback,
  onFeedbackChange,
  onStatusChange,
  onAdminNotesChange,
  onResolutionNotesChange,
  updating,
}: FeedbackDetailDialogProps) {
  if (!feedback) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={2} alignItems="center">
          {typeConfig[feedback.type].icon}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">{feedback.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {typeConfig[feedback.type].label} • Submitted{' '}
              {formatDistanceToNow(feedback.createdAt.toDate(), { addSuffix: true })}
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <Select
              value={feedback.status}
              onChange={(e) => onStatusChange(feedback.id, e.target.value as FeedbackStatus)}
              disabled={updating}
            >
              {Object.entries(statusConfig).map(([key, config]) => (
                <MenuItem key={key} value={key}>
                  {config.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* User Info */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Submitted By
            </Typography>
            <Typography>
              {feedback.userName} ({feedback.userEmail})
            </Typography>
          </Box>

          {/* Description */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Description
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{feedback.description}</Typography>
          </Box>

          {/* Bug-specific fields */}
          {feedback.type === 'bug' && (
            <>
              {feedback.stepsToReproduce && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Steps to Reproduce
                  </Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                    {feedback.stepsToReproduce}
                  </Typography>
                </Box>
              )}

              {feedback.expectedBehavior && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Expected Behavior
                  </Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                    {feedback.expectedBehavior}
                  </Typography>
                </Box>
              )}

              {feedback.actualBehavior && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Actual Behavior
                  </Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>{feedback.actualBehavior}</Typography>
                </Box>
              )}

              {feedback.consoleErrors && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Console Errors
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      bgcolor: 'grey.900',
                      color: 'error.light',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      whiteSpace: 'pre-wrap',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    {feedback.consoleErrors}
                  </Paper>
                </Box>
              )}
            </>
          )}

          {/* Feature-specific fields */}
          {feedback.type === 'feature' && feedback.stepsToReproduce && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Use Case
              </Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{feedback.stepsToReproduce}</Typography>
            </Box>
          )}

          {/* Screenshots */}
          {feedback.screenshotUrls?.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Screenshots ({feedback.screenshotUrls.length})
              </Typography>
              <ImageList cols={2} gap={8}>
                {feedback.screenshotUrls.map((url, index) => (
                  <ImageListItem key={index}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Screenshot ${index + 1}`}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: 'auto',
                          borderRadius: 4,
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      />
                    </a>
                  </ImageListItem>
                ))}
              </ImageList>
            </Box>
          )}

          {/* Technical Info */}
          {(feedback.pageUrl || feedback.browserInfo) && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Technical Information
              </Typography>
              {feedback.pageUrl && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>Page URL:</strong>{' '}
                  <a href={feedback.pageUrl} target="_blank" rel="noopener noreferrer">
                    {feedback.pageUrl}
                  </a>
                </Typography>
              )}
              {feedback.browserInfo && (
                <Typography variant="body2">
                  <strong>Browser:</strong> {feedback.browserInfo}
                </Typography>
              )}
            </Box>
          )}

          <Divider />

          {/* Resolution Notes - Only shown for resolved/closed/wont_fix statuses */}
          {['resolved', 'closed', 'wont_fix'].includes(feedback.status) && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Resolution Notes (visible to user)
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={2}
                placeholder="Explain how this was resolved or why it was closed..."
                value={feedback.resolutionNotes || ''}
                onChange={(e) => {
                  onFeedbackChange({ ...feedback, resolutionNotes: e.target.value });
                }}
                onBlur={(e) => onResolutionNotesChange(feedback.id, e.target.value)}
                helperText="This note will be visible to the user who submitted this feedback"
              />
            </Box>
          )}

          {/* Admin Notes */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Admin Notes (internal only)
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Add internal notes about this feedback..."
              value={feedback.adminNotes || ''}
              onChange={(e) => {
                onFeedbackChange({ ...feedback, adminNotes: e.target.value });
              }}
              onBlur={(e) => onAdminNotesChange(feedback.id, e.target.value)}
            />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
