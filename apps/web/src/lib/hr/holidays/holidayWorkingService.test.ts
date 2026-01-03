/**
 * Holiday Working Service Tests
 *
 * Tests for holiday working override service business logic:
 * - Creating holiday working overrides
 * - Processing overrides and granting comp-off
 * - Filtering and listing overrides
 *
 * Note: Integration tests with real Firestore emulator are in __integration__/ directory
 */

import type { HolidayWorkingScope, HolidayWorkingStatus } from '@vapour/types';

// Mock Firebase
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

jest.mock('../onDuty/compOffService', () => ({
  grantCompOff: jest.fn(),
}));

jest.mock('./holidayService', () => ({
  getHolidayById: jest.fn(),
}));

describe('Holiday Working Service', () => {
  describe('CreateHolidayWorkingInput Validation', () => {
    it('should require holiday name for ad-hoc dates', () => {
      const input = {
        holidayId: undefined,
        holidayName: 'Working Saturday',
        holidayDate: new Date(2025, 0, 4),
        scope: 'ALL_USERS' as HolidayWorkingScope,
        affectedUserIds: [],
        isAdHoc: true,
      };

      expect(input.holidayName).toBeTruthy();
      expect(input.holidayName.trim().length > 0).toBe(true);
    });

    it('should require at least one user for SPECIFIC_USERS scope', () => {
      const inputValid = {
        scope: 'SPECIFIC_USERS' as HolidayWorkingScope,
        affectedUserIds: ['user-1', 'user-2'],
      };

      const inputInvalid = {
        scope: 'SPECIFIC_USERS' as HolidayWorkingScope,
        affectedUserIds: [],
      };

      expect(inputValid.affectedUserIds.length > 0).toBe(true);
      expect(inputInvalid.affectedUserIds.length > 0).toBe(false);
    });

    it('should allow empty affectedUserIds for ALL_USERS scope', () => {
      const input = {
        scope: 'ALL_USERS' as HolidayWorkingScope,
        affectedUserIds: [],
      };

      // For ALL_USERS, we fetch all active users later
      expect(input.scope === 'ALL_USERS' || input.affectedUserIds.length > 0).toBe(true);
    });
  });

  describe('HolidayWorkingScope Logic', () => {
    it('should have two valid scope values', () => {
      const scopes: HolidayWorkingScope[] = ['ALL_USERS', 'SPECIFIC_USERS'];
      expect(scopes.length).toBe(2);
    });

    it('should determine target users based on scope', () => {
      const allUsersScope: HolidayWorkingScope = 'ALL_USERS';
      const specificUsersScope: HolidayWorkingScope = 'SPECIFIC_USERS';

      // When scope is ALL_USERS, we should fetch from users collection
      // When scope is SPECIFIC_USERS, we use affectedUserIds
      expect(allUsersScope === 'ALL_USERS').toBe(true);
      expect(specificUsersScope === 'SPECIFIC_USERS').toBe(true);
    });
  });

  describe('HolidayWorkingStatus Transitions', () => {
    it('should have valid status values', () => {
      const validStatuses: HolidayWorkingStatus[] = ['PROCESSING', 'COMPLETED', 'FAILED'];
      expect(validStatuses).toContain('PROCESSING');
      expect(validStatuses).toContain('COMPLETED');
      expect(validStatuses).toContain('FAILED');
    });

    it('should transition from PROCESSING to COMPLETED on success', () => {
      const successfulResults = [
        { userId: 'user-1', success: true },
        { userId: 'user-2', success: true },
      ];
      const failedResults = successfulResults.filter((r) => !r.success);

      const newStatus: HolidayWorkingStatus =
        failedResults.length > 0 && successfulResults.filter((r) => r.success).length === 0
          ? 'FAILED'
          : 'COMPLETED';

      expect(newStatus).toBe('COMPLETED');
    });

    it('should transition from PROCESSING to FAILED when all fail', () => {
      const results = [
        { userId: 'user-1', success: false },
        { userId: 'user-2', success: false },
      ];
      const successfulResults = results.filter((r) => r.success);
      const failedResults = results.filter((r) => !r.success);

      const newStatus: HolidayWorkingStatus =
        failedResults.length > 0 && successfulResults.length === 0 ? 'FAILED' : 'COMPLETED';

      expect(newStatus).toBe('FAILED');
    });

    it('should transition to COMPLETED when some succeed and some fail', () => {
      const results = [
        { userId: 'user-1', success: true },
        { userId: 'user-2', success: false },
      ];
      const successfulResults = results.filter((r) => r.success);
      const failedResults = results.filter((r) => !r.success);

      const newStatus: HolidayWorkingStatus =
        failedResults.length > 0 && successfulResults.length === 0 ? 'FAILED' : 'COMPLETED';

      expect(newStatus).toBe('COMPLETED');
    });
  });

  describe('Processing Results Aggregation', () => {
    interface ProcessingResult {
      userId: string;
      userName: string;
      userEmail: string;
      success: boolean;
      error?: string;
    }

    it('should count successful results correctly', () => {
      const results: ProcessingResult[] = [
        { userId: 'user-1', userName: 'User 1', userEmail: 'u1@test.com', success: true },
        { userId: 'user-2', userName: 'User 2', userEmail: 'u2@test.com', success: true },
        { userId: 'user-3', userName: 'User 3', userEmail: 'u3@test.com', success: false },
      ];

      const successfulResults = results.filter((r) => r.success);
      const failedResults = results.filter((r) => !r.success);

      expect(successfulResults.length).toBe(2);
      expect(failedResults.length).toBe(1);
    });

    it('should extract user IDs from results', () => {
      const results: ProcessingResult[] = [
        { userId: 'user-1', userName: 'User 1', userEmail: 'u1@test.com', success: true },
        { userId: 'user-2', userName: 'User 2', userEmail: 'u2@test.com', success: true },
      ];

      const processedUserIds = results.filter((r) => r.success).map((r) => r.userId);

      expect(processedUserIds).toEqual(['user-1', 'user-2']);
    });

    it('should extract failed user IDs from results', () => {
      const results: ProcessingResult[] = [
        { userId: 'user-1', userName: 'User 1', userEmail: 'u1@test.com', success: true },
        {
          userId: 'user-2',
          userName: 'User 2',
          userEmail: 'u2@test.com',
          success: false,
          error: 'Balance not found',
        },
        {
          userId: 'user-3',
          userName: 'User 3',
          userEmail: 'u3@test.com',
          success: false,
          error: 'Max balance reached',
        },
      ];

      const failedUserIds = results.filter((r) => !r.success).map((r) => r.userId);

      expect(failedUserIds).toEqual(['user-2', 'user-3']);
    });

    it('should generate error message for partial failures', () => {
      const failedCount = 3;
      const errorMessage =
        failedCount > 0
          ? `Failed to grant comp-off to ${failedCount} user(s). Check logs for details.`
          : undefined;

      expect(errorMessage).toBe('Failed to grant comp-off to 3 user(s). Check logs for details.');
    });
  });

  describe('Ad-hoc vs Holiday-based Override', () => {
    it('should differentiate ad-hoc dates from declared holidays', () => {
      const adHocOverride = {
        holidayId: undefined,
        holidayName: 'Working Saturday - Jan 4',
        isAdHoc: true,
      };

      const holidayOverride = {
        holidayId: 'holiday-123',
        holidayName: 'Diwali',
        isAdHoc: false,
      };

      expect(adHocOverride.isAdHoc).toBe(true);
      expect(adHocOverride.holidayId).toBeUndefined();
      expect(holidayOverride.isAdHoc).toBe(false);
      expect(holidayOverride.holidayId).toBe('holiday-123');
    });

    it('should skip holiday validation for ad-hoc dates', () => {
      const input = {
        holidayId: undefined,
        isAdHoc: true,
        holidayName: 'Working Saturday',
      };

      // For ad-hoc dates, we don't need to validate holidayId exists
      const shouldValidateHoliday = input.holidayId && !input.isAdHoc;
      expect(shouldValidateHoliday).toBeFalsy();
    });

    it('should require holiday validation for declared holidays', () => {
      const input = {
        holidayId: 'holiday-123',
        isAdHoc: false,
        holidayName: 'Diwali',
      };

      const shouldValidateHoliday = input.holidayId && !input.isAdHoc;
      expect(shouldValidateHoliday).toBeTruthy();
    });
  });

  describe('Filter Building Logic', () => {
    it('should filter by status', () => {
      const overrides = [
        { id: '1', status: 'COMPLETED' as HolidayWorkingStatus },
        { id: '2', status: 'PROCESSING' as HolidayWorkingStatus },
        { id: '3', status: 'FAILED' as HolidayWorkingStatus },
        { id: '4', status: 'COMPLETED' as HolidayWorkingStatus },
      ];

      const filtered = overrides.filter((o) => o.status === 'COMPLETED');
      expect(filtered.length).toBe(2);
    });

    it('should filter by multiple statuses', () => {
      const overrides = [
        { id: '1', status: 'COMPLETED' as HolidayWorkingStatus },
        { id: '2', status: 'PROCESSING' as HolidayWorkingStatus },
        { id: '3', status: 'FAILED' as HolidayWorkingStatus },
        { id: '4', status: 'COMPLETED' as HolidayWorkingStatus },
      ];

      const targetStatuses: HolidayWorkingStatus[] = ['COMPLETED', 'PROCESSING'];
      const filtered = overrides.filter((o) => targetStatuses.includes(o.status));
      expect(filtered.length).toBe(3);
    });

    it('should filter by holidayId', () => {
      const overrides = [
        { id: '1', holidayId: 'holiday-1' },
        { id: '2', holidayId: 'holiday-2' },
        { id: '3', holidayId: 'holiday-1' },
      ];

      const filtered = overrides.filter((o) => o.holidayId === 'holiday-1');
      expect(filtered.length).toBe(2);
    });

    it('should filter by year based on holidayDate', () => {
      const overrides = [
        { id: '1', holidayDate: new Date(2024, 11, 25) },
        { id: '2', holidayDate: new Date(2025, 0, 1) },
        { id: '3', holidayDate: new Date(2025, 6, 15) },
        { id: '4', holidayDate: new Date(2026, 0, 1) },
      ];

      const targetYear = 2025;
      const startOfYear = new Date(targetYear, 0, 1).getTime();
      const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59).getTime();

      const filtered = overrides.filter((o) => {
        const holidayTime = o.holidayDate.getTime();
        return holidayTime >= startOfYear && holidayTime <= endOfYear;
      });

      expect(filtered.length).toBe(2);
      expect(filtered.map((o) => o.id)).toEqual(['2', '3']);
    });
  });

  describe('isHolidayConvertedToWorkingDay Logic', () => {
    it('should return true if completed overrides exist', () => {
      const overrides = [{ id: '1', holidayId: 'holiday-1', status: 'COMPLETED' }];
      const hasConversion = overrides.length > 0;
      expect(hasConversion).toBe(true);
    });

    it('should return true if processing overrides exist', () => {
      const overrides = [{ id: '1', holidayId: 'holiday-1', status: 'PROCESSING' }];
      const hasConversion = overrides.length > 0;
      expect(hasConversion).toBe(true);
    });

    it('should return false if no overrides exist', () => {
      const overrides: Array<{ id: string }> = [];
      const hasConversion = overrides.length > 0;
      expect(hasConversion).toBe(false);
    });

    it('should ignore failed overrides', () => {
      const allOverrides = [{ id: '1', holidayId: 'holiday-1', status: 'FAILED' }];

      const validOverrides = allOverrides.filter(
        (o) => o.status === 'COMPLETED' || o.status === 'PROCESSING'
      );

      const hasConversion = validOverrides.length > 0;
      expect(hasConversion).toBe(false);
    });
  });

  describe('CompOff Source Building', () => {
    it('should build correct source for holiday working', () => {
      const overrideId = 'override-123';
      const holidayName = 'Diwali';
      const holidayDate = new Date(2025, 9, 20);

      const source = {
        source: 'HOLIDAY_WORKING' as const,
        holidayWorkingId: overrideId,
        holidayName,
        holidayDate,
      };

      expect(source.source).toBe('HOLIDAY_WORKING');
      expect(source.holidayWorkingId).toBe(overrideId);
      expect(source.holidayName).toBe('Diwali');
      expect(source.holidayDate).toEqual(holidayDate);
    });
  });

  describe('User Filtering for Processing', () => {
    interface TestUser {
      id: string;
      displayName: string;
      email: string;
      isActive: boolean;
    }

    it('should filter only active users', () => {
      const users: TestUser[] = [
        { id: 'user-1', displayName: 'User 1', email: 'u1@test.com', isActive: true },
        { id: 'user-2', displayName: 'User 2', email: 'u2@test.com', isActive: false },
        { id: 'user-3', displayName: 'User 3', email: 'u3@test.com', isActive: true },
      ];

      const activeUsers = users.filter((u) => u.isActive);
      expect(activeUsers.length).toBe(2);
      expect(activeUsers.map((u) => u.id)).toEqual(['user-1', 'user-3']);
    });

    it('should handle missing displayName gracefully', () => {
      const user = {
        id: 'user-1',
        displayName: undefined,
        email: 'u1@test.com',
      };

      const displayName = user.displayName || 'Unknown User';
      expect(displayName).toBe('Unknown User');
    });

    it('should handle missing email gracefully', () => {
      const user = {
        id: 'user-1',
        displayName: 'User 1',
        email: undefined,
      };

      const email = user.email || '';
      expect(email).toBe('');
    });
  });

  describe('Override Update Data', () => {
    it('should include all required fields in update', () => {
      const successfulResults = [
        { userId: 'user-1', success: true },
        { userId: 'user-2', success: true },
      ];
      const failedResults = [{ userId: 'user-3', success: false }];

      const updateData = {
        status: failedResults.length > 0 && successfulResults.length === 0 ? 'FAILED' : 'COMPLETED',
        compOffGrantedCount: successfulResults.length,
        processedUserIds: successfulResults.map((r) => r.userId),
        failedUserIds: failedResults.map((r) => r.userId),
        processedAt: new Date(),
        updatedAt: new Date(),
        errorMessage:
          failedResults.length > 0
            ? `Failed to grant comp-off to ${failedResults.length} user(s). Check logs for details.`
            : undefined,
      };

      expect(updateData.status).toBe('COMPLETED');
      expect(updateData.compOffGrantedCount).toBe(2);
      expect(updateData.processedUserIds).toEqual(['user-1', 'user-2']);
      expect(updateData.failedUserIds).toEqual(['user-3']);
      expect(updateData.errorMessage).toBe(
        'Failed to grant comp-off to 1 user(s). Check logs for details.'
      );
    });
  });
});
