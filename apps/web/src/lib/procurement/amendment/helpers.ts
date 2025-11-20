/**
 * Amendment Service Helpers
 *
 * Helper functions for amendment operations
 */

import { Timestamp } from 'firebase/firestore';
import type { PurchaseOrderChange, PurchaseOrderAmendment } from '@vapour/types';

/**
 * Determine amendment type based on changes
 */
export function determineAmendmentType(
  changes: PurchaseOrderChange[]
): PurchaseOrderAmendment['amendmentType'] {
  const hasQuantityChange = changes.some((c) => c.field.includes('quantity'));
  const hasPriceChange = changes.some(
    (c) => c.field.includes('Price') || c.field.includes('Total')
  );
  const hasDeliveryChange = changes.some((c) => c.field.includes('delivery'));
  const hasTermsChange = changes.some((c) => c.category === 'TERMS');

  if (hasQuantityChange) return 'QUANTITY_CHANGE';
  if (hasPriceChange) return 'PRICE_CHANGE';
  if (hasDeliveryChange) return 'DELIVERY_CHANGE';
  if (hasTermsChange) return 'TERMS_CHANGE';

  return 'GENERAL';
}

/**
 * Format value for display
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'number') return value.toFixed(2);
  if (value instanceof Date || (value && typeof value === 'object' && 'toDate' in value)) {
    const date = value instanceof Date ? value : (value as Timestamp).toDate();
    return date.toLocaleDateString();
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
