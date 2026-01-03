/**
 * Holiday Working Override Types
 *
 * Types for admin bulk action to convert holidays to working days.
 * Grants compensatory leave to all or specific users.
 */

import { Timestamp } from 'firebase/firestore';
import { TimestampFields } from '../common';

// ============================================
// Holiday Working Scope
// ============================================

/**
 * Scope of holiday working override
 */
export type HolidayWorkingScope = 'ALL_USERS' | 'SPECIFIC_USERS';

/**
 * Processing status for holiday working override
 */
export type HolidayWorkingStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

// ============================================
// Holiday Working Override
// ============================================

/**
 * Holiday working override - admin converts a holiday to a working day
 * Automatically grants comp-off to affected users
 */
export interface HolidayWorkingOverride extends TimestampFields {
  id: string;

  // Holiday Details
  holidayId?: string; // Reference to hrHolidays document (optional for ad-hoc dates like Sat/Sun)
  holidayName: string;
  holidayDate: Timestamp;
  isAdHoc?: boolean; // True if this is an ad-hoc date (Saturday/Sunday), not a declared holiday

  // Scope
  scope: HolidayWorkingScope;
  affectedUserIds: string[]; // Empty array if ALL_USERS, specific user IDs if SPECIFIC_USERS

  // Processing Results
  compOffGrantedCount: number; // Number of users successfully granted comp-off
  processedUserIds: string[]; // User IDs that were processed
  failedUserIds: string[]; // User IDs that failed (if any)

  // Admin Metadata
  createdBy: string; // Admin user ID
  createdByName: string;
  createdByEmail: string;
  reason?: string; // Optional reason for converting holiday

  // Processing Status
  status: HolidayWorkingStatus;
  processedAt?: Timestamp; // When processing completed
  errorMessage?: string; // Error details if status is FAILED
}

// ============================================
// Input Types
// ============================================

/**
 * Input for creating holiday working override
 */
export interface CreateHolidayWorkingInput {
  holidayId?: string; // Optional for ad-hoc dates (Saturdays/Sundays)
  holidayName: string;
  holidayDate: Date;
  scope: HolidayWorkingScope;
  affectedUserIds: string[]; // Required if scope is SPECIFIC_USERS, ignored if ALL_USERS
  reason?: string;
  isAdHoc?: boolean; // True if this is an ad-hoc date, not a declared holiday
}

/**
 * Filters for querying holiday working overrides
 */
export interface HolidayWorkingOverrideFilters {
  holidayId?: string;
  status?: HolidayWorkingStatus | HolidayWorkingStatus[];
  createdBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Result of processing a single user for holiday working
 */
export interface HolidayWorkingUserResult {
  userId: string;
  userName: string;
  userEmail: string;
  success: boolean;
  error?: string;
}
