/**
 * Goods Receipt Helpers Tests
 *
 * Tests for pure utility functions: status/condition text and colors,
 * search filtering, stats calculation, and available actions.
 */

import type { GoodsReceipt, GoodsReceiptStatus, ItemCondition } from '@vapour/types';
import {
  getGRStatusText,
  getGRStatusColor,
  getConditionText,
  getConditionColor,
  getOverallConditionText,
  getOverallConditionColor,
  getInspectionTypeText,
  filterGRsBySearch,
  calculateGRStats,
  getGRAvailableActions,
} from './goodsReceiptHelpers';

// Helper to create a minimal GoodsReceipt
function createMockGR(overrides?: Partial<GoodsReceipt>): GoodsReceipt {
  return {
    id: 'gr-1',
    number: 'GR/2025/01/0001',
    purchaseOrderId: 'po-1',
    poNumber: 'PO/2025/01/0001',
    projectId: 'proj-1',
    projectName: 'Alpha Project',
    inspectionType: 'DELIVERY_SITE',
    inspectionLocation: 'Site A',
    inspectionDate: {
      seconds: Date.now() / 1000,
      nanoseconds: 0,
    } as unknown as GoodsReceipt['inspectionDate'],
    overallCondition: 'ACCEPTED',
    hasIssues: false,
    status: 'COMPLETED',
    approvedForPayment: false,
    inspectedBy: 'user-1',
    inspectedByName: 'John Doe',
    createdAt: {
      seconds: Date.now() / 1000,
      nanoseconds: 0,
    } as unknown as GoodsReceipt['createdAt'],
    updatedAt: {
      seconds: Date.now() / 1000,
      nanoseconds: 0,
    } as unknown as GoodsReceipt['updatedAt'],
    ...overrides,
  } as unknown as GoodsReceipt;
}

describe('goodsReceiptHelpers', () => {
  describe('getGRStatusText', () => {
    it.each<[GoodsReceiptStatus, string]>([
      ['PENDING', 'Pending'],
      ['IN_PROGRESS', 'In Progress'],
      ['COMPLETED', 'Completed'],
      ['ISSUES_FOUND', 'Issues Found'],
    ])('returns "%s" -> "%s"', (status, expected) => {
      expect(getGRStatusText(status)).toBe(expected);
    });
  });

  describe('getGRStatusColor', () => {
    it.each<[GoodsReceiptStatus, string]>([
      ['PENDING', 'default'],
      ['IN_PROGRESS', 'info'],
      ['COMPLETED', 'success'],
      ['ISSUES_FOUND', 'error'],
    ])('returns "%s" -> "%s"', (status, expected) => {
      expect(getGRStatusColor(status)).toBe(expected);
    });
  });

  describe('getConditionText', () => {
    it.each<[ItemCondition, string]>([
      ['GOOD', 'Good'],
      ['DAMAGED', 'Damaged'],
      ['DEFECTIVE', 'Defective'],
      ['INCOMPLETE', 'Incomplete'],
    ])('returns "%s" -> "%s"', (condition, expected) => {
      expect(getConditionText(condition)).toBe(expected);
    });
  });

  describe('getConditionColor', () => {
    it.each<[ItemCondition, string]>([
      ['GOOD', 'success'],
      ['DAMAGED', 'error'],
      ['DEFECTIVE', 'error'],
      ['INCOMPLETE', 'warning'],
    ])('returns "%s" -> "%s"', (condition, expected) => {
      expect(getConditionColor(condition)).toBe(expected);
    });
  });

  describe('getOverallConditionText', () => {
    it('returns "Accepted" for ACCEPTED', () => {
      expect(getOverallConditionText('ACCEPTED')).toBe('Accepted');
    });

    it('returns "Conditionally Accepted" for CONDITIONALLY_ACCEPTED', () => {
      expect(getOverallConditionText('CONDITIONALLY_ACCEPTED')).toBe('Conditionally Accepted');
    });

    it('returns "Rejected" for REJECTED', () => {
      expect(getOverallConditionText('REJECTED')).toBe('Rejected');
    });

    it('returns "-" for undefined', () => {
      expect(getOverallConditionText(undefined)).toBe('-');
    });
  });

  describe('getOverallConditionColor', () => {
    it('returns "success" for ACCEPTED', () => {
      expect(getOverallConditionColor('ACCEPTED')).toBe('success');
    });

    it('returns "warning" for CONDITIONALLY_ACCEPTED', () => {
      expect(getOverallConditionColor('CONDITIONALLY_ACCEPTED')).toBe('warning');
    });

    it('returns "error" for REJECTED', () => {
      expect(getOverallConditionColor('REJECTED')).toBe('error');
    });

    it('returns "default" for undefined', () => {
      expect(getOverallConditionColor(undefined)).toBe('default');
    });
  });

  describe('getInspectionTypeText', () => {
    it.each<['VENDOR_SITE' | 'DELIVERY_SITE' | 'THIRD_PARTY', string]>([
      ['VENDOR_SITE', 'Vendor Site'],
      ['DELIVERY_SITE', 'Delivery Site'],
      ['THIRD_PARTY', 'Third Party'],
    ])('returns "%s" -> "%s"', (type, expected) => {
      expect(getInspectionTypeText(type)).toBe(expected);
    });
  });

  describe('filterGRsBySearch', () => {
    const grs = [
      createMockGR({
        id: 'gr-1',
        number: 'GR/2025/01/0001',
        poNumber: 'PO-001',
        projectName: 'Alpha Project',
        inspectedByName: 'John Doe',
      }),
      createMockGR({
        id: 'gr-2',
        number: 'GR/2025/01/0002',
        poNumber: 'PO-002',
        projectName: 'Beta Project',
        inspectedByName: 'Jane Smith',
      }),
      createMockGR({
        id: 'gr-3',
        number: 'GR/2025/02/0001',
        poNumber: 'PO-003',
        projectName: 'Gamma Project',
        inspectedByName: 'Bob Wilson',
      }),
    ];

    it('returns all GRs when search is empty', () => {
      expect(filterGRsBySearch(grs, '')).toHaveLength(3);
      expect(filterGRsBySearch(grs, '   ')).toHaveLength(3);
    });

    it('filters by GR number', () => {
      expect(filterGRsBySearch(grs, '0002')).toHaveLength(1);
      expect(filterGRsBySearch(grs, '0002')[0]!.id).toBe('gr-2');
    });

    it('filters by PO number', () => {
      expect(filterGRsBySearch(grs, 'PO-001')).toHaveLength(1);
    });

    it('filters by project name', () => {
      expect(filterGRsBySearch(grs, 'Beta')).toHaveLength(1);
    });

    it('filters by inspector name', () => {
      expect(filterGRsBySearch(grs, 'jane')).toHaveLength(1);
    });

    it('is case insensitive', () => {
      expect(filterGRsBySearch(grs, 'ALPHA')).toHaveLength(1);
    });

    it('returns empty when no match', () => {
      expect(filterGRsBySearch(grs, 'nonexistent')).toHaveLength(0);
    });
  });

  describe('calculateGRStats', () => {
    it('calculates all stats correctly', () => {
      const grs = [
        createMockGR({ status: 'PENDING', hasIssues: false, approvedForPayment: false }),
        createMockGR({ status: 'PENDING', hasIssues: false, approvedForPayment: false }),
        createMockGR({ status: 'IN_PROGRESS', hasIssues: false, approvedForPayment: false }),
        createMockGR({ status: 'COMPLETED', hasIssues: false, approvedForPayment: false }),
        createMockGR({ status: 'COMPLETED', hasIssues: true, approvedForPayment: true }),
        createMockGR({ status: 'ISSUES_FOUND', hasIssues: true, approvedForPayment: false }),
      ];

      const stats = calculateGRStats(grs);

      expect(stats.total).toBe(6);
      expect(stats.pending).toBe(2);
      expect(stats.inProgress).toBe(1);
      expect(stats.completed).toBe(2);
      expect(stats.withIssues).toBe(2);
      expect(stats.awaitingPaymentApproval).toBe(1); // COMPLETED but not approved
    });

    it('returns zeros for empty array', () => {
      const stats = calculateGRStats([]);

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.inProgress).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.withIssues).toBe(0);
      expect(stats.awaitingPaymentApproval).toBe(0);
    });
  });

  describe('getGRAvailableActions', () => {
    it('can complete when IN_PROGRESS', () => {
      const gr = createMockGR({ status: 'IN_PROGRESS' });
      const actions = getGRAvailableActions(gr);

      expect(actions.canComplete).toBe(true);
      expect(actions.canApprovePayment).toBe(false);
    });

    it('can approve payment when COMPLETED with bill and not yet approved', () => {
      const gr = createMockGR({
        status: 'COMPLETED',
        approvedForPayment: false,
        paymentRequestId: 'bill-123',
      });
      const actions = getGRAvailableActions(gr);

      expect(actions.canComplete).toBe(false);
      expect(actions.canCreateBill).toBe(false);
      expect(actions.canApprovePayment).toBe(true);
    });

    it('can create bill when COMPLETED, sent to accounting, without bill', () => {
      const gr = createMockGR({
        status: 'COMPLETED',
        approvedForPayment: false,
        sentToAccountingAt: {
          seconds: Date.now() / 1000,
          nanoseconds: 0,
        } as unknown as GoodsReceipt['sentToAccountingAt'],
      });
      const actions = getGRAvailableActions(gr);

      expect(actions.canCreateBill).toBe(true);
      expect(actions.canApprovePayment).toBe(false);
    });

    it('cannot create bill when COMPLETED but not sent to accounting', () => {
      const gr = createMockGR({ status: 'COMPLETED', approvedForPayment: false });
      const actions = getGRAvailableActions(gr);

      expect(actions.canCreateBill).toBe(false);
    });

    it('cannot approve payment when already approved', () => {
      const gr = createMockGR({
        status: 'COMPLETED',
        approvedForPayment: true,
        paymentRequestId: 'bill-123',
      });
      const actions = getGRAvailableActions(gr);

      expect(actions.canApprovePayment).toBe(false);
    });

    it('has no actions when PENDING', () => {
      const gr = createMockGR({ status: 'PENDING' });
      const actions = getGRAvailableActions(gr);

      expect(actions.canComplete).toBe(false);
      expect(actions.canCreateBill).toBe(false);
      expect(actions.canApprovePayment).toBe(false);
    });
  });
});
