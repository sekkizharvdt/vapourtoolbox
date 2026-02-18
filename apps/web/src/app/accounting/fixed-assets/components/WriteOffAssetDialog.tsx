'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Typography,
} from '@mui/material';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { writeOffAsset } from '@/lib/accounting/fixedAssetService';
import type { FixedAsset } from '@vapour/types';
import { formatCurrency } from '@/lib/utils/formatters';

interface WriteOffAssetDialogProps {
  open: boolean;
  onClose: () => void;
  asset: FixedAsset;
  onWrittenOff: () => void;
}

export default function WriteOffAssetDialog({
  open,
  onClose,
  asset,
  onWrittenOff,
}: WriteOffAssetDialogProps) {
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    if (!user || !claims?.permissions) return;

    if (!reason.trim()) {
      setError('Write-off reason is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await writeOffAsset(asset.id, reason.trim(), user.uid, claims.permissions);

      toast.success(`Asset ${asset.assetNumber} written off`);
      onWrittenOff();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to write off asset';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Write Off Asset — {asset.assetNumber}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Alert severity="error" sx={{ mb: 2 }}>
          This will write off the asset completely. The full remaining book value will be recorded
          as a loss. This action cannot be undone.
        </Alert>

        <Typography variant="body2" sx={{ mb: 2 }}>
          Current Written Down Value: <strong>{formatCurrency(asset.writtenDownValue)}</strong>
        </Typography>
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          Loss on write-off: <strong>{formatCurrency(asset.writtenDownValue)}</strong>
        </Typography>

        <TextField
          label="Reason for Write-Off"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          fullWidth
          required
          multiline
          rows={3}
          placeholder="e.g., Damaged beyond repair, Stolen, Obsolete"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <LoadingButton
          variant="contained"
          color="error"
          onClick={handleSubmit}
          loading={saving}
          disabled={!reason.trim()}
        >
          Write Off Asset
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
