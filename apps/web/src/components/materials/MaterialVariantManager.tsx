'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  FormControlLabel,
  Switch,
  Alert,
  IconButton,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import type { Material, MaterialVariant } from '@vapour/types';
import MaterialVariantList from './MaterialVariantList';
import { generateVariantCode } from '@/lib/materials/variantUtils';

interface MaterialVariantManagerProps {
  material: Material;
  onVariantsChange: (variants: MaterialVariant[]) => void;
  readOnly?: boolean;
}

interface VariantFormData {
  variantCode: string;
  displayName: string;
  thickness?: number;
  length?: number;
  width?: number;
  schedule?: string;
  nominalSize?: string;
  weightPerUnit?: number;
  leadTimeDays?: number;
  minimumOrderQuantity?: number;
  isAvailable: boolean;
}

/**
 * Material Variant Manager Component
 *
 * Manages variants for a material - add, edit, delete.
 * Used on material creation/edit pages.
 */
export default function MaterialVariantManager({
  material,
  onVariantsChange,
  readOnly = false,
}: MaterialVariantManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<MaterialVariant | null>(null);
  const [formData, setFormData] = useState<VariantFormData>(getEmptyFormData());

  const variants = material.variants || [];

  function getEmptyFormData(): VariantFormData {
    return {
      variantCode: '',
      displayName: '',
      isAvailable: true,
    };
  }

  function resetForm() {
    setFormData(getEmptyFormData());
    setEditingVariant(null);
  }

  const handleOpenDialog = (variant?: MaterialVariant) => {
    if (variant) {
      setEditingVariant(variant);
      setFormData({
        variantCode: variant.variantCode,
        displayName: variant.displayName,
        thickness: variant.dimensions.thickness,
        length: variant.dimensions.length,
        width: variant.dimensions.width,
        schedule: variant.dimensions.schedule,
        nominalSize: variant.dimensions.nominalSize,
        weightPerUnit: variant.weightPerUnit,
        leadTimeDays: variant.leadTimeDays,
        minimumOrderQuantity: variant.minimumOrderQuantity,
        isAvailable: variant.isAvailable,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSaveVariant = () => {
    const now = new Date();
    const timestamp = { seconds: Math.floor(now.getTime() / 1000), nanoseconds: 0 };

    const newVariant: MaterialVariant = {
      id: editingVariant?.id || `var_${Date.now()}`,
      variantCode: formData.variantCode,
      displayName: formData.displayName,
      dimensions: {
        thickness: formData.thickness,
        length: formData.length,
        width: formData.width,
        schedule: formData.schedule,
        nominalSize: formData.nominalSize,
      },
      weightPerUnit: formData.weightPerUnit,
      leadTimeDays: formData.leadTimeDays,
      minimumOrderQuantity: formData.minimumOrderQuantity,
      priceHistory: editingVariant?.priceHistory || [],
      isAvailable: formData.isAvailable,
      createdAt: editingVariant?.createdAt || timestamp,
      updatedAt: timestamp,
      createdBy: editingVariant?.createdBy || 'current-user', // TODO: Get from auth
      updatedBy: 'current-user', // TODO: Get from auth
    };

    let updatedVariants: MaterialVariant[];
    if (editingVariant) {
      // Update existing variant
      updatedVariants = variants.map((v) => (v.id === editingVariant.id ? newVariant : v));
    } else {
      // Add new variant
      updatedVariants = [...variants, newVariant];
    }

    onVariantsChange(updatedVariants);
    handleCloseDialog();
  };

  const handleDeleteVariant = (variantId: string) => {
    if (confirm('Are you sure you want to delete this variant?')) {
      const updatedVariants = variants.filter((v) => v.id !== variantId);
      onVariantsChange(updatedVariants);
    }
  };

  const handleDuplicateVariant = (variant: MaterialVariant) => {
    const now = new Date();
    const timestamp = { seconds: Math.floor(now.getTime() / 1000), nanoseconds: 0 };

    const duplicatedVariant: MaterialVariant = {
      ...variant,
      id: `var_${Date.now()}`,
      variantCode: `${variant.variantCode}_COPY`,
      displayName: `${variant.displayName} (Copy)`,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: 'current-user', // TODO: Get from auth
      updatedBy: 'current-user', // TODO: Get from auth
    };

    onVariantsChange([...variants, duplicatedVariant]);
  };

  const isFormValid = formData.variantCode.trim() !== '' && formData.displayName.trim() !== '';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Material Variants</Typography>
        {!readOnly && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={!material.materialCode}
          >
            Add Variant
          </Button>
        )}
      </Box>

      {!material.materialCode && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Save the material first to add variants
        </Alert>
      )}

      {/* Info Alert */}
      {material.materialCode && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Base Material Code: <strong>{material.materialCode}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Variants will use codes like: {material.materialCode}-3thk-2B, {material.materialCode}
            -5thk-2B, etc.
          </Typography>
        </Alert>
      )}

      {/* Variants List/Table */}
      {variants.length > 0 ? (
        <Box>
          <MaterialVariantList material={material} showPricing={false} compact />

          {/* Action Buttons for Each Variant */}
          {!readOnly && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Manage Variants
              </Typography>
              <Stack spacing={1}>
                {variants.map((variant) => (
                  <Box
                    key={variant.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {variant.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                        {generateVariantCode(material.materialCode, variant)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(variant)}
                        title="Edit variant"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDuplicateVariant(variant)}
                        title="Duplicate variant"
                      >
                        <CopyIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteVariant(variant.id)}
                        title="Delete variant"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      ) : (
        <Alert severity="info">
          No variants defined. Add variants to specify different thicknesses, finishes, or sizes for
          this material.
        </Alert>
      )}

      {/* Variant Form Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingVariant ? 'Edit Variant' : 'Add Variant'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {/* Variant Code */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Variant Code"
                value={formData.variantCode}
                onChange={(e) => setFormData({ ...formData, variantCode: e.target.value })}
                placeholder="e.g., 2B, BA, NO1"
                helperText="Short code for this variant (finish, size, etc.)"
              />
            </Grid>

            {/* Display Name */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Display Name"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="e.g., 2B Finish, Bright Annealed"
                helperText="Human-readable name"
              />
            </Grid>

            {/* Dimensions Section */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Dimensions
              </Typography>
            </Grid>

            {/* Thickness */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Thickness (mm)"
                type="number"
                value={formData.thickness || ''}
                onChange={(e) =>
                  setFormData({ ...formData, thickness: parseFloat(e.target.value) || undefined })
                }
                inputProps={{ step: 0.1, min: 0 }}
              />
            </Grid>

            {/* Length */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Length (mm)"
                type="number"
                value={formData.length || ''}
                onChange={(e) =>
                  setFormData({ ...formData, length: parseFloat(e.target.value) || undefined })
                }
                inputProps={{ step: 1, min: 0 }}
              />
            </Grid>

            {/* Width */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Width (mm)"
                type="number"
                value={formData.width || ''}
                onChange={(e) =>
                  setFormData({ ...formData, width: parseFloat(e.target.value) || undefined })
                }
                inputProps={{ step: 1, min: 0 }}
              />
            </Grid>

            {/* Schedule (for pipes) */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Schedule (for pipes)"
                value={formData.schedule || ''}
                onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                placeholder="e.g., Sch 40, Sch 80"
              />
            </Grid>

            {/* Nominal Size (for pipes/fittings) */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nominal Size (DN/NPS)"
                value={formData.nominalSize || ''}
                onChange={(e) => setFormData({ ...formData, nominalSize: e.target.value })}
                placeholder="e.g., DN 50, NPS 2"
              />
            </Grid>

            {/* Properties Section */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Properties & Procurement
              </Typography>
            </Grid>

            {/* Weight per Unit */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label={`Weight per ${material.baseUnit}`}
                type="number"
                value={formData.weightPerUnit || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    weightPerUnit: parseFloat(e.target.value) || undefined,
                  })
                }
                inputProps={{ step: 0.01, min: 0 }}
                helperText="kg/m² for plates, kg/m for pipes"
              />
            </Grid>

            {/* Lead Time */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Lead Time (days)"
                type="number"
                value={formData.leadTimeDays || ''}
                onChange={(e) =>
                  setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) || undefined })
                }
                inputProps={{ step: 1, min: 0 }}
              />
            </Grid>

            {/* Minimum Order Quantity */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label={`Min. Order Qty (${material.baseUnit})`}
                type="number"
                value={formData.minimumOrderQuantity || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    minimumOrderQuantity: parseFloat(e.target.value) || undefined,
                  })
                }
                inputProps={{ step: 1, min: 0 }}
              />
            </Grid>

            {/* Availability */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isAvailable}
                    onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                  />
                }
                label="Available for ordering"
              />
            </Grid>

            {/* Preview Full Code */}
            {material.materialCode && formData.variantCode && (
              <Grid item xs={12}>
                <Alert severity="success">
                  <Typography variant="body2">
                    Full Specification Code:{' '}
                    <strong>
                      {generateVariantCode(material.materialCode, {
                        ...formData,
                        id: 'preview',
                        priceHistory: [],
                        dimensions: {
                          thickness: formData.thickness,
                          length: formData.length,
                          width: formData.width,
                          schedule: formData.schedule,
                          nominalSize: formData.nominalSize,
                        },
                        createdAt: { seconds: 0, nanoseconds: 0 },
                        updatedAt: { seconds: 0, nanoseconds: 0 },
                        createdBy: '',
                        updatedBy: '',
                      } as MaterialVariant)}
                    </strong>
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveVariant} disabled={!isFormValid}>
            {editingVariant ? 'Update' : 'Add'} Variant
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
