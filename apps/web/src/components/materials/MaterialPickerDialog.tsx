'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Stack,
  Divider,
} from '@mui/material';
import { Search as SearchIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import type { Material, MaterialVariant, MaterialCategory } from '@vapour/types';
import { MATERIAL_CATEGORY_LABELS } from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import { queryMaterials } from '@/lib/materials/materialService';
import MaterialVariantSelector from './MaterialVariantSelector';
import { hasVariants } from '@/lib/materials/variantUtils';

interface MaterialPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (material: Material, variant?: MaterialVariant, fullCode?: string) => void;
  title?: string;
  categories?: MaterialCategory[];
  requireVariantSelection?: boolean;
}

/**
 * Material Picker Dialog
 *
 * A dialog for searching and selecting materials with variant support.
 * Users can:
 * 1. Search for materials by name, code, or specification
 * 2. Filter by category
 * 3. Select a material
 * 4. Choose a specific variant (if applicable)
 * 5. Confirm selection with full specification code
 */
export default function MaterialPickerDialog({
  open,
  onClose,
  onSelect,
  title = 'Select Material',
  categories,
  requireVariantSelection = true,
}: MaterialPickerDialogProps) {
  const { db } = getFirebase();

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'ALL'>('ALL');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MaterialVariant | null>(null);
  const [selectedFullCode, setSelectedFullCode] = useState<string>('');

  const loadMaterials = useCallback(async () => {
    if (!db) return;

    try {
      setLoading(true);
      setError(null);

      const categoriesToQuery =
        selectedCategory === 'ALL' && categories
          ? categories
          : selectedCategory === 'ALL'
            ? undefined
            : [selectedCategory];

      const result = await queryMaterials(db, {
        categories: categoriesToQuery,
        isActive: true,
        sortField: 'materialCode',
        sortDirection: 'asc',
        limitResults: 100,
      });

      setMaterials(result.materials);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, [db, selectedCategory, categories]);

  // Load materials on open
  useEffect(() => {
    if (open && db) {
      loadMaterials();
    }
  }, [open, db, loadMaterials]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedMaterial(null);
      setSelectedVariant(null);
      setSelectedFullCode('');
      setSearchText('');
    }
  }, [open]);

  // Filter materials by search text
  const filteredMaterials = useMemo(() => {
    if (!searchText.trim()) return materials;

    const searchLower = searchText.toLowerCase();
    return materials.filter(
      (material) =>
        material.name.toLowerCase().includes(searchLower) ||
        material.materialCode.toLowerCase().includes(searchLower) ||
        material.description?.toLowerCase().includes(searchLower) ||
        material.specification?.standard?.toLowerCase().includes(searchLower) ||
        material.specification?.grade?.toLowerCase().includes(searchLower)
    );
  }, [materials, searchText]);

  // Get unique categories from filtered materials
  const availableCategories = useMemo(() => {
    if (categories) return categories;
    return Array.from(new Set(materials.map((m) => m.category)));
  }, [materials, categories]);

  // Handle material selection
  const handleMaterialSelect = (material: Material) => {
    setSelectedMaterial(material);
    setSelectedVariant(null);
    setSelectedFullCode(material.materialCode);
  };

  // Handle variant selection
  const handleVariantSelect = (variant: MaterialVariant | null, fullCode: string) => {
    setSelectedVariant(variant);
    setSelectedFullCode(fullCode);
  };

  // Handle confirm
  const handleConfirm = () => {
    if (!selectedMaterial) return;

    // If material has variants and requireVariantSelection is true, ensure variant is selected
    if (requireVariantSelection && hasVariants(selectedMaterial) && !selectedVariant) {
      setError('Please select a variant');
      return;
    }

    onSelect(selectedMaterial, selectedVariant || undefined, selectedFullCode);
    onClose();
  };

  // Can confirm?
  const canConfirm =
    selectedMaterial &&
    (!requireVariantSelection || !hasVariants(selectedMaterial) || selectedVariant);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {/* Search */}
        <TextField
          fullWidth
          placeholder="Search materials by code, name, or specification..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* Category Tabs */}
        {availableCategories.length > 1 && (
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={selectedCategory}
              onChange={(_, value) => setSelectedCategory(value)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="All" value="ALL" />
              {availableCategories.map((category) => (
                <Tab
                  key={category}
                  label={MATERIAL_CATEGORY_LABELS[category].replace(/^.*? - /, '')}
                  value={category}
                />
              ))}
            </Tabs>
          </Box>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Two-Column Layout: Materials List + Variant Selector */}
        <Box sx={{ display: 'flex', gap: 2, minHeight: 400 }}>
          {/* Left: Materials List */}
          <Box sx={{ flex: 1, borderRight: 1, borderColor: 'divider', pr: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Materials ({filteredMaterials.length})
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : filteredMaterials.length === 0 ? (
              <Alert severity="info">
                {searchText ? 'No materials found matching your search' : 'No materials available'}
              </Alert>
            ) : (
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {filteredMaterials.map((material) => (
                  <ListItem key={material.id} disablePadding>
                    <ListItemButton
                      selected={selectedMaterial?.id === material.id}
                      onClick={() => handleMaterialSelect(material)}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight="medium">
                              {material.materialCode}
                            </Typography>
                            {selectedMaterial?.id === material.id && (
                              <CheckCircleIcon color="primary" fontSize="small" />
                            )}
                          </Box>
                        }
                        secondary={
                          <>
                            <Typography variant="body2">{material.name}</Typography>
                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                              {material.specification?.standard && (
                                <Chip
                                  label={material.specification.standard}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              {material.specification?.grade && (
                                <Chip
                                  label={material.specification.grade}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              {hasVariants(material) && (
                                <Chip
                                  label={`${material.variants?.length || 0} variants`}
                                  size="small"
                                  color="primary"
                                />
                              )}
                            </Stack>
                          </>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          {/* Right: Variant Selector */}
          <Box sx={{ flex: 1 }}>
            {selectedMaterial ? (
              <>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Material Details
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6">{selectedMaterial.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedMaterial.materialCode}
                  </Typography>
                  {selectedMaterial.description && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1, display: 'block' }}
                    >
                      {selectedMaterial.description}
                    </Typography>
                  )}
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Variant Selector */}
                <MaterialVariantSelector
                  material={selectedMaterial}
                  selectedVariantId={selectedVariant?.id}
                  onVariantSelect={handleVariantSelect}
                  compact
                />
              </>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'text.secondary',
                }}
              >
                <Typography variant="body2">Select a material to view details</Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Selected Full Code Display */}
        {selectedMaterial && selectedFullCode && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Selected Material: <strong>{selectedFullCode}</strong>
            </Typography>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={!canConfirm}>
          Select Material
        </Button>
      </DialogActions>
    </Dialog>
  );
}
