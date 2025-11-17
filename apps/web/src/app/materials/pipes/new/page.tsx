'use client';

import { useState } from 'react';
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
  Radio,
  RadioGroup,
  Divider,
  Stack,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Breadcrumbs,
  Link,
  FormLabel,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { MaterialCategory, MaterialType, Material, MATERIAL_CATEGORY_LABELS } from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { createMaterial } from '@/lib/materials/materialService';

const PIPE_CATEGORIES = [
  MaterialCategory.PIPES_CARBON_STEEL,
  MaterialCategory.PIPES_STAINLESS_304L,
  MaterialCategory.PIPES_STAINLESS_316L,
];

// Common pipe schedules
const PIPE_SCHEDULES = ['Sch 10', 'Sch 40', 'Sch 80', 'Sch 160'];

// Construction types
const CONSTRUCTION_TYPES = ['Seamless', 'Welded'];

export default function NewPipeMaterialPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { db } = getFirebase();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '' as MaterialCategory | '',
    materialType: 'RAW_MATERIAL' as MaterialType,
    customCode: '',

    // Pipe Specification
    standard: '',
    grade: '',
    schedule: '',
    constructionType: '',
    nominalSize: '',

    // Pipe Properties
    density: '',
    densityUnit: 'kg/m3' as 'kg/m3' | 'g/cm3',
    tensileStrength: '',
    yieldStrength: '',
    elongation: '',
    maxOperatingTemp: '',

    // Units
    baseUnit: 'meter', // Default to meter for pipes

    // Organization
    tags: [] as string[],
    isStandard: false,
    trackInventory: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');

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

  // Auto-populate based on category selection
  const handleCategoryChange = (category: MaterialCategory) => {
    handleChange('category', category);

    // Auto-populate standard and grade based on category
    if (category === MaterialCategory.PIPES_CARBON_STEEL) {
      setFormData((prev) => ({
        ...prev,
        category,
        standard: 'ASTM A106',
        grade: 'Grade B',
        density: '7850',
      }));
    } else if (category === MaterialCategory.PIPES_STAINLESS_304L) {
      setFormData((prev) => ({
        ...prev,
        category,
        standard: 'ASTM A312',
        grade: '304L',
        density: '8000',
      }));
    } else if (category === MaterialCategory.PIPES_STAINLESS_316L) {
      setFormData((prev) => ({
        ...prev,
        category,
        standard: 'ASTM A312',
        grade: '316L',
        density: '8000',
      }));
    }
  };

  // Validate and submit
  const handleSubmit = async () => {
    if (!db || !user) return;

    try {
      setLoading(true);
      setError(null);

      // Build tags including construction type
      const allTags = [...formData.tags];
      if (formData.constructionType && !allTags.includes(formData.constructionType.toLowerCase())) {
        allTags.push(formData.constructionType.toLowerCase());
      }

      // Build material object
      const materialData: Omit<
        Material,
        'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
      > = {
        materialCode: '', // Will be auto-generated
        name: formData.name,
        description: formData.description,
        category: formData.category as MaterialCategory,
        materialType: formData.materialType,
        customCode: formData.customCode || undefined,

        specification: {
          standard: formData.standard || undefined,
          grade: formData.grade || undefined,
          schedule: formData.schedule || undefined,
          form: formData.constructionType || undefined,
          nominalSize: formData.nominalSize || undefined,
        },

        properties: {
          density: formData.density ? parseFloat(formData.density) : undefined,
          densityUnit: formData.densityUnit,
          tensileStrength: formData.tensileStrength
            ? parseFloat(formData.tensileStrength)
            : undefined,
          yieldStrength: formData.yieldStrength ? parseFloat(formData.yieldStrength) : undefined,
          elongation: formData.elongation ? parseFloat(formData.elongation) : undefined,
          maxOperatingTemp: formData.maxOperatingTemp
            ? parseFloat(formData.maxOperatingTemp)
            : undefined,
        },

        baseUnit: formData.baseUnit,
        tags: allTags,
        isStandard: formData.isStandard,
        trackInventory: formData.trackInventory,
        hasVariants: false,

        preferredVendors: [],
        priceHistory: [],
        certifications: [],
        isActive: true,
      };

      // Create material
      const created = await createMaterial(db, materialData, user.uid);

      // Navigate to pipes list or material detail
      router.push(`/materials/${created.id}`);
    } catch (err) {
      console.error('Error creating pipe material:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create pipe material. Please check all required fields.');
      }
    } finally {
      setLoading(false);
    }
  };

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
          href="/materials/pipes"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/materials/pipes');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Pipes
        </Link>
        <Typography color="text.primary">New Pipe</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/materials/pipes')}>
          Back to Pipes
        </Button>
        <Box>
          <Typography variant="h4" component="h1">
            New Pipe Material
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add a new pipe material with ASTM schedule specifications
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

          <Box>
            <TextField
              fullWidth
              required
              label="Material Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Carbon Steel A106 Grade B Seamless Pipe"
              helperText="Example: Carbon Steel A106 Seamless Pipe, SS 316L Welded Pipe"
            />
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Custom Code"
              value={formData.customCode}
              onChange={(e) => handleChange('customCode', e.target.value)}
              placeholder="e.g., CS-SMLS-SCH40"
              helperText="Optional short code for internal reference"
            />
          </Box>

          <Box>
            <TextField
              fullWidth
              required
              multiline
              rows={3}
              label="Description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Detailed description including typical applications, pressure ratings, and key properties..."
              helperText="Describe the pipe's uses, properties, and typical applications (minimum 10 characters)"
            />
          </Box>

          {/* Pipe Material Type */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Pipe Material & Grade
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Select the pipe material based on ASTM standards
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Box>

          <FormControl component="fieldset" required fullWidth>
            <RadioGroup
              value={formData.category}
              onChange={(e) => handleCategoryChange(e.target.value as MaterialCategory)}
            >
              <Grid container spacing={2}>
                {PIPE_CATEGORIES.map((category) => (
                  <Grid key={category} size={{ xs: 12, sm: 4 }}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderColor: formData.category === category ? 'primary.main' : 'divider',
                        borderWidth: formData.category === category ? 2 : 1,
                        bgcolor:
                          formData.category === category ? 'action.selected' : 'background.paper',
                      }}
                    >
                      <CardActionArea onClick={() => handleCategoryChange(category)}>
                        <CardContent>
                          <FormControlLabel
                            value={category}
                            control={<Radio />}
                            label={
                              <Box>
                                <Typography variant="body1" fontWeight="medium">
                                  {MATERIAL_CATEGORY_LABELS[category].replace(/^Pipes - /, '')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {category === MaterialCategory.PIPES_CARBON_STEEL &&
                                    'ASTM A106, A53'}
                                  {category === MaterialCategory.PIPES_STAINLESS_304L &&
                                    'ASTM A312'}
                                  {category === MaterialCategory.PIPES_STAINLESS_316L &&
                                    'ASTM A312'}
                                </Typography>
                              </Box>
                            }
                            sx={{ m: 0, width: '100%' }}
                          />
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </RadioGroup>
          </FormControl>

          {/* Pipe Specification */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Pipe Specification
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Enter the ASTM standard, schedule, and construction details
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
                placeholder="e.g., ASTM A106"
                helperText="ASTM standard (auto-filled based on material)"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Grade"
                value={formData.grade}
                onChange={(e) => handleChange('grade', e.target.value)}
                placeholder="e.g., Grade B, 304L, 316L"
                helperText="Material grade (auto-filled)"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <FormLabel>Schedule (ASTM)</FormLabel>
                <Select
                  value={formData.schedule}
                  onChange={(e) => handleChange('schedule', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>Select Schedule</em>
                  </MenuItem>
                  {PIPE_SCHEDULES.map((schedule) => (
                    <MenuItem key={schedule} value={schedule}>
                      {schedule}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <FormLabel>Construction Type</FormLabel>
                <Select
                  value={formData.constructionType}
                  onChange={(e) => handleChange('constructionType', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>Select Construction Type</em>
                  </MenuItem>
                  {CONSTRUCTION_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Nominal Size"
                value={formData.nominalSize}
                onChange={(e) => handleChange('nominalSize', e.target.value)}
                placeholder="e.g., DN 50, NPS 2"
                helperText="Nominal pipe size (DN or NPS)"
              />
            </Grid>
          </Grid>

          {/* Material Properties */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Material Properties
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Enter the mechanical and physical properties
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
                helperText="Auto-filled based on material"
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
                placeholder="meter"
                helperText="Unit for pricing (default: meter)"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Tensile Strength (MPa)"
                value={formData.tensileStrength}
                onChange={(e) => handleChange('tensileStrength', e.target.value)}
                placeholder="e.g., 415"
                helperText="Ultimate tensile strength"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Yield Strength (MPa)"
                value={formData.yieldStrength}
                onChange={(e) => handleChange('yieldStrength', e.target.value)}
                placeholder="e.g., 240"
                helperText="Minimum yield strength"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Elongation (%)"
                value={formData.elongation}
                onChange={(e) => handleChange('elongation', e.target.value)}
                placeholder="e.g., 30"
                helperText="Elongation at break"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Max Operating Temperature (°C)"
                value={formData.maxOperatingTemp}
                onChange={(e) => handleChange('maxOperatingTemp', e.target.value)}
                placeholder="e.g., 400"
                helperText="Maximum operating temperature"
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
              placeholder="Type and press Enter (e.g., high-pressure, oil-gas)"
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
              onClick={() => router.push('/materials/pipes')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSubmit}
              disabled={
                loading ||
                !formData.name ||
                !formData.description ||
                !formData.category ||
                !formData.baseUnit
              }
            >
              {loading ? 'Creating...' : 'Create Pipe Material'}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}
