import React, { useState } from 'react';
import {
  Box,
  Typography,
  SxProps,
  Theme,
  IconButton,
  Popover,
  Button,
  Divider,
  Tooltip,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import MenuBookIcon from '@mui/icons-material/MenuBook';

export interface PageHelpContent {
  /**
   * Brief description of what this page does
   */
  description: string;

  /**
   * Quick tips for using this page (2-4 bullet points)
   */
  tips: string[];

  /**
   * Section ID in the guide to link to (e.g., 'hr', 'procurement', 'accounting')
   */
  guideSection?: string;
}

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

  /**
   * Optional help content for this page
   */
  help?: PageHelpContent;
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
  help,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleHelpClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleHelpClose = () => {
    setAnchorEl(null);
  };

  const helpOpen = Boolean(anchorEl);

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom={!!subtitle}>
            {title}
          </Typography>
          {help && (
            <>
              <Tooltip title="Page help">
                <IconButton
                  size="small"
                  onClick={handleHelpClick}
                  sx={{ mb: subtitle ? 1 : 0 }}
                  aria-label="Page help"
                >
                  <HelpOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Popover
                open={helpOpen}
                anchorEl={anchorEl}
                onClose={handleHelpClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'left',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'left',
                }}
                slotProps={{
                  paper: {
                    sx: { maxWidth: 360, p: 2 },
                  },
                }}
              >
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  {title}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {help.description}
                </Typography>

                {help.tips.length > 0 && (
                  <>
                    <Typography variant="subtitle2" gutterBottom>
                      Quick Tips
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, mt: 0, mb: 2 }}>
                      {help.tips.map((tip, index) => (
                        <li key={index}>
                          <Typography variant="body2" color="text.secondary">
                            {tip}
                          </Typography>
                        </li>
                      ))}
                    </Box>
                  </>
                )}

                {help.guideSection && (
                  <>
                    <Divider sx={{ my: 1.5 }} />
                    <Button
                      component="a"
                      href={`/guide#${help.guideSection}`}
                      startIcon={<MenuBookIcon />}
                      size="small"
                      fullWidth
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      View full documentation
                    </Button>
                  </>
                )}
              </Popover>
            </>
          )}
        </Box>
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
