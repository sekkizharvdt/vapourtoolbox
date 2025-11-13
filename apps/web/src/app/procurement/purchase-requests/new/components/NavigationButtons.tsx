/**
 * Navigation Buttons Component
 *
 * Bottom navigation controls for the multi-step form
 */

'use client';

import { Paper, Stack, Button } from '@mui/material';
import { Save as SaveIcon, Send as SendIcon } from '@mui/icons-material';

interface NavigationButtonsProps {
  activeStep: number;
  totalSteps: number;
  saving: boolean;
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

export function NavigationButtons({
  activeStep,
  totalSteps,
  saving,
  onCancel,
  onBack,
  onNext,
  onSaveDraft,
  onSubmit,
}: NavigationButtonsProps) {
  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between">
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Stack direction="row" spacing={2}>
          {activeStep === 0 && (
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={onSaveDraft}
              disabled={saving}
            >
              Save Draft
            </Button>
          )}
          {activeStep > 0 && (
            <Button onClick={onBack} disabled={saving}>
              Back
            </Button>
          )}
          {activeStep < totalSteps - 1 && (
            <Button variant="contained" onClick={onNext}>
              Next
            </Button>
          )}
          {activeStep === totalSteps - 1 && (
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={onSubmit}
              disabled={saving}
            >
              {saving ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
