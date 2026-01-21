/**
 * Theme Constants
 *
 * Centralized constants for consistent UI styling across the application.
 * Import and use these instead of hardcoding values.
 */

// ============================================================================
// Spacing Constants
// ============================================================================

/**
 * Standard spacing values (in theme spacing units)
 * MUI theme.spacing(1) = 8px by default
 */
export const SPACING = {
  /** Card/Paper internal padding (16px) */
  CARD_PADDING: 2,

  /** Dialog content padding (24px) */
  DIALOG_PADDING: 3,

  /** Form field gap (16px) */
  FORM_GAP: 2,

  /** Section gap within a page (24px) */
  SECTION_GAP: 3,

  /** Item gap in lists/stacks (8px) */
  ITEM_GAP: 1,

  /** Small gap for tight spacing (4px) */
  TIGHT_GAP: 0.5,

  /** Page margin bottom (32px) */
  PAGE_MARGIN_BOTTOM: 4,

  /** Table cell padding (8-16px) */
  TABLE_CELL_PADDING: 1,
} as const;

// ============================================================================
// Border Radius Constants
// ============================================================================

/**
 * Standard border radius values (in theme spacing units)
 */
export const BORDER_RADIUS = {
  /** Default for cards, papers, containers (4px) */
  DEFAULT: 1,

  /** Chips, buttons, small elements (16px) */
  PILL: 4,

  /** Circular elements */
  CIRCLE: '50%',

  /** Sharp corners (no radius) */
  NONE: 0,
} as const;

// ============================================================================
// Dialog/Modal Constants
// ============================================================================

/**
 * Standard dialog widths
 */
export const DIALOG_WIDTH = {
  /** Small dialogs (400px) - confirmations, simple forms */
  SM: 'sm',

  /** Medium dialogs (600px) - standard forms */
  MD: 'md',

  /** Large dialogs (960px) - complex forms, previews */
  LG: 'lg',

  /** Extra large dialogs (1280px) - full editors */
  XL: 'xl',
} as const;

// ============================================================================
// Table Constants
// ============================================================================

/**
 * Standard table configurations
 */
export const TABLE = {
  /** Default rows per page */
  DEFAULT_PAGE_SIZE: 25,

  /** Available page size options */
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100] as const,

  /** Minimum column width for actions */
  ACTION_COLUMN_WIDTH: 120,
} as const;

// ============================================================================
// File Upload Constants
// ============================================================================

/**
 * File upload limits
 */
export const FILE_UPLOAD = {
  /** Maximum file size in bytes (20MB) */
  MAX_SIZE: 20 * 1024 * 1024,

  /** Maximum file size display string */
  MAX_SIZE_DISPLAY: '20MB',

  /** Allowed image types */
  IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const,

  /** Allowed document types */
  DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ] as const,

  /** Allowed spreadsheet types */
  SPREADSHEET_TYPES: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ] as const,
} as const;

// ============================================================================
// Animation Constants
// ============================================================================

/**
 * Standard animation durations
 */
export const ANIMATION = {
  /** Fast transitions (150ms) */
  FAST: 150,

  /** Normal transitions (250ms) */
  NORMAL: 250,

  /** Slow transitions (350ms) */
  SLOW: 350,
} as const;

// ============================================================================
// Typography Variant Guidelines
// ============================================================================

/**
 * Typography variant guidelines for consistency
 *
 * Use these patterns:
 * - Page titles: variant="h4" component="h1"
 * - Section titles: variant="h6" or variant="subtitle1" fontWeight={600}
 * - Card titles: variant="subtitle1" fontWeight={600}
 * - Form labels: variant="body2" or component default
 * - Helper text: variant="caption" color="text.secondary"
 * - Data labels: variant="caption" color="text.secondary"
 * - Data values: variant="body2"
 */
export const TYPOGRAPHY = {
  PAGE_TITLE: { variant: 'h4', component: 'h1' },
  SECTION_TITLE: { variant: 'h6' },
  CARD_TITLE: { variant: 'subtitle1', fontWeight: 600 },
  DATA_LABEL: { variant: 'caption', color: 'text.secondary' },
  DATA_VALUE: { variant: 'body2' },
  HELPER_TEXT: { variant: 'caption', color: 'text.secondary' },
} as const;
