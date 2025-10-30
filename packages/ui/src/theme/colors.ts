// Vapour Brand Colors
// Extracted from Vapour Desal logo

/**
 * Primary brand colors from logo gradient
 * - Light Blue (top): #7DD3FC
 * - Cyan (middle): #0891B2
 * - Navy (bottom): #1E3A8A
 */
export const brandColors = {
  primary: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC', // Light blue (logo top)
    400: '#38BDF8',
    500: '#0891B2', // Cyan (logo middle) - MAIN
    600: '#0E7490',
    700: '#155E75',
    800: '#1E3A8A', // Navy (logo bottom)
    900: '#164E63',
    main: '#0891B2',
    light: '#7DD3FC',
    dark: '#1E3A8A',
    contrastText: '#FFFFFF',
  },

  secondary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6', // Blue (Vapour text) - MAIN
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
    main: '#3B82F6',
    light: '#60A5FA',
    dark: '#2563EB',
    contrastText: '#FFFFFF',
  },

  accent: {
    50: '#ECFEFF',
    100: '#CFFAFE',
    200: '#A5F3FC',
    300: '#67E8F9',
    400: '#22D3EE',
    500: '#06B6D4', // Bright cyan (Desal text) - MAIN
    600: '#0891B2',
    700: '#0E7490',
    800: '#155E75',
    900: '#164E63',
    main: '#06B6D4',
    light: '#22D3EE',
    dark: '#0E7490',
    contrastText: '#FFFFFF',
  },
};

/**
 * Semantic colors for status indicators
 */
export const semanticColors = {
  success: {
    main: '#10B981', // Green
    light: '#34D399',
    dark: '#059669',
    contrastText: '#FFFFFF',
  },

  warning: {
    main: '#F59E0B', // Amber
    light: '#FBBF24',
    dark: '#D97706',
    contrastText: '#000000',
  },

  error: {
    main: '#EF4444', // Red
    light: '#F87171',
    dark: '#DC2626',
    contrastText: '#FFFFFF',
  },

  info: {
    main: '#3B82F6', // Blue
    light: '#60A5FA',
    dark: '#2563EB',
    contrastText: '#FFFFFF',
  },
};

/**
 * Neutral colors
 */
export const neutralColors = {
  50: '#F9FAFB',
  100: '#F3F4F6',
  200: '#E5E7EB',
  300: '#D1D5DB',
  400: '#9CA3AF',
  500: '#6B7280',
  600: '#4B5563',
  700: '#374151',
  800: '#1F2937',
  900: '#111827',
};

/**
 * Background colors - Light mode
 */
export const backgroundColors = {
  default: '#F8FAFC',
  paper: '#FFFFFF',
};

/**
 * Background colors - Dark mode
 */
export const darkBackgroundColors = {
  default: '#0F172A', // Dark slate
  paper: '#1E293B',   // Lighter slate
};
