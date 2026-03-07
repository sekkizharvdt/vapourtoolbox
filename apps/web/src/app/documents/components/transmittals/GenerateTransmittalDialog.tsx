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
import type {
  MasterDocumentEntry,
  TransmittalDeliveryMethod,
  TransmittalDocumentEntry,
} from '@vapour/types';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import DocumentSelectionStep from './DocumentSelectionStep';
import TransmittalDetailsStep from './TransmittalDetailsStep';
import PreviewStep from './PreviewStep';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  createTransmittal,
  updateTransmittalStatus,
  getTransmittal,
} from '@/lib/documents/transmittalService';
import {
  getSubmissionById,
  getSubmissionsByMasterDocument,
} from '@/lib/documents/documentSubmissionService';
import { generateTransmittalPdf } from '@/lib/documents/transmittalPdfService';
import { downloadTransmittalZip } from '@/lib/documents/transmittalZipService';

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
  const { db } = getFirebase();
  const { user } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(preSelectedDocuments);
  const [subject, setSubject] = useState('');
  const [coverNotes, setCoverNotes] = useState('');
  const [purposeOfIssue, setPurposeOfIssue] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<TransmittalDeliveryMethod | ''>('');
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
      setDeliveryMethod('');
      setError(null);
      onClose();
    }
  };

  const handleGenerate = async () => {
    if (!db || !user) {
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
        clientName: 'Client Name',
        documentIds: selectedDocIds,
        subject: subject || undefined,
        coverNotes: coverNotes || undefined,
        purposeOfIssue: purposeOfIssue || undefined,
        deliveryMethod: deliveryMethod || undefined,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Unknown',
      });

      console.warn('[GenerateTransmittal] Transmittal record created:', transmittalId);

      // Step 2: Fetch the created transmittal for PDF generation
      const transmittal = await getTransmittal(db, projectId, transmittalId);
      if (!transmittal) {
        throw new Error('Failed to retrieve created transmittal');
      }

      // Step 3: Build TransmittalDocumentEntry[] from selected MasterDocumentEntry[]
      // Fetch file URLs from the latest submission for each document
      const transmittalDocs: TransmittalDocumentEntry[] = await Promise.all(
        selectedDocuments.map(async (mdlDoc) => {
          let documentFileUrl: string | undefined;
          let submissionId = mdlDoc.lastSubmissionId;

          // Find the latest submission — by ID if available, otherwise query
          const submission = submissionId
            ? await getSubmissionById(projectId, submissionId)
            : await getSubmissionsByMasterDocument(projectId, mdlDoc.id).then(
                (subs) => subs[0] ?? null
              );

          if (submission) {
            submissionId = submission.id;

            // Get file URL from submission.files[] (primary file first)
            if (submission.files && submission.files.length > 0) {
              const primaryFile = submission.primaryFileId
                ? submission.files.find((f) => f.id === submission.primaryFileId)
                : submission.files.find((f) => f.isPrimary);
              const file = primaryFile ?? submission.files[0];
              if (file) {
                documentFileUrl = file.fileUrl;
              }
            }
            // Fall back to DocumentRecord via documentId
            if (!documentFileUrl && submission.documentId) {
              const docRecordRef = doc(db, COLLECTIONS.DOCUMENTS, submission.documentId);
              const docRecordSnap = await getDoc(docRecordRef);
              if (docRecordSnap.exists()) {
                documentFileUrl = docRecordSnap.data().fileUrl;
              }
            }
          }

          return {
            masterDocumentId: mdlDoc.id,
            documentNumber: mdlDoc.documentNumber,
            documentTitle: mdlDoc.documentTitle,
            disciplineCode: mdlDoc.disciplineCode,
            revision: mdlDoc.currentRevision,
            submissionDate: mdlDoc.lastSubmissionDate ?? Timestamp.now(),
            status: mdlDoc.status,
            purposeOfIssue: purposeOfIssue || undefined,
            submissionId,
            documentFileUrl,
          };
        })
      );

      // Step 4: Generate cover sheet PDF client-side using @react-pdf/renderer
      console.warn('[GenerateTransmittal] Generating PDF cover sheet...');
      const pdfBlob = await generateTransmittalPdf(transmittal, transmittalDocs);

      // Step 5: Generate and download ZIP with cover sheet + document files
      console.warn('[GenerateTransmittal] Generating ZIP archive...');
      const dlMethod = deliveryMethod || undefined;
      await downloadTransmittalZip(
        transmittal.transmittalNumber,
        transmittalDocs,
        dlMethod,
        pdfBlob
      );

      // Step 6: Update transmittal status to GENERATED
      await updateTransmittalStatus(db, projectId, transmittalId, 'GENERATED');

      console.warn('[GenerateTransmittal] Download triggered');
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
                deliveryMethod={deliveryMethod}
                onSubjectChange={setSubject}
                onCoverNotesChange={setCoverNotes}
                onPurposeChange={setPurposeOfIssue}
                onDeliveryMethodChange={setDeliveryMethod}
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
