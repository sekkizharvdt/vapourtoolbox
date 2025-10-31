/**
 * GST Calculator
 * Handles GST calculations for Indian taxation
 * Automatically determines CGST+SGST vs IGST based on state
 */

import type { GSTDetails } from '@vapour/types';

// Indian states and union territories
export const INDIAN_STATES = {
  'Andaman and Nicobar Islands': 'AN',
  'Andhra Pradesh': 'AP',
  'Arunachal Pradesh': 'AR',
  Assam: 'AS',
  Bihar: 'BR',
  Chandigarh: 'CH',
  Chhattisgarh: 'CT',
  'Dadra and Nagar Haveli and Daman and Diu': 'DN',
  Delhi: 'DL',
  Goa: 'GA',
  Gujarat: 'GJ',
  Haryana: 'HR',
  'Himachal Pradesh': 'HP',
  'Jammu and Kashmir': 'JK',
  Jharkhand: 'JH',
  Karnataka: 'KA',
  Kerala: 'KL',
  Ladakh: 'LA',
  Lakshadweep: 'LD',
  'Madhya Pradesh': 'MP',
  Maharashtra: 'MH',
  Manipur: 'MN',
  Meghalaya: 'ML',
  Mizoram: 'MZ',
  Nagaland: 'NL',
  Odisha: 'OR',
  Puducherry: 'PY',
  Punjab: 'PB',
  Rajasthan: 'RJ',
  Sikkim: 'SK',
  'Tamil Nadu': 'TN',
  Telangana: 'TG',
  Tripura: 'TR',
  'Uttar Pradesh': 'UP',
  Uttarakhand: 'UT',
  'West Bengal': 'WB',
} as const;

export interface GSTCalculationParams {
  taxableAmount: number;
  gstRate: number; // Combined GST rate (e.g., 18 for 18% GST)
  sourceState: string; // State code (e.g., "KA", "MH")
  destinationState: string; // State code
  hsnCode?: string;
  sacCode?: string;
}

/**
 * Calculate GST breakdown
 * Automatically determines if it's intra-state (CGST+SGST) or inter-state (IGST)
 */
export function calculateGST(params: GSTCalculationParams): GSTDetails {
  const { taxableAmount, gstRate, sourceState, destinationState, hsnCode, sacCode } = params;

  // Determine if intra-state or inter-state
  const isIntraState = sourceState.toUpperCase() === destinationState.toUpperCase();

  let gstDetails: GSTDetails;

  if (isIntraState) {
    // Intra-state transaction: CGST + SGST
    const cgstRate = gstRate / 2;
    const sgstRate = gstRate / 2;
    const cgstAmount = (taxableAmount * cgstRate) / 100;
    const sgstAmount = (taxableAmount * sgstRate) / 100;

    gstDetails = {
      gstType: 'CGST_SGST',
      taxableAmount,
      cgstRate,
      cgstAmount: parseFloat(cgstAmount.toFixed(2)),
      sgstRate,
      sgstAmount: parseFloat(sgstAmount.toFixed(2)),
      totalGST: parseFloat((cgstAmount + sgstAmount).toFixed(2)),
      hsnCode,
      sacCode,
      placeOfSupply: destinationState,
    };
  } else {
    // Inter-state transaction: IGST
    const igstAmount = (taxableAmount * gstRate) / 100;

    gstDetails = {
      gstType: 'IGST',
      taxableAmount,
      igstRate: gstRate,
      igstAmount: parseFloat(igstAmount.toFixed(2)),
      totalGST: parseFloat(igstAmount.toFixed(2)),
      hsnCode,
      sacCode,
      placeOfSupply: destinationState,
    };
  }

  return gstDetails;
}

/**
 * Calculate reverse charge GST (for specific transactions)
 */
export function calculateReverseChargeGST(params: GSTCalculationParams): GSTDetails {
  // For reverse charge, calculation is same but direction of liability changes
  return calculateGST(params);
}

/**
 * Validate GST rate
 * Common GST rates in India: 0%, 0.25%, 3%, 5%, 12%, 18%, 28%
 */
export function isValidGSTRate(rate: number): boolean {
  const validRates = [0, 0.25, 3, 5, 12, 18, 28];
  return validRates.includes(rate);
}

/**
 * Get GST rate suggestions for autocomplete
 */
export function getGSTRateSuggestions(): number[] {
  return [0, 0.25, 3, 5, 12, 18, 28];
}

/**
 * Extract state code from GSTIN
 * GSTIN format: 22AAAAA0000A1Z5 (first 2 digits are state code)
 */
export function getStateFromGSTIN(gstin: string): string | null {
  if (!gstin || gstin.length !== 15) {
    return null;
  }

  const stateCode = gstin.substring(0, 2);
  const stateCodeToName: Record<string, string> = {
    '01': 'JK',
    '02': 'HP',
    '03': 'PB',
    '04': 'CH',
    '05': 'UT',
    '06': 'HR',
    '07': 'DL',
    '08': 'RJ',
    '09': 'UP',
    10: 'BR',
    11: 'SK',
    12: 'AR',
    13: 'NL',
    14: 'MN',
    15: 'MZ',
    16: 'TR',
    17: 'ML',
    18: 'AS',
    19: 'WB',
    20: 'JH',
    21: 'OR',
    22: 'CT',
    23: 'MP',
    24: 'GJ',
    27: 'MH',
    29: 'KA',
    30: 'GA',
    31: 'LD',
    32: 'KL',
    33: 'TN',
    34: 'PY',
    35: 'AN',
    36: 'TG',
    37: 'AP',
    38: 'LA',
  };

  return stateCodeToName[stateCode] || null;
}

/**
 * Validate GSTIN format
 */
export function isValidGSTIN(gstin: string): boolean {
  // GSTIN format: 22AAAAA0000A1Z5
  // - First 2 digits: State code
  // - Next 10 characters: PAN
  // - Next 1 character: Entity number
  // - Next 1 character: Z (default)
  // - Last 1 character: Checksum
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
}
