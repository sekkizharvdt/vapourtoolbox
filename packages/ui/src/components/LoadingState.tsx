import React from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  TableRow,
  TableCell,
  SxProps,
  Theme,
} from '@mui/material';

export interface LoadingStateProps {
  /**
   * Optional loading message
   */
  message?: string;

  /**
   * Display variant
   * - 'table': For use in table tbody (renders as TableRow/TableCell)
   * - 'inline': Renders as a simple Box (default)
   * - 'page': Full-page centered loading state with larger spacing
   */
  variant?: 'table' | 'inline' | 'page';

  /**
   * Number of columns to span (only for 'table' variant)
   */
  colSpan?: number;

  /**
   * Size of the spinner
   */
  size?: number;

  /**
   * Custom sx props
   */
  sx?: SxProps<Theme>;
}

/**
 * Standardized loading state component
 * Provides consistent styling for loading indicators across tables, cards, and pages
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  variant = 'inline',
  colSpan = 1,
  size = 40,
  sx,
}) => {
  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: variant === 'page' ? 8 : 4,
        ...sx,
      }}
    >
      <CircularProgress size={size} />
      {message && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {message}
        </Typography>
      )}
    </Box>
  );

  switch (variant) {
    case 'table':
      return (
        <TableRow>
          <TableCell colSpan={colSpan}>{content}</TableCell>
        </TableRow>
      );

    case 'page':
    case 'inline':
    default:
      return content;
  }
};
