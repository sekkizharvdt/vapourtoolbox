'use client';

/**
 * Upload Approval Letter Dialog
 *
 * Allows users to upload a client approval email/letter and select
 * which documents it covers. One letter can approve multiple documents.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Alert,
  Box,
  LinearProgress,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  InputAdornment,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  AttachFile as AttachIcon,
  Close as CloseIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import type { MasterDocumentEntry } from '@vapour/types';
import { uploadApprovalLetter } from '@/lib/documents/approvalService';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface UploadApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  documents: MasterDocumentEntry[];
  onSuccess: () => void;
}

export default function UploadApprovalDialog({
  open,
  onClose,
  projectId,
  documents,
  onSuccess,
}: UploadApprovalDialogProps) {
  const { db } = getFirebase();
  const { user } = useAuth();

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [letterReference, setLetterReference] = useState('');
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Filter documents eligible for approval (UNDER_REVIEW status primarily)
  const eligibleDocuments = useMemo(
    () => documents.filter((d) => ['UNDER_REVIEW', 'SUBMITTED'].includes(d.status)),
    [documents]
  );

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return eligibleDocuments;
    const q = searchQuery.toLowerCase();
    return eligibleDocuments.filter(
      (d) => d.documentNumber.toLowerCase().includes(q) || d.documentTitle.toLowerCase().includes(q)
    );
  }, [eligibleDocuments, searchQuery]);

  const canSubmit = file !== null && selectedDocIds.length > 0 && letterDate !== '' && !uploading;

  const handleReset = useCallback(() => {
    setFile(null);
    setLetterReference('');
    setLetterDate(new Date().toISOString().split('T')[0] ?? '');
    setSubject('');
    setNotes('');
    setSelectedDocIds([]);
    setSearchQuery('');
    setError(null);
    setUploadProgress(0);
    setUploading(false);
  }, []);

  const handleClose = useCallback(() => {
    if (!uploading) {
      handleReset();
      onClose();
    }
  }, [uploading, handleReset, onClose]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) setFile(selected);
    event.target.value = '';
  }, []);

  const handleToggleDocument = useCallback((docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedDocIds.length === filteredDocuments.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(filteredDocuments.map((d) => d.id));
    }
  }, [selectedDocIds.length, filteredDocuments]);

  const handleSubmit = async () => {
    if (!db || !user || !file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const result = await uploadApprovalLetter(db, {
        projectId,
        file,
        approvedDocumentIds: selectedDocIds,
        letterReference: letterReference.trim() || undefined,
        letterDate: new Date(letterDate),
        subject: subject.trim() || undefined,
        notes: notes.trim() || undefined,
        uploadedBy: user.uid,
        uploadedByName: user.displayName || 'Unknown',
        onProgress: setUploadProgress,
      });

      onSuccess();
      handleClose();

      // Show summary after close
      if (result.documentsSkipped > 0) {
        console.warn(
          `[UploadApproval] ${result.documentsApproved} approved, ${result.documentsSkipped} skipped (already approved or invalid state)`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload approval letter');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Upload Client Approval Letter</DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* File upload */}
          <Box>
            <Button
              variant="outlined"
              component="label"
              startIcon={<AttachIcon />}
              disabled={uploading}
              fullWidth
            >
              {file ? file.name : 'Select Approval Letter / Email'}
              <input
                type="file"
                hidden
                onChange={handleFileChange}
                accept=".pdf,.eml,.msg,.png,.jpg,.jpeg"
              />
            </Button>
            {file && (
              <Chip
                label={`${file.name} (${(file.size / 1024).toFixed(0)} KB)`}
                onDelete={() => setFile(null)}
                deleteIcon={<CloseIcon fontSize="small" />}
                size="small"
                sx={{ mt: 1 }}
              />
            )}
          </Box>

          {/* Letter details */}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Letter Reference"
              value={letterReference}
              onChange={(e) => setLetterReference(e.target.value)}
              size="small"
              fullWidth
              disabled={uploading}
              placeholder="e.g., ABC-APP-2026-001"
            />
            <TextField
              label="Letter Date"
              type="date"
              value={letterDate}
              onChange={(e) => setLetterDate(e.target.value)}
              size="small"
              fullWidth
              disabled={uploading}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>

          <TextField
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            size="small"
            fullWidth
            disabled={uploading}
            placeholder="Approval of submitted documents..."
          />

          {/* Document selection */}
          <Box>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2">
                Select Approved Documents ({selectedDocIds.length} selected)
              </Typography>
              <Button size="small" onClick={handleSelectAll} disabled={uploading}>
                {selectedDocIds.length === filteredDocuments.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Stack>

            <TextField
              placeholder="Search documents..."
              size="small"
              fullWidth
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 1 }}
            />

            {eligibleDocuments.length === 0 ? (
              <Alert severity="info">
                No documents are eligible for approval. Documents must be in SUBMITTED or
                UNDER_REVIEW status.
              </Alert>
            ) : (
              <List
                dense
                sx={{
                  maxHeight: 300,
                  overflow: 'auto',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                {filteredDocuments.map((docItem) => (
                  <ListItem key={docItem.id} disablePadding>
                    <ListItemButton
                      onClick={() => handleToggleDocument(docItem.id)}
                      disabled={uploading}
                      dense
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          edge="start"
                          checked={selectedDocIds.includes(docItem.id)}
                          tabIndex={-1}
                          disableRipple
                          size="small"
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={docItem.documentNumber}
                        secondary={docItem.documentTitle}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                        secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                      />
                      <Chip
                        label={docItem.currentRevision}
                        size="small"
                        sx={{ ml: 1, fontFamily: 'monospace' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          {/* Notes */}
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={2}
            fullWidth
            disabled={uploading}
            placeholder="Optional notes about this approval..."
          />

          {/* Upload progress */}
          {uploading && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Uploading approval letter...
              </Typography>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Box>
          )}

          {/* Error */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!canSubmit}
          startIcon={<UploadIcon />}
        >
          {uploading
            ? 'Uploading...'
            : `Approve ${selectedDocIds.length} Document${selectedDocIds.length !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
