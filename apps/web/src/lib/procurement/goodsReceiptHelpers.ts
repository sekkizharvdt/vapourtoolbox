/**
 * Goods Receipt Helper Functions
 *
 * Utility functions for formatting, filtering, and computing goods receipt data
 */

import type { GoodsReceipt, GoodsReceiptStatus, ItemCondition } from '@vapour/types';

// Status display text
export function getGRStatusText(status: GoodsReceiptStatus): string {
  const statusTexts: Record<GoodsReceiptStatus, string> = {
    PENDING: 'Pending',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    ISSUES_FOUND: 'Issues Found',
  };
  return statusTexts[status] || status;
}

// Status color for MUI Chip
export function getGRStatusColor(
  status: GoodsReceiptStatus
): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
  const statusColors: Record<
    GoodsReceiptStatus,
    'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
  > = {
    PENDING: 'default',
    IN_PROGRESS: 'info',
    COMPLETED: 'success',
    ISSUES_FOUND: 'error',
  };
  return statusColors[status] || 'default';
}

// Condition display text
export function getConditionText(condition: ItemCondition): string {
  const conditionTexts: Record<ItemCondition, string> = {
    GOOD: 'Good',
    DAMAGED: 'Damaged',
    DEFECTIVE: 'Defective',
    INCOMPLETE: 'Incomplete',
  };
  return conditionTexts[condition] || condition;
}

// Condition color for MUI Chip
export function getConditionColor(
  condition: ItemCondition
): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
  const conditionColors: Record<
    ItemCondition,
    'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
  > = {
    GOOD: 'success',
    DAMAGED: 'error',
    DEFECTIVE: 'error',
    INCOMPLETE: 'warning',
  };
  return conditionColors[condition] || 'default';
}

// Overall condition display
export function getOverallConditionText(
  condition?: 'ACCEPTED' | 'CONDITIONALLY_ACCEPTED' | 'REJECTED'
): string {
  if (!condition) return '-';
  const texts: Record<string, string> = {
    ACCEPTED: 'Accepted',
    CONDITIONALLY_ACCEPTED: 'Conditionally Accepted',
    REJECTED: 'Rejected',
  };
  return texts[condition] || condition;
}

export function getOverallConditionColor(
  condition?: 'ACCEPTED' | 'CONDITIONALLY_ACCEPTED' | 'REJECTED'
): 'default' | 'success' | 'warning' | 'error' {
  if (!condition) return 'default';
  const colors: Record<string, 'success' | 'warning' | 'error'> = {
    ACCEPTED: 'success',
    CONDITIONALLY_ACCEPTED: 'warning',
    REJECTED: 'error',
  };
  return colors[condition] || 'default';
}

// Inspection type display
export function getInspectionTypeText(
  type: 'VENDOR_SITE' | 'DELIVERY_SITE' | 'THIRD_PARTY'
): string {
  const typeTexts: Record<string, string> = {
    VENDOR_SITE: 'Vendor Site',
    DELIVERY_SITE: 'Delivery Site',
    THIRD_PARTY: 'Third Party',
  };
  return typeTexts[type] || type;
}

// Filter goods receipts by search query
export function filterGRsBySearch(grs: GoodsReceipt[], searchQuery: string): GoodsReceipt[] {
  if (!searchQuery.trim()) return grs;

  const query = searchQuery.toLowerCase();
  return grs.filter(
    (gr) =>
      gr.number.toLowerCase().includes(query) ||
      gr.poNumber.toLowerCase().includes(query) ||
      gr.projectName.toLowerCase().includes(query) ||
      gr.inspectedByName?.toLowerCase().includes(query)
  );
}

// Calculate stats for goods receipt dashboard
export function calculateGRStats(grs: GoodsReceipt[]) {
  return {
    total: grs.length,
    pending: grs.filter((gr) => gr.status === 'PENDING').length,
    inProgress: grs.filter((gr) => gr.status === 'IN_PROGRESS').length,
    completed: grs.filter((gr) => gr.status === 'COMPLETED').length,
    withIssues: grs.filter((gr) => gr.hasIssues).length,
    awaitingPaymentApproval: grs.filter((gr) => gr.status === 'COMPLETED' && !gr.approvedForPayment)
      .length,
  };
}

// Get available actions based on status
export function getGRAvailableActions(gr: GoodsReceipt): {
  canComplete: boolean;
  canCreateBill: boolean;
  canApprovePayment: boolean;
} {
  return {
    canComplete: gr.status === 'IN_PROGRESS',
    canCreateBill: gr.status === 'COMPLETED' && !gr.paymentRequestId,
    canApprovePayment: gr.status === 'COMPLETED' && !gr.approvedForPayment && !!gr.paymentRequestId,
  };
}
