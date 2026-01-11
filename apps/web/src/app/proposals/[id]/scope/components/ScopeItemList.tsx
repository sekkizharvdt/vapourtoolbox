'use client';

/**
 * Scope Item List Component
 *
 * Displays scope items grouped by project phase with inline editing.
 */

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  TextField,
  Chip,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  DragIndicator as DragIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import type { ScopeItem, ScopeItemType, ProjectPhase } from '@vapour/types';
import { PROJECT_PHASE_LABELS, PROJECT_PHASE_ORDER } from '@vapour/types';

interface ScopeItemListProps {
  items: ScopeItem[];
  type: ScopeItemType;
  onUpdate: (item: ScopeItem) => void;
  onDelete: (itemId: string, type: ScopeItemType) => void;
  onReorder: (items: ScopeItem[]) => void;
  allItems: ScopeItem[]; // For showing relationships
}

interface PhaseGroupProps {
  phase: ProjectPhase | 'UNASSIGNED';
  items: ScopeItem[];
  type: ScopeItemType;
  onUpdate: (item: ScopeItem) => void;
  onDelete: (itemId: string) => void;
  allItems: ScopeItem[];
}

function PhaseGroup({ phase, items, type, onUpdate, onDelete, allItems }: PhaseGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const phaseLabel = phase === 'UNASSIGNED' ? 'Unassigned' : PROJECT_PHASE_LABELS[phase];

  if (items.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1.5,
          bgcolor: 'action.hover',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <IconButton size="small" sx={{ mr: 1 }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          {phaseLabel}
        </Typography>
        <Chip label={items.length} size="small" />
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ p: 1 }}>
          {items.map((item) => (
            <ScopeItemCard
              key={item.id}
              item={item}
              type={type}
              onUpdate={onUpdate}
              onDelete={onDelete}
              allItems={allItems}
            />
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
}

interface ScopeItemCardProps {
  item: ScopeItem;
  type: ScopeItemType;
  onUpdate: (item: ScopeItem) => void;
  onDelete: (itemId: string) => void;
  allItems: ScopeItem[];
}

function ScopeItemCard({ item, type, onUpdate, onDelete, allItems }: ScopeItemCardProps) {
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

  // Find related items
  const relatedItems = (item.relatedItems || [])
    .map((id) => allItems.find((i) => i.id === id))
    .filter(Boolean) as ScopeItem[];

  const dependsOnItems = (item.dependsOn || [])
    .map((id) => allItems.find((i) => i.id === id))
    .filter(Boolean) as ScopeItem[];

  if (editing) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 2, mb: 1, bgcolor: 'background.default' }}
      >
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
            value={editedItem.description}
            onChange={(e) => setEditedItem({ ...editedItem, description: e.target.value })}
            fullWidth
            size="small"
            multiline
            rows={2}
          />
          {type === 'SUPPLY' && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Quantity"
                type="number"
                value={editedItem.quantity || ''}
                onChange={(e) => setEditedItem({ ...editedItem, quantity: Number(e.target.value) || undefined })}
                size="small"
                sx={{ width: 120 }}
              />
              <TextField
                label="Unit"
                value={editedItem.unit || ''}
                onChange={(e) => setEditedItem({ ...editedItem, unit: e.target.value })}
                size="small"
                sx={{ width: 120 }}
                placeholder="nos, kg, m, lot"
              />
            </Box>
          )}
          {type === 'SERVICE' && (
            <TextField
              label="Deliverable"
              value={editedItem.deliverable || ''}
              onChange={(e) => setEditedItem({ ...editedItem, deliverable: e.target.value })}
              fullWidth
              size="small"
              placeholder="What output is produced?"
            />
          )}
          <TextField
            label="Notes"
            value={editedItem.notes || ''}
            onChange={(e) => setEditedItem({ ...editedItem, notes: e.target.value })}
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
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ mr: 1, color: 'text.secondary', cursor: 'grab' }}>
        <DragIcon fontSize="small" />
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="body2" fontWeight="medium">
            {item.itemNumber}
          </Typography>
          <Typography variant="body2" fontWeight="medium" noWrap>
            {item.name}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {item.description}
        </Typography>
        {type === 'SUPPLY' && item.quantity && (
          <Typography variant="caption" color="text.secondary">
            Qty: {item.quantity} {item.unit}
          </Typography>
        )}
        {type === 'SERVICE' && item.deliverable && (
          <Typography variant="caption" color="text.secondary">
            Deliverable: {item.deliverable}
          </Typography>
        )}
        {(relatedItems.length > 0 || dependsOnItems.length > 0) && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            {dependsOnItems.map((related) => (
              <Tooltip key={related.id} title={`Depends on: ${related.name}`}>
                <Chip
                  icon={<LinkIcon />}
                  label={related.itemNumber}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              </Tooltip>
            ))}
            {relatedItems.map((related) => (
              <Tooltip key={related.id} title={`Related: ${related.name}`}>
                <Chip
                  label={related.itemNumber}
                  size="small"
                  variant="outlined"
                />
              </Tooltip>
            ))}
          </Box>
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

export function ScopeItemList({
  items,
  type,
  onUpdate,
  onDelete,
  onReorder: _onReorder, // TODO: Implement drag-and-drop reordering
  allItems,
}: ScopeItemListProps) {
  // Group items by phase
  const groupedItems: Record<ProjectPhase | 'UNASSIGNED', ScopeItem[]> = {
    ENGINEERING: [],
    PROCUREMENT: [],
    MANUFACTURING: [],
    LOGISTICS: [],
    SITE: [],
    COMMISSIONING: [],
    DOCUMENTATION: [],
    UNASSIGNED: [],
  };

  items.forEach((item) => {
    const phase = item.phase || 'UNASSIGNED';
    groupedItems[phase].push(item);
  });

  // For exclusions, don't group by phase (they typically don't have phases)
  if (type === 'EXCLUSION') {
    return (
      <Box>
        {items.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}
          >
            <Typography variant="body2">
              No exclusions defined. Add items that are explicitly NOT included in the scope.
            </Typography>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: 1 }}>
            {items.map((item) => (
              <ScopeItemCard
                key={item.id}
                item={item}
                type={type}
                onUpdate={onUpdate}
                onDelete={(id) => onDelete(id, type)}
                allItems={allItems}
              />
            ))}
          </Paper>
        )}
      </Box>
    );
  }

  // For services and supply, group by phase
  const hasItems = items.length > 0;

  return (
    <Box>
      {!hasItems ? (
        <Paper
          variant="outlined"
          sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}
        >
          <Typography variant="body2">
            {type === 'SERVICE'
              ? 'No services defined. Add work activities performed by VDT.'
              : 'No supply items defined. Add physical items to be delivered.'}
          </Typography>
        </Paper>
      ) : (
        <>
          {PROJECT_PHASE_ORDER.map((phase) => (
            <PhaseGroup
              key={phase}
              phase={phase}
              items={groupedItems[phase]}
              type={type}
              onUpdate={onUpdate}
              onDelete={(id) => onDelete(id, type)}
              allItems={allItems}
            />
          ))}
          {groupedItems.UNASSIGNED.length > 0 && (
            <PhaseGroup
              phase="UNASSIGNED"
              items={groupedItems.UNASSIGNED}
              type={type}
              onUpdate={onUpdate}
              onDelete={(id) => onDelete(id, type)}
              allItems={allItems}
            />
          )}
        </>
      )}
    </Box>
  );
}
