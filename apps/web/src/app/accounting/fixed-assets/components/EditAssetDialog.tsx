'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  InputAdornment,
  Typography,
  Divider,
} from '@mui/material';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { updateFixedAsset } from '@/lib/accounting/fixedAssetService';
import type { FixedAsset, DepreciationMethod } from '@vapour/types';
import { ASSET_CATEGORY_LABELS } from '@vapour/types';

interface EditAssetDialogProps {
  open: boolean;
  onClose: () => void;
  asset: FixedAsset;
  onUpdated: () => void;
}

export default function EditAssetDialog({ open, onClose, asset, onUpdated }: EditAssetDialogProps) {
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state — only editable non-financial fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');
  const [depMethod, setDepMethod] = useState<DepreciationMethod>('WDV');
  const [depRate, setDepRate] = useState('');
  const [usefulLife, setUsefulLife] = useState('');
  const [residualValue, setResidualValue] = useState('');

  // Initialize from asset data
  useEffect(() => {
    if (asset) {
      setName(asset.name);
      setDescription(asset.description ?? '');
      setLocation(asset.location ?? '');
      setAssignedTo(asset.assignedTo ?? '');
      setNotes(asset.notes ?? '');
      setDepMethod(asset.depreciationMethod);
      setDepRate(asset.depreciationRatePercent.toString());
      setUsefulLife(asset.usefulLifeYears?.toString() ?? '');
      setResidualValue(asset.residualValue.toString());
    }
  }, [asset]);

  const handleSubmit = async () => {
    if (!user || !claims?.permissions) return;

    if (!name.trim()) {
      setError('Asset name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await updateFixedAsset(
        asset.id,
        {
          name: name.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          assignedTo: assignedTo.trim() || undefined,
          notes: notes.trim() || undefined,
          depreciationMethod: depMethod,
          ...(depRate && { depreciationRatePercent: parseFloat(depRate) }),
          ...(usefulLife && { usefulLifeYears: parseInt(usefulLife, 10) }),
          residualValue: parseFloat(residualValue) || 0,
        },
        user.uid,
        claims.permissions
      );

      toast.success('Asset updated successfully');
      onUpdated();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update asset';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Asset — {asset.assetNumber}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>
          Asset Details
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              label="Asset Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Category"
              value={ASSET_CATEGORY_LABELS[asset.category] ?? asset.category}
              fullWidth
              disabled
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              fullWidth
              placeholder="e.g., Main Office, Factory Floor"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Assigned To"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              fullWidth
              placeholder="Employee name"
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Depreciation Configuration
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Method</InputLabel>
              <Select
                value={depMethod}
                label="Method"
                onChange={(e) => setDepMethod(e.target.value as DepreciationMethod)}
              >
                <MenuItem value="WDV">WDV (Written Down Value)</MenuItem>
                <MenuItem value="SLM">SLM (Straight Line)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="Rate (%)"
              value={depRate}
              onChange={(e) => setDepRate(e.target.value)}
              fullWidth
              type="number"
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="Useful Life (years)"
              value={usefulLife}
              onChange={(e) => setUsefulLife(e.target.value)}
              fullWidth
              type="number"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="Residual Value"
              value={residualValue}
              onChange={(e) => setResidualValue(e.target.value)}
              fullWidth
              type="number"
              InputProps={{
                startAdornment: <InputAdornment position="start">&#8377;</InputAdornment>,
              }}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          fullWidth
          multiline
          rows={2}
          placeholder="Warranty info, serial number, etc."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <LoadingButton
          variant="contained"
          onClick={handleSubmit}
          loading={saving}
          disabled={!name.trim()}
        >
          Save Changes
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
