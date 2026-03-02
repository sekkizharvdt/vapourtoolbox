'use client';

/**
 * Transmittals Tab
 *
 * Project-level transmittals view. Wraps existing transmittal components
 * and adds "Generate Transmittal" action.
 */

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Box, Button, Stack, Typography, Alert } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { LoadingState, EmptyState } from '@vapour/ui';
import type { Project, MasterDocumentEntry } from '@vapour/types';
import { canManageDocuments } from '@vapour/constants';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { getMasterDocumentsByProject } from '@/lib/documents/masterDocumentService';
import TransmittalsList from '@/app/documents/components/transmittals/TransmittalsList';

const GenerateTransmittalDialog = dynamic(
  () => import('@/app/documents/components/transmittals/GenerateTransmittalDialog'),
  { ssr: false }
);

interface TransmittalsTabProps {
  project: Project;
}

export default function TransmittalsTab({ project }: TransmittalsTabProps) {
  const { claims } = useAuth();
  const { db } = getFirebase();
  const hasManageAccess = claims?.permissions ? canManageDocuments(claims.permissions) : false;

  const [documents, setDocuments] = useState<MasterDocumentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadDocuments = useCallback(async () => {
    if (!db) return;
    try {
      const docs = await getMasterDocumentsByProject(db, project.id, {});
      setDocuments(docs.filter((d) => !d.isDeleted));
    } catch (err) {
      console.error('[TransmittalsTab] Error loading documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [db, project.id]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleTransmittalCreated = () => {
    setGenerateDialogOpen(false);
    setRefreshKey((k) => k + 1);
  };

  if (loading) {
    return <LoadingState message="Loading transmittals..." variant="page" />;
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Action Bar */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6">Document Transmittals</Typography>
        {hasManageAccess && (
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => setGenerateDialogOpen(true)}
            disabled={documents.length === 0}
          >
            Generate Transmittal
          </Button>
        )}
      </Stack>

      {documents.length === 0 ? (
        <EmptyState
          message="No documents in this project yet. Create documents in the Master Document List first."
          variant="paper"
        />
      ) : (
        <TransmittalsList
          key={refreshKey}
          projectId={project.id}
          documents={documents}
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {/* Generate Transmittal Dialog */}
      <GenerateTransmittalDialog
        open={generateDialogOpen}
        onClose={handleTransmittalCreated}
        projectId={project.id}
        projectName={project.name}
        documents={documents}
      />
    </Box>
  );
}
