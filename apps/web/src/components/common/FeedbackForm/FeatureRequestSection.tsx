'use client';

/**
 * Feature Request Section
 *
 * Form fields specific to feature requests: use case and expected outcome.
 */

import { Typography, TextField, Card, CardContent, Alert } from '@mui/material';

interface FeatureRequestSectionProps {
  useCase: string;
  expectedOutcome: string;
  onUseCaseChange: (value: string) => void;
  onExpectedOutcomeChange: (value: string) => void;
}

export function FeatureRequestSection({
  useCase,
  expectedOutcome,
  onUseCaseChange,
  onExpectedOutcomeChange,
}: FeatureRequestSectionProps) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Additional Information
        </Typography>

        <Alert severity="info" sx={{ mb: 2 }}>
          The more context you provide, the better we can understand and prioritize your request.
        </Alert>

        <TextField
          fullWidth
          label="Use Case"
          placeholder="Describe a scenario where this feature would help you..."
          value={useCase}
          onChange={(e) => onUseCaseChange(e.target.value)}
          multiline
          rows={3}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Expected Outcome"
          placeholder="What would you expect this feature to do?"
          value={expectedOutcome}
          onChange={(e) => onExpectedOutcomeChange(e.target.value)}
          multiline
          rows={2}
        />
      </CardContent>
    </Card>
  );
}
