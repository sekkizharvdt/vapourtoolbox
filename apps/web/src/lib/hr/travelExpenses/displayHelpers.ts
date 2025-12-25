/**
 * Travel Expense Display Helpers
 *
 * Shared utilities for displaying travel expense data across the HR module.
 */

import type { TravelExpenseStatus, TravelExpenseCategory } from '@vapour/types';

// ============================================
// Status Display
// ============================================

/**
 * MUI Chip color mapping for travel expense statuses
 */
export const TRAVEL_EXPENSE_STATUS_COLORS: Record<
  TravelExpenseStatus,
  'default' | 'warning' | 'success' | 'error' | 'info' | 'primary'
> = {
  DRAFT: 'default',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
  REIMBURSED: 'primary',
};

/**
 * Human-readable labels for travel expense statuses
 */
export const TRAVEL_EXPENSE_STATUS_LABELS: Record<TravelExpenseStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REIMBURSED: 'Reimbursed',
};

/**
 * Get the display properties for a travel expense status
 */
export function getTravelExpenseStatusDisplay(status: TravelExpenseStatus): {
  label: string;
  color: 'default' | 'warning' | 'success' | 'error' | 'info' | 'primary';
} {
  return {
    label: TRAVEL_EXPENSE_STATUS_LABELS[status],
    color: TRAVEL_EXPENSE_STATUS_COLORS[status],
  };
}

// ============================================
// Category Display
// ============================================

/**
 * Human-readable labels for expense categories
 */
export const EXPENSE_CATEGORY_LABELS: Record<TravelExpenseCategory, string> = {
  AIR_TRAVEL: 'Air Travel',
  TRAIN_TRAVEL: 'Train Travel',
  ROAD_TRAVEL: 'Road Travel',
  HOTEL: 'Hotel / Stay',
  FOOD: 'Food & Meals',
  LOCAL_CONVEYANCE: 'Local Conveyance',
  OTHER: 'Other',
};

/**
 * MUI Chip/Badge colors for expense categories
 */
export const EXPENSE_CATEGORY_COLORS: Record<
  TravelExpenseCategory,
  'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default'
> = {
  AIR_TRAVEL: 'primary',
  TRAIN_TRAVEL: 'success',
  ROAD_TRAVEL: 'warning',
  HOTEL: 'secondary',
  FOOD: 'error',
  LOCAL_CONVEYANCE: 'info',
  OTHER: 'default',
};

/**
 * Material UI icon names for expense categories (use with MUI Icon component)
 */
export const EXPENSE_CATEGORY_ICONS: Record<TravelExpenseCategory, string> = {
  AIR_TRAVEL: 'Flight',
  TRAIN_TRAVEL: 'Train',
  ROAD_TRAVEL: 'DirectionsCar',
  HOTEL: 'Hotel',
  FOOD: 'Restaurant',
  LOCAL_CONVEYANCE: 'LocalTaxi',
  OTHER: 'Receipt',
};

/**
 * Get the display properties for an expense category
 */
export function getExpenseCategoryDisplay(category: TravelExpenseCategory): {
  label: string;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default';
  icon: string;
} {
  return {
    label: EXPENSE_CATEGORY_LABELS[category],
    color: EXPENSE_CATEGORY_COLORS[category],
    icon: EXPENSE_CATEGORY_ICONS[category],
  };
}

/**
 * Get all expense categories as options for select/dropdown
 */
export function getExpenseCategoryOptions(): Array<{
  value: TravelExpenseCategory;
  label: string;
  icon: string;
}> {
  return (Object.keys(EXPENSE_CATEGORY_LABELS) as TravelExpenseCategory[]).map((category) => ({
    value: category,
    label: EXPENSE_CATEGORY_LABELS[category],
    icon: EXPENSE_CATEGORY_ICONS[category],
  }));
}

// ============================================
// Date Formatting
// ============================================

/**
 * Format a date for display in travel expenses
 * Uses Indian English locale with short month format
 */
export function formatExpenseDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a date range for trip display
 */
export function formatTripDateRange(startDate: Date, endDate: Date): string {
  const start = formatExpenseDate(startDate);
  const end = formatExpenseDate(endDate);

  if (start === end) {
    return start;
  }

  return `${start} - ${end}`;
}

/**
 * Format a date and time for display
 */
export function formatExpenseDateTime(date: Date): string {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// Amount Formatting
// ============================================

/**
 * Format amount with currency
 */
export function formatExpenseAmount(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format GST percentage
 */
export function formatGstRate(rate: number): string {
  return `${rate}%`;
}

// ============================================
// Trip Duration
// ============================================

/**
 * Calculate number of days between two dates (inclusive)
 */
export function calculateTripDays(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays + 1; // Include both start and end dates
}

/**
 * Format trip duration in human-readable format
 */
export function formatTripDuration(startDate: Date, endDate: Date): string {
  const days = calculateTripDays(startDate, endDate);

  if (days === 1) {
    return '1 day';
  }

  return `${days} days`;
}
