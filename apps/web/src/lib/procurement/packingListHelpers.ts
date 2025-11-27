/**
 * Packing List Helper Functions
 *
 * Utility functions for formatting, filtering, and computing packing list data
 */

import type { PackingList, PackingListStatus } from '@vapour/types';

// Status display text
export function getPLStatusText(status: PackingListStatus): string {
  const statusTexts: Record<PackingListStatus, string> = {
    DRAFT: 'Draft',
    FINALIZED: 'Finalized',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
  };
  return statusTexts[status] || status;
}

// Status color for MUI Chip
export function getPLStatusColor(
  status: PackingListStatus
): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
  const statusColors: Record<
    PackingListStatus,
    'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
  > = {
    DRAFT: 'default',
    FINALIZED: 'info',
    SHIPPED: 'warning',
    DELIVERED: 'success',
  };
  return statusColors[status] || 'default';
}

// Shipping method display text
export function getShippingMethodText(method?: 'AIR' | 'SEA' | 'ROAD' | 'COURIER'): string {
  if (!method) return '-';
  const methodTexts: Record<string, string> = {
    AIR: 'Air Freight',
    SEA: 'Sea Freight',
    ROAD: 'Road Transport',
    COURIER: 'Courier',
  };
  return methodTexts[method] || method;
}

// Filter packing lists by search query
export function filterPLsBySearch(pls: PackingList[], searchQuery: string): PackingList[] {
  if (!searchQuery.trim()) return pls;

  const query = searchQuery.toLowerCase();
  return pls.filter(
    (pl) =>
      pl.number.toLowerCase().includes(query) ||
      pl.poNumber.toLowerCase().includes(query) ||
      pl.vendorName.toLowerCase().includes(query) ||
      pl.projectName.toLowerCase().includes(query) ||
      pl.trackingNumber?.toLowerCase().includes(query)
  );
}

// Calculate stats for packing list dashboard
export function calculatePLStats(pls: PackingList[]) {
  return {
    total: pls.length,
    draft: pls.filter((pl) => pl.status === 'DRAFT').length,
    finalized: pls.filter((pl) => pl.status === 'FINALIZED').length,
    shipped: pls.filter((pl) => pl.status === 'SHIPPED').length,
    delivered: pls.filter((pl) => pl.status === 'DELIVERED').length,
    totalPackages: pls.reduce((sum, pl) => sum + (pl.numberOfPackages || 0), 0),
  };
}

// Check if status transition is allowed
export function canTransitionTo(
  currentStatus: PackingListStatus,
  targetStatus: PackingListStatus
): boolean {
  const allowedTransitions: Record<PackingListStatus, PackingListStatus[]> = {
    DRAFT: ['FINALIZED'],
    FINALIZED: ['SHIPPED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: [],
  };
  return allowedTransitions[currentStatus]?.includes(targetStatus) || false;
}

// Get available actions based on status
export function getAvailableActions(status: PackingListStatus): {
  canFinalize: boolean;
  canShip: boolean;
  canDeliver: boolean;
  canEdit: boolean;
} {
  return {
    canFinalize: status === 'DRAFT',
    canShip: status === 'FINALIZED',
    canDeliver: status === 'SHIPPED',
    canEdit: status === 'DRAFT',
  };
}
