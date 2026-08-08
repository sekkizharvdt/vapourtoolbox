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
  Divider,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  FormHelperText,
  Alert,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { getLastAppRouteUrl } from '@/lib/feedback/lastAppRoute';
import { getRecentConsoleErrors, getConsoleErrorCount } from '@/lib/feedback/consoleErrorBuffer';
import {
  resolveRelatedDocument,
  formatRelatedDocument,
  type RelatedDocument,
} from '@/lib/feedback/relatedDocument';
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
  const { toast } = useToast();
  const [formData, setFormData] = useState<FeedbackFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // The record the user was looking at, derived from the URL (Phase B1).
  const [relatedDocument, setRelatedDocument] = useState<RelatedDocument | null>(null);

  // Capture browser info and auto-detect module on mount
  // Try to get the referring page (where user came from) as default for bug location
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const browserInfo = `${navigator.userAgent}\nScreen: ${window.screen.width}x${window.screen.height}\nViewport: ${window.innerWidth}x${window.innerHeight}`;
      // Use referrer if available (the page they came from), otherwise leave empty for bugs
      // document.referrer is only set on a full page load — Next.js client-side
      // navigation leaves it empty, which is why feature requests captured a
      // pageUrl only 16% of the time. Fall back to the route the user was last
      // on (recorded by RouteTracker), so the originating screen is captured
      // without asking for it.
      const referrer = document.referrer;
      const referrerUrl = referrer && referrer.includes(window.location.host) ? referrer : '';
      const originUrl = referrerUrl || getLastAppRouteUrl();
      // Detect module from wherever the user came from, never from /feedback itself
      const detectedModule = originUrl
        ? detectModuleFromUrl(originUrl)
        : detectModuleFromUrl(window.location.href);
      setFormData((prev) => ({
        ...prev,
        browserInfo,
        // Captured for features too, not just bugs — the screen that prompted an
        // idea is often the whole context for it. Users can still edit it.
        pageUrl: originUrl,
        module: detectedModule,
      }));

      // Work out WHICH record the user was looking at. Only 1% of reports name
      // a document number in the text, so this is derived rather than asked for
      // (Phase B1). Resolved once on mount; a failure leaves it unset and the
      // report is no worse off than before.
      if (originUrl) {
        const { db } = getFirebase();
        void resolveRelatedDocument(db, originUrl).then(setRelatedDocument);
      }
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
      toast.error('Screenshot must be less than 5MB');
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
      toast.error('Failed to upload screenshot. Please try again.');
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
      toast.error('Please provide a title');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('Please provide a description');
      return;
    }

    // Require page URL for bug reports
    if (formData.type === 'bug' && !formData.pageUrl.trim()) {
      toast.error('Please provide the page URL where you encountered this bug');
      return;
    }

    // Severity is now required (Phase C3). It was optional and set on 49% of
    // bugs, of which 94% chose "critical" — a field that discriminates nothing.
    // The four levels already carry written definitions, so forcing a choice is
    // what makes them mean something, the same way impact works for features.
    if (formData.type === 'bug' && !formData.severity) {
      toast.error('Please choose how severe this issue is');
      return;
    }

    // Feature requests: require the two things that make a request rankable.
    // Both fields already existed and were optional, and were answered ~17% and
    // ~41% of the time — leaving 83% of requests with no use case and no way to
    // prioritise them against each other. One required question yields 100%;
    // requiring four would just cause abandonment, so only these two are
    // enforced (Phase D of docs/reviews/2026-08-07-feedback-intake-plan.md).
    if (formData.type === 'feature') {
      if (!formData.stepsToReproduce.trim()) {
        toast.error('Please describe a situation where this feature would help you');
        return;
      }
      if (!formData.impact) {
        toast.error('Please choose how much this feature would help your workflow');
        return;
      }
    }

    setIsSubmitting(true);

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
        // Captured automatically (Phase B2) rather than relying on the user to
        // open devtools and paste, which yielded 21% overall and 2% from one of
        // the two main reporters. Anything they typed is kept and leads.
        consoleErrors: [formData.consoleErrors.trim(), getRecentConsoleErrors()]
          .filter(Boolean)
          .join('\n\n--- captured automatically ---\n\n'),
        userId: user?.uid || null,
        userEmail: user?.email || null,
        userName: user?.displayName || null,
        createdAt: Timestamp.now(),
        status: 'new',
        // `priority` is no longer written (Phase C2). It was
        // `type === 'bug' ? 'medium' : 'low'` — a restatement of `type` that
        // nothing queried or displayed, so it added a field without adding
        // information. Existing records keep theirs; no migration (rule 31).
      };

      // Which record this is about, derived from the URL rather than typed
      // (Phase B1). Conditional spread — Firestore rejects undefined (rule 12).
      if (relatedDocument) {
        feedbackData.relatedDocument = {
          collection: relatedDocument.collection,
          docId: relatedDocument.docId,
          label: relatedDocument.label,
          ...(relatedDocument.number !== undefined && { number: relatedDocument.number }),
        };
      }

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

      toast.success("Thank you for your feedback! We'll review it shortly.");
      setFormData({
        ...initialFormData,
        browserInfo: formData.browserInfo,
        pageUrl: '', // Clear URL for next submission
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
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
                <FormControl fullWidth required error={!formData.severity}>
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
            <FormControl fullWidth sx={{ maxWidth: 400 }} required error={!formData.impact}>
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
              <FormHelperText>
                How much would this feature help your workflow? This is how requests get ranked
                against each other.
              </FormHelperText>
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

          {/* Shown so the reporter can see we already know which record this is
              about, and correct us if they had navigated on. */}
          {relatedDocument && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Linked to <strong>{formatRelatedDocument(relatedDocument)}</strong> — captured
              automatically from the page you came from.
            </Alert>
          )}

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
          autoCapturedErrorCount={getConsoleErrorCount()}
          expectedBehavior={formData.expectedBehavior}
          actualBehavior={formData.actualBehavior}
          consoleErrors={formData.consoleErrors}
          screenshotUrls={formData.screenshotUrls}
          isUploading={isUploading}
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
          onUseCaseChange={(value) => setFormData((prev) => ({ ...prev, stepsToReproduce: value }))}
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
    </Box>
  );
}
