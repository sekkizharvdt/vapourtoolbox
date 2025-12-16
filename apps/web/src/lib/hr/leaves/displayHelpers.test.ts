/**
 * Leave Display Helpers Tests
 *
 * Tests for HR leave module display utilities:
 * - Status color mappings
 * - Status label mappings
 * - Date formatting functions
 */

import {
  LEAVE_STATUS_COLORS,
  LEAVE_STATUS_LABELS,
  formatLeaveDate,
  formatLeaveDateTime,
  getLeaveStatusDisplay,
} from './displayHelpers';

describe('Leave Display Helpers', () => {
  describe('LEAVE_STATUS_COLORS', () => {
    it('should have all required status colors', () => {
      expect(LEAVE_STATUS_COLORS.DRAFT).toBe('default');
      expect(LEAVE_STATUS_COLORS.PENDING_APPROVAL).toBe('warning');
      expect(LEAVE_STATUS_COLORS.APPROVED).toBe('success');
      expect(LEAVE_STATUS_COLORS.REJECTED).toBe('error');
      expect(LEAVE_STATUS_COLORS.CANCELLED).toBe('info');
    });

    it('should have exactly 5 statuses', () => {
      const statusCount = Object.keys(LEAVE_STATUS_COLORS).length;
      expect(statusCount).toBe(5);
    });
  });

  describe('LEAVE_STATUS_LABELS', () => {
    it('should have human-readable labels for all statuses', () => {
      expect(LEAVE_STATUS_LABELS.DRAFT).toBe('Draft');
      expect(LEAVE_STATUS_LABELS.PENDING_APPROVAL).toBe('Pending Approval');
      expect(LEAVE_STATUS_LABELS.APPROVED).toBe('Approved');
      expect(LEAVE_STATUS_LABELS.REJECTED).toBe('Rejected');
      expect(LEAVE_STATUS_LABELS.CANCELLED).toBe('Cancelled');
    });

    it('should have exactly 5 labels', () => {
      const labelCount = Object.keys(LEAVE_STATUS_LABELS).length;
      expect(labelCount).toBe(5);
    });
  });

  describe('formatLeaveDate', () => {
    it('should format date in Indian English locale', () => {
      const date = new Date(2025, 11, 15); // Dec 15, 2025
      const formatted = formatLeaveDate(date);

      // Format should be "15 Dec 2025" or similar locale-specific format
      expect(formatted).toMatch(/15.*Dec.*2025/i);
    });

    it('should handle single-digit dates', () => {
      const date = new Date(2025, 0, 5); // Jan 5, 2025
      const formatted = formatLeaveDate(date);

      expect(formatted).toMatch(/0?5.*Jan.*2025/i);
    });

    it('should handle different months', () => {
      const months = [
        { month: 0, name: 'Jan' },
        { month: 3, name: 'Apr' },
        { month: 6, name: 'Jul' },
        { month: 11, name: 'Dec' },
      ];

      months.forEach(({ month, name }) => {
        const date = new Date(2025, month, 10);
        const formatted = formatLeaveDate(date);
        expect(formatted).toContain(name);
      });
    });
  });

  describe('formatLeaveDateTime', () => {
    it('should format date and time in Indian English locale', () => {
      const date = new Date(2025, 11, 15, 14, 30); // Dec 15, 2025, 14:30
      const formatted = formatLeaveDateTime(date);

      // Should include date parts and time
      expect(formatted).toMatch(/15.*Dec.*2025/i);
      expect(formatted).toMatch(/14:30|2:30/i); // 24h or 12h format
    });

    it('should handle midnight time', () => {
      const date = new Date(2025, 5, 20, 0, 0); // Jun 20, 2025, 00:00
      const formatted = formatLeaveDateTime(date);

      expect(formatted).toMatch(/20.*Jun.*2025/i);
      expect(formatted).toMatch(/00:00|12:00/i);
    });

    it('should handle noon time', () => {
      const date = new Date(2025, 5, 20, 12, 0); // Jun 20, 2025, 12:00
      const formatted = formatLeaveDateTime(date);

      expect(formatted).toMatch(/12:00/i);
    });
  });

  describe('getLeaveStatusDisplay', () => {
    it('should return correct display properties for DRAFT status', () => {
      const display = getLeaveStatusDisplay('DRAFT');

      expect(display.label).toBe('Draft');
      expect(display.color).toBe('default');
    });

    it('should return correct display properties for PENDING_APPROVAL status', () => {
      const display = getLeaveStatusDisplay('PENDING_APPROVAL');

      expect(display.label).toBe('Pending Approval');
      expect(display.color).toBe('warning');
    });

    it('should return correct display properties for APPROVED status', () => {
      const display = getLeaveStatusDisplay('APPROVED');

      expect(display.label).toBe('Approved');
      expect(display.color).toBe('success');
    });

    it('should return correct display properties for REJECTED status', () => {
      const display = getLeaveStatusDisplay('REJECTED');

      expect(display.label).toBe('Rejected');
      expect(display.color).toBe('error');
    });

    it('should return correct display properties for CANCELLED status', () => {
      const display = getLeaveStatusDisplay('CANCELLED');

      expect(display.label).toBe('Cancelled');
      expect(display.color).toBe('info');
    });

    it('should return consistent results when called multiple times', () => {
      const display1 = getLeaveStatusDisplay('APPROVED');
      const display2 = getLeaveStatusDisplay('APPROVED');

      expect(display1).toEqual(display2);
    });
  });
});
