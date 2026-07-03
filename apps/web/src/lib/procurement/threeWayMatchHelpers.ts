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
    approved: matches.filter((m) => m.approvalStatus === 'APPROVED').length,
    totalVariance: matches.reduce((sum, m) => sum + Math.abs(m.variance), 0),
  };
}

// Re-export formatCurrency from centralized utility for backwards compatibility
export { formatCurrency } from '@/lib/utils/formatters';

import { formatPercentage as formatPercentageFraction } from '@/lib/utils/formatters';

/**
 * Format an already-computed 0–100 percentage value (e.g. `overallMatchPercentage`,
 * `variancePercentage`). Delegates to the canonical formatter, which expects a
 * 0–1 fraction — this file's fields are pre-scaled, so the canonical duplicate
 * would double-multiply if called directly.
 */
export function formatPercentage(value: number): string {
  return formatPercentageFraction(value / 100, 2);
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
