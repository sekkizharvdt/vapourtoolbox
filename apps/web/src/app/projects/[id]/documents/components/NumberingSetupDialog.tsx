'use client';

/**
 * Numbering Setup Dialog
 *
 * First-time setup for project document numbering disciplines.
 * Allows users to select which standard disciplines apply to their project.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Stack,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  Box,
} from '@mui/material';
import {
  STANDARD_DISCIPLINE_CODES,
  initializeWithStandardDisciplines,
} from '@/lib/documents/documentNumberingService';
import { useAuth } from '@/contexts/AuthContext';

interface NumberingSetupDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectCode: string;
  onSetupComplete: () => void;
}

export default function NumberingSetupDialog({
  open,
  onClose,
  projectId,
  projectCode,
  onSetupComplete,
}: NumberingSetupDialogProps) {
  const { user } = useAuth();
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(
    new Set(STANDARD_DISCIPLINE_CODES.map((d) => d.code))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedCodes(new Set(STANDARD_DISCIPLINE_CODES.map((d) => d.code)));
  };

  const handleDeselectAll = () => {
    setSelectedCodes(new Set());
  };

  const handleInitialize = async () => {
    if (!user || selectedCodes.size === 0) return;

    setLoading(true);
    setError(null);

    try {
      await initializeWithStandardDisciplines(
        projectId,
        projectCode,
        Array.from(selectedCodes),
        user.uid
      );
      onSetupComplete();
      onClose();
    } catch (err) {
      console.error('[NumberingSetupDialog] Error initializing:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize numbering');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Set Up Document Numbering</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            <Typography variant="body2">
              Select the disciplines relevant to this project. Documents will be numbered as{' '}
              <strong>{projectCode}-[DISCIPLINE]-[SEQ]</strong> (e.g., {projectCode}-01-001).
            </Typography>
          </Alert>

          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button size="small" onClick={handleDeselectAll}>
              Deselect All
            </Button>
          </Stack>

          <Divider />

          <FormGroup>
            {STANDARD_DISCIPLINE_CODES.map((disc) => (
              <FormControlLabel
                key={disc.code}
                control={
                  <Checkbox
                    checked={selectedCodes.has(disc.code)}
                    onChange={() => handleToggle(disc.code)}
                    disabled={loading}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">
                      <strong>{disc.code}</strong> &mdash; {disc.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {disc.description}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </FormGroup>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleInitialize}
          variant="contained"
          disabled={loading || selectedCodes.size === 0}
        >
          {loading ? 'Initializing...' : `Initialize ${selectedCodes.size} Disciplines`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
