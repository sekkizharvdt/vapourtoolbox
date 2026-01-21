'use client';

/**
 * EmptyState Component
 *
 * Standardized empty state display for tables, lists, and containers.
 * Use this component instead of ad-hoc empty state implementations.
 *
 * @example
 * // Basic usage
 * <EmptyState
 *   title="No transactions found"
 *   description="Create your first transaction to get started"
 * />
 *
 * @example
 * // With icon and action
 * <EmptyState
 *   icon={<InboxIcon />}
 *   title="No messages"
 *   description="Your inbox is empty"
 *   action={<Button onClick={handleRefresh}>Refresh</Button>}
 * />
 *
 * @example
 * // Compact variant for tables
 * <EmptyState
 *   variant="compact"
 *   title="No items"
 * />
 */

import { Box, Typography, Button, Paper, Stack } from '@mui/material';
import {
  Inbox as InboxIcon,
  SearchOff as SearchOffIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /**
   * Main title text
   */
  title: string;

  /**
   * Optional description text
   */
  description?: string;

  /**
   * Custom icon to display. If not provided, uses default based on variant.
   */
  icon?: ReactNode;

  /**
   * Action button or element to display
   */
  action?: ReactNode;

  /**
   * Primary action button text (shorthand for simple button)
   */
  actionLabel?: string;

  /**
   * Primary action button click handler
   */
  onAction?: () => void;

  /**
   * Display variant
   * - 'default': Full height with centered content and icon
   * - 'compact': Minimal height for inline/table usage
   * - 'search': For search results with no matches
   */
  variant?: 'default' | 'compact' | 'search';

  /**
   * Whether to wrap in a Paper component
   */
  paper?: boolean;

  /**
   * Custom minimum height (for default variant)
   */
  minHeight?: number | string;
}

/**
 * Get default icon based on variant
 */
function getDefaultIcon(variant: EmptyStateProps['variant']): ReactNode {
  switch (variant) {
    case 'search':
      return <SearchOffIcon sx={{ fontSize: 48, color: 'text.disabled' }} />;
    case 'compact':
      return null;
    default:
      return <InboxIcon sx={{ fontSize: 64, color: 'text.disabled' }} />;
  }
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  actionLabel,
  onAction,
  variant = 'default',
  paper = false,
  minHeight,
}: EmptyStateProps) {
  const displayIcon = icon !== undefined ? icon : getDefaultIcon(variant);

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: variant === 'compact' ? 3 : 6,
        px: 3,
        minHeight: minHeight ?? (variant === 'default' ? 300 : undefined),
      }}
    >
      <Stack spacing={2} alignItems="center">
        {displayIcon && <Box>{displayIcon}</Box>}

        <Box>
          <Typography
            variant={variant === 'compact' ? 'body1' : 'h6'}
            color="text.secondary"
            gutterBottom={!!description}
          >
            {title}
          </Typography>

          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>
              {description}
            </Typography>
          )}
        </Box>

        {/* Action button */}
        {action ||
          (actionLabel && onAction && (
            <Button variant="contained" onClick={onAction} sx={{ mt: 1 }}>
              {actionLabel}
            </Button>
          ))}
      </Stack>
    </Box>
  );

  if (paper) {
    return (
      <Paper variant="outlined" sx={{ bgcolor: 'background.default' }}>
        {content}
      </Paper>
    );
  }

  return content;
}

/**
 * Preset: No results found (for search)
 */
export function NoResultsFound({
  searchTerm,
  onClear,
}: {
  searchTerm?: string;
  onClear?: () => void;
}) {
  return (
    <EmptyState
      variant="search"
      title={searchTerm ? `No results for "${searchTerm}"` : 'No results found'}
      description="Try adjusting your search or filters"
      action={
        onClear ? (
          <Button variant="outlined" onClick={onClear} size="small">
            Clear Search
          </Button>
        ) : undefined
      }
    />
  );
}

/**
 * Preset: Empty folder/list
 */
export function EmptyFolder({
  title = 'No items',
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      icon={<FolderOpenIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
      title={title}
      description={description}
    />
  );
}

export default EmptyState;
