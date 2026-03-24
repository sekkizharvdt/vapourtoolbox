'use client';

import { Stepper, Step, StepLabel, Box } from '@mui/material';

interface WizardStepperProps {
  activeStep: number;
  steps: string[];
}

export function WizardStepper({ activeStep, steps }: WizardStepperProps) {
  return (
    <Box sx={{ mb: 4 }}>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
