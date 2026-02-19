'use client';

/**
 * Add Unified Scope Item Dialog
 *
 * Dialog for adding a new item to a scope category in the unified matrix.
 * Supports classification toggle (SERVICE/SUPPLY), quantity/unit for supply items,
 * and pre-checks all activity columns for MATRIX categories.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Autocomplete,
} from '@mui/material';
import type { ScopeCategoryEntry, UnifiedScopeItem, ScopeItemClassification } from '@vapour/types';
import { SCOPE_CATEGORY_DEFAULTS, MATRIX_ACTIVITY_TEMPLATES } from '@vapour/types';

interface AddUnifiedScopeItemDialogProps {
  open: boolean;
  category: ScopeCategoryEntry | null;
  onClose: () => void;
  onAdd: (categoryId: string, item: UnifiedScopeItem) => void;
}

const UNITS = ['nos', 'kg', 'm', 'm2', 'm3', 'lot', 'set', 'pair', 'length', 'roll'];

export function AddUnifiedScopeItemDialog({
  open,
  category,
  onClose,
  onAdd,
}: AddUnifiedScopeItemDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState<ScopeItemClassification>('SERVICE');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState('');
  const [notes, setNotes] = useState('');

  // Reset form when dialog opens with a new category
  useEffect(() => {
    if (open && category) {
      setName('');
      setDescription('');
      const defaults = SCOPE_CATEGORY_DEFAULTS[category.categoryKey];
      setClassification(defaults.defaultClassification);
      setQuantity('');
      setUnit('');
      setNotes('');
    }
  }, [open, category]);

  if (!category) return null;

  const handleSubmit = () => {
    // For MATRIX categories, pre-check all activity columns
    let activityToggles: Record<string, boolean> | undefined;
    if (category.displayType === 'MATRIX' && category.activityTemplate) {
      const columns = MATRIX_ACTIVITY_TEMPLATES[category.activityTemplate];
      activityToggles = {};
      columns.forEach((col) => {
        activityToggles![col.id] = true;
      });
    }

    const itemNumber = String(category.items.length + 1);

    const newItem: UnifiedScopeItem = {
      id: crypto.randomUUID(),
      itemNumber,
      name: name.trim(),
      ...(description.trim() && { description: description.trim() }),
      classification,
      included: true,
      ...(activityToggles && { activityToggles }),
      ...(classification === 'SUPPLY' && quantity ? { quantity: Number(quantity) } : {}),
      ...(classification === 'SUPPLY' && unit ? { unit } : {}),
      order: category.items.length,
      ...(notes.trim() && { notes: notes.trim() }),
    };

    onAdd(category.id, newItem);
    onClose();
  };

  const isValid = name.trim().length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Item to {category.label}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            autoFocus
            placeholder="e.g., Heat Exchanger, Cable Tray Layout"
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Optional description..."
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Classification
            </Typography>
            <ToggleButtonGroup
              value={classification}
              exclusive
              onChange={(_, val) => {
                if (val) setClassification(val);
              }}
              size="small"
            >
              <ToggleButton value="SERVICE">Service</ToggleButton>
              <ToggleButton value="SUPPLY">Supply</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {classification === 'SUPPLY' && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : '')}
                sx={{ width: 150 }}
              />
              <Autocomplete
                value={unit}
                onChange={(_, newValue) => setUnit(newValue || '')}
                options={UNITS}
                freeSolo
                sx={{ flexGrow: 1 }}
                renderInput={(params) => (
                  <TextField {...params} label="Unit" placeholder="nos, kg, m..." />
                )}
              />
            </Box>
          )}

          {category.displayType === 'MATRIX' && (
            <Typography variant="caption" color="text.secondary">
              All activity columns will be pre-checked. You can toggle individual activities after
              adding.
            </Typography>
          )}

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Additional notes..."
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!isValid}>
          Add Item
        </Button>
      </DialogActions>
    </Dialog>
  );
}
