'use client';

import { useState, useEffect } from 'react';
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
  CircularProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import { useRouter, useParams } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  ServiceCategory,
  SERVICE_CATEGORY_LABELS,
  ServiceCalculationMethod,
  SERVICE_CALCULATION_METHOD_LABELS,
} from '@vapour/types';
import type { Service } from '@vapour/types';
import { getServiceById, updateService } from '@/lib/services/crud';

export default function EditServicePage() {
  const router = useRouter();
  const params = useParams();
  const serviceId = params.id as string;
  const { user } = useAuth();
  const { db } = getFirebase();

  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ServiceCategory>(ServiceCategory.ENGINEERING);
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

  // Load service and populate form
  useEffect(() => {
    async function load() {
      if (!db || !serviceId) return;
      try {
        const result = await getServiceById(db, serviceId);
        if (result) {
          setService(result);
          setName(result.name);
          setDescription(result.description ?? '');
          setCategory(result.category);
          setCalculationMethod(result.calculationMethod);
          setDefaultRateValue(
            result.defaultRateValue != null ? String(result.defaultRateValue) : ''
          );
          setIsStandard(result.isStandard);
        }
      } catch (err) {
        console.error('Error loading service:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [db, serviceId]);

  const handleSave = async () => {
    if (!(name ?? '').trim()) {
      setError('Service name is required');
      return;
    }

    if (!user?.uid || !db) return;

    setSaving(true);
    setError('');

    try {
      await updateService(
        db,
        serviceId,
        {
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          calculationMethod,
          ...(defaultRateValue ? { defaultRateValue: parseFloat(defaultRateValue) } : {}),
          isStandard,
        },
        user.uid
      );

      setSnackbar({ open: true, message: 'Service updated successfully' });
      router.push(`/services/${serviceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!service) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography color="text.secondary">Service not found</Typography>
        <Button onClick={() => router.push('/services')} sx={{ mt: 2 }}>
          Back to Services
        </Button>
      </Box>
    );
  }

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
          Edit Service: {service.serviceCode}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              label="Service Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
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
            />
          </Grid>

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
              helperText={
                isPercentageMethod
                  ? 'Percentage applied to material/total cost'
                  : 'Fixed amount or per-unit rate'
              }
            />
          </Grid>

          <Grid size={12}>
            <FormControlLabel
              control={
                <Switch checked={isStandard} onChange={(e) => setIsStandard(e.target.checked)} />
              }
              label="Standard service (applies by default to all applicable BOM items)"
            />
          </Grid>

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
                {saving ? 'Saving...' : 'Save Changes'}
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
