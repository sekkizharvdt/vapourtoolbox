/**
 * Amendment Service Helpers
 *
 * Helper functions for amendment operations
 */

import { Timestamp } from 'firebase/firestore';
import type { PurchaseOrderChange, PurchaseOrderAmendment } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

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
 * Format value for display in the amendment "Changes" table.
 *
 * Dates use the shared DD-MMM-YYYY formatter so amendment dates match the rest
 * of Procurement (feedback 8ImQ5sgbK0uSZGuhRTqE, dZQaZCkO172rq3dSrWoK).
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'number') return value.toFixed(2);
  if (value instanceof Date || (value && typeof value === 'object' && 'toDate' in value)) {
    return formatDate(value as Date | Timestamp);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
