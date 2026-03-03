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
import {
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import type { Material, MaterialVariant, MaterialCategory } from '@vapour/types';
import { MATERIAL_CATEGORY_LABELS, getPipingCategory, isFlatPipingCategory } from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import {
  queryMaterials,
  queryMaterialsByFamily,
  queryPipingFamilies,
} from '@/lib/materials/materialService';
import MaterialVariantSelector from './MaterialVariantSelector';
import PipingMaterialTable from './PipingMaterialTable';
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
 * A dialog for searching and selecting materials with category-aware UX:
 * - Plates: material list + variant selector (thickness)
 * - Flanges/Pipes/Fittings: family list + filterable table (NPS, rating, schedule)
 * - Other: simple material selection
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

  // Selection state — for non-piping (plates/other)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MaterialVariant | null>(null);
  const [selectedFullCode, setSelectedFullCode] = useState<string>('');

  // Piping-specific state
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [familyMaterials, setFamilyMaterials] = useState<Material[]>([]);
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [selectedPipingMaterial, setSelectedPipingMaterial] = useState<Material | null>(null);

  // Determine if we're in piping mode based on the current category filter
  const isPipingMode = useMemo(() => {
    if (selectedCategory !== 'ALL') {
      return isFlatPipingCategory(selectedCategory);
    }
    // If categories prop restricts to piping only
    if (categories && categories.length > 0) {
      return categories.every(isFlatPipingCategory);
    }
    return false;
  }, [selectedCategory, categories]);

  const currentPipingCategory = useMemo(() => {
    if (selectedCategory !== 'ALL') {
      return getPipingCategory(selectedCategory);
    }
    if (categories && categories.length === 1 && categories[0]) {
      return getPipingCategory(categories[0]);
    }
    return 'OTHER';
  }, [selectedCategory, categories]);

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

      // For piping categories, load families (one per familyCode)
      if (
        categoriesToQuery &&
        categoriesToQuery.length > 0 &&
        categoriesToQuery.every(isFlatPipingCategory)
      ) {
        const families = await queryPipingFamilies(db, categoriesToQuery);
        setMaterials(families);
      } else {
        const result = await queryMaterials(db, {
          categories: categoriesToQuery,
          sortField: 'materialCode',
          sortDirection: 'asc',
          limitResults: 100,
        });

        // Filter out explicitly deactivated and migrated parent docs
        setMaterials(result.materials.filter((m) => m.isActive !== false && m.isMigrated !== true));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, [db, selectedCategory, categories]);

  // Load materials on open or category change
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
      setSelectedFamily(null);
      setFamilyMaterials([]);
      setSelectedPipingMaterial(null);
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
        material.specification?.grade?.toLowerCase().includes(searchLower) ||
        material.familyCode?.toLowerCase().includes(searchLower)
    );
  }, [materials, searchText]);

  // Get unique categories from filtered materials
  const availableCategories = useMemo(() => {
    if (categories) return categories;
    return Array.from(new Set(materials.map((m) => m.category)));
  }, [materials, categories]);

  // Handle material selection (non-piping)
  const handleMaterialSelect = (material: Material) => {
    setSelectedMaterial(material);
    setSelectedVariant(null);
    setSelectedFullCode(material.materialCode);
  };

  // Handle family selection (piping)
  const handleFamilySelect = async (material: Material) => {
    const family = material.familyCode || material.materialCode;
    setSelectedFamily(family);
    setSelectedPipingMaterial(null);

    if (!db) return;

    setLoadingFamily(true);
    try {
      const familyItems = await queryMaterialsByFamily(db, family);
      setFamilyMaterials(familyItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load family materials');
    } finally {
      setLoadingFamily(false);
    }
  };

  // Handle piping material selection from table
  const handlePipingSelect = (material: Material) => {
    setSelectedPipingMaterial(material);
  };

  // Handle variant selection (plates)
  const handleVariantSelect = (variant: MaterialVariant | null, fullCode: string) => {
    setSelectedVariant(variant);
    setSelectedFullCode(fullCode);
  };

  // Handle back to list
  const handleBack = () => {
    if (isPipingMode && selectedFamily) {
      setSelectedFamily(null);
      setFamilyMaterials([]);
      setSelectedPipingMaterial(null);
    } else {
      setSelectedMaterial(null);
      setSelectedVariant(null);
      setSelectedFullCode('');
    }
  };

  // Handle confirm
  const handleConfirm = () => {
    if (isPipingMode && selectedPipingMaterial) {
      // Piping: the material IS the specific item (no variant needed)
      onSelect(selectedPipingMaterial, undefined, selectedPipingMaterial.materialCode);
      onClose();
      return;
    }

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
  const canConfirm = isPipingMode
    ? !!selectedPipingMaterial
    : selectedMaterial &&
      (!requireVariantSelection || !hasVariants(selectedMaterial) || selectedVariant);

  // Currently showing detail panel?
  const showingDetail = isPipingMode ? !!selectedFamily : !!selectedMaterial;

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
              onChange={(_, value) => {
                setSelectedCategory(value);
                // Reset selection on category change
                setSelectedMaterial(null);
                setSelectedFamily(null);
                setFamilyMaterials([]);
                setSelectedPipingMaterial(null);
              }}
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

        {/* Two-Column Layout: List + Detail */}
        <Box sx={{ display: 'flex', gap: 2, minHeight: 400 }}>
          {/* Left: Materials/Family List */}
          <Box sx={{ flex: 1, borderRight: 1, borderColor: 'divider', pr: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {isPipingMode ? 'Material Families' : 'Materials'} ({filteredMaterials.length})
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : filteredMaterials.length === 0 ? (
              <Box>
                <Alert severity="info" sx={{ mb: 1 }}>
                  {searchText
                    ? 'No materials found matching your search'
                    : 'No materials available'}
                </Alert>
                <Button size="small" onClick={() => window.open('/materials', '_blank')}>
                  Add to Materials Database &rarr;
                </Button>
              </Box>
            ) : (
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {filteredMaterials.map((material) => {
                  const isSelected = isPipingMode
                    ? (material.familyCode || material.materialCode) === selectedFamily
                    : selectedMaterial?.id === material.id;

                  return (
                    <ListItem key={material.id} disablePadding>
                      <ListItemButton
                        selected={isSelected}
                        onClick={() =>
                          isPipingMode
                            ? handleFamilySelect(material)
                            : handleMaterialSelect(material)
                        }
                        sx={{ borderRadius: 1, mb: 0.5 }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" fontWeight="medium">
                                {isPipingMode
                                  ? material.familyCode || material.materialCode
                                  : material.materialCode}
                              </Typography>
                              {isSelected && <CheckCircleIcon color="primary" fontSize="small" />}
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
                                {!isPipingMode && hasVariants(material) && (
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
                  );
                })}
              </List>
            )}
            {!loading && (
              <Button
                size="small"
                onClick={() => window.open('/materials', '_blank')}
                sx={{ mt: 1 }}
              >
                Material not listed? Add to database &rarr;
              </Button>
            )}
          </Box>

          {/* Right: Detail Panel */}
          <Box sx={{ flex: 1 }}>
            {showingDetail ? (
              <>
                {/* Back button */}
                <Button
                  startIcon={<ArrowBackIcon />}
                  onClick={handleBack}
                  size="small"
                  sx={{ mb: 1 }}
                >
                  Back to list
                </Button>

                {isPipingMode && selectedFamily ? (
                  /* =========================================
                     PIPING MODE: Family table
                     ========================================= */
                  <>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Select Size / Rating
                    </Typography>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {selectedFamily}
                    </Typography>
                    <Divider sx={{ my: 1 }} />

                    <PipingMaterialTable
                      materials={familyMaterials}
                      pipingCategory={currentPipingCategory}
                      loading={loadingFamily}
                      selectedMaterialId={selectedPipingMaterial?.id}
                      onSelect={handlePipingSelect}
                    />

                    {/* Selected item summary */}
                    {selectedPipingMaterial && (
                      <Alert severity="success" sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          Selected: <strong>{selectedPipingMaterial.materialCode}</strong>
                          {' — '}
                          {selectedPipingMaterial.name}
                        </Typography>
                      </Alert>
                    )}
                  </>
                ) : selectedMaterial ? (
                  /* =========================================
                     NON-PIPING MODE: Material detail + variants
                     ========================================= */
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
                ) : null}
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
                <Typography variant="body2">
                  {isPipingMode
                    ? 'Select a material family to view sizes'
                    : 'Select a material to view details'}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Selected Full Code Display (non-piping) */}
        {!isPipingMode && selectedMaterial && selectedFullCode && (
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
