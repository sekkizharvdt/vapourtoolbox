/**
 * HR Holiday Management Types
 *
 * Types for company holidays and recurring holiday configuration
 */

import { Timestamp } from 'firebase/firestore';
import { TimestampFields } from '../common';

// ============================================
// Holiday Type Classification
// ============================================

/**
 * Holiday type classification
 */
export type HolidayType = 'COMPANY' | 'NATIONAL' | 'OPTIONAL';

// ============================================
// Company Holiday
// ============================================

/**
 * Company holiday document (stored in hrHolidays collection)
 */
export interface Holiday extends TimestampFields {
  id: string;
  name: string; // e.g., "Diwali", "Pongal", "Independence Day"
  date: Timestamp;
  year: number; // Calendar year for easier querying
  type: HolidayType;
  description?: string;
  color?: string; // Display color for calendar
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Input for creating a new holiday
 */
export interface CreateHolidayInput {
  name: string;
  date: Date;
  type: HolidayType;
  description?: string;
  color?: string;
}

/**
 * Input for updating a holiday
 */
export interface UpdateHolidayInput {
  name?: string;
  date?: Date;
  type?: HolidayType;
  description?: string;
  color?: string;
  isActive?: boolean;
}

// ============================================
// Recurring Holiday Configuration
// ============================================

/**
 * Configuration for recurring holidays (stored in hrConfig/leaveSettings)
 */
export interface RecurringHolidayConfig {
  sundays: boolean; // All Sundays are holidays
  firstSaturday: boolean; // 1st Saturday of each month is a holiday
  thirdSaturday: boolean; // 3rd Saturday of each month is a holiday
}

/**
 * Default recurring holiday configuration
 */
export const DEFAULT_RECURRING_HOLIDAY_CONFIG: RecurringHolidayConfig = {
  sundays: true,
  firstSaturday: true,
  thirdSaturday: true,
};

// ============================================
// Leave Balance Reset Configuration
// ============================================

/**
 * Configuration for annual leave balance reset
 */
export interface LeaveBalanceResetConfig {
  resetDay: number; // Day of month (1-31)
  resetMonth: number; // Month (1-12, where 1 = January)
  sickLeaveQuota: number; // Annual sick leave days
  casualLeaveQuota: number; // Annual casual leave days
  carryForwardEnabled: boolean;
  maxCarryForward: number; // Maximum days that can be carried forward
}

/**
 * Default leave balance reset configuration
 */
export const DEFAULT_LEAVE_BALANCE_RESET_CONFIG: LeaveBalanceResetConfig = {
  resetDay: 1,
  resetMonth: 1, // January
  sickLeaveQuota: 12,
  casualLeaveQuota: 12,
  carryForwardEnabled: false,
  maxCarryForward: 0,
};

// ============================================
// Calendar Display Types
// ============================================

/**
 * Holiday entry for calendar display
 */
export interface HolidayCalendarEntry {
  date: Date;
  name: string;
  type: 'RECURRING' | 'COMPANY';
  holidayType?: HolidayType; // For company holidays
  color: string;
}

/**
 * Combined calendar entry (holiday or leave)
 */
export interface CalendarEntry {
  date: Date;
  entryType: 'HOLIDAY' | 'LEAVE';
  name: string;
  color: string;
  // For holidays
  holidayType?: 'RECURRING' | 'COMPANY';
  // For leaves
  employeeId?: string;
  employeeName?: string;
  leaveType?: string;
}

// ============================================
// Holiday Filters
// ============================================

/**
 * Filters for listing holidays
 */
export interface HolidayFilters {
  year?: number;
  type?: HolidayType;
  isActive?: boolean;
}
