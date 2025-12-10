'use client';

/**
 * Feedback Form Component
 *
 * Allows users to:
 * - Report bugs/errors with screenshot and console logs
 * - Request new features
 * - Provide general feedback
 *
 * This is the main entry point that composes all subcomponents.
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  Divider,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { FeedbackTypeSelector } from './FeedbackTypeSelector';
import { BugDetailsSection } from './BugDetailsSection';
import { FeatureRequestSection } from './FeatureRequestSection';
import { initialFormData, type FeedbackFormData, type FeedbackType } from './types';

// Re-export for backward compatibility
export { FeedbackTypeSelector } from './FeedbackTypeSelector';
export { ScreenshotUpload } from './ScreenshotUpload';
export { ConsoleErrorInstructions } from './ConsoleErrorInstructions';
export * from './types';

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

  const handleTypeChange = (type: FeedbackType) => {
    setFormData((prev) => ({ ...prev, type }));
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

  const handleClear = () => {
    setFormData({
      ...initialFormData,
      browserInfo: formData.browserInfo,
      pageUrl: formData.pageUrl,
    });
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
      <FeedbackTypeSelector value={formData.type} onChange={handleTypeChange} />

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
        <BugDetailsSection
          stepsToReproduce={formData.stepsToReproduce}
          expectedBehavior={formData.expectedBehavior}
          actualBehavior={formData.actualBehavior}
          consoleErrors={formData.consoleErrors}
          screenshotUrls={formData.screenshotUrls}
          isUploading={isUploading}
          onStepsChange={(value) => setFormData((prev) => ({ ...prev, stepsToReproduce: value }))}
          onExpectedChange={(value) =>
            setFormData((prev) => ({ ...prev, expectedBehavior: value }))
          }
          onActualChange={(value) => setFormData((prev) => ({ ...prev, actualBehavior: value }))}
          onConsoleErrorsChange={(value) =>
            setFormData((prev) => ({ ...prev, consoleErrors: value }))
          }
          onScreenshotAdd={handleScreenshotAdd}
          onScreenshotRemove={handleScreenshotRemove}
        />
      )}

      {/* Feature Request Fields */}
      {formData.type === 'feature' && (
        <FeatureRequestSection
          useCase={formData.stepsToReproduce}
          expectedOutcome={formData.expectedBehavior}
          onUseCaseChange={(value) => setFormData((prev) => ({ ...prev, stepsToReproduce: value }))}
          onExpectedOutcomeChange={(value) =>
            setFormData((prev) => ({ ...prev, expectedBehavior: value }))
          }
        />
      )}

      <Divider sx={{ my: 3 }} />

      {/* Submit Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button variant="outlined" onClick={handleClear} disabled={isSubmitting}>
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
