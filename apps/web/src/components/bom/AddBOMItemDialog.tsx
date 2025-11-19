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
} from '@mui/material';
import { useState } from 'react';
import { BOMItemType, BOMComponentType, type Material } from '@vapour/types';
import { BOM_ITEM_TYPE_LABELS } from '@vapour/types';
import MaterialSelector from './MaterialSelector';
import { getAllBoughtOutCategories } from '@/lib/bom/boughtOutHelpers';

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

  // Shape-based specific (placeholder for now)
  const [shapeId, setShapeId] = useState('');

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
    setShapeId('');
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

    if (componentType === 'SHAPE' && !shapeId) {
      setError('Shape-based items not yet implemented. Please use Bought-Out tab.');
      return;
    }

    try {
      setLoading(true);

      const data: AddItemData = {
        itemType,
        name,
        description: description || undefined,
        quantity,
        unit,
        componentType,
        materialId: componentType === 'BOUGHT_OUT' ? selectedMaterial?.id : undefined,
        shapeId: componentType === 'SHAPE' ? shapeId : undefined,
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

  // Auto-fill name from material when selected
  const handleMaterialChange = (_materialId: string | null, material: Material | null) => {
    setSelectedMaterial(material);
    if (material && !name) {
      setName(material.name);
    }
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
            <Tab label="Fabricated (Shape-Based)" disabled />
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

        {/* Shape-Based Tab (Placeholder) */}
        <TabPanel value={tabValue} index={1}>
          <Alert severity="info">
            Shape-based (fabricated) items are coming soon. For now, please use the Bought-Out
            Component tab to add items.
          </Alert>
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
