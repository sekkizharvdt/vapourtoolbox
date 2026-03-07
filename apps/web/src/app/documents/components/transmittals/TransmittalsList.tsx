'use client';

/**
 * Transmittals List Component
 *
 * Main container for transmittals history view
 * - Loads transmittals from Firestore
 * - Displays table with filters
 * - Handles view/download actions
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Snackbar,
} from '@mui/material';
import type {
  DocumentTransmittal,
  MasterDocumentEntry,
  TransmittalDocumentEntry,
} from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { COLLECTIONS } from '@vapour/firebase';
import TransmittalsTable from './TransmittalsTable';
import TransmittalDetailDialog from './TransmittalDetailDialog';
import {
  deleteTransmittal,
  getTransmittal,
  updateTransmittalStatus,
} from '@/lib/documents/transmittalService';
import {
  getSubmissionById,
  getSubmissionsByMasterDocument,
} from '@/lib/documents/documentSubmissionService';
import { generateTransmittalPdf } from '@/lib/documents/transmittalPdfService';
import { downloadTransmittalZip } from '@/lib/documents/transmittalZipService';

interface TransmittalsListProps {
  projectId: string;
  documents?: MasterDocumentEntry[];
  onRefresh?: () => void;
}

export default function TransmittalsList({
  projectId,
  documents: documentsProp,
  onRefresh: _onRefresh,
}: TransmittalsListProps) {
  const { db, functions } = getFirebase();

  const [transmittals, setTransmittals] = useState<DocumentTransmittal[]>([]);
  const [filteredTransmittals, setFilteredTransmittals] = useState<DocumentTransmittal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransmittal, setSelectedTransmittal] = useState<DocumentTransmittal | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [transmittalToDelete, setTransmittalToDelete] = useState<DocumentTransmittal | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [snackMessage, setSnackMessage] = useState<string | null>(null);

  useEffect(() => {
    loadTransmittals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    // Filter transmittals based on search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = transmittals.filter(
        (t) =>
          t.transmittalNumber.toLowerCase().includes(query) ||
          t.subject?.toLowerCase().includes(query) ||
          t.clientName.toLowerCase().includes(query) ||
          t.createdByName.toLowerCase().includes(query)
      );
      setFilteredTransmittals(filtered);
    } else {
      setFilteredTransmittals(transmittals);
    }
  }, [searchQuery, transmittals]);

  const loadTransmittals = async () => {
    if (!db) {
      console.error('[TransmittalsList] Firebase db not initialized');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const transmittalsRef = collection(db, 'projects', projectId, 'transmittals');
      const q = query(
        transmittalsRef,
        where('projectId', '==', projectId),
        orderBy('transmittalDate', 'desc')
      );

      const snapshot = await getDocs(q);
      const data: DocumentTransmittal[] = [];

      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as DocumentTransmittal);
      });

      setTransmittals(data);
      setFilteredTransmittals(data);
    } catch (err) {
      console.error('[TransmittalsList] Error loading transmittals:', err);
      setError(err instanceof Error ? err.message : 'Failed to load transmittals');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTransmittal = (transmittal: DocumentTransmittal) => {
    setSelectedTransmittal(transmittal);
    setDetailDialogOpen(true);
  };

  const handleDownloadZip = async (transmittal: DocumentTransmittal) => {
    try {
      if (!transmittal.zipFileUrl) {
        alert('ZIP file not available for this transmittal');
        return;
      }

      if (!functions) {
        alert('Firebase Functions not initialized');
        return;
      }

      console.warn('[TransmittalsList] Downloading ZIP for:', transmittal.transmittalNumber);

      // Get signed download URL from Cloud Function
      const getDownloadUrlFn = httpsCallable(functions, 'getTransmittalDownloadUrl');
      const result = await getDownloadUrlFn({ fileUrl: transmittal.zipFileUrl });
      const data = result.data as { downloadUrl: string };

      // Trigger download
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = `${transmittal.transmittalNumber}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.warn('[TransmittalsList] ZIP download triggered');
    } catch (err) {
      console.error('Failed to download ZIP:', err);
      alert(
        'Failed to download ZIP file: ' + (err instanceof Error ? err.message : 'Unknown error')
      );
    }
  };

  const handleDownloadPdf = async (transmittal: DocumentTransmittal) => {
    try {
      if (!transmittal.transmittalPdfUrl) {
        alert('PDF not available for this transmittal');
        return;
      }

      if (!functions) {
        alert('Firebase Functions not initialized');
        return;
      }

      console.warn('[TransmittalsList] Downloading PDF for:', transmittal.transmittalNumber);

      // Get signed download URL from Cloud Function
      const getDownloadUrlFn = httpsCallable(functions, 'getTransmittalDownloadUrl');
      const result = await getDownloadUrlFn({ fileUrl: transmittal.transmittalPdfUrl });
      const data = result.data as { downloadUrl: string };

      // Trigger download
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = `${transmittal.transmittalNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.warn('[TransmittalsList] PDF download triggered');
    } catch (err) {
      console.error('Failed to download PDF:', err);
      alert(
        'Failed to download PDF file: ' + (err instanceof Error ? err.message : 'Unknown error')
      );
    }
  };

  const handleRegenerate = async (transmittal: DocumentTransmittal) => {
    if (!db || !documentsProp) return;

    setRegenerating(transmittal.id);
    setError(null);

    try {
      // Fetch full transmittal data
      const fullTransmittal = await getTransmittal(db, projectId, transmittal.id);
      if (!fullTransmittal) throw new Error('Transmittal not found');

      // Build TransmittalDocumentEntry[] from document IDs
      const transmittalDocs: TransmittalDocumentEntry[] = await Promise.all(
        fullTransmittal.documentIds.map(async (docId) => {
          const mdlDoc = documentsProp.find((d) => d.id === docId);
          let documentFileUrl: string | undefined;
          let submissionId = mdlDoc?.lastSubmissionId;

          const submission = submissionId
            ? await getSubmissionById(projectId, submissionId)
            : mdlDoc
              ? await getSubmissionsByMasterDocument(projectId, mdlDoc.id).then(
                  (subs) => subs[0] ?? null
                )
              : null;

          if (submission) {
            submissionId = submission.id;
            if (submission.files && submission.files.length > 0) {
              const primaryFile = submission.primaryFileId
                ? submission.files.find((f) => f.id === submission.primaryFileId)
                : submission.files.find((f) => f.isPrimary);
              const file = primaryFile ?? submission.files[0];
              if (file) documentFileUrl = file.fileUrl;
            }
            if (!documentFileUrl && submission.documentId) {
              const docRecordRef = doc(db, COLLECTIONS.DOCUMENTS, submission.documentId);
              const docRecordSnap = await getDoc(docRecordRef);
              if (docRecordSnap.exists()) {
                documentFileUrl = docRecordSnap.data().fileUrl;
              }
            }
          }

          return {
            masterDocumentId: docId,
            documentNumber: mdlDoc?.documentNumber || docId,
            documentTitle: mdlDoc?.documentTitle || '',
            disciplineCode: mdlDoc?.disciplineCode || '',
            revision: mdlDoc?.currentRevision || '0',
            submissionDate: mdlDoc?.lastSubmissionDate ?? Timestamp.now(),
            status: mdlDoc?.status || 'DRAFT',
            submissionId,
            documentFileUrl,
          };
        })
      );

      // Generate PDF cover sheet
      const pdfBlob = await generateTransmittalPdf(fullTransmittal, transmittalDocs);

      // Generate and download ZIP
      await downloadTransmittalZip(
        fullTransmittal.transmittalNumber,
        transmittalDocs,
        undefined,
        pdfBlob
      );

      // Update status to GENERATED
      await updateTransmittalStatus(db, projectId, transmittal.id, 'GENERATED');
      setSnackMessage(`${fullTransmittal.transmittalNumber} regenerated and downloaded`);
      await loadTransmittals();
    } catch (err) {
      console.error('[TransmittalsList] Regenerate failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate transmittal');
    } finally {
      setRegenerating(null);
    }
  };

  const handleDeleteClick = (transmittal: DocumentTransmittal) => {
    setTransmittalToDelete(transmittal);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!db || !transmittalToDelete) return;

    try {
      await deleteTransmittal(db, projectId, transmittalToDelete.id);
      setSnackMessage(`${transmittalToDelete.transmittalNumber} deleted`);
      setDeleteConfirmOpen(false);
      setTransmittalToDelete(null);
      await loadTransmittals();
    } catch (err) {
      console.error('[TransmittalsList] Delete failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete transmittal');
      setDeleteConfirmOpen(false);
      setTransmittalToDelete(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ px: 3 }}>
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">Transmittals History</Typography>
            <Typography variant="body2" color="text.secondary">
              {filteredTransmittals.length} transmittal
              {filteredTransmittals.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
            </Typography>
          </Box>
        </Stack>

        {/* Search */}
        <TextField
          placeholder="Search by transmittal number, subject, client, or creator..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          fullWidth
          sx={{ maxWidth: 600 }}
        />

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {regenerating && (
          <Alert severity="info" icon={<CircularProgress size={20} />}>
            Regenerating transmittal... This may take a few moments.
          </Alert>
        )}

        <TransmittalsTable
          transmittals={filteredTransmittals}
          onViewTransmittal={handleViewTransmittal}
          onDownloadZip={handleDownloadZip}
          onRegenerate={handleRegenerate}
          onDelete={handleDeleteClick}
        />
      </Stack>

      <TransmittalDetailDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        transmittal={selectedTransmittal}
        documents={documentsProp}
        onDownloadPdf={handleDownloadPdf}
        onDownloadZip={handleDownloadZip}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Transmittal</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete transmittal{' '}
            <strong>{transmittalToDelete?.transmittalNumber}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={!!snackMessage}
        autoHideDuration={4000}
        onClose={() => setSnackMessage(null)}
        message={snackMessage}
      />
    </Box>
  );
}
