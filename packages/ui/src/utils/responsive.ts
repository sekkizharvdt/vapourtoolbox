'use client';

// Responsive Utility Helpers

import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

/**
 * Breakpoint hooks for responsive design
 */

export function useIsMobile() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
}

export function useIsTablet() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.between('sm', 'md'));
}

export function useIsDesktop() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.up('md'));
}

export function useIsSmallScreen() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('md'));
}

export function useIsLargeScreen() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.up('lg'));
}

/**
 * Responsive value helper
 * Returns different values based on screen size
 */
export function useResponsiveValue<T>(values: {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
}): T | undefined {
  const theme = useTheme();
  const isXl = useMediaQuery(theme.breakpoints.up('xl'));
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const isSm = useMediaQuery(theme.breakpoints.up('sm'));

  if (isXl && values.xl !== undefined) return values.xl;
  if (isLg && values.lg !== undefined) return values.lg;
  if (isMd && values.md !== undefined) return values.md;
  if (isSm && values.sm !== undefined) return values.sm;
  return values.xs;
}

/**
 * Grid columns helper
 * Returns appropriate column count based on screen size
 */
export function useGridColumns(options?: {
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}): number {
  const defaults = {
    xs: 1,   // Mobile: 1 column
    sm: 2,   // Tablet: 2 columns
    md: 2,   // Small laptop: 2 columns
    lg: 3,   // Desktop: 3 columns
    xl: 4,   // Large desktop: 4 columns
  };

  return useResponsiveValue({ ...defaults, ...options }) || defaults.xs;
}

/**
 * Touch device detection
 */
export function useIsTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Screen orientation
 */
export function useIsPortrait(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(orientation: portrait)').matches;
}

export function useIsLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(orientation: landscape)').matches;
}

/**
 * Sidebar width helper for responsive layouts
 */
export function useSidebarWidth(): {
  width: number;
  collapsed: boolean;
} {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  if (isMobile) {
    return { width: 0, collapsed: true }; // Hidden on mobile
  }

  if (isTablet) {
    return { width: 64, collapsed: true }; // Icon-only on tablet
  }

  return { width: 240, collapsed: false }; // Full width on desktop
}

/**
 * Module card columns for dashboard
 */
export function useModuleCardColumns(): number {
  return useGridColumns({
    xs: 1,  // Mobile: 1 card per row
    sm: 2,  // Tablet: 2 cards per row
    md: 2,  // Small laptop: 2 cards per row
    lg: 3,  // Desktop: 3 cards per row
    xl: 4,  // Large desktop: 4 cards per row
  });
}
