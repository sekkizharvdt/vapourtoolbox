/**
 * Types for Currency & Forex Components
 */

import type { CurrencyCode, ExchangeRate, CurrencyConfiguration } from '@vapour/types';

// Currency display information
export const CURRENCY_INFO: Record<CurrencyCode, { name: string; symbol: string; flag: string }> = {
  INR: { name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  USD: { name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  EUR: { name: 'Euro', symbol: '€', flag: '🇪🇺' },
  GBP: { name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  AED: { name: 'UAE Dirham', symbol: 'AED', flag: '🇦🇪' },
};

export interface ExchangeRatesTabProps {
  exchangeRates: ExchangeRate[];
  bankRates: Partial<Record<CurrencyCode, { rate: number; date: Date }>>;
  lastRefresh: Date | null;
  refreshing: boolean;
  hasCreateAccess: boolean;
  onRefresh: () => void;
  error: string;
  success: string;
  onClearError: () => void;
  onClearSuccess: () => void;
  baseCurrency: CurrencyCode;
}

export interface SettingsTabProps {
  currencyConfig: CurrencyConfiguration[];
  baseCurrency: CurrencyCode;
  hasCreateAccess: boolean;
}

export function formatRate(rate: number): string {
  return rate.toFixed(4);
}

export function getTimeAgo(date: Date | null): string {
  if (!date) return 'Never';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export function isRateStale(date: Date | null): 'fresh' | 'stale' | 'very-stale' {
  if (!date) return 'very-stale';
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  if (diffHours <= 24) return 'fresh';
  if (diffHours <= 48) return 'stale';
  return 'very-stale';
}
