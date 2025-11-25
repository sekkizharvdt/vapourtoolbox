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
  InputLabel,
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

const PLATE_CATEGORIES = [
  MaterialCategory.PLATES_CARBON_STEEL,
  MaterialCategory.PLATES_STAINLESS_STEEL,
  MaterialCategory.PLATES_DUPLEX_STEEL,
  MaterialCategory.PLATES_ALLOY_STEEL,
];

// Common grades by category
const COMMON_GRADES: Record<string, string[]> = {
  [MaterialCategory.PLATES_CARBON_STEEL]: ['A36', 'A516 Gr 60', 'A516 Gr 70', 'A285 Gr C'],
  [MaterialCategory.PLATES_STAINLESS_STEEL]: ['304', '304L', '316', '316L', '321', '310S'],
  [MaterialCategory.PLATES_DUPLEX_STEEL]: ['2205', '2507', 'S31803', 'S32750'],
  [MaterialCategory.PLATES_ALLOY_STEEL]: ['P11', 'P22', 'P91', 'P5', 'P9'],
};

// Common finishes for plates
const COMMON_FINISHES = ['2B', 'BA', 'No. 4', 'No. 8', 'HL (Hairline)', 'Hot Rolled', 'Pickled'];

// Category metadata for auto-population
const CATEGORY_METADATA: Record<
  string,
  { standard: string; defaultGrade: string; density: string; form: string }
> = {
  [MaterialCategory.PLATES_CARBON_STEEL]: {
    standard: 'ASTM A36',
    defaultGrade: 'A36',
    density: '7850',
    form: 'Plate',
  },
  [MaterialCategory.PLATES_STAINLESS_STEEL]: {
    standard: 'ASTM A240',
    defaultGrade: '316L',
    density: '8000',
    form: 'Plate',
  },
  [MaterialCategory.PLATES_DUPLEX_STEEL]: {
    standard: 'ASTM A240',
    defaultGrade: '2205',
    density: '7800',
    form: 'Plate',
  },
  [MaterialCategory.PLATES_ALLOY_STEEL]: {
    standard: 'ASTM A387',
    defaultGrade: 'P11',
    density: '7850',
    form: 'Plate',
  },
};

export default function NewPlateMaterialPage() {
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

    // Plate Specification
    standard: '',
    grade: '',
    finish: '',
    form: 'Plate', // Default to Plate

    // Plate Properties
    density: '',
    densityUnit: 'kg/m3' as 'kg/m3' | 'g/cm3',

    // Units
    baseUnit: 'kg', // Default to kg for plates

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
    const metadata = CATEGORY_METADATA[category];
    if (metadata) {
      setFormData((prev) => ({
        ...prev,
        category,
        standard: metadata.standard,
        grade: metadata.defaultGrade,
        density: metadata.density,
        form: metadata.form,
        // Auto-generate name based on selection
        name: generateMaterialName(metadata.standard, metadata.defaultGrade, metadata.form),
      }));
    } else {
      handleChange('category', category);
    }
  };

  // Auto-generate material name from specification
  const generateMaterialName = (standard?: string, grade?: string, form?: string): string => {
    const parts: string[] = [];
    if (standard) parts.push(standard);
    if (grade) parts.push(grade);
    if (form) parts.push(form);
    return parts.join(' ') || '';
  };

  // Update material name when specification changes
  const handleSpecChange = (field: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-update name if user hasn't manually changed it
      const autoGeneratedName = generateMaterialName(updated.standard, updated.grade, updated.form);
      return {
        ...updated,
        name: autoGeneratedName || prev.name, // Keep existing name if auto-gen is empty
      };
    });
    setError(null);
  };

  // Validate and submit
  const handleSubmit = async () => {
    if (!db || !user) return;

    try {
      setLoading(true);
      setError(null);

      // Build material object
      const materialData: Omit<
        Material,
        'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
      > = {
        materialCode: formData.customCode || '', // Use custom code if provided, otherwise will be auto-generated
        name: formData.name,
        description: formData.description,
        category: formData.category as MaterialCategory,
        materialType: formData.materialType,
        ...(formData.customCode && { customCode: formData.customCode }),

        specification: {
          ...(formData.standard && { standard: formData.standard }),
          ...(formData.grade && { grade: formData.grade }),
          ...(formData.finish && { finish: formData.finish }),
          form: formData.form,
        },

        properties: {
          density: formData.density ? parseFloat(formData.density) : undefined,
          densityUnit: formData.densityUnit,
        },

        baseUnit: formData.baseUnit,
        tags: formData.tags,
        isStandard: formData.isStandard,
        trackInventory: formData.trackInventory,
        hasVariants: false,

        preferredVendors: [],
        priceHistory: [],
        certifications: [],
        isActive: true,
      };

      // Create material (service will validate)
      const created = await createMaterial(db, materialData, user.uid);

      // Navigate to plates list or material detail
      router.push(`/materials/${created.id}`);
    } catch (err) {
      console.error('Error creating plate material:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create plate material. Please check all required fields.');
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
          href="/materials/plates"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/materials/plates');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Plates
        </Link>
        <Typography color="text.primary">New Plate</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/materials/plates')}>
          Back to Plates
        </Button>
        <Box>
          <Typography variant="h4" component="h1">
            New Plate Material
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add a new plate material with ASME/ASTM specifications
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
              placeholder="Auto-generated from specification"
              helperText="Auto-generated from standard, grade, and form. You can edit this if needed."
            />
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Custom Code"
              value={formData.customCode}
              onChange={(e) => handleChange('customCode', e.target.value)}
              placeholder="e.g., SS316-PL"
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
              placeholder="Detailed description including typical applications, advantages, and key properties..."
              helperText="Describe the material's uses, properties, and typical applications (minimum 10 characters)"
            />
          </Box>

          {/* Plate Category */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Plate Material Type
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Select the plate material category based on ASME/ASTM standards
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Box>

          <FormControl component="fieldset" required fullWidth>
            <RadioGroup
              value={formData.category}
              onChange={(e) => handleCategoryChange(e.target.value as MaterialCategory)}
            >
              <Grid container spacing={2}>
                {PLATE_CATEGORIES.map((category) => (
                  <Grid key={category} size={{ xs: 12, sm: 6 }}>
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
                                  {MATERIAL_CATEGORY_LABELS[category].replace(/^Plates - /, '')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {category === MaterialCategory.PLATES_CARBON_STEEL &&
                                    'ASTM A36, A516, A285'}
                                  {category === MaterialCategory.PLATES_STAINLESS_STEEL &&
                                    'ASTM A240: 304, 316, 316L, 321'}
                                  {category === MaterialCategory.PLATES_DUPLEX_STEEL &&
                                    'ASTM A240: 2205, 2507'}
                                  {category === MaterialCategory.PLATES_ALLOY_STEEL &&
                                    'ASTM A387: P11, P22, P91'}
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

          {/* ASME/ASTM Specification */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              ASME/ASTM Specification
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Enter the standard specification details for the plate material
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Standard"
                value={formData.standard}
                onChange={(e) => handleSpecChange('standard', e.target.value)}
                placeholder="e.g., ASTM A240"
                helperText="ASME/ASTM standard (auto-filled)"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Grade</InputLabel>
                <Select
                  value={formData.grade}
                  onChange={(e) => handleSpecChange('grade', e.target.value)}
                  label="Grade"
                  displayEmpty
                >
                  <MenuItem value="" disabled>
                    Select Grade
                  </MenuItem>
                  {formData.category &&
                    COMMON_GRADES[formData.category]?.map((grade) => (
                      <MenuItem key={grade} value={grade}>
                        {grade}
                      </MenuItem>
                    ))}
                  <MenuItem value="__custom__" disabled sx={{ fontStyle: 'italic' }}>
                    --- Or enter custom grade below ---
                  </MenuItem>
                </Select>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Or enter custom grade"
                  value={
                    formData.category && COMMON_GRADES[formData.category]?.includes(formData.grade)
                      ? ''
                      : formData.grade
                  }
                  onChange={(e) => handleSpecChange('grade', e.target.value)}
                  sx={{ mt: 1 }}
                  helperText="Material grade (select from dropdown or enter custom)"
                />
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Finish</InputLabel>
                <Select
                  value={formData.finish}
                  onChange={(e) => handleSpecChange('finish', e.target.value)}
                  label="Finish"
                  displayEmpty
                >
                  <MenuItem value="">No Finish Specified</MenuItem>
                  {COMMON_FINISHES.map((finish) => (
                    <MenuItem key={finish} value={finish}>
                      {finish}
                    </MenuItem>
                  ))}
                  <MenuItem value="__custom__" disabled sx={{ fontStyle: 'italic' }}>
                    --- Or enter custom finish below ---
                  </MenuItem>
                </Select>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Or enter custom finish"
                  value={COMMON_FINISHES.includes(formData.finish) ? '' : formData.finish}
                  onChange={(e) => handleSpecChange('finish', e.target.value)}
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
                onChange={(e) => handleSpecChange('form', e.target.value)}
                placeholder="Plate"
                helperText="Material form (auto-filled as Plate)"
              />
            </Grid>
          </Grid>

          {/* Material Properties */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Material Properties
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Enter the physical properties for weight calculations
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
                helperText="Unit for pricing and quantity (default: kg)"
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
              placeholder="Type and press Enter to add tags (e.g., stainless-steel, pressure-vessel)"
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
              onClick={() => router.push('/materials/plates')}
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
              {loading ? 'Creating...' : 'Create Plate Material'}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}
