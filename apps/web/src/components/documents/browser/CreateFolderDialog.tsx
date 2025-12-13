'use client';

/**
 * CreateFolderDialog Component
 *
 * Dialog for creating a new folder within the document browser
 */

import { memo, useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
} from '@mui/material';
import { CreateNewFolder as FolderIcon } from '@mui/icons-material';

interface CreateFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (folderName: string) => Promise<void>;
  parentPath: string;
  existingNames?: string[];
}

function CreateFolderDialogComponent({
  open,
  onClose,
  onConfirm,
  parentPath,
  existingNames = [],
}: CreateFolderDialogProps) {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setFolderName('');
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const validateFolderName = useCallback(
    (name: string): string | null => {
      if (!name.trim()) {
        return 'Folder name is required';
      }
      if (name.length > 50) {
        return 'Folder name must be 50 characters or less';
      }
      if (/[<>:"/\\|?*]/.test(name)) {
        return 'Folder name cannot contain < > : " / \\ | ? *';
      }
      if (existingNames.includes(name.trim().toLowerCase())) {
        return 'A folder with this name already exists';
      }
      return null;
    },
    [existingNames]
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setFolderName(value);
      setError(validateFolderName(value));
    },
    [validateFolderName]
  );

  const handleSubmit = useCallback(async () => {
    const validationError = validateFolderName(folderName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await onConfirm(folderName.trim());
      onClose();
    } catch (err) {
      console.error('[CreateFolderDialog] Error creating folder:', err);
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  }, [folderName, validateFolderName, onConfirm, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !error && folderName.trim()) {
        handleSubmit();
      }
    },
    [error, folderName, handleSubmit]
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FolderIcon color="primary" />
        Create New Folder
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Folder Name"
          fullWidth
          value={folderName}
          onChange={handleNameChange}
          onKeyDown={handleKeyDown}
          error={!!error}
          helperText={error || `Creating in: ${parentPath || 'Root'}`}
          disabled={loading}
          inputProps={{ maxLength: 50 }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !!error || !folderName.trim()}
        >
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export const CreateFolderDialog = memo(CreateFolderDialogComponent);
