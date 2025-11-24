'use client';

/**
 * Add Supply Item Dialog
 *
 * Dialog for adding new supply items to a document
 * - Item details (name, description, type)
 * - Specifications
 * - Quantity and unit
 * - Cost estimates
 * - Delivery requirements
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Divider,
} from '@mui/material';
import type { MasterDocumentEntry, SupplyItemType } from '@vapour/types';

interface AddSupplyItemDialogProps {
  open: boolean;
  onClose: () => void;
  document: MasterDocumentEntry;
  onSubmit: (data: SupplyItemData) => Promise<void>;
}

export interface SupplyItemData {
  itemName: string;
  description: string;
  itemType: SupplyItemType;
  specification: string;
  quantity: number;
  unit: string;
  estimatedUnitCost?: number;
  currency: string;
  drawingReference?: string;
  materialGrade?: string;
  notes?: string;
}

const ITEM_TYPES: { value: SupplyItemType; label: string }[] = [
  { value: 'RAW_MATERIAL', label: 'Raw Material' },
  { value: 'BOUGHT_OUT_ITEM', label: 'Bought Out Item' },
  { value: 'SERVICE', label: 'Service' },
];

const UNITS = ['EA', 'KG', 'MTR', 'SET', 'SQM', 'LTR', 'HR', 'LOT'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

export default function AddSupplyItemDialog({
  open,
  onClose,
  document,
  onSubmit,
}: AddSupplyItemDialogProps) {
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [itemType, setItemType] = useState<SupplyItemType>('RAW_MATERIAL');
  const [specification, setSpecification] = useState('');
  const [quantity, setQuantity] = useState<string>('1');
  const [unit, setUnit] = useState('EA');
  const [estimatedUnitCost, setEstimatedUnitCost] = useState<string>('');
  const [currency, setCurrency] = useState('INR');
  const [drawingReference, setDrawingReference] = useState('');
  const [materialGrade, setMaterialGrade] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!itemName.trim()) {
      setError('Please enter item name');
      return;
    }
    if (!description.trim()) {
      setError('Please enter description');
      return;
    }
    if (!specification.trim()) {
      setError('Please enter specification');
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      setError('Please enter valid quantity');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const data: SupplyItemData = {
        itemName: itemName.trim(),
        description: description.trim(),
        itemType,
        specification: specification.trim(),
        quantity: parseFloat(quantity),
        unit,
        currency,
      };

      if (estimatedUnitCost && parseFloat(estimatedUnitCost) > 0) {
        data.estimatedUnitCost = parseFloat(estimatedUnitCost);
      }
      if (drawingReference.trim()) {
        data.drawingReference = drawingReference.trim();
      }
      if (materialGrade.trim()) {
        data.materialGrade = materialGrade.trim();
      }
      if (notes.trim()) {
        data.notes = notes.trim();
      }

      await onSubmit(data);

      handleReset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add supply item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setItemName('');
    setDescription('');
    setItemType('RAW_MATERIAL');
    setSpecification('');
    setQuantity('1');
    setUnit('EA');
    setEstimatedUnitCost('');
    setCurrency('INR');
    setDrawingReference('');
    setMaterialGrade('');
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    if (!submitting) {
      handleReset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Add Supply Item
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {document.documentNumber} - {document.documentTitle}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Basic Info */}
          <TextField
            label="Item Name"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="e.g., Carbon Steel Plate"
            disabled={submitting}
            required
            fullWidth
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of the item"
            disabled={submitting}
            required
            fullWidth
            multiline
            rows={2}
          />

          <FormControl fullWidth required>
            <InputLabel>Item Type</InputLabel>
            <Select
              value={itemType}
              onChange={(e) => setItemType(e.target.value as SupplyItemType)}
              label="Item Type"
              disabled={submitting}
            >
              {ITEM_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />

          {/* Specifications */}
          <Typography variant="subtitle2">Specifications</Typography>

          <TextField
            label="Specification"
            value={specification}
            onChange={(e) => setSpecification(e.target.value)}
            placeholder="Technical specification"
            disabled={submitting}
            required
            fullWidth
            multiline
            rows={2}
          />

          <Stack direction="row" spacing={2}>
            <TextField
              label="Drawing Reference"
              value={drawingReference}
              onChange={(e) => setDrawingReference(e.target.value)}
              placeholder="e.g., DWG-001"
              disabled={submitting}
              fullWidth
            />
            <TextField
              label="Material Grade"
              value={materialGrade}
              onChange={(e) => setMaterialGrade(e.target.value)}
              placeholder="e.g., SS304"
              disabled={submitting}
              fullWidth
            />
          </Stack>

          <Divider />

          {/* Quantity and Cost */}
          <Typography variant="subtitle2">Quantity & Cost</Typography>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={submitting}
              required
              inputProps={{ min: 0, step: 0.01 }}
              sx={{ width: '40%' }}
            />
            <FormControl sx={{ width: '60%' }} required>
              <InputLabel>Unit</InputLabel>
              <Select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                label="Unit"
                disabled={submitting}
              >
                {UNITS.map((u) => (
                  <MenuItem key={u} value={u}>
                    {u}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Estimated Unit Cost"
              type="number"
              value={estimatedUnitCost}
              onChange={(e) => setEstimatedUnitCost(e.target.value)}
              disabled={submitting}
              inputProps={{ min: 0, step: 0.01 }}
              sx={{ width: '70%' }}
            />
            <FormControl sx={{ width: '30%' }}>
              <InputLabel>Currency</InputLabel>
              <Select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                label="Currency"
                disabled={submitting}
              >
                {CURRENCIES.map((curr) => (
                  <MenuItem key={curr} value={curr}>
                    {curr}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {/* Total Cost Preview */}
          {estimatedUnitCost &&
            parseFloat(estimatedUnitCost) > 0 &&
            quantity &&
            parseFloat(quantity) > 0 && (
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Estimated Total Cost:</strong> {currency}{' '}
                  {(parseFloat(estimatedUnitCost) * parseFloat(quantity)).toFixed(2)}
                </Typography>
              </Alert>
            )}

          <Divider />

          {/* Notes */}
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes or comments"
            disabled={submitting}
            fullWidth
            multiline
            rows={3}
          />

          {/* Error Message */}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
          {submitting ? 'Adding...' : 'Add Item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
