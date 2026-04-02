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
  const { user, claims } = useAuth();
  const { db } = getFirebase();
  const tenantId = claims?.tenantId || 'default-entity';

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

  const handleSave = async () => {
    if (!(name ?? '').trim()) {
      setError('Service name is required');
      return;
    }

    if (!user?.uid || !db) return;

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

      const service = await createService(
        db,
        {
          serviceCode: '', // Will be auto-generated
          name: name.trim(),
          ...(description.trim() && { description: description.trim() }),
          category,
          calculationMethod,
          ...(defaultRateValue && { defaultRateValue: parseFloat(defaultRateValue) }),
          ...(unit.trim() && { unit: unit.trim() }),
          ...(estimatedTurnaroundDays && {
            estimatedTurnaroundDays: parseInt(estimatedTurnaroundDays, 10),
          }),
          ...(testMethodStandard.trim() && { testMethodStandard: testMethodStandard.trim() }),
          ...(sampleRequirements.trim() && { sampleRequirements: sampleRequirements.trim() }),
          ...(accreditationsList.length > 0 && { requiredAccreditations: accreditationsList }),
          ...(deliverablesList.length > 0 && { deliverables: deliverablesList }),
          tenantId,
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
