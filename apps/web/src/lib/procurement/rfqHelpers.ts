/**
 * RFQ Helper Functions
 *
 * Utility functions for RFQ display, formatting, validation, and status checks
 */

import type { RFQ, RFQStatus, RFQItem } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// STATUS HELPERS
// ============================================================================

/**
 * Check if RFQ can be edited
 */
export function canEditRFQ(rfq: RFQ): boolean {
  return rfq.status === 'DRAFT';
}

/**
 * Check if RFQ can be issued
 */
export function canIssueRFQ(rfq: RFQ): boolean {
  return rfq.status === 'DRAFT' && rfq.vendorIds.length > 0;
}

/**
 * Check if RFQ can be cancelled
 */
export function canCancelRFQ(rfq: RFQ): boolean {
  return rfq.status !== 'COMPLETED' && rfq.status !== 'CANCELLED';
}

/**
 * Check if RFQ can accept offers
 */
export function canAcceptOffers(rfq: RFQ): boolean {
  return rfq.status === 'ISSUED' || rfq.status === 'OFFERS_RECEIVED';
}

/**
 * Check if RFQ is ready for completion
 */
export function canCompleteRFQ(rfq: RFQ): boolean {
  return (
    (rfq.status === 'OFFERS_RECEIVED' || rfq.status === 'UNDER_EVALUATION') &&
    rfq.offersReceived > 0
  );
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Get status display text
 */
export function getRFQStatusText(status: RFQStatus): string {
  const statusMap: Record<RFQStatus, string> = {
    DRAFT: 'Draft',
    ISSUED: 'Issued',
    OFFERS_RECEIVED: 'Offers Received',
    UNDER_EVALUATION: 'Under Evaluation',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };

  return statusMap[status];
}

/**
 * Get status color for chips/badges
 */
export function getRFQStatusColor(
  status: RFQStatus
): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' {
  const colorMap: Record<
    RFQStatus,
    'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'
  > = {
    DRAFT: 'default',
    ISSUED: 'info',
    OFFERS_RECEIVED: 'primary',
    UNDER_EVALUATION: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'error',
  };

  return colorMap[status];
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate RFQ before issuing
 */
export function validateRFQForIssuance(rfq: RFQ): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!rfq.title || rfq.title.trim() === '') {
    errors.push('Title is required');
  }

  if (!rfq.description || rfq.description.trim() === '') {
    errors.push('Description is required');
  }

  if (rfq.vendorIds.length === 0) {
    errors.push('At least one vendor must be selected');
  }

  if (!rfq.dueDate) {
    errors.push('Due date is required');
  } else {
    const now = new Date();
    const dueDate = rfq.dueDate.toDate();
    if (dueDate <= now) {
      errors.push('Due date must be in the future');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if RFQ is overdue
 */
export function isRFQOverdue(rfq: RFQ): boolean {
  if (!rfq.dueDate) return false;
  if (rfq.status === 'COMPLETED' || rfq.status === 'CANCELLED') return false;

  const now = new Date();
  const dueDate = rfq.dueDate.toDate();
  return dueDate < now;
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

/**
 * Calculate offer completion percentage
 */
export function getOfferCompletionPercentage(rfq: RFQ): number {
  if (rfq.vendorIds.length === 0) return 0;
  return Math.round((rfq.offersReceived / rfq.vendorIds.length) * 100);
}

/**
 * Calculate evaluation completion percentage
 */
export function getEvaluationCompletionPercentage(rfq: RFQ): number {
  if (rfq.offersReceived === 0) return 0;
  return Math.round((rfq.offersEvaluated / rfq.offersReceived) * 100);
}

/**
 * Get days until due date
 */
export function getDaysUntilDue(rfq: RFQ): number {
  if (!rfq.dueDate) return 0;

  const now = new Date();
  const dueDate = rfq.dueDate.toDate();
  const diffTime = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get urgency level based on days until due
 */
export function getRFQUrgency(rfq: RFQ): 'high' | 'medium' | 'low' {
  const daysUntilDue = getDaysUntilDue(rfq);

  if (daysUntilDue < 0) return 'high'; // Overdue
  if (daysUntilDue <= 3) return 'high';
  if (daysUntilDue <= 7) return 'medium';
  return 'low';
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format date with relative time
 */
export function formatRFQDate(timestamp: Timestamp | undefined): string {
  if (!timestamp) return 'N/A';

  const date = timestamp.toDate();
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format due date with urgency indicator
 */
export function formatDueDate(rfq: RFQ): { text: string; color: string; isOverdue: boolean } {
  if (!rfq.dueDate) {
    return { text: 'No due date', color: 'text.secondary', isOverdue: false };
  }

  const daysUntilDue = getDaysUntilDue(rfq);
  const isOverdue = daysUntilDue < 0;

  if (isOverdue) {
    return {
      text: `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`,
      color: 'error.main',
      isOverdue: true,
    };
  }

  if (daysUntilDue === 0) {
    return { text: 'Due today', color: 'warning.main', isOverdue: false };
  }

  if (daysUntilDue === 1) {
    return { text: 'Due tomorrow', color: 'warning.main', isOverdue: false };
  }

  const urgency = getRFQUrgency(rfq);
  const color =
    urgency === 'high' ? 'warning.main' : urgency === 'medium' ? 'info.main' : 'text.secondary';

  return {
    text: `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`,
    color,
    isOverdue: false,
  };
}

// ============================================================================
// SEARCH AND FILTER HELPERS
// ============================================================================

/**
 * Filter RFQs based on search query
 */
export function filterRFQsBySearch(rfqs: RFQ[], searchQuery: string): RFQ[] {
  if (!searchQuery || searchQuery.trim() === '') return rfqs;

  const query = searchQuery.toLowerCase().trim();

  return rfqs.filter((rfq) => {
    return (
      rfq.number.toLowerCase().includes(query) ||
      rfq.title.toLowerCase().includes(query) ||
      rfq.description?.toLowerCase().includes(query) ||
      rfq.vendorNames.some((name) => name.toLowerCase().includes(query)) ||
      rfq.projectNames.some((name) => name.toLowerCase().includes(query))
    );
  });
}

/**
 * Sort RFQs by field
 */
export function sortRFQs(
  rfqs: RFQ[],
  sortBy: 'number' | 'createdAt' | 'dueDate' | 'status',
  sortOrder: 'asc' | 'desc' = 'desc'
): RFQ[] {
  const sorted = [...rfqs];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'number':
        comparison = a.number.localeCompare(b.number);
        break;
      case 'createdAt':
        comparison = a.createdAt.toMillis() - b.createdAt.toMillis();
        break;
      case 'dueDate':
        const aTime = a.dueDate?.toMillis() || 0;
        const bTime = b.dueDate?.toMillis() || 0;
        comparison = aTime - bTime;
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

// ============================================================================
// STATISTICS HELPERS
// ============================================================================

/**
 * Calculate RFQ statistics
 */
export function calculateRFQStats(rfqs: RFQ[]) {
  const stats = {
    total: rfqs.length,
    draft: 0,
    issued: 0,
    offersReceived: 0,
    underEvaluation: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
    dueThisWeek: 0,
  };

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  rfqs.forEach((rfq) => {
    // Status counts
    switch (rfq.status) {
      case 'DRAFT':
        stats.draft++;
        break;
      case 'ISSUED':
        stats.issued++;
        break;
      case 'OFFERS_RECEIVED':
        stats.offersReceived++;
        break;
      case 'UNDER_EVALUATION':
        stats.underEvaluation++;
        break;
      case 'COMPLETED':
        stats.completed++;
        break;
      case 'CANCELLED':
        stats.cancelled++;
        break;
    }

    // Overdue count
    if (isRFQOverdue(rfq)) {
      stats.overdue++;
    }

    // Due this week
    if (rfq.dueDate && rfq.status !== 'COMPLETED' && rfq.status !== 'CANCELLED') {
      const dueDate = rfq.dueDate.toDate();
      if (dueDate >= now && dueDate <= weekFromNow) {
        stats.dueThisWeek++;
      }
    }
  });

  return stats;
}

// ============================================================================
// ITEM HELPERS
// ============================================================================

/**
 * Group RFQ items by project
 */
export function groupRFQItemsByProject(items: RFQItem[]): Map<string, RFQItem[]> {
  const grouped = new Map<string, RFQItem[]>();

  items.forEach((item) => {
    const projectId = item.projectId;
    const existing = grouped.get(projectId) || [];
    existing.push(item);
    grouped.set(projectId, existing);
  });

  return grouped;
}

/**
 * Group RFQ items by equipment
 */
export function groupRFQItemsByEquipment(items: RFQItem[]): Map<string, RFQItem[]> {
  const grouped = new Map<string, RFQItem[]>();

  items.forEach((item) => {
    const equipmentId = item.equipmentId || 'NO_EQUIPMENT';
    const existing = grouped.get(equipmentId) || [];
    existing.push(item);
    grouped.set(equipmentId, existing);
  });

  return grouped;
}

/**
 * Calculate total quantity for all items
 */
export function calculateTotalQuantity(items: RFQItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
