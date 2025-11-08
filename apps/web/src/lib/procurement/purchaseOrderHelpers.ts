/**
 * Purchase Order Helper Functions
 *
 * Utility functions for PO display, validation, and formatting
 */

import type { PurchaseOrder, PurchaseOrderStatus } from '@vapour/types';

// ============================================================================
// STATUS UTILITIES
// ============================================================================

export function getPOStatusText(status: PurchaseOrderStatus): string {
  const statusMap: Record<PurchaseOrderStatus, string> = {
    DRAFT: 'Draft',
    PENDING_APPROVAL: 'Pending Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    ISSUED: 'Issued',
    ACKNOWLEDGED: 'Acknowledged',
    IN_PROGRESS: 'In Progress',
    DELIVERED: 'Delivered',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
  return statusMap[status] || status;
}

export function getPOStatusColor(
  status: PurchaseOrderStatus
): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' {
  const colorMap: Record<
    PurchaseOrderStatus,
    'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'
  > = {
    DRAFT: 'default',
    PENDING_APPROVAL: 'warning',
    APPROVED: 'info',
    REJECTED: 'error',
    ISSUED: 'primary',
    ACKNOWLEDGED: 'info',
    IN_PROGRESS: 'primary',
    DELIVERED: 'success',
    COMPLETED: 'success',
    CANCELLED: 'error',
  };
  return colorMap[status] || 'default';
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export function canEditPO(po: PurchaseOrder): boolean {
  return po.status === 'DRAFT';
}

export function canSubmitForApproval(po: PurchaseOrder): boolean {
  return po.status === 'DRAFT';
}

export function canApprovePO(po: PurchaseOrder): boolean {
  return po.status === 'PENDING_APPROVAL';
}

export function canRejectPO(po: PurchaseOrder): boolean {
  return po.status === 'PENDING_APPROVAL';
}

export function canIssuePO(po: PurchaseOrder): boolean {
  return po.status === 'APPROVED';
}

export function canCancelPO(po: PurchaseOrder): boolean {
  return ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED'].includes(po.status);
}

// ============================================================================
// DISPLAY UTILITIES
// ============================================================================

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  const currencySymbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };

  const symbol = currencySymbols[currency] || currency;

  return `${symbol}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatExpectedDelivery(po: PurchaseOrder): string {
  if (!po.expectedDeliveryDate) {
    return 'Not specified';
  }

  const expectedDate = po.expectedDeliveryDate.toDate();
  const now = new Date();
  const diffTime = expectedDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `Overdue by ${Math.abs(diffDays)} days`;
  } else if (diffDays === 0) {
    return 'Due today';
  } else if (diffDays <= 7) {
    return `Due in ${diffDays} days`;
  } else {
    return expectedDate.toLocaleDateString();
  }
}

export function getDeliveryStatus(po: PurchaseOrder): {
  text: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
} {
  const progress = po.deliveryProgress || 0;

  if (progress === 0) {
    return { text: 'Not Started', color: 'default' };
  } else if (progress < 100) {
    return { text: `${progress.toFixed(0)}% Delivered`, color: 'primary' };
  } else {
    return { text: 'Fully Delivered', color: 'success' };
  }
}

export function getPaymentStatus(po: PurchaseOrder): {
  text: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
} {
  const progress = po.paymentProgress || 0;

  if (progress === 0) {
    return { text: 'Not Paid', color: 'default' };
  } else if (progress < 100) {
    return { text: `${progress.toFixed(0)}% Paid`, color: 'warning' };
  } else {
    return { text: 'Fully Paid', color: 'success' };
  }
}

export function getAdvancePaymentStatus(po: PurchaseOrder): {
  text: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
} | null {
  if (!po.advancePaymentRequired) {
    return null;
  }

  const statusMap = {
    PENDING: { text: 'Advance Pending', color: 'warning' as const },
    REQUESTED: { text: 'Advance Requested', color: 'info' as const },
    PAID: { text: 'Advance Paid', color: 'success' as const },
  };

  return statusMap[po.advancePaymentStatus || 'PENDING'];
}

// ============================================================================
// FILTER & SORT UTILITIES
// ============================================================================

export function filterPOsBySearch(pos: PurchaseOrder[], searchQuery: string): PurchaseOrder[] {
  if (!searchQuery.trim()) {
    return pos;
  }

  const query = searchQuery.toLowerCase();

  return pos.filter(
    (po) =>
      po.number.toLowerCase().includes(query) ||
      po.vendorName.toLowerCase().includes(query) ||
      po.title?.toLowerCase().includes(query) ||
      po.selectedOfferNumber?.toLowerCase().includes(query)
  );
}

export function sortPOsByDate(
  pos: PurchaseOrder[],
  order: 'asc' | 'desc' = 'desc'
): PurchaseOrder[] {
  return [...pos].sort((a, b) => {
    const aTime = a.createdAt.toMillis();
    const bTime = b.createdAt.toMillis();
    return order === 'desc' ? bTime - aTime : aTime - bTime;
  });
}

export function sortPOsByAmount(
  pos: PurchaseOrder[],
  order: 'asc' | 'desc' = 'desc'
): PurchaseOrder[] {
  return [...pos].sort((a, b) => {
    return order === 'desc' ? b.grandTotal - a.grandTotal : a.grandTotal - b.grandTotal;
  });
}

// ============================================================================
// STATISTICS
// ============================================================================

export function calculatePOStats(pos: PurchaseOrder[]) {
  const stats = {
    total: pos.length,
    draft: 0,
    pendingApproval: 0,
    approved: 0,
    issued: 0,
    inProgress: 0,
    completed: 0,
    totalValue: 0,
    avgValue: 0,
  };

  pos.forEach((po) => {
    stats.totalValue += po.grandTotal;

    switch (po.status) {
      case 'DRAFT':
        stats.draft++;
        break;
      case 'PENDING_APPROVAL':
        stats.pendingApproval++;
        break;
      case 'APPROVED':
        stats.approved++;
        break;
      case 'ISSUED':
      case 'ACKNOWLEDGED':
        stats.issued++;
        break;
      case 'IN_PROGRESS':
        stats.inProgress++;
        break;
      case 'COMPLETED':
      case 'DELIVERED':
        stats.completed++;
        break;
    }
  });

  stats.avgValue = stats.total > 0 ? stats.totalValue / stats.total : 0;

  return stats;
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validatePOForSubmission(po: PurchaseOrder): string[] {
  const errors: string[] = [];

  if (!po.vendorId || !po.vendorName) {
    errors.push('Vendor information is missing');
  }

  if (!po.deliveryAddress) {
    errors.push('Delivery address is required');
  }

  if (!po.paymentTerms) {
    errors.push('Payment terms are required');
  }

  if (!po.deliveryTerms) {
    errors.push('Delivery terms are required');
  }

  if (po.grandTotal <= 0) {
    errors.push('PO amount must be greater than zero');
  }

  return errors;
}
