'use client';

/**
 * Transmittal Details Step
 *
 * Step 2 of transmittal generation - enter transmittal metadata
 * - Subject
 * - Cover notes
 * - Purpose of issue
 */

import {
  Stack,
  TextField,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import type { TransmittalDeliveryMethod } from '@vapour/types';

interface TransmittalDetailsStepProps {
  subject: string;
  coverNotes: string;
  purposeOfIssue: string;
  deliveryMethod: TransmittalDeliveryMethod | '';
  onSubjectChange: (value: string) => void;
  onCoverNotesChange: (value: string) => void;
  onPurposeChange: (value: string) => void;
  onDeliveryMethodChange: (value: TransmittalDeliveryMethod | '') => void;
}

export default function TransmittalDetailsStep({
  subject,
  coverNotes,
  purposeOfIssue,
  deliveryMethod,
  onSubjectChange,
  onCoverNotesChange,
  onPurposeChange,
  onDeliveryMethodChange,
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

      <FormControl fullWidth>
        <InputLabel id="delivery-method-label">Delivery Method</InputLabel>
        <Select
          labelId="delivery-method-label"
          value={deliveryMethod}
          label="Delivery Method"
          onChange={(e) => onDeliveryMethodChange(e.target.value as TransmittalDeliveryMethod | '')}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          <MenuItem value="HARD_COPY">Hard Copy Only</MenuItem>
          <MenuItem value="SOFT_COPY">Soft Copy Only</MenuItem>
          <MenuItem value="BOTH">Both Hard &amp; Soft Copy</MenuItem>
        </Select>
      </FormControl>

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
