/**
 * Purchase Request Helper Functions Tests
 *
 * Tests for PR utility functions including:
 * - Status helpers
 * - Priority helpers
 * - Type/category helpers
 * - Calculation helpers
 * - Validation helpers
 * - Formatting helpers
 * - Filter and sort helpers
 * - Stats helpers
 */

import type { PurchaseRequest, PurchaseRequestItem, PurchaseRequestStatus } from '@vapour/types';
import {
  canEditPurchaseRequest,
  canSubmitPurchaseRequest,
  canReviewPurchaseRequest,
  canCreateRFQFromPR,
  getPRStatusColor,
  getPRStatusText,
  getPriorityColor,
  getPriorityText,
  getPRTypeText,
  getPRCategoryText,
  calculatePRTotalCost,
  calculateTotalQuantity,
  getUniqueEquipmentIds,
  groupItemsByEquipment,
  validatePRForSubmission,
  validatePRItem,
  formatCurrency,
  formatDate,
  formatDateTime,
  getRelativeTime,
  filterPRsBySearch,
  sortPRs,
  getPRStats,
} from './purchaseRequestHelpers';

// Mock Timestamp helper
const createMockTimestamp = (date: Date) => ({
  toDate: () => date,
  toMillis: () => date.getTime(),
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
});

// Helper to create mock PurchaseRequest
const createMockPR = (overrides: Partial<PurchaseRequest> = {}): PurchaseRequest =>
  ({
    id: 'pr-1',
    number: 'PR-2024-001',
    projectId: 'project-1',
    projectName: 'Test Project',
    title: 'Steel Materials Required',
    description: 'Procurement of steel plates for fabrication',
    status: 'DRAFT' as PurchaseRequestStatus,
    priority: 'MEDIUM' as const,
    type: 'PROJECT' as const,
    category: 'RAW_MATERIAL' as const,
    itemCount: 3,
    estimatedTotalCost: 100000,
    submittedBy: 'user-1',
    submittedByName: 'John Doe',
    createdAt: createMockTimestamp(new Date()),
    updatedAt: createMockTimestamp(new Date()),
    ...overrides,
  }) as PurchaseRequest;

// Helper to create mock PurchaseRequestItem
const createMockPRItem = (overrides: Partial<PurchaseRequestItem> = {}): PurchaseRequestItem =>
  ({
    id: 'item-1',
    description: 'SS 304 Plate 3mm',
    quantity: 10,
    unit: 'pcs',
    estimatedUnitCost: 5000,
    estimatedTotalCost: 50000,
    materialCode: 'PL-SS-304-3MM',
    ...overrides,
  }) as PurchaseRequestItem;

describe('Purchase Request Helpers', () => {
  describe('canEditPurchaseRequest', () => {
    it('should return true for DRAFT status', () => {
      const pr = createMockPR({ status: 'DRAFT' });
      expect(canEditPurchaseRequest(pr)).toBe(true);
    });

    it('should return true for REJECTED status', () => {
      const pr = createMockPR({ status: 'REJECTED' });
      expect(canEditPurchaseRequest(pr)).toBe(true);
    });

    it.each<PurchaseRequestStatus>(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CONVERTED_TO_RFQ'])(
      'should return false for %s status',
      (status) => {
        const pr = createMockPR({ status });
        expect(canEditPurchaseRequest(pr)).toBe(false);
      }
    );
  });

  describe('canSubmitPurchaseRequest', () => {
    it('should return true for DRAFT with items', () => {
      const pr = createMockPR({ status: 'DRAFT', itemCount: 3 });
      expect(canSubmitPurchaseRequest(pr)).toBe(true);
    });

    it('should return false for DRAFT without items', () => {
      const pr = createMockPR({ status: 'DRAFT', itemCount: 0 });
      expect(canSubmitPurchaseRequest(pr)).toBe(false);
    });

    it('should return false for non-DRAFT status', () => {
      const pr = createMockPR({ status: 'SUBMITTED', itemCount: 3 });
      expect(canSubmitPurchaseRequest(pr)).toBe(false);
    });
  });

  describe('canReviewPurchaseRequest', () => {
    it('should return true for SUBMITTED status', () => {
      const pr = createMockPR({ status: 'SUBMITTED' });
      expect(canReviewPurchaseRequest(pr)).toBe(true);
    });

    it('should return true for UNDER_REVIEW status', () => {
      const pr = createMockPR({ status: 'UNDER_REVIEW' });
      expect(canReviewPurchaseRequest(pr)).toBe(true);
    });

    it.each<PurchaseRequestStatus>(['DRAFT', 'APPROVED', 'REJECTED', 'CONVERTED_TO_RFQ'])(
      'should return false for %s status',
      (status) => {
        const pr = createMockPR({ status });
        expect(canReviewPurchaseRequest(pr)).toBe(false);
      }
    );
  });

  describe('canCreateRFQFromPR', () => {
    it('should return true for APPROVED status', () => {
      const pr = createMockPR({ status: 'APPROVED' });
      expect(canCreateRFQFromPR(pr)).toBe(true);
    });

    it.each<PurchaseRequestStatus>([
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'REJECTED',
      'CONVERTED_TO_RFQ',
    ])('should return false for %s status', (status) => {
      const pr = createMockPR({ status });
      expect(canCreateRFQFromPR(pr)).toBe(false);
    });
  });

  describe('getPRStatusColor', () => {
    it.each<[PurchaseRequestStatus, string]>([
      ['DRAFT', 'default'],
      ['SUBMITTED', 'info'],
      ['UNDER_REVIEW', 'warning'],
      ['APPROVED', 'success'],
      ['REJECTED', 'error'],
      ['CONVERTED_TO_RFQ', 'secondary'],
    ])('should return %s for status %s', (status, expected) => {
      expect(getPRStatusColor(status)).toBe(expected);
    });

    it('should return default for unknown status', () => {
      expect(getPRStatusColor('UNKNOWN' as PurchaseRequestStatus)).toBe('default');
    });
  });

  describe('getPRStatusText', () => {
    it.each<[PurchaseRequestStatus, string]>([
      ['DRAFT', 'Draft'],
      ['SUBMITTED', 'Pending Approval'],
      ['UNDER_REVIEW', 'Under Review'],
      ['APPROVED', 'Approved'],
      ['REJECTED', 'Rejected'],
      ['CONVERTED_TO_RFQ', 'Converted to RFQ'],
    ])('should return "%s" for status %s', (status, expected) => {
      expect(getPRStatusText(status)).toBe(expected);
    });

    it('should return status itself for unknown status', () => {
      expect(getPRStatusText('UNKNOWN' as PurchaseRequestStatus)).toBe('UNKNOWN');
    });
  });

  describe('getPriorityColor', () => {
    it.each<['LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', string]>([
      ['LOW', 'default'],
      ['MEDIUM', 'info'],
      ['HIGH', 'warning'],
      ['URGENT', 'error'],
    ])('should return %s for priority %s', (priority, expected) => {
      expect(getPriorityColor(priority)).toBe(expected);
    });
  });

  describe('getPriorityText', () => {
    it.each<['LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', string]>([
      ['LOW', 'Low'],
      ['MEDIUM', 'Medium'],
      ['HIGH', 'High'],
      ['URGENT', 'Urgent'],
    ])('should return "%s" for priority %s', (priority, expected) => {
      expect(getPriorityText(priority)).toBe(expected);
    });
  });

  describe('getPRTypeText', () => {
    it.each<['PROJECT' | 'BUDGETARY' | 'INTERNAL', string]>([
      ['PROJECT', 'Project'],
      ['BUDGETARY', 'Budgetary'],
      ['INTERNAL', 'Internal Requirement'],
    ])('should return "%s" for type %s', (type, expected) => {
      expect(getPRTypeText(type)).toBe(expected);
    });

    it('should return type itself for unknown type', () => {
      expect(getPRTypeText('UNKNOWN' as 'PROJECT')).toBe('UNKNOWN');
    });
  });

  describe('getPRCategoryText', () => {
    it.each<['SERVICE' | 'RAW_MATERIAL' | 'BOUGHT_OUT', string]>([
      ['SERVICE', 'Service'],
      ['RAW_MATERIAL', 'Raw Material'],
      ['BOUGHT_OUT', 'Bought Out Item'],
    ])('should return "%s" for category %s', (category, expected) => {
      expect(getPRCategoryText(category)).toBe(expected);
    });

    it('should return category itself for unknown category', () => {
      expect(getPRCategoryText('UNKNOWN' as 'SERVICE')).toBe('UNKNOWN');
    });
  });

  describe('calculatePRTotalCost', () => {
    it('should calculate total cost from items', () => {
      const items = [
        createMockPRItem({ estimatedTotalCost: 50000 }),
        createMockPRItem({ estimatedTotalCost: 30000 }),
        createMockPRItem({ estimatedTotalCost: 20000 }),
      ];

      expect(calculatePRTotalCost(items)).toBe(100000);
    });

    it('should handle empty array', () => {
      expect(calculatePRTotalCost([])).toBe(0);
    });

    it('should handle undefined costs', () => {
      const items = [
        createMockPRItem({ estimatedTotalCost: 50000 }),
        createMockPRItem({ estimatedTotalCost: undefined }),
        createMockPRItem({ estimatedTotalCost: 30000 }),
      ];

      expect(calculatePRTotalCost(items)).toBe(80000);
    });
  });

  describe('calculateTotalQuantity', () => {
    it('should calculate total quantity from items', () => {
      const items = [
        createMockPRItem({ quantity: 10 }),
        createMockPRItem({ quantity: 20 }),
        createMockPRItem({ quantity: 30 }),
      ];

      expect(calculateTotalQuantity(items)).toBe(60);
    });

    it('should handle empty array', () => {
      expect(calculateTotalQuantity([])).toBe(0);
    });
  });

  describe('getUniqueEquipmentIds', () => {
    it('should return unique equipment IDs', () => {
      const items = [
        createMockPRItem({ equipmentId: 'eq-1' }),
        createMockPRItem({ equipmentId: 'eq-2' }),
        createMockPRItem({ equipmentId: 'eq-1' }), // Duplicate
        createMockPRItem({ equipmentId: 'eq-3' }),
      ];

      const result = getUniqueEquipmentIds(items);
      expect(result).toHaveLength(3);
      expect(result).toContain('eq-1');
      expect(result).toContain('eq-2');
      expect(result).toContain('eq-3');
    });

    it('should filter out items without equipment ID', () => {
      const items = [
        createMockPRItem({ equipmentId: 'eq-1' }),
        createMockPRItem({ equipmentId: undefined }),
        createMockPRItem({ equipmentId: 'eq-2' }),
      ];

      const result = getUniqueEquipmentIds(items);
      expect(result).toHaveLength(2);
    });

    it('should handle empty array', () => {
      expect(getUniqueEquipmentIds([])).toHaveLength(0);
    });
  });

  describe('groupItemsByEquipment', () => {
    it('should group items by equipment ID', () => {
      const items = [
        createMockPRItem({ id: 'item-1', equipmentId: 'eq-1' }),
        createMockPRItem({ id: 'item-2', equipmentId: 'eq-2' }),
        createMockPRItem({ id: 'item-3', equipmentId: 'eq-1' }),
      ];

      const result = groupItemsByEquipment(items);

      expect(result['eq-1']).toHaveLength(2);
      expect(result['eq-2']).toHaveLength(1);
    });

    it('should put items without equipment in no-equipment group', () => {
      const items = [
        createMockPRItem({ id: 'item-1', equipmentId: 'eq-1' }),
        createMockPRItem({ id: 'item-2', equipmentId: undefined }),
        createMockPRItem({ id: 'item-3', equipmentId: undefined }),
      ];

      const result = groupItemsByEquipment(items);

      expect(result['eq-1']).toHaveLength(1);
      expect(result['no-equipment']).toHaveLength(2);
    });

    it('should always have no-equipment key', () => {
      const items = [createMockPRItem({ equipmentId: 'eq-1' })];

      const result = groupItemsByEquipment(items);

      expect(result['no-equipment']).toBeDefined();
      expect(result['no-equipment']).toHaveLength(0);
    });
  });

  describe('validatePRForSubmission', () => {
    it('should return valid for correct PR and items', () => {
      const pr = createMockPR({ status: 'DRAFT' });
      const items = [
        createMockPRItem({ description: 'Item 1', quantity: 10, unit: 'pcs' }),
        createMockPRItem({ description: 'Item 2', quantity: 5, unit: 'kg' }),
      ];

      const result = validatePRForSubmission(pr, items);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for non-DRAFT status', () => {
      const pr = createMockPR({ status: 'SUBMITTED' });
      const items = [createMockPRItem()];

      const result = validatePRForSubmission(pr, items);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Only draft purchase requests can be submitted');
    });

    it('should fail for empty items', () => {
      const pr = createMockPR({ status: 'DRAFT' });

      const result = validatePRForSubmission(pr, []);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Purchase request must have at least one item');
    });

    it('should fail for item without description', () => {
      const pr = createMockPR({ status: 'DRAFT' });
      const items = [createMockPRItem({ description: '' })];

      const result = validatePRForSubmission(pr, items);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item 1: Description is required');
    });

    it('should fail for item with zero quantity', () => {
      const pr = createMockPR({ status: 'DRAFT' });
      const items = [createMockPRItem({ quantity: 0 })];

      const result = validatePRForSubmission(pr, items);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item 1: Quantity must be greater than 0');
    });

    it('should fail for item without unit', () => {
      const pr = createMockPR({ status: 'DRAFT' });
      const items = [createMockPRItem({ unit: '' })];

      const result = validatePRForSubmission(pr, items);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item 1: Unit is required');
    });

    it('should report multiple item errors', () => {
      const pr = createMockPR({ status: 'DRAFT' });
      const items = [createMockPRItem({ description: '' }), createMockPRItem({ quantity: -1 })];

      const result = validatePRForSubmission(pr, items);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validatePRItem', () => {
    it('should return valid for correct item', () => {
      const item = { description: 'Test item', quantity: 10, unit: 'pcs' };

      const result = validatePRItem(item);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for empty description', () => {
      const item = { description: '', quantity: 10, unit: 'pcs' };

      const result = validatePRItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Description is required');
    });

    it('should fail for whitespace-only description', () => {
      const item = { description: '   ', quantity: 10, unit: 'pcs' };

      const result = validatePRItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Description is required');
    });

    it('should fail for zero quantity', () => {
      const item = { description: 'Test', quantity: 0, unit: 'pcs' };

      const result = validatePRItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Quantity must be greater than 0');
    });

    it('should fail for negative quantity', () => {
      const item = { description: 'Test', quantity: -5, unit: 'pcs' };

      const result = validatePRItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Quantity must be greater than 0');
    });

    it('should fail for missing unit', () => {
      const item = { description: 'Test', quantity: 10, unit: '' };

      const result = validatePRItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unit is required');
    });

    it('should return multiple errors', () => {
      const item = { description: '', quantity: 0, unit: '' };

      const result = validatePRItem(item);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('formatCurrency', () => {
    it('should format INR amounts correctly', () => {
      expect(formatCurrency(100000)).toBe('₹1,00,000.00');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('₹0.00');
    });

    it('should handle decimals', () => {
      expect(formatCurrency(1234.56)).toBe('₹1,234.56');
    });

    it('should round to 2 decimal places', () => {
      expect(formatCurrency(1234.567)).toBe('₹1,234.57');
    });

    it('should handle large amounts', () => {
      expect(formatCurrency(10000000)).toBe('₹1,00,00,000.00'); // 1 Crore
    });
  });

  describe('formatDate', () => {
    it('should format Date object', () => {
      const date = new Date('2024-06-15');
      const result = formatDate(date);
      expect(result).toContain('15');
      expect(result).toContain('Jun');
      expect(result).toContain('2024');
    });

    it('should format Timestamp-like object', () => {
      const timestamp = createMockTimestamp(new Date('2024-12-25'));
      const result = formatDate(timestamp);
      expect(result).toContain('25');
      expect(result).toContain('Dec');
      expect(result).toContain('2024');
    });
  });

  describe('formatDateTime', () => {
    it('should format Date with time', () => {
      const date = new Date('2024-06-15T14:30:00');
      const result = formatDateTime(date);
      expect(result).toContain('15');
      expect(result).toContain('Jun');
      expect(result).toContain('2024');
      // Time format may vary by locale
    });

    it('should format Timestamp-like object with time', () => {
      const timestamp = createMockTimestamp(new Date('2024-12-25T09:45:00'));
      const result = formatDateTime(timestamp);
      expect(result).toContain('25');
      expect(result).toContain('Dec');
      expect(result).toContain('2024');
    });
  });

  describe('getRelativeTime', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return "Just now" for recent times', () => {
      const date = new Date('2024-06-15T11:59:30');
      expect(getRelativeTime(date)).toBe('Just now');
    });

    it('should return minutes ago', () => {
      const date = new Date('2024-06-15T11:45:00');
      expect(getRelativeTime(date)).toBe('15 minutes ago');
    });

    it('should return "1 minute ago" for singular', () => {
      const date = new Date('2024-06-15T11:59:00');
      expect(getRelativeTime(date)).toBe('1 minute ago');
    });

    it('should return hours ago', () => {
      const date = new Date('2024-06-15T09:00:00');
      expect(getRelativeTime(date)).toBe('3 hours ago');
    });

    it('should return "1 hour ago" for singular', () => {
      const date = new Date('2024-06-15T11:00:00');
      expect(getRelativeTime(date)).toBe('1 hour ago');
    });

    it('should return "Yesterday"', () => {
      const date = new Date('2024-06-14T12:00:00');
      expect(getRelativeTime(date)).toBe('Yesterday');
    });

    it('should return days ago', () => {
      const date = new Date('2024-06-12T12:00:00');
      expect(getRelativeTime(date)).toBe('3 days ago');
    });

    it('should return weeks ago', () => {
      const date = new Date('2024-06-01T12:00:00');
      expect(getRelativeTime(date)).toBe('2 weeks ago');
    });

    it('should return "1 week ago" for singular', () => {
      const date = new Date('2024-06-08T12:00:00');
      expect(getRelativeTime(date)).toBe('1 week ago');
    });

    it('should return months ago', () => {
      const date = new Date('2024-03-15T12:00:00');
      expect(getRelativeTime(date)).toBe('3 months ago');
    });

    it('should return years ago', () => {
      const date = new Date('2022-06-15T12:00:00');
      expect(getRelativeTime(date)).toBe('2 years ago');
    });

    it('should handle Timestamp-like objects', () => {
      const timestamp = createMockTimestamp(new Date('2024-06-14T12:00:00'));
      expect(getRelativeTime(timestamp)).toBe('Yesterday');
    });
  });

  describe('filterPRsBySearch', () => {
    const testPRs = [
      createMockPR({
        id: 'pr-1',
        number: 'PR-2024-001',
        title: 'Steel Plates',
        description: 'For fabrication work',
        projectName: 'Project Alpha',
        submittedByName: 'John Doe',
      }),
      createMockPR({
        id: 'pr-2',
        number: 'PR-2024-002',
        title: 'Pipe Fittings',
        description: 'Plumbing materials',
        projectName: 'Project Beta',
        submittedByName: 'Jane Smith',
      }),
      createMockPR({
        id: 'pr-3',
        number: 'PR-2024-003',
        title: 'Electrical Components',
        description: 'Motor starters',
        projectName: 'Project Alpha',
        submittedByName: 'John Doe',
      }),
    ];

    it('should return all for empty search', () => {
      expect(filterPRsBySearch(testPRs, '')).toHaveLength(3);
      expect(filterPRsBySearch(testPRs, '   ')).toHaveLength(3);
    });

    it('should filter by number', () => {
      const result = filterPRsBySearch(testPRs, 'PR-2024-001');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('pr-1');
    });

    it('should filter by title', () => {
      const result = filterPRsBySearch(testPRs, 'Steel');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('pr-1');
    });

    it('should filter by description', () => {
      const result = filterPRsBySearch(testPRs, 'Motor');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('pr-3');
    });

    it('should filter by project name', () => {
      const result = filterPRsBySearch(testPRs, 'Alpha');
      expect(result).toHaveLength(2);
    });

    it('should filter by submitter name', () => {
      const result = filterPRsBySearch(testPRs, 'John');
      expect(result).toHaveLength(2);
    });

    it('should be case insensitive', () => {
      expect(filterPRsBySearch(testPRs, 'steel')).toHaveLength(1);
      expect(filterPRsBySearch(testPRs, 'STEEL')).toHaveLength(1);
    });
  });

  describe('sortPRs', () => {
    const testPRs = [
      createMockPR({
        id: 'pr-1',
        number: 'PR-2024-001',
        priority: 'LOW',
        status: 'DRAFT',
        createdAt: createMockTimestamp(new Date('2024-01-15')) as never,
      }),
      createMockPR({
        id: 'pr-2',
        number: 'PR-2024-003',
        priority: 'URGENT',
        status: 'APPROVED',
        createdAt: createMockTimestamp(new Date('2024-06-01')) as never,
      }),
      createMockPR({
        id: 'pr-3',
        number: 'PR-2024-002',
        priority: 'MEDIUM',
        status: 'SUBMITTED',
        createdAt: createMockTimestamp(new Date('2024-03-20')) as never,
      }),
    ];

    it('should sort by date descending by default', () => {
      const result = sortPRs(testPRs, 'date');
      expect(result[0]?.id).toBe('pr-2');
      expect(result[1]?.id).toBe('pr-3');
      expect(result[2]?.id).toBe('pr-1');
    });

    it('should sort by date ascending', () => {
      const result = sortPRs(testPRs, 'date', 'asc');
      expect(result[0]?.id).toBe('pr-1');
      expect(result[2]?.id).toBe('pr-2');
    });

    it('should sort by number', () => {
      const result = sortPRs(testPRs, 'number', 'asc');
      expect(result[0]?.number).toBe('PR-2024-001');
      expect(result[1]?.number).toBe('PR-2024-002');
      expect(result[2]?.number).toBe('PR-2024-003');
    });

    it('should sort by priority', () => {
      const result = sortPRs(testPRs, 'priority');
      expect(result[0]?.priority).toBe('URGENT');
      expect(result[2]?.priority).toBe('LOW');
    });

    it('should sort by priority ascending', () => {
      const result = sortPRs(testPRs, 'priority', 'asc');
      expect(result[0]?.priority).toBe('LOW');
      expect(result[2]?.priority).toBe('URGENT');
    });

    it('should sort by status', () => {
      const result = sortPRs(testPRs, 'status', 'asc');
      expect(result[0]?.status).toBe('APPROVED');
    });

    it('should not mutate original array', () => {
      const original = [...testPRs];
      sortPRs(testPRs, 'date');
      expect(testPRs).toEqual(original);
    });
  });

  describe('getPRStats', () => {
    it('should handle empty array', () => {
      const stats = getPRStats([]);

      expect(stats.total).toBe(0);
      expect(stats.totalEstimatedCost).toBe(0);
    });

    it('should count by status', () => {
      const prs = [
        createMockPR({ status: 'DRAFT' }),
        createMockPR({ status: 'DRAFT' }),
        createMockPR({ status: 'SUBMITTED' }),
        createMockPR({ status: 'APPROVED' }),
      ];

      const stats = getPRStats(prs);

      expect(stats.total).toBe(4);
      expect(stats.byStatus['DRAFT']).toBe(2);
      expect(stats.byStatus['SUBMITTED']).toBe(1);
      expect(stats.byStatus['APPROVED']).toBe(1);
    });

    it('should count by priority', () => {
      const prs = [
        createMockPR({ priority: 'LOW' }),
        createMockPR({ priority: 'MEDIUM' }),
        createMockPR({ priority: 'MEDIUM' }),
        createMockPR({ priority: 'HIGH' }),
        createMockPR({ priority: 'URGENT' }),
      ];

      const stats = getPRStats(prs);

      expect(stats.byPriority.LOW).toBe(1);
      expect(stats.byPriority.MEDIUM).toBe(2);
      expect(stats.byPriority.HIGH).toBe(1);
      expect(stats.byPriority.URGENT).toBe(1);
    });

    it('should count by type', () => {
      const prs = [
        createMockPR({ type: 'PROJECT' }),
        createMockPR({ type: 'PROJECT' }),
        createMockPR({ type: 'BUDGETARY' }),
        createMockPR({ type: 'INTERNAL' }),
      ];

      const stats = getPRStats(prs);

      expect(stats.byType.PROJECT).toBe(2);
      expect(stats.byType.BUDGETARY).toBe(1);
      expect(stats.byType.INTERNAL).toBe(1);
    });
  });

  describe('Real-world scenarios', () => {
    it('should validate PR lifecycle', () => {
      // Create a draft PR
      let pr = createMockPR({ status: 'DRAFT', itemCount: 3 });

      expect(canEditPurchaseRequest(pr)).toBe(true);
      expect(canSubmitPurchaseRequest(pr)).toBe(true);
      expect(canReviewPurchaseRequest(pr)).toBe(false);

      // Submit for approval
      pr = { ...pr, status: 'SUBMITTED' };
      expect(canEditPurchaseRequest(pr)).toBe(false);
      expect(canReviewPurchaseRequest(pr)).toBe(true);

      // Under review
      pr = { ...pr, status: 'UNDER_REVIEW' };
      expect(canReviewPurchaseRequest(pr)).toBe(true);

      // Approved
      pr = { ...pr, status: 'APPROVED' };
      expect(canCreateRFQFromPR(pr)).toBe(true);
      expect(canReviewPurchaseRequest(pr)).toBe(false);

      // Converted to RFQ
      pr = { ...pr, status: 'CONVERTED_TO_RFQ' };
      expect(canCreateRFQFromPR(pr)).toBe(false);
    });

    it('should handle rejected PR resubmission', () => {
      let pr = createMockPR({ status: 'REJECTED', itemCount: 3 });

      // Can edit rejected PR
      expect(canEditPurchaseRequest(pr)).toBe(true);

      // Fix issues and resubmit
      pr = { ...pr, status: 'DRAFT' };
      expect(canSubmitPurchaseRequest(pr)).toBe(true);
    });

    it('should calculate comprehensive stats', () => {
      const prs = [
        createMockPR({ status: 'DRAFT', priority: 'LOW', type: 'PROJECT' }),
        createMockPR({ status: 'DRAFT', priority: 'MEDIUM', type: 'PROJECT' }),
        createMockPR({ status: 'SUBMITTED', priority: 'HIGH', type: 'BUDGETARY' }),
        createMockPR({ status: 'APPROVED', priority: 'URGENT', type: 'INTERNAL' }),
        createMockPR({ status: 'CONVERTED_TO_RFQ', priority: 'MEDIUM', type: 'PROJECT' }),
      ];

      const stats = getPRStats(prs);

      expect(stats.total).toBe(5);
      expect(stats.byStatus['DRAFT']).toBe(2);
      expect(stats.byPriority.URGENT).toBe(1);
      expect(stats.byType.PROJECT).toBe(3);
    });
  });
});
