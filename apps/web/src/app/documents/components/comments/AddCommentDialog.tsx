'use client';

/**
 * Add Comment Dialog
 *
 * Dialog for adding new document comments
 * - Comment text with multiline input
 * - Severity selection (Critical/Major/Minor/Suggestion)
 * - Category selection
 * - Optional location info (page, section, line)
 * - Attachment support (future)
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  Box,
  Chip,
} from '@mui/material';
import type { MasterDocumentEntry, CommentSeverity, CommentCategory } from '@vapour/types';

interface AddCommentDialogProps {
  open: boolean;
  onClose: () => void;
  document: MasterDocumentEntry;
  submissionId?: string;
  onSubmit: (data: CommentData) => Promise<void>;
}

export interface CommentData {
  commentText: string;
  severity: CommentSeverity;
  category: CommentCategory;
  pageNumber?: number;
  section?: string;
  lineItem?: string;
}

const SEVERITY_OPTIONS: { value: CommentSeverity; label: string; color: string }[] = [
  { value: 'CRITICAL', label: 'Critical', color: '#d32f2f' },
  { value: 'MAJOR', label: 'Major', color: '#f57c00' },
  { value: 'MINOR', label: 'Minor', color: '#fbc02d' },
  { value: 'SUGGESTION', label: 'Suggestion', color: '#388e3c' },
];

const CATEGORY_OPTIONS: { value: CommentCategory; label: string }[] = [
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'QUALITY', label: 'Quality' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'FORMATTING', label: 'Formatting' },
  { value: 'CLARIFICATION', label: 'Clarification' },
  { value: 'OTHER', label: 'Other' },
];

export default function AddCommentDialog({
  open,
  onClose,
  document,
  submissionId,
  onSubmit,
}: AddCommentDialogProps) {
  const [commentText, setCommentText] = useState('');
  const [severity, setSeverity] = useState<CommentSeverity>('MINOR');
  const [category, setCategory] = useState<CommentCategory>('TECHNICAL');
  const [pageNumber, setPageNumber] = useState<string>('');
  const [section, setSection] = useState('');
  const [lineItem, setLineItem] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!commentText.trim()) {
      setError('Please enter comment text');
      return;
    }

    if (!submissionId) {
      setError('No submission selected. Please submit the document first.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const data: CommentData = {
        commentText: commentText.trim(),
        severity,
        category,
      };

      // Add optional location info
      if (pageNumber && !isNaN(parseInt(pageNumber, 10))) {
        data.pageNumber = parseInt(pageNumber, 10);
      }
      if (section.trim()) {
        data.section = section.trim();
      }
      if (lineItem.trim()) {
        data.lineItem = lineItem.trim();
      }

      await onSubmit(data);

      // Reset form
      handleReset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setCommentText('');
    setSeverity('MINOR');
    setCategory('TECHNICAL');
    setPageNumber('');
    setSection('');
    setLineItem('');
    setError(null);
  };

  const handleClose = () => {
    if (!submitting) {
      handleReset();
      onClose();
    }
  };

  const getSeverityColor = (sev: CommentSeverity): string => {
    return SEVERITY_OPTIONS.find((opt) => opt.value === sev)?.color || '#000';
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Add Comment
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {document.documentNumber} - {document.documentTitle}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* No Submission Warning */}
          {!submissionId && (
            <Alert severity="warning">
              No submission is selected. You need to submit the document first before adding
              comments.
            </Alert>
          )}

          {/* Comment Text */}
          <TextField
            label="Comment Text"
            multiline
            rows={6}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Enter the comment details..."
            disabled={submitting || !submissionId}
            required
            fullWidth
            helperText="Describe the issue, concern, or suggestion in detail"
          />

          {/* Severity and Category */}
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth required>
              <InputLabel>Severity</InputLabel>
              <Select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as CommentSeverity)}
                label="Severity"
                disabled={submitting || !submissionId}
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: opt.color,
                        }}
                      />
                      <Typography>{opt.label}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Category</InputLabel>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as CommentCategory)}
                label="Category"
                disabled={submitting || !submissionId}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Selected Severity Preview */}
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Selected Severity:
            </Typography>
            <Chip
              label={SEVERITY_OPTIONS.find((opt) => opt.value === severity)?.label}
              size="small"
              sx={{
                bgcolor: getSeverityColor(severity),
                color: 'white',
                fontWeight: 600,
                ml: 1,
              }}
            />
          </Box>

          {/* Optional Location Info */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Location Information (Optional)
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Page Number"
                type="number"
                value={pageNumber}
                onChange={(e) => setPageNumber(e.target.value)}
                disabled={submitting || !submissionId}
                size="small"
                sx={{ width: 150 }}
                inputProps={{ min: 1 }}
              />
              <TextField
                label="Section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                disabled={submitting || !submissionId}
                size="small"
                placeholder="e.g., 3.2.1"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Line Item"
                value={lineItem}
                onChange={(e) => setLineItem(e.target.value)}
                disabled={submitting || !submissionId}
                size="small"
                placeholder="e.g., Item 45"
                sx={{ flex: 1 }}
              />
            </Stack>
          </Box>

          {/* Error Message */}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!commentText.trim() || submitting || !submissionId}
        >
          {submitting ? 'Adding...' : 'Add Comment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
