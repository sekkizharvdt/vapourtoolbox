'use client';

/**
 * Feedback Form Component
 *
 * Allows users to:
 * - Report bugs/errors with screenshot and console logs
 * - Request new features
 * - Provide general feedback
 */

import { useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Chip,
  IconButton,
  Paper,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import FeedbackIcon from '@mui/icons-material/Feedback';
import ScreenshotIcon from '@mui/icons-material/Screenshot';
import CodeIcon from '@mui/icons-material/Code';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

type FeedbackType = 'bug' | 'feature' | 'general';

interface FeedbackFormData {
  type: FeedbackType;
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  consoleErrors: string;
  screenshotUrls: string[];
  browserInfo: string;
  pageUrl: string;
}

const initialFormData: FeedbackFormData = {
  type: 'bug',
  title: '',
  description: '',
  stepsToReproduce: '',
  expectedBehavior: '',
  actualBehavior: '',
  consoleErrors: '',
  screenshotUrls: [],
  browserInfo: '',
  pageUrl: '',
};

/**
 * Instructions for getting console errors
 */
function ConsoleErrorInstructions() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon color="info" fontSize="small" />
          <Typography variant="body2" fontWeight={500}>
            How to get console error messages
          </Typography>
        </Box>
        <IconButton size="small">{expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
      </Box>

      <Collapse in={expanded}>
        <List dense sx={{ mt: 1 }}>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Chip label="1" size="small" color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Open Developer Tools"
              secondary={
                <>
                  <strong>Windows/Linux:</strong> Press F12 or Ctrl+Shift+I
                  <br />
                  <strong>Mac:</strong> Press ⌘+Option+I
                </>
              }
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Chip label="2" size="small" color="primary" />
            </ListItemIcon>
            <ListItemText
              primary='Click the "Console" tab'
              secondary="Look for red error messages"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Chip label="3" size="small" color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Right-click on the error message"
              secondary='Select "Copy" or "Copy message" and paste it below'
            />
          </ListItem>
        </List>
      </Collapse>
    </Paper>
  );
}

/**
 * Screenshot upload component
 */
function ScreenshotUpload({
  screenshots,
  onAdd,
  onRemove,
  isUploading,
}: {
  screenshots: string[];
  onAdd: (file: File) => void;
  onRemove: (index: number) => void;
  isUploading: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onAdd(file);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        onAdd(file);
      }
    },
    [onAdd]
  );

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id="screenshot-upload"
      />

      <Paper
        variant="outlined"
        sx={{
          p: 3,
          textAlign: 'center',
          border: '2px dashed',
          borderColor: 'divider',
          bgcolor: 'action.hover',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
          '&:hover': {
            borderColor: 'primary.main',
          },
        }}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {isUploading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Uploading...
            </Typography>
          </Box>
        ) : (
          <>
            <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Drag and drop a screenshot here, or click to select
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Supports PNG, JPG, GIF (max 5MB)
            </Typography>
          </>
        )}
      </Paper>

      {screenshots.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          {screenshots.map((url, index) => (
            <Paper
              key={index}
              variant="outlined"
              sx={{
                position: 'relative',
                width: 100,
                height: 100,
                overflow: 'hidden',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Screenshot ${index + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <IconButton
                size="small"
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  bgcolor: 'background.paper',
                  '&:hover': { bgcolor: 'error.light', color: 'white' },
                }}
                onClick={() => onRemove(index)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * Main Feedback Form Component
 */
export function FeedbackForm() {
  const { user } = useAuth();
  const [formData, setFormData] = useState<FeedbackFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Capture browser info on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      const browserInfo = `${navigator.userAgent}\nScreen: ${window.screen.width}x${window.screen.height}\nViewport: ${window.innerWidth}x${window.innerHeight}`;
      setFormData((prev) => ({
        ...prev,
        browserInfo,
        pageUrl: window.location.href,
      }));
    }
  });

  const handleTypeChange = (_: React.MouseEvent<HTMLElement>, newType: FeedbackType | null) => {
    if (newType) {
      setFormData((prev) => ({ ...prev, type: newType }));
    }
  };

  const handleInputChange =
    (field: keyof FeedbackFormData) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleScreenshotAdd = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('Screenshot must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const { storage } = getFirebase();
      const timestamp = Date.now();
      const fileName = `feedback/${user?.uid || 'anonymous'}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, fileName);

      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      setFormData((prev) => ({
        ...prev,
        screenshotUrls: [...prev.screenshotUrls, downloadUrl],
      }));
    } catch (error) {
      console.error('Failed to upload screenshot:', error);
      setSubmitError('Failed to upload screenshot. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleScreenshotRemove = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      screenshotUrls: prev.screenshotUrls.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      setSubmitError('Please provide a title');
      return;
    }

    if (!formData.description.trim()) {
      setSubmitError('Please provide a description');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { db } = getFirebase();

      const feedbackData = {
        ...formData,
        userId: user?.uid || null,
        userEmail: user?.email || null,
        userName: user?.displayName || null,
        createdAt: Timestamp.now(),
        status: 'new',
        priority: formData.type === 'bug' ? 'medium' : 'low',
      };

      await addDoc(collection(db, 'feedback'), feedbackData);

      setSubmitSuccess(true);
      setFormData({
        ...initialFormData,
        browserInfo: formData.browserInfo,
        pageUrl: formData.pageUrl,
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      setSubmitError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeConfig = (type: FeedbackType) => {
    const configs = {
      bug: {
        icon: <BugReportIcon />,
        label: 'Bug Report',
        color: 'error' as const,
        description: 'Report an error or unexpected behavior',
      },
      feature: {
        icon: <LightbulbIcon />,
        label: 'Feature Request',
        color: 'warning' as const,
        description: 'Suggest a new feature or improvement',
      },
      general: {
        icon: <FeedbackIcon />,
        label: 'General Feedback',
        color: 'info' as const,
        description: 'Share your thoughts or suggestions',
      },
    };
    return configs[type];
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Feedback & Support
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Help us improve Vapour Toolbox by reporting issues or suggesting new features.
      </Typography>

      {/* Feedback Type Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            What would you like to share?
          </Typography>

          <ToggleButtonGroup
            value={formData.type}
            exclusive
            onChange={handleTypeChange}
            fullWidth
            sx={{ mb: 2 }}
          >
            {(['bug', 'feature', 'general'] as FeedbackType[]).map((type) => {
              const config = getTypeConfig(type);
              return (
                <ToggleButton
                  key={type}
                  value={type}
                  sx={{
                    py: 2,
                    flexDirection: 'column',
                    gap: 0.5,
                    '&.Mui-selected': {
                      bgcolor: `${config.color}.light`,
                      color: `${config.color}.dark`,
                      '&:hover': {
                        bgcolor: `${config.color}.light`,
                      },
                    },
                  }}
                >
                  {config.icon}
                  <Typography variant="body2" fontWeight={500}>
                    {config.label}
                  </Typography>
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>

          <Alert severity={getTypeConfig(formData.type).color} icon={false}>
            {getTypeConfig(formData.type).description}
          </Alert>
        </CardContent>
      </Card>

      {/* Common Fields */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Details
          </Typography>

          <TextField
            fullWidth
            label="Title"
            placeholder={
              formData.type === 'bug'
                ? 'Brief description of the issue'
                : formData.type === 'feature'
                  ? 'Name of the feature you would like'
                  : 'Subject of your feedback'
            }
            value={formData.title}
            onChange={handleInputChange('title')}
            required
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Description"
            placeholder={
              formData.type === 'bug'
                ? 'Describe what went wrong...'
                : formData.type === 'feature'
                  ? 'Describe the feature and why it would be useful...'
                  : 'Share your thoughts...'
            }
            value={formData.description}
            onChange={handleInputChange('description')}
            multiline
            rows={4}
            required
          />
        </CardContent>
      </Card>

      {/* Bug-specific Fields */}
      {formData.type === 'bug' && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon color="error" />
                  Bug Details
                </Box>
              </Typography>

              <TextField
                fullWidth
                label="Steps to Reproduce"
                placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                value={formData.stepsToReproduce}
                onChange={handleInputChange('stepsToReproduce')}
                multiline
                rows={3}
                sx={{ mb: 2 }}
                helperText="List the steps to reproduce the issue"
              />

              <Box
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}
              >
                <TextField
                  fullWidth
                  label="Expected Behavior"
                  placeholder="What should have happened?"
                  value={formData.expectedBehavior}
                  onChange={handleInputChange('expectedBehavior')}
                  multiline
                  rows={2}
                />

                <TextField
                  fullWidth
                  label="Actual Behavior"
                  placeholder="What actually happened?"
                  value={formData.actualBehavior}
                  onChange={handleInputChange('actualBehavior')}
                  multiline
                  rows={2}
                />
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CodeIcon color="primary" />
                  Console Error Messages
                </Box>
              </Typography>

              <ConsoleErrorInstructions />

              <TextField
                fullWidth
                label="Console Errors (if any)"
                placeholder="Paste any error messages from the browser console here..."
                value={formData.consoleErrors}
                onChange={handleInputChange('consoleErrors')}
                multiline
                rows={4}
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                  },
                }}
              />
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ScreenshotIcon color="primary" />
                  Screenshots
                </Box>
              </Typography>

              <Typography variant="body2" color="text.secondary" paragraph>
                Screenshots help us understand the issue better. You can capture your screen using:
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Chip label="Windows: Win+Shift+S" size="small" sx={{ mr: 1, mb: 1 }} />
                <Chip label="Mac: ⌘+Shift+4" size="small" sx={{ mr: 1, mb: 1 }} />
                <Chip label="Or use Snipping Tool" size="small" sx={{ mb: 1 }} />
              </Box>

              <ScreenshotUpload
                screenshots={formData.screenshotUrls}
                onAdd={handleScreenshotAdd}
                onRemove={handleScreenshotRemove}
                isUploading={isUploading}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Feature Request Fields */}
      {formData.type === 'feature' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Additional Information
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              The more context you provide, the better we can understand and prioritize your
              request.
            </Alert>

            <TextField
              fullWidth
              label="Use Case"
              placeholder="Describe a scenario where this feature would help you..."
              value={formData.stepsToReproduce}
              onChange={handleInputChange('stepsToReproduce')}
              multiline
              rows={3}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Expected Outcome"
              placeholder="What would you expect this feature to do?"
              value={formData.expectedBehavior}
              onChange={handleInputChange('expectedBehavior')}
              multiline
              rows={2}
            />
          </CardContent>
        </Card>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Submit Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          onClick={() =>
            setFormData({
              ...initialFormData,
              browserInfo: formData.browserInfo,
              pageUrl: formData.pageUrl,
            })
          }
          disabled={isSubmitting}
        >
          Clear Form
        </Button>
        <Button
          type="submit"
          variant="contained"
          size="large"
          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
          disabled={isSubmitting || isUploading}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </Button>
      </Box>

      {/* Success Snackbar */}
      <Snackbar
        open={submitSuccess}
        autoHideDuration={6000}
        onClose={() => setSubmitSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          icon={<CheckCircleIcon />}
          onClose={() => setSubmitSuccess(false)}
          sx={{ width: '100%' }}
        >
          Thank you for your feedback! We&apos;ll review it shortly.
        </Alert>
      </Snackbar>

      {/* Error Snackbar */}
      <Snackbar
        open={!!submitError}
        autoHideDuration={6000}
        onClose={() => setSubmitError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSubmitError(null)} sx={{ width: '100%' }}>
          {submitError}
        </Alert>
      </Snackbar>
    </Box>
  );
}
