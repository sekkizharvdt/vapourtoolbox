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
import { useRouter, usePathname } from 'next/navigation';
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

export default function EditServiceClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { db } = getFirebase();

  // Static export: useParams() returns the placeholder; parse the real id from the path.
  const [serviceId, setServiceId] = useState<string | null>(null);
  useEffect(() => {
    if (!pathname) return;
    const match = pathname.match(/\/services\/([^/]+)(?:\/|$)/);
    const extracted = match?.[1];
    if (extracted && extracted !== 'placeholder') {
      setServiceId(extracted);
    }
  }, [pathname]);

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
  // Procurement fields
  const [unit, setUnit] = useState('');
  const [estimatedTurnaroundDays, setEstimatedTurnaroundDays] = useState<string>('');
  const [testMethodStandard, setTestMethodStandard] = useState('');
  const [sampleRequirements, setSampleRequirements] = useState('');
  const [requiredAccreditations, setRequiredAccreditations] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  const [loadError, setLoadError] = useState<string | null>(null);

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
          // Procurement fields
          setUnit(result.unit ?? '');
          setEstimatedTurnaroundDays(
            result.estimatedTurnaroundDays != null ? String(result.estimatedTurnaroundDays) : ''
          );
          setTestMethodStandard(result.testMethodStandard ?? '');
          setSampleRequirements(result.sampleRequirements ?? '');
          setRequiredAccreditations((result.requiredAccreditations ?? []).join(', '));
          setDeliverables((result.deliverables ?? []).join(', '));
        }
      } catch (err) {
        console.error('Error loading service:', err);
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Failed to load service. You may not have permission to view this item.'
        );
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

    if (!user?.uid || !db || !serviceId) return;

    setSaving(true);
    setError('');

    try {
      const accreditationsList = requiredAccreditations
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const deliverablesList = deliverables
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await updateService(
        db,
        serviceId,
        {
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : { description: '' }),
          category,
          calculationMethod,
          ...(defaultRateValue ? { defaultRateValue: parseFloat(defaultRateValue) } : {}),
          isStandard,
          ...(unit.trim() ? { unit: unit.trim() } : {}),
          ...(estimatedTurnaroundDays
            ? { estimatedTurnaroundDays: parseInt(estimatedTurnaroundDays, 10) }
            : {}),
          ...(testMethodStandard.trim() ? { testMethodStandard: testMethodStandard.trim() } : {}),
          ...(sampleRequirements.trim() ? { sampleRequirements: sampleRequirements.trim() } : {}),
          requiredAccreditations: accreditationsList,
          deliverables: deliverablesList,
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
        <Typography color="text.secondary">{loadError || 'Service not found'}</Typography>
        {loadError && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
            {loadError}
          </Typography>
        )}
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

          {/* Procurement */}
          <Grid size={12}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
              Procurement
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              fullWidth
              placeholder="e.g., per test, per sample, per day, lump sum"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Estimated Turnaround (days)"
              value={estimatedTurnaroundDays}
              onChange={(e) => setEstimatedTurnaroundDays(e.target.value)}
              fullWidth
              type="number"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Test Method / Standard"
              value={testMethodStandard}
              onChange={(e) => setTestMethodStandard(e.target.value)}
              fullWidth
              placeholder="e.g., ASTM D3172, ISO 11722"
            />
          </Grid>

          <Grid size={12}>
            <TextField
              label="Sample Requirements"
              value={sampleRequirements}
              onChange={(e) => setSampleRequirements(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="Description of sample needed (quantity, condition, preparation)"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Required Accreditations"
              value={requiredAccreditations}
              onChange={(e) => setRequiredAccreditations(e.target.value)}
              fullWidth
              placeholder="e.g., NABL, ISO 17025, BIS (comma-separated)"
              helperText="Comma-separated list"
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Deliverables"
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
              fullWidth
              placeholder="e.g., Test Certificate, Analysis Report (comma-separated)"
              helperText="Comma-separated list"
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
