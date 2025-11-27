/**
 * Three-Way Match Helper Functions
 *
 * UI helper functions for Three-Way Match operations
 */

import type { ThreeWayMatch, ThreeWayMatchStatus } from '@vapour/types';

/**
 * Get status display text
 */
export function getMatchStatusText(status: ThreeWayMatchStatus): string {
  const statusMap: Record<ThreeWayMatchStatus, string> = {
    MATCHED: 'Matched',
    PARTIALLY_MATCHED: 'Partially Matched',
    NOT_MATCHED: 'Not Matched',
    PENDING_REVIEW: 'Pending Review',
    APPROVED_WITH_VARIANCE: 'Approved with Variance',
    REJECTED: 'Rejected',
  };
  return statusMap[status] || status;
}

/**
 * Get status color for Chip component
 */
export function getMatchStatusColor(
  status: ThreeWayMatchStatus
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  const colorMap: Record<
    ThreeWayMatchStatus,
    'success' | 'warning' | 'error' | 'info' | 'default'
  > = {
    MATCHED: 'success',
    PARTIALLY_MATCHED: 'warning',
    NOT_MATCHED: 'error',
    PENDING_REVIEW: 'info',
    APPROVED_WITH_VARIANCE: 'success',
    REJECTED: 'error',
  };
  return colorMap[status] || 'default';
}

/**
 * Filter matches by search term
 */
export function filterMatches(matches: ThreeWayMatch[], searchTerm: string): ThreeWayMatch[] {
  if (!searchTerm.trim()) return matches;

  const term = searchTerm.toLowerCase();
  return matches.filter(
    (match) =>
      match.matchNumber.toLowerCase().includes(term) ||
      match.poNumber.toLowerCase().includes(term) ||
      match.grNumber.toLowerCase().includes(term) ||
      match.vendorBillNumber.toLowerCase().includes(term) ||
      match.vendorName.toLowerCase().includes(term) ||
      match.projectName.toLowerCase().includes(term)
  );
}

/**
 * Filter matches by status
 */
export function filterMatchesByStatus(
  matches: ThreeWayMatch[],
  status: ThreeWayMatchStatus | 'ALL'
): ThreeWayMatch[] {
  if (status === 'ALL') return matches;
  return matches.filter((match) => match.status === status);
}

/**
 * Calculate match statistics
 */
export function calculateMatchStats(matches: ThreeWayMatch[]) {
  return {
    total: matches.length,
    matched: matches.filter((m) => m.status === 'MATCHED').length,
    partiallyMatched: matches.filter((m) => m.status === 'PARTIALLY_MATCHED').length,
    notMatched: matches.filter((m) => m.status === 'NOT_MATCHED').length,
    pendingReview: matches.filter((m) => m.status === 'PENDING_REVIEW').length,
    approvedWithVariance: matches.filter((m) => m.status === 'APPROVED_WITH_VARIANCE').length,
    totalVariance: matches.reduce((sum, m) => sum + Math.abs(m.variance), 0),
  };
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency = 'AED'): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Get variance color
 */
export function getVarianceColor(variance: number): 'success' | 'warning' | 'error' {
  if (Math.abs(variance) < 0.01) return 'success';
  if (Math.abs(variance) < 100) return 'warning';
  return 'error';
}

/**
 * Get match percentage color
 */
export function getMatchPercentageColor(percentage: number): 'success' | 'warning' | 'error' {
  if (percentage >= 95) return 'success';
  if (percentage >= 80) return 'warning';
  return 'error';
}
