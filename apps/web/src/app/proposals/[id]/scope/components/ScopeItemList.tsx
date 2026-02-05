'use client';

/**
 * Scope Item List Component
 *
 * Displays scope items grouped by project phase with inline editing and BOM linking.
 * Supports drag-and-drop reordering within phase groups.
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
  Button,
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
  Receipt as BOMIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ScopeItem, ScopeItemType, ProjectPhase, LinkedBOM } from '@vapour/types';
import { PROJECT_PHASE_LABELS, PROJECT_PHASE_ORDER } from '@vapour/types';
import { LinkBOMDialog } from './LinkBOMDialog';

interface ScopeItemListProps {
  items: ScopeItem[];
  type: ScopeItemType;
  onUpdate: (item: ScopeItem) => void;
  onDelete: (itemId: string, type: ScopeItemType) => void;
  onReorder: (items: ScopeItem[]) => void;
  allItems: ScopeItem[]; // For showing relationships
  // Proposal context for BOM linking
  proposalId?: string;
  proposalNumber?: string;
  enquiryId?: string;
  enquiryNumber?: string;
}

interface PhaseGroupProps {
  phase: ProjectPhase | 'UNASSIGNED';
  items: ScopeItem[];
  type: ScopeItemType;
  onUpdate: (item: ScopeItem) => void;
  onDelete: (itemId: string) => void;
  onReorderPhase: (phaseItems: ScopeItem[]) => void;
  allItems: ScopeItem[];
  proposalId?: string;
  proposalNumber?: string;
  enquiryId?: string;
  enquiryNumber?: string;
}

function PhaseGroup({
  phase,
  items,
  type,
  onUpdate,
  onDelete,
  onReorderPhase,
  allItems,
  proposalId,
  proposalNumber,
  enquiryId,
  enquiryNumber,
}: PhaseGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const phaseLabel = phase === 'UNASSIGNED' ? 'Unassigned' : PROJECT_PHASE_LABELS[phase];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const reordered = arrayMove(items, oldIndex, newIndex);
      onReorderPhase(reordered);
    }
  };

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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item) => (
                <SortableScopeItemCard
                  key={item.id}
                  item={item}
                  type={type}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  allItems={allItems}
                  proposalId={proposalId}
                  proposalNumber={proposalNumber}
                  enquiryId={enquiryId}
                  enquiryNumber={enquiryNumber}
                />
              ))}
            </SortableContext>
          </DndContext>
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
  proposalId?: string;
  proposalNumber?: string;
  enquiryId?: string;
  enquiryNumber?: string;
  dragHandleProps?: Record<string, unknown>;
}

function ScopeItemCard({
  item,
  type,
  onUpdate,
  onDelete,
  allItems,
  proposalId,
  proposalNumber,
  enquiryId,
  enquiryNumber,
  dragHandleProps,
}: ScopeItemCardProps) {
  const [editing, setEditing] = useState(false);
  const [editedItem, setEditedItem] = useState(item);
  const [linkBOMDialogOpen, setLinkBOMDialogOpen] = useState(false);

  // Check if BOM linking is enabled (has proposal context and not an exclusion)
  const canLinkBOM = proposalId && proposalNumber && type !== 'EXCLUSION';

  const formatCurrency = (money: { amount: number; currency: string }) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: money.currency,
      maximumFractionDigits: 0,
    }).format(money.amount);
  };

  const handleLinkBOMs = (linkedBOMs: LinkedBOM[]) => {
    const existingBOMs = item.linkedBOMs || [];
    const allLinkedBOMs = [...existingBOMs, ...linkedBOMs];

    // Calculate estimation summary
    const totalCost = allLinkedBOMs.reduce((sum, bom) => sum + bom.totalCost.amount, 0);
    const currency = allLinkedBOMs[0]?.totalCost.currency || 'INR';

    const updatedItem: ScopeItem = {
      ...item,
      linkedBOMs: allLinkedBOMs,
      estimationSummary: {
        totalCost: { amount: totalCost, currency },
        bomCount: allLinkedBOMs.length,
      },
    };

    onUpdate(updatedItem);
  };

  const handleUnlinkBOM = (bomId: string) => {
    const remainingBOMs = (item.linkedBOMs || []).filter((bom) => bom.bomId !== bomId);
    const totalCost = remainingBOMs.reduce((sum, bom) => sum + bom.totalCost.amount, 0);
    const currency = remainingBOMs[0]?.totalCost.currency || 'INR';

    const updatedItem: ScopeItem = {
      ...item,
      linkedBOMs: remainingBOMs.length > 0 ? remainingBOMs : undefined,
      estimationSummary:
        remainingBOMs.length > 0
          ? {
              totalCost: { amount: totalCost, currency },
              bomCount: remainingBOMs.length,
            }
          : undefined,
    };

    onUpdate(updatedItem);
  };

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
                onChange={(e) =>
                  setEditedItem({ ...editedItem, quantity: Number(e.target.value) || undefined })
                }
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

  const linkedBOMs = item.linkedBOMs || [];
  const existingLinkedBOMIds = linkedBOMs.map((bom) => bom.bomId);

  return (
    <>
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
        <Box
          sx={{ mr: 1, color: 'text.secondary', cursor: 'grab', touchAction: 'none' }}
          {...dragHandleProps}
        >
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
            {/* Show estimation summary if BOMs are linked */}
            {item.estimationSummary && item.estimationSummary.bomCount > 0 && (
              <Chip
                icon={<BOMIcon />}
                label={formatCurrency(item.estimationSummary.totalCost)}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
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

          {/* Show linked BOMs */}
          {linkedBOMs.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, display: 'block' }}
              >
                Linked BOMs ({linkedBOMs.length}):
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {linkedBOMs.map((bom) => (
                  <Tooltip
                    key={bom.bomId}
                    title={`${bom.bomName} - ${formatCurrency(bom.totalCost)}. Click × to unlink.`}
                  >
                    <Chip
                      icon={<BOMIcon />}
                      label={bom.bomCode}
                      size="small"
                      variant="outlined"
                      color="primary"
                      onDelete={() => handleUnlinkBOM(bom.bomId)}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>
          )}

          {/* Link BOM button for SERVICE and SUPPLY items */}
          {canLinkBOM && (
            <Box sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="text"
                startIcon={<AddIcon />}
                onClick={() => setLinkBOMDialogOpen(true)}
                sx={{ textTransform: 'none' }}
              >
                Link BOM
              </Button>
            </Box>
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
                  <Chip label={related.itemNumber} size="small" variant="outlined" />
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

      {/* Link BOM Dialog */}
      {canLinkBOM && (
        <LinkBOMDialog
          open={linkBOMDialogOpen}
          onClose={() => setLinkBOMDialogOpen(false)}
          scopeItem={item}
          proposalId={proposalId!}
          proposalNumber={proposalNumber!}
          enquiryId={enquiryId}
          enquiryNumber={enquiryNumber}
          onLink={handleLinkBOMs}
          existingLinkedBOMIds={existingLinkedBOMIds}
        />
      )}
    </>
  );
}

/**
 * Sortable wrapper for ScopeItemCard that enables drag-and-drop
 */
function SortableScopeItemCard(props: ScopeItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ScopeItemCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

export function ScopeItemList({
  items,
  type,
  onUpdate,
  onDelete,
  onReorder,
  allItems,
  proposalId,
  proposalNumber,
  enquiryId,
  enquiryNumber,
}: ScopeItemListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  /**
   * Handle reordering within a phase group
   * Updates the order of items within the phase and calls onReorder with the full list
   */
  const handlePhaseReorder = (
    phase: ProjectPhase | 'UNASSIGNED',
    reorderedPhaseItems: ScopeItem[]
  ) => {
    // Build the new complete list by replacing items in this phase
    const newItems: ScopeItem[] = [];

    // Add items in phase order
    for (const p of [...PROJECT_PHASE_ORDER, 'UNASSIGNED' as const]) {
      if (p === phase) {
        newItems.push(...reorderedPhaseItems);
      } else {
        newItems.push(...groupedItems[p]);
      }
    }

    onReorder(newItems);
  };

  // For exclusions, don't group by phase (they typically don't have phases)
  if (type === 'EXCLUSION') {
    const handleExclusionDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        onReorder(reordered);
      }
    };

    return (
      <Box>
        {items.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">
              No exclusions defined. Add items that are explicitly NOT included in the scope.
            </Typography>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ p: 1 }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleExclusionDragEnd}
            >
              <SortableContext
                items={items.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.map((item) => (
                  <SortableScopeItemCard
                    key={item.id}
                    item={item}
                    type={type}
                    onUpdate={onUpdate}
                    onDelete={(id) => onDelete(id, type)}
                    allItems={allItems}
                    proposalId={proposalId}
                    proposalNumber={proposalNumber}
                    enquiryId={enquiryId}
                    enquiryNumber={enquiryNumber}
                  />
                ))}
              </SortableContext>
            </DndContext>
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
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
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
              onReorderPhase={(reordered) => handlePhaseReorder(phase, reordered)}
              allItems={allItems}
              proposalId={proposalId}
              proposalNumber={proposalNumber}
              enquiryId={enquiryId}
              enquiryNumber={enquiryNumber}
            />
          ))}
          {groupedItems.UNASSIGNED.length > 0 && (
            <PhaseGroup
              phase="UNASSIGNED"
              items={groupedItems.UNASSIGNED}
              type={type}
              onUpdate={onUpdate}
              onDelete={(id) => onDelete(id, type)}
              onReorderPhase={(reordered) => handlePhaseReorder('UNASSIGNED', reordered)}
              allItems={allItems}
              proposalId={proposalId}
              proposalNumber={proposalNumber}
              enquiryId={enquiryId}
              enquiryNumber={enquiryNumber}
            />
          )}
        </>
      )}
    </Box>
  );
}
