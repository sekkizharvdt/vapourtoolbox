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
} from '@mui/material';
import { useState, useMemo } from 'react';
import { BOMItemType, BOMComponentType, type Material, type Shape } from '@vapour/types';
import { BOM_ITEM_TYPE_LABELS } from '@vapour/types';
import MaterialSelector from './MaterialSelector';
import ShapeSelector from './ShapeSelector';
import ShapeParameterInput from './ShapeParameterInput';
import ShapeCalculationResults from './ShapeCalculationResults';
import { getAllBoughtOutCategories } from '@/lib/bom/boughtOutHelpers';
import { calculateShape } from '@/lib/shapes/shapeCalculator';

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

  // Bought-out specific
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

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
    setSelectedMaterial(null);
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
    if (componentType === 'BOUGHT_OUT' && !selectedMaterial) {
      setError('Please select a material');
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

      const data: AddItemData = {
        itemType,
        name,
        description: description || undefined,
        quantity,
        unit,
        componentType,
        materialId:
          componentType === 'BOUGHT_OUT'
            ? selectedMaterial?.id
            : componentType === 'SHAPE'
              ? shapeMaterial?.id
              : undefined,
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

  // Auto-fill name from material when selected (bought-out tab)
  const handleMaterialChange = (_materialId: string | null, material: Material | null) => {
    setSelectedMaterial(material);
    if (material && !name) {
      setName(material.name);
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

        {/* Bought-Out Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <MaterialSelector
              value={selectedMaterial?.id || null}
              onChange={handleMaterialChange}
              categories={getAllBoughtOutCategories()}
              materialType="BOUGHT_OUT_COMPONENT"
              label="Select Bought-Out Component *"
              required
              entityId={entityId}
            />

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

            {selectedMaterial?.currentPrice && (
              <Alert severity="info">
                Unit Price:{' '}
                {new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: selectedMaterial.currentPrice.pricePerUnit.currency,
                }).format(selectedMaterial.currentPrice.pricePerUnit.amount)}
                {' / '}
                {selectedMaterial.currentPrice.unit}
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
    </Dialog>
  );
}
