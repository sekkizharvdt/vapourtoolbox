'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Chip,
  FormControlLabel,
  Checkbox,
  Divider,
  Stack,
  Grid,
  Breadcrumbs,
  Link,
  InputLabel,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter, usePathname } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { MaterialCategory, Material, MATERIAL_CATEGORY_LABELS } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { getMaterialById, updateMaterial } from '@/lib/materials/materialService';

// Common grades by category
const COMMON_GRADES: Record<string, string[]> = {
  [MaterialCategory.PLATES_CARBON_STEEL]: ['A36', 'A516 Gr 60', 'A516 Gr 70', 'A285 Gr C'],
  [MaterialCategory.PLATES_STAINLESS_STEEL]: ['304', '304L', '316', '316L', '321', '310S'],
  [MaterialCategory.PLATES_DUPLEX_STEEL]: ['2205', '2507', 'S31803', 'S32750'],
  [MaterialCategory.PLATES_ALLOY_STEEL]: ['P11', 'P22', 'P91', 'P5', 'P9'],
  [MaterialCategory.PIPES_CARBON_STEEL]: ['B', 'X42', 'X52', 'X60', 'X65', 'X70'],
  [MaterialCategory.PIPES_STAINLESS_304L]: ['304L'],
  [MaterialCategory.PIPES_STAINLESS_316L]: ['316L'],
  [MaterialCategory.PIPES_ALLOY_STEEL]: ['P11', 'P22', 'P91', 'P5', 'P9'],
};

// Common finishes
const COMMON_FINISHES = ['2B', 'BA', 'No. 4', 'No. 8', 'HL (Hairline)', 'Hot Rolled', 'Pickled'];

export default function EditMaterialClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { db } = getFirebase();

  const [material, setMaterial] = useState<Material | null>(null);
  const [loadingMaterial, setLoadingMaterial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materialId, setMaterialId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    customCode: '',
    standard: '',
    grade: '',
    finish: '',
    form: '',
    density: '',
    densityUnit: 'kg/m3' as 'kg/m3' | 'g/cm3',
    tensileStrength: '',
    yieldStrength: '',
    maxOperatingTemp: '',
    baseUnit: 'kg',
    tags: [] as string[],
    isStandard: false,
    trackInventory: false,
  });

  const [tagInput, setTagInput] = useState('');

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/materials\/([^/]+)\/edit/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setMaterialId(extractedId);
      }
    }
  }, [pathname]);

  // Load material
  useEffect(() => {
    if (materialId) {
      loadMaterial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId]);

  const loadMaterial = async () => {
    if (!materialId) {
      setError('No material ID provided');
      setLoadingMaterial(false);
      return;
    }

    if (!db) {
      setError('Firebase not initialized');
      setLoadingMaterial(false);
      return;
    }

    try {
      setLoadingMaterial(true);
      setError(null);

      const data = await getMaterialById(db, materialId);

      if (!data) {
        setError('Material not found');
        return;
      }

      setMaterial(data);

      // Populate form with existing data
      setFormData({
        name: data.name || '',
        description: data.description || '',
        customCode: data.customCode || '',
        standard: data.specification?.standard || '',
        grade: data.specification?.grade || '',
        finish: data.specification?.finish || '',
        form: data.specification?.form || '',
        density: data.properties?.density?.toString() || '',
        densityUnit: (data.properties?.densityUnit as 'kg/m3' | 'g/cm3') || 'kg/m3',
        tensileStrength: data.properties?.tensileStrength?.toString() || '',
        yieldStrength: data.properties?.yieldStrength?.toString() || '',
        maxOperatingTemp: data.properties?.maxOperatingTemp?.toString() || '',
        baseUnit: data.baseUnit || 'kg',
        tags: data.tags || [],
        isStandard: data.isStandard || false,
        trackInventory: data.trackInventory || false,
      });
    } catch (err) {
      console.error('Error loading material:', err);
      setError(err instanceof Error ? err.message : 'Failed to load material');
    } finally {
      setLoadingMaterial(false);
    }
  };

  // Handle input change
  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  // Handle tag addition
  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  // Handle tag deletion
  const handleDeleteTag = (tagToDelete: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToDelete),
    }));
  };

  // Validate and submit
  const handleSubmit = async () => {
    if (!db || !user || !material || !materialId) return;

    try {
      setSaving(true);
      setError(null);

      // Build updates object
      const updates: Partial<Material> = {
        name: formData.name,
        description: formData.description,
        ...(formData.customCode && { customCode: formData.customCode }),

        specification: {
          ...(formData.standard && { standard: formData.standard }),
          ...(formData.grade && { grade: formData.grade }),
          ...(formData.finish && { finish: formData.finish }),
          ...(formData.form && { form: formData.form }),
        },

        properties: {
          ...(formData.density && { density: parseFloat(formData.density) }),
          densityUnit: formData.densityUnit,
          ...(formData.tensileStrength && {
            tensileStrength: parseFloat(formData.tensileStrength),
          }),
          ...(formData.yieldStrength && { yieldStrength: parseFloat(formData.yieldStrength) }),
          ...(formData.maxOperatingTemp && {
            maxOperatingTemp: parseFloat(formData.maxOperatingTemp),
          }),
        },

        baseUnit: formData.baseUnit,
        tags: formData.tags,
        isStandard: formData.isStandard,
        trackInventory: formData.trackInventory,
      };

      await updateMaterial(db, materialId, updates, user.uid);

      // Navigate back to material detail
      router.push(`/materials/${materialId}`);
    } catch (err) {
      console.error('Error updating material:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update material. Please check all required fields.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Determine category-specific breadcrumb
  const getCategoryPath = () => {
    if (!material) return { path: '/materials', label: 'Materials' };

    const isPlate = [
      MaterialCategory.PLATES_CARBON_STEEL,
      MaterialCategory.PLATES_STAINLESS_STEEL,
      MaterialCategory.PLATES_DUPLEX_STEEL,
      MaterialCategory.PLATES_ALLOY_STEEL,
    ].includes(material.category);

    const isPipe = [
      MaterialCategory.PIPES_CARBON_STEEL,
      MaterialCategory.PIPES_STAINLESS_304L,
      MaterialCategory.PIPES_STAINLESS_316L,
      MaterialCategory.PIPES_ALLOY_STEEL,
    ].includes(material.category);

    if (isPlate) {
      return { path: '/materials/plates', label: 'Plates' };
    }
    if (isPipe) {
      return { path: '/materials/pipes', label: 'Pipes' };
    }
    return { path: '/materials', label: 'Materials' };
  };

  if (loadingMaterial) {
    return (
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !material) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Material not found'}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/materials')}
          sx={{ mt: 2 }}
        >
          Back to Materials
        </Button>
      </Container>
    );
  }

  const categoryInfo = getCategoryPath();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/materials"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/materials');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Materials
        </Link>
        <Link
          color="inherit"
          href={categoryInfo.path}
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push(categoryInfo.path);
          }}
          sx={{ cursor: 'pointer' }}
        >
          {categoryInfo.label}
        </Link>
        <Link
          color="inherit"
          href={`/materials/${materialId}`}
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push(`/materials/${materialId}`);
          }}
          sx={{ cursor: 'pointer' }}
        >
          {material.materialCode}
        </Link>
        <Typography color="text.primary">Edit</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/materials/${materialId}`)}
        >
          Back to Material
        </Button>
        <Box>
          <Typography variant="h4" component="h1">
            Edit Material
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {material.materialCode} - {MATERIAL_CATEGORY_LABELS[material.category]}
          </Typography>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Form */}
      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* Basic Information */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Box>

          <TextField
            fullWidth
            required
            label="Material Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            helperText="Full name of the material"
          />

          <TextField
            fullWidth
            label="Custom Code"
            value={formData.customCode}
            onChange={(e) => handleChange('customCode', e.target.value)}
            placeholder="e.g., PL-CS-A36"
            helperText="Optional short code for internal reference"
          />

          <TextField
            fullWidth
            required
            multiline
            rows={3}
            label="Description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            helperText="Detailed description including typical applications"
          />

          {/* Specification */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Specification
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Standard"
                value={formData.standard}
                onChange={(e) => handleChange('standard', e.target.value)}
                placeholder="e.g., ASTM A240"
                helperText="ASME/ASTM standard"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Grade</InputLabel>
                <Select
                  value={formData.grade}
                  onChange={(e) => handleChange('grade', e.target.value)}
                  label="Grade"
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {material.category &&
                    COMMON_GRADES[material.category]?.map((grade) => (
                      <MenuItem key={grade} value={grade}>
                        {grade}
                      </MenuItem>
                    ))}
                </Select>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Or enter custom grade"
                  value={
                    material.category && COMMON_GRADES[material.category]?.includes(formData.grade)
                      ? ''
                      : formData.grade
                  }
                  onChange={(e) => handleChange('grade', e.target.value)}
                  sx={{ mt: 1 }}
                  helperText="Material grade"
                />
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Finish</InputLabel>
                <Select
                  value={formData.finish}
                  onChange={(e) => handleChange('finish', e.target.value)}
                  label="Finish"
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {COMMON_FINISHES.map((finish) => (
                    <MenuItem key={finish} value={finish}>
                      {finish}
                    </MenuItem>
                  ))}
                </Select>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Or enter custom finish"
                  value={COMMON_FINISHES.includes(formData.finish) ? '' : formData.finish}
                  onChange={(e) => handleChange('finish', e.target.value)}
                  sx={{ mt: 1 }}
                  helperText="Surface finish (optional)"
                />
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Form"
                value={formData.form}
                onChange={(e) => handleChange('form', e.target.value)}
                placeholder="Plate, Pipe, etc."
                helperText="Material form"
              />
            </Grid>
          </Grid>

          {/* Material Properties */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Material Properties
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Enter density for weight calculations. Other properties are optional.
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Density"
                value={formData.density}
                onChange={(e) => handleChange('density', e.target.value)}
                placeholder="e.g., 7850"
                helperText="Required for weight calculations"
                InputProps={{
                  endAdornment: (
                    <Select
                      value={formData.densityUnit}
                      onChange={(e) => handleChange('densityUnit', e.target.value)}
                      variant="standard"
                      sx={{ ml: 1 }}
                    >
                      <MenuItem value="kg/m3">kg/m³</MenuItem>
                      <MenuItem value="g/cm3">g/cm³</MenuItem>
                    </Select>
                  ),
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Base Unit"
                value={formData.baseUnit}
                onChange={(e) => handleChange('baseUnit', e.target.value)}
                placeholder="kg"
                helperText="Unit for pricing and quantity"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Tensile Strength (Optional)"
                value={formData.tensileStrength}
                onChange={(e) => handleChange('tensileStrength', e.target.value)}
                placeholder="e.g., 485"
                helperText="MPa (optional)"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Yield Strength (Optional)"
                value={formData.yieldStrength}
                onChange={(e) => handleChange('yieldStrength', e.target.value)}
                placeholder="e.g., 260"
                helperText="MPa (optional)"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Max Operating Temperature (Optional)"
                value={formData.maxOperatingTemp}
                onChange={(e) => handleChange('maxOperatingTemp', e.target.value)}
                placeholder="e.g., 650"
                helperText="°C (optional)"
              />
            </Grid>
          </Grid>

          {/* Organization */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Organization & Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Add Tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Type and press Enter to add tags"
              helperText="Tags help with searching and organization"
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {formData.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  onDelete={() => handleDeleteTag(tag)}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>

          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isStandard}
                  onChange={(e) => handleChange('isStandard', e.target.checked)}
                />
              }
              label="Mark as Standard Material"
            />
          </Box>

          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.trackInventory}
                  onChange={(e) => handleChange('trackInventory', e.target.checked)}
                />
              }
              label="Enable Inventory Tracking"
            />
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => router.push(`/materials/${materialId}`)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSubmit}
              disabled={saving || !formData.name || !formData.description || !formData.baseUnit}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}
