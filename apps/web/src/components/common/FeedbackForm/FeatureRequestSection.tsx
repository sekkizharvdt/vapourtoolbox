'use client';

/**
 * Feature Request Section
 *
 * One required question: the situation the feature would help with.
 *
 * This section previously asked two optional questions — "Use Case" and
 * "Expected Outcome" — and 83% of the 122 requests on record answered neither,
 * leaving title + description + module and nothing to act on. Expected Outcome
 * largely restated the description, so it has gone; Use Case is the question
 * that decides whether a request is actionable, and it is now required
 * (Phase D of docs/reviews/2026-08-07-feedback-intake-plan.md).
 */

import { Typography, TextField, Card, CardContent } from '@mui/material';

interface FeatureRequestSectionProps {
  useCase: string;
  onUseCaseChange: (value: string) => void;
}

export function FeatureRequestSection({ useCase, onUseCaseChange }: FeatureRequestSectionProps) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          When would you use this?
        </Typography>

        <TextField
          fullWidth
          label="Use Case"
          placeholder="e.g. When I raise a PO for a budgetary RFQ, I have to check the PR by hand to know it should not go ahead."
          value={useCase}
          onChange={(e) => onUseCaseChange(e.target.value)}
          multiline
          rows={3}
          required
          error={!useCase.trim()}
          helperText="Describe a real situation where this would have helped. This is what tells us whether to build it, and how."
        />
      </CardContent>
    </Card>
  );
}
