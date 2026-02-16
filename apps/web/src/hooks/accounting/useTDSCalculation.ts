import { useMemo, useState } from 'react';
import { calculateTDS, type TDSDetails, type TDSSection } from '@/lib/accounting/tdsCalculator';

interface UseTDSCalculationOptions {
  /**
   * Amount to calculate TDS on (subtotal + GST)
   */
  amount: number;
  /**
   * Whether TDS is deducted
   */
  enabled?: boolean;
}

interface UseTDSCalculationReturn {
  /**
   * Whether TDS is deducted
   */
  tdsDeducted: boolean;
  /**
   * Set TDS deduction status
   */
  setTdsDeducted: (deducted: boolean) => void;
  /**
   * TDS section code
   */
  tdsSection: TDSSection;
  /**
   * Set TDS section
   */
  setTdsSection: (section: TDSSection) => void;
  /**
   * Vendor PAN number
   */
  vendorPAN: string;
  /**
   * Set vendor PAN
   */
  setVendorPAN: (pan: string) => void;
  /**
   * Manual TDS rate override (null = auto from section)
   */
  tdsRateOverride: number | null;
  /**
   * Set manual TDS rate override
   */
  setTdsRateOverride: (rate: number | null) => void;
  /**
   * Calculated TDS details (rate, amount)
   */
  tdsDetails: TDSDetails | undefined;
  /**
   * TDS amount to deduct
   */
  tdsAmount: number;
}

/**
 * Custom hook for managing TDS calculation state and logic.
 * Handles TDS checkbox state, section selection, PAN input, rate override, and automatic calculation.
 */
export function useTDSCalculation(options: UseTDSCalculationOptions): UseTDSCalculationReturn {
  const { amount, enabled = true } = options;

  const [tdsDeducted, setTdsDeducted] = useState(false);
  const [tdsSection, setTdsSection] = useState<TDSSection>('194C');
  const [vendorPAN, setVendorPAN] = useState('');
  const [tdsRateOverride, setTdsRateOverride] = useState<number | null>(null);

  // Calculate TDS details
  const tdsDetails = useMemo(() => {
    if (!enabled || !tdsDeducted || amount <= 0) {
      return undefined;
    }

    return calculateTDS({
      amount,
      section: tdsSection,
      panNumber: vendorPAN,
      rateOverride: tdsRateOverride,
    });
  }, [enabled, tdsDeducted, amount, tdsSection, vendorPAN, tdsRateOverride]);

  // Calculate TDS amount
  const tdsAmount = useMemo(() => {
    return tdsDetails?.tdsAmount || 0;
  }, [tdsDetails]);

  return {
    tdsDeducted,
    setTdsDeducted,
    tdsSection,
    setTdsSection,
    vendorPAN,
    setVendorPAN,
    tdsRateOverride,
    setTdsRateOverride,
    tdsDetails,
    tdsAmount,
  };
}
