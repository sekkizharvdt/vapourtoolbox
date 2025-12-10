/**
 * RFQ Helper Functions Tests
 *
 * Tests for RFQ utility functions including:
 * - Status helpers
 * - Display helpers
 * - Validation helpers
 * - Calculation helpers
 * - Formatting helpers
 * - Search and filter helpers
 * - Statistics helpers
 * - Item helpers
 */

import type { RFQ, RFQStatus, RFQItem } from '@vapour/types';
import {
  canEditRFQ,
  canIssueRFQ,
  canCancelRFQ,
  canAcceptOffers,
  canCompleteRFQ,
  getRFQStatusText,
  getRFQStatusColor,
  validateRFQForIssuance,
  isRFQOverdue,
  getOfferCompletionPercentage,
  getEvaluationCompletionPercentage,
  getDaysUntilDue,
  getRFQUrgency,
  formatRFQDate,
  formatDueDate,
  filterRFQsBySearch,
  sortRFQs,
  calculateRFQStats,
  groupRFQItemsByProject,
  groupRFQItemsByEquipment,
  calculateTotalQuantity,
} from './rfqHelpers';

// Mock Timestamp helper
const createMockTimestamp = (date: Date) => ({
  toDate: () => date,
  toMillis: () => date.getTime(),
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
});

// Helper to create mock RFQ
const createMockRFQ = (overrides: Partial<RFQ> = {}): RFQ =>
  ({
    id: 'rfq-1',
    number: 'RFQ-2024-001',
    title: 'Steel Plates Requirement',
    description: 'Procurement of SS 304 plates for fabrication',
    status: 'DRAFT' as RFQStatus,
    vendorIds: ['vendor-1', 'vendor-2'],
    vendorNames: ['ABC Steels', 'XYZ Industries'],
    projectIds: ['project-1'],
    projectNames: ['Test Project'],
    offersReceived: 0,
    offersEvaluated: 0,
    createdAt: createMockTimestamp(new Date()),
    updatedAt: createMockTimestamp(new Date()),
    ...overrides,
  }) as RFQ;

// Helper to create mock RFQItem
const createMockRFQItem = (overrides: Partial<RFQItem> = {}): RFQItem =>
  ({
    id: 'item-1',
    description: 'SS 304 Plate 3mm',
    quantity: 100,
    unit: 'kg',
    projectId: 'project-1',
    equipmentId: 'eq-1',
    ...overrides,
  }) as RFQItem;

describe('RFQ Helpers', () => {
  describe('canEditRFQ', () => {
    it('should return true for DRAFT status', () => {
      const rfq = createMockRFQ({ status: 'DRAFT' });
      expect(canEditRFQ(rfq)).toBe(true);
    });

    it.each<RFQStatus>(['ISSUED', 'OFFERS_RECEIVED', 'UNDER_EVALUATION', 'COMPLETED', 'CANCELLED'])(
      'should return false for %s status',
      (status) => {
        const rfq = createMockRFQ({ status });
        expect(canEditRFQ(rfq)).toBe(false);
      }
    );
  });

  describe('canIssueRFQ', () => {
    it('should return true for DRAFT with vendors', () => {
      const rfq = createMockRFQ({
        status: 'DRAFT',
        vendorIds: ['vendor-1', 'vendor-2'],
      });
      expect(canIssueRFQ(rfq)).toBe(true);
    });

    it('should return false for DRAFT without vendors', () => {
      const rfq = createMockRFQ({
        status: 'DRAFT',
        vendorIds: [],
      });
      expect(canIssueRFQ(rfq)).toBe(false);
    });

    it('should return false for non-DRAFT status', () => {
      const rfq = createMockRFQ({
        status: 'ISSUED',
        vendorIds: ['vendor-1'],
      });
      expect(canIssueRFQ(rfq)).toBe(false);
    });
  });

  describe('canCancelRFQ', () => {
    it.each<RFQStatus>(['DRAFT', 'ISSUED', 'OFFERS_RECEIVED', 'UNDER_EVALUATION'])(
      'should return true for %s status',
      (status) => {
        const rfq = createMockRFQ({ status });
        expect(canCancelRFQ(rfq)).toBe(true);
      }
    );

    it.each<RFQStatus>(['COMPLETED', 'CANCELLED'])(
      'should return false for %s status',
      (status) => {
        const rfq = createMockRFQ({ status });
        expect(canCancelRFQ(rfq)).toBe(false);
      }
    );
  });

  describe('canAcceptOffers', () => {
    it.each<RFQStatus>(['ISSUED', 'OFFERS_RECEIVED'])(
      'should return true for %s status',
      (status) => {
        const rfq = createMockRFQ({ status });
        expect(canAcceptOffers(rfq)).toBe(true);
      }
    );

    it.each<RFQStatus>(['DRAFT', 'UNDER_EVALUATION', 'COMPLETED', 'CANCELLED'])(
      'should return false for %s status',
      (status) => {
        const rfq = createMockRFQ({ status });
        expect(canAcceptOffers(rfq)).toBe(false);
      }
    );
  });

  describe('canCompleteRFQ', () => {
    it('should return true for OFFERS_RECEIVED with offers', () => {
      const rfq = createMockRFQ({
        status: 'OFFERS_RECEIVED',
        offersReceived: 3,
      });
      expect(canCompleteRFQ(rfq)).toBe(true);
    });

    it('should return true for UNDER_EVALUATION with offers', () => {
      const rfq = createMockRFQ({
        status: 'UNDER_EVALUATION',
        offersReceived: 2,
      });
      expect(canCompleteRFQ(rfq)).toBe(true);
    });

    it('should return false without offers', () => {
      const rfq = createMockRFQ({
        status: 'OFFERS_RECEIVED',
        offersReceived: 0,
      });
      expect(canCompleteRFQ(rfq)).toBe(false);
    });

    it.each<RFQStatus>(['DRAFT', 'ISSUED', 'COMPLETED', 'CANCELLED'])(
      'should return false for %s status',
      (status) => {
        const rfq = createMockRFQ({ status, offersReceived: 2 });
        expect(canCompleteRFQ(rfq)).toBe(false);
      }
    );
  });

  describe('getRFQStatusText', () => {
    it.each<[RFQStatus, string]>([
      ['DRAFT', 'Draft'],
      ['ISSUED', 'Issued'],
      ['OFFERS_RECEIVED', 'Offers Received'],
      ['UNDER_EVALUATION', 'Under Evaluation'],
      ['COMPLETED', 'Completed'],
      ['CANCELLED', 'Cancelled'],
    ])('should return "%s" for status %s', (status, expected) => {
      expect(getRFQStatusText(status)).toBe(expected);
    });
  });

  describe('getRFQStatusColor', () => {
    it.each<[RFQStatus, string]>([
      ['DRAFT', 'default'],
      ['ISSUED', 'info'],
      ['OFFERS_RECEIVED', 'primary'],
      ['UNDER_EVALUATION', 'warning'],
      ['COMPLETED', 'success'],
      ['CANCELLED', 'error'],
    ])('should return "%s" color for status %s', (status, expected) => {
      expect(getRFQStatusColor(status)).toBe(expected);
    });
  });

  describe('validateRFQForIssuance', () => {
    it('should return valid for complete RFQ', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const rfq = createMockRFQ({
        title: 'Test RFQ',
        description: 'Test description',
        vendorIds: ['vendor-1'],
        dueDate: createMockTimestamp(futureDate) as never,
      });

      const result = validateRFQForIssuance(rfq);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing title', () => {
      const rfq = createMockRFQ({ title: '' });
      const result = validateRFQForIssuance(rfq);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });

    it('should fail for whitespace-only title', () => {
      const rfq = createMockRFQ({ title: '   ' });
      const result = validateRFQForIssuance(rfq);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });

    it('should fail for missing description', () => {
      const rfq = createMockRFQ({ description: '' });
      const result = validateRFQForIssuance(rfq);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Description is required');
    });

    it('should fail for no vendors', () => {
      const rfq = createMockRFQ({ vendorIds: [] });
      const result = validateRFQForIssuance(rfq);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one vendor must be selected');
    });

    it('should fail for missing due date', () => {
      const rfq = createMockRFQ({ dueDate: undefined });
      const result = validateRFQForIssuance(rfq);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Due date is required');
    });

    it('should fail for past due date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const rfq = createMockRFQ({
        title: 'Test',
        description: 'Test',
        vendorIds: ['vendor-1'],
        dueDate: createMockTimestamp(pastDate) as never,
      });

      const result = validateRFQForIssuance(rfq);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Due date must be in the future');
    });

    it('should return multiple errors', () => {
      const rfq = createMockRFQ({
        title: '',
        description: '',
        vendorIds: [],
        dueDate: undefined,
      });

      const result = validateRFQForIssuance(rfq);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('isRFQOverdue', () => {
    it('should return true for past due date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const rfq = createMockRFQ({
        status: 'ISSUED',
        dueDate: createMockTimestamp(pastDate) as never,
      });

      expect(isRFQOverdue(rfq)).toBe(true);
    });

    it('should return false for future due date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const rfq = createMockRFQ({
        status: 'ISSUED',
        dueDate: createMockTimestamp(futureDate) as never,
      });

      expect(isRFQOverdue(rfq)).toBe(false);
    });

    it('should return false for COMPLETED status', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const rfq = createMockRFQ({
        status: 'COMPLETED',
        dueDate: createMockTimestamp(pastDate) as never,
      });

      expect(isRFQOverdue(rfq)).toBe(false);
    });

    it('should return false for CANCELLED status', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const rfq = createMockRFQ({
        status: 'CANCELLED',
        dueDate: createMockTimestamp(pastDate) as never,
      });

      expect(isRFQOverdue(rfq)).toBe(false);
    });

    it('should return false for missing due date', () => {
      const rfq = createMockRFQ({ dueDate: undefined });
      expect(isRFQOverdue(rfq)).toBe(false);
    });
  });

  describe('getOfferCompletionPercentage', () => {
    it('should calculate correct percentage', () => {
      const rfq = createMockRFQ({
        vendorIds: ['v1', 'v2', 'v3', 'v4'],
        offersReceived: 2,
      });

      expect(getOfferCompletionPercentage(rfq)).toBe(50);
    });

    it('should return 0 for no vendors', () => {
      const rfq = createMockRFQ({ vendorIds: [], offersReceived: 0 });
      expect(getOfferCompletionPercentage(rfq)).toBe(0);
    });

    it('should return 100 for all offers received', () => {
      const rfq = createMockRFQ({
        vendorIds: ['v1', 'v2'],
        offersReceived: 2,
      });

      expect(getOfferCompletionPercentage(rfq)).toBe(100);
    });

    it('should round to integer', () => {
      const rfq = createMockRFQ({
        vendorIds: ['v1', 'v2', 'v3'],
        offersReceived: 1,
      });

      expect(getOfferCompletionPercentage(rfq)).toBe(33);
    });
  });

  describe('getEvaluationCompletionPercentage', () => {
    it('should calculate correct percentage', () => {
      const rfq = createMockRFQ({
        offersReceived: 4,
        offersEvaluated: 2,
      });

      expect(getEvaluationCompletionPercentage(rfq)).toBe(50);
    });

    it('should return 0 for no offers', () => {
      const rfq = createMockRFQ({ offersReceived: 0, offersEvaluated: 0 });
      expect(getEvaluationCompletionPercentage(rfq)).toBe(0);
    });

    it('should return 100 for all evaluated', () => {
      const rfq = createMockRFQ({
        offersReceived: 3,
        offersEvaluated: 3,
      });

      expect(getEvaluationCompletionPercentage(rfq)).toBe(100);
    });
  });

  describe('getDaysUntilDue', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return positive days for future date', () => {
      const rfq = createMockRFQ({
        dueDate: createMockTimestamp(new Date('2024-06-22T12:00:00')) as never,
      });

      expect(getDaysUntilDue(rfq)).toBe(7);
    });

    it('should return negative days for past date', () => {
      const rfq = createMockRFQ({
        dueDate: createMockTimestamp(new Date('2024-06-10T12:00:00')) as never,
      });

      expect(getDaysUntilDue(rfq)).toBe(-5);
    });

    it('should return 0 for missing due date', () => {
      const rfq = createMockRFQ({ dueDate: undefined });
      expect(getDaysUntilDue(rfq)).toBe(0);
    });

    it('should return 1 for tomorrow', () => {
      const rfq = createMockRFQ({
        dueDate: createMockTimestamp(new Date('2024-06-16T12:00:00')) as never,
      });

      expect(getDaysUntilDue(rfq)).toBe(1);
    });
  });

  describe('getRFQUrgency', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return high for overdue', () => {
      const rfq = createMockRFQ({
        dueDate: createMockTimestamp(new Date('2024-06-10')) as never,
      });
      expect(getRFQUrgency(rfq)).toBe('high');
    });

    it('should return high for due within 3 days', () => {
      const rfq = createMockRFQ({
        dueDate: createMockTimestamp(new Date('2024-06-17')) as never,
      });
      expect(getRFQUrgency(rfq)).toBe('high');
    });

    it('should return medium for due within 7 days', () => {
      const rfq = createMockRFQ({
        dueDate: createMockTimestamp(new Date('2024-06-20')) as never,
      });
      expect(getRFQUrgency(rfq)).toBe('medium');
    });

    it('should return low for due beyond 7 days', () => {
      const rfq = createMockRFQ({
        dueDate: createMockTimestamp(new Date('2024-06-30')) as never,
      });
      expect(getRFQUrgency(rfq)).toBe('low');
    });
  });

  describe('formatRFQDate', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return "N/A" for undefined', () => {
      expect(formatRFQDate(undefined)).toBe('N/A');
    });

    it('should return "Today" for today', () => {
      const timestamp = createMockTimestamp(new Date('2024-06-15T10:00:00'));
      expect(formatRFQDate(timestamp as never)).toBe('Today');
    });

    it('should return "Yesterday" for yesterday', () => {
      const timestamp = createMockTimestamp(new Date('2024-06-14T12:00:00'));
      expect(formatRFQDate(timestamp as never)).toBe('Yesterday');
    });

    it('should return days ago for recent dates', () => {
      const timestamp = createMockTimestamp(new Date('2024-06-12T12:00:00'));
      expect(formatRFQDate(timestamp as never)).toBe('3 days ago');
    });

    it('should return formatted date for older dates', () => {
      const timestamp = createMockTimestamp(new Date('2024-05-01T12:00:00'));
      const result = formatRFQDate(timestamp as never);
      expect(result).toContain('May');
      expect(result).toContain('2024');
    });
  });

  describe('formatDueDate', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return no due date message', () => {
      const rfq = createMockRFQ({ dueDate: undefined });
      const result = formatDueDate(rfq);
      expect(result.text).toBe('No due date');
      expect(result.isOverdue).toBe(false);
    });

    it('should return overdue message', () => {
      const rfq = createMockRFQ({
        dueDate: createMockTimestamp(new Date('2024-06-10')) as never,
      });
      const result = formatDueDate(rfq);
      expect(result.text).toMatch(/Overdue by \d+ days?/);
      expect(result.isOverdue).toBe(true);
      expect(result.color).toBe('error.main');
    });

    it('should return overdue by 1 day singular', () => {
      const rfq = createMockRFQ({
        dueDate: createMockTimestamp(new Date('2024-06-14')) as never,
      });
      const result = formatDueDate(rfq);
      expect(result.text).toBe('Overdue by 1 day');
    });

    it('should return "Due today"', () => {
      // Use same time as current system time for exact 0 day difference
      const rfq = createMockRFQ({
        dueDate: createMockTimestamp(new Date('2024-06-15T12:00:00')) as never,
      });
      const result = formatDueDate(rfq);
      expect(result.text).toBe('Due today');
      expect(result.color).toBe('warning.main');
    });

    it('should return "Due tomorrow"', () => {
      const rfq = createMockRFQ({
        dueDate: createMockTimestamp(new Date('2024-06-16T12:00:00')) as never,
      });
      const result = formatDueDate(rfq);
      expect(result.text).toBe('Due tomorrow');
    });

    it('should return days remaining', () => {
      const rfq = createMockRFQ({
        dueDate: createMockTimestamp(new Date('2024-06-20')) as never,
      });
      const result = formatDueDate(rfq);
      expect(result.text).toMatch(/Due in \d+ days/);
      expect(result.isOverdue).toBe(false);
    });
  });

  describe('filterRFQsBySearch', () => {
    const testRFQs = [
      createMockRFQ({
        id: 'rfq-1',
        number: 'RFQ-2024-001',
        title: 'Steel Plates',
        description: 'For fabrication',
        vendorNames: ['ABC Steels'],
        projectNames: ['Project Alpha'],
      }),
      createMockRFQ({
        id: 'rfq-2',
        number: 'RFQ-2024-002',
        title: 'Pipe Fittings',
        description: 'Plumbing materials',
        vendorNames: ['XYZ Pipes'],
        projectNames: ['Project Beta'],
      }),
      createMockRFQ({
        id: 'rfq-3',
        number: 'RFQ-2024-003',
        title: 'Electrical Components',
        description: 'Motor parts',
        vendorNames: ['ABC Electronics', 'DEF Electrical'],
        projectNames: ['Project Alpha'],
      }),
    ];

    it('should return all for empty search', () => {
      expect(filterRFQsBySearch(testRFQs, '')).toHaveLength(3);
      expect(filterRFQsBySearch(testRFQs, '   ')).toHaveLength(3);
    });

    it('should filter by number', () => {
      const result = filterRFQsBySearch(testRFQs, 'RFQ-2024-001');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('rfq-1');
    });

    it('should filter by title', () => {
      const result = filterRFQsBySearch(testRFQs, 'Steel');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('rfq-1');
    });

    it('should filter by description', () => {
      const result = filterRFQsBySearch(testRFQs, 'Motor');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('rfq-3');
    });

    it('should filter by vendor name', () => {
      const result = filterRFQsBySearch(testRFQs, 'ABC');
      expect(result).toHaveLength(2); // ABC Steels and ABC Electronics
    });

    it('should filter by project name', () => {
      const result = filterRFQsBySearch(testRFQs, 'Alpha');
      expect(result).toHaveLength(2);
    });

    it('should be case insensitive', () => {
      expect(filterRFQsBySearch(testRFQs, 'steel')).toHaveLength(1);
      expect(filterRFQsBySearch(testRFQs, 'STEEL')).toHaveLength(1);
    });
  });

  describe('sortRFQs', () => {
    const testRFQs = [
      createMockRFQ({
        id: 'rfq-1',
        number: 'RFQ-2024-001',
        status: 'DRAFT',
        createdAt: createMockTimestamp(new Date('2024-01-15')) as never,
        dueDate: createMockTimestamp(new Date('2024-06-01')) as never,
      }),
      createMockRFQ({
        id: 'rfq-2',
        number: 'RFQ-2024-003',
        status: 'ISSUED',
        createdAt: createMockTimestamp(new Date('2024-06-01')) as never,
        dueDate: createMockTimestamp(new Date('2024-06-15')) as never,
      }),
      createMockRFQ({
        id: 'rfq-3',
        number: 'RFQ-2024-002',
        status: 'COMPLETED',
        createdAt: createMockTimestamp(new Date('2024-03-20')) as never,
        dueDate: createMockTimestamp(new Date('2024-05-01')) as never,
      }),
    ];

    it('should sort by createdAt descending by default', () => {
      const result = sortRFQs(testRFQs, 'createdAt');
      expect(result[0]?.id).toBe('rfq-2');
      expect(result[2]?.id).toBe('rfq-1');
    });

    it('should sort by createdAt ascending', () => {
      const result = sortRFQs(testRFQs, 'createdAt', 'asc');
      expect(result[0]?.id).toBe('rfq-1');
      expect(result[2]?.id).toBe('rfq-2');
    });

    it('should sort by number', () => {
      const result = sortRFQs(testRFQs, 'number', 'asc');
      expect(result[0]?.number).toBe('RFQ-2024-001');
      expect(result[1]?.number).toBe('RFQ-2024-002');
      expect(result[2]?.number).toBe('RFQ-2024-003');
    });

    it('should sort by dueDate', () => {
      const result = sortRFQs(testRFQs, 'dueDate', 'asc');
      expect(result[0]?.id).toBe('rfq-3'); // May 1
      expect(result[1]?.id).toBe('rfq-1'); // June 1
      expect(result[2]?.id).toBe('rfq-2'); // June 15
    });

    it('should sort by status', () => {
      const result = sortRFQs(testRFQs, 'status', 'asc');
      expect(result[0]?.status).toBe('COMPLETED');
      expect(result[1]?.status).toBe('DRAFT');
      expect(result[2]?.status).toBe('ISSUED');
    });

    it('should not mutate original array', () => {
      const original = [...testRFQs];
      sortRFQs(testRFQs, 'number');
      expect(testRFQs).toEqual(original);
    });
  });

  describe('calculateRFQStats', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle empty array', () => {
      const stats = calculateRFQStats([]);
      expect(stats.total).toBe(0);
      expect(stats.draft).toBe(0);
    });

    it('should count by status', () => {
      const rfqs = [
        createMockRFQ({ status: 'DRAFT' }),
        createMockRFQ({ status: 'DRAFT' }),
        createMockRFQ({ status: 'ISSUED' }),
        createMockRFQ({ status: 'OFFERS_RECEIVED' }),
        createMockRFQ({ status: 'UNDER_EVALUATION' }),
        createMockRFQ({ status: 'COMPLETED' }),
        createMockRFQ({ status: 'CANCELLED' }),
      ];

      const stats = calculateRFQStats(rfqs);

      expect(stats.total).toBe(7);
      expect(stats.draft).toBe(2);
      expect(stats.issued).toBe(1);
      expect(stats.offersReceived).toBe(1);
      expect(stats.underEvaluation).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.cancelled).toBe(1);
    });

    it('should count overdue RFQs', () => {
      const rfqs = [
        createMockRFQ({
          status: 'ISSUED',
          dueDate: createMockTimestamp(new Date('2024-06-10')) as never,
        }),
        createMockRFQ({
          status: 'OFFERS_RECEIVED',
          dueDate: createMockTimestamp(new Date('2024-06-01')) as never,
        }),
        createMockRFQ({
          status: 'ISSUED',
          dueDate: createMockTimestamp(new Date('2024-06-20')) as never,
        }),
      ];

      const stats = calculateRFQStats(rfqs);
      expect(stats.overdue).toBe(2);
    });

    it('should count due this week', () => {
      const rfqs = [
        createMockRFQ({
          status: 'ISSUED',
          dueDate: createMockTimestamp(new Date('2024-06-18')) as never,
        }),
        createMockRFQ({
          status: 'ISSUED',
          dueDate: createMockTimestamp(new Date('2024-06-20')) as never,
        }),
        createMockRFQ({
          status: 'ISSUED',
          dueDate: createMockTimestamp(new Date('2024-06-30')) as never,
        }),
      ];

      const stats = calculateRFQStats(rfqs);
      expect(stats.dueThisWeek).toBe(2);
    });

    it('should not count completed/cancelled in due this week', () => {
      const rfqs = [
        createMockRFQ({
          status: 'COMPLETED',
          dueDate: createMockTimestamp(new Date('2024-06-18')) as never,
        }),
        createMockRFQ({
          status: 'CANCELLED',
          dueDate: createMockTimestamp(new Date('2024-06-20')) as never,
        }),
      ];

      const stats = calculateRFQStats(rfqs);
      expect(stats.dueThisWeek).toBe(0);
    });
  });

  describe('groupRFQItemsByProject', () => {
    it('should group items by project ID', () => {
      const items = [
        createMockRFQItem({ id: 'item-1', projectId: 'project-1' }),
        createMockRFQItem({ id: 'item-2', projectId: 'project-2' }),
        createMockRFQItem({ id: 'item-3', projectId: 'project-1' }),
      ];

      const result = groupRFQItemsByProject(items);

      expect(result.get('project-1')).toHaveLength(2);
      expect(result.get('project-2')).toHaveLength(1);
    });

    it('should put items without project in no-project group', () => {
      const items = [
        createMockRFQItem({ id: 'item-1', projectId: 'project-1' }),
        createMockRFQItem({ id: 'item-2', projectId: undefined }),
      ];

      const result = groupRFQItemsByProject(items);

      expect(result.get('no-project')).toHaveLength(1);
    });
  });

  describe('groupRFQItemsByEquipment', () => {
    it('should group items by equipment ID', () => {
      const items = [
        createMockRFQItem({ id: 'item-1', equipmentId: 'eq-1' }),
        createMockRFQItem({ id: 'item-2', equipmentId: 'eq-2' }),
        createMockRFQItem({ id: 'item-3', equipmentId: 'eq-1' }),
      ];

      const result = groupRFQItemsByEquipment(items);

      expect(result.get('eq-1')).toHaveLength(2);
      expect(result.get('eq-2')).toHaveLength(1);
    });

    it('should put items without equipment in NO_EQUIPMENT group', () => {
      const items = [
        createMockRFQItem({ id: 'item-1', equipmentId: 'eq-1' }),
        createMockRFQItem({ id: 'item-2', equipmentId: undefined }),
      ];

      const result = groupRFQItemsByEquipment(items);

      expect(result.get('NO_EQUIPMENT')).toHaveLength(1);
    });
  });

  describe('calculateTotalQuantity', () => {
    it('should sum quantities', () => {
      const items = [
        createMockRFQItem({ quantity: 100 }),
        createMockRFQItem({ quantity: 200 }),
        createMockRFQItem({ quantity: 50 }),
      ];

      expect(calculateTotalQuantity(items)).toBe(350);
    });

    it('should return 0 for empty array', () => {
      expect(calculateTotalQuantity([])).toBe(0);
    });
  });

  describe('Real-world scenarios', () => {
    it('should track RFQ lifecycle', () => {
      // Create draft RFQ
      let rfq = createMockRFQ({
        status: 'DRAFT',
        vendorIds: ['v1', 'v2'],
        offersReceived: 0,
      });

      expect(canEditRFQ(rfq)).toBe(true);
      expect(canIssueRFQ(rfq)).toBe(true);
      expect(canCancelRFQ(rfq)).toBe(true);

      // Issue RFQ
      rfq = { ...rfq, status: 'ISSUED' };
      expect(canEditRFQ(rfq)).toBe(false);
      expect(canAcceptOffers(rfq)).toBe(true);

      // Offers received
      rfq = { ...rfq, status: 'OFFERS_RECEIVED', offersReceived: 2 };
      expect(canAcceptOffers(rfq)).toBe(true);
      expect(canCompleteRFQ(rfq)).toBe(true);

      // Under evaluation
      rfq = { ...rfq, status: 'UNDER_EVALUATION' };
      expect(canCompleteRFQ(rfq)).toBe(true);

      // Completed
      rfq = { ...rfq, status: 'COMPLETED' };
      expect(canCancelRFQ(rfq)).toBe(false);
      expect(canCompleteRFQ(rfq)).toBe(false);
    });

    it('should handle comprehensive stats', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-15T12:00:00'));

      const rfqs = [
        createMockRFQ({
          status: 'DRAFT',
          dueDate: undefined,
        }),
        createMockRFQ({
          status: 'ISSUED',
          dueDate: createMockTimestamp(new Date('2024-06-20')) as never,
        }),
        createMockRFQ({
          status: 'OFFERS_RECEIVED',
          dueDate: createMockTimestamp(new Date('2024-06-10')) as never, // Overdue
        }),
        createMockRFQ({
          status: 'COMPLETED',
          dueDate: createMockTimestamp(new Date('2024-06-18')) as never,
        }),
      ];

      const stats = calculateRFQStats(rfqs);

      expect(stats.total).toBe(4);
      expect(stats.draft).toBe(1);
      expect(stats.issued).toBe(1);
      expect(stats.offersReceived).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.overdue).toBe(1);
      expect(stats.dueThisWeek).toBe(1); // Only the ISSUED one

      jest.useRealTimers();
    });
  });
});
