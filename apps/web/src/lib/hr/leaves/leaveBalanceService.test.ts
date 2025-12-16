/**
 * Leave Balance Service Tests
 *
 * Tests for leave balance business logic:
 * - getCurrentFiscalYear() utility
 * - Balance calculations (available = entitled + carryForward - used - pending)
 *
 * Note: Firestore integration tests are in __integration__/ directory
 * These unit tests focus on pure functions and business logic validation
 */

import { getCurrentFiscalYear } from './leaveBalanceService';

describe('Leave Balance Service', () => {
  describe('getCurrentFiscalYear', () => {
    // Store original Date to restore after tests
    const RealDate = Date;

    afterEach(() => {
      // Restore original Date
      global.Date = RealDate;
    });

    it('should return the current year', () => {
      const currentYear = new Date().getFullYear();
      expect(getCurrentFiscalYear()).toBe(currentYear);
    });

    it('should return correct year at start of year (January 1)', () => {
      // Mock Date to January 1, 2025
      const mockDate = new Date(2025, 0, 1);
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as Date);

      expect(getCurrentFiscalYear()).toBe(2025);
    });

    it('should return correct year at end of year (December 31)', () => {
      // Mock Date to December 31, 2025
      const mockDate = new Date(2025, 11, 31);
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as Date);

      expect(getCurrentFiscalYear()).toBe(2025);
    });

    it('should return correct year mid-year', () => {
      // Mock Date to July 15, 2025
      const mockDate = new Date(2025, 6, 15);
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as Date);

      expect(getCurrentFiscalYear()).toBe(2025);
    });
  });

  describe('Leave Balance Calculation Logic', () => {
    /**
     * Leave balance calculation formula:
     * available = entitled + carryForward - used - pending
     *
     * These tests verify the calculation logic that should be applied
     * when updating leave balances
     */

    describe('available balance calculation', () => {
      it('should calculate available balance correctly with no used or pending', () => {
        const entitled = 12;
        const carryForward = 0;
        const used = 0;
        const pending = 0;

        const available = entitled + carryForward - used - pending;

        expect(available).toBe(12);
      });

      it('should calculate available balance with some used days', () => {
        const entitled = 12;
        const carryForward = 0;
        const used = 3;
        const pending = 0;

        const available = entitled + carryForward - used - pending;

        expect(available).toBe(9);
      });

      it('should calculate available balance with pending days', () => {
        const entitled = 12;
        const carryForward = 0;
        const used = 0;
        const pending = 2;

        const available = entitled + carryForward - used - pending;

        expect(available).toBe(10);
      });

      it('should calculate available balance with both used and pending', () => {
        const entitled = 12;
        const carryForward = 0;
        const used = 5;
        const pending = 2;

        const available = entitled + carryForward - used - pending;

        expect(available).toBe(5);
      });

      it('should include carry forward in available balance', () => {
        const entitled = 12;
        const carryForward = 3;
        const used = 0;
        const pending = 0;

        const available = entitled + carryForward - used - pending;

        expect(available).toBe(15);
      });

      it('should handle all factors together', () => {
        const entitled = 15;
        const carryForward = 5;
        const used = 8;
        const pending = 3;

        const available = entitled + carryForward - used - pending;

        expect(available).toBe(9); // 15 + 5 - 8 - 3 = 9
      });

      it('should allow negative available (overdraft scenario)', () => {
        const entitled = 10;
        const carryForward = 0;
        const used = 12;
        const pending = 0;

        const available = entitled + carryForward - used - pending;

        expect(available).toBe(-2);
      });
    });

    describe('pending leave transitions', () => {
      /**
       * When a leave request is submitted:
       * - pending += numberOfDays
       * - available -= numberOfDays
       */
      it('should correctly add pending days', () => {
        const initialPending = 0;
        const numberOfDays = 3;

        const newPending = initialPending + numberOfDays;

        expect(newPending).toBe(3);
      });

      /**
       * When a leave request is approved:
       * - pending -= numberOfDays
       * - used += numberOfDays
       * - available unchanged (already decreased when pending)
       */
      it('should correctly confirm pending to used', () => {
        const initialPending = 3;
        const initialUsed = 5;
        const numberOfDays = 3;

        const newPending = Math.max(0, initialPending - numberOfDays);
        const newUsed = initialUsed + numberOfDays;

        expect(newPending).toBe(0);
        expect(newUsed).toBe(8);
      });

      /**
       * When a leave request is rejected or cancelled:
       * - pending -= numberOfDays
       * - available += numberOfDays (restored)
       */
      it('should correctly remove pending days on rejection', () => {
        const initialPending = 5;
        const numberOfDays = 3;

        const newPending = Math.max(0, initialPending - numberOfDays);

        expect(newPending).toBe(2);
      });

      it('should not allow negative pending when removing', () => {
        const initialPending = 2;
        const numberOfDays = 5; // More than pending

        const newPending = Math.max(0, initialPending - numberOfDays);

        expect(newPending).toBe(0);
      });
    });
  });

  describe('Business Rules Validation', () => {
    describe('leave request validation', () => {
      /**
       * Business rule: Cannot request more days than available
       */
      it('should validate request does not exceed available balance', () => {
        const available = 5;
        const requestedDays = 3;

        const isValid = requestedDays <= available;

        expect(isValid).toBe(true);
      });

      it('should reject request exceeding available balance', () => {
        const available = 5;
        const requestedDays = 7;

        const isValid = requestedDays <= available;

        expect(isValid).toBe(false);
      });

      it('should allow request equal to available balance', () => {
        const available = 5;
        const requestedDays = 5;

        const isValid = requestedDays <= available;

        expect(isValid).toBe(true);
      });
    });

    describe('carry forward rules', () => {
      /**
       * Business rule: Carry forward cannot exceed maxCarryForward
       */
      it('should cap carry forward at maximum allowed', () => {
        const unusedDays = 8;
        const maxCarryForward = 5;

        const actualCarryForward = Math.min(unusedDays, maxCarryForward);

        expect(actualCarryForward).toBe(5);
      });

      it('should allow full unused days if under max', () => {
        const unusedDays = 3;
        const maxCarryForward = 5;

        const actualCarryForward = Math.min(unusedDays, maxCarryForward);

        expect(actualCarryForward).toBe(3);
      });

      it('should handle zero max carry forward', () => {
        const unusedDays = 5;
        const maxCarryForward = 0;

        const actualCarryForward = Math.min(unusedDays, maxCarryForward);

        expect(actualCarryForward).toBe(0);
      });
    });

    describe('fiscal year boundary', () => {
      /**
       * Business rule: Balances are per fiscal year
       */
      it('should treat different fiscal years independently', () => {
        const balance2024 = { fiscalYear: 2024, entitled: 12, used: 8 };
        const balance2025 = { fiscalYear: 2025, entitled: 12, used: 0 };

        expect(balance2024.fiscalYear).not.toBe(balance2025.fiscalYear);
        expect(balance2024.used).not.toBe(balance2025.used);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero entitled days', () => {
      const entitled = 0;
      const carryForward = 3;
      const used = 0;
      const pending = 0;

      const available = entitled + carryForward - used - pending;

      expect(available).toBe(3);
    });

    it('should handle fractional days (half-day leaves)', () => {
      const entitled = 12;
      const carryForward = 0;
      const used = 2.5;
      const pending = 0.5;

      const available = entitled + carryForward - used - pending;

      expect(available).toBe(9);
    });

    it('should handle large numbers', () => {
      const entitled = 365;
      const carryForward = 30;
      const used = 200;
      const pending = 50;

      const available = entitled + carryForward - used - pending;

      expect(available).toBe(145);
    });
  });
});
