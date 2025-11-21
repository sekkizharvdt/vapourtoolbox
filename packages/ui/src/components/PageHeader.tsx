import React from 'react';
import { Box, Typography, SxProps, Theme } from '@mui/material';

export interface PageHeaderProps {
  /**
   * Main page title
   */
  title: string;

  /**
   * Optional subtitle or description
   */
  subtitle?: string;

  /**
   * Optional action button or component (e.g., "New" button)
   */
  action?: React.ReactNode;

  /**
   * Custom sx props for the container
   */
  sx?: SxProps<Theme>;

  /**
   * Optional children to render (e.g. status chips)
   */
  children?: React.ReactNode;
}

/**
 * Standardized page header component
 * Provides consistent spacing and layout for page titles with optional actions
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  action,
  sx,
  children,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        mb: 3,
        ...sx,
      }}
    >
      <Box>
        <Typography variant="h4" component="h1" gutterBottom={!!subtitle}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
        {children && <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>{children}</Box>}
      </Box>
      {action && <Box>{action}</Box>}
    </Box>
  );
};
