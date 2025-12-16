/**
 * Purchase Order Helper Functions Tests
 *
 * Tests for PO utility functions including:
 * - Status utilities
 * - Validation utilities
 * - Display formatting
 * - Filter and sort utilities
 * - Statistics calculation
 */

import type { PurchaseOrder, PurchaseOrderStatus } from '@vapour/types';
import {
  getPOStatusText,
  getPOStatusColor,
  canEditPO,
  canSubmitForApproval,
  canApprovePO,
  canRejectPO,
  canIssuePO,
  canCancelPO,
  formatCurrency,
  formatExpectedDelivery,
  getDeliveryStatus,
  getPaymentStatus,
  getAdvancePaymentStatus,
  filterPOsBySearch,
  sortPOsByDate,
  sortPOsByAmount,
  calculatePOStats,
  validatePOForSubmission,
} from './purchaseOrderHelpers';

// Mock Timestamp helper
const createMockTimestamp = (date: Date) => ({
  toDate: () => date,
  toMillis: () => date.getTime(),
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
});

// Helper to create mock PurchaseOrder
const createMockPO = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder =>
  ({
    id: 'po-1',
    number: 'PO-2024-001',
    projectId: 'project-1',
    vendorId: 'vendor-1',
    vendorName: 'Test Vendor Pvt Ltd',
    title: 'Steel Plates Order',
    status: 'DRAFT' as PurchaseOrderStatus,
    grandTotal: 100000,
    currency: 'INR',
    deliveryAddress: '123 Factory Street, Mumbai',
    paymentTerms: 'Net 30',
    deliveryTerms: 'FOB Destination',
    createdAt: createMockTimestamp(new Date()),
    updatedAt: createMockTimestamp(new Date()),
    ...overrides,
  }) as PurchaseOrder;

describe('Purchase Order Helpers', () => {
  describe('getPOStatusText', () => {
    it.each<[PurchaseOrderStatus, string]>([
      ['DRAFT', 'Draft'],
      ['PENDING_APPROVAL', 'Pending Approval'],
      ['APPROVED', 'Approved'],
      ['REJECTED', 'Rejected'],
      ['ISSUED', 'Issued'],
      ['ACKNOWLEDGED', 'Acknowledged'],
      ['IN_PROGRESS', 'In Progress'],
      ['DELIVERED', 'Delivered'],
      ['COMPLETED', 'Completed'],
      ['CANCELLED', 'Cancelled'],
      ['AMENDED', 'Amended'],
    ])('should return "%s" for status %s', (status, expected) => {
      expect(getPOStatusText(status)).toBe(expected);
    });

    it('should return status itself for unknown status', () => {
      expect(getPOStatusText('UNKNOWN' as PurchaseOrderStatus)).toBe('UNKNOWN');
    });
  });

  describe('getPOStatusColor', () => {
    it.each<[PurchaseOrderStatus, string]>([
      ['DRAFT', 'default'],
      ['PENDING_APPROVAL', 'warning'],
      ['APPROVED', 'info'],
      ['REJECTED', 'error'],
      ['ISSUED', 'primary'],
      ['ACKNOWLEDGED', 'info'],
      ['IN_PROGRESS', 'primary'],
      ['DELIVERED', 'success'],
      ['COMPLETED', 'success'],
      ['CANCELLED', 'error'],
      ['AMENDED', 'warning'],
    ])('should return "%s" color for status %s', (status, expected) => {
      expect(getPOStatusColor(status)).toBe(expected);
    });

    it('should return default for unknown status', () => {
      expect(getPOStatusColor('UNKNOWN' as PurchaseOrderStatus)).toBe('default');
    });
  });

  describe('canEditPO', () => {
    it('should return true for DRAFT status', () => {
      const po = createMockPO({ status: 'DRAFT' });
      expect(canEditPO(po)).toBe(true);
    });

    it.each<PurchaseOrderStatus>([
      'PENDING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'ISSUED',
      'ACKNOWLEDGED',
      'IN_PROGRESS',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
      'AMENDED',
    ])('should return false for %s status', (status) => {
      const po = createMockPO({ status });
      expect(canEditPO(po)).toBe(false);
    });
  });

  describe('canSubmitForApproval', () => {
    it('should return true for DRAFT status', () => {
      const po = createMockPO({ status: 'DRAFT' });
      expect(canSubmitForApproval(po)).toBe(true);
    });

    it('should return false for non-DRAFT status', () => {
      const po = createMockPO({ status: 'PENDING_APPROVAL' });
      expect(canSubmitForApproval(po)).toBe(false);
    });
  });

  describe('canApprovePO', () => {
    it('should return true for PENDING_APPROVAL status', () => {
      const po = createMockPO({ status: 'PENDING_APPROVAL' });
      expect(canApprovePO(po)).toBe(true);
    });

    it.each<PurchaseOrderStatus>(['DRAFT', 'APPROVED', 'ISSUED', 'COMPLETED'])(
      'should return false for %s status',
      (status) => {
        const po = createMockPO({ status });
        expect(canApprovePO(po)).toBe(false);
      }
    );
  });

  describe('canRejectPO', () => {
    it('should return true for PENDING_APPROVAL status', () => {
      const po = createMockPO({ status: 'PENDING_APPROVAL' });
      expect(canRejectPO(po)).toBe(true);
    });

    it('should return false for non-PENDING_APPROVAL status', () => {
      const po = createMockPO({ status: 'APPROVED' });
      expect(canRejectPO(po)).toBe(false);
    });
  });

  describe('canIssuePO', () => {
    it('should return true for APPROVED status', () => {
      const po = createMockPO({ status: 'APPROVED' });
      expect(canIssuePO(po)).toBe(true);
    });

    it.each<PurchaseOrderStatus>(['DRAFT', 'PENDING_APPROVAL', 'ISSUED', 'COMPLETED'])(
      'should return false for %s status',
      (status) => {
        const po = createMockPO({ status });
        expect(canIssuePO(po)).toBe(false);
      }
    );
  });

  describe('canCancelPO', () => {
    it.each<PurchaseOrderStatus>(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED'])(
      'should return true for %s status',
      (status) => {
        const po = createMockPO({ status });
        expect(canCancelPO(po)).toBe(true);
      }
    );

    it.each<PurchaseOrderStatus>([
      'ACKNOWLEDGED',
      'IN_PROGRESS',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
      'AMENDED',
    ])('should return false for %s status', (status) => {
      const po = createMockPO({ status });
      expect(canCancelPO(po)).toBe(false);
    });
  });

  describe('formatCurrency', () => {
    it('should format INR with rupee symbol', () => {
      expect(formatCurrency(100000, 'INR')).toBe('₹1,00,000.00');
    });

    it('should format USD with dollar symbol', () => {
      expect(formatCurrency(5000, 'USD')).toBe('$5,000.00');
    });

    it('should format EUR with euro symbol (German locale)', () => {
      const result = formatCurrency(2500.5, 'EUR');
      // German locale: "2.500,50 €"
      expect(result).toContain('€');
      expect(result).toContain('2');
      expect(result).toContain('500');
    });

    it('should format GBP with pound symbol', () => {
      const result = formatCurrency(1234.56, 'GBP');
      expect(result).toContain('£');
      expect(result).toContain('1,234.56');
    });

    it('should format JPY with yen symbol', () => {
      const result = formatCurrency(1000, 'JPY');
      // JPY uses yen symbol ¥
      expect(result).toContain('¥');
      expect(result).toContain('1,000');
    });

    it('should default to INR when no currency specified', () => {
      expect(formatCurrency(50000)).toBe('₹50,000.00');
    });

    it('should handle zero amount', () => {
      expect(formatCurrency(0, 'INR')).toBe('₹0.00');
    });

    it('should handle decimal amounts', () => {
      expect(formatCurrency(1234.567, 'INR')).toBe('₹1,234.57');
    });
  });

  describe('formatExpectedDelivery', () => {
    it('should return "Not specified" when no delivery date', () => {
      const po = createMockPO({ expectedDeliveryDate: undefined });
      expect(formatExpectedDelivery(po)).toBe('Not specified');
    });

    it('should return "Due today" for today\'s date', () => {
      const today = new Date();
      const po = createMockPO({
        expectedDeliveryDate: createMockTimestamp(today) as never,
      });
      expect(formatExpectedDelivery(po)).toBe('Due today');
    });

    it('should return days remaining for dates within 7 days', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      futureDate.setHours(23, 59, 59); // End of day to ensure 3 days
      const po = createMockPO({
        expectedDeliveryDate: createMockTimestamp(futureDate) as never,
      });
      const result = formatExpectedDelivery(po);
      expect(result).toMatch(/Due in \d+ days?/);
    });

    it('should return overdue message for past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const po = createMockPO({
        expectedDeliveryDate: createMockTimestamp(pastDate) as never,
      });
      expect(formatExpectedDelivery(po)).toMatch(/Overdue by \d+ days/);
    });

    it('should return formatted date for dates beyond 7 days', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const po = createMockPO({
        expectedDeliveryDate: createMockTimestamp(futureDate) as never,
      });
      const result = formatExpectedDelivery(po);
      // Should be a formatted date string like "1/15/2024"
      expect(result).not.toMatch(/Due in/);
      expect(result).not.toBe('Not specified');
    });
  });

  describe('getDeliveryStatus', () => {
    it('should return "Not Started" for 0% progress', () => {
      const po = createMockPO({ deliveryProgress: 0 });
      const result = getDeliveryStatus(po);
      expect(result.text).toBe('Not Started');
      expect(result.color).toBe('default');
    });

    it('should return percentage for partial delivery', () => {
      const po = createMockPO({ deliveryProgress: 45 });
      const result = getDeliveryStatus(po);
      expect(result.text).toBe('45% Delivered');
      expect(result.color).toBe('primary');
    });

    it('should return "Fully Delivered" for 100% progress', () => {
      const po = createMockPO({ deliveryProgress: 100 });
      const result = getDeliveryStatus(po);
      expect(result.text).toBe('Fully Delivered');
      expect(result.color).toBe('success');
    });

    it('should handle undefined delivery progress', () => {
      const po = createMockPO({ deliveryProgress: undefined });
      const result = getDeliveryStatus(po);
      expect(result.text).toBe('Not Started');
      expect(result.color).toBe('default');
    });

    it('should round decimal percentages', () => {
      const po = createMockPO({ deliveryProgress: 33.333 });
      const result = getDeliveryStatus(po);
      expect(result.text).toBe('33% Delivered');
    });
  });

  describe('getPaymentStatus', () => {
    it('should return "Not Paid" for 0% progress', () => {
      const po = createMockPO({ paymentProgress: 0 });
      const result = getPaymentStatus(po);
      expect(result.text).toBe('Not Paid');
      expect(result.color).toBe('default');
    });

    it('should return percentage for partial payment', () => {
      const po = createMockPO({ paymentProgress: 50 });
      const result = getPaymentStatus(po);
      expect(result.text).toBe('50% Paid');
      expect(result.color).toBe('warning');
    });

    it('should return "Fully Paid" for 100% progress', () => {
      const po = createMockPO({ paymentProgress: 100 });
      const result = getPaymentStatus(po);
      expect(result.text).toBe('Fully Paid');
      expect(result.color).toBe('success');
    });

    it('should handle undefined payment progress', () => {
      const po = createMockPO({ paymentProgress: undefined });
      const result = getPaymentStatus(po);
      expect(result.text).toBe('Not Paid');
    });
  });

  describe('getAdvancePaymentStatus', () => {
    it('should return null when advance not required', () => {
      const po = createMockPO({ advancePaymentRequired: false });
      expect(getAdvancePaymentStatus(po)).toBeNull();
    });

    it('should return null when advancePaymentRequired is undefined', () => {
      const po = createMockPO({ advancePaymentRequired: undefined });
      expect(getAdvancePaymentStatus(po)).toBeNull();
    });

    it('should return "Advance Pending" for PENDING status', () => {
      const po = createMockPO({
        advancePaymentRequired: true,
        advancePaymentStatus: 'PENDING',
      });
      const result = getAdvancePaymentStatus(po);
      expect(result?.text).toBe('Advance Pending');
      expect(result?.color).toBe('warning');
    });

    it('should return "Advance Requested" for REQUESTED status', () => {
      const po = createMockPO({
        advancePaymentRequired: true,
        advancePaymentStatus: 'REQUESTED',
      });
      const result = getAdvancePaymentStatus(po);
      expect(result?.text).toBe('Advance Requested');
      expect(result?.color).toBe('info');
    });

    it('should return "Advance Paid" for PAID status', () => {
      const po = createMockPO({
        advancePaymentRequired: true,
        advancePaymentStatus: 'PAID',
      });
      const result = getAdvancePaymentStatus(po);
      expect(result?.text).toBe('Advance Paid');
      expect(result?.color).toBe('success');
    });

    it('should default to PENDING when status not set', () => {
      const po = createMockPO({
        advancePaymentRequired: true,
        advancePaymentStatus: undefined,
      });
      const result = getAdvancePaymentStatus(po);
      expect(result?.text).toBe('Advance Pending');
    });
  });

  describe('filterPOsBySearch', () => {
    const testPOs = [
      createMockPO({
        id: 'po-1',
        number: 'PO-2024-001',
        vendorName: 'ABC Steel Suppliers',
        title: 'Steel Plates',
        selectedOfferNumber: 'OFF-001',
      }),
      createMockPO({
        id: 'po-2',
        number: 'PO-2024-002',
        vendorName: 'XYZ Industries',
        title: 'Pipe Fittings',
        selectedOfferNumber: 'OFF-002',
      }),
      createMockPO({
        id: 'po-3',
        number: 'PO-2024-003',
        vendorName: 'Steel Masters Pvt Ltd',
        title: 'Structural Steel',
        selectedOfferNumber: 'OFF-003',
      }),
    ];

    it('should return all POs for empty search query', () => {
      expect(filterPOsBySearch(testPOs, '')).toHaveLength(3);
      expect(filterPOsBySearch(testPOs, '   ')).toHaveLength(3);
    });

    it('should filter by PO number', () => {
      const result = filterPOsBySearch(testPOs, 'PO-2024-001');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('po-1');
    });

    it('should filter by vendor name', () => {
      const result = filterPOsBySearch(testPOs, 'XYZ');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('po-2');
    });

    it('should filter by title', () => {
      const result = filterPOsBySearch(testPOs, 'Pipe');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('po-2');
    });

    it('should filter by offer number', () => {
      const result = filterPOsBySearch(testPOs, 'OFF-003');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('po-3');
    });

    it('should be case insensitive', () => {
      const result = filterPOsBySearch(testPOs, 'steel');
      expect(result).toHaveLength(2); // ABC Steel and Steel Masters
    });

    it('should match partial strings', () => {
      const result = filterPOsBySearch(testPOs, 'Master');
      expect(result).toHaveLength(1);
      expect(result[0]?.vendorName).toContain('Masters');
    });
  });

  describe('sortPOsByDate', () => {
    const testPOs = [
      createMockPO({
        id: 'po-old',
        createdAt: createMockTimestamp(new Date('2024-01-01')) as never,
      }),
      createMockPO({
        id: 'po-mid',
        createdAt: createMockTimestamp(new Date('2024-06-01')) as never,
      }),
      createMockPO({
        id: 'po-new',
        createdAt: createMockTimestamp(new Date('2024-12-01')) as never,
      }),
    ];

    it('should sort by date descending by default', () => {
      const result = sortPOsByDate(testPOs);
      expect(result[0]?.id).toBe('po-new');
      expect(result[1]?.id).toBe('po-mid');
      expect(result[2]?.id).toBe('po-old');
    });

    it('should sort by date ascending when specified', () => {
      const result = sortPOsByDate(testPOs, 'asc');
      expect(result[0]?.id).toBe('po-old');
      expect(result[1]?.id).toBe('po-mid');
      expect(result[2]?.id).toBe('po-new');
    });

    it('should not mutate original array', () => {
      const original = [...testPOs];
      sortPOsByDate(testPOs);
      expect(testPOs).toEqual(original);
    });
  });

  describe('sortPOsByAmount', () => {
    const testPOs = [
      createMockPO({ id: 'po-small', grandTotal: 10000 }),
      createMockPO({ id: 'po-medium', grandTotal: 50000 }),
      createMockPO({ id: 'po-large', grandTotal: 100000 }),
    ];

    it('should sort by amount descending by default', () => {
      const result = sortPOsByAmount(testPOs);
      expect(result[0]?.id).toBe('po-large');
      expect(result[1]?.id).toBe('po-medium');
      expect(result[2]?.id).toBe('po-small');
    });

    it('should sort by amount ascending when specified', () => {
      const result = sortPOsByAmount(testPOs, 'asc');
      expect(result[0]?.id).toBe('po-small');
      expect(result[1]?.id).toBe('po-medium');
      expect(result[2]?.id).toBe('po-large');
    });

    it('should not mutate original array', () => {
      const original = [...testPOs];
      sortPOsByAmount(testPOs);
      expect(testPOs).toEqual(original);
    });
  });

  describe('calculatePOStats', () => {
    it('should handle empty array', () => {
      const stats = calculatePOStats([]);
      expect(stats.total).toBe(0);
      expect(stats.totalValue).toBe(0);
      expect(stats.avgValue).toBe(0);
    });

    it('should count POs by status', () => {
      const testPOs = [
        createMockPO({ status: 'DRAFT', grandTotal: 10000 }),
        createMockPO({ status: 'DRAFT', grandTotal: 20000 }),
        createMockPO({ status: 'PENDING_APPROVAL', grandTotal: 30000 }),
        createMockPO({ status: 'APPROVED', grandTotal: 40000 }),
        createMockPO({ status: 'ISSUED', grandTotal: 50000 }),
        createMockPO({ status: 'ACKNOWLEDGED', grandTotal: 60000 }),
        createMockPO({ status: 'IN_PROGRESS', grandTotal: 70000 }),
        createMockPO({ status: 'COMPLETED', grandTotal: 80000 }),
        createMockPO({ status: 'DELIVERED', grandTotal: 90000 }),
      ];

      const stats = calculatePOStats(testPOs);

      expect(stats.total).toBe(9);
      expect(stats.draft).toBe(2);
      expect(stats.pendingApproval).toBe(1);
      expect(stats.approved).toBe(1);
      expect(stats.issued).toBe(2); // ISSUED + ACKNOWLEDGED
      expect(stats.inProgress).toBe(1);
      expect(stats.completed).toBe(2); // COMPLETED + DELIVERED
    });

    it('should calculate total value', () => {
      const testPOs = [
        createMockPO({ grandTotal: 100000 }),
        createMockPO({ grandTotal: 200000 }),
        createMockPO({ grandTotal: 300000 }),
      ];

      const stats = calculatePOStats(testPOs);

      expect(stats.totalValue).toBe(600000);
    });

    it('should calculate average value', () => {
      const testPOs = [
        createMockPO({ grandTotal: 100000 }),
        createMockPO({ grandTotal: 200000 }),
        createMockPO({ grandTotal: 300000 }),
      ];

      const stats = calculatePOStats(testPOs);

      expect(stats.avgValue).toBe(200000);
    });

    it('should handle cancelled and amended status', () => {
      const testPOs = [
        createMockPO({ status: 'CANCELLED', grandTotal: 50000 }),
        createMockPO({ status: 'AMENDED', grandTotal: 75000 }),
        createMockPO({ status: 'REJECTED', grandTotal: 25000 }),
      ];

      const stats = calculatePOStats(testPOs);

      // These statuses are not specifically counted
      expect(stats.total).toBe(3);
      expect(stats.draft).toBe(0);
      expect(stats.totalValue).toBe(150000);
    });
  });

  describe('validatePOForSubmission', () => {
    it('should return empty array for valid PO', () => {
      const po = createMockPO({
        vendorId: 'vendor-1',
        vendorName: 'Test Vendor',
        deliveryAddress: '123 Street',
        paymentTerms: 'Net 30',
        deliveryTerms: 'FOB',
        grandTotal: 50000,
      });

      const errors = validatePOForSubmission(po);
      expect(errors).toHaveLength(0);
    });

    it('should return error for missing vendor ID', () => {
      const po = createMockPO({ vendorId: '' });
      const errors = validatePOForSubmission(po);
      expect(errors).toContain('Vendor information is missing');
    });

    it('should return error for missing vendor name', () => {
      const po = createMockPO({ vendorName: '' });
      const errors = validatePOForSubmission(po);
      expect(errors).toContain('Vendor information is missing');
    });

    it('should return error for missing delivery address', () => {
      const po = createMockPO({ deliveryAddress: '' });
      const errors = validatePOForSubmission(po);
      expect(errors).toContain('Delivery address is required');
    });

    it('should return error for missing payment terms', () => {
      const po = createMockPO({ paymentTerms: '' });
      const errors = validatePOForSubmission(po);
      expect(errors).toContain('Payment terms are required');
    });

    it('should return error for missing delivery terms', () => {
      const po = createMockPO({ deliveryTerms: '' });
      const errors = validatePOForSubmission(po);
      expect(errors).toContain('Delivery terms are required');
    });

    it('should return error for zero amount', () => {
      const po = createMockPO({ grandTotal: 0 });
      const errors = validatePOForSubmission(po);
      expect(errors).toContain('PO amount must be greater than zero');
    });

    it('should return error for negative amount', () => {
      const po = createMockPO({ grandTotal: -1000 });
      const errors = validatePOForSubmission(po);
      expect(errors).toContain('PO amount must be greater than zero');
    });

    it('should return multiple errors when multiple fields are invalid', () => {
      const po = createMockPO({
        vendorId: '',
        deliveryAddress: '',
        grandTotal: 0,
      });

      const errors = validatePOForSubmission(po);
      expect(errors.length).toBeGreaterThan(1);
      expect(errors).toContain('Vendor information is missing');
      expect(errors).toContain('Delivery address is required');
      expect(errors).toContain('PO amount must be greater than zero');
    });
  });

  describe('Real-world scenarios', () => {
    it('should correctly process PO lifecycle', () => {
      // Create a draft PO
      let po = createMockPO({ status: 'DRAFT' });

      expect(canEditPO(po)).toBe(true);
      expect(canSubmitForApproval(po)).toBe(true);
      expect(canApprovePO(po)).toBe(false);
      expect(canCancelPO(po)).toBe(true);

      // Submit for approval
      po = { ...po, status: 'PENDING_APPROVAL' };
      expect(canEditPO(po)).toBe(false);
      expect(canApprovePO(po)).toBe(true);
      expect(canRejectPO(po)).toBe(true);

      // Approve
      po = { ...po, status: 'APPROVED' };
      expect(canIssuePO(po)).toBe(true);
      expect(canCancelPO(po)).toBe(true);

      // Issue
      po = { ...po, status: 'ISSUED' };
      expect(canIssuePO(po)).toBe(false);
      expect(canCancelPO(po)).toBe(true);

      // Acknowledged
      po = { ...po, status: 'ACKNOWLEDGED' };
      expect(canCancelPO(po)).toBe(false); // Can't cancel after acknowledgment

      // Completed
      po = { ...po, status: 'COMPLETED' };
      expect(canEditPO(po)).toBe(false);
      expect(canCancelPO(po)).toBe(false);
    });

    it('should format currency correctly for Indian amounts', () => {
      // Common Indian business amounts
      expect(formatCurrency(100)).toBe('₹100.00');
      expect(formatCurrency(1000)).toBe('₹1,000.00');
      expect(formatCurrency(100000)).toBe('₹1,00,000.00'); // 1 Lakh
      expect(formatCurrency(1000000)).toBe('₹10,00,000.00'); // 10 Lakhs
      expect(formatCurrency(10000000)).toBe('₹1,00,00,000.00'); // 1 Crore
    });

    it('should handle complex statistics calculation', () => {
      const pos = [
        createMockPO({ status: 'DRAFT', grandTotal: 50000 }),
        createMockPO({ status: 'DRAFT', grandTotal: 75000 }),
        createMockPO({ status: 'PENDING_APPROVAL', grandTotal: 100000 }),
        createMockPO({ status: 'APPROVED', grandTotal: 200000 }),
        createMockPO({ status: 'ISSUED', grandTotal: 500000 }),
        createMockPO({ status: 'IN_PROGRESS', grandTotal: 750000 }),
        createMockPO({ status: 'COMPLETED', grandTotal: 1000000 }),
      ];

      const stats = calculatePOStats(pos);

      expect(stats.total).toBe(7);
      expect(stats.totalValue).toBe(2675000);
      expect(stats.avgValue).toBeCloseTo(382142.86, 0);
      expect(stats.draft).toBe(2);
      expect(stats.inProgress).toBe(1);
      expect(stats.completed).toBe(1);
    });
  });
});
