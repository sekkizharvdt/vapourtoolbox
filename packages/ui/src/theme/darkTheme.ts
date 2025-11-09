// Dark Mode Theme Configuration

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { brandColors, semanticColors, neutralColors, darkBackgroundColors } from './colors';
import { typography } from './typography';

/**
 * Dark mode theme configuration
 */
const darkThemeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      ...brandColors.primary,
      // Adjust for dark mode visibility
      main: '#22D3EE', // Brighter cyan for dark backgrounds
      light: '#7DD3FC',
      dark: '#0891B2',
    },
    secondary: {
      ...brandColors.secondary,
      main: '#60A5FA', // Brighter blue
      light: '#93C5FD',
      dark: '#3B82F6',
    },
    success: semanticColors.success,
    warning: semanticColors.warning,
    error: semanticColors.error,
    info: {
      ...semanticColors.info,
      main: '#60A5FA', // Brighter for dark mode
    },
    background: darkBackgroundColors,
    grey: neutralColors,
    text: {
      primary: '#F1F5F9', // Light slate
      secondary: '#CBD5E1', // Medium slate
      disabled: '#64748B', // Dark slate
    },
  },

  typography,

  shape: {
    borderRadius: 8,
  },

  spacing: 8,

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.3)',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.4)',
          },
        },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.3)',
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          border: 'none',
          backgroundImage: 'none',
          boxShadow: '2px 0 8px rgb(0 0 0 / 0.3)',
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

    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
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
 * Create and export the dark theme
 */
export const vapourDarkTheme = createTheme(darkThemeOptions);
