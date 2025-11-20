import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';

export interface TableAction {
  /**
   * Icon element to display
   */
  icon: React.ReactElement;

  /**
   * Tooltip label for the action
   */
  label: string;

  /**
   * Click handler
   */
  onClick: () => void;

  /**
   * Whether to show this action (for conditional rendering)
   * @default true
   */
  show?: boolean;

  /**
   * Whether the action is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Color of the icon button
   */
  color?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
}

export interface TableActionCellProps {
  /**
   * Array of actions to display
   */
  actions: TableAction[];

  /**
   * Size of icon buttons
   * @default 'small'
   */
  size?: 'small' | 'medium' | 'large';
}

/**
 * Standardized table action cell component
 * Provides consistent styling for action buttons in table rows
 *
 * @example
 * ```tsx
 * <TableActionCell
 *   actions={[
 *     {
 *       icon: <VisibilityIcon />,
 *       label: 'View',
 *       onClick: () => handleView(row.id),
 *     },
 *     {
 *       icon: <EditIcon />,
 *       label: 'Edit',
 *       onClick: () => handleEdit(row.id),
 *       show: canEdit,
 *     },
 *     {
 *       icon: <DeleteIcon />,
 *       label: 'Delete',
 *       onClick: () => handleDelete(row.id),
 *       color: 'error',
 *       show: canDelete,
 *     },
 *   ]}
 * />
 * ```
 */
export const TableActionCell: React.FC<TableActionCellProps> = ({ actions, size = 'small' }) => {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
      {actions
        .filter((action) => action.show !== false)
        .map((action, index) => (
          <Tooltip key={index} title={action.label}>
            <span>
              <IconButton
                size={size}
                onClick={action.onClick}
                disabled={action.disabled}
                color={action.color}
                aria-label={action.label}
              >
                {action.icon}
              </IconButton>
            </span>
          </Tooltip>
        ))}
    </Box>
  );
};
