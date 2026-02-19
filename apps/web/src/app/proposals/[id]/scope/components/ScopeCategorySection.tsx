'use client';

/**
 * Scope Category Section Component
 *
 * Collapsible section for a single discipline category in the unified scope matrix.
 * Renders either a ChecklistItemList or MatrixTable based on the category's displayType.
 */

import { useState } from 'react';
import { Box, Paper, Typography, IconButton, Collapse, Chip, Button } from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import type { ScopeCategoryEntry, UnifiedScopeItem, ActivityColumn } from '@vapour/types';
import { SCOPE_CATEGORY_DEFAULTS, MATRIX_ACTIVITY_TEMPLATES } from '@vapour/types';
import { ChecklistItemList } from './ChecklistItemList';
import { MatrixTable } from './MatrixTable';

interface ScopeCategorySectionProps {
  category: ScopeCategoryEntry;
  onUpdateItem: (categoryId: string, item: UnifiedScopeItem) => void;
  onDeleteItem: (categoryId: string, itemId: string) => void;
  onAddItem: (categoryId: string) => void;
}

export function ScopeCategorySection({
  category,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
}: ScopeCategorySectionProps) {
  const [expanded, setExpanded] = useState(true);

  const includedCount = category.items.filter((i) => i.included).length;
  const excludedCount = category.items.filter((i) => !i.included).length;
  const defaults = SCOPE_CATEGORY_DEFAULTS[category.categoryKey];

  const activityColumns: ActivityColumn[] = category.activityTemplate
    ? MATRIX_ACTIVITY_TEMPLATES[category.activityTemplate]
    : [];

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      {/* Collapsible Header */}
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
        <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 600 }}>
          {category.label}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mr: 1 }}>
          {category.items.length > 0 ? (
            <>
              <Chip
                label={`${includedCount} included`}
                size="small"
                color="success"
                variant="outlined"
              />
              {excludedCount > 0 && (
                <Chip
                  label={`${excludedCount} excluded`}
                  size="small"
                  color="default"
                  variant="outlined"
                />
              )}
            </>
          ) : (
            <Chip label="Empty" size="small" variant="outlined" />
          )}
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={(e) => {
            e.stopPropagation();
            onAddItem(category.id);
          }}
          sx={{ textTransform: 'none' }}
        >
          Add Item
        </Button>
      </Box>

      {/* Collapsible Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 1.5 }}>
          {category.displayType === 'CHECKLIST' ? (
            <ChecklistItemList
              items={category.items}
              defaultClassification={defaults.defaultClassification}
              onUpdateItem={(item) => onUpdateItem(category.id, item)}
              onDeleteItem={(itemId) => onDeleteItem(category.id, itemId)}
            />
          ) : (
            <MatrixTable
              items={category.items}
              activityColumns={activityColumns}
              defaultClassification={defaults.defaultClassification}
              onUpdateItem={(item) => onUpdateItem(category.id, item)}
              onDeleteItem={(itemId) => onDeleteItem(category.id, itemId)}
            />
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
