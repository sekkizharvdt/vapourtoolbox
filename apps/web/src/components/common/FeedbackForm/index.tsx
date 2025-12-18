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

import { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  FormHelperText,
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
import {
  initialFormData,
  detectModuleFromUrl,
  MODULE_OPTIONS,
  SEVERITY_OPTIONS,
  FREQUENCY_OPTIONS,
  IMPACT_OPTIONS,
  type FeedbackFormData,
  type FeedbackType,
  type FeedbackModule,
  type FeedbackSeverity,
  type FeedbackFrequency,
  type FeedbackImpact,
} from './types';

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

  // Capture browser info and auto-detect module on mount
  // Try to get the referring page (where user came from) as default for bug location
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const browserInfo = `${navigator.userAgent}\nScreen: ${window.screen.width}x${window.screen.height}\nViewport: ${window.innerWidth}x${window.innerHeight}`;
      // Use referrer if available (the page they came from), otherwise leave empty for bugs
      const referrer = document.referrer;
      const referrerUrl = referrer && referrer.includes(window.location.host) ? referrer : '';
      // Detect module from referrer if available, otherwise from current URL
      const detectedModule = referrerUrl
        ? detectModuleFromUrl(referrerUrl)
        : detectModuleFromUrl(window.location.href);
      setFormData((prev) => ({
        ...prev,
        browserInfo,
        pageUrl: referrerUrl, // Start with referrer URL for bugs, user can edit
        module: detectedModule,
      }));
    }
  }, []);

  const handleTypeChange = (type: FeedbackType) => {
    // Clear type-specific fields when switching types
    setFormData((prev) => ({
      ...prev,
      type,
      severity: undefined,
      frequency: undefined,
      impact: undefined,
    }));
  };

  const handleModuleChange = (module: FeedbackModule) => {
    setFormData((prev) => ({ ...prev, module }));
  };

  const handleSeverityChange = (severity: FeedbackSeverity) => {
    setFormData((prev) => ({ ...prev, severity }));
  };

  const handleFrequencyChange = (frequency: FeedbackFrequency) => {
    setFormData((prev) => ({ ...prev, frequency }));
  };

  const handleImpactChange = (impact: FeedbackImpact) => {
    setFormData((prev) => ({ ...prev, impact }));
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

    // Require page URL for bug reports
    if (formData.type === 'bug' && !formData.pageUrl.trim()) {
      setSubmitError('Please provide the page URL where you encountered this bug');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { db } = getFirebase();

      // Build feedback data, excluding undefined values (Firestore doesn't accept undefined)
      const feedbackData: Record<string, unknown> = {
        type: formData.type,
        module: formData.module,
        title: formData.title,
        description: formData.description,
        pageUrl: formData.pageUrl,
        browserInfo: formData.browserInfo,
        screenshotUrls: formData.screenshotUrls,
        stepsToReproduce: formData.stepsToReproduce,
        expectedBehavior: formData.expectedBehavior,
        actualBehavior: formData.actualBehavior,
        consoleErrors: formData.consoleErrors,
        userId: user?.uid || null,
        userEmail: user?.email || null,
        userName: user?.displayName || null,
        createdAt: Timestamp.now(),
        status: 'new',
        priority: formData.type === 'bug' ? 'medium' : 'low',
      };

      // Only add optional fields if they have values (avoid undefined in Firestore)
      if (formData.severity) {
        feedbackData.severity = formData.severity;
      }
      if (formData.frequency) {
        feedbackData.frequency = formData.frequency;
      }
      if (formData.impact) {
        feedbackData.impact = formData.impact;
      }

      await addDoc(collection(db, 'feedback'), feedbackData);

      setSubmitSuccess(true);
      setFormData({
        ...initialFormData,
        browserInfo: formData.browserInfo,
        pageUrl: '', // Clear URL for next submission
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
      pageUrl: '', // Clear URL on form clear
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

      {/* Feedback Type and Module Selection */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          <FeedbackTypeSelector value={formData.type} onChange={handleTypeChange} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Which Module?
              </Typography>
              <FormControl fullWidth>
                <InputLabel id="module-label">Module</InputLabel>
                <Select
                  labelId="module-label"
                  value={formData.module}
                  label="Module"
                  onChange={(e) => handleModuleChange(e.target.value as FeedbackModule)}
                >
                  {MODULE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Select the area of the application this relates to</FormHelperText>
              </FormControl>
            </CardContent>
          </Card>
        </Box>
      </Stack>

      {/* Bug-specific: Severity, Frequency, and URL */}
      {formData.type === 'bug' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Bug Classification
            </Typography>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Page URL where issue occurred"
                placeholder="https://toolbox.vapourdesal.com/procurement/pos/..."
                value={formData.pageUrl}
                onChange={handleInputChange('pageUrl')}
                required
                helperText="Enter the full URL of the page where you encountered this bug (required)"
                error={formData.type === 'bug' && !formData.pageUrl.trim()}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel id="severity-label">Severity</InputLabel>
                  <Select
                    labelId="severity-label"
                    value={formData.severity || ''}
                    label="Severity"
                    onChange={(e) => handleSeverityChange(e.target.value as FeedbackSeverity)}
                  >
                    {SEVERITY_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label} - {option.description}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>How severe is this issue?</FormHelperText>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel id="frequency-label">Frequency</InputLabel>
                  <Select
                    labelId="frequency-label"
                    value={formData.frequency || ''}
                    label="Frequency"
                    onChange={(e) => handleFrequencyChange(e.target.value as FeedbackFrequency)}
                  >
                    {FREQUENCY_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>How often does this happen?</FormHelperText>
                </FormControl>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Feature-specific: Impact */}
      {formData.type === 'feature' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Feature Priority
            </Typography>
            <FormControl fullWidth sx={{ maxWidth: 400 }}>
              <InputLabel id="impact-label">Impact</InputLabel>
              <Select
                labelId="impact-label"
                value={formData.impact || ''}
                label="Impact"
                onChange={(e) => handleImpactChange(e.target.value as FeedbackImpact)}
              >
                {IMPACT_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>How much would this feature help your workflow?</FormHelperText>
            </FormControl>
          </CardContent>
        </Card>
      )}

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
