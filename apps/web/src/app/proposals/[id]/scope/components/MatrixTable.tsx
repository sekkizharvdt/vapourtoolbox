'use client';

/**
 * Matrix Table Component
 *
 * Renders scope items as a table with activity column checkboxes.
 * Used for MATRIX-type scope categories (Manufactured, Bought Out, Fabrication).
 * Features a sticky first column, horizontal scroll, and row-level include/exclude toggles.
 */

import { useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import type { UnifiedScopeItem, ActivityColumn, ScopeItemClassification } from '@vapour/types';
import { SCOPE_ITEM_CLASSIFICATION_LABELS } from '@vapour/types';

interface MatrixTableProps {
  items: UnifiedScopeItem[];
  activityColumns: ActivityColumn[];
  defaultClassification: ScopeItemClassification;
  onUpdateItem: (item: UnifiedScopeItem) => void;
  onDeleteItem: (itemId: string) => void;
}

/** Inline dialog for editing item name, description, classification */
function EditItemDialog({
  open,
  item,
  onClose,
  onSave,
}: {
  open: boolean;
  item: UnifiedScopeItem;
  onClose: () => void;
  onSave: (item: UnifiedScopeItem) => void;
}) {
  const [editedItem, setEditedItem] = useState(item);

  const handleSave = () => {
    onSave(editedItem);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Item</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
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
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!editedItem.name.trim()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function MatrixTable({
  items,
  activityColumns,
  onUpdateItem,
  onDeleteItem,
}: MatrixTableProps) {
  const [editingItem, setEditingItem] = useState<UnifiedScopeItem | null>(null);

  const handleToggleIncluded = (item: UnifiedScopeItem) => {
    onUpdateItem({ ...item, included: !item.included });
  };

  const handleToggleActivity = (item: UnifiedScopeItem, activityId: string) => {
    const currentToggles = item.activityToggles || {};
    onUpdateItem({
      ...item,
      activityToggles: {
        ...currentToggles,
        [activityId]: !currentToggles[activityId],
      },
    });
  };

  const handleToggleAllActivities = (item: UnifiedScopeItem, checked: boolean) => {
    const newToggles: Record<string, boolean> = {};
    activityColumns.forEach((col) => {
      newToggles[col.id] = checked;
    });
    onUpdateItem({ ...item, activityToggles: newToggles });
  };

  if (items.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">
          No items in this category. Click &ldquo;+ Add Item&rdquo; to add one.
        </Typography>
      </Paper>
    );
  }

  // Sticky first column styles
  const stickyNameCellSx = {
    position: 'sticky' as const,
    left: 0,
    bgcolor: 'background.paper',
    zIndex: 2,
    borderRight: 1,
    borderColor: 'divider',
    minWidth: 220,
    maxWidth: 280,
  };

  const stickyHeaderCellSx = {
    ...stickyNameCellSx,
    zIndex: 3,
    bgcolor: 'action.hover',
  };

  return (
    <>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ overflowX: 'auto', maxWidth: '100%' }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={stickyHeaderCellSx}>
                <Typography variant="caption" fontWeight="bold">
                  Item
                </Typography>
              </TableCell>
              {activityColumns.map((col) => (
                <Tooltip key={col.id} title={col.label} placement="top">
                  <TableCell
                    align="center"
                    sx={{
                      bgcolor: 'action.hover',
                      px: 0.5,
                      minWidth: 56,
                      maxWidth: 56,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.65rem',
                        lineHeight: 1.2,
                        display: 'block',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.shortLabel}
                    </Typography>
                  </TableCell>
                </Tooltip>
              ))}
              <TableCell align="center" sx={{ bgcolor: 'action.hover', minWidth: 100 }}>
                <Typography variant="caption" fontWeight="bold">
                  Actions
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => {
              const toggles = item.activityToggles || {};
              const allChecked = activityColumns.every((col) => toggles[col.id]);
              const someChecked = activityColumns.some((col) => toggles[col.id]);

              return (
                <TableRow
                  key={item.id}
                  sx={{
                    opacity: item.included ? 1 : 0.4,
                    bgcolor: item.included ? 'inherit' : 'action.disabledBackground',
                  }}
                >
                  {/* Sticky name column */}
                  <TableCell
                    sx={{
                      ...stickyNameCellSx,
                      bgcolor: item.included ? 'background.paper' : 'action.disabledBackground',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Checkbox
                        checked={item.included}
                        onChange={() => handleToggleIncluded(item)}
                        size="small"
                        sx={{ p: 0.25 }}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          noWrap
                          sx={{
                            textDecoration: item.included ? 'none' : 'line-through',
                            fontSize: '0.8rem',
                          }}
                        >
                          {item.name}
                        </Typography>
                        <Chip
                          label={SCOPE_ITEM_CLASSIFICATION_LABELS[item.classification]}
                          size="small"
                          variant="outlined"
                          color={item.classification === 'SERVICE' ? 'primary' : 'secondary'}
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                      </Box>
                    </Box>
                  </TableCell>

                  {/* Activity toggle cells */}
                  {activityColumns.map((col) => (
                    <TableCell key={col.id} align="center" sx={{ px: 0 }}>
                      <Checkbox
                        checked={!!toggles[col.id]}
                        onChange={() => handleToggleActivity(item, col.id)}
                        disabled={!item.included}
                        size="small"
                        sx={{ p: 0.25 }}
                      />
                    </TableCell>
                  ))}

                  {/* Actions column */}
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    {item.included && (
                      <Tooltip
                        title={allChecked ? 'Uncheck all activities' : 'Check all activities'}
                      >
                        <Checkbox
                          checked={allChecked}
                          indeterminate={someChecked && !allChecked}
                          onChange={(e) => handleToggleAllActivities(item, e.target.checked)}
                          size="small"
                          sx={{ p: 0.25 }}
                        />
                      </Tooltip>
                    )}
                    <IconButton size="small" onClick={() => setEditingItem(item)}>
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => onDeleteItem(item.id)}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {editingItem && (
        <EditItemDialog
          open={!!editingItem}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(updatedItem) => {
            onUpdateItem(updatedItem);
            setEditingItem(null);
          }}
        />
      )}
    </>
  );
}
