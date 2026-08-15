'use client';

import { Chip, Tooltip } from '@mui/material';
import type { CatalogLineDimensions } from '@vapour/types';
import { describeLineDimensions, formatLineDimensions } from '@/lib/catalog/lineDimensions';

/**
 * The one way a structured plate size is shown on a procurement line.
 *
 * Every document in the chain — PR, RFQ, quote, PO, goods receipt — renders
 * dimensions through this, so the size reads identically wherever a buyer,
 * vendor or storekeeper meets it (rule 32).
 */

interface LineDimensionsChipProps {
  dimensions?: CatalogLineDimensions;
  /** Fires when the chip is clicked; omit for a read-only surface. */
  onClick?: () => void;
  size?: 'small' | 'medium';
}

export default function LineDimensionsChip({
  dimensions,
  onClick,
  size = 'small',
}: LineDimensionsChipProps) {
  if (!dimensions) return null;

  const label = formatLineDimensions(dimensions);
  if (!label) return null;

  const withWeight =
    dimensions.totalWeightKg !== undefined ? `${label} · ${dimensions.totalWeightKg} kg` : label;

  return (
    <Tooltip title={describeLineDimensions(dimensions)}>
      <Chip
        label={withWeight}
        size={size}
        color="primary"
        variant="outlined"
        {...(onClick && { onClick })}
        sx={{ mt: 0.5 }}
      />
    </Tooltip>
  );
}
