// Vapour Toolbox Theme
// Material UI v7 with Vapour Desal branding

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { brandColors, semanticColors, neutralColors, backgroundColors } from './colors';
import { typography } from './typography';

/**
 * Main theme configuration with Vapour branding
 */
const themeOptions: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: brandColors.primary,
    secondary: brandColors.secondary,
    success: semanticColors.success,
    warning: semanticColors.warning,
    error: semanticColors.error,
    info: semanticColors.info,
    background: backgroundColors,
    grey: neutralColors,
  },

  typography,

  shape: {
    borderRadius: 8,
  },

  spacing: 8,

  breakpoints: {
    values: {
      xs: 0,      // Mobile phones (portrait)
      sm: 600,    // Mobile phones (landscape) / Small tablets
      md: 900,    // Tablets / Small laptops
      lg: 1200,   // Desktop / Large tablets (landscape)
      xl: 1536,   // Large desktop
    },
  },

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          // Desktop-optimized sizing
          minHeight: 40,
          padding: '8px 16px',
          // Larger on mobile for touch
          '@media (max-width: 600px)': {
            minHeight: 48,
            padding: '12px 24px',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        sizeSmall: {
          minHeight: 32,
          padding: '6px 12px',
        },
        sizeLarge: {
          minHeight: 48,
          padding: '12px 24px',
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          },
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          border: 'none',
          boxShadow: '2px 0 8px rgb(0 0 0 / 0.1)',
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          // Desktop: Standard sizing
          '& .MuiInputBase-root': {
            minHeight: 40,
          },
          // Mobile: Larger for touch
          '@media (max-width: 600px)': {
            '& .MuiInputBase-root': {
              minHeight: 48,
            },
          },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          // Desktop: Standard size
          padding: 8,
          // Mobile: Larger touch targets
          '@media (max-width: 600px)': {
            padding: 12,
          },
        },
      },
    },

    MuiListItem: {
      styleOverrides: {
        root: {
          // Desktop: Compact
          minHeight: 48,
          paddingTop: 8,
          paddingBottom: 8,
          // Mobile: Comfortable touch targets
          '@media (max-width: 600px)': {
            minHeight: 56,
            paddingTop: 12,
            paddingBottom: 12,
          },
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          // Desktop: Standard padding
          padding: '12px 16px',
          // Mobile: More padding
          '@media (max-width: 600px)': {
            padding: '16px',
          },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          // Desktop: Standard modal
          margin: 32,
          // Mobile: Near full-screen
          '@media (max-width: 600px)': {
            margin: 16,
            maxHeight: 'calc(100% - 32px)',
          },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
};

/**
 * Create and export the theme
 */
export const vapourTheme = createTheme(themeOptions);

/**
 * Export dark theme
 */
export { vapourDarkTheme } from './darkTheme';

/**
 * Export theme provider and hook
 */
export { VapourThemeProvider, useThemeMode } from './ThemeProvider';

/**
 * Export for re-export
 */
export { brandColors, semanticColors, neutralColors, typography };
