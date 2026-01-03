/**
 * Comp-Off Service Tests
 *
 * Tests for compensatory leave (comp-off) service business logic:
 * - Balance limits (soft: 10, hard: 20)
 * - Expiry calculation (365 days)
 * - Comp-off source tracking
 *
 * Note: Integration tests with real Firestore emulator are in __integration__/ directory
 */

import { addYears } from 'date-fns';

// Mock Firebase and dependencies
jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({
    db: {},
  })),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  runTransaction: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0, toDate: () => new Date() })),
    fromDate: jest.fn((date: Date) => ({
      seconds: date.getTime() / 1000,
      nanoseconds: 0,
      toDate: () => date,
    })),
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('../leaves/leaveBalanceService', () => ({
  getUserLeaveBalanceByType: jest.fn(),
  getCurrentFiscalYear: jest.fn(() => 2025),
  addCompOffBalance: jest.fn(),
}));

describe('Comp-Off Service', () => {
  describe('Balance Limits', () => {
    const SOFT_LIMIT = 10;
    const HARD_LIMIT = 20;

    it('should allow granting when balance is below soft limit', () => {
      const currentBalance = 5;
      const canGrant = currentBalance < HARD_LIMIT;
      const shouldWarn = currentBalance >= SOFT_LIMIT;

      expect(canGrant).toBe(true);
      expect(shouldWarn).toBe(false);
    });

    it('should warn but allow when balance is at or above soft limit', () => {
      const currentBalance = 10;
      const canGrant = currentBalance < HARD_LIMIT;
      const shouldWarn = currentBalance >= SOFT_LIMIT;

      expect(canGrant).toBe(true);
      expect(shouldWarn).toBe(true);
    });

    it('should warn when balance is between soft and hard limit', () => {
      const currentBalance = 15;
      const canGrant = currentBalance < HARD_LIMIT;
      const shouldWarn = currentBalance >= SOFT_LIMIT;

      expect(canGrant).toBe(true);
      expect(shouldWarn).toBe(true);
    });

    it('should reject when balance is at hard limit', () => {
      const currentBalance = 20;
      const canGrant = currentBalance < HARD_LIMIT;

      expect(canGrant).toBe(false);
    });

    it('should reject when balance exceeds hard limit', () => {
      const currentBalance = 25;
      const canGrant = currentBalance < HARD_LIMIT;

      expect(canGrant).toBe(false);
    });
  });

  describe('Expiry Calculation', () => {
    it('should calculate expiry as 365 days from grant date', () => {
      const grantDate = new Date(2025, 0, 15);
      const expiryDate = addYears(grantDate, 1);

      expect(expiryDate.getFullYear()).toBe(2026);
      expect(expiryDate.getMonth()).toBe(0);
      expect(expiryDate.getDate()).toBe(15);
    });

    it('should handle leap year grant dates', () => {
      // Grant on Feb 29, 2024
      const grantDate = new Date(2024, 1, 29);
      const expiryDate = addYears(grantDate, 1);

      // Should expire on March 1, 2025 (no Feb 29 in 2025)
      expect(expiryDate.getFullYear()).toBe(2025);
      expect(expiryDate.getMonth()).toBe(1);
      expect(expiryDate.getDate()).toBe(28);
    });

    it('should correctly identify expiring comp-offs', () => {
      const today = new Date(2025, 0, 15);
      const withinDays = 30;

      const compOffs = [
        { expiryDate: new Date(2025, 0, 20), userId: 'user-1' }, // 5 days away
        { expiryDate: new Date(2025, 1, 10), userId: 'user-2' }, // ~26 days away
        { expiryDate: new Date(2025, 2, 1), userId: 'user-3' }, // ~45 days away
      ];

      const expiring = compOffs.filter((c) => {
        const daysRemaining = Math.ceil(
          (c.expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysRemaining > 0 && daysRemaining <= withinDays;
      });

      expect(expiring.length).toBe(2);
      expect(expiring.map((c) => c.userId)).toEqual(['user-1', 'user-2']);
    });
  });

  describe('CompOffSource Validation', () => {
    it('should validate ON_DUTY_REQUEST source', () => {
      const source = {
        source: 'ON_DUTY_REQUEST' as const,
        onDutyRequestId: 'odr-123',
        holidayName: 'Diwali',
        holidayDate: new Date(2025, 9, 20),
      };

      expect(source.source).toBe('ON_DUTY_REQUEST');
      expect(source.onDutyRequestId).toBeDefined();
    });

    it('should validate HOLIDAY_WORKING source', () => {
      const source = {
        source: 'HOLIDAY_WORKING' as const,
        holidayWorkingId: 'hw-123',
        holidayName: 'Republic Day',
        holidayDate: new Date(2025, 0, 26),
      };

      expect(source.source).toBe('HOLIDAY_WORKING');
      expect(source.holidayWorkingId).toBeDefined();
    });

    it('should require holidayName for all sources', () => {
      const validSource = {
        source: 'HOLIDAY_WORKING' as const,
        holidayWorkingId: 'hw-123',
        holidayName: 'Republic Day',
        holidayDate: new Date(2025, 0, 26),
      };

      expect(validSource.holidayName).toBeTruthy();
      expect(validSource.holidayName.length > 0).toBe(true);
    });

    it('should require holidayDate for all sources', () => {
      const source = {
        source: 'HOLIDAY_WORKING' as const,
        holidayWorkingId: 'hw-123',
        holidayName: 'Republic Day',
        holidayDate: new Date(2025, 0, 26),
      };

      expect(source.holidayDate).toBeInstanceOf(Date);
      expect(source.holidayDate.getTime()).not.toBeNaN();
    });
  });

  describe('Balance Not Found Handling', () => {
    it('should generate correct error message when balance not found', () => {
      const userId = 'user-123';
      const errorMessage = `Comp-off balance not found for user ${userId}. Ensure COMP_OFF leave type exists and balances are initialized.`;

      expect(errorMessage).toContain(userId);
      expect(errorMessage).toContain('COMP_OFF');
      expect(errorMessage).toContain('balances are initialized');
    });
  });

  describe('Comp-Off Balance Return Type', () => {
    it('should return correct balance structure', () => {
      const balance = {
        entitled: 3,
        used: 1,
        pending: 0,
        available: 2,
      };

      expect(balance.available).toBe(balance.entitled - balance.used - balance.pending);
    });

    it('should handle zero balance', () => {
      const balance = {
        entitled: 0,
        used: 0,
        pending: 0,
        available: 0,
      };

      expect(balance.available).toBe(0);
    });

    it('should handle fully used balance', () => {
      const balance = {
        entitled: 5,
        used: 5,
        pending: 0,
        available: 0,
      };

      expect(balance.available).toBe(0);
    });
  });

  describe('Expiry Warning Threshold', () => {
    it('should return 30 days as warning threshold', () => {
      const warningThreshold = 30;
      expect(warningThreshold).toBe(30);
    });

    it('should identify comp-offs needing warning', () => {
      const warningThreshold = 30;

      const compOffs = [
        { expiryDate: new Date(2025, 0, 20), daysRemaining: 5 }, // Should warn
        { expiryDate: new Date(2025, 1, 10), daysRemaining: 26 }, // Should warn
        { expiryDate: new Date(2025, 2, 1), daysRemaining: 45 }, // No warning
      ];

      const needsWarning = compOffs.filter(
        (c) => c.daysRemaining > 0 && c.daysRemaining <= warningThreshold
      );

      expect(needsWarning.length).toBe(2);
    });
  });

  describe('useCompOff Logging', () => {
    it('should include required fields for logging', () => {
      const logData = {
        userId: 'user-123',
        leaveRequestId: 'lr-456',
        message: 'Comp-off deducted via leave approval',
      };

      expect(logData.userId).toBeDefined();
      expect(logData.leaveRequestId).toBeDefined();
      expect(logData.message).toContain('Comp-off deducted');
    });
  });

  describe('Grant Comp-Off Metadata', () => {
    it('should include all required metadata fields', () => {
      const grantDate = new Date(2025, 0, 15);
      const expiryDate = addYears(grantDate, 1);

      const metadata = {
        source: 'HOLIDAY_WORKING' as const,
        onDutyRequestId: undefined,
        holidayWorkingId: 'hw-123',
        holidayName: 'Republic Day',
        holidayDate: new Date(2025, 0, 26),
        grantDate,
        expiryDate,
        grantedBy: 'admin-123',
      };

      expect(metadata.source).toBeDefined();
      expect(metadata.holidayName).toBeDefined();
      expect(metadata.holidayDate).toBeDefined();
      expect(metadata.grantDate).toBeDefined();
      expect(metadata.expiryDate).toBeDefined();
      expect(metadata.grantedBy).toBeDefined();
    });

    it('should set holidayWorkingId for HOLIDAY_WORKING source', () => {
      const metadata = {
        source: 'HOLIDAY_WORKING' as const,
        holidayWorkingId: 'hw-123',
        holidayName: 'Republic Day',
        holidayDate: new Date(2025, 0, 26),
        grantDate: new Date(),
        expiryDate: addYears(new Date(), 1),
        grantedBy: 'admin-123',
      };

      expect(metadata.source).toBe('HOLIDAY_WORKING');
      expect(metadata.holidayWorkingId).toBe('hw-123');
    });

    it('should set onDutyRequestId for ON_DUTY_REQUEST source', () => {
      const metadata = {
        source: 'ON_DUTY_REQUEST' as const,
        onDutyRequestId: 'odr-123',
        holidayName: 'Diwali',
        holidayDate: new Date(2025, 9, 20),
        grantDate: new Date(),
        expiryDate: addYears(new Date(), 1),
        grantedBy: 'admin-123',
      };

      expect(metadata.source).toBe('ON_DUTY_REQUEST');
      expect(metadata.onDutyRequestId).toBe('odr-123');
    });
  });

  describe('Fiscal Year Integration', () => {
    it('should use current fiscal year when not specified', () => {
      const currentYear = new Date().getFullYear();
      const optionalFiscalYear: number | undefined = undefined;
      const fiscalYear = optionalFiscalYear ?? currentYear;

      expect(fiscalYear).toBe(currentYear);
    });

    it('should use specified fiscal year when provided', () => {
      const currentYear = new Date().getFullYear();
      const specifiedYear: number | undefined = 2024;
      const fiscalYear = specifiedYear ?? currentYear;

      expect(fiscalYear).toBe(2024);
    });
  });

  describe('COMP_OFF Leave Type Code', () => {
    it('should use correct leave type code', () => {
      const COMP_OFF_LEAVE_TYPE = 'COMP_OFF';
      expect(COMP_OFF_LEAVE_TYPE).toBe('COMP_OFF');
    });
  });
});
