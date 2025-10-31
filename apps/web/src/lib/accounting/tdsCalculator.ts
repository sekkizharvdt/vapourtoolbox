/**
 * TDS (Tax Deducted at Source) Calculator
 * Handles TDS calculations for Indian taxation
 */

import type { TDSDetails } from '@vapour/types';

// Common TDS sections and their rates
export const TDS_SECTIONS = {
  '192': { description: 'Salary', rate: 0, threshold: 0 },
  '192A': { description: 'Premature withdrawal from EPF', rate: 10, threshold: 50000 },
  '193': { description: 'Interest on securities', rate: 10, threshold: 0 },
  '194': { description: 'Dividend', rate: 10, threshold: 5000 },
  '194A': { description: 'Interest other than securities', rate: 10, threshold: 40000 },
  '194B': { description: 'Winnings from lottery/crossword', rate: 30, threshold: 10000 },
  '194C': { description: 'Payment to contractors', rate: 1, threshold: 30000 },
  '194D': { description: 'Insurance commission', rate: 5, threshold: 15000 },
  '194DA': { description: 'Life insurance policy payment', rate: 5, threshold: 100000 },
  '194EE': { description: 'NSS deposit', rate: 10, threshold: 2500 },
  '194F': { description: 'Mutual fund repurchase', rate: 20, threshold: 0 },
  '194G': { description: 'Commission on lottery tickets', rate: 5, threshold: 15000 },
  '194H': { description: 'Commission or brokerage', rate: 5, threshold: 15000 },
  '194I': { description: 'Rent', rate: 10, threshold: 240000 },
  '194IA': { description: 'Transfer of immovable property', rate: 1, threshold: 5000000 },
  '194IB': { description: 'Rent by individual/HUF', rate: 5, threshold: 50000 },
  '194IC': { description: 'Joint development agreement', rate: 10, threshold: 0 },
  '194J': { description: 'Professional/technical services', rate: 10, threshold: 30000 },
  '194K': { description: 'Mutual fund units', rate: 10, threshold: 0 },
  '194LA': { description: 'Compensation for land acquisition', rate: 10, threshold: 250000 },
  '194M': { description: 'Payment to contractors/professionals', rate: 5, threshold: 50000000 },
  '194N': { description: 'Cash withdrawal', rate: 2, threshold: 10000000 },
  '194O': { description: 'E-commerce transactions', rate: 1, threshold: 500000 },
  '194Q': { description: 'Purchase of goods', rate: 0.1, threshold: 5000000 },
} as const;

export type TDSSection = keyof typeof TDS_SECTIONS;

export interface TDSCalculationParams {
  amount: number;
  section: TDSSection;
  panNumber?: string;
  isSeniorCitizen?: boolean;
}

/**
 * Calculate TDS amount based on section
 */
export function calculateTDS(params: TDSCalculationParams): TDSDetails {
  const { amount, section, panNumber, isSeniorCitizen = false } = params;

  const sectionInfo = TDS_SECTIONS[section];

  if (!sectionInfo) {
    throw new Error(`Invalid TDS section: ${section}`);
  }

  let tdsRate = sectionInfo.rate;

  // If PAN is not provided, TDS rate is 20% (higher rate)
  if (!panNumber) {
    tdsRate = 20;
  }

  // Special handling for senior citizens (Section 194A)
  if (section === '194A' && isSeniorCitizen) {
    tdsRate = 0; // No TDS for senior citizens on interest income up to threshold
  }

  // Calculate TDS amount
  const tdsAmount = (amount * tdsRate) / 100;

  return {
    section,
    tdsRate,
    tdsAmount: parseFloat(tdsAmount.toFixed(2)),
    panNumber,
  };
}

/**
 * Check if TDS is applicable based on threshold
 */
export function isTDSApplicable(section: TDSSection, amount: number): boolean {
  const sectionInfo = TDS_SECTIONS[section];

  if (!sectionInfo) {
    return false;
  }

  return amount >= sectionInfo.threshold;
}

/**
 * Get TDS section information
 */
export function getTDSSectionInfo(section: TDSSection) {
  return TDS_SECTIONS[section];
}

/**
 * Get all TDS sections for dropdown
 */
export function getAllTDSSections() {
  return Object.entries(TDS_SECTIONS).map(([section, info]) => ({
    section,
    description: info.description,
    rate: info.rate,
    threshold: info.threshold,
  }));
}

/**
 * Get commonly used TDS sections
 */
export function getCommonTDSSections(): TDSSection[] {
  return ['194C', '194J', '194I', '194H', '194A'];
}

/**
 * Validate PAN number format
 */
export function isValidPAN(pan: string): boolean {
  // PAN format: AAAAA9999A
  // - First 3 characters: Alphabetic series (AAA to ZZZ)
  // - 4th character: Status (C, P, H, F, A, T, B, L, J, G)
  // - 5th character: First letter of surname/name
  // - Next 4 characters: Sequential number (0001 to 9999)
  // - Last character: Alphabetic check digit
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan);
}

/**
 * Calculate net payable after TDS deduction
 */
export function calculateNetPayable(grossAmount: number, tdsAmount: number): number {
  return parseFloat((grossAmount - tdsAmount).toFixed(2));
}
