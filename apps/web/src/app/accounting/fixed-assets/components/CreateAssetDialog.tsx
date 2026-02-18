'use client';

import { useState } from 'react';
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
import { createFixedAsset } from '@/lib/accounting/fixedAssetService';
import type { AssetCategory, DepreciationMethod } from '@vapour/types';
import { ASSET_CATEGORY_LABELS, DEPRECIATION_RATES } from '@vapour/types';

interface CreateAssetDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  // Pre-fill from vendor bill
  prefill?: {
    vendor?: string;
    vendorId?: string;
    purchaseAmount?: number;
    purchaseDate?: string; // YYYY-MM-DD
    sourceBillId?: string;
    sourceBillNumber?: string;
  };
}

const CATEGORY_OPTIONS = Object.entries(ASSET_CATEGORY_LABELS).map(([value, label]) => ({
  value: value as AssetCategory,
  label,
}));

export function CreateAssetDialog({ open, onClose, onCreated, prefill }: CreateAssetDialogProps) {
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<AssetCategory>('COMPUTERS_AND_IT');
  const [purchaseDate, setPurchaseDate] = useState(
    prefill?.purchaseDate ?? new Date().toISOString().slice(0, 10)
  );
  const [purchaseAmount, setPurchaseAmount] = useState(prefill?.purchaseAmount?.toString() ?? '');
  const [vendor, setVendor] = useState(prefill?.vendor ?? '');
  const [location, setLocation] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');

  // Depreciation config
  const [depMethod, setDepMethod] = useState<DepreciationMethod>('WDV');
  const [depRate, setDepRate] = useState('');
  const [usefulLife, setUsefulLife] = useState('');
  const [residualValue, setResidualValue] = useState('0');

  // Auto-fill depreciation defaults when category changes
  const handleCategoryChange = (newCategory: AssetCategory) => {
    setCategory(newCategory);
    const defaults = DEPRECIATION_RATES[newCategory];
    setDepRate(depMethod === 'WDV' ? defaults.wdv.toString() : defaults.slm.toString());
    setUsefulLife(defaults.usefulLife.toString());
  };

  const handleMethodChange = (newMethod: DepreciationMethod) => {
    setDepMethod(newMethod);
    const defaults = DEPRECIATION_RATES[category];
    setDepRate(newMethod === 'WDV' ? defaults.wdv.toString() : defaults.slm.toString());
  };

  // Initialize defaults on mount
  useState(() => {
    const defaults = DEPRECIATION_RATES[category];
    setDepRate(defaults.wdv.toString());
    setUsefulLife(defaults.usefulLife.toString());
  });

  const handleSubmit = async () => {
    if (!user || !claims?.entityId || !claims?.permissions) return;

    // Validation
    if (!name.trim()) {
      setError('Asset name is required');
      return;
    }
    const amount = parseFloat(purchaseAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Valid purchase amount is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const result = await createFixedAsset(
        {
          name: name.trim(),
          ...(description.trim() && { description: description.trim() }),
          category,
          purchaseDate: new Date(purchaseDate),
          purchaseAmount: amount,
          ...(vendor.trim() && { vendor: vendor.trim() }),
          ...(prefill?.vendorId && { vendorId: prefill.vendorId }),
          ...(prefill?.sourceBillId && { sourceBillId: prefill.sourceBillId }),
          ...(prefill?.sourceBillNumber && { sourceBillNumber: prefill.sourceBillNumber }),
          ...(location.trim() && { location: location.trim() }),
          ...(assignedTo.trim() && { assignedTo: assignedTo.trim() }),
          depreciationMethod: depMethod,
          ...(depRate && { depreciationRatePercent: parseFloat(depRate) }),
          ...(usefulLife && { usefulLifeYears: parseInt(usefulLife, 10) }),
          ...(residualValue && { residualValue: parseFloat(residualValue) }),
          ...(notes.trim() && { notes: notes.trim() }),
        },
        user.uid,
        claims.permissions,
        claims.entityId
      );

      toast.success(`Asset ${result.assetNumber} registered successfully`);
      onCreated(result.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create asset';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Register Fixed Asset</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {prefill?.sourceBillNumber && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Creating asset from bill {prefill.sourceBillNumber}
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
              placeholder="e.g., Dell OptiPlex 7020 - Raaja"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth required>
              <InputLabel>Category</InputLabel>
              <Select
                value={category}
                label="Category"
                onChange={(e) => handleCategoryChange(e.target.value as AssetCategory)}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Purchase Date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              fullWidth
              required
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Purchase Amount (excl. GST)"
              value={purchaseAmount}
              onChange={(e) => setPurchaseAmount(e.target.value)}
              fullWidth
              required
              type="number"
              InputProps={{
                startAdornment: <InputAdornment position="start">&#8377;</InputAdornment>,
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              fullWidth
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
            <FormControl fullWidth required>
              <InputLabel>Method</InputLabel>
              <Select
                value={depMethod}
                label="Method"
                onChange={(e) => handleMethodChange(e.target.value as DepreciationMethod)}
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
              helperText={`Default for ${ASSET_CATEGORY_LABELS[category]}`}
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
          disabled={!name.trim() || !purchaseAmount}
        >
          Register Asset
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
