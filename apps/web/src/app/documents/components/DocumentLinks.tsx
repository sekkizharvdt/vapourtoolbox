'use client';

/**
 * Document Links Component
 *
 * Main component for managing document links and dependencies
 * Features:
 * - Predecessor links (documents that must be completed first)
 * - Successor links (documents that depend on this one)
 * - Related documents (non-dependent relationships)
 * - Add/remove links
 * - Visual dependency indicators
 * - Circular dependency detection
 */

import { useState } from 'react';
import { Box, Typography, Stack, Alert } from '@mui/material';
import type { MasterDocumentEntry, DocumentLink } from '@vapour/types';
import AddLinkDialog from './links/AddLinkDialog';
import LinksSection from './links/LinksSection';

interface DocumentLinksProps {
  document: MasterDocumentEntry;
  onUpdate: () => void;
}

type LinkDialogType = 'PREREQUISITE' | 'SUCCESSOR' | 'RELATED' | null;

export default function DocumentLinks({ document, onUpdate }: DocumentLinksProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<LinkDialogType>(null);

  const handleOpenDialog = (type: LinkDialogType) => {
    setDialogType(type);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setDialogType(null);
  };

  const handleAddLink = async (
    documentId: string,
    linkType: 'PREREQUISITE' | 'SUCCESSOR' | 'RELATED'
  ) => {
    try {
      // TODO: Implement actual link creation
      // This will involve:
      // 1. Create DocumentLink object
      // 2. Update MasterDocumentEntry arrays (predecessors/successors/relatedDocuments)
      // 3. Create reciprocal link if needed (predecessor → successor, successor → predecessor)
      // 4. Check for circular dependencies
      // 5. Update document status if all predecessors are complete

      console.log('Adding link:', { documentId, linkType });

      // For now, show a placeholder alert
      alert('Document link creation will be implemented with Firestore integration');

      // Update parent
      onUpdate();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add link');
    }
  };

  const handleRemoveLink = async (link: DocumentLink) => {
    try {
      // TODO: Implement link removal
      // This will involve:
      // 1. Remove link from appropriate array (predecessors/successors/relatedDocuments)
      // 2. Remove reciprocal link from target document
      // 3. Update Firestore

      console.log('Removing link:', link);

      // For now, show a placeholder alert
      if (window.confirm(`Remove link to ${link.documentNumber}?`)) {
        alert('Document link removal will be implemented with Firestore integration');
        onUpdate();
      }
    } catch (err) {
      console.error('Failed to remove link:', err);
    }
  };

  // Get all existing links for filtering in add dialog
  const getAllLinks = (): DocumentLink[] => {
    return [...document.predecessors, ...document.successors, ...document.relatedDocuments];
  };

  return (
    <Box sx={{ px: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Typography variant="h6">Document Links & Dependencies</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage document relationships and dependencies
          </Typography>
        </Box>

        {/* Info Alert */}
        <Alert severity="info">
          <Typography variant="body2">
            <strong>Predecessors:</strong> Documents that must be completed before this document can
            start.
            <br />
            <strong>Successors:</strong> Documents that depend on this document being completed.
            <br />
            <strong>Related Documents:</strong> Documents that are related but not dependent on each
            other.
          </Typography>
        </Alert>

        {/* Predecessors and Successors Row */}
        <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}>
          <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
            <LinksSection
              title="Predecessors"
              links={document.predecessors}
              onAdd={() => handleOpenDialog('PREREQUISITE')}
              onRemove={handleRemoveLink}
              emptyMessage="No predecessor documents. This document can start immediately."
            />
          </Box>

          <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
            <LinksSection
              title="Successors"
              links={document.successors}
              onAdd={() => handleOpenDialog('SUCCESSOR')}
              onRemove={handleRemoveLink}
              emptyMessage="No successor documents. No other documents depend on this one."
            />
          </Box>
        </Stack>

        {/* Related Documents */}
        <Box>
          <LinksSection
            title="Related Documents"
            links={document.relatedDocuments}
            onAdd={() => handleOpenDialog('RELATED')}
            onRemove={handleRemoveLink}
            emptyMessage="No related documents linked."
          />
        </Box>

        {/* Dependency Summary */}
        {(document.predecessors.length > 0 || document.successors.length > 0) && (
          <Alert
            severity={
              document.predecessors.every((p) => p.status === 'ACCEPTED') ? 'success' : 'warning'
            }
          >
            <Typography variant="body2">
              {document.predecessors.length > 0 && (
                <>
                  <strong>Predecessors Status:</strong>{' '}
                  {document.predecessors.filter((p) => p.status === 'ACCEPTED').length} of{' '}
                  {document.predecessors.length} completed
                  {document.predecessors.every((p) => p.status === 'ACCEPTED') && (
                    <> - All predecessors complete, ready to start!</>
                  )}
                  <br />
                </>
              )}
              {document.successors.length > 0 && (
                <>
                  <strong>Successors Waiting:</strong> {document.successors.length} document
                  {document.successors.length !== 1 ? 's' : ''} depend on this document
                </>
              )}
            </Typography>
          </Alert>
        )}
      </Stack>

      {/* Add Link Dialog */}
      {dialogType && (
        <AddLinkDialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          document={document}
          linkType={dialogType}
          existingLinks={getAllLinks()}
          onAdd={handleAddLink}
        />
      )}
    </Box>
  );
}
