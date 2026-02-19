'use client';

/**
 * Checklist Item List Component
 *
 * Renders scope items as a simple checklist with include/exclude toggles,
 * classification chips (SERVICE/SUPPLY), and inline editing.
 * Used for CHECKLIST-type scope categories.
 */

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Checkbox,
  TextField,
  Chip,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import type { UnifiedScopeItem, ScopeItemClassification } from '@vapour/types';
import { SCOPE_ITEM_CLASSIFICATION_LABELS } from '@vapour/types';

interface ChecklistItemListProps {
  items: UnifiedScopeItem[];
  defaultClassification: ScopeItemClassification;
  onUpdateItem: (item: UnifiedScopeItem) => void;
  onDeleteItem: (itemId: string) => void;
}

function ChecklistItemCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: UnifiedScopeItem;
  onUpdate: (item: UnifiedScopeItem) => void;
  onDelete: (itemId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editedItem, setEditedItem] = useState(item);

  const handleSave = () => {
    onUpdate(editedItem);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditedItem(item);
    setEditing(false);
  };

  const handleToggleIncluded = () => {
    onUpdate({ ...item, included: !item.included });
  };

  if (editing) {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 1, bgcolor: 'background.default' }}>
        <Stack spacing={2}>
          <TextField
            label="Name"
            value={editedItem.name}
            onChange={(e) => setEditedItem({ ...editedItem, name: e.target.value })}
            fullWidth
            size="small"
            required
          />
          <TextField
            label="Description"
            value={editedItem.description || ''}
            onChange={(e) =>
              setEditedItem({ ...editedItem, description: e.target.value || undefined })
            }
            fullWidth
            size="small"
            multiline
            rows={2}
          />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Classification
            </Typography>
            <ToggleButtonGroup
              value={editedItem.classification}
              exclusive
              onChange={(_, val) => {
                if (val) setEditedItem({ ...editedItem, classification: val });
              }}
              size="small"
            >
              <ToggleButton value="SERVICE">Service</ToggleButton>
              <ToggleButton value="SUPPLY">Supply</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          {editedItem.classification === 'SUPPLY' && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Quantity"
                type="number"
                value={editedItem.quantity || ''}
                onChange={(e) =>
                  setEditedItem({
                    ...editedItem,
                    quantity: Number(e.target.value) || undefined,
                  })
                }
                size="small"
                sx={{ width: 120 }}
              />
              <TextField
                label="Unit"
                value={editedItem.unit || ''}
                onChange={(e) =>
                  setEditedItem({ ...editedItem, unit: e.target.value || undefined })
                }
                size="small"
                sx={{ width: 120 }}
                placeholder="nos, kg, m"
              />
            </Box>
          )}
          <TextField
            label="Notes"
            value={editedItem.notes || ''}
            onChange={(e) => setEditedItem({ ...editedItem, notes: e.target.value || undefined })}
            fullWidth
            size="small"
            multiline
            rows={2}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <IconButton onClick={handleCancel} size="small" color="inherit">
              <CancelIcon />
            </IconButton>
            <IconButton onClick={handleSave} size="small" color="primary">
              <SaveIcon />
            </IconButton>
          </Box>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        mb: 1,
        display: 'flex',
        alignItems: 'flex-start',
        opacity: item.included ? 1 : 0.5,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Checkbox
        checked={item.included}
        onChange={handleToggleIncluded}
        size="small"
        sx={{ mt: -0.5, mr: 1 }}
      />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography
            variant="body2"
            fontWeight="medium"
            sx={{ textDecoration: item.included ? 'none' : 'line-through' }}
          >
            {item.itemNumber}. {item.name}
          </Typography>
          <Chip
            label={SCOPE_ITEM_CLASSIFICATION_LABELS[item.classification]}
            size="small"
            variant="outlined"
            color={item.classification === 'SERVICE' ? 'primary' : 'secondary'}
          />
          {!item.included && <Chip label="Excluded" size="small" color="default" />}
        </Box>
        {item.description && (
          <Typography variant="body2" color="text.secondary">
            {item.description}
          </Typography>
        )}
        {item.classification === 'SUPPLY' && item.quantity && (
          <Typography variant="caption" color="text.secondary">
            Qty: {item.quantity} {item.unit}
          </Typography>
        )}
        {item.notes && (
          <Typography variant="caption" color="text.secondary" display="block">
            Note: {item.notes}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <IconButton onClick={() => setEditing(true)} size="small">
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton onClick={() => onDelete(item.id)} size="small" color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
}

export function ChecklistItemList({ items, onUpdateItem, onDeleteItem }: ChecklistItemListProps) {
  if (items.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">
          No items in this category. Click &ldquo;+ Add Item&rdquo; to add one.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {items.map((item) => (
        <ChecklistItemCard
          key={item.id}
          item={item}
          onUpdate={onUpdateItem}
          onDelete={onDeleteItem}
        />
      ))}
    </Box>
  );
}
