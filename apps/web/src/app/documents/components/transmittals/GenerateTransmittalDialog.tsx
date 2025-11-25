'use client';

/**
 * Generate Transmittal Dialog
 *
 * Multi-step dialog for creating document transmittals
 * Steps:
 * 1. Select documents (with filters for ready documents)
 * 2. Add transmittal details (subject, notes, purpose)
 * 3. Preview transmittal PDF
 * 4. Generate and download ZIP
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Box,
  Alert,
} from '@mui/material';
import type { MasterDocumentEntry } from '@vapour/types';

interface GenerateTransmittalDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  documents: MasterDocumentEntry[];
  preSelectedDocuments?: string[];
}

const STEPS = ['Select Documents', 'Transmittal Details', 'Preview & Generate'];

export default function GenerateTransmittalDialog({
  open,
  onClose,
  projectId,
  projectName,
  preSelectedDocuments = [],
}: GenerateTransmittalDialogProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedDocIds] = useState<string[]>(preSelectedDocuments);
  const [subject] = useState('');
  const [coverNotes] = useState('');
  const [purposeOfIssue] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      // TODO: Implement transmittal generation
      console.log('Generating transmittal:', {
        projectId,
        selectedDocIds,
        subject,
        coverNotes,
        purposeOfIssue,
      });
      alert('Transmittal generation will be implemented');
      onClose();
    } catch (err) {
      console.error('Failed to generate transmittal:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Generate Document Transmittal
        <Typography variant="body2" color="text.secondary">
          {projectName}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Stepper activeStep={activeStep}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Alert severity="info">
            Step {activeStep + 1} of {STEPS.length}: {STEPS[activeStep]}
          </Alert>

          <Box sx={{ minHeight: 400 }}>
            <Typography>Transmittal generation UI will be implemented here</Typography>
            <Typography variant="caption" color="text.secondary">
              Selected documents: {selectedDocIds.length}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {activeStep > 0 && <Button onClick={handleBack}>Back</Button>}
        {activeStep < STEPS.length - 1 && (
          <Button variant="contained" onClick={handleNext}>
            Next
          </Button>
        )}
        {activeStep === STEPS.length - 1 && (
          <Button variant="contained" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating...' : 'Generate & Download'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
