/**
 * Layout Constants for UI Standardization
 *
 * These constants ensure consistent spacing, sizing, and layout
 * across all pages and components in the application.
 */

/**
 * Section spacing values (in MUI spacing units, 1 unit = 8px)
 * Use these for consistent vertical rhythm between sections
 */
export const SECTION_SPACING = {
  /** Space after page header (32px) */
  page: 4,
  /** Space between major sections (24px) */
  section: 3,
  /** Space between related components (16px) */
  component: 2,
  /** Minimal spacing for tight layouts (8px) */
  tight: 1,
} as const;

/**
 * Container max-width values for different page types
 */
export const CONTAINER_WIDTHS = {
  /** List/table pages - widest layout */
  list: 'xl',
  /** Detail/view pages */
  detail: 'lg',
  /** Form dialogs and focused content */
  form: 'md',
  /** Auth pages (login, register) */
  auth: 'sm',
} as const;

/**
 * Standard component sizes
 * Use these to ensure consistent sizing across the app
 */
export const COMPONENT_SIZES = {
  /** Chips should always be small */
  chip: 'small',
  /** Icons in table action cells */
  tableIcon: 'small',
  /** Icons in page headers */
  headerIcon: 'medium',
  /** Status indicator icons */
  statusIcon: 'small',
  /** Form fields in filter bars */
  formField: 'small',
} as const;

/**
 * Sidebar width constants
 */
export const SIDEBAR_WIDTHS = {
  /** Fully expanded sidebar with labels */
  expanded: 240,
  /** Collapsed sidebar with small labels (tablets) */
  collapsed: 80,
  /** Collapsed sidebar with icons only (legacy) */
  collapsedIconOnly: 64,
} as const;

/**
 * Table minimum widths for responsive layouts
 */
export const TABLE_MIN_WIDTHS = {
  /** Standard table with 4-6 columns */
  standard: 650,
  /** Wide table with many columns */
  wide: 900,
  /** Compact table with few columns */
  compact: 400,
} as const;

// Type exports for TypeScript consumers
export type SectionSpacingKey = keyof typeof SECTION_SPACING;
export type ContainerWidthKey = keyof typeof CONTAINER_WIDTHS;
export type ComponentSizeKey = keyof typeof COMPONENT_SIZES;
