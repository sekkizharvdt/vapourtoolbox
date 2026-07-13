'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Tabs,
  Tab,
  MenuItem,
  CircularProgress,
  Alert,
  Divider,
  Typography,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useState, useMemo } from 'react';
import {
  BOMItemType,
  BOMComponentType,
  type CatalogRef,
  type Material,
  type Shape,
} from '@vapour/types';
import { BOM_ITEM_TYPE_LABELS } from '@vapour/types';
import MaterialSelector from './MaterialSelector';
import ShapeSelector from './ShapeSelector';
import ShapeParameterInput from './ShapeParameterInput';
import ShapeCalculationResults from './ShapeCalculationResults';
import CatalogPickerDialog, {
  type CatalogSelection,
} from '@/components/catalog/CatalogPickerDialog';
import { calculateShape } from '@/lib/shapes/shapeCalculator';
import { formatCurrency, formatMoney } from '@/lib/utils/formatters';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`add-item-tabpanel-${index}`}
      aria-labelledby={`add-item-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface AddBOMItemDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: AddItemData) => Promise<void>;
  entityId: string;
}

export interface AddItemData {
  itemType: BOMItemType;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  componentType: BOMComponentType;
  materialId?: string;
  shapeId?: string;
  parameters?: Record<string, number>;
  /** Set when a bought-out component is picked from the bought_out_items catalog. */
  boughtOutItemId?: string;
  /** Unified catalog linkage written alongside the per-kind id (design 2026-06-15 §3.1). */
  catalogRef?: CatalogRef;
}

export default function AddBOMItemDialog({
  open,
  onClose,
  onAdd,
  entityId,
}: AddBOMItemDialogProps) {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common fields
  const [itemType, setItemType] = useState<BOMItemType>(BOMItemType.PART);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('nos');

  // Bought-out specific — a catalog selection (bought_out_items doc, or a
  // material for legacy material-backed bought-out components). Replaces the
  // old bought-out-as-MaterialCategory modeling (catalog unification stage 2).
  const [catalogSelection, setCatalogSelection] = useState<CatalogSelection | null>(null);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);

  // Shape-based specific
  const [selectedShape, setSelectedShape] = useState<Shape | null>(null);
  const [shapeMaterial, setShapeMaterial] = useState<Material | null>(null);
  const [shapeParameters, setShapeParameters] = useState<Record<string, number | string | boolean>>(
    {}
  );
  const [parameterErrors, setParameterErrors] = useState<Record<string, string>>({});

  // Calculate shape results when parameters change
  const shapeCalculationResult = useMemo(() => {
    if (!selectedShape || !shapeMaterial) return null;

    // Check all required parameters are filled
    const requiredParams = selectedShape.parameters.filter((p) => p.required);
    const missingParams = requiredParams.filter(
      (p) => shapeParameters[p.name] === undefined || shapeParameters[p.name] === ''
    );

    if (missingParams.length > 0) return null;

    // Convert parameters to numbers for calculation
    const numericParams: Record<string, number> = {};
    for (const [key, value] of Object.entries(shapeParameters)) {
      if (typeof value === 'number') {
        numericParams[key] = value;
      } else if (typeof value === 'string') {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          numericParams[key] = num;
        }
      }
    }

    try {
      const result = calculateShape({
        shape: selectedShape,
        material: shapeMaterial,
        parameterValues: numericParams,
        quantity,
      });
      return result;
    } catch (err) {
      console.error('Shape calculation error:', err);
      return null;
    }
  }, [selectedShape, shapeMaterial, shapeParameters, quantity]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
  };

  const handleClose = () => {
    // Reset form
    setTabValue(0);
    setItemType(BOMItemType.PART);
    setName('');
    setDescription('');
    setQuantity(1);
    setUnit('nos');
    setCatalogSelection(null);
    setCatalogPickerOpen(false);
    setSelectedShape(null);
    setShapeMaterial(null);
    setShapeParameters({});
    setParameterErrors({});
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Item name is required');
      return;
    }

    if (quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    const componentType: BOMComponentType = tabValue === 0 ? 'BOUGHT_OUT' : 'SHAPE';

    // Validate based on component type
    if (componentType === 'BOUGHT_OUT' && !catalogSelection) {
      setError('Please select an item from the catalog');
      return;
    }

    if (componentType === 'SHAPE') {
      if (!selectedShape) {
        setError('Please select a shape');
        return;
      }
      if (!shapeMaterial) {
        setError('Please select a material for the shape');
        return;
      }
      if (!shapeCalculationResult) {
        setError('Please fill in all required parameters');
        return;
      }
    }

    try {
      setLoading(true);

      // Convert parameters to numbers for storage
      const numericParams: Record<string, number> = {};
      if (componentType === 'SHAPE') {
        for (const [key, value] of Object.entries(shapeParameters)) {
          if (typeof value === 'number') {
            numericParams[key] = value;
          } else if (typeof value === 'string') {
            const num = parseFloat(value);
            if (!isNaN(num)) {
              numericParams[key] = num;
            }
          }
        }
      }

      // Bought-out: link the real catalog document. A bought_out_items pick
      // writes boughtOutItemId (+ catalogRef) and NO materialId — costing
      // skips such lines until the A2 pricing bridge. A Materials-tab pick
      // (legacy material-backed bought-out component) keeps writing
      // materialId so its costing behaves exactly as before.
      const data: AddItemData = {
        itemType,
        name,
        description: description || undefined,
        quantity,
        unit,
        componentType,
        materialId:
          componentType === 'BOUGHT_OUT'
            ? catalogSelection?.source.kind === 'RAW_MATERIAL'
              ? catalogSelection.source.material.id
              : undefined
            : componentType === 'SHAPE'
              ? shapeMaterial?.id
              : undefined,
        boughtOutItemId:
          componentType === 'BOUGHT_OUT' && catalogSelection?.source.kind === 'BOUGHT_OUT'
            ? catalogSelection.source.boughtOutItem.id
            : undefined,
        catalogRef: componentType === 'BOUGHT_OUT' ? catalogSelection?.ref : undefined,
        shapeId: componentType === 'SHAPE' ? selectedShape?.id : undefined,
        parameters: componentType === 'SHAPE' ? numericParams : undefined,
      };

      await onAdd(data);
      handleClose();
    } catch (err) {
      console.error('Error adding item:', err);
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  // Bought-out tab: catalog pick (bought_out_items or materials backend)
  const handleCatalogSelect = (selection: CatalogSelection) => {
    setCatalogSelection(selection);
    setCatalogPickerOpen(false);
    if (!name) {
      setName(selection.item.name);
    }
  };

  // Handle shape selection
  const handleShapeChange = (_shapeId: string | null, shape: Shape | null) => {
    setSelectedShape(shape);
    setShapeParameters({}); // Reset parameters when shape changes
    if (shape && !name) {
      setName(shape.name);
    }
  };

  // Handle shape material selection
  const handleShapeMaterialChange = (_materialId: string | null, material: Material | null) => {
    setShapeMaterial(material);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Add BOM Item</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Component Type Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Bought-Out Component" />
            <Tab label="Fabricated (Shape-Based)" />
          </Tabs>
        </Box>

        {/* Bought-Out Tab — picks from the unified catalog (bought_out_items
            or the legacy material-backed components in materials). */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                label="Bought-Out Component *"
                value={
                  catalogSelection
                    ? `${catalogSelection.ref.code} — ${catalogSelection.ref.name}`
                    : ''
                }
                fullWidth
                required
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconButton
                        size="small"
                        onClick={() => setCatalogPickerOpen(true)}
                        aria-label="Select from catalog"
                      >
                        <SearchIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                onClick={() => setCatalogPickerOpen(true)}
                placeholder="Select from catalog"
                helperText={
                  catalogSelection?.ref.kind === 'BOUGHT_OUT'
                    ? 'Linked to the Bought-Out database. Cost calculation for these lines is not wired yet — it currently uses material prices only.'
                    : 'Pick from the Bought-Out database (or the Materials tab for material-backed components)'
                }
              />
              <Button
                variant="outlined"
                onClick={() => setCatalogPickerOpen(true)}
                sx={{ mt: 1, whiteSpace: 'nowrap' }}
              >
                Browse
              </Button>
            </Box>

            <TextField
              label="Item Type"
              select
              value={itemType}
              onChange={(e) => setItemType(e.target.value as BOMItemType)}
              fullWidth
            >
              {Object.entries(BOM_ITEM_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Item Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              helperText="Auto-filled from material, can be customized"
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Quantity *"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                inputProps={{ min: 0, step: 1 }}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Unit *"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                sx={{ flex: 1 }}
                helperText='e.g., "nos", "pcs", "sets"'
              />
            </Box>

            {catalogSelection?.source.kind === 'RAW_MATERIAL' &&
              catalogSelection.source.material.currentPrice && (
                <Alert severity="info">
                  Unit Price:{' '}
                  {formatCurrency(
                    catalogSelection.source.material.currentPrice.pricePerUnit.amount,
                    catalogSelection.source.material.currentPrice.pricePerUnit.currency
                  )}
                  {' / '}
                  {catalogSelection.source.material.currentPrice.unit}
                </Alert>
              )}
            {catalogSelection?.source.kind === 'BOUGHT_OUT' &&
              (catalogSelection.source.boughtOutItem.pricing?.listPrice?.amount ?? 0) > 0 && (
                <Alert severity="info">
                  List Price: {formatMoney(catalogSelection.source.boughtOutItem.pricing.listPrice)}
                </Alert>
              )}
          </Box>
        </TabPanel>

        {/* Shape-Based Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Shape Selection */}
            <ShapeSelector
              value={selectedShape?.id || null}
              onChange={handleShapeChange}
              label="Select Shape *"
              required
            />

            {/* Material Selection for Shape */}
            {selectedShape && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Material Selection
                </Typography>
                <MaterialSelector
                  value={shapeMaterial?.id || null}
                  onChange={handleShapeMaterialChange}
                  categories={
                    selectedShape.allowedMaterialCategories?.length
                      ? selectedShape.allowedMaterialCategories
                      : undefined
                  }
                  materialType="RAW_MATERIAL"
                  label="Select Material *"
                  required
                  entityId={entityId}
                />
              </>
            )}

            {/* Shape Parameters */}
            {selectedShape && shapeMaterial && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Dimensions
                </Typography>
                <ShapeParameterInput
                  shape={selectedShape}
                  values={shapeParameters}
                  onChange={setShapeParameters}
                  errors={parameterErrors}
                />
              </>
            )}

            {/* Item Details */}
            {selectedShape && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Item Details
                </Typography>

                <TextField
                  label="Item Type"
                  select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as BOMItemType)}
                  fullWidth
                >
                  {Object.entries(BOM_ITEM_TYPE_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="Item Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  required
                  helperText="Auto-filled from shape, can be customized"
                />

                <TextField
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                />

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Quantity *"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    inputProps={{ min: 1, step: 1 }}
                    required
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Unit *"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    required
                    sx={{ flex: 1 }}
                    helperText='e.g., "nos", "pcs"'
                  />
                </Box>
              </>
            )}

            {/* Calculation Results */}
            {shapeCalculationResult && (
              <>
                <Divider sx={{ my: 1 }} />
                <ShapeCalculationResults
                  calculatedValues={shapeCalculationResult.calculatedValues}
                  costEstimate={shapeCalculationResult.costEstimate}
                  quantity={quantity}
                  totalWeight={shapeCalculationResult.totalWeight}
                  totalCost={shapeCalculationResult.totalCost}
                />
              </>
            )}
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Adding...' : 'Add Item'}
        </Button>
      </DialogActions>

      {/* Unified catalog picker (catalog unification stage 2) — bought-out
          components link real bought_out_items docs; the Materials tab stays
          available for legacy material-backed components (still costed). */}
      <CatalogPickerDialog
        open={catalogPickerOpen}
        onClose={() => setCatalogPickerOpen(false)}
        onSelect={handleCatalogSelect}
        defaultKind="BOUGHT_OUT"
        kinds={['BOUGHT_OUT', 'RAW_MATERIAL']}
      />
    </Dialog>
  );
}
