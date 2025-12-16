/**
 * Purchase Request Helper Functions
 *
 * Utility functions for working with Purchase Requests
 */

import type { PurchaseRequest, PurchaseRequestItem, PurchaseRequestStatus } from '@vapour/types';

// ============================================================================
// STATUS HELPERS
// ============================================================================

/**
 * Check if PR can be edited
 */
export function canEditPurchaseRequest(pr: PurchaseRequest): boolean {
  return pr.status === 'DRAFT' || pr.status === 'REJECTED';
}

/**
 * Check if PR can be submitted
 */
export function canSubmitPurchaseRequest(pr: PurchaseRequest): boolean {
  return pr.status === 'DRAFT' && pr.itemCount > 0;
}

/**
 * Check if PR can be approved/rejected
 */
export function canReviewPurchaseRequest(pr: PurchaseRequest): boolean {
  return pr.status === 'SUBMITTED' || pr.status === 'UNDER_REVIEW';
}

/**
 * Check if PR can have RFQs created from it
 */
export function canCreateRFQFromPR(pr: PurchaseRequest): boolean {
  return pr.status === 'APPROVED';
}

/**
 * Get status color for UI
 */
export function getPRStatusColor(
  status: PurchaseRequestStatus
): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'DRAFT':
      return 'default';
    case 'SUBMITTED':
      return 'info';
    case 'UNDER_REVIEW':
      return 'warning';
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
      return 'error';
    case 'CONVERTED_TO_RFQ':
      return 'secondary';
    default:
      return 'default';
  }
}

/**
 * Get status display text
 */
export function getPRStatusText(status: PurchaseRequestStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'SUBMITTED':
      return 'Pending Approval';
    case 'UNDER_REVIEW':
      return 'Under Review';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'CONVERTED_TO_RFQ':
      return 'Converted to RFQ';
    default:
      return status;
  }
}

// ============================================================================
// PRIORITY HELPERS
// ============================================================================

/**
 * Get priority color for UI
 */
export function getPriorityColor(
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
): 'default' | 'info' | 'warning' | 'error' {
  switch (priority) {
    case 'LOW':
      return 'default';
    case 'MEDIUM':
      return 'info';
    case 'HIGH':
      return 'warning';
    case 'URGENT':
      return 'error';
    default:
      return 'default';
  }
}

/**
 * Get priority display text
 */
export function getPriorityText(priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'): string {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

// ============================================================================
// TYPE/CATEGORY HELPERS
// ============================================================================

/**
 * Get PR type display text
 */
export function getPRTypeText(type: 'PROJECT' | 'BUDGETARY' | 'INTERNAL'): string {
  switch (type) {
    case 'PROJECT':
      return 'Project';
    case 'BUDGETARY':
      return 'Budgetary';
    case 'INTERNAL':
      return 'Internal Requirement';
    default:
      return type;
  }
}

/**
 * Get PR category display text
 */
export function getPRCategoryText(category: 'SERVICE' | 'RAW_MATERIAL' | 'BOUGHT_OUT'): string {
  switch (category) {
    case 'SERVICE':
      return 'Service';
    case 'RAW_MATERIAL':
      return 'Raw Material';
    case 'BOUGHT_OUT':
      return 'Bought Out Item';
    default:
      return category;
  }
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

/**
 * Calculate total estimated cost for PR
 */
export function calculatePRTotalCost(items: PurchaseRequestItem[]): number {
  return items.reduce((sum, item) => {
    return sum + (item.estimatedTotalCost || 0);
  }, 0);
}

/**
 * Calculate total items count
 */
export function calculateTotalQuantity(items: PurchaseRequestItem[]): number {
  return items.reduce((sum, item) => {
    return sum + item.quantity;
  }, 0);
}

/**
 * Get unique equipment IDs from PR items
 */
export function getUniqueEquipmentIds(items: PurchaseRequestItem[]): string[] {
  const equipmentIds = items.filter((item) => item.equipmentId).map((item) => item.equipmentId!);

  return Array.from(new Set(equipmentIds));
}

/**
 * Group items by equipment
 */
export function groupItemsByEquipment(
  items: PurchaseRequestItem[]
): Record<string, PurchaseRequestItem[]> {
  const grouped: Record<string, PurchaseRequestItem[]> = {
    'no-equipment': [],
  };

  items.forEach((item) => {
    const key = item.equipmentId || 'no-equipment';
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  });

  return grouped;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate PR before submission
 */
export function validatePRForSubmission(
  pr: PurchaseRequest,
  items: PurchaseRequestItem[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check status
  if (pr.status !== 'DRAFT') {
    errors.push('Only draft purchase requests can be submitted');
  }

  // Check has items
  if (items.length === 0) {
    errors.push('Purchase request must have at least one item');
  }

  // Check all items have required fields
  items.forEach((item, index) => {
    if (!item.description || item.description.trim() === '') {
      errors.push(`Item ${index + 1}: Description is required`);
    }

    if (!item.quantity || item.quantity <= 0) {
      errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
    }

    if (!item.unit || item.unit.trim() === '') {
      errors.push(`Item ${index + 1}: Unit is required`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate PR item
 */
export function validatePRItem(item: Partial<PurchaseRequestItem>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!item.description || item.description.trim() === '') {
    errors.push('Description is required');
  }

  if (!item.quantity || item.quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }

  if (!item.unit || item.unit.trim() === '') {
    errors.push('Unit is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

// Re-export formatCurrency from centralized utility for backwards compatibility
export { formatCurrency } from '@/lib/utils/formatters';

/**
 * Format date
 */
export function formatDate(date: Date | { toDate: () => Date }): string {
  const dateObj = date instanceof Date ? date : date.toDate();
  return dateObj.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format datetime
 */
export function formatDateTime(date: Date | { toDate: () => Date }): string {
  const dateObj = date instanceof Date ? date : date.toDate();
  return dateObj.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get relative time (e.g., "2 days ago")
 */
export function getRelativeTime(date: Date | { toDate: () => Date }): string {
  const dateObj = date instanceof Date ? date : date.toDate();
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes === 0) {
        return 'Just now';
      }
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    }
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
}

// ============================================================================
// FILTER HELPERS
// ============================================================================

/**
 * Filter PRs by search text
 */
export function filterPRsBySearch(prs: PurchaseRequest[], searchText: string): PurchaseRequest[] {
  if (!searchText || searchText.trim() === '') {
    return prs;
  }

  const search = searchText.toLowerCase().trim();

  return prs.filter((pr) => {
    return (
      pr.number.toLowerCase().includes(search) ||
      pr.title.toLowerCase().includes(search) ||
      pr.description.toLowerCase().includes(search) ||
      pr.projectName?.toLowerCase().includes(search) ||
      pr.submittedByName.toLowerCase().includes(search)
    );
  });
}

/**
 * Sort PRs
 */
export function sortPRs(
  prs: PurchaseRequest[],
  sortBy: 'date' | 'number' | 'priority' | 'status',
  order: 'asc' | 'desc' = 'desc'
): PurchaseRequest[] {
  const sorted = [...prs];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'date':
        comparison = a.createdAt.toMillis() - b.createdAt.toMillis();
        break;
      case 'number':
        comparison = a.number.localeCompare(b.number);
        break;
      case 'priority': {
        const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
      }
      case 'status': {
        comparison = a.status.localeCompare(b.status);
        break;
      }
    }

    return order === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

// ============================================================================
// STATS HELPERS
// ============================================================================

/**
 * Get PR statistics
 */
export function getPRStats(prs: PurchaseRequest[]): {
  total: number;
  byStatus: Record<PurchaseRequestStatus, number>;
  byPriority: Record<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', number>;
  byType: Record<'PROJECT' | 'BUDGETARY' | 'INTERNAL', number>;
  totalEstimatedCost: number;
} {
  const byStatus: Record<string, number> = {};
  const stats = {
    total: prs.length,
    byStatus,
    byPriority: {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    },
    byType: {
      PROJECT: 0,
      BUDGETARY: 0,
      INTERNAL: 0,
    },
    totalEstimatedCost: 0,
  };

  prs.forEach((pr) => {
    // Count by status
    stats.byStatus[pr.status] = (stats.byStatus[pr.status] || 0) + 1;

    // Count by priority
    stats.byPriority[pr.priority]++;

    // Count by type
    stats.byType[pr.type]++;
  });

  return stats;
}
