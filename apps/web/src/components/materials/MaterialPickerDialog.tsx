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
  Grid,
  Paper,
  Stack,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import type { Material, MaterialVariant, MaterialCategory } from '@vapour/types';
import {
  PICKER_CATEGORY_GROUPS,
  MATERIAL_CATEGORY_LABELS,
  getPipingCategory,
  isFlatPipingCategory,
} from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import {
  queryMaterials,
  queryMaterialsByFamily,
  queryPipingFamilies,
  searchMaterials,
} from '@/lib/materials/materialService';
import { createMaterial } from '@/lib/materials/crud';
import { useAuth } from '@/contexts/AuthContext';
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
  /**
   * Optional defaults for the inline "Create new material" form. Pre-fills
   * the form from a parsed line item so the user doesn't re-type the
   * description / unit / category. Mirrors the same prop on ServicePicker.
   */
  createDefaults?: {
    name?: string;
    description?: string;
    unit?: string;
    category?: MaterialCategory;
  };
}

type PickerView = 'categories' | 'list' | 'detail';

/**
 * Material Picker Dialog — Category-First Navigation
 *
 * Three-phase drill-down:
 * 1. Category selection (Flanges, Pipes, Fittings, Plates, etc.)
 * 2. Material/family list within the selected category
 * 3. Detail view (piping table or material detail)
 */
export default function MaterialPickerDialog({
  open,
  onClose,
  onSelect,
  title = 'Select Material',
  categories,
  requireVariantSelection = true,
  createDefaults,
}: MaterialPickerDialogProps) {
  const { db } = getFirebase();
  const { user, claims } = useAuth();
  const tenantId = claims?.tenantId || 'default-entity';

  // Navigation state
  const [view, setView] = useState<PickerView>('categories');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  // Data state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Material[] | null>(null);

  // Selection state — non-piping (plates/other)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MaterialVariant | null>(null);
  const [selectedFullCode, setSelectedFullCode] = useState<string>('');

  // Piping-specific state
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [familyMaterials, setFamilyMaterials] = useState<Material[]>([]);
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [selectedPipingMaterial, setSelectedPipingMaterial] = useState<Material | null>(null);

  // Inline-create state — toggled when the user clicks "Create New". Hides
  // the rest of the picker so the user doesn't lose their place. On save,
  // the new material is auto-selected back into whatever opened the picker.
  // Minimum required fields only — the full Materials page is the place
  // for grading specs, properties, variants, etc.
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createCategory, setCreateCategory] = useState<MaterialCategory | ''>('');
  const [createGrade, setCreateGrade] = useState('');
  const [createStandard, setCreateStandard] = useState('');
  const [createBaseUnit, setCreateBaseUnit] = useState('NOS');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Derived: which groups are available based on the categories prop
  const availableGroups = useMemo(() => {
    if (!categories || categories.length === 0) return PICKER_CATEGORY_GROUPS;
    return PICKER_CATEGORY_GROUPS.filter((group) =>
      group.categories.some((cat) => categories.includes(cat))
    ).map((group) => ({
      ...group,
      categories: group.categories.filter((cat) => categories.includes(cat)),
    }));
  }, [categories]);

  // Derived: currently selected group
  const selectedGroup = useMemo(
    () => availableGroups.find((g) => g.key === selectedGroupKey) || null,
    [availableGroups, selectedGroupKey]
  );

  const isPipingMode = selectedGroup?.pipingMode ?? false;

  const currentPipingCategory = useMemo(() => {
    if (!selectedGroup) return 'OTHER';
    // Use the first category to determine the piping display type
    const firstCat = selectedGroup.categories[0];
    return firstCat ? getPipingCategory(firstCat) : 'OTHER';
  }, [selectedGroup]);

  // Reset ALL state when dialog opens
  useEffect(() => {
    if (open) {
      setView('categories');
      setSelectedGroupKey(null);
      setMaterials([]);
      setSearchText('');
      setSearchResults(null);
      setError(null);
      setLoading(false);
      setSelectedMaterial(null);
      setSelectedVariant(null);
      setSelectedFullCode('');
      setSelectedFamily(null);
      setFamilyMaterials([]);
      setLoadingFamily(false);
      setSelectedPipingMaterial(null);
      // Reset the create form, pre-filling from row context where given.
      setShowCreate(false);
      setCreateError(null);
      setCreating(false);
      setCreateName(createDefaults?.name ?? '');
      setCreateDescription(createDefaults?.description ?? '');
      setCreateCategory(createDefaults?.category ?? '');
      setCreateBaseUnit((createDefaults?.unit ?? 'NOS').toUpperCase());
      setCreateGrade('');
      setCreateStandard('');
    }
  }, [open, createDefaults]);

  // Auto-skip category view if only one group is available
  useEffect(() => {
    if (open && view === 'categories' && availableGroups.length === 1 && availableGroups[0]) {
      const group = availableGroups[0];
      setSelectedGroupKey(group.key);
      setView('list');
    }
  }, [open, view, availableGroups]);

  // Load materials when entering list view
  const loadMaterials = useCallback(async () => {
    if (!db || !selectedGroup) return;

    try {
      setLoading(true);
      setError(null);

      if (selectedGroup.pipingMode) {
        const families = await queryPipingFamilies(db, selectedGroup.categories);
        setMaterials(families);
      } else {
        const result = await queryMaterials(db, {
          categories: selectedGroup.categories,
          sortField: 'materialCode',
          sortDirection: 'asc',
          limitResults: 200,
        });
        setMaterials(result.materials.filter((m) => m.isActive !== false && m.isMigrated !== true));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  }, [db, selectedGroup]);

  useEffect(() => {
    if (open && db && view === 'list' && selectedGroup) {
      loadMaterials();
    }
  }, [open, db, view, selectedGroup, loadMaterials]);

  // Cross-category search from landing
  useEffect(() => {
    if (!db || !searchText.trim() || view !== 'categories') {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const results = await searchMaterials(db, searchText.trim(), 50);
        setSearchResults(results.filter((m) => m.isActive !== false && m.isMigrated !== true));
      } catch {
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [db, searchText, view]);

  // Filter materials by search text (within list view)
  const filteredMaterials = useMemo(() => {
    if (view !== 'list' || !searchText.trim()) return materials;

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
  }, [materials, searchText, view]);

  // ========== Handlers ==========

  const handleGroupSelect = (groupKey: string) => {
    setSelectedGroupKey(groupKey);
    setView('list');
    setSearchText('');
    setSearchResults(null);
  };

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

  const handleMaterialSelect = (material: Material) => {
    setSelectedMaterial(material);
    setSelectedVariant(null);
    setSelectedFullCode(material.materialCode);
  };

  const handlePipingSelect = (material: Material) => {
    setSelectedPipingMaterial(material);
  };

  const handleVariantSelect = (variant: MaterialVariant | null, fullCode: string) => {
    setSelectedVariant(variant);
    setSelectedFullCode(fullCode);
  };

  // Handle search result click — navigate to the right group and select
  const handleSearchResultSelect = (material: Material) => {
    // Determine the piping category type
    if (isFlatPipingCategory(material.category)) {
      // It's a piping material — select it directly
      setSelectedPipingMaterial(material);
      onSelect(material, undefined, material.materialCode);
      onClose();
    } else {
      // Non-piping — select directly
      onSelect(material, undefined, material.materialCode);
      onClose();
    }
  };

  const handleBack = () => {
    if (view === 'list' && selectedFamily) {
      // Back from family detail to family list
      setSelectedFamily(null);
      setFamilyMaterials([]);
      setSelectedPipingMaterial(null);
    } else if (view === 'list' && selectedMaterial) {
      // Back from material detail to material list
      setSelectedMaterial(null);
      setSelectedVariant(null);
      setSelectedFullCode('');
    } else if (view === 'list') {
      // Back to category selection
      setView('categories');
      setSelectedGroupKey(null);
      setMaterials([]);
      setSearchText('');
    }
  };

  const handleConfirm = () => {
    if (isPipingMode && selectedPipingMaterial) {
      onSelect(selectedPipingMaterial, undefined, selectedPipingMaterial.materialCode);
      onClose();
      return;
    }

    if (!selectedMaterial) return;

    if (requireVariantSelection && hasVariants(selectedMaterial) && !selectedVariant) {
      setError('Please select a variant');
      return;
    }

    onSelect(selectedMaterial, selectedVariant || undefined, selectedFullCode);
    onClose();
  };

  const canConfirm = isPipingMode
    ? !!selectedPipingMaterial
    : selectedMaterial &&
      (!requireVariantSelection || !hasVariants(selectedMaterial) || selectedVariant);

  const showingDetail = isPipingMode ? !!selectedFamily : !!selectedMaterial;

  const handleCreate = async () => {
    if (!user?.uid || !db) {
      setCreateError('You must be signed in to create a material.');
      return;
    }
    if (!createName.trim()) {
      setCreateError('Material name is required.');
      return;
    }
    if (!createCategory) {
      setCreateError('Category is required.');
      return;
    }
    if (!createGrade.trim()) {
      setCreateError('Grade is required (used to generate the material code).');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      // materialCode is auto-generated by createMaterial from grade +
      // category when left blank — same pattern as the full /materials/new
      // pages. We just pass an empty string to satisfy the required field.
      const materialData: Omit<
        Material,
        'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
      > = {
        materialCode: '',
        name: createName.trim(),
        description: createDescription.trim(),
        category: createCategory as MaterialCategory,
        materialType: 'RAW_MATERIAL',
        specification: {
          grade: createGrade.trim(),
          ...(createStandard.trim() && { standard: createStandard.trim() }),
        },
        properties: {},
        hasVariants: false,
        baseUnit: createBaseUnit.trim() || 'NOS',
        preferredVendors: [],
        priceHistory: [],
        trackInventory: false,
        tags: [],
        isActive: true,
        isStandard: false,
        ...(tenantId && { tenantId }),
      };
      const created = await createMaterial(db, materialData, user.uid);
      onSelect(created, undefined, created.materialCode);
      onClose();
    } catch (err) {
      console.error('[MaterialPickerDialog] createMaterial failed', err);
      setCreateError(err instanceof Error ? err.message : 'Failed to create material.');
    } finally {
      setCreating(false);
    }
  };

  // ========== Render ==========

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {showCreate ? (
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton size="small" onClick={() => setShowCreate(false)} disabled={creating}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography variant="h6" component="span">
              Create New Material
            </Typography>
          </Stack>
        ) : view === 'list' && selectedGroup ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
              size="small"
              sx={{ minWidth: 'auto' }}
              disabled={!!selectedFamily || !!selectedMaterial}
            >
              Back
            </Button>
            <Typography variant="h6" component="span">
              {title} &mdash; {selectedGroup.label}
            </Typography>
          </Box>
        ) : (
          title
        )}
      </DialogTitle>
      <DialogContent>
        {showCreate ? (
          /* Inline create form — minimum required fields. The full Materials
             page is the place to set properties, variants, vendor links, etc. */
          <Stack spacing={2} sx={{ pt: 1 }}>
            {createError && <Alert severity="error">{createError}</Alert>}
            <TextField
              label="Material Name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              fullWidth
              required
              autoFocus
              size="small"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={createCategory}
                  label="Category"
                  onChange={(e) => setCreateCategory(e.target.value as MaterialCategory)}
                >
                  {Object.entries(MATERIAL_CATEGORY_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Grade"
                value={createGrade}
                onChange={(e) => setCreateGrade(e.target.value)}
                fullWidth
                required
                size="small"
                helperText="e.g. 304, 316L, A36 — used to build the material code"
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Standard (optional)"
                value={createStandard}
                onChange={(e) => setCreateStandard(e.target.value)}
                fullWidth
                size="small"
                helperText="e.g. ASTM A240, IS 2062"
              />
              <TextField
                label="Base Unit"
                value={createBaseUnit}
                onChange={(e) => setCreateBaseUnit(e.target.value.toUpperCase())}
                fullWidth
                size="small"
                helperText="e.g. NOS, KG, MTR"
              />
            </Stack>
            <TextField
              label="Description (optional)"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={2}
            />
            <Typography variant="caption" color="text.secondary">
              You can add properties, variants, preferred vendors, and other details from the
              Materials page later.
            </Typography>
          </Stack>
        ) : (
          <>
            {/* Search */}
            <TextField
              fullWidth
              placeholder={
                view === 'categories'
                  ? 'Search all materials by code, name, or specification...'
                  : `Search ${selectedGroup?.label || 'materials'}...`
              }
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => setShowCreate(true)}
                    >
                      Create New
                    </Button>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            {/* Error */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* ===== CATEGORY LANDING VIEW ===== */}
            {view === 'categories' && !searchResults && (
              <Grid container spacing={2}>
                {availableGroups.map((group) => (
                  <Grid key={group.key} size={{ xs: 6, sm: 4, md: 3 }}>
                    <Paper
                      elevation={0}
                      onClick={() => handleGroupSelect(group.key)}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 2,
                        textAlign: 'center',
                        transition: 'all 0.15s',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight="bold">
                        {group.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {group.categories.length === 1
                          ? '1 type'
                          : `${group.categories.length} types`}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}

            {/* ===== SEARCH RESULTS (from landing) ===== */}
            {view === 'categories' && searchResults && (
              <Box sx={{ minHeight: 300 }}>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : searchResults.length === 0 ? (
                  <Alert severity="info">No materials found matching your search</Alert>
                ) : (
                  <>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Search Results ({searchResults.length})
                    </Typography>
                    <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                      {searchResults.map((material) => (
                        <ListItem key={material.id} disablePadding>
                          <ListItemButton
                            onClick={() => handleSearchResultSelect(material)}
                            sx={{ borderRadius: 1, mb: 0.5 }}
                          >
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" fontWeight="medium">
                                    {material.materialCode}
                                  </Typography>
                                  <Chip
                                    label={
                                      MATERIAL_CATEGORY_LABELS[material.category]?.replace(
                                        /^.*? - /,
                                        ''
                                      ) || material.category
                                    }
                                    size="small"
                                    variant="outlined"
                                  />
                                </Box>
                              }
                              secondary={material.name}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </Box>
            )}

            {/* ===== LIST + DETAIL VIEW ===== */}
            {view === 'list' && (
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
                          : 'No materials available in this category'}
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
                                    {isSelected && (
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
                      {/* Back within detail */}
                      <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={handleBack}
                        size="small"
                        sx={{ mb: 1 }}
                      >
                        Back to list
                      </Button>

                      {isPipingMode && selectedFamily ? (
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

                          {selectedPipingMaterial && (
                            <Alert severity="success" sx={{ mt: 2 }}>
                              <Typography variant="body2">
                                Selected: <strong>{selectedPipingMaterial.materialCode}</strong>
                                {' \u2014 '}
                                {selectedPipingMaterial.name}
                              </Typography>
                            </Alert>
                          )}
                        </>
                      ) : selectedMaterial ? (
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
            )}

            {/* Selected Full Code Display (non-piping) */}
            {view === 'list' && !isPipingMode && selectedMaterial && selectedFullCode && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Selected Material: <strong>{selectedFullCode}</strong>
                </Typography>
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {showCreate ? (
          <>
            <Button onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating…' : 'Create & Use'}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={handleConfirm} disabled={!canConfirm}>
              Select Material
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
