/**
 * Exchange Rate Management Types
 *
 * Handles currency exchange rates, forex gains/losses,
 * and multi-currency transaction support
 */

import type { Timestamp } from './common';
import type { CurrencyCode } from './common';

/**
 * Exchange Rate Source
 */
export type ExchangeRateSource = 'MANUAL' | 'API' | 'SYSTEM';

/**
 * Exchange Rate Status
 */
export type ExchangeRateStatus = 'ACTIVE' | 'EXPIRED' | 'DRAFT';

/**
 * Exchange Rate Record
 *
 * Stores historical exchange rates for currency conversions
 */
export interface ExchangeRate {
  id?: string;

  // Currency Pair
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  baseCurrency: CurrencyCode; // Usually INR for this company

  // Rate Information
  rate: number; // Exchange rate (1 fromCurrency = rate toCurrency)
  inverseRate: number; // Inverse rate (1 toCurrency = inverseRate fromCurrency)

  // Effective Period
  effectiveFrom: Timestamp;
  effectiveTo?: Timestamp;
  status: ExchangeRateStatus;

  // Source & Metadata
  source: ExchangeRateSource;
  sourceReference?: string; // API provider, manual entry reference, etc.
  notes?: string;

  // Audit Fields
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy?: string;
}

/**
 * Forex Gain/Loss Type
 */
export type ForexGainLossType = 'REALIZED' | 'UNREALIZED';

/**
 * Forex Gain/Loss Entry
 *
 * Records foreign exchange gains or losses on transactions
 */
export interface ForexGainLoss {
  id?: string;

  // Transaction Reference
  transactionId: string;
  transactionType: string;
  transactionNumber: string;
  transactionDate: Timestamp;

  // Currency Information
  foreignCurrency: CurrencyCode;
  foreignAmount: number;
  baseCurrency: CurrencyCode;

  // Exchange Rates
  bookingRate: number; // Rate when transaction was booked
  settlementRate: number; // Rate when payment was made/received
  currentRate?: number; // Current market rate (for unrealized)

  // Gain/Loss Calculation
  type: ForexGainLossType;
  bookingAmount: number; // Amount in base currency at booking rate
  settlementAmount: number; // Amount in base currency at settlement rate
  gainLossAmount: number; // Difference (positive = gain, negative = loss)

  // Settlement Information
  settlementDate?: Timestamp;
  settlementReference?: string;

  // Accounting
  glAccountId?: string; // GL account for gain/loss posting
  glEntryId?: string; // Link to GL entry

  // Audit Fields
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

/**
 * Currency Configuration
 *
 * Defines which currencies are active and their display settings
 */
export interface CurrencyConfiguration {
  id?: string;
  currency: CurrencyCode;
  isActive: boolean;
  isBaseCurrency: boolean;
  displayName: string;
  symbol: string;
  decimalPlaces: number;
  defaultExchangeRate?: number; // Fallback rate if no rate is found
  glGainAccountId?: string; // GL account for forex gains
  glLossAccountId?: string; // GL account for forex losses
  notes?: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

/**
 * Currency Exposure Report
 *
 * Summary of outstanding foreign currency balances
 */
export interface CurrencyExposure {
  currency: CurrencyCode;
  totalReceivables: number; // In foreign currency
  totalPayables: number; // In foreign currency
  netExposure: number; // Receivables - Payables
  currentRate: number;
  exposureInBaseCurrency: number;
  unrealizedGainLoss: number;
  transactionCount: number;
}

/**
 * Exchange Rate History Entry
 */
export interface ExchangeRateHistory {
  date: Timestamp;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  source: ExchangeRateSource;
}

/**
 * Input for creating exchange rate
 */
export interface CreateExchangeRateInput {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  effectiveFrom: Timestamp;
  effectiveTo?: Timestamp;
  source: ExchangeRateSource;
  sourceReference?: string;
  notes?: string;
}

/**
 * Forex Report Filters
 */
export interface ForexReportFilters {
  startDate: Timestamp;
  endDate: Timestamp;
  currency?: CurrencyCode;
  type?: ForexGainLossType;
  transactionType?: string;
}

/**
 * Forex Summary
 */
export interface ForexSummary {
  totalRealizedGain: number;
  totalRealizedLoss: number;
  netRealizedGainLoss: number;
  totalUnrealizedGain: number;
  totalUnrealizedLoss: number;
  netUnrealizedGainLoss: number;
  netTotalGainLoss: number;
  transactionCount: number;
  byCurrency: Record<
    CurrencyCode,
    {
      realized: number;
      unrealized: number;
      total: number;
    }
  >;
}
