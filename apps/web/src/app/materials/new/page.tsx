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
  InputLabel,
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
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import {
  MaterialCategory,
  MaterialType,
  Material,
  MATERIAL_CATEGORY_LABELS,
  MATERIAL_CATEGORY_GROUPS,
} from '@vapour/types';
import { useAuth } from '@/contexts/AuthContext';
import { createMaterial } from '@/lib/materials/materialService';

export default function NewMaterialPage() {
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

    // Specification
    standard: '',
    grade: '',
    finish: '',
    form: '',
    schedule: '',
    nominalSize: '',

    // Properties
    density: '',
    densityUnit: 'kg/m3' as 'kg/m3' | 'g/cm3',

    // Units
    baseUnit: '',

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
        materialCode: '', // Will be auto-generated
        name: formData.name,
        description: formData.description,
        category: formData.category as MaterialCategory,
        materialType: formData.materialType,
        customCode: formData.customCode || undefined,

        specification: {
          standard: formData.standard || undefined,
          grade: formData.grade || undefined,
          finish: formData.finish || undefined,
          form: formData.form || undefined,
          schedule: formData.schedule || undefined,
          nominalSize: formData.nominalSize || undefined,
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

      // Navigate to material detail
      router.push(`/materials/${created.id}`);
    } catch (err) {
      console.error('Error creating material:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create material. Please check all required fields.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()}>
          Back
        </Button>
        <Box>
          <Typography variant="h4" component="h1">
            New Material
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add a new material to the database
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
              placeholder="e.g., Stainless Steel 316L Plate"
              helperText="Descriptive name for the material"
            />
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Custom Code"
              value={formData.customCode}
              onChange={(e) => handleChange('customCode', e.target.value)}
              placeholder="e.g., SS316-PL"
              helperText="Optional short code"
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
              placeholder="Detailed description of the material, its properties, and typical uses..."
              helperText="Minimum 10 characters"
            />
          </Box>

          {/* Classification */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Plate Category
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Select the plate material category
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Box>

          <FormControl component="fieldset" required fullWidth>
            <RadioGroup
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
            >
              <Grid container spacing={2}>
                {MATERIAL_CATEGORY_GROUPS['Raw Materials - Plates']?.map((category) => (
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
                      <CardActionArea onClick={() => handleChange('category', category)}>
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

          <Box>
            <FormControl fullWidth required>
              <InputLabel>Material Type</InputLabel>
              <Select
                value={formData.materialType}
                onChange={(e) => handleChange('materialType', e.target.value as MaterialType)}
                label="Material Type"
              >
                <MenuItem value="RAW_MATERIAL">Raw Material</MenuItem>
                <MenuItem value="BOUGHT_OUT_COMPONENT">Bought-Out Component</MenuItem>
                <MenuItem value="CONSUMABLE">Consumable</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* ASME/ASTM Specification */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              ASME/ASTM Specification
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Standard"
              value={formData.standard}
              onChange={(e) => handleChange('standard', e.target.value)}
              placeholder="e.g., ASTM A240"
              helperText="ASME/ASTM standard"
            />
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Grade"
              value={formData.grade}
              onChange={(e) => handleChange('grade', e.target.value)}
              placeholder="e.g., 316L"
              helperText="Material grade"
            />
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Finish"
              value={formData.finish}
              onChange={(e) => handleChange('finish', e.target.value)}
              placeholder="e.g., 2B"
              helperText="Surface finish"
            />
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Form"
              value={formData.form}
              onChange={(e) => handleChange('form', e.target.value)}
              placeholder="e.g., Plate"
              helperText="Material form"
            />
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Schedule"
              value={formData.schedule}
              onChange={(e) => handleChange('schedule', e.target.value)}
              placeholder="e.g., Sch 40"
              helperText="Pipe schedule (if applicable)"
            />
          </Box>

          <Box>
            <TextField
              fullWidth
              label="Nominal Size"
              value={formData.nominalSize}
              onChange={(e) => handleChange('nominalSize', e.target.value)}
              placeholder="e.g., DN 50"
              helperText="Nominal diameter/size"
            />
          </Box>

          {/* Material Properties */}
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Material Properties
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Box>

          <Box>
            <TextField
              fullWidth
              type="number"
              label="Density"
              value={formData.density}
              onChange={(e) => handleChange('density', e.target.value)}
              placeholder="e.g., 8000"
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
          </Box>

          <Box>
            <TextField
              fullWidth
              required
              label="Base Unit"
              value={formData.baseUnit}
              onChange={(e) => handleChange('baseUnit', e.target.value)}
              placeholder="e.g., kg, nos, meter"
              helperText="Unit for pricing and quantity"
            />
          </Box>

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
            <Button variant="outlined" onClick={() => router.back()} disabled={loading}>
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
              {loading ? 'Creating...' : 'Create Material'}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}
