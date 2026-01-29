/**
 * PO Amendment Helper Functions Tests
 *
 * Tests for UI helper functions for PO amendments
 */

// Mock the formatCurrency import
jest.mock('@/lib/utils/formatters', () => ({
  formatCurrency: jest.fn((amount: number, currency: string) => `${currency} ${amount.toFixed(2)}`),
}));

import {
  getAmendmentStatusText,
  getAmendmentStatusColor,
  getAmendmentTypeText,
  filterAmendments,
  filterAmendmentsByStatus,
  calculateAmendmentStats,
  getAmendmentAvailableActions,
} from './amendmentHelpers';
import type { PurchaseOrderAmendment } from '@vapour/types';
import type { Timestamp } from 'firebase/firestore';

// Helper to create mock amendments - these tests only need the fields used by the helper functions
// Using type assertion since we're testing pure functions that only access specific fields
function createMockAmendment(data: {
  id: string;
  purchaseOrderNumber: string;
  reason: string;
  requestedByName: string;
  status: PurchaseOrderAmendment['status'];
  totalChange: number;
  amendmentType?: PurchaseOrderAmendment['amendmentType'];
}): PurchaseOrderAmendment {
  const mockTimestamp = {} as Timestamp;
  // Cast to unknown first to bypass strict type checking for test mocks
  return {
    id: data.id,
    purchaseOrderId: 'po-default',
    purchaseOrderNumber: data.purchaseOrderNumber,
    amendmentNumber: 1,
    amendmentDate: mockTimestamp,
    amendmentType: data.amendmentType || 'GENERAL',
    reason: data.reason,
    requestedBy: 'user-default',
    requestedByName: data.requestedByName,
    changes: [],
    previousGrandTotal: 0,
    newGrandTotal: 0,
    totalChange: data.totalChange,
    status: data.status,
    applied: false,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    createdBy: 'user-default',
    updatedBy: 'user-default',
  } as PurchaseOrderAmendment;
}

describe('amendmentHelpers', () => {
  // ============================================================================
  // GET AMENDMENT STATUS TEXT
  // ============================================================================
  describe('getAmendmentStatusText', () => {
    it('should return correct text for DRAFT status', () => {
      expect(getAmendmentStatusText('DRAFT')).toBe('Draft');
    });

    it('should return correct text for PENDING_APPROVAL status', () => {
      expect(getAmendmentStatusText('PENDING_APPROVAL')).toBe('Pending Approval');
    });

    it('should return correct text for APPROVED status', () => {
      expect(getAmendmentStatusText('APPROVED')).toBe('Approved');
    });

    it('should return correct text for REJECTED status', () => {
      expect(getAmendmentStatusText('REJECTED')).toBe('Rejected');
    });
  });

  // ============================================================================
  // GET AMENDMENT STATUS COLOR
  // ============================================================================
  describe('getAmendmentStatusColor', () => {
    it('should return default color for DRAFT status', () => {
      expect(getAmendmentStatusColor('DRAFT')).toBe('default');
    });

    it('should return warning color for PENDING_APPROVAL status', () => {
      expect(getAmendmentStatusColor('PENDING_APPROVAL')).toBe('warning');
    });

    it('should return success color for APPROVED status', () => {
      expect(getAmendmentStatusColor('APPROVED')).toBe('success');
    });

    it('should return error color for REJECTED status', () => {
      expect(getAmendmentStatusColor('REJECTED')).toBe('error');
    });
  });

  // ============================================================================
  // GET AMENDMENT TYPE TEXT
  // ============================================================================
  describe('getAmendmentTypeText', () => {
    it('should return correct text for QUANTITY_CHANGE', () => {
      expect(getAmendmentTypeText('QUANTITY_CHANGE')).toBe('Quantity Change');
    });

    it('should return correct text for PRICE_CHANGE', () => {
      expect(getAmendmentTypeText('PRICE_CHANGE')).toBe('Price Change');
    });

    it('should return correct text for TERMS_CHANGE', () => {
      expect(getAmendmentTypeText('TERMS_CHANGE')).toBe('Terms Change');
    });

    it('should return correct text for DELIVERY_CHANGE', () => {
      expect(getAmendmentTypeText('DELIVERY_CHANGE')).toBe('Delivery Change');
    });

    it('should return correct text for GENERAL', () => {
      expect(getAmendmentTypeText('GENERAL')).toBe('General');
    });
  });

  // ============================================================================
  // FILTER AMENDMENTS
  // ============================================================================
  describe('filterAmendments', () => {
    const mockAmendments: PurchaseOrderAmendment[] = [
      createMockAmendment({
        id: 'amend-1',
        purchaseOrderNumber: 'PO/2024/01/0001',
        amendmentType: 'QUANTITY_CHANGE',
        reason: 'Customer requested additional units',
        status: 'APPROVED',
        totalChange: 20000,
        requestedByName: 'John Smith',
      }),
      createMockAmendment({
        id: 'amend-2',
        purchaseOrderNumber: 'PO/2024/01/0002',
        amendmentType: 'PRICE_CHANGE',
        reason: 'Vendor price increase',
        status: 'PENDING_APPROVAL',
        totalChange: 5000,
        requestedByName: 'Jane Doe',
      }),
    ];

    it('should return all amendments when search term is empty', () => {
      const result = filterAmendments(mockAmendments, '');
      expect(result).toHaveLength(2);
    });

    it('should return all amendments when search term is whitespace', () => {
      const result = filterAmendments(mockAmendments, '   ');
      expect(result).toHaveLength(2);
    });

    it('should filter by PO number', () => {
      const result = filterAmendments(mockAmendments, '0001');
      expect(result).toHaveLength(1);
      expect(result[0]?.purchaseOrderNumber).toBe('PO/2024/01/0001');
    });

    it('should filter by reason (case insensitive)', () => {
      const result = filterAmendments(mockAmendments, 'vendor');
      expect(result).toHaveLength(1);
      expect(result[0]?.reason).toContain('Vendor');
    });

    it('should filter by requester name', () => {
      const result = filterAmendments(mockAmendments, 'john');
      expect(result).toHaveLength(1);
      expect(result[0]?.requestedByName).toBe('John Smith');
    });

    it('should return empty array when no matches', () => {
      const result = filterAmendments(mockAmendments, 'nonexistent');
      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // FILTER AMENDMENTS BY STATUS
  // ============================================================================
  describe('filterAmendmentsByStatus', () => {
    const mockAmendments: PurchaseOrderAmendment[] = [
      createMockAmendment({
        id: 'amend-1',
        purchaseOrderNumber: 'PO/2024/01/0001',
        reason: 'Test',
        status: 'DRAFT',
        totalChange: 50,
        requestedByName: 'Test',
      }),
      createMockAmendment({
        id: 'amend-2',
        purchaseOrderNumber: 'PO/2024/01/0002',
        reason: 'Test',
        status: 'PENDING_APPROVAL',
        totalChange: 20,
        requestedByName: 'Test',
      }),
      createMockAmendment({
        id: 'amend-3',
        purchaseOrderNumber: 'PO/2024/01/0003',
        reason: 'Test',
        status: 'APPROVED',
        totalChange: 50,
        requestedByName: 'Test',
      }),
    ];

    it('should return all amendments when status is ALL', () => {
      const result = filterAmendmentsByStatus(mockAmendments, 'ALL');
      expect(result).toHaveLength(3);
    });

    it('should filter by DRAFT status', () => {
      const result = filterAmendmentsByStatus(mockAmendments, 'DRAFT');
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('DRAFT');
    });

    it('should filter by PENDING_APPROVAL status', () => {
      const result = filterAmendmentsByStatus(mockAmendments, 'PENDING_APPROVAL');
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('PENDING_APPROVAL');
    });

    it('should filter by APPROVED status', () => {
      const result = filterAmendmentsByStatus(mockAmendments, 'APPROVED');
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('APPROVED');
    });

    it('should return empty array for REJECTED when none exist', () => {
      const result = filterAmendmentsByStatus(mockAmendments, 'REJECTED');
      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // CALCULATE AMENDMENT STATS
  // ============================================================================
  describe('calculateAmendmentStats', () => {
    const mockAmendments: PurchaseOrderAmendment[] = [
      createMockAmendment({
        id: 'amend-1',
        purchaseOrderNumber: 'PO/2024/01/0001',
        reason: 'Test',
        status: 'DRAFT',
        totalChange: 50,
        requestedByName: 'Test',
      }),
      createMockAmendment({
        id: 'amend-2',
        purchaseOrderNumber: 'PO/2024/01/0002',
        reason: 'Test',
        status: 'PENDING_APPROVAL',
        totalChange: 20,
        requestedByName: 'Test',
      }),
      createMockAmendment({
        id: 'amend-3',
        purchaseOrderNumber: 'PO/2024/01/0003',
        reason: 'Test',
        status: 'APPROVED',
        totalChange: 100,
        requestedByName: 'Test',
      }),
      createMockAmendment({
        id: 'amend-4',
        purchaseOrderNumber: 'PO/2024/01/0004',
        reason: 'Test',
        status: 'APPROVED',
        totalChange: 50,
        requestedByName: 'Test',
      }),
      createMockAmendment({
        id: 'amend-5',
        purchaseOrderNumber: 'PO/2024/01/0005',
        reason: 'Test',
        status: 'REJECTED',
        totalChange: 100,
        requestedByName: 'Test',
      }),
    ];

    it('should calculate correct total count', () => {
      const stats = calculateAmendmentStats(mockAmendments);
      expect(stats.total).toBe(5);
    });

    it('should calculate correct draft count', () => {
      const stats = calculateAmendmentStats(mockAmendments);
      expect(stats.draft).toBe(1);
    });

    it('should calculate correct pending approval count', () => {
      const stats = calculateAmendmentStats(mockAmendments);
      expect(stats.pendingApproval).toBe(1);
    });

    it('should calculate correct approved count', () => {
      const stats = calculateAmendmentStats(mockAmendments);
      expect(stats.approved).toBe(2);
    });

    it('should calculate correct rejected count', () => {
      const stats = calculateAmendmentStats(mockAmendments);
      expect(stats.rejected).toBe(1);
    });

    it('should calculate total value change only for approved amendments', () => {
      const stats = calculateAmendmentStats(mockAmendments);
      // Only approved: 100 + 50 = 150
      expect(stats.totalValueChange).toBe(150);
    });

    it('should return zeros for empty array', () => {
      const stats = calculateAmendmentStats([]);
      expect(stats).toEqual({
        total: 0,
        draft: 0,
        pendingApproval: 0,
        approved: 0,
        rejected: 0,
        totalValueChange: 0,
      });
    });
  });

  // ============================================================================
  // GET AMENDMENT AVAILABLE ACTIONS
  // ============================================================================
  describe('getAmendmentAvailableActions', () => {
    it('should return correct actions for DRAFT status', () => {
      const amendment = createMockAmendment({
        id: 'amend-1',
        purchaseOrderNumber: 'PO/2024/01/0001',
        reason: 'Test',
        status: 'DRAFT',
        totalChange: 50,
        requestedByName: 'Test',
      });
      const actions = getAmendmentAvailableActions(amendment);
      expect(actions).toEqual({
        canSubmit: true,
        canApprove: false,
        canReject: false,
        canEdit: true,
        canDelete: true,
      });
    });

    it('should return correct actions for PENDING_APPROVAL status', () => {
      const amendment = createMockAmendment({
        id: 'amend-1',
        purchaseOrderNumber: 'PO/2024/01/0001',
        reason: 'Test',
        status: 'PENDING_APPROVAL',
        totalChange: 50,
        requestedByName: 'Test',
      });
      const actions = getAmendmentAvailableActions(amendment);
      expect(actions).toEqual({
        canSubmit: false,
        canApprove: true,
        canReject: true,
        canEdit: false,
        canDelete: false,
      });
    });

    it('should return correct actions for APPROVED status', () => {
      const amendment = createMockAmendment({
        id: 'amend-1',
        purchaseOrderNumber: 'PO/2024/01/0001',
        reason: 'Test',
        status: 'APPROVED',
        totalChange: 50,
        requestedByName: 'Test',
      });
      const actions = getAmendmentAvailableActions(amendment);
      expect(actions).toEqual({
        canSubmit: false,
        canApprove: false,
        canReject: false,
        canEdit: false,
        canDelete: false,
      });
    });

    it('should return correct actions for REJECTED status', () => {
      const amendment = createMockAmendment({
        id: 'amend-1',
        purchaseOrderNumber: 'PO/2024/01/0001',
        reason: 'Test',
        status: 'REJECTED',
        totalChange: 50,
        requestedByName: 'Test',
      });
      const actions = getAmendmentAvailableActions(amendment);
      expect(actions).toEqual({
        canSubmit: false,
        canApprove: false,
        canReject: false,
        canEdit: false,
        canDelete: false,
      });
    });
  });
});
