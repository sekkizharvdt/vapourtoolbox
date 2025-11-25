'use client';

/**
 * Transmittal Details Step
 *
 * Step 2 of transmittal generation - enter transmittal metadata
 * - Subject
 * - Cover notes
 * - Purpose of issue
 */

import { Stack, TextField, Typography, Alert } from '@mui/material';

interface TransmittalDetailsStepProps {
  subject: string;
  coverNotes: string;
  purposeOfIssue: string;
  onSubjectChange: (value: string) => void;
  onCoverNotesChange: (value: string) => void;
  onPurposeChange: (value: string) => void;
}

export default function TransmittalDetailsStep({
  subject,
  coverNotes,
  purposeOfIssue,
  onSubjectChange,
  onCoverNotesChange,
  onPurposeChange,
}: TransmittalDetailsStepProps) {
  return (
    <Stack spacing={3}>
      <Alert severity="info">
        Provide transmittal details that will appear in the cover sheet.
      </Alert>

      <TextField
        label="Subject"
        value={subject}
        onChange={(e) => onSubjectChange(e.target.value)}
        placeholder="e.g., Design Documents for Review"
        fullWidth
        helperText="Brief description of the transmittal purpose"
      />

      <TextField
        label="Purpose of Issue"
        value={purposeOfIssue}
        onChange={(e) => onPurposeChange(e.target.value)}
        placeholder="e.g., For Approval, For Review, For Information"
        fullWidth
      />

      <TextField
        label="Cover Notes"
        value={coverNotes}
        onChange={(e) => onCoverNotesChange(e.target.value)}
        placeholder="Enter any additional notes or instructions for the client..."
        multiline
        rows={8}
        fullWidth
        helperText="These notes will appear on the transmittal cover sheet"
      />

      <Typography variant="caption" color="text.secondary">
        * All fields are optional. A transmittal number and date will be auto-generated.
      </Typography>
    </Stack>
  );
}
