'use client';

/**
 * Add Document Link Dialog
 *
 * Dialog for adding predecessor, successor, or related document links
 * - Search for documents in the project
 * - Link type selection (Prerequisite/Successor/Related)
 * - Validation (prevent duplicate links, circular dependencies)
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Alert,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  CircularProgress,
  Box,
  Chip,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import type { MasterDocumentEntry, DocumentLink } from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface AddLinkDialogProps {
  open: boolean;
  onClose: () => void;
  document: MasterDocumentEntry;
  linkType: 'PREREQUISITE' | 'SUCCESSOR' | 'RELATED';
  existingLinks: DocumentLink[];
  onAdd: (documentId: string, linkType: 'PREREQUISITE' | 'SUCCESSOR' | 'RELATED') => Promise<void>;
}

export default function AddLinkDialog({
  open,
  onClose,
  document,
  linkType,
  existingLinks,
  onAdd,
}: AddLinkDialogProps) {
  const { db } = getFirebase();

  const [searchTerm, setSearchTerm] = useState('');
  const [documents, setDocuments] = useState<MasterDocumentEntry[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<MasterDocumentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<MasterDocumentEntry | null>(null);

  useEffect(() => {
    if (open) {
      loadDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      setFilteredDocuments(
        documents.filter(
          (doc) =>
            doc.documentNumber.toLowerCase().includes(term) ||
            doc.documentTitle.toLowerCase().includes(term)
        )
      );
    } else {
      setFilteredDocuments(documents);
    }
  }, [searchTerm, documents]);

  const loadDocuments = async () => {
    if (!db) {
      console.error('[AddLinkDialog] Firebase db not initialized');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const docsRef = collection(db, 'projects', document.projectId, 'masterDocuments');
      const q = query(docsRef, where('__name__', '!=', document.id));

      const snapshot = await getDocs(q);
      const data: MasterDocumentEntry[] = [];

      snapshot.forEach((doc) => {
        const docData: MasterDocumentEntry = {
          id: doc.id,
          ...doc.data(),
        } as unknown as MasterDocumentEntry;

        // Filter out already linked documents
        const isAlreadyLinked = existingLinks.some((link) => link.masterDocumentId === doc.id);

        if (!isAlreadyLinked) {
          data.push(docData);
        }
      });

      setDocuments(data);
      setFilteredDocuments(data);
    } catch (err) {
      console.error('[AddLinkDialog] Error loading documents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedDocument) {
      setError('Please select a document to link');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onAdd(selectedDocument.id, linkType);
      handleReset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add link');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSearchTerm('');
    setSelectedDocument(null);
    setError(null);
  };

  const handleClose = () => {
    if (!submitting) {
      handleReset();
      onClose();
    }
  };

  const getLinkTypeLabel = (type: string): string => {
    switch (type) {
      case 'PREREQUISITE':
        return 'Predecessor';
      case 'SUCCESSOR':
        return 'Successor';
      case 'RELATED':
        return 'Related Document';
      default:
        return type;
    }
  };

  const getLinkTypeDescription = (type: string): string => {
    switch (type) {
      case 'PREREQUISITE':
        return 'This document depends on the selected document being completed first';
      case 'SUCCESSOR':
        return 'The selected document depends on this document being completed first';
      case 'RELATED':
        return 'The selected document is related but not dependent';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Add {getLinkTypeLabel(linkType)}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {document.documentNumber} - {document.documentTitle}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Link Type Info */}
          <Alert severity="info">{getLinkTypeDescription(linkType)}</Alert>

          {/* Search Bar */}
          <TextField
            label="Search Documents"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by number or title..."
            disabled={loading || submitting}
            fullWidth
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.disabled' }} />,
            }}
          />

          {/* Loading State */}
          {loading && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Loading documents...
              </Typography>
            </Box>
          )}

          {/* Document List */}
          {!loading && filteredDocuments.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Select a document to link ({filteredDocuments.length} available)
              </Typography>
              <List
                sx={{
                  maxHeight: 400,
                  overflow: 'auto',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mt: 1,
                }}
              >
                {filteredDocuments.map((doc) => (
                  <ListItem key={doc.id} disablePadding>
                    <ListItemButton
                      selected={selectedDocument?.id === doc.id}
                      onClick={() => setSelectedDocument(doc)}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight="medium">
                              {doc.documentNumber}
                            </Typography>
                            <Chip label={doc.status} size="small" variant="outlined" />
                          </Stack>
                        }
                        secondary={
                          <>
                            <Typography variant="body2" component="span">
                              {doc.documentTitle}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              component="span"
                              sx={{ display: 'block' }}
                            >
                              {doc.disciplineCode} • Rev {doc.currentRevision}
                            </Typography>
                          </>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Empty State */}
          {!loading && filteredDocuments.length === 0 && (
            <Alert severity="warning">
              {searchTerm
                ? 'No documents found matching your search'
                : 'No documents available to link (all documents are already linked)'}
            </Alert>
          )}

          {/* Selected Document Preview */}
          {selectedDocument && (
            <Alert severity="success">
              <Typography variant="body2" fontWeight="medium" gutterBottom>
                Selected: {selectedDocument.documentNumber}
              </Typography>
              <Typography variant="body2">{selectedDocument.documentTitle}</Typography>
            </Alert>
          )}

          {/* Error Message */}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleAdd}
          variant="contained"
          disabled={!selectedDocument || submitting || loading}
        >
          {submitting ? 'Adding...' : 'Add Link'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
