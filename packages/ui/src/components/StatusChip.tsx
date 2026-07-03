import { Chip, ChipProps } from '@mui/material';
import { getStatusColor, type StatusColorContext } from '@vapour/constants';

export interface StatusChipProps {
  /** Raw status/priority value (e.g. `'PENDING_APPROVAL'`). */
  status: string;
  /**
   * Label lookup — pass a domain label map from `@vapour/constants`
   * (e.g. `QUOTE_STATUS_LABELS`, `TRANSACTION_STATUS_LABELS`). Falls back to
   * the raw status string if the map has no entry.
   */
  labels?: Record<string, string>;
  /** Context for context-specific color overrides (see `getStatusColor`). */
  context?: StatusColorContext;
  size?: ChipProps['size'];
  variant?: ChipProps['variant'];
}

/**
 * Renders a status Chip with the label from a canonical `@vapour/constants`
 * label map and the color from the canonical `getStatusColor` — replaces the
 * per-page `getStatusColor`/inline-label pattern repeated across ~27 pages.
 *
 * @example
 * ```tsx
 * <StatusChip status={quote.status} labels={QUOTE_STATUS_LABELS} context="transaction" />
 * ```
 */
export function StatusChip({ status, labels, context, size = 'small', variant }: StatusChipProps) {
  const label = labels?.[status] ?? status;
  const color = getStatusColor(status, context);
  return <Chip label={label} color={color} size={size} variant={variant} />;
}
