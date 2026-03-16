'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Paper,
  IconButton,
  FormControlLabel,
  Switch,
  Alert,
  Snackbar,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import { useRouter, useSearchParams } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  ServiceCategory,
  SERVICE_CATEGORY_LABELS,
  ServiceCalculationMethod,
  SERVICE_CALCULATION_METHOD_LABELS,
} from '@vapour/types';
import { createService } from '@/lib/services/crud';

export default function NewServicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') as ServiceCategory | null;
  const { user } = useAuth();
  const { db } = getFirebase();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ServiceCategory>(
    initialCategory || ServiceCategory.ENGINEERING
  );
  const [calculationMethod, setCalculationMethod] = useState<ServiceCalculationMethod>(
    ServiceCalculationMethod.PERCENTAGE_OF_MATERIAL
  );
  const [defaultRateValue, setDefaultRateValue] = useState<string>('');
  const [isStandard, setIsStandard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  const handleSave = async () => {
    if (!(name ?? '').trim()) {
      setError('Service name is required');
      return;
    }

    if (!user?.uid || !db) return;

    setSaving(true);
    setError('');

    try {
      const service = await createService(
        db,
        {
          serviceCode: '', // Will be auto-generated
          name: name.trim(),
          ...(description.trim() && { description: description.trim() }),
          category,
          calculationMethod,
          ...(defaultRateValue && { defaultRateValue: parseFloat(defaultRateValue) }),
          entityId: 'default-entity',
          isActive: true,
          isStandard,
        },
        user.uid
      );

      setSnackbar({ open: true, message: 'Service created successfully' });
      router.push(`/services/${service.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service');
    } finally {
      setSaving(false);
    }
  };

  const isPercentageMethod =
    calculationMethod === ServiceCalculationMethod.PERCENTAGE_OF_MATERIAL ||
    calculationMethod === ServiceCalculationMethod.PERCENTAGE_OF_TOTAL;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => router.back()}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" component="h1">
          New Service
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Basic Info */}
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              label="Service Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              placeholder="e.g., Proximate Analysis, Fabrication - Pressure Vessel"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth required>
              <InputLabel>Category</InputLabel>
              <Select
                value={category}
                label="Category"
                onChange={(e) => setCategory(e.target.value as ServiceCategory)}
              >
                {Object.entries(SERVICE_CATEGORY_LABELS).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={12}>
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="Detailed description of the service..."
            />
          </Grid>

          {/* Costing */}
          <Grid size={12}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
              Costing
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth required>
              <InputLabel>Calculation Method</InputLabel>
              <Select
                value={calculationMethod}
                label="Calculation Method"
                onChange={(e) => setCalculationMethod(e.target.value as ServiceCalculationMethod)}
              >
                {Object.entries(SERVICE_CALCULATION_METHOD_LABELS).map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label={isPercentageMethod ? 'Default Rate (%)' : 'Default Rate (Amount)'}
              value={defaultRateValue}
              onChange={(e) => setDefaultRateValue(e.target.value)}
              fullWidth
              type="number"
              placeholder={isPercentageMethod ? 'e.g., 15' : 'e.g., 50000'}
              helperText={
                isPercentageMethod
                  ? 'Percentage applied to material/total cost'
                  : 'Fixed amount or per-unit rate'
              }
            />
          </Grid>

          {/* Options */}
          <Grid size={12}>
            <FormControlLabel
              control={
                <Switch checked={isStandard} onChange={(e) => setIsStandard(e.target.checked)} />
              }
              label="Standard service (applies by default to all applicable BOM items)"
            />
          </Grid>

          {/* Actions */}
          <Grid size={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving || !(name ?? '').trim()}
              >
                {saving ? 'Saving...' : 'Create Service'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        message={snackbar.message}
      />
    </Box>
  );
}
