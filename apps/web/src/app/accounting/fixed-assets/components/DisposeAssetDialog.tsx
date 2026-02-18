'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Alert,
  InputAdornment,
  Typography,
} from '@mui/material';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { disposeAsset } from '@/lib/accounting/fixedAssetService';
import type { FixedAsset } from '@vapour/types';
import { formatCurrency } from '@/lib/utils/formatters';

interface DisposeAssetDialogProps {
  open: boolean;
  onClose: () => void;
  asset: FixedAsset;
  onDisposed: () => void;
}

export default function DisposeAssetDialog({
  open,
  onClose,
  asset,
  onDisposed,
}: DisposeAssetDialogProps) {
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().slice(0, 10));
  const [disposalAmount, setDisposalAmount] = useState('');
  const [disposalReason, setDisposalReason] = useState('');

  const saleProceeds = parseFloat(disposalAmount) || 0;
  const gainLoss = saleProceeds - asset.writtenDownValue;

  const handleSubmit = async () => {
    if (!user || !claims?.permissions) return;

    if (!disposalReason.trim()) {
      setError('Disposal reason is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await disposeAsset(
        asset.id,
        {
          disposalDate: new Date(disposalDate),
          disposalAmount: saleProceeds,
          disposalReason: disposalReason.trim(),
        },
        user.uid,
        claims.permissions
      );

      toast.success(`Asset ${asset.assetNumber} disposed successfully`);
      onDisposed();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to dispose asset';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Dispose Asset — {asset.assetNumber}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Alert severity="warning" sx={{ mb: 2 }}>
          This will mark the asset as disposed. This action cannot be undone.
        </Alert>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Current Written Down Value: <strong>{formatCurrency(asset.writtenDownValue)}</strong>
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Disposal Date"
              type="date"
              value={disposalDate}
              onChange={(e) => setDisposalDate(e.target.value)}
              fullWidth
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Sale Proceeds"
              value={disposalAmount}
              onChange={(e) => setDisposalAmount(e.target.value)}
              fullWidth
              type="number"
              InputProps={{
                startAdornment: <InputAdornment position="start">&#8377;</InputAdornment>,
              }}
              helperText="Enter 0 if scrapped without sale"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Reason for Disposal"
              value={disposalReason}
              onChange={(e) => setDisposalReason(e.target.value)}
              fullWidth
              required
              multiline
              rows={2}
              placeholder="e.g., Sold to third party, Scrapped, Donated"
            />
          </Grid>
        </Grid>

        {disposalAmount !== '' && (
          <Alert severity={gainLoss >= 0 ? 'success' : 'error'} sx={{ mt: 2 }}>
            {gainLoss >= 0
              ? `Gain on disposal: ${formatCurrency(gainLoss)}`
              : `Loss on disposal: ${formatCurrency(Math.abs(gainLoss))}`}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <LoadingButton
          variant="contained"
          color="warning"
          onClick={handleSubmit}
          loading={saving}
          disabled={!disposalReason.trim()}
        >
          Dispose Asset
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
