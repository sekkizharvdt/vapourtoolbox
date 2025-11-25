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
import { Box, Typography, Stack, Alert, CircularProgress, TextField } from '@mui/material';
import type { DocumentTransmittal } from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import TransmittalsTable from './TransmittalsTable';
import TransmittalDetailDialog from './TransmittalDetailDialog';

interface TransmittalsListProps {
  projectId: string;
}

export default function TransmittalsList({ projectId }: TransmittalsListProps) {
  const { db, functions } = getFirebase();

  const [transmittals, setTransmittals] = useState<DocumentTransmittal[]>([]);
  const [filteredTransmittals, setFilteredTransmittals] = useState<DocumentTransmittal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransmittal, setSelectedTransmittal] = useState<DocumentTransmittal | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

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

      console.log('[TransmittalsList] Downloading ZIP for:', transmittal.transmittalNumber);

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

      console.log('[TransmittalsList] ZIP download triggered');
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

      console.log('[TransmittalsList] Downloading PDF for:', transmittal.transmittalNumber);

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

      console.log('[TransmittalsList] PDF download triggered');
    } catch (err) {
      console.error('Failed to download PDF:', err);
      alert(
        'Failed to download PDF file: ' + (err instanceof Error ? err.message : 'Unknown error')
      );
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

        {error && <Alert severity="error">{error}</Alert>}

        <TransmittalsTable
          transmittals={filteredTransmittals}
          onViewTransmittal={handleViewTransmittal}
          onDownloadZip={handleDownloadZip}
        />
      </Stack>

      <TransmittalDetailDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        transmittal={selectedTransmittal}
        onDownloadPdf={handleDownloadPdf}
        onDownloadZip={handleDownloadZip}
      />
    </Box>
  );
}
