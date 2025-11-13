/**
 * GST Reports Utilities
 *
 * Helper functions for GST calculations
 */

import type { GSTSummary } from './types';

/**
 * Create empty GST summary
 */
export function createEmptyGSTSummary(): GSTSummary {
  return {
    taxableValue: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    cess: 0,
    total: 0,
    transactionCount: 0,
  };
}

/**
 * Calculate GST from line items
 */
export function calculateGSTFromLineItems(gstDetails?: {
  gstType: 'CGST_SGST' | 'IGST';
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
}): { cgst: number; sgst: number; igst: number } {
  if (!gstDetails) {
    return { cgst: 0, sgst: 0, igst: 0 };
  }

  if (gstDetails.gstType === 'CGST_SGST') {
    return {
      cgst: gstDetails.cgstAmount || 0,
      sgst: gstDetails.sgstAmount || 0,
      igst: 0,
    };
  } else {
    return {
      cgst: 0,
      sgst: 0,
      igst: gstDetails.igstAmount || 0,
    };
  }
}
