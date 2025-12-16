/**
 * PO Amendment Helper Functions
 *
 * UI helper functions for PO Amendment operations
 */

import type { PurchaseOrderAmendment } from '@vapour/types';

type AmendmentStatus = PurchaseOrderAmendment['status'];
type AmendmentType = PurchaseOrderAmendment['amendmentType'];

/**
 * Get status display text
 */
export function getAmendmentStatusText(status: AmendmentStatus): string {
  const statusMap: Record<AmendmentStatus, string> = {
    DRAFT: 'Draft',
    PENDING_APPROVAL: 'Pending Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  };
  return statusMap[status] || status;
}

/**
 * Get status color for Chip component
 */
export function getAmendmentStatusColor(
  status: AmendmentStatus
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  const colorMap: Record<AmendmentStatus, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
    DRAFT: 'default',
    PENDING_APPROVAL: 'warning',
    APPROVED: 'success',
    REJECTED: 'error',
  };
  return colorMap[status] || 'default';
}

/**
 * Get amendment type display text
 */
export function getAmendmentTypeText(type: AmendmentType): string {
  const typeMap: Record<AmendmentType, string> = {
    QUANTITY_CHANGE: 'Quantity Change',
    PRICE_CHANGE: 'Price Change',
    TERMS_CHANGE: 'Terms Change',
    DELIVERY_CHANGE: 'Delivery Change',
    GENERAL: 'General',
  };
  return typeMap[type] || type;
}

/**
 * Filter amendments by search term
 */
export function filterAmendments(
  amendments: PurchaseOrderAmendment[],
  searchTerm: string
): PurchaseOrderAmendment[] {
  if (!searchTerm.trim()) return amendments;

  const term = searchTerm.toLowerCase();
  return amendments.filter(
    (amendment) =>
      amendment.purchaseOrderNumber.toLowerCase().includes(term) ||
      amendment.reason.toLowerCase().includes(term) ||
      amendment.requestedByName.toLowerCase().includes(term)
  );
}

/**
 * Filter amendments by status
 */
export function filterAmendmentsByStatus(
  amendments: PurchaseOrderAmendment[],
  status: AmendmentStatus | 'ALL'
): PurchaseOrderAmendment[] {
  if (status === 'ALL') return amendments;
  return amendments.filter((amendment) => amendment.status === status);
}

/**
 * Calculate amendment statistics
 */
export function calculateAmendmentStats(amendments: PurchaseOrderAmendment[]) {
  return {
    total: amendments.length,
    draft: amendments.filter((a) => a.status === 'DRAFT').length,
    pendingApproval: amendments.filter((a) => a.status === 'PENDING_APPROVAL').length,
    approved: amendments.filter((a) => a.status === 'APPROVED').length,
    rejected: amendments.filter((a) => a.status === 'REJECTED').length,
    totalValueChange: amendments
      .filter((a) => a.status === 'APPROVED')
      .reduce((sum, a) => sum + a.totalChange, 0),
  };
}

// Re-export formatCurrency from centralized utility for backwards compatibility
export { formatCurrency } from '@/lib/utils/formatters';

/**
 * Get available actions for an amendment
 */
export function getAmendmentAvailableActions(amendment: PurchaseOrderAmendment) {
  return {
    canSubmit: amendment.status === 'DRAFT',
    canApprove: amendment.status === 'PENDING_APPROVAL',
    canReject: amendment.status === 'PENDING_APPROVAL',
    canEdit: amendment.status === 'DRAFT',
    canDelete: amendment.status === 'DRAFT',
  };
}
