import { useMemo } from 'react';
import type { LineItem, GSTDetails } from '@vapour/types';
import { calculateGST } from '@/lib/accounting/gstCalculator';

interface UseGSTCalculationOptions {
  /**
   * Array of line items to calculate GST from
   */
  lineItems: LineItem[];
  /**
   * Subtotal amount (taxable amount)
   */
  subtotal: number;
  /**
   * Company's state code (e.g., '29' for Karnataka)
   */
  companyState?: string;
  /**
   * Customer/Vendor's state code
   */
  entityState?: string;
  /**
   * Whether to enable GST calculation
   */
  enabled?: boolean;
}

interface UseGSTCalculationReturn {
  /**
   * Calculated GST details (CGST, SGST, IGST breakdown)
   */
  gstDetails: GSTDetails | undefined;
  /**
   * Average GST rate across all line items
   */
  averageGstRate: number;
  /**
   * Total GST amount (CGST + SGST + IGST)
   */
  totalGstAmount: number;
  /**
   * Grand total (subtotal + GST)
   */
  grandTotal: number;
}

/**
 * Custom hook for calculating GST from line items.
 * Handles intra-state (CGST + SGST) and inter-state (IGST) scenarios.
 *
 * @example
 * ```tsx
 * const { gstDetails, totalGstAmount, grandTotal } = useGSTCalculation({
 *   lineItems,
 *   subtotal,
 *   companyState: '29',
 *   entityState: '27',
 * });
 * ```
 */
export function useGSTCalculation(options: UseGSTCalculationOptions): UseGSTCalculationReturn {
  const { lineItems, subtotal, companyState, entityState, enabled = true } = options;

  // Calculate average GST rate from line items
  const averageGstRate = useMemo(() => {
    if (lineItems.length === 0) return 0;
    const totalGstRate = lineItems.reduce((sum, item) => sum + (item.gstRate || 0), 0);
    return totalGstRate / lineItems.length;
  }, [lineItems]);

  // Calculate GST details
  const gstDetails = useMemo(() => {
    if (!enabled || subtotal <= 0 || averageGstRate <= 0) {
      return undefined;
    }

    // If both states are available, use proper CGST/SGST vs IGST determination
    if (companyState && entityState) {
      return calculateGST({
        taxableAmount: subtotal,
        gstRate: averageGstRate,
        sourceState: companyState,
        destinationState: entityState,
      });
    }

    // Fallback: Calculate GST without state info (assume IGST for simplicity)
    // This ensures GST is calculated even when entity state isn't configured
    const totalGST = subtotal * (averageGstRate / 100);
    return {
      taxableAmount: subtotal,
      gstType: 'IGST' as const,
      igstRate: averageGstRate,
      igstAmount: totalGST,
      totalGST,
    };
  }, [enabled, companyState, entityState, subtotal, averageGstRate]);

  // Calculate total GST amount
  const totalGstAmount = useMemo(() => {
    if (!gstDetails) return 0;
    return gstDetails.totalGST;
  }, [gstDetails]);

  // Calculate grand total
  const grandTotal = useMemo(() => {
    return subtotal + totalGstAmount;
  }, [subtotal, totalGstAmount]);

  return {
    gstDetails,
    averageGstRate,
    totalGstAmount,
    grandTotal,
  };
}
