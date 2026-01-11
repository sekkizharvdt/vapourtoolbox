'use client';

/**
 * Add Scope Item Dialog
 *
 * Dialog for adding a new scope item (service, supply, or exclusion).
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Chip,
  Autocomplete,
} from '@mui/material';
import type { ScopeItem, ScopeItemType, ProjectPhase } from '@vapour/types';
import { PROJECT_PHASE_LABELS, PROJECT_PHASE_ORDER, SCOPE_ITEM_TYPE_LABELS } from '@vapour/types';

interface AddScopeItemDialogProps {
  open: boolean;
  type: ScopeItemType;
  onClose: () => void;
  onAdd: (item: ScopeItem) => void;
  existingItems: ScopeItem[];
}

const UNITS = ['nos', 'kg', 'm', 'm2', 'm3', 'lot', 'set', 'pair', 'length', 'roll'];

export function AddScopeItemDialog({
  open,
  type,
  onClose,
  onAdd,
  existingItems,
}: AddScopeItemDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phase, setPhase] = useState<ProjectPhase | ''>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState('');
  const [deliverable, setDeliverable] = useState('');
  const [notes, setNotes] = useState('');
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [relatedItems, setRelatedItems] = useState<string[]>([]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setPhase('');
      setQuantity('');
      setUnit('');
      setDeliverable('');
      setNotes('');
      setDependsOn([]);
      setRelatedItems([]);
    }
  }, [open]);

  // Generate item number based on existing items
  const generateItemNumber = (): string => {
    const itemsOfType = existingItems.filter((i) => i.type === type);
    const typePrefix = type === 'SERVICE' ? 'S' : type === 'SUPPLY' ? 'M' : 'E';

    // Group by phase if applicable
    if (type !== 'EXCLUSION' && phase) {
      const phaseIndex = PROJECT_PHASE_ORDER.indexOf(phase) + 1;
      const itemsInPhase = itemsOfType.filter((i) => i.phase === phase);
      return `${phaseIndex}.${itemsInPhase.length + 1}`;
    }

    // Simple sequential numbering
    return `${typePrefix}${itemsOfType.length + 1}`;
  };

  const handleSubmit = () => {
    const newItem: ScopeItem = {
      id: crypto.randomUUID(),
      itemNumber: generateItemNumber(),
      type,
      name,
      description,
      phase: type !== 'EXCLUSION' && phase ? phase : undefined,
      quantity: type === 'SUPPLY' && quantity ? Number(quantity) : undefined,
      unit: type === 'SUPPLY' && unit ? unit : undefined,
      deliverable: type === 'SERVICE' && deliverable ? deliverable : undefined,
      dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
      relatedItems: relatedItems.length > 0 ? relatedItems : undefined,
      order: existingItems.filter((i) => i.type === type).length,
      notes: notes || undefined,
    };

    onAdd(newItem);
  };

  const isValid = name.trim().length > 0 && description.trim().length > 0;

  // Available items for relationships (services and supply only)
  const availableForRelationship = existingItems.filter(
    (item) => item.type === 'SERVICE' || item.type === 'SUPPLY'
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Add {SCOPE_ITEM_TYPE_LABELS[type]}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            autoFocus
            placeholder={
              type === 'SERVICE'
                ? 'e.g., Process Engineering Design'
                : type === 'SUPPLY'
                  ? 'e.g., SS316L Plates'
                  : 'e.g., Civil Works'
            }
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            required
            multiline
            rows={3}
            placeholder={
              type === 'SERVICE'
                ? 'Describe the work activity...'
                : type === 'SUPPLY'
                  ? 'Describe the material/equipment...'
                  : 'Describe what is NOT included...'
            }
          />

          {/* Phase selector for services and supply */}
          {type !== 'EXCLUSION' && (
            <FormControl fullWidth>
              <InputLabel>Project Phase</InputLabel>
              <Select
                value={phase}
                onChange={(e) => setPhase(e.target.value as ProjectPhase | '')}
                label="Project Phase"
              >
                <MenuItem value="">
                  <em>Select phase...</em>
                </MenuItem>
                {PROJECT_PHASE_ORDER.map((p) => (
                  <MenuItem key={p} value={p}>
                    {PROJECT_PHASE_LABELS[p]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Quantity and unit for supply items */}
          {type === 'SUPPLY' && (
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

          {/* Deliverable for service items */}
          {type === 'SERVICE' && (
            <TextField
              label="Deliverable"
              value={deliverable}
              onChange={(e) => setDeliverable(e.target.value)}
              fullWidth
              placeholder="What output is produced? e.g., Process P&ID, GA Drawings"
            />
          )}

          {/* Dependencies (for services and supply) */}
          {type !== 'EXCLUSION' && availableForRelationship.length > 0 && (
            <Autocomplete
              multiple
              value={dependsOn}
              onChange={(_, newValue) => setDependsOn(newValue)}
              options={availableForRelationship.map((item) => item.id)}
              getOptionLabel={(id) => {
                const item = availableForRelationship.find((i) => i.id === id);
                return item ? `${item.itemNumber} - ${item.name}` : id;
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Depends On"
                  placeholder="Select items this depends on..."
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((id, index) => {
                  const item = availableForRelationship.find((i) => i.id === id);
                  return (
                    <Chip
                      {...getTagProps({ index })}
                      key={id}
                      label={item?.itemNumber || id}
                      size="small"
                    />
                  );
                })
              }
            />
          )}

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Additional notes or comments..."
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!isValid}
        >
          Add {SCOPE_ITEM_TYPE_LABELS[type]}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
