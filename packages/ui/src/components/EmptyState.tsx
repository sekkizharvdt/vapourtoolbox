import React from 'react';
import {
  Box,
  Typography,
  TableRow,
  TableCell,
  Card,
  CardContent,
  Paper,
  SxProps,
  Theme,
} from '@mui/material';

export interface EmptyStateProps {
  /**
   * Message to display
   */
  message: string;

  /**
   * Optional action button or component
   */
  action?: React.ReactNode;

  /**
   * Display variant
   * - 'table': For use in table tbody (renders as TableRow/TableCell)
   * - 'card': Renders inside a Card component
   * - 'paper': Renders inside a Paper component
   * - 'inline': Renders as a simple Box (default)
   */
  variant?: 'table' | 'card' | 'paper' | 'inline';

  /**
   * Number of columns to span (only for 'table' variant)
   */
  colSpan?: number;

  /**
   * Custom sx props
   */
  sx?: SxProps<Theme>;
}

/**
 * Standardized empty state component
 * Provides consistent styling for "no data" states across tables, cards, and pages
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  action,
  variant = 'inline',
  colSpan = 1,
  sx,
}) => {
  const content = (
    <Box
      sx={{
        textAlign: 'center',
        py: 4,
        ...sx,
      }}
    >
      <Typography variant="body1" color="text.secondary" gutterBottom>
        {message}
      </Typography>
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );

  switch (variant) {
    case 'table':
      return (
        <TableRow>
          <TableCell colSpan={colSpan}>{content}</TableCell>
        </TableRow>
      );

    case 'card':
      return (
        <Card>
          <CardContent>{content}</CardContent>
        </Card>
      );

    case 'paper':
      return <Paper>{content}</Paper>;

    case 'inline':
    default:
      return content;
  }
};
