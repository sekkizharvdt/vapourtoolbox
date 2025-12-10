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
  CircularProgress,
} from '@mui/material';
import type { MasterDocumentEntry } from '@vapour/types';
import DocumentSelectionStep from './DocumentSelectionStep';
import TransmittalDetailsStep from './TransmittalDetailsStep';
import PreviewStep from './PreviewStep';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { createTransmittal } from '@/lib/documents/transmittalService';
import { httpsCallable } from 'firebase/functions';

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
  documents,
  preSelectedDocuments = [],
}: GenerateTransmittalDialogProps) {
  const { db, functions } = getFirebase();
  const { user } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(preSelectedDocuments);
  const [subject, setSubject] = useState('');
  const [coverNotes, setCoverNotes] = useState('');
  const [purposeOfIssue, setPurposeOfIssue] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleClose = () => {
    if (!generating) {
      setActiveStep(0);
      setSelectedDocIds([]);
      setSubject('');
      setCoverNotes('');
      setPurposeOfIssue('');
      setError(null);
      onClose();
    }
  };

  const handleGenerate = async () => {
    if (!db || !functions || !user) {
      setError('Firebase not initialized or user not authenticated');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // Step 1: Create DocumentTransmittal record in Firestore
      console.warn('[GenerateTransmittal] Creating transmittal record...');
      const transmittalId = await createTransmittal(db, {
        projectId,
        projectName,
        clientName: 'Client Name', // Uses default; client name can be passed from project context
        documentIds: selectedDocIds,
        subject,
        coverNotes,
        purposeOfIssue,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Unknown',
      });

      console.warn('[GenerateTransmittal] Transmittal record created:', transmittalId);

      // Step 2: Call Cloud Function to generate PDF and ZIP
      console.warn('[GenerateTransmittal] Calling generateTransmittal Cloud Function...');
      const generateTransmittalFn = httpsCallable(functions, 'generateTransmittal');
      const result = await generateTransmittalFn({
        transmittalId,
        projectId,
      });

      const data = result.data as {
        success: boolean;
        transmittalNumber: string;
        zipUrl: string;
        zipSize: number;
        fileCount: number;
      };

      console.warn('[GenerateTransmittal] Generation complete:', data);

      // Step 3: Get download URL for the ZIP file
      const getDownloadUrlFn = httpsCallable(functions, 'getTransmittalDownloadUrl');
      const downloadResult = await getDownloadUrlFn({ fileUrl: data.zipUrl });
      const downloadData = downloadResult.data as { downloadUrl: string };

      // Step 4: Trigger download
      const link = document.createElement('a');
      link.href = downloadData.downloadUrl;
      link.download = `${data.transmittalNumber}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.warn('[GenerateTransmittal] Download triggered');

      // Show success message
      alert(
        `Transmittal generated successfully!\n\n` +
          `Transmittal Number: ${data.transmittalNumber}\n` +
          `Files Included: ${data.fileCount}\n` +
          `ZIP Size: ${(data.zipSize / (1024 * 1024)).toFixed(2)} MB\n\n` +
          `Download started automatically.`
      );

      handleClose();
    } catch (err) {
      console.error('[GenerateTransmittal] Failed to generate transmittal:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate transmittal');
    } finally {
      setGenerating(false);
    }
  };

  const selectedDocuments = documents.filter((doc) => selectedDocIds.includes(doc.id));
  const canProceed = activeStep === 0 ? selectedDocIds.length > 0 : true;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Generate Document Transmittal
        <Typography variant="body2" color="text.secondary">
          {projectName}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Error Alert */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Generation Progress */}
          {generating && (
            <Alert severity="info" icon={<CircularProgress size={20} />}>
              Generating transmittal... This may take a few moments while we create the PDF and
              gather all files.
            </Alert>
          )}

          {/* Stepper */}
          <Stepper activeStep={activeStep}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Step Content */}
          <Box sx={{ minHeight: 400 }}>
            {activeStep === 0 && (
              <DocumentSelectionStep
                documents={documents}
                selectedIds={selectedDocIds}
                onSelectionChange={setSelectedDocIds}
              />
            )}

            {activeStep === 1 && (
              <TransmittalDetailsStep
                subject={subject}
                coverNotes={coverNotes}
                purposeOfIssue={purposeOfIssue}
                onSubjectChange={setSubject}
                onCoverNotesChange={setCoverNotes}
                onPurposeChange={setPurposeOfIssue}
              />
            )}

            {activeStep === 2 && (
              <PreviewStep
                selectedDocuments={selectedDocuments}
                subject={subject}
                coverNotes={coverNotes}
                purposeOfIssue={purposeOfIssue}
                projectName={projectName}
              />
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={generating}>
          Cancel
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={generating}>
            Back
          </Button>
        )}
        {activeStep < STEPS.length - 1 && (
          <Button variant="contained" onClick={handleNext} disabled={!canProceed}>
            Next
          </Button>
        )}
        {activeStep === STEPS.length - 1 && (
          <Button
            variant="contained"
            color="success"
            onClick={handleGenerate}
            disabled={generating || selectedDocIds.length === 0}
          >
            {generating ? 'Generating...' : 'Generate & Download'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
