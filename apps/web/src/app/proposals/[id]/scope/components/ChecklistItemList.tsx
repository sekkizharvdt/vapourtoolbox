'use client';

/**
 * Checklist Item List Component
 *
 * Renders scope items as a simple checklist with include/exclude toggles,
 * classification chips (SERVICE/SUPPLY), and inline editing.
 * Used for CHECKLIST-type scope categories.
 *
 * AI-parsed items (source = 'AI_PARSED') can't be silently deleted — they
 * came from the buyer's SOW. Excluding one requires a reason, which then
 * shows on the client PDF as a clarification. Manually-added items can be
 * deleted directly.
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
  Button,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Block as ExcludeIcon,
  AutoAwesome as AiIcon,
  RestartAlt as ReincludeIcon,
} from '@mui/icons-material';
import type { UnifiedScopeItem, ScopeItemClassification, ScopeCategoryKey } from '@vapour/types';
import { SCOPE_ITEM_CLASSIFICATION_LABELS } from '@vapour/types';

interface ChecklistItemListProps {
  items: UnifiedScopeItem[];
  defaultClassification: ScopeItemClassification;
  currentCategoryKey: ScopeCategoryKey;
  allCategories: { categoryKey: ScopeCategoryKey; label: string }[];
  onUpdateItem: (item: UnifiedScopeItem, targetCategoryKey?: ScopeCategoryKey) => void;
  onDeleteItem: (itemId: string) => void;
}

function ChecklistItemCard({
  item,
  currentCategoryKey,
  allCategories,
  onUpdate,
  onDelete,
}: {
  item: UnifiedScopeItem;
  currentCategoryKey: ScopeCategoryKey;
  allCategories: { categoryKey: ScopeCategoryKey; label: string }[];
  onUpdate: (item: UnifiedScopeItem, targetCategoryKey?: ScopeCategoryKey) => void;
  onDelete: (itemId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editedItem, setEditedItem] = useState(item);
  const [targetCategory, setTargetCategory] = useState<ScopeCategoryKey>(currentCategoryKey);

  // Inline exclusion-reason flow for AI-parsed items.
  // While capturing the reason, the item is in a "pending exclusion" state.
  const [pendingReason, setPendingReason] = useState<string | null>(null);

  const isAiParsed = item.source === 'AI_PARSED';

  const handleSave = () => {
    onUpdate(editedItem, targetCategory);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditedItem(item);
    setTargetCategory(currentCategoryKey);
    setEditing(false);
  };

  const startExclude = () => {
    setPendingReason(item.exclusionReason ?? '');
  };

  const cancelExclude = () => {
    setPendingReason(null);
  };

  const confirmExclude = () => {
    const reason = (pendingReason ?? '').trim();
    if (!reason) return;
    onUpdate({ ...item, included: false, exclusionReason: reason });
    setPendingReason(null);
  };

  const handleReinclude = () => {
    onUpdate({ ...item, included: true, exclusionReason: undefined });
  };

  const handleToggleIncluded = () => {
    if (item.included) {
      // Including → Excluding
      if (isAiParsed) {
        startExclude();
      } else {
        // Manual items can flip freely
        onUpdate({ ...item, included: false });
      }
    } else {
      // Excluding → Including: always allowed, clear any reason
      onUpdate({ ...item, included: true, exclusionReason: undefined });
    }
  };

  const handleRemoveClick = () => {
    if (isAiParsed) {
      startExclude();
    } else {
      onDelete(item.id);
    }
  };

  if (editing) {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 1, bgcolor: 'background.default' }}>
        <Stack spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel id={`category-label-${item.id}`}>Category</InputLabel>
            <Select
              labelId={`category-label-${item.id}`}
              label="Category"
              value={targetCategory}
              onChange={(e) => setTargetCategory(e.target.value as ScopeCategoryKey)}
            >
              {allCategories.map((c) => (
                <MenuItem key={c.categoryKey} value={c.categoryKey}>
                  {c.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
            <IconButton onClick={handleCancel} size="small" color="inherit" aria-label="Close">
              <CancelIcon />
            </IconButton>
            <IconButton onClick={handleSave} size="small" color="primary" aria-label="Action">
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
        opacity: item.included ? 1 : 0.7,
        borderLeftWidth: !item.included ? 3 : 1,
        borderLeftColor: !item.included ? 'warning.main' : undefined,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <Checkbox
          checked={item.included}
          onChange={handleToggleIncluded}
          size="small"
          sx={{ mt: -0.5, mr: 1 }}
        />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
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
            {isAiParsed && (
              <Tooltip title="From the buyer's SOW (parsed by AI)">
                <Chip
                  icon={<AiIcon fontSize="small" />}
                  label="From SOW"
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              </Tooltip>
            )}
            {!item.included && (
              <Chip label="Excluded from offer" size="small" color="warning" variant="filled" />
            )}
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
          {!item.included && item.exclusionReason && pendingReason === null && (
            <Box
              sx={{
                mt: 1,
                pl: 1.5,
                py: 0.5,
                borderLeft: 3,
                borderColor: 'warning.light',
                bgcolor: 'action.hover',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Clarification for the client
              </Typography>
              <Typography variant="body2">{item.exclusionReason}</Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton onClick={() => setEditing(true)} size="small" aria-label="Edit">
            <EditIcon fontSize="small" />
          </IconButton>
          {item.included ? (
            <Tooltip title={isAiParsed ? 'Exclude from the offer (requires a reason)' : 'Remove'}>
              <IconButton
                onClick={handleRemoveClick}
                size="small"
                color={isAiParsed ? 'warning' : 'error'}
                aria-label={isAiParsed ? 'Exclude' : 'Remove'}
              >
                {isAiParsed ? <ExcludeIcon fontSize="small" /> : <DeleteIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          ) : (
            isAiParsed && (
              <Tooltip title="Re-include">
                <IconButton onClick={handleReinclude} size="small" aria-label="Re-include">
                  <ReincludeIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )
          )}
        </Box>
      </Box>

      {/* Inline reason capture when excluding an AI-parsed item */}
      {pendingReason !== null && (
        <Box
          sx={{
            mt: 1.5,
            p: 1.5,
            bgcolor: 'warning.light',
            borderRadius: 1,
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Reason for excluding from the offer
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            This clarification will appear on the client PDF, alongside the original item.
          </Typography>
          <TextField
            fullWidth
            size="small"
            autoFocus
            multiline
            minRows={1}
            value={pendingReason}
            onChange={(e) => setPendingReason(e.target.value)}
            placeholder='e.g. "Per SOW §3.4, only a brief CSP assessment is required."'
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} justifyContent="flex-end">
            <Button size="small" onClick={cancelExclude}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              color="warning"
              onClick={confirmExclude}
              disabled={pendingReason.trim().length === 0}
            >
              Confirm exclusion
            </Button>
          </Stack>
        </Box>
      )}
    </Paper>
  );
}

export function ChecklistItemList({
  items,
  currentCategoryKey,
  allCategories,
  onUpdateItem,
  onDeleteItem,
}: ChecklistItemListProps) {
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
          currentCategoryKey={currentCategoryKey}
          allCategories={allCategories}
          onUpdate={onUpdateItem}
          onDelete={onDeleteItem}
        />
      ))}
    </Box>
  );
}
