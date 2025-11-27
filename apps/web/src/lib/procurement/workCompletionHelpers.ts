/**
 * Work Completion Certificate Helper Functions
 *
 * UI helper functions for Work Completion Certificate operations
 */

import type { WorkCompletionCertificate } from '@vapour/types';

/**
 * Filter WCCs by search term
 */
export function filterWCCs(
  wccs: WorkCompletionCertificate[],
  searchTerm: string
): WorkCompletionCertificate[] {
  if (!searchTerm.trim()) return wccs;

  const term = searchTerm.toLowerCase();
  return wccs.filter(
    (wcc) =>
      wcc.number.toLowerCase().includes(term) ||
      wcc.poNumber.toLowerCase().includes(term) ||
      wcc.vendorName.toLowerCase().includes(term) ||
      wcc.projectName.toLowerCase().includes(term) ||
      wcc.workDescription.toLowerCase().includes(term)
  );
}

/**
 * Calculate WCC statistics
 */
export function calculateWCCStats(wccs: WorkCompletionCertificate[]) {
  return {
    total: wccs.length,
    fullyComplete: wccs.filter(
      (wcc) => wcc.allItemsDelivered && wcc.allItemsAccepted && wcc.allPaymentsCompleted
    ).length,
    pendingPayments: wccs.filter((wcc) => !wcc.allPaymentsCompleted).length,
    pendingDelivery: wccs.filter((wcc) => !wcc.allItemsDelivered).length,
  };
}

/**
 * Get completion status display
 */
export function getCompletionStatus(wcc: WorkCompletionCertificate): {
  label: string;
  color: 'success' | 'warning' | 'error' | 'default';
} {
  const allComplete = wcc.allItemsDelivered && wcc.allItemsAccepted && wcc.allPaymentsCompleted;

  if (allComplete) {
    return { label: 'Fully Complete', color: 'success' };
  }

  if (!wcc.allItemsDelivered) {
    return { label: 'Pending Delivery', color: 'warning' };
  }

  if (!wcc.allItemsAccepted) {
    return { label: 'Pending Acceptance', color: 'warning' };
  }

  if (!wcc.allPaymentsCompleted) {
    return { label: 'Pending Payment', color: 'warning' };
  }

  return { label: 'In Progress', color: 'default' };
}
